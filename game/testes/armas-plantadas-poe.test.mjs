// As ARMADILHAS e MINAS PLANTADAS do PoE (dono, 12/10: "Armadilhas e Minas plantadas — limite, duração, detonação") de ponta a ponta: a gema
// real na barra planta no alvo; a Armadilha ativa com o inimigo a 1 casa (na hora, com o alvo em cima), dura 4 s e tem limite; a Mina detona
// sozinha com você parado e um inimigo perto, na sequência de detonação; a magia em área do monstro as destrói; e os nós REAIS da árvore
// que mexem em cada coisa (os 34 que eram ✗ e os 3 aproximados que o plantio deixou exatos).
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
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');

/** Uma Bruxa com `gemas` encaixadas na varinha, na barra, numa caçada do PoE; `af`: atributos na varinha. */
async function bruxaCom(gemas, af = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const n = gemas.length;
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: n, links: Array.from({ length: Math.max(0, n - 1) }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 1, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  gemas.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  return e;
}
/**
 * Um bicho da caçada, parado em (dx, dy) de você, com muita vida; os outros longe. (17/10, dono: "Alvo sem mods no teste") o alvo é um bicho
 * NORMAL, sem mods de monstro — o teste mede o plantio e a ativação, não a defesa dele: o Mágico com "Resistência Física" (+50%) levava a
 * Armadilha Explosiva de nível 1 (5 de dano físico) ao teto de 90% de redução, e o dano saía 0 (~2% das sementes).
 */
function bichoEm(e, dx, dy) {
  const b = e.hunt.monstros.find((m) => (m.raridade ?? 'normal') === 'normal' && !m.mods?.length);
  assert.ok(b, 'há um bicho Normal na caçada');
  const outros = e.hunt.monstros.filter((m) => m !== b);
  for (const o of outros) Object.assign(o, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e9, maxHp: 1e9 });
  return b;
}
/** Usa o slot no alvo (com a conjuração, se tiver). Devolve os eventos. */
function usar(e, slot, alvo) {
  e.hunt.clock += 10_000;
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo, {});
  assert.ok(r.ok, r.erro);
  if (!r.conjurando) return r.eventos ?? [];
  e.hunt.clock += 3000;
  return Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM);
}
const danoEm = (eventos, b) => eventos.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + x.v, 0);
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const plantar = (e, tipo, slot, dx, dy, extra = {}) => Plantadas.plantar(e.hunt, ficha(e), { tipo, acao: e.actions[slot].id, slot, x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, z: e.hunt.z ?? 0, duracaoMs: tipo === 'mina' ? 5000 : 4000, detonacaoMs: 250, agora: e.hunt.clock, ...extra });

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

test('ARMADILHA: o arremesso planta no alvo; com o alvo em cima ela ativa na hora (o dano sai e nada fica plantado)', { skip: SEM }, async () => {
  const e = await bruxaCom(['Explosive_Trap']);
  const b = bichoEm(e, 1, 0);
  const ev = usar(e, 0, b);
  assert.ok(danoEm(ev, b) > 0, 'o dano da Armadilha Explosiva');
  assert.equal(Plantadas.plantadas(e.hunt).length, 0, 'ativou: não fica plantada');
});

test('ARMADILHA plantada longe: espera; o inimigo chega a 1 casa e ela ativa (do lugar dela); sem ninguém, acaba em 4 s', { skip: SEM }, async () => {
  const e = await bruxaCom(['Explosive_Trap']);
  const b = bichoEm(e, 6, 0);
  plantar(e, 'armadilha', 0, 2, 0);
  assert.deepEqual(Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []), [], 'ninguém perto: nada');
  assert.equal(Plantadas.plantadas(e.hunt).length, 1);
  Object.assign(b, { x: e.hunt.pos.x + 3, y: e.hunt.pos.y });
  const ev = Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []);
  assert.ok(danoEm(ev, b) > 0, 'o bicho a 1 casa ativa');
  assert.equal(Plantadas.plantadas(e.hunt).length, 0);
  plantar(e, 'armadilha', 0, 2, 2);
  e.hunt.clock += 4001;
  assert.equal(Plantadas.plantadas(e.hunt).length, 0, 'a duração acabou');
});

