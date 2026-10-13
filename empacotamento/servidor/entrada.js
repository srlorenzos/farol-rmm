// Ponto de entrada do farol-servidor.exe (Node SEA). Empacotado por build.mjs, que registra os módulos do
// servidor em globalThis.__FAROL_MODULOS__ e chama iniciar(). Não é usado fora do executável.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';

const VERSAO = process.env.FAROL_VERSAO_BUILD || '0.0.0';
const NOME_TAREFA = 'Farol Servidor';
const AJUDA = `Farol RMM servidor ${VERSAO}

Uso: farol-servidor.exe [comando]

  (sem comando)            inicia o servidor e o painel (padrão http://127.0.0.1:8420)
  criar-admin --usuario U --senha S   cria o administrador (ou abra o painel para o setup inicial)
  instalar-tarefa          registra o servidor para iniciar com o Windows (Tarefa Agendada como SYSTEM; exige administrador)
  remover-tarefa           remove essa tarefa
  versao                   mostra a versão

Variáveis: PORT, HOST, URL_PUBLICA, DB, WEBHOOK_URL, FAROL_DADOS (pasta de dados; padrão %ProgramData%\\FarolServidor).
Dados, banco e .env ficam na pasta de dados; o painel e a biblioteca são extraídos de dentro do exe para ela.
`;

function pastaDados() {
  return process.env.FAROL_DADOS || (process.platform === 'win32'
    ? join(process.env.ProgramData || 'C:\\ProgramData', 'FarolServidor')
    : join(process.env.HOME || '.', '.farol-servidor'));
}

/** Extrai painel, biblioteca e agente (embutidos no exe) para a pasta de dados, só quando mudam. */
function extrairRecursos(dados) {
  const sea = createRequire(import.meta.url)('node:sea');
  const bruto = Buffer.from(sea.getAsset('recursos.gz'));
  const destino = join(dados, 'recursos');
  const marca = join(destino, '.versao');
  const hash = `${VERSAO}:${bruto.length}`;
  if (existsSync(marca) && readFileSync(marca, 'utf8') === hash) return destino;
  const arquivos = JSON.parse(gunzipSync(bruto).toString('utf8'));
  rmSync(destino, { recursive: true, force: true });
  for (const [rel, b64] of Object.entries(arquivos)) {
    const alvo = join(destino, rel);
    mkdirSync(dirname(alvo), { recursive: true });
    writeFileSync(alvo, Buffer.from(b64, 'base64'));
  }
  writeFileSync(marca, hash);
  return destino;
}

