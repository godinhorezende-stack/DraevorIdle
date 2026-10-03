// O escalonamento da dificuldade pelos jogadores ativos da instância (`systems/hunt/escalonamento.mjs`).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import * as Party from '../systems/party.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as R from '../systems/regras.mjs';
import * as E from '../systems/hunt/escalonamento.mjs';
import * as S from '../systems/hunt/setores.mjs';
import { personagemDeTeste } from './apoio.mjs';

const ret = (x0, y0, w, h) => { const set = new Set(); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set.add(`${x},${y}`); return set; };
const bicho = (extra = {}) => ({ hp: 1000, maxHp: 1000, forca: 1, raridade: 'normal', ...extra });

test('D1. fatores por jogador a mais: sozinho é 1; quatro, +90% de vida e NENHUM dano a mais nos normais; chefe pesa mais; há teto', () => {
  assert.deepEqual(E.fatoresPara('normal', 1), { vida: 1, dano: 1 });
  const q = E.fatoresPara('normal', 4);
  assert.ok(Math.abs(q.vida - 1.9) < 1e-9 && q.dano === 1);
  assert.ok(E.fatoresPara('boss', 4).vida > q.vida);
  for (const tipo of Object.keys(E.ESCALONAMENTO.porJogador)) assert.equal(E.fatoresPara(tipo, 5).dano, 1, `${tipo}: o dano não escala`);
  assert.ok(E.fatoresPara('raro', 4).vida > E.fatoresPara('normal', 4).vida);
  assert.deepEqual(E.fatoresPara('normal', 100), { vida: E.ESCALONAMENTO.teto.vida, dano: E.ESCALONAMENTO.teto.dano });
  assert.equal(E.tipoDoBicho({ raridade: 'elite' }), 'elite');
  assert.equal(E.tipoDoBicho({ isBoss: true }), 'boss');
  assert.equal(E.tipoDoBicho({}), 'normal');
});

test('D2. os modelos: por setor (35% dos de fora), por ativos, por tamanho da party; chefe sente todos os ativos', () => {
  const base = { ativos: 4, total: 5, pesoDeFora: 0.35 };
  assert.ok(Math.abs(E.jogadoresQueOBichoSente({ ...base, modelo: 'setor', tipo: 'normal', noSetor: 1 }) - 2.05) < 1e-9, 'um por setor: 1 + 3×0,35');
  assert.equal(E.jogadoresQueOBichoSente({ ...base, modelo: 'setor', tipo: 'normal', noSetor: 4 }), 4, 'todos juntos: 4');
  assert.equal(E.jogadoresQueOBichoSente({ ...base, modelo: 'setor', tipo: 'boss', noSetor: 1 }), 4, 'chefe: a party ativa inteira');
  assert.equal(E.jogadoresQueOBichoSente({ ...base, modelo: 'ativos', tipo: 'normal', noSetor: 1 }), 4);
  assert.equal(E.jogadoresQueOBichoSente({ ...base, modelo: 'total', tipo: 'normal', noSetor: 0 }), 5);
  assert.equal(E.jogadoresQueOBichoSente({ ...base, ativos: 0, modelo: 'setor', tipo: 'normal', noSetor: 0 }), 1, 'nunca abaixo de 1');
});

test('D3. reescalar guarda a FRAÇÃO de vida, não acumula (aplicar de novo não muda) e voltar a 1 devolve o valor base', () => {
  const m = bicho({ hp: 500 });
  assert.equal(E.reescalar(m, { vida: 2, dano: 1.5 }), true);
  assert.equal(m.maxHp, 2000);
  assert.equal(m.hp, 1000, 'continua com a metade da vida');
  assert.equal(m.forca, 1.5);
  assert.equal(E.reescalar(m, { vida: 2, dano: 1.5 }), false, 'idempotente');
  assert.equal(m.maxHp, 2000);
  E.reescalar(m, { vida: 1, dano: 1 });
  assert.deepEqual([m.maxHp, m.hp, m.forca], [1000, 500, 1], 'sair gente desfaz');
  const quase = bicho({ hp: 1 });
  E.reescalar(quase, { vida: 3, dano: 1 });
  assert.ok(quase.hp >= 1, 'vivo continua vivo');
  const morto = bicho({ hp: 0 });
  E.reescalar(morto, { vida: 3, dano: 1 });
  assert.equal(morto.hp, 0, 'morto não ressuscita');
});