test('LIMITE: 15 Armadilhas e 15 Minas por vez (a mais velha sai); "Pode ter até 2 Armadilhas / 3 Minas Remotas adicionais plantadas por vez"', { skip: SEM }, async () => {
  const e = await bruxaCom(['Explosive_Trap', 'Stormblast_Mine']);
  bichoEm(e, 30, 30);
  for (let i = 0; i < 18; i++) plantar(e, 'armadilha', 0, 2 + (i % 5), 2 + Math.floor(i / 5));
  assert.equal(Plantadas.plantadas(e.hunt, 'armadilha').length, 15);
  alocar(e, /^max_armadilhas$/);
  for (let i = 0; i < 4; i++) plantar(e, 'armadilha', 0, 8, 8 + i);
  assert.equal(Plantadas.plantadas(e.hunt, 'armadilha').length, 17);
  const m = await bruxaCom(['Stormblast_Mine']);
  bichoEm(m, 30, 30);
  alocar(m, /^max_minas$/);
  for (let i = 0; i < 20; i++) plantar(m, 'mina', 0, 2 + (i % 5), 2 + Math.floor(i / 5));
  assert.equal(Plantadas.plantadas(m.hunt, 'mina').length, 18);
});

test('"Quando suas Armadilhas Ativarem, suas Armadilhas próximas também Ativam": a 3 casas, em cadeia; sem o nó, só a do inimigo', { skip: SEM }, async () => {
  const cena = async (comNo) => {
    const e = await bruxaCom(['Explosive_Trap']);
    if (comNo) alocar(e, /^armadilhas_ativam_proximas$/);
    bichoEm(e, 3, 0);
    plantar(e, 'armadilha', 0, 2, 0);
    plantar(e, 'armadilha', 0, 2, 3);
    Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []);
    return Plantadas.plantadas(e.hunt, 'armadilha').length;
  };
  assert.equal(await cena(false), 1, 'sem o nó: a de longe fica');
  assert.equal(await cena(true), 0, 'com o nó: as duas ativam');
});

test('ARMADILHAS a mais no arremesso: "5% de chance de arremessar até 4 Armadilhas adicionais" (as 4, em volta) e "arremessam até N" (sempre)', { skip: SEM }, async () => {
  const e = await bruxaCom(['Explosive_Trap']);
  alocar(e, /^armadilhas_extras_chance$/);
  const f = ficha(e);
  assert.equal(Plantadas.extrasDoArremesso(f, 'armadilha', () => 0), 4, 'na chance: as 4');
  assert.equal(Plantadas.extrasDoArremesso(f, 'armadilha', () => 0.99), 0, 'fora da chance: nenhuma');
  assert.equal(Plantadas.extrasDoArremesso(f, 'mina', () => 0), 0, 'só Armadilhas');
  assert.equal(Plantadas.extrasDoArremesso({ afPoe: { armadilhas_extras: 2 } }, 'armadilha', () => 0.99), 2);
  const casas = Plantadas.casasDoArremesso(10, 10, 4);
  assert.equal(casas.length, 5);
  assert.equal(new Set(casas.map((c) => `${c.x},${c.y}`)).size, 5, 'cada uma na sua casa');
});

