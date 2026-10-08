// "Coloco o alvo para atacar o mais perto, mas às vezes outro fica mais perto e ele não muda" (dono, 07/10): com a trava do percurso,
// a estratégia "mais perto" troca para um bicho colado (1 casa) ou que ficou ao menos FOLGA_DA_TROCA passos mais perto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import { alvoAtual, FOLGA_DA_TROCA } from '../systems/hunt/alvo.mjs';
import { gradeDaHunt, huntOuMapaCustom } from '../systems/hunt/terreno.mjs';
import { noAndar } from '../systems/hunt/andares.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';

function cacadaComPercurso() {
  for (const huntId of [HUNT_DE_TESTE, 'rotworm-cave', 'swamp-troll-cave', 'cyclopolis']) {
    const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
    if (!Cacadas.entrar(e, { huntId, mode: 'auto' }).ok) continue;
    if (e.hunt.percurso) return e;
  }
  return null;
}

test('mais perto: a trava solta quando outro bicho chega colado ou fica bem mais perto; não troca por 1 passo de diferença', (t) => {
  const e = cacadaComPercurso();
  if (!e) return t.skip('nenhuma caçada com percurso neste pacote');
  const h = e.hunt;
  h.strategy = 'nearest';
  const [a, b] = h.monstros;
  h.monstros.splice(0, h.monstros.length, a, b);
  // As casas do PRÓPRIO percurso (andáveis e no corredor): ele parado num ponto, os bichos em pontos à frente.
  const pontos = gradeDaHunt(huntOuMapaCustom(h.huntId)).percurso.filter((p) => noAndar(p, h.z));
  const i0 = h.percurso.passo % pontos.length;
  const em = (k) => ({ x: pontos[(i0 + k) % pontos.length].x, y: pontos[(i0 + k) % pontos.length].y });
  Object.assign(h.pos, em(0));
  const passosAte = (m) => Math.max(Math.abs(m.x - h.pos.x), Math.abs(m.y - h.pos.y));
  let k1 = 1;
  while (k1 < 30 && passosAte(em(k1)) < 5) k1++;
  Object.assign(a, { ...em(k1), hp: 100, maxHp: 100, perseguindo: true });
  Object.assign(b, { ...em(k1 + 1), hp: 100, maxHp: 100, perseguindo: true });
  delete h.aPeGuardado;
  const travado = alvoAtual(h);
  if (!travado) return t.skip('o corredor do percurso não alcança esta posição');
  assert.equal(h.alvoTravado, travado.uid);
  const outro = travado === a ? b : a;
  // O outro num ponto um pouco mais perto que o travado (menos que a folga): não troca.
  let kq = k1;
  while (kq > 1 && passosAte(em(kq)) >= passosAte(travado) - (FOLGA_DA_TROCA - 1)) kq--;
  if (passosAte(em(kq)) === passosAte(travado) - (FOLGA_DA_TROCA - 1)) {
    Object.assign(outro, em(kq));
    delete h.aPeGuardado;
    assert.equal(alvoAtual(h)?.uid, travado.uid, 'uma casa de diferença não troca');
  }
  // O outro chega colado (o primeiro ponto do percurso ao lado dele): troca.
  let kc = 1;
  while (kc < 10 && passosAte(em(kc)) !== 1) kc++;
  Object.assign(outro, em(kc));
  delete h.aPeGuardado;
  assert.equal(alvoAtual(h)?.uid, outro.uid, 'o colado vira o alvo');
  assert.equal(h.alvoTravado, outro.uid);
});
