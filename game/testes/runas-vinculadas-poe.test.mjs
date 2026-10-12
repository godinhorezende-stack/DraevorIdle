// As RUNAS (Brands do PoE) PRESAS AO INIMIGO (dono, 12/10: "Runas e Vínculos presos ao alvo") de ponta a ponta: a gema real na barra conjura a
// Runa, que vincula ao alvo e é Ativada na hora e a cada N segundos enquanto vinculada; a duração vinculada e a solta; o limite de 3 ativas e
// de 1 por inimigo; a troca de alvo; e os nós REAIS da árvore de cada linha de Runa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Runas = await import('../systems/itens-poe/runas-vinculadas.mjs');
const ModsPoe = await import('../systems/itens-poe/condicoes-poe.mjs');

/** Uma Bruxa com `gemas` encaixadas na varinha, na barra, numa caçada do PoE. */
async function bruxaCom(gemas) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const n = gemas.length;
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: n, links: Array.from({ length: Math.max(0, n - 1) }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 1, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  gemas.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  return e;
}
/** Os bichos da caçada: os `n` primeiros nas casas dadas (com muita vida), os outros longe. */
function bichosEm(e, ...casas) {
  const todos = e.hunt.monstros;
  todos.forEach((b, i) => {
    if (i < casas.length) Object.assign(b, { x: e.hunt.pos.x + casas[i][0], y: e.hunt.pos.y + casas[i][1], hp: 1e9, maxHp: 1e9 });
    else Object.assign(b, { x: e.hunt.pos.x + 80, y: e.hunt.pos.y + 80 });
  });
  return todos.slice(0, casas.length);
}
function usar(e, slot, alvo, manual = false) {
  e.hunt.clock += 10_000;
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo, { manual });
  if (!r.ok) return r;
  if (!r.conjurando) return r;
  e.hunt.clock += 3000;
  return { ok: true, eventos: Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) };
}
const danoEm = (eventos, b) => (eventos ?? []).filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + x.v, 0);
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
/** Avança o relógio da caçada `ms` em passos de 50 ms, rodando o tique das Runas; devolve os eventos. */
function passar(e, ms) {
  const eventos = [];
  for (let t = 0; t < ms; t += 50) { e.hunt.clock += 50; Acoes.tiqueDasRunas(e, e.hunt, PERSONAGEM, eventos); }
  return eventos;
}
const runa = (e, x, y, extra = {}) => Runas.conjurar(e.hunt, ficha(e), { acao: e.actions[0].id, slot: 0, x: e.hunt.pos.x + x, y: e.hunt.pos.y + y, props: { ...Runas.daGema([]), ...extra }, agora: e.hunt.clock });

/** Aloca o nó (principal, maestria ou ascendência) com um efeito cuja chave casa `re`. */
function alocar(e, re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  let no = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  let opcao = null;
  if (!no) for (const n of arv.nos.filter((x) => x.tipo === 'mastery' && !x.ascendencia)) { const o = (n.opcoes ?? []).find((x) => tem(x.efeitos)); if (o) { no = n; opcao = o.id; break; } }
  if (!no) {
    no = arv.nos.find((n) => n.ascendencia && tem(n.efeitos));
    assert.ok(no, `há nó com ${re}`);
    e.classePoe = arv.ascendencias[no.ascendencia].classe;
    P.garantir(e);
    e.passivas.ascendencia = no.ascendencia;
    Comandos.depoisDeMudar(e);
    assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) }).ok);
    Ficha.invalidar(e);
    return;
  }
  const ate = no.tipo === 'mastery' ? arv.nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia).id : no.id;
  const caminho = P.caminhoAte(e, ate);
  const antes = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
  if (antes.length) assert.equal(Comandos.comando(e, { action: 'alocar', ids: antes }).feitos, antes.length);
  assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id, ...(opcao ? { opcao } : {}) }).ok);
  Ficha.invalidar(e);
}

test('o que a GEMA diz: a ativação, as durações vinculada/solta, a troca de alvo, a única ativação e a Runa a mais por inimigo', { skip: SEM }, () => {
  const d = (s) => Runas.daGema(G.textosDaGema(s, 10).linhas);
  assert.deepEqual(d('Storm_Brand'), { intervaloMs: 500, unica: false, vinculadaMs: 5000, soltaMs: 6000, trocaMs: null, porInimigoExtra: 0 });
  assert.equal(d('Storm_Brand_of_Indecision').trocaMs, 300);
  assert.equal(d('Wintertide_Brand').porInimigoExtra, 1);
  assert.equal(d('Wintertide_Brand').vinculadaMs, 2000);
  assert.equal(d('Armageddon_Brand_of_Volatility').unica, true);
  assert.equal(d('Penance_Brand_of_Dissipation').intervaloMs, 1000, '"a cada segundo"');
});

