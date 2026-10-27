// O GOLPE QUE MATA aparece (report do dono, 27/10: "ele morre sem aparecer o dano"). Antes, os eventos do tique da morte iam no quadro
// DEPOIS do `death` — já na cidade, sem a caçada, por baixo da caixa da morte —, e o `death` não dizia quem matou. Agora:
// - no tique da morte vai primeiro o último quadro da CAÇADA com o evento do golpe (valor, tipo, nome do golpe e do monstro, `fatal`);
// - o `death` leva o golpe (`golpe` e `golpeTexto`: "Morto por X — Golpe: N de Tipo");
// - o golpe corpo a corpo, a magia/mecânica (`aplicarNoJogador`) e o dano contínuo marcam o golpe que zerou a vida;
// - a morte offline leva o golpe no relatório da ausência.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sessao } from '../websocket/sessao.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Morte from '../systems/morte.mjs';
import * as Poderes from '../systems/poderes.mjs';
import * as R from '../systems/regras.mjs';
import { contraAtaque } from '../systems/hunt/combate.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { ligado as itensPoeLigado } from '../systems/itens-poe/catalogo.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';

const NOME = 'Golpe Fatal';

function sessaoNaCacada() {
  const enviados = [];
  const s = new Sessao({ readyState: 1, send: (texto) => enviados.push(JSON.parse(texto)) });
  s.conta = { id: 'teste-do-golpe-fatal' };
  s.personagem = { id: 0, nome: NOME };
  s.estado = personagemDeTeste({ vocacao: 'knight', level: 50 });
  s.estado.pos = { ...R.POSICAO_INICIAL };
  const r = Cacadas.entrar(s.estado, { huntId: HUNT_DE_TESTE, mode: 'auto' });
  assert.ok(r.ok, r.erro);
  // Sem a proteção de entrada (o mapa "carregado"): a caçada anda já.
  s.segurarNaEntrada = () => false;
  return { s, enviados };
}

const noPersonagem = (e) => e.t === 'dmg' && !e.foe && !e.lacaio && e.uid === 'player' && e.quem === NOME && e.v > 0;

test('no tique da morte, o quadro da caçada com o golpe vai ANTES do `death`, e o `death` diz quem matou, com qual golpe, quanto e o tipo', async () => {
  const { s, enviados } = sessaoNaCacada();
  const original = Date.now;
  let agora = original();
  Date.now = () => agora;
  let doTique = null;
  try {
    for (let i = 0; i < 2400 && s.estado.hunt; i++) {
      // Vida no fio (e sem Escudo de Energia): o primeiro golpe que passar mata.
      s.estado.hp = Math.min(s.estado.hp, 1);
      s.estado.es = 0;
      const n = enviados.length;
      agora += 250;
      await s.tique();
      if (!s.estado.hunt) doTique = enviados.slice(n);
    }
  } finally {
    Date.now = original;
  }
  assert.ok(doTique, 'o personagem não morreu na caçada');
  const iMorte = doTique.findIndex((m) => m.t === 'death');
  assert.ok(iMorte >= 0, 'o `death` não foi enviado');
  const quadroDaCacada = doTique.slice(0, iMorte).find((m) => m.t === 'state' && m.hunt && m.events?.some(noPersonagem));
  assert.ok(quadroDaCacada, `o golpe que matou não foi ao cliente antes da morte, na caçada: ${JSON.stringify(doTique.map((m) => [m.t, !!m.hunt, (m.events ?? []).filter((e) => e.t === 'dmg')]))}`);
  const golpes = quadroDaCacada.events.filter(noPersonagem);
  const fatal = golpes.find((e) => e.fatal) ?? golpes.at(-1);
  assert.ok(fatal.v > 0, 'o valor do golpe');
  assert.equal(typeof fatal.de, 'string', 'o nome do monstro');
  assert.ok(fatal.de.length > 0);
  assert.ok(fatal.golpe, 'o nome do golpe');
  assert.ok(fatal.elemento, 'o tipo do golpe');
  assert.ok(fatal.fatal, 'a marca do golpe que zerou a vida');
  const morte = doTique[iMorte];
  assert.deepEqual(
    { de: morte.golpe?.de, golpe: morte.golpe?.golpe, v: morte.golpe?.v, elemento: morte.golpe?.elemento },
    { de: fatal.de, golpe: fatal.golpe, v: fatal.v, elemento: fatal.elemento },
    'o `death` leva o mesmo golpe'
  );
  assert.equal(morte.golpe.tipo, Morte.nomeDoTipo(fatal.elemento));
  assert.match(morte.golpeTexto, new RegExp(`^Morto por ${fatal.de} — .+: ${fatal.v.toLocaleString('pt-BR').replaceAll('.', '\\.')} de `));
  // E a cidade vem DEPOIS (sem repetir os eventos da caçada nela).
  const depois = doTique.slice(iMorte + 1).filter((m) => m.t === 'state');
  assert.ok(depois.length, 'a cidade depois da morte');
  assert.equal(depois[0].hunt ?? null, null);
  assert.equal((depois[0].events ?? []).filter(noPersonagem).length, 0);
});

