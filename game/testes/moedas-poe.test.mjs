// As MOEDAS do PoE (dono, 07/10: "cadastre todas as moedas empilháveis com suas funcionalidades ... e fale quais estão funcionando"):
// o cadastro das 195, o status de cada uma, e o efeito de cada moeda que funciona numa peça de verdade do PoE (a moeda só sai quando a
// peça muda; peça corrompida só aceita as Corroídas; peça espelhada não aceita nada).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const M = await import('../systems/itens-poe/moedas.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  Jogo.iniciar(ITEM_CATALOG);
  M.iniciar();
}
const rngDe = (s) => { let x = s; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };
const peca = (base, raridade = 'normal', ilvl = 60) => Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl, rng: rngDe(7) }));
const mods = (p) => [...p.poe.prefixos, ...p.poe.sufixos];
/** Usa a moeda `slug` na peça (na mochila, índice 0) com `n` moedas no bolso. */
function usar(e, slug, alvo = { onde: 'inventory', indice: 0 }, rng = rngDe(11)) {
  e.inventory.push({ id: M.idDa(slug), count: 1 });
  return M.usar(e, { moeda: M.idDa(slug), alvo }, rng);
}
const novo = (p) => Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { inventory: p ? [p] : [] });
const ARMADURA = 'Body_Armours/Plate_Vest';
const ARMA = 'One_Hand_Swords/Rusted_Sword';

test('as 195 moedas no catálogo, cada uma com status; as principais funcionam', { skip: SEM }, () => {
  assert.equal(M.MOEDAS.length, 195);
  for (const m of M.MOEDAS) assert.ok(ITEM_CATALOG[m.itemId]?.stackable, m.slug);
  const st = (s) => M.STATUS[s].status;
  for (const s of ['Orb_of_Transmutation', 'Orb_of_Augmentation', 'Orb_of_Alteration', 'Regal_Orb', 'Orb_of_Alchemy', 'Chaos_Orb', 'Exalted_Orb', 'Orb_of_Scouring', 'Orb_of_Annulment', 'Divine_Orb', 'Blessed_Orb', 'Orb_of_Chance', 'Mirror_of_Kalandra', 'Fracturing_Orb', 'Gemcutters_Prism']) assert.equal(st(s), 'funciona', s);
  assert.equal(st('Vaal_Orb'), 'parcial');
  assert.equal(st('Cartographers_Chisel'), 'nao');
  assert.match(M.STATUS.Cartographers_Chisel.motivo, /mapas/);
  assert.equal(ITEM_CATALOG[M.idDa('Chaos_Orb')].poeMoeda.icone, 'Chaos_Orb.png');
});

test('Transmutação → Ampliador → Alteração → Régia → Exaltado → Caos → Anulação → Divino → Expurgo', { skip: SEM }, () => {
  const p = peca(ARMADURA);
  const e = novo(p);
  assert.ok(!usar(e, 'Chaos_Orb').ok, 'Caos não vale em Normal');
  assert.equal(e.inventory.filter((x) => x.id === M.idDa('Chaos_Orb')).length, 1, 'a moeda não saiu');
  e.inventory = [p];
  assert.ok(usar(e, 'Orb_of_Transmutation').ok);
  assert.equal(p.poe.raridade, 'magico');
  if (mods(p).length < 2) assert.ok(usar(e, 'Orb_of_Augmentation').ok);
  assert.equal(mods(p).length, 2);
  assert.ok(!usar(e, 'Orb_of_Augmentation').ok, 'já tem os dois');
  e.inventory = [p];
  assert.ok(usar(e, 'Orb_of_Alteration', undefined, rngDe(99)).ok);
  assert.ok(usar(e, 'Regal_Orb').ok);
  assert.equal(p.poe.raridade, 'raro');
  const antes = mods(p).length;
  assert.ok(usar(e, 'Exalted_Orb').ok);
  assert.equal(mods(p).length, antes + 1);
  assert.ok(usar(e, 'Chaos_Orb').ok);
  assert.ok(mods(p).length >= 4);
  const n = mods(p).length;
  assert.ok(usar(e, 'Orb_of_Annulment').ok);
  assert.equal(mods(p).length, n - 1);
  const valores = JSON.stringify(mods(p).map((m) => m.valores));
  let mudou = false;
  for (let i = 0; i < 6 && !mudou; i++) { usar(e, 'Divine_Orb', undefined, rngDe(200 + i)); mudou = JSON.stringify(mods(p).map((m) => m.valores)) !== valores; }
  assert.ok(mudou, 'o Divino sorteia os valores de novo');
  assert.ok(Object.keys(p.poe.af).length > 0, 'a peça foi remontada (os atributos do Draevor)');
  assert.ok(usar(e, 'Orb_of_Scouring').ok);
  assert.equal(p.poe.raridade, 'normal');
  assert.equal(mods(p).length, 0);
});

