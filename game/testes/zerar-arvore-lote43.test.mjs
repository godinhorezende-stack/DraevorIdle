// ZERAR A ÁRVORE — LOTE 43 (dono, 16/10: "Fazer todos" — os limites do motor): P040 a ÉGIDE NECROMÂNTICA ("Todos os bônus do Escudo equipado se
// aplicam aos seus Lacaios e não a você") com as DEFESAS: a armadura, a evasão e o escudo de energia da base do escudo (com o "+X" e o "aumentado
// em X%" do próprio escudo), a vida fixa, a supressão de magia e a redução física adicional, o bloqueio aumentado, o dano mágico e o crítico
// mágico (no lacaio que conjura), o dano do elemento (no lacaio daquele elemento), o evitar afecções, o reflexo físico e o início da recarga do
// escudo — no lacaio que leva o golpe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { faixaDoCampo } = await import('../systems/itens/item.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Uma Bruxa com uma Varinha e um Escudo (`base`, com `afEscudo`), e a Égide Necromântica alocada (`egide`). */
function personagem({ afEscudo = {}, base = 'Shields/Cedar_Tower_Shield', egide = true } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { sistema: 'poe', classePoe: 'Witch' });
  const escudo = peca(base);
  escudo.poe.af = { ...(escudo.poe.af ?? {}), ...afEscudo };
  e.equipment = { ...(e.equipment ?? {}), weapon: peca('Wands/Driftwood_Wand'), shield: escudo };
  P.garantir(e);
  if (egide) {
    const no = P.arvore().nos.find((n) => !n.ascendencia && (n.efeitos ?? []).some((x) => /^egide_necromantica$/.test(x.add ?? '')));
    const caminho = P.caminhoAte(e, no.id);
    if (caminho.length > 1) Comandos.comando(e, { action: 'alocar', ids: caminho.slice(0, -1) });
    assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id }).ok);
  }
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  return e;
}
const af = (e) => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };
const media = (p, campo) => { const [a, b] = faixaDoCampo(p, campo); return (a + b) / 2; };

test('a linha da Égide Necromântica: a nota diz o que vai aos lacaios e o que o lacaio do jogo não tem', { skip: SEM }, () => {
  const t = T.traduzirMod({ modelo: 'Todos os bônus do Escudo equipado se aplicam aos seus Lacaios e não a você', valores: [] });
  assert.match(t.partes[0].nota, /DEFESAS da base \(armadura, evasão e escudo de energia/);
  assert.match(t.partes[0].nota, /mana, atributos, precisão/);
});

test('P040 — as DEFESAS do escudo vão aos lacaios: a armadura da base com o "+X" e o "aumentado" dele; a evasão e o escudo de energia; a vida fixa', { skip: SEM }, () => {
  const e = personagem({ afEscudo: { armor_flat: 100, armour_pct: 50, life: 40, spell_suppression: 20, phys_res: 5 } });
  const sem = personagem({ afEscudo: {}, egide: true });
  delete sem.equipment.shield;
  const a = af(e);
  const base = media(e.equipment.shield, 'armor');
  assert.ok(base > 0, 'o Escudo de Torre tem armadura');
  assert.ok(Math.abs(a.minion_armadura - (base + 100) * 1.5) < 1e-6, `${a.minion_armadura} = (${base} + 100) × 1,5`);
  assert.equal((a.minion_vida_fixa ?? 0) - (af(sem).minion_vida_fixa ?? 0), 40);
  assert.equal(a.minion_supressao, 20);
  assert.equal((a.minion_phys_red ?? 0) - (af(sem).minion_phys_red ?? 0), 5);
  // a evasão e o escudo de energia (um escudo de evasão/escudo)
  const ev = personagem({ base: 'Shields/Goathide_Buckler', afEscudo: { evasion: 30 } });
  assert.ok(Math.abs(af(ev).minion_evasao - (media(ev.equipment.shield, 'evasion') + 30)) < 1e-6);
  const es = personagem({ base: 'Shields/Twig_Spirit_Shield', afEscudo: { energy_shield: 20, es_pct: 100 } });
  assert.ok(Math.abs(af(es).minion_es - (media(es.equipment.shield, 'es') + 20) * 2) < 1e-6);
  // o lacaio invocado: a armadura, a supressão, a vida fixa (antes dos aumentos), o escudo de energia fixo
  const q = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, a);
  const q0 = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, af(sem));
  assert.ok(Math.abs(q.poe.armadura - a.minion_armadura) < 1e-6);
  assert.equal(q.poe.supressao, 20);
  assert.ok(q.vida > q0.vida, 'a vida fixa');
  const qe = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, af(es));
  const l = LacaiosPoe.aplicarNoLacaio({ maxHp: 500, hp: 500, poe: qe.poe });
  assert.ok(Math.abs(l.maxEs - Math.round(qe.poe.esFixo)) <= 1, 'o escudo de energia fixo do lacaio');
});

