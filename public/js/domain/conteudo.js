/**
 * Conteúdo cadastrado pelo Planejamento: mídias (TxC e fotos) e telas extras das apresentações.
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

/** Em qual apresentação a tela ou a imagem aparece. */
export const DESTINOS = Object.freeze({
  ambas: 'Obra e Cliente',
  obra: 'Somente Obra',
  cliente: 'Somente Cliente',
});

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Destino de uma mídia. Registros gravados antes do campo existir só tinham `visivelCliente`:
 * apareciam sempre na Obra e, se visíveis, também no Cliente.
 */
export function destinoDaMidia(midia) {
  if (DESTINOS[midia?.destino]) return midia.destino;
  return midia?.visivelCliente === false ? 'obra' : 'ambas';
}

/** Destino de uma tela. Telas gravadas antes do campo existir eram só da apresentação Cliente. */
export function destinoDaTela(tela) {
  return DESTINOS[tela?.destino] ? tela.destino : 'cliente';
}

/** A tela/mídia com este destino aparece na apresentação `visao` ("obra" ou "cliente")? */
export const apareceNa = (destino, visao) => destino === 'ambas' || destino === visao;

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
  const destino = destinoDaMidia(entrada);
  return {
    tipo,
    obra,
    chaveObra: chaveObra(obra),
    mes: entrada.mes,
    grupo: texto(entrada.grupo),
    comentario: texto(entrada.comentario),
    arquivoId: entrada.arquivoId,
    destino,
    visivelCliente: apareceNa(destino, 'cliente'), // mantido para compatibilidade com registros antigos
    ordem: Number.isFinite(Number(entrada.ordem)) ? Number(entrada.ordem) : 0,
  };
}

/**
 * Tela extra das apresentações: título, apresentação em que aparece (destino), obras em que aparece
 * (vazio = todas) e blocos (imagem, planilha somente leitura ou texto).
 */
export function normalizarTela(entrada) {
  const titulo = texto(entrada?.titulo);
  if (!titulo) throw new Error('Informe o título da tela.');
  const blocos = Array.isArray(entrada.blocos) ? entrada.blocos : [];
  return {
    titulo,
    subtitulo: texto(entrada.subtitulo),
    destino: destinoDaTela(entrada),
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

/** Telas visíveis na apresentação `visao` para as obras filtradas, em ordem. */
export function telasDaObra(telas, chaves, visao) {
  return telas
    .filter((t) => t.ativa && apareceNa(destinoDaTela(t), visao) && (t.obras.length === 0 || t.obras.some((o) => chaves.includes(o))))
    .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

/** Mídias que aparecem na apresentação `visao`. */
export function midiasDaVisao(midias, visao) {
  return midias.filter((m) => apareceNa(destinoDaMidia(m), visao));
}
