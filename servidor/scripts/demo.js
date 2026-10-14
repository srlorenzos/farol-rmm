// Popula um banco com dados de DEMONSTRAÇÃO (clientes, sites, dispositivos fictícios com 24 h de histórico,
// inventário, alertas e execuções). Útil para conhecer o painel sem instalar agentes.
//   npm run demo -- --db dados/demo.db [--dispositivos 80] [--vivo]
// Depois: DB=dados/demo.db npm start. Os dispositivos fictícios não têm agente: sem --vivo eles ficam offline
// 1 min depois; com --vivo o script continua rodando e simula os check-ins (Ctrl+C para parar).
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { abrirBanco, transacao } from '../src/db.js';
import { resolve } from 'node:path';
import { carregarConfig, RAIZ_SERVIDOR } from '../src/config.js';
import { criarApp } from '../src/app.js';

const { values } = parseArgs({ options: { db: { type: 'string', default: 'dados/demo.db' }, dispositivos: { type: 'string', default: '64' }, vivo: { type: 'boolean', default: false } } });
const config = carregarConfig({ caminhoBanco: resolve(RAIZ_SERVIDOR, values.db), tarefasPeriodicas: false });
const db = abrirBanco(config.caminhoBanco);
const app = await criarApp({ config, db }); // aplica as migrações
const N = Number(values.dispositivos);
const agora = Date.now();
let semente = 42;
const rnd = () => { semente = (semente * 16807) % 2147483647; return (semente - 1) / 2147483646; };
const escolher = (lista) => lista[Math.floor(rnd() * lista.length)];

const CLIENTES = [
  ['Clínica Vida', ['Unidade Centro', 'Unidade Norte']],
  ['Padaria Pão de Ouro', ['Loja 1', 'Loja 2', 'Fábrica']],
  ['Contábil Exata', ['Escritório']],
];
const SOS = [
  ['Windows', 'Windows 11 Pro 23H2', 'AMD64', 0.55], ['Windows', 'Windows 10 Pro 22H2', 'AMD64', 0.2],
  ['Windows', 'Windows Server 2022 Standard', 'AMD64', 0.08], ['Linux', 'Ubuntu 24.04.1 LTS', 'x86_64', 0.12], ['Darwin', 'macOS 14.6 Sonoma', 'arm64', 0.05],
];
const MODELOS = [['Dell Inc.', 'OptiPlex 7090'], ['Lenovo', 'ThinkPad T14 Gen 3'], ['HP', 'EliteDesk 800 G6'], ['Dell Inc.', 'PowerEdge T150'], ['Apple', 'MacBook Air M2']];
const NOMES = ['recepcao', 'financeiro', 'caixa', 'gerencia', 'estoque', 'rh', 'consultorio', 'servidor', 'triagem', 'compras', 'diretoria', 'atendimento'];
const USUARIOS = ['maria', 'joao.silva', 'ana', 'carlos', 'fernanda', 'pedro', 'juliana', null];
const SOFTWARES = [['Google Chrome', '129.0.6668.90', 'Google LLC'], ['Microsoft Edge', '129.0.2792.79', 'Microsoft Corporation'], ['7-Zip 24.08', '24.08', 'Igor Pavlov'],
  ['Microsoft 365 Apps', '16.0.17928', 'Microsoft Corporation'], ['Adobe Acrobat Reader', '24.003.20112', 'Adobe'], ['AnyDesk', '8.1.0', 'AnyDesk Software GmbH'],
  ['Mozilla Firefox', '131.0', 'Mozilla'], ['VLC media player', '3.0.21', 'VideoLAN'], ['Notepad++', '8.6.9', 'Notepad++ Team'], ['Python 3.12', '3.12.6', 'Python Software Foundation']];