test('P040 — no GOLPE: a armadura (armadura ÷ (armadura + 5 × o físico), com a redução adicional, no teto de 90%), a evasão e a supressão', { skip: SEM }, () => {
  // a armadura: 1000 contra um físico de 100 → 1000 ÷ 1500 = 66,7%; + 10% adicional = 76,7%
  const l = { hp: 1000, maxHp: 1000, nivel: 30, poe: { armadura: 1000, reducaoFisica: 10 } };
  const { dano } = LacaiosPoe.danoNoLacaio(l, { fisico: 100, rng: () => 0.99 });
  assert.ok(Math.abs(dano - 100 * (1 - (100 * 1000 / 1500 + 10) / 100)) < 1e-9);
  // o teto de 90%
  const l2 = { hp: 1000, maxHp: 1000, poe: { armadura: 1e6, reducaoFisica: 50 } };
  assert.ok(Math.abs(LacaiosPoe.danoNoLacaio(l2, { fisico: 100 }).dano - 10) < 1e-9);
  // a evasão contra o ataque (a precisão do bicho); contra a magia, não
  const l3 = { hp: 1000, maxHp: 1000, nivel: 30, poe: { evasao: 5000 } };
  assert.equal(LacaiosPoe.danoNoLacaio(l3, { fisico: 100, precisao: 100, rng: () => 0.01 }).evadiu, true);
  assert.notEqual(LacaiosPoe.danoNoLacaio(l3, { fisico: 100, precisao: 100, magia: true, rng: () => 0.01 }).evadiu, true);
  // a supressão: a magia suprimida, 50% menos
  const l4 = { hp: 1000, maxHp: 1000, poe: { supressao: 100 } };
  assert.equal(LacaiosPoe.danoNoLacaio(l4, { outros: 100, magia: true, rng: () => 0.5 }).dano, 50);
  // o início da recarga do escudo: 2 s ÷ (1 + 100%)
  const l5 = { hp: 1000, maxHp: 1000, es: 10, maxEs: 10, poe: { esRecargaInicio: 100 } };
  LacaiosPoe.danoNoLacaio(l5, { outros: 5 });
  assert.equal(l5.esEspera, 1000);
});

test('P040 — os outros bônus do escudo nos lacaios: o bloqueio aumentado, o dano mágico (no que conjura), o dano do elemento, o evitar afecções', { skip: SEM }, () => {
  const a = af(personagem({ afEscudo: { block_inc: 50, spell_dmg: 40, fire_dmg: 30, avoid_elem_ailments: 100, reflect_phys_melee: 25 } }));
  assert.equal(a.minion_block_inc, 50);
  // o dano mágico vale no lacaio que conjura (o Mago Esqueleto), não no Zumbi; o de Fogo, no lacaio de Fogo
  const zumbi = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, a);
  const zumbi0 = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, {});
  assert.deepEqual(zumbi.dano, zumbi0.dano, 'o Zumbi (físico, corpo a corpo): nem o mágico nem o de Fogo');
  // o bloqueio aumentado no bloqueio do lacaio
  const l = { uid: 'l', x: 0, y: 0, hp: 10, maxHp: 10, poe: { bloqueio: 40, bloqueioInc: 50 } };
  assert.equal(Cacadas.lacaioBloqueia(l, null, [], () => 0.59), true, '40 × 1,5 = 60%');
  assert.equal(Cacadas.lacaioBloqueia({ ...l, poe: { bloqueio: 40 } }, null, [], () => 0.59), false);
  // o evitar afecções: a lentidão do Resfriamento do Elite não pega
  const lento = LacaiosPoe.controleNoLacaio({ poe: { evitarAfeccoes: 100 } }, { elite: true, raridade: 'raro' }, { isBoss: false }, 0, () => 0);
  assert.equal(lento, false);
  assert.equal(zumbi.poe.reflexoFisico, 25);
});
