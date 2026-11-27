/**
 * IAT (Informativo do Acidente do Trabalho, SMS-IAT) e IST (Informativo de Segurança do Trabalho, SMS-IST):
 * campos, listas suspensas e regras — funções puras usadas pelo navegador, pelo servidor e pelos testes.
 *
 * Fontes: planilhas "SMS-IAT-REV09" (abas IAT, IAT Metrocasa, Base, Tabelas 13/14/15/17) e "SMS-IST-REV05"
 * (abas IST, Contra-Relatório, Base). Obra, engenheiro e coordenador saem do Cadastro de obras do sistema
 * (a aba Base das planilhas é ignorada nesses campos).
 */
import { semAcento } from './normalizar.js';
import { TABELA_13, TABELA_14, TABELA_15, TABELA_17 } from './tabelas-esocial.js';

export { TABELA_13, TABELA_14, TABELA_15, TABELA_17 };

// ── Listas suspensas ─────────────────────────────────────────────────────
export const SIM_NAO = Object.freeze(['Sim', 'Não']);
export const SEXOS = Object.freeze(['Masculino', 'Feminino']);
export const ESTADOS_CIVIS = Object.freeze(['Solteiro', 'Casado', 'Divorciado', 'Viúvo']);
export const UFS_LOCAL = Object.freeze(['SP', 'MG']);
export const LATERALIDADES = Object.freeze(['Esquerda', 'Direita', 'Ambos']);
/** Aba Base, coluna "Tipo de Acidente". */
export const TIPOS_ACIDENTE_IAT = Object.freeze(['Típico', 'Doença Ocupacional', 'Trajeto']);
/** Aba Base da IST, coluna "Ocorrencias". */
export const OCORRENCIAS_IST = Object.freeze([
  'Quase Acidente', 'Dano Material', 'Dano Máquina/Eqpto', 'Dano Ambiental', 'Furto', 'Roubo', 'Vandalismo',
  'Greve/Paralisação', 'Sindicato', 'Fiscalização da Prefeitura', 'Fiscalização do Ministério do Trabalho',
  'Fiscalização da Vigilância Sanitária', 'Fiscalização do CREA', 'Ausência de Pagamento de Salário', 'Coleta Seletiva',
  'Sustentabilidade no Canteiro de Obra', 'Reclamação do Vizinho', 'Abandono de Serviço', 'Alojamento Irregular',
  'Área de Vivência Irregular', 'Outros',
]);

export const TABELAS_IAT = Object.freeze({ parteCorpo: TABELA_13, agenteCausador: TABELA_14, situacaoGeradora: TABELA_15, naturezaLesao: TABELA_17 });

/** Descrição de um código das tabelas do eSocial (como o PROCV da planilha). */
export function descricaoTabela(tabela, codigo) {
  const c = String(codigo ?? '').trim();
  return c ? (tabela.find(([k]) => k === c)?.[1] ?? '') : '';
}

// ── Cabeçalhos dos formulários ───────────────────────────────────────────
export const CABECALHO_IAT = Object.freeze({ codigo: 'SMS-IAT', titulo: 'IAT - INFORMATIVO DO ACIDENTE DE TRABALHO', revisao: 'Revisão: 08', data: '2024-05-27' });
export const CABECALHO_METROCASA = Object.freeze({ titulo: 'RESUMO DA OCORRÊNCIA (METROCASA)' });
export const CABECALHO_IST = Object.freeze({ codigo: 'SMS-IST', titulo: 'IST - INFORMATIVO DE SEGURANÇA DO TRABALHO', revisao: 'Revisão: 05', data: '2024-12-03' });
export const CABECALHO_CONTRA = Object.freeze({ codigo: 'SMS-IST', titulo: 'CONTRA-RELATÓRIO DO IST', revisao: 'Revisão: 05', data: '2024-12-03' });

