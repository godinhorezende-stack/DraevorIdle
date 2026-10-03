// A ponte HTTP do acesso à Engine (`admin/acesso.mjs`): atende `auth/entrar|sair|quem` e barra, ANTES de qualquer rota `/api/mapas*`, o que o
// acesso não permite. Devolve `true` quando já respondeu (o servidor não segue adiante).
import { lerCookie, montarCookies, apagarCookies, mesmaOrigem, classeDaRota } from './acesso.mjs';
import * as Auditoria from './auditoria.mjs';

const PREFIXO = '/api/mapas/_conteudo/auth/';

export function criarGuarda(acesso, { auditoria = Auditoria, aoGravar = null } = {}) {
  return async function guardar(req, res, caminho, { json, corpoJson }) {
    if (!caminho.startsWith('/api/mapas')) return false;
    const ip = req.headers['x-real-ip'] ?? req.socket?.remoteAddress ?? 'desconhecido';
    const cookie = req.headers.cookie;
    const token = lerCookie(cookie);
    const seguro = String(req.headers['x-forwarded-proto'] ?? '').includes('https');
    if (caminho === `${PREFIXO}quem`) return json(res, 200, acesso.quem(token)), true;
    if (caminho === `${PREFIXO}sair` && req.method === 'POST') {
      const quem = acesso.quem(token);
      acesso.sair(token);
      if (quem.logado) auditoria.registrar({ tipo: 'logout', quem: quem.email, ip });
      res.setHeader('Set-Cookie', apagarCookies());
      return json(res, 200, { ok: true }), true;
    }
    if (caminho === `${PREFIXO}entrar` && req.method === 'POST') {
      const origem = req.headers.origin;
      if (!mesmaOrigem(origem, req.headers.host, req.headers['x-forwarded-host'])) return json(res, 403, { ok: false, erro: 'Pedido de outra origem recusado.' }), true;
      const d = await corpoJson(req).catch(() => null);
      const r = await acesso.entrar({ email: d?.email, senha: d?.senha, ip });
      if (!r.ok) { auditoria.registrar({ tipo: 'login-falha', quem: String(d?.email ?? '').slice(0, 120), ip, status: r.status, motivo: r.erro }); return json(res, r.status, { ok: false, erro: r.erro }), true; }
      auditoria.registrar({ tipo: 'login', quem: r.email, ip });
      res.setHeader('Set-Cookie', montarCookies(r.token, { seguro }));
      return json(res, 200, { ok: true, email: r.email, ...acesso.quem(r.token) }), true;
    }
    const d = acesso.autorizar({ metodo: req.method, caminho, cookie, origem: req.headers.origin ?? null, host: req.headers.host, encaminhado: req.headers['x-forwarded-host'] ?? null });
    const quem = acesso.quem(token).email;
    req.engineQuem = quem ?? null; // quem está agindo (as rotas de versão registram o autor)
    const classe = classeDaRota(req.method, caminho);
    if (!d.ok) {
      // Tentativa recusada (sem login, sem permissão, de outra origem ou gravação desligada): só as que mudariam algo entram no registro.
      if (classe !== 'leitura') auditoria.registrar({ tipo: 'recusado', quem, ip, metodo: req.method, rota: caminho.replace('/api/mapas/_conteudo/', ''), codigo: d.codigo });
      return json(res, d.status, { ok: false, codigo: d.codigo, erros: [d.erro], erro: d.erro }), true;
    }
    if (classe === 'grava' || classe === 'operacao') {
      // Registra o RESULTADO quando a resposta sai (o corpo foi lido pelo handler; só o resumo vai para o registro).
      const fim = res.end.bind(res);
      res.end = (...a) => {
        let ok = res.statusCode < 400;
        try { const corpo = JSON.parse(a[0]); if (corpo && corpo.ok === false) ok = false; } catch { /* resposta sem JSON */ }
        auditoria.registrar({ tipo: classe === 'grava' ? 'gravacao' : 'operacao', quem, ip, metodo: req.method, rota: caminho.replace('/api/mapas/_conteudo/', ''), resumo: Auditoria.resumirCorpo(req.corpoAuditado), ok });
        if (ok && classe === 'grava') { try { aoGravar?.({ rota: caminho.replace('/api/mapas/_conteudo/', ''), corpo: req.corpoAuditado ?? null }); } catch { /* o Hot Reload nunca derruba a resposta */ } }
        return fim(...a);
      };
    }
    return false;
  };
}
