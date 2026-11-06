// (05/11, dono: "resolver as linhas sem efeito dos Únicos" — lote 1, os FRASCOS e as TINTURAS) O levantamento pelo balão achou 61 linhas de
// frascos únicos sem efeito. Agora: o texto de lembrete entre parênteses e a linha vazia são nota; o "durante o efeito" em qualquer caixa e no
// começo da frase; os atributos "durante o Efeito" dos frascos de VIDA e de MANA passam a valer (antes só os de Utilidade); o que o frasco faz
// AO SER USADO (cargas, Escudo de Energia/Vida tirados, Caos em % da Vida, recarga do escudo, Empurrão, Fuga, Exposição, Agressividade por Frenesi,
// Vida por Tolerância) e NO TÉRMINO (Vida inteira, Debilitar); a Eletrização em volta (Vinktar), o Sábio Carvalho, o Colhedor de Almas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
await import('../systems/dados.mjs');
if (!SEM) await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Fr = await import('../systems/itens-poe/frascos.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

/** O frasco único pelo slug, gerado como cai. */
function unico(slug) {
  const cat = Catalogo.catalogo();
  for (const [classe, c] of Object.entries(cat.classes)) {
    const u = c.unicos?.find((x) => x.slug === slug);
    if (!u) continue;
    const b = c.bases.find((x) => x.nome === u.base);
    return Jogo.pecaDoJogo(gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base: b.id, raridade: 'unico', ilvl: 84, rng: semente(7), unico: slug }), Catalogo.REGRAS, semente(9));
  }
  throw new Error(`sem o único ${slug}`);
}
/** Um personagem na caçada com o frasco no cinto (vaga 0), com monstros em volta. */
function comFrasco(slug, monstros = []) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 80 });
  e.inventory = [unico(slug)];
  assert.equal(Fr.por(e, { pilha: 0 }).ok, true);
  e.hunt = { clock: 0, monstros: [], pos: { x: 5, y: 5 } };
  e.maxHp = 1000;
  e.hp = 1000;
  e.maxMana = 500;
  e.mana = 500;
  // (o primeiro tique enche o cinto; os monstros entram depois — com eles em volta o uso automático beberia o frasco)
  Fr.tique(e, [], 'Teste');
  e.hunt.monstros = monstros;
  return e;
}
const linhasSem = (slug) => {
  const p = unico(slug);
  const mods = [...(p.poe.implicitos ?? []), ...(p.poe.prefixos ?? []), ...(p.poe.sufixos ?? []), ...(p.poe.modificadores ?? [])];
  return mods.filter((m, k) => p.poe.estados[k] === 'registrado').map((m) => m.texto);
};

