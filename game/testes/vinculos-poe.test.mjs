// Os VÍNCULOS do PoE (dono, 12/10: "Criar igual ao PoE") de ponta a ponta: as 6 gemas de Vínculo, que o jogo não tinha, focam um jogador da
// party na sala (um lacaio, com o nó da árvore), custam mana por segundo, quebram fora do alcance e — "se o alvo morrer enquanto vinculado,
// você também morrerá"; os efeitos de cada gema no alvo e os nós REAIS da árvore de cada linha de Vínculo.
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
const Vinculos = await import('../systems/itens-poe/vinculos.mjs');
const ModsPoe = await import('../systems/itens-poe/condicoes-poe.mjs');

/** Uma Bruxa (com `gemas` na varinha e na barra) numa caçada do PoE. */
async function bruxaCom(gemas = []) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const n = gemas.length;
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: Math.max(1, n), links: Array.from({ length: Math.max(0, n - 1) }, () => true), gemas: Array(Math.max(1, n)).fill(null), cores: Array(Math.max(1, n)).fill('W') };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 1, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  gemas.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 100_000;
  e.maxHp = e.hp = 10_000;
  P.garantir(e);
  return e;
}
/** A party: `dono` e os `aliados` na mesma sala, a `dx` casas dele; um bicho perto do dono (os Vínculos saem em combate). */
function party(dono, aliados, dx = 2) {
  const membros = [{ estado: dono, nome: 'Ana' }, ...aliados.map((a, i) => ({ estado: a, nome: `Amiga${i}` }))];
  const naSala = membros.map((m) => m.estado);
  aliados.forEach((a, i) => { a.hunt.pos = { ...dono.hunt.pos, x: dono.hunt.pos.x + dx + i }; a.hunt.z = dono.hunt.z; a.hunt.clock = dono.hunt.clock; });
  for (const m of membros) m.estado.hunt.partilha = { ativa: true, bonus: 1, membros, naSala };
  const [b, ...outros] = dono.hunt.monstros;
  for (const o of outros) Object.assign(o, { x: dono.hunt.pos.x + 60, y: dono.hunt.pos.y + 60 });
  Object.assign(b, { x: dono.hunt.pos.x - 2, y: dono.hunt.pos.y, hp: 1e9, maxHp: 1e9 });
  return b;
}
function usar(e, slot) {
  e.hunt.clock += 10_000;
  for (const m of e.hunt.partilha?.naSala ?? []) m.hunt.clock = e.hunt.clock;
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, null, {});
  if (!r.ok || !r.conjurando) return r;
  e.hunt.clock += 2000;
  for (const m of e.hunt.partilha?.naSala ?? []) m.hunt.clock = e.hunt.clock;
  return { ok: true, eventos: Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) };
}
const af = (e) => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
function passar(e, ms) {
  for (let t = 0; t < ms; t += 250) {
    e.hunt.clock += 250;
    for (const m of e.hunt.partilha?.naSala ?? []) if (m !== e) m.hunt.clock = e.hunt.clock;
    Acoes.tiqueDosVinculos(e, e.hunt, PERSONAGEM, []);
  }
}
/** Aloca o nó (principal, maestria ou ascendência) com um efeito cuja chave casa `re`. */
function alocar(e, re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  let no = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  let opcao = null;
  if (!no) for (const n of arv.nos.filter((x) => x.tipo === 'mastery' && !x.ascendencia)) { const o = (n.opcoes ?? []).find((x) => tem(x.efeitos)); if (o) { no = n; opcao = o.id; break; } }
  assert.ok(no, `há nó com ${re}`);
  const ate = no.tipo === 'mastery' ? arv.nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia).id : no.id;
  const caminho = P.caminhoAte(e, ate);
  const antes = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
  if (antes.length) assert.equal(Comandos.comando(e, { action: 'alocar', ids: antes }).feitos, antes.length);
  assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id, ...(opcao ? { opcao } : {}) }).ok);
  Ficha.invalidar(e);
}

test('as 6 GEMAS de Vínculo existem: Flamejante, Protetor, D\'Alma, Destrutivo e Vampírico funcionam; o Intuitivo é parcial (as magias ativadas pelos acertos do alvo)', { skip: SEM }, async () => {
  await bruxaCom();
  for (const s of ['Flame_Link', 'Protective_Link', 'Soul_Link', 'Destructive_Link', 'Vampiric_Link']) assert.equal(G.doSlug(s).statusNoJogo, 'funciona', s);
  assert.equal(G.doSlug('Intuitive_Link').statusNoJogo, 'parcial');
  assert.equal(G.doSlug('Flame_Link').arquetipo, 'vinculo');
});

