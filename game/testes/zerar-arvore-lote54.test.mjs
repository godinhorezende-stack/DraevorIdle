// LOTE 54 — as ÚNICAS de JOIA (J30, a quinta leva — as decisões do dono, 16/10): a Fúria Fulminante ("Nos ataques com escudo": o crítico da Mão
// Secundária por Escudo de Energia no escudo vale nas gemas que atacam com o dano base da mão secundária — Esmagar Escudos, Arremesso Espectral…;
// a chance na base, antes do "aumentado") e a Fome Eterna ("Pesquisar no poedb": o Espectro ganha o Devorador de Almas — +5% de Velocidade de
// Ataque e Conjuração por alma de inimigo morto perto, perde 1 a cada 0,5 s sem alma recente, máximo de 45; o buff não renova enquanto dura).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Acoes = await import('../systems/acoes.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const modelo = (slug, trecho) => Catalogo.catalogo().classes.Jewels.unicos.find((x) => x.slug === slug).modificadores.find((m) => m.modelo.includes(trecho));
const anel = (af) => ({ id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id), count: 1, af: [], poe: { af } });
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 80, rng: () => 0.5 }));

test('as linhas com efeito', { skip: SEM }, () => {
  for (const [slug, trecho] of [['Seething_Fury', 'Chance de Golpe Crítico'], ['Seething_Fury', 'Multiplicador'], ['Unending_Hunger', 'Devorador']]) {
    const m = modelo(slug, trecho);
    assert.ok(['novo', 'equivalente'].includes(tr(m.modelo, (m.faixas ?? []).map((f) => f[0])).estado), `${slug}: ${trecho}`);
  }
  assert.deepEqual(tr(modelo('Seething_Fury', 'Chance de Golpe Crítico').modelo, [0.15, 10]).efeitos, [{ stat: 'crit_base_golpe%esEscudo:10@ataqueDeEscudo', valor: 0.15 }]);
});

test('os ATAQUES COM ESCUDO: as gemas com o dano base da mão secundária ganham a tag `ataqueDeEscudo`; as outras, não', { skip: SEM }, () => {
  for (const s of ['Shield_Crush', 'Shield_Charge', 'Spectral_Shield_Throw', 'Glacial_Shield_Swipe']) assert.ok(Acoes.tagsPoeDaSkill({ poeGema: { slug: s } }).includes('ataqueDeEscudo'), s);
  for (const s of ['Heavy_Strike', 'Ice_Crash_of_Cadence', 'Fireball']) assert.ok(!Acoes.tagsPoeDaSkill({ poeGema: { slug: s } }).includes('ataqueDeEscudo'), s);
});

test('a FÚRIA FULMINANTE: +0,15% de crítico BASE e +4% de multiplicador por 10 de Escudo de Energia no escudo — só no ataque com escudo', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 80 });
  e.sistema = 'poe';
  const escudo = peca('Shields/Titanium_Spirit_Shield');
  e.equipment = { ...e.equipment, shield: escudo, ring: anel({ 'crit_base_golpe%esEscudo:10@ataqueDeEscudo': 0.15, 'crit_dmg%esEscudo:10@ataqueDeEscudo': 4 }) };
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  const n = Math.floor(ModsPoe.defesaDaPecaVestida(escudo).escudo / 10);
  assert.ok(n > 0);
  const comEscudo = ModsPoe.fichaDoGolpe(f, Acoes.tagsPoeDaSkill({ poeGema: { slug: 'Shield_Crush' } }), { estado: e });
  const semEscudo = ModsPoe.fichaDoGolpe(f, Acoes.tagsPoeDaSkill({ poeGema: { slug: 'Heavy_Strike' } }), { estado: e });
  const esperado = (f.critPontos + (0.15 * n) / 100) * (1 + (f.critInc ?? 0) / 100) * (f.critMais ?? 1);
  assert.ok(Math.abs(comEscudo.critChance - Math.min(f.critTeto ?? 1, esperado)) < 1e-9, `${comEscudo.critChance} ≈ ${esperado}`);
  assert.ok(Math.abs(comEscudo.critMultiplier - (f.critMultiplier + (4 * n) / 100)) < 1e-9);
  assert.equal(semEscudo.critChance, f.critChance, 'o ataque sem escudo: o crítico de sempre');
});

