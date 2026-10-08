// O VISUAL das skills (Arena de Efeitos — `systems/efeitos-visuais.mjs`, `admin/arena-efeitos.mjs`): a validação do override, o preset +
// override por skill, os eventos do combate marcados com a skill (`sk`) e o lançamento (`skill`), e a simulação da arena no combate de
// verdade. O desenho em si é do cliente (`frontend/client/src/efeitos-visuais.mjs`), conferido no navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Efeitos from '../systems/efeitos-visuais.mjs';
import * as Arena from '../admin/arena-efeitos.mjs';
import { ACTION_CATALOG } from '../systems/dados.mjs';
// O jogo inteiro, como no servidor (o bootstrap do PoE: as áreas da campanha, as gemas, os itens) — a Arena de Efeitos abre uma área do PoE.
import './apoio.mjs';

test('validar: limpa números para o intervalo, recusa campo e parte desconhecidos, preset inexistente e sprite inválido', () => {
  const ok = Efeitos.validar({ presets: { azul: { nome: 'Azul', visual: { projetil: { sprite: { tipo: 'projetil', id: 5 }, escala: 99, rastro: { quantidade: 50 } } } } }, skills: { x: { preset: 'azul', override: { impacto: { opacidade: -3 } } } } });
  assert.ok(ok.ok, ok.erros.join(' '));
  assert.equal(ok.override.presets.azul.visual.projetil.escala, 5, 'escala no máximo 5');
  assert.equal(ok.override.presets.azul.visual.projetil.rastro.quantidade, 10);
  assert.equal(ok.override.skills.x.override.impacto.opacidade, 0);
  assert.ok(!Efeitos.validar({ skills: { x: { preset: 'nao-existe' } } }).ok);
  assert.ok(!Efeitos.validar({ skills: { x: { override: { brilho: {} } } } }).ok, 'parte desconhecida');
  assert.ok(!Efeitos.validar({ skills: { x: { override: { impacto: { tamanho: 2 } } } } }).ok, 'campo desconhecido');
  assert.ok(!Efeitos.validar({ skills: { x: { override: { impacto: { sprite: { tipo: 'asset', id: 'sumiu' } } } } } }).ok, 'asset fora da biblioteca');
  assert.ok(!Efeitos.validar({ presets: { 'fabrica:fogo': { nome: 'x', visual: {} } } }).ok, 'preset de fábrica não se edita');
});

test('o visual da skill: o preset (de fábrica ou do dono) com o override por cima, campo a campo', () => {
  const dados = {
    assets: {}, presets: { azul: { nome: 'Azul', visual: { projetil: { sprite: { tipo: 'projetil', id: 5 }, escala: 1.5 }, impacto: { sprite: { tipo: 'efeito', id: 38 } } } } },
    skills: { a: { preset: 'azul', override: { projetil: { escala: 2 } } }, b: { preset: 'fabrica:gelo' }, c: { override: { impacto: { sprite: { tipo: 'nenhum' } } } } },
  };
  assert.deepEqual(Efeitos.visualDaSkill('a', dados).projetil, { sprite: { tipo: 'projetil', id: 5 }, escala: 2 });
  assert.deepEqual(Efeitos.visualDaSkill('a', dados).impacto, { sprite: { tipo: 'efeito', id: 38 } });
  assert.equal(Efeitos.visualDaSkill('b', dados).projetil.sprite.id, ACTION_CATALOG.spells.find((x) => x.id === 'spell-ice-strike').projetil, 'o preset de fábrica de gelo usa o projétil da magia de gelo');
  assert.equal(Efeitos.visualDaSkill('c', dados).impacto.sprite.tipo, 'nenhum');
  assert.equal(Efeitos.visualDaSkill('z', dados), null, 'sem configuração: o desenho de sempre');
  const cli = Efeitos.paraOCliente(dados);
  assert.ok(cli.presets['fabrica:fogo'] && cli.presets.azul && cli.skills.a);
});

