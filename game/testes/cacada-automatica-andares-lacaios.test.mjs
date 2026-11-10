// (10/11, dono: "essa fase [Caminhos Fluviais] um player reclamou que o personagem fica um tempo andando perdido sem completar a fase"; "quero que os
// lacaios andem igual o player, hoje parece que está puxando algo"; "deixe a caçada automática melhor — hoje ele vai em áreas errando muito, que não tem
// mob") Três coisas da Caça Automática:
//   1. com o andar vazio, ele vai pela escada da rota direto ao pedaço de andar que tem bicho (`percurso.irAoAndarComBichos`), não pelo laço inteiro;
//   2. o resto da instância longe é perseguido pelo tempo do CAMINHO até ele, não desistido em 15 s no meio do caminho;
//   3. o lacaio anda no passo do dono, num crédito de passo, e o desenho de cada tique dura o tique (não 2 casas em meio tique).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as R from '../systems/regras.mjs';
import { bfsDistancias, distancia } from '../systems/hunt/caminho.mjs';
import { andarDaGrade } from '../systems/hunt/andares.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

const SEM = !Catalogo.ligado() && 'só no jogo oficial (PoE)';
const todos = (h) => [...h.monstros, ...Object.values(h.outrosAndares ?? {}).flat()];

function entrar(huntId) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.maxHp = e.hp = 1e9;
  const r = Cacadas.entrar(e, { huntId, mode: 'auto' });
  assert.ok(r.ok, r.erro);
  e.hunt.ultimoTique = Date.now();
  return e;
}
/** Os bichos com 1 de Vida: o que se mede é o caminho, não a força do personagem de teste. */
const fracos = (h) => { for (const m of todos(h)) { m.hp = Math.min(m.hp, 1); m.maxHp = 1; } };

test('Caminhos Fluviais (o Amazon Camp, 7 andares): com bicho só no andar 8, ele vai pela escada da rota e chega lá em menos de 25 s', { skip: SEM }, () => {
  const e = entrar('poe-a2-the-riverways');
  const h = e.hunt;
  assert.equal(h.z, 7);
  assert.ok(h.outrosAndares?.[8]?.length, 'há bichos no andar 8');
  // Só os do andar 8 ficam: o andar 7 (onde ele está) e os outros, vazios.
  h.monstros.splice(0);
  for (const z of Object.keys(h.outrosAndares)) if (Number(z) !== 8) h.outrosAndares[z] = [];
  let t = h.ultimoTique;
  let chegou = null;
  for (let i = 0; i < 25 * 4 && chegou == null; i++) {
    fracos(e.hunt);
    Cacadas.tique(e, PERSONAGEM, (t += R.PASSO_MS));
    if (e.hunt.z === 8) chegou = i / 4;
  }
  // (Pelo laço, a escada do andar 8 é o waypoint 156: mais de 40 s andando o andar 7 vazio.)
  assert.ok(chegou != null, 'chegou ao andar 8');
});

test('o resto da instância LONGE (Grande Arena): ele persegue pelo tempo do caminho e mata, sem largar no meio e voltar', { skip: SEM }, () => {
  const e = entrar('poe-a4-the-grand-arena');
  const h = e.hunt;
  const grade = andarDaGrade(Cacadas.gradeDaHunt({ id: h.huntId }), h.z);
  const dist = bfsDistancias(grade, h.pos);
  // Fica só o bicho mais longe a pé (mais de 60 casas: 15 s não bastam para chegar).
  const ordem = h.monstros.map((m) => [m, dist.em(m.x, m.y) ?? -1]).sort((a, b) => b[1] - a[1]);
  const [longe, passos] = ordem[0];
  assert.ok(passos > 60, `o mais longe a ${passos} casas`);
  h.monstros.splice(0, h.monstros.length, longe);
  for (const z of Object.keys(h.outrosAndares ?? {})) h.outrosAndares[z] = [];
  // (os baús do PoE no caminho ficam de fora: o idle passa por eles antes do bicho mais longe — a regra de 03/11)
  for (const enc of Object.values(h.instancia?.encontros ?? {})) enc.semCaminhoAte = Infinity;
  let t = h.ultimoTique;
  let morreu = null;
  const limite = Math.ceil((passos * R.PASSO_MS * 1.4) / R.PASSO_MS) + 12;
  for (let i = 0; i < limite && morreu == null; i++) {
    fracos(e.hunt);
    Cacadas.tique(e, PERSONAGEM, (t += R.PASSO_MS));
    if (!(longe.hp > 0) || !e.hunt.monstros.includes(longe)) morreu = i;
  }
  assert.ok(morreu != null, `matou o bicho a ${passos} casas em até ${(limite / 4).toFixed(1)} s`);
});

test('o LACAIO anda no passo do dono: longe, 2 casas por tique desenhadas no tique inteiro; perto, 1 casa por tique como você', { skip: SEM }, () => {
  const e = entrar(HUNT_DE_TESTE);
  const h = e.hunt;
  h.monstros.splice(0);
  const grade = andarDaGrade(Cacadas.gradeDaHunt({ id: h.huntId }), h.z);
  // Uma casa a 12+ passos de você, para ele vir correndo.
  const dist = bfsDistancias(grade, h.pos, 14);
  let inicio = null;
  for (const k of grade.andavel) {
    const [x, y] = k.split(',').map(Number);
    if ((dist.em(x, y) ?? 0) >= 12) { inicio = { x, y }; break; }
  }
  assert.ok(inicio, 'achou uma casa longe');
  const l = { uid: 'l1', tipo: 'lacaio', semAtaque: true, x: inicio.x, y: inicio.y, hp: 100, maxHp: 100, perto: 2 };
  h.lacaios = [l];
  const razao = Cacadas.razaoDoDono(e);
  assert.equal(razao, 1, 'o personagem de teste anda na base');
  let agora = 1_000_000;
  const tiques = [];
  for (let i = 0; i < 16; i++) {
    const antes = { x: l.x, y: l.y };
    Cacadas.tiqueDosLacaios(e, h, PERSONAGEM, grade, (agora += R.PASSO_MS));
    tiques.push({ casas: distancia(antes, l), moveMs: l.moveMs, longe: distancia(antes, h.pos) > l.perto + 3 });
  }
  const andando = tiques.filter((x) => x.casas > 0);
  assert.ok(andando.some((x) => x.longe && x.casas === 2), 'longe, corre 2 casas por tique');
  for (const x of andando) assert.equal(x.moveMs, R.PASSO_MS, `o desenho de ${x.casas} casa(s) dura o tique: ${JSON.stringify(tiques)}`);
  assert.ok(andando.some((x) => !x.longe && x.casas === 1), 'perto, 1 casa por tique, como você');
  assert.ok(distancia(l, h.pos) <= l.perto, 'chegou perto de você');
});
