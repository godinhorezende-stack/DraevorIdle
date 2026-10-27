// (lote R3B, 27/10) AS PARCIAIS MAIS DIFÍCEIS: as Sentinelas (a Absolvição, a da Inspiração e o Arauto da Pureza como ARAUTO), a Nova da Relíquia Sagrada, o Golpe
// Sagrado como ataque que invoca, o Clamor do General (o Poder com os cadáveres, os Guerreiros Ilusórios com os seus Ataques ligados), o Arqueiro Ilusório e os Espíritos
// Sagrados (usam a SUA habilidade), o Relâmpago Vivo e o Nascido da Colmeia. A fonte é o PoB (act_str.lua, act_int.lua, sup_int.lua, minion.lua, Minions.lua). Os sorteios
// ficam travados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const R3B = await import('../systems/itens-poe/gemas-r3b.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const Terreno = await import('../systems/hunt/terreno.mjs');
const QuemFeriu = await import('../systems/hunt/quem-feriu.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
function travado(v, fn) {
  const antes = Math.random;
  Math.random = typeof v === 'function' ? v : () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
const acao = (s) => G.doSlug(s).acao;
const ef = (slug, nivel = 20, q = 20) => SP.efeitoNoNivel(slug, nivel, q, { tags: ['Magia', 'Ataque', 'Projétil', 'Área', 'Corpo a Corpo', 'Raio', 'Físico', 'Duração', 'Arco', 'Lacaio'].map((x) => `poe:${x}`) }).efeito;
const P = { nome: 'T' };
async function montar(slugs, { arma = 'One_Hand_Swords/Rusted_Sword', nivel = 20, qualidade = 0 } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: slugs.length, links: Array(Math.max(0, slugs.length - 1)).fill(true), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: doSlug(s).itemId, nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < slugs.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: acao(slugs[0]), enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [], evasaoPct: 0 });
  return { e, b, resto };
}
function usar(e, b, v = 0.5) {
  const eventos = [];
  const r = travado(v, () => Acoes.disparar(e, e.hunt, P, 0, b, { manual: true }));
  assert.ok(r.ok, JSON.stringify(r));
  eventos.push(...(r.eventos ?? []));
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(travado(v, () => Acoes.concluirConjuracao(e, e.hunt, P)) ?? [])); }
  return eventos;
}
const lacaiosDe = (e, slug) => (e.hunt.lacaios ?? []).filter((l) => l.gema === slug && l.hp > 0);

test('R3B: o status — as ativas só com a limitação dos lacaios (o Clamor do General sem nada); os suportes sem linha de fora; os números do PoB', { skip: SEM }, () => {
  const st = G.statusNoJogo();
  for (const s of ['Absolution', 'Absolution_of_Inspiring', 'Herald_of_Purity', 'Summon_Holy_Relic', 'Holy_Strike']) {
    assert.ok(st[s].motivos.length === 1 && /^o lacaio ataca do jeito do tipo dele/.test(st[s].motivos[0]), `${s}: ${st[s].motivos.join(' | ')}`);
  }
  assert.equal(st.Generals_Cry.status, 'funciona', st.Generals_Cry.motivos.join(' | '));
  assert.equal(G.doSlug('Herald_of_Purity').arquetipo, 'arauto');
  assert.equal(G.doSlug('Holy_Strike').arquetipo, 'corpo_a_corpo');
  for (const s of ['Mirage_Archer_Support', 'Sacred_Wisps_Support', 'Living_Lightning_Support', 'Hiveborn_Support']) assert.equal(SP.doSlug(s)?.status, 'funciona', `${s}: ${(SP.doSlug(s)?.motivos ?? []).join(' | ')}`);
  const ll = ef('Living_Lightning_Support');
  assert.deepEqual([ll.relampagoVivo, ll.relampagoN, ll.relampagoMax, ll.relampagoMs, ll.relampagoAtaques, ll.relampagoRicochetes, ll.relampagoConvPct, ll.relampagoRecargaMs, ll.relampagoUsos, ll.relampagoNivel], [1, 1, 8, 5000, 5, 3, 100, 200, 5, 70]);
  assert.equal(ef('Living_Lightning_Support', 20, 0).relampagoAtaques, 3, 'sem qualidade: 3 ataques');
  const hb = ef('Hiveborn_Support', 3, 20);
  assert.deepEqual([hb.colmeia, hb.colmeiaN, hb.colmeiaMax, hb.colmeiaMs, hb.colmeiaRaioM, hb.colmeiaGeloPct, hb.colmeiaRecargaMs, hb.colmeiaNivel], [1, 5, 14, 10000, 4.5, 20, 5000, 76]);
  const sw = ef('Sacred_Wisps_Support');
  assert.deepEqual([sw.espiritosSagrados, sw.espiritosN, sw.espiritosMax, sw.espiritosMs, sw.espiritosChance, sw.espiritosChanceRaro, sw.espiritosMenosDanoPct, sw.soVarinha], [1, 2, 2, 10000, 25, 25, 51, 1]);
  const ma = ef('Mirage_Archer_Support');
  assert.deepEqual([ma.arqueiroIlusorio, ma.arqueiroMax, ma.arqueiroMs, ma.arqueiroMenosVelPct, ma.arqueiroMenosDanoPct], [1, 1, 4000, 60, 31]);
  assert.equal(ma.maisDanoPct, undefined, 'o "menos Dano" do Arqueiro não vale mais no SEU uso');
  assert.equal(sw.maisDanoPct, undefined);
});

