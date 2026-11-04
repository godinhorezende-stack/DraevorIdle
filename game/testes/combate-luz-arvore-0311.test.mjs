// COMBATE + LUZ + ÁRVORE (03/11) — os achados confirmados das revisões, pela regra do PoE:
//   - o EMPURRÃO de verdade: o Salto Impactante do Hillock (o poder do poedb) chega ao `Poderes.dispararMagia` com o `empurra` (antes o converter marcava e o
//     `deAtaque` não repassava) — pelo poder registrado do monstro e pelo comportamento do chefe (a área avisada);
//   - o SOLO CONGELADO que você cria (a Harpa de Nuro, a Coroa da Salmoura, o Frasco de Água-marinha): Resfria os MONSTROS nele, com o "Efeito do Solo Congelado
//     aumentado"; a Vida Regenerada "sobre Solo Congelado" (o Passo Natal) com você sobre qualquer um; a nota larga dos solos diz quais ainda não existem;
//   - a ÁRVORE sem nenhum "não se aplica ao jogo" (o Exército Indomável e as Raízes de Kaom retraduzidos);
//   - a sorte do alcance renovada só depois do golpe inteiro;
//   - a LUZ: o "tamanho do Personagem reduzido" (t minúsculo) vale; o Campo de Visão pelo Escudo com o Escudo cheio (`es` null) e sem o máximo ainda; a Glória
//     Dourada pelo tique dos Vínculos (a foto de quem vincula); o frasco de luz só durante o efeito.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const A = await import('../systems/itens-poe/arvore.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Habilidades = await import('../systems/itens-poe/habilidades.mjs');
const Monstros = await import('../systems/itens-poe/monstros.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const Luz = await import('../systems/itens-poe/iluminacao.mjs');
const Vinculos = await import('../systems/itens-poe/vinculos.mjs');
const BossCatalogo = await import('../systems/bosses-unicos/catalogo.mjs');
const Boss = await import('../systems/bosses-unicos/boss.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const { criarMonstro } = await import('../systems/hunt/monstros.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

function travado(v, fn) {
  const antes = Math.random;
  Math.random = typeof v === 'function' ? v : () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const fichaCom = (af) => ({ afPoe: af, eventosPoe: ModsPoe.eventosDa(af) });
const efeitos = (texto, valores) => Object.fromEntries(T.traduzirParte(texto, valores ?? (texto.match(/\{(\d+)\}/g) ?? []).map(() => 15)).efeitos.map((e) => [e.stat, e.valor]));
const HILLOCK = () => Object.values(Monstros.CAMPANHA.areas).flatMap((a) => a.monstros ?? []).find((m) => m.slug === 'Hillock' && m.habilidades?.length);

/** Um personagem forte numa caçada real da campanha (a Praia do Crepúsculo), sem os monstros dela; `af`: o anel com os atributos do PoE. */
function naPraia(af = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { sistema: 'poe', classePoe: 'Marauder' });
  e.equipment = { ...e.equipment, ring: { id: 1, poe: { af } } };
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-twilight-strand', mode: 'auto', strategy: 'nearest' })).ok);
  e.maxHp = e.hp = 1e9;
  e.hunt.monstros.length = 0;
  e.hunt.clock = 100_000;
  return e;
}
/** A grade do combate só com as casas `casas` andáveis (o empurrão confere a casa de destino). */
const grade = (hunt, casas) => ModsPoe.definirGradeDoCombate(hunt, () => ({ andavel: new Set(casas.map(([x, y]) => `${x},${y}`)) }));

// ---------------------------------------------------------------- 1. o empurrão

test('o EMPURRÃO de verdade: o poder do Hillock (Salto Impactante) leva o `empurra` ao `dispararMagia` — você vai uma casa para longe; "Não Pode ser Empurrado" impede', { skip: SEM }, () => {
  const hillock = HILLOCK();
  const key = Monstros.chaveDe(hillock);
  const salto = Poderes.poderesDe(key)?.ataques?.find((a) => a.nome === 'Salto Impactante');
  assert.ok(salto, 'o Salto Impactante nos poderes registrados do Hillock');
  assert.equal(salto.empurra, true, 'o poder leva o empurrão');
  assert.equal(Habilidades.poderes(hillock).find((a) => a.nome === 'Salto Impactante')?.empurra, true);
  // o caminho de verdade: o acerto do poder no jogador
  const rodada = (af) => {
    const e = naPraia(af);
    const h = e.hunt;
    const { x, y } = h.pos;
    const bicho = criarMonstro({ key, x: x - 1, y }, h);
    h.monstros.push(bicho);
    grade(h, [[x, y], [x + 1, y], [x - 1, y]]);
    const eventos = [];
    // (sem esquiva nem bloqueio: o sorteio alto)
    travado(0.99, () => Poderes.dispararMagia({ estado: e, hunt: h, personagem: PERSONAGEM, bicho, eventos, agora: h.clock, ficha: Ficha.combate(e), temEscudo: false }, salto));
    return { e, eventos, x, y };
  };
  const r = rodada({});
  assert.deepEqual([r.e.hunt.pos.x, r.e.hunt.pos.y], [r.x + 1, r.y], 'empurrado uma casa para longe do Hillock');
  assert.ok(r.eventos.some((ev) => ev.estado === 'empurrado'), 'a tela mostra o empurrão');
  const imune = rodada({ imune_empurrao: 1 });
  assert.deepEqual([imune.e.hunt.pos.x, imune.e.hunt.pos.y], [imune.x, imune.y], 'Não Pode ser Empurrado');
  assert.ok(!imune.eventos.some((ev) => ev.estado === 'empurrado'));
});

test('o EMPURRÃO no chefe: o comportamento (a área avisada) do Salto Impactante leva o `empurra` até o golpe — `boss.ataqueDe`', { skip: SEM }, () => {
  const comps = Habilidades.comportamentos(HILLOCK());
  const salto = comps.find((c) => c.tipo === 'area-telegrafada' && c.empurra);
  assert.ok(salto, JSON.stringify(comps));
  const id = 'empurrao-teste-0311';
  const def = BossCatalogo.registrar({ id, nome: 'Hillock de Teste', categoria: 'principal', base: 'cyclops', nivel: 10, atributos: { vida: 1e9 }, melee: { min: 1, max: 1, intervaloMs: 600000 }, comportamentos: [{ ...salto, intervaloMs: 600000 }], fases: [], recompensas: { loot: [], primeiraVitoria: null } });
  try {
    const e = naPraia();
    const h = e.hunt;
    const { x, y } = h.pos;
    const r = Boss.aparecer(h, def, { x: x - 1, y, z: h.z });
    assert.equal(r.ok, true, JSON.stringify(r));
    grade(h, [[x, y], [x + 1, y], [x - 1, y]]);
    r.monstro.boss.proximo.b0 = h.clock; // dispara já
    const eventos = [];
    travado(0.99, () => {
      for (let t = 0; t < 2000; t += 250) { h.clock += 250; eventos.push(...Combate.golpesDosMonstros(e, h, PERSONAGEM)); if (h.pos.x !== x) break; }
    });
    assert.deepEqual([h.pos.x, h.pos.y], [x + 1, y], 'o golpe do chefe empurrou');
    assert.ok(eventos.some((ev) => ev.estado === 'empurrado'));
  } finally { BossCatalogo.esquecer(id); }
});

// ---------------------------------------------------------------- 2. o Solo Congelado

test('o SOLO CONGELADO dos itens: as linhas valem (nenhuma na nota larga dos solos) e a nota larga não diz mais que nenhum solo existe', { skip: SEM }, () => {
  assert.deepEqual(efeitos('{0}% de chance de criar Solo Congelado ao Congelar um Inimigo'), { 'ev:congelar:soloCongelado': 15 });
  assert.deepEqual(efeitos('{0}% de chance de criar Solo Resfriado ao Acertar com um Ataque'), { 'ev:acertar:soloCongelado@ataque': 15 });
  assert.deepEqual(efeitos('Efeito do Solo Congelado aumentado em {0}%', [40]), { solo_congelado_efeito: 40 });
  assert.deepEqual(efeitos('{0}% de Vida Regenerada por segundo sobre Solo Congelado', [2]), { 'life_regen_max_pct@soloCongelado': 2 });
  for (const l of ['{0}% de chance de criar Solo Congelado ao Congelar um Inimigo', '{0}% de chance de criar Solo Resfriado ao Acertar com um Ataque', 'Efeito do Solo Congelado aumentado em {0}%', '{0}% de Vida Regenerada por segundo sobre Solo Congelado', 'Cria Solo Congelado ao Utilizar']) {
    assert.equal(T.traduzirParte(l, [15]).estado, 'novo', l);
  }
  // a linha do modificador de monstro (o solo ao morrer existe no monstro): lembrete, não "não existe"
  assert.equal(T.traduzirParte('Solo Resfriado ao Morrer', []).estado, 'lembrete');
  const larga = T.TABELA.regras.find((r) => r.estado === 'inerte' && /Solo \(\?:Ardente\|Eletrizado\|Congelado\|Profano/.test(r.padrao));
  assert.ok(larga);
  assert.doesNotMatch(larga.nota, /os solos \(ardente, sagrado, fúngico…\) não existem no jogo/);
  assert.match(larga.nota, /Fúngico/);
  assert.match(larga.nota, /Solo Congelado \(o dos monstros e o seu\)/);
});

test('o seu Solo Congelado Resfria os MONSTROS nele (10% × o "Efeito do Solo Congelado aumentado"), não você; o evento ("ao Congelar") cria onde está o inimigo', { skip: SEM }, () => {
  const e = naPraia();
  const h = e.hunt;
  const { x, y } = h.pos;
  const dentro = criarMonstro({ key: 'troll', x: x + 3, y }, h);
  const fora = criarMonstro({ key: 'troll', x: x + 8, y }, h);
  for (const m of [dentro, fora]) Object.assign(m, { hp: 1e9, maxHp: 1e9 });
  h.monstros.push(dentro, fora);
  // a Harpa de Nuro: 100% para o teste; o solo nasce na casa do inimigo Congelado
  const ficha = fichaCom({ 'ev:congelar:soloCongelado': 100, solo_congelado_efeito: 40 });
  ModsPoe.evento(e, h, 'congelar', ficha, { alvo: dentro });
  const solo = (h.areasFrias ?? []).find((a) => a.soloCongelado);
  assert.ok(solo, 'o solo nasceu');
  assert.deepEqual([solo.x, solo.y, solo.raio, solo.ate - h.clock], [x + 3, y, 1, 6000]);
  assert.equal(solo.efeitoPct, 14, '10% × 1,4');
  travado(0.5, () => Cacadas.resfriarNasAreasFrias(h, h.clock, e));
  assert.equal(dentro.estados?.lento?.pct, 14, 'o monstro no solo: Resfriado 14%');
  assert.ok(!(fora.estados?.lento?.ate > h.clock), 'o de fora não');
  assert.ok(!(h.controle?.lento?.ate > h.clock), 'o seu solo não Resfria você');
  // sem a linha do efeito: os 10% do PoE
  const h2 = naPraia().hunt;
  ModsPoe.criarSoloCongelado(h2, fichaCom({}), { x: 1, y: 1 });
  assert.equal(h2.areasFrias.at(-1).efeitoPct, 10);
  // a Coroa da Salmoura: "ao Acertar com um Ataque" — só no golpe com a tag de ataque
  const coroa = fichaCom({ 'ev:acertar:soloCongelado@ataque': 100 });
  const h3 = naPraia().hunt;
  ModsPoe.evento({ hunt: h3 }, h3, 'acertar', coroa, { alvo: { x: 4, y: 4 }, tags: ['magia'] });
  assert.equal((h3.areasFrias ?? []).filter((a) => a.soloCongelado).length, 0, 'a magia não cria');
  ModsPoe.evento({ hunt: h3 }, h3, 'acertar', coroa, { alvo: { x: 4, y: 4 }, tags: ['ataque'] });
  assert.equal((h3.areasFrias ?? []).filter((a) => a.soloCongelado).length, 1, 'o ataque cria');
});

test('"X% de Vida Regenerada por segundo sobre Solo Congelado" (o Passo Natal): vale sobre qualquer Solo Congelado — o do monstro ou o seu — e não fora dele', { skip: SEM }, () => {
  const e = naPraia({ 'life_regen_max_pct@soloCongelado': 2 });
  const h = e.hunt;
  const { x, y } = h.pos;
  const regen = () => { Ficha.invalidar(e); return Ficha.combate(e).afPoe?.life_regen_max_pct ?? 0; };
  const base = regen();
  assert.equal(ModsPoe.noSoloCongelado(h), false);
  assert.ok(!ModsPoe.condicoesDe(e).has('soloCongelado'));
  // o solo do monstro ("Solo Resfriado ao Morrer")
  h.solosDosMonstros = [{ tipo: 'congelado', x, y, z: h.z ?? 0, raio: 1, ate: h.clock + 5000, pct: 10 }];
  assert.equal(ModsPoe.noSoloCongelado(h), true);
  assert.ok(ModsPoe.condicoesDe(e).has('soloCongelado'));
  assert.equal(regen() - base, 2, 'sobre o solo do monstro: +2%');
  // "Inafetado por Solo Congelado" não tira o "sobre" (só o Resfriamento)
  h.solosDosMonstros[0].ate = h.clock - 1;
  assert.equal(regen() - base, 0, 'o solo acabou: nada');
  // o seu solo
  ModsPoe.criarSoloCongelado(h, fichaCom({}), { x: x + 1, y });
  assert.equal(regen() - base, 2, 'sobre o seu solo: +2%');
  h.pos = { ...h.pos, x: x + 5 };
  assert.equal(regen() - base, 0, 'fora dele: nada');
});

test('o FRASCO DE ÁGUA-MARINHA ("Cria Solo Congelado ao Utilizar"): o solo no chão onde você está (3 casas, 5 s) — Resfria quem entra depois, com o efeito aumentado', { skip: SEM }, () => {
  const e = naPraia({ solo_congelado_efeito: 50 });
  const h = e.hunt;
  const { x, y } = h.pos;
  const frasco = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Utility_Flasks/Aquamarine_Flask', raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  Frascos.cinto(e)[0] = frasco;
  assert.equal(Frascos.parametros(frasco).aoUsar?.solo, 'congelado');
  assert.ok(Frascos.usar(e, 0, []));
  const solo = (h.areasFrias ?? []).find((a) => a.soloCongelado);
  assert.ok(solo, 'o solo no chão');
  assert.deepEqual([solo.x, solo.y, solo.raio, solo.ate - h.clock, solo.efeitoPct], [x, y, 3, 5000, 15]);
  // o monstro que ENTRA depois do uso também fica Resfriado (antes: só os de perto na hora)
  const m = criarMonstro({ key: 'troll', x: x + 2, y }, h);
  Object.assign(m, { hp: 1e9, maxHp: 1e9 });
  h.monstros.push(m);
  h.clock += 1000;
  travado(0.5, () => Cacadas.resfriarNasAreasFrias(h, h.clock, e));
  assert.equal(m.estados?.lento?.pct, 15);
  assert.equal(ModsPoe.noSoloCongelado(h), true, 'você está sobre ele');
});

// ---------------------------------------------------------------- 3. a árvore

test('a ÁRVORE sem "não se aplica ao jogo": o Exército Indomável (os lacaios sangram) e as Raízes de Kaom ("Não Pode ser Empurrado") valem', { skip: SEM }, () => {
  const arv = P.arvore();
  const exercito = arv.porId.get('25409');
  const raizes = arv.porId.get('35448');
  assert.ok(exercito.efeitos.some((x) => x.add === 'lacaios_sangrar_andando_sem_extra' && x.valor === 1));
  assert.ok(!exercito.estados.includes('inerte'));
  assert.ok(raizes.efeitos.some((x) => x.add === 'imune_empurrao' && x.valor === 1));
  assert.ok(!raizes.estados.includes('inerte'));
  // a mesma tradução do montar (`A.traduzirLinha`)
  assert.equal(A.traduzirLinha('Não Pode ser Empurrado').estado, 'novo');
  // nenhum "não se aplica ao jogo" nos dados (fora os comentários `_xxx`)
  const semComentarios = (o) => JSON.stringify(o, (k, v) => (k.startsWith('_') ? undefined : v));
  for (const arq of ['arvore-poe.json', 'traducao.json']) {
    const d = JSON.parse(readFileSync(new URL(`../gamedata/itens-poe/${arq}`, import.meta.url), 'utf8'));
    assert.doesNotMatch(semComentarios(d), /não se aplica ao jogo/, arq);
  }
});

// ---------------------------------------------------------------- 4. a sorte do alcance

test('a SORTE DO ALCANCE do golpe básico: renovada uma vez, só depois do golpe inteiro (nenhuma leitura depois da troca)', { skip: SEM }, () => {
  const e = naPraia({ alcance_corpo_m: 1 });
  const h = e.hunt;
  assert.ok(Ficha.combate(e).alcanceCorpoFracao > 0, 'com a fração do alcance');
  const b = criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, h);
  Object.assign(b, { hp: 1e12, maxHp: 1e12 });
  h.monstros.push(b);
  h.alvo = b.uid;
  const log = [];
  let valor = 0.2;
  Object.defineProperty(h, 'poeSorteDoAlcance', { configurable: true, enumerable: true, get() { log.push('ler'); return valor; }, set(v) { log.push('trocar'); valor = v; } });
  const r = travado(0.5, () => Combate.round(e, PERSONAGEM));
  assert.equal(r.bateu, true);
  assert.equal(log.filter((x) => x === 'trocar').length, 1, 'uma troca por golpe');
  assert.equal(log.at(-1), 'trocar', `a troca é a última coisa do golpe: ${log.join(',')}`);
  assert.ok(log.indexOf('ler') >= 0 && log.indexOf('ler') < log.indexOf('trocar'), 'o alcance do golpe leu a sorte antes');
  // sem golpe (o alvo longe): a sorte fica
  log.length = 0;
  Object.assign(b, { x: h.pos.x + 9 });
  travado(0.5, () => Combate.round(e, PERSONAGEM));
  assert.equal(log.filter((x) => x === 'trocar').length, 0);
});

// ---------------------------------------------------------------- 5. a luz

test('o "tamanho do Personagem reduzido em 10%" (o Ninho do Rato, t minúsculo) vale: o desenho a 0,9×', { skip: SEM }, () => {
  const t = T.traduzirParte('tamanho do Personagem reduzido em {0}%', [10]);
  assert.equal(t.estado, 'novo');
  assert.deepEqual(t.efeitos, [{ stat: 'tamanho_personagem', valor: -10 }]);
  assert.equal(Luz.tamanhoDoPersonagem({ tamanho_personagem: -10 }), 0.9);
});

test('o Campo de Visão pelo Escudo: o Escudo cheio (`es` null — a arena) e o máximo que ainda não chegou dão a luz cheia, não o piso', { skip: SEM }, () => {
  const pelo = { luz_pelo_escudo: 1 };
  const { baseCasas, pisoDaVidaPct } = Luz.LUZ;
  assert.equal(Luz.fracaoDaLuz({ hp: 1, maxHp: 100, es: null, maxEsPoe: 300 }, pelo), 1, 'es null = cheio');
  assert.equal(Luz.raioDaLuz({ hp: 1, maxHp: 100, es: null, maxEsPoe: 300 }, pelo), baseCasas);
  assert.equal(Luz.fracaoDaLuz({ hp: 1, maxHp: 100, es: 50 }, pelo), 1, 'sem o máximo ainda: cheia');
  assert.equal(Luz.fracaoDaLuz({ hp: 1, maxHp: 100, es: 150, maxEsPoe: 300 }, pelo), 0.5);
  assert.equal(Luz.raioDaLuz({ hp: 100, maxHp: 100, es: 0, maxEsPoe: 0 }, pelo), baseCasas * pisoDaVidaPct / 100, 'sem Escudo nenhum: o piso, como no PoE');
});

test('a GLÓRIA DOURADA pelo tique dos Vínculos (a foto de quem vincula — `Acoes.tiqueDosVinculos`): o aumentado da luz soma só no mercenário', { skip: SEM }, () => {
  const rodada = (af) => {
    const e = naPraia(af);
    const h = e.hunt;
    h.lacaios = [{ uid: 'm1', nome: 'Mercenário', mercenario: true, hp: 100, maxHp: 100, x: h.pos.x + 1, y: h.pos.y }, { uid: 'z1', nome: 'Zumbi', hp: 100, maxHp: 100, x: h.pos.x - 1, y: h.pos.y }];
    const lk = Vinculos.criar(h, { acao: 'teste', slug: 'Teste', nome: 'Vínculo', props: { efeitos: { critMult: 20 } }, alvos: [{ tipo: 'lacaio', uid: 'm1', mercenario: true }, { tipo: 'lacaio', uid: 'z1' }], duracaoMs: 10_000, custoPorSegundo: 0 });
    Acoes.tiqueDosVinculos(e, h, PERSONAGEM, []);
    const efeito = ModsPoe.valor(Ficha.combate(e), 'efeito_buff_gema:vinculo');
    return { lk, h, efeito };
  };
  const com = rodada({ light_radius: 25, luz_no_vinculo_mercenario: 1 });
  assert.equal(com.lk.foto.luzNoMercenarioPct, Luz.aumentoDaLuz(Ficha.combate(naPraia({ light_radius: 25, luz_no_vinculo_mercenario: 1 })).afPoe));
  const luz = com.lk.foto.luzNoMercenarioPct;
  assert.ok(luz >= 25, `a luz na foto: ${luz}`);
  const arred = (n) => Math.round(n * 100) / 100;
  assert.equal(arred(Vinculos.doLacaio(com.h, { uid: 'm1', mercenario: true }).critMult), arred(20 * (1 + (com.efeito + luz) / 100)), 'no mercenário: com a luz');
  assert.equal(arred(Vinculos.doLacaio(com.h, { uid: 'z1' }).critMult), arred(20 * (1 + com.efeito / 100)), 'no lacaio comum: sem a luz');
  // sem o nó da Glória Dourada: a foto não leva a luz
  const sem = rodada({ light_radius: 25 });
  assert.equal(sem.lk.foto.luzNoMercenarioPct, undefined);
  assert.equal(arred(Vinculos.doLacaio(sem.h, { uid: 'm1', mercenario: true }).critMult), arred(20 * (1 + sem.efeito / 100)));
});

test('o FRASCO de luz ("Raio aumentado em X% durante o Efeito"): a luz só enquanto o efeito dura — na ficha e no raio da tela', { skip: SEM }, () => {
  const e = naPraia();
  const h = e.hunt;
  const frasco = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Utility_Flasks/Quicksilver_Flask', raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  frasco.poe.modificadores = [...(frasco.poe.modificadores ?? []), { modelo: 'Raio aumentado em {0}% durante o Efeito', valores: [25] }];
  Frascos.cinto(e)[0] = frasco;
  const luz = () => { Ficha.invalidar(e); return Number(Ficha.combate(e).afPoe?.light_radius) || 0; };
  const raio = () => Luz.raioDaLuz({ hp: 100, maxHp: 100 }, Ficha.combate(e).afPoe, h);
  const antes = luz();
  const raioAntes = raio();
  assert.ok(Frascos.usar(e, 0, []));
  const dur = Frascos.parametros(frasco).duracaoMs;
  assert.ok(dur > 0);
  assert.equal(luz() - antes, 25, 'durante o efeito: +25%');
  assert.ok(raio() > raioAntes, 'o raio na tela cresce');
  h.clock += dur + 1;
  assert.equal(luz() - antes, 0, 'o efeito acabou: a luz volta');
  assert.equal(raio(), raioAntes);
});
