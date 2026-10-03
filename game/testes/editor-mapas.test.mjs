import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as L from '../frontend/client/src/editor-mapas-logica.mjs';
import * as Mapas from '../admin/mapas.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import { CITY_MAP } from '../systems/dados.mjs';

// Cada teste cita a(s) função(ões) F# da auditoria (docs/editor-de-mapas-auditoria.md) que ele prova na aba Mapas da Engine.
const cidade = { atlas: CITY_MAP.atlas, cell: CITY_MAP.cell, palette: CITY_MAP.palette };
const raridades = [{ id: 'normal', nome: 'Normal', maxModificadores: 0 }, { id: 'modificado', nome: 'Modificado', maxModificadores: 2 }, { id: 'raro', nome: 'Raro', maxModificadores: 3 }, { id: 'elite', nome: 'Elite', maxModificadores: 3 }];
const modificadores = [{ id: 'brutal', nome: 'Brutal', raridades: ['modificado', 'raro', 'elite'], incompativeis: ['frio'] }, { id: 'frio', nome: 'Frio', incompativeis: ['brutal'] }, { id: 'veloz', nome: 'Veloz', raridades: ['elite'] }, { id: 'duro', nome: 'Duro' }];
const ctx = { raridades, modificadores, tipoDoSpawn: { normal: 'normal', elite: 'elite' } };

test('F1/F2/F4: mapa novo nasce todo bloqueado e sem chão; tamanho e id seguem os limites do servidor; real = atlas próprio ou vários andares', () => {
  const m = L.novoMapa(6, 5, cidade, 40);
  assert.equal(m.blocked.length, 30);
  assert.ok(m.blocked.every((b) => b === 1));
  assert.deepEqual(m.stacks[0], [40]);
  assert.equal(L.ehMapaReal(m, cidade), false);
  assert.equal(L.ehMapaReal({ ...m, atlas: 'outro' }, cidade), true);
  assert.equal(L.ehMapaReal({ ...m, levels: [7, 8] }, cidade), true);
  assert.equal(L.tamanhoValido(4, 10), false);
  assert.equal(L.tamanhoValido(300, 300), true);
  assert.equal(L.tamanhoValido(301, 10), false);
  assert.equal(L.ID_VALIDO.test('minha-caverna'), true);
  assert.equal(L.ID_VALIDO.test('Minha'), false);
});

test('F5/F6/F8: o corpo de salvar — mapa do editor grava a grade; mapa real só os spawns e exige o mesmo id; sem id ou id inválido recusa', () => {
  const m = L.novoMapa(5, 5, cidade, 40);
  const ed = L.corpoDeSalvar({ id: 'meu-mapa', mapa: m, spawns: [], real: false, idAberto: null });
  assert.deepEqual(Object.keys(ed.corpo).sort(), ['blocked', 'height', 'id', 'spawns', 'stacks', 'width']);
  const real = L.corpoDeSalvar({ id: 'troll-cave', mapa: m, spawns: [{ id: 's1' }], real: true, idAberto: 'troll-cave' });
  assert.deepEqual(real.corpo, { id: 'troll-cave', soSpawns: true, spawns: [{ id: 's1' }] });
  assert.match(L.corpoDeSalvar({ id: 'outro-id', mapa: m, spawns: [], real: true, idAberto: 'troll-cave' }).erro, /mesmo id/);
  assert.match(L.corpoDeSalvar({ id: '', mapa: m, spawns: [], real: false }).erro, /Escreva um id/);
  assert.match(L.corpoDeSalvar({ id: 'ID Ruim', mapa: m, spawns: [], real: false }).erro, /inválido/);
  assert.match(L.mensagemDeSalvo('x', true, 3), /Spawns de "x" salvos \(3\)/);
  assert.match(L.mensagemDeSalvo('x', false, 3), /startHunt "x"/);
});

