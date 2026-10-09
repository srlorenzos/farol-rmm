// Ponto de entrada: `npm start`.
import { criarApp } from './app.js';
import { carregarConfig } from './config.js';
import { totalUsuarios } from './rotas/auth.js';

const config = carregarConfig();
const app = await criarApp({ config, logger: { level: process.env.LOG_LEVEL || 'info' } });

try {
  await app.listen({ port: config.porta, host: config.host });
  if (totalUsuarios(app.farol.db) === 0) {
    app.log.warn('Nenhum usuário cadastrado: rode "npm run criar-admin" ou abra o painel para o setup inicial.');
  }
  if (!config.https && !['127.0.0.1', 'localhost', '::1'].includes(config.host)) {
    app.log.warn('Servidor exposto sem URL_PUBLICA https://. Em produção, coloque um proxy reverso com TLS na frente.');
  }
} catch (e) {
  app.log.error(e);
  process.exit(1);
}

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, async () => {
    await app.close();
    process.exit(0);
  });
}
