/**
 * Administração → Segurança do Trabalho → Nova IST (rota #/admin/seguranca-ist/<id|nova>).
 * Sub-abas "IST" e "Contra-Relatório", como as abas da planilha SMS-IST. Da aba Base só a lista "Ocorrências"
 * é usada (Classificação da Ocorrência); a obra vem do Cadastro de obras.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { estado } from '../core/estado.js';
import { CAMPOS_IST, FOTOS_IST, normalizarIst, pendenciasIst, RODAPE_IST } from '../domain/informativos.js';
import { alerta, botaoAcao, carregando, confirmar, toast } from '../ui/componentes.js';
import { baixarPdf, enviarInformativo, historicoEnvios } from '../ui/envio-informativo.js';
import { folhaContraRelatorio, folhaIst } from '../ui/impressao-informativos.js';
import { campoInformativo, controleField, espacoFoto, grade, numeroFormatado, secao, subAbas } from '../ui/informativo.js';
import { icone } from '../ui/icones.js';

const cadastrosDaObra = () => estado.cadastros().filter((c) => c.id).sort((a, b) => a.obra.localeCompare(b.obra, 'pt-BR'));
const campoIst = (id) => CAMPOS_IST.find((c) => c.id === id);

export async function renderInformativoIst(alvo, { id } = {}) {
  const cadastros = cadastrosDaObra();
  montar(alvo, carregando(6));
  let doc;
  try {
    doc = id && id !== 'nova' ? await api.get(`/seguranca/ist/${encodeURIComponent(id)}`)
      : { ...normalizarIst({}), id: null, numero: null, numeroPrevisto: (await api.get('/seguranca/ist/proximo')).numero };
  } catch (e) {
    return montar(alvo, alerta('error', 'Não foi possível abrir a IST', e.message));
  }
  let aba = 'ist';
  let alterado = false;
  const obraDoc = () => cadastros.find((c) => c.id === doc.obraId) ?? null;
  const numero = () => numeroFormatado(doc);

  const corpo = h('div', { class: 'stack' });
  const abas = h('div');
  const acoes = h('div', { class: 'row inf-acoes' });
  const titulo = h('h1', {});

  const salvar = async ({ silencioso = false } = {}) => {
    if (!doc.obraId) { toast('warning', 'Escolha a obra', 'A IST é salva no estabelecimento escolhido em "Nome do Estabelecimento".'); return false; }
    try {
      const dados = normalizarIst(doc);
      const salvo = doc.id ? await api.put(`/seguranca/ist/${doc.id}`, dados) : await api.post('/seguranca/ist', dados);
      doc = { ...doc, ...salvo };
      alterado = false;
      history.replaceState(null, '', `#/admin/seguranca-ist/${doc.id}`);
      desenharTopo();
      desenharCorpo(); // o Nº definitivo é o que o servidor gravou (o contra-relatório acompanha)
      if (!silencioso) toast('success', 'IST salva', `Nº ${numero()} — ${obraDoc()?.obra ?? ''}`);
      return true;
    } catch (e) {
      toast('error', 'Não foi possível salvar a IST', e.message, 8000);
      return false;
    }
  };

  const conferir = () => {
    const faltam = pendenciasIst(doc);
    if (faltam.length) toast('warning', 'Complete a IST antes de continuar', `Falta(m): ${faltam.join(', ')}.`, 9000);
    return !faltam.length;
  };
  const gerarPdf = async () => {
    if (!conferir() || !(await salvar({ silencioso: true }))) return;
    const contra = aba === 'contra';
    await baixarPdf([contra ? folhaContraRelatorio(doc) : folhaIst(doc, obraDoc())], nomePdf(contra));
  };
  const nomePdf = (contra) => `${contra ? 'Contra-Relatório IST' : 'IST'} ${numero()} - ${obraDoc()?.obra ?? ''}.pdf`;
  /** Gera os PDFs (IST e Contra-Relatório) e envia pelo servidor, com cópia para os e-mails da obra. */
  const enviarEmail = async () => {
    if (!conferir() || !(await salvar({ silencioso: true }))) return;
    await enviarInformativo({
      tipo: 'ist', qual: 'ist', doc, cadastro: obraDoc(),
      pdfs: [{ nome: nomePdf(false), folha: folhaIst(doc, obraDoc()) }, { nome: nomePdf(true), folha: folhaContraRelatorio(doc) }],
      aoEnviar: (envios) => { doc.envios = envios; desenharCorpo(); },
    });
  };
  const sair = async () => {
    if (alterado && !(await confirmar('Sair sem salvar?', 'As alterações desta IST ainda não foram salvas.', { rotulo: 'Sair sem salvar', perigo: true }))) return;
    location.hash = '#/admin/seguranca';
  };

  function desenharTopo() {
    titulo.textContent = doc.id ? `IST nº ${numero()}` : `Nova IST — nº ${numero()}`;
    montar(abas, subAbas([{ id: 'ist', nome: 'IST' }, { id: 'contra', nome: 'Contra-Relatório' }], aba, (a) => { aba = a; desenharTopo(); desenharCorpo(); }));
    montar(acoes,
      botaoAcao('Salvar', () => salvar(), 'btn primary'),
      h('button', { class: 'btn secondary', type: 'button', onclick: gerarPdf }, icone('texto', { tamanho: 16 }), aba === 'contra' ? 'Gerar PDF do Contra-Relatório' : 'Gerar PDF'),
      h('button', { class: 'btn secondary', type: 'button', onclick: enviarEmail }, icone('enviar', { tamanho: 16 }), 'Enviar por e-mail'));
  }

  const ctx = { cadastros, aoMudar: () => { alterado = true; } };
  const fotos = (lista) => h('div', { class: 'inf-fotos inf-fotos-3' }, Array.from({ length: FOTOS_IST }, (_, i) => espacoFoto({
    legenda: `Foto ${i + 1}`, id: lista[i], aoMudar: (idArq) => { lista[i] = idArq; alterado = true; },
  })));

  function formularioIst() {
    const c = (id) => campoInformativo(campoIst(id), doc, ctx);
    return [
      secao('Identificação', grade(
        h('label', { class: 'field inf-campo', style: { gridColumn: 'span 2' } }, h('span', {}, 'Nº'), h('input', { value: numero(), readonly: true, tabindex: -1 }), h('small', {}, 'Automático (último + 1)')),
        c('data'), c('horario'), c('local'), c('obraId'))),
      secao('Descrição Resumida da Ocorrência', grade(c('descricao'))),
      secao('Classificação', grade(c('classificacao'), c('potencialMulta'), c('complementoClassificacao'))),
      secao('Ações Imediatas: (Descrever ações logo após a ocorrência)', h('div', { class: 'stack' }, doc.acoesImediatas.map((t, i) => controleField(h('input', {
        value: t, maxlength: 500, 'aria-label': `Ação imediata ${i + 1}`, oninput: (e) => { doc.acoesImediatas[i] = e.target.value; alterado = true; },
      }))))),
      secao('PLANO DE AÇÃO CORRETIVA', h('div', { class: 'sheet inf-plano' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Ítem', 'O que Fazer ?', 'Responsáveis', 'Prazo (Dias)'].map((t) => h('th', {}, t)))),
        h('tbody', {}, doc.planoAcao.map((l, i) => h('tr', {},
          h('td', {}, String(i + 1)),
          ['oQue', 'responsaveis'].map((k) => h('td', {}, controleField(h('input', { value: l[k] ?? '', maxlength: 500, 'aria-label': `${k} ${i + 1}`, oninput: (e) => { l[k] = e.target.value; alterado = true; } })))),
          h('td', {}, controleField(h('input', { type: 'number', min: 1, step: 1, value: l.prazoDias ?? '', 'aria-label': `Prazo ${i + 1}`, oninput: (e) => { l.prazoDias = e.target.value === '' ? null : Number(e.target.value); alterado = true; } }))))))))),
      alerta('warning', 'Envio', RODAPE_IST),
      secao('FOTOS DA OCORRÊNCIA - EVIDÊNCIAS OBJETIVAS', fotos(doc.fotos)),
    ];
  }

  function formularioContra() {
    return [
      secao(`Contra-Relatório IST: ${numero()}`, h('p', { class: 'muted small' }, 'Fotos do plano de ação corretiva já executado (evidências objetivas).'), fotos(doc.contraFotos)),
      alerta('warning', 'Envio', RODAPE_IST),
    ];
  }

  function desenharCorpo() {
    montar(corpo, ...(aba === 'contra' ? formularioContra() : formularioIst()), historicoEnvios(doc.envios));
  }

  montar(alvo,
    h('div', { class: 'titulo-pagina inf-topo' },
      h('div', {},
        h('a', { class: 'seg-voltar', href: '#/admin/seguranca', onclick: (e) => { e.preventDefault(); sair(); } }, icone('direita', { tamanho: 14 }), 'Segurança do Trabalho'),
        titulo,
        h('p', {}, 'IST - Informativo de Segurança do Trabalho (SMS-IST)')),
      acoes),
    abas,
    corpo);
  desenharTopo();
  desenharCorpo();
}
