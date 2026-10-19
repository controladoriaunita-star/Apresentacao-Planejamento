/**
 * Campos do cadastro de obras — equivalente à tabela dCadastrodeObras do Power BI, que vinha da aba
 * "Painel de Obras" de uma pasta local e NÃO está nas abas do SharePoint usadas aqui.
 * O cadastro é mantido no app (Planejamento/Dev) e pode ser importado de uma planilha com os mesmos
 * cabeçalhos da aba "Painel de Obras" (coluna `cabecalho`).
 */
import { chaveObra, dataIso, numero, texto } from './normalizar.js';

export const GRUPOS_CADASTRO = ['Identificação', 'Equipe', 'Características', 'Áreas e unidades', 'Prazos', 'Orçamento e INCC'];

export const CAMPOS_CADASTRO = [
  { campo: 'obra', rotulo: 'Obra', cabecalho: 'Obras', outros: ['Nome da Obra'], tipo: 'texto', grupo: 'Identificação', obrigatorio: true },
  { campo: 'cliente', rotulo: 'Cliente', cabecalho: 'Clientes', outros: ['Cliente'], tipo: 'texto', grupo: 'Identificação' },
  { campo: 'uau', rotulo: 'Nº empresa UAU', cabecalho: 'Nº Empresa UAU', tipo: 'texto', grupo: 'Identificação' },
  { campo: 'situacao', rotulo: 'Situação', tipo: 'opcao', opcoes: ['', 'ativa', 'concluida', 'paralisada'], grupo: 'Identificação', ajuda: 'Vazio = automático pelo avanço físico' },
  { campo: 'endereco', rotulo: 'Endereço', cabecalho: 'Endereço da Obra', outros: ['Endereço'], tipo: 'texto', grupo: 'Identificação' },
  { campo: 'cidade', rotulo: 'Cidade', cabecalho: 'Cidade', tipo: 'texto', grupo: 'Identificação' },
  { campo: 'bairro', rotulo: 'Bairro', cabecalho: 'Bairro', tipo: 'texto', grupo: 'Identificação' },
  { campo: 'diretoria', rotulo: 'Diretoria', cabecalho: 'Diretoria', outros: ['Diretor/Superintendente'], tipo: 'texto', grupo: 'Equipe' },
  { campo: 'gestao', rotulo: 'Gestão (GGO de construção)', cabecalho: 'GGO de Construção', outros: ['GGO'], tipo: 'texto', grupo: 'Equipe' },
  { campo: 'coordenador', rotulo: 'Coordenação', cabecalho: 'Coordenador', tipo: 'texto', grupo: 'Equipe' },
  { campo: 'engenharia', rotulo: 'Engenharia', cabecalho: 'Engenharia', outros: ['Engenheiro 1'], tipo: 'texto', grupo: 'Equipe' },
  { campo: 'planejamento', rotulo: 'Planejamento', cabecalho: 'Planejamento', tipo: 'texto', grupo: 'Equipe' },
  { campo: 'tipologia', rotulo: 'Tipologia', cabecalho: 'Tipologia', tipo: 'texto', grupo: 'Características' },
  { campo: 'padrao', rotulo: 'Padrão', cabecalho: 'Padrão', outros: ['Segmento'], tipo: 'texto', grupo: 'Características' },
  { campo: 'sistemaEstrutural', rotulo: 'Sistema estrutural', cabecalho: 'Sistema Estrutural', tipo: 'texto', grupo: 'Características' },
  { campo: 'fundacao', rotulo: 'Fundação', cabecalho: 'Fundação', outros: ['Fundação Profunda'], tipo: 'texto', grupo: 'Características' },
  { campo: 'numeroTorres', rotulo: 'Nº de torres', cabecalho: 'Nº de Torres', outros: ['Nº Torres'], tipo: 'numero', grupo: 'Características' },
  { campo: 'temBanda', rotulo: 'Banda', cabecalho: 'Tem Banda?', outros: ['Banda'], tipo: 'numero', grupo: 'Características' },
  { campo: 'numeroUH', rotulo: 'Nº de UH', cabecalho: "Nº UH's", tipo: 'numero', grupo: 'Áreas e unidades', usadoEm: 'Custo por UH, NH-NU, unidades no mês' },
  { campo: 'unidadesHabitaveis', rotulo: 'Unidades habitáveis', cabecalho: 'Nº Unid. Habitáveis', tipo: 'numero', grupo: 'Áreas e unidades' },
  { campo: 'areaEquivalente', rotulo: 'Área equivalente (m²)', cabecalho: 'Área Equivalente', outros: ['Área Equivalente (m²)'], tipo: 'numero', grupo: 'Áreas e unidades', usadoEm: 'Custo por AE' },
  { campo: 'areaPrivativaTotal', rotulo: 'Área privativa total (m²)', cabecalho: 'Área privativa Total', outros: ['Área Privativa (m²)'], tipo: 'numero', grupo: 'Áreas e unidades', usadoEm: 'Custo por AP' },
  { campo: 'areaConstruida', rotulo: 'Área construída (m²)', cabecalho: 'Área Const.', outros: ['Área Construída (m²)'], tipo: 'numero', grupo: 'Áreas e unidades', usadoEm: 'Custo por AC' },
  { campo: 'areaPrivativaMedia', rotulo: 'Área privativa média UH (m²)', cabecalho: 'Área privativa Média', outros: ['Área da Unidade (m²)'], tipo: 'numero', grupo: 'Áreas e unidades' },
  { campo: 'areaUhEquivalente', rotulo: 'Área equivalente UH (m²)', cabecalho: 'Área UH Equiv.', tipo: 'numero', grupo: 'Áreas e unidades' },
  { campo: 'coeficienteAEq', rotulo: 'Coeficiente AE/AP', cabecalho: 'Coeficiente de AEq', tipo: 'numero', grupo: 'Áreas e unidades' },
  { campo: 'areaTerreno', rotulo: 'Área do terreno (m²)', cabecalho: 'Área do Terreno', tipo: 'numero', grupo: 'Áreas e unidades' },
  { campo: 'inicioObra', rotulo: 'Início da obra', cabecalho: 'Início de Obra', tipo: 'data', grupo: 'Prazos' },
  { campo: 'fimObraMeta', rotulo: 'Fim da obra (meta)', cabecalho: 'Fim de Obra Meta Obra', outros: ['Fim de Obra Meta Obra inicial'], tipo: 'data', grupo: 'Prazos' },
  { campo: 'fimObraCliente', rotulo: 'Fim da obra (cliente final)', cabecalho: 'Fim de Obra Cliente Final', tipo: 'data', grupo: 'Prazos' },
  { campo: 'fimObraIncorporador', rotulo: 'Fim da obra (incorporador)', cabecalho: 'Fim de Obra Incorporador', tipo: 'data', grupo: 'Prazos' },
  { campo: 'fimProjetadoReal', rotulo: 'Fim projetado (real)', cabecalho: 'Fim Projetado de obra real', tipo: 'data', grupo: 'Prazos', usadoEm: 'Painel de obras: término projetado' },
  { campo: 'prazoInicial', rotulo: 'Prazo inicial (meses)', cabecalho: 'Prazo de Obra Inicial', tipo: 'numero', grupo: 'Prazos' },
  { campo: 'prazoMeta', rotulo: 'Prazo meta (meses)', cabecalho: 'Prazo Meta Obra', tipo: 'numero', grupo: 'Prazos' },
  { campo: 'orcamentoBase', rotulo: 'Orçamento base (R$)', cabecalho: 'Orçamento Base', tipo: 'numero', grupo: 'Orçamento e INCC' },
  { campo: 'orcamentoComTaxa', rotulo: 'Orçamento com taxa, impostos e adicionais (R$)', cabecalho: 'Orçamento com taxa, impostos e adicionais', tipo: 'numero', grupo: 'Orçamento e INCC', usadoEm: 'Painel de obras' },
  { campo: 'taxaAdmInicial', rotulo: 'Taxa de administração inicial (R$)', cabecalho: 'Taxa Adm Inicial (R$)', tipo: 'numero', grupo: 'Orçamento e INCC', usadoEm: 'Painel de obras: taxa prevista' },
  { campo: 'taxaPercentual', rotulo: 'Taxa de administração (%)', cabecalho: 'Taxa (%)', tipo: 'numero', grupo: 'Orçamento e INCC', usadoEm: 'Painel de obras', ajuda: 'Fração: 0,1 = 10%' },
  { campo: 'mesOrcamento', rotulo: 'Mês do orçamento', cabecalho: 'Mês Orçamento', tipo: 'data', grupo: 'Orçamento e INCC' },
  { campo: 'dataBaseIncc', rotulo: 'Data-base INCC', cabecalho: 'Data base INCC', tipo: 'data', grupo: 'Orçamento e INCC', usadoEm: 'INCC base (se o índice ficar vazio)' },
  { campo: 'inccBase', rotulo: 'INCC do orçamento base (índice)', cabecalho: 'INCC (Orç. Base)', tipo: 'numero', grupo: 'Orçamento e INCC', usadoEm: 'INCC base e % de reajuste' },
];

