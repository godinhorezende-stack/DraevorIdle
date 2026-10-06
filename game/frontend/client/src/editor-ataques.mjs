// ATAQUES E EFEITOS dos mobs na Engine (sistema de itens do PoE — só com ITENS_POE=1): o golpe básico e as habilidades de cada monstro, editáveis
// (elemento, forma, raio, comprimento, ritmo, efeito na tela, projétil, força; ligar/desligar; criar habilidade nova) e uma ARENA que mostra o ataque
// com o MESMO desenho do jogo (`sprites.mjs`: a criatura, os efeitos e os projéteis do Tibia). A biblioteca de efeitos mostra todos os ids, animados.
// O servidor valida e grava (`itens-poe/habilidades.validarAjuste` → gamedata/itens-poe/campanha-ajustes.json) e o jogo usa na hora.
import { el, msg, cabecalho } from './editor-ui.mjs';
import { jogo } from './editor-sprites.mjs';
import { escolherSprite } from './editor-biblioteca-sprites.mjs';

const BASE = '/api/mapas/_engine/itens-poe/';
const api = async (rota, corpo) => (await fetch(BASE + rota, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) } : {})).json();
const COR = { physical: '#c9ced8', fire: '#ff8a4c', ice: '#86d6ff', energy: '#c79bff', chaos: '#93c95a' };
const NOME_EL = { physical: 'físico', fire: 'fogo', ice: 'gelo', energy: 'raio', chaos: 'caos' };
const NOME_FORMA = { alvo: 'no alvo', area: 'em área', feixe: 'em feixe' };
const T = 32;

// ---------------------------------------------------------------- o renderer do jogo + os índices de efeitos e projéteis
let pronto = null;
let INDICE = { efeitos: [], tiros: [] };
async function renderer() {
  pronto ??= (async () => {
    const S = await jogo();
    if (S?.loadEffectData) await S.loadEffectData().catch(() => {});
    const [e, m] = await Promise.all([fetch('/gamedata/effect-sprites.json').then((r) => r.json()).catch(() => ({})), fetch('/gamedata/missile-sprites.json').then((r) => r.json()).catch(() => ({}))]);
    INDICE = { efeitos: Object.keys(e).map(Number).sort((a, b) => a - b), tiros: Object.keys(m).map(Number).sort((a, b) => a - b) };
    return S;
  })();
  return pronto;
}

