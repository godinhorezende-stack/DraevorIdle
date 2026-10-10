// O CICLO DO PORTAL de viagem (dono, 10/10: "Portal aberto por 3 segundos e fechamento animado por 3 segundos; barra de progresso
// sincronizada; fade suave do portal e do personagem; nenhum efeito visual permanece após a remoção do portal") — a conta pura que o mapa
// (`map.mjs`) desenha, e a regra de quando a tela abre o portal (`main.mjs`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CICLO_PADRAO, duracao, quadroDoCiclo, chaveDaCena, abrePortal, ABRINDO_MS } from '../frontend/client/src/portal-ciclo.mjs';
import * as Protecao from '../systems/protecao.mjs';

const perto = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);

test('3 s aberto + 3 s fechando: as fases, a barra (sincronizada, 1 → 0 em cada fase) e o fim', () => {
  assert.deepEqual({ ...CICLO_PADRAO }, { abertoMs: 3000, fechamentoMs: 3000 });
  assert.deepEqual(CICLO_PADRAO, { ...Protecao.config().portal }, 'o mesmo ciclo que o servidor manda no welcome');
  assert.equal(duracao(), 6000);
  const em = (t) => quadroDoCiclo(t);
  assert.equal(em(0).fase, 'aberto');
  perto(em(0).barra, 1, 'a barra começa cheia');
  perto(em(1500).barra, 0.5, 'na metade da abertura, metade');
  assert.equal(em(2999).fase, 'aberto');
  assert.equal(em(3000).fase, 'fechando');
  perto(em(3000).barra, 1, 'o fechamento começa com a barra cheia (na cor dele)');
  perto(em(4500).barra, 0.5, 'na metade do fechamento, metade');
  assert.equal(em(5999).fase, 'fechando');
  assert.equal(em(6000).fase, 'fim');
});

test('o FADE: o portal acende ao abrir, fica inteiro aberto, e no fechamento some (e encolhe) junto com o personagem — que some primeiro', () => {
  const em = (t) => quadroDoCiclo(t);
  perto(em(0).portal.alpha, 0, 'nasce apagado');
  assert.ok(em(ABRINDO_MS / 2).portal.alpha > 0 && em(ABRINDO_MS / 2).portal.alpha < 1, 'acendendo');
  perto(em(ABRINDO_MS).portal.alpha, 1, 'aceso');
  perto(em(2000).portal.escala, 1, 'inteiro');
  perto(em(2000).personagem.alpha, 1, 'o personagem inteiro com o portal aberto');
  perto(em(3000).portal.alpha, 1, 'o fechamento começa do portal inteiro');
  // Suave: o alpha e a escala só descem durante o fechamento, sem pulos.
  let antes = em(3000);
  for (let t = 3050; t <= 6000; t += 50) {
    const q = em(t);
    assert.ok(q.portal.alpha <= antes.portal.alpha + 1e-9 && q.personagem.alpha <= antes.personagem.alpha + 1e-9, `desce em ${t}`);
    assert.ok(antes.portal.alpha - q.portal.alpha < 0.06, `sem pulo em ${t}`);
    assert.ok(q.personagem.alpha <= q.portal.alpha + 1e-9, `o personagem é puxado antes do portal sumir (${t})`);
    antes = q;
  }
  assert.ok(em(4500).portal.escala < 1 && em(4500).personagem.escala < 1, 'encolhem para dentro');
  // No fim, nada fica na tela.
  const fim = em(6000);
  assert.deepEqual([fim.portal.alpha, fim.personagem.alpha, fim.barra, fim.energia], [0, 0, 0, 0]);
  assert.deepEqual(em(60_000), fim, 'e continua sem nada');
});

test('a energia pulsa (0..1) e o ciclo segue a configuração (`gamedata/protecao.json` → `portal`)', () => {
  const pulsos = [0, 105, 210, 315, 420].map((t) => quadroDoCiclo(t).energia);
  assert.ok(Math.min(...pulsos) < 0.2 && Math.max(...pulsos) > 0.8, `pulsa: ${pulsos.map((p) => p.toFixed(2)).join(' ')}`);
  for (const p of pulsos) assert.ok(p >= 0 && p <= 1);
  const curto = { abertoMs: 1000, fechamentoMs: 500 };
  assert.equal(duracao(curto), 1500);
  assert.equal(quadroDoCiclo(999, curto).fase, 'aberto');
  assert.equal(quadroDoCiclo(1000, curto).fase, 'fechando');
  perto(quadroDoCiclo(1250, curto).barra, 0.5, 'a barra no ritmo do fechamento curto');
  assert.equal(quadroDoCiclo(1500, curto).fase, 'fim');
});

test('a CENA na tela: cada entrada de caçada (instância, sala) é uma; a cidade pelo id e pelo teletransporte', () => {
  assert.equal(chaveDaCena({ hunt: { mapId: 'a1', entrada: 'x1' } }), 'h:x1');
  assert.equal(chaveDaCena({ hunt: { mapId: 'a1' } }), 'h:a1', 'servidor antigo, sem entrada: o mapa');
  assert.notEqual(chaveDaCena({ hunt: { mapId: 'a1', entrada: 'x1' } }), chaveDaCena({ hunt: { mapId: 'a1', entrada: 'x2' } }), 'a instância nova no mesmo mapa é outra cena');
  assert.equal(chaveDaCena({ city: { player: { x: 1, y: 1 }, cidade: { id: 'poe-a1' } } }), 'c:poe-a1:0');
  assert.equal(chaveDaCena({ city: { player: { x: 1, y: 1, teleporte: 2 }, cidade: { id: 'poe-a2' } } }), 'c:poe-a2:2');
  assert.equal(chaveDaCena({ city: { player: { x: 1, y: 1 } } }), 'c:city:0', 'o clássico: a cidade única');
  assert.equal(chaveDaCena({}), null);
});

test('o portal de saída abre só numa VIAGEM: com cena antes, cena diferente e o personagem vivo', () => {
  assert.equal(abrePortal({ antes: 'c:city:0', depois: 'h:x1' }), true, 'da cidade para a caçada');
  assert.equal(abrePortal({ antes: 'h:x1', depois: 'h:x2' }), true, 'para a instância nova');
  assert.equal(abrePortal({ antes: 'h:x1', depois: 'c:city:0' }), true, 'de volta à cidade');
  assert.equal(abrePortal({ antes: 'c:poe-a1:0', depois: 'c:poe-a2:1' }), true, 'para outra cidade');
  assert.equal(abrePortal({ antes: null, depois: 'h:x1' }), false, 'entrar no jogo / reconexão: sem cena de onde sair');
  assert.equal(abrePortal({ antes: 'h:x1', depois: 'h:x1' }), false, 'a mesma cena');
  assert.equal(abrePortal({ antes: 'h:x1', depois: 'c:city:0', morreu: true }), false, 'morrer não é viajar');
  assert.equal(abrePortal({ antes: 'c:city:0', depois: 'h:duelo', pvp: true }), false, 'o duelo da Arena (sem proteção de entrada, com a largada dele) entra direto');
});