export const AVISO_ESOCIAL = 'Conforme legislação vigente do eSocial (informações trabalhistas, previdenciárias e tributárias), o prazo do envio da CAT-Comunicação do Acidente de Trabalho (S-2210) deve ser registrada até o primeiro dia útil seguinte ao da ocorrência e, em caso de morte, de imediato. Caso o acidente de trabalho resulte em afastamento do trabalhador, o declarante deve também, obrigatoriamente, enviar o evento S-2230. Ressalta-se ainda que, para os estagiários, não é obrigatório o envio dos eventos de SST.';
export const RODAPE_IAT = 'Após o preenchimento deste informativo, o TST da obra deverá enviar por e-mail em até 24 horas do acidente ocorrido para acidentes@unitaengenharia.com.br, com cópia para o Engenheiro Residente, Administrativo da Obra, Qualidade e responsável da empresa contratada, quando aplicável.';
export const RODAPE_METROCASA = 'METROCASA: após o preenchimento deste informativo, o TST da obra inicialmente deverá converter este arquivo no formato PDF, e posteriormente enviar por e-mail em até 24 horas do acidente ocorrido para comunicacao.acidentes@metrocasa.com.br';
export const RODAPE_IST = 'Após o preenchimento deste informativo, o TST da obra deverá enviar por e-mail para acidentes@unitaengenharia.com.br, com cópia para Coordenador de Engenharia, Engenheiro Residente, Administrativo da Obra, Qualidade e responsável da empresa contratada, quando aplicável.';

/** Valores fixos da seção I e II da IAT (vêm preenchidos na planilha). */
export const FIXOS_IAT = Object.freeze({ emitente: 'Empregador', tipoCat: 'Inicial', iniciativaCat: 'Empregador', fonteCadastramento: 'eSocial', tipoInscricao: 'CNPJ' });

/** VIII — Evidências objetivas (Sim → anexar a cópia do documento em PDF). */
export const EVIDENCIAS_IAT = Object.freeze([
  { id: 'capacitacao', texto: 'O acidentado recebeu capacitação e treinamento, conforme NRs 1.7 e 18.14 ?' },
  { id: 'osst', texto: 'O acidentado possui OSST, conforme NR 01, ítem 1.4.1 alínea "c" ?' },
  { id: 'fichaEpi', texto: 'O acidentado possui a Ficha de EPI, conforme NR 06 ?' },
  { id: 'dsq', texto: 'O acidentado participava nos DSQ da obra ?' },
  { id: 'certificados', texto: 'O acidentado possui os certificados pertinentes a sua atividade ?' },
  { id: 'aprLpp', texto: 'Na atividade do acidentado, possui a APR/LPP ?' },
  { id: 'pt', texto: 'Na atividade do acidentado, possui a PT (Permissão de Trabalho) assinada ?' },
  { id: 'outros', texto: 'Outros:', comTexto: true },
]);
export const AVISO_ANEXO = 'Anexar a cópia do documento, em formato PDF';

/** Relatório fotográfico da IAT (6 fotos com legenda fixa); as 4 primeiras vão para a IAT Metrocasa. */
export const FOTOS_IAT = Object.freeze(['Parte do Corpo Atingida', 'Agente Causador', 'Situação Geradora', 'Local do Acidente', 'Atestado Médico com CRM e CID', 'Outros, se necessário']);
export const LINHAS_PLANO_IAT = 4;
export const LINHAS_PLANO_IST = 6;
export const FOTOS_IST = 12;