test('MINA: detona sozinha com você parado e inimigo perto; andando, espera ("Detonar Minas é Ativado enquanto você se mover" detona)', { skip: SEM }, async () => {
  const e = await bruxaCom(['Stormblast_Mine']);
  const b = bichoEm(e, 4, 0);
  e.hunt.poeRecente = { ...(e.hunt.poeRecente ?? {}), moveu: e.hunt.clock };
  plantar(e, 'mina', 0, 3, 0);
  assert.equal(danoEm(Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []), b), 0, 'andando: não detona');
  e.hunt.clock += 1000;
  assert.ok(danoEm(Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []), b) > 0, 'parado: detona');
  const m = await bruxaCom(['Stormblast_Mine']);
  alocar(m, /^detonar_minas_movendo$/);
  const b2 = bichoEm(m, 4, 0);
  m.hunt.poeRecente = { ...(m.hunt.poeRecente ?? {}), moveu: m.hunt.clock };
  plantar(m, 'mina', 0, 3, 0);
  assert.ok(danoEm(Acoes.tiqueDasPlantadas(m, m.hunt, PERSONAGEM, []), b2) > 0, 'com o nó: detona andando');
});

test('SEQUÊNCIA DE DETONAÇÃO: a 1ª na hora, cada seguinte depois do tempo de detonação ÷ (1 + 10% × as anteriores); "Velocidade de Detonação aumentada" encurta', { skip: SEM }, async () => {
  const cena = async (comNo) => {
    const e = await bruxaCom(['Stormblast_Mine']);
    if (comNo) alocar(e, /^velocidade_detonacao$/);
    bichoEm(e, 4, 0);
    const t0 = e.hunt.clock;
    for (let i = 0; i < 3; i++) plantar(e, 'mina', 0, 3, 0, { agora: t0 + i });
    const agora = Plantadas.minasQueDetonam(e.hunt, ficha(e), t0 + 2);
    assert.equal(agora.length, 1, 'a primeira, na hora');
    return Plantadas.plantadas(e.hunt, 'mina', t0 + 2).map((p) => p.detonaEm - (t0 + 2)).sort((a, b) => a - b);
  };
  const sem = await cena(false);
  assert.deepEqual(sem, [0, Math.round(250 / 1.1), Math.round(250 / 1.1) + Math.round(250 / 1.2)]);
  const com = await cena(true);
  assert.ok(com[1] < sem[1] && com[2] < sem[2], `${sem} → ${com}`);
});

test('DURAÇÃO: a da gema (Armadilha 4 s, Mina 5 s); "Duração da Mina aumentada em 30%" = 6,5 s; o tempo de detonação vem da gema', { skip: SEM }, async () => {
  const e = await bruxaCom(['Stormblast_Mine']);
  assert.equal(Plantadas.duracaoMs(ficha(e), 'mina', G.compilada('Stormblast_Mine', 1)?.stats?.duracaoObjeto), 5000);
  assert.equal(Plantadas.duracaoMs(ficha(e), 'armadilha', G.compilada('Explosive_Trap', 1)?.stats?.duracaoObjeto), 4000);
  assert.equal(Plantadas.detonacaoDaGema(G.doSlug('Stormblast_Mine').gema.mods), 250);
  assert.equal(Plantadas.detonacaoDaGema(G.doSlug('Pyroclast_Mine').gema.mods), 350);
  alocar(e, /^duracao_mina$/);
  assert.equal(Plantadas.duracaoMs(ficha(e), 'mina', 5), 6500);
});

test('a magia em ÁREA do monstro destrói as plantadas que pega; "Armadilhas/Minas não podem ser Danificadas" impede', { skip: SEM }, async () => {
  const e = await bruxaCom(['Explosive_Trap', 'Stormblast_Mine']);
  const b = bichoEm(e, 30, 30);
  e.hunt.poeRecente = { ...(e.hunt.poeRecente ?? {}), moveu: e.hunt.clock };
  plantar(e, 'armadilha', 0, 1, 1);
  plantar(e, 'mina', 1, 1, 0);
  Object.assign(b, { x: e.hunt.pos.x + 2, y: e.hunt.pos.y + 2 });
  const casas = [{ x: e.hunt.pos.x + 1, y: e.hunt.pos.y + 1 }, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y }];
  assert.equal(Plantadas.destruirNaArea(e.hunt, casas, ficha(e)), 2);
  assert.equal(Plantadas.plantadas(e.hunt).length, 0);
  for (const re of [/^armadilhas_indestrutiveis$/, /^minas_indestrutiveis$/]) alocar(e, re);
  plantar(e, 'armadilha', 0, 1, 1);
  plantar(e, 'mina', 1, 1, 0);
  assert.equal(Plantadas.destruirNaArea(e.hunt, casas, ficha(e)), 0);
  assert.equal(Plantadas.plantadas(e.hunt).length, 2);
});

