// O GOLPE DO BICHO NO LACAIO (dono, 14/10: "Depois, num lote próprio"): o mesmo golpe corpo a corpo que o bicho dá em você — a faixa do
// arquivo do monstro (`Poderes.golpeCorpoACorpo`) —, com a metade da força que o jogo dá ao golpe nos lacaios; antes era a metade da VIDA
// ATUAL do bicho (`R.ataqueDoMonstro`), e um bicho com muita vida (um chefe, ou o de 1 bilhão dos testes) matava qualquer lacaio de um golpe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Poderes = await import('../systems/poderes.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));

test('o bicho de 1 bilhão de vida ao lado do Sentinela tira dele a metade do GOLPE do arquivo (o mínimo da faixa, com o sorteio em 0) — não a metade da vida', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Templar';
  const arma = peca('Wands/Driftwood_Wand');
  arma.poe.af = { ...(arma.poe.af ?? {}), sentinela_do_resplendor: 20 };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  const h = e.hunt;
  const [b, ...outros] = h.monstros;
  for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(b, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {} });
  const melee = Poderes.poderesDe(b.key)?.ataques?.find((a) => a.tipo === 'melee');
  assert.ok(melee, `o ${b.key} tem golpe no arquivo`);
  let t = Date.now();
  const original = Math.random;
  const golpes = [];
  let sentinela = null;
  try {
    Math.random = () => 0;
    for (let i = 0; i < 12; i++) {
      const ev = Cacadas.tique(e, PERSONAGEM, (t += 250));
      sentinela ??= h.lacaios?.find((l) => l.sentinela);
      if (sentinela) golpes.push(...ev.filter((x) => x.t === 'dmg' && x.uid === sentinela.uid && x.lacaio && !x.foe));
    }
  } finally { Math.random = original; }
  assert.ok(sentinela, 'o Sentinela saiu');
  assert.ok(golpes.length > 0, 'o bicho acertou o Sentinela');
  const fator = ModsPoe.doBicho(b, h.clock ?? 0, { contraOutro: true }).danoFator;
  // (lote 44, dono: "Aplicar o PoB" — o Sentinela tem a armadura do PoE: armadura ÷ (armadura + 5 × o físico), no teto de 90%)
  const fisico = melee.min * 0.5 * fator;
  const armadura = sentinela.poe?.armadura ?? 0;
  const red = Math.min(90, armadura > 0 ? (100 * armadura) / (armadura + 5 * fisico) : 0);
  const esperado = Math.max(1, Math.round(fisico * (1 - red / 100)));
  for (const g of golpes) assert.equal(g.v, esperado, `${g.v} = metade de ${melee.min} × ${fator}, menos ${red.toFixed(1)}% da armadura`);
  assert.ok(sentinela.hp > 0 && sentinela.hp >= sentinela.maxHp - esperado * golpes.length, 'vivo, com a vida que os golpes tiraram');
});
