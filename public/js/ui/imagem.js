/**
 * Imagens em qualquer formato: PNG, JPG, WEBP e GIF seguem como estão; os demais (HEIC/HEIF do iPhone, TIFF, BMP,
 * AVIF, SVG, ICO, JFIF…) são convertidos no navegador antes do envio — PNG quando há transparência possível
 * (SVG, ICO, AVIF) e JPG nas fotos —, para que toda imagem anexada abra em qualquer navegador e no Storage.
 * HEIC (heic2any) e TIFF (utif + pako) usam bibliotecas em public/vendor, carregadas só quando necessário.
 */

/** Tipos guardados como estão (os mesmos aceitos pelo servidor em server/store/arquivos.mjs). */
const TIPOS_WEB = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** `accept` dos seletores de imagem: qualquer imagem + extensões que o Windows nem sempre associa a image/*. */
export const ACEITA_IMAGENS = 'image/*,.heic,.heif,.avif,.tif,.tiff,.bmp,.jfif,.svg,.ico';

const EXTENSOES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', jpe: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  heic: 'image/heic', heif: 'image/heif', avif: 'image/avif', tif: 'image/tiff', tiff: 'image/tiff', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon',
};
const COM_TRANSPARENCIA = new Set(['image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/avif', 'image/bmp']);

const extensao = (nome) => String(nome ?? '').toLowerCase().split('.').pop();

/** Tipo da imagem pelo navegador ou, se ele não informar (comum em HEIC/JFIF no Windows), pela extensão. */
export function tipoDaImagem(arquivo) {
  const doNavegador = String(arquivo.type ?? '').toLowerCase();
  if (doNavegador.startsWith('image/')) return doNavegador === 'image/jpg' || doNavegador === 'image/pjpeg' ? 'image/jpeg' : doNavegador;
  return EXTENSOES[extensao(arquivo.name)] ?? null;
}

export const ehImagem = (arquivo) => Boolean(tipoDaImagem(arquivo));

/**
 * Devolve um File pronto para enviar: o próprio arquivo (com o tipo corrigido) ou a conversão para PNG/JPG.
 * Lança Error com mensagem para o usuário quando o arquivo não é imagem ou não pôde ser lido.
 */
export async function prepararImagem(arquivo) {
  const tipo = tipoDaImagem(arquivo);
  if (!tipo) throw new Error(`"${arquivo.name}" não é uma imagem.`);
  if (TIPOS_WEB.has(tipo)) return arquivo.type === tipo ? arquivo : new File([arquivo], arquivo.name, { type: tipo, lastModified: arquivo.lastModified });

  const saida = COM_TRANSPARENCIA.has(tipo) ? 'image/png' : 'image/jpeg';
  let blob;
  try {
    if (tipo === 'image/heic' || tipo === 'image/heif') blob = await deHeic(arquivo, saida);
    else if (tipo === 'image/tiff') blob = await deTiff(arquivo, saida);
    else blob = await peloNavegador(arquivo, saida);
  } catch (e) {
    console.error(e);
    throw new Error(`Não foi possível converter "${arquivo.name}". Salve a imagem como JPG ou PNG e tente de novo.`);
  }
  const nome = `${arquivo.name.replace(/\.[^.]+$/, '')}.${saida === 'image/png' ? 'png' : 'jpg'}`;
  return new File([blob], nome, { type: saida, lastModified: arquivo.lastModified });
}

// ── Conversores ──────────────────────────────────────────────────────

const carregados = new Map();
function carregarScript(src) {
  if (!carregados.has(src)) {
    carregados.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { carregados.delete(src); reject(new Error(`Não foi possível carregar ${src}.`)); };
      document.head.append(s);
    }));
  }
  return carregados.get(src);
}

/** BMP, AVIF, SVG, ICO etc.: o próprio navegador decodifica; o canvas regrava em PNG/JPG. */
async function peloNavegador(arquivo, saida) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    // SVG sem width/height pode vir com 0 × 0: usa um tamanho padrão.
    const largura = img.naturalWidth || 1600;
    const altura = img.naturalHeight || Math.round(largura * 0.75);
    return paraBlob(desenhar(largura, altura, (ctx) => ctx.drawImage(img, 0, 0, largura, altura), saida), saida);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function deHeic(arquivo, saida) {
  // Safari (e Edge com a extensão HEVC) já decodificam HEIC: tenta o navegador antes de baixar o conversor.
  try { return await peloNavegador(arquivo, saida); } catch { /* segue com heic2any */ }
  await carregarScript('vendor/heic2any.min.js');
  const resultado = await window.heic2any({ blob: arquivo, toType: saida, quality: 0.9 });
  return Array.isArray(resultado) ? resultado[0] : resultado; // HEIC com várias imagens: a primeira
}

async function deTiff(arquivo, saida) {
  await carregarScript('vendor/pako_inflate.min.js'); // TIFF com compressão Deflate
  await carregarScript('vendor/utif.js');
  const { UTIF } = window;
  const dados = await arquivo.arrayBuffer();
  const [pagina] = UTIF.decode(dados); // TIFF com várias páginas: a primeira
  if (!pagina) throw new Error('TIFF sem imagem.');
  UTIF.decodeImage(dados, pagina);
  const rgba = UTIF.toRGBA8(pagina);
  const { width: largura, height: altura } = pagina;
  // createImageBitmap + drawImage (e não putImageData) para o fundo branco valer onde o TIFF é transparente.
  const bitmap = await createImageBitmap(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length), largura, altura));
  return paraBlob(desenhar(largura, altura, (ctx) => ctx.drawImage(bitmap, 0, 0), saida), saida);
}

function desenhar(largura, altura, pintar, saida) {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (saida === 'image/jpeg') { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, largura, altura); } // JPG não tem transparência
  pintar(ctx);
  return canvas;
}

const paraBlob = (canvas, saida) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem.'))), saida, 0.9);
});
