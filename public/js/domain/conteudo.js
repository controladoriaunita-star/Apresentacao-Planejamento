/**
 * Conteúdo cadastrado pelo Planejamento: mídias (TxC e fotos) e telas da apresentação Cliente.
 * Validação compartilhada entre o servidor e os formulários.
 */
import { chaveObra, texto } from './normalizar.js';

export const TIPOS_MIDIA = Object.freeze({
  txc: { nome: 'Tempo x Caminho', grupo: 'Torre' },
  foto: { nome: 'Acompanhamento fotográfico', grupo: 'Local' },
});

export const TIPOS_BLOCO = Object.freeze({
  imagem: 'Imagem',
  planilha: 'Planilha (somente leitura)',
  texto: 'Texto',
});

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * TxC e fotos: uma imagem por registro, vinculada a obra + mês (como na lista do SharePoint
 * "Cadastro de Imagens"), com torre (TxC) ou local (fotos) e comentário.
 */
export function normalizarMidia(entrada) {
  const tipo = entrada?.tipo;
  if (!TIPOS_MIDIA[tipo]) throw new Error('Tipo de mídia inválido.');
  const obra = texto(entrada.obra);
  if (!obra) throw new Error('Informe a obra.');
  if (!MES.test(entrada.mes ?? '')) throw new Error('Informe o mês no formato AAAA-MM.');
  if (!texto(entrada.arquivoId)) throw new Error('Envie a imagem.');
  return {
    tipo,
    obra,
    chaveObra: chaveObra(obra),
    mes: entrada.mes,
    grupo: texto(entrada.grupo),
    comentario: texto(entrada.comentario),
    arquivoId: entrada.arquivoId,
    visivelCliente: entrada.visivelCliente !== false,
    ordem: Number.isFinite(Number(entrada.ordem)) ? Number(entrada.ordem) : 0,
  };
}

/**
 * Tela da apresentação Cliente: título, obras em que aparece (vazio = todas) e blocos
 * (imagem, planilha somente leitura ou texto).
 */
export function normalizarTela(entrada) {
  const titulo = texto(entrada?.titulo);
  if (!titulo) throw new Error('Informe o título da tela.');
  const blocos = Array.isArray(entrada.blocos) ? entrada.blocos : [];
  return {
    titulo,
    subtitulo: texto(entrada.subtitulo),
    obras: (Array.isArray(entrada.obras) ? entrada.obras : []).map(chaveObra).filter(Boolean),
    ordem: Number.isFinite(Number(entrada.ordem)) ? Number(entrada.ordem) : 0,
    ativa: entrada.ativa !== false,
    blocos: blocos.map((b, i) => {
      if (!TIPOS_BLOCO[b?.tipo]) throw new Error(`Bloco ${i + 1}: tipo inválido.`);
      if (b.tipo !== 'texto' && !texto(b.arquivoId)) throw new Error(`Bloco ${i + 1}: envie o arquivo.`);
      if (b.tipo === 'texto' && !texto(b.texto)) throw new Error(`Bloco ${i + 1}: escreva o texto.`);
      return {
        tipo: b.tipo,
        titulo: texto(b.titulo),
        arquivoId: b.tipo === 'texto' ? null : b.arquivoId,
        arquivoNome: texto(b.arquivoNome),
        aba: texto(b.aba), // planilha: aba a exibir (vazio = primeira)
        texto: b.tipo === 'texto' ? String(b.texto).trim() : null,
        largura: b.largura === 'metade' ? 'metade' : 'inteira',
      };
    }),
  };
}

/** Telas visíveis para as obras filtradas, em ordem. */
export function telasDaObra(telas, chaves) {
  return telas
    .filter((t) => t.ativa && (t.obras.length === 0 || t.obras.some((o) => chaves.includes(o))))
    .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}
