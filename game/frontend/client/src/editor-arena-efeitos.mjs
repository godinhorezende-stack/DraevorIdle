// A ARENA DE EFEITOS da engine (dono, 06/10): o laboratório visual das skills, logo abaixo da Arena de Gemas.
//   - LANÇA a skill de verdade no servidor (`efeitos/simular`: o `Acoes.disparar` de uma caçada, com a gema, os suportes e o nível) em
//     1/3/5/10 bonecos na direção e distância escolhidas, e recebe os EVENTOS do combate;
//   - desenha esses eventos com a MESMA camada de efeitos do jogo (`efeitos-visuais.mjs`) e os mesmos sprites (`sprites.mjs`): o que se
//     vê aqui é o que o jogador vê. "Original" é o desenho de fábrica; "Customizado" é o visual em edição (prévia sem gravar);
//   - linha do tempo de cada evento visual (SKILL_CAST, PROJECTILE_CREATED, PROJECTILE_HIT, AREA_CREATED, DAMAGE_APPLIED), play/pausa/
//     reiniciar/avançar e velocidade 0,25×…8×;
//   - edita cada PARTE (lançamento, projétil, impacto, área, no alvo): sprite (efeito, projétil ou spritesheet da biblioteca), escala,
//     rotação, opacidade, deslocamento, atraso, duração, loop, espelhar, âncora, velocidade e rastro do projétil, som (guardado);
//   - presets (os de fábrica por elemento + os do dono), aplicar a outras skills, biblioteca de spritesheets (enviar PNG) e versões.
// Grava em `gamedata/overrides/efeitos.json` (o padrão dos overrides). Não mexe no dano: só no desenho.
import { el, msg } from './editor-ui.mjs';
import { escolherSprite } from './editor-biblioteca-sprites.mjs';
// O desenho do jogo (sprites e a camada de efeitos) só carrega quando a arena abre — no navegador (os testes do Node importam as telas).
let loadSpriteData, loadEffectData, drawCreature, criarCamada, desenharEfeito, desenharProjetil, desenharQuadroDeAsset, duracaoDoAsset;
async function carregarDesenho() {
  if (criarCamada) return;
  ({ loadSpriteData, loadEffectData, drawCreature } = await import('./sprites.mjs'));
  ({ criarCamada, desenharEfeito, desenharProjetil, desenharQuadroDeAsset, duracaoDoAsset } = await import('./efeitos-visuais.mjs'));
}

const API = '/api/mapas/_conteudo/';
const get = async (r) => (await fetch(API + r)).json();
const post = async (r, corpo) => (await fetch(API + r, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) })).json();
const TILE = 32;
const LARGURA = 13;
const ALTURA = 9;
const VELOCIDADES = [0.25, 0.5, 1, 2, 4, 8];
const DIRECOES = [['no', '↖'], ['n', '↑'], ['ne', '↗'], ['o', '←'], [null, '•'], ['l', '→'], ['so', '↙'], ['s', '↓'], ['se', '↘']];
const COR_DA_PARTE = { lancamento: '#c9a35a', projetil: '#5aa9e6', impacto: '#e0703a', area: '#7bc96f', alvo: '#b07be0' };

/** Os campos de cada parte: `[campo, rótulo, tipo, min, max, passo]` (tipo num | bool | sel). */
const COMUNS = [
  ['escala', 'Escala', 'num', 0.1, 5, 0.05, 1], ['rotacao', 'Rotação (°)', 'num', -360, 360, 5, 0], ['opacidade', 'Opacidade', 'num', 0, 1, 0.05, 1],
  ['dx', 'Deslocamento X (px)', 'num', -96, 96, 1, 0], ['dy', 'Deslocamento Y (px)', 'num', -96, 96, 1, 0], ['atraso', 'Atraso (ms)', 'num', 0, 5000, 10, 0],
  ['duracao', 'Duração (ms; 0 = a da animação)', 'num', 0, 10000, 10, 0], ['loop', 'Repetir a animação (loop)', 'bool'], ['flipX', 'Espelhar na horizontal', 'bool'], ['flipY', 'Espelhar na vertical', 'bool'],
];
const DA_PARTE = {
  lancamento: [],
  projetil: [['velocidade', 'Velocidade (ms por casa; o combate usa 60)', 'num', 10, 500, 5, 60], ['orientar', 'Girar o sprite para a direção do voo', 'bool']],
  impacto: [['noImpacto', 'Esperar o projétil chegar', 'bool']],
  area: [['noImpacto', 'Esperar o projétil chegar', 'bool']],
  alvo: [['ancora', 'Âncora no alvo', 'sel', ['acima', 'corpo', 'pes']], ['noImpacto', 'Esperar o projétil chegar', 'bool']],
};

