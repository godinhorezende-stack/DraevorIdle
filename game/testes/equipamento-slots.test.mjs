// O EQUIPAMENTO validado pelo servidor (dono, 03/10): cada peça só entra no slot a que pertence, a munição só vale para a arma que a aceita, e uma recusa
// nunca tira nada da mochila nem do corpo. Ver `systems/itens/equipamento.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Inventario from '../systems/inventario.mjs';
import * as Equipamento from '../systems/itens/equipamento.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { round } from '../systems/hunt/combate.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const todos = Object.values(ITEM_CATALOG);
/** Uma peça real e simples de cada slot (sem requisito de atributo, nível baixo, que não empilha). */
const simples = (slot, filtro = () => true) => todos.find((i) => i.slot === slot && !i.stackable && !(i.minLevel > 5) && !i.requisitos && !i.twoHanded && !i.quiver && !String(i.name).startsWith('Crafted') && filtro(i));
const AMOSTRA = {
  head: simples('head', (i) => i.type === 'helmets'),
  neck: simples('neck', (i) => /amulets/.test(i.type)),
  body: simples('body', (i) => i.type === 'armors'),
  legs: simples('legs', (i) => i.type === 'legs'),
  feet: simples('feet', (i) => i.type === 'boots'),
  ring: simples('ring', (i) => i.type === 'rings'),
  weapon: simples('weapon', (i) => i.type === 'sword weapons'),
  shield: simples('shield', (i) => i.type === 'shields'),
  ammo: todos.find((i) => i.slot === 'ammo' && i.ammo === 'arrow' && i.attack && !(i.minLevel > 5)),
  backpack: simples('backpack', (i) => i.type === 'containers'),
};
const nome = (id) => ITEM_CATALOG[id].name;

function personagem(extra = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 600, ...extra });
  e.equipment = {};
  e.inventory = [];
  return e;
}
const unidades = (e, id) => (e.inventory ?? []).filter((p) => p.id === id).reduce((n, p) => n + (p.count ?? 1), 0) + Object.values(e.equipment ?? {}).filter((p) => p?.id === id).reduce((n, p) => n + (p.count ?? 1), 0);
const fotografia = (e) => JSON.stringify({ i: e.inventory, q: e.equipment });

test('a amostra tem uma peça real para cada slot do jogo', () => {
  for (const slot of Equipamento.SLOTS_DE_EQUIPAMENTO) assert.ok(AMOSTRA[slot], `sem peça de teste para ${slot}`);
});

test('cada peça entra no SEU slot (arrastar para o slot certo e clique, sem dizer o slot)', () => {
  for (const [slot, meta] of Object.entries(AMOSTRA)) {
    const e = personagem();
    e.inventory = [{ id: meta.id, count: 1 }];
    assert.equal(Inventario.equipar(e, { id: meta.id, slot }).ok, true, `${meta.name} em ${slot}`);
    assert.equal(e.equipment[slot].id, meta.id);
    assert.equal(unidades(e, meta.id), 1, 'uma só cópia: no corpo, não na mochila');
    const clique = personagem();
    clique.inventory = [{ id: meta.id, count: 1 }];
    assert.equal(Inventario.equipar(clique, { id: meta.id }).ok, true, `clique: ${meta.name}`);
    assert.equal(clique.equipment[slot].id, meta.id, 'o clique vai para o slot do item, não para o primeiro livre');
  }
});

test('nenhuma peça entra em slot de outra categoria: recusa com a frase certa e NADA muda (mochila e corpo intactos)', () => {
  for (const [slotCerto, meta] of Object.entries(AMOSTRA)) {
    for (const slotErrado of Equipamento.SLOTS_DE_EQUIPAMENTO) {
      if (slotErrado === slotCerto) continue;
      const e = personagem();
      e.inventory = [{ id: meta.id, count: 1 }, { id: AMOSTRA[slotErrado].id, count: 1 }];
      e.equipment[slotErrado] = { id: AMOSTRA[slotErrado].id, count: 1 };
      const antes = fotografia(e);
      const r = Inventario.equipar(e, { id: meta.id, slot: slotErrado });
      assert.equal(r.ok, false, `${meta.name} (${slotCerto}) aceito em ${slotErrado}`);
      assert.equal(r.erro, 'Este item não pode ser equipado neste slot.');
      assert.equal(fotografia(e), antes, `${meta.name} → ${slotErrado}: o estado mudou numa recusa`);
    }
  }
  // Os casos do relato.
  const e = personagem();
  const capacete = AMOSTRA.head;
  e.inventory = [{ id: capacete.id, count: 1 }];
  assert.equal(Inventario.equipar(e, { id: capacete.id, slot: 'feet' }).ok, false, 'capacete em bota');
  assert.equal(Inventario.equipar(e, { id: AMOSTRA.body.id, slot: 'ring' }).ok, false, 'armadura em anel (nem está na mochila)');
});

