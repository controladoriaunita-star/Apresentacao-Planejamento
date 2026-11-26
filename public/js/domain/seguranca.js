/**
 * Segurança do Trabalho — regras de negócio dos acidentes (funções puras: navegador, servidor e testes).
 *
 * - Listas padronizadas (tipo, parte do corpo, fase da obra) e validação do cadastro manual e da importação;
 * - chave de deduplicação para a planilha acumulativa;
 * - indicadores das abas Dashboard-01/02 da planilha "Controle de Acidentes-Dashboard.xlsx";
 * - série mês a mês por tipo do "Modelo - Indicador Segurança do Trabalho".
 *
 * Incorporador (Cliente) e Método construtivo (Sistema estrutural) NÃO ficam no acidente: vêm sempre do
 * Cadastro de obras pelo `obraId` (sem cópia, sem divergência).
 */
import { chaveObra, dataIso, intervaloMeses, semAcento, somarMeses } from './normalizar.js';

export const TIPOS_ACIDENTE = Object.freeze([
  { sigla: 'CPT', nome: 'Acidente com perda de tempo', cor: '--acidente-cpt' },
  { sigla: 'SPT', nome: 'Acidente sem perda de tempo', cor: '--acidente-spt' },
  { sigla: 'TRJ', nome: 'Acidente de trajeto', cor: '--acidente-trj' },
  { sigla: 'FT', nome: 'Acidente fatal', cor: '--acidente-ft' },
]);
export const SIGLAS_TIPO = TIPOS_ACIDENTE.map((t) => t.sigla);
/** Quase acidente: registrado como um acidente, mas fora dos indicadores de acidentes (só entra na base da Pirâmide de Bird). */
export const SIGLA_QUASE = 'QA';
export const TIPOS_REGISTRO = Object.freeze([...TIPOS_ACIDENTE, { sigla: SIGLA_QUASE, nome: 'Quase acidente', cor: '--acidente-qa' }]);
export const SIGLAS_REGISTRO = TIPOS_REGISTRO.map((t) => t.sigla);
/** Categorias Padronizadas da planilha "Dashboard Consolidado - Quase Acidentes" (aba Base Consolidada). */
export const CATEGORIAS_QUASE = Object.freeze([
  'Instalações Elétricas / DR / Iluminação', 'Máquinas e Equipamentos', 'Proteção Contra Quedas / Periferia',
  'Documentações e Gestão de SST', 'Área de Vivência / Bebedouros e Chuveiros', 'Aberturas de Pisos e Shafts',
  'Uso de EPIs / Cinto de Segurança', 'Organização e Limpeza', 'Alojamentos / Conservação e Armários',
  'Proteção Contra Incêndio', 'Área de Vivência / Projetos', 'Escadas e Rampas', 'Primeiros Socorros / Emergência',
  'Canteiro / Caminho Seguro e Sinalização',
]);
/** Ordem da legenda do Modelo - Indicador Segurança do Trabalho (SPT, CPT, TRJ, FT). */
export const ORDEM_MODELO = ['SPT', 'CPT', 'TRJ', 'FT'];

export const PARTES_CORPO = Object.freeze([
  'Dedo', 'Pé', 'Cabeça', 'Ombro', 'Joelho', 'Braço', 'Olho', 'Mandíbula', 'Mão', 'Perna', 'Coluna', 'Boca',
  'Peito', 'Tornozelo', 'Rosto', 'Costas', 'Coxa', 'Antebraço', 'Punho', 'Nariz', 'Abdômen', 'Queixo', 'Canela', 'Dorso',
]);

/** Lista de validação "Fase da Obra" da aba Dados da planilha de controle. */
export const FASES_OBRA = Object.freeze(['Fundação', 'Estrutura', 'Acabamento', 'Assistência Técnica']);

