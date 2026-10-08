// O quadro leve (fase 1 de "deixar o jogo mais leve"): o cliente que pediu
// delta recebe só a tela e só o que mudou — e, juntando do jeito que o
// cliente de verdade junta (`applyState`/`juntarAsCriaturas`, main.mjs), tem
// de ver EXATAMENTE os bichos da tela do quadro inteiro, a cada quadro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sessao } from '../websocket/sessao.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Prey from '../systems/prey.mjs';
import * as Quadro from '../websocket/quadro.mjs';
import { personagemDeTeste, huntDoPoe } from './apoio.mjs';

/** O cliente, reduzido ao que junta a caçada — a mesma conta de main.mjs. */
function clienteFalso() {
  const c = { hunt: null, mobilia: new Map(), bytes: 0, quadros: 0, eventos: [] };
  c.receber = (texto) => {
    c.bytes += texto.length;
    const m = JSON.parse(texto);
    if (m.t !== 'state' && m.t !== 'welcome') return;
    c.quadros++;
    if (m.events) c.eventos.push(...m.events);
    if (!('hunt' in m)) return;
    let h = m.huntDelta && c.hunt && m.hunt ? { ...c.hunt, ...m.hunt } : m.hunt;
    if (h && m.hunt?.monsters) {
      const agora = new Map();
      const lista = [];
      for (const b of h.monsters) {
        const cheio = b.name !== undefined ? b : c.mobilia.has(b.uid) ? { ...c.mobilia.get(b.uid), ...b } : null;
        if (!cheio) continue;
        agora.set(b.uid, cheio);
        lista.push(cheio);
      }
      c.mobilia = agora;
      h = { ...h, monsters: lista };
    }
    c.hunt = h;
  };
  return c;
}

function sessaoNaCacada(huntId, { delta = true, oculta = false } = {}) {
  const cliente = clienteFalso();
  const s = new Sessao({ readyState: 1, send: (t) => cliente.receber(t) });
  clearInterval(s.tick);
  s.conta = { id: 'teste-do-quadro' };
  s.personagem = { id: 0, nome: 'Quadro' };
  s.estado = personagemDeTeste({ level: 600 });
  Prey.garantir(s.estado);
  s.estado.maxHp = s.estado.hp = 1e12;
  if (delta) s.receber({ t: 'delta', on: true, sessao: true, fundo: true });
  if (oculta) s.receber({ t: 'oculta', on: true });
  assert.ok(Cacadas.entrar(s.estado, { huntId, mode: 'auto' }).ok);
  return { s, cliente };
}

/** Roda `segundos` de caçada; a cada quadro, o que o cliente montou tem de ser a tela do quadro inteiro. */
function rodar({ s, cliente }, segundos, conferir = true) {
  let t = Date.now();
  s.estado.hunt.ultimoTique = t;
  for (let i = 0; i < segundos * 4; i++) {
    t += 250;
    s.estado.hp = s.estado.maxHp;
    const eventos = Cacadas.tique(s.estado, s.personagem, t) ?? [];
    s.mandarEstado(false, eventos);
    if (!conferir || !s.estado.hunt) continue;
    const inteiro = Cacadas.snapshotDaHunt(s.estado);
    const tela = inteiro.monsters.filter((m) => Quadro.naTela(inteiro.player, m));
    const porUid = (l) => [...l].sort((a, b) => a.uid - b.uid);
    assert.deepEqual(porUid(cliente.hunt.monsters), porUid(tela), `quadro ${i}: o cliente não montou a tela certa`);
    assert.deepEqual(cliente.hunt.player, inteiro.player);
  }
}

test('delta: o cliente monta exatamente os bichos da tela em 2 minutos de Werelions', () => {
  rodar(sessaoNaCacada(huntDoPoe('werelions-1')), 120);
});

test('delta: numa hunt grande o quadro fica muito menor que o inteiro', () => {
  const leve = sessaoNaCacada(huntDoPoe('werelions-1'));
  rodar(leve, 30, false);
  const cheio = sessaoNaCacada(huntDoPoe('werelions-1'), { delta: false });
  rodar(cheio, 30, false);
  const porSegundoLeve = leve.cliente.bytes / 30;
  const porSegundoCheio = cheio.cliente.bytes / 30;
  assert.ok(porSegundoLeve < porSegundoCheio / 5, `leve ${Math.round(porSegundoLeve)} B/s, cheio ${Math.round(porSegundoCheio)} B/s`);
});

test('aba escondida: sem fx/shot, mas o resto dos eventos (dano, loot) continua', () => {
  const r = sessaoNaCacada(huntDoPoe('werelions-1'), { oculta: true });
  rodar(r, 30, false);
  assert.ok(r.cliente.eventos.some((e) => e.t === 'dmg'));
  assert.ok(!r.cliente.eventos.some((e) => e.t === 'fx' || e.t === 'shot'));
});

test('pedir delta de novo (remendo falhou no cliente) manda o quadro inteiro', () => {
  const r = sessaoNaCacada(huntDoPoe('werelions-1'));
  rodar(r, 5, false);
  r.cliente.mobilia.clear(); // o cliente perdeu o que sabia
  r.s.receber({ t: 'delta', on: true, sessao: true, fundo: true });
  rodar(r, 10);
});
