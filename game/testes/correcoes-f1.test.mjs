// (revisão F1, 27/10) As correções da revisão dos lotes E2a, E2b e D1 (as ATIVAS), pelo PoE 1 (o PoB): o Castigo na fileira do combo, o Solo Eletrizado no mapa sem
// Eletrização, o impacto do Zumbi da Queda com o que o golpe do lacaio leva, a Oferenda que vence contra as magias, a Armadilha de Lâminas ativada uma vez, o Carne e
// Pedra só no acerto e com todo o Efeito de Aura (decisão do dono) e a chance de Eletrizar da aura do Castigo. Os sorteios ficam travados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Combo = await import('../systems/combo.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const E2b = await import('../systems/itens-poe/gemas-e2b.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const Cond = await import('../systems/itens-poe/condicoes-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com as gemas (cada uma solta) na arma, na barra em ordem, numa caçada; o alvo imortal a (dx, 0) e os outros longe. */
async function montar(slugs, { nivel = 20, qualidade = 0, arma = 'Daggers/Sai', dx = 1, vocacao = 'knight', classePoe = 'Scion' } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const lista = [slugs].flat();
  const e = Object.assign(personagemDeTeste({ vocacao, level: 90 }), { classePoe, sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: lista.length, links: lista.slice(1).map(() => false), gemas: lista.map(() => null), cores: lista.map(() => 'W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  const itemDe = (s) => G.doSlug(s)?.itemId ?? [...GS.DEFS.values()].find((d) => d.poe?.slug === s)?.itemId;
  e.inventory = lista.map((s) => GS.itemDaGema({ id: itemDe(s), nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < lista.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  lista.forEach((s, i) => { if (G.doSlug(s)) e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 10_000;
  e.maxHp = e.hp = 100_000;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });
  return { e, b, resto };
}
function usar(e, b, slot = 0, v = 0.5) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; return { ...x, eventos: [...(x.eventos ?? []), ...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])] }; }
    return x;
  });
}
const id = (slug) => G.doSlug(slug).acao;
const golpesDeLacaio = (ev) => (ev ?? []).filter((x) => x.t === 'dmg' && x.lacaio);

test('F1: o Castigo e o Castigo Vaal ficam na fileira do COMBO (o uso é o ataque corpo a corpo), não no sustento', { skip: SEM }, async () => {
  const { e } = await montar(['Smite', 'Vaal_Smite', 'Cleave', 'Flesh_and_Stone'], { arma: 'One_Hand_Maces/Driftwood_Club' });
  assert.deepEqual(Acoes.POR_ID_PUBLICO(id('Smite')).papeis, ['suporte'], 'na entrada segue de suporte (a troca é no disparo)');
  assert.equal(Combo.ehDoCombo(e, 0), true, 'o Castigo');
  assert.equal(Combo.ehDoCombo(e, 1), true, 'o Castigo Vaal');
  assert.equal(Combo.ehDoCombo(e, 2), true, 'a Clivagem');
  assert.equal(Combo.ehDoCombo(e, 3), false, 'a aura segue no sustento');
  assert.deepEqual(Combo.slotsDoCombo(e), [0, 1, 2]);
  // juntando monstros (a "lura"), o combo não dispara nada — o Castigo também fica parado
  e.hunt.lurando = true;
  assert.deepEqual(Combo.tiqueDoCombo(e, e.hunt, PERSONAGEM) ?? [], []);
});

test('F1: o Solo Eletrizado da Relampejante Vaal não Eletriza o monstro imune (o mapa "não são Afetados por Eletrizações")', { skip: SEM }, () => {
  const solos = [{ ate: 10_000, casas: ['5,5'], efeitoPct: 15, z: 0 }];
  const imune = { hp: 10, x: 5, y: 5, z: 0, imuneChoque: true };
  const comum = { hp: 10, x: 5, y: 5, z: 0 };
  assert.equal(E2b.eletrizarNoSolo([imune], solos, 1000), 0);
  assert.equal(imune.estados?.chocado, undefined);
  assert.equal(E2b.eletrizarNoSolo([comum], solos, 1000), 1);
  assert.equal(comum.estados.chocado.pct, 15);
});