test('R3B: a Absolvição — a penalidade nos acertados, a chance de 25% no Raro, a Sentinela com a conversão de 50% e a morte com a penalidade (o cadáver consumido; no máximo, renova)', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Absolution']);
  b.raridade = 'raro';
  // 0,3 × 100 = 30 ≥ 25: não convoca no acerto
  usar(e, b, 0.3);
  assert.equal(lacaiosDe(e, 'Absolution').length, 0);
  assert.ok(b.r3bAbsolvicao && b.r3bAbsolvicao.ate === e.hunt.clock + 3000, 'a penalidade de 3 s');
  // 0,1 × 100 = 10 < 25: convoca
  e.hunt.clock += 2000;
  delete e.hunt.cooldowns[acao('Absolution')];
  delete e.hunt.cooldowns[Acoes.GRUPO_DO_POE];
  usar(e, b, 0.1);
  const [s] = lacaiosDe(e, 'Absolution');
  assert.ok(s, 'a Sentinela no Raro');
  assert.equal(s.nome, 'Sentinela da Absolvição');
  assert.equal(s.conversao.energy, 50, 'a Sentinela converte 50% do Físico em Raio');
  assert.ok(Math.max(Math.abs(s.x - b.x), Math.abs(s.y - b.y)) <= 1, 'ao lado do alvo');
  // a morte de um não-Único com a penalidade: o cadáver vira a Sentinela
  const m = resto[0];
  Object.assign(m, { x: e.hunt.pos.x + 2, y: e.hunt.pos.y, hp: 0, raridade: 'normal', r3bAbsolvicao: { ate: e.hunt.clock + 1000, acao: acao('Absolution') } });
  travado(0.5, () => Combate.processarMortes(e, P, []));
  assert.equal(lacaiosDe(e, 'Absolution').length, 2, 'a segunda Sentinela, do cadáver');
  assert.ok(!(e.hunt.cadaveres ?? []).some((c) => c.x === m.x && c.y === m.y && c.key === m.key), 'o cadáver foi consumido');
  // o Único não convoca
  const u = resto[1];
  Object.assign(u, { x: e.hunt.pos.x + 3, y: e.hunt.pos.y, hp: 0, raridade: 'unico', r3bAbsolvicao: { ate: e.hunt.clock + 1000, acao: acao('Absolution') } });
  travado(0.5, () => Combate.processarMortes(e, P, []));
  assert.equal(lacaiosDe(e, 'Absolution').length, 2, 'o Único não vira Sentinela');
  // no máximo (3): renova a que acaba antes
  const terceira = resto[2];
  Object.assign(terceira, { x: e.hunt.pos.x - 2, y: e.hunt.pos.y, hp: 0, raridade: 'normal', r3bAbsolvicao: { ate: e.hunt.clock + 1000, acao: acao('Absolution') } });
  travado(0.5, () => Combate.processarMortes(e, P, []));
  assert.equal(lacaiosDe(e, 'Absolution').length, 3);
  const vivas = lacaiosDe(e, 'Absolution');
  vivas[0].ate -= 5000;
  vivas[0].hp = 1;
  const antes = vivas[0].ate;
  const quarta = resto[3];
  Object.assign(quarta, { x: e.hunt.pos.x - 3, y: e.hunt.pos.y, hp: 0, raridade: 'magico', r3bAbsolvicao: { ate: e.hunt.clock + 1000, acao: acao('Absolution') } });
  travado(0.5, () => Combate.processarMortes(e, P, []));
  assert.equal(lacaiosDe(e, 'Absolution').length, 3, 'no máximo, não convoca outra');
  assert.ok(vivas[0].ate > antes && vivas[0].hp === vivas[0].maxHp, 'renova a duração e a vida da que acabava antes');
  // a penalidade vencida não convoca
  const quinta = resto[4];
  Object.assign(quinta, { x: e.hunt.pos.x - 4, y: e.hunt.pos.y, hp: 0, raridade: 'normal', r3bAbsolvicao: { ate: e.hunt.clock - 1, acao: acao('Absolution') } });
  const ate0 = vivas.map((l) => l.ate);
  travado(0.5, () => Combate.processarMortes(e, P, []));
  assert.deepEqual(lacaiosDe(e, 'Absolution').map((l) => l.ate), ate0);
});