test('F7/F10/F11/F31: formato antigo `posicoes` vira spawns; grade por andar; contagem por andar com a entrada marcada', () => {
  const antigo = { z: 7, posicoes: [{ x: 1, y: 2, key: 'troll' }, { x: 3, y: 4, key: 'rotworm' }] };
  const s = L.spawnsDoMapaAberto(antigo);
  assert.deepEqual(s.map((x) => [x.id, x.raio, x.quantidade, x.criaturas[0].key]), [['s1', 0, 1, 'troll'], ['s2', 0, 1, 'rotworm']]);
  const m = { z: 7, levels: [7, 8], stacks: ['a'], blocked: [0], floors: { 8: { stacks: ['b'], blocked: [1] } }, width: 1, height: 1 };
  assert.deepEqual(L.gradeDe(m, 7), { stacks: ['a'], blocked: [0] });
  assert.deepEqual(L.gradeDe(m, 8), { stacks: ['b'], blocked: [1] });
  assert.deepEqual(L.gradeDe(m, 9), { stacks: [], blocked: [] });
  const por = L.spawnsPorAndar([{ id: 'a', x: 0, y: 0, z: 8 }, { id: 'b', x: 0, y: 0 }], m);
  assert.deepEqual(por, [{ z: 7, entrada: true, spawns: 1 }, { z: 8, entrada: false, spawns: 1 }]);
});

test('F17: a casa sob o ponteiro respeita a escala e os limites; o status diz vazio/bloqueado/andável e o spawn da casa', () => {
  assert.deepEqual(L.casaDoPonteiro(70, 33, 1, 10, 10), { x: 2, y: 1 });
  assert.deepEqual(L.casaDoPonteiro(70, 33, 0.5, 10, 10), { x: 4, y: 2 });
  assert.equal(L.casaDoPonteiro(-1, 0, 1, 10, 10), null);
  assert.equal(L.casaDoPonteiro(10 * 32, 0, 1, 10, 10), null);
  const m = L.novoMapa(5, 5, cidade, 40);
  m.blocked[0] = 0;
  assert.match(L.textoDaCasa(m, 7, { x: 0, y: 0 }, [], (k) => k), /andável/);
  assert.match(L.textoDaCasa(m, 7, { x: 1, y: 0 }, [], (k) => k), /bloqueado/);
  assert.match(L.textoDaCasa(m, 7, { x: 0, y: 0 }, [{ id: 's9', x: 0, y: 0, criaturas: [{ key: 'troll' }] }], (k) => `Nome ${k}`), /spawn s9: Nome troll/);
});

test('F21/F22: pincel deixa andável com o piso e parede bloqueia; mapa real não pinta; repetir a mesma pintura não conta como mudança', () => {
  const m = L.novoMapa(5, 5, cidade, 40);
  assert.equal(L.pintarCasa(m, 7, 2, 2, 'pincel', 579, false), true);
  assert.equal(m.blocked[2 * 5 + 2], 0);
  assert.deepEqual(m.stacks[2 * 5 + 2], [579]);
  assert.equal(L.pintarCasa(m, 7, 2, 2, 'pincel', 579, false), false);
  assert.equal(L.pintarCasa(m, 7, 2, 2, 'parede', 40, false), true);
  assert.equal(m.blocked[2 * 5 + 2], 1);
  assert.equal(L.pintarCasa(m, 7, 1, 1, 'pincel', 40, true), false, 'mapa real não pinta');
  assert.equal(L.pintarCasa(m, 7, 1, 1, 'spawn', 40, false), false);
});

test('F19/F20/F26/F33: só marca spawn em casa andável com criatura escolhida; ids únicos; o spawn novo leva as propriedades do próximo', () => {
  const m = L.novoMapa(5, 5, cidade, 40);
  L.pintarCasa(m, 7, 1, 1, 'pincel', 40, false);
  const troll = { key: 'troll' };
  assert.match(L.motivoParaNaoMarcar(m, 7, 1, 1, null), /Escolha uma criatura/);
  assert.match(L.motivoParaNaoMarcar(m, 7, 3, 3, troll), /andável/);
  assert.equal(L.motivoParaNaoMarcar(m, 7, 1, 1, troll), null);
  assert.ok(!['s1', 's3'].includes(L.novoId([{ id: 's1' }, { id: 's3' }])));
  assert.equal(L.novoId([]), 's1');
  assert.ok(!['s2', 's3'].includes(L.novoId([{ id: 's2' }, { id: 's3' }])));
  const ids = [{ id: 's1' }, { id: 's2' }];
  assert.equal(L.novoId(ids), 's3');
  const s = L.novoSpawn({ id: 's9', x: 1, y: 1, z: 7, proximo: { raio: 3, quantidade: 4, raridade: 'raro', modificadores: ['brutal'] }, bicho: troll });
  assert.deepEqual(s, { id: 's9', x: 1, y: 1, z: 7, raio: 3, quantidade: 4, tipo: 'normal', criaturas: [{ key: 'troll', peso: 1 }], raridade: 'raro', modificadores: ['brutal'] });
  const normal = L.novoSpawn({ id: 's1', x: 0, y: 0, z: 7, proximo: { raio: 0, quantidade: 1, raridade: 'normal', modificadores: [] }, bicho: troll });
  assert.equal('raridade' in normal, false, 'normal sem modificador: o arquivo não cresce à toa');
});

