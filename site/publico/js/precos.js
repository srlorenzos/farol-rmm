// Tabela de preços do Farol RMM. Fonte única: o site (calculadora) e a função api/checkout.js importam este arquivo.
// Valores em centavos de real, por dispositivo/mês, em faixas graduadas (cada faixa vale só para os dispositivos dela).
export const GRATIS_MAX = 5;
export const MIN_PAGO = GRATIS_MAX + 1;
export const MAX_DISPOSITIVOS = 5000;
export const DESCONTO_ANUAL = 0.2;
export const FAIXAS = [
  { plano: 'profissional', de: 6, ate: 50, mensal: 990 },
  { plano: 'msp', de: 51, ate: 200, mensal: 790 },
  { plano: 'msp', de: 201, ate: 500, mensal: 590 },
  { plano: 'msp', de: 501, ate: MAX_DISPOSITIVOS, mensal: 450 },
];

/** Calcula o preço. intervalo: 'mes' | 'ano'. Devolve centavos (inteiros). */
export function calcular(quantidade, intervalo = 'mes') {
  const q = Math.floor(Number(quantidade));
  if (!Number.isFinite(q) || q < 0 || q > MAX_DISPOSITIVOS) throw new RangeError('Quantidade de dispositivos inválida');
  if (q <= GRATIS_MAX) return { quantidade: q, plano: 'gratis', intervalo, total: 0, mensal_equivalente: 0, por_dispositivo_mes: 0, economia_anual: 0 };
  let mensal = 0;
  for (const f of FAIXAS) {
    const nesta = Math.max(0, Math.min(q, f.ate) - (f.de - 1));
    mensal += nesta * f.mensal;
  }
  const plano = q <= FAIXAS[0].ate ? 'profissional' : 'msp';
  const anual = Math.round(mensal * 12 * (1 - DESCONTO_ANUAL));
  const total = intervalo === 'ano' ? anual : mensal;
  return {
    quantidade: q, plano, intervalo, total,
    mensal_equivalente: intervalo === 'ano' ? Math.round(anual / 12) : mensal,
    por_dispositivo_mes: Math.round((intervalo === 'ano' ? anual / 12 : mensal) / q),
    economia_anual: mensal * 12 - anual,
  };
}

export const NOMES_PLANO = { gratis: 'Grátis', profissional: 'Profissional', msp: 'MSP' };
export const brl = (centavos) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