test('R3B: a qualidade da Absolvição — "Lacaios têm Recuperação da Recarga aumentada" vale na Sentinela (o golpe em área dela)', { skip: SEM }, async () => {
  const { e, b } = await montar(['Absolution'], { qualidade: 20 });
  b.raridade = 'raro';
  usar(e, b, 0.1);
  const [s] = lacaiosDe(e, 'Absolution');
  assert.equal(s.poe.recargaPct, 40);
});

test('R3B: o Arauto da Pureza é ARAUTO — o buff (12% mais Dano Físico, a reserva), a Sentinela ao matar, os 20% no Raro e a renovação no máximo', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Herald_of_Purity']);
  usar(e, b);
  const buff = e.hunt.buffs[acao('Herald_of_Purity')];
  assert.equal(buff?.tipo, 'poe-arauto');
  assert.equal(lacaiosDe(e, 'Herald_of_Purity').length, 0, 'ligar o Arauto não convoca');
  assert.equal(G.buffNoNivel('Herald_of_Purity', 20).af.mais_dano_fisico, 12);
  // o abate SEU com o Arauto ligado
  const m = resto[0];
  Object.assign(m, { x: e.hunt.pos.x + 2, y: e.hunt.pos.y, hp: 0 });
  QuemFeriu.carimbar(m, QuemFeriu.VOCE);
  travado(0.5, () => Combate.processarMortes(e, P, []));
  const [s] = lacaiosDe(e, 'Herald_of_Purity');
  assert.ok(s, 'a Sentinela da Pureza');
  assert.equal(s.duracaoMs, 12000);
  // o abate do lacaio não convoca
  const n = resto[1];
  Object.assign(n, { x: e.hunt.pos.x + 3, y: e.hunt.pos.y, hp: 0 });
  QuemFeriu.carimbar(n, QuemFeriu.LACAIO);
  travado(0.5, () => Combate.processarMortes(e, P, []));
  assert.equal(lacaiosDe(e, 'Herald_of_Purity').length, 1);
  // os 20% no Raro (o seu acerto)
  b.raridade = 'raro';
  travado(0.3, () => Acoes.aoAcertarR3B(e, e.hunt, P, { acertados: [b] }));
  assert.equal(lacaiosDe(e, 'Herald_of_Purity').length, 1, '30 ≥ 20: não');
  travado(0.1, () => Acoes.aoAcertarR3B(e, e.hunt, P, { acertados: [b] }));
  assert.equal(lacaiosDe(e, 'Herald_of_Purity').length, 2, '10 < 20: convoca');
  // no máximo (4), renova
  for (let i = 0; i < 2; i++) travado(0.1, () => Acoes.aoAcertarR3B(e, e.hunt, P, { acertados: [b] }));
  assert.equal(lacaiosDe(e, 'Herald_of_Purity').length, 4);
  travado(0.1, () => Acoes.aoAcertarR3B(e, e.hunt, P, { acertados: [b] }));
  assert.equal(lacaiosDe(e, 'Herald_of_Purity').length, 4, 'no máximo, renova');
  // sem o Arauto ligado, nada
  delete e.hunt.buffs[acao('Herald_of_Purity')];
  const ate = lacaiosDe(e, 'Herald_of_Purity').map((l) => l.ate);
  travado(0.1, () => Acoes.aoAcertarR3B(e, e.hunt, P, { acertados: [b] }));
  assert.deepEqual(lacaiosDe(e, 'Herald_of_Purity').map((l) => l.ate), ate);
  // o "Só um Arauto": a Pureza ligada é um Arauto de buff como os outros
  assert.equal(Acoes.arautoExcedente({ clock: 0, buffs: { [acao('Herald_of_Purity')]: { tipo: 'poe-arauto', ate: 1e12, desde: 0 } } }, acao('Herald_of_Purity'), { afPoe: { so_um_arauto: 1 } }), false);
});

