// O CONGELAMENTO DO PoE e a GEADA (dono, 14/10: "Adotar a conta do PoE"): o Congelamento que você põe segue o dano de Gelo do acerto — 60 ms
// por 1% da vida do monstro, até 3 s, × a Duração aumentada; com menos de 0,3 s não congela (antes, 1,5 s fixos) — e a Geada do Juramento do
// Inverno ("Acertos que falharem em Congelar devido a Duração insuficiente do Congelamento infligem Geada": 10 s, acumula, +20% de Duração do
// Congelamento por Geada, sai ao Congelar).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await import('../systems/acoes.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');

const bicho = () => ({ hp: 10_000, maxHp: 10_000, x: 0, y: 0, estados: {} });
/** Um acerto com `gelo` de dano de Gelo, 100% de chance de Congelar, sem crítico. */
const acertar = (b, gelo, af = {}, agora = 1000) => AfeccoesPoe.aoAcertar(b, [{ elemento: 'ice', dano: gelo }], { afeccoes: AfeccoesPoe.daSoma({ chance_freeze: 100, ...af }), agora, rng: () => 0 });

test('a CONTA: 60 ms por 1% da vida em Gelo, até 3 s, × a Duração aumentada; abaixo de 0,3 s não congela', { skip: SEM }, () => {
  assert.equal(AfeccoesPoe.msDoCongelamento(500, 10_000), 300, '5% da vida: 0,3 s, o mínimo');
  assert.equal(AfeccoesPoe.msDoCongelamento(200, 10_000), 0, '2%: 0,12 s — não congela');
  assert.equal(AfeccoesPoe.msDoCongelamento(9000, 10_000), 3000, 'até 3 s');
  assert.equal(AfeccoesPoe.msDoCongelamento(250, 10_000, 100), 300, '2,5% com 100% de Duração aumentada: 0,3 s');
});

test('o ACERTO congela pela conta (não mais 1,5 s fixos): 10% da vida em Gelo = 0,6 s; 2% não congela', { skip: SEM }, () => {
  const b = bicho();
  const postos = acertar(b, 1000);
  assert.ok(postos.includes('congelado'), JSON.stringify(postos));
  assert.equal(b.estados.congelado.ate - 1000, 600);
  const fraco = bicho();
  assert.ok(!acertar(fraco, 200).includes('congelado'), 'curto demais');
  assert.equal(fraco.estados.congelado, undefined);
  assert.equal(fraco.estados.geada, undefined, 'sem o Juramento do Inverno, sem Geada');
  // ("Congela Inimigos como se causasse 50% mais Dano": 4% em Gelo × 1,5 = 6% → 0,36 s)
  const comMais = bicho();
  assert.ok(acertar(comMais, 400, { congelamento_como_mais: 50 }).includes('congelado'));
  assert.equal(comMais.estados.congelado.ate - 1000, 360);
});

test('a GEADA: o acerto curto demais inflige Geada (acumula, 10 s); cada Geada +20% de duração; ao Congelar, sai toda', { skip: SEM }, () => {
  const [l] = P.arvore().nos.flatMap((n) => (n.textos ?? []).map((t, i) => ({ t, estado: n.estados?.[i], efeitos: n.efeitos }))).filter((x) => /infligem Geada$/.test(x.t));
  assert.equal(l.estado, 'novo');
  assert.ok(l.efeitos.some((x) => x.add === 'geada_ao_falhar_congelar'));
  const af = { geada_ao_falhar_congelar: 1 };
  const b = bicho();
  assert.ok(acertar(b, 400, af, 1000).includes('geada'), '4%: 0,24 s — Geada');
  assert.deepEqual(b.estados.geada, { n: 1, ate: 11_000 });
  acertar(b, 400, af, 2000);
  assert.deepEqual(b.estados.geada, { n: 2, ate: 12_000 }, 'acumula e renova');
  // (com 2 Geadas, +40%: 0,24 s × 1,4 = 0,336 s — congela, e as Geadas saem)
  const postos = acertar(b, 400, af, 3000);
  assert.ok(postos.includes('congelado'), JSON.stringify(postos));
  assert.equal(b.estados.congelado.ate - 3000, 336);
  assert.equal(b.estados.geada, undefined, 'congelado: as Geadas saem');
  // (passados 10 s, a Geada acaba)
  const c = bicho();
  acertar(c, 400, af, 1000);
  assert.equal(AfeccoesPoe.geadasNo(c, 11_001), 0);
});
