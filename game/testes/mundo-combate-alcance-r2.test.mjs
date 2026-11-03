// (03/11) A frente "mundo + combate + alcance", rodada 2:
//   - os BAÚS do PoE no MAPA do endgame depois do CLEAR: o mapa conclui ao limpar (como sempre), mas o idle ainda vai aos baús fechados e
//     alcançáveis do andar (inclusive o perto do último monstro) antes de voltar para a cidade — `itens-poe/baus-poe.seguramASaidaDoMapa`;
//   - "Habilidades Prismáticas causam X% menos Dano de <elemento>" no golpe do clone prismático (as Flechas/o Piscar dos Clones Prismáticos);
//   - o Solo Congelado que você cria: o novo na mesma casa renova o existente, e os seus não expulsam as áreas frias das gemas;
//   - o ALCANCE "suave" (dono, 03/11): a arma dá as casas dela; só os metros A MAIS valem meia casa cada (a fração vira chance).
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
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Dispositivo = await import('../systems/mapas-dispositivo.mjs');
const Instancia = await import('../systems/hunt/instancia.mjs');
const BausPoe = await import('../systems/itens-poe/baus-poe.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const { gradeDaHunt, huntOuMapaCustom } = await import('../systems/hunt/terreno.mjs');
const { andarDaGrade } = await import('../systems/hunt/andares.mjs');
const { bfsDistancias, distancia } = await import('../systems/hunt/caminho.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Condicoes = await import('../systems/itens-poe/condicoes-poe.mjs');
const Combate100 = await import('../systems/itens-poe/combate-100.mjs');
const Prismaticas = await import('../systems/itens-poe/prismaticas.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');

// ---------------------------------------------------------------- 1. os baús no mapa depois do CLEAR

/** O personagem com a campanha vencida (o Dispositivo liberado), vida que não acaba e um Machado Vaal (como em `mapas-endgame.test.mjs`). */
function personagemDeMapa() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ...(e.equipment ?? {}), weapon: Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 64, rng: () => 0.5 })) };
  e.hp = e.maxHp = 1e9;
  for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = Array.from({ length: 10 }, (_, i) => i + 1);
  e.settings = { ...(e.settings ?? {}), autoSellPouch: false };
  Bolsa.garantir(e);
  return e;
}
function abrirMapa(e, peca) {
  e.inventory.push(peca);
  const m = Dispositivo.mapasCarregados(e).find((x) => x.peca === peca);
  return Dispositivo.abrir(e, { onde: m.onde, indice: m.indice, assinatura: m.assinatura, mode: 'auto' });
}

test('BAÚS no MAPA: o mapa conclui ao limpar, e o idle ainda abre os baús fechados do andar (o perto do último monstro também) antes de voltar', { skip: SEM }, () => {
  const e = personagemDeMapa();
  assert.ok(abrirMapa(e, Jogo.mapaSorteado(1, { raridade: 'normal' })).ok);
  const h = e.hunt;
  const inst = Instancia.daSala(h);
  const baus = Object.values(inst.encontros ?? {}).filter(BausPoe.ehBauPoe);
  assert.ok(baus.length >= 3, 'o mapa tem baús');
  const grade = andarDaGrade(gradeDaHunt(huntOuMapaCustom(h.huntId)), h.z);
  const dist = bfsDistancias(grade, h.pos);
  const casas = [...grade.andavel].map((k) => k.split(',').map(Number)).map(([x, y]) => ({ x, y, d: dist.em(x, y) })).filter((c) => c.d != null);
  const dAte = (m) => Math.min(...casas.filter((c) => distancia(c, m) <= 1).map((c) => c.d));
  // o ÚLTIMO monstro: um do seu andar a 6–12 passos; os outros (e os dos outros andares) mortos
  const ultimo = h.monstros.find((m) => m.hp > 0 && dAte(m) >= 6 && dAte(m) <= 12);
  assert.ok(ultimo, 'um monstro no meio do caminho');
  for (const m of [...h.monstros, ...Object.values(h.outrosAndares ?? {}).flat()]) if (m !== ultimo) m.hp = 0;
  // (o personagem de teste fere pouco: o último morre em poucos golpes — o teste é dos baús)
  ultimo.hp = Math.min(ultimo.hp, 20);
  const dUltimo = dAte(ultimo);
  const ocupadas = new Set([`${ultimo.x},${ultimo.y}`]);
  const livre = (c) => !ocupadas.has(`${c.x},${c.y}`) && !h.monstros.some((m) => m.x === c.x && m.y === c.y);
  // o baú PERTO do último monstro (3 casas dele, atrás dele) e dois mais longe que ele (o idle mata o monstro antes — o CLEAR vem com eles fechados)
  const perto = casas.find((c) => distancia(c, ultimo) === 3 && c.d >= dUltimo + 2 && livre(c));
  assert.ok(perto, 'uma casa a 3 do último monstro, atrás dele');
  ocupadas.add(`${perto.x},${perto.y}`);
  const longe = [];
  for (const c of casas) {
    if (longe.length === 2) break;
    if (c.d < dUltimo + 5 || c.d > dUltimo + 10 || distancia(c, ultimo) < 5 || !livre(c) || longe.some((o) => distancia(o, c) < 4)) continue;
    longe.push(c);
    ocupadas.add(`${c.x},${c.y}`);
  }
  assert.equal(longe.length, 2, 'duas casas mais longe que o último monstro');
  const [bPerto, b2, b3, ...resto] = baus;
  for (const [b, c] of [[bPerto, perto], [b2, longe[0]], [b3, longe[1]]]) Object.assign(b, { x: c.x, y: c.y, z: h.z, estado: 'disponivel' });
  for (const b of resto) b.estado = 'concluido';
  const nossos = [bPerto, b2, b3];
  // a caçada de verdade (250 ms por tique) até voltar para a cidade
  let agora = Date.now();
  h.ultimoTique = agora;
  let fechadosNoClear = null;
  for (let t = 0; t < 600 && e.hunt; t++) {
    Cacadas.tique(e, PERSONAGEM, (agora += 250));
    if (fechadosNoClear == null && inst.status === 'limpa') fechadosNoClear = nossos.filter((b) => b.estado !== 'concluido').length;
  }
  assert.equal(inst.status, 'limpa', `o mapa limpou (${e.avisoDaHunt})`);
  assert.equal(e.mapas.concluidos, 1, 'o mapa concluiu ao limpar, como sempre');
  assert.ok(fechadosNoClear >= 2, `no CLEAR ainda havia baús fechados (${fechadosNoClear})`);
  assert.equal(e.hunt, null, 'depois dos baús, a cidade');
  assert.deepEqual(nossos.map((b) => b.estado), ['concluido', 'concluido', 'concluido'], 'todos os baús abertos — o do último monstro também');
});

