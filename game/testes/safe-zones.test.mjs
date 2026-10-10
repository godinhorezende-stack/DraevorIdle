// As SAFE ZONES por casa (dono, 10/10: "Animação de Portais e Sistema de Safe Zones" — `systems/protecao.mjs`). As casas seguras moram no
// arquivo do mapa (`seguras`), marcadas no editor; dentro delas o jogador não ataca nem apanha (golpe, magia, mecânica, dano contínuo), e
// nenhum bicho nasce, pisa, atravessa ou persegue para dentro. O bicho que estiver numa (o mapa carregou assim, a configuração mudou) sai.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE, comSkills } from './apoio.mjs';
import { doClassico } from './apoio-migracao.mjs';
import * as Protecao from '../systems/protecao.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Poderes from '../systems/poderes.mjs';
import * as Mecanicas from '../systems/mobs/mecanicas.mjs';
import * as Dot from '../systems/combate/dot.mjs';
import * as R from '../systems/regras.mjs';
import { moverMonstros, renascer } from '../systems/hunt/monstros.mjs';
import { andarDaGrade } from '../systems/hunt/andares.mjs';
import { huntOuMapaCustom, mapaRealCapturado, RAIZ_HUNTS } from '../systems/hunt/terreno.mjs';
import { casaLivre } from '../systems/encontros/sala.mjs';
import { empurrar } from '../systems/itens-poe/condicoes-poe.mjs';
import * as L from '../frontend/client/src/editor-mapas-logica.mjs';
import * as MapasAdmin from '../admin/mapas.mjs';

const DIF = HUNT_DE_TESTE === 'troll-cave' ? 'medio' : 'facil';
const k = (x, y) => `${x},${y}`;

/** Uma sala `w`×`h` toda andável, com o mapa (e as casas seguras do andar 7) por baixo. */
function sala(w, h, seguras = []) {
  const andavel = new Set();
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) andavel.add(k(x, y));
  return { z: 7, minX: 0, maxX: w - 1, minY: 0, maxY: h - 1, andavel, mapa: { width: w, height: h, z: 7, seguras: { 7: seguras } } };
}
const bicho = (uid, x, y, extra = {}) => ({ uid, key: 'rat', x, y, dir: 2, hp: 100, maxHp: 100, perseguindo: true, proximoPasso: 0, ...extra });

/** Entra na caçada de teste e devolve o estado e a grade do andar dela. */
function naCacada(level = 60) {
  const e = personagemDeTeste({ level });
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade: DIF }).ok);
  const grade = andarDaGrade(Cacadas.gradeDaHunt(huntOuMapaCustom(e.hunt.huntId)), e.hunt.z);
  return { e, h: e.hunt, grade };
}
/** As casas seguras do mapa da caçada durante `fn` (o mapa em memória é o mesmo de todo o processo: volta como estava no fim). */
async function comSeguras(grade, porAndar, fn) {
  const antes = grade.mapa.seguras;
  grade.mapa.seguras = Object.fromEntries(Object.entries(porAndar).map(([z, casas]) => [z, [...casas].map((c) => c.split(',').map(Number))]));
  try {
    return await fn();
  } finally {
    if (antes === undefined) delete grade.mapa.seguras;
    else grade.mapa.seguras = antes;
  }
}
/** A casa andável vizinha de `p` (fora de `fora`). */
function vizinha(grade, p, fora = new Set()) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const c = { x: p.x + dx, y: p.y + dy };
    if (grade.andavel.has(k(c.x, c.y)) && !fora.has(k(c.x, c.y))) return c;
  }
  return null;
}