test('a arena lança a skill no combate de verdade: os eventos de desenho saem marcados com a skill e o lançamento vem na frente', () => {
  const skill = ACTION_CATALOG.spells.find((x) => x.id === 'spell-flame-strike') ? 'spell-flame-strike' : ACTION_CATALOG.spells.find((x) => x.projetil && x.efeito)?.id;
  const r = Arena.simular({ skill, nivel: 1, alvos: 3, distancia: 3, direcao: 'l' });
  assert.ok(r.ok, r.erros?.join(' '));
  const desenho = r.eventos.filter((e) => ['shot', 'fx', 'explosao', 'area'].includes(e.t));
  assert.ok(desenho.length, 'a skill desenha alguma coisa');
  assert.ok(desenho.every((e) => e.sk === skill), 'todo evento de desenho leva o id da skill');
  const lancamento = r.eventos.find((e) => e.t === 'skill' || (e.t === 'cast' && e.sk));
  assert.equal(lancamento?.sk, skill, 'SKILL_CAST');
  assert.equal(r.alvos.length, 3);
  assert.ok(r.alvos.every((a) => a.look), 'os bonecos têm desenho');
  assert.ok(!Arena.simular({ skill: 'nao-existe' }).ok);
});

test('a prévia valida e resolve o override sem gravar nada', () => {
  const antes = Efeitos.ler();
  const p = Arena.previa({ skills: { 'spell-flame-strike': { preset: 'fabrica:raio' } } });
  assert.ok(p.ok);
  assert.ok(p.cliente.skills['spell-flame-strike'].projetil);
  assert.deepEqual(Efeitos.ler(), antes, 'nada gravado');
  assert.ok(!Arena.previa({ skills: { x: { preset: '???' } } }).ok);
});

test('o estilo automático da gema: pelo que ela é (nome, tags, arquétipo, elemento) — flecha de fogo, lâminas, relâmpago, aura, maldição', async () => {
  const { estiloDaGema } = await import('../systems/itens-poe/estilos-das-gemas.mjs');
  const est = (en, h = {}) => estiloDaGema({ en, tags: [], arquetipo: 'projetil', elemento: 'physical', ...h });
  assert.equal(est('Fireball', { elemento: 'fire' }).visual.projetil.sprite.id, 4);
  assert.equal(est('Blade Vortex', { arquetipo: 'area' }).motivo, 'lâminas', 'lâminas antes do "vortex" de gelo');
  assert.equal(est('Vortex', { elemento: 'ice', arquetipo: 'area' }).motivo, 'redemoinho de gelo');
  assert.equal(est('Arc', { elemento: 'energy', arquetipo: 'ricochete' }).visual.impacto.sprite.id, 176);
  assert.equal(est('Burning Arrow', { elemento: 'fire', tags: ['Arco', 'Ataque'] }).visual.projetil.sprite.id, 34, 'arco de fogo: a flecha de fogo');
  assert.ok(est('Wrath', { elemento: 'energy', arquetipo: 'aura' }).visual.lancamento, 'aura: o redemoinho no lançamento');
  assert.ok(est('Despair', { elemento: 'chaos', arquetipo: 'maldicao' }).visual.alvo, 'maldição: o efeito no alvo');
  assert.ok(est('Vaal Fireball', { elemento: 'fire' }).visual.lancamento, 'a Vaal ganha o lançamento roxo');
});

test('o personagem vira para onde lança a skill (o alvo ou a casa mirada)', async () => {
  const Acoes = await import('../systems/acoes.mjs');
  const h = { pos: { x: 10, y: 10, dir: 2 } };
  for (const [alvo, dir] of [[{ x: 10, y: 6 }, 0], [{ x: 14, y: 11 }, 1], [{ x: 9, y: 15 }, 2], [{ x: 5, y: 10 }, 3]]) {
    Acoes.virarParaOAlvo(h, alvo);
    assert.equal(h.pos.dir, dir, JSON.stringify(alvo));
  }
  Acoes.virarParaOAlvo(h, { x: 10, y: 10 });
  assert.equal(h.pos.dir, 3, 'na mesma casa: fica como estava');
});
