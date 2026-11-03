// (03/11) As CORREÇÕES da frente "mundo + dados" (a revisão do 100%: os baús do PoE, as Prismáticas e as Tatuagens):
//   - as TATUAGENS (ids 917.001+) são itens do PoE: a caída entra no personagem, na troca, na guilda e no mercado (`so-itens-do-poe.FAIXAS_DO_POE`);
//   - o FOCO DE COMBATE só nos 3 elementos do PoE (Fogo, Gelo, Raio): o "Caos" não gera `raio_prisma_*_chaos`;
//   - os BAÚS do PoE no caminho do idle: a caçada de verdade abre TODOS (o idle vai ao baú mais perto quando nenhum monstro está mais perto, e os baús
//     alcançáveis seguram o CLEAR no automático — `itens-poe/baus-poe.bauMaisPerto`/`seguramOClear`), também de quem ataca de longe;
//   - o lugar dos baús pela SEMENTE da instância; o loot pelo caminho do monstro (o ouro dividido na party, os mapas dentro do mapa);
//   - o clone das Flechas dos Clones Prismáticos: cada flecha num elemento sorteado (sem o proibido pelo Foco de Combate), todo o Físico convertido;
//   - a Tatuagem do Devorador de Corações rodando (o Golpe de Misericórdia consome o cadáver e cura) e o Estandarte/a aura com efeito real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const Jogo = await import('../systems/itens-poe/jogo.mjs');
if (!SEM) Jogo.iniciar(ITEM_CATALOG);
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { traduzirParte } = await import('../systems/itens-poe/traduzir.mjs');
const SoPoe = await import('../systems/itens-poe/so-itens-do-poe.mjs');
const Tatuagens = await import('../systems/passivas/tatuagens.mjs');
const BausPoe = await import('../systems/itens-poe/baus-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Instancia = await import('../systems/hunt/instancia.mjs');
const { acharHunt, gradeDaHunt } = await import('../systems/hunt/terreno.mjs');
const { andarDaGrade } = await import('../systems/hunt/andares.mjs');
const H = await import('../systems/itens-poe/lacaios-habilidades.mjs');
const Prismaticas = await import('../systems/itens-poe/prismaticas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const Ficha = await import('../systems/ficha.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');

const semente = (s = 7) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
function novo({ classe = 'Marauder', arma = 'Two_Hand_Axes/Vaal_Axe', af = null } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 70 }), { sistema: 'poe', classePoe: classe });
  delete e.classe;
  P.garantir(e);
  e.equipment = { weapon: Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 64, rng: () => 0.5 })) };
  if (af) e.equipment.ring = { id: 3357, count: 1, poe: { classe: 'Rings', base: 'Rings/X', af, prefixos: [], sufixos: [], implicitos: [] } };
  e.settings = { ...(e.settings ?? {}), autoSellPouch: false };
  Ficha.invalidar(e);
  return e;
}
const entrar = (e, huntId) => {
  const r = Cacadas.entrar(e, { huntId, mode: 'auto', strategy: 'nearest', dificuldade: 'facil' });
  assert.equal(r.ok, true, `${huntId}: ${r.erro}`);
  return e;
};
const bausDe = (e) => Object.values(Instancia.daSala(e.hunt)?.encontros ?? {}).filter(BausPoe.ehBauPoe);

// ---------------------------------------------------------------- as Tatuagens e o Foco de Combate

test('TATUAGENS: os ids 917.001+ são do PoE — a tatuagem caída entra no personagem (e na troca, na guilda, no mercado)', { skip: SEM }, () => {
  assert.ok(Tatuagens.TATUAGENS.length > 0);
  for (const t of Tatuagens.TATUAGENS) {
    assert.ok(SoPoe.ehDoPoe(t.itemId), `${t.slug} (${t.itemId})`);
    assert.ok(SoPoe.podeEntrar(t.itemId), `${t.slug} (${t.itemId})`);
  }
  assert.ok(!SoPoe.podeEntrar(918_001), 'fora das faixas, não');
});

