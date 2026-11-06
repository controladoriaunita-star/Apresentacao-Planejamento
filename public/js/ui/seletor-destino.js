/**
 * Caixa de seleção "Apresentação": decide se a tela ou a imagem vai para a apresentação Obra, Cliente ou ambas.
 * Usada nos formulários de Novas telas e de TxC e fotos.
 */
import { h } from '../core/dom.js';
import { DESTINOS } from '../domain/conteudo.js';
import { campo } from './componentes.js';

/** @returns {{ elemento: HTMLElement, valor: () => string }} */
export function seletorDestino(destino) {
  const select = h('select', {}, Object.entries(DESTINOS).map(([valor, rotulo]) => h('option', { value: valor, selected: valor === destino }, rotulo)));
  return { elemento: campo('Apresentação', select), valor: () => select.value };
}
