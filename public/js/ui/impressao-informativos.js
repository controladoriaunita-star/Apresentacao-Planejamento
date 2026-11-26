/**
 * Folhas da IAT, IAT Metrocasa, IST e Contra-Relatório com a mesma grade das planilhas (colunas B–K na IAT,
 * B–P na IST, mesmas mesclagens e rótulos). Estilo: public/css/impressao-informativos.css. O PDF é gerado a
 * partir delas em ui/envio-informativo.js (baixar ou anexar ao e-mail).
 */
import { api } from '../core/api.js';
import { h } from '../core/dom.js';
import {
  AVISO_ANEXO, AVISO_ESOCIAL, CABECALHO_CONTRA, CABECALHO_IAT, CABECALHO_IST, CABECALHO_METROCASA, descricaoTabela, EVIDENCIAS_IAT,
  FIXOS_IAT, FOTOS_IAT, metrocasaEfetivo, RODAPE_IAT, RODAPE_IST, RODAPE_METROCASA, TABELA_13, TABELA_14, TABELA_15, TABELA_17,
} from '../domain/informativos.js';

const dataBr = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') ? iso.split('-').reverse().join('/') : '');
const num = (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('pt-BR'));
const moeda = (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

// Células: rot = rótulo · val = valor · sec = título de seção · nota = texto corrido · foto = imagem
const c = (classe, conteudo, span = 1, extra = {}) => ({ classe, conteudo, span, ...extra });
const rot = (t, span, extra) => c('rot', t, span, extra);
const val = (t, span, extra) => c('val', t ?? '', span, extra);
const sec = (t, span) => c('sec', t, span);
const nota = (t, span, extra) => c('nota', t, span, extra);
const foto = (id, span) => c('foto', id ? h('img', { src: api.urlArquivo(id), alt: '' }) : '', span);

function folha(colunas, larguras, linhas) {
  return h('table', { class: 'folha' },
    h('colgroup', {}, larguras.map((l) => h('col', { style: { width: `${l}%` } }))),
    h('tbody', {}, linhas.map((linha) => h('tr', { class: linha.classe ?? '' }, (linha.celulas ?? linha).map((cel) => h('td', {
      class: cel.classe, colspan: cel.span > 1 ? cel.span : null, rowspan: cel.linhas > 1 ? cel.linhas : null,
    }, cel.conteudo))))));
}

function cabecalho(cab, colunasTitulo, colunasCodigo, colunasLogo) {
  const logo = c('logo', h('img', { src: 'assets/brand/logo-unita.png', alt: 'Unità Engenharia' }), colunasLogo, { linhas: 3 });
  return [
    [logo, c('formulario', 'FORMULÁRIO', colunasTitulo), c('codigo', cab.codigo, colunasCodigo)],
    [c('titulo', cab.titulo, colunasTitulo, { linhas: 2 }), c('codigo', cab.revisao, colunasCodigo)],
    [c('codigo', dataBr(cab.data), colunasCodigo)],
  ];
}

// ── IAT (colunas B–K) ────────────────────────────────────────────────────
const LARGURAS_IAT = [12.9, 12.9, 10.9, 15.7, 5.9, 5.9, 10.9, 5.9, 10.9, 12.9].map((l) => (l / 104.8) * 100);

function linhaTabela(rotulo, tabela, codigo) {
  return [rot(rotulo), val(codigo), val(descricaoTabela(tabela, codigo), 8)];
}

export function folhaIat(doc, cadastro) {
  const plano = doc.planoAcao ?? [];
  const fotos = doc.fotos ?? [];
  const evid = doc.evidencias ?? {};
  return folha(10, LARGURAS_IAT, [
    ...cabecalho(CABECALHO_IAT, 8, 1, 1),
    [nota(AVISO_ESOCIAL, 10, { classe: 'nota destaque' })],
    [sec('I- DADOS DE IDENTIFICAÇÃO', 10)],
    [rot('Emitente:'), val(FIXOS_IAT.emitente), rot('Tipo de CAT:'), val(FIXOS_IAT.tipoCat), rot('Iniciativa da CAT:', 2), val(FIXOS_IAT.iniciativaCat, 2), rot('Fonte do cadastramento:'), val(FIXOS_IAT.fonteCadastramento)],
    [rot('Nº da CAT:'), val(String(doc.numero ?? '').padStart(2, '0'), 2), rot('Nome da Obra:'), val(cadastro?.obra, 3), rot('Engenheiro Residente:', 2), val(doc.engenheiroResidente)],
    [sec('II- DADOS DO EMITENTE (EMPREGADOR)', 10)],
    [rot('Razão Social', 3), rot('Tipo'), rot('Nº da Inscrição (CNPJ)', 3), rot('CNAE', 3)],
    [val(doc.razaoSocial, 3), val(FIXOS_IAT.tipoInscricao), val(doc.cnpj, 3), val(doc.cnae, 3)],
    [sec('III- DADOS DO ACIDENTADO', 10)],
    [rot('Nome do Colaborador Acidentado', 2), rot('CPF'), rot('Data de Nascimento'), rot('Sexo', 3), rot('Estado Civil', 2), rot('CBO')],
    [val(doc.nomeAcidentado, 2), val(doc.cpf), val(dataBr(doc.dataNascimento)), val(doc.sexo, 3), val(doc.estadoCivil, 2), val(doc.cbo)],
    [rot('Filiação à previdência social', 2), val(doc.filiacaoPrevidencia), rot('Áreas:'), val(doc.areas, 3), val(''), rot('Cargo/Função:'), val(doc.cargoFuncao)],
    [sec('IV- DADOS DO ACIDENTE OU DOENÇA', 10)],
    [rot('Data do Acidente'), rot('Hora do Acidente'), rot('Após quantas horas de trabalho ?', 2), rot('Tipo de Acidente', 2), rot('Houve afastamento ?', 2), rot('Último dia trabalhado'), rot('País')],
    [val(dataBr(doc.dataAcidente)), val(doc.horaAcidente), val(doc.horasTrabalho, 2), val(doc.tipoAcidente, 2), val(doc.houveAfastamento, 2), val(dataBr(doc.ultimoDiaTrabalhado)), val(doc.pais)],
    [rot('Especificação (endereço) do local do acidente', 3), rot('CNPJ', 2), rot('UF'), rot('Município do local do acidente', 2), rot('Local do acidente (bloco/andar)', 2)],
    [val(doc.enderecoLocal, 3), val(doc.cnpjLocal, 2), val(doc.uf), val(doc.municipio, 2), val(doc.localAcidente, 2)],
    linhaTabela('Tabela 13-Parte do Corpo Atingida:', TABELA_13, doc.parteCorpo),
    linhaTabela('Tabela 14-Agente Causador:', TABELA_14, doc.agenteCausador),
    linhaTabela('Tabela 15-Situação Geradora:', TABELA_15, doc.situacaoGeradora),
    [rot('Houve registro policial ?'), val(doc.registroPolicial), rot('Houve morte ?'), val(doc.houveMorte), rot('Data do óbito:', 2), val(dataBr(doc.dataObito), 2), rot('Lateralidade:'), val(doc.lateralidade)],
    { classe: 'alta', celulas: [rot('Observações (descrição do acidente):', 2), val(doc.observacoes, 8, { classe: 'val texto' })] },
    [sec('V- DADOS DO ATESTADO MÉDICO', 10)],
    [rot('Data'), rot('Hora'), rot('Houve internação ?'), rot('Provável duração do tratamento (dias)', 2), rot('Deverá o acidentado afastar-se do trabalho durante o tratamento ?', 5)],
    [val(dataBr(doc.atestadoData)), val(doc.atestadoHora), val(doc.internacao), val(num(doc.duracaoTratamentoDias), 2), val(doc.afastarTratamento, 5)],
    [sec('VI- LESÃO', 10)],
    linhaTabela('Tabela 17-Natureza da Lesão:', TABELA_17, doc.naturezaLesao),
    [sec('VII- DIAGNÓSTICO', 10)],
    [rot('Diagnóstico provável'), val(doc.diagnostico, 7), rot('CID'), val(doc.cid)],
    [rot('Nome do médico'), val(doc.medicoNome, 3), rot('CRM do médico', 2), val(doc.medicoCrm, 2), rot('UF'), val(doc.medicoUf)],
    { classe: 'media', celulas: [rot('OBSERVAÇÕES:'), val(doc.observacoesDiagnostico, 9, { classe: 'val texto' })] },
    [sec('VIII- EVIDÊNCIAS OBJETIVAS', 10)],
    ...EVIDENCIAS_IAT.map((e) => {
      const r = evid[e.id] ?? {};
      const observacao = r.resposta === 'Sim' ? (r.anexoNome ? `${AVISO_ANEXO} — anexado: ${r.anexoNome}` : AVISO_ANEXO) : '';
      const pergunta = e.comTexto ? [rot(e.texto), val(r.texto, 4)] : [rot(e.texto, 5)];
      return [...pergunta, val(r.resposta), nota(observacao, 4)];
    }),
    [sec('IX- PLANO DE AÇÃO CORRETIVA', 10)],
    [rot('O que fazer ?', 3), rot('Por que fazer ?', 4), rot('Responsáveis', 2), rot('Prazo (dias)')],
    ...Array.from({ length: 4 }, (_, i) => ({ classe: 'plano', celulas: [val(plano[i]?.oQue, 3), val(plano[i]?.porQue, 4), val(plano[i]?.responsaveis, 2), val(num(plano[i]?.prazoDias))] })),
    [nota(RODAPE_IAT, 10, { classe: 'nota destaque' })],
    [sec('RELATÓRIO FOTOGRÁFICO DO ACIDENTE DE TRABALHO', 10)],
    ...[0, 2, 4].flatMap((i) => [
      { classe: 'linha-foto', celulas: [foto(fotos[i], 4), foto(fotos[i + 1], 6)] },
      [rot(FOTOS_IAT[i], 4, { classe: 'rot legenda' }), rot(FOTOS_IAT[i + 1], 6, { classe: 'rot legenda' })],
    ]),
  ]);
}

export function folhaMetrocasa(doc, cadastro) {
  const m = metrocasaEfetivo(doc, cadastro);
  return folha(10, LARGURAS_IAT, [
    [c('logo', h('img', { src: 'assets/brand/logo-unita.png', alt: 'Unità Engenharia' })), c('titulo', CABECALHO_METROCASA.titulo, 9)],
    [rot('Tipo:'), val(m.tipo), rot('Nome da Obra:'), val(m.obra, 2), rot('Nome da Empresa Contratada:', 3), val(m.empresa, 2)],
    [rot('Função:'), val(m.funcao), rot('Torre/Andar:'), val(m.torreAndar, 2), rot('Material/Equipto:', 3), val(m.material, 2)],
    { classe: 'media', celulas: [rot('Resumo do Acidente:'), val(m.resumo, 9, { classe: 'val texto' })] },
    [rot('Com Afastamento (dias):', 2), val(num(m.afastamentoDias)), rot('Parte do Corpo Atingida:', 3), val(m.parteCorpo, 4)],
    [sec('Relatório Fotográfico do Acidente', 10)],
    { classe: 'linha-foto', celulas: [foto(m.fotos[0], 4), foto(m.fotos[1], 6)] },
    [rot(FOTOS_IAT[0], 4, { classe: 'rot legenda' }), rot(FOTOS_IAT[1], 6, { classe: 'rot legenda' })],
    { classe: 'linha-foto', celulas: [foto(m.fotos[2], 4), foto(m.fotos[3], 6)] },
    [rot(FOTOS_IAT[2], 4, { classe: 'rot legenda' }), rot(FOTOS_IAT[3], 6, { classe: 'rot legenda' })],
    [nota(RODAPE_METROCASA, 10, { classe: 'nota destaque' })],
  ]);
}

// ── IST e Contra-Relatório (colunas B–P) ─────────────────────────────────
const LARGURAS_IST = Array.from({ length: 15 }, () => 100 / 15);
const fotosIst = (lista) => [0, 3, 6, 9].map((i) => ({ classe: 'linha-foto-ist', celulas: [foto(lista[i], 5), foto(lista[i + 1], 5), foto(lista[i + 2], 5)] }));

export function folhaIst(doc, cadastro) {
  const plano = doc.planoAcao ?? [];
  const acoes = doc.acoesImediatas ?? [];
  return folha(15, LARGURAS_IST, [
    ...cabecalho(CABECALHO_IST, 10, 2, 3),
    [rot('Nº'), rot('Data', 2), rot('Horário', 2), rot('Local', 6), rot('Nome do Estabelecimento', 4)],
    [val(String(doc.numero ?? '').padStart(2, '0')), val(dataBr(doc.data), 2), val(doc.horario, 2), val(doc.local, 6), val(cadastro?.obra, 4)],
    [sec('Descrição Resumida da Ocorrência', 15)],
    { classe: 'alta', celulas: [val(doc.descricao, 15, { classe: 'val texto' })] },
    [rot('Classificação da Ocorrência:', 3, { linhas: 2 }), val(doc.classificacao, 6), rot('Potencial de Multa:', 3), val(moeda(doc.potencialMulta), 3)],
    [val(doc.complementoClassificacao, 12)],
    [rot('Ações Imediatas: (Descrever ações logo após a ocorrência)', 3, { linhas: 3 }), val(acoes[0], 12)],
    [val(acoes[1], 12)],
    [val(acoes[2], 12)],
    [sec('PLANO DE AÇÃO CORRETIVA', 15)],
    [rot('Ítem'), rot('O que Fazer ?', 5), rot('Responsáveis', 7), rot('Prazo (Dias)', 2)],
    ...Array.from({ length: 6 }, (_, i) => [rot(String(i + 1)), val(plano[i]?.oQue, 5), val(plano[i]?.responsaveis, 7), val(plano[i]?.prazoDias ? String(plano[i].prazoDias).padStart(2, '0') : '', 2)]),
    [nota(RODAPE_IST, 15, { classe: 'nota destaque' })],
    [sec('FOTOS DA OCORRÊNCIA - EVIDÊNCIAS OBJETIVAS', 15)],
    ...fotosIst(doc.fotos ?? []),
  ]);
}

export function folhaContraRelatorio(doc) {
  return folha(15, LARGURAS_IST, [
    ...cabecalho(CABECALHO_CONTRA, 10, 2, 3),
    [rot('Contra-Relatório IST:', 2), val(String(doc.numero ?? '').padStart(2, '0')), sec('FOTOS DO PLANO DE AÇÃO CORRETIVA - EVIDÊNCIAS OBJETIVAS', 12)],
    ...fotosIst(doc.contraFotos ?? []),
    [nota(RODAPE_IST, 15, { classe: 'nota destaque' })],
  ]);
}
