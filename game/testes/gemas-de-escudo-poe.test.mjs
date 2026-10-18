// As GEMAS DE ESCUDO do PoE (lote G4, 17/10): o ataque usa o escudo como a arma da mão secundária — "X a Y de Dano Físico Base como a Mão
// Secundária" (de Fogo/Gelo nas transfiguradas) no lugar do golpe da arma —, + "X a Y de Dano Adicional por cada 15 de Armadura (ou Evasão)
// no Escudo" e "+0,1% de Chance de Golpe Crítico da Mão Secundária por cada 10 de Escudo de Energia Máximo no Escudo"; sem escudo, não sai.
// Antes: o golpe da arma, e o adicional "por cada 15 de Armadura" somado fixo a todo ataque (o compilador o lia como dano adicional).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const GP = await import('../systems/itens-poe/gemas-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

const peca = (base) => Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
/** Um Duelista com uma espada, o escudo (opcional; `defesas`: a armadura/evasão/ES da base trocada) e a gema de escudo na espada. */
function montar(gema, { escudo = 'Shields/Splintered_Tower_Shield', defesas = null } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { classePoe: 'Duelist' });
  const arma = peca('One_Hand_Swords/Rusted_Sword');
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  delete e.equipment.shield;
  if (escudo) {
    const s = peca(escudo);
    // (a defesa do escudo vestido é a faixa da base dele — `condicoes-poe.defesaDaPecaVestida`)
    if (defesas) s.base = { ...(s.base ?? {}), armor: [defesas.armadura ?? 0, defesas.armadura ?? 0], evasion: [defesas.evasao ?? 0, defesas.evasao ?? 0], es: [defesas.escudo ?? 0, defesas.escudo ?? 0] };
    e.equipment.shield = s;
  }
  e.inventory = [GS.itemDaGema({ id: GP.doSlug(gema).itemId, nivel: 20, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GP.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return e;
}
const entryDe = (slug) => Acoes.POR_ID_PUBLICO(GP.doSlug(slug).acao);

test('G4: os números das gemas de escudo no nível 20 e o fim do adicional fixo errado', { skip: SEM }, () => {
  const crush = GP.escudoDaGema('Shield_Crush', 20);
  assert.deepEqual(crush.base, { elemento: 'physical', min: 300, max: 450 });
  assert.deepEqual(crush.porDefesa, [{ elemento: 'physical', min: 8, max: 12, por: 15, defesa: 'armEva' }]);
  assert.equal(GP.escudoDaGema('Shield_Crush_of_the_Chieftain', 20).base.elemento, 'fire');
  assert.equal(GP.escudoDaGema('Spectral_Shield_Throw_of_Shattering', 20).porDefesa[0].defesa, 'evasao');
  assert.deepEqual(GP.escudoDaGema('Divine_Blast', 20).critPorEs, { pct: 0.1, por: 10 });
  assert.equal(GP.escudoDaGema('Cleave', 20), null, 'a Cutilada não é de escudo');
  // o "por cada 15 de Armadura ou Evasão no escudo" não é mais o adicional fixo do ataque
  assert.equal(GP.compilada('Shield_Crush', 20).stats.adicional.fisico, undefined);
  for (const slug of ['Shield_Crush', 'Shield_Charge', 'Spectral_Shield_Throw', 'Glacial_Shield_Swipe', 'Divine_Blast']) {
    assert.ok(!GP.doSlug(slug).motivosNoJogo.some((m) => /Mão Secund|no escudo|no Escudo/i.test(m)), `${slug}: ${GP.doSlug(slug).motivosNoJogo.join(' | ')}`);
  }
});

test('G4: o dano é a base do escudo (não a espada) + o adicional pela Armadura/Evasão do escudo vestido', { skip: SEM }, () => {
  const media = (e, slug) => { const d = Acoes.danoMostrado(e, entryDe(slug)); return (d.min + d.max) / 2; };
  const fraco = montar('Shield_Crush', { defesas: { armadura: 0, evasao: 0 } });
  const forte = montar('Shield_Crush', { defesas: { armadura: 300, evasao: 0 } });
  // 300 de armadura = 20 × (8 a 12) a mais, × a eficácia do ataque
  const ef = GP.eficaciaNoNivel('Shield_Crush', 20);
  const diferencaBruta = 20 * 10 * ef;
  const d0 = media(fraco, 'Shield_Crush');
  const d1 = media(forte, 'Shield_Crush');
  assert.ok(d1 > d0, `${d1} > ${d0}`);
  // o "aumentado" multiplica a diferença: d1 − d0 ≥ a diferença bruta (nenhum "reduzido" no personagem de teste)
  assert.ok(d1 - d0 >= diferencaBruta * 0.95, `${d1 - d0} ≥ ${diferencaBruta}`);
  // a base é a do escudo (300–450 × a eficácia), não a Espada Enferrujada
  assert.ok(d0 >= 375 * ef * 0.95, `${d0} ≥ ${375 * ef}`);
});

test('G4: sem escudo a gema de escudo não sai; com escudo, sai', { skip: SEM }, () => {
  for (const [escudo, ok] of [[null, false], ['Shields/Splintered_Tower_Shield', true]]) {
    const e = montar('Shield_Crush', { escudo });
    assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
    e.hunt.clock = 100_000;
    e.mana = e.maxMana = 1e6;
    const b = e.hunt.monstros[0];
    Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e9, maxHp: 1e9 });
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, {});
    assert.equal(!!r.ok, ok, `${escudo}: ${r.erro}`);
    if (!ok) assert.equal(r.motivo, 'ARMA');
  }
});
