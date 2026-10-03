// O ACESSO à Engine, validado NO SERVIDOR: quem pode entrar (contas do jogo cujo e-mail está na lista de administradores) e o que pode gravar
// (arquivos do editor só onde a gravação está ligada — desenvolvimento; produção só lê e opera). Vale para todas as rotas `/api/mapas*`
// (a Engine e o editor de mapas antigo, que usa o mesmo cookie), em cima do bloqueio de rede do nginx. A configuração e a decisão são PURAS
// (testadas); o login usa a conta do jogo (senha com scrypt, `database/banco.mjs`) injetada como dependência, e a sessão da Engine fica na
// memória do processo (cookie HttpOnly): reiniciar o servidor exige entrar de novo e não polui o banco do jogo.
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ARQUIVO = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata', 'engine.json');
export const NOME_DO_COOKIE = 'engine_sessao';
export const DURACAO_DA_SESSAO_MS = 12 * 3_600_000;
const TENTATIVAS = { max: 5, janelaMs: 10 * 60_000 };

// ------------------------------------------------------------------ configuração

const lerAdminsDoArquivo = (arquivo = ARQUIVO) => {
  try {
    return JSON.parse(readFileSync(arquivo, 'utf8')).admins ?? [];
  } catch {
    return [];
  }
};
const normalizarEmail = (e) => String(e ?? '').trim().toLowerCase();
const liga = (v) => (v === '1' || v === 'true' ? true : v === '0' || v === 'false' ? false : null);

/**
 * A configuração de acesso. `producao`: NODE_ENV=production, dentro de container ou ENGINE_MODO=producao. Em produção o login é obrigatório e a
 * gravação desligada; em desenvolvimento (a sua máquina) nada exige login e grava. `ENGINE_EXIGE_LOGIN` e `ENGINE_GRAVA` (0|1) mandam sobre o padrão.
 */
export function configuracao({ env = process.env, existe = existsSync, arquivoDeAdmins = ARQUIVO } = {}) {
  const producao = env.ENGINE_MODO === 'producao' || (env.ENGINE_MODO !== 'desenvolvimento' && (env.NODE_ENV === 'production' || existe('/.dockerenv')));
  const admins = (env.ENGINE_ADMINS != null ? env.ENGINE_ADMINS.split(',') : lerAdminsDoArquivo(arquivoDeAdmins)).map(normalizarEmail).filter(Boolean);
  return { producao, exigeLogin: liga(env.ENGINE_EXIGE_LOGIN) ?? producao, grava: liga(env.ENGINE_GRAVA) ?? !producao, admins };
}
export const ehAdmin = (config, email) => config.admins.includes(normalizarEmail(email));

// ------------------------------------------------------------------ o que cada rota faz