test('a magia / mecânica de chefe (`aplicarNoJogador`): o golpe que zera a vida vai marcado, com o tipo e o nome — "Morto por General Adus — Bomba Viva: N de Raio"', () => {
  const { s } = sessaoNaCacada();
  const e = s.estado;
  e.hp = 10;
  e.es = 0;
  const eventos = [];
  const bicho = { name: 'General Adus', key: 'general-adus', uid: 'adus' };
  const dano = Poderes.danoDeElementoNoJogador(e, e.hunt, s.personagem, bicho, 1e7, 'energy', eventos, 'Bomba Viva', Ficha.combate(e), false);
  assert.ok(dano > 0);
  assert.equal(e.hp, 0);
  const ev = eventos.find(noPersonagem);
  assert.equal(ev.fatal, true);
  assert.equal(ev.elemento, 'energy');
  const g = Morte.golpeQueMatou(eventos, NOME);
  assert.deepEqual({ de: g.de, golpe: g.golpe, v: g.v, elemento: g.elemento }, { de: 'General Adus', golpe: 'Bomba Viva', v: ev.v, elemento: 'energy' });
  assert.equal(Morte.textoDoGolpe(g), `Morto por General Adus — Bomba Viva: ${ev.v.toLocaleString('pt-BR')} de ${itensPoeLigado() ? 'Raio' : 'Energia'}`);
});

test('o golpe corpo a corpo que mata vai marcado (`fatal`), com o monstro, o golpe e o tipo', () => {
  const { s } = sessaoNaCacada();
  const e = s.estado;
  const bicho = Object.assign(criarMonstro({ key: e.hunt.monstros[0]?.key ?? 'troll', x: e.hunt.pos.x + 1, y: e.hunt.pos.y }, null), { attack: 1e6 });
  let eventos = [];
  for (let i = 0; i < 200 && e.hp > 0; i++) {
    e.hp = 1;
    e.es = 0;
    eventos = [];
    contraAtaque(e, e.hunt, s.personagem, bicho, eventos);
  }
  assert.equal(e.hp, 0, 'o golpe nunca passou');
  const ev = eventos.filter(noPersonagem).find((x) => x.fatal);
  assert.ok(ev, `sem o golpe fatal: ${JSON.stringify(eventos.filter((x) => x.t === 'dmg'))}`);
  assert.equal(ev.de, bicho.name);
  assert.equal(ev.golpe, 'corpo a corpo');
  assert.ok(ev.elemento);
  assert.match(Morte.textoDoGolpe(Morte.golpeQueMatou(eventos, NOME)), new RegExp(`^Morto por ${bicho.name} — Corpo a corpo: `));
});

test('sem a marca (a vida zerou por outro caminho), vale o último dano no próprio personagem — nunca o do lacaio nem o que ele causou', () => {
  const eventos = [
    { t: 'dmg', uid: 'player', quem: NOME, v: 50, foe: false, de: 'Zumbi', golpe: 'corpo a corpo', elemento: 'physical' },
    { t: 'dmg', uid: 'player', quem: NOME, v: 70, foe: false, de: 'Esqueleto', golpe: 'Flecha', elemento: 'fire' },
    { t: 'dmg', uid: 'm1', v: 900, foe: true, alvo: 'Zumbi' },
    { t: 'dmg', uid: 'l1', v: 800, foe: false, lacaio: true, de: 'Zumbi' },
    { t: 'dmg', uid: 'player', quem: 'Outro', v: 999, foe: false, de: 'Zumbi' },
  ];
  assert.deepEqual(Morte.golpeQueMatou(eventos, NOME), { de: 'Esqueleto', golpe: 'Flecha', v: 70, elemento: 'fire', tipo: 'Fogo' });
  assert.equal(Morte.golpeQueMatou([{ ...eventos[0], fatal: true }, eventos[1]], NOME).de, 'Zumbi', 'a marca vale mais que a ordem');
  assert.equal(Morte.golpeQueMatou([eventos[2], eventos[3]], NOME), null);
  // O dano contínuo (o veneno do bicho) chega com o nome do efeito como golpe.
  assert.equal(Morte.textoDoGolpe({ de: 'Aranha', golpe: 'Veneno', v: 1234, tipo: 'Caos' }), 'Morto por Aranha — Veneno: 1.234 de Caos');
});

test('a morte offline: o golpe que matou vai no relatório da ausência (a caixa e o motivo)', () => {
  const { s } = sessaoNaCacada();
  const golpeFatal = { de: 'General Adus', golpe: 'Bomba Viva', v: 3230, elemento: 'energy', tipo: 'Raio' };
  const r = s.relatorioDaAusenciaNaEntrada({ report: { minutos: 12 }, morreu: true, golpeFatal });
  assert.deepEqual(r.morte.golpe, golpeFatal);
  assert.equal(r.morte.golpeTexto, 'Morto por General Adus — Bomba Viva: 3.230 de Raio');
  assert.match(r.andamento.motivo, /morreu caçando enquanto estava fora.*Morto por General Adus — Bomba Viva: 3\.230 de Raio\./);
  assert.deepEqual(s.estado.relatorioDaAusencia.morte.golpe, golpeFatal, 'gravado no personagem até o OK');
});