export function arenaDeEfeitos({ slugInicial = null } = {}) {
  const T = {
    dados: null, draft: null, revisao: null, skill: null, filtro: '', suportes: new Set(), nivel: 10, alvos: 1, distancia: 4, direcao: 'l',
    // O MODO: 'combate' (uma caçada de verdade com vários bichos, o personagem lançando a skill) ou 'lancamento' (um lançamento, parado).
    modo: 'combate', mobs: 6, segundos: 12, carregando: false,
    sim: null, cliente: null, errosDaPrevia: [], parte: 'projetil', vel: 1, pausado: false, t0: 0, tPausa: 0, loop: true, comparar: false, lados: null,
  };
  const raiz = el('section', { class: 'arena-efeitos' });

  // ---------------------------------------------------------------- dados
  async function carregar() {
    await carregarDesenho();
    await Promise.all([loadSpriteData().catch(() => {}), loadEffectData().catch(() => {})]);
    T.dados = await get('efeitos');
    const { _nota, ...resto } = T.dados.override ?? {};
    T.draft = { assets: resto.assets ?? {}, presets: resto.presets ?? {}, skills: resto.skills ?? {} };
    T.revisao = T.dados.revisao;
    T.cliente = T.dados.cliente;
    const inicial = slugInicial ? T.dados.skills.find((s) => s.slug === slugInicial) : null;
    T.skill = (inicial ?? T.dados.skills.find((s) => s.id === 'poe-gema:Fireball') ?? T.dados.skills[0])?.id ?? null;
    pintar();
    await lancar();
  }
  /** O visual em edição, resolvido como o jogo recebe (o servidor valida e junta preset + override; nada é gravado). */
  async function previa() {
    const r = await post('efeitos/previa', { override: T.draft });
    T.cliente = r.cliente;
    T.errosDaPrevia = r.erros ?? [];
    montarLados();
    pintarErros();
    pintarTimeline();
    // Os campos mostram o visual resolvido: repinta o editor, menos enquanto se mexe num campo dele (não roubar o foco do controle).
    if (!raiz.querySelector('.ae-editor')?.contains(document.activeElement)) pintarEditor();
  }
  let esperaDaPrevia = null;
  const previaEmBreve = () => { clearTimeout(esperaDaPrevia); esperaDaPrevia = setTimeout(previa, 180); };

  async function lancar() {
    if (!T.skill) return;
    T.carregando = true;
    pintarTimeline();
    const combate = T.modo === 'combate';
    const r = combate
      ? await post('efeitos/combate', { skill: T.skill, nivel: T.nivel, suportes: [...T.suportes], mobs: T.mobs, segundos: T.segundos })
      : await post('efeitos/simular', { skill: T.skill, nivel: T.nivel, suportes: [...T.suportes], alvos: T.alvos, distancia: T.distancia, direcao: T.direcao });
    T.carregando = false;
    if (!r.ok) { msg(`Arena de Efeitos: ${r.erros?.join(' ')}`, 'erro'); T.sim = null; montarLados(); pintarTimeline(); return; }
    T.sim = { ...r, tipo: combate ? 'combate' : 'lancamento' };
    if (combate) msg(`Combate: ${r.usos} uso(s) da skill e ${r.mortes} bicho(s) derrotado(s) em ${T.segundos} s.`, 'ok');
    else if (r.distancia !== T.distancia) msg(`A distância ficou em ${r.distancia} casa(s): é o alcance da skill.`, 'aviso');
    montarLados();
    reiniciar();
    pintarTimeline();
  }

  // ---------------------------------------------------------------- eventos → instâncias (a camada do jogo)
  /** As instâncias de um lado (Original: sem visual da skill; Customizado: o da prévia), no tempo da arena (0 = o começo). */
  function lado(visuais) {
    const camada = criarCamada();
    const saida = { efeitos: [], projeteis: [], danos: [], fim: 0 };
    // Os eventos com o instante de cada um: no combate, o do tique em que saíram; num lançamento, 0 (e o fim da conjuração depois).
    const pares = [];
    if (T.sim?.tipo === 'combate') for (const q of T.sim.quadros) for (const ev of q.eventos) pares.push([q.t, ev]);
    else {
      let b = 0;
      for (const ev of T.sim?.eventos ?? []) { if (ev.t === 'castFim') b = T.sim.conjuracaoMs; pares.push([b, ev]); }
    }
    let base = 0;
    for (const [t, ev] of pares) {
      base = t;
      const n = camada.receber(ev, base, { visuais, uidDe: (e) => e.uid });
      saida.efeitos.push(...n.efeitos);
      saida.projeteis.push(...n.projeteis);
      if (ev.t === 'dmg' && ev.foe) saida.danos.push({ born: base, uid: ev.uid, v: ev.v, crit: ev.crit, color: ev.color });
    }
    for (const i of [...saida.efeitos, ...saida.projeteis]) saida.fim = Math.max(saida.fim, i.born + i.life);
    saida.fim = Math.max(saida.fim, base + 700, T.sim?.conjuracaoMs ?? 0, T.sim?.tipo === 'combate' ? T.sim.quadros.at(-1).t : 0);
    return saida;
  }
  function montarLados() {
    if (!T.sim || !T.cliente) { T.lados = null; return; }
    const custom = T.cliente;
    T.lados = { original: lado({ assets: custom.assets, presets: {}, skills: {} }), custom: lado(custom) };
  }

  // ---------------------------------------------------------------- reprodução
  const agoraVirtual = () => (T.pausado ? T.tPausa : (performance.now() - T.t0) * T.vel);
  function reiniciar() { T.t0 = performance.now(); T.tPausa = 0; T.pausado = false; pintarControles(); }
  function pausar() { if (T.pausado) { T.t0 = performance.now() - T.tPausa / T.vel; T.pausado = false; } else { T.tPausa = agoraVirtual(); T.pausado = true; } pintarControles(); }
  function avancar(ms) { const t = agoraVirtual() + ms; T.pausado = true; T.tPausa = Math.max(0, t); pintarControles(); }
  function mudarVelocidade(v) { const t = agoraVirtual(); T.vel = v; if (!T.pausado) T.t0 = performance.now() - t / v; pintarControles(); }

  const telas = { original: null, custom: null };
  function desenharLado(canvas, L, t) {
    if (!canvas || !T.sim) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const cena = cenaEm(t);
    const cam = { x: Math.round((cena.pos.x - Math.floor(LARGURA / 2)) * TILE), y: Math.round((cena.pos.y - Math.floor(ALTURA / 2)) * TILE) };
    // O chão: um xadrez discreto (a arena não tem mapa; o que importa é a posição de cada casa).
    for (let y = 0; y < ALTURA; y++) for (let x = 0; x < LARGURA; x++) { ctx.fillStyle = (x + y) % 2 ? '#1b2326' : '#1f2a2e'; ctx.fillRect(x * TILE, y * TILE, TILE, TILE); }
    const posDe = (uid) => (uid === 'player' ? cena.pos : cena.mobs.find((a) => a.uid === uid) ?? null);
    drawCreature(ctx, { look: T.sim.jogador.look, colors: T.sim.jogador.colors, dir: cena.pos.dir ?? dirDoLancador(), frame: 0 }, cena.pos.x * TILE - cam.x, cena.pos.y * TILE - cam.y);
    for (const a of cena.mobs) {
      const px = a.x * TILE - cam.x;
      const py = a.y * TILE - cam.y;
      drawCreature(ctx, { look: a.look, colors: a.colors, dir: a.dir ?? 3, frame: 0 }, px, py);
      // A vida do bicho (no combate, cai e o bicho some ao morrer).
      if (a.vida != null) { ctx.fillStyle = '#000'; ctx.fillRect(px + 2, py - 6, 28, 4); ctx.fillStyle = a.vida > 50 ? '#3fbf3f' : a.vida > 20 ? '#e0b84a' : '#e05a3a'; ctx.fillRect(px + 3, py - 5, Math.round((26 * a.vida) / 100), 2); }
    }
    if (!L) return;
    for (const e of L.efeitos) {
      const dono = e.uid != null ? posDe(e.uid) : null;
      const b = dono ?? { x: e.x, y: e.y };
      desenharEfeito(ctx, e, b.x * TILE - cam.x, b.y * TILE - cam.y, t);
    }
    for (const p of L.projeteis) desenharProjetil(ctx, p, t, cam);
    // Os números de dano (DAMAGE_APPLIED), subindo como no jogo.
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    for (const d of L.danos) {
      const idade = t - d.born;
      if (idade < 0 || idade > 800) continue;
      const a = posDe(d.uid);
      if (!a) continue;
      ctx.globalAlpha = 1 - idade / 800;
      ctx.fillStyle = d.color ?? '#ff4444';
      ctx.fillText(String(d.v ?? ''), a.x * TILE - cam.x + TILE / 2, a.y * TILE - cam.y - 4 - idade / 25);
      ctx.globalAlpha = 1;
    }
  }
  /** O personagem e os bichos no instante `t`: no combate, entre um tique e o próximo (andam suave); num lançamento, parados. */
  function cenaEm(t) {
    if (T.sim?.tipo !== 'combate') return { pos: T.sim.pos, mobs: T.sim.alvos };
    const Q = T.sim.quadros;
    const i = Math.max(0, Math.min(Q.length - 1, Math.floor(t / 250)));
    const a = Q[i];
    const b = Q[Math.min(Q.length - 1, i + 1)];
    const f = Math.max(0, Math.min(1, (t - a.t) / 250));
    const mistura = (p, q) => (q ? { ...p, x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f } : p);
    return { pos: mistura(a.pos, b.pos), mobs: a.mobs.map((m) => mistura(m, b.mobs.find((x) => x.uid === m.uid))) };
  }
  const dirDoLancador = () => ({ n: 0, ne: 1, l: 1, se: 1, s: 2, so: 3, o: 3, no: 3 })[T.direcao] ?? 2;
  let conectou = false;
  function quadro() {
    if (!criarCamada) { requestAnimationFrame(quadro); return; }
    // Espera a tela entrar na página; saiu dela (outra tela da engine), o laço para.
    if (!raiz.isConnected) { if (!conectou) requestAnimationFrame(quadro); return; }
    conectou = true;
    let t = agoraVirtual();
    const fim = Math.max(T.lados?.custom?.fim ?? 0, T.lados?.original?.fim ?? 0) + 400;
    if (!T.pausado && T.lados && t > fim) {
      if (T.loop) { reiniciar(); t = 0; } else { T.pausado = true; T.tPausa = fim; t = fim; pintarControles(); }
    }
    desenharLado(telas.custom, T.lados?.custom, t);
    if (T.comparar) desenharLado(telas.original, T.lados?.original, t);
    const agulha = raiz.querySelector('.ae-agulha');
    if (agulha && T.lados) agulha.style.left = `${Math.min(100, (100 * t) / Math.max(1, fim))}%`;
    const rel = raiz.querySelector('.ae-relogio');
    if (rel) rel.textContent = `${Math.round(t)} ms`;
    requestAnimationFrame(quadro);
  }

  // ---------------------------------------------------------------- edição do draft
  const skillAtual = () => T.dados?.skills.find((s) => s.id === T.skill) ?? null;
  const confDaSkill = () => (T.draft.skills[T.skill] ??= {});
  const presetDe = (id) => (id ? T.draft.presets[id] ?? T.dados.presetsDeFabrica[id] ?? null : null);
  /** A parte como VALE agora (preset + override), para mostrar nos campos; e a do override (o que se edita). */
  // O que VALE agora (o servidor resolveu na prévia: estilo automático + preset + override).
  const parteEfetiva = (p) => ({ ...(T.cliente?.skills?.[T.skill]?.[p] ?? {}) });
  function mudar(p, campo, valor) {
    const c = confDaSkill();
    c.override ??= {};
    c.override[p] ??= {};
    if (valor === undefined) delete c.override[p][campo];
    else c.override[p][campo] = valor;
    if (!Object.keys(c.override[p]).length) delete c.override[p];
    limparSkill();
    previaEmBreve();
  }
  function limparSkill() {
    const c = T.draft.skills[T.skill];
    if (c && !c.preset && !Object.keys(c.override ?? {}).length) delete T.draft.skills[T.skill];
  }

  // ---------------------------------------------------------------- interface
  function pintar() {
    raiz.replaceChildren(
      el('h2', { class: 'ae-titulo' }, 'Arena de Efeitos'),
      el('p', { class: 'dica' }, 'O visual das skills, separado do dano: a skill é lançada no combate de verdade (com a gema, os suportes e o nível) e os eventos são desenhados com a mesma camada de efeitos do jogo. "Original" é o desenho de fábrica; "Customizado", o que você está editando. Salvar grava em gamedata/overrides/efeitos.json (para valer na produção: commit e deploy).'),
      el('div', { class: 'ae-grade' },
        el('aside', { class: 'ae-esquerda' }, blocoSkill(), blocoTeste()),
        el('div', { class: 'ae-centro' }, el('div', { class: 'ae-controles' }), el('div', { class: 'ae-telas' }), el('div', { class: 'ae-timeline' }), el('div', { class: 'ae-erros' })),
        el('aside', { class: 'ae-direita' }, el('div', { class: 'ae-presets' }), el('div', { class: 'ae-editor' }), el('div', { class: 'ae-biblioteca' }), el('div', { class: 'ae-salvar' }))));
    pintarTelas();
    pintarControles();
    pintarEditor();
    pintarPresets();
    pintarBiblioteca();
    pintarSalvar();
    pintarTimeline();
  }
  function blocoSkill() {
    const lista = el('select', { size: 12, class: 'ae-lista', onchange: (e) => { T.skill = e.target.value; pintarEditor(); pintarPresets(); lancar(); } });
    const encher = () => {
      const f = T.filtro.toLowerCase();
      lista.replaceChildren(...T.dados.skills.filter((s) => !f || `${s.nome} ${s.id}`.toLowerCase().includes(f)).slice(0, 400).map((s) => el('option', { value: s.id, selected: s.id === T.skill }, `${T.draft.skills[s.id] ? '● ' : ''}${s.nome}${s.poe ? '' : ' (Draevor)'}`)));
    };
    encher();
    return el('div', { class: 'ae-bloco' }, el('h4', {}, 'Skill'),
      el('input', { type: 'search', placeholder: 'Buscar skill…', value: T.filtro, oninput: (e) => { T.filtro = e.target.value; encher(); } }), lista,
      el('p', { class: 'dica' }, '● = tem visual configurado.'));
  }
  function blocoTeste() {
    const sup = el('select', { multiple: true, size: 6, onchange: (e) => { T.suportes = new Set([...e.target.selectedOptions].map((o) => o.value)); lancar(); } },
      (T.dados.suportes ?? []).map((s) => el('option', { value: s.slug, selected: T.suportes.has(s.slug) }, s.nome)));
    const num = (rotulo, campo, min, max) => el('label', { class: 'ae-campo' }, rotulo, el('input', { type: 'number', min, max, value: T[campo], onchange: (e) => { T[campo] = Number(e.target.value); lancar(); } }));
    const combate = T.modo === 'combate';
    return el('div', { class: 'ae-bloco' }, el('h4', {}, 'Teste'),
      el('div', { class: 'ae-abas' },
        el('button', { type: 'button', class: combate ? 'ativo' : '', onclick: () => { T.modo = 'combate'; pintar(); lancar(); } }, 'Combate (vários mobs)'),
        el('button', { type: 'button', class: combate ? '' : 'ativo', onclick: () => { T.modo = 'lancamento'; pintar(); lancar(); } }, 'Um lançamento')),
      el('p', { class: 'dica' }, combate ? 'Uma caçada de verdade: os bichos da área vêm, o personagem lança a skill da barra (como no jogo) e quem morre volta. Bom para ver área, cadeia, projéteis extras e vários alvos.' : 'Um lançamento parado, nos bonecos na direção e distância escolhidas: bom para ajustar o tempo de cada efeito.'),
      num('Nível da gema', 'nivel', 1, 40),
      combate ? [num('Mobs vivos ao mesmo tempo', 'mobs', 1, 20), num('Duração (segundos)', 'segundos', 4, 40)] : null,
      combate ? null : [
        el('label', { class: 'ae-campo' }, 'Alvos', el('select', { onchange: (e) => { T.alvos = Number(e.target.value); lancar(); } }, [1, 3, 5, 10].map((n) => el('option', { value: n, selected: n === T.alvos }, String(n))))),
        num('Distância (casas)', 'distancia', 1, 8),
        el('div', { class: 'ae-campo' }, 'Direção do alvo', el('div', { class: 'ae-rosa' }, DIRECOES.map(([d, s]) => el('button', { type: 'button', class: d === T.direcao ? 'ativo' : '', disabled: !d, onclick: () => { T.direcao = d; pintar(); lancar(); } }, s))))],
      el('label', { class: 'ae-campo' }, 'Suportes ligados (Ctrl+clique)', sup),
      el('button', { type: 'button', class: 'botao', onclick: lancar }, combate ? '⚔ Rodar o combate de novo' : '⟳ Lançar de novo'));
  }
  function pintarTelas() {
    const c = raiz.querySelector('.ae-telas');
    if (!c) return;
    const tela = (rotulo, chave) => {
      const cv = el('canvas', { width: LARGURA * TILE, height: ALTURA * TILE, class: 'ae-canvas' });
      telas[chave] = cv;
      return el('figure', { class: 'ae-tela' }, el('figcaption', {}, rotulo), cv);
    };
    telas.original = null;
    c.replaceChildren(...(T.comparar ? [tela('ANTES (o molde do Draevor, sem visual)', 'original')] : []), tela('AGORA (estilo da gema + o que você editou)', 'custom'));
  }
  function pintarControles() {
    const c = raiz.querySelector('.ae-controles');
    if (!c) return;
    c.replaceChildren(
      el('button', { type: 'button', onclick: () => { if (T.pausado) pausar(); else reiniciar(); } }, '▶ Play'),
      el('button', { type: 'button', onclick: pausar }, T.pausado ? '▶ Continuar' : '⏸ Pausa'),
      el('button', { type: 'button', onclick: reiniciar }, '⏮ Reiniciar'),
      el('button', { type: 'button', onclick: () => avancar(-50) }, '◀ 50 ms'),
      el('button', { type: 'button', onclick: () => avancar(50) }, '50 ms ▶'),
      el('span', { class: 'ae-sep' }, 'Velocidade:'),
      VELOCIDADES.map((v) => el('button', { type: 'button', class: v === T.vel ? 'ativo' : '', onclick: () => mudarVelocidade(v) }, `${v}×`)),
      el('label', {}, el('input', { type: 'checkbox', checked: T.loop, onchange: (e) => { T.loop = e.target.checked; } }), ' repetir'),
      el('label', {}, el('input', { type: 'checkbox', checked: T.comparar, onchange: (e) => { T.comparar = e.target.checked; pintarTelas(); } }), ' comparar com o ANTES'),
      el('span', { class: 'ae-relogio' }, '0 ms'));
  }
  /** A LINHA DO TEMPO: cada instância visual do lado Customizado (barra = início e duração), o tempo da conjuração e os danos (●). */
  function pintarTimeline() {
    const c = raiz.querySelector('.ae-timeline');
    if (!c) return;
    const L = T.lados?.custom;
    if (T.carregando || !L) { c.replaceChildren(el('p', { class: 'dica' }, T.carregando ? (T.modo === 'combate' ? 'Rodando o combate no servidor…' : 'Lançando…') : 'Sem eventos visuais.')); return; }
    const fim = Math.max(L.fim, T.lados.original.fim) + 400;
    const pct = (ms) => `${(100 * ms) / fim}%`;
    const linhas = [];
    if (T.sim.conjuracaoMs) linhas.push(['Conjuração', 'SKILL_CAST', 0, T.sim.conjuracaoMs, '#8a8f98', null]);
    const EV = T.dados.eventosDasPartes;
    for (const i of [...L.efeitos, ...L.projeteis]) linhas.push([T.dados.nomeDasPartes[i.rotulo] ?? i.rotulo, EV[i.rotulo] ?? '', i.born, i.life, COR_DA_PARTE[i.rotulo] ?? '#999', i.rotulo]);
    // Uma linha por parte (as instâncias da mesma parte juntas: os 3 projéteis da GMP na mesma linha).
    const porParte = new Map();
    for (const l of linhas) { const k = `${l[0]}|${l[1]}`; if (!porParte.has(k)) porParte.set(k, []); porParte.get(k).push(l); }
    const reguas = [0, 0.25, 0.5, 0.75, 1].map((f) => el('span', { class: 'ae-regua', style: `left:${f * 100}%` }, `${Math.round(f * fim)}ms`));
    c.replaceChildren(el('div', { class: 'ae-tl' },
      el('div', { class: 'ae-tl-topo' }, el('span', { class: 'ae-tl-rot' }, ''), el('div', { class: 'ae-tl-faixa' }, reguas, el('i', { class: 'ae-agulha' }))),
      [...porParte.entries()].map(([k, ls]) => {
        const [nome, ev] = k.split('|');
        const parte = ls[0][5];
        return el('div', { class: `ae-tl-linha${parte && parte === T.parte ? ' sel' : ''}`, onclick: () => { if (parte) { T.parte = parte; pintarEditor(); pintarTimeline(); } } },
          el('span', { class: 'ae-tl-rot', title: ev }, `${nome}`, el('small', {}, ev)),
          el('div', { class: 'ae-tl-faixa' }, ls.map(([, , ini, dur, cor]) => el('b', { style: `left:${pct(ini)};width:${pct(Math.max(20, dur))};background:${cor}`, title: `${Math.round(ini)} → ${Math.round(ini + dur)} ms` }))));
      }),
      el('div', { class: 'ae-tl-linha' }, el('span', { class: 'ae-tl-rot' }, 'Dano', el('small', {}, 'DAMAGE_APPLIED')),
        el('div', { class: 'ae-tl-faixa' }, L.danos.map((d) => el('em', { style: `left:${pct(d.born)}`, title: `${d.v}${d.crit ? ' (crítico)' : ''}` }, '●'))))));
  }
  function pintarErros() {
    const c = raiz.querySelector('.ae-erros');
    if (c) c.replaceChildren(...T.errosDaPrevia.map((e) => el('p', { class: 'nao' }, e)));
  }

  /** O EDITOR da parte escolhida: o sprite e os campos; mudar aqui muda só o override desta skill. */
  function pintarEditor() {
    const c = raiz.querySelector('.ae-editor');
    if (!c || !T.skill) return;
    const p = T.parte;
    const v = parteEfetiva(p);
    const ov = T.draft.skills[T.skill]?.override?.[p] ?? {};
    const s = skillAtual();
    const spriteTxt = (sp) => (!sp ? `padrão do combate${p === 'projetil' && s?.fabrica.projetil ? ` (projétil #${s.fabrica.projetil})` : (p === 'impacto' || p === 'area') && s?.fabrica.efeito ? ` (efeito #${s.fabrica.efeito})` : ''}` : sp.tipo === 'nenhum' ? 'nenhum (não desenha)' : sp.tipo === 'asset' ? `spritesheet "${(T.cliente?.assets ?? T.draft.assets)[sp.id]?.nome ?? sp.id}"` : `${sp.tipo === 'efeito' ? 'efeito' : 'projétil'} #${sp.id}`);
    const campo = ([k, rot, tipo, min, max, passo, pad]) => {
      const marcado = k in ov;
      if (tipo === 'bool') return el('label', { class: `ae-campo ae-bool${marcado ? ' mudado' : ''}` }, el('input', { type: 'checkbox', checked: !!v[k], onchange: (e) => mudar(p, k, e.target.checked) }), ` ${rot}`);
      if (tipo === 'sel') return el('label', { class: `ae-campo${marcado ? ' mudado' : ''}` }, rot, el('select', { onchange: (e) => mudar(p, k, e.target.value || undefined) }, el('option', { value: '' }, '—'), min.map((o) => el('option', { value: o, selected: v[k] === o }, o))));
      const entrada = el('input', { type: 'range', min, max, step: passo, value: v[k] ?? pad });
      const numero = el('input', { type: 'number', min, max, step: passo, value: v[k] ?? pad, class: 'ae-num' });
      entrada.oninput = () => { numero.value = entrada.value; mudar(p, k, Number(entrada.value)); };
      numero.onchange = () => { entrada.value = numero.value; mudar(p, k, Number(numero.value)); };
      return el('label', { class: `ae-campo${marcado ? ' mudado' : ''}` }, rot, el('div', { class: 'ae-faixa' }, entrada, numero, marcado ? el('button', { type: 'button', title: 'voltar ao do preset', onclick: () => { mudar(p, k, undefined); pintarEditor(); } }, '↺') : null));
    };
    const rastro = v.rastro ?? {};
    const mudarRastro = (k, valor) => { const r = { ...(ov.rastro ?? {}), [k]: valor }; mudar(p, 'rastro', r); };
    const som = v.som ?? {};
    const mudarSom = (k, valor) => mudar(p, 'som', { ...(ov.som ?? {}), [k]: valor });
    c.replaceChildren(el('div', { class: 'ae-bloco' },
      el('h4', {}, 'Editar a parte'),
      el('div', { class: 'ae-abas' }, T.dados.partes.map((x) => el('button', { type: 'button', class: x === p ? 'ativo' : '', style: `border-bottom-color:${COR_DA_PARTE[x]}`, onclick: () => { T.parte = x; pintarEditor(); pintarTimeline(); } }, T.dados.nomeDasPartes[x].replace(/ \(.*\)/, '')))),
      s?.estilo ? el('label', { class: 'ae-campo ae-bool' }, el('input', { type: 'checkbox', checked: !T.draft.skills[T.skill]?.semEstilo, onchange: (e) => { const c2 = confDaSkill(); if (e.target.checked) delete c2.semEstilo; else c2.semEstilo = true; limparSkill(); previaEmBreve(); pintarEditor(); } }), ` Estilo automático da gema: ${s.estilo}`) : null,
      el('p', { class: 'dica' }, `Evento: ${T.dados.eventosDasPartes[p]}. Os campos marcados mudam só nesta skill (por cima do estilo e do preset).`),
      el('div', { class: 'ae-campo' }, 'Sprite', el('b', {}, spriteTxt(v.sprite)),
        el('div', { class: 'ae-linha' },
          el('button', { type: 'button', onclick: async () => { const x = await escolherSprite({ secoes: ['efeitos', 'tiros'], tipo: p === 'projetil' ? 'tiros' : 'efeitos', titulo: 'Sprite do efeito' }); if (x) { mudar(p, 'sprite', { tipo: x.tipo === 'tiros' ? 'projetil' : 'efeito', id: Number(x.id) }); pintarEditor(); } } }, 'Escolher da biblioteca…'),
          el('select', { onchange: (e) => { if (e.target.value) mudar(p, 'sprite', { tipo: 'asset', id: e.target.value }); pintarEditor(); } }, el('option', { value: '' }, 'Spritesheet…'), Object.entries(T.cliente?.assets ?? T.draft.assets).map(([id, a]) => el('option', { value: id, selected: v.sprite?.tipo === 'asset' && v.sprite.id === id }, `${a.nome} (${a.categoria})${a.fabrica ? ' · fábrica' : ''}`))),
          el('button', { type: 'button', onclick: () => { mudar(p, 'sprite', { tipo: 'nenhum' }); pintarEditor(); } }, 'Nenhum'),
          'sprite' in ov ? el('button', { type: 'button', onclick: () => { mudar(p, 'sprite', undefined); pintarEditor(); } }, '↺ padrão') : null)),
      [...COMUNS, ...(DA_PARTE[p] ?? [])].map(campo),
      p === 'projetil' ? el('fieldset', { class: 'ae-grupo' }, el('legend', {}, 'Rastro'),
        el('label', { class: 'ae-campo' }, 'Cópias', el('input', { type: 'number', min: 0, max: 10, value: rastro.quantidade ?? 0, onchange: (e) => mudarRastro('quantidade', Number(e.target.value)) })),
        el('label', { class: 'ae-campo' }, 'Espaço entre cópias (0,02–0,3 do voo)', el('input', { type: 'number', min: 0.02, max: 0.3, step: 0.01, value: rastro.espaco ?? 0.06, onchange: (e) => mudarRastro('espaco', Number(e.target.value)) })),
        el('label', { class: 'ae-campo' }, 'Opacidade do rastro', el('input', { type: 'number', min: 0, max: 1, step: 0.05, value: rastro.opacidade ?? 0.5, onchange: (e) => mudarRastro('opacidade', Number(e.target.value)) }))) : null,
      el('fieldset', { class: 'ae-grupo' }, el('legend', {}, 'Som (guardado — o jogo ainda não toca sons de combate)'),
        el('label', { class: 'ae-campo' }, 'Arquivo', el('input', { type: 'text', value: som.arquivo ?? '', placeholder: 'ex.: fogo-impacto.ogg', onchange: (e) => mudarSom('arquivo', e.target.value) })),
        el('label', { class: 'ae-campo' }, 'Volume', el('input', { type: 'number', min: 0, max: 1, step: 0.05, value: som.volume ?? 1, onchange: (e) => mudarSom('volume', Number(e.target.value)) })),
        el('label', { class: 'ae-campo' }, 'Pitch', el('input', { type: 'number', min: 0.25, max: 3, step: 0.05, value: som.pitch ?? 1, onchange: (e) => mudarSom('pitch', Number(e.target.value)) })),
        el('label', { class: 'ae-campo' }, 'Atraso (ms)', el('input', { type: 'number', min: 0, max: 5000, value: som.atraso ?? 0, onchange: (e) => mudarSom('atraso', Number(e.target.value)) })),
        el('label', { class: 'ae-campo ae-bool' }, el('input', { type: 'checkbox', checked: !!som.loop, onchange: (e) => mudarSom('loop', e.target.checked) }), ' loop')),
      el('button', { type: 'button', onclick: () => { const c2 = T.draft.skills[T.skill]; if (c2?.override) delete c2.override[p]; limparSkill(); previaEmBreve(); pintarEditor(); } }, `↺ Desfazer tudo de "${T.dados.nomeDasPartes[p]}" nesta skill`)));
  }

  /** PRESETS: o da skill, criar do visual atual, duplicar, renomear, excluir, aplicar a outras skills. */
  function pintarPresets() {
    const c = raiz.querySelector('.ae-presets');
    if (!c || !T.skill) return;
    const atual = T.draft.skills[T.skill]?.preset ?? '';
    const todos = { ...T.dados.presetsDeFabrica, ...T.draft.presets };
    const novoId = (nome) => nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || `preset-${Date.now()}`;
    const visualAtual = () => { const v = {}; for (const p of T.dados.partes) { const x = parteEfetiva(p); if (Object.keys(x).length) v[p] = x; } return v; };
    const s = skillAtual();
    c.replaceChildren(el('div', { class: 'ae-bloco' }, el('h4', {}, 'Preset da skill'),
      el('select', { onchange: (e) => { const c2 = confDaSkill(); if (e.target.value) c2.preset = e.target.value; else delete c2.preset; limparSkill(); previaEmBreve(); pintarEditor(); } },
        el('option', { value: '' }, '— sem preset (desenho de fábrica) —'),
        Object.entries(todos).map(([id, pr]) => el('option', { value: id, selected: id === atual }, `${pr.nome}${pr.fabrica ? ' (fábrica)' : ''}`))),
      el('div', { class: 'ae-linha' },
        el('button', { type: 'button', onclick: () => { const nome = prompt('Nome do preset novo (o visual como está agora nesta skill):'); if (!nome) return; const id = novoId(nome); T.draft.presets[id] = { nome, visual: visualAtual() }; const c2 = confDaSkill(); c2.preset = id; delete c2.override; previaEmBreve(); pintarPresets(); pintarEditor(); } }, 'Salvar como preset'),
        atual ? el('button', { type: 'button', onclick: () => { const base = todos[atual]; const nome = prompt('Nome da cópia:', `${base.nome} (cópia)`); if (!nome) return; T.draft.presets[novoId(nome)] = { nome, visual: structuredClone(base.visual ?? {}) }; pintarPresets(); } }, 'Duplicar') : null,
        atual && T.draft.presets[atual] ? el('button', { type: 'button', onclick: () => { const nome = prompt('Novo nome:', T.draft.presets[atual].nome); if (nome) { T.draft.presets[atual].nome = nome; pintarPresets(); } } }, 'Renomear') : null,
        atual && T.draft.presets[atual] ? el('button', { type: 'button', onclick: () => { const v = visualAtual(); T.draft.presets[atual].visual = v; delete confDaSkill().override; previaEmBreve(); pintarEditor(); msg('Preset atualizado com o visual desta skill.', 'ok'); } }, 'Atualizar com esta skill') : null,
        atual && T.draft.presets[atual] ? el('button', { type: 'button', onclick: () => { const usam = Object.entries(T.draft.skills).filter(([, x]) => x.preset === atual).length; if (!confirm(`Excluir o preset "${T.draft.presets[atual].nome}"? ${usam} skill(s) usam: elas voltam ao desenho de fábrica (mais o que mudaram).`)) return; delete T.draft.presets[atual]; for (const x of Object.values(T.draft.skills)) if (x.preset === atual) delete x.preset; for (const id of Object.keys(T.draft.skills)) { const x = T.draft.skills[id]; if (!x.preset && !Object.keys(x.override ?? {}).length) delete T.draft.skills[id]; } previaEmBreve(); pintarPresets(); pintarEditor(); } }, 'Excluir') : null),
      atual ? el('div', { class: 'ae-linha' },
        el('button', { type: 'button', onclick: () => aplicarEm((x) => x.elemento && x.elemento === s?.elemento && x.poe, `as gemas do PoE de elemento ${s?.elemento}`) }, `Aplicar a todas as gemas de ${s?.elemento ?? '—'}`),
        el('button', { type: 'button', onclick: () => { const f = prompt('Aplicar este preset às skills cujo nome contém:'); if (f) aplicarEm((x) => x.nome.toLowerCase().includes(f.toLowerCase()), `as skills com "${f}"`); } }, 'Aplicar por nome…')) : null));
    function aplicarEm(filtro, descricao) {
      const alvos = T.dados.skills.filter(filtro);
      if (!alvos.length || !confirm(`Aplicar o preset "${todos[atual].nome}" a ${alvos.length} skill(s) (${descricao})? O que cada uma mudou por cima fica.`)) return;
      for (const x of alvos) (T.draft.skills[x.id] ??= {}).preset = atual;
      msg(`Preset aplicado a ${alvos.length} skill(s) — falta Salvar.`, 'ok');
      previaEmBreve();
    }
  }

  /** A BIBLIOTECA de spritesheets: enviar um PNG, definir a grade e a animação, ver antes de salvar. */
  function pintarBiblioteca() {
    const c = raiz.querySelector('.ae-biblioteca');
    if (!c) return;
    const f = { id: '', nome: '', categoria: 'Impact', colunas: 4, linhas: 1, fps: 12, inicio: 0, fim: 3, loop: false, pingpong: false, reverso: false, url: null, png: null };
    const tela = el('canvas', { width: 128, height: 128, class: 'ae-canvas-asset' });
    let t0 = performance.now();
    const animar = () => {
      if (!tela.isConnected) return;
      const ctx = tela.getContext('2d');
      ctx.clearRect(0, 0, 128, 128);
      if (f.url) { const d = duracaoDoAsset(f); const t = (performance.now() - t0) % (d + 300); desenharQuadroDeAsset(ctx, f, Math.min(0.999, t / d), 64, 64); }
      requestAnimationFrame(animar);
    };
    const num = (k, rot, min, max) => el('label', { class: 'ae-campo' }, rot, el('input', { type: 'number', min, max, value: f[k], onchange: (e) => { f[k] = Number(e.target.value); t0 = performance.now(); } }));
    const bool = (k, rot) => el('label', { class: 'ae-campo ae-bool' }, el('input', { type: 'checkbox', onchange: (e) => { f[k] = e.target.checked; } }), ` ${rot}`);
    // Todos os sprites (os de fábrica, desenhados por código, e os enviados), cada um ANIMADO; clicar aplica na parte em edição.
    const todos = Object.entries(T.cliente?.assets ?? T.draft.assets);
    const vitrine = el('div', { class: 'ae-vitrine' }, todos.map(([id, a]) => {
      const cv = el('canvas', { width: 64, height: 64, class: 'ae-vitrine-cv', 'data-asset': id });
      return el('button', { type: 'button', class: 'ae-vitrine-item', title: `${a.nome} · ${a.categoria} · ${a.colunas}×${a.linhas} · ${a.fps} fps${a.fabrica ? ' (fábrica)' : ''} — clique para usar em "${T.dados.nomeDasPartes[T.parte]}"`, onclick: () => { mudar(T.parte, 'sprite', { tipo: 'asset', id }); pintarEditor(); } }, cv, el('small', {}, a.nome));
    }));
    const t1 = performance.now();
    const animarVitrine = () => {
      if (!vitrine.isConnected) return;
      for (const cv of vitrine.querySelectorAll('canvas')) {
        const a = (T.cliente?.assets ?? {})[cv.dataset.asset];
        if (!a) continue;
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, 64, 64);
        const d = duracaoDoAsset(a);
        const esc = 0.62; // cabe o maior quadro (96 px) no quadrinho de 64
        ctx.save(); ctx.scale(esc, esc);
        desenharQuadroDeAsset(ctx, a, Math.min(0.999, ((performance.now() - t1) % (d + 250)) / d), 32 / esc, 32 / esc);
        ctx.restore();
      }
      requestAnimationFrame(animarVitrine);
    };
    requestAnimationFrame(animarVitrine);
    c.replaceChildren(el('details', { class: 'ae-bloco', open: true }, el('summary', {}, `Biblioteca de sprites (${todos.length}) — clique num para usar na parte em edição`),
      vitrine,
      el('h5', {}, 'Enviar um spritesheet (PNG)'),
      el('input', { type: 'file', accept: 'image/png', onchange: (e) => { const arq = e.target.files?.[0]; if (!arq) return; const r = new FileReader(); r.onload = () => { f.png = r.result; f.url = r.result; t0 = performance.now(); if (!f.id) { f.id = arq.name.replace(/\.png$/i, '').replace(/[^\w-]+/g, '-').slice(0, 60); f.nome = f.id; pintarCampos(); } }; r.readAsDataURL(arq); } }),
      el('div', { class: 'ae-campos-asset' }), tela,
      el('button', { type: 'button', class: 'botao', onclick: async () => {
        if (!f.png || !f.id) return msg('Escolha o PNG e o id.', 'aviso');
        const { png, url, ...definicao } = f;
        const r = await post('efeitos/asset', { id: f.id, png, definicao, revisao: T.revisao });
        if (!r.ok) return msg(r.erros?.join(' ') ?? 'Não gravou.', 'erro');
        T.revisao = r.revisao;
        T.draft.assets = r.cliente ? Object.fromEntries(Object.entries(r.cliente.assets).map(([k, a]) => [k, (({ url: _u, ...resto }) => resto)(a)])) : T.draft.assets;
        msg(`Spritesheet "${f.nome}" na biblioteca. ${r.comoPublicar ?? ''}`, 'ok');
        await previa();
        pintarBiblioteca();
        pintarEditor();
      } }, 'Adicionar à biblioteca')));
    function pintarCampos() {
      c.querySelector('.ae-campos-asset')?.replaceChildren(
        el('label', { class: 'ae-campo' }, 'Id', el('input', { type: 'text', value: f.id, onchange: (e) => { f.id = e.target.value; } })),
        el('label', { class: 'ae-campo' }, 'Nome', el('input', { type: 'text', value: f.nome, onchange: (e) => { f.nome = e.target.value; } })),
        el('label', { class: 'ae-campo' }, 'Categoria', el('select', { onchange: (e) => { f.categoria = e.target.value; } }, T.dados.categorias.map((k) => el('option', { value: k, selected: k === f.categoria }, k)))),
        num('colunas', 'Colunas', 1, 64), num('linhas', 'Linhas', 1, 64), num('fps', 'FPS', 1, 60), num('inicio', 'Quadro inicial', 0, 4095), num('fim', 'Quadro final', 0, 4095),
        bool('loop', 'Loop'), bool('pingpong', 'Ida e volta'), bool('reverso', 'Ao contrário'));
    }
    pintarCampos();
    animar();
  }

  function pintarSalvar() {
    const c = raiz.querySelector('.ae-salvar');
    if (!c) return;
    c.replaceChildren(el('div', { class: 'ae-bloco' },
      el('button', { type: 'button', class: 'botao primario', onclick: async () => {
        const r = await post('efeitos', { acao: 'salvar', override: T.draft, revisao: T.revisao });
        if (!r.ok) return msg((r.erros ?? []).join(' ') || 'Não gravou.', 'erro');
        T.revisao = r.revisao;
        T.dados.versoes = (await get('efeitos/versoes')).versoes ?? [];
        msg(`Visual salvo. ${r.comoPublicar ?? ''}`, 'ok');
        pintarSalvar();
      } }, 'Salvar os efeitos'),
      el('details', {}, el('summary', {}, `Versões anteriores (${T.dados.versoes?.length ?? 0})`),
        el('ul', {}, (T.dados.versoes ?? []).slice(0, 30).map((n) => el('li', {}, `versão ${n} `, el('button', { type: 'button', onclick: async () => {
          if (!confirm(`Restaurar a versão ${n}? (A atual vira uma versão nova: nada se perde.)`)) return;
          const r = await post('efeitos', { acao: 'restaurar', versao: n, revisao: T.revisao });
          if (!r.ok) return msg((r.erros ?? []).join(' '), 'erro');
          await carregar();
        } }, 'Restaurar')))))));
  }

  /** Escolher a skill de uma gema (a gema escolhida na Arena de Gemas em cima). */
  function escolherGema(slug) {
    const s = T.dados?.skills.find((x) => x.slug === slug);
    if (!s || s.id === T.skill) return;
    T.skill = s.id;
    pintar();
    lancar();
  }

  carregar().catch((e) => msg(`Arena de Efeitos: ${e.message}`, 'erro'));
  requestAnimationFrame(quadro);
  return { elemento: raiz, escolherGema };
}