/** Campos do acidente: `campo` (app), `rotulo` (tela) e `cabecalho` (planilha modelo / planilha de controle). */
export const CAMPOS_ACIDENTE = Object.freeze([
  { campo: 'data', rotulo: 'Data', cabecalho: 'Data do Acidente', outros: ['Data'] },
  { campo: 'obra', rotulo: 'Obra', cabecalho: 'Nome da Obra', outros: ['Obra'] },
  { campo: 'incorporador', rotulo: 'Incorporador', cabecalho: 'Incorporação', outros: ['Incorporador', 'Cliente'] },
  { campo: 'metodoConstrutivo', rotulo: 'Método construtivo', cabecalho: 'Método Construtivo', outros: ['Sistema Estrutural'] },
  { campo: 'faseObra', rotulo: 'Fase da obra', cabecalho: 'Fase da Obra' },
  { campo: 'nomeAcidentado', rotulo: 'Nome do acidentado', cabecalho: 'Nome do Acidentado', outros: ['Nome do Colaborador Acidentado'] },
  { campo: 'funcao', rotulo: 'Função', cabecalho: 'Função', outros: ['Cargo'] },
  { campo: 'empresa', rotulo: 'Nome da empresa', cabecalho: 'Nome da Empresa', outros: ['Empresa'] },
  { campo: 'tipo', rotulo: 'Tipo do acidente', cabecalho: 'Tipo', outros: ['Tipo do Acidente', 'Tipo Acidente'] },
  { campo: 'parteCorpo', rotulo: 'Parte do corpo atingida', cabecalho: 'Parte do Corpo Atingida', outros: ['Parte do Corpo'] },
  { campo: 'diasAfastamento', rotulo: 'Dias de afastamento', cabecalho: 'Dias Afastamento', outros: ['Dias de Afastamento', 'Dias Perdidos (DP)', 'Dias Perdidos', 'Número de dias de afastamento'] },
  { campo: 'resumo', rotulo: 'Resumo do acidente', cabecalho: 'Resumo do Acidente', outros: ['Resumo'] },
]);

/** Cabeçalhos do modelo oficial (mesma ordem da aba Dados; Mês e Ano são calculados e ignorados na importação). */
export const CABECALHOS_MODELO = ['Data do Acidente', 'Mês', 'Ano', 'Nome da Obra', 'Incorporação', 'Método Construtivo', 'Fase da Obra',
  'Nome do Acidentado', 'Função', 'Nome da Empresa', 'Tipo', 'Parte do Corpo Atingida', 'Dias Afastamento', 'Resumo do Acidente'];

const PARTE_POR_CHAVE = new Map(PARTES_CORPO.map((p) => [semAcento(p), p]));
const FASE_POR_CHAVE = new Map(FASES_OBRA.map((f) => [semAcento(f), f]));
const CATEGORIA_POR_CHAVE = new Map(CATEGORIAS_QUASE.map((c) => [semAcento(c).replace(/\s*\/\s*/g, '/'), c]));
const limpar = (v) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());

/** "cpt", "CPT – Acidente com perda de tempo" → "CPT"; inválido → null. */
export function siglaTipo(valor) {
  if (/^quase[\s-]*acidentes?$/.test(semAcento(valor))) return SIGLA_QUASE;
  const t = limpar(valor).toUpperCase();
  const sigla = t.split(/[\s–—-]/)[0];
  return SIGLAS_REGISTRO.includes(sigla) ? sigla : null;
}

/** Categoria na grafia da lista (sem diferenciar acento, caixa e espaços ao redor da barra); fora da lista → null. */
export const categoriaQuasePadrao = (valor) => CATEGORIA_POR_CHAVE.get(semAcento(valor).replace(/\s*\/\s*/g, '/')) ?? null;

const MESES_NOME = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const fimDoMes = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);

/**
 * Último dia do mês da planilha de quase acidentes, que só traz mês e ano:
 * "Janeiro/2026", "jan/26", "01/2026", "2026-01" ou uma data → "2026-01-31". Inválido → null.
 */
export function ultimoDiaDoMes(valor) {
  const t = semAcento(valor);
  if (!t) return null;
  const partes = t.match(/^([a-z]+|\d{1,2})[\s/.-]*(?:de\s+)?(\d{4}|\d{2})$/);
  const invertido = t.match(/^(\d{4})-(\d{1,2})$/);
  let ano = null;
  let mes = null;
  if (invertido) {
    ano = Number(invertido[1]);
    mes = Number(invertido[2]);
  } else if (partes) {
    ano = Number(partes[2]) + (partes[2].length === 2 ? 2000 : 0);
    mes = /^\d/.test(partes[1]) ? Number(partes[1]) : (partes[1].length >= 3 ? MESES_NOME.findIndex((m) => m.startsWith(partes[1])) + 1 : 0);
  } else {
    const iso = dataIso(valor);
    if (!iso) return null;
    ano = Number(iso.slice(0, 4));
    mes = Number(iso.slice(5, 7));
  }
  return mes >= 1 && mes <= 12 ? fimDoMes(ano, mes) : null;
}

