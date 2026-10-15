/**
 * Hash de senha com PBKDF2-SHA256 — escolhido por existir igual no PHP (`hash_pbkdf2`), então os
 * usuários migram para a versão PHP sem redefinir senha. Formato: pbkdf2$<iterações>$<sal b64>$<hash b64>.
 */
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const ITERACOES = 210_000;
const TAMANHO = 32;

export function gerarHash(senha) {
  const sal = randomBytes(16);
  const hash = pbkdf2Sync(String(senha), sal, ITERACOES, TAMANHO, 'sha256');
  return `pbkdf2$${ITERACOES}$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export function conferirSenha(senha, armazenado) {
  const [tipo, iteracoes, salB64, hashB64] = String(armazenado ?? '').split('$');
  if (tipo !== 'pbkdf2' || !iteracoes || !salB64 || !hashB64) return false;
  const esperado = Buffer.from(hashB64, 'base64');
  const calculado = pbkdf2Sync(String(senha), Buffer.from(salB64, 'base64'), Number(iteracoes), esperado.length, 'sha256');
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

/** Regra mínima de senha (mesma mensagem no front). */
export function validarSenha(senha) {
  if (typeof senha !== 'string' || senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  return null;
}