/** Um laço de animação por canvas: para sozinho quando o canvas sai da tela. */
function animar(canvas, desenhar) {
  let t0 = null;
  const passo = (t) => {
    if (!canvas.isConnected) return;
    t0 ??= t;
    desenhar(t - t0);
    requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

// ---------------------------------------------------------------- miniatura de um efeito / projétil (animada)
export function miniatura(tipo, id, tam = 48) {
  const c = el('canvas', { width: 64, height: 64, class: 'atq-mini', style: `width:${tam}px;height:${tam}px` });
  renderer().then((S) => {
    if (!S) return;
    animar(c, (t) => {
      const g = c.getContext('2d');
      g.clearRect(0, 0, 64, 64);
      if (tipo === 'tiro') {
        const fase = (t % 1200) / 1200;
        S.drawMissile(g, id, 8 + fase * 48, 32, 1, 0);
      } else {
        const dur = S.effectDuration(id) || 600;
        S.drawEffect(g, id, 16, 16, ((t % (dur + 250)) / dur));
      }
    });
  });
  return c;
}

/**
 * O SELETOR de efeito ou de projétil: o atual (animado) e, ao clicar, a grade com todos (animados) para escolher. `padrao`: o id que vale quando
 * nada é escolhido (o efeito do elemento); `aoEscolher(id|null)`.
 */
export function seletorDeEfeito({ tipo = 'efeito', valor = null, padrao = null, aoEscolher, desligado = false }) {
  const caixa = el('div', { class: 'atq-seletor' });
  const pintar = (aberto = false) => {
    const atual = valor ?? padrao;
    caixa.replaceChildren(
      el('button', { type: 'button', class: 'atq-atual', disabled: desligado, title: tipo === 'tiro' ? 'Projétil (do bicho até o alvo)' : 'Efeito na tela', onclick: () => pintar(!aberto) },
        atual ? miniatura(tipo, atual, 40) : el('span', { class: 'atq-sem' }, 'nenhum'),
        el('span', {}, atual ? `#${atual}${valor == null && padrao ? ' (padrão)' : ''}` : tipo === 'tiro' ? 'sem projétil' : '—')),
      aberto ? el('div', { class: 'atq-grade' },
        el('button', { type: 'button', class: 'atq-opcao', onclick: () => { valor = null; aoEscolher(null); pintar(false); } }, el('span', { class: 'atq-sem' }, tipo === 'tiro' ? 'sem' : 'padrão'), el('small', {}, tipo === 'tiro' ? 'sem projétil' : 'do elemento')),
        el('button', { type: 'button', class: 'atq-opcao', title: 'Buscar por nome ou etiqueta na Biblioteca de sprites', onclick: async () => { pintar(false); const x = await escolherSprite({ tipo: tipo === 'tiro' ? 'tiros' : 'efeitos' }); if (x) { valor = Number(x.id); aoEscolher(valor); pintar(false); } } }, el('span', { class: 'atq-sem' }, '🔎'), el('small', {}, 'biblioteca')),
        (tipo === 'tiro' ? INDICE.tiros : INDICE.efeitos).map((id) => el('button', { type: 'button', class: `atq-opcao${id === valor ? ' ativa' : ''}`, onclick: () => { valor = id; aoEscolher(id); pintar(false); } }, miniatura(tipo, id, 40), el('small', {}, `#${id}`)))) : null);
  };
  renderer().then(() => pintar(false));
  pintar(false);
  return caixa;
}

// ---------------------------------------------------------------- a ARENA: o monstro ataca o "jogador", um ataque de cada vez
/** As casas que o ataque pega (a mesma ideia da geometria do jogo: alvo, área em volta de alguém, feixe em linha). */
function casasDo(a, mob, alvo) {
  if (a.basico || (a.tipo !== 'area' && (a.forma === 'alvo' || !a.forma))) return [alvo];
  if (a.forma === 'feixe') return Array.from({ length: Math.max(1, a.comprimento || 5) }, (_, i) => ({ x: mob.x + 1 + i, y: mob.y }));
  const centro = a.tipo === 'area' || a.noAlvo ? alvo : mob;
  const r = Math.max(1, a.raio || 1);
  const l = [];
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (Math.hypot(dx, dy) <= r + 0.5 && !(centro === mob && dx === 0 && dy === 0)) l.push({ x: centro.x + dx, y: centro.y + dy });
  return l;
}

/**
 * A arena: `info` = `{ desenho, basico, habilidades }` (o que `mobs/ataques` devolve, ou o rascunho da tela). Toca os ataques em sequência (ou só o
 * escolhido) com o desenho do jogo. Devolve `{ elemento, tocar(indice|null) }`.
 */
export function arena(info) {
  const W = 13;
  const H = 7;
  const canvas = el('canvas', { width: W * T, height: H * T, class: 'atq-arena' });
  const legenda = el('div', { class: 'atq-legenda' });
  const mob = { x: 3, y: 3 };
  const alvo = { x: 9, y: 3 };
  let lista = [];
  let so = null;
  const montar = () => {
    lista = [{ basico: true, nome: 'Golpe básico (corpo a corpo)', elemento: 'physical', efeito: info.basico?.efeitoNaTela ?? 1, min: Math.round((info.basico?.dano ?? 0) * 0.8), max: Math.round((info.basico?.dano ?? 0) * 1.2), duracao: 900 },
      ...(info.habilidades ?? []).filter((h) => h.tipo !== 'invocar' && h.ativo !== false).map((h) => ({ ...h, efeito: h.efeitoNaTela ?? h.efeito, duracao: (h.tiro ? 450 : 0) + (h.tipo === 'area' ? h.avisoMs ?? 1200 : 0) + 1100 }))];
  };
  montar();
  const tocar = (i) => { so = i; t0 = null; };
  let t0 = null;
  renderer().then((S) => {
    if (!S) return legenda.replaceChildren('Sem os sprites do jogo.');
    animar(canvas, (agora) => {
      t0 ??= agora;
      const g = canvas.getContext('2d');
      g.imageSmoothingEnabled = false;
      for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { g.fillStyle = (x + y) % 2 ? '#1c222c' : '#202733'; g.fillRect(x * T, y * T, T, T); }
      const seq = so == null ? lista : [lista[so]].filter(Boolean);
      if (!seq.length) return;
      const ciclo = seq.reduce((s, a) => s + a.duracao + 500, 0);
      let t = (agora - t0) % ciclo;
      let a = seq[0];
      for (const x of seq) { if (t < x.duracao + 500) { a = x; break; } t -= x.duracao + 500; }
      // As criaturas: o monstro (virado para o alvo) e o "jogador" (um cidadão).
      if (info.desenho?.look) S.drawCreature(g, { look: info.desenho.look, colors: info.desenho.cores ?? undefined, dir: 1, frame: Math.floor(agora / 180) % 2, walking: false }, mob.x * T, mob.y * T);
      S.drawCreature(g, { look: 128, colors: { head: 78, body: 69, legs: 58, feet: 76 }, dir: 3, frame: 0, walking: false }, alvo.x * T, alvo.y * T);
      const casas = casasDo(a, mob, alvo);
      const aviso = a.tipo === 'area' ? a.avisoMs ?? 1200 : 0;
      const voo = a.tiro ? 450 : 0;
      if (t < aviso) {
        g.fillStyle = 'rgba(255,80,60,0.28)';
        for (const c of casas) g.fillRect(c.x * T + 1, c.y * T + 1, T - 2, T - 2);
      } else if (t < aviso + voo) {
        const f = (t - aviso) / voo;
        S.drawMissile(g, a.tiro, (mob.x + 0.5 + (alvo.x - mob.x) * f) * T, (mob.y + 0.5) * T, Math.sign(alvo.x - mob.x), 0);
      } else if (a.efeito && t < a.duracao) {
        const dur = S.effectDuration(a.efeito) || 600;
        const p = (t - aviso - voo) / dur;
        if (p <= 1) for (const c of casas) S.drawEffect(g, a.efeito, c.x * T, c.y * T, p);
      }
      const forma = a.tipo === 'area' ? `área avisada (raio ${a.raio ?? 1})` : NOME_FORMA[a.forma] ?? '';
      const texto = `${a.nome} · ${NOME_EL[a.elemento] ?? a.elemento}${a.basico ? ' · corpo a corpo' : forma ? ` · ${forma}` : ''}${a.min ? ` · ${a.min}–${a.max}` : ''}`;
      if (legenda.dataset.t !== texto) { legenda.dataset.t = texto; legenda.replaceChildren(el('span', { class: 'atq-ponto', style: `background:${COR[a.elemento] ?? '#999'}` }), texto); }
    });
  });
  return { elemento: el('div', { class: 'atq-palco' }, canvas, legenda), tocar, atualizar: (novo) => { info = novo; montar(); t0 = null; } };
}

// ---------------------------------------------------------------- o EDITOR de ataques de um monstro
/** O editor (golpe básico + habilidades + novas) com a arena. `slug`: o monstro do PoE; `nivel`: a ocorrência (padrão: a primeira). */
export function editorDeAtaques(slug, { nivel = null, somenteLeitura = false } = {}) {
  const caixa = el('div', { class: 'atq-editor' }, el('span', { class: 'dica' }, 'Carregando os ataques…'));
  let D = null;
  let rascunho = null;
  let sujo = false;
  let palco = null;
  const carregar = async (n = nivel) => {
    D = await api(`mobs/ataques?${new URLSearchParams({ slug, ...(n ? { nivel: n } : {}) })}`);
    if (D.ok === false) return caixa.replaceChildren(el('p', { class: 'nao' }, D.erros?.[0] ?? 'Sem ataques.'));
    rascunho = structuredClone({ basico: D.ajuste.basico ?? {}, habilidades: D.ajuste.habilidades ?? {}, novas: D.ajuste.novas ?? [] });
    sujo = false;
    await renderer();
    pintar();
  };
  /** O que a arena mostra: o rascunho aplicado sobre as habilidades do PoE (a prévia é local; os números de dano exatos voltam do servidor ao salvar). */
  const previa = () => {
    const ef = (h) => h.efeito ?? D.efeitoPadrao[h.elemento] ?? 35;
    const habs = D.originais.map((h) => {
      const a = rascunho.habilidades[h.nome];
      if (!a) return h;
      const n = { ...h, ...Object.fromEntries(Object.entries(a).filter(([k, v]) => v != null && k !== 'fatorDano' && k !== 'ativo')) };
      if (a.fatorDano && h.min != null) Object.assign(n, { min: Math.round(h.min * a.fatorDano), max: Math.round(h.max * a.fatorDano) });
      return { ...n, ativo: a.ativo !== false, efeitoNaTela: ef(n) };
    });
    const novas = rascunho.novas.map((x) => ({ tipo: 'magia', ...x, min: Math.round(D.basico.dano * (x.pctDoGolpe ?? 100) / 100 * 0.8), max: Math.round(D.basico.dano * (x.pctDoGolpe ?? 100) / 100 * 1.2), efeitoNaTela: ef(x), nova: true }));
    return { desenho: D.desenho, basico: { ...D.basico, efeitoNaTela: rascunho.basico.efeito ?? 1 }, habilidades: [...habs, ...novas] };
  };
  const mudou = () => { sujo = true; palco?.atualizar(previa()); pintarBarra(); };
  const barra = el('div', { class: 'linha atq-barra' });
  const pintarBarra = () => barra.replaceChildren(
    somenteLeitura ? null : el('button', { type: 'button', class: sujo ? 'primario' : '', disabled: !sujo, onclick: salvar }, sujo ? 'Salvar ataques' : 'Ataques salvos'),
    somenteLeitura || !sujo ? null : el('button', { type: 'button', onclick: () => carregar(D.nivel) }, 'Desfazer'),
    somenteLeitura ? null : el('button', { type: 'button', class: 'perigo', onclick: restaurar, disabled: !Object.keys(D.ajuste ?? {}).length }, 'Voltar ao do PoE'),
    el('span', { class: 'dica' }, 'Vale na hora (próximo combate). O dano segue o do PoE em cada nível de área (× a força).'));
  async function salvar() {
    const r = await api('mobs/ataques', { slug, ajuste: rascunho, nivel: D.nivel });
    if (!r.ok) return msg(r.erros?.slice(0, 3).join(' ') ?? 'Não salvou.', 'erro');
    msg('Ataques e efeitos salvos (valem no próximo combate).', 'ok');
    await carregar(D.nivel);
  }
  async function restaurar() {
    const r = await api('mobs/ataques', { slug, ajuste: {}, nivel: D.nivel });
    if (!r.ok) return msg(r.erros?.[0] ?? 'Não deu.', 'erro');
    msg('Ataques de volta aos do PoE.', 'ok');
    await carregar(D.nivel);
  }
  const campoNum = (rot, valor, aoMudar, props = {}) => el('label', { class: 'campo atq-num' }, rot, el('input', { type: 'number', value: valor ?? '', disabled: somenteLeitura, ...props, onchange: (e) => aoMudar(e.target.value === '' ? null : Number(e.target.value)) }));
  const campoSel = (rot, valor, opcoes, aoMudar) => el('label', { class: 'campo atq-num' }, rot, el('select', { disabled: somenteLeitura, onchange: (e) => aoMudar(e.target.value) }, opcoes.map(([v, n]) => el('option', { value: v, selected: v === valor }, n))));
  function linhaDaHabilidade(h, i, ehNova) {
    const a = ehNova ? rascunho.novas[i] : (rascunho.habilidades[h.nome] ??= {});
    const val = (k) => a[k] ?? h[k];
    const set = (k, v) => { if (v == null || (!ehNova && v === h[k])) delete a[k]; else a[k] = v; if (!ehNova && !Object.keys(a).length) delete rascunho.habilidades[h.nome]; mudou(); };
    const invocar = h.tipo === 'invocar';
    const ativo = ehNova || a.ativo !== false;
    return el('div', { class: `atq-hab${ativo ? '' : ' desligada'}` },
      el('div', { class: 'linha' },
        ehNova ? el('input', { value: a.nome ?? '', disabled: somenteLeitura, style: 'flex:1;min-width:0', onchange: (e) => { a.nome = e.target.value; mudou(); } }) : el('b', { style: 'flex:1' }, h.nome),
        el('span', { class: 'selo' }, invocar ? 'invocação' : h.tipo === 'area' ? 'área avisada' : 'magia'), ehNova ? el('span', { class: 'selo usos' }, 'nova') : null,
        !ehNova && !somenteLeitura ? el('label', { class: 'marca' }, el('input', { type: 'checkbox', checked: ativo, onchange: (e) => { if (e.target.checked) delete a.ativo; else a.ativo = false; if (!Object.keys(a).length) delete rascunho.habilidades[h.nome]; mudou(); pintar(); } }), 'ligada') : null,
        el('button', { type: 'button', title: 'Ver só esta na arena', onclick: () => palco?.tocar(1 + previa().habilidades.filter((x) => x.tipo !== 'invocar' && x.ativo !== false).findIndex((x) => x.nome === (ehNova ? a.nome : h.nome))) }, '▶'),
        ehNova && !somenteLeitura ? el('button', { type: 'button', class: 'perigo', onclick: () => { rascunho.novas.splice(i, 1); mudou(); pintar(); } }, '✕') : null),
      invocar ? el('div', { class: 'dica' }, `Invoca os monstros da área a cada ${Math.round((h.intervaloMs ?? 0) / 1000)} s.`) : el('div', { class: 'atq-campos' },
        campoSel('Elemento', val('elemento'), D.elementos.map((e) => [e, NOME_EL[e] ?? e]), (v) => set('elemento', v)),
        campoSel('Forma', val('forma'), D.formas.map((f) => [f, NOME_FORMA[f]]), (v) => set('forma', v)),
        campoNum('Raio', val('raio'), (v) => set('raio', v), { min: 0, max: 8 }),
        campoNum('Comprimento', val('comprimento'), (v) => set('comprimento', v), { min: 0, max: 10 }),
        campoNum('A cada (ms)', val('intervaloMs'), (v) => set('intervaloMs', v), { min: 500, max: 60000, step: 100 }),
        ehNova ? campoNum('Força (% do golpe)', a.pctDoGolpe ?? 100, (v) => { a.pctDoGolpe = v ?? 100; mudou(); }, { min: 1, max: 1000 }) : campoNum('Força (×)', a.fatorDano ?? 1, (v) => set('fatorDano', v === 1 ? null : v), { min: 0.01, max: 10, step: 0.05 }),
        el('div', { class: 'campo' }, 'Efeito na tela', seletorDeEfeito({ tipo: 'efeito', valor: a.efeito ?? null, padrao: D.efeitoPadrao[val('elemento')] ?? 35, desligado: somenteLeitura, aoEscolher: (id) => set('efeito', id) })),
        el('div', { class: 'campo' }, 'Projétil', seletorDeEfeito({ tipo: 'tiro', valor: val('tiro') ?? null, desligado: somenteLeitura, aoEscolher: (id) => set('tiro', id) }))),
      !invocar && h.min != null ? el('div', { class: 'dica' }, `Dano no nível ${D.nivel}: ${h.min}–${h.max}${a.fatorDano ? ` → ${Math.round(h.min * a.fatorDano)}–${Math.round(h.max * a.fatorDano)}` : ''} · ${NOME_EL[val('elemento')] ?? ''} · ${NOME_FORMA[val('forma')] ?? ''}`) : null);
  }
  function pintar() {
    palco = arena(previa());
    caixa.replaceChildren(
      el('div', { class: 'linha', style: 'flex-wrap:wrap' },
        D.niveis.length > 1 ? el('label', { class: 'campo', style: 'flex:none' }, 'Ver no nível', el('select', { onchange: (e) => carregar(Number(e.target.value)) }, D.niveis.map((n) => el('option', { value: n, selected: n === D.nivel }, `nv ${n}`)))) : null,
        el('span', { class: 'dica' }, `${D.nome} — nível ${D.nivel}${D.area ? ` (${D.area})` : ''}${D.chefeDeAto ? ' · chefe de ato' : ''}`),
        el('button', { type: 'button', onclick: () => palco.tocar(null) }, '▶ Tocar todos')),
      palco.elemento,
      el('h5', {}, 'Golpe básico (corpo a corpo)'),
      el('div', { class: 'atq-hab' }, el('div', { class: 'linha' }, el('b', { style: 'flex:1' }, `Golpe ${Math.round(D.basico.dano * 0.8)}–${Math.round(D.basico.dano * 1.2)} a cada ${Number(D.basico.tempoAtaque).toFixed(2)} s`), el('button', { type: 'button', onclick: () => palco.tocar(0) }, '▶')),
        el('div', { class: 'atq-campos' }, el('div', { class: 'campo' }, 'Efeito ao acertar', seletorDeEfeito({ tipo: 'efeito', valor: rascunho.basico.efeito ?? null, padrao: 1, desligado: somenteLeitura, aoEscolher: (id) => { if (id == null) delete rascunho.basico.efeito; else rascunho.basico.efeito = id; mudou(); } })))),
      el('h5', {}, `Habilidades do PoE (${D.originais.length})`),
      D.originais.length ? el('div', { class: 'atq-habs' }, D.originais.map((h, i) => linhaDaHabilidade(h, i, false))) : el('p', { class: 'dica' }, 'Sem habilidades no poedb: só o golpe básico.'),
      el('h5', {}, `Habilidades novas (${rascunho.novas.length})`),
      el('div', { class: 'atq-habs' }, rascunho.novas.map((h, i) => linhaDaHabilidade(h, i, true))),
      somenteLeitura ? null : el('button', { type: 'button', onclick: () => { rascunho.novas.push({ nome: 'Habilidade nova', elemento: 'fire', forma: 'alvo', raio: 0, comprimento: 0, intervaloMs: 6000, pctDoGolpe: 120 }); mudou(); pintar(); } }, '+ Habilidade nova'),
      barra,
      D.doPoedb.length ? el('details', {}, el('summary', {}, `Como vieram do poedb (${D.doPoedb.length})`), el('ul', { class: 'atq-poedb' }, D.doPoedb.map((h) => el('li', {}, el('b', {}, h.nome ?? h.interno), h.dano ? ` — ${h.dano.min}–${h.dano.max}${h.elemento ? ` ${NOME_EL[h.elemento] ?? h.elemento}` : ''}` : '', h.descricao ? el('div', { class: 'dica' }, h.descricao) : null)))) : null);
    pintarBarra();
  }
  carregar();
  return caixa;
}

// ---------------------------------------------------------------- a BIBLIOTECA de efeitos e projéteis (todos os ids, animados)
export function criarTelaDeEfeitos({ raiz }) {
  const E = { tipo: 'efeito', busca: '' };
  async function desenhar() {
    raiz().replaceChildren(el('div', { class: 'dica' }, 'Carregando os efeitos…'));
    await renderer();
    pintar();
  }
  function pintar() {
    const ids = (E.tipo === 'tiro' ? INDICE.tiros : INDICE.efeitos).filter((id) => !E.busca || String(id).includes(E.busca));
    raiz().replaceChildren(
      cabecalho('Efeitos e projéteis', `Os ${INDICE.efeitos.length} efeitos e ${INDICE.tiros.length} projéteis do jogo, animados com o mesmo desenho do jogo. O número é o id que vai no ataque (aba Mobs → Ataques e efeitos).`),
      el('div', { class: 'linha' },
        el('div', { class: 'eng-abas' }, [['efeito', `Efeitos (${INDICE.efeitos.length})`], ['tiro', `Projéteis (${INDICE.tiros.length})`]].map(([id, n]) => el('button', { type: 'button', class: E.tipo === id ? 'ativa' : '', onclick: () => { E.tipo = id; pintar(); } }, n))),
        el('input', { type: 'search', placeholder: 'Buscar id…', value: E.busca, oninput: (e) => { E.busca = e.target.value.trim(); pintar(); } })),
      el('div', { class: 'atq-biblioteca' }, ids.map((id) => el('div', { class: 'atq-opcao', title: `${E.tipo === 'tiro' ? 'Projétil' : 'Efeito'} #${id}` }, miniatura(E.tipo, id, 64), el('b', {}, `#${id}`)))));
  }
  return { desenhar };
}