test('Alquimia e Elo viram Rara; o Talhador segura o mod no Caos; a Chance vira Mágica/Rara/Única', { skip: SEM }, () => {
  const p = peca(ARMADURA);
  const e = novo(p);
  assert.ok(usar(e, 'Orb_of_Alchemy').ok);
  assert.equal(p.poe.raridade, 'raro');
  assert.ok(usar(e, 'Fracturing_Orb').ok);
  const talhado = mods(p).find((m) => m.talhado);
  assert.ok(talhado);
  for (let i = 0; i < 3; i++) usar(e, 'Chaos_Orb', undefined, rngDe(50 + i));
  assert.ok(mods(p).some((m) => m.talhado && m.texto === talhado.texto), 'o talhado ficou');
  const q = peca(ARMADURA);
  const f = novo(q);
  assert.ok(usar(f, 'Orb_of_Chance').ok);
  assert.ok(['magico', 'raro', 'unico'].includes(q.poe.raridade));
});

test('qualidade: o Amolador sobe o dano da arma, a Sucata a defesa; até 20%', { skip: SEM }, () => {
  const a = peca(ARMA);
  const e = novo(a);
  const dano = a.base.attack[1];
  assert.ok(!usar(e, 'Armourers_Scrap').ok, 'Sucata não vale em arma');
  for (let i = 0; i < 4; i++) usar(e, 'Blacksmiths_Whetstone');
  assert.equal(a.poe.qualidade, 20);
  assert.ok(a.base.attack[1] > dano);
  assert.ok(!usar(e, 'Blacksmiths_Whetstone').ok, 'no máximo');
  const c = peca(ARMADURA);
  const f = novo(c);
  const def = c.base.armor[0];
  assert.ok(usar(f, 'Armourers_Scrap').ok);
  assert.equal(c.poe.qualidade, 5);
  assert.ok(c.base.armor[0] > def);
});

test('Orbe Vaal corrompe (só as Corroídas valem depois); Espelho copia; Remorso e lascas; Prisma do Lapidário', { skip: SEM }, () => {
  const p = peca(ARMADURA, 'raro');
  const e = novo(p);
  assert.ok(usar(e, 'Vaal_Orb').ok);
  assert.ok(p.poe.corrompido);
  assert.match(usar(e, 'Chaos_Orb').erro, /corrompida/);
  assert.ok(usar(e, 'Tainted_Armourers_Scrap').ok, 'as Corroídas valem');
  const q = peca(ARMADURA, 'raro');
  const f = novo(q);
  assert.ok(usar(f, 'Mirror_of_Kalandra').ok);
  const copia = f.inventory.find((x) => x.poe?.espelhado);
  assert.ok(copia && JSON.stringify(copia.poe.prefixos) === JSON.stringify(q.poe.prefixos));
  assert.match(M.usar(f, { moeda: M.idDa('Chaos_Orb'), alvo: { onde: 'inventory', indice: f.inventory.indexOf(copia) } }).erro ?? 'sem moeda', /espelhada|não tem/);
  const g = novo(null);
  assert.ok(usar(g, 'Orb_of_Regret', null).ok);
  assert.equal(g.passivas.restituicoes, 1);
  g.inventory.push({ id: M.idDa('Chaos_Shard'), count: 20 });
  assert.ok(M.usar(g, { moeda: M.idDa('Chaos_Shard') }).ok);
  assert.ok(g.inventory.some((x) => x.id === M.idDa('Chaos_Orb')));
  assert.ok(!g.inventory.some((x) => x.id === M.idDa('Chaos_Shard')), 'as 20 lascas saíram');
  const gema = [...GS.DEFS.values()].find((d) => d.tipo === 'ativa');
  const h = novo(GS.itemDaGema(GS.novaGema(gema.itemId)));
  assert.ok(usar(h, 'Gemcutters_Prism').ok);
  assert.equal(h.inventory[0].gema.qualidade, 1);
});
