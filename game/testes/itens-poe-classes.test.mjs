// Incremento 4a: as 7 classes do PoE (só com ITENS_POE=1). A classe fica por cima da vocação: dá os atributos iniciais (For/Des/Int) e
// eles NÃO crescem com o level (como no PoE); quem não escolheu usa a padrão da vocação e escolhe uma vez.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const Classes = await import('../systems/itens-poe/classes.mjs');
const Atributos = await import('../systems/personagem/atributos.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';

test('as 7 classes com os atributos iniciais do PoE', { skip: SEM }, () => {
  const l = Classes.paraCliente();
  assert.equal(l.length, 7);
  const por = Object.fromEntries(l.map((c) => [c.slug, c.atributos]));
  assert.deepEqual(por.Marauder, { str: 32, dex: 14, int: 14 });
  assert.deepEqual(por.Ranger, { str: 14, dex: 32, int: 14 });
  assert.deepEqual(por.Witch, { str: 14, dex: 14, int: 32 });
  assert.deepEqual(por.Scion, { str: 20, dex: 20, int: 20 });
  assert.equal(l.find((c) => c.slug === 'Duelist').ascendencias.length, 3);
});

test('sem escolha: a classe padrão da vocação; atributos da classe e SEM ganho por level', { skip: SEM }, () => {
  const k = personagemDeTeste({ vocacao: 'knight', level: 300 });
  assert.equal(Classes.classeDe(k).slug, 'Marauder');
  const a = Atributos.principais(k, {});
  assert.deepEqual([a.str, a.dex, a.int], [32, 14, 14], 'level 300 com os mesmos atributos do level 1');
  assert.deepEqual(Atributos.principais(k, { str: 10 }).str, 42, 'árvore/itens somam por cima');
  assert.equal(Classes.classeDe(personagemDeTeste({ vocacao: 'sorcerer', level: 50 })).slug, 'Witch');
});

test('escolher a classe: uma vez; inválida recusa', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  assert.equal(Classes.escolher(e, 'Nada').ok, false);
  assert.equal(Classes.escolher(e, 'Witch').ok, true);
  assert.equal(Classes.classeDe(e).slug, 'Witch');
  assert.deepEqual(Atributos.principais(e, {}).int, 32, 'knight bruxa: os atributos são os da classe');
  const r = Classes.escolher(e, 'Ranger');
  assert.equal(r.ok, false);
  assert.match(r.erro, /já é Bruxa/);
});

test('escala do PoE no personagem: vida 28+12/level, mana 14+6/level (40 e 20 no nível 1), atributos do PoE, precisão 2/level, golpe = a faixa da arma', { skip: SEM }, async () => {
  const R = await import('../systems/regras.mjs');
  assert.deepEqual(R.statsBase('knight', 1), { maxHp: 40, maxMana: 20 });
  assert.deepEqual(R.statsBase('sorcerer', 13), { maxHp: 184, maxMana: 92 }, 'a vocação não muda a base no PoE');
  const ef = Atributos.efeitos({ str: 32, dex: 14, int: 14 });
  assert.deepEqual([ef.vida, ef.danoFisicoPct, ef.precisao, ef.evasaoPct, ef.mana, ef.energyShieldPct, ef.velocidadeDeAtaquePct, ef.danoMagicoPct].map((v) => Math.round(v * 100) / 100), [16, 6.4, 28, 2.8, 14, 2.8, 0, 0]);
  assert.equal(Atributos.precisaoBase(13), 26);
  for (let i = 0; i < 50; i++) {
    const g = R.golpeDoJogador({ attack: 7, attackMin: 4, attackMax: 9 }, 80, 300);
    assert.ok(g >= 4 && g <= 9, `golpe ${g}: só a faixa da arma, sem perícia nem level`);
  }
  for (let i = 0; i < 50; i++) {
    const g = R.golpeDoJogador(null, 80, 300);
    assert.ok(g >= 2 && g <= 6, 'desarmado: 2–6');
  }
});

test('vida e mana iniciais de cada classe: a tabela do dono (Marauder ~56/34, Caçadora ~47/34, Bruxa ~47/52, Duelista ~51/34, Templário ~51/43, Sombra ~47/43, Herdeira ~50/40)', { skip: SEM }, async () => {
  const R = await import('../systems/regras.mjs');
  const A = await import('../systems/personagem/atributos.mjs');
  const C = await import('../systems/itens-poe/classes.mjs');
  const tabela = { Marauder: [56, 34], Ranger: [47, 34], Witch: [47, 52], Duelist: [51, 34], Templar: [51, 43], Shadow: [47, 43], Scion: [50, 40] };
  for (const [slug, [vida, mana]] of Object.entries(tabela)) {
    const b = R.statsBase('knight', 1);
    const ef = A.efeitos({ ...C.CLASSES[slug].atributos });
    assert.ok(Math.abs(b.maxHp + ef.vida - vida) <= 0.5, `${slug}: vida ${b.maxHp + ef.vida} (tabela ~${vida})`);
    assert.ok(Math.abs(b.maxMana + ef.mana - mana) <= 0.5, `${slug}: mana ${b.maxMana + ef.mana} (tabela ~${mana})`);
  }
});

test('o começo do PoE: cada classe nasce só com a sua arma (Normal, Item Level 1), e ela cumpre o requisito de atributo da classe', { skip: SEM }, async () => {
  const D = await import('../systems/dados.mjs');
  const J = await import('../systems/itens-poe/jogo.mjs');
  const C = await import('../systems/itens-poe/classes.mjs');
  const Req = await import('../systems/personagem/requisitos.mjs');
  J.iniciar(D.ITEM_CATALOG);
  for (const slug of C.DADOS.ordem) {
    const p = J.armaInicial(slug);
    const meta = D.ITEM_CATALOG[p.id];
    assert.equal(meta.slot, 'weapon', slug);
    assert.equal(p.poe.raridade, 'normal', slug);
    assert.equal(p.poe.ilvl, 1, slug);
    assert.ok(!meta.minLevel || meta.minLevel <= 1, `${slug}: arma sem requisito de nível`);
    assert.equal(Req.falta(meta, C.CLASSES[slug].atributos), null, `${slug}: cumpre os atributos de ${meta.name}`);
  }
});
