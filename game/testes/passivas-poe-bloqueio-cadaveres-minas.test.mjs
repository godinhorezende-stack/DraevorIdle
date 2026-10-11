// A árvore do PoE, ciclo 7, lote E (11/10 — "tente resolver tudo que não está funcionando"): as linhas que ligam em mecânicas que o jogo já
// tem — o teto do bloqueio, os cadáveres da caçada, a Exposição de quem infligiu, a resistência invertida, o Totem que leva parte do golpe,
// a regeneração dos inimigos próximos, os encaixes da arma, as Minas (que no jogo detonam no alvo) e as magias usadas recentemente.
// Cada teste aloca o nó REAL pelo servidor e mede onde a linha age.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Estados = await import('../systems/skills/estados.mjs');
const Resistencia = await import('../systems/hunt/resistencia.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}
const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);
const ESPADA = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'fire sword')?.id);

function novo(classe = 'Scion') {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: classe });
  delete e.classe;
  P.garantir(e);
  e.equipment = {};
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  return e;
}
/** O nó (ou a opção de maestria) com um efeito cuja chave casa `re`. */
function achar(re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  const comum = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  if (comum) return { no: comum, valor: comum.efeitos.find((x) => re.test(x.add)).valor };
  for (const n of arv.nos.filter((x) => x.tipo === 'mastery' && !x.ascendencia)) {
    const o = (n.opcoes ?? []).find((x) => tem(x.efeitos));
    if (o) return { no: n, opcao: o.id, valor: o.efeitos.find((x) => re.test(x.add)).valor };
  }
  const asc = arv.nos.find((n) => n.ascendencia && tem(n.efeitos));
  return asc ? { no: asc, asc: true, valor: asc.efeitos.find((x) => re.test(x.add)).valor } : null;
}
function com(re) {
  const achado = achar(re);
  assert.ok(achado, `há nó com ${re}`);
  const { no, opcao } = achado;
  const e = novo(achado.asc ? P.arvore().ascendencias[no.ascendencia].classe : 'Scion');
  if (achado.asc) { e.passivas.ascendencia = no.ascendencia; Comandos.depoisDeMudar(e); assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) }).ok); }
  else {
    const ate = no.tipo === 'mastery' ? P.arvore().nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia).id : no.id;
    const caminho = P.caminhoAte(e, ate);
    const antes = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
    if (antes.length) assert.equal(Comandos.comando(e, { action: 'alocar', ids: antes }).feitos, antes.length);
    assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id, ...(opcao ? { opcao } : {}) }).ok);
  }
  Ficha.invalidar(e);
  const chave = [...(no.efeitos ?? []), ...((no.opcoes ?? []).find((o) => o.id === opcao)?.efeitos ?? [])].find((x) => re.test(x.add ?? '')).add;
  return { e, valor: Number(Ficha.combate(e).afPoe[chave]) || achado.valor, chave };
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const golpe = (e, tags, alvo = null) => ModsPoe.fichaDoGolpe(ficha(e), tags, { estado: e, alvo });
const bicho = (extra = {}) => ({ uid: 9, key: 'rat', name: 'Rato', x: 1, y: 0, hp: 1000, maxHp: 1000, ...extra });
/** Veste no anel uma peça do PoE com estes atributos já traduzidos. */
function anel(e, af) {
  e.equipment.ring = { id: ANEL, count: 1, af: [], poe: { af } };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
}

test('BLOQUEIO: "+X% à Chance máxima de Bloquear o Dano de Ataques / Dano Mágico" sobe o teto de 75%', { skip: SEM }, () => {
  const a = com(/^max_block$/);
  anel(a.e, { block: 200 });
  assert.ok(Math.abs(ficha(a.e).blockChance - (0.75 + a.valor / 100)) < 1e-9, `${ficha(a.e).blockChance}`);
  const m = com(/^max_spell_block$/);
  anel(m.e, { spell_block: 200 });
  assert.ok(Math.abs(ficha(m.e).bloqueioDeMagia - (0.75 + m.valor / 100)) < 1e-9, `${ficha(m.e).bloqueioDeMagia}`);
  const sem = novo();
  anel(sem, { block: 200, spell_block: 200 });
  assert.equal(ficha(sem).blockChance, 0.75);
  assert.equal(ficha(sem).bloqueioDeMagia, 0.75);
});

