/**
 * Ponto de entrada: `npm start` (ou `npm run dev`, que reinicia ao salvar).
 */
import { createServer } from 'node:http';
import { criarApp } from './app.mjs';
import { carregarConfig, graphConfigurado } from './config.mjs';

const config = carregarConfig();
if (config.fonteDados === 'graph' && !graphConfigurado(config)) {
  console.warn('[aviso] Credenciais do Microsoft Graph ausentes em .env.local — use DATA_SOURCE=exemplo para demonstração.');
}
if (config.semLogin) {
  console.warn(`[aviso] LOGIN=desligado — o app abre sem login, com o papel "${config.papelSemLogin}".`);
}

const app = criarApp(config);
createServer(app).listen(config.porta, () => {
  console.log(`Apresentação Planejamento em http://localhost:${config.porta} (dados: ${config.fonteDados})`);
  app.preCarregar(); // lê as planilhas do SharePoint em segundo plano
});
