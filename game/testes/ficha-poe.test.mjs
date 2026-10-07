// A FICHA no estilo do PoE (dono, 07/10: "melhore a ficha do personagem ... com todos os atributos importantes e de onde vem"):
// as seções da tela de personagem do PoE e a ORIGEM de cada número — a soma das fontes fecha com o total.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Ficha = await import('../systems/ficha.mjs');
const FichaPoe = await import('../systems/personagem/ficha-poe.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
const soma = (fontes) => fontes.filter((f) => !f.pct).reduce((n, f) => n + f.valor, 0);

test('a ficha do PoE: cabeçalho com classe e atributos, Vida/ES/Mana, as 4 resistências e as seções da tela do PoE', { skip: SEM }, () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 20 }), { classePoe: 'Witch' });
  Afixos.sincronizarMaximos(e);
  const f = FichaPoe.montar(e, Ficha.combate(e));
  assert.equal(f.cabecalho.classe, 'Bruxa');
  assert.deepEqual(f.cabecalho.atributos.map((a) => a.id), ['str', 'dex', 'int']);
  assert.deepEqual(f.grandes.map((g) => g.id), ['vida', 'es', 'mana']);
  assert.deepEqual(f.resistencias.map((r) => r.nome), ['Fogo', 'Gelo', 'Raio', 'Caos']);
  assert.deepEqual(f.secoes.map((s) => s.titulo), ['Vida', 'Escudo de Energia', 'Mana', 'Ataque', 'Magia', 'Defesa', 'Cargas', 'Diversos']);
  // De onde vem: a vida fecha com a soma das fontes (nível + Força + equipamento + árvore + o resto).
  const vida = f.grandes[0];
  assert.equal(Math.round(soma(vida.fontes)), vida.valor);
  assert.ok(vida.fontes.some((x) => /Nível 20/.test(x.fonte)) && vida.fontes.some((x) => /Força/.test(x.fonte)));
  const mana = f.grandes[2];
  assert.equal(Math.round(soma(mana.fontes)), mana.valor);
  // A Inteligência vem da classe (Bruxa: 32).
  const int = f.cabecalho.atributos[2];
  assert.equal(int.valor, 32);
  assert.ok(int.fontes.some((x) => /Classe \(Bruxa\)/.test(x.fonte) && x.valor === 32));
});

test('a redução da Armadura segue a fórmula do PoE (A / (A + 5 × dano)), até 90%', () => {
  assert.equal(Math.round(FichaPoe.reducaoDaArmadura(500, 100) * 100), 50);
  assert.equal(Math.round(FichaPoe.reducaoDaArmadura(250, 100) * 100), 33);
  assert.equal(FichaPoe.reducaoDaArmadura(1e9, 1), 0.9);
});

