/**
 * Função única da Vercel: atende todas as rotas /api/* com o mesmo tratador do servidor local
 * (server/app.mjs). Os arquivos de public/ são servidos pela própria Vercel como estáticos.
 * Configuração pelas variáveis de ambiente do projeto na Vercel (ver docs/SUPABASE_VERCEL.md).
 */
import { criarApp } from '../server/app.mjs';
import { carregarConfig } from '../server/config.mjs';

let app = null; // reaproveitado enquanto a instância estiver quente (cache das planilhas em memória)

export default async function handler(req, res) {
  app ??= criarApp(carregarConfig());
  return app(req, res);
}