/** Parte do corpo na grafia da lista ("mão", "Abdomen" → "Mão", "Abdômen"); fora da lista → null. */
export const parteCorpoPadrao = (valor) => PARTE_POR_CHAVE.get(semAcento(valor)) ?? null;
export const faseObraPadrao = (valor) => FASE_POR_CHAVE.get(semAcento(valor)) ?? null;

/** Inteiro ≥ 0 ou null ("5", 5, "5,0" → 5; "-1", "2,5", "" → null). */
export function diasValidos(valor) {
  if (valor === null || valor === undefined || limpar(valor) === '') return null;
  const n = typeof valor === 'number' ? valor : Number(limpar(valor).replace(',', '.'));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * Valida e normaliza um acidente (formulário ou linha de planilha já associada à obra).
 * @param {object} entrada  {data, obraId, faseObra, nomeAcidentado, funcao, empresa, tipo, parteCorpo, diasAfastamento, resumo}
 * @param {{hoje?: string}} opcoes  data de hoje (AAAA-MM-DD) — acidente não pode ser no futuro
 * @returns {{acidente: object|null, erros: string[]}}
 */
export function validarAcidente(entrada, { hoje = new Date().toISOString().slice(0, 10) } = {}) {
  const erros = [];
  const data = dataIso(entrada?.data);
  const tipo = siglaTipo(entrada?.tipo);
  const quase = tipo === SIGLA_QUASE;
  // Quase acidente da planilha fica no último dia do mês: o mês atual é aceito por inteiro.
  const limite = quase ? fimDoMes(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7))) : hoje;
  if (!data) erros.push('Data inválida ou vazia.');
  else if (data > limite) erros.push('A data do acidente não pode ser futura.');
  else if (data < '1990-01-01') erros.push('Data do acidente fora do intervalo aceito.');
  const obraId = limpar(entrada?.obraId) || null;
  // Importação sem de-para: a obra fica com o nome que veio na planilha, sem vínculo com o Cadastro de obras.
  const obraPlanilha = obraId ? null : limpar(entrada?.obraPlanilha) || null;
  if (!obraId && !obraPlanilha) erros.push('Obra não informada ou não encontrada no Cadastro de obras.');
  const faseObra = faseObraPadrao(entrada?.faseObra);
  // Quase acidente não tem acidentado, função, empresa, parte do corpo nem afastamento; a fase é opcional.
  if (!faseObra && (!quase || limpar(entrada?.faseObra))) erros.push(limpar(entrada?.faseObra) ? `Fase da obra "${limpar(entrada.faseObra)}" fora da lista (${FASES_OBRA.join(', ')}).` : 'Informe a fase da obra.');
  const nomeAcidentado = quase ? null : limpar(entrada?.nomeAcidentado);
  if (!quase && !nomeAcidentado) erros.push('Informe o nome do acidentado.');
  const funcao = quase ? null : limpar(entrada?.funcao) || null;
  if (!quase && !funcao) erros.push('Informe a função.');
  const empresa = quase ? null : limpar(entrada?.empresa) || null;
  if (!quase && !empresa) erros.push('Informe o nome da empresa.');
  if (!tipo) erros.push(limpar(entrada?.tipo) ? `Tipo "${limpar(entrada.tipo)}" inválido (use ${SIGLAS_REGISTRO.join(', ')}).` : 'Informe o tipo do acidente.');
  const categoria = quase ? categoriaQuasePadrao(entrada?.categoria) : null;
  if (quase && !categoria) erros.push(limpar(entrada?.categoria) ? `Categoria "${limpar(entrada.categoria)}" fora da lista padronizada.` : 'Selecione a categoria do quase acidente.');
  const parteCorpo = quase ? null : parteCorpoPadrao(entrada?.parteCorpo);
  if (!quase && !parteCorpo) erros.push(limpar(entrada?.parteCorpo) ? `Parte do corpo "${limpar(entrada.parteCorpo)}" fora da lista.` : 'Informe a parte do corpo atingida.');
  const diasAfastamento = quase ? null : diasValidos(entrada?.diasAfastamento);
  if (!quase && diasAfastamento === null) erros.push('Dias de afastamento: informe um número inteiro igual ou maior que zero.');
  const resumo = String(entrada?.resumo ?? '').trim();
  if (!resumo) erros.push(quase ? 'Informe a descrição do quase acidente.' : 'Informe o resumo do acidente.');
  if (erros.length) return { acidente: null, erros };
  const acidente = { data, obraId, obraPlanilha, faseObra, nomeAcidentado, funcao, empresa, tipo, categoria, parteCorpo, diasAfastamento, resumo };
  return { acidente: { ...acidente, chaveDedup: chaveDeduplicacao(acidente) }, erros };
}