test('regras do PoE (dono, 07/10): vida/mana base 50/40 no nível 1, vida sem regeneração de base, mana 1,8%/s, penalidade de resistência por ato e supressão', { skip: SEM }, async () => {
  const R = await import('../systems/regras.mjs');
  assert.deepEqual(R.statsBase('sorcerer', 1), { maxHp: 50, maxMana: 40 });
  assert.deepEqual(R.statsBase('sorcerer', 10), { maxHp: 158, maxMana: 94 });
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 20 }), { classePoe: 'Witch' });
  e.maxHp = 500; e.maxMana = 200;
  let f = Ficha.combate(e);
  assert.equal(f.regenPoe.vidaPorSegundo, 0, 'sem regeneração de vida de base');
  assert.equal(Math.round(f.regenPoe.manaPorSegundo * 100) / 100, 3.6, '1,8% de 200');
  assert.equal(f.penalidadeDeResistencia, 0);
  assert.equal(f.protection.fire, 0);
  // Venceu o chefe do Ato 5: −30% em tudo (o Caos também), podendo ficar negativo.
  e.campanha = { facil: { bosses: [1, 2, 3, 4, 5] } };
  Ficha.invalidar(e);
  f = Ficha.combate(e);
  assert.equal(f.penalidadeDeResistencia, 30);
  assert.deepEqual(['fire', 'ice', 'energy', 'chaos'].map((el) => f.protection[el]), [-30, -30, -30, -30]);
  e.campanha.facil.bosses.push(6, 7, 8, 9, 10);
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).protection.fire, -60, 'depois do Ato 10, −60%');
  // A regeneração do PoE com os mods: 2% da vida/s e +50% de velocidade de regeneração = 500 × 2% × 1,5 = 15/s.
  const vida = Ficha.regenDoPoe({ maxHp: 500, maxMana: 200 }, { life_regen_max_pct: 2, life_regen_pct: 50, mana_regen_pct: 100 });
  assert.equal(vida.vidaPorSegundo, 15);
  assert.equal(Math.round(vida.manaPorSegundo * 100) / 100, 7.2, '1,8% × 2');
  // A ficha mostra as cargas ativas / máximo e a penalidade.
  const fp = FichaPoe.montar(e, Ficha.combate(e));
  const cargas = fp.secoes.find((s) => s.id === 'cargas').linhas.map((l) => l.valor);
  assert.deepEqual(cargas, ['0 / 3', '0 / 3', '0 / 3']);
  assert.ok(fp.secoes.find((s) => s.id === 'defesa').linhas.some((l) => /Penalidade/.test(l.rotulo) && l.valor === '−60%'));
  assert.ok(fp.resistencias.find((r) => r.id === 'fire').fontes.some((x) => /Penalidade da campanha/.test(x.fonte) && x.valor === -60));
});

test('na cidade (fora da caçada), modo PoE: vida, mana, Escudo de Energia e frascos cheios', async () => {
  const S = await import('../websocket/sessao.mjs');
  const e = { maxHp: 76, hp: 64, maxMana: 54, mana: 10, es: 3, frascos: [] };
  S.encherNaCidade(e);
  assert.deepEqual([e.hp, e.mana, e.es], [76, 54, null]);
  const morto = { maxHp: 76, hp: 0, maxMana: 54, mana: 0, frascos: [] };
  S.encherNaCidade(morto);
  assert.equal(morto.hp, 0, 'morto não ressuscita por aqui (a morte cuida disso)');
});

test('modo PoE: as vocações do Draevor não dão especialização (sem o Life +15% do Knight, sem o +15% de Fogo do Sorcerer...): a mesma classe do PoE dá a mesma ficha em qualquer vocação', { skip: SEM }, async () => {
  const C = await import('../systems/hunt/combate.mjs');
  const Esp = await import('../systems/personagem/especializacoes.mjs');
  const fazer = (voc) => {
    const e = Object.assign(personagemDeTeste({ vocacao: voc, level: 1 }), { classePoe: 'Marauder', equipment: {} });
    C.refazerMaximos(e, 1);
    Ficha.invalidar(e);
    return e;
  };
  const knight = fazer('knight');
  assert.deepEqual(Esp.especializacoesDe(knight), []);
  // Marauder nível 1: 50 do nível + 16 da Força (32) = 66 — sem os +10 da especialização Life.
  assert.equal(knight.maxHp, 66);
  const f = FichaPoe.montar(knight, Ficha.combate(knight));
  assert.ok(!f.grandes[0].fontes.some((x) => /Especialização|Outros/.test(x.fonte)), JSON.stringify(f.grandes[0].fontes));
  for (const voc of ['paladin', 'sorcerer', 'druid', 'monk']) {
    const x = fazer(voc);
    assert.equal(x.maxHp, knight.maxHp, voc);
    const a = Ficha.combate(knight);
    const b = Ficha.combate(x);
    for (const k of ['danoDoElemento', 'afinidades', 'armor', 'accuracy', 'castSpeed', 'velocidadeDeAtaque', 'evasion']) assert.deepEqual(b[k], a[k], `${voc}: ${k}`);
  }
});