test('BAÚS no MAPA: a saída espera no máximo SEGURA_A_SAIDA_DO_MAPA_MS depois do aviso, e só no automático', { skip: SEM }, () => {
  const e = personagemDeMapa();
  assert.ok(abrirMapa(e, Jogo.mapaSorteado(1, { raridade: 'normal' })).ok);
  const h = e.hunt;
  const inst = Instancia.daSala(h);
  const grade = andarDaGrade(gradeDaHunt(huntOuMapaCustom(h.huntId)), h.z);
  const [b, ...outros] = Object.values(inst.encontros ?? {}).filter(BausPoe.ehBauPoe);
  for (const o of outros) o.estado = 'concluido';
  b.z = h.z;
  inst.status = 'limpa';
  h.clock = 50_000;
  h.fimEm = 50_000;
  assert.ok(BausPoe.bauMaisPerto(h, grade), 'o baú do mapa limpo ainda é o rumo');
  assert.equal(BausPoe.seguramASaidaDoMapa(e, h, grade), true);
  h.modo = 'online';
  assert.equal(BausPoe.seguramASaidaDoMapa(e, h, grade), false, 'na Caça Online, não espera');
  h.modo = 'auto';
  h.clock = h.fimEm + BausPoe.SEGURA_A_SAIDA_DO_MAPA_MS + 1;
  assert.equal(BausPoe.seguramASaidaDoMapa(e, h, grade), false, 'passado o teto, sai');
  b.estado = 'concluido';
  h.clock = h.fimEm;
  assert.equal(BausPoe.seguramASaidaDoMapa(e, h, grade), false, 'sem baú fechado, sai na hora');
});

// ---------------------------------------------------------------- 3. o seu Solo Congelado e as áreas frias das gemas

