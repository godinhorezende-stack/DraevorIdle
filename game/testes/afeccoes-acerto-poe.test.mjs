// O DANO SÓ DO ACERTO E O SÓ DAS AFECÇÕES (lote G17, 17/10 — o PoB: o dano-base das afecções sai de um `dotCfg` sem as flags Hit, Spell, Attack,
// Melee, Projectile e Area — CalcOffence.calcAilmentSourceDamage): o "X% menos Dano com Acertos" das Afecções Mortais não diminui o Incêndio que o
// acerto põe; o "mais Dano de Afecções" e o de cada afecção multiplicam só a afecção; o "mais Dano Degenerativo"/"Incendiário"/"de Caos degenerativo"
// multiplicam as afecções de dano e o degenerativo da gema, nunca o acerto; o "mais" de Mágico/Projétil/Corpo a Corpo/Ataque/Área fica no acerto; a
// chance de afecção dos suportes entra nas afecções do PoE; o "mais" de cada repetição do Golpe Múltiplo vale só nela. Mede no jogo.
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
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Registro = await import('../systems/combate/registro.mjs');

const TAGS = (...t) => ({ tags: t.map((x) => `poe:${x}`) });
// (o efeito com qualidade 0: as linhas da qualidade saem com 0 — tiradas)
const efeito = (slug, ativa) => Object.fromEntries(Object.entries(SP.efeitoNoNivel(slug, Math.min(20, SP.doSlug(slug).suporte.linhas.length || 1), 0, ativa).efeito).filter(([, v]) => v !== 0));
const sorte = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } };

/** O personagem com a arma, a ativa e os suportes ligados, numa caçada, com um alvo imortal colado (o resto longe). */
async function montar(arma, ativa, suportes = []) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const n = 1 + suportes.length;
  a.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = [ativa, ...suportes].map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(ativa).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  // (a raridade dos monstros é sorteada ao entrar: o sorteio fixo dá o mesmo alvo em toda montagem — e sem resistência própria)
  assert.ok(sorte(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} });
  return { e, b };
}
/** Um uso com o sorteio fixo em `v`: os golpes da gema no alvo (o registro), e os dots postos nele. */
function usar({ e, b }, v) {
  Registro.definirNivel(2);
  Registro.limparRegistro();
  try {
    sorte(v, () => {
      const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
      assert.ok(r.ok, r.erro);
      if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
    });
    return { golpes: Registro.ultimosGolpes(200).filter((g) => g.origem === 'gema'), dots: b.dots ?? [], agora: e.hunt.clock };
  } finally { Registro.definirNivel(0); }
}
const totalDo = (dots, tipo) => dots.filter((d) => d.tipo === tipo).reduce((t, d) => t + (d.falta ?? 0), 0);
const perto = (a, b, tol = 0.01) => Math.abs(a / b - 1) < tol;

test('G17: o efeito dos suportes pelo que cada "mais" atinge (o PoB)', { skip: SEM }, () => {
  assert.deepEqual(efeito('Deadly_Ailments_Support', TAGS('Ataque', 'Magia')), { custoPct: 40, maisAfeccaoPct: 44, maisDanoAcertoPct: -80 });
  // (um ataque de arco sem a tag Físico: o "Dano Físico de Ataque de Projétil" vale — o físico vem da arma)
  const vic = efeito('Vicious_Projectiles_Support', TAGS('Ataque', 'Projétil', 'Arco'));
  assert.deepEqual([vic.maisDanoAcertoPct, vic.maisDotCaosPct, vic.maisDotFisicoPct, vic.maisDanoPct], [49, 49, 49, undefined]);
  const multi = efeito('Multistrike_Support', TAGS('Ataque', 'Corpo a Corpo'));
  assert.deepEqual([multi.maisDanoAcertoPct, multi['repeticaoMaisPct:1'], multi['repeticaoMaisPct:2'], multi.maisDanoPct], [-20, 22, 44, undefined]);
  const sangra = efeito('Chance_to_Bleed_Support', TAGS('Ataque'));
  assert.deepEqual([sangra['af:chance_bleed'], sangra.maisSangramentoPct, sangra.sangramentoChance, sangra.ignitePct], [25, 29, undefined, undefined]);
  const prol = efeito('Elemental_Proliferation_Support', TAGS('Magia'));
  assert.deepEqual([prol.congelarChance, prol['af:chance_shock'], prol['af:chance_ignite']], [20, 20, 20]);
  assert.deepEqual(efeito('Burning_Damage_Support', TAGS('Magia', 'Fogo')), { custoPct: 30, maisDotFogoPct: 34 });
  const vol = efeito('Volatility_Support', TAGS('Ataque'));
  assert.deepEqual([vol.maisMaxAtaquePct, vol.maisMinAtaquePct, vol.maisDanoPct], [58, -69, undefined]);
  assert.equal(efeito('Behead_Support', TAGS('Ataque', 'Corpo a Corpo'))['af:mais_dano@alvoVidaBaixa'], 49);
  assert.equal(efeito('Controlled_Destruction_Support', TAGS('Magia')).maisDanoAcertoPct, 39);
  // (o "por cada …" sem regra própria não vira um "mais" fixo: o Sobre-esforço fica parcial, com a linha do Clamor não feita)
  assert.ok(SP.efeitoNoNivel('Overexertion_Support', 20, 0, TAGS('Ataque')).naoFeitas.some((l) => /por cada Clamor/.test(l)));
});