/**
 * Identificador do acidente para não importar duas vezes a mesma linha da planilha acumulativa.
 * Combina data + obra + acidentado + tipo + parte do corpo + função + empresa (nunca só nome ou data).
 * Dias de afastamento e resumo ficam de fora de propósito: na planilha acumulativa eles costumam ser
 * corrigidos depois (afastamento prorrogado, texto revisado) e isso não pode gerar um segundo acidente.
 */
export function chaveDeduplicacao(a) {
  // Quase acidente não tem pessoa: o que o identifica é o mês, a obra, a categoria e a descrição (resumida em hash).
  const obra = a.obraId ?? `planilha:${chaveObra(a.obraPlanilha)}`;
  if (a.tipo === SIGLA_QUASE) return [a.data, obra, SIGLA_QUASE, semAcento(a.categoria), hashTexto(semAcento(a.resumo))].join('|');
  return [a.data, obra, semAcento(a.nomeAcidentado), a.tipo, semAcento(a.parteCorpo), semAcento(a.funcao), semAcento(a.empresa)].join('|');
}

/** Hash curto e estável (cyrb53): a chave vai na URL da consulta ao Supabase e a descrição pode ser longa. */
function hashTexto(texto) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const POR_CABECALHO = new Map(CAMPOS_ACIDENTE.flatMap((c) => [c.cabecalho, ...(c.outros ?? [])].map((cab) => [semAcento(cab), c.campo])));

/**
 * Objeto de linha da planilha (cabeçalho → valor) → entrada com os campos do app. A primeira coluna com o
 * cabeçalho vence: as listas de validação ao lado da aba Dados ("Nome da Obra_1"…) ficam de fora.
 */
export function entradaDeLinha(linha) {
  const entrada = {};
  for (const [cab, valor] of Object.entries(linha ?? {})) {
    const campo = POR_CABECALHO.get(semAcento(cab));
    if (campo && !(campo in entrada)) entrada[campo] = valor;
  }
  return entrada;
}

const CABECALHOS_QUASE = new Map([
  ['obra', 'obra'], ['nome da obra', 'obra'],
  ['mes', 'mes'], ['mes/ano', 'mes'], ['periodo', 'mes'],
  ['descricao do quase acidente', 'resumo'], ['descricao do quase-acidente', 'resumo'], ['descricao', 'resumo'],
  ['categoria padronizada', 'categoria'], ['categoria', 'categoria'],
]);

/** Linha da aba "Base Consolidada" → entrada de quase acidente, com a data no último dia do mês. */
export function entradaQuaseDeLinha(linha) {
  const lida = {};
  for (const [cab, valor] of Object.entries(linha ?? {})) {
    const campo = CABECALHOS_QUASE.get(semAcento(cab));
    if (campo && !(campo in lida)) lida[campo] = valor;
  }
  if (!limpar(lida.obra) && !limpar(lida.mes) && !limpar(lida.resumo) && !limpar(lida.categoria)) return {};
  return { obra: lida.obra, data: ultimoDiaDoMes(lida.mes) ?? limpar(lida.mes), tipo: SIGLA_QUASE, categoria: lida.categoria, resumo: lida.resumo };
}

/** A planilha tem as colunas da Base Consolidada? */
export const ehPlanilhaQuase = (linhas) => (linhas ?? []).some((l) => {
  const cabs = Object.keys(l ?? {}).map(semAcento);
  return cabs.includes('categoria padronizada') && cabs.includes('mes');
});

/** Linha toda vazia nos campos do acidente (sobras de formatação, listas de validação ao lado). */
export function linhaVazia(entrada) {
  return ['data', 'obra', 'nomeAcidentado', 'tipo', 'empresa', 'funcao'].every((c) => limpar(entrada[c]) === '');
}

/**
 * Encontra o cadastro da obra pelo nome da planilha: nome normalizado, "Incorporação + Obra" ou de-para
 * escolhido pelo usuário na pré-visualização (`mapa`: chave do nome → id do cadastro).
 */
