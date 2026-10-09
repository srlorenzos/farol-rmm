// Leitura de configuração: variáveis de ambiente + arquivo .env opcional (sem dependências).
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ_SERVIDOR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const RAIZ_PROJETO = resolve(RAIZ_SERVIDOR, '..');

export function lerDotEnv(caminho) {
  if (!existsSync(caminho)) return {};
  const vars = {};
  for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    if (linha.trim().startsWith('#')) continue;
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    vars[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return vars;
}

/**
 * Proxy confiável para X-Forwarded-For.
 * TRUST_PROXY=1 (ou URL_PUBLICA https) confia só em proxies locais (loopback);
 * TRUST_PROXY=<lista de IPs/CIDRs> confia nesses endereços. Nunca confia em qualquer origem,
 * para que um cliente não consiga forjar o IP da auditoria/rate limit quando o servidor está exposto.
 */
function proxyConfiavel(valor, https) {
  if (valor && valor !== '0' && valor !== '1') return valor.split(',').map((s) => s.trim()).filter(Boolean);
  if (valor === '1' || (https && valor !== '0')) return ['127.0.0.1', '::1'];
  return false;
}

export function carregarConfig(sobrescrever = {}) {
  const env = { ...lerDotEnv(resolve(RAIZ_SERVIDOR, '.env')), ...process.env };
  const urlPublica = (env.URL_PUBLICA || '').replace(/\/+$/, '');
  const https = urlPublica.startsWith('https://');
  return {
    porta: Number(env.PORT || 8420),
    host: env.HOST || '127.0.0.1',
    caminhoBanco: resolve(RAIZ_SERVIDOR, env.DB || 'dados/farol.db'),
    urlPublica,
    webhookUrl: env.WEBHOOK_URL || '',
    // Cookie Secure só faz sentido quando o painel é servido por HTTPS.
    https,
    confiarProxy: proxyConfiavel(env.TRUST_PROXY, https),
    sessaoHoras: Number(env.SESSAO_HORAS || 12),
    offlineSegundos: 60,
    intervaloCheckin: 15,
    retencaoMetricasDias: 7,
    retencaoJobsDias: Number(env.RETENCAO_JOBS_DIAS || 90),
    limites: { global: 300, login: 10, registrar: 10, agente: 120 },
    tarefasPeriodicas: true,
    pastaModulos: resolve(RAIZ_SERVIDOR, 'src', 'modulos'),
    pastaBiblioteca: resolve(RAIZ_SERVIDOR, env.BIBLIOTECA || 'biblioteca'),
    pastaPainel: resolve(RAIZ_PROJETO, 'painel'),
    pastaAgente: resolve(RAIZ_PROJETO, 'agente'),
    ...sobrescrever,
  };
}
