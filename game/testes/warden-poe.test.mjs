// O WARDEN (dono, 14/10: o próximo bloco do item 4, "Warden"): a Pele de Árvore (a Casca), a Lição das Estações e o Avatar Liberto (a Fúria
// Liberta e o Liberto) — os números do nível 20 do PoE (poedb). As habilidades saem sozinhas (o jogo usa as habilidades sozinho). E o HUD com
// os buffs do PoE por nome, a Casca e a Fúria Liberta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Um personagem do PoE numa caçada, com `af` na varinha. */
function personagem(af = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Ranger';
  const arma = peca('Wands/Driftwood_Wand');
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  P.garantir(e);
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const soma = (e) => { Ficha.invalidar(e); return Afixos.soma(e); };
const bicho = { uid: 1, key: 'rat', name: 'Rato', x: 1, y: 1, hp: 100, maxHp: 100 };

test('a ÁRVORE: as 9 linhas do Warden com efeito (as habilidades saem sozinhas)', { skip: SEM }, () => {
  const linhas = P.arvore().nos.filter((n) => n.ascendencia === 'Warden' && /Ensinamentos da Mãe|Lição das Estações|Avatar da Selva/.test(n.nome)).flatMap((n) => n.textos.map((t, i) => ({ t, estado: n.estados[i] }))).filter((l) => l.estado !== 'nota');
  assert.equal(linhas.length, 9);
  for (const l of linhas) assert.equal(l.estado, 'novo', l.t);
});

test('a CASCA (Pele de Árvore): +1 por segundo sem ser Acertado por um Ataque Recentemente, -1 por Ataque que acerta, até 10; -60 de Físico de Ataque por Casca, 4% mais Evadir por Casca abaixo do máximo', { skip: SEM }, () => {
  const e = personagem({ pele_de_arvore: 20 });
  const h = e.hunt;
  const t0 = h.clock;
  ModsPoe.tiqueDoWarden(e, h, ficha(e).afPoe, t0);
  assert.equal(h.casca.n, 0);
  ModsPoe.tiqueDoWarden(e, h, ficha(e).afPoe, t0 + 3500);
  assert.equal(h.casca.n, 3, '3,5 s: 3 Cascas');
  ModsPoe.tiqueDoWarden(e, h, ficha(e).afPoe, t0 + 20_000);
  assert.equal(h.casca.n, 10, 'até 10');
  h.clock = t0 + 20_000;
  let s = soma(e);
  assert.equal(s.physical_sofrido_ataque, -600);
  assert.equal(s.chance_evadir_mais ?? 0, 0, 'cheia: nada de Evasão a mais');
  // (o Ataque que acerta: -1, e não ganha de novo enquanto for "Recentemente" — 4 s)
  ModsPoe.aoSerAcertado(e, h, bicho, ficha(e), { dano: 10, corpoACorpo: true, agora: t0 + 20_000 });
  assert.equal(h.casca.n, 9);
  ModsPoe.tiqueDoWarden(e, h, ficha(e).afPoe, t0 + 23_000);
  assert.equal(h.casca.n, 9, 'acertado há 3 s: não ganha');
  s = soma(e);
  assert.equal(s.chance_evadir_mais, 4);
  assert.equal(s.physical_sofrido_ataque, -540);
  ModsPoe.tiqueDoWarden(e, h, ficha(e).afPoe, t0 + 26_000);
  assert.equal(h.casca.n, 10, 'passados os 4 s, volta a ganhar');
  // (a Magia que acerta não tira Casca sem a Lição das Estações)
  ModsPoe.aoSerAcertado(e, h, bicho, ficha(e), { dano: 10, magia: true, agora: t0 + 26_000 });
  assert.equal(h.casca.n, 10);
});

test('a LIÇÃO DAS ESTAÇÕES: -25 de cada tipo de dano dos Acertos de Magia por Casca; +3% do Suprimido Impedido por Casca abaixo do máximo; a Magia tira 1 Casca', { skip: SEM }, () => {
  const e = personagem({ pele_de_arvore: 20, casca_magia_fixo: -25, casca_supressao: 3, casca_perde_magia: 1 });
  const h = e.hunt;
  h.casca = { n: 6, ultimo: h.clock };
  const s = soma(e);
  for (const el of ['physical', 'fire', 'ice', 'energy', 'chaos']) assert.equal(s[`${el}_sofrido_magia`], -150, el);
  const sem = personagem();
  assert.equal((s.supressao_prevenida ?? 0) - (soma(sem).supressao_prevenida ?? 0), 12, '4 abaixo do máximo × 3%');
  const f = ficha(e);
  assert.equal(ModsPoe.fixoRecebido(f, 'fire', { magia: true }), -150);
  assert.equal(ModsPoe.fixoRecebido(f, 'fire', { ataque: true }), 0, 'só nos Acertos de Magia');
  ModsPoe.aoSerAcertado(e, h, bicho, f, { dano: 10, magia: true });
  assert.equal(h.casca.n, 5);
});

test('o AVATAR LIBERTO: 1 de Fúria Liberta por Afecção Elemental (0,2 s por tipo); com 100, Liberto por 10 s — sempre Congela/Eletriza/Incendeia e 100% mais Dano Elemental', { skip: SEM }, () => {
  const e = personagem({ avatar_liberto: 20, furia_liberta_por_afeccao: 1, furia_liberta_nao_liberto: 1, 'chance_freeze@buff:liberto': 100, 'chance_shock@buff:liberto': 100, 'chance_ignite@buff:liberto': 100, 'mais_dano_elemental@buff:liberto': 100 });
  const h = e.hunt;
  const af = ficha(e).afPoe;
  const t0 = h.clock;
  ModsPoe.ganharFuriaLiberta(e, h, af, ['queimando', 'eletrizado', 'envenenado'], t0);
  assert.equal(h.furiaLiberta.n, 2, 'o Incêndio e a Eletrização (o Veneno não é elemental)');
  ModsPoe.ganharFuriaLiberta(e, h, af, ['queimando'], t0 + 100);
  assert.equal(h.furiaLiberta.n, 2, 'o mesmo tipo antes de 0,2 s não conta');
  ModsPoe.ganharFuriaLiberta(e, h, af, ['queimando', 'congelado', 'lento'], t0 + 200);
  assert.equal(h.furiaLiberta.n, 5);
  h.furiaLiberta.n = 100;
  ModsPoe.tiqueDoWarden(e, h, af, t0 + 300);
  assert.ok(ModsPoe.buffAtivo(e, 'liberto'), 'Liberto');
  assert.equal(h.poeBuffs.liberto, t0 + 300 + 10_000);
  assert.equal(h.furiaLiberta.n, 0, 'consome tudo');
  ModsPoe.ganharFuriaLiberta(e, h, af, ['eletrizado'], t0 + 1000);
  assert.equal(h.furiaLiberta.n, 0, 'não ganha enquanto Liberto');
  h.clock = t0 + 400;
  const s = soma(e);
  assert.ok(s.chance_freeze >= 100 && s.chance_shock >= 100 && s.chance_ignite >= 100, JSON.stringify([s.chance_freeze, s.chance_shock, s.chance_ignite]));
  const f = ficha(e);
  assert.equal(ModsPoe.fatorDoDanoElemental(f, h, 'qualquer', 'fire'), 2);
  assert.equal(ModsPoe.fatorDoDanoElemental(f, h, 'qualquer', 'physical'), 1);
  // (sem Liberto, nada)
  delete h.poeBuffs.liberto;
  assert.equal(ModsPoe.fatorDoDanoElemental(ficha(e), h, 'qualquer', 'fire'), 1);
});

test('o HUD: os buffs do PoE por nome (o Liberto, os altares), a Casca e a Fúria Liberta, com o número no lugar do relógio', { skip: SEM }, () => {
  const e = personagem();
  const h = e.hunt;
  h.casca = { n: 7, ultimo: h.clock };
  h.furiaLiberta = { n: 40, ultimo: {} };
  ModsPoe.ganharBuff(h, 'liberto', 10);
  ModsPoe.ganharBuff(h, 'altarMassivo', 20);
  const cartoes = ModsPoe.buffsDoCliente(e);
  const por = Object.fromEntries(cartoes.map((c) => [c.nome, c]));
  assert.equal(por.Casca.contador, 7);
  assert.equal(por['Fúria Liberta'].contador, 40);
  assert.equal(por.Liberto.resta, 10_000);
  assert.equal(por['Altar Massivo'].resta, 20_000);
  // (e vão para o cliente com os outros cartões)
  const tela = Cacadas.snapshotDaHunt(e);
  assert.ok(tela.buffs.some((b) => b.nome === 'Casca' && b.contador === 7), JSON.stringify(tela.buffs.map((b) => b.nome)));
});
