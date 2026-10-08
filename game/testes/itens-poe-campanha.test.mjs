// A campanha do PoE convertida (gamedata/itens-poe/campanha-poe.json — tools/montar-campanha-poe.mjs): 10 atos + Epílogo, áreas com mapa
// do Draevor e monstros do PoE, chefes de ato.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HUNT_DE_TESTE } from './apoio.mjs';

const C = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/campanha-poe.json', import.meta.url), 'utf8'));
const CAMPANHA = JSON.parse(readFileSync(new URL('../gamedata/campanha.json', import.meta.url), 'utf8'));

test('C1 — 10 atos + Epílogo; toda área de combate tem mapa do Draevor (de uma hunt da campanha) e monstros do PoE com status', () => {
  assert.equal(C.atos.length, 11);
  assert.equal(C.atos.at(-1).nome, 'Epílogo');
  const huntsDoDraevor = new Set(CAMPANHA.fases.map((f) => f.huntId));
  for (const a of Object.values(C.areas)) {
    if (a.cidade) {
      assert.equal(a.mapa, null);
      continue;
    }
    assert.ok(huntsDoDraevor.has(a.mapa), `${a.nome}: mapa ${a.mapa}`);
    assert.ok(a.monstros.length > 0, `${a.nome}: sem monstros`);
    for (const m of a.monstros) assert.ok(m.vida > 0 && m.dano >= 0 && m.tempoAtaque > 0, `${a.nome}/${m.nome}`);
    for (const c of a.conexoes) assert.ok(C.areas[c], `${a.nome}: conexão ${c}`);
  }
  const prisao = Object.values(C.areas).find((a) => a.nome === 'Prisão Inferior' && a.ato === 1);
  assert.equal(prisao.mapa, 'prison-2', 'a prisão usa o mapa de prisão do Draevor');
});

test('C1 — os 10 chefes de ato com os status de campanha (os 3 que a coleção só traz em nível de mapa, calculados)', () => {
  assert.equal(Object.keys(C.chefes).length, 10);
  for (const ch of Object.values(C.chefes)) assert.ok(ch.monstro?.vida > 0 && ch.monstro.dano > 0, ch.nome);
  assert.equal(C.chefes[1].monstro.vida, 9657, 'Merveil: o valor da coleção');
  assert.ok(C.chefes[2].monstro.calculado && C.chefes[2].monstro.vida > C.chefes[1].monstro.vida && C.chefes[2].monstro.vida < C.chefes[3].monstro.vida, 'Essência dos Vaal entre Merveil e Dominus');
});

test('C2 — os monstros do PoE viram criaturas: status do PoE, desenho do Draevor (pelo nome ou nativo do mapa), golpe e ritmo do PoE', async () => {
  const { execFileSync } = await import('node:child_process');
  const codigo = `
    process.env.ITENS_POE = '1';
    const M = await import('./systems/itens-poe/monstros.mjs');
    const { BESTIARY, criarMonstro } = await import('./systems/hunt/monstros.mjs');
    const { spawnsDaHunt } = await import('./systems/hunt/terreno.mjs');
    const Poderes = await import('./systems/poderes.mjs');
    const Mob = await import('./systems/mobs/atributos.mjs');
    const nativos = (mapa) => [...new Set((spawnsDaHunt(mapa) ?? []).flatMap((s) => (s.criaturas ?? []).map((c) => c.key)))];
    const r = M.iniciar(nativos);
    const costa = M.CAMPANHA.areas['poe-a1-the-twilight-strand'];
    const chaves = r.porArea.get(costa.id);
    const hillock = costa.monstros.find((m) => m.slug === 'Hillock');
    const kH = M.chaveDe(hillock);
    const b = BESTIARY[kH];
    const m = criarMonstro({ key: kH, x: 1, y: 1 }, null);
    const golpes = Array.from({ length: 200 }, () => Poderes.golpeCorpoACorpo(m));
    const caranguejo = Object.values(M.CAMPANHA.areas).flatMap((a) => a.monstros).find((x) => /^Caranguejo/.test(x.nome));
    console.log(JSON.stringify({ total: r.total, chaves: chaves.length, nome: b.name, hp: b.hp, vidaPoe: hillock.vida, exp: b.exp, vel: m.velocidadeDeAtaque, tempo: hillock.tempoAtaque,
      golpeMin: Math.min(...golpes), golpeMax: Math.max(...golpes), dano: hillock.dano, armadura: Mob.armaduraDe(m, 1), armPoe: hillock.armadura,
      desenhoCaranguejo: BESTIARY[M.chaveDe(caranguejo)].look, lookCrab: BESTIARY.crab.look }));
  `;
  const r = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' }).trim().split('\n').pop());
  assert.ok(r.total > 500, `${r.total} criaturas`);
  assert.equal(r.nome, 'Hillock');
  assert.equal(r.hp, r.vidaPoe, 'a vida do PoE, como está');
  assert.ok(Math.abs(r.vel - 2000 / (r.tempo * 1000)) < 0.01, 'o ritmo: o tempo de ataque do PoE');
  assert.ok(r.golpeMin >= Math.round(r.dano * 0.8) && r.golpeMax <= Math.round(r.dano * 1.2), 'o golpe: o dano do PoE ±20%');
  assert.equal(r.armadura, r.armPoe, 'a armadura do PoE, sem a curva do Draevor');
  assert.equal(r.desenhoCaranguejo, r.lookCrab, 'o Caranguejo do PoE usa o desenho do caranguejo do Draevor');
});

