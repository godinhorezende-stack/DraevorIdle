// Os MODIFICADORES DE MONSTRO do PoE (gamedata/itens-poe/modificadores-monstro.json — tools/montar-modificadores-monstro-poe.mjs) e o OURO
// pelo level do monstro (itens-poe/regras.json → ouro). Pedido do dono, 05/10: Normal sem mods, Mágico 1, Raro 2 a 4; ouro aleatório na
// faixa do level × a raridade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUNT_DE_TESTE } from './apoio.mjs';

process.env.ITENS_POE = '1';
const Mods = await import('../systems/itens-poe/modificadores-monstro.mjs');
const Raridade = await import('../systems/mobs/raridade.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const { BESTIARY } = await import('../systems/hunt/monstros.mjs');

const REGRAS = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/regras.json', import.meta.url), 'utf8'));
const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test('os 204 modificadores do PoE: nome e texto em português, nível, peso por raridade e o efeito no Draevor', () => {
  const d = Mods.DADOS;
  assert.equal(d.mods.length, 204, 'os 205 do poedb menos 1 vazio');
  assert.deepEqual(d.quantos, { magico: [1, 1], raro: [2, 4] });
  for (const m of d.mods) {
    assert.ok(m.id && m.nome && m.linhas.length, m.id);
    assert.ok(['efeito', 'aproximado', 'parcial', 'registrado'].includes(m.estado), m.id);
  }
  const rapido = d.mods.find((m) => m.id === 'MonsterSpeed1');
  if (rapido) assert.ok(rapido.stats.velocidadeDeAtaquePct > 0 || rapido.stats.velocidadePct > 0, JSON.stringify(rapido.stats));
  const incendiario = d.mods.find((m) => m.id === 'MonsterArchnemesisIgniter');
  assert.equal(incendiario.mecanicas[0].elemento, 'fire', 'a queimadura vira o debuff de fogo no golpe');
  assert.ok(d.mods.some((m) => m.pesoMagico > 0) && d.mods.some((m) => m.pesoRaro > 0));
  // Os ocultos de cada raridade (vida "a mais" do PoE: Mágico +148%, Raro +390%).
  assert.equal(d.ocultos.magico.vidaMais, 1.48);
  assert.equal(d.ocultos.raro.vidaMais, 3.9);
});

test('o sorteio: Mágico 1 mod, Raro 2 a 4, só os de nível até o do monstro, sem repetir família', () => {
  const rng = semente(7);
  for (let i = 0; i < 200; i++) {
    const nivel = 1 + (i % 70);
    const mag = Mods.sortearMods('magico', nivel, rng);
    assert.equal(mag.length, 1);
    const raro = Mods.sortearMods('raro', nivel, rng);
    assert.ok(raro.length >= 2 && raro.length <= 4, `${raro.length}`);
    const familias = raro.map((id) => Mods.mod(id).familia).filter(Boolean);
    assert.equal(new Set(familias).size, familias.length);
    for (const id of [...mag, ...raro]) assert.ok(Mods.mod(id).nivel <= nivel, `${id} nível ${Mods.mod(id).nivel} > ${nivel}`);
  }
  assert.deepEqual(Mods.sortearMods('normal', 50, rng), []);
});

test('com o PoE ligado, todo bicho (do PoE e do Draevor) nasce Mágico/Raro só com os mods do PoE e os ocultos; único e chefe ficam como estão', () => {
  Mods.iniciar();
  BESTIARY['poe-teste-30'] = { name: 'Teste', poe: { nivel: 30 } };
  BESTIARY['poe-teste-unico-30'] = { name: 'Único', poe: { nivel: 30, unico: true } };
  const novo = (key) => ({ key, maxHp: 1000, hp: 1000, exp: 100 });
  const raro = Raridade.aplicar(novo('poe-teste-30'), { raridade: 'raro', modificadores: [], sortear: true });
  assert.equal(raro.raridade, 'raro');
  assert.ok(raro.mods.length >= 2 && raro.mods.length <= 4 && raro.mods.every((id) => id.startsWith('poe:')));
  assert.ok(raro.maxHp >= 4900, `vida do Raro com o oculto do PoE (×4,9): ${raro.maxHp}`);
  assert.equal(raro.exp, 500, 'exp do Raro: ×5 (regra do dono)');
  assert.equal(Raridade.aplicar(novo('poe-teste-30'), { raridade: 'modificado', modificadores: [], sortear: true }).exp, 300, 'Mágico ×3');
  assert.equal(Raridade.aplicar(novo('poe-teste-30'), { raridade: 'elite', modificadores: [], sortear: true }).exp, 500, 'Elite conta como Raro: ×5');
  assert.equal(Raridade.aplicar(novo('poe-teste-30'), { raridade: 'boss', modificadores: [], sortear: true }).exp, 500, 'Chefe conta como Único: ×5');
  assert.ok(!raro.levelExtra, 'o PoE não dá level a mais pela raridade');
  // A velocidade de ataque = os +33% ocultos do Raro + a dos mods sorteados (há mods que a reduzem).
  const daRaridade = 1 + (33 + Raridade.statsDos(raro.mods).velocidadeDeAtaquePct) / 100;
  assert.ok(Math.abs((raro.velocidadeDeAtaque ?? 1) - daRaridade) < 1e-9, `${raro.velocidadeDeAtaque} ≠ ${daRaridade}`);
  // Com o PoE ligado só existem os do PoE: os do Draevor saem do catálogo (e um spawn/onda que ainda os cite não dá erro — ele sorteia os do PoE).
  assert.ok(Object.keys(Raridade.MODIFICADORES).every((id) => id.startsWith('poe:')));
  assert.ok(Raridade.IGNORADOS.has('vigoroso') && Raridade.IGNORADOS.has('brutal'));
  const doDraevor = [...Raridade.IGNORADOS][0];
  const doMapa = Raridade.aplicar(novo('poe-teste-30'), { raridade: 'modificado', modificadores: [doDraevor] });
  assert.equal(doMapa.mods.length, 1);
  assert.ok(doMapa.mods[0].startsWith('poe:'));
  assert.deepEqual(Raridade.errosDoSpawn({ raridade: 'modificado', modificadores: [doDraevor] }), []);
  assert.equal(Raridade.CONFIG.raridades.modificado.maxModificadores, 1, 'Mágico aceita 1, como no PoE');
  assert.ok(Raridade.opcoesParaEditor().modificadores.every((m) => m.id.startsWith('poe:')), 'o editor de mapas só oferece os do PoE');
  // Sem `sortear` (simulador, encontros) não sorteia nada.
  assert.equal(Raridade.aplicar(novo('poe-teste-30'), { raridade: 'normal' }).raridade, undefined);
  // Com sorteio, uns viram Mágico/Raro (chance de `sorteioDaRaridade`), os outros seguem normais.
  const conta = {};
  for (let i = 0; i < 2000; i++) {
    const m = Raridade.aplicar(novo('poe-teste-30'), { raridade: 'normal', modificadores: [], sortear: true });
    conta[m.raridade ?? 'normal'] = (conta[m.raridade ?? 'normal'] ?? 0) + 1;
    if (m.raridade === 'modificado') assert.equal(m.mods.length, 1);
  }
  assert.ok(conta.normal > 1500 && conta.modificado > 100 && conta.raro > 10, JSON.stringify(conta));
  // O único do PoE (já com a vida de único no status): nada do PoE.
  assert.equal(Raridade.aplicar(novo('poe-teste-unico-30'), { raridade: 'normal', sortear: true }).raridade, undefined);
  // O bicho do Draevor também: Raro com 2 a 4 mods do PoE e os ocultos do PoE (vida ×4,9), não os números do Draevor.
  const draevor = Raridade.aplicar({ key: 'rat', maxHp: 100, hp: 100, exp: 10 }, { raridade: 'raro', sortear: true });
  assert.ok(draevor.maxHp >= 490, `vida ${draevor.maxHp} (×4,9 do oculto, mais os mods de vida)`);
  assert.ok(draevor.mods.length >= 2 && draevor.mods.every((id) => id.startsWith('poe:')));
  // O chefe não sorteia.
  assert.equal(Raridade.aplicar({ key: 'rat', maxHp: 100, hp: 100, exp: 10, isBoss: true }, { raridade: 'normal', sortear: true }).raridade, undefined);
  // A tela mostra o NOME em português e o texto do PoE.
  const tela = Raridade.paraCliente(raro);
  assert.ok(tela.mods.every((n) => typeof n === 'string' && !n.startsWith('poe:')));
  assert.ok(Raridade.descricaoDe(raro.mods[0]).length > 0);
  delete BESTIARY['poe-teste-30'];
  delete BESTIARY['poe-teste-unico-30'];
});

// A Ameaça Agarradora (o Navio Encalhado, a área de HUNT_DE_TESTE) bate a cada 0,93 s no PoE. A raridade TROCAVA esse ritmo pelo
// "1 + os aumentados": a Rara (+33%) ficava com 1,33 — um golpe a cada 1,5 s, mais devagar que a Comum (loot-moeda.test.mjs, 09/10).
test('a raridade acelera o golpe do PRÓPRIO bicho do PoE: Mágico e Raro batem mais rápido que o Comum da mesma espécie', async () => {
  const { criarMonstro } = await import('../systems/hunt/monstros.mjs');
  const AtributosDoMob = await import('../systems/mobs/atributos.mjs');
  Mods.iniciar();
  const key = 'poe-scrabbling-menace-12';
  const base = BESTIARY[key]?.velocidadeDeAtaque;
  assert.ok(BESTIARY[key]?.poe && base > 1, `a espécie do PoE com o ritmo dela (${base})`);
  const nascer = (raridade, modificadores) => Raridade.aplicar(criarMonstro({ key, x: 0, y: 0 }), { raridade, modificadores });
  const { magico, raro } = Mods.DADOS.ocultos;
  // Mods sem velocidade de ataque: só os ocultos da raridade mexem nela.
  const comum = nascer('normal', []);
  const mag = nascer('modificado', ['poe:MonsterModIncreasedLife']);
  const rar = nascer('raro', ['poe:MonsterModIncreasedLife', 'poe:MonsterArchnemesisGargantuan']);
  assert.equal(comum.velocidadeDeAtaque, base);
  assert.ok(Math.abs(mag.velocidadeDeAtaque - base * (1 + magico.velocidadeDeAtaquePct / 100)) < 1e-9, `Mágico: ${mag.velocidadeDeAtaque}`);
  assert.ok(Math.abs(rar.velocidadeDeAtaque - base * (1 + raro.velocidadeDeAtaquePct / 100)) < 1e-9, `Raro: ${rar.velocidadeDeAtaque}`);
  const intervalo = (m) => AtributosDoMob.intervaloDoGolpe(m);
  assert.equal(intervalo(comum), 930, 'o Comum: o tempo de ataque do PoE');
  assert.ok(intervalo(rar) < intervalo(mag) && intervalo(mag) < intervalo(comum), `Raro ${intervalo(rar)} < Mágico ${intervalo(mag)} < Comum ${intervalo(comum)} ms`);
  // Um mod de velocidade de ataque soma com o oculto (os "aumentados" do PoE somam entre si) e os dois escalam a base.
  const veloz = nascer('raro', ['poe:MonsterModSpeedAura', 'poe:MonsterModIncreasedLife']);
  const doMod = Raridade.statsDos(['poe:MonsterModSpeedAura']).velocidadeDeAtaquePct;
  assert.ok(doMod > 0);
  assert.ok(Math.abs(veloz.velocidadeDeAtaque - base * (1 + (raro.velocidadeDeAtaquePct + doMod) / 100)) < 1e-9, `Raro com Aura do Ímpeto: ${veloz.velocidadeDeAtaque}`);
});

test('o ouro pelo level do monstro: aleatório na faixa da tabela (interpolada), × a raridade e o Gold Find', () => {
  assert.deepEqual(Jogo.faixaDeOuro(1, REGRAS), [2, 4]);
  assert.deepEqual(Jogo.faixaDeOuro(50, REGRAS), [80, 115]);
  assert.deepEqual(Jogo.faixaDeOuro(100, REGRAS), [340, 500]);
  assert.deepEqual(Jogo.faixaDeOuro(120, REGRAS), [340, 500]);
  assert.deepEqual(Jogo.faixaDeOuro(3, REGRAS), [4, 6], 'entre 1 (2–4) e 5 (5–8)');
  const rng = semente(3);
  const vistos = new Set();
  for (let i = 0; i < 500; i++) {
    const o = Jogo.ouroDoMonstro(50, 'normal', rng, REGRAS);
    assert.ok(o >= 80 && o <= 115, `${o}`);
    vistos.add(o);
  }
  assert.ok(vistos.size > 20, 'aleatório dentro da faixa');
  assert.equal(Jogo.multiplicadorDeOuro('modificado', REGRAS), 2.5);
  assert.equal(Jogo.multiplicadorDeOuro('raro', REGRAS), 8.5);
  assert.equal(Jogo.multiplicadorDeOuro('boss', REGRAS), 29.5);
  assert.equal(Jogo.ouroDoMonstro(1, 'raro', () => 0, REGRAS), 17, '2 × 8,5');
  assert.equal(Jogo.ouroDoMonstro(1, 'normal', () => 0.999, REGRAS, 1.5), 6, '4 × Gold Find 50%');
  assert.equal(Jogo.ouroDoMonstro(1, 'raro', () => 0, { ...REGRAS, ouro: { ...REGRAS.ouro, porRaridade: { raro: 3 } } }), 6, 'o multiplicador próprio da raridade manda');
});

test('o monstro do PoE morto solta o ouro do level dele no bolso (o do Draevor não)', async () => {
  const Cacadas = await import('../systems/cacadas.mjs');
  const { matarMonstro } = await import('../systems/hunt/combate.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
  BESTIARY['poe-teste-ouro-40'] = { name: 'Teste do Ouro', look: 0, exp: 10, loot: [], poe: { nivel: 40 } };
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  assert.equal(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto', strategy: 'nearest' }).ok, true);
  e.hunt.monstros = [];
  e.hunt.respawns = [];
  delete e.hunt.instancia;
  const achado = 1 + (Ficha.combate(e).goldFind ?? 0) / 100;
  let uid = 900_000;
  const matar = (extra) => {
    const alvo = { uid: ++uid, key: 'poe-teste-ouro-40', name: 'Teste do Ouro', look: 0, x: e.hunt.pos.x + 1, y: e.hunt.pos.y, dir: 3, hp: 1, maxHp: 1, exp: 10, loot: [], ...extra };
    e.hunt.monstros.push(alvo);
    const antes = e.gold ?? 0;
    matarMonstro(e, e.hunt, PERSONAGEM, alvo, []);
    return (e.gold ?? 0) - antes;
  };
  for (let i = 0; i < 30; i++) {
    const g = matar({});
    assert.ok(g >= Math.round(55 * achado) && g <= Math.round(80 * achado), `normal nv 40: ${g}`);
  }
  const raro = matar({ raridade: 'raro' });
  assert.ok(raro >= Math.round(55 * 8.5 * achado) && raro <= Math.round(80 * 8.5 * achado), `raro nv 40: ${raro}`);
  // Um bicho do Draevor sem moeda no loot: nada de ouro do PoE.
  const antes = e.gold ?? 0;
  const draevor = { uid: ++uid, key: 'rat', name: 'Rat', look: 0, x: e.hunt.pos.x + 1, y: e.hunt.pos.y, dir: 3, hp: 1, maxHp: 1, exp: 5, loot: [] };
  e.hunt.monstros.push(draevor);
  matarMonstro(e, e.hunt, PERSONAGEM, draevor, []);
  assert.equal((e.gold ?? 0) - antes, 0);
  delete BESTIARY['poe-teste-ouro-40'];
});

test('a curva de level do personagem com o PoE: a tabela do dono (exata nos pontos dela), máximo 100', async () => {
  const R = await import('../systems/regras.mjs');
  const pontos = { 1: 0, 10: 17615, 20: 494091, 30: 3418492, 40: 13113982, 50: 38799620, 60: 104259370, 70: 280155640, 80: 759685950, 90: 3047261510, 91: 3698536440, 95: 8000000000, 99: 17275000000, 100: 21057000000 };
  for (const [lv, xp] of Object.entries(pontos)) assert.equal(R.expForLevel(Number(lv)), xp, `level ${lv}`);
  // Cada level custa mais que o anterior.
  for (let L = 1; L < 99; L++) assert.ok(R.expDeUmLevel(L + 1) > R.expDeUmLevel(L), `level ${L + 1}`);
  assert.equal(R.levelFromExp(0), 1);
  assert.equal(R.levelFromExp(17615), 10);
  assert.equal(R.levelFromExp(17614), 9);
  assert.equal(R.levelFromExp(1e15), 100, 'não passa do 100');
  assert.equal(R.expForLevel(101), Infinity);
  assert.deepEqual(R.progressoDoLevel(100, 3e10), { current: 0, needed: 0, percent: 1, toNext: 0 });
  assert.equal(R.progressoDoLevel(10, 17615).needed, R.expForLevel(11) - 17615);
  assert.equal(R.expDeUmLevel(100), 21057000000 - 17275000000, 'no 100, a medida do último level (gemas, morte)');
  // Os estágios (×3 até o 50) e o bônus de level baixo do Draevor não entram na curva do PoE: só stamina/boosts/premium.
  const Boosts = await import('../systems/boosts.mjs');
  const Stamina = await import('../systems/stamina.mjs');
  const { personagemDeTeste } = await import('./apoio.mjs');
  const e = personagemDeTeste({ vocacao: 'knight', level: 5 });
  e.level = 5;
  assert.equal(Boosts.expDoBicho(e, 100), Math.round(100 * Stamina.fatorDeExp(e)));
});

test('a prévia da área do PoE na janela da hunt: monstros com os status do PoE, mods e itens com as chances (somam 100%)', async () => {
  const { existsSync } = await import('node:fs');
  const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
  if (!existsSync(Catalogo.ARQUIVO)) return;
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
  (await import('../systems/itens-poe/campanha.mjs')).iniciar();
  const { previaDaArea } = await import('../systems/itens-poe/previa-da-area.mjs');
  assert.equal(previaDaArea('troll-cave'), null, 'hunt do Draevor não tem prévia do PoE');
  const p = previaDaArea('poe-a1-the-twilight-strand');
  assert.equal(p.nome, 'Costa do Crepúsculo');
  const hillock = p.monstros.find((m) => m.slug === 'Hillock');
  assert.deepEqual([hillock.unico, hillock.vida, hillock.experiencia], [true, 474, 165]);
  const soma = (l) => Math.round(l.reduce((t, x) => t + x.chance, 0));
  assert.equal(soma(p.mods.magico), 100);
  assert.equal(soma(p.mods.raro), 100);
  assert.equal(soma(p.drop.categorias), 100);
  assert.equal(soma(p.drop.raridadeDaPeca), 100);
  assert.ok(p.mods.magico.every((m) => m.nivel <= p.nivel));
  assert.deepEqual(p.drop.pecasPorMonstro, { normal: 16, modificado: 40, raro: 136, unico: 472 });
  assert.deepEqual([p.drop.ouro.min, p.drop.ouro.max], [2, 4]);
});

test('as raridades como no PoE (dono, 07/10): Comum, Mágico azul, Raro amarelo, Único laranja; sem level a mais nem resumo de multiplicadores no balão', () => {
  const r = Raridade.CONFIG.raridades;
  assert.deepEqual([r.normal.nome, r.modificado.nome, r.raro.nome, r.elite.nome, r.unico.nome, r.boss.nome], ['Comum', 'Mágico', 'Raro', 'Raro', 'Único', 'Único']);
  assert.deepEqual([r.modificado.cor, r.raro.cor, r.unico.cor], ['#8888ff', '#ffff77', '#f0a050']);
  assert.ok(Object.values(r).every((x) => !x.levelExtra), 'nenhum level a mais pela raridade');
  const c = Raridade.coresParaCliente();
  assert.equal(c.raro.resumo, null);
  assert.equal(c.raro.cor, '#ffff77');
});
