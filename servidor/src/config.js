// Leitura de configuração: variáveis de ambiente + arquivo .env opcional (sem dependências).
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ_SERVIDOR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function lerDotEnv(caminho) {
  if (!existsSync(caminho)) return {};
  const vars = {};
  for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m || linha.trim().startsWith('#')) continue;
    vars[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return vars;
}

export function carregarConfig(sobrescrever = {}) {
  const env = { ...lerDotEnv(resolve(RAIZ_SERVIDOR, '.env')), ...process.env };
  const urlPublica = (env.URL_PUBLICA || '').replace(/\/+$/, '');
  return {
    porta: Number(env.PORT || 8420),
    host: env.HOST || '127.0.0.1',
    caminhoBanco: resolve(RAIZ_SERVIDOR, env.DB || 'dados/farol.db'),
    urlPublica,
    webhookUrl: env.WEBHOOK_URL || '',
    // Cookie Secure só faz sentido quando o painel é servido por HTTPS.
    https: urlPublica.startsWith('https://'),
    confiarProxy: env.TRUST_PROXY === '1' || urlPublica.startsWith('https://'),
    sessaoHoras: Number(env.SESSAO_HORAS || 12),
    offlineSegundos: 60,
    intervaloCheckin: 15,
    limites: { global: 300, login: 10, registrar: 10 },
    tarefasPeriodicas: true,
    ...sobrescrever,
  };
}
