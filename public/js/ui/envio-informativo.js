/**
 * PDF e envio por e-mail da IAT, IAT Metrocasa e IST.
 * - PDF gerado no navegador (html2canvas + jsPDF em public/vendor) a partir das folhas de impressao-informativos.js,
 *   com quebra de página entre as linhas da folha (nenhuma linha cortada ao meio).
 * - Envio: os PDFs sobem como arquivos e o servidor envia o e-mail com eles anexados (POST …/:id/enviar),
 *   para o destinatário da ficha com cópia para os e-mails da obra; o envio fica no histórico do informativo.
 */
import { api } from '../core/api.js';
import { h, montar, token } from '../core/dom.js';
import { fmtDataHora } from '../core/formato.js';
import { emailInformativo } from '../domain/informativos.js';
import { abrirModal, alerta, toast } from './componentes.js';
import { icone } from './icones.js';

const LARGURA_PX = 718; // 190 mm a 96 dpi (A4 retrato com 10 mm de margem)
const ALTURA_PAGINA_PX = (LARGURA_PX * 277) / 190;
const NOMES = { iat: 'IAT', metrocasa: 'IAT Metrocasa', ist: 'IST' };
/** Destinatários: lista (v40.3) ou um endereço só (envios antigos do histórico). */
const paraTexto = (para) => [para ?? []].flat().join(', ');

const scripts = new Map();
function carregarScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => { scripts.delete(src); falha(new Error(`Não foi possível carregar ${src}`)); };
      document.head.append(s);
    }));
  }
  return scripts.get(src);
}

function garantirEstilo() {
  if (document.getElementById('css-impressao-informativos')) return Promise.resolve();
  return new Promise((ok) => {
    const link = h('link', { id: 'css-impressao-informativos', rel: 'stylesheet', href: 'css/impressao-informativos.css' });
    link.onload = ok;
    link.onerror = ok;
    document.head.append(link);
  });
}

// ── Corpo do e-mail no layout do PDF ────────────────────────────────────
// A mesma folha da planilha (tabela com as mesclagens), com os estilos copiados para atributos/inline — e-mail não lê
// CSS de arquivo e o Outlook ignora quase todo <style>. As fotos ficam só no PDF anexo (no corpo, um aviso no lugar).
const ESTILOS_CELULA = ['background-color', 'color', 'font-weight', 'font-size', 'text-align', 'vertical-align', 'white-space', 'line-height', 'letter-spacing'];

