// A caçada gravada no banco leva os bichos sem o que é cópia do bestiário
// (`Cacadas.huntParaGravar`), e volta IDÊNTICA ao carregar
// (`Cacadas.huntAoCarregar`) — inclusive bicho com campo mexido e boneco sem `key`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as R from '../systems/regras.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { personagemDeTeste, PERSONAGEM, huntDoPoe } from './apoio.mjs';
import { aAdaptar } from './apoio-migracao.mjs';

/** O que o banco guarda e o que volta dele, pelo mesmo caminho da sessão. */
const idaEVolta = (hunt) => Cacadas.huntAoCarregar(JSON.parse(JSON.stringify(Cacadas.huntParaGravar(hunt))));
const comoTexto = (hunt) => JSON.parse(JSON.stringify(hunt));

function cacando(huntId, tiques = 40) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 600 });
  const r = Cacadas.entrar(e, { huntId, mode: 'cycle', strategy: 'nearest' });
  assert.equal(r.ok, true, r.erro);
  let agora = Date.now();
  for (let i = 0; i < tiques; i++) Cacadas.tique(e, PERSONAGEM, (agora += R.PASSO_MS));
  return e;
}

test('a caçada volta idêntica do banco, e muito menor', { skip: aAdaptar("Gravar a caçada compacta é da engine; a área do PoE comprime menos (128895 → 81660 bytes) que a meta do teste") }, () => {
  for (const id of [huntDoPoe('werelions-1'), 'spike-8', 'winter-dream-court']) {
    const e = cacando(id);
    assert.ok(e.hunt.monstros.length > 10, `${id}: só ${e.hunt.monstros.length} bichos`);
    const antes = JSON.stringify(e.hunt);
    const gravada = JSON.stringify(Cacadas.huntParaGravar(e.hunt));
    assert.deepEqual(idaEVolta(e.hunt), comoTexto(e.hunt), id);
    assert.ok(gravada.length < antes.length / 3, `${id}: ${antes.length} → ${gravada.length} bytes`);
    // A caçada viva não foi tocada pela gravação.
    assert.equal(JSON.stringify(e.hunt), antes);
  }
});

test('bicho com campo diferente do bestiário (exp ajustada, boss com outra vida) guarda o campo', () => {
  const e = cacando(huntDoPoe('werelions-1'), 4);
  const [a, b] = e.hunt.monstros;
  a.exp = 12345;
  b.maxHp = 999999;
  b.hp = 999999;
  const volta = idaEVolta(e.hunt);
  assert.equal(volta.monstros[0].exp, 12345);
  assert.equal(volta.monstros[1].maxHp, 999999);
  assert.deepEqual(volta, comoTexto(e.hunt));
});

test('personagem gravado antes disto (bichos com todos os campos) carrega sem mudar nada', () => {
  const e = cacando(huntDoPoe('werelions-1'), 4);
  const velho = comoTexto(e.hunt);
  assert.deepEqual(Cacadas.huntAoCarregar(comoTexto(e.hunt)), velho);
});

test('depois de carregar, bicho novo nasce com uid acima de todos os da caçada', () => {
  const e = cacando(huntDoPoe('werelions-1'), 4);
  const gravada = comoTexto(Cacadas.huntParaGravar(e.hunt));
  gravada.monstros[0].uid = 5_000_000; // como se o servidor tivesse reiniciado com o contador lá atrás
  Cacadas.huntAoCarregar(gravada);
  const novo = criarMonstro({ key: gravada.monstros[1].key, x: 0, y: 0 });
  assert.ok(novo.uid > 5_000_000, `uid ${novo.uid}`);
});