export function encontrarObra(nome, incorporacao, cadastros, mapa = {}) {
  const chave = chaveObra(nome);
  if (!chave) return null;
  if (mapa[chave]) return cadastros.find((c) => c.id === mapa[chave]) ?? null;
  return cadastros.find((c) => c.chave === chave)
    ?? (incorporacao ? cadastros.find((c) => c.chave === chaveObra(`${incorporacao} ${nome}`)) : null)
    ?? null;
}

/**
 * Busca de obra enquanto o usuário digita: todas as palavras precisam aparecer no nome ou no cliente
 * (sem diferenciar acento e caixa). Nomes que começam com o texto vêm primeiro.
 */
export function filtrarObras(cadastros, texto) {
  const busca = semAcento(texto);
  const palavras = busca.split(' ').filter(Boolean);
  return (cadastros ?? [])
    .filter((c) => { const alvo = semAcento(`${c.obra} ${c.cliente ?? ''}`); return palavras.every((p) => alvo.includes(p)); })
    .map((c, i) => ({ c, i, inicio: busca && semAcento(c.obra).startsWith(busca) ? 0 : 1 }))
    .sort((a, b) => a.inicio - b.inicio || a.i - b.i)
    .map(({ c }) => c);
}

/** Incorporador e método construtivo de uma obra, sempre do Cadastro de obras. */
export function dadosDaObra(cadastro) {
  return { obra: cadastro?.obra ?? null, chaveObra: cadastro?.chave ?? null, incorporador: cadastro?.cliente ?? null, metodoConstrutivo: cadastro?.sistemaEstrutural ?? null };
}

/** O cadastro da obra tem o que o acidente exige? (Cliente e Sistema estrutural). */
export function pendenciasDaObra(cadastro) {
  const faltam = [];
  if (!limpar(cadastro?.cliente)) faltam.push('Cliente');
  if (!limpar(cadastro?.sistemaEstrutural)) faltam.push('Sistema estrutural');
  return faltam;
}

/**
 * Analisa as linhas de uma planilha: cada uma volta com `situacao` ('novo' | 'existente' | 'repetido' | 'erro'),
 * erros, avisos e o acidente normalizado. Usada na pré-visualização e de novo no servidor ao confirmar.
 * @param {object[]} linhas  objetos {cabeçalho: valor}
 * @param {object[]} cadastros  Cadastro de obras
 * @param {Map<string, object>} existentes  chaveDedup → acidente já gravado
 */
export function analisarImportacao(linhas, cadastros, existentes, { mapaObras = {}, hoje, modo = 'acidentes' } = {}) {
  const vistos = new Map();
  const resultado = [];
  const paraEntrada = modo === 'quase' ? entradaQuaseDeLinha : entradaDeLinha;
  (linhas ?? []).forEach((linha, i) => {
    const entrada = paraEntrada(linha);
    if (linhaVazia(entrada)) return;
    const numero = Number(linha?.__linha) || i + 2;
    const cadastro = encontrarObra(entrada.obra, entrada.incorporador, cadastros, mapaObras);
    const erros = [];
    const avisos = [];
    if (!limpar(entrada.obra)) erros.push('Informe o nome da obra.');
    else if (!cadastro) avisos.push('Sem associação: entra com o nome da planilha.');
    else {
      const faltam = pendenciasDaObra(cadastro);
      if (faltam.length) erros.push(`Complete no Cadastro de obras de ${cadastro.obra}: ${faltam.join(' e ')}.`);
      const obra = dadosDaObra(cadastro);
      if (limpar(entrada.incorporador) && obra.incorporador && semAcento(entrada.incorporador) !== semAcento(obra.incorporador)) {
        avisos.push(`Incorporação "${limpar(entrada.incorporador)}" na planilha; vale a do cadastro: "${obra.incorporador}".`);
      }
      if (limpar(entrada.metodoConstrutivo) && obra.metodoConstrutivo && semAcento(entrada.metodoConstrutivo) !== semAcento(obra.metodoConstrutivo)) {
        avisos.push(`Método construtivo "${limpar(entrada.metodoConstrutivo)}" na planilha; vale o do cadastro: "${obra.metodoConstrutivo}".`);
      }
    }
    const { acidente, erros: errosCampos } = validarAcidente({ ...entrada, obraId: cadastro?.id ?? '', obraPlanilha: cadastro ? null : entrada.obra }, { hoje });
    // Já importado antes só com o nome da planilha e agora associado a uma obra: continua sendo o mesmo registro.
    const chaveAlternativa = acidente && cadastro ? chaveDeduplicacao({ ...acidente, obraId: null, obraPlanilha: entrada.obra }) : null;
    erros.push(...errosCampos.filter((e) => !e.startsWith('Obra não informada')));
    let situacao = erros.length ? 'erro' : 'novo';
    if (acidente && !erros.length) {
      const ja = existentes.get(acidente.chaveDedup) ?? (chaveAlternativa ? existentes.get(chaveAlternativa) : undefined);
      if (ja) {
        situacao = 'existente';
        if (ja.diasAfastamento !== acidente.diasAfastamento) avisos.push(`Já cadastrado com ${ja.diasAfastamento} dia(s) de afastamento (planilha: ${acidente.diasAfastamento}). O registro existente foi mantido.`);
      } else if (vistos.has(acidente.chaveDedup)) {
        situacao = 'repetido';
        avisos.push(`Mesmo acidente da linha ${vistos.get(acidente.chaveDedup)} desta planilha.`);
      } else vistos.set(acidente.chaveDedup, numero);
    }
    resultado.push({ linha: numero, situacao, erros, avisos, entrada: resumoEntrada(entrada), obraId: cadastro?.id ?? null, chaveAlternativa, acidente: erros.length ? null : acidente });
  });
  const contar = (s) => resultado.filter((r) => r.situacao === s).length;
  const obrasNaoEncontradas = [...new Map(resultado
    .filter((r) => !r.obraId && limpar(r.entrada.obra))
    .map((r) => [chaveObra(r.entrada.obra), limpar(r.entrada.obra)])).entries()].map(([chave, nome]) => ({ chave, nome }));
  return {
    linhas: resultado,
    totais: { lidas: resultado.length, novos: contar('novo'), existentes: contar('existente'), repetidos: contar('repetido'), erros: contar('erro') },
    obrasNaoEncontradas,
  };
}