/** Uma Bruxa numa caçada, com um bicho colado e um Zumbi da Queda caindo nele. */
async function quedaNaCacada() {
  const { e, b, resto } = await montar('Raise_Zombie_of_Falling', { arma: 'Wands/Driftwood_Wand', dx: 2, vocacao: 'sorcerer', classePoe: 'Witch' });
  const h = e.hunt;
  h.monstros = [b, ...resto.slice(0, 0)];
  const q = LacaiosPoe.oQueInvoca('Raise_Zombie_of_Falling', 20, { nivel: 20, qualidade: 0 }, {});
  const l = { ...q, uid: 'z1', gema: 'Raise_Zombie_of_Falling', tipo: 'lacaio', x: b.x, y: b.y, hp: q.vida, maxHp: q.vida, proximoGolpe: 0, alcanceDeAtaque: 1, perto: 6, acertos: 0 };
  h.lacaios = [l];
  return { e, h, b, l };
}

test('F1: o impacto do Zumbi da Queda leva as suas auras de aliado (o "aumentado" e o "mais"), como o golpe comum do lacaio', { skip: SEM }, async () => {
  const { e, h, b, l } = await quedaNaCacada();
  const ficha = Ficha.combate(e);
  const impacto = (opcoes) => {
    b.hp = 1e12;
    const ev = travado(0.99, () => Cacadas.impactoDaQueda(e, h, l, ficha, PERSONAGEM, Date.now(), opcoes));
    const g = golpesDeLacaio(ev);
    assert.equal(g.length, 1, JSON.stringify(ev));
    return g[0].v;
  };
  const sem = impacto({});
  const aliado = { danoIncPct: 50, maisDanoPct: 20, res: 0, bloqueio: 0, velPct: 0 };
  const com = impacto({ aliado });
  const inc = l.poe?.danoIncPct ?? 0;
  const esperado = ((1 + (inc + 50) / 100) / (1 + inc / 100)) * 1.2;
  assert.ok(Math.abs(com / sem - esperado) < 0.01, `${com} / ${sem} ≠ ${esperado}`);
  // e o crítico da Oferenda Espiritual: "sempre crítico" pelo multiplicador dela (a chance de 100% com o sorteio 0,99)
  const oferenda = { critPct: 100, critMult: 100, ate: Date.now() + 60_000 };
  const critico = LacaiosPoe.criticoDoLacaio(l, oferenda, h.clock);
  if (critico.chance > 99) {
    const ev = travado(0.99, () => Cacadas.impactoDaQueda(e, h, l, ficha, PERSONAGEM, Date.now(), { oferenda }));
    assert.equal(golpesDeLacaio(ev)[0].crit, true, 'com a Oferenda, o impacto pode ser crítico');
  }
});

test('F1: a Oferenda Óssea vencida não bloqueia mais as MAGIAS dos monstros no lacaio (o fim no relógio de parede)', { skip: SEM }, async () => {
  const { e, h, b } = await quedaNaCacada();
  const q = LacaiosPoe.oQueInvoca('Raise_Zombie', 20, { nivel: 20, qualidade: 0 }, {});
  const l = { ...q, uid: 'l1', gema: 'Raise_Zombie', tipo: 'lacaio', x: b.x - 1, y: b.y, hp: 1e9, maxHp: 1e9, proximoGolpe: 0, alcanceDeAtaque: 1, perto: 6, acertos: 0 };
  h.lacaios = [l];
  h.ultimoTique = Date.now();
  h.clock = 5_000; // o relógio da caçada é pequeno; o `ate` da Oferenda é de parede
  const magia = () => {
    l.hp = 1e9;
    travado(0.01, () => Cacadas.magiaNoLacaio({ estado: e, hunt: h, bicho: b, l, a: { elemento: 'fire', min: 1000, max: 1000 }, eventos: [], agora: h.clock, ficha: Ficha.combate(e) }));
    return 1e9 - l.hp;
  };
  l.oferenda = { bloqueioMagicoPct: 100, ate: Date.now() + 60_000 };
  assert.equal(magia(), 0, 'ligada: bloqueia (o sorteio 0,01)');
  l.oferenda = { bloqueioMagicoPct: 100, ate: Date.now() - 1000 };
  assert.ok(magia() > 0, 'vencida: a magia fere o lacaio');
});

