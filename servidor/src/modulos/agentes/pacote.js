// Empacota o agente Python (agente/farol/**) como um zipapp .pyz, que o Python executa direto:
//   python farol-agente.pyz instalar --servidor ... --token ...
// O zip é montado em memória (deflate + CRC32 do node:zlib) e reaproveitado enquanto os arquivos não mudam.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';
import { createHash } from 'node:crypto';

const MAIN = `# Ponto de entrada do zipapp do agente Farol.
import sys
from farol.cli import main
sys.exit(main())
`;

function listarPython(pasta, raiz, saida = []) {
  for (const d of readdirSync(pasta, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (d.name.startsWith('.') || d.name === '__pycache__') continue;
    const caminho = join(pasta, d.name);
    if (d.isDirectory()) listarPython(caminho, raiz, saida);
    else if (d.name.endsWith('.py')) saida.push({ nome: relative(raiz, caminho).split(sep).join('/'), caminho });
  }
  return saida;
}

function dosDataHora(data) {
  const hora = (data.getHours() << 11) | (data.getMinutes() << 5) | Math.floor(data.getSeconds() / 2);
  const dia = ((data.getFullYear() - 1980) << 9) | ((data.getMonth() + 1) << 5) | data.getDate();
  return { hora, dia };
}

/** Monta um ZIP (método deflate) a partir de [{ nome, dados: Buffer }]. */
export function montarZip(arquivos, data = new Date(2024, 0, 1)) {
  const { hora, dia } = dosDataHora(data);
  const locais = [];
  const centrais = [];
  let deslocamento = 0;
  for (const a of arquivos) {
    const nome = Buffer.from(a.nome, 'utf8');
    const comprimido = deflateRawSync(a.dados, { level: 9 });
    const crc = crc32(a.dados);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);           // versão necessária
    local.writeUInt16LE(0x0800, 6);       // flag: nomes em UTF-8
    local.writeUInt16LE(8, 8);            // deflate
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(a.dados.length, 22);
    local.writeUInt16LE(nome.length, 26);
    local.writeUInt16LE(0, 28);
    locais.push(local, nome, comprimido);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(hora, 12);
    central.writeUInt16LE(dia, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(a.dados.length, 24);
    central.writeUInt16LE(nome.length, 28);
    central.writeUInt32LE(deslocamento, 42);
    centrais.push(central, nome);
    deslocamento += local.length + nome.length + comprimido.length;
  }
  const tamanhoCentral = centrais.reduce((n, b) => n + b.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(tamanhoCentral, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, ...centrais, fim]);
}

let cache = null;

/** Devolve { dados: Buffer, sha256, arquivos } do pacote .pyz, ou null se a pasta do agente não existir. */
export function pacoteAgente(pastaAgente) {
  const pasta = join(pastaAgente, 'farol');
  if (!existsSync(pasta)) return null;
  const fontes = listarPython(pasta, pastaAgente);
  const assinatura = fontes.map((f) => `${f.nome}:${statSync(f.caminho).mtimeMs}`).join('|');
  if (cache?.assinatura === assinatura) return cache;
  const arquivos = [{ nome: '__main__.py', dados: Buffer.from(MAIN) },
    ...fontes.map((f) => ({ nome: f.nome, dados: readFileSync(f.caminho) }))];
  const dados = montarZip(arquivos);
  cache = { assinatura, dados, sha256: createHash('sha256').update(dados).digest('hex'), arquivos: arquivos.map((a) => a.nome) };
  return cache;
}