test('R3B: a Relíquia Sagrada não ataca; a Nova no seu acerto com ataque — o dano, a recarga de 0,3 s, o Boon em você e nos lacaios (× 1,4 com a qualidade 20)', { skip: SEM }, async () => {
  const { e, b } = await montar(['Summon_Holy_Relic'], { qualidade: 20 });
  usar(e, b);
  const [r] = lacaiosDe(e, 'Summon_Holy_Relic');
  assert.ok(r?.semAtaque, 'a Relíquia não ataca');
  Object.assign(r, { x: e.hunt.pos.x, y: e.hunt.pos.y });
  const outro = { uid: 'z', tipo: 'lacaio', gema: 'x', hp: 10, maxHp: 1e6, x: r.x + 1, y: r.y };
  e.hunt.lacaios.push(outro);
  const nova = R3B.novaDasLinhas(G.textosDaGema('Summon_Holy_Relic', 20).linhas, G.linhasDaQualidadeDe('Summon_Holy_Relic', 20), 20, r.nivel);
  assert.ok(Math.abs(nova.min - R3B.NOVA.base[0] * R3B.eficaciaDaMagia(r.nivel, R3B.NOVA.baseEf, R3B.NOVA.incEf)) < 1e-6);
  assert.equal(nova.raioM, 3);
  assert.equal(nova.efeitoPct, 40);
  const hp0 = b.hp;
  const ev = travado(0, () => Acoes.aoAcertarR3B(e, e.hunt, P, { ataque: true, acertados: [b] }));
  assert.ok(ev.some((x) => x.t === 'dmg' && x.uid === b.uid && x.lacaio), 'a Nova acertou');
  assert.ok(b.hp < hp0);
  assert.ok(Math.abs(e.hunt.poeTemporarios['reliquiaSagrada:life_regen'].valor - 154.6 * 1.4) < 1e-6, 'o Boon em você');
  assert.ok(Math.abs(outro.r3bRegen.porS - 985 * 1.4) < 1e-6, 'o Boon no lacaio');
  // a recarga
  const hp1 = b.hp;
  travado(0, () => Acoes.aoAcertarR3B(e, e.hunt, P, { ataque: true, acertados: [b] }));
  assert.equal(b.hp, hp1, 'na recarga de 0,3 s');
  e.hunt.clock += 300;
  travado(0, () => Acoes.aoAcertarR3B(e, e.hunt, P, { ataque: true, acertados: [b] }));
  assert.ok(b.hp < hp1, 'depois da recarga');
  // a magia não solta a Nova
  e.hunt.clock += 300;
  const hp2 = b.hp;
  travado(0, () => Acoes.aoAcertarR3B(e, e.hunt, P, { ataque: false, acertados: [b] }));
  assert.equal(b.hp, hp2);
  // o tique cura o lacaio pelo tempo que passou
  Acoes.tiqueR3B(e, e.hunt, P, e.hunt.clock);
  Acoes.tiqueR3B(e, e.hunt, P, e.hunt.clock + 1000);
  assert.ok(Math.abs(outro.hp - (10 + 985 * 1.4)) < 1, `cura de 1 s: ${outro.hp}`);
});