test('G17: as Afecções Mortais — o acerto da Bola de Fogo cai 80%, o Incêndio dela sobe 44%', { skip: SEM }, async () => {
  const sem = usar(await montar('Wands/Driftwood_Wand', 'Fireball'), 0.01);
  const com = usar(await montar('Wands/Driftwood_Wand', 'Fireball', ['Deadly_Ailments_Support']), 0.01);
  const acerto = (u) => u.golpes.reduce((t, g) => t + g.danoAntesDaResistencia, 0);
  assert.ok(acerto(sem) > 0 && totalDo(sem.dots, 'queimadura') > 0, 'a Bola de Fogo acertou e incendiou');
  assert.ok(perto(acerto(com) / acerto(sem), 0.2, 0.02), `o acerto: ${acerto(com)} / ${acerto(sem)}`);
  assert.ok(perto(totalDo(com.dots, 'queimadura') / totalDo(sem.dots, 'queimadura'), 1.44), `o Incêndio: ${totalDo(com.dots, 'queimadura')} / ${totalDo(sem.dots, 'queimadura')}`);
});

test('G17: o Dano Incendiário — o acerto da Bola de Fogo igual, o Incêndio 34% mais', { skip: SEM }, async () => {
  const sem = usar(await montar('Wands/Driftwood_Wand', 'Fireball'), 0.01);
  const com = usar(await montar('Wands/Driftwood_Wand', 'Fireball', ['Burning_Damage_Support']), 0.01);
  const acerto = (u) => u.golpes.reduce((t, g) => t + g.danoAntesDaResistencia, 0);
  assert.ok(perto(acerto(com), acerto(sem), 0.02), `o acerto: ${acerto(com)} / ${acerto(sem)}`);
  assert.ok(perto(totalDo(com.dots, 'queimadura') / totalDo(sem.dots, 'queimadura'), 1.34), `o Incêndio: ${totalDo(com.dots, 'queimadura')} / ${totalDo(sem.dots, 'queimadura')}`);
});

test('G17: a Chance de Sangramento põe o Sangramento do PoE (não o estado antigo do Draevor, de dano 0)', { skip: SEM }, async () => {
  const sem = usar(await montar('Two_Hand_Maces/Driftwood_Maul', 'Heavy_Strike'), 0.01);
  assert.equal(totalDo(sem.dots, 'sangramento'), 0, 'sem o suporte, nada');
  const com = usar(await montar('Two_Hand_Maces/Driftwood_Maul', 'Heavy_Strike', ['Chance_to_Bleed_Support']), 0.01);
  const sangramentos = com.dots.filter((d) => d.tipo === 'sangramento');
  assert.ok(sangramentos.length && sangramentos.every((d) => d.origem?.fonte === 'poe' && d.falta > 0), JSON.stringify(sangramentos.map((d) => ({ fonte: d.origem?.fonte, falta: d.falta }))));
});

test('G17: o degenerativo da Flecha Cáustica — igual com as Afecções Mortais (não é acerto), 49% mais com os Projéteis Viciosos (Caos degenerativo)', { skip: SEM }, async () => {
  const tipo = G.DEGEN_DO_ELEMENTO.chaos;
  const dot = async (suportes) => totalDo(usar(await montar('Bows/Crude_Bow', 'Caustic_Arrow', suportes), 0.99).dots.filter((d) => d.chave === 'Caustic_Arrow'), tipo);
  const base = await dot([]);
  assert.ok(base > 0, 'a Flecha Cáustica deixa o degenerativo de Caos');
  assert.ok(perto(await dot(['Deadly_Ailments_Support']), base), 'as Afecções Mortais não mexem no degenerativo da gema');
  assert.ok(perto((await dot(['Vicious_Projectiles_Support'])) / base, 1.49), 'os Projéteis Viciosos: 49% mais Dano de Caos degenerativo');
});

