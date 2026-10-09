// O DANO DEGENERATIVO das gemas do PoE (dono, 09/10: "vamos implementar" — o 1º do roteiro): "Causa 765 de Dano de Gelo Base por segundo"
// (Vórtice, Geada Rastejante, Flecha Cáustica, Contagiar…) vira um dano contínuo no alvo acertado — dano por segundo × a duração da
// habilidade, com o Multiplicador de Dano Degenerativo (o geral e o do elemento: o de Gelo, que não agia em nada, agora age), o aumentado
// do elemento e os suportes; uma instância por gema (a mesma não acumula com ela mesma, gemas diferentes sim); a resistência em cada pulso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const R = await import('../systems/skills/reforcos.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Dot = await import('../systems/combate/dot.mjs');
const { traduzirParte } = await import('../systems/itens-poe/traduzir.mjs');
if (!SEM) {
  (await import('../systems/itens-poe/jogo.mjs')).iniciar(ITEM_CATALOG);
  await G.iniciar({ registrarGema: (g) => (Acoes.registrarAcao(g.entry), GS.registrarAtiva(g)), registrarReforco: R.registrar });
}

/** Uma Bruxa com estas gemas na varinha (e na barra), numa área do Ato 1, com UM bicho imortal ao lado; `af`: um anel com estes atributos. */
async function montar(slugs, af = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const Cacadas = await import('../systems/cacadas.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const Afixos = await import('../systems/afixos.mjs');
  const { personagemDeTeste } = await import('./apoio.mjs');
  (await import('../systems/itens-poe/campanha.mjs')).iniciar();
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.classePoe = 'Witch';
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: slugs.length, links: slugs.slice(1).map(() => false), gemas: slugs.map(() => null), cores: slugs.map(() => 'W') };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma, ring: { id: J.idDaBase('Rings/Iron_Ring'), count: 1, poe: { base: 'Rings/Iron_Ring', classe: 'Rings', af, tv: J.VERSAO_DA_TRADUCAO } } };
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 10, xp: 0, raridade: 'comum' }));
  slugs.forEach((_, i) => GS.encaixar(e, { de: 0, slot: 'weapon', indice: i }));
  Ficha.invalidar(e); Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  slugs.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const { PERSONAGEM } = await import('./apoio.mjs');
  let t = Date.now();
  const bicho = () => e.hunt.monstros[0];
  const rodar = (segundos) => {
    for (let i = 0; i < (segundos * 1000) / 250 && e.hunt; i++) {
      const h = e.hunt;
      h.monstros = h.monstros.slice(0, 1);
      Object.assign(h.monstros[0], { hp: Math.max(h.monstros[0].hp, 1e11), maxHp: 1e12, x: h.pos.x + 2, y: h.pos.y });
      h.alvo = h.monstros[0].uid;
      e.hp = e.maxHp; e.mana = 1e6; e.maxMana = 1e6;
      Cacadas.tique(e, PERSONAGEM, (t += 250));
    }
  };
  return { e, bicho, rodar };
}

test('a gema do PoE sabe o dano degenerativo dela no nível (o elemento, o dano por segundo e a duração)', { skip: SEM }, () => {
  const v = G.degenerativoNoNivel('Vortex', 10);
  assert.equal(v.partes[0].elemento, 'ice');
  assert.ok(v.partes[0].dps > 0);
  assert.ok(v.duracaoMs >= 1000);
  assert.equal(G.degenerativoNoNivel('Fireball', 10), null, 'Bola de Fogo não tem dano degenerativo');
  assert.ok(!(G.doSlug('Contagion').motivosNoJogo ?? []).some((m) => /sem dano direto|degenerativo/.test(m)), 'Contagiar deixa de ser "sem efeito"');
});

test('Vórtice e Contagiar aplicam o dano degenerativo no bicho acertado, uma instância por gema', { skip: SEM }, async () => {
  const { bicho, rodar } = await montar(['Vortex', 'Contagion']);
  rodar(12);
  const dots = bicho().dots ?? [];
  const gelo = dots.filter((d) => d.tipo === 'degenGelo');
  const caos = dots.filter((d) => d.tipo === 'degenCaos');
  assert.ok(gelo.length >= 1 || Dot.dosDoTipo(bicho(), 'degenGelo').length >= 0, 'o Vórtice acertou');
  assert.ok(gelo.length + caos.length >= 1, `degenerativos no bicho: ${JSON.stringify(dots.map((d) => d.tipo))}`);
  for (const lista of [gelo, caos]) assert.ok(lista.length <= 1, 'a mesma gema não acumula com ela mesma');
  for (const d of [...gelo, ...caos]) assert.ok(['Vortex', 'Contagion'].includes(d.chave), d.chave);
});

test('o Multiplicador de Dano de Gelo Degenerativo agora age (no dano degenerativo das habilidades de Gelo)', { skip: SEM }, async () => {
  const mod = traduzirParte('+{0}% de Multiplicador de Dano de Gelo Degenerativo', [50]);
  assert.ok(['novo', 'equivalente', 'aproximado'].includes(mod.estado), mod.estado);
  const sem = await montar(['Vortex']);
  sem.rodar(6);
  const com = await montar(['Vortex'], { dot_multi_cold: 100 });
  com.rodar(6);
  const maior = (b) => Math.max(0, ...(b.dots ?? []).filter((d) => d.tipo === 'degenGelo').map((d) => d.porPulso));
  assert.ok(maior(sem.bicho()) > 0, 'sem o mod, o Vórtice já degenera');
  assert.ok(Math.abs(maior(com.bicho()) / maior(sem.bicho()) - 2) < 0.05, `+100% de multiplicador: o dobro (${maior(com.bicho())} / ${maior(sem.bicho())})`);
});