test('R3B: o Golpe Sagrado é um ATAQUE — acerta (metade do Físico em Raio) e convoca o Armamento Sagrado ao acertar', { skip: SEM }, async () => {
  const golpe = async (resist) => {
    const m = await montar(['Holy_Strike'], { arma: 'One_Hand_Maces/Driftwood_Club' });
    m.b.resist = resist;
    usar(m.e, m.b);
    return { ...m, dano: 1e12 - m.b.hp };
  };
  const { e, b, dano } = await golpe({});
  assert.ok(dano > 0, 'o golpe acertou');
  // com o alvo resistente a Raio, a metade convertida cai pela resistência (sem a conversão, o golpe todo Físico não mudaria)
  const resistente = await golpe({ energy: 75 });
  assert.ok(resistente.dano < dano * 0.8, `${resistente.dano} × ${dano}`);
  const [a] = lacaiosDe(e, 'Holy_Strike');
  assert.equal(a?.nome, 'Armamento Sagrado');
  assert.equal(a.conversao.energy, 50);
});

test('R3B: o Clamor do General — o Poder com os cadáveres e os Guerreiros Ilusórios usando o Ataque ligado (com o "51% menos Dano")', { skip: SEM }, async () => {
  const { e, b } = await montar(['Generals_Cry', 'Heavy_Strike']);
  b.raridade = 'normal';
  // 1 de Poder do inimigo: nenhum Guerreiro
  let ev = usar(e, b);
  assert.ok(!ev.some((x) => x.t === 'gatilho' && x.suporte === 'Guerreiro Ilusório'));
  // + 4 cadáveres: 5 de Poder → 2 Guerreiros
  e.hunt.cadaveres = Array.from({ length: 4 }, (_, i) => ({ key: 'x', x: e.hunt.pos.x - 1, y: e.hunt.pos.y + i - 1, maxHp: 10 }));
  e.hunt.clock += 10_000;
  e.hunt.cooldowns = {};
  const hp0 = b.hp;
  ev = usar(e, b);
  const guerreiros = ev.filter((x) => x.t === 'gatilho' && x.suporte === 'Guerreiro Ilusório');
  assert.equal(guerreiros.length, 2, JSON.stringify(ev.filter((x) => x.t === 'gatilho')));
  assert.ok(b.hp < hp0, 'os Guerreiros acertaram');
  const g = R3B.guerreirosDasLinhas(G.textosDaGema('Generals_Cry', 20).linhas, G.linhasDaQualidadeDe('Generals_Cry', 20));
  assert.deepEqual([g.porCada, g.cada, g.maximo, g.menosPct], [2, 5, 6, 51]);
  assert.equal(R3B.quantosGuerreiros(g, 30), 6, 'até o máximo (5 + 1 da qualidade 20)');
  assert.equal(R3B.quantosGuerreiros(g, 9), 2);
});