test('sem aliado não sai; com um jogador da party perto, o VÍNCULO FLAMEJANTE dá a ele o Fogo adicional (+ 5% da sua vida) e custa mana por segundo', { skip: SEM }, async () => {
  const ana = await bruxaCom(['Flame_Link']);
  const sozinha = usar(ana, 0);
  assert.equal(sozinha.motivo, 'SEM_ALIADO', JSON.stringify(sozinha));
  const amiga = await bruxaCom();
  party(ana, [amiga]);
  const antes = af(amiga).added_fire_dmg_min ?? 0;
  const r = usar(ana, 0);
  assert.ok(r.ok, r.erro);
  const [lk] = Vinculos.vinculos(ana.hunt);
  assert.deepEqual(lk.alvos.map((a) => a.nome), ['Amiga0']);
  const e = lk.efeitos;
  assert.ok(Math.abs((af(amiga).added_fire_dmg_min ?? 0) - antes - (e.fogoMin + ana.maxHp * 0.05)) < 1e-6, 'o Fogo da gema + 5% da vida de quem vincula');
  const mana = ana.mana;
  passar(ana, 1000);
  assert.equal(mana - ana.mana, lk.custoPorSegundo, 'um segundo de custo');
  ana.mana = 0;
  passar(ana, 1000);
  assert.equal(Vinculos.vinculos(ana.hunt).length, 0, 'sem mana, o Vínculo acaba');
});

test('QUEBRA fora do alcance em 4 s ("Vínculos demoram duas vezes mais para quebrar": 8 s); o alvo MORRE vinculado: você também morre', { skip: SEM }, async () => {
  const cena = async (comNo) => {
    const ana = await bruxaCom(['Soul_Link']);
    if (comNo) alocar(ana, /^vinculo_quebra_dobro$/);
    const amiga = await bruxaCom();
    party(ana, [amiga]);
    assert.ok(usar(ana, 0).ok);
    amiga.hunt.pos = { ...amiga.hunt.pos, x: ana.hunt.pos.x + 30 };
    passar(ana, 4250);
    return Vinculos.vinculos(ana.hunt).length;
  };
  assert.equal(await cena(false), 0, 'quebrou em 4 s');
  assert.equal(await cena(true), 1, 'com o nó, ainda não');
  const ana = await bruxaCom(['Soul_Link']);
  const amiga = await bruxaCom();
  party(ana, [amiga]);
  assert.ok(usar(ana, 0).ok);
  amiga.hp = 0;
  passar(ana, 250);
  assert.equal(ana.hp, 0, '"se o alvo morrer enquanto vinculado, você também morrerá"');
});

test('VÍNCULO D\'ALMA: o alvo sofre X% menos dano e 30% do acerto nele sai do SEU Escudo de Energia; PROTETOR: o bloqueio dele igual ao seu; DESTRUTIVO: o crítico igual ao seu e + Multiplicador', { skip: SEM }, async () => {
  const ana = await bruxaCom(['Soul_Link', 'Protective_Link', 'Destructive_Link']);
  const amiga = await bruxaCom();
  party(ana, [amiga]);
  const alma = usar(ana, 0);
  assert.ok(alma.ok, alma.erro);
  const lkAlma = Vinculos.vinculos(ana.hunt)[0];
  assert.equal(af(amiga).dano_recebido_mais, -lkAlma.efeitos.menosDano);
  ana.es = 500;
  assert.equal(Vinculos.desviarParaOEscudo(amiga, 100), 70);
  assert.equal(ana.es, 470);
  // o Protetor e o Destrutivo: num segundo aliado (1 Vínculo por alvo)
  const bia = await bruxaCom();
  party(ana, [amiga, bia]);
  bia.hunt.pos = { ...amiga.hunt.pos };
  amiga.hunt.pos = { ...amiga.hunt.pos, x: ana.hunt.pos.x + 40 };
  assert.ok(usar(ana, 1).ok, 'o Protetor vai na Bia (a Amiga já tem um Vínculo e está longe)');
  const fAna = ficha(ana);
  assert.ok(Math.abs(ficha(bia).blockChance - Math.min(fAna.blockChance, 1)) < 0.002, `${ficha(bia).blockChance} × ${fAna.blockChance}`);
  ana.hunt.vinculos = [];
  assert.ok(usar(ana, 2).ok);
  const fBia = ficha(bia);
  assert.ok(Math.abs(fBia.critChance - fAna.critChance) < 0.002, 'o crítico igual ao seu');
  assert.ok((fBia.afPoe.crit_dmg ?? 0) >= Vinculos.vinculos(ana.hunt)[0].efeitos.critMult);
});