const ROTAS_DE_LEITURA_POR_POST = [/^fase\/[^/]+\/validar$/, /^mapa\/validar$/, /^bosses\/validar$/, /^atos-editor\/validar$/, /^atos-editor\/previa$/, /^mapas\/validar$/, /^campanha\/validar$/];
const ROTAS_DE_OPERACAO = [/^operacao\//, /^modo-beta$/, /^server-save$/];
const PREFIXO = '/api/mapas/_conteudo/';

/**
 * Classifica uma requisição `/api/mapas*`: 'publica' (login/logout/quem), 'leitura', 'operacao' (age no servidor em execução, não grava arquivo)
 * ou 'grava' (grava arquivo do editor). POST desconhecido sob `_conteudo` = 'grava' (o padrão seguro é negar).
 */
export function classeDaRota(metodo, caminho) {
  if (caminho.startsWith(`${PREFIXO}auth/`)) return 'publica';
  if (metodo === 'GET' || metodo === 'HEAD') return 'leitura';
  const rota = caminho.startsWith(PREFIXO) ? caminho.slice(PREFIXO.length) : null;
  if (rota == null) return 'grava'; // POST /api/mapas (salvar mapa)
  if (ROTAS_DE_OPERACAO.some((r) => r.test(rota))) return 'operacao';
  if (ROTAS_DE_LEITURA_POR_POST.some((r) => r.test(rota))) return 'leitura';
  return 'grava';
}

/**
 * A origem do pedido é a MESMA do servidor? Compara o NOME do host e ignora a porta: atrás do nginx (`Host: $host`, sem porta) e de um túnel SSH
 * (`https://localhost:8443`) o `Origin` traz a porta e o `Host` não. Outro site (outro nome) continua recusado; o cookie SameSite=Strict e o
 * login com senha seguem valendo por cima.
 */
export function mesmaOrigem(origem, host, encaminhado = null) {
  if (!origem) return true;
  let o;
  try { o = new URL(origem); } catch { return false; }
  const nome = (h) => String(h ?? '').split(',')[0].trim().replace(/:\d+$/, '').toLowerCase();
  return !!host && (o.host.toLowerCase() === String(host).toLowerCase() || nome(o.host) === nome(host) || (encaminhado != null && nome(o.host) === nome(encaminhado)));
}

/** A decisão: `{ ok: true }` ou `{ ok: false, status, codigo, erro }`. `sessao`: `{ email }` ou null. */
export function decidir({ config, metodo, caminho, sessao, origem = null, host = null, encaminhado = null }) {
  const classe = classeDaRota(metodo, caminho);
  if (classe === 'publica') return { ok: true, classe };
  if (config.exigeLogin) {
    if (!sessao) return { ok: false, status: 401, codigo: 'sem-login', erro: 'Entre com uma conta de administrador para usar a Engine.' };
    if (!ehAdmin(config, sessao.email)) return { ok: false, status: 403, codigo: 'sem-permissao', erro: 'Esta conta não é administradora da Engine.' };
  }
  // Defesa contra CSRF: pedido que muda algo precisa vir da MESMA origem (o cookie já é SameSite=Strict).
  if (classe !== 'leitura' && origem) {
    if (!mesmaOrigem(origem, host, encaminhado)) return { ok: false, status: 403, codigo: 'origem', erro: 'Pedido de outra origem recusado.' };
  }
  if (classe === 'grava' && !config.grava) return { ok: false, status: 403, codigo: 'gravacao-desligada', erro: 'Gravação desligada neste servidor (produção): edite localmente, faça commit e publique pelo deploy.' };
  return { ok: true, classe };
}

// ------------------------------------------------------------------ cookie e sessão

export function lerCookie(cabecalho, nome = NOME_DO_COOKIE) {
  for (const parte of String(cabecalho ?? '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return null;
}
export function montarCookie(token, { seguro = false, maxAgeMs = DURACAO_DA_SESSAO_MS } = {}) {
  return `${NOME_DO_COOKIE}=${encodeURIComponent(token)}; Path=/api/mapas; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}${seguro ? '; Secure' : ''}`;
}

/** O controle de acesso com as dependências do banco injetadas (testes usam falsas). */
export function criarAcesso({ config = configuracao(), deps, agora = () => Date.now() } = {}) {
  const sessoes = new Map(); // token -> { email, expira }
  const falhas = new Map(); // ip -> { n, desde }

  const sessaoDe = (token) => {
    const s = token ? sessoes.get(token) : null;
    if (!s) return null;
    if (s.expira <= agora()) { sessoes.delete(token); return null; }
    return s;
  };
  const bloqueado = (ip) => {
    const f = falhas.get(ip);
    if (!f) return false;
    if (agora() - f.desde > TENTATIVAS.janelaMs) { falhas.delete(ip); return false; }
    return f.n >= TENTATIVAS.max;
  };
  const falhou = (ip) => {
    const f = falhas.get(ip);
    falhas.set(ip, f && agora() - f.desde <= TENTATIVAS.janelaMs ? { n: f.n + 1, desde: f.desde } : { n: 1, desde: agora() });
  };

  return {
    config,
    sessaoDe,
    /** Entra com e-mail e senha da conta do jogo. Só administrador recebe sessão. */
    async entrar({ email, senha, ip = 'desconhecido' }) {
      if (bloqueado(ip)) return { ok: false, status: 429, erro: 'Muitas tentativas. Aguarde alguns minutos.' };
      const mail = normalizarEmail(email);
      const conta = mail ? await deps.contaPorEmail(mail) : null;
      const certa = conta ? await deps.conferirSenha(senha, conta.senha) : false;
      if (!conta || !certa) { falhou(ip); return { ok: false, status: 401, erro: 'E-mail ou senha incorretos.' }; }
      if (!ehAdmin(config, conta.email)) { falhou(ip); return { ok: false, status: 403, erro: 'Esta conta não é administradora da Engine.' }; }
      falhas.delete(ip);
      const token = randomBytes(24).toString('hex');
      sessoes.set(token, { email: normalizarEmail(conta.email), expira: agora() + DURACAO_DA_SESSAO_MS });
      return { ok: true, token, email: normalizarEmail(conta.email) };
    },
    sair(token) { sessoes.delete(token); },
    /** A página da Engine exige ir ao login? (o servidor exige login e o cookie não é de um administrador com sessão válida) */
    precisaDeLogin(cookieHeader) {
      if (!config.exigeLogin) return false;
      const s = sessaoDe(lerCookie(cookieHeader));
      return !(s && ehAdmin(config, s.email));
    },
    quem(token) {
      const s = sessaoDe(token);
      return { logado: !!s, email: s?.email ?? null, admin: !!s && ehAdmin(config, s.email), config: { producao: config.producao, exigeLogin: config.exigeLogin, grava: config.grava } };
    },
    /** Decide uma requisição já com o cookie lido. */
    autorizar({ metodo, caminho, cookie, origem, host, encaminhado = null }) {
      return decidir({ config, metodo, caminho, sessao: sessaoDe(lerCookie(cookie)), origem, host, encaminhado });
    },
  };
}
