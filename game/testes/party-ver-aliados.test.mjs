// Na instância da party, cada um VÊ os outros (dono, 08/10: "quero ver os dados, ataques e projéteis dele também, a vida dele, o mob
// tirando a vida dele e sua mana"): os eventos visuais de combate de cada jogador vão para os outros da sala, com o nome dele, e o aliado
// vem com a vida e a mana. Antes cada um só recebia os próprios eventos.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
// Uma tabela de parties SÓ deste teste (os outros arquivos, em outros processos, também gravam parties no banco compartilhado).
process.env.PARTY_TABELA = `parties_salvas_a${process.pid}`;
const B = await import('../database/banco.mjs');
const { Sessao, vivas } = await import('../websocket/sessao.mjs');
const Party = await import('../systems/party.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const R = await import('../systems/regras.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

const contas = [];
after(async () => {
  for (const s of [...vivas.values()]) s.desconectar?.();
  for (const c of contas) {
    await B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(c);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(c);
  }
  await B.banco.exec(`DROP TABLE IF EXISTS ${process.env.PARTY_TABELA}`);
});

async function jogador(prefixo) {
  const c = await B.criarConta({ email: `partya-${randomUUID()}@teste.local`, senha: 'senha-123' });
  contas.push(c.id);
  await B.gravarMelhoriasDaConta(c.id, { slotsDeParty: 3 });
  await B.lerMelhoriasDaConta(c.id);
  const recebidas = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => recebidas.push(JSON.parse(d)) });
  s.conta = { id: c.id };
  const nome = `${prefixo}${randomUUID().replace(/[^a-z]/g, '').slice(0, 7)}`;
  const e = { ...personagemDeTeste({ vocacao: 'knight', level: 30 }), sistema: 'poe', pos: { ...R.POSICAO_INICIAL } };
  await s.concluirEntrada({ id: randomUUID(), nome }, e, null, null);
  return { s, nome, recebidas };
}

test('os eventos que a sala vê: os visuais de combate, com o nome de quem fez; experiência, loot e falas ficam com cada um', () => {
  const s = { personagem: { nome: 'Alfa' } };
  const eventos = [
    { t: 'cast', uid: 'player', quem: 'Alfa', skill: 'Bola de Fogo', ms: 750 },
    { t: 'skill', uid: 'player', sk: 'poe-gema:Fireball', x: 1, y: 1 },
    { t: 'shot', id: 5, x: 1, y: 1, tx: 3, ty: 3 },
    { t: 'fx', id: 1, uid: 'player', x: 1, y: 1 },
    { t: 'dmg', uid: 34, v: 120, foe: true },
    { t: 'dmg', uid: 'player', quem: 'Alfa', v: 7, de: 'Afogado' },
    { t: 'block', uid: 'player', quem: 'Alfa', esquiva: true },
    { t: 'kill', name: 'Cuspidor', exp: 39, quem: 'Alfa' },
    { t: 'loot', name: 'Cuspidor', items: [] },
    { t: 'say', uid: 'player', text: 'oi' },
  ];
  const vistos = Party.eventosParaOsOutros(s, eventos);
  assert.deepEqual(vistos.map((e) => e.t), ['cast', 'skill', 'shot', 'fx', 'dmg', 'dmg', 'block']);
  assert.equal(vistos.find((e) => e.t === 'fx').quem, 'Alfa', 'o efeito nele leva o nome dele (na tela do outro: o aliado)');
  assert.equal(vistos.find((e) => e.t === 'skill').quem, 'Alfa');
  assert.equal(vistos.find((e) => e.t === 'dmg' && e.uid === 34).quem, undefined, 'o dano no bicho fica no bicho (o mesmo nas duas telas)');
  assert.equal(eventos[1].quem, undefined, 'não mexe no evento de quem fez');
});

test('na mesma sala, o convidado recebe os golpes do dono (com o nome dele) e vê a vida e a mana dele', async () => {
  const a = await jogador('Va');
  const b = await jogador('Vb');
  assert.ok(Party.comandoDoGrupo(a.s, { action: 'convidar', name: b.nome }).ok);
  assert.ok(Party.comandoDoGrupo(b.s, { action: 'aceitar' }).ok);
  assert.ok(Cacadas.entrar(a.s.estado, { huntId: 'poe-a1-the-twilight-strand', mode: 'auto', strategy: 'nearest' }).ok);
  assert.ok(Party.comandoDaCaca(a.s, { action: 'invite', name: b.nome }).ok);
  assert.ok(Party.comandoDaCaca(b.s, { action: 'accept' }).ok);
  assert.equal(Cacadas.salaDe(b.s.estado.hunt), a.s.estado.hunt);

  // Um bicho colado em A (é ele que vai bater em A — "o mob tirando a vida dele"); a caçada anda (cada tique conta 1 s).
  const h = a.s.estado.hunt;
  const bicho = h.monstros.find((m) => m.hp > 0);
  Object.assign(bicho, { x: h.pos.x + 1, y: h.pos.y, z: h.z ?? bicho.z });
  for (let i = 0; i < 40; i++) {
    for (const j of [a, b]) {
      j.s.estado.hunt.ultimoTique = Date.now() - 1000;
      if (j.s.estado.hp <= 0) j.s.estado.hp = j.s.estado.maxHp;
      await j.s.tique();
    }
  }
  const eventosDeB = b.recebidas.flatMap((m) => m.events ?? m.eventos ?? []);
  const deA = eventosDeB.filter((e) => e.quem === a.nome);
  assert.ok(deA.length > 0, `B viu eventos de A (${eventosDeB.length} eventos na tela de B)`);
  assert.ok(deA.some((e) => (e.t === 'dmg' || e.t === 'block') && e.uid === 'player'), 'o bicho batendo em A (o dano ou a esquiva dele)');
  assert.ok(!eventosDeB.some((e) => e.t === 'kill' && e.quem === a.nome), 'a experiência de A não aparece para B');

  // O aliado na tela de B: a vida e a mana de A.
  const aliado = Party.extrasDoRetrato(b.s).aliados.find((x) => x.name === a.nome);
  assert.equal(aliado.hp, a.s.estado.hp);
  assert.equal(aliado.maxMana, a.s.estado.maxMana);
  assert.equal(aliado.mana, Math.floor(a.s.estado.mana));
});