test('C3 — a campanha do PoE no lugar da do Draevor: áreas sobre os mapas do Draevor com os monstros do PoE, progressão pelo grafo, chefe de ato, ato seguinte', async () => {
  const { execFileSync } = await import('node:child_process');
  const codigo = `
    process.env.ITENS_POE = '1';
    const PC = await import('./systems/itens-poe/campanha.mjs');
    const r0 = PC.iniciar();
    const Campanha = await import('./systems/campanha.mjs');
    const Cacadas = await import('./systems/cacadas.mjs');
    const { personagemDeTeste } = await import('./testes/apoio.mjs');
    const e = personagemDeTeste({ vocacao: 'knight', level: 20 });
    e.campanha = {};
    const r = { atos: r0.atos, problemas: r0.problemas.length, fases: Campanha.FASES.length, legado: Campanha.FASES.some((f) => f.huntId === 'troll-cave') };
    const ok = Cacadas.entrar(e, { huntId: 'poe-a1-the-twilight-strand', mode: 'auto', dificuldade: 'facil', campanha: true });
    const bichos = [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];
    r.entrou = ok.ok;
    r.soDoPoe = bichos.length > 0 && bichos.every((m) => m.key.startsWith('poe-'));
    r.hillock = bichos.some((m) => m.key === 'poe-hillock-1');
    e.hunt = null;
    r.costaAntes = Campanha.faseLiberada(e, 'facil', 'poe-a1-the-coast');
    const p = (e.campanha.facil ??= { limpezas: {}, completas: [], bosses: [], premios: [] });
    p.completas.push('poe-a1-the-twilight-strand');
    r.costaDepois = Campanha.faseLiberada(e, 'facil', 'poe-a1-the-coast');
    r.chefeAntes = Campanha.bossLiberado(e, 'facil', 1);
    const ato1 = Campanha.FASES.filter((f) => f.ato === 1).map((f) => f.huntId);
    p.completas.push(...ato1);
    r.chefeDepois = Campanha.bossLiberado(e, 'facil', 1);
    r.chefe = Campanha.bossDoAto(1)?.nome;
    r.antesDoChefe = Campanha.ultimaFaseDoAto(1)?.nome;
    r.ato2Antes = Campanha.faseLiberada(e, 'facil', 'poe-a2-the-southern-forest');
    p.bosses.push(1);
    r.ato2Depois = Campanha.faseLiberada(e, 'facil', 'poe-a2-the-southern-forest');
    console.log(JSON.stringify(r));
  `;
  const r = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' }).trim().split('\n').pop());
  assert.deepEqual(r.atos, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.problemas, 0);
  assert.equal(r.fases, Object.values(C.areas).filter((a) => !a.cidade && a.mapa).length, 'uma fase por área de combate');
  assert.equal(r.legado, false, 'a campanha do Draevor saiu');
  assert.ok(r.entrou && r.soDoPoe, 'a Costa do Crepúsculo tem só monstros do PoE');
  assert.ok(r.hillock, 'com o Hillock, o único da área');
  assert.deepEqual([r.costaAntes, r.costaDepois], [false, true], 'a Costa abre depois da Costa do Crepúsculo');
  assert.deepEqual([r.chefeAntes, r.chefeDepois], [false, true]);
  assert.match(r.chefe, /Merveil/);
  if (C.areas['poe-a1-the-cavern-of-anger']) assert.equal(r.antesDoChefe, 'Caverna da Cólera', 'o chefe do Ato 1 vem depois da Caverna da Cólera (a área dele, do poedb)');
  assert.deepEqual([r.ato2Antes, r.ato2Depois], [false, true], 'o Ato 2 abre com a vitória sobre o chefe do Ato 1');
});

