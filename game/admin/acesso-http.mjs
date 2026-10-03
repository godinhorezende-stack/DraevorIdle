// A ponte HTTP do acesso à Engine (`admin/acesso.mjs`): atende `auth/entrar|sair|quem` e barra, ANTES de qualquer rota `/api/mapas*`, o que o
// acesso não permite. Devolve `true` quando já respondeu (o servidor não segue adiante).
import { lerCookie, montarCookie, mesmaOrigem, NOME_DO_COOKIE } from './acesso.mjs';

const PREFIXO = '/api/mapas/_conteudo/auth/';

export function criarGuarda(acesso) {
  return async function guardar(req, res, caminho, { json, corpoJson }) {
    if (!caminho.startsWith('/api/mapas')) return false;
    const cookie = req.headers.cookie;
    const token = lerCookie(cookie);
    const seguro = String(req.headers['x-forwarded-proto'] ?? '').includes('https');
    if (caminho === `${PREFIXO}quem`) return json(res, 200, acesso.quem(token)), true;
    if (caminho === `${PREFIXO}sair` && req.method === 'POST') {
      acesso.sair(token);
      res.setHeader('Set-Cookie', `${NOME_DO_COOKIE}=; Path=/api/mapas; HttpOnly; SameSite=Strict; Max-Age=0`);
      return json(res, 200, { ok: true }), true;
    }
    if (caminho === `${PREFIXO}entrar` && req.method === 'POST') {
      const origem = req.headers.origin;
      if (!mesmaOrigem(origem, req.headers.host, req.headers['x-forwarded-host'])) return json(res, 403, { ok: false, erro: 'Pedido de outra origem recusado.' }), true;
      const d = await corpoJson(req).catch(() => null);
      const r = await acesso.entrar({ email: d?.email, senha: d?.senha, ip: req.headers['x-real-ip'] ?? req.socket?.remoteAddress ?? 'desconhecido' });
      if (!r.ok) return json(res, r.status, { ok: false, erro: r.erro }), true;
      res.setHeader('Set-Cookie', montarCookie(r.token, { seguro }));
      return json(res, 200, { ok: true, email: r.email, ...acesso.quem(r.token) }), true;
    }
    const d = acesso.autorizar({ metodo: req.method, caminho, cookie, origem: req.headers.origin ?? null, host: req.headers.host, encaminhado: req.headers['x-forwarded-host'] ?? null });
    if (d.ok) return false;
    return json(res, d.status, { ok: false, codigo: d.codigo, erros: [d.erro], erro: d.erro }), true;
  };
}