// ── Campos da IAT (ordem e rótulos da aba IAT) ───────────────────────────
// tipo: texto | data | hora | numero | lista | simnao | tabela | longo | fixo | obra | moeda
// largura: colunas de uma grade de 12 (tela); `tabela`: chave em TABELAS_IAT.
export const SECOES_IAT = Object.freeze([
  {
    titulo: 'I- DADOS DE IDENTIFICAÇÃO',
    campos: [
      { id: 'emitente', rotulo: 'Emitente', tipo: 'fixo', largura: 3 },
      { id: 'tipoCat', rotulo: 'Tipo de CAT', tipo: 'fixo', largura: 3 },
      { id: 'iniciativaCat', rotulo: 'Iniciativa da CAT', tipo: 'fixo', largura: 3 },
      { id: 'fonteCadastramento', rotulo: 'Fonte do cadastramento', tipo: 'fixo', largura: 3 },
      { id: 'numeroCat', rotulo: 'Nº da CAT', tipo: 'auto', largura: 3, ajuda: 'Gerado automaticamente (último + 1)' },
      { id: 'obraId', rotulo: 'Nome da Obra', tipo: 'obra', largura: 5, obrigatorio: true },
      { id: 'engenheiroResidente', rotulo: 'Engenheiro Residente', tipo: 'texto', largura: 4, ajuda: 'Engenharia do Cadastro de obras' },
    ],
  },
  {
    titulo: 'II- DADOS DO EMITENTE (EMPREGADOR)',
    campos: [
      { id: 'razaoSocial', rotulo: 'Razão Social', tipo: 'texto', largura: 4, obrigatorio: true, ajuda: 'Empresa do acidentado (contratada)' },
      { id: 'tipoInscricao', rotulo: 'Tipo', tipo: 'fixo', largura: 2 },
      { id: 'cnpj', rotulo: 'Nº da Inscrição (CNPJ)', tipo: 'texto', largura: 3 },
      { id: 'cnae', rotulo: 'CNAE', tipo: 'texto', largura: 3 },
    ],
  },
  {
    titulo: 'III- DADOS DO ACIDENTADO',
    campos: [
      { id: 'nomeAcidentado', rotulo: 'Nome do Colaborador Acidentado', tipo: 'texto', largura: 4, obrigatorio: true },
      { id: 'cpf', rotulo: 'CPF', tipo: 'texto', largura: 2 },
      { id: 'dataNascimento', rotulo: 'Data de Nascimento', tipo: 'data', largura: 2 },
      { id: 'sexo', rotulo: 'Sexo', tipo: 'lista', opcoes: SEXOS, largura: 2 },
      { id: 'estadoCivil', rotulo: 'Estado Civil', tipo: 'lista', opcoes: ESTADOS_CIVIS, largura: 2 },
      { id: 'cbo', rotulo: 'CBO', tipo: 'texto', largura: 2 },
      { id: 'filiacaoPrevidencia', rotulo: 'Filiação à previdência social', tipo: 'texto', largura: 3 },
      { id: 'areas', rotulo: 'Áreas', tipo: 'texto', largura: 3 },
      { id: 'cargoFuncao', rotulo: 'Cargo/Função', tipo: 'texto', largura: 4, obrigatorio: true },
    ],
  },
  {
    titulo: 'IV- DADOS DO ACIDENTE OU DOENÇA',
    campos: [
      { id: 'dataAcidente', rotulo: 'Data do Acidente', tipo: 'data', largura: 2, obrigatorio: true },
      { id: 'horaAcidente', rotulo: 'Hora do Acidente', tipo: 'hora', largura: 2, obrigatorio: true },
      { id: 'horasTrabalho', rotulo: 'Após quantas horas de trabalho ?', tipo: 'hora', largura: 2 },
      { id: 'tipoAcidente', rotulo: 'Tipo de Acidente', tipo: 'lista', opcoes: TIPOS_ACIDENTE_IAT, largura: 2, obrigatorio: true },
      { id: 'houveAfastamento', rotulo: 'Houve afastamento ?', tipo: 'simnao', largura: 2 },
      { id: 'ultimoDiaTrabalhado', rotulo: 'Último dia trabalhado', tipo: 'data', largura: 2 },
      { id: 'pais', rotulo: 'País', tipo: 'texto', largura: 2, padrao: 'Brasil' },
      { id: 'enderecoLocal', rotulo: 'Especificação (endereço) do local do acidente', tipo: 'texto', largura: 4 },
      { id: 'cnpjLocal', rotulo: 'CNPJ', tipo: 'texto', largura: 2 },
      { id: 'uf', rotulo: 'UF', tipo: 'lista', opcoes: UFS_LOCAL, largura: 1 },
      { id: 'municipio', rotulo: 'Município do local do acidente', tipo: 'texto', largura: 3 },
      { id: 'localAcidente', rotulo: 'Local do acidente (bloco/andar)', tipo: 'texto', largura: 4, obrigatorio: true },
      { id: 'parteCorpo', rotulo: 'Tabela 13-Parte do Corpo Atingida', tipo: 'tabela', tabela: 'parteCorpo', largura: 12, obrigatorio: true },
      { id: 'agenteCausador', rotulo: 'Tabela 14-Agente Causador', tipo: 'tabela', tabela: 'agenteCausador', largura: 12, obrigatorio: true },
      { id: 'situacaoGeradora', rotulo: 'Tabela 15-Situação Geradora', tipo: 'tabela', tabela: 'situacaoGeradora', largura: 12, obrigatorio: true },
      { id: 'registroPolicial', rotulo: 'Houve registro policial ?', tipo: 'simnao', largura: 3 },
      { id: 'houveMorte', rotulo: 'Houve morte ?', tipo: 'simnao', largura: 3 },
      { id: 'dataObito', rotulo: 'Data do óbito', tipo: 'data', largura: 3 },
      { id: 'lateralidade', rotulo: 'Lateralidade', tipo: 'lista', opcoes: LATERALIDADES, largura: 3 },
      { id: 'observacoes', rotulo: 'Observações (descrição do acidente)', tipo: 'longo', largura: 12, obrigatorio: true },
    ],
  },
  {
    titulo: 'V- DADOS DO ATESTADO MÉDICO',
    campos: [
      { id: 'atestadoData', rotulo: 'Data', tipo: 'data', largura: 2 },
      { id: 'atestadoHora', rotulo: 'Hora', tipo: 'hora', largura: 2 },
      { id: 'internacao', rotulo: 'Houve internação ?', tipo: 'simnao', largura: 2 },
      { id: 'duracaoTratamentoDias', rotulo: 'Provável duração do tratamento (dias)', tipo: 'numero', largura: 3 },
      { id: 'afastarTratamento', rotulo: 'Deverá o acidentado afastar-se do trabalho durante o tratamento ?', tipo: 'simnao', largura: 3 },
    ],
  },
  {
    titulo: 'VI- LESÃO',
    campos: [{ id: 'naturezaLesao', rotulo: 'Tabela 17-Natureza da Lesão', tipo: 'tabela', tabela: 'naturezaLesao', largura: 12 }],
  },
  {
    titulo: 'VII- DIAGNÓSTICO',
    campos: [
      { id: 'diagnostico', rotulo: 'Diagnóstico provável', tipo: 'texto', largura: 9 },
      { id: 'cid', rotulo: 'CID', tipo: 'texto', largura: 3 },
      { id: 'medicoNome', rotulo: 'Nome do médico', tipo: 'texto', largura: 6 },
      { id: 'medicoCrm', rotulo: 'CRM do médico', tipo: 'texto', largura: 4 },
      { id: 'medicoUf', rotulo: 'UF', tipo: 'texto', largura: 2 },
      { id: 'observacoesDiagnostico', rotulo: 'OBSERVAÇÕES', tipo: 'longo', largura: 12 },
    ],
  },
]);

