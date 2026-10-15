/**
 * Copia o conteúdo do modo local (DATA_DIR) para o Supabase: cadastro de obras, anexos (com os binários),
 * TxC/fotos, telas do cliente, INCC (manuais e meses do Banco Central) e usuários.
 *
 * Usuários: o Supabase Auth não aceita o hash de senha antigo, então cada usuário é criado com a senha
 * temporária informada em MIGRACAO_SENHA_TEMPORARIA e deve trocá-la em "Minha conta" no primeiro acesso.
 *
 * Uso (com SUPABASE_* preenchidos no .env.local e o SQL já aplicado):
 *   set MIGRACAO_SENHA_TEMPORARIA=uma-senha-forte   (PowerShell: $env:MIGRACAO_SENHA_TEMPORARIA="...")
 *   npm run migrar:supabase
 * Pode rodar de novo: registros já existentes (mesmo id/chave/e-mail) são pulados.
 */
import { carregarConfig, supabaseConfigurado } from '../config.mjs';
import { ArmazemLocal, ArmazemSupabase } from '../store/armazem.mjs';
import { RepositorioArquivosLocal } from '../store/arquivos.mjs';
import { ColecaoJson } from '../store/json-store.mjs';
import { ColecaoSupabase, linhaCadastro } from '../store/supabase-store.mjs';
import { ClienteSupabase } from '../supabase/cliente.mjs';

const config = carregarConfig();
if (!supabaseConfigurado(config)) {
  console.error('Preencha SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.');
  process.exit(1);
}
const senhaTemporaria = process.env.MIGRACAO_SENHA_TEMPORARIA ?? '';
const cliente = new ClienteSupabase(config.supabase);
const local = (nome) => new ColecaoJson(config.dataDir, nome);
const remoto = (tabela, opcoes) => new ColecaoSupabase(cliente, tabela, opcoes);
const resumo = [];

async function copiar(nome, origem, destino, chave = 'id') {
  let novos = 0;
  for (const r of await origem.listar()) {
    if (await destino.buscarPor(chave, r[chave])) continue;
    await destino.inserir(r);
    novos++;
  }
  resumo.push(`${nome}: ${novos} copiado(s)`);
}

// Anexos primeiro (mídias referenciam arquivos).
const arquivosLocais = new RepositorioArquivosLocal(config.dataDir);
const arquivosRemotos = remoto('arquivos');
let anexos = 0;
for (const meta of await arquivosLocais.meta.listar()) {
  if (await arquivosRemotos.obter(meta.id)) continue;
  const { dados } = await arquivosLocais.ler(meta.id);
  const caminho = `anexos/${meta.id}`;
  await cliente.gravarObjeto(caminho, dados, meta.tipo);
  await arquivosRemotos.inserir({ ...meta, caminho });
  anexos++;
}
resumo.push(`anexos: ${anexos} enviado(s) ao Storage`);

await copiar('cadastro de obras', local('cadastro-obras'), remoto('cadastro_obras', { mapa: linhaCadastro }), 'chave');
await copiar('TxC e fotos', local('midias'), remoto('midias'));
await copiar('telas do cliente', local('telas'), remoto('telas'));

const incc = await new ArmazemLocal(config.dataDir).ler('incc');
if (incc) {
  await new ArmazemSupabase(cliente).gravar('incc', incc);
  resumo.push('INCC: copiado');
}

const perfis = remoto('perfis');
const usuariosLocais = await local('usuarios').listar();
if (usuariosLocais.length && senhaTemporaria.length < 8) {
  resumo.push(`usuários: NÃO migrados — defina MIGRACAO_SENHA_TEMPORARIA (8+ caracteres) para criar ${usuariosLocais.length} usuário(s)`);
} else {
  for (const u of usuariosLocais) {
    if (await perfis.buscarPor('email', u.email)) continue;
    const criado = await cliente.criarUsuarioAuth(u.email, senhaTemporaria);
    await perfis.inserir({ id: criado.id ?? criado.user?.id, nome: u.nome, email: u.email, papel: u.papel, ativo: u.ativo !== false });
    resumo.push(`usuário criado: ${u.email} (${u.papel}) — senha temporária`);
  }
}

console.log(resumo.join('\n'));