test('a RUNA conjurada pela barra vincula ao alvo e é Ativada na hora; depois a cada N segundos enquanto vinculada; acaba em 5 s', { skip: SEM }, async () => {
  const e = await bruxaCom(['Storm_Brand']);
  const [b] = bichosEm(e, [1, 0]);
  const r = usar(e, 0, b);
  assert.ok(r.ok, r.erro);
  assert.ok(danoEm(r.eventos, b) > 0, 'a 1ª Ativação, na hora');
  const [runaAtiva] = Runas.ativas(e.hunt);
  assert.equal(runaAtiva.alvo, b.uid, 'vinculada ao alvo');
  const intervalo = runaAtiva.intervaloMs;
  const ev = passar(e, 2000);
  const ativacoes = ev.filter((x) => x.t === 'skill').length;
  assert.ok(Math.abs(ativacoes - Math.floor(2000 / intervalo)) <= 1, `${ativacoes} Ativações em 2 s com intervalo de ${intervalo} ms`);
  assert.ok(danoEm(ev, b) > 0);
  passar(e, 3100);
  assert.equal(Runas.ativas(e.hunt).length, 0, 'a duração vinculada (5 s) acabou');
});

test('o inimigo MORRE: a Runa solta e se vincula a outro no alcance (3 casas); sem ninguém, solta acaba em 6 s', { skip: SEM }, async () => {
  const e = await bruxaCom(['Storm_Brand']);
  const [a, b] = bichosEm(e, [2, 0], [4, 0]);
  const r = runa(e, 2, 0);
  Runas.vincular(e.hunt, ficha(e), r, e.hunt.clock, { preferido: a });
  assert.equal(r.alvo, a.uid);
  a.hp = 0;
  passar(e, 100);
  assert.equal(r.alvo, b.uid, 'vinculou ao outro, a 2 casas');
  b.hp = 0;
  passar(e, 100);
  assert.equal(r.alvo, null, 'solta');
  passar(e, 6000);
  assert.equal(Runas.ativas(e.hunt).length, 0, 'a duração solta acabou');
});

test('LIMITE: 3 Runas ativas no total (a mais velha sai); "Você pode Conjurar 2 Runas Adicionais" = 5; com todas em campo o automático não conjura (o clique, sim)', { skip: SEM }, async () => {
  const e = await bruxaCom(['Storm_Brand']);
  const [b] = bichosEm(e, [1, 0]);
  for (let i = 0; i < 4; i++) runa(e, 10 + i, 10);
  assert.equal(Runas.ativas(e.hunt).length, 3);
  const auto = usar(e, 0, b);
  assert.equal(auto.motivo, 'RUNAS_COMPLETAS', JSON.stringify(auto));
  assert.ok(usar(e, 0, b, true).ok, 'o clique conjura');
  alocar(e, /^runas_extras$/);
  for (let i = 0; i < 4; i++) runa(e, 10 + i, 12);
  assert.equal(Runas.ativas(e.hunt).length, 5);
});

test('1 Runa vinculada por inimigo; "Você pode ter uma Marca adicional Vinculada à um Inimigo" (Mesclador de Runas) deixa 2; a Maré Invernal tem 1 a mais', { skip: SEM }, async () => {
  const cena = async (comNo) => {
    const e = await bruxaCom(['Storm_Brand']);
    if (comNo) alocar(e, /^runas_por_inimigo_extra$/);
    const [b] = bichosEm(e, [2, 0]);
    const r1 = runa(e, 2, 0);
    const r2 = runa(e, 2, 0);
    Runas.vincular(e.hunt, ficha(e), r1, e.hunt.clock);
    Runas.vincular(e.hunt, ficha(e), r2, e.hunt.clock);
    return [r1.alvo, r2.alvo].filter((u) => u === b.uid).length;
  };
  assert.equal(await cena(false), 1);
  assert.equal(await cena(true), 2);
  assert.equal(Runas.porInimigo({ afPoe: {} }, { porInimigoExtra: 1 }), 2);
});

test('TROCA DE ALVO: "Runas se Vinculam a um novo Inimigo cada vez que se Ativam" (e a Runa Tempestuosa da Indecisão): depois de Ativar, vincula a outro', { skip: SEM }, async () => {
  const e = await bruxaCom(['Storm_Brand']);
  alocar(e, /^runas_trocam_alvo_s$/);
  const [a, b] = bichosEm(e, [2, 0], [3, 0]);
  const r = runa(e, 2, 0);
  Runas.vincular(e.hunt, ficha(e), r, e.hunt.clock, { preferido: a });
  passar(e, 50);
  assert.equal(r.alvo, b.uid, 'trocou para o outro');
});