test('SOLO CONGELADO: o novo na mesma casa renova o que está lá (não soma), e a enxurrada dos seus não expulsa as áreas frias das gemas', { skip: SEM }, () => {
  const h = { pos: { x: 10, y: 10 }, z: 0, clock: 0, monstros: [] };
  const ficha = { afPoe: {} };
  // as das gemas: o Estalo Gélido Vaal (a carga por segundo) e o Estalo Gélido (a carga ao morrer)
  Condicoes.criarAreaFria(h, { x: 5, y: 5, raioM: 3.6, segundos: 6, agora: 0, porSegundo: 'poder' });
  Condicoes.criarAreaFria(h, { x: 6, y: 6, raioM: 3, segundos: 6, agora: 0, aoMorrer: { tipo: 'frenesi', chance: 25 } });
  // o mesmo solo na mesma casa, 1 s depois: um só, com a duração renovada
  Condicoes.criarSoloCongelado(h, ficha, { x: 20, y: 20, agora: 0 });
  Condicoes.criarSoloCongelado(h, ficha, { x: 20, y: 20, agora: 1000 });
  const naCasa = h.areasFrias.filter((a) => a.soloCongelado && a.x === 20 && a.y === 20);
  assert.equal(naCasa.length, 1, 'um só solo na casa');
  assert.equal(naCasa[0].ate, 1000 + Condicoes.SOLO_CONGELADO_SEU.segundos * 1000, 'a duração renovada');
  // a ENXURRADA (a Coroa da Salmoura: um solo por acerto, em casas diferentes): as áreas das gemas ficam
  for (let i = 0; i < 40; i++) Condicoes.criarSoloCongelado(h, ficha, { x: 30 + i, y: 30, agora: 1000 + i * 50 });
  assert.ok(h.areasFrias.some((a) => a.porSegundo === 'poder'), 'a do Estalo Gélido Vaal ficou');
  assert.ok(h.areasFrias.some((a) => a.aoMorrer?.tipo === 'frenesi'), 'a do Estalo Gélido ficou');
  const solos = h.areasFrias.filter((a) => a.soloCongelado);
  assert.equal(solos.length, Condicoes.AREAS_FRIAS.maximoDeSolos, 'os seus solos no teto deles');
  assert.ok(solos.some((a) => a.x === 69), 'o mais novo ficou');
  // e as gemas no teto delas: 12 áreas novas de gema não tiram os seus solos
  for (let i = 0; i < 14; i++) Condicoes.criarAreaFria(h, { x: 100 + i, y: 5, raioM: 2, segundos: 6, agora: 3000 });
  assert.equal(h.areasFrias.filter((a) => !a.soloCongelado).length, Condicoes.AREAS_FRIAS.maximo);
  assert.equal(h.areasFrias.filter((a) => a.soloCongelado).length, Condicoes.AREAS_FRIAS.maximoDeSolos);
});

// ---------------------------------------------------------------- 4. o alcance "suave" (decisão do dono, 03/11)

test('ALCANCE suave: a arma dá as casas dela; só os metros A MAIS valem meia casa cada (+0,2 m = 10%, +0,9 m = 45%, +2,0 m = +1, +2,4 m = +1 e 20% de +2)', { skip: SEM }, () => {
  const C = Combate100;
  // a conta pura (a espada de 1,1 m: a arma sozinha não fecha casa)
  assert.deepEqual(C.casasDoAlcance(1.1, 0), { inteiras: 0, fracao: 0 }, 'só a arma: como antes, sem chance');
  assert.deepEqual(C.casasDoAlcance(1.1, 0.1), { inteiras: 0, fracao: 0.05 }, '+0,1 m: 5% (antes: 60% — 1,2 m ÷ 2)');
  assert.deepEqual(C.casasDoAlcance(1.1, 0.2), { inteiras: 0, fracao: 0.1 });
  assert.deepEqual(C.casasDoAlcance(1.1, 0.9), { inteiras: 0, fracao: 0.45 });
  assert.deepEqual(C.casasDoAlcance(1.1, 2.0), { inteiras: 1, fracao: 0 });
  assert.deepEqual(C.casasDoAlcance(1.1, 2.4), { inteiras: 1, fracao: 0.2 });
  assert.deepEqual(C.casasDoAlcance(1.3, 2.9), { inteiras: 1, fracao: 0.45 }, 'a arma não soma a fração dela');
  // no personagem de verdade (`Cacadas.alcanceDaArma`, a ficha): a sorte do golpe decide a fração
  const comEspada = (metros, sorte) => {
    const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
    Object.assign(e, { sistema: 'poe', classePoe: 'Duelist' });
    const arma = Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'One_Hand_Swords/Rusted_Sword', raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
    arma.poe.af = { ...(arma.poe.af ?? {}), alcance_corpo_m: metros };
    e.equipment = { weapon: arma };
    e.hunt = { poeSorteDoAlcance: sorte };
    Ficha.invalidar(e);
    assert.equal(Ficha.combate(e).alcanceCorpoM, Math.round((1.1 + metros) * 10) / 10);
    return Cacadas.alcanceDaArma(Cacadas.armaDoPersonagem(e), e);
  };
  for (const [metros, sorte, casas] of [[0.2, 0.05, 2], [0.2, 0.1, 1], [0.9, 0.44, 2], [0.9, 0.45, 1], [2.0, 0.99, 2], [2.4, 0.19, 3], [2.4, 0.2, 2]]) {
    assert.equal(comEspada(metros, sorte), casas, `+${metros} m, sorte ${sorte}: ${casas} casa(s)`);
  }
  // a média: +0,9 m em 1000 golpes, 45% com a casa a mais
  let n = 0;
  for (let i = 0; i < 1000; i++) n += comEspada(0.9, i / 1000) - 1;
  assert.equal(n, 450);
});