test('poedb — as áreas de chefe que faltavam e os chefes de cada área (com habilidades)', { skip: !C.areas['poe-a1-the-cavern-of-anger'] && 'poedb não extraído' }, () => {
  const colera = C.areas['poe-a1-the-cavern-of-anger'];
  assert.ok(colera.doPoedb && colera.conexoes.includes('poe-a1-the-cavern-of-wrath'), 'a Caverna da Cólera entra depois da Caverna da Ira');
  const superior = C.areas['poe-a1-the-upper-prison'];
  assert.ok(superior.monstros.some((m) => m.unico && /Brutus/.test(m.nome)), 'Brutus na Prisão Superior');
  for (const a of Object.values(C.areas)) for (const nome of a.chefes ?? []) {
    if (a.cidade || /Totem/.test(nome)) continue;
    assert.ok(a.monstros.some((m) => m.unico && m.nome === nome), `${a.nome}: ${nome}`);
  }
  assert.ok(C.chefes[1].monstro.habilidades.some((h) => h.dano), 'a Merveil com habilidades (dano no nível)');
});

test('habilidades dos chefes: magia (com elemento), área avisada, invocação; movimento e ataque padrão ficam de fora; dano na proporção do golpe do chefe', async () => {
  const H = await import('../systems/itens-poe/habilidades.mjs');
  const chefe = { dano: 40, habilidades: [
    { nome: 'Ataque Padrão', interno: 'Melee', tags: ['Attack', 'Melee'], dano: { min: 30, max: 50 } },
    { nome: 'Lança', interno: 'IceSpear', tags: ['Spell'], dano: { min: 10, max: 20 }, elemento: 'ice', tempo: 1.5 },
    { nome: 'Salto', interno: 'LeapSlam', tags: ['Attack', 'Area', 'Slam'], dano: { min: 30, max: 50 }, recarga: 7 },
    { nome: 'Teleporte', interno: 'Teleport', tags: ['Spell'] },
    { nome: 'Estátua', interno: 'SummonStatue', tags: ['Spell'], recarga: 10 },
  ] };
  assert.equal(H.fatorDeDano(chefe), 1, 'golpe 40 ÷ ataque padrão (30–50 → 40)');
  const c = H.convertidas(chefe);
  assert.deepEqual(c.map((x) => x.tipo), ['magia', 'area', 'invocar']);
  assert.deepEqual([c[0].elemento, c[0].min, c[0].max], ['ice', Math.round(10 / 0.67), Math.round(20 / 0.67)], 'magia: sem o 33% menos de ataque do Único');
  assert.equal(c[0].intervaloMs, 4500, 'sem recarga: 3× o tempo');
  assert.deepEqual([c[1].min, c[1].max, c[1].intervaloMs, c[1].avisoMs], [30, 50, 7000, 1200]);
  const comp = H.comportamentos(chefe, ['skeleton']);
  assert.deepEqual(comp.map((x) => x.tipo), ['magia', 'area-telegrafada', 'invocar']);
  assert.deepEqual(H.comportamentos(chefe, []).map((x) => x.tipo), ['magia', 'area-telegrafada'], 'sem quem invocar, a invocação sai');
});

test('habilidades no jogo: os chefes de ato têm os comportamentos (validados) e os chefes de área as magias nos poderes', async () => {
  const { execFileSync } = await import('node:child_process');
  const codigo = `
    process.env.ITENS_POE = '1';
    const PC = await import('./systems/itens-poe/campanha.mjs');
    const r0 = PC.iniciar();
    const BU = await import('./systems/bosses-unicos/catalogo.mjs');
    const merveil = BU.bossUnico('poe-chefe-ato-1');
    const M = await import('./systems/itens-poe/monstros.mjs');
    const { BESTIARY } = await import('./systems/hunt/monstros.mjs');
    const comHab = Object.values(M.CAMPANHA.areas).flatMap((a) => a.monstros).find((m) => m.unico && m.habilidades?.some((h) => h.dano && (h.elemento || (h.tags ?? []).includes('Spell'))));
    console.log(JSON.stringify({ problemas: r0.problemas.length, merveil: merveil.comportamentos.map((c) => c.tipo + ':' + c.elemento), unico: comHab?.nome, chave: comHab && M.chaveDe(comHab), tem: !!(comHab && BESTIARY[M.chaveDe(comHab)]) }));
  `;
  const r = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' }).trim().split('\n').pop());
  assert.equal(r.problemas, 0, 'os comportamentos passam na validação dos bosses únicos');
  assert.ok(r.merveil.includes('magia:ice'), `a Merveil com magia de gelo (${r.merveil})`);
  assert.ok(r.tem, `um chefe de área com magia registrado (${r.unico})`);
});