test('as casas seguras do arquivo: a casa é segura, a grade dos bichos fica sem elas, e trocar a configuração refaz a conta', () => {
  const g = sala(5, 5, [[2, 2], [2, 3]]);
  assert.equal(Protecao.ehSegura(g, 2, 2), true);
  assert.equal(Protecao.ehSegura(g, 1, 1), false);
  assert.equal(Protecao.temSeguras(g.mapa), true);
  const dosBichos = Protecao.gradeDosBichos(g);
  assert.equal(dosBichos.andavel.has('2,2'), false);
  assert.equal(dosBichos.andavel.has('1,1'), true);
  assert.equal(dosBichos.andavel.size, g.andavel.size - 2);
  assert.equal(Protecao.gradeDosBichos(g), dosBichos, 'guardada');
  // O editor salvou outra configuração: o objeto novo refaz as casas e a grade.
  g.mapa.seguras = { 7: [[0, 0]] };
  assert.equal(Protecao.ehSegura(g, 2, 2), false);
  assert.equal(Protecao.gradeDosBichos(g).andavel.has('0,0'), false);
  assert.equal(Protecao.gradeDosBichos(g).andavel.has('2,2'), true);
  // Sem casa segura, a grade é a própria.
  delete g.mapa.seguras;
  assert.equal(Protecao.gradeDosBichos(g), g);
});

test('validação das casas seguras (servidor): dentro do mapa, inteiros, sem repetição; vazio vira null', () => {
  const mapa = { width: 10, height: 8 };
  assert.deepEqual(Protecao.validarSeguras({ 7: [[3, 4], [1, 1], [3, 4]] }, mapa), { ok: true, seguras: { 7: [[1, 1], [3, 4]] } });
  assert.deepEqual(Protecao.validarSeguras({ 7: [] }, mapa), { ok: true, seguras: null });
  assert.deepEqual(Protecao.validarSeguras(null, mapa), { ok: true, seguras: null });
  assert.match(Protecao.validarSeguras({ 7: [[10, 1]] }, mapa).erro, /fora do mapa/);
  assert.match(Protecao.validarSeguras({ 7: [[1.5, 1]] }, mapa).erro, /fora do mapa/);
  assert.match(Protecao.validarSeguras({ sete: [[1, 1]] }, mapa).erro, /andar inválido/);
  assert.match(Protecao.validarSeguras([[1, 1]], mapa).erro, /formato/);
});

test('PATHFINDING: o bicho contorna a zona (nunca pisa nela) e chega ao jogador pela passagem que sobra', () => {
  // Sala 7×3; a zona fecha a coluna x=3 menos a casa de baixo: a única passagem é (3,2).
  const g = sala(7, 3, [[3, 0], [3, 1]]);
  const hunt = { pos: { x: 6, y: 1 }, monstros: [bicho(1, 0, 1)] };
  const m = hunt.monstros[0];
  const pisadas = [];
  for (let t = 1; t <= 30 && Math.max(Math.abs(m.x - 6), Math.abs(m.y - 1)) > 1; t++) {
    moverMonstros(hunt, Protecao.gradeDosBichos(g), t * 2000);
    pisadas.push(k(m.x, m.y));
  }
  assert.ok(!pisadas.includes('3,0') && !pisadas.includes('3,1'), `nunca na zona: ${pisadas.join(' ')}`);
  assert.ok(pisadas.includes('3,2'), 'passou pela passagem');
  assert.ok(Math.max(Math.abs(m.x - 6), Math.abs(m.y - 1)) <= 1, 'chegou ao jogador');
});

test('PATHFINDING: zona fechando o caminho inteiro → o bicho não atravessa; com o jogador DENTRO, ninguém persegue', () => {
  const g = sala(7, 3, [[3, 0], [3, 1], [3, 2]]);
  const hunt = { pos: { x: 6, y: 1 }, monstros: [bicho(1, 1, 1)] };
  for (let t = 1; t <= 10; t++) moverMonstros(hunt, Protecao.gradeDosBichos(g), t * 2000);
  assert.ok(hunt.monstros[0].x < 3, `não atravessou (x=${hunt.monstros[0].x})`);
  // O jogador entra na zona: a IA larga a perseguição.
  const dentro = { pos: { x: 3, y: 1 }, monstros: [bicho(1, 1, 1)] };
  moverMonstros(dentro, Protecao.gradeDosBichos(g), 2000, { semPerseguir: true });
  assert.deepEqual([dentro.monstros[0].x, dentro.monstros[0].y, dentro.monstros[0].perseguindo], [1, 1, false]);
});