test('R3B: o Arqueiro Ilusório — o acerto com flecha o convoca (máximo 1, 4 s) e ele usa a sua habilidade no tempo ÷ 0,4', { skip: SEM }, async () => {
  const { e, b } = await montar(['Burning_Arrow', 'Mirage_Archer_Support'], { arma: 'Bows/Crude_Bow' });
  usar(e, b);
  const s = e.hunt.poeR3B;
  assert.equal(s?.espelhos?.length, 1);
  assert.equal(s.espelhos[0].ate, e.hunt.clock + 4000);
  // o segundo acerto não convoca outro (o máximo)
  e.hunt.clock += 2000;
  e.hunt.cooldowns = {};
  usar(e, b);
  assert.equal(s.espelhos.length, 1);
  const hp0 = b.hp;
  const ev = travado(0.5, () => Acoes.tiqueR3B(e, e.hunt, P, e.hunt.clock));
  assert.ok(ev.some((x) => x.t === 'gatilho' && x.suporte === 'Arqueiro Ilusório'));
  assert.ok(b.hp < hp0, 'o Arqueiro acertou');
  const uso = Acoes.temposDaGemaPoe(e, Acoes.POR_ID_PUBLICO(acao('Burning_Arrow'))).uso;
  assert.equal(s.espelhos[0].proximoEm, e.hunt.clock + R3B.intervaloDoArqueiro(uso, 60));
  assert.equal(R3B.intervaloDoArqueiro(1000, 60), 2500);
  // o uso dele não convoca outro Arqueiro nem mexe na sua recarga
  assert.equal(s.espelhos.length, 1);
  // vencido, sai
  Acoes.tiqueR3B(e, e.hunt, P, e.hunt.clock + 5000);
  assert.equal(s.espelhos.length, 0);
});

test('R3B: os Espíritos Sagrados — o acerto os convoca (2), o disparo seguinte de cada um sai na chance (25%, +25% com Raro perto), com o "51% menos Dano"; só com Varinha', { skip: SEM }, async () => {
  const { e, b } = await montar(['Power_Siphon', 'Sacred_Wisps_Support'], { arma: 'Wands/Driftwood_Wand' });
  let ev = usar(e, b);
  assert.equal(e.hunt.poeR3B?.espiritos?.length, 2);
  assert.ok(!ev.some((x) => x.t === 'gatilho' && x.suporte === 'Espírito Sagrado'), 'no primeiro uso não havia Espíritos');
  e.hunt.clock += 2000;
  e.hunt.cooldowns = {};
  ev = usar(e, b, 0.3);
  assert.equal(ev.filter((x) => x.t === 'gatilho' && x.suporte === 'Espírito Sagrado').length, 0, '30 ≥ 25: nenhum');
  e.hunt.clock += 2000;
  e.hunt.cooldowns = {};
  b.raridade = 'raro';
  ev = usar(e, b, 0.3);
  assert.equal(ev.filter((x) => x.t === 'gatilho' && x.suporte === 'Espírito Sagrado').length, 2, 'com o Raro na Presença: 30 < 50, os dois');
  assert.equal(R3B.chanceDoEspirito(ef('Sacred_Wisps_Support'), true), 50);
  // só com Varinha
  const m = await montar(['Power_Siphon', 'Sacred_Wisps_Support'], { arma: 'Bows/Crude_Bow' });
  const r = travado(0.5, () => Acoes.disparar(m.e, m.e.hunt, P, 0, m.b, { manual: true }));
  assert.ok(!r.ok);
});