/** Valores exibidos na pré-visualização (texto como veio, data já legível). */
function resumoEntrada(e) {
  const saida = {};
  for (const { campo } of CAMPOS_ACIDENTE) saida[campo] = campo === 'data' ? (dataIso(e.data) ?? limpar(e.data)) : (e[campo] instanceof Date ? dataIso(e[campo]) : limpar(e[campo]));
  saida.resumo = String(e.resumo ?? '').trim();
  saida.categoria = limpar(e.categoria);
  return saida;
}

// ── Indicadores ──────────────────────────────────────────────────────────
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Contagem por categoria, da maior para a menor (empate: ordem alfabética). */
function contarPor(acidentes, chave) {
  const mapa = new Map();
  for (const a of acidentes) {
    const k = chave(a);
    if (k) mapa.set(k, (mapa.get(k) ?? 0) + 1);
  }
  return [...mapa].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}

/**
 * "10 primeiros" da tabela dinâmica do Excel: os 10 maiores valores, incluindo os empatados com o 10º
 * (por isso a planilha de referência mostra 11 funções).
 */
export function primeiros(itens, n = 10) {
  if (itens.length <= n) return itens;
  const corte = itens[n - 1].valor;
  return itens.filter((i) => i.valor >= corte);
}

/** Nome de exibição que agrupa grafias diferentes ("mão" e "Mão"; "Persona " e "Persona"). */
function agrupado(campo) {
  const nomes = new Map();
  return (a) => {
    const texto = limpar(a[campo]);
    if (!texto) return null;
    const k = semAcento(texto);
    if (!nomes.has(k)) nomes.set(k, texto);
    return nomes.get(k);
  };
}

/**
 * Indicadores do Dashboard Segurança — mesmas tabelas dinâmicas da planilha de referência
 * (Analise_Dinamicas → Dashboard-01 e Dashboard-02), todas contando acidentes ("Contagem de Tipo"):
 *   Tab01 total · Tab02 média de dias de afastamento · Tab03 por ano · Tab04 por mês (Jan–Dez)
 *   Tab05 por obra (10 primeiros) · Tab06 por fase · Tab07 por função (10 primeiros)
 *   Tab08 por parte do corpo (10 primeiros) · Tab09 por tipo (classificação) · Tab10 por empresa (10 primeiros)
 * @param {Array<{data, tipo, faseObra, funcao, empresa, parteCorpo, diasAfastamento, obra}>} acidentes
 */
