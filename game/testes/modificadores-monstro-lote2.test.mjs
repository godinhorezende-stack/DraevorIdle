// (09/11 — dono: "quero resolver os aproximados e parciais" dos modificadores de monstro) LOTE 2: as AFECÇÕES. As que o monstro sofre ("−80% de
// Efeito de Afecções de Raio em si", "Duração do Congelamento/Incêndio/Definhamento em si reduzida", "+30% de Resistência a Fogo contra Dano Degenerativo",
// "Dano Físico Degenerativo sofrido reduzido") e as que ele causa em você (o Resfriamento do Gelo do PoE, o "Efeito de Resfriamento aumentado", o
// "Sempre Eletriza" com o efeito e a duração, a chance de Congelar).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as Afeccoes from '../systems/itens-poe/afeccoes.mjs';
import * as ModsPoe from '../systems/itens-poe/mods-poe.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { resistido } from '../systems/hunt/resistencia.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { contraAtaque } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

const SEM = !Catalogo.ligado() && 'só no jogo oficial (PoE)';
const alvo = (extra = {}) => ({ hp: 1e6, maxHp: 1e6, dots: [], estados: {}, ...extra });
const acertar = (b, elemento, af) => Afeccoes.aoAcertar(b, [{ elemento, dano: 200_000 }], { afeccoes: Afeccoes.daSoma(af), crit: true, agora: 0, rng: () => 0.5 });

test('o monstro com "−80% de Efeito de Afecções de Raio/Gelo em si": a Eletrização e o Resfriamento que você põe nele saem com 20% da força', { skip: SEM }, () => {
  const normal = alvo();
  acertar(normal, 'energy', {});
  const resistente = alvo({ afeccaoEfeitoPct: { eletrizacao: -80 } });
  acertar(resistente, 'energy', {});
  assert.ok(normal.estados.chocado?.pct > 0, 'eletriza o normal');
  assert.equal(resistente.estados.chocado?.pct ?? 0, Math.round(normal.estados.chocado.pct * 0.2 * 10) / 10);
  const frio = alvo();
  acertar(frio, 'ice', {});
  const frioResistente = alvo({ afeccaoEfeitoPct: { resfriamento: -80 } });
  acertar(frioResistente, 'ice', {});
  assert.ok((frio.estados.lento?.pct ?? 0) > (frioResistente.estados.lento?.pct ?? 0), `${frio.estados.lento?.pct} > ${frioResistente.estados.lento?.pct}`);
});

test('a duração EM SI: o Incêndio dura 80% menos e o Definhamento 60% menos no monstro que tem a linha', { skip: SEM }, () => {
  const normal = alvo();
  acertar(normal, 'fire', {});
  const curto = alvo({ afeccaoDuracaoPct: { incendio: -80 } });
  acertar(curto, 'fire', {});
  const dur = (b) => b.dots.find((d) => d.tipo === 'queimadura')?.ate ?? 0;
  assert.ok(dur(normal) > 0);
  assert.ok(Math.abs(dur(curto) - dur(normal) * 0.2) <= 100, `${dur(curto)} ≈ ${dur(normal) * 0.2}`);
  const w = alvo({ afeccaoDuracaoPct: { definhar: -60 } });
  ModsPoe.porNoAlvo(w, 'definhado', 2000, 0);
  assert.equal(w.estados.definhado.ate, 800);
});

test('o dano contínuo no monstro: "+30% de Resistência a Fogo contra Dano Degenerativo" e "Dano Físico Degenerativo sofrido reduzido em 25%" — o acerto não muda', () => {
  const hunt = { clock: 0 };
  const m = { key: 'troll', hp: 1e6, maxHp: 1e6, resistDot: { fire: 30 }, dotFisicoSofridoPct: -25 };
  assert.equal(resistido(hunt, m, 'fire', 1000, null, { dot: true }), resistido(hunt, { key: 'troll' }, 'fire', 1000, null, { dot: true }) - 300);
  assert.equal(resistido(hunt, m, 'fire', 1000), resistido(hunt, { key: 'troll' }, 'fire', 1000), 'o acerto não pega a resistência contra dano contínuo');
  assert.equal(resistido(hunt, m, 'physical', 1000, null, { dot: true }), Math.round(resistido(hunt, { key: 'troll' }, 'physical', 1000, null, { dot: true }) * 0.75));
});