/** IAT Metrocasa: campo, rótulo e de onde vem na IAT (fórmulas da aba "IAT Metrocasa"). */
export const CAMPOS_METROCASA = Object.freeze([
  { id: 'tipo', rotulo: 'Tipo', origem: 'Incidente se o afastamento for 0 dia; senão, Acidente', tipo: 'lista', opcoes: ['Incidente', 'Acidente'] },
  { id: 'obra', rotulo: 'Nome da Obra', origem: 'Nome da Obra', tipo: 'fixo' },
  { id: 'empresa', rotulo: 'Nome da Empresa Contratada', origem: 'Razão Social' },
  { id: 'funcao', rotulo: 'Função', origem: 'Cargo/Função' },
  { id: 'torreAndar', rotulo: 'Torre/Andar', origem: 'Local do acidente (bloco/andar)' },
  { id: 'material', rotulo: 'Material/Equipto', origem: 'Tabela 14-Agente Causador' },
  { id: 'resumo', rotulo: 'Resumo do Acidente', origem: 'Observações (descrição do acidente)', tipo: 'longo' },
  { id: 'afastamentoDias', rotulo: 'Com Afastamento (dias)', origem: 'Provável duração do tratamento (dias)', tipo: 'numero' },
  { id: 'parteCorpo', rotulo: 'Parte do Corpo Atingida', origem: 'Tabela 13-Parte do Corpo Atingida' },
]);

// ── Campos da IST ───────────────────────────────────────────────────────
export const CAMPOS_IST = Object.freeze([
  { id: 'data', rotulo: 'Data', tipo: 'data', largura: 2, obrigatorio: true },
  { id: 'horario', rotulo: 'Horário', tipo: 'hora', largura: 2, obrigatorio: true },
  { id: 'local', rotulo: 'Local', tipo: 'texto', largura: 4, obrigatorio: true },
  { id: 'obraId', rotulo: 'Nome do Estabelecimento', tipo: 'obra', largura: 4, obrigatorio: true },
  { id: 'descricao', rotulo: 'Descrição Resumida da Ocorrência', tipo: 'longo', largura: 12, obrigatorio: true },
  { id: 'classificacao', rotulo: 'Classificação da Ocorrência', tipo: 'lista', opcoes: OCORRENCIAS_IST, largura: 6, obrigatorio: true },
  { id: 'potencialMulta', rotulo: 'Potencial de Multa', tipo: 'moeda', largura: 6 },
  { id: 'complementoClassificacao', rotulo: 'Complemento da classificação', tipo: 'texto', largura: 12 },
]);