test('"Habilidades que Arremessam Armadilhas têm +1 Uso de Recarga": a Armadilha de Urso (3 usos) fica com 4', { skip: SEM }, async () => {
  const e = await bruxaCom(['Bear_Trap']);
  const entry = Acoes.catalogo(e).spells.find((a) => a.id === e.actions[0].id);
  const antes = Acoes.temposDaGemaPoe(e, entry).cargas;
  alocar(e, /^usos_recarga@armadilha$/);
  assert.equal(Acoes.temposDaGemaPoe(e, entry, undefined, ficha(e)).cargas, antes + 1);
});

test('ATIVAR/DETONAR uma vez adicional (exato agora): "10% de Chance das Armadilhas Ativarem uma vez adicional" — a habilidade sai duas vezes do mesmo lugar', { skip: SEM }, async () => {
  const cena = async (comNo) => {
    const e = await bruxaCom(['Explosive_Trap']);
    if (comNo) alocar(e, /^armadilha_ativa_de_novo$/);
    bichoEm(e, 3, 0);
    plantar(e, 'armadilha', 0, 2, 0);
    const original = Math.random;
    Math.random = () => 0;
    try { return Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []).filter((x) => x.t === 'skill').length; } finally { Math.random = original; }
  };
  assert.equal(await cena(false), 1);
  assert.equal(await cena(true), 2);
});

test('"Minas Desaceleram Inimigos próximos delas por 2 segundos quando são Plantadas" (exato agora): ao plantar, os a até 3 casas da Mina', { skip: SEM }, async () => {
  const e = await bruxaCom(['Stormblast_Mine']);
  alocar(e, /^minas_desaceleram_s$/);
  const b = bichoEm(e, 1, 0);
  const ev = usar(e, 0, b);
  assert.ok((b.estados?.lento?.ate ?? 0) > e.hunt.clock, 'desacelerado');
  // (a Mina usada pela barra, com o alvo perto e você parado, detona na hora — e marca o "Detonou uma Mina Recentemente")
  assert.ok(danoEm(ev, b) > 0, 'detonou');
  assert.equal(e.hunt.poeRecente?.detonouMina, e.hunt.clock);
  assert.equal(Plantadas.plantadas(e.hunt).length, 0);
});

test('a ÁRVORE: as 34 linhas de Armadilhas e Minas (e as 3 que eram aproximadas) têm efeito no balão', { skip: SEM }, () => {
  const textos = [/plantadas por vez$/, /^Armadilhas não podem ser Danificadas$/, /^Minas não podem ser Danificadas$/, /^Detonar Minas é Ativado enquanto você se mover$/, /^Minas tem Velocidade de Detonação/, /^Duração da Mina aumentada/,
    /^Quando suas Armadilhas Ativarem/, /Uso de Recarga$/, /arremessar até \d+ Armadilhas adicionais$/, /Ativarem uma vez adicional$/, /Detonadas uma Vez Adicional$/, /quando são Plantadas$/];
  const linhas = P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i] }))));
  for (const re of textos) {
    const achadas = linhas.filter((l) => re.test(l.t));
    assert.ok(achadas.length > 0, `há linha ${re}`);
    for (const l of achadas) assert.ok(['equivalente', 'novo', 'aproximado'].includes(l.estado), `${l.t}: ${l.estado}`);
  }
});