test('F1: a Armadilha de Lâminas ativada dispara o "quando sua Armadilha for ativada por um Inimigo" UMA vez (não em cada giro)', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Blade_Trap');
  Object.assign(resto[0], { x: b.x, y: b.y + 1, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });
  assert.ok(usar(e, b).ok);
  const t = e.hunt.poeTorres?.find((x) => x.girosD1);
  assert.ok(t, 'a Armadilha que gira');
  const eventos = () => (e.hunt.poeUsosRecentes?.['ev.armadilha'] ?? []).length;
  assert.equal(eventos(), 1, 'a ativação');
  e.hunt.clock = t.ate + 10;
  travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock));
  assert.ok(!(e.hunt.poeTorres ?? []).some((x) => x.girosD1), 'girou tudo');
  assert.equal(eventos(), 1, '4 giros × 2 inimigos: nenhum evento a mais');
});

test('F1: o Carne e Pedra (Postura de Sangue) é "mais Dano Físico dos ACERTOS" — não vale no pulso do Sangramento', { skip: SEM }, () => {
  const m = { hp: 10, estados: { carneEPedraD1: { ate: 1000, sanguePct: 20 } } };
  const limpo = { hp: 10, estados: {} };
  assert.ok(Math.abs(Cond.fatorRecebidoPeloBicho(m, 'physical', { afPoe: {}, tagsDoGolpe: ['ataque'] }, 0) / Cond.fatorRecebidoPeloBicho(limpo, 'physical', { afPoe: {}, tagsDoGolpe: ['ataque'] }, 0) - 1.2) < 1e-9, 'no acerto, 20% mais');
  assert.equal(Cond.fatorRecebidoNoDot(m, 'physical', 0), Cond.fatorRecebidoNoDot(limpo, 'physical', 0), 'no dano contínuo, nada');
  assert.equal(Cond.fatorRecebidoNoDot(m, 'physical', 0, { efeito_definhamento: 10 }), Cond.fatorRecebidoNoDot(limpo, 'physical', 0, { efeito_definhamento: 10 }));
});

test('F1: o Carne e Pedra escala com TODO o Efeito de Aura (decisão do dono — o da árvore e das peças, como as outras auras)', { skip: SEM }, async () => {
  const { e, b } = await montar('Flesh_and_Stone', { arma: 'Wands/Driftwood_Wand' });
  assert.ok(usar(e, b).ok);
  Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.equal(b.estados.carneEPedraD1.sanguePct, 20, 'sem nada: 20% no nível 20');
  const arma = e.equipment.weapon;
  arma.poe = { ...(arma.poe ?? {}), af: { ...(arma.poe?.af ?? {}), 'efeito_buff_gema:aura': 50 } };
  Ficha.invalidar(e);
  Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.ok(Math.abs(b.estados.carneEPedraD1.sanguePct - 30) < 1e-9, `50% de Efeito de Aura: 20 × 1,5 = 30 (${b.estados.carneEPedraD1.sanguePct})`);
  const buff = e.hunt.buffs[id('Flesh_and_Stone')];
  assert.ok(Math.abs(G.efeitoDoBuff(e, buff.tipo ?? 'poe-aura', id('Flesh_and_Stone'), buff, e, { emVoce: false }) - 1.5) < 1e-9, 'a mesma conta das auras');
});

test('F1: a chance de Eletrizar do Castigo é da AURA (vale para os seus golpes enquanto ligada), não do golpe da gema', { skip: SEM }, async () => {
  assert.equal(G.buffNoNivel('Smite', 20, 0).af.chance_shock, 19);
  assert.equal(G.buffNoNivel('Vaal_Smite', 20, 0).af.chance_shock, 19);
  assert.equal(G.afeccoesComAGema({ chance: {} }, 'Smite', 20, 0).chance.eletrizacao, undefined, 'o golpe não soma a chance (senão dobra com a aura)');
  const { e, b } = await montar(['Smite', 'Cleave'], { arma: 'One_Hand_Maces/Driftwood_Club' });
  const antes = Number(Ficha.combate(e).afPoe?.chance_shock) || 0;
  assert.ok(usar(e, b).ok);
  assert.ok(e.hunt.buffs[id('Smite')], 'a aura ligou ao acertar');
  Ficha.invalidar(e);
  assert.ok((Number(Ficha.combate(e).afPoe?.chance_shock) || 0) - antes >= 19, 'com a aura, a sua chance de Eletrizar sobe');
});