export function calcularIndicadores(acidentes) {
  const registros = acidentes ?? [];
  // Quase acidente não é acidente: fica fora de todos os indicadores, menos da base da Pirâmide de Bird.
  const lista = registros.filter((a) => a.tipo !== SIGLA_QUASE);
  const total = lista.length;
  const somaDias = lista.reduce((s, a) => s + (Number(a.diasAfastamento) || 0), 0);
  // Média como a tabela dinâmica do Excel (Tab02): acidentes sem dias informados ficam fora do divisor.
  const comDias = lista.filter((a) => a.diasAfastamento !== null && a.diasAfastamento !== undefined && a.diasAfastamento !== '').length;
  const porMes = MESES_CURTOS.map((rotulo, i) => ({ rotulo, valor: lista.filter((a) => Number(String(a.data).slice(5, 7)) === i + 1).length }));
  const anos = contarPor(lista, (a) => String(a.data).slice(0, 4)).sort((a, b) => a.rotulo.localeCompare(b.rotulo));
  const anosComQuase = [...new Set(registros.map((a) => String(a.data).slice(0, 4)))].sort();
  const porTipo = SIGLAS_TIPO.map((sigla) => ({ rotulo: sigla, valor: lista.filter((a) => a.tipo === sigla).length }));
  return {
    total,
    quaseAcidentes: registros.length - lista.length,
    mediaDias: comDias ? somaDias / comDias : null,
    totalDias: somaDias,
    porMes,
    porAno: anos,
    porTipo,
    porFase: contarPor(lista, agrupado('faseObra')).sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR')),
    porObra: primeiros(contarPor(lista, agrupado('obra'))),
    porFuncao: primeiros(contarPor(lista, agrupado('funcao'))),
    porEmpresa: primeiros(contarPor(lista, agrupado('empresa'))),
    porParteCorpo: primeiros(contarPor(lista, agrupado('parteCorpo'))),
    // Pirâmide de Bird: contagem por tipo em cada ano (evolução dos níveis).
    porAnoTipo: anosComQuase.map((ano) => ({
      ano, ...Object.fromEntries(SIGLAS_REGISTRO.map((s) => [s, registros.filter((a) => a.tipo === s && String(a.data).startsWith(ano)).length])),
    })),
  };
}

// ── Pirâmide de Bird ─────────────────────────────────────────────────────
/**
 * Níveis da pirâmide de Bird (1969: 1 : 10 : 30 : 600) e o tipo de acidente que alimenta cada um.
 * Mapeamento definido pela Unità em 23/11/2026: FT = grave · CPT + SPT = lesão leve · TRJ = dano material · QA = quase acidente.
 * `cor` é a cor do nível na pirâmide (vermelho, azul, verde, laranja). A classificação do acidente tem cores próprias (TIPOS_REGISTRO).
 */
export const PIRAMIDE_BIRD = Object.freeze([
  { nivel: 1, tipo: 'FT', cor: '--bird-grave', nome: 'Acidente grave', descricao: 'Acidente fatal', proporcao: 1 },
  { nivel: 2, tipo: 'CPT', cor: '--bird-leve', tipos: ['CPT', 'SPT'], nome: 'Acidente com lesão leve', descricao: 'Com ou sem perda de tempo', proporcao: 10 },
  { nivel: 3, tipo: 'TRJ', cor: '--bird-dano', nome: 'Acidente com dano material', descricao: 'Acidente de trajeto', proporcao: 30 },
  { nivel: 4, tipo: SIGLA_QUASE, cor: '--bird-quase', nome: 'Quase acidente', descricao: 'Incidente sem lesão nem dano', proporcao: 600 },
]);

/**
 * Indicadores da pirâmide a partir da contagem por tipo ({FT, CPT, SPT, TRJ, QA}).
 * - Âncora: o nível mais alto com ocorrência. Dele sai o "esperado por Bird" dos demais
 *   (ex.: 137 lesões leves → esperados 13,7 graves, 411 danos materiais e 8.220 quase acidentes).
 * - Proporção observada: cada nível dividido pelo mesmo fator, comparável com 1 : 10 : 30 : 600.
 * - Cobertura: observado ÷ esperado (abaixo de 100% = menos registros do que Bird prevê).
 * - Gravidade: % das ocorrências nos dois níveis de cima (grave + lesão).
 * - Base por acidente com lesão: quase acidentes ÷ (graves + lesões leves); Bird espera 600 ÷ 11 ≈ 54,5.
 */
