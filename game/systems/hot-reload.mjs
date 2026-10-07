// HOT RELOAD DE CONTEÚDO (só no ambiente local de desenvolvimento): quando a Engine grava um arquivo do jogo, o servidor percebe, valida, recarrega SÓ o
// recurso afetado, avisa os clientes conectados e mantém um histórico. Não é um sistema paralelo: usa as camadas de overrides que já existem
// (`Overrides.reaplicar*`), o registro de atos do `campanha.mjs` e o canal de mensagens do WebSocket (`avisos-globais.transmitir`).
//
// COMO FUNCIONA
//   1. Entradas: o evento EXPLÍCITO de salvamento da Engine (`aposGravacao`, o caminho principal) e o monitoramento de arquivos (`fs.watch`, complemento:
//      pega edição manual, `git pull`, outro editor). As duas viram `mudou(caminho)`.
//   2. `classificar(caminho)` decide: ignorar (temporários, backups, `_versoes`…), recarregar a QUENTE (monstros, itens, sprites, atos, campanha) ou
//      avisar que é preciso REINICIAR (hunts, mapas, habilidades, gemas, catálogos originais…).
//   3. Debounce (vários salvamentos seguidos = uma recarga); uma FILA serial (nunca duas recargas ao mesmo tempo); e a assinatura do conteúdo: arquivo
//      que não mudou de verdade (o evento explícito + o do `fs.watch` do mesmo salvamento) não recarrega duas vezes.
//   4. Cada estratégia é TRANSACIONAL: valida tudo antes de tocar no jogo. Se algo for inválido, nada muda — fica a última versão válida — e o erro vai
//      para o histórico e para a Engine. Consertou o arquivo, salvou de novo: recarrega.
//   5. Sucesso: `notificar({ t: 'contentUpdate', tipo, ids, revisao, ... })` para os jogadores (o cliente troca só o recurso afetado).
//
// ISOLAMENTO: `podeAtivar` desliga tudo em produção, com `HOT_RELOAD=0`, ou se o banco for compartilhado/remoto. Nada aqui faz commit, deploy ou toca na VPS.
import { createHash } from 'node:crypto';
import { watch, existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

export const ORDEM_DE_RECARGA = ['progressao', 'itens', 'classes', 'conjuntos', 'item-power', 'monstros', 'sprites', 'sprites-itens', 'campanha', 'atos'];
export const ROTULOS = { classes: 'Classes e atributos', 'sprites-itens': 'Sprites de itens', 'item-power': 'Item Power', conjuntos: 'Conjuntos', progressao: 'Progressão e loot', monstros: 'Monstros', itens: 'Itens', sprites: 'Sprites', atos: 'Acts', campanha: 'Campanha (níveis)' };
const IGNORAR_NOME = /(^\.|~$|\.(tmp|temp|bak|swp|swx|orig|rej|lock|part|crdownload)$|^\.#|^#.*#$|^4913$|\.jsonl$|\.md$)/;
const IGNORAR_PASTA = new Set(['_versoes', 'node_modules', '.git', 'hunts-imagens']);
const MS_DO_ATUALIZADO = 4000;

// O que NÃO dá para recarregar com segurança em tempo real (e por quê).
const MOTIVO_DO_ESTADO_DO_JOGADOR = 'O estado dos personagens (recargas, gemas equipadas, passivas, instâncias em andamento) depende do catálogo carregado no boot: trocar o catálogo com gente jogando poderia corromper esse estado.';
const REINICIO = [
  [/^hunts\//, 'hunts', 'Hunts e mapas', 'As grades de spawn são aquecidas no boot e há instâncias de hunt em andamento.'],
  [/^(encontros\/|encontros\.json$|bosses-unicos\.json$|campanha-conteudo\.json$)/, 'encontros', 'Encontros e bosses únicos', 'São lidos no boot (conteúdo secreto do servidor) e ligados às fases e à campanha.'],
  [/^(skills\/|gemas\/|gemas\.json$|action-catalog|combate\/|passivas\/|arvore\/|armas\/|classes\.json$|charms\.json$)/, 'habilidades', 'Habilidades, gemas e árvore', MOTIVO_DO_ESTADO_DO_JOGADOR],
  [/^(item-catalog\.json$|itens\/|craft-receitas\.json$|desmanche\.json$|store-real\.json$|equipamento-por-vocacao\.json$)/, 'catalogo-de-itens', 'Catálogo de itens original e lojas', 'O catálogo original é lido no boot; edite itens pelo editor de Itens (overrides), que recarrega a quente.'],
  [/^(catalog-real\.json$|mobs\/|monstro-poderes\.json$|boss-poderes\.json$|mounts-real\.json$)/, 'catalogo-original', 'Catálogo original (bestiário, bosses, montarias)', 'O bestiário original é lido no boot; edite monstros pelo editor de Mobs (overrides), que recarrega a quente.'],
  [/^(sprites\/(items|effects|missiles)\/|item-sprites\.json$|effect-sprites\.json$|missile-sprites\.json$|sprites\/city\.|sprites\/treino\.|city-|treino-)/, 'atlas', 'Atlas de itens, efeitos, projéteis e cenário', 'São atlas compilados em páginas: precisam ser reconstruídos e o navegador recarregado.'],
];

/**
 * Decide o que fazer com um arquivo alterado. `caminho` é relativo a `gamedata/` (qualquer separador). Devolve `null` (ignorar) ou
 * `{ tipo, quente: true, id? }` / `{ tipo, quente: false, rotulo, motivo }`.
 */
export function classificar(caminho) {
  const c = String(caminho ?? '').replace(/\\/g, '/').replace(/^\.?\//, '');
  if (!c) return null;
  const partes = c.split('/');
  const nome = partes.at(-1);
  if (partes.some((p) => IGNORAR_PASTA.has(p)) || IGNORAR_NOME.test(nome)) return null;
  if (c === 'engine.json' || c === 'modo-beta.json' || c === 'novidades.json') return null; // estado/config de operação, não conteúdo
  if (c === 'overrides/monstros.json') return { tipo: 'monstros', quente: true };
  if (c === 'overrides/itens.json') return { tipo: 'itens', quente: true };
  if (c === 'overrides/progressao.json') return { tipo: 'progressao', quente: true };
  if (c === 'overrides/conjuntos.json') return { tipo: 'conjuntos', quente: true };
  if (c === 'overrides/item-power.json') return { tipo: 'item-power', quente: true };
  if (c === 'overrides/classes.json') return { tipo: 'classes', quente: true };
  if (c === 'overrides/sprites.json') return { tipo: 'sprites', quente: true };
  if (c === 'overrides/itens-sprites.json' || /^overrides\/sprites\/itens\/\d+\.png$/.test(c)) return { tipo: 'sprites-itens', quente: true };
  let m = /^overrides\/sprites\/(\d+)\.png$/.exec(c);
  if (m) return { tipo: 'sprites', quente: true, id: m[1] };
  m = /^sprites\/outfits\/(\d+)\.png$/.exec(c);
  if (m) return { tipo: 'sprites', quente: true, id: m[1], original: true };
  if (c === 'outfits.json') return { tipo: 'sprites', quente: true, indice: true };
  if (c === 'campanha.json') return { tipo: 'campanha', quente: true };
  m = /^atos\/([^/]+)\.json$/.exec(c);
  if (m) return { tipo: 'atos', quente: true, id: m[1] };
  if (c.startsWith('overrides/')) return null; // outro arquivo de overrides que ninguém lê
  if (c.startsWith('sprites/hunts/')) return null; // fundos de mapa servidos como estático (sem cache a invalidar)
  for (const [padrao, tipo, rotulo, motivo] of REINICIO) if (padrao.test(c)) return { tipo, quente: false, rotulo, motivo };
  if (/\.(json|png)$/.test(nome)) return { tipo: 'outros', quente: false, rotulo: 'Dados do jogo', motivo: `${c} é lido no boot do servidor.` };
  return null;
}

/** Pode ligar? Só em desenvolvimento local, nunca em produção nem com banco/serviço compartilhado. Pura. */
export function podeAtivar({ producao = false, env = {} } = {}) {
  if (producao) return { ativo: false, motivo: 'ambiente de produção: o Hot Reload nunca roda em produção.' };
  if (env.HOT_RELOAD === '0' || env.HOT_RELOAD === 'false') return { ativo: false, motivo: 'desligado por HOT_RELOAD=0.' };
  if (env.ENGINE_MODO === 'producao') return { ativo: false, motivo: 'ENGINE_MODO=producao.' };
  if (env.DATABASE_URL) {
    let host = '';
    try { host = new URL(env.DATABASE_URL).hostname; } catch { host = env.DATABASE_URL; }
    if (!['localhost', '127.0.0.1', '::1', '[::1]', '', 'postgres'].includes(host)) return { ativo: false, motivo: `o banco (${host}) é compartilhado/remoto: o Hot Reload não mexe em conteúdo de ambiente compartilhado.` };
  }
  return { ativo: true, motivo: null };
}

/** Uma assinatura curta do conteúdo de uma lista de arquivos (ausente conta como ausente). */
export function assinaturaDe(arquivos) {
  const h = createHash('sha1');
  for (const a of [...arquivos].sort()) {
    h.update(`${a}\0`);
    try { h.update(readFileSync(a)); } catch { h.update('ausente'); }
    h.update('\0');
  }
  return h.digest('hex').slice(0, 16);
}

/**
 * O núcleo. `estrategias[tipo] = { assinatura(info) → string, aplicar(info) → { ids, resumo, payload? } | { reinicio: motivo } }` (assíncronas ou não).
 * `info` = `{ caminhos: [relativos], ids: [..], forcar }`.
 */
export function criarHotReload({ estrategias, notificar = () => {}, ativo = true, motivoInativo = null, agora = Date.now, debounceMs = 250, tentativaMs = 350, log = console.log, historicoMax = 60 } = {}) {
  const S = { estado: ativo ? 'ativo' : 'desativado', mensagem: ativo ? 'Hot Reload ativo.' : `Hot Reload desligado: ${motivoInativo ?? '—'}`, desde: agora(), revisao: 0, historico: [], pendentes: new Map(), erros: new Map(), reinicio: new Map(), assinaturas: new Map(), timer: null, fila: Promise.resolve(), vigias: [], processando: false };
  const hora = () => new Date(agora()).toISOString().slice(11, 19);
  const guardar = (e) => {
    const entrada = { quando: agora(), ...e };
    S.historico.unshift(entrada);
    if (S.historico.length > historicoMax) S.historico.length = historicoMax;
    log(`[hot-reload] ${hora()} ${e.tipo}${e.ids?.length ? ` [${e.ids.slice(0, 6).join(', ')}${e.ids.length > 6 ? '…' : ''}]` : ''} → ${e.resultado}${e.ms != null ? ` (${e.ms}ms)` : ''}: ${e.mensagem}`);
    return entrada;
  };
  const marcar = (estado, mensagem) => { S.estado = estado; S.mensagem = mensagem; S.desde = agora(); };

  /** Alguma coisa mudou (caminho relativo a `gamedata/`). `origem`: 'engine' | 'arquivo' | 'manual'. */
  function mudou(caminho, origem = 'arquivo') {
    if (!ativo) return null;
    const c = classificar(caminho);
    if (!c) return null;
    if (!c.quente) {
      const chave = c.tipo;
      if (!S.reinicio.has(chave)) { S.reinicio.set(chave, { tipo: chave, rotulo: c.rotulo, motivo: c.motivo, caminho, desde: agora() }); guardar({ tipo: chave, resultado: 'reinicio', origem, mensagem: `${c.rotulo}: este recurso exige reinicializar o servidor. ${c.motivo}` }); }
      else S.reinicio.get(chave).caminho = caminho;
      if (!S.processando && S.pendentes.size === 0) marcar('reinicio', `${c.rotulo}: este recurso exige reinicialização do servidor.`);
      return c;
    }
    const p = S.pendentes.get(c.tipo) ?? { caminhos: new Set(), ids: new Set(), origem };
    p.caminhos.add(String(caminho).replace(/\\/g, '/'));
    if (c.id) p.ids.add(c.id);
    if (origem === 'engine') p.origem = 'engine';
    S.pendentes.set(c.tipo, p);
    marcar('pendente', 'Alteração salva, aguardando recarga.');
    clearTimeout(S.timer);
    S.timer = setTimeout(() => { processar(); }, debounceMs);
    return c;
  }

  /** Roda a fila agora (o debounce chama isto). Serial: nunca duas recargas ao mesmo tempo. Devolve uma promessa do fim da fila. */
  function processar() {
    clearTimeout(S.timer);
    S.fila = S.fila.then(async () => {
      while (S.pendentes.size) {
        const tipo = ORDEM_DE_RECARGA.find((t) => S.pendentes.has(t)) ?? [...S.pendentes.keys()][0];
        const info = S.pendentes.get(tipo);
        S.pendentes.delete(tipo);
        await executar(tipo, { caminhos: [...info.caminhos], ids: [...info.ids], origem: info.origem, forcar: !!info.forcar });
        await new Promise((r) => setImmediate(r)); // não monopoliza o laço do jogo entre uma recarga e outra
      }
      posFila();
    }).catch((e) => log(`[hot-reload] falha inesperada na fila: ${e.message}`));
    return S.fila;
  }
  function posFila() {
    if (S.pendentes.size) return;
    if (S.erros.size) { const [t, e] = [...S.erros][0]; marcar('erro', `${ROTULOS[t] ?? t}: ${e.mensagem}`); }
    else if (S.reinicio.size) { const r = [...S.reinicio.values()][0]; marcar('reinicio', `${r.rotulo}: este recurso exige reinicialização do servidor.`); }
  }

  async function executar(tipo, info) {
    const est = estrategias[tipo];
    if (!est) return;
    S.processando = true;
    marcar('recarregando', `Recarregando ${ROTULOS[tipo] ?? tipo}…`);
    const t0 = Date.now();
    try {
      const assinatura = await est.assinatura?.(info);
      if (!info.forcar && assinatura != null && S.assinaturas.get(tipo) === assinatura) {
        guardar({ tipo, ids: info.ids, resultado: 'sem-mudanca', origem: info.origem, mensagem: 'Conteúdo igual ao já carregado: nada a recarregar.', ms: Date.now() - t0 });
        marcar('atualizado', `${ROTULOS[tipo] ?? tipo}: já estava atualizado.`);
        return;
      }
      let r;
      try { r = await est.aplicar(info); } catch (primeiro) {
        // Um salvamento ainda em andamento pode entregar o arquivo pela metade (o `fs.watch` avisa no meio da escrita): uma segunda tentativa, logo depois, resolve.
        if (info.origem === 'manual') throw primeiro;
        await new Promise((ok) => setTimeout(ok, tentativaMs));
        r = await est.aplicar(info);
      }
      if (r?.reinicio) {
        S.reinicio.set(tipo, { tipo, rotulo: ROTULOS[tipo] ?? tipo, motivo: r.reinicio, desde: agora() });
        guardar({ tipo, ids: info.ids, resultado: 'reinicio', origem: info.origem, mensagem: r.reinicio, ms: Date.now() - t0 });
        marcar('reinicio', `${ROTULOS[tipo] ?? tipo}: este recurso exige reinicialização do servidor.`);
        return;
      }
      if (assinatura != null) S.assinaturas.set(tipo, assinatura);
      S.erros.delete(tipo);
      S.reinicio.delete(tipo);
      S.revisao++;
      const ids = r?.ids ?? info.ids;
      const envio = { t: 'contentUpdate', tipo, ids, revisao: S.revisao, em: agora(), ...(r?.payload ?? {}) };
      let n = 0;
      try { n = notificar(envio) ?? 0; } catch (e) { log(`[hot-reload] a notificação dos clientes falhou: ${e.message}`); }
      guardar({ tipo, ids, resultado: 'ok', origem: info.origem, mensagem: `${r?.resumo ?? 'atualizado'}${n ? ` · ${n} cliente(s) avisado(s)` : ''}`, ms: Date.now() - t0, revisao: S.revisao });
      marcar('atualizado', `${ROTULOS[tipo] ?? tipo} atualizado${r?.resumo ? `: ${r.resumo}` : ''}.`);
    } catch (e) {
      S.erros.set(tipo, { mensagem: e.message, quando: agora() });
      guardar({ tipo, ids: info.ids, resultado: 'erro', origem: info.origem, mensagem: `${e.message} Segue a última versão válida; corrija o arquivo e salve de novo.`, ms: Date.now() - t0 });
      marcar('erro', `${ROTULOS[tipo] ?? tipo}: ${e.message}`);
    } finally {
      S.processando = false;
    }
  }

  /** O evento EXPLÍCITO de salvamento da Engine: `rota` relativa a `/api/mapas/_conteudo/`, `corpo` = o que foi enviado. */
  function aposGravacao(rota, corpo = null) {
    if (!ativo) return [];
    const caminhos = caminhosDaRota(rota, corpo);
    for (const c of caminhos) mudou(c, 'engine');
    return caminhos;
  }

  /** Recarga MANUAL de um recurso (botão da Engine): ignora a assinatura (recarrega mesmo sem mudança). */
  function recarregar(tipo, id = null) {
    if (!ativo) return Promise.resolve({ ok: false, erro: `Hot Reload desligado: ${motivoInativo}` });
    if (!estrategias[tipo]) return Promise.resolve({ ok: false, erro: `Recurso desconhecido: ${tipo}. Os que recarregam a quente: ${Object.keys(estrategias).join(', ')}.` });
    const p = S.pendentes.get(tipo) ?? { caminhos: new Set(), ids: new Set(), origem: 'manual' };
    if (id) p.ids.add(String(id));
    p.forcar = true;
    p.origem = 'manual';
    S.pendentes.set(tipo, p);
    marcar('pendente', 'Alteração salva, aguardando recarga.');
    return processar().then(() => ({ ok: !S.erros.has(tipo), erro: S.erros.get(tipo)?.mensagem ?? null, estado: S.estado }));
  }

  /** Liga o monitoramento de arquivos: `dirs` = `[{ dir, recursivo }]`, relativos a `raiz`. Devolve a função que desliga. */
  function vigiar(raiz, dirs, { observar = watch } = {}) {
    if (!ativo) return () => {};
    for (const { dir, recursivo = false, absoluto = false, prefixo = dir } of dirs) {
      const abs = absoluto ? dir : join(raiz, dir);
      if (!existsSync(abs)) continue;
      try {
        const w = observar(abs, { recursive: recursivo, persistent: false }, (_tipo, nome) => { if (nome) mudou(join(prefixo, String(nome)), 'arquivo'); });
        w.on?.('error', () => {});
        S.vigias.push(w);
      } catch (e) { log(`[hot-reload] não consegui vigiar ${dir}: ${e.message}`); }
    }
    return parar;
  }
  function parar() { clearTimeout(S.timer); for (const w of S.vigias.splice(0)) { try { w.close(); } catch { /* já fechado */ } } }

  /** Guarda a assinatura do que JÁ está carregado (o boot), para a primeira recarga não refazer o que já está no ar. */
  async function semear() {
    for (const [tipo, est] of Object.entries(estrategias)) {
      try { const a = await est.assinatura?.({ caminhos: [], ids: [], forcar: false }); if (a != null) S.assinaturas.set(tipo, a); await est.semear?.(); } catch { /* sem semente: a primeira recarga roda */ }
    }
  }

  /** O estado para a Engine (e o indicador): código, mensagem, histórico, erros, reinício. */
  function estadoAtual() {
    let { estado, mensagem } = S;
    if (estado === 'atualizado' && agora() - S.desde > MS_DO_ATUALIZADO) { estado = S.erros.size ? 'erro' : S.reinicio.size ? 'reinicio' : 'ativo'; mensagem = estado === 'ativo' ? 'Hot Reload ativo.' : S.mensagem; }
    return {
      ativo, motivoInativo, estado, mensagem, desde: S.desde, revisao: S.revisao,
      pendentes: [...S.pendentes.keys()],
      erros: [...S.erros].map(([tipo, e]) => ({ tipo, rotulo: ROTULOS[tipo] ?? tipo, ...e })),
      reinicio: [...S.reinicio.values()],
      recarregaveis: Object.keys(estrategias).map((tipo) => ({ tipo, rotulo: ROTULOS[tipo] ?? tipo })),
      historico: S.historico.slice(0, 40),
    };
  }
  return { mudou, aposGravacao, processar, recarregar, vigiar, parar, semear, estadoAtual, _S: S };
}

/** Os arquivos (relativos a `gamedata/`) que uma gravação da Engine toca, a partir da rota e do corpo. Pura. */
export function caminhosDaRota(rota, corpo = null) {
  const r = String(rota ?? '').replace(/^\/?api\/mapas\/_conteudo\//, '').replace(/^\//, '').split('?')[0];
  if (r === 'overrides') return ['overrides/monstros.json'];
  if (r === 'overrides/itens') return ['overrides/itens.json'];
  if (r === 'progressao') return ['overrides/progressao.json'];
  if (r === 'conjuntos') return ['overrides/conjuntos.json'];
  if (r === 'item-power') return ['overrides/item-power.json'];
  if (r === 'classes') return ['overrides/classes.json'];
  if (r === 'item-power/edicao') return ['overrides/itens.json'];
  if (r === 'sprites-itens') return ['overrides/itens-sprites.json', ...(corpo?.id && /^\d+$/.test(String(corpo.id)) ? [`overrides/sprites/itens/${corpo.id}.png`] : [])];
  if (r === 'overrides/sprites') return ['overrides/sprites.json', ...(corpo?.look && /^\d+$/.test(String(corpo.look)) ? [`overrides/sprites/${corpo.look}.png`] : [])];
  if (r.startsWith('campanha')) return ['campanha.json'];
  const ato = /^atos-editor(?:\/([a-z0-9-]+))?/.exec(r);
  if (ato) { const id = ato[1] ?? corpo?.id; return id && /^[a-z0-9-]+$/.test(String(id)) ? [`atos/${id}.json`] : []; }
  if (/^fase\/.+\/(encontros|meta)$/.test(r)) return ['encontros.json'];
  if (r.startsWith('bosses')) return ['bosses-unicos.json'];
  if (r.startsWith('hunts') || r.startsWith('mapa')) return ['hunts/mapa.json'];
  return [];
}

/** Os diretórios que o monitoramento vigia por padrão (relativos a `gamedata/`). Pequenos e rasos: nada de vigiar as pastas de multi-MB. */
export const DIRETORIOS_VIGIADOS = [
  { dir: 'overrides', recursivo: true },
  { dir: 'atos' }, { dir: '.' }, { dir: 'sprites/outfits' }, { dir: 'sprites' },
  { dir: 'hunts' }, { dir: 'encontros' }, { dir: 'mobs' }, { dir: 'skills' }, { dir: 'gemas' }, { dir: 'itens' }, { dir: 'combate' }, { dir: 'passivas' }, { dir: 'arvore' }, { dir: 'armas' },
];
export { readdirSync, statSync };