// ── Normalização (o que chega da tela ou da API) ─────────────────────────
const texto = (v, max = 4000) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const umaLinha = (v, max = 300) => texto(v, max).replace(/\s+/g, ' ');
const dataValida = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : '');
const horaValida = (v) => (/^\d{1,2}:\d{2}$/.test(String(v ?? '')) ? String(v).padStart(5, '0') : '');
const numeroValido = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const t = String(v).trim();
  // "1.500,50" (digitado) ou 1500.5 (campo numérico): a vírgula decide se o ponto é separador de milhar.
  const n = typeof v === 'number' ? v : Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const daLista = (lista, v) => {
  const k = semAcento(v);
  return lista.find((o) => semAcento(o) === k) ?? '';
};
const idArquivo = (v) => (typeof v === 'string' && /^[\w-]{6,80}$/.test(v) ? v : null);

function normalizarCampo(def, v) {
  switch (def.tipo) {
    case 'fixo': return FIXOS_IAT[def.id] ?? umaLinha(v);
    case 'data': return dataValida(v);
    case 'hora': return horaValida(v);
    case 'numero': return numeroValido(v);
    case 'moeda': return numeroValido(v);
    case 'lista': return daLista(def.opcoes, v);
    case 'simnao': return daLista(SIM_NAO, v);
    case 'tabela': return descricaoTabela(TABELAS_IAT[def.tabela], v) ? String(v).trim() : '';
    case 'longo': return texto(v);
    case 'obra': return umaLinha(v, 80);
    default: return umaLinha(v);
  }
}

const linhasPlano = (lista, n, campos) => Array.from({ length: n }, (_, i) => {
  const l = lista?.[i] ?? {};
  return Object.fromEntries(campos.map((c) => [c, c === 'prazoDias' ? numeroValido(l[c]) : umaLinha(l[c], 500)]));
});
const fotos = (lista, n) => Array.from({ length: n }, (_, i) => idArquivo(lista?.[i]));

export function normalizarIat(entrada = {}) {
  const saida = {};
  // 'auto' (Nº da CAT) não é digitado: é o número sequencial do registro, dado pelo servidor.
  for (const s of SECOES_IAT) for (const c of s.campos) if (c.tipo !== 'auto') saida[c.id] = normalizarCampo(c, entrada[c.id] ?? c.padrao);
  saida.evidencias = Object.fromEntries(EVIDENCIAS_IAT.map((e) => {
    const v = entrada.evidencias?.[e.id] ?? {};
    const resposta = daLista(SIM_NAO, v.resposta);
    const anexoId = resposta === 'Sim' ? idArquivo(v.anexoId) : null;
    return [e.id, { resposta, anexoId, anexoNome: anexoId ? umaLinha(v.anexoNome, 180) : '', ...(e.comTexto ? { texto: umaLinha(v.texto, 300) } : {}) }];
  }));
  saida.planoAcao = linhasPlano(entrada.planoAcao, LINHAS_PLANO_IAT, ['oQue', 'porQue', 'responsaveis', 'prazoDias']);
  saida.fotos = fotos(entrada.fotos, FOTOS_IAT.length);
  saida.metrocasa = Object.fromEntries(CAMPOS_METROCASA.filter((c) => c.tipo !== 'fixo').map((c) => {
    const v = entrada.metrocasa?.[c.id];
    if (v === null || v === undefined || v === '') return [c.id, null]; // vazio = segue a IAT
    return [c.id, c.tipo === 'numero' ? numeroValido(v) : c.tipo === 'lista' ? daLista(c.opcoes, v) || null : c.tipo === 'longo' ? texto(v) : umaLinha(v)];
  }));
  return saida;
}