test('SPAWN: nenhum bicho nasce numa casa segura (a instância, o chefe, o povoar), em nenhum andar', async () => {
  const primeira = naCacada();
  const base = Cacadas.gradeDaHunt(huntOuMapaCustom(primeira.h.huntId));
  // A zona cobre as casas em volta de onde os bichos nasceram da primeira vez (raio 2), em cada andar.
  const porAndar = {};
  const todos = [[primeira.h.z, primeira.h.monstros], ...Object.entries(primeira.h.outrosAndares ?? {})];
  for (const [z, lista] of todos) {
    const g = andarDaGrade(base, Number(z));
    const casas = (porAndar[z] ??= new Set());
    for (const m of lista) for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (g.andavel.has(k(m.x + dx, m.y + dy))) casas.add(k(m.x + dx, m.y + dy));
  }
  await comSeguras(base, porAndar, () => {
    const { h } = naCacada();
    const naZona = [[h.z, h.monstros], ...Object.entries(h.outrosAndares ?? {})].flatMap(([z, lista]) => lista.filter((m) => porAndar[z]?.has(k(m.x, m.y))));
    assert.deepEqual(naZona.map((m) => `${m.name} ${m.x},${m.y}`), [], 'ninguém nasceu na zona');
    const nasceram = h.monstros.length + Object.values(h.outrosAndares ?? {}).flat().length;
    assert.ok(nasceram > 0, 'e os bichos nasceram (fora dela)');
  });
});

test('RESPAWN e INVOCAÇÃO: o ponto que ficou numa casa segura → o bicho renasce na casa livre mais perto FORA dela; a invocação idem', async () => {
  const { h, grade } = naCacada();
  const molde = h.monstros.find((m) => m.hp > 0);
  // Uma casa andável longe do jogador e a zona em volta dela (raio 1).
  const centro = [...grade.andavel].map((c) => c.split(',').map(Number)).find(([x, y]) => Math.max(Math.abs(x - h.pos.x), Math.abs(y - h.pos.y)) > 6 && [-1, 0, 1].every((d) => grade.andavel.has(k(x + d, y)) && grade.andavel.has(k(x, y + d))));
  assert.ok(centro, 'achou uma casa para a zona');
  const zona = new Set();
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) zona.add(k(centro[0] + dx, centro[1] + dy));
  await comSeguras(grade, { [grade.z]: zona }, () => {
    h.monstros.splice(0, h.monstros.length);
    h.respawns.push({ key: molde.key, x: centro[0], y: centro[1], volta: 0 });
    renascer(h);
    assert.equal(h.monstros.length, 1, 'renasceu');
    const novo = h.monstros[0];
    assert.equal(zona.has(k(novo.x, novo.y)), false, `fora da zona (${novo.x},${novo.y})`);
    assert.ok(Math.max(Math.abs(novo.x - centro[0]), Math.abs(novo.y - centro[1])) <= 3, 'perto do ponto');
    // A casa de uma invocação/encontro (`encontros/sala.casaLivre`, que os chefes únicos e os eventos usam).
    const casa = casaLivre(h, { x: centro[0], y: centro[1] }, h.z);
    assert.ok(casa && !zona.has(k(casa.x, casa.y)), 'a invocação não cai na zona');
  });
});