export function calcularPiramideBird(contagem) {
  const qtd = (tipo) => Number(contagem?.[tipo]) || 0;
  const doNivel = (n) => (n.tipos ?? [n.tipo]).reduce((s, t) => s + qtd(t), 0);
  const total = PIRAMIDE_BIRD.reduce((s, n) => s + doNivel(n), 0);
  const ancora = PIRAMIDE_BIRD.find((n) => doNivel(n) > 0) ?? null;
  const fator = ancora ? doNivel(ancora) / ancora.proporcao : null;
  const niveis = PIRAMIDE_BIRD.map((n) => {
    const ocorrencias = doNivel(n);
    const esperado = fator === null ? null : n.proporcao * fator;
    return {
      ...n,
      ocorrencias,
      percentual: total ? ocorrencias / total : null,
      proporcaoObservada: fator ? ocorrencias / fator : null,
      esperado,
      cobertura: esperado ? ocorrencias / esperado : null,
      ancora: n === ancora,
    };
  });
  const comLesao = niveis[0].ocorrencias + niveis[1].ocorrencias;
  return {
    total,
    ancora: ancora?.nivel ?? null,
    niveis,
    gravidade: total ? comLesao / total : null,
    basePorLesao: comLesao ? niveis[3].ocorrencias / comLesao : null,
    basePorLesaoBird: 600 / 11,
    coberturaBase: niveis[3].cobertura,
  };
}

/** Anos com acidentes (para o segmentador "Ano"). */
export const anosDosAcidentes = (acidentes) => [...new Set((acidentes ?? []).map((a) => String(a.data).slice(0, 4)))].sort();

/**
 * Meses do eixo do gráfico "Nº de acidentes ocorridos no mês":
 * - de 1 mês antes do primeiro acidente até 1 mês depois do último, com todos os meses do meio (mesmo sem acidente);
 * - no mínimo 12 meses: se o intervalo for menor, completa para trás (o último mês continua sendo o último acidente + 1);
 * - sem acidentes: os 12 meses até o mês de referência.
 * @param {string} referencia  "AAAA-MM" usado só quando não há acidentes
 */
export function mesesDoGrafico(acidentes, { referencia, minimo = 12 } = {}) {
  const meses = (acidentes ?? []).map((a) => String(a.data).slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
  const fim = meses.length ? somarMeses(meses.at(-1), 1) : (referencia ?? new Date().toISOString().slice(0, 7));
  let inicio = meses.length ? somarMeses(meses[0], -1) : somarMeses(fim, -(minimo - 1));
  if (intervaloMeses(inicio, fim).length < minimo) inicio = somarMeses(fim, -(minimo - 1));
  return intervaloMeses(inicio, fim);
}

/**
 * Modelo - Indicador Segurança do Trabalho: para cada mês do período, a quantidade de acidentes de cada tipo
 * (colunas SPT/CPT/TRJ/FT da tabela e barras do gráfico "Nº de Acidentes Ocorridos no Mês").
 * @param {string[]} meses  "AAAA-MM" em ordem
 */
export function serieMensalPorTipo(acidentes, meses) {
  const indice = new Map(meses.map((m, i) => [m, i]));
  const series = Object.fromEntries(SIGLAS_TIPO.map((s) => [s, meses.map(() => 0)]));
  for (const a of acidentes ?? []) {
    const i = indice.get(String(a.data).slice(0, 7));
    if (i !== undefined && series[a.tipo]) series[a.tipo][i] += 1;
  }
  return series;
}

/**
 * Linhas da tabela do modelo, agrupadas por período (mês): cada mês com acidentes traz os acidentes em ordem
 * de data e a contagem por tipo; o mês de referência aparece mesmo vazio (última linha do modelo).
 */
export function tabelaPorPeriodo(acidentes, { referencia = null } = {}) {
  const porMes = new Map();
  for (const a of [...(acidentes ?? [])].sort((x, y) => x.data.localeCompare(y.data))) {
    const mes = a.data.slice(0, 7);
    if (!porMes.has(mes)) porMes.set(mes, []);
    porMes.get(mes).push(a);
  }
  if (referencia && !porMes.has(referencia) && ![...porMes.keys()].some((m) => m > referencia)) porMes.set(referencia, []);
  return [...porMes].sort(([a], [b]) => a.localeCompare(b)).map(([mes, lista]) => ({
    mes,
    acidentes: lista,
    porTipo: Object.fromEntries(SIGLAS_TIPO.map((s) => [s, lista.filter((a) => a.tipo === s).length])),
    diasPerdidos: lista.reduce((s, a) => s + (Number(a.diasAfastamento) || 0), 0),
  }));
}