export function normalizarIst(entrada = {}) {
  const saida = Object.fromEntries(CAMPOS_IST.map((c) => [c.id, normalizarCampo(c, entrada[c.id])]));
  saida.acoesImediatas = Array.from({ length: 3 }, (_, i) => umaLinha(entrada.acoesImediatas?.[i], 500));
  saida.planoAcao = linhasPlano(entrada.planoAcao, LINHAS_PLANO_IST, ['oQue', 'responsaveis', 'prazoDias'])
    .map((l) => ({ ...l, prazoDias: l.prazoDias !== null && l.prazoDias >= 1 ? Math.round(l.prazoDias) : null })); // validação: inteiro ≥ 1
  saida.fotos = fotos(entrada.fotos, FOTOS_IST);
  saida.contraFotos = fotos(entrada.contraFotos, FOTOS_IST);
  return saida;
}

/** Todos os arquivos (fotos e anexos) citados num informativo — para apagar os que saíram. */
export function arquivosDoInformativo(doc) {
  const ids = [...(doc?.fotos ?? []), ...(doc?.contraFotos ?? []), ...Object.values(doc?.evidencias ?? {}).map((e) => e?.anexoId),
    ...(doc?.envios ?? []).flatMap((e) => e?.anexos ?? [])]; // PDFs enviados por e-mail (histórico)
  return [...new Set(ids.filter(Boolean))];
}

// ── IAT Metrocasa ───────────────────────────────────────────────────────
/** A obra é da Metrocasa? (Cliente/incorporador do Cadastro de obras.) */
export const ehMetrocasa = (cadastro) => semAcento(cadastro?.cliente).includes('metrocasa');

/** Valores que a aba "IAT Metrocasa" puxa da IAT. */
export function metrocasaDaIat(iat, cadastro) {
  const dias = iat?.duracaoTratamentoDias;
  return {
    tipo: dias === null || dias === undefined || dias === '' ? '' : Number(dias) === 0 ? 'Incidente' : 'Acidente',
    obra: cadastro?.obra ?? '',
    empresa: iat?.razaoSocial ?? '',
    funcao: iat?.cargoFuncao ?? '',
    torreAndar: iat?.localAcidente ?? '',
    material: descricaoTabela(TABELA_14, iat?.agenteCausador),
    resumo: iat?.observacoes ?? '',
    afastamentoDias: dias ?? null,
    parteCorpo: descricaoTabela(TABELA_13, iat?.parteCorpo),
  };
}

/** O que vai para a IAT Metrocasa: o que o usuário complementou ou, se vazio, o que veio da IAT. */
export function metrocasaEfetivo(iat, cadastro) {
  const derivado = metrocasaDaIat(iat, cadastro);
  const proprio = iat?.metrocasa ?? {};
  const efetivo = Object.fromEntries(Object.entries(derivado).map(([k, v]) => [k, proprio[k] ?? v]));
  // Complementar o afastamento também define o tipo (mesma fórmula da planilha), se o tipo não foi escolhido.
  if (!proprio.tipo && efetivo.afastamentoDias !== null && efetivo.afastamentoDias !== '' && !derivado.tipo) {
    efetivo.tipo = Number(efetivo.afastamentoDias) === 0 ? 'Incidente' : 'Acidente';
  }
  return { ...efetivo, fotos: (iat?.fotos ?? []).slice(0, 4) };
}

// ── Pendências para gerar PDF / enviar e-mail ───────────────────────────
const vazio = (v) => v === null || v === undefined || String(v).trim() === '';

export function pendenciasIat(iat) {
  const faltam = [];
  for (const s of SECOES_IAT) for (const c of s.campos) if (c.obrigatorio && vazio(iat?.[c.id])) faltam.push(c.rotulo);
  if (iat?.houveMorte === 'Sim' && vazio(iat?.dataObito)) faltam.push('Data do óbito');
  return faltam;
}

export function pendenciasMetrocasa(iat, cadastro) {
  const m = metrocasaEfetivo(iat, cadastro);
  return CAMPOS_METROCASA.filter((c) => vazio(m[c.id])).map((c) => c.rotulo);
}

export function pendenciasIst(ist) {
  return CAMPOS_IST.filter((c) => c.obrigatorio && vazio(ist?.[c.id])).map((c) => c.rotulo);
}

// ── E-mail ──────────────────────────────────────────────────────────────
const dataBr = (iso) => (dataValida(iso) ? iso.split('-').reverse().join('/') : '');