test('COMBATE nas duas mãos: na zona o jogador não ataca e não apanha (nem do bicho colado); fora dela, tudo volta', async () => {
  const { e, h, grade } = naCacada();
  h.modo = 'online';
  const casa = { x: h.pos.x, y: h.pos.y };
  const lado = vizinha(grade, casa);
  const vivo = h.monstros.find((m) => m.hp > 0);
  h.monstros.splice(0, h.monstros.length, vivo);
  Object.assign(vivo, { x: lado.x, y: lado.y, hp: 1e9, maxHp: 1e9 });
  delete vivo.proximoGolpe;
  h.alvo = vivo.uid;
  const hp = e.hp;
  // O golpe do jogador SAIU (acertando ou não): o relógio dele (`proximoGolpeEm`) anda. A vida do bicho não serve de prova — o golpe pode
  // errar, e o bicho que sorteou o Escudo de Energia (os modificadores do PoE) o gasta antes da vida.
  const golpeAntes = h.proximoGolpeEm;
  let agora = Date.now();
  await comSeguras(grade, { [grade.z]: new Set([k(casa.x, casa.y)]) }, () => {
    for (let t = 0; t < 24; t++) Cacadas.tique(e, PERSONAGEM, (agora += R.PASSO_MS));
    assert.equal(h.imune, true, 'imune na casa segura');
    assert.equal(h.proximoGolpeEm, golpeAntes, 'o jogador não atacou');
    assert.equal(vivo.hp, 1e9);
    assert.equal(vivo.proximoGolpe, undefined, 'o bicho não tentou golpe');
    assert.equal(e.hp, hp, 'nem um ponto de vida');
    assert.deepEqual([h.pos.x, h.pos.y], [casa.x, casa.y]);
  });
  // A zona some (a configuração mudou): as regras de sempre.
  for (let t = 0; t < 24; t++) Cacadas.tique(e, PERSONAGEM, (agora += R.PASSO_MS));
  assert.equal(h.imune, false);
  assert.notEqual(h.proximoGolpeEm, golpeAntes, 'o jogador ataca');
  assert.notEqual(vivo.proximoGolpe, undefined, 'o bicho ataca');
});

test('MAGIA, MECÂNICA e DANO CONTÍNUO não ferem na zona (o caminho comum do dano no jogador)', () => {
  const { e, h } = naCacada();
  const ficha = Ficha.combate(e);
  const m = h.monstros.find((x) => x.hp > 0);
  e.hp = e.maxHp;
  Protecao.marcarImune(h, true);
  assert.equal(Poderes.danoDeElementoNoJogador(e, h, PERSONAGEM, m, 500, 'fire', [], 'Teste', ficha, false), 0);
  assert.equal(Poderes.aplicarNoJogador({ estado: e, hunt: h, bicho: m, dano: 500, elemento: 'fire', eventos: [], base: { uid: 'player', x: h.pos.x, y: h.pos.y }, ficha, temEscudo: false }), 0);
  const tipo = Object.keys(Dot.CONFIG.tipos)[0];
  Dot.aplicarNoJogador(h, { tipo, total: 5000, origem: { fonte: 'mob', mob: m.name, uid: m.uid } }, h.clock ?? 0);
  h.clock = (h.clock ?? 0) + 5000;
  Mecanicas.tique(e, h, PERSONAGEM, []);
  assert.equal(e.hp, e.maxHp, 'o veneno pulsou sem ferir');
  // Fora da zona, o mesmo dano fere.
  Protecao.marcarImune(h, false);
  Poderes.danoDeElementoNoJogador(e, h, PERSONAGEM, m, 500, 'fire', [], 'Teste', ficha, false);
  assert.ok(e.hp < e.maxHp, 'fora da zona, fere');
});

test('o bicho que está numa casa segura (o mapa carregou assim, a configuração mudou) SAI dela no tique — sem prender ninguém', async () => {
  const g = sala(6, 6, [[2, 2], [2, 3], [3, 2], [3, 3]]);
  const hunt = { pos: { x: 0, y: 0 }, monstros: [bicho(1, 2, 2), bicho(2, 3, 3), bicho(3, 5, 5)] };
  assert.equal(Protecao.tirarBichosDaZona(hunt, g), 2);
  for (const m of hunt.monstros) assert.equal(Protecao.ehSegura(g, m.x, m.y), false, `${m.uid} fora (${m.x},${m.y})`);
  assert.equal(new Set(hunt.monstros.map((m) => k(m.x, m.y))).size, 3, 'cada um numa casa');
  // Sem casa livre fora da zona por perto: sai da caçada (não fica preso lá dentro).
  const toda = sala(3, 3, [...Array(9)].map((_, i) => [i % 3, Math.floor(i / 3)]));
  const preso = { pos: { x: 0, y: 0 }, monstros: [bicho(9, 1, 1)] };
  assert.equal(Protecao.tirarBichosDaZona(preso, toda), 1);
  assert.equal(preso.monstros.length, 0);
  // Na caçada de verdade: o tique do dono da sala tira.
  const { e, h, grade } = naCacada();
  const m = h.monstros.find((x) => x.hp > 0);
  await comSeguras(grade, { [grade.z]: new Set([k(m.x, m.y)]) }, () => {
    Cacadas.tique(e, PERSONAGEM, Date.now() + R.PASSO_MS);
    assert.equal(Protecao.ehSegura(grade, m.x, m.y), false, 'saiu da casa segura');
  });
});

