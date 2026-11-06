// (06/11, dono: "continue até dar 0 linhas sem efeito") O último lote dos Únicos sem efeito — os anéis que sobraram, os amuletos, as armas, as aljavas, os
// frascos e as tinturas — e o fechamento: NENHUM único do jogo fica com linha "sem efeito" no balão. As mecânicas que entram: o Resfriamento revertido (a
// Fiandeira Invernal), a Vida perdida adiada (a Progênese), o Veneno a mais (o Aguilhão da Traição) e o espalhado (o Cutelo do Bino), o Poder do inimigo (o
// Ladrão de Nomes), a resistência que falta (a Réplica: Nebulis)…
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
await import('../systems/dados.mjs');
if (!SEM) await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Cond = await import('../systems/itens-poe/condicoes-poe.mjs');
const Controle = await import('../systems/combate/controle.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test('nenhum único do jogo fica com linha "sem efeito" no balão', { skip: SEM }, () => {
  const cat = Catalogo.catalogo();
  const ruins = [];
  for (const [classe, c] of Object.entries(cat.classes)) {
    for (const u of c.unicos ?? []) {
      const b = c.bases.find((x) => x.nome === u.base);
      if (!b) continue;
      const g = gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base: b.id, raridade: 'unico', ilvl: 84, rng: semente(5), unico: u.slug });
      if (!g || g.erro) continue;
      const p = Jogo.pecaDoJogo(g, Catalogo.REGRAS, semente(6));
      const linhas = [...(p?.poe?.implicitos ?? []), ...(p?.poe?.prefixos ?? []), ...(p?.poe?.sufixos ?? []), ...(p?.poe?.modificadores ?? [])];
      linhas.forEach((m, k) => { if (p.poe.estados?.[k] === 'registrado') ruins.push(`${classe} ${u.nome}: ${m.texto}`); });
    }
  }
  assert.deepEqual(ruins, []);
});

test('a Fiandeira Invernal: o Resfriamento em você vira pressa; a Progênese adia a Vida perdida', () => {
  const hunt = { clock: 0, controle: { lento: { ate: 5000, pct: 30 } } };
  assert.ok(Controle.fatorDeLentidao(hunt, 0) > 1);
  hunt.poeResfriamentoRevertido = true;
  assert.ok(Math.abs(Controle.fatorDeLentidao(hunt, 0) - 0.7) < 1e-9);
  const h2 = { clock: 0 };
  assert.equal(ModsPoe.adiarDano(h2, { afPoe: { dano_adiado_pct: 25 } }, 100, 0), 75);
  assert.equal(h2.poeVidaAdiada.length, 1);
  const estado = { hp: 100, maxHp: 100 };
  ModsPoe.aurasProximas({ actions: [] }, { ...h2, pos: { x: 0, y: 0 }, monstros: [] }, { afPoe: { x: 1 } }, 0);
  const h3 = { clock: 0, pos: { x: 0, y: 0 }, monstros: [], poeVidaAdiada: h2.poeVidaAdiada };
  ModsPoe.aurasProximas(estado, h3, { afPoe: { x: 1 } }, 2000);
  assert.ok(Math.abs(estado.hp - 87.5) < 1e-6, `metade dos 25 em 2 s: ${estado.hp}`);
});

test('o Aguilhão da Traição põe um Veneno a mais; o Cutelo do Bino espalha o do morto', () => {
  const alvo = { uid: 1, hp: 50, maxHp: 50, x: 1, y: 0, estados: {}, dots: [] };
  const vizinho = { uid: 2, hp: 50, maxHp: 50, x: 2, y: 0, estados: {}, dots: [] };
  const hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [alvo, vizinho] };
  alvo.dots.push({ id: 'v1', tipo: 'venenoPoe', falta: 40, ate: 2000, porPulso: 10, proximo: 500, desde: 0 });
  const af = { 'ev:envenenar:venenoExtra': 100, 'ev:matar:espalharVeneno:400': 100 };
  const ficha = { afPoe: af, eventosPoe: Cond.eventosDa(af) };
  ModsPoe.evento({ hp: 10, maxHp: 10 }, hunt, 'envenenar', ficha, { alvo, agora: 0 });
  assert.equal(alvo.dots.filter((d) => d.tipo === 'venenoPoe').length, 2);
  ModsPoe.evento({ hp: 10, maxHp: 10 }, hunt, 'matar', ficha, { alvo, agora: 0 });
  assert.equal(vizinho.dots.filter((d) => d.tipo === 'venenoPoe').length, 1);
  assert.equal(hunt.poeTemporarios.cuteloDoBino.valor, 400);
});

