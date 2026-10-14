#!/usr/bin/env node
// Emite uma licença manualmente (uso do dono do produto).
// Uso: node scripts/emitir-licenca.js --privada <licenca-privada.pem> --cliente "Nome" [--email x@y] [--plano profissional]
//        [--dispositivos 50 | --dispositivos ilimitado] [--dias 365 | --sem-validade]
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { assinar, verificar } from '../src/modulos/licenca/chave.js';

const a = process.argv.slice(2);
const arg = (n) => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : undefined; };
const tem = (n) => a.includes(`--${n}`);

if (tem('ajuda') || !arg('privada') || !arg('cliente')) {
  console.error('Uso: node scripts/emitir-licenca.js --privada <arquivo.pem> --cliente "Nome" [--email e] [--plano p] [--dispositivos N|ilimitado] [--dias N | --sem-validade]');
  process.exit(tem('ajuda') ? 0 : 1);
}
const disp = arg('dispositivos') ?? '10';
const dispositivos_max = disp === 'ilimitado' ? 0 : Number.parseInt(disp, 10);
if (!Number.isInteger(dispositivos_max) || dispositivos_max < 0) { console.error('--dispositivos inválido'); process.exit(1); }
const agora = Date.now();
const dias = Number.parseInt(arg('dias') ?? '365', 10);
const licenca = assinar({
  id: randomUUID(), cliente: arg('cliente'), email: arg('email') ?? null, plano: arg('plano') ?? 'profissional',
  dispositivos_max, emitida_em: agora, expira_em: tem('sem-validade') ? null : agora + dias * 86_400_000,
}, readFileSync(arg('privada'), 'utf8'));
const r = verificar(licenca);
if (!r.ok) { console.error(`A chave gerada não confere com a chave pública embutida no servidor: ${r.erro}`); process.exit(2); }
console.log(licenca);