test('R3B: o Relâmpago Vivo — o acerto com Raio o invoca (5 usos de 0,2 s), 100% em Raio, intocável; ataca 5 vezes (qualidade 20), Ricocheteia 3 e some', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Arc', 'Living_Lightning_Support'], { qualidade: 20 });
  usar(e, b);
  const ll = (e.hunt.lacaios ?? []).filter((l) => l.r3bRelampago && l.hp > 0);
  assert.equal(ll.length, 1);
  const l = ll[0];
  assert.deepEqual([l.nome, l.conversao.energy, l.intocavel, l.r3bAtaques, l.r3bRicochetes, l.intervaloMs, l.critChance, l.nivel], ['Relâmpago Vivo', 100, true, 5, 3, 250, 13, 70]);
  // a recarga com 5 usos (0,2 s cada um): 5 saem na hora, o 6º espera a recarga
  const s = {};
  assert.deepEqual(Array.from({ length: 6 }, () => R3B.gastarUso(s, 'r', 200, 5, 1000)), [true, true, true, true, true, false]);
  assert.equal(R3B.gastarUso(s, 'r', 200, 5, 1199), false);
  assert.equal(R3B.gastarUso(s, 'r', 200, 5, 1200), true);
  // o acerto sem Raio não invoca (o Golpe Pesado Físico)
  const fis = await montar(['Heavy_Strike', 'Living_Lightning_Support']);
  usar(fis.e, fis.b);
  assert.equal((fis.e.hunt.lacaios ?? []).filter((x) => x.r3bRelampago).length, 0, 'sem Dano de Raio, nada');
  // o golpe dele: Ricocheteia nos vizinhos e conta os ataques
  e.hunt.lacaios = [l];
  Object.assign(l, { x: b.x - 1, y: b.y, proximoGolpe: 0, r3bAtaques: 1 });
  const [v1, v2] = resto;
  Object.assign(v1, { x: b.x + 1, y: b.y, hp: 1e9, maxHp: 1e9 });
  Object.assign(v2, { x: b.x + 2, y: b.y, hp: 1e9, maxHp: 1e9 });
  const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(e.hunt.huntId)), e.hunt.z);
  const agora = Date.now();
  travado(0.5, () => Cacadas.tiqueDosLacaios(e, e.hunt, null, grade, agora));
  assert.ok(v1.hp < 1e9 && v2.hp < 1e9, 'o golpe Ricocheteou nos dois vizinhos');
  assert.equal(l.r3bAtaques, 0);
  assert.equal(l.ate, agora, 'some depois do último ataque');
  assert.deepEqual(R3B.saltosDoRicochete({ x: 0, y: 0 }, [{ x: 1, y: 0, hp: 1 }, { x: 5, y: 0, hp: 1 }], 3, 2), [{ x: 1, y: 0, hp: 1 }], 'o salto de 2 casas');
});

test('R3B: o Nascido da Colmeia — a Oferenda suportada invoca 5 (nível 76), 10 s, Gelo, com a recarga de 5 s; o Cobrir de Gelo no acerto deles', { skip: SEM }, async () => {
  const { e, b } = await montar(['Bone_Offering', 'Hiveborn_Support'], { nivel: 3 });
  e.hunt.cadaveres = [{ key: 'x', x: e.hunt.pos.x + 1, y: e.hunt.pos.y + 1, maxHp: 10 }];
  // (a Oferenda pede um lacaio em campo)
  e.hunt.lacaios = [{ uid: 'z', tipo: 'lacaio', gema: 'Raise_Zombie', hp: 10, maxHp: 10, x: e.hunt.pos.x - 1, y: e.hunt.pos.y }];
  travado(0.5, () => usar(e, b));
  const nascidos = e.hunt.lacaios.filter((l) => l.r3bColmeia);
  assert.equal(nascidos.length, 5);
  const n = nascidos[0];
  assert.deepEqual([n.nome, n.nivel, n.conversao.ice, n.duracaoMs, n.poe.chances.cobrirGelo], ['Nascido da Colmeia', 76, 100, 10000, 20]);
  // a recarga de 5 s
  e.hunt.cadaveres = [{ key: 'x', x: e.hunt.pos.x + 1, y: e.hunt.pos.y + 1, maxHp: 10 }];
  e.hunt.clock += 1000;
  e.hunt.cooldowns = {};
  travado(0.5, () => usar(e, b));
  assert.equal(e.hunt.lacaios.filter((l) => l.r3bColmeia).length, 5, 'na recarga');
  // o Cobrir de Gelo
  const alvo = { uid: 'g', x: 1, y: 1, hp: 100, maxHp: 100, estados: {}, dots: [] };
  travado(0.1, () => Cacadas.efeitosDoLacaioNoAcerto(e.hunt, n, alvo, 10, 'ice', {}));
  assert.ok(alvo.estados.cobertoGelo?.ate > e.hunt.clock, 'Coberto de Gelo');
});