function salaCom(bichos, setores = true) {
  const alc = new Map([[7, ret(0, 0, 60, 60)]]);
  const grade = { alcancaveis: alc };
  const mapa = S.mapaDeSetores(alc);
  const sala = { clock: 10_000, monstros: bichos, outrosAndares: {}, instancia: setores ? { id: 'i', setores: {} } : null };
  return { sala, grade, mapa };
}

test('D4. por setor: o bicho do setor onde a party está fica mais forte que o de um setor vazio; juntos ≠ espalhados', () => {
  const { sala, grade, mapa } = salaCom([]);
  const noroeste = mapa.setorDe(2, 2, 7);
  const sudeste = mapa.setorDe(58, 58, 7);
  const a = bicho({ setor: noroeste });
  const b = bicho({ setor: sudeste });
  sala.monstros.push(a, b);
  // Quatro juntos no noroeste.
  E.aplicarNaSala(sala, { jogadores: [{ x: 2, y: 2, z: 7 }, { x: 3, y: 3, z: 7 }, { x: 4, y: 4, z: 7 }, { x: 5, y: 5, z: 7 }], grade });
  assert.ok(Math.abs(a.maxHp - 1900) < 2, `no setor dos 4: ${a.maxHp}`);
  assert.ok(Math.abs(b.maxHp - 1000 * (1 + 0.3 * (4 * 0.35 - 1))) < 2, `no setor vazio, só 35% dos 4 (n=1,4): ${b.maxHp}`);
  // Espalhados: um por setor ⇒ cada setor com 2,05 "jogadores".
  sala.clock += 2000;
  E.aplicarNaSala(sala, { jogadores: [{ x: 2, y: 2, z: 7 }, { x: 58, y: 58, z: 7 }, { x: 58, y: 2, z: 7 }, { x: 2, y: 58, z: 7 }], grade });
  assert.ok(Math.abs(a.maxHp - 1315) < 2, `um por setor: n = 1 + 3×0,35 = 2,05 ⇒ 1315 (reunidos davam 1900): ${a.maxHp}`);
  assert.ok(a.maxHp < 1500, `espalhados: ${a.maxHp} (reunidos davam 1900)`);
});

test('D5. o chefe sente a party ativa inteira, esteja onde estiver; sozinho nada é tocado; a rodada respeita o intervalo', () => {
  const { sala, grade, mapa } = salaCom([]);
  const boss = bicho({ raridade: 'boss', setor: mapa.setorDe(2, 2, 7) });
  const normal = bicho({ setor: mapa.setorDe(2, 2, 7) });
  sala.monstros.push(boss, normal);
  const sozinho = { jogadores: [{ x: 2, y: 2, z: 7 }], grade };
  assert.equal(E.aplicarNaSala(sala, sozinho), 0);
  assert.equal(boss.escalaDaParty, undefined, 'nunca foi escalonado: nem a marca existe');
  sala.clock += 2000;
  const longe = { jogadores: [{ x: 58, y: 58, z: 7 }, { x: 58, y: 2, z: 7 }, { x: 2, y: 58, z: 7 }, { x: 30, y: 30, z: 7 }], grade };
  E.aplicarNaSala(sala, longe);
  assert.ok(Math.abs(boss.maxHp - 2500) < 2, `chefe: 4 ativos ⇒ +150%: ${boss.maxHp}`);
  assert.ok(normal.maxHp < 1500);
  const antes = boss.maxHp;
  assert.equal(E.aplicarNaSala(sala, sozinho), 0, 'dentro do intervalo, não faz nada');
  sala.clock += 2000;
  E.aplicarNaSala(sala, sozinho);
  assert.equal(boss.maxHp, 1000, 'ficou sozinho: volta ao base');
  assert.ok(antes > 1000);
});