test('F27: raio 0–10 e quantidade 1–20, com os limites do servidor', () => {
  assert.deepEqual([L.limitarRaio(-3), L.limitarRaio(99), L.limitarRaio('4.6')], [0, 10, 5]);
  assert.deepEqual([L.limitarQuantidade(0), L.limitarQuantidade(99), L.limitarQuantidade('7')], [1, 20, 7]);
});

test('F28/F32: raridade — normal + modificador vira "modificado"; corta no teto; voltar a normal um tipo antigo escreve "normal"', () => {
  assert.deepEqual(L.comRaridade({ raridade: 'normal', modificadores: ['duro'] }), { raridade: 'modificado', modificadores: ['duro'] });
  assert.deepEqual(L.comRaridade({ raridade: 'normal' }), {});
  const s = { id: 's1', tipo: 'normal' };
  L.aplicarRaridade(s, false, 'modificado', ['duro', 'brutal', 'veloz'], ctx);
  assert.deepEqual(s.modificadores, ['duro', 'brutal'], 'teto de 2 no modificado');
  const antigo = { id: 's2', tipo: 'elite', raridade: 'elite', modificadores: ['duro'] };
  L.aplicarRaridade(antigo, false, 'normal', [], ctx);
  assert.equal(antigo.raridade, 'normal', 'um tipo elite antigo precisa dizer normal com todas as letras');
  const proximo = { raridade: 'normal', modificadores: [] };
  L.aplicarRaridade(proximo, true, 'elite', ['duro'], ctx);
  assert.deepEqual(proximo, { raridade: 'elite', modificadores: ['duro'] });
  assert.equal(L.tetoDe(raridades, 'raro'), 3);
});

test('F29: modificador travado pelo teto, pelas raridades permitidas e pelas incompatibilidades — cada um com o motivo', () => {
  const por = (id, mods, raridade) => L.estadoDoModificador(modificadores.find((m) => m.id === id), mods, raridade, { raridades, modificadores });
  assert.equal(por('duro', [], 'modificado').travado, false);
  assert.equal(por('veloz', [], 'modificado').travado, true);
  assert.match(por('veloz', [], 'modificado').motivo, /Só entra em: Elite/);
  assert.equal(por('frio', ['brutal'], 'modificado').travado, true);
  assert.match(por('frio', ['brutal'], 'modificado').motivo, /combina/);
  assert.equal(por('duro', ['brutal', 'frio'].slice(0, 1).concat('x'), 'modificado').travado, true, 'teto de 2 já cheio');
  assert.equal(por('brutal', ['brutal'], 'modificado').travado, false, 'o marcado nunca trava (dá para desmarcar)');
  assert.equal(por('duro', ['brutal'], 'normal').teto, 2, 'normal com modificador usa o teto de "modificado"');
});

test('F25: lista de criaturas — "deste mapa" primeiro, o resto só por busca (nome ou key), no máximo 60', () => {
  const bestiario = Array.from({ length: 100 }, (_, i) => ({ key: `bicho-${i}`, name: `Bicho ${i}` })).concat([{ key: 'troll', name: 'Troll' }]);
  const sem = L.gruposDeBichos(bestiario, { filtro: '', daqui: new Set(['troll']) });
  assert.deepEqual(sem[0].bichos.map((b) => b.key), ['troll']);
  assert.equal(sem[1].bichos.length, 0);
  assert.match(sem[1].titulo, /busque/);
  const com = L.gruposDeBichos(bestiario, { filtro: 'bicho', daqui: new Set() });
  assert.equal(com[1].bichos.length, 60);
  assert.equal(L.gruposDeBichos(bestiario, { filtro: 'TROLL', daqui: new Set(['troll']) })[0].bichos.length, 1);
});