test('FOCO DE COMBATE: só Fogo, Gelo e Raio (os do PoE) — "Caos" não gera atributo solto', { skip: SEM }, () => {
  const texto = (el) => `Com um total de {0} de Destreza e Força no Raio, Habilidades Prismáticas não podem escolher ${el}`;
  assert.deepEqual(traduzirParte(texto('Raio'), [40]).efeitos, [{ stat: 'raio_prisma_nao_escolhe_energy', valor: 40 }]);
  assert.deepEqual(traduzirParte(texto('Fogo'), [40]).efeitos, [{ stat: 'raio_prisma_nao_escolhe_fire', valor: 40 }]);
  assert.deepEqual(traduzirParte(texto('Gelo'), [40]).efeitos, [{ stat: 'raio_prisma_nao_escolhe_ice', valor: 40 }]);
  const menos = traduzirParte('Com um total de {0} de Força e Inteligência no Raio, Habilidades Prismáticas causam {1}% menos Dano de Gelo', [40, 50]).efeitos;
  assert.deepEqual(menos, [{ stat: 'raio_prisma_menos_ice_limiar', valor: 40 }, { stat: 'raio_prisma_menos_ice', valor: 50 }]);
  for (const t of [traduzirParte(texto('Caos'), [40]), traduzirParte('Com um total de {0} de Destreza no Raio, Habilidades Prismáticas causam {1}% menos Dano de Caos', [40, 50])]) {
    assert.ok(!t.efeitos.some((x) => /raio_prisma_.*chaos/.test(x.stat)), JSON.stringify(t.efeitos));
  }
});

// ---------------------------------------------------------------- os baús no caminho do idle

/** Caça a área de verdade (o tique da caçada, 250 ms por vez) até o CLEAR; o personagem não morre (a vida cheia a cada tique). */
function cacarAteLimpar(e, minutos = 15) {
  const inst = Instancia.daSala(e.hunt);
  const baus = bausDe(e);
  let agora = Date.now();
  e.hunt.ultimoTique = agora;
  for (let t = 0; inst.status === 'ativa' && t < minutos * 240; t++) {
    agora += 250;
    e.hp = e.maxHp ?? e.hp;
    Cacadas.tique(e, PERSONAGEM, agora);
    if (!e.hunt) break;
  }
  return { status: inst.status, baus };
}

for (const [area, arma, distancia] of [
  ['poe-a1-the-coast', 'Two_Hand_Axes/Vaal_Axe', 0],
  ['poe-a1-the-mud-flats', 'Two_Hand_Axes/Vaal_Axe', 0],
  ['poe-a1-the-tidal-island', 'Two_Hand_Axes/Vaal_Axe', 0],
  ['poe-a1-the-ship-graveyard-cave', 'Two_Hand_Axes/Vaal_Axe', 0],
  ['poe-a1-the-coast', 'Bows/Decimation_Bow', 5],
  ['poe-a1-the-tidal-island', 'Bows/Decimation_Bow', 5],
]) {
  test(`BAÚS no caminho: caçando ${area} de verdade (${distancia ? `de longe, a ${distancia} casas` : 'corpo a corpo'}), a sala só fica limpa com TODOS os baús abertos`, { skip: SEM }, () => {
    const e = entrar(novo({ classe: distancia ? 'Ranger' : 'Marauder', arma }), area);
    if (distancia) e.hunt.distancia = distancia;
    const { status, baus } = cacarAteLimpar(e);
    assert.equal(status, 'limpa', 'a sala limpou');
    assert.equal(baus.length, BausPoe.POR_AREA);
    assert.deepEqual(baus.filter((b) => b.estado !== 'concluido').map((b) => `${b.x},${b.y},${b.z}`), [], 'nenhum baú ficou fechado');
  });
}