test('D6. desligar (cfg.ativo=false) e o modelo "total" funcionam; muitos bichos custam pouco', () => {
  const { sala, grade, mapa } = salaCom([]);
  sala.monstros.push(bicho({ setor: mapa.setorDe(2, 2, 7) }));
  assert.equal(E.aplicarNaSala(sala, { jogadores: [{ x: 1, y: 1, z: 7 }, { x: 2, y: 1, z: 7 }], grade, cfg: { ...E.ESCALONAMENTO, ativo: false } }), 0);
  sala.clock += 2000;
  E.aplicarNaSala(sala, { jogadores: [{ x: 1, y: 1, z: 7 }], totalDaParty: 5, grade, cfg: { ...E.ESCALONAMENTO, modelo: 'total' } });
  assert.ok(Math.abs(sala.monstros[0].maxHp - 2200) < 2, 'total=5 ⇒ +120%');
  const muitos = Array.from({ length: 2000 }, (_, i) => bicho({ setor: mapa.setorDe(i % 60, (i * 7) % 60, 7) }));
  const grande = { ...sala, clock: 99_000, monstros: muitos };
  const t0 = performance.now();
  E.aplicarNaSala(grande, { jogadores: [{ x: 1, y: 1, z: 7 }, { x: 50, y: 50, z: 7 }, { x: 20, y: 40, z: 7 }], grade });
  assert.ok(performance.now() - t0 < 50, `${performance.now() - t0}ms para 2000 bichos`);
});

// ------------------------------------------------------------------ integração real

const criadas = [];
after(async () => {
  for (const { s, nome, conta } of criadas) {
    s.desconectar();
    vivas.delete(nome);
    await B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(conta);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta);
  }
});
async function jogador(i) {
  const conta = await B.criarConta({ email: `esc-${randomUUID()}@teste.local`, senha: 'senha-123' });
  await B.gravarMelhoriasDaConta(conta.id, { slotsDeParty: 3 });
  await B.lerMelhoriasDaConta(conta.id);
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: () => {} });
  s.conta = { id: conta.id };
  const nome = `Es${i}${randomUUID().replace(/[^a-z]/g, '').slice(0, 6)}`;
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.pos = { ...R.POSICAO_INICIAL };
  await s.concluirEntrada({ id: randomUUID(), nome }, e, null, null);
  criadas.push({ s, nome, conta: conta.id });
  return { s, nome };
}

test('D7. na instância real: dois ativos deixam os bichos mais fortes; sair o segundo devolve ao base', async () => {
  const a = await jogador(1);
  const b = await jogador(2);
  Party.comandoDoGrupo(a.s, { action: 'convidar', name: b.nome });
  Party.comandoDoGrupo(b.s, { action: 'aceitar' });
  assert.equal(Cacadas.entrar(a.s.estado, { huntId: 'troll-cave', mode: 'auto', dificuldade: 'medio' }).ok, true);
  const hunt = a.s.estado.hunt;
  // Os primeiros tiques ajustam o que a entrada deixou (escala da fase); o "base" é o de depois disso.
  for (let t = 0; t < 6; t++) await a.s.tique();
  const base = hunt.monstros.map((m) => m.maxHp);
  assert.ok(hunt.monstros.every((m) => m.escalaDaParty === undefined), 'sozinho: nenhum bicho foi escalonado');
  for (let t = 0; t < 6; t++) await a.s.tique();
  assert.deepEqual(hunt.monstros.map((m) => m.maxHp), base, 'sozinho: nada muda');
  Party.comandoDaCaca(a.s, { action: 'invite', name: b.nome });
  assert.equal(Party.comandoDaCaca(b.s, { action: 'accept' }).ok, true);
  hunt.clock += 5000; // passa do intervalo
  for (let t = 0; t < 8; t++) { await a.s.tique(); await b.s.tique(); }
  const depois = hunt.monstros.map((m) => m.maxHp);
  assert.ok(depois.some((v, i) => v > base[i]), 'com dois ativos, a vida dos bichos subiu');
  assert.ok(hunt.monstros.every((m, i) => m.maxHp >= base[i]));
  // O segundo sai (comando): volta ao base.
  Party.comandoDoGrupo(b.s, { action: 'sair' });
  hunt.clock += 5000;
  for (let t = 0; t < 8; t++) await a.s.tique();
  assert.deepEqual(hunt.monstros.map((m) => m.maxHp), base, 'sozinho de novo: dificuldade original');
});