test('VÍNCULO VAMPÍRICO: a vida que o SEU Dreno recupera vai para o alvo vinculado', { skip: SEM }, async () => {
  const ana = await bruxaCom(['Vampiric_Link']);
  const amiga = await bruxaCom();
  party(ana, [amiga]);
  assert.ok(usar(ana, 0).ok);
  ana.hp = 5000;
  amiga.hp = 1000;
  ana.hunt.roubos = [{ recurso: 'vida', restante: 300, porSegundo: 300 }];
  Ficha.recuperarRoubo(ana, 1000);
  assert.equal(ana.hp, 5000, 'você não recupera');
  assert.ok(amiga.hp > 1000, `o alvo recupera (${amiga.hp})`);
});

test('"Habilidades de Vínculo podem focar em Lacaios Danificáveis": sem o nó, o lacaio não é alvo; com o nó, é — e o Vínculo D\'Alma nele (menos dano)', { skip: SEM }, async () => {
  const ana = await bruxaCom(['Soul_Link']);
  party(ana, []);
  ana.hunt.lacaios = [{ uid: 'lacaio:t1', x: ana.hunt.pos.x + 1, y: ana.hunt.pos.y, hp: 100, maxHp: 100, tipo: 'lacaio' }];
  assert.equal(usar(ana, 0).motivo, 'SEM_ALIADO');
  alocar(ana, /^vinculo_em_lacaios$/);
  assert.ok(usar(ana, 0).ok);
  const no = Vinculos.doLacaio(ana.hunt, ana.hunt.lacaios[0]);
  assert.ok(no.menosDano > 0 && no.escudoPct === 30);
});

/** Uma Ana (com a gema de Vínculo e os nós `nos`) e duas amigas na sala, o Vínculo já conjurado. */
async function cenaDaArvore(nos, gema = 'Flame_Link') {
  const ana = await bruxaCom([gema]);
  for (const re of nos) alocar(ana, re);
  const amiga = await bruxaCom();
  const bia = await bruxaCom();
  const bicho = party(ana, [amiga, bia]);
  ana.hunt.cargasPoe = { frenesi: { n: 3, ate: ana.hunt.clock + 60_000 } };
  assert.ok(usar(ana, 0).ok);
  passar(ana, 250);
  return { ana, amiga, bia, bicho, lk: Vinculos.vinculos(ana.hunt)[0] };
}

test('a ÁRVORE nos Vínculos (cada opção da Maestria de Vínculos num personagem — uma opção por maestria, como no PoE): o alvo aleatório a mais, as cargas, a velocidade, a Exposição, o feixe', { skip: SEM }, async () => {
  assert.equal((await cenaDaArvore([])).lk.alvos.length, 1);
  assert.equal((await cenaDaArvore([/^vinculo_alvos_extra$/])).lk.alvos.length, 2, '1 alvo aleatório a mais');
  // "Alvos Vinculados compartilham Cargas…": as cargas de quem vincula valem no alvo
  const c = await cenaDaArvore([/^vinculo_compartilha_cargas$/]);
  const alvoDasCargas = Vinculos.resolver(c.ana.hunt, c.lk.alvos[0]);
  assert.ok(Object.keys(c.lk.foto.cargas ?? {}).length > 0, 'a foto traz as cargas');
  for (const [k, n] of Object.entries(c.lk.foto.cargas)) assert.ok((af(alvoDasCargas)[k] ?? 0) >= n, k);
  // "Sua Velocidade de Movimento é igual a maior … entre os Jogadores Vinculados"
  const vel = await cenaDaArvore([/^velocidade_igual_vinculados$/]);
  assert.equal(ficha(vel.ana).speed, Math.round(Math.max(...vel.lk.alvos.map((a) => Ficha.combate(Vinculos.resolver(vel.ana.hunt, a)).speed))));
  // a Exposição nos inimigos perto do alvo
  const ex = await cenaDaArvore([/^vinculo_exposicao_proximos$/]);
  const alvoEx = Vinculos.resolver(ex.ana.hunt, ex.lk.alvos[0]);
  Object.assign(ex.bicho, { x: alvoEx.hunt.pos.x + 1, y: alvoEx.hunt.pos.y });
  passar(ex.ana, 250);
  assert.ok(ex.bicho.estados?.exposicao?.fire > ex.ana.hunt.clock, 'exposto ao Fogo');
  // o feixe: o bicho na reta entre você e o alvo
  const fx = await cenaDaArvore([/^feixe_sem_afeccao$/]);
  const alvoFx = Vinculos.resolver(fx.ana.hunt, fx.lk.alvos[0]);
  alvoFx.hunt.pos = { ...alvoFx.hunt.pos, x: fx.ana.hunt.pos.x + 3, y: fx.ana.hunt.pos.y };
  passar(fx.ana, 250);
  assert.equal(Vinculos.noFeixe(fx.ana.hunt, { x: fx.ana.hunt.pos.x + 1, y: fx.ana.hunt.pos.y }), true);
  assert.equal(Vinculos.noFeixe(fx.ana.hunt, { x: fx.ana.hunt.pos.x, y: fx.ana.hunt.pos.y + 5 }), false);
  assert.equal(Vinculos.noFeixe(ex.ana.hunt, { x: ex.ana.hunt.pos.x + 1, y: ex.ana.hunt.pos.y }), false, 'sem a opção, nada');
});

