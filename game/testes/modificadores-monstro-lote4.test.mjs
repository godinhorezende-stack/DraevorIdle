// (09/11 — dono: "quero resolver os aproximados e parciais" dos modificadores de monstro) LOTE 4: o tamanho, a ÁREA das magias do monstro, Evitar Projéteis,
// as AÇÕES TRIPLAS (repete e pausa) e a UNIÃO DAS ALMAS (o bando ganha vida e tamanho quando ele morre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../systems/mobs/atributos.mjs';
import * as Poderes from '../systems/poderes.mjs';
import * as Mecanicas from '../systems/mobs/mecanicas.mjs';
import * as Iluminacao from '../systems/itens-poe/iluminacao.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';

const troll = (extra = {}) => Object.assign(criarMonstro({ key: 'troll', x: 10, y: 10 }, null), extra);
const DADOS = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/modificadores-monstro.json', import.meta.url), 'utf8'));

test('a ÁREA das magias: "Área de Efeito aumentada em 80%" pega mais casas (o raio × a raiz de 1,8)', () => {
  const a = { forma: 'area', raio: 3 };
  const normal = Poderes.casasDaMagia(a, troll(), { x: 10, y: 10 }).length;
  const enorme = Poderes.casasDaMagia(a, troll({ areaPct: 80 }), { x: 10, y: 10 }).length;
  assert.ok(enorme > normal * 1.4, `${normal} → ${enorme}`);
});

test('Evitar Projéteis: o sorteio abaixo da chance evita; sem o modificador, nunca', () => {
  assert.equal(M.evitouProjetil(troll({ evitarProjeteisPct: 30 }), () => 0.2), true);
  assert.equal(M.evitouProjetil(troll({ evitarProjeteisPct: 30 }), () => 0.4), false);
  assert.equal(M.evitouProjetil(troll(), () => 0), false);
});

test('as AÇÕES TRIPLAS: o golpe sai e repete 2 vezes no ritmo dele; depois da última, a pausa de 1,5 s; sem o modificador, o intervalo de sempre', () => {
  const m = troll({ repeticoes: 2, pausaMs: 1500 });
  const iv = M.intervaloDoGolpe(troll());
  const seq = [1, 2, 3, 4, 5, 6].map(() => M.intervaloDoGolpe(m, { contar: true }));
  assert.deepEqual(seq, [iv, iv, iv + 1500, iv, iv, iv + 1500]);
  assert.equal(M.intervaloDoGolpe(m), iv, 'sem contar (o simulador), sem pausa');
  assert.equal(M.pausaDaRepeticao(troll()), 0);
});

test('a UNIÃO DAS ALMAS: ao morrer, o bando (o mesmo spawn) ganha +40% de Vida Máxima e +10% de tamanho; quem é de outro spawn, não', () => {
  const uniao = troll({ spawnId: 's1', packVidaPct: 40, packEscalaPct: 10, hp: 0 });
  const doBando = troll({ spawnId: 's1', hp: 500, maxHp: 1000 });
  const outro = troll({ spawnId: 's2', hp: 1000, maxHp: 1000 });
  const hunt = { clock: 0, pos: { x: 99, y: 99 }, monstros: [uniao, doBando, outro] };
  Mecanicas.aoMorrer({ hp: 1 }, hunt, { nome: 'teste' }, uniao, []);
  assert.deepEqual([doBando.maxHp, doBando.hp], [1400, 900], 'a vida que faltava continua faltando');
  assert.equal(outro.maxHp, 1000);
  assert.equal(Iluminacao.tamanhoDoMonstro(doBando, DADOS), Iluminacao.tamanhoDoMonstro(troll({ escalaExtraPct: 10 }), DADOS));
  assert.ok(Iluminacao.tamanhoDoMonstro(doBando, DADOS) > 1);
});

test('os modificadores do arquivo: o Enorme, o Fragmentador e as Ações Triplas com os campos do lote 4', () => {
  const por = (nome) => DADOS.mods.find((m) => m.nome === nome);
  assert.equal(por('Enorme').stats.areaPct, 80);
  assert.equal(por('Enorme').estado, 'efeito');
  assert.equal(por('Fragmentador').stats.evitarProjeteisPct, 30);
  assert.deepEqual([por('Ações Triplas').stats.repeticoes, por('Ações Triplas').stats.pausaMs], [2, 1500]);
});