function tarefa(acao) {
  if (process.platform !== 'win32') { console.error('Só no Windows.'); return 1; }
  const exe = process.execPath;
  if (acao === 'remover') {
    spawnSync('schtasks.exe', ['/End', '/TN', NOME_TAREFA], { stdio: 'ignore' });
    const r = spawnSync('schtasks.exe', ['/Delete', '/TN', NOME_TAREFA, '/F'], { encoding: 'utf8' });
    console.log(r.status === 0 ? 'Tarefa removida.' : (r.stderr || r.stdout || 'Tarefa não encontrada.').trim());
    return r.status === 0 ? 0 : 1;
  }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Servidor do Farol RMM</Description></RegistrationInfo>
  <Triggers><BootTrigger><Enabled>true</Enabled></BootTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>S-1-5-18</UserId><RunLevel>HighestAvailable</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure><Interval>PT1M</Interval><Count>999</Count></RestartOnFailure>
  </Settings>
  <Actions Context="Author"><Exec><Command>${esc(exe)}</Command><WorkingDirectory>${esc(dirname(exe))}</WorkingDirectory></Exec></Actions>
</Task>`;
  const arq = join(process.env.TEMP || '.', `farol-servidor-${process.pid}.xml`);
  writeFileSync(arq, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, 'utf16le')]));
  const r = spawnSync('schtasks.exe', ['/Create', '/TN', NOME_TAREFA, '/XML', arq, '/F'], { encoding: 'utf8' });
  rmSync(arq, { force: true });
  if (r.status !== 0) { console.error((r.stderr || r.stdout).trim() + '\n(Precisa de administrador.)'); return 1; }
  spawnSync('schtasks.exe', ['/Run', '/TN', NOME_TAREFA]);
  console.log(`Tarefa "${NOME_TAREFA}" criada: o servidor inicia com o Windows. Dados em ${pastaDados()}.`);
  console.log('Defina PORT/HOST/URL_PUBLICA em um arquivo .env nessa pasta de dados (ex.: HOST=0.0.0.0).');
  return 0;
}

async function criarAdmin() {
  const { abrirBanco } = await import('../../servidor/src/db.js');
  const { carregarConfig } = await import('../../servidor/src/config.js');
  const { criarUsuario, validarSenhaForte } = await import('../../servidor/src/modulos/auth/index.js');
  const { auditar } = await import('../../servidor/src/nucleo/contexto.js');
  const { MIGRACOES_NUCLEO } = await import('../../servidor/src/nucleo/esquema.js');
  const { aplicarMigracoes } = await import('../../servidor/src/nucleo/migracoes.js');
  const { values } = parseArgs({ args: process.argv.slice(3), options: { usuario: { type: 'string' }, senha: { type: 'string' } } });
  if (!values.usuario || !values.senha) { console.error('Use: criar-admin --usuario U --senha S'); return 1; }
  if (!/^[A-Za-z0-9._@-]{3,64}$/.test(values.usuario)) { console.error('Usuário inválido.'); return 1; }
  const fraca = validarSenhaForte(values.senha);
  if (fraca) { console.error(fraca); return 1; }
  const config = carregarConfig();
  mkdirSync(dirname(config.caminhoBanco), { recursive: true });
  const db = abrirBanco(config.caminhoBanco);
  aplicarMigracoes(db, 'nucleo', MIGRACOES_NUCLEO);
  if (db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(values.usuario)) { console.error('Usuário já existe.'); return 1; }
  await criarUsuario(db, values.usuario, values.senha);
  auditar(db, { usuario: values.usuario, acao: 'admin_criado', alvo: values.usuario, detalhes: 'via farol-servidor.exe' });
  db.close();
  console.log(`Administrador "${values.usuario}" criado.`);
  return 0;
}

export async function iniciar() {
  const cmd = process.argv[2];
  if (cmd === 'ajuda' || cmd === '--help' || cmd === '-h') { console.log(AJUDA); return; }
  if (cmd === 'versao' || cmd === '--version') { console.log(VERSAO); return; }
  if (cmd === 'instalar-tarefa') process.exit(tarefa('instalar'));
  if (cmd === 'remover-tarefa') process.exit(tarefa('remover'));

  const dados = pastaDados();
  mkdirSync(dados, { recursive: true });
  const recursos = extrairRecursos(dados);
  if (cmd === 'criar-admin') process.exit(await criarAdmin());

  const { criarApp } = await import('../../servidor/src/app.js');
  const { carregarConfig } = await import('../../servidor/src/config.js');
  const { totalUsuarios } = await import('../../servidor/src/modulos/auth/index.js');
  const ajustes = { pastaPainel: join(recursos, 'painel'), pastaAgente: join(recursos, 'agente') };
  if (!process.env.BIBLIOTECA) ajustes.pastaBiblioteca = join(recursos, 'biblioteca');
  const config = carregarConfig(ajustes);
  const app = await criarApp({ config, logger: { level: process.env.LOG_LEVEL || 'info' } });
  try {
    await app.listen({ port: config.porta, host: config.host });
    if (totalUsuarios(app.farol.db) === 0) app.log.warn('Nenhum usuário cadastrado: abra o painel para o setup inicial ou rode "farol-servidor.exe criar-admin".');
    app.log.info(`Farol servidor ${VERSAO}; dados em ${dados}`);
  } catch (e) {
    app.log.error(e);
    process.exit(1);
  }
  for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, async () => { await app.close(); process.exit(0); });
}