test('a FOME ETERNA na árvore: com 40 de Inteligência ALOCADA no raio, o Espectro tem 50% de chance de ganhar o Devorador de Almas por 20 s', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  P.garantir(e);
  const nos = P.arvore().nos;
  const inteligencia = (s) => nos.filter((x) => (x.efeitos ?? []).some((ef) => ef.add === 'int') && Math.hypot(x.x - s.x, x.y - s.y) <= P.RAIOS_DE_JOIA.medio);
  const s = nos.filter((x) => P.ehEncaixeDeJoia(x)).sort((a, b) => inteligencia(b).length - inteligencia(a).length)[0];
  const doRaio = inteligencia(s);
  const soma = (lista) => lista.reduce((t, x) => t + x.efeitos.filter((ef) => ef.add === 'int').reduce((u, ef) => u + ef.valor, 0), 0);
  assert.ok(soma(doRaio) >= 40);
  e.passivas.alocados.push(s.id);
  P.garantir(e);
  const u = Catalogo.catalogo().classes.Jewels.unicos.find((x) => x.slug === 'Unending_Hunger');
  const base = Catalogo.catalogo().classes.Jewels.bases.find((b) => b.nome === u.base);
  const joia = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 80, rng: () => 0, unico: 'Unending_Hunger' }));
  e.inventory = [joia];
  assert.equal(Comandos.comando(e, { action: 'encaixarJoia', no: s.id, pilha: 0, id: joia.id }).ok, true);
  const af = () => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };
  assert.ok(!(af().espectro_devorador_chance > 0), 'sem Inteligência alocada no raio, nada');
  let total = 0;
  for (const x of doRaio) { if (total >= 40) break; e.passivas.alocados.push(x.id); total = soma(doRaio.filter((y) => e.passivas.alocados.includes(y.id))); }
  P.garantir(e);
  assert.equal(af().espectro_devorador_chance, 50);
  assert.equal(af().espectro_devorador_s, 20);
  // o Espectro convocado com isso ganha o Devorador ao matar; o Zumbi, não
  assert.deepEqual(LacaiosPoe.oQueInvoca('Raise_Spectre', 20, null, af()).poe.aoMatar.devoradorDeAlmas, [50, 20]);
  assert.equal(LacaiosPoe.oQueInvoca('Raise_Zombie', 20, null, af()).poe.aoMatar.devoradorDeAlmas, undefined);
});

test('o DEVORADOR DE ALMAS no Espectro: +5% de velocidade por alma de morto a até 3 casas; perde 1 a cada 0,5 s sem alma recente; não renova', { skip: SEM }, () => {
  const l = { hp: 100, x: 0, y: 0, poe: { aoMatar: { devoradorDeAlmas: [100, 20] } } };
  LacaiosPoe.aoMatarDoLacaio(l, 1000, () => 0);
  assert.equal(l.buffs.devoradorDeAlmas, 21_000);
  LacaiosPoe.aoMatarDoLacaio(l, 5000, () => 0);
  assert.equal(l.buffs.devoradorDeAlmas, 21_000, 'não renova enquanto dura');
  for (const [x, t] of [[2, 2000], [3, 2100], [1, 2200]]) ModsPoe.almaParaOsLacaios([l], { x, y: 0 }, t);
  ModsPoe.almaParaOsLacaios([l], { x: 5, y: 0 }, 2300);
  assert.equal(ModsPoe.almasDoLacaio(l, 2300), 3, 'o de 5 casas não conta');
  assert.equal(LacaiosPoe.velocidadeDoLacaio(l, 2300), 15);
  // (sem alma nova por 4 s, perde 1 a cada 0,5 s)
  assert.equal(ModsPoe.almasDoLacaio(l, 2200 + 4000 + 1000), 1);
  assert.equal(ModsPoe.almasDoLacaio(l, 22_000), 0, 'acabou o buff, as almas vão junto');
  // o teto de 45
  const m = { hp: 100, x: 0, y: 0, buffs: { devoradorDeAlmas: 99_000 } };
  for (let i = 0; i < 60; i++) ModsPoe.almaParaOsLacaios([m], { x: 0, y: 1 }, 1000 + i);
  assert.equal(ModsPoe.almasDoLacaio(m, 1100), 45);
});