test('BAÚS seguram o CLEAR só no automático, com o baú alcançável, e no máximo SEGURA_O_CLEAR_MS depois do último monstro', { skip: SEM }, () => {
  const e = entrar(novo(), 'poe-a1-the-coast');
  const h = e.hunt;
  const grade = andarDaGrade(gradeDaHunt(acharHunt(h.huntId)), h.z);
  const [b, ...outros] = bausDe(e);
  for (const o of outros) o.estado = 'concluido';
  b.z = h.z;
  for (const m of [...h.monstros, ...Object.values(h.outrosAndares ?? {}).flat()]) m.hp = 0;
  h.clock = 1000;
  assert.ok(BausPoe.bauMaisPerto(h, grade), 'o baú está ao alcance a pé');
  assert.equal(BausPoe.seguramOClear(e, h, grade), true, 'no automático, segura');
  assert.equal(Instancia.marcarSeLimpou(h, h.clock, { estado: e, personagem: PERSONAGEM, segura: () => BausPoe.seguramOClear(e, h, grade) }), false, 'a sala espera o baú');
  h.modo = 'online';
  assert.equal(BausPoe.seguramOClear(e, h, grade), false, 'na Caça Online (o jogador anda), não segura');
  h.modo = 'auto';
  h.clock += BausPoe.SEGURA_O_CLEAR_MS + 1;
  assert.equal(BausPoe.seguramOClear(e, h, grade), false, 'passado o limite, solta');
  assert.equal(Instancia.marcarSeLimpou(h, h.clock, { estado: e, personagem: PERSONAGEM, segura: () => BausPoe.seguramOClear(e, h, grade) }), true);
  // sem quem segure (o chamador antigo), o CLEAR é o de sempre
  const f = entrar(novo(), 'poe-a1-the-coast');
  for (const m of [...f.hunt.monstros, ...Object.values(f.hunt.outrosAndares ?? {}).flat()]) m.hp = 0;
  assert.equal(Instancia.marcarSeLimpou(f.hunt, 1), true);
});

test('BAÚS: o idle anda até o baú quando nenhum monstro está mais perto (e abre ao chegar)', { skip: SEM }, () => {
  const e = entrar(novo(), 'poe-a1-the-coast');
  const h = e.hunt;
  const [b, ...outros] = bausDe(e);
  for (const o of outros) o.estado = 'concluido';
  // os monstros longe (no fim da área) e o baú a 6 casas, no mesmo andar
  for (const m of h.monstros) m.hp = 0;
  const grade = andarDaGrade(gradeDaHunt(acharHunt(h.huntId)), h.z);
  const casa = [...grade.andavel].map((k) => k.split(',').map(Number)).find(([x, y]) => Math.max(Math.abs(x - h.pos.x), Math.abs(y - h.pos.y)) === 6 && BausPoe.bauMaisPerto({ ...h, pos: { x, y } }, grade));
  assert.ok(casa, 'uma casa andável a 6');
  Object.assign(b, { x: casa[0], y: casa[1], z: h.z });
  let agora = Date.now();
  h.ultimoTique = agora;
  for (let t = 0; t < 80 && b.estado !== 'concluido'; t++) {
    agora += 250;
    Cacadas.tique(e, PERSONAGEM, agora);
  }
  assert.equal(b.estado, 'concluido', 'o idle foi até o baú e ele abriu');
});

test('BAÚS pela SEMENTE da instância: a mesma semente põe os baús nas mesmas casas (sem Math.random)', { skip: SEM }, () => {
  const e = entrar(novo(), 'poe-a1-the-coast');
  const inst = Instancia.daSala(e.hunt);
  assert.ok(Number.isInteger(inst.semente), 'a instância tem a semente');
  const grade = gradeDaHunt(acharHunt(e.hunt.huntId));
  const todos = [...e.hunt.monstros.map((m) => ({ z: e.hunt.z, m })), ...Object.entries(e.hunt.outrosAndares ?? {}).flatMap(([z, l]) => l.map((m) => ({ z: Number(z), m })))];
  const casas = (s) => BausPoe.porNaInstancia({ semente: s, encontros: {} }, { grade, todos }).map((b) => `${b.x},${b.y},${b.z}:${b.raridade}`);
  const original = Math.random;
  try {
    Math.random = () => { throw new Error('Math.random no lugar dos baús'); };
    assert.deepEqual(casas(12345), casas(12345));
  } finally {
    Math.random = original;
  }
  const sementes = [1, 2, 3, 4, 5, 6].map((s) => casas(s).join(' '));
  assert.ok(new Set(sementes).size > 1, 'outra semente, outro lugar');
});