function cena(extra = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.maxHp = e.hp = 2000;
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  const m = Object.assign(criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null), extra);
  h.monstros.splice(0, h.monstros.length, m);
  return { e, h, m };
}
const bater = ({ e, h, m }) => {
  const ev = [];
  const original = Math.random;
  Math.random = () => 0.5;
  try { contraAtaque(e, h, PERSONAGEM, m, ev); } finally { Math.random = original; }
  return ev;
};

test('o monstro que te acerta com Gelo te RESFRIA (o PoE); o "Efeito de Resfriamento aumentado em 200%" dele resfria mais; o físico puro não resfria', { skip: SEM }, () => {
  const fisico = cena();
  bater(fisico);
  assert.ok(!(fisico.h.controle?.lento?.pct > 0), 'o golpe físico não resfria');
  const gelo = cena({ conversaoPct: { ice: 100 } });
  bater(gelo);
  const pct = gelo.h.controle?.lento?.pct ?? 0;
  assert.ok(pct > 0, 'o golpe de gelo resfria');
  const forte = cena({ conversaoPct: { ice: 100 }, efeitoResfriamentoPct: 200 });
  bater(forte);
  assert.ok((forte.h.controle?.lento?.pct ?? 0) > pct, `${forte.h.controle?.lento?.pct} > ${pct}`);
});

test('o "Sempre Eletriza" com "Todo Dano pode Eletrizar" (o Eletrocutante) te eletriza com o golpe físico; o efeito aumentado eletriza mais; "35% de chance de Congelar" com "Todo Dano pode Congelar" congela', { skip: SEM }, () => {
  const eletro = cena({ sempreEletriza: true, todoDanoEletriza: true });
  bater(eletro);
  const pct = eletro.h.debuffsDoJogador?.eletrizado?.pct ?? 0;
  assert.ok(pct > 0, 'eletrizou');
  const forte = cena({ sempreEletriza: true, todoDanoEletriza: true, efeitoEletrizacaoPct: 25, duracaoEletrizacaoPct: 50 });
  bater(forte);
  assert.ok(forte.h.debuffsDoJogador.eletrizado.pct > pct);
  assert.ok(forte.h.debuffsDoJogador.eletrizado.ate > eletro.h.debuffsDoJogador.eletrizado.ate);
  const sem = cena({ sempreEletriza: true });
  bater(sem);
  assert.ok(!(sem.h.debuffsDoJogador?.eletrizado?.pct > 0), 'sem Raio e sem "Todo Dano pode Eletrizar", nada');
  const gelo = cena({ chanceCongelar: 100, todoDanoCongela: true, forca: 30 });
  bater(gelo);
  assert.ok(gelo.h.controle?.congelado?.ate > 0, JSON.stringify(gelo.h.controle));
});

test('os modificadores do arquivo: o Resistente a Fogo e Incêndio com o Incêndio em si reduzido (e a linha certa), o Eletrocutante e o Congelamento Permanente com efeito', () => {
  const d = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/modificadores-monstro.json', import.meta.url), 'utf8'));
  const fogo = d.mods.find((m) => m.nome === 'Resistente a Fogo e Incêndio');
  assert.equal(fogo.stats.afeccaoDuracaoPct.incendio, -80);
  assert.ok(fogo.linhas.includes('Duração do Incêndio em Você reduzida em 80%'));
  assert.equal(d.mods.find((m) => m.id === 'MonsterArchnemesisShocker_').estado, 'efeito');
  assert.equal(d.mods.find((m) => m.id === 'MonsterArchnemesisFreezer__').estado, 'efeito');
});