test('o cliente não manda o que quer: slot inventado, item que não está na mochila, item que não se veste', () => {
  const e = personagem();
  e.inventory = [{ id: AMOSTRA.head.id, count: 1 }];
  const antes = fotografia(e);
  assert.equal(Inventario.equipar(e, { id: AMOSTRA.head.id, slot: 'cabeça' }).ok, false, 'slot inventado');
  assert.equal(Inventario.equipar(e, { id: AMOSTRA.head.id, slot: '__proto__' }).ok, false);
  assert.equal(Inventario.equipar(e, { id: AMOSTRA.body.id, slot: 'body' }).ok, false, 'peça que não está na mochila');
  assert.equal(Inventario.equipar(e, { id: 999999999 }).ok, false, 'item que não existe');
  const pocao = todos.find((i) => !i.slot && i.stackable);
  e.inventory.push({ id: pocao.id, count: 5 });
  const comPocao = fotografia(e);
  assert.equal(Inventario.equipar(e, { id: pocao.id, slot: 'weapon' }).ok, false, 'item sem slot');
  assert.equal(fotografia(e), comPocao);
  assert.notEqual(antes, '');
});

test('a troca é segura: a peça antiga volta para a mochila, nada duplica e nada some; recusa por level mantém tudo', () => {
  const e = personagem();
  const outra = simples('head', (i) => i.type === 'helmets' && i.id !== AMOSTRA.head.id);
  e.inventory = [{ id: AMOSTRA.head.id, count: 1 }, { id: outra.id, count: 1 }];
  assert.equal(Inventario.equipar(e, { id: AMOSTRA.head.id, slot: 'head' }).ok, true);
  assert.equal(Inventario.equipar(e, { id: outra.id, slot: 'head' }).ok, true);
  assert.equal(e.equipment.head.id, outra.id);
  assert.equal(unidades(e, AMOSTRA.head.id), 1, 'a antiga voltou, uma só cópia');
  assert.equal(unidades(e, outra.id), 1);
  // Level insuficiente: recusa e nada sai do lugar.
  const fraco = personagem({ level: 3 });
  const pesada = todos.find((i) => i.slot === 'body' && i.minLevel >= 200 && !i.stackable);
  fraco.inventory = [{ id: pesada.id, count: 1 }];
  const antes = fotografia(fraco);
  const r = Inventario.equipar(fraco, { id: pesada.id, slot: 'body' });
  assert.equal(r.ok, false);
  assert.ok(r.erro && r.erro.length > 3, 'a recusa explica o requisito (level ou atributo)');
  assert.equal(fotografia(fraco), antes);
});

test('desequipar devolve UMA cópia à mochila; atributos acompanham equipar e desequipar', () => {
  const e = personagem();
  const armadura = todos.find((i) => i.slot === 'body' && i.armor > 5 && !(i.minLevel > 5) && !i.requisitos && !i.stackable);
  e.inventory = [{ id: armadura.id, count: 1 }];
  const sem = Ficha.combate(e).armor;
  assert.equal(Inventario.equipar(e, { id: armadura.id, slot: 'body' }).ok, true);
  Ficha.invalidar(e);
  assert.ok(Ficha.combate(e).armor > sem, 'a armadura soma ao equipar');
  assert.equal(Inventario.desequipar(e, { slot: 'body' }).ok, true);
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).armor, sem, 'e sai ao desequipar');
  assert.equal(unidades(e, armadura.id), 1);
  assert.equal(Inventario.desequipar(e, { slot: 'body' }).ok, false, 'já vazio');
  assert.equal(Inventario.desequipar(e, { slot: 'backpack' }).ok, false, 'a mochila não sai');
});