test('modo PoE: sem Buff Power (não liga, sem +3000 de vida/mana, fora da Store) e a coleção de outfits/montarias sem crítico', { skip: SEM }, async () => {
  const BP = await import('../systems/buffpower.mjs');
  const Ap = await import('../systems/aparencia.mjs');
  const Loja = await import('../systems/loja.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 10 }), { buffPowerMs: { poder: 3_600_000, exp: 3_600_000, loot: 3_600_000 }, buffVida: true, maxHp: 3200, maxMana: 3100, hp: 3200, mana: 3100 });
  assert.equal(BP.ativo(e, 'poder'), false);
  assert.equal(BP.fatorDeLoot(e), 1);
  assert.equal(BP.fonteDeExp(e), null);
  assert.deepEqual(BP.paraCliente(e), []);
  BP.sincronizarVida(e);
  assert.deepEqual([e.maxHp, e.maxMana, e.buffVida], [200, 100, false], 'os +3000 saem');
  assert.match(BP.ligar(e, 1).erro, /não existe no modo PoE/);
  e.lojaOutfits = [1, 2, 3];
  assert.equal(Ap.colecao(e).critChance, 0);
  const loja = JSON.stringify(Loja.catalogoDaLoja?.(e) ?? Loja.paraCliente?.(e) ?? {});
  assert.ok(!/"id":"buffpower-/.test(loja), 'o Buff Power não aparece na Store');
});

test('modo PoE: o multiplicador de crítico começa em 150% (a ficha mostra a base de 150 e soma o resto por cima)', { skip: SEM }, () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 10 }), { classePoe: 'Marauder', equipment: {} });
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  assert.equal(f.critMultiplier, 1.5);
  assert.ok(f.origens.critMultiplier.some((x) => x.fonte === 'Base do personagem' && x.valor === 150));
  const fp = FichaPoe.montar(e, f);
  assert.equal(fp.secoes.find((s) => s.id === 'ataque').linhas.find((l) => l.rotulo === 'Multiplicador de crítico').valor, '150%');
});

test('modo PoE: sem os 3% de crítico "do personagem"; o roubo só nos ataques, até 10% por acerto e 20% da máxima por segundo', { skip: SEM }, () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 10 }), { classePoe: 'Marauder', equipment: {} });
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  assert.equal(f.critChance, 0, 'desarmado e sem itens: nenhuma chance "do personagem"');
  assert.ok(!f.origens.critChance?.some((x) => x.fonte === 'Base do personagem' && x.valor > 0));
  assert.ok(f.critMagiaPoe, 'a magia usa a base da gema');
  // O roubo: cada acerto cria uma instância de até 10% da máxima, a 2%/s; todas juntas até 20%/s; magia não rouba.
  Object.assign(e, { maxHp: 1000, hp: 100, maxMana: 500, mana: 0, hunt: { clock: 0 } });
  const ficha = { lifeLeech: 1, manaLeech: 1 }; // 100% do dano (para ver os tetos)
  const ev = [];
  Ficha.aplicarLeech(e, 5000, ev, 'x', { x: 0, y: 0 }, ficha, null, { ataque: false });
  assert.equal(e.hunt.roubos?.length ?? 0, 0, 'magia não rouba');
  Ficha.aplicarLeech(e, 5000, ev, 'x', { x: 0, y: 0 }, ficha);
  assert.deepEqual(e.hunt.roubos.map((x) => [x.recurso, x.restante, x.porSegundo]), [['vida', 100, 20], ['mana', 50, 10]], 'instância de 10% da máxima, a 2%/s');
  assert.equal(e.hp, 100, 'não cura na hora');
  Ficha.recuperarRoubo(e, 1000);
  assert.deepEqual([e.hp, e.mana], [120, 10], 'um segundo: 2% da máxima');
  Ficha.recuperarRoubo(e, 4000);
  assert.deepEqual([e.hp, e.mana], [200, 50], 'em 5 s a instância acaba (10%)');
  assert.equal(e.hunt.roubos.length, 0);
  // 15 golpes de uma vez: 15 × 2% = 30%/s pedidos, mas o teto é 20%/s.
  for (let k = 0; k < 15; k++) Ficha.aplicarLeech(e, 5000, ev, 'x', { x: 0, y: 0 }, ficha);
  Ficha.recuperarRoubo(e, 1000);
  assert.equal(e.hp, 400, '+20% (200) no segundo, não +30%');
});