test('a ÁRVORE nos Vínculos (os notáveis): "Velocidade de Movimento aumentada em 10% enquanto … dois alvos Vinculados", "Maldições são infligidas em Você…" e o efeito por metade da duração', { skip: SEM }, async () => {
  const semNo = await cenaDaArvore([/^vinculo_alvos_extra$/]);
  const com = await cenaDaArvore([/^vinculo_alvos_extra$/, /^vinculos2_move_speed$/, /^maldicoes_em_voce_vinculo$/]);
  assert.equal(com.lk.alvos.length, 2);
  assert.ok(ficha(com.ana).speed > ficha(semNo.ana).speed, 'mais rápida com dois alvos');
  const alvo = Vinculos.resolver(com.ana.hunt, com.lk.alvos[0]);
  ModsPoe.amaldicoarJogador(alvo.hunt, 'teste', { nome: 'Vulnerabilidade', af: { dano_physical_recebido_inc: 20 } });
  assert.ok(com.ana.hunt.maldicoesNoJogador?.teste, 'a maldição veio para quem vincula');
  assert.equal(alvo.hunt.maldicoesNoJogador?.teste, undefined);
  const lk = { ...com.lk, foto: { ...com.lk.foto, efeitoPct: 0, porMetadePct: 20 } };
  assert.ok(Math.abs(Vinculos.fatorDoEfeito(lk, lk.desde + (lk.ate - lk.desde) / 2) - 1.2) < 1e-9, '+20% na metade da duração');
});

test('"Defesas aumentadas em 25% enquanto você tiver ao menos quatro alvos Vinculados": com 4 (de duas gemas), Armadura, Evasão e Escudo; com 3, nada', { skip: SEM }, () => {
  const lk = (n) => ({ ate: 10_000, desde: 0, alvos: Array.from({ length: n }, (_, i) => ({ tipo: 'lacaio', uid: `l${i}` })), foto: { defesas4: 25 } });
  const estado = (lks) => ({ hunt: { clock: 0, vinculos: lks } });
  assert.deepEqual(Vinculos.addsDosVinculos(estado([lk(2), lk(2)])), { armour_pct: 25, evasion_pct: 25, es_pct: 25 });
  assert.equal(Vinculos.addsDosVinculos(estado([lk(2), lk(1)])), null);
});

test('a ÁRVORE: as 33 linhas de Vínculo têm efeito no balão', { skip: SEM }, () => {
  const linhas = P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i] }))));
  for (const re of [/^Habilidades de Vínculo podem focar em Lacaios/, /Feixes de Vínculo/, /alvos Vinculados têm Exposição/, /^Vínculos demoram/, /alvo aleatório adicional$/, /^Alvos Vinculados compartilham/, /entre os Jogadores Vinculados$/, /quatro alvos Vinculados$/, /dois alvov?s Vinculados$/, /Duração do Vínculo que tenha Expirado$/, /ao invés dos alvos Vinculados$/]) {
    const achadas = linhas.filter((l) => re.test(l.t));
    assert.ok(achadas.length > 0, `há linha ${re}`);
    for (const l of achadas) assert.ok(['equivalente', 'novo', 'aproximado'].includes(l.estado), `${l.t}: ${l.estado}`);
  }
});