/** HTML da folha para o corpo do e-mail. A folha original não é alterada (trabalha numa cópia). */
export async function folhaParaEmail(folha) {
  await garantirEstilo();
  const copia = folha.cloneNode(true);
  const area = h('div', { 'aria-hidden': 'true', style: { position: 'fixed', left: '-10000px', top: '0', width: `${LARGURA_PX}px` } }, copia);
  document.body.append(area);
  try {
    const mesa = copia.matches('table') ? copia : copia.querySelector('table');
    for (const tabela of [mesa, ...copia.querySelectorAll('table table')].filter(Boolean)) {
      Object.assign(tabela, { cellPadding: '0', cellSpacing: '0', border: '0' });
      tabela.setAttribute('width', String(LARGURA_PX));
      tabela.setAttribute('style', `border-collapse:collapse;table-layout:fixed;width:100%;max-width:${LARGURA_PX}px;font-family:Arial,Helvetica,sans-serif;`);
    }
    for (const col of copia.querySelectorAll('col')) {
      col.setAttribute('width', String(Math.round(col.getBoundingClientRect().width)));
      col.removeAttribute('style');
    }
    for (const td of copia.querySelectorAll('td')) {
      const cs = getComputedStyle(td);
      const estilo = [`border:1px solid ${cs.borderTopColor}`, `padding:${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
        ...ESTILOS_CELULA.map((prop) => `${prop}:${cs.getPropertyValue(prop)}`)];
      if (td.classList.contains('foto')) {
        const tinhaFoto = Boolean(td.querySelector('img'));
        montar(td, tinhaFoto ? h('span', { style: { color: cs.color, fontStyle: 'italic' } }, 'Foto no PDF anexo') : '');
        estilo.push('height:28px', 'text-align:center');
      } else {
        // Altura fixa só onde a folha define (campos de valor, plano de ação); rótulos e legendas seguem o conteúdo.
        const alturaFixa = td.classList.contains('val') || td.parentElement?.classList.contains('plano');
        if (alturaFixa) estilo.push(`height:${Math.round(td.getBoundingClientRect().height)}px`);
        for (const img of td.querySelectorAll('img')) {
          const { width, height } = img.getBoundingClientRect();
          img.setAttribute('src', new URL(img.getAttribute('src'), location.href).href); // logo público do app
          img.setAttribute('width', String(Math.round(width)));
          img.setAttribute('height', String(Math.round(height)));
          img.setAttribute('style', 'display:block;margin:0 auto;border:0;');
        }
      }
      td.setAttribute('style', `${estilo.join(';')};`);
      td.removeAttribute('class');
    }
    for (const el of copia.querySelectorAll('[class]')) el.removeAttribute('class');
    copia.removeAttribute('class');
    return copia.outerHTML;
  } finally {
    area.remove();
  }
}

const imagensProntas = (raiz) => Promise.all([...raiz.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((ok) => { img.onload = ok; img.onerror = ok; }))));

/** Gera o PDF (Blob) com uma ou mais folhas, cada folha começando numa página nova. */
export async function gerarPdf(folhas) {
  await Promise.all([carregarScript('vendor/html2canvas.min.js'), carregarScript('vendor/jspdf.umd.min.js'), garantirEstilo()]);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const area = h('div', { class: 'pdf-render', 'aria-hidden': 'true', style: { position: 'fixed', left: '-10000px', top: '0', width: `${LARGURA_PX}px`, background: token('--surface') } });
  document.body.append(area);
  let primeira = true;
  try {
    for (const folha of folhas) {
      montar(area, folha);
      await imagensProntas(area);
      const topo = area.getBoundingClientRect().top;
      const limites = [...area.querySelectorAll('tr')].map((tr) => tr.getBoundingClientRect().bottom - topo);
      const total = area.scrollHeight;
      const tela = await window.html2canvas(area, { scale: 2, useCORS: true, backgroundColor: token('--surface'), logging: false, windowWidth: LARGURA_PX });
      const escala = tela.width / area.offsetWidth;
      for (let inicio = 0; inicio < total - 1;) {
        const limite = inicio + ALTURA_PAGINA_PX;
        // quebra na última linha da folha que cabe na página (uma linha maior que a página é cortada)
        const cabem = limites.filter((b) => b > inicio + 1 && b <= limite);
        const fim = total <= limite ? total : (cabem.length ? Math.max(...cabem) : limite);
        const pedaco = document.createElement('canvas');
        pedaco.width = tela.width;
        pedaco.height = Math.ceil((fim - inicio) * escala);
        const ctx = pedaco.getContext('2d');
        ctx.fillStyle = token('--surface');
        ctx.fillRect(0, 0, pedaco.width, pedaco.height);
        ctx.drawImage(tela, 0, Math.floor(inicio * escala), tela.width, pedaco.height, 0, 0, pedaco.width, pedaco.height);
        if (!primeira) pdf.addPage();
        primeira = false;
        pdf.addImage(pedaco.toDataURL('image/jpeg', 0.85), 'JPEG', 10, 10, 190, ((fim - inicio) * 190) / LARGURA_PX);
        inicio = fim;
      }
    }
  } finally {
    area.remove();
  }
  return pdf.output('blob');
}

/** Gera e baixa o PDF. */
export async function baixarPdf(folhas, nomeArquivo) {
  const aviso = toast('info', 'Gerando o PDF…', null, 60000);
  try {
    const blob = await gerarPdf(folhas);
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: nomeArquivo });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e) {
    toast('error', 'Não foi possível gerar o PDF', e.message, 8000);
  } finally {
    aviso?.remove?.();
  }
}

/**
 * Abre na hora a confirmação (De, Para, Assunto e corpo já estão no navegador) e, enquanto o usuário confere,
 * gera os PDFs e os sobe para o armazenamento. Cada anexo aparece "preparando" e vira link quando fica pronto;
 * "Enviar e-mail" espera os anexos (se clicado antes, envia assim que ficarem prontos).
 * @param {{tipo: 'iat'|'ist', qual: 'iat'|'metrocasa'|'ist', doc: object, cadastro: object, pdfs: Array<{nome: string, folha: Element}>, aoEnviar: Function}} p
 */
export async function enviarInformativo({ tipo, qual, doc, cadastro, pdfs, aoEnviar }) {
  const email = emailInformativo(qual, doc, cadastro);
  // Sem destinatário fixo: vai só para os e-mails cadastrados na obra (o servidor também confere).
  if (!email.para.length) {
    toast('warning', 'Obra sem e-mails cadastrados', `Cadastre os e-mails de ${cadastro?.obra ?? 'obra'} em Segurança do Trabalho → E-mails das obras: a ${NOMES[qual]} vai só para eles.`, 10000);
    return;
  }
  const anexos = [];
  let enviado = false;
  let cancelado = false;
  const descartar = () => { if (!enviado) for (const a of anexos) if (a) api.del(`/arquivos/${a.id}`).catch(() => {}); };

  const linha = (rotulo, conteudo) => h('div', { class: 'envio-linha' }, h('b', {}, rotulo), h('div', {}, conteudo));
  const de = h('span', { class: 'muted' }, '…');
  const aviso = h('div');
  const previa = h('div', { class: 'envio-previa' }, h('span', { class: 'muted' }, 'Montando…'));
  const itensAnexo = pdfs.map((p) => h('span', { class: 'envio-anexo-preparando', title: 'Preparando o PDF' }, h('span', { class: 'spin' }), p.nome));
  let pedidoSituacao;
  let preparo;
  let bloqueado = false; // envio não configurado ou anexo com erro: o botão não religa
  const botaoEnviar = h('button', { class: 'btn primary', type: 'button' }, 'Enviar e-mail');
  botaoEnviar.addEventListener('click', async () => {
    botaoEnviar.disabled = true;
    montar(botaoEnviar, h('span', { class: 'spin' }), 'Enviando…');
    let r = null;
    try {
      const [situacao] = await Promise.all([pedidoSituacao, preparo]);
      const html = await corpoPronto.catch(() => null); // sem o layout, o servidor usa a ficha em texto
      if (situacao.modo && !cancelado) r = await api.post(`/seguranca/${tipo}/${doc.id}/enviar`, { qual, anexos: anexos.map((a) => a.id), html });
    } catch (e) {
      if (!cancelado && !bloqueado) toast('error', 'O e-mail não foi enviado', e.message, 10000);
    }
    if (!r) {
      montar(botaoEnviar, 'Enviar e-mail');
      botaoEnviar.disabled = bloqueado;
      return;
    }
    enviado = true;
    m.fechar();
    toast('success', r.modo === 'arquivo' ? 'E-mail gravado (modo demonstração)' : 'E-mail enviado',
      r.modo === 'arquivo' ? `Arquivo: data/exemplo/emails-enviados/${r.arquivo}` : `Para ${paraTexto(r.para)}.`, 9000);
    aoEnviar?.(r.envios);
  });

  const m = abrirModal({
    titulo: `Enviar ${NOMES[qual]} por e-mail`,
    largo: true,
    aoFechar: () => { cancelado = true; descartar(); },
    conteudo: h('div', { class: 'stack' },
      aviso,
      h('div', { class: 'envio-resumo' },
        linha('De', de),
        linha('Para', paraTexto(email.para)),
        linha('Assunto', email.assunto),
        linha('Anexo(s)', h('div', { class: 'envio-anexos' }, itensAnexo))),
      h('details', { class: 'envio-corpo' }, h('summary', {}, 'Ver o corpo do e-mail'), previa)),
    acoes: [h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'), botaoEnviar],
  });

  const bloquear = (alertaEl) => {
    bloqueado = true;
    montar(aviso, alertaEl);
    botaoEnviar.disabled = true;
  };

  pedidoSituacao = api.get('/seguranca/envio').then((situacao) => {
    montar(de, situacao.remetente ?? '—');
    de.className = situacao.remetente ? '' : 'muted';
    if (!situacao.modo) {
      bloquear(alerta('error', 'Envio automático não configurado no servidor', 'Configure EMAIL_ENVIO (graph ou smtp) e EMAIL_REMETENTE. Enquanto isso, use "Gerar PDF".'));
    } else if (situacao.modo === 'arquivo') {
      montar(aviso, alerta('info', 'Modo demonstração', 'O e-mail não é enviado de verdade: fica salvo, com o PDF, em data/exemplo/emails-enviados (abra o .eml no Outlook para ver).'));
    }
    return situacao;
  });

  // PDFs gerados um a um (usam a mesma área de desenho); cada um sobe assim que fica pronto, sem esperar o próximo.
  const corpoPronto = Promise.all(pdfs.map((p) => folhaParaEmail(p.folha))).then((folhas) => folhas.join('<br>'));
  corpoPronto.then((html) => { previa.innerHTML = html; }).catch(() => montar(previa, h('pre', {}, email.corpo)));

  preparo = (async () => {
    const subidas = [];
    for (const [i, p] of pdfs.entries()) {
      if (cancelado) break;
      const blob = await gerarPdf([p.folha]);
      subidas.push(api.enviarArquivo(new File([blob], p.nome, { type: 'application/pdf' })).then((a) => {
        anexos[i] = a;
        if (cancelado) return api.del(`/arquivos/${a.id}`).catch(() => {});
        itensAnexo[i].replaceWith(h('a', { href: api.urlArquivo(a.id), target: '_blank', rel: 'noopener' }, icone('texto', { tamanho: 14 }), a.nome));
        return null;
      }));
    }
    await Promise.all(subidas);
  })();
  preparo.catch((e) => {
    if (cancelado) return;
    for (const item of itensAnexo) if (item.isConnected) item.classList.add('falhou');
    bloquear(alerta('error', 'Não foi possível preparar o anexo', `${e.message} Feche e tente de novo, ou use "Gerar PDF".`));
  });
  pedidoSituacao.catch((e) => bloquear(alerta('error', 'Não foi possível consultar o envio no servidor', e.message)));
}

/** Carrega antes as bibliotecas e o estilo do PDF (tela da IAT/IST aberta), para o envio não esperar por eles. */
export function prepararPdf() {
  Promise.all([carregarScript('vendor/html2canvas.min.js'), carregarScript('vendor/jspdf.umd.min.js'), garantirEstilo()]).catch(() => {});
}

/** Histórico de envios por e-mail do informativo. */
export function historicoEnvios(envios = []) {
  if (!envios.length) return null;
  return h('section', { class: 'card card-pad inf-secao' },
    h('h3', { class: 'inf-secao-titulo' }, 'Envios por e-mail'),
    h('div', { class: 'sheet' }, h('table', { class: 'lista-admin' },
      h('thead', {}, h('tr', {}, ['Quando', 'Ficha', 'Para', 'Cópia', 'Por', 'Anexo(s)'].map((t) => h('th', {}, t)))),
      h('tbody', {}, [...envios].reverse().map((e) => h('tr', {},
        h('td', { class: 'esq' }, fmtDataHora(e.em), e.modo === 'arquivo' ? h('small', { class: 'muted' }, ' (demonstração)') : null),
        h('td', { class: 'esq' }, NOMES[e.qual] ?? e.qual),
        h('td', { class: 'esq' }, paraTexto(e.para)),
        h('td', { class: 'esq' }, e.copia?.length ? e.copia.join(', ') : '—'),
        h('td', { class: 'esq' }, e.por),
        h('td', { class: 'esq' }, (e.anexos ?? []).map((id, i) => h('a', { href: api.urlArquivo(id), target: '_blank', rel: 'noopener' }, `PDF ${i + 1} `)))))))));
}