// ---------------------------------------------------------------- 2. o "menos" do Foco de Combate no lacaio prismático

test('PRISMÁTICOS: o clone dos Clones Prismáticos e os Esqueletos Magos são lacaios prismáticos (o PoB: RandomElement nos minionSkillTypes); os outros não', { skip: SEM }, () => {
  for (const slug of ['Blink_Arrow_of_Prismatic_Clones', 'Mirror_Arrow_of_Prismatic_Clones']) {
    const q = LacaiosPoe.oQueInvoca(slug, 20, { nivel: 20, qualidade: 0 }, {});
    assert.equal(q?.habPob?.prismatica, true, `${slug}: a invocação de verdade leva a prismática`);
    assert.ok(Prismaticas.ehLacaioPrismatico({ gema: slug, habPob: q.habPob }), slug);
  }
  assert.ok(Prismaticas.ehLacaioPrismatico({ gema: 'Summon_Skeletons_of_Mages' }));
  for (const slug of ['Summon_Skeletons', 'Blink_Arrow', 'Mirror_Arrow', 'Raise_Zombie']) assert.ok(!Prismaticas.ehLacaioPrismatico({ gema: slug, habPob: LacaiosPoe.oQueInvoca(slug, 20, { nivel: 20, qualidade: 0 }, {})?.habPob }), slug);
});

test('PRISMÁTICOS: "Habilidades Prismáticas causam 50% menos Dano de Fogo" vale no golpe do clone prismático e do Esqueleto Mago (só no Fogo; o lacaio comum não)', { skip: SEM }, () => {
  const linha = [{ stat: 'mais_dano_fogo', tags: ['prismatico'], valor: -50 }, { stat: 'mais_dano_gelo', tags: ['prismatico', 'comArco'], valor: -50 }];
  assert.deepEqual(Prismaticas.menosNoLacaioPrismatico({ porTag: linha }), { fire: 0.5, ice: 1, energy: 1 }, 'só a linha com a tag prismática pura');
  // (o que a árvore põe na ficha — `mais_dano_fogo@prismatico` — vira esta linha da `porTag`)
  assert.deepEqual(Prismaticas.menosNoLacaioPrismatico({ porTag: ModsPoe.porTag(personagemDeMapa(), { 'mais_dano_fogo@prismatico': -50 }) }), { fire: 0.5, ice: 1, energy: 1 });
  // o golpe de verdade (`golpeDoLacaioNoBicho`): o mesmo lacaio com e sem a linha, o bicho sem resistência
  const e = personagemDeMapa();
  const fichaDoDono = Ficha.combate(e);
  const golpe = (l, tipo, porTag) => {
    const b = { uid: 'b1', x: 3, y: 3, hp: 1e6, maxHp: 1e6, name: 'Alvo', resist: {} };
    const hunt = { pos: { x: 1, y: 1 }, z: 0, clock: 1000, monstros: [b], lacaios: [l] };
    const c = { estado: e, hunt, personagem: PERSONAGEM, l, ficha: { ...fichaDoDono, porTag }, aliado: null, vinculo: null, oferenda: null, relogio: 1000, agora: 1000, eventos: [] };
    Cacadas.golpeDoLacaioNoBicho(c, b, 100, { partes: [{ tipo, f: 1 }], tipo, magia: true, semCritico: true });
    return 1e6 - b.hp;
  };
  const lacaio = (extra) => ({ uid: 'l1', x: 2, y: 2, hp: 100, maxHp: 100, dano: { min: 1000, max: 1000 }, somado: [0, 0], critChance: 0, critMult: 1.5, ...extra });
  for (const l of [lacaio({ gema: 'Mirror_Arrow_of_Prismatic_Clones', habPob: { principal: [{ id: 'BlinkMirrorArrowMelee' }], prismatica: true } }), lacaio({ gema: 'Summon_Skeletons_of_Mages' })]) {
    const sem = golpe(l, 'fire', []);
    const com = golpe(l, 'fire', linha);
    assert.ok(sem > 0);
    assert.ok(Math.abs(com - sem * 0.5) <= 1, `${l.gema}: Fogo ${sem} → ${com} (50% menos)`);
    assert.equal(golpe(l, 'energy', linha), golpe(l, 'energy', []), `${l.gema}: o Raio não muda`);
  }
  const comum = lacaio({ gema: 'Summon_Skeletons' });
  assert.equal(golpe(comum, 'fire', linha), golpe(comum, 'fire', []), 'o lacaio que não é prismático não sofre o "menos"');
});
