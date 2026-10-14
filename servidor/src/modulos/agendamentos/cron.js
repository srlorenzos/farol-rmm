// Expressão cron simplificada de 5 campos (minuto hora dia mês dia-da-semana), cada campo aceitando
// '*', listas ("1,2,5"), intervalos ("1-5") e passos ("*/15" ou "1-20/5"). Sem campo de segundos (não
// precisamos de precisão abaixo de 1 minuto) nem de extensões tipo "@daily" — mantém simples e auditável.
// Busca força-bruta minuto a minuto (até 2 anos à frente): simples de entender e corrigir, rápido o
// bastante pra uma tarefa que roda a cada 30 s, não por requisição.

const CAMPOS = [
  { nome: 'minuto', min: 0, max: 59, get: (d) => d.getMinutes() },
  { nome: 'hora', min: 0, max: 23, get: (d) => d.getHours() },
  { nome: 'dia', min: 1, max: 31, get: (d) => d.getDate() },
  { nome: 'mes', min: 1, max: 12, get: (d) => d.getMonth() + 1 },
  { nome: 'semana', min: 0, max: 6, get: (d) => d.getDay() }, // 0 = domingo
];
const DOIS_ANOS_MS = 2 * 365 * 86_400_000;

function parseCampo(def, texto) {
  const valores = new Set();
  for (const parte of String(texto).split(',')) {
    const [intervalo, passoTxt] = parte.split('/');
    const passo = passoTxt ? Number(passoTxt) : 1;
    if (!Number.isInteger(passo) || passo < 1) throw new Error(`campo "${def.nome}": passo inválido em "${parte}"`);
    let ini, fim;
    if (intervalo === '*') { ini = def.min; fim = def.max; }
    else if (intervalo.includes('-')) { [ini, fim] = intervalo.split('-').map(Number); }
    else { ini = fim = Number(intervalo); }
    if (!Number.isInteger(ini) || !Number.isInteger(fim) || ini > fim || ini < def.min || fim > def.max) {
      throw new Error(`campo "${def.nome}": valor fora do intervalo ${def.min}-${def.max} em "${parte}"`);
    }
    for (let i = ini; i <= fim; i += passo) valores.add(i);
  }
  return valores;
}

/** Compila "min hora dia mes semana" numa estrutura pronta pra testar datas. Lança Error com mensagem clara. */
export function compilarCron(expressao) {
  const partes = String(expressao ?? '').trim().split(/\s+/);
  if (partes.length !== 5) throw new Error('Expressão cron precisa ter 5 campos: minuto hora dia mês dia-da-semana (ex.: "0 22 * * 2" = toda terça às 22h)');
  const compilado = {};
  CAMPOS.forEach((def, i) => { compilado[def.nome] = parseCampo(def, partes[i]); });
  return compilado;
}

/** Bate os 5 campos contra uma data (hora local do servidor). */
function bate(compilado, data) {
  return CAMPOS.every((def) => compilado[def.nome].has(def.get(data)));
}

/**
 * Próximo instante (ms epoch) estritamente depois de `apartirDeMs` que bate com a expressão compilada.
 * `null` se nada bater nos próximos 2 anos (expressão impossível, ex. 31 de fevereiro).
 */
export function proximaExecucaoCron(compilado, apartirDeMs) {
  let t = new Date(apartirDeMs);
  t.setSeconds(0, 0);
  t = new Date(t.getTime() + 60_000); // nunca o minuto corrente — sempre o próximo
  const limite = apartirDeMs + DOIS_ANOS_MS;
  while (t.getTime() < limite) {
    if (bate(compilado, t)) return t.getTime();
    t = new Date(t.getTime() + 60_000);
  }
  return null;
}

/** Valida e já devolve a próxima execução — usado nas rotas (uma chamada só, erro claro se a expressão for ruim). */
export function validarCronEProximaExecucao(expressao, apartirDeMs = Date.now()) {
  const compilado = compilarCron(expressao);
  return proximaExecucaoCron(compilado, apartirDeMs);
}