test('BAÚS pagam pelo caminho do monstro: o ouro DIVIDIDO na party e, dentro de um mapa, os MAPAS (pela tabela do monstro da raridade do baú)', { skip: SEM }, async () => {
  // a party: o ouro do baú em partes iguais
  const ana = entrar(novo(), 'poe-a1-the-coast');
  const bia = novo();
  bia.hunt = { sessao: null };
  const membros = [{ estado: ana, nome: 'Ana' }, { estado: bia, nome: 'Bia' }];
  ana.hunt.partilha = { ativa: true, membros };
  const [b] = bausDe(ana);
  const [ouroA, ouroB] = [ana.gold ?? 0, bia.gold ?? 0];
  BausPoe.pagar(ana, ana.hunt, b, semente(9));
  const [ganhoA, ganhoB] = [(ana.gold ?? 0) - ouroA, (bia.gold ?? 0) - ouroB];
  assert.ok(ganhoA > 0 && ganhoB > 0, `as duas ganham (${ganhoA}, ${ganhoB})`);
  assert.ok(Math.abs(ganhoA - ganhoB) <= 1, 'em partes iguais');
  // dentro de um mapa T16: o Grande Baú (a tabela do Único) solta mapas; fora do mapa, nenhum
  const Mapas = await import('../systems/itens-poe/mapas.mjs');
  const IDS_DOS_MAPAS = new Set(Array.from({ length: 16 }, (_, i) => Jogo.idDaBase(Mapas.baseDoTier(i + 1))).filter(Boolean));
  assert.ok(IDS_DOS_MAPAS.size > 0);
  const ehMapa = (id) => IDS_DOS_MAPAS.has(Number(id));
  const mapasEm = (comMapa) => {
    const e = entrar(novo(), 'poe-a1-the-coast');
    if (comMapa) e.hunt.mapa = { id: 'x', tier: 16, nivel: 83, quantidade: 0, raridade: 0, grupo: 0, efeitos: { instancia: {} } };
    let n = 0;
    for (let i = 0; i < 60; i++) n += BausPoe.pagar(e, e.hunt, { raridade: 'grande', nome: 'Grande Baú', nivel: 83 }, semente(100 + i)).filter((x) => ehMapa(x.id)).length;
    return n;
  };
  const mapas = mapasEm(true);
  assert.equal(mapasEm(false), 0, 'fora do mapa, o baú não solta mapa');
  assert.ok(mapas > 0, `o Grande Baú do mapa soltou ${mapas} mapas em 60`);
});

// ---------------------------------------------------------------- os Clones Prismáticos

test('CLONES PRISMÁTICOS: cada flecha do clone sorteia o elemento (sem o proibido pelo Foco de Combate) e converte todo o Físico', { skip: SEM }, () => {
  for (const slug of ['Blink_Arrow_of_Prismatic_Clones', 'Mirror_Arrow_of_Prismatic_Clones']) assert.equal(H.configDaGema(slug)?.prismatica, true, slug);
  assert.equal(H.configDaGema('Blink_Arrow')?.prismatica, undefined, 'a Flecha comum não');
  const l = { habPob: { principal: [{ id: 'BlinkMirrorArrowMelee', tempoMs: 800 }], prismatica: true } };
  const vistos = new Set();
  const rng = semente(3);
  for (let i = 0; i < 60; i++) {
    const h = H.principalDaVez(l, rng, new Set(['fire']));
    assert.ok(Prismaticas.ELEMENTOS.includes(h.elemento) && h.elemento !== 'fire', h.elemento);
    assert.deepEqual(h.conversao, { [h.elemento]: 100 });
    assert.deepEqual(H.partesDaHabilidade(l, h, () => [{ tipo: 'physical', f: 1 }]), [{ tipo: h.elemento, f: 1 }], 'todo o Físico no elemento');
    vistos.add(h.elemento);
  }
  assert.deepEqual([...vistos].sort(), ['energy', 'ice'], 'os dois livres saem');
  // a habilidade da tabela não muda (a conversão é da vez)
  assert.equal(l.habPob.principal[0].conversao, undefined);
});

// ---------------------------------------------------------------- o Devorador de Corações, o Estandarte e a aura