test('NOVO — desfazer/refazer: cada edição registra antes; desfazer e refazer restauram spawns e grade; nova edição zera o "refazer"', () => {
  let estado = { spawns: [], grade: { stacks: [[1]], blocked: [1] } };
  const H = L.criarHistorico({ foto: () => estado, restaurar: (f) => { estado = f; } });
  H.registrar();
  estado = { spawns: [{ id: 's1' }], grade: { stacks: [[1]], blocked: [0] } };
  H.registrar();
  estado = { spawns: [{ id: 's1' }, { id: 's2' }], grade: { stacks: [[1]], blocked: [0] } };
  assert.deepEqual(H.estado(), { podeDesfazer: true, podeRefazer: false });
  assert.equal(H.desfazer(), true);
  assert.equal(estado.spawns.length, 1);
  assert.equal(H.desfazer(), true);
  assert.equal(estado.spawns.length, 0);
  assert.equal(estado.grade.blocked[0], 1);
  assert.equal(H.desfazer(), false);
  assert.equal(H.refazer(), true);
  assert.equal(estado.spawns.length, 1);
  H.registrar();
  assert.equal(H.estado().podeRefazer, false, 'editar depois de desfazer descarta o refazer');
  const curto = L.criarHistorico({ foto: () => 1, restaurar: () => {}, max: 3 });
  for (let i = 0; i < 10; i++) curto.registrar();
  let n = 0;
  while (curto.desfazer()) n++;
  assert.equal(n, 3, 'o histórico tem teto');
});

test('NOVO — distribuição de raridade à vista (por bicho) e validação ao vivo no servidor (todos os erros, não só o primeiro)', async () => {
  const d = L.distribuicaoDeRaridade([{ quantidade: 3, raridade: 'raro' }, { quantidade: 1 }, { raridade: 'elite' }], (s) => s.raridade ?? 'normal');
  assert.deepEqual(d, { total: 5, porRaridade: { raro: 3, normal: 1, elite: 1 } });
  const v = Mapas.validarSpawns({ spawns: [{ id: 'a', x: 1, y: 1, raio: 1, quantidade: 1, tipo: 'normal', criaturas: [{ key: 'troll', peso: 1 }] }, { id: 'a', x: 99, y: 1, criaturas: [{ key: 'inexistente' }] }], width: 10, height: 10 });
  assert.equal(v.ok, false);
  assert.ok(v.erros.length >= 3, 'lista todos os erros');
  assert.match(Mapas.validarSpawns({ spawns: [], width: 10, height: 10 }).erros[0], /ao menos um spawn/, 'o servidor exige 1 spawn para salvar (a tela só avisa, não pinta de erro)');
  const resp = [];
  const json = (r, c, b) => resp.push([c, b]);
  await Http.atender({ method: 'POST' }, {}, '/api/mapas/_conteudo/mapas/validar', new URL('http://x/'), { json, corpoJson: async () => ({ spawns: [], width: 5, height: 5 }) });
  assert.equal(resp[0][0], 200);
  assert.equal(resp[0][1].ok, false);
});

test('a aba Mapas está ligada à Engine e o /editor antigo continua existindo (nada é removido)', () => {
  const ed = readFileSync(new URL('../frontend/client/src/editor-conteudo.mjs', import.meta.url), 'utf8');
  assert.match(ed, /criarEditorDeMapas/);
  assert.match(ed, /\['mapas', 'Mapas'\]/);
  assert.match(ed, /href: '\/editor'/, 'o link para o editor antigo continua na navegação');
  assert.match(readFileSync(new URL('../frontend/editor.html', import.meta.url), 'utf8'), /Editor de mapas/);
  const tela = readFileSync(new URL('../frontend/client/src/editor-mapas.mjs', import.meta.url), 'utf8');
  for (const rota of ['/api/mapas/opcoes', '/api/mapas/atributos-do-mob', "'/api/mapas'", 'mapas/validar']) assert.ok(tela.includes(rota), rota);
});
