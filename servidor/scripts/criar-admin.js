// Cria o usuário administrador.
// Interativo:      npm run criar-admin
// Não interativo:  npm run criar-admin -- --usuario admin --senha 'S3nha-Forte!'
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { stdin, stdout } from 'node:process';
import { abrirBanco } from '../src/db.js';
import { carregarConfig } from '../src/config.js';
import { criarUsuario, validarSenhaForte } from '../src/modulos/auth/index.js';
import { auditar } from '../src/nucleo/contexto.js';
import { MIGRACOES_NUCLEO } from '../src/nucleo/esquema.js';
import { aplicarMigracoes } from '../src/nucleo/migracoes.js';

const { values } = parseArgs({
  options: { usuario: { type: 'string' }, senha: { type: 'string' }, db: { type: 'string' } },
});

const config = carregarConfig(values.db ? { caminhoBanco: values.db } : {});
const db = abrirBanco(config.caminhoBanco);
aplicarMigracoes(db, 'nucleo', MIGRACOES_NUCLEO);

async function perguntarOculto(rl, pergunta) {
  // Esconde a digitação substituindo o eco do terminal.
  const original = rl._writeToOutput;
  rl._writeToOutput = (s) => { if (s.includes(pergunta)) original.call(rl, s); };
  const r = await rl.question(pergunta);
  rl._writeToOutput = original;
  stdout.write('\n');
  return r;
}

let { usuario, senha } = values;
if (!usuario || !senha) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  usuario ||= (await rl.question('Usuário do administrador: ')).trim();
  if (!senha) {
    senha = await perguntarOculto(rl, 'Senha (mín. 10 caracteres): ');
    const conf = await perguntarOculto(rl, 'Confirme a senha: ');
    if (senha !== conf) { console.error('As senhas não conferem.'); process.exit(1); }
  }
  rl.close();
}

if (!/^[A-Za-z0-9._@-]{3,64}$/.test(usuario)) {
  console.error('Usuário inválido: use 3–64 caracteres (letras, números, . _ @ -).');
  process.exit(1);
}
const fraca = validarSenhaForte(senha);
if (fraca) { console.error(fraca); process.exit(1); }

if (db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(usuario)) {
  console.error(`O usuário "${usuario}" já existe.`);
  process.exit(1);
}
await criarUsuario(db, usuario, senha);
auditar(db, { usuario, acao: 'admin_criado', alvo: usuario, detalhes: 'via terminal' });
db.close();
console.log(`Administrador "${usuario}" criado. Ative o 2FA em Minha conta no primeiro acesso.`);
