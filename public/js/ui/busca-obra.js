/**
 * Campo de obra com busca (de-para da importação): lista suspensa padrão do sistema (ui/busca-lista.js) com as obras
 * do Cadastro de obras; busca pelo nome ou pelo cliente.
 *
 * aoMudar({ id, invalido }): id da obra (null = sem associação); invalido = há texto que não é uma obra da lista.
 */
import { filtrarObras } from '../domain/seguranca.js';
import { buscaLista } from './busca-lista.js';

export function buscaObra({ cadastros, valor = null, rotulo, aoMudar }) {
  const opcoes = cadastros.map((c) => ({ valor: c.id, rotulo: c.obra, detalhe: c.cliente ?? '', cadastro: c }));
  return buscaLista({
    opcoes,
    valor,
    rotulo: `Obra do cadastro para ${rotulo}`,
    placeholder: 'Digite para buscar a obra…',
    filtrar: (lista, texto) => filtrarObras(lista.map((o) => o.cadastro), texto).map((c) => lista.find((o) => o.valor === c.id)),
    aoMudar: ({ valor: id, invalido }) => aoMudar({ id, invalido }),
  });
}