const nr = (n) => String(n ?? '').padStart(2, '0');
const moedaBr = (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
/** Linhas "Rótulo: valor" da ficha, só com o que foi preenchido. */
const linhasFicha = (pares) => pares.filter(([, v]) => !vazio(v)).map(([r, v]) => `${r}: ${v}`);

/** Ficha no corpo do e-mail, na ordem dos campos do formulário. */
function fichaNoCorpo(tipo, doc, cadastro) {
  const obra = cadastro?.obra ?? '';
  if (tipo === 'metrocasa') {
    const m = metrocasaEfetivo(doc, cadastro);
    return [CABECALHO_METROCASA.titulo, ...linhasFicha(CAMPOS_METROCASA.map((c) => [c.rotulo, m[c.id]]))];
  }
  if (tipo === 'iat') {
    const valor = (c) => (c.tipo === 'auto' ? nr(doc.numero) : c.tipo === 'obra' ? obra : c.tipo === 'data' ? dataBr(doc[c.id])
      : c.tipo === 'tabela' ? (doc[c.id] ? `${doc[c.id]} – ${descricaoTabela(TABELAS_IAT[c.tabela], doc[c.id])}` : '') : doc[c.id]);
    return [CABECALHO_IAT.titulo, ...SECOES_IAT.flatMap((s) => {
      const linhas = linhasFicha(s.campos.filter((c) => c.tipo !== 'fixo').map((c) => [c.rotulo.replace(/\s*\?$/, '?'), valor(c)]));
      return linhas.length ? ['', s.titulo, ...linhas] : [];
    })];
  }
  const valor = (c) => (c.tipo === 'obra' ? obra : c.tipo === 'data' ? dataBr(doc[c.id]) : c.tipo === 'moeda' ? moedaBr(doc[c.id]) : doc[c.id]);
  const plano = (doc.planoAcao ?? []).filter((l) => l.oQue).map((l, i) => `${i + 1}. ${l.oQue}${l.responsaveis ? ` — ${l.responsaveis}` : ''}${l.prazoDias ? ` (${l.prazoDias} dias)` : ''}`);
  const acoes = (doc.acoesImediatas ?? []).filter(Boolean);
  return [CABECALHO_IST.titulo, `Nº: ${nr(doc.numero)}`, ...linhasFicha(CAMPOS_IST.map((c) => [c.rotulo, valor(c)])),
    ...(acoes.length ? ['', 'Ações Imediatas:', ...acoes.map((a) => `- ${a}`)] : []),
    ...(plano.length ? ['', 'Plano de Ação Corretiva:', ...plano] : [])];
}

/**
 * E-mail da IAT, IAT Metrocasa ou IST: vai só para os e-mails cadastrados na obra (Cadastro de obras → Cadastrar
 * e-mails), todos em "Para" — sem destinatário fixo (v40.3) — com a ficha preenchida no corpo. O servidor envia com
 * o PDF anexado, da caixa de quem está logado. Obra sem e-mail: `para` vazio e o envio é recusado.
 */
export function emailInformativo(tipo, doc, cadastro) {
  const obra = cadastro?.obra ?? '';
  const para = [...new Set(cadastro?.emails ?? [])];
  const anexo = tipo === 'metrocasa' ? 'o PDF do resumo da ocorrência' : tipo === 'iat' ? 'o PDF da IAT' : 'os PDFs da IST e do Contra-Relatório';
  const rodape = tipo === 'metrocasa' ? RODAPE_METROCASA : tipo === 'iat' ? RODAPE_IAT : RODAPE_IST;
  const assunto = tipo === 'metrocasa' ? `Resumo da ocorrência (Metrocasa) – ${obra} – ${dataBr(doc.dataAcidente)}`
    : tipo === 'iat' ? `IAT nº ${nr(doc.numero)} – ${obra} – ${doc.nomeAcidentado || 'acidentado'} – ${dataBr(doc.dataAcidente)}`
      : `IST nº ${nr(doc.numero)} – ${obra} – ${doc.classificacao} – ${dataBr(doc.data)}`;
  return {
    para,
    copia: [],
    assunto,
    corpo: ['Prezados,', '', `${tipo === 'ist' ? 'Seguem' : 'Segue'} em anexo ${anexo} da obra ${obra}.`, '', ...fichaNoCorpo(tipo, doc, cadastro), '', rodape].join('\n'),
  };
}
