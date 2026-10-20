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
      // (17/10, lote G2 — o dono: "Monstro a 1 casa") colado: as áreas têm o raio do PoE (o Vórtice, 2,3 m = 1,15 casa), e a 2 casas (4 m) ele
      // só pegava quando sorteava a casa a mais
      Object.assign(h.monstros[0], { hp: Math.max(h.monstros[0].hp, 1e11), maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
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

// (lote A3b, com o aval do dono: o degenerativo do Vórtice é o do CHÃO — D5: só quem está dentro leva, o dano exato pelo tempo, `Acoes.tiqueDosObjetos` —;
// os dois testes medem o chão: o Contagiar segue no acertado, uma instância por gema)
test('Vórtice deixa o dano degenerativo no CHÃO e Contagiar no bicho acertado, uma instância por gema', { skip: SEM }, async () => {
  const { e, bicho, rodar } = await montar(['Vortex', 'Contagion']);
  let chao = null;
  for (let i = 0; i < 12 && !chao; i++) { rodar(1); chao = (e.hunt?.poeObjetos ?? []).find((o) => o.slug === 'Vortex' && o.efeito === 'solo') ?? null; }
  assert.ok(chao, 'o Vórtice deixou o chão');
  assert.equal(chao.partes[0].tipo, 'degenGelo');
  assert.ok(chao.partes[0].porSegundo > 0);
  const dots = bicho().dots ?? [];
  assert.ok(!dots.some((d) => d.tipo === 'degenGelo' && d.chave === 'Vortex'), 'o do Vórtice não fica no acertado');
  const caos = dots.filter((d) => d.tipo === 'degenCaos');
  assert.ok(caos.length <= 1, 'a mesma gema não acumula com ela mesma');
  for (const d of caos) assert.equal(d.chave, 'Contagion');
});

test('o Multiplicador de Dano de Gelo Degenerativo agora age (no dano degenerativo das habilidades de Gelo)', { skip: SEM }, async () => {
  const mod = traduzirParte('+{0}% de Multiplicador de Dano de Gelo Degenerativo', [50]);
  assert.ok(['novo', 'equivalente', 'aproximado'].includes(mod.estado), mod.estado);
  // (lote A3b, com o aval do dono: o dano por segundo do CHÃO do Vórtice — o maior visto em 6 s)
  const maior = async (af) => {
    const m = await montar(['Vortex'], af);
    let v = 0;
    for (let i = 0; i < 6; i++) { m.rodar(1); for (const o of m.e.hunt?.poeObjetos ?? []) if (o.slug === 'Vortex' && o.efeito === 'solo') v = Math.max(v, o.partes[0].porSegundo); }
    return v;
  };
  const sem = await maior({});
  const com = await maior({ dot_multi_cold: 100 });
  assert.ok(sem > 0, 'sem o mod, o Vórtice já degenera');
  assert.ok(Math.abs(com / sem - 2) < 0.05, `+100% de multiplicador: o dobro (${com} / ${sem})`);
});

test('a chance de EMPALAR da gema (Golpe Duplo do Empalamento, Aço Partido… 7 gemas) chega ao acerto: a mesma mecânica de empalamento dos itens e da árvore', { skip: SEM }, async () => {
  const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
  const slug = 'Double_Strike_of_Impaling';
  const chance = G.compilada(slug, 10)?.stats?.chances?.empalar;
  assert.ok(chance > 0, 'a gema tem chance de empalar');
  const ficha = { afPoe: {}, porTag: [] };
  // sem a gema: nada de empalar (era o defeito — a chance da gema não ia a lugar nenhum)
  assert.equal(ModsPoe.valor(ficha, 'chance_empalar'), 0);
  const comGema = G.fichaComAsChancesDaGema(ficha, slug, 10);
  assert.equal(ModsPoe.valor(comGema, 'chance_empalar'), chance);
  // o acerto do motor empala o alvo com essa ficha
  const hunt = { clock: 0 };
  const alvo = { uid: 1, x: 0, y: 0, hp: 1000, maxHp: 1000, estados: {} };
  ModsPoe.aoAcertar({ hp: 100, maxHp: 100, equipment: {} }, hunt, alvo, comGema, { dano: 100, fisico: 100, rng: () => 0, agora: 0 });
  assert.ok(Array.isArray(alvo.estados.empalado) && alvo.estados.empalado.length === 1, JSON.stringify(alvo.estados));
  // e o estado da gema no jogo não diz mais "a chance de empalar ainda não existe"
  assert.ok(!(G.doSlug(slug).motivosNoJogo ?? []).some((m) => /empalar/.test(m)));
  // a ação da gema passa a ficha com a chance ao acerto
  const acoes = (await import('node:fs')).readFileSync(new URL('../systems/acoes.mjs', import.meta.url), 'utf8');
  assert.match(acoes, /GemasPoe\.fichaComAsChancesDaGema\(ficha, entry\.poeGema\.slug/);
});