test('o Poder do inimigo (o Ladrão de Nomes) e a resistência que falta (a Réplica: Nebulis)', () => {
  assert.equal(Cond.poderDoInimigo({ raridade: 'normal' }), 1);
  assert.equal(Cond.poderDoInimigo({ raridade: 'modificado' }), 2);
  assert.equal(Cond.poderDoInimigo({ raridade: 'raro' }), 10);
  assert.equal(Cond.poderDoInimigo({ boss: { id: 'x' } }), 20);
  const r = Cond.escalasDaFicha({ hunt: { clock: 0 } }, { 'fire_dmg%resElemFaltando:1~450': 12 }, { protection: { fire: 50, ice: 75, energy: 75 } });
  assert.equal(r?.fire_dmg, 300);
});

test('toda linha inerte de único leva o motivo no balão, também nos frascos (o Vinho do Profeta, o Apanhador de Almas)', { skip: SEM }, () => {
  const cat = Catalogo.catalogo();
  const semNota = [];
  for (const [classe, c] of Object.entries(cat.classes)) {
    for (const u of c.unicos ?? []) {
      const b = c.bases.find((x) => x.nome === u.base);
      if (!b) continue;
      const g = gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base: b.id, raridade: 'unico', ilvl: 84, rng: semente(5), unico: u.slug });
      if (!g || g.erro) continue;
      const p = Jogo.pecaDoJogo(g, Catalogo.REGRAS, semente(6));
      const linhas = [...(p?.poe?.implicitos ?? []), ...(p?.poe?.prefixos ?? []), ...(p?.poe?.sufixos ?? []), ...(p?.poe?.modificadores ?? [])];
      linhas.forEach((m, k) => { if (p.poe.estados?.[k] === 'inerte' && !p.poe.notas?.[k]) semNota.push(`${classe} ${u.nome}: ${m.texto}`); });
    }
  }
  assert.deepEqual(semNota, []);
});

test('a Nebulis: "caso Corrompido" vale só com a própria peça corrompida; o Gelo da arma por Destreza', async () => {
  assert.deepEqual(Cond.daPeca('spell_dmg%corrompidaLocal', 90, { poe: { corrompido: true } }, {}), ['spell_dmg', 90]);
  assert.deepEqual(Cond.daPeca('spell_dmg%corrompidaLocal', 90, { poe: {} }, {}), ['spell_dmg', 0]);
  assert.deepEqual(Cond.daPeca('dmg_inc%corrompidaLocal@ataque', 80, { poe: { corrompido: true } }, {}), ['dmg_inc@ataque', 80]);
  const { traduzirParte } = await import('../systems/itens-poe/traduzir.mjs');
  const t = traduzirParte('Adiciona {0} a {1} de Dano de Gelo aos Ataques com esta Arma a cada {2} de Destreza', [3, 6, 10]);
  assert.notEqual(t.estado, 'registrado');
  assert.deepEqual(t.efeitos.map((e) => e.stat), ['added_ice_dmg_min%atr:dex:10', 'added_ice_dmg_max%atr:dex:10']);
});

test('toda linha que um único pode sortear do pool dele (os implícitos de Síntese da Nebulis, o Corrompido da Corda) tem regra', { skip: SEM }, async () => {
  const { traduzirMod } = await import('../systems/itens-poe/traduzir.mjs');
  const ruins = [];
  for (const c of Object.values(Catalogo.catalogo().classes)) for (const u of c.unicos ?? []) {
    for (const g of u.implicitosSorteados?.grupos ?? []) for (const t of g.tiers) {
      const r = traduzirMod({ modelo: t.modelo, valores: (t.faixas ?? []).map((f) => f[0]) });
      if (r.estado === 'registrado' || (r.partes ?? []).some((p) => p.estado === 'registrado')) ruins.push(`${u.nome}: ${t.modelo}`);
    }
  }
  assert.deepEqual(ruins, []);
});