test('CADÁVERES: "A cada N segundos, Consome um Cadáver próximo para Recuperar X% de Vida" — consome o mais perto e cura', { skip: SEM }, () => {
  const { e, chave, valor } = com(/^periodico:\d+:consumirCadaver:hp$/);
  const cada = Number(chave.split(':')[1]);
  e.maxHp = 10000;
  e.hp = 1000;
  e.hunt.cadaveres = [{ key: 'rat', x: 20, y: 20 }, { key: 'rat', x: 2, y: 1 }];
  ModsPoe.aurasProximas(e, e.hunt, ficha(e));
  assert.equal(e.hp, 1000, 'o primeiro só começa a contar');
  e.hunt.clock += cada * 1000;
  ModsPoe.aurasProximas(e, e.hunt, ficha(e));
  assert.equal(e.hp, 1000 + (10000 * valor) / 100);
  assert.deepEqual(e.hunt.cadaveres.map((c) => c.x), [20], 'o de longe (fora das 6 casas) fica');
  assert.ok(ModsPoe.condicoesDe(e, ficha(e).afPoe).has('consumiuCadaverRecente'));
  // sem cadáver perto, nada
  e.hunt.clock += cada * 1000;
  ModsPoe.aurasProximas(e, e.hunt, ficha(e));
  assert.equal(e.hp, 1000 + (10000 * valor) / 100);
});

test('EXPOSIÇÃO e RESISTÊNCIA: "Exposições … aplicam ao menos X%" e "tratarem a Resistência Elemental como invertida"', { skip: SEM }, () => {
  const { e, valor } = com(/^exposicao_minima$/);
  const alvo = bicho({ estados: { exposicao: { fire: e.hunt.clock + 4000 } } });
  const semFicha = Resistencia.resistenciaDe(e.hunt, alvo, 'fire');
  ModsPoe.definirFichaDaCacada(e.hunt, () => ficha(e));
  assert.equal(Resistencia.resistenciaDe(e.hunt, alvo, 'fire'), semFicha + 10 - Math.abs(valor), 'a Exposição padrão (10) vira o mínimo');
  const r = com(/^chance_res_invertida$/);
  const resistente = bicho({ resist: { fire: 40 } });
  // (o sorteio fixo: sem ele, o golpe "normal" também inverte em X% das vezes)
  const semInverter = (tags) => ModsPoe.fichaDoGolpe(ficha(r.e), tags, { estado: r.e, rng: () => 0.999 });
  const normal = Resistencia.resistenciaEfetivaDe(r.e.hunt, resistente, 'fire', semInverter(['magia', 'fogo']));
  const f = ModsPoe.fichaDoGolpe(ficha(r.e), ['magia', 'fogo'], { estado: r.e, rng: () => 0 });
  assert.equal(f.resInvertida, true);
  assert.equal(Resistencia.resistenciaEfetivaDe(r.e.hunt, resistente, 'fire', f), -normal);
  assert.equal(Resistencia.resistenciaEfetivaDe(r.e.hunt, resistente, 'physical', f), Resistencia.resistenciaEfetivaDe(r.e.hunt, resistente, 'physical', semInverter(['magia'])), 'só a elemental');
});