test('ataques e efeitos (aba Mobs): o ajuste valida, liga/desliga e muda a habilidade, cria habilidade nova pela força do golpe e o golpe básico ganha o efeito escolhido', async () => {
  const H = await import('../systems/itens-poe/habilidades.mjs');
  const monstro = { nome: 'Teste', dano: 50, habilidades: [
    { nome: 'Ataque Padrão', interno: 'Melee', tags: ['Attack'], dano: { min: 40, max: 60 } },
    { nome: 'Lança de Gelo', interno: 'IceSpear', tags: ['Spell'], dano: { min: 20, max: 30 }, elemento: 'ice', recarga: 6 },
  ] };
  assert.equal(H.validarAjuste({ habilidades: { 'Lança de Gelo': { forma: 'cubo' } } }).ok, false);
  assert.equal(H.validarAjuste({ basico: { efeito: 0 } }).ok, false);
  assert.equal(H.validarAjuste({ novas: [{ nome: 'X', pctDoGolpe: 0 }] }).ok, false);
  const v = H.validarAjuste({ basico: { efeito: 7 }, habilidades: { 'Lança de Gelo': { forma: 'feixe', efeito: 43, tiro: 12, fatorDano: 2 } }, novas: [{ nome: 'Bola de Fogo', elemento: 'fire', forma: 'area', raio: 2, pctDoGolpe: 150 }] });
  assert.equal(v.ok, true);
  const l = H.comAjuste(monstro, v.ajuste);
  const lanca = l.find((h) => h.nome === 'Lança de Gelo');
  assert.equal(lanca.forma, 'feixe');
  assert.equal(lanca.efeito, 43);
  assert.equal(lanca.tiro, 12);
  const original = H.convertidas(monstro).find((h) => h.nome === 'Lança de Gelo');
  assert.equal(lanca.min, original.min * 2, 'a força multiplica o dano do PoE');
  const nova = l.find((h) => h.nome === 'Bola de Fogo');
  assert.deepEqual([nova.min, nova.max], [60, 90], '150% do golpe 50, ±20%');
  assert.equal(H.comAjuste(monstro, { habilidades: { 'Lança de Gelo': { ativo: false } } }).some((h) => h.nome === 'Lança de Gelo'), false, 'desligada sai');
  const p = H.poderes(monstro, v.ajuste);
  assert.ok(p.some((x) => x.efeito === 43 && x.tiro === 12 && x.forma === 'feixe'), 'os poderes do bicho levam o efeito e o projétil');
  const Poderes = await import('../systems/poderes.mjs');
  Poderes.registrarPoderes('teste-efeito-golpe', { ataques: [{ tipo: 'melee', min: 1, max: 2, intervalo: 1000, chance: 100, efeito: 7 }], curas: [] }, { forcar: true });
  assert.equal(Poderes.efeitoDoGolpe({ key: 'teste-efeito-golpe' }), 7);
  assert.equal(Poderes.efeitoDoGolpe({ key: 'rat-que-nao-existe' }), 1, 'sem ajuste: o sangue de sempre');
});

test('a campanha do PoE é uma passada só: o Cruel e o Merciless não abrem, e a recusa diz isso (não "o boss do Ato 0")', async () => {
  const Cacadas = await import('../systems/cacadas.mjs');
  const { personagemDeTeste } = await import('./apoio.mjs');
  for (const dificuldade of ['medio', 'dificil']) {
    const r = Cacadas.entrar(personagemDeTeste({ level: 30 }), { huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade });
    assert.equal(r.ok, false, dificuldade);
    assert.match(r.erro, /^A campanha do PoE é uma passada só, no .+: o .+ não abre\.$/, r.erro);
    assert.doesNotMatch(r.erro, /Ato 0/);
  }
  assert.equal(Cacadas.entrar(personagemDeTeste({ level: 30 }), { huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade: 'facil' }).ok, true, 'o Normal entra');
});