test('G17: o Golpe Múltiplo — o "mais" de cada repetição só nela (22% na primeira, 44% na segunda), os 20% menos de Ataque em todas', { skip: SEM }, async () => {
  const sem = usar(await montar('Two_Hand_Maces/Driftwood_Maul', 'Heavy_Strike'), 0.99).golpes.map((g) => g.danoAntesDaResistencia);
  const com = usar(await montar('Two_Hand_Maces/Driftwood_Maul', 'Heavy_Strike', ['Multistrike_Support']), 0.99).golpes.map((g) => g.danoAntesDaResistencia);
  assert.equal(com.length, 3, `o uso e as 2 repetições: ${com}`);
  assert.ok(perto(com[0] / sem[0], 0.8, 0.02), `o uso: ${com[0]} / ${sem[0]}`);
  assert.ok(perto(com[1] / com[0], 1.22, 0.02) && perto(com[2] / com[0], 1.44, 0.02), `as repetições: ${com}`);
});

test('G17: a Volatilidade — o máximo da faixa do ataque 58% mais, o mínimo 69% menos', { skip: SEM }, async () => {
  const faixa = async (suportes) => usar(await montar('Two_Hand_Maces/Driftwood_Maul', 'Heavy_Strike', suportes), 0.99).golpes[0].detalhe;
  const sem = await faixa([]);
  const com = await faixa(['Volatility_Support']);
  assert.ok(perto(com.max / sem.max, 1.58, 0.02), `o máximo: ${com.max} / ${sem.max}`);
  assert.ok(perto(com.min / sem.min, 0.31, 0.05), `o mínimo: ${com.min} / ${sem.min}`);
});

test('G17: as Toxinas Vis — 5% mais no acerto por Veneno no alvo (até 8); o Veneno não leva esse "mais"', { skip: SEM }, async () => {
  const acerto = async (venenos) => {
    const m = await montar('Two_Hand_Maces/Driftwood_Maul', 'Heavy_Strike', ['Vile_Toxins_Support']);
    m.b.dots = Array.from({ length: venenos }, (_, i) => ({ id: `v${i}`, tipo: 'venenoPoe', falta: 1e9, porPulso: 1, ate: 1e12 }));
    return usar(m, 0.99).golpes.reduce((t, g) => t + g.danoAntesDaResistencia, 0);
  };
  const { maisAcertoPorVenenoPct: pct, maisAcertoPorVenenoMax: teto } = efeito('Vile_Toxins_Support', TAGS('Ataque'));
  assert.ok(pct > 0 && teto >= 3, `${pct}% até ${teto}`);
  const zero = await acerto(0);
  assert.ok(perto((await acerto(3)) / zero, 1 + (3 * pct) / 100, 0.02), `três venenos: ${3 * pct}% mais`);
  assert.ok(perto((await acerto(teto + 4)) / zero, 1 + (teto * pct) / 100, 0.02), `acima do teto: ${teto * pct}%`);
});

test('G17: o Foco Elemental — a Bola de Fogo crítica não incendeia ("não podem infligir Afecções Elementais"), com 34% mais no acerto', { skip: SEM }, async () => {
  const sem = usar(await montar('Wands/Driftwood_Wand', 'Fireball'), 0.01);
  const com = usar(await montar('Wands/Driftwood_Wand', 'Fireball', ['Elemental_Focus_Support']), 0.01);
  assert.ok(totalDo(sem.dots, 'queimadura') > 0 && totalDo(com.dots, 'queimadura') === 0, 'sem incêndio com o Foco');
  const acerto = (u) => u.golpes.reduce((t, g) => t + g.danoAntesDaResistencia, 0);
  assert.ok(perto(acerto(com) / acerto(sem), 1.34, 0.02), `o acerto: ${acerto(com)} / ${acerto(sem)}`);
});

test('G17: o Sadismo — o Incêndio da Bola de Fogo dura 70% menos e corre 98% mais rápido', { skip: SEM }, async () => {
  const dur = (u) => u.dots.filter((d) => d.tipo === 'queimadura').map((d) => d.ate - u.agora)[0];
  const sem = dur(usar(await montar('Wands/Driftwood_Wand', 'Fireball'), 0.01));
  const com = dur(usar(await montar('Wands/Driftwood_Wand', 'Fireball', ['Sadism_Support']), 0.01));
  assert.ok(sem > 0 && com > 0, `${sem} ${com}`);
  // (4 s × 0,3 = 1,2 s, ÷ 1,98 = ~0,61 s — o tique arredonda no pulso)
  assert.ok(com <= sem * 0.3 / 1.98 * 1.2 && com >= sem * 0.3 / 1.98 * 0.8, `a duração: ${com} ms contra ${sem} ms`);
});