test('TOTEM: "X% do Dano de Acertos é sofrido na Vida do seu Totem mais próximo antes da sua"', { skip: SEM }, () => {
  const { e, valor } = com(/^dano_no_totem_pct$/);
  e.hunt.lacaios = [{ uid: 'l1', tipo: 'totem', nome: 'Totem', hp: 5000, maxHp: 5000, x: 3, y: 0 }, { uid: 'l2', tipo: 'totem', nome: 'Totem', hp: 5000, maxHp: 5000, x: 1, y: 0 }];
  const parte = ModsPoe.parteNoTotem(e.hunt, ficha(e), 1000);
  assert.equal(parte, Math.round((1000 * valor) / 100));
  assert.equal(e.hunt.lacaios[1].hp, 5000 - parte, 'o mais perto leva');
  assert.equal(e.hunt.lacaios[0].hp, 5000);
  assert.equal(ModsPoe.parteNoTotem(novo().hunt, ficha(novo()), 1000), 0, 'sem a linha, nada');
});

test('INIMIGOS PRÓXIMOS: "têm Regeneração de Vida reduzida em X%" — o monstro perto regenera menos', { skip: SEM }, () => {
  const { e, valor } = com(/^aura_regen_menos$/);
  const regen = (aura) => {
    const m = bicho({ hp: 500, regen: 10, proximaRegen: 0 });
    const hunt = { clock: 10000, monstros: [m], pos: { x: 0, y: 0 } };
    if (aura) ModsPoe.aurasProximas({ ...e, hunt }, hunt, ficha(e));
    Estados.tique(hunt, [], hunt.clock);
    return m.hp - 500;
  };
  assert.equal(regen(false), 100);
  assert.equal(regen(true), Math.max(valor >= 100 ? 0 : 1, Math.round(100 * (1 - valor / 100))));
});

test('ENCAIXES e MINAS: "se a arma … tiver um encaixe verde e vermelho"; "Cada Mina aplica Dano sofrido aumentado … até Y%"', { skip: SEM }, () => {
  const { e, valor } = com(/^armour_pct@armaComEncaixes:GR$/);
  const armadura = () => Number(ficha(e).afPoe.armour_pct) || 0;
  e.equipment.weapon = { id: ESPADA, count: 1, soquetes: { abertos: 2, cores: ['G', 'B'], gemas: [null, null] } };
  const sem = armadura();
  e.equipment.weapon.soquetes.cores = ['G', 'R'];
  assert.equal(armadura() - sem, valor);
  const m = com(/^mina_fragiliza:\d+$/);
  const teto = Number(m.chave.split(':')[1]);
  const alvo = bicho();
  for (let i = 0; i < 10; i++) ModsPoe.aoAcertar(m.e, m.e.hunt, alvo, golpe(m.e, ['magia', 'mina', 'area']), { dano: 1, rng: () => 0.999 });
  assert.equal(alvo.estados.minaFragil.pct, teto);
  assert.ok(Math.abs(ModsPoe.fatorRecebidoPeloBicho(alvo, 'fire', ficha(m.e), m.e.hunt.clock) - (1 + teto / 100)) < 1e-9);
  const outro = bicho();
  ModsPoe.aoAcertar(m.e, m.e.hunt, outro, golpe(m.e, ['magia', 'area']), { dano: 1, rng: () => 0.999 });
  assert.equal(outro.estados?.minaFragil, undefined, 'só o golpe de Mina');
});

test('MAGIAS RECENTES: "Velocidade de Conjuração aumentada em X% por cada Magia … Conjurado Recentemente"', { skip: SEM }, () => {
  const { e, valor } = com(/^cast_speed%usos:magia$/);
  const vel = () => Number(ficha(e).afPoe.cast_speed) || 0;
  const zero = vel();
  ModsPoe.marcarUsoPorTag(e.hunt, ['magia', 'fogo'], 'Fireball', e.hunt.clock);
  ModsPoe.marcarUsoPorTag(e.hunt, ['magia', 'fogo'], 'Fireball', e.hunt.clock + 100);
  ModsPoe.marcarUsoPorTag(e.hunt, ['ataque'], 'Cleave', e.hunt.clock + 200);
  e.hunt.clock += 300;
  assert.equal(vel() - zero, 2 * valor);
  e.hunt.clock += 5000;
  assert.equal(vel(), zero, 'passados 4 s, não contam');
});
