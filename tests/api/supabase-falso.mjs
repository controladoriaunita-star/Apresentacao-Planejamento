/**
 * Supabase simulado em memória para os testes: atende, por `fetch`, os mesmos endereços que
 * server/supabase/cliente.mjs usa — Auth (GoTrue), banco (PostgREST, filtros `eq.` e `order`) e Storage.
 * Exige a chave certa em cada área (anon no login, service role no resto), o que pega erros de configuração.
 * Os e-mails de convite e de nova senha ficam em `emails` ({ tipo, email, token, endereco }), com o token que o
 * link real levaria ao app.
 */
import { randomUUID } from 'node:crypto';

export const CHAVES = { anon: 'chave-anon-teste', servico: 'chave-servico-teste' };

export function criarSupabaseFalso({ url = 'http://supabase.falso' } = {}) {
  const usuarios = new Map(); // id → {id, email, senha, banido, confirmado}
  const tokens = new Map(); // access/refresh → id
  const tabelas = new Map(); // nome → linhas[]
  const objetos = new Map(); // "bucket/caminho" → {dados, tipo}
  const assinaturas = new Map(); // token → "bucket/caminho"
  const chamadas = [];
  const emails = [];
  const enviarEmail = (tipo, usuario, endereco) => emails.push({ tipo, email: usuario.email, token: sessaoPara(usuario).access_token, endereco });

  const json = (status, corpo) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
  const tabela = (nome) => { if (!tabelas.has(nome)) tabelas.set(nome, []); return tabelas.get(nome); };
  const sessaoPara = (usuario) => {
    const access = `at-${randomUUID()}`;
    const refresh = `rt-${randomUUID()}`;
    tokens.set(access, usuario.id);
    tokens.set(refresh, usuario.id);
    return { access_token: access, refresh_token: refresh, expires_in: 3600, token_type: 'bearer', user: { id: usuario.id, email: usuario.email } };
  };

  async function lerCorpo(init) {
    if (init?.body === undefined || init.body === null) return null;
    if (typeof init.body === 'string') { try { return JSON.parse(init.body); } catch { return init.body; } }
    if (init.body instanceof Uint8Array) return Buffer.from(init.body);
    if (typeof init.body.arrayBuffer === 'function') return Buffer.from(await init.body.arrayBuffer());
    return init.body;
  }

  /** Valores de `in.("a","b",c)` (aspas opcionais, com \" e \\ escapados). */
  const valoresIn = (texto) => [...texto.slice(1, -1).matchAll(/"((?:[^"\\]|\\.)*)"|([^,]+)/g)].map((m) => (m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2]));

  function filtrar(linhas, params) {
    let resultado = linhas;
    for (const [k, v] of params) {
      if (['select', 'order', 'on_conflict', 'limit', 'offset'].includes(k)) continue;
      const [, op, valor] = v.match(/^(eq|in|gte|lte|ilike)\.(.*)$/s) ?? [null, 'eq', v];
      if (op === 'eq') resultado = resultado.filter((l) => String(l[k]) === valor);
      if (op === 'in') { const vs = new Set(valoresIn(valor)); resultado = resultado.filter((l) => vs.has(String(l[k]))); }
      if (op === 'gte') resultado = resultado.filter((l) => String(l[k]) >= valor);
      if (op === 'lte') resultado = resultado.filter((l) => String(l[k]) <= valor);
      if (op === 'ilike') { const t = valor.replace(/\*/g, '').toLowerCase(); resultado = resultado.filter((l) => String(l[k] ?? '').toLowerCase().includes(t)); }
    }
    const ordem = params.get('order');
    if (ordem) {
      const criterios = ordem.split(',').map((c) => c.split('.'));
      resultado = [...resultado].sort((a, b) => {
        for (const [col, dir] of criterios) {
          const d = String(a[col] ?? '').localeCompare(String(b[col] ?? '')) * (dir === 'desc' ? -1 : 1);
          if (d) return d;
        }
        return 0;
      });
    }
    return resultado;
  }

  /** Únicos do banco real que a API precisa ver respeitados (supabase/migrations). */
  const UNICOS = { acidentes: ['chave_dedup'] };
  const violaUnico = (nome, linhas, nova, ignorar = null) => (UNICOS[nome] ?? []).some((col) => linhas.some((l) => l !== ignorar && l[col] === nova[col]));
  const colunas = (linha, select) => (!select || select === '*' ? { ...linha } : Object.fromEntries(select.split(',').map((c) => [c, linha[c]])));

  async function atender(entrada, init = {}) {
    const alvo = new URL(typeof entrada === 'string' ? entrada : entrada.url);
    const metodo = (init.method ?? 'GET').toUpperCase();
    const cab = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    const caminho = alvo.pathname;
    chamadas.push(`${metodo} ${caminho}`);
    const corpo = await lerCorpo(init);
    const servico = cab.authorization === `Bearer ${CHAVES.servico}`;

    // ── Auth ──
    if (caminho === '/auth/v1/token') {
      if (cab.apikey !== CHAVES.anon) return json(401, { msg: 'apikey inválida' });
      if (alvo.searchParams.get('grant_type') === 'password') {
        const u = [...usuarios.values()].find((x) => x.email === corpo.email);
        if (!u || u.senha !== corpo.password || u.banido) return json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
        return json(200, sessaoPara(u));
      }
      const id = tokens.get(corpo.refresh_token);
      if (!id || usuarios.get(id)?.banido) return json(400, { error_description: 'Invalid Refresh Token' });
      tokens.delete(corpo.refresh_token);
      return json(200, sessaoPara(usuarios.get(id)));
    }
    if (caminho === '/auth/v1/user') {
      const id = tokens.get(String(cab.authorization).replace('Bearer ', ''));
      return id ? json(200, { id, email: usuarios.get(id).email }) : json(401, { msg: 'token inválido' });
    }
    if (caminho === '/auth/v1/logout') return json(204);
    if (caminho === '/auth/v1/invite') {
      if (!servico) return json(403, { msg: 'precisa da service role' });
      let u = [...usuarios.values()].find((x) => x.email === corpo.email);
      if (u?.confirmado) return json(422, { msg: 'A user with this email address has already been registered' });
      if (!u) {
        u = { id: randomUUID(), email: corpo.email, senha: null, banido: false, confirmado: false };
        usuarios.set(u.id, u);
      }
      enviarEmail('invite', u, alvo.searchParams.get('redirect_to'));
      return json(200, { id: u.id, email: u.email });
    }
    if (caminho === '/auth/v1/recover') {
      if (cab.apikey !== CHAVES.anon) return json(401, { msg: 'apikey inválida' });
      const u = [...usuarios.values()].find((x) => x.email === corpo.email);
      if (u) enviarEmail('recovery', u, alvo.searchParams.get('redirect_to'));
      return json(200, {});
    }
    if (caminho.startsWith('/auth/v1/admin/users')) {
      if (!servico) return json(403, { msg: 'precisa da service role' });
      const id = decodeURIComponent(caminho.split('/')[5] ?? '');
      if (metodo === 'POST') {
        if ([...usuarios.values()].some((x) => x.email === corpo.email)) return json(422, { msg: 'A user with this email address has already been registered' });
        const u = { id: randomUUID(), email: corpo.email, senha: corpo.password, banido: false, confirmado: true };
        usuarios.set(u.id, u);
        return json(200, { id: u.id, email: u.email });
      }
      const u = usuarios.get(id);
      if (!u) return json(404, { msg: 'User not found' });
      if (metodo === 'PUT') {
        if (corpo.password) Object.assign(u, { senha: corpo.password, confirmado: true });
        if (corpo.ban_duration) u.banido = corpo.ban_duration !== 'none';
        return json(200, { id: u.id, email: u.email });
      }
      if (metodo === 'DELETE') { usuarios.delete(id); return json(200, {}); }
    }

    // ── Banco ──
    if (caminho.startsWith('/rest/v1/')) {
      if (!servico) return json(401, { message: 'RLS: acesso negado sem a service role' });
      const nome = caminho.slice('/rest/v1/'.length);
      const linhas = tabela(nome);
      const params = alvo.searchParams;
      if (metodo === 'GET') {
        const todas = filtrar(linhas, params);
        const inicio = Number(params.get('offset') ?? 0);
        const fim = params.has('limit') ? inicio + Number(params.get('limit')) : undefined;
        const pagina = todas.slice(inicio, fim).map((l) => colunas(l, params.get('select')));
        const cabecalhos = { 'content-type': 'application/json' };
        if (/count=exact/.test(cab.prefer ?? '')) cabecalhos['content-range'] = `${inicio}-${inicio + pagina.length - 1}/${todas.length}`;
        return new Response(JSON.stringify(pagina), { status: 200, headers: cabecalhos });
      }
      if (metodo === 'POST' && Array.isArray(corpo)) {
        // Inserção em lote: tudo ou nada; com resolution=ignore-duplicates pula os conflitos em on_conflict.
        const ignorar = /ignore-duplicates/.test(cab.prefer ?? '');
        const conflito = params.get('on_conflict');
        const criadas = [];
        for (const nova of corpo) {
          const repetida = (conflito && [...linhas, ...criadas].some((l) => l[conflito] === nova[conflito])) || violaUnico(nome, [...linhas, ...criadas], nova);
          if (repetida && ignorar) continue;
          if (repetida) return json(409, { message: 'duplicate key value violates unique constraint' });
          criadas.push({ ...nova });
        }
        linhas.push(...criadas);
        return json(201, criadas.map((l) => ({ ...l })));
      }
      if (metodo === 'POST') {
        const conflito = params.get('on_conflict');
        const nova = { ...corpo };
        if (!conflito && violaUnico(nome, linhas, nova)) return json(409, { message: 'duplicate key value violates unique constraint' });
        const i = conflito ? linhas.findIndex((l) => l[conflito] === nova[conflito]) : -1;
        if (i >= 0) linhas[i] = { ...linhas[i], ...nova };
        else {
          if (linhas.some((l) => l.id === nova.id)) return json(409, { message: 'duplicate key' });
          linhas.push(nova);
        }
        return json(201, [{ ...(i >= 0 ? linhas[i] : nova) }]);
      }
      const alvos = filtrar(linhas, params);
      if (metodo === 'PATCH') {
        if (alvos.some((l) => violaUnico(nome, linhas, { ...l, ...corpo }, l))) return json(409, { message: 'duplicate key value violates unique constraint' });
        for (const l of alvos) Object.assign(l, corpo);
        return json(200, alvos.map((l) => ({ ...l })));
      }
      if (metodo === 'DELETE') {
        tabelas.set(nome, linhas.filter((l) => !alvos.includes(l)));
        return json(200, alvos);
      }
    }

    // ── Storage ──
    if (caminho.startsWith('/storage/v1/object/upload/sign/')) {
      const chave = decodeURIComponent(caminho.slice('/storage/v1/object/upload/sign/'.length));
      if (metodo === 'POST') {
        if (!servico) return json(403, { message: 'precisa da service role' });
        const token = randomUUID();
        assinaturas.set(token, chave);
        return json(200, { url: `/object/upload/sign/${chave}?token=${token}` });
      }
      if (metodo === 'PUT') {
        if (assinaturas.get(alvo.searchParams.get('token')) !== chave) return json(403, { message: 'assinatura inválida' });
        objetos.set(chave, { dados: corpo, tipo: cab['content-type'] });
        return json(200, { Key: chave });
      }
    }
    if (caminho.startsWith('/storage/v1/object/sign/')) {
      const chave = decodeURIComponent(caminho.slice('/storage/v1/object/sign/'.length));
      if (metodo === 'POST') {
        if (!servico) return json(403, { message: 'precisa da service role' });
        const token = randomUUID();
        assinaturas.set(token, chave);
        return json(200, { signedURL: `/object/sign/${chave}?token=${token}` });
      }
      const objeto = objetos.get(chave);
      if (assinaturas.get(alvo.searchParams.get('token')) !== chave || !objeto) return json(400, { message: 'Object not found' });
      return new Response(objeto.dados, { status: 200, headers: { 'content-type': objeto.tipo ?? 'application/octet-stream' } });
    }
    if (caminho.startsWith('/storage/v1/object/authenticated/')) {
      if (!servico) return json(403, { message: 'precisa da service role' });
      const objeto = objetos.get(decodeURIComponent(caminho.slice('/storage/v1/object/authenticated/'.length)));
      return objeto ? new Response(objeto.dados, { status: 200 }) : json(400, { message: 'Object not found' });
    }
    if (caminho.startsWith('/storage/v1/object/')) {
      if (!servico) return json(403, { message: 'precisa da service role' });
      const resto = decodeURIComponent(caminho.slice('/storage/v1/object/'.length));
      if (metodo === 'DELETE') {
        for (const p of corpo.prefixes ?? []) objetos.delete(`${resto}/${p}`);
        return json(200, []);
      }
      if (metodo === 'POST') {
        objetos.set(resto, { dados: corpo, tipo: cab['content-type'] });
        return json(200, { Key: resto });
      }
    }
    return json(404, { message: `rota simulada não existe: ${metodo} ${caminho}` });
  }

  return { url, fetch: atender, usuarios, tabelas, objetos, chamadas, emails };
}
