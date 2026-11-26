/**
 * Administração → Segurança do Trabalho → Nova IAT (rota #/admin/seguranca-iat/<id|nova>).
 * Formulário da aba "IAT" da planilha SMS-IAT; nas obras da Metrocasa (Cliente do Cadastro de obras) aparece a
 * sub-aba "IAT Metrocasa", preenchida a partir da IAT — o usuário só complementa o que faltar para gerar o PDF
 * ou o e-mail.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { estado } from '../core/estado.js';
import {
  AVISO_ANEXO, AVISO_ESOCIAL, CAMPOS_METROCASA, EVIDENCIAS_IAT, ehMetrocasa, FOTOS_IAT,
  metrocasaDaIat, metrocasaEfetivo, normalizarIat, pendenciasIat, pendenciasMetrocasa, RODAPE_IAT, RODAPE_METROCASA, SECOES_IAT, SIM_NAO,
} from '../domain/informativos.js';
import { alerta, botaoAcao, campo, carregando, confirmar, toast } from '../ui/componentes.js';
import { baixarPdf, enviarInformativo, historicoEnvios } from '../ui/envio-informativo.js';
import { folhaIat, folhaMetrocasa } from '../ui/impressao-informativos.js';
import { anexoPdf, campoInformativo, controleField, espacoFoto, grade, numeroFormatado, secao, subAbas } from '../ui/informativo.js';
import { icone } from '../ui/icones.js';

const cadastrosDaObra = () => estado.cadastros().filter((c) => c.id).sort((a, b) => a.obra.localeCompare(b.obra, 'pt-BR'));

export async function renderInformativoIat(alvo, { id } = {}) {
  const cadastros = cadastrosDaObra();
  montar(alvo, carregando(6));
  let doc;
  try {
    doc = id && id !== 'nova' ? await api.get(`/seguranca/iat/${encodeURIComponent(id)}`)
      : { ...normalizarIat({}), id: null, numero: null, numeroPrevisto: (await api.get('/seguranca/iat/proximo')).numero };
  } catch (e) {
    return montar(alvo, alerta('error', 'Não foi possível abrir a IAT', e.message));
  }
  let aba = 'iat';
  let alterado = false;
  const obraDoc = () => cadastros.find((c) => c.id === doc.obraId) ?? null;

  const corpo = h('div', { class: 'stack' });
  const abas = h('div');
  const acoes = h('div', { class: 'row inf-acoes' });
  const titulo = h('h1', {});

  const salvar = async ({ silencioso = false } = {}) => {
    if (!doc.obraId) { toast('warning', 'Escolha a obra', 'A IAT é salva na obra escolhida em "Nome da Obra".'); return false; }
    try {
      const dados = normalizarIat(doc);
      const salvo = doc.id ? await api.put(`/seguranca/iat/${doc.id}`, dados) : await api.post('/seguranca/iat', dados);
      doc = { ...doc, ...salvo };
      desenharCorpo(); // o Nº da CAT definitivo é o que o servidor gravou
      alterado = false;
      history.replaceState(null, '', `#/admin/seguranca-iat/${doc.id}`);
      desenharTopo();
      if (!silencioso) toast('success', 'IAT salva', `Nº ${String(doc.numero).padStart(2, '0')} — ${obraDoc()?.obra ?? ''}`);
      return true;
    } catch (e) {
      toast('error', 'Não foi possível salvar a IAT', e.message, 8000);
      return false;
    }
  };

  /** PDF e e-mail exigem o formulário completo; salva antes para o PDF sair igual ao registro. */
  const conferir = (pendencias, nome) => {
    if (!pendencias.length) return true;
    toast('warning', `Complete a ${nome} antes de continuar`, `Falta(m): ${pendencias.join(', ')}.`, 9000);
    return false;
  };
  const gerarPdf = async (qual) => {
    const metro = qual === 'metrocasa';
    if (!conferir(metro ? pendenciasMetrocasa(doc, obraDoc()) : pendenciasIat(doc), metro ? 'IAT Metrocasa' : 'IAT')) return;
    if (!(await salvar({ silencioso: true }))) return;
    await baixarPdf([folhaDe(qual)], nomePdf(qual));
  };
  const folhaDe = (qual) => (qual === 'metrocasa' ? folhaMetrocasa(doc, obraDoc()) : folhaIat(doc, obraDoc()));
  const nomePdf = (qual) => `${qual === 'metrocasa' ? 'IAT Metrocasa' : 'IAT'} ${numeroFormatado(doc)} - ${obraDoc()?.obra ?? ''}.pdf`;
  /** Gera o PDF e envia pelo servidor, com cópia para os e-mails da obra (confirmação antes). */
  const enviarEmail = async (qual) => {
    const metro = qual === 'metrocasa';
    if (!conferir(metro ? pendenciasMetrocasa(doc, obraDoc()) : pendenciasIat(doc), metro ? 'IAT Metrocasa' : 'IAT')) return;
    if (!(await salvar({ silencioso: true }))) return;
    await enviarInformativo({
      tipo: 'iat', qual, doc, cadastro: obraDoc(), pdfs: [{ nome: nomePdf(qual), folha: folhaDe(qual) }],
      aoEnviar: (envios) => { doc.envios = envios; desenharCorpo(); },
    });
  };

  const sair = async () => {
    if (alterado && !(await confirmar('Sair sem salvar?', 'As alterações desta IAT ainda não foram salvas.', { rotulo: 'Sair sem salvar', perigo: true }))) return;
    location.hash = '#/admin/seguranca';
  };

  function desenharTopo() {
    const metro = ehMetrocasa(obraDoc());
    if (!metro && aba === 'metrocasa') aba = 'iat';
    titulo.textContent = doc.id ? `IAT nº ${numeroFormatado(doc)}` : `Nova IAT — nº ${numeroFormatado(doc)}`;
    montar(abas, metro ? subAbas([{ id: 'iat', nome: 'IAT' }, { id: 'metrocasa', nome: 'IAT Metrocasa' }], aba, (a) => { aba = a; desenharTopo(); desenharCorpo(); }) : null);
    const qual = aba === 'metrocasa' ? 'metrocasa' : 'iat';
    montar(acoes,
      botaoAcao('Salvar', () => salvar(), 'btn primary'),
      h('button', { class: 'btn secondary', type: 'button', onclick: () => gerarPdf(qual) }, icone('texto', { tamanho: 16 }), qual === 'metrocasa' ? 'Gerar PDF Metrocasa' : 'Gerar PDF'),
      h('button', { class: 'btn secondary', type: 'button', onclick: () => enviarEmail(qual) }, icone('enviar', { tamanho: 16 }), 'Enviar por e-mail'));
  }

  const aoMudar = (campoId) => {
    alterado = true;
    if (campoId === 'obraId') {
      // Engenheiro Residente vem da Engenharia do Cadastro de obras (a aba Base da planilha não é usada).
      doc.engenheiroResidente = obraDoc()?.engenharia ?? '';
      desenharTopo();
      desenharCorpo();
    }
  };

  function formularioIat() {
    const ctx = { cadastros, aoMudar };
    const evid = doc.evidencias;
    return [
      alerta('error', 'Prazo da CAT no eSocial', AVISO_ESOCIAL),
      ...SECOES_IAT.map((s) => secao(s.titulo, grade(...s.campos.map((c) => campoInformativo(c, doc, ctx))))),
      secao('VIII- EVIDÊNCIAS OBJETIVAS', h('div', { class: 'inf-evidencias' }, EVIDENCIAS_IAT.map((e) => {
        const r = evid[e.id];
        const anexo = h('div', { class: 'inf-evidencia-anexo' });
        const desenharAnexo = () => montar(anexo, r.resposta === 'Sim' ? [h('small', { class: 'muted' }, AVISO_ANEXO),
          anexoPdf({ id: r.anexoId, nome: r.anexoNome, aoMudar: (idArq, nome) => { r.anexoId = idArq; r.anexoNome = nome; alterado = true; } })] : null);
        desenharAnexo();
        return h('div', { class: 'inf-evidencia' },
          h('div', { class: 'inf-evidencia-texto' }, h('span', {}, e.texto),
            e.comTexto ? controleField(h('input', { value: r.texto ?? '', maxlength: 300, placeholder: 'Descreva', 'aria-label': 'Outros', oninput: (ev) => { r.texto = ev.target.value; alterado = true; } })) : null),
          controleField(h('select', { 'aria-label': e.texto, onchange: (ev) => { r.resposta = ev.target.value; alterado = true; desenharAnexo(); } },
            h('option', { value: '', selected: !r.resposta }, 'Selecione'), SIM_NAO.map((o) => h('option', { value: o, selected: r.resposta === o }, o)))),
          anexo);
      }))),
      secao('IX- PLANO DE AÇÃO CORRETIVA', h('div', { class: 'sheet inf-plano' }, h('table', {},
        h('thead', {}, h('tr', {}, ['O que fazer ?', 'Por que fazer ?', 'Responsáveis', 'Prazo (dias)'].map((t) => h('th', {}, t)))),
        h('tbody', {}, doc.planoAcao.map((l, i) => h('tr', {},
          ['oQue', 'porQue', 'responsaveis'].map((k) => h('td', {}, controleField(h('input', { value: l[k] ?? '', maxlength: 500, 'aria-label': `${k} ${i + 1}`, oninput: (e) => { l[k] = e.target.value; alterado = true; } })))),
          h('td', {}, controleField(h('input', { type: 'number', min: 0, step: 1, value: l.prazoDias ?? '', 'aria-label': `Prazo ${i + 1}`, oninput: (e) => { l.prazoDias = e.target.value === '' ? null : Number(e.target.value); alterado = true; } }))))))))),
      alerta('warning', 'Envio', RODAPE_IAT),
      secao('RELATÓRIO FOTOGRÁFICO DO ACIDENTE DE TRABALHO', h('div', { class: 'inf-fotos inf-fotos-2' },
        FOTOS_IAT.map((legenda, i) => espacoFoto({ legenda, id: doc.fotos[i], aoMudar: (idArq) => { doc.fotos[i] = idArq; alterado = true; } })))),
    ];
  }

  function formularioMetrocasa() {
    const cadastro = obraDoc();
    const derivado = metrocasaDaIat(doc, cadastro);
    const pendentes = h('div');
    const desenharPendencias = () => {
      const faltam = pendenciasMetrocasa(doc, cadastro);
      montar(pendentes, faltam.length
        ? alerta('warning', 'Complete antes de gerar o PDF ou enviar', `Falta(m): ${faltam.join(', ')}.`)
        : alerta('success', 'IAT Metrocasa completa', 'Pronta para gerar o PDF e enviar.'));
    };
    const campos = CAMPOS_METROCASA.map((c) => {
      const efetivo = metrocasaEfetivo(doc, cadastro)[c.id];
      const ajuda = c.tipo === 'fixo' ? 'Da IAT' : doc.metrocasa[c.id] !== null ? `Complementado aqui (na IAT: ${c.origem})` : `Da IAT: ${c.origem}`;
      const mudar = (v) => {
        const valor = v === '' || v === null ? null : v;
        // Igual ao que vem da IAT = não é complemento: continua acompanhando a IAT.
        doc.metrocasa[c.id] = valor !== null && String(valor) === String(derivado[c.id] ?? '') ? null : valor;
        alterado = true;
        desenharPendencias();
      };
      let controle;
      if (c.tipo === 'fixo') controle = h('input', { value: efetivo ?? '', readonly: true, tabindex: -1 });
      else if (c.tipo === 'lista') controle = h('select', { onchange: (e) => mudar(e.target.value) }, h('option', { value: '' }, 'Selecione'), c.opcoes.map((o) => h('option', { value: o, selected: efetivo === o }, o)));
      else if (c.tipo === 'longo') controle = h('textarea', { rows: 5, oninput: (e) => mudar(e.target.value) }, efetivo ?? '');
      else if (c.tipo === 'numero') controle = h('input', { type: 'number', min: 0, step: 1, value: efetivo ?? '', oninput: (e) => mudar(e.target.value === '' ? null : Number(e.target.value)) });
      else controle = h('input', { value: efetivo ?? '', maxlength: 300, oninput: (e) => mudar(e.target.value) });
      const el = campo(`${c.rotulo} *`, controle, ajuda);
      el.style.gridColumn = `span ${c.tipo === 'longo' ? 12 : 4}`;
      return el;
    });
    desenharPendencias();
    return [
      alerta('info', 'Preenchida a partir da IAT', 'Os campos já vêm da IAT. Complete o que faltar; o que você alterar aqui vale só para a IAT Metrocasa.'),
      pendentes,
      secao('RESUMO DA OCORRÊNCIA (METROCASA)', grade(...campos)),
      secao('Relatório Fotográfico do Acidente', h('p', { class: 'muted small' }, 'As 4 primeiras fotos da IAT. Para trocar, altere na sub-aba IAT.'),
        h('div', { class: 'inf-fotos inf-fotos-2' }, FOTOS_IAT.slice(0, 4).map((legenda, i) => espacoFoto({ legenda, id: doc.fotos[i], somenteLeitura: true, aoMudar: () => {} })))),
      alerta('warning', 'Envio', RODAPE_METROCASA),
    ];
  }

  function desenharCorpo() {
    montar(corpo, ...(aba === 'metrocasa' ? formularioMetrocasa() : formularioIat()), historicoEnvios(doc.envios));
  }

  montar(alvo,
    h('div', { class: 'titulo-pagina inf-topo' },
      h('div', {},
        h('a', { class: 'seg-voltar', href: '#/admin/seguranca', onclick: (e) => { e.preventDefault(); sair(); } }, icone('direita', { tamanho: 14 }), 'Segurança do Trabalho'),
        titulo,
        h('p', {}, 'IAT - Informativo do Acidente do Trabalho (SMS-IAT)')),
      acoes),
    abas,
    corpo);
  desenharTopo();
  desenharCorpo();
}