test('persistência: o equipamento sobrevive ao salvar e carregar (JSON); peça em slot errado de antes volta para a mochila sem perda', () => {
  const e = personagem();
  e.inventory = [{ id: AMOSTRA.head.id, count: 1 }];
  Inventario.equipar(e, { id: AMOSTRA.head.id, slot: 'head' });
  const recarregado = JSON.parse(JSON.stringify(e));
  assert.deepEqual(recarregado.equipment, e.equipment);
  // Estado antigo: uma espada vestida no slot do escudo e um anel no slot do capacete.
  const antigo = personagem();
  antigo.equipment.shield = { id: AMOSTRA.weapon.id, count: 1 };
  antigo.equipment.head = { id: AMOSTRA.ring.id, count: 1 };
  antigo.equipment.body = { id: AMOSTRA.body.id, count: 1 };
  const saiu = Inventario.recolherPecasNoSlotErrado(antigo);
  assert.equal(saiu.length, 2);
  assert.equal(antigo.equipment.shield, null);
  assert.equal(antigo.equipment.head, null);
  assert.equal(antigo.equipment.body.id, AMOSTRA.body.id, 'a peça no slot certo fica');
  assert.equal(unidades(antigo, AMOSTRA.weapon.id), 1);
  assert.equal(unidades(antigo, AMOSTRA.ring.id), 1);
  assert.deepEqual(Inventario.recolherPecasNoSlotErrado(antigo), [], 'rodar de novo não faz nada');
});

// ------------------------------------------------------------------ munição

const arco = todos.find((i) => i.slot === 'weapon' && i.ammo === 'arrow' && !(i.minLevel > 5) && !i.requisitos);
const besta = todos.find((i) => i.slot === 'weapon' && i.ammo === 'bolt' && !(i.minLevel > 5) && !i.requisitos);
const flecha = todos.find((i) => i.slot === 'ammo' && i.ammo === 'arrow' && i.attack && !(i.minLevel > 5));
const bolt = todos.find((i) => i.slot === 'ammo' && i.ammo === 'bolt' && i.attack && !(i.minLevel > 5));
const lanca = todos.find((i) => i.slot === 'weapon' && i.skill === 'distance' && !i.ammo && i.attack && !(i.minLevel > 5));
const wand = todos.find((i) => i.slot === 'weapon' && i.type === 'wands' && !(i.minLevel > 5));
const rod = todos.find((i) => i.slot === 'weapon' && i.type === 'rods' && !(i.minLevel > 5));

test('quais armas usam munição: só as que o catálogo marca (arco e besta); lança, wand e rod não', () => {
  assert.ok(arco && besta && flecha && bolt && lanca && wand && rod);
  assert.equal(Equipamento.usaMunicao(arco), true);
  assert.equal(Equipamento.usaMunicao(besta), true);
  for (const m of [lanca, wand, rod, AMOSTRA.weapon]) assert.equal(Equipamento.usaMunicao(m), false, m.name);
  assert.equal(Equipamento.municaoServe(arco, flecha), true);
  assert.equal(Equipamento.municaoServe(besta, bolt), true);
  assert.equal(Equipamento.municaoServe(arco, bolt), false, 'bolt não serve no arco');
  assert.equal(Equipamento.municaoServe(besta, flecha), false, 'flecha não serve na besta');
  assert.equal(Equipamento.municaoServe(lanca, flecha), false, 'arma sem munição não aceita nenhuma');
  // A flecha sem a marca do tipo no catálogo (simple arrow, burst arrow) agora vale para o arco.
  for (const f of todos.filter((i) => i.slot === 'ammo' && i.type === 'ammunition' && / arrow$/.test(i.name))) assert.equal(f.ammo, 'arrow', f.name);
});

function naCacada(arma, municao = null) {
  const e = personagemDeTeste({ vocacao: 'paladin', level: 300 });
  e.equipment.shield = null;
  e.equipment.weapon = { id: arma.id, count: 1 };
  e.equipment.ammo = municao ? { id: municao.id, count: 1 } : null;
  e.maxHp = e.hp = 1e12;
  e.maxMana = e.mana = 1e9;
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.outrosAndares = {};
  const m = criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null);
  m.hp = m.maxHp = 1e12;
  m.forca = 0;
  m.resist = {};
  delete m.spawn;
  h.monstros.splice(0, h.monstros.length, m);
  h.alvo = m.uid;
  return { e, m };
}
const dano = (e, m, rodadas = 30) => {
  const antes = m.hp;
  for (let i = 0; i < rodadas; i++) round(e, PERSONAGEM);
  return antes - m.hp;
};

test('arco com flecha e besta com bolt atiram; a munição NÃO se gasta (é uma peça que dá ataque) e o ataque vem dela', () => {
  for (const [arma, municao] of [[arco, flecha], [besta, bolt]]) {
    const { e, m } = naCacada(arma, municao);
    assert.equal(Equipamento.faltaMunicao(e), false);
    assert.ok(dano(e, m) > 0, `${arma.name} com ${municao.name}`);
    assert.equal(e.equipment.ammo.count, 1, 'a munição continua lá');
    assert.equal(e.equipment.ammo.id, municao.id);
    assert.ok(Ficha.combate(e).ataque >= municao.attack, 'o ataque da munição soma ao da arma');
  }
});