const POR_CAMPO = new Map(CAMPOS_CADASTRO.map((c) => [c.campo, c]));

/** Valida e normaliza um cadastro vindo do formulário ou da importação. */
export function normalizarCadastro(entrada) {
  const saida = {};
  for (const def of CAMPOS_CADASTRO) {
    const valor = entrada?.[def.campo];
    if (def.tipo === 'numero') saida[def.campo] = numero(valor);
    else if (def.tipo === 'data') saida[def.campo] = dataIso(valor);
    else if (def.tipo === 'opcao') saida[def.campo] = def.opcoes.includes(valor) && valor ? valor : null;
    else saida[def.campo] = valor === null || valor === undefined ? null : texto(valor);
  }
  if (!saida.obra) throw new Error('Informe o nome da obra.');
  saida.chave = chaveObra(saida.obra);
  return saida;
}

/**
 * Converte linhas de uma planilha "Painel de Obras" (aba "Painel de Obras" do Power BI ou BD_Fixo da
 * planilha Painel de Obras.xlsm — cabeçalhos em `cabecalho`/`outros`) em cadastros.
 * Só os campos que existem na planilha entram: importar o BD_Fixo não apaga, por exemplo, o bairro.
 */
export function cadastrosDePlanilha(linhas) {
  const porCabecalho = new Map(CAMPOS_CADASTRO.flatMap((c) => [c.cabecalho, ...(c.outros ?? [])].filter(Boolean).map((cab) => [chaveObra(cab), c.campo])));
  return linhas
    .map((linha) => {
      const entrada = {};
      for (const [cab, valor] of Object.entries(linha)) {
        const campo = porCabecalho.get(chaveObra(cab));
        if (campo && !(campo in entrada && valor === null)) entrada[campo] = valor;
      }
      return entrada;
    })
    .filter((e) => texto(e.obra))
    .map((entrada) => {
      const cadastro = normalizarCadastro(entrada);
      for (const campo of Object.keys(cadastro)) if (campo !== 'chave' && !(campo in entrada)) delete cadastro[campo];
      return cadastro;
    });
}

/**
 * O BD_Fixo grafa algumas obras sem o cliente ("Sacomã" × "Habita Sacomã" nas abas do SharePoint). Se o nome
 * importado não é conhecido e "Cliente + Obra" é, o cadastro vai para a obra conhecida (mantendo o nome dela).
 * @param {Array<Map<string, string>>} conhecidas  chave → nome, em ordem de prioridade (planilhas, cadastro)
 */
export function associarObrasConhecidas(registros, conhecidas) {
  return registros.map((r) => {
    if (!r.cliente) return r;
    const alternativa = chaveObra(`${r.cliente} ${r.obra}`);
    for (const nomes of conhecidas) {
      if (nomes.has(r.chave)) return r;
      if (nomes.has(alternativa)) return { ...r, chave: alternativa, obra: nomes.get(alternativa) };
    }
    return r;
  });
}

export const campoCadastro = (campo) => POR_CAMPO.get(campo);