transacao(db, () => {
  db.exec("DELETE FROM jobs; DELETE FROM alertas; DELETE FROM comandos; DELETE FROM metricas; DELETE FROM agentes WHERE segredo_hash = 'demo'; DELETE FROM sites WHERE id > 1; DELETE FROM clientes WHERE id > 1;");
  db.prepare("UPDATE clientes SET nome = 'Minha empresa' WHERE id = 1").run();
  const sites = [1];
  for (const [cliente, nomesSites] of CLIENTES) {
    const c = Number(db.prepare('INSERT INTO clientes (nome, criado_em) VALUES (?, ?)').run(cliente, agora).lastInsertRowid);
    for (const s of nomesSites) sites.push(Number(db.prepare('INSERT INTO sites (cliente_id, nome, criado_em) VALUES (?, ?, ?)').run(c, s, agora).lastInsertRowid));
  }
  const insAg = db.prepare(`INSERT INTO agentes (id, segredo_hash, hostname, so, so_versao, arquitetura, versao_agente, ip_local, usuario_logado, cpu_pct, ram_usada, ram_total,
    disco_max_pct, discos_json, uptime, status, registrado_em, ultimo_checkin, site_id, inventario_json, inventario_em, capacidades_json, descricao)
    VALUES (?, 'demo', ?, ?, ?, ?, '2.0.0', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insMet = db.prepare('INSERT INTO metricas (agente_id, ts, cpu, ram_pct, disco_pct) VALUES (?, ?, ?, ?, ?)');
  const insAl = db.prepare("INSERT INTO alertas (agente_id, tipo, mensagem, valor, status, aberto_em, resolvido_em, severidade) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const insJob = db.prepare(`INSERT INTO jobs (agente_id, nome, shell, conteudo, timeout, status, criado_por, criado_em, enviado_em, concluido_em, codigo_saida, stdout, duracao_ms, origem, lote)
    VALUES (?, ?, ?, ?, 60, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const nomesUsados = new Set();
  for (let i = 0; i < N; i++) {
    let r = rnd();
    const so = SOS.find((x) => (r -= x[3]) <= 0) ?? SOS[0];
    const site = sites[i % sites.length];
    let host;
    do { host = `${escolher(NOMES)}-${String(Math.floor(rnd() * 90) + 10)}`; } while (nomesUsados.has(host));
    nomesUsados.add(host);
    if (so[1].includes('Server') || host.startsWith('servidor')) host = `srv-${host}`;
    const status = rnd() < 0.82 ? 'online' : 'offline';
    const cpu = Math.min(99, Math.round(rnd() ** 2.2 * 100));
    const ramTotal = escolher([8, 16, 16, 32]) * 1024 ** 3;
    const ramPct = 25 + rnd() * 65;
    const discoPct = Math.min(99, Math.round(30 + rnd() ** 1.6 * 68));
    const discos = so[0] === 'Windows' ? [{ ponto: 'C:\\', fs: 'NTFS', total: 512e9, usado: 512e9 * discoPct / 100, pct: discoPct }] : [{ ponto: '/', fs: so[0] === 'Darwin' ? 'apfs' : 'ext4', total: 256e9, usado: 256e9 * discoPct / 100, pct: discoPct }];
    const [fab, mod] = so[0] === 'Darwin' ? MODELOS[4] : so[1].includes('Server') ? MODELOS[3] : escolher(MODELOS.slice(0, 3));
    const inventario = {
      sistema: { so: so[0], versao: so[1], hostname: host, arquitetura: so[2], boot: Math.floor((agora - 3600_000 * (2 + rnd() * 200)) / 1000), python: '3.12.6' },
      hardware: { cpu_modelo: so[0] === 'Darwin' ? 'Apple M2' : escolher(['Intel(R) Core(TM) i5-11500 @ 2.70GHz', 'Intel(R) Core(TM) i7-1265U', 'AMD Ryzen 5 PRO 5650G']), nucleos_fisicos: 6, nucleos_logicos: 12, ram_total: ramTotal, fabricante: fab, modelo: mod, serial: `BR${Math.floor(rnd() * 1e8)}` },
      rede: [{ nome: so[0] === 'Windows' ? 'Ethernet' : 'eth0', mac: '3C:52:82:1A:2B:3C', ipv4: [`192.168.${site}.${10 + i}`], ipv6: [], ativa: true, velocidade_mbps: 1000 }],
      discos: discos.map((d) => ({ dispositivo: so[0] === 'Windows' ? 'C:\\' : '/dev/sda1', ponto: d.ponto, fs: d.fs })),
      softwares: SOFTWARES.filter(() => rnd() < 0.8).map(([nome, versao, fabricante]) => ({ nome, versao, fabricante, instalado_em: '20240812' })),
    };
    const id = randomUUID();
    const ultimo = status === 'online' ? agora - Math.floor(rnd() * 14_000) : agora - Math.floor(3600_000 * (1 + rnd() * 70));
    insAg.run(id, host, so[0], so[1], so[2], `192.168.${site}.${10 + i}`, status === 'online' ? escolher(USUARIOS) : null, cpu, Math.round(ramTotal * ramPct / 100), ramTotal,
      discoPct, JSON.stringify(discos), Math.floor(3600 * (2 + rnd() * 300)), status, agora - 86400_000 * 30, ultimo, site, JSON.stringify(inventario), agora - 1800_000,
      JSON.stringify(['ping', 'energia.reiniciar', 'energia.desligar', 'sessao:eco']), rnd() < 0.2 ? 'Mesa ao lado da janela' : null);
    // histórico de 24 h (1 ponto a cada 5 min)
    const base = 10 + rnd() * 35;
    for (let t = agora - 86400_000; t <= Math.min(ultimo, agora); t += 300_000) {
      const h = new Date(t).getHours();
      const exp = h >= 8 && h <= 18 ? 1 : 0.35;
      insMet.run(id, t, Math.max(1, Math.min(100, base * exp + 15 * Math.sin(t / 3.7e6) + rnd() * 18)), Math.min(98, ramPct + 6 * Math.sin(t / 7e6)), discoPct);
    }
    if (status === 'offline' && rnd() < 0.6) insAl.run(id, 'offline', `Sem check-in há ${Math.floor((agora - ultimo) / 60000)} min (limite 5 min)`, null, 'aberto', ultimo + 300_000, null, 'critico');
    if (discoPct > 90) insAl.run(id, 'disco', `Disco ${discos[0].ponto} em ${discoPct}% (limite 90%)`, discoPct, 'aberto', agora - Math.floor(rnd() * 8e7), null, discoPct >= 95 ? 'critico' : 'alerta');
    if (cpu > 85) insAl.run(id, 'cpu', `CPU em ${cpu}% (limite 90%) por 4 check-ins seguidos`, cpu, 'aberto', agora - Math.floor(rnd() * 3e6), null, 'alerta');
    if (rnd() < 0.3) insAl.run(id, 'ram', 'Memória em 93% (limite 90%) por 4 check-ins seguidos', 93, 'resolvido', agora - 9e7, agora - 8.6e7, 'alerta');
    if (i < 24) {
      const nomes = [['Limpar arquivos temporários', 'powershell', 'Liberados: 1.284,3 MB'], ['Espaço em disco (Windows)', 'powershell', 'DeviceID Uso %\n-------- -----\nC:       71,2'],
        ['Reiniciar spooler de impressão', 'powershell', 'Name    Status\nSpooler Running'], ['Informações de rede (Linux)', 'bash', 'eth0 UP 192.168.1.20/24']];
      const [nome, sh, saida] = escolher(nomes);
      const st = rnd() < 0.85 ? 'sucesso' : 'falha';
      const criado = agora - Math.floor(rnd() * 86400_000);
      insJob.run(id, nome, sh, '# demo', st, escolher(['eduardo', 'tecnico.ana']), criado, criado + 4000, criado + 9000, st === 'sucesso' ? 0 : 1, saida, 2300 + Math.floor(rnd() * 9000), 'script:1', randomUUID());
    }
  }
});
console.log(`Demo pronta em ${config.caminhoBanco}: ${N} dispositivos em ${CLIENTES.length + 1} clientes.`);
await app.close();
if (values.vivo) {
  console.log('Simulando check-ins a cada 10 s (Ctrl+C para parar)…');
  const tick = () => {
    const t = Date.now();
    db.prepare(`UPDATE agentes SET ultimo_checkin = ?, status = 'online',
        cpu_pct = MAX(1, MIN(99, COALESCE(cpu_pct, 10) + (abs(random()) % 11) - 5))
      WHERE segredo_hash = 'demo' AND revogado = 0 AND (status = 'online' OR (status = 'offline' AND ultimo_checkin > ?))`).run(t, t - 120_000);
  };
  tick();
  setInterval(tick, 10_000);
} else {
  db.close();
}