test('o EMPURRÃO do PoE não joga um bicho para dentro da zona', async () => {
  const { e, h, grade } = naCacada();
  const atras = (m) => ({ x: m.x + Math.sign(m.x - h.pos.x), y: m.y + Math.sign(m.y - h.pos.y) });
  const lado = vizinha(grade, h.pos, new Set());
  const m = h.monstros.find((x) => x.hp > 0);
  h.monstros.splice(0, h.monstros.length, m);
  Object.assign(m, { x: lado.x, y: lado.y });
  const destino = atras(m);
  if (!grade.andavel.has(k(destino.x, destino.y))) return;
  await comSeguras(grade, { [grade.z]: new Set([k(destino.x, destino.y)]) }, () => {
    Cacadas.tique(e, PERSONAGEM, Date.now() + R.PASSO_MS);
    Object.assign(m, { x: lado.x, y: lado.y, hp: Math.max(1, m.hp) });
    assert.equal(empurrar(h, m), false, 'a casa de trás é segura: não empurra');
  });
  Cacadas.tique(e, PERSONAGEM, Date.now() + 2 * R.PASSO_MS);
  Object.assign(m, { x: lado.x, y: lado.y });
  assert.equal(empurrar(h, m), true, 'sem a zona, empurra');
});

test('a magia de ATAQUE na mão é recusada na zona; fora dela, sai', { skip: doClassico('a magia de ataque do Draevor (no PoE, as gemas: o mesmo papel "attack" passa pela mesma regra)') }, async () => {
  const { e, h, grade } = naCacada();
  e.vocation = 'sorcerer';
  e.maxMana = e.mana = 1e6;
  e.actions = Array(Acoes.SLOTS).fill(null);
  comSkills(e, ['spell-energy-strike']);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
  assert.ok(Acoes.definir(e, { slot, value: { id: 'spell-energy-strike' } }).ok);
  const m = h.monstros.find((x) => x.hp > 0);
  const lado = vizinha(grade, h.pos);
  Object.assign(m, { x: lado.x, y: lado.y, hp: 1e9, maxHp: 1e9 });
  h.alvo = m.uid;
  await comSeguras(grade, { [grade.z]: new Set([k(h.pos.x, h.pos.y)]) }, () => {
    const r = Cacadas.disparoManual(e, PERSONAGEM, slot);
    assert.equal(r.motivo, 'ZONA_SEGURA', r.erro);
  });
  const fora = Cacadas.disparoManual(e, PERSONAGEM, slot);
  assert.notEqual(fora.motivo, 'ZONA_SEGURA');
  assert.equal(fora.ok, true, fora.erro);
});