test('arco sem munição, ou com a munição errada (bolt no arco): o golpe da arma não sai e avisa, e a munição errada não dá bônus', () => {
  for (const municao of [null, bolt]) {
    const { e, m } = naCacada(arco, municao);
    assert.equal(Equipamento.faltaMunicao(e), true);
    assert.equal(dano(e, m), 0, `arco com ${municao ? municao.name : 'nada'} não deveria atirar`);
    assert.match(e.avisoDaHunt ?? '', /munição/i);
    if (municao) assert.equal(Ficha.combate(e).ataque, 0, 'a munição errada não dá bônus');
  }
  // Pôr a flecha certa destrava o tiro e limpa o estado.
  const { e, m } = naCacada(arco, bolt);
  dano(e, m, 3);
  e.equipment.ammo = { id: flecha.id, count: 1 };
  Ficha.invalidar(e);
  assert.ok(dano(e, m) > 0);
});

test('arma que NÃO usa munição (lança, wand, rod) ataca normalmente sem nada no slot de munição', () => {
  for (const arma of [lanca, wand, rod]) {
    const { e, m } = naCacada(arma, null);
    assert.equal(Equipamento.faltaMunicao(e), false, arma.name);
    assert.ok(dano(e, m) > 0, `${arma.name} sem munição`);
  }
});

test('troca de arma com munição equipada: a munição fica, e vale só para a arma que a aceita', () => {
  const e = personagem();
  e.inventory = [{ id: arco.id, count: 1 }, { id: besta.id, count: 1 }, { id: flecha.id, count: 1 }];
  assert.equal(Inventario.equipar(e, { id: flecha.id, slot: 'ammo' }).ok, true);
  assert.equal(Inventario.equipar(e, { id: arco.id, slot: 'weapon' }).ok, true);
  assert.equal(Equipamento.faltaMunicao(e), false);
  assert.equal(Inventario.equipar(e, { id: besta.id, slot: 'weapon' }).ok, true);
  assert.equal(e.equipment.ammo.id, flecha.id, 'a flecha continua equipada');
  assert.equal(Equipamento.faltaMunicao(e), true, 'mas não serve na besta');
  assert.equal(unidades(e, arco.id), 1);
});

test('duas mãos: o arco tira o escudo e o escudo tira a arma de duas mãos; arma de uma mão e escudo convivem; a aljava fica com o arco', () => {
  const e = personagem();
  const escudo = AMOSTRA.shield;
  const umaMao = AMOSTRA.weapon;
  e.inventory = [{ id: escudo.id, count: 1 }, { id: umaMao.id, count: 1 }, { id: arco.id, count: 1 }];
  assert.equal(Inventario.equipar(e, { id: escudo.id, slot: 'shield' }).ok, true);
  assert.equal(Inventario.equipar(e, { id: umaMao.id, slot: 'weapon' }).ok, true);
  assert.ok(e.equipment.shield && e.equipment.weapon, 'uma mão + escudo convivem');
  assert.equal(Inventario.equipar(e, { id: arco.id, slot: 'weapon' }).ok, true);
  assert.equal(e.equipment.shield, null, 'o arco (duas mãos) tirou o escudo');
  assert.equal(unidades(e, escudo.id), 1);
  const aljava = todos.find((i) => i.quiver && i.slot === 'shield' && !(i.minLevel > 5) && !i.requisitos);
  if (aljava) {
    e.inventory.push({ id: aljava.id, count: 1 });
    assert.equal(Inventario.equipar(e, { id: aljava.id, slot: 'shield' }).ok, true);
    assert.equal(e.equipment.weapon.id, arco.id, 'a aljava não tira o arco');
  }
});

test('o cliente antecipa a regra (destaca o slot certo, recusa o errado com a mensagem) e o servidor continua sendo a barreira', async () => {
  const { readFileSync } = await import('node:fs');
  const inv = readFileSync(new URL('../frontend/client/src/inventory.mjs', import.meta.url), 'utf8');
  for (const trecho of ['marcarSlotsCompativeis', 'limparMarcasDeSlot', 'slot-incompativel', "Este item não pode ser equipado neste slot."]) assert.ok(inv.includes(trecho), trecho);
  const css = readFileSync(new URL('../frontend/client/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.slot\.slot-compativel/);
  const inventario = readFileSync(new URL('../systems/inventario.mjs', import.meta.url), 'utf8');
  assert.ok(!/const destino = slot \?\? meta\?\.slot;\s*\n\s*if \(!meta \|\| !destino\)/.test(inventario), 'o equipar não aceita mais qualquer slot');
  assert.ok(inventario.includes('Equipamento.validarEquipar'));
});