test('DEVORADOR DE CORAÇÕES rodando: o Golpe de Misericórdia consome o cadáver do morto (não fica cadáver) e recupera 10% da Vida', { skip: SEM }, () => {
  const linha = 'ev:golpeDeMisericordia:consumirCadaverChance:hp:10';
  const golpe = (comTatuagem) => {
    const e = entrar(novo({ af: { culling: 1, ...(comTatuagem ? { [linha]: 100 } : {}) } }), 'poe-a1-the-coast');
    const h = e.hunt;
    h.monstros = h.monstros.slice(0, 1);
    const m = h.monstros[0];
    Object.assign(m, { x: h.pos.x + 1, y: h.pos.y, maxHp: 10_000, hp: 500 });
    h.cadaveres = [];
    const ficha = Ficha.combate(e);
    assert.ok(ficha.eventosPoe.some((x) => x.evento === 'golpeDeMisericordia') === comTatuagem);
    e.hp = Math.round((e.maxHp ?? 1000) * 0.5);
    const antes = e.hp;
    ModsPoe.aoAcertar(e, h, m, ficha, { dano: 1, personagem: PERSONAGEM, agora: h.clock ?? 0, eventos: [] });
    assert.equal(m.hp, 0, 'o Golpe de Misericórdia matou (5% da Vida)');
    Combate.processarMortes(e, PERSONAGEM, []);
    return { ganho: e.hp - antes, maxHp: e.maxHp, cadaveres: h.cadaveres.length, devorado: !!m.poeDevorado };
  };
  const sem = golpe(false);
  assert.equal(sem.cadaveres, 1, 'sem a tatuagem, o morto deixa o cadáver');
  assert.equal(sem.devorado, false);
  const com = golpe(true);
  assert.equal(com.devorado, true);
  assert.equal(com.cadaveres, 0, 'com a tatuagem, o cadáver foi consumido');
  assert.ok(com.ganho >= Math.floor(com.maxHp * 0.1) - 1, `recuperou ${com.ganho} de ${com.maxHp}`);
});

test('ESTANDARTE: "Bônus do seu estandarte permanecem por N segundos após você sair da área" — ao sair, o bônus fica N s (sem a linha, acaba na hora)', { skip: SEM }, () => {
  const sair = (af) => {
    const e = novo({ af });
    const ficha = Ficha.combate(e);
    const b = { ate: 1e9, desde: 0, raio: 3, estandarte: { x: 0, y: 0, z: 7 } };
    const h = { clock: 5000, pos: { x: 10, y: 0 }, z: 7, buffs: { banner: b }, monstros: [] };
    ModsPoe.aurasProximas(e, h, ficha, 5000);
    return { ate: b.ate, saiu: b.estandarte.saiu };
  };
  assert.deepEqual(sair(null), { ate: 5000, saiu: 5000 }, 'sem a linha: acaba ao sair');
  assert.deepEqual(sair({ estandarte_fica_s: 3 }), { ate: 8000, saiu: 5000 }, 'com 3 s: fica até 3 s depois');
  // dentro da área nada muda
  const e = novo({ af: { estandarte_fica_s: 3 } });
  const b = { ate: 1e9, desde: 0, raio: 3, estandarte: { x: 0, y: 0, z: 7 } };
  ModsPoe.aurasProximas(e, { clock: 0, pos: { x: 2, y: 0 }, z: 7, buffs: { banner: b }, monstros: [] }, Ficha.combate(e), 0);
  assert.equal(b.ate, 1e9);
});

test('AURA: "Efeito em Área de Habilidades de Aura aumentado" aumenta o raio da aura (não o de outra habilidade) e "Habilidades de Aura Não Maldições têm Duração aumentada" a duração', { skip: SEM }, () => {
  const graca = { id: GemasPoe.doSlug('Grace').acao, poeGema: { slug: 'Grace', arquetipo: 'aura' } };
  const clamor = { id: GemasPoe.doSlug('Enduring_Cry').acao, poeGema: { slug: 'Enduring_Cry', arquetipo: 'clamor' } };
  const base = novo();
  const comArea = novo({ af: { 'area_inc@aura': 300 } });
  assert.equal(Acoes.raioDaAuraDe(base, graca, 4), 4);
  assert.equal(Acoes.raioDaAuraDe(comArea, graca, 4), 8, 'a área ×4 → o raio ×2');
  assert.equal(Acoes.raioDaAuraDe(comArea, clamor, 4), 4, 'o Clamor não é aura');
  const comDuracao = novo({ af: { 'duracao_habilidades@aura': 40 } });
  assert.equal(Acoes.duracaoDasPecas(base, graca), 0);
  assert.equal(Acoes.duracaoDasPecas(comDuracao, graca), 40, 'a duração da aura +40%');
  assert.equal(Acoes.duracaoDasPecas(comDuracao, clamor), 0, 'a do Clamor não');
});
