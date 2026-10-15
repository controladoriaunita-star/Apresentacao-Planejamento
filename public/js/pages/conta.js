/**
 * Minha conta: troca da própria senha.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { estado } from '../core/estado.js';
import { PAPEIS } from '../domain/permissoes.js';
import { alerta, botaoAcao, campo, card, toast } from '../ui/componentes.js';

export function renderConta(alvo) {
  const erro = h('div');
  const atual = h('input', { type: 'password', autocomplete: 'current-password' });
  const nova = h('input', { type: 'password', autocomplete: 'new-password' });
  const u = estado.usuario;
  montar(alvo,
    h('div', { class: 'titulo-pagina' }, h('div', {}, h('h1', {}, 'Minha conta'), h('p', {}, `${u.nome} · ${u.email} · ${PAPEIS[u.papel]?.nome}`))),
    card({ class: 'card-pad', style: { maxWidth: '480px' } },
      h('div', { class: 'stack' }, erro, campo('Senha atual', atual), campo('Nova senha', nova, 'Mínimo de 8 caracteres'),
        botaoAcao('Trocar senha', async () => {
          montar(erro);
          try {
            await api.put('/auth/senha', { senhaAtual: atual.value, novaSenha: nova.value });
            atual.value = '';
            nova.value = '';
            toast('success', 'Senha alterada');
          } catch (e) {
            montar(erro, alerta('error', e.message));
          }
        }, 'btn primary'))));
}
