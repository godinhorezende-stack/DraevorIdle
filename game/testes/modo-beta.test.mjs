import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as Beta from '../systems/modo-beta.mjs';
import * as Premium from '../systems/premium.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Bosses from '../systems/bosses.mjs';
import { CATALOGO } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';
import { doClassico } from './apoio-migracao.mjs';

afterEach(() => Beta.definir(false));
const novo = (level = 1) => personagemDeTeste({ level, campanha: {} });

test('M1. desligado (padrão dos testes): VIP, especial e divina continuam trancadas e quem não tem premium é recusado', () => {
  assert.equal(Beta.ativo(), false);
  const e = novo(5);
  for (const h of [CATALOGO.vips[0], CATALOGO.especiais[0], CATALOGO.divinas[0]]) assert.equal(Premium.podeEntrar(e, h).ok, false, h.id);
  assert.equal(Cacadas.entrar(e, { huntId: CATALOGO.vips[0].id, mode: 'auto' }).ok, false);
});

test('M2. ligado: entra em VIP, Instance e Divine sem premium, pergaminho nem level, e não é expulso por falta de acesso', { skip: doClassico("Modo beta das hunts VIP/Instance/Divine e dos bosses do Draevor") }, () => {
  Beta.definir(true);
  for (const h of [CATALOGO.vips[0], CATALOGO.especiais[0], CATALOGO.divinas[0]]) {
    const e = novo(1);
    assert.equal(Premium.podeEntrar(e, h).ok, true, h.id);
    const r = Cacadas.entrar(e, { huntId: h.id, mode: 'auto' });
    assert.equal(r.ok, true, `${h.id}: ${r.erro}`);
    assert.equal(Premium.podeFicar(e, e.hunt.tranca), true);
  }
});

test('M3. ligado: boss sem level, sem task e sem recarga, quantas vezes quiser (e nenhuma espera é gravada)', { skip: doClassico("Modo beta das hunts VIP/Instance/Divine e dos bosses do Draevor") }, () => {
  Beta.definir(true);
  const boss = CATALOGO.bosses.find((b) => b.task && (b.level ?? 0) > 50 && !b.id.startsWith('urmahlullu'));
  assert.ok(boss);
  const e = novo(1);
  for (let i = 0; i < 4; i++) {
    const r = Cacadas.entrar(e, { huntId: boss.id, mode: 'auto' });
    assert.equal(r.ok, true, r.erro);
    e.hunt = null;
  }
  assert.equal(e.bossCooldownsAte?.[boss.id] ?? 0, 0);
  Beta.definir(false);
  assert.equal(Cacadas.entrar(novo(1), { huntId: boss.id, mode: 'auto' }).ok, false, 'desligar devolve as regras normais na hora');
});

test('M4. ligado NÃO abre o boss de ato sem portal: a regra do portal e da limpeza continua valendo', () => {
  Beta.definir(true);
  const r = Cacadas.entrar(novo(300), { huntId: 'urmahlullu-the-immaculate', mode: 'auto', dificuldade: 'facil', campanha: true });
  assert.equal(r.ok, false);
});

test('M5. o interruptor não grava nada no personagem e o admin só muda por rota trancada', async () => {
  const { readFileSync } = await import('node:fs');
  const idx = readFileSync(new URL('../backend/index.mjs', import.meta.url), 'utf8');
  assert.match(idx, /\/api\/mapas\/_conteudo\/modo-beta/);
  Beta.definir(true);
  const e = novo(1);
  const antes = JSON.stringify(e);
  Premium.podeEntrar(e, CATALOGO.vips[0]);
  assert.equal(JSON.stringify(e), antes);
  assert.equal(typeof Bosses.marcarEntrada, 'function');
});