test('EDITOR: pintar e apagar casas seguras, o texto da casa e o corpo de salvar (mapa real e do editor)', () => {
  const mapa = { width: 6, height: 4, z: 7 };
  const seguras = new Map();
  assert.equal(L.pintarSegura(seguras, mapa, 7, 1, 1, 'segura'), true);
  assert.equal(L.pintarSegura(seguras, mapa, 7, 1, 1, 'segura'), false, 'já marcada');
  assert.equal(L.pintarSegura(seguras, mapa, 7, 2, 1, 'segura'), true);
  assert.equal(L.pintarSegura(seguras, mapa, 7, 9, 9, 'segura'), false, 'fora do mapa');
  assert.equal(L.pintarSegura(seguras, mapa, 7, 2, 1, 'apagarSegura'), true);
  assert.deepEqual(L.segurasParaSalvar(seguras), { 7: [[1, 1]] });
  assert.deepEqual(L.contagemDeSeguras(seguras, 7), { andar: 1, total: 1 });
  assert.equal(L.FERRAMENTAS.includes('segura') && L.FERRAMENTAS.includes('apagarSegura'), true);
  const m = L.novoMapa(6, 4, { atlas: 'city', cell: 64, palette: {} }, 40);
  m.blocked.fill(0);
  assert.match(L.textoDaCasa(m, 7, { x: 1, y: 1 }, [], (x) => x, seguras), /zona segura/);
  assert.doesNotMatch(L.textoDaCasa(m, 7, { x: 2, y: 2 }, [], (x) => x, seguras), /zona segura/);
  assert.deepEqual(L.corpoDeSalvar({ id: HUNT_DE_TESTE, mapa: m, spawns: [], real: true, idAberto: HUNT_DE_TESTE, seguras }).corpo.seguras, { 7: [[1, 1]] });
  assert.equal(L.corpoDeSalvar({ id: 'meu-mapa', mapa: m, spawns: [], real: false, idAberto: null, seguras: new Map() }).corpo.seguras, null, 'sem nenhuma: null (apaga)');
  // Lido de volta do arquivo.
  assert.deepEqual([...L.segurasDoMapaAberto({ seguras: { 7: [[1, 1]] } }).get(7)], ['1,1']);
});

test('SERVIDOR: o salvar grava as casas seguras (validadas) no arquivo e no mapa em memória; sem o campo, as de antes ficam', () => {
  const id = 'teste-safe-zones-do-editor';
  const w = 12;
  const h = 8;
  const blocked = new Array(w * h).fill(0);
  const stacks = new Array(w * h).fill(0).map(() => [40]);
  const spawns = [{ id: 's1', x: 9, y: 5, z: 7, raio: 0, quantidade: 1, criaturas: [{ key: 'rat', peso: 1 }] }];
  try {
    assert.match(MapasAdmin.salvar({ id, width: w, height: h, blocked, stacks, spawns, seguras: { 7: [[40, 1]] } }).erro, /fora do mapa/);
    assert.equal(MapasAdmin.salvar({ id, width: w, height: h, blocked, stacks, spawns, seguras: { 7: [[1, 1], [2, 1]] } }).ok, true);
    assert.deepEqual(MapasAdmin.carregar(id).seguras, { 7: [[1, 1], [2, 1]] });
    // O mapa em memória (o que o jogo usa) recebe a configuração nova na hora.
    const emMemoria = mapaRealCapturado(id);
    assert.ok(emMemoria);
    assert.equal(MapasAdmin.salvarSpawns({ id, spawns, seguras: { 7: [[3, 3]] } }).ok, true);
    assert.deepEqual(MapasAdmin.carregar(id).seguras, { 7: [[3, 3]] });
    assert.deepEqual(emMemoria.seguras, { 7: [[3, 3]] }, 'valendo no jogo sem reiniciar');
    // Só os spawns (o /editor antigo): as casas seguras ficam.
    assert.equal(MapasAdmin.salvarSpawns({ id, spawns }).ok, true);
    assert.deepEqual(MapasAdmin.carregar(id).seguras, { 7: [[3, 3]] });
    assert.equal(MapasAdmin.salvar({ id, width: w, height: h, blocked, stacks, spawns }).ok, true);
    assert.deepEqual(MapasAdmin.carregar(id).seguras, { 7: [[3, 3]] }, 'o salvar sem o campo também preserva');
    // `null` apaga.
    assert.equal(MapasAdmin.salvarSpawns({ id, spawns, seguras: null }).ok, true);
    assert.equal(MapasAdmin.carregar(id).seguras, undefined);
    assert.equal(emMemoria.seguras, undefined);
    assert.match(MapasAdmin.salvarSpawns({ id, spawns, seguras: { 7: [[99, 0]] } }).erro, /fora do mapa/);
  } finally {
    rmSync(join(RAIZ_HUNTS, `${id}-map.json`), { force: true });
  }
});