test('"Recupera 10% de Mana quando uma Runa expira enquanto Vinculada"; "Inimigos sofrem Dano aumentado em 5% para cada uma de suas Runas Vinculadas a eles"', { skip: SEM }, async () => {
  const e = await bruxaCom(['Storm_Brand']);
  alocar(e, /^mana_runa_expira_vinculada$/);
  alocar(e, /^dano_por_runa_vinculada$/);
  const [b] = bichosEm(e, [2, 0]);
  const r = runa(e, 2, 0, { vinculadaMs: 400 });
  Runas.vincular(e.hunt, ficha(e), r, e.hunt.clock, { preferido: b });
  passar(e, 50);
  assert.equal(b.runasVinculadas, 1);
  const f = ficha(e);
  assert.ok(Math.abs(ModsPoe.fatorRecebidoPeloBicho(b, 'energy', f, e.hunt.clock) - 1.05) < 1e-9, 'o inimigo sofre 5% a mais');
  e.mana = 0;
  passar(e, 500);
  assert.equal(Runas.ativas(e.hunt).length, 0);
  assert.equal(e.mana, Math.round(e.maxMana * 0.1), 'a mana voltou');
  assert.equal(b.runasVinculadas, undefined);
});

test('no FIM do vínculo: "Runas têm 100% mais Frequência de Ativação se 75% …" (o intervalo cai à metade) e "Área de Efeito aumentada em 30% caso 50% …"', { skip: SEM }, async () => {
  // Ativada a cada 1 s, vinculada por 4 s: entre 3 s e 4 s (depois dos 75%), com o nó o intervalo cai para 0,5 s.
  const cena = async (comNo) => {
    const e = await bruxaCom(['Storm_Brand']);
    if (comNo) alocar(e, /^runa_frequencia_tardia_pct$/);
    const [b] = bichosEm(e, [2, 0]);
    const r = runa(e, 2, 0, { intervaloMs: 1000, vinculadaMs: 4000 });
    Runas.vincular(e.hunt, ficha(e), r, e.hunt.clock, { preferido: b });
    const cedo = passar(e, 3000).filter((x) => x.t === 'skill').length;
    const tarde = passar(e, 950).filter((x) => x.t === 'skill').length;
    return { cedo, tarde, b, r };
  };
  const sem = await cena(false);
  const com = await cena(true);
  assert.equal(sem.cedo, 3, 'a 1ª na hora, a de 1 s e a de 2 s');
  assert.equal(com.cedo, 3, 'antes dos 75%, igual');
  assert.equal(sem.tarde, 1, 'sem o nó: só a de 3 s');
  assert.equal(com.tarde, 2, 'com o nó: a de 3 s e a de 3,5 s');
  const { b, r } = com;
  const area = Runas.tique({ clock: 0, monstros: [b], runas: [{ ...r, alvo: b.uid, em: 0, proxima: 0, vinculadaPassou: 3000, vinculadaMs: 4000 }] }, { afPoe: { runa_area_tardia_pct: 30, runa_area_tardia_apos: 50 } }, 0, () => 0);
  assert.equal(area.ativar[0].areaExtra, 2, '30% → 1,2 casa (o sorteio 0 leva a fração)');
});

test('"Alcance do Vínculo de Runas aumentado": as 3 casas × o aumento', { skip: SEM }, () => {
  assert.equal(Runas.alcance({ afPoe: {} }), 3);
  assert.equal(Runas.alcance({ afPoe: { alcance_vinculo_runas: 50 } }), 5);
});

test('a ÁRVORE: as linhas de Runa têm efeito no balão; as de Vínculo seguem sem efeito, com o motivo (as gemas de Vínculo ainda não existem)', { skip: SEM }, () => {
  const linhas = P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i], nota: o.notas?.[i] }))));
  for (const re of [/^Alcance do Vínculo de Runas/, /Runas Adicionais$/, /^Runas se Vinculam a um novo Inimigo/, /quando uma Runa expira enquanto Vinculada$/, /Runas Vinculadas a eles$/, /^Você pode ter uma Marca adicional Vinculada/, /Frequência de Ativação se/, /caso \d+% da Duração do Vínculo tenha expirado$/]) {
    const achadas = linhas.filter((l) => re.test(l.t));
    assert.ok(achadas.length > 0, `há linha ${re}`);
    for (const l of achadas) assert.ok(['equivalente', 'novo', 'aproximado'].includes(l.estado), `${l.t}: ${l.estado}`);
  }
  const vinculo = linhas.filter((l) => /^Habilidades de Vínculo podem focar/.test(l.t));
  assert.ok(vinculo.length && vinculo.every((l) => l.estado === 'inerte' && /habilidades de Vínculo/.test(l.nota ?? '')));
});