test('o balão: o lembrete entre parênteses e a linha vazia são nota; "durante o efeito" minúsculo e no começo casam; os 45 dos frascos que passaram a ter efeito', { skip: SEM }, () => {
  assert.deepEqual(linhasSem('The_Overflowing_Chalice').filter((t) => /^\(/.test(t)), []);
  assert.deepEqual(linhasSem('Atziris_Promise'), [], 'a Promessa de Atziri ("durante o efeito" minúsculo)');
  assert.deepEqual(linhasSem('Taste_of_Hate'), [], 'o Sabor do Ódio');
  assert.deepEqual(linhasSem('Doedres_Elixir'), [], 'o Elixir de Doedre (ao usar)');
  assert.deepEqual(linhasSem('Vessel_of_Vinktar'), [], 'o Vaso de Vinktar');
  assert.deepEqual(linhasSem('The_Wise_Oak'), [], 'O Sábio Carvalho');
  assert.deepEqual(linhasSem('Lions_Roar'), [], 'o Rugido do Leão');
});

test('o frasco de MANA aplica os atributos "durante o Efeito" (o Espírito de Lavianga: as Habilidades não custam Mana) — antes só o de Utilidade', { skip: SEM }, () => {
  const e = comFrasco('Laviangas_Spirit');
  e.mana = 100;
  assert.equal(Fr.usar(e, 0, [], 'Teste'), true);
  const ativo = Object.values(e.hunt.frascosPoe.ativos)[0];
  assert.equal(ativo.af?.custo_mana_inc, -100);
});

test('o Elixir de Doedre ao usar: as Cargas de Tolerância, Frenesi e Poder da peça; tira o % do Escudo de Energia e o da Vida como Caos (não mata)', { skip: SEM }, () => {
  const e = comFrasco('Doedres_Elixir');
  e.maxEsPoe = 400;
  e.es = 400;
  // (os números são os da peça gerada: o Doedre sorteia 1 a 3 de cada carga)
  const linhas = Fr.cinto(e)[0].poe.modificadores.map((m) => m.texto);
  const n = (re) => Number(linhas.map((t) => t.match(re)?.[1]).find(Boolean));
  assert.equal(Fr.usar(e, 0, [], 'Teste'), true);
  const c = e.hunt.cargasPoe ?? {};
  assert.deepEqual([c.tolerancia?.n, c.frenesi?.n, c.poder?.n], [n(/Ganha (\d+) Cargas? de Tolerância/), n(/Ganha (\d+) Cargas? de Frenesi/), n(/Ganha (\d+) Cargas? de Poder/)]);
  assert.equal(e.es, 400 - (400 * n(/Remove (\d+)% do seu Escudo/)) / 100, 'o % do escudo máximo tirado');
  assert.equal(e.hp, 1000 - (1000 * n(/recebe (\d+)% da sua Vida/)) / 100, 'o % da Vida máxima como Caos');
});

test('o Elixir Coruscante: a Vida fica em 1 e a Vida tirada vira Escudo de Energia em 2 s; o Sangue dos Karui recupera toda a Vida no término', { skip: SEM }, () => {
  const e = comFrasco('Coruscating_Elixir');
  e.hp = 800;
  assert.equal(Fr.usar(e, 0, [], 'Teste'), true);
  assert.equal(e.hp, 1);
  const rec = e.hunt.recuperacoes?.find((r) => r.recurso === 'es');
  assert.ok(rec, 'a regeneração do escudo');
  assert.equal(Math.round(rec.porMs * (rec.ate - rec.desde)), 799);
  const k = comFrasco('Blood_of_the_Karui');
  k.hp = 100;
  assert.equal(Fr.usar(k, 0, [], 'Teste'), true);
  k.hp = 50;
  k.hunt.clock = 60_000;
  Fr.tique(k, [], 'Teste');
  assert.equal(k.hp, 1000, 'no término, a Vida inteira');
});

test('o Vaso de Vinktar: Eletriza quem está em volta enquanto dura, você recebe mais dano, e o Raio nas Magias; o Cálice da Luz Estelar põe Exposição ao usar', { skip: SEM }, () => {
  const perto = { uid: 1, hp: 100, x: 6, y: 5, estados: {} };
  const longe = { uid: 2, hp: 100, x: 20, y: 20, estados: {} };
  const e = comFrasco('Vessel_of_Vinktar', [perto, longe]);
  assert.equal(Fr.usar(e, 0, [], 'Teste'), true);
  const ativo = Object.values(e.hunt.frascosPoe.ativos)[0];
  assert.ok(ativo.af.spell_added_energy_dmg_max > 0, 'o Raio adicionado às Magias');
  assert.ok(ativo.af.dano_recebido_inc > 0, 'você Eletrizado: mais dano recebido');
  e.hunt.clock = 200;
  Fr.tique(e, [], 'Teste');
  assert.ok(perto.estados.chocado?.pct > 0, 'quem está perto, Eletrizado');
  assert.equal(longe.estados.chocado, undefined);
  const alvo = { uid: 3, hp: 100, x: 5, y: 6, estados: {} };
  const l = comFrasco('Starlight_Chalice', [alvo]);
  assert.equal(Fr.usar(l, 0, [], 'Teste'), true);
  assert.ok(alvo.estados.exposicao?.fire > 0 && alvo.estados.exposicao?.ice > 0 && alvo.estados.exposicao?.energy > 0);
});

test('O Sábio Carvalho: no uso, o elemento da Resistência mais baixa recebe menos dano e o da mais alta é penetrado', { skip: SEM }, () => {
  const e = comFrasco('The_Wise_Oak');
  const par = Fr.parametros(Fr.cinto(e)[0], {});
  assert.ok(par.sabio?.reducao > 0 && par.sabio?.penetra > 0);
});

test('o Colhedor de Almas: entra na área sem cargas (perde todas) e consome o máximo de cargas no uso', { skip: SEM }, () => {
  const e = comFrasco('Soul_Ripper');
  const p = Fr.cinto(e)[0];
  assert.equal(p.poe.cargas, 0, 'perdeu as cargas ao entrar');
  const par = Fr.parametros(p, {});
  assert.equal(par.cargasPorUso, par.cargasMaximas);
});
