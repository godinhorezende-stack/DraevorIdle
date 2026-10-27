// (lote P4, rodada 4 das gemas — dono 27/10: "quero resolver") As parciais e as limitações do idle que sobraram: o Impedimento de Ganho de Almas de todas as Vaal (a
// decisão do dono) e a Tentação Vaal que o troca; o Vínculo Intuitivo (os acertos do aliado vinculado ativam as suas magias ligadas, com o "menos Dano" e a recarga de
// 0,5 s); as Maquinações (o "por fundamental" do poedb pt é "per Keystone" — por keystone alocada); o Infestador (o raio do PoB e a troca à mão); e os Duplos do Golpe
// Duplo Vaal (andam até o inimigo e usam o golpe com a sua força). O Devastador segue parcial: o valor da Área perto do totem não está em fonte nenhuma em disco.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const P4 = await import('../systems/itens-poe/gemas-p4.mjs');
const Vinculos = await import('../systems/itens-poe/vinculos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');

function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
const TAGS = (...t) => ({ tags: t.map((x) => `poe:${x}`) });

/**
 * O personagem com `grupos` de gemas na arma (cada grupo ligado entre si, os grupos sem ligação), as ativas `barra` nos slots, numa caçada do PoE; o primeiro bicho colado
 * e imortal, os outros longe.
 */
async function montar(grupos, { barra = null, arma = 'Wands/Driftwood_Wand', vocacao = 'sorcerer', classe = 'Witch', nivel = 20, level = 90 } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao, level }), { classePoe: classe, sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const slugs = grupos.flat();
  const links = [];
  grupos.forEach((g, gi) => g.forEach((_, i) => { if (links.length < slugs.length - 1) links.push(i < g.length - 1); }));
  a.soquetes = { abertos: slugs.length, links: links.slice(0, Math.max(0, slugs.length - 1)), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: doSlug(s).itemId, nivel, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < slugs.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  (barra ?? [slugs[0]]).forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
  return { e, b };
}
/** Usa a gema do `slot` no alvo (a conjuração concluída), com o sorteio travado; devolve `{ r, eventos, inicio }`. */
function usar(e, alvo, { slot = 0, passo = 60_000, v = 0.5, manual = true } = {}) {
  e.hunt.clock += passo;
  const inicio = e.hunt.clock;
  for (const m of e.hunt.partilha?.naSala ?? []) m.hunt.clock = e.hunt.clock;
  const r = travado(v, () => Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo, { manual }));
  const eventos = [...(r.eventos ?? [])];
  if (r.ok && e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(travado(v, () => Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM)) ?? [])); }
  return { r, eventos, inicio };
}

// ---------------------------------------------------------------- o status

test('P4: o Vínculo Intuitivo, o Infestador, o Golpe Duplo Vaal, a Tentação Vaal e as Maquinações saem de parcial/limitação; o Devastador segue parcial (sem o número)', { skip: SEM }, async () => {
  await montar([['Fireball']]);
  for (const s of ['Intuitive_Link', 'Plague_Bearer', 'Vaal_Double_Strike']) assert.deepEqual([s, G.doSlug(s).statusNoJogo, G.doSlug(s).motivosNoJogo], [s, 'funciona', []]);
  for (const s of ['Vaal_Temptation_Support', 'Machinations_Support']) assert.deepEqual([s, SP.doSlug(s).status, SP.doSlug(s).motivos], [s, 'funciona', []]);
  assert.equal(SP.doSlug('Earthbreaker_Support').status, 'parcial');
  assert.match(SP.doSlug('Earthbreaker_Support').motivos[0], /ancestor_totem_grants_owner_area_of_effect/);
});

// ---------------------------------------------------------------- o Impedimento de Ganho de Almas

test('P4: o Impedimento de Ganho de Almas (as contas) — a recarga das Vaal que carregam anda pelo pedaço não coberto; o fim é um instante só', () => {
  const hunt = { clock: 0 };
  const cds = { a: { ate: 10_000, total: 10_000 }, b: { ate: 3000, total: 5000 }, c: { ate: 500, total: 500 }, x: { ate: 9000, total: 9000 } };
  assert.equal(P4.impedirAlmas(hunt, cds, ['a', 'b', 'c'], 1000, 4000), 4000);
  assert.deepEqual([cds.a.ate, cds.b.ate, cds.c.ate, cds.x.ate], [14_000, 7000, 500, 9000], 'a pronta (c) e a que não é Vaal (x) não mudam');
  assert.equal(hunt.poeAlmasImpedidasAte, 5000);
  // (um segundo impedimento que se sobrepõe: só o pedaço novo — de 5 s a 6 s)
  assert.equal(P4.impedirAlmas(hunt, cds, ['a', 'b'], 2000, 4000), 1000);
  assert.deepEqual([cds.a.ate, cds.b.ate, hunt.poeAlmasImpedidasAte], [15_000, 8000, 6000]);
  // (um mais curto, dentro do anterior: nada)
  assert.equal(P4.impedirAlmas(hunt, cds, ['a'], 3000, 1000), 0);
  assert.ok(P4.almasImpedidas(hunt, 5999) && !P4.almasImpedidas(hunt, 6000));
  P4.limparImpedimento(hunt, 6000);
  assert.equal(hunt.poeAlmasImpedidasAte, undefined, 'vencido, sai da caçada');
  // ("Modificadores à Duração do Efeito de Habilidade também se aplicam à Anulação do Ganho de Almas": × a Duração da Habilidade, só com a linha)
  assert.equal(P4.msDoImpedimento(5000, ['Modificadores à Duração do Efeito de Habilidade também se aplicam à Anulação do Ganho de Almas dessa Habilidade'], 1.5), 7500);
  assert.equal(P4.msDoImpedimento(4000, ['Duração base é de 6 segundos'], 1.5), 4000);
});

test('P4: de ponta a ponta — usar uma Vaal impede o ganho de almas (a recarga das Vaal da barra para pelo impedimento); com a Tentação Vaal não impede e dá o dano', { skip: SEM }, async () => {
  const { e, b } = await montar([['Vaal_Fireball'], ['Vaal_Arc']], { barra: ['Vaal_Fireball', 'Vaal_Arc'] });
  const fb = G.doSlug('Vaal_Fireball').acao;
  const arc = G.doSlug('Vaal_Arc').acao;
  // (o Arco Vaal usado primeiro: a recarga dele carrega; o impedimento dele, 2 s)
  const u1 = usar(e, b, { slot: 1 });
  assert.ok(u1.r.ok, JSON.stringify(u1.r));
  const cdArc = e.hunt.cooldowns[arc];
  assert.equal(cdArc.ate - cdArc.total, e.hunt.poeAlmasImpedidasAte, 'a recarga do Arco começa só no fim do impedimento dele');
  const arcAntes = cdArc.ate;
  // (1 s depois a Bola de Fogo Vaal — impedimento 4 s: a recarga dela começa no fim, e a do Arco, que carregava, para pelo pedaço novo)
  const u2 = usar(e, b, { slot: 0, passo: 3000 });
  assert.ok(u2.r.ok, JSON.stringify(u2.r));
  const cdFb = e.hunt.cooldowns[fb];
  const fimFb = e.hunt.poeAlmasImpedidasAte;
  assert.equal(cdFb.ate - cdFb.total, fimFb);
  assert.equal(e.hunt.cooldowns[arc].ate - arcAntes, 4000, 'o impedimento do Arco já tinha acabado: os 4 s inteiros da Bola de Fogo');
  // (no impedimento, a alma a mais "por Inimigo Estilhaçado" não entra)
  assert.ok(P4.almasImpedidas(e.hunt, e.hunt.clock));

  // a TENTAÇÃO VAAL: a Bola de Fogo Vaal suportada não impede — a recarga começa no uso — e põe o degenerativo pelo tempo do impedimento
  const t = await montar([['Vaal_Fireball', 'Vaal_Temptation_Support']]);
  const ut = usar(t.e, t.b);
  assert.ok(ut.r.ok, JSON.stringify(ut.r));
  assert.equal(t.e.hunt.poeAlmasImpedidasAte, undefined, 'sem impedimento');
  const d = t.e.hunt.efeitosDoJogador?.dots?.find((x) => x.chave === 'tentacaoVaal');
  assert.ok(d, 'o dano da Tentação');
  assert.equal(d.ate - d.desde, 4000, 'pelo tempo do impedimento que ela troca');
});

// ---------------------------------------------------------------- o Vínculo Intuitivo

/** A party: `dono` e a `aliada` na mesma sala, a 2 casas; o bicho colado do dono a 4 casas da aliada (o mais perto dela). */
function party(dono, aliada) {
  const membros = [{ estado: dono, nome: 'Ana' }, { estado: aliada, nome: 'Amiga0' }];
  aliada.hunt.pos = { ...dono.hunt.pos, x: dono.hunt.pos.x + 2 };
  aliada.hunt.z = dono.hunt.z;
  aliada.hunt.clock = dono.hunt.clock;
  for (const m of membros) m.estado.hunt.partilha = { ativa: true, bonus: 1, membros, naSala: membros.map((x) => x.estado) };
  const [b, ...outros] = dono.hunt.monstros;
  for (const o of outros) Object.assign(o, { x: dono.hunt.pos.x + 60, y: dono.hunt.pos.y + 60 });
  Object.assign(b, { x: dono.hunt.pos.x - 2, y: dono.hunt.pos.y, hp: 1e12, maxHp: 1e12 });
  return b;
}
function tique(e, ms = 250) {
  e.hunt.clock += ms;
  for (const m of e.hunt.partilha?.naSala ?? []) if (m !== e) m.hunt.clock = e.hunt.clock;
  return Acoes.tiqueDosVinculos(e, e.hunt, PERSONAGEM, []);
}

test('P4: o Vínculo Intuitivo — o "menos Dano" do nível e o grupo de gatilho das magias ligadas (as Vaal e as Canalizadas fora; recarga 0,5 s)', { skip: SEM }, async () => {
  assert.equal(P4.menosDoIntuitivo(G.textosDaGema('Intuitive_Link', 1).linhas), 44);
  assert.equal(P4.menosDoIntuitivo(G.textosDaGema('Intuitive_Link', 20).linhas), 38);
  assert.equal(Vinculos.daGema(G.textosDaGema('Intuitive_Link', 20).linhas).efeitos.intuitivoMenosPct, 38);
  assert.deepEqual(Vinculos.daGema(G.textosDaGema('Intuitive_Link', 20).linhas).naoFeitas, []);
  const { e } = await montar([['Intuitive_Link', 'Fireball', 'Vaal_Fireball', 'Incinerate']]);
  const g = GS.gruposComGatilho(e).find((x) => x.intuitivo);
  assert.ok(g);
  assert.deepEqual(g.gatilho, { quando: 'intuitivo', recargaMs: 500 });
  assert.deepEqual(g.magias, [G.doSlug('Fireball').acao], 'a Vaal e a Canalizada não são ativadas pelo Vínculo');
  assert.equal(GS.ativadaPor(e, G.doSlug('Fireball').acao), G.doSlug('Intuitive_Link').gema.nome, 'a magia ligada só sai pelo Vínculo');
  // (as contas do acerto visto: o primeiro olhar só guarda)
  assert.deepEqual(P4.acertoDoVinculado(undefined, 500), { dispara: false, visto: 500 });
  assert.deepEqual(P4.acertoDoVinculado(500, 500), { dispara: false, visto: 500 });
  assert.deepEqual(P4.acertoDoVinculado(500, 800), { dispara: true, visto: 800 });
});

test('P4: de ponta a ponta — o acerto da aliada vinculada ativa a Bola de Fogo ligada ao Vínculo Intuitivo, no inimigo perto dela; a recarga de 0,5 s segura o próximo', { skip: SEM }, async () => {
  const { e: ana } = await montar([['Intuitive_Link', 'Fireball']], { nivel: 1 });
  const { e: amiga } = await montar([['Fireball']]);
  const b = party(ana, amiga);
  const r = usar(ana, null);
  assert.ok(r.r.ok, JSON.stringify(r.r));
  const [lk] = Vinculos.vinculos(ana.hunt);
  assert.equal(lk.slug, 'Intuitive_Link');
  assert.equal(lk.efeitos.intuitivoMenosPct, 44);
  // (o primeiro tique só guarda o último acerto dela)
  amiga.hunt.poeRecente = { acertou: amiga.hunt.clock };
  tique(ana);
  const hp0 = b.hp;
  amiga.hunt.poeRecente.acertou = amiga.hunt.clock;
  const ev = travado(0.5, () => tique(ana));
  const g = ev.filter((x) => x.t === 'gatilho');
  assert.deepEqual(g.map((x) => x.suporte), ['Vínculo Intuitivo'], JSON.stringify(ev.slice(0, 6)));
  assert.ok(b.hp < hp0, 'a Bola de Fogo acertou o inimigo perto da aliada');
  // (um acerto novo dela 250 ms depois: a recarga do gatilho segura)
  amiga.hunt.poeRecente.acertou = amiga.hunt.clock;
  assert.equal(travado(0.5, () => tique(ana)).filter((x) => x.t === 'gatilho').length, 0);
  // (passada a recarga, o próximo acerto ativa de novo)
  tique(ana, 500);
  amiga.hunt.poeRecente.acertou = amiga.hunt.clock;
  assert.equal(travado(0.5, () => tique(ana)).filter((x) => x.t === 'gatilho').length, 1);
  // (sem acerto novo, nada)
  assert.equal(travado(0.5, () => tique(ana, 600)).filter((x) => x.t === 'gatilho').length, 0);
});

test('P4: o Vínculo Intuitivo — o "38% menos Dano" do nível 20 vale na magia ativada (a mesma Bola de Fogo, com e sem o menos, no mesmo sorteio)', { skip: SEM }, async () => {
  const { e: ana } = await montar([['Intuitive_Link', 'Fireball']], { nivel: 20 });
  const { e: amiga } = await montar([['Fireball']]);
  const b = party(ana, amiga);
  assert.ok(usar(ana, null).r.ok);
  const danoCom = (menos) => {
    ana.hunt.clock += 1000;
    delete ana.hunt.cooldowns[`gatilho:${GS.gruposComGatilho(ana).find((x) => x.intuitivo).chave}`];
    const hp = b.hp;
    travado(0.5, () => Acoes.ativarGatilhos(ana, ana.hunt, PERSONAGEM, 'intuitivo', { alvo: b, vinculo: G.doSlug('Intuitive_Link').acao, maisAcertoPct: -menos, maisAfeccaoPct: -menos }, []));
    return hp - b.hp;
  };
  const [lk] = Vinculos.vinculos(ana.hunt);
  assert.equal(lk.efeitos.intuitivoMenosPct, 38);
  const cheio = danoCom(0);
  const menos = danoCom(lk.efeitos.intuitivoMenosPct);
  assert.ok(cheio > 0);
  assert.ok(Math.abs(menos / cheio - 0.62) < 0.02, `${cheio} → ${menos}`);
});

// ---------------------------------------------------------------- as Maquinações

test('P4: as Maquinações — "por fundamental" é por keystone alocada: X% do Físico como Caos adicional e 10% de Custo aumentado por keystone', { skip: SEM }, async () => {
  const ef = SP.efeitoNoNivel('Machinations_Support', 3, 0, TAGS('Magia', 'Ataque', 'Físico', 'Caos')).efeito;
  assert.equal(ef.p4CaosPorFundamentalPct, 8);
  assert.equal(ef.p4CustoPorFundamentalPct, 10);
  assert.equal(SP.efeitoNoNivel('Machinations_Support', 1, 0, TAGS('Magia')).efeito.p4CaosPorFundamentalPct, 6);
  const com3 = P4.comAsFundamentais(ef, 3);
  assert.equal(com3['af:phys_as_extra_chaos'], 24);
  assert.equal(com3.custoIncPct, 30);
  assert.equal(P4.comAsFundamentais(ef, 0), ef, 'sem keystone, nada');
  // (de ponta a ponta: o custo da Bola de Fogo suportada sobe 10% com uma keystone alocada — o "aumentado" do custo)
  const { e, b } = await montar([['Fireball', 'Machinations_Support']]);
  const custo = () => { const m = e.mana; const u = usar(e, b); assert.ok(u.r.ok, JSON.stringify(u.r)); return m - e.mana; };
  const sem = custo();
  const arv = P.arvore();
  const alvo = arv.nos.filter((n) => n.tipo === 'keystone' && !n.ascendencia && /^(Iron Reflexes|Unwavering Stance|Iron Grip|Point Blank|Resolute Technique)$/.test(n.nomeEn ?? ''))
    .map((n) => ({ n, c: P.caminhoAte(e, n.id) })).filter((x) => x.c?.length).sort((x, y) => x.c.length - y.c.length)[0];
  assert.ok(alvo, 'há uma keystone ao alcance');
  const antes = alvo.c.slice(0, -1);
  if (antes.length) assert.equal(Comandos.comando(e, { action: 'alocar', ids: antes }).feitos, antes.length);
  assert.ok(Comandos.comando(e, { action: 'alocar', id: alvo.n.id }).ok);
  Ficha.invalidar(e);
  const com = custo();
  assert.ok(Math.abs(com / sem - 1.1) < 0.03, `${sem} → ${com}`);
});

// ---------------------------------------------------------------- o Infestador

test('P4: o Infestador — à mão alterna entre Incubando e Infestando (recarga 0,5 s); o raio é o do PoB (2,5 m + 0,3 m no 20 = 1,4 casa: 1, ou 2 na chance de 40%)', { skip: SEM }, async () => {
  assert.equal(P4.raioDoInfestadorM(0.3), 2.8);
  const p = { modo: 'incubando', valor: 0, recargaAte: 0 };
  assert.equal(P4.alternarPraga(p, 1000).motivo, 'SEM_VALOR');
  p.valor = 500;
  assert.equal(P4.alternarPraga(p, 1000).modo, 'infestando');
  assert.equal(p.inicio, 500);
  assert.equal(P4.alternarPraga(p, 1200).motivo, 'COOLDOWN');
  assert.equal(P4.alternarPraga(p, 1500).modo, 'incubando');
  assert.equal(p.valor, 500, 'o Valor que sobrou fica');

  const { e } = await montar([['Plague_Bearer']]);
  const [b1, b2] = e.hunt.monstros;
  Object.assign(b1, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e9, maxHp: 1e9 });
  Object.assign(b2, { x: e.hunt.pos.x - 2, y: e.hunt.pos.y, hp: 1e9, maxHp: 1e9 });
  // (o primeiro uso à mão: ganha o Incubando)
  assert.equal(e.hunt.praga, undefined);
  const u0 = usar(e, null, { passo: 0 });
  assert.ok(u0.r.ok, JSON.stringify(u0.r));
  assert.equal(e.hunt.praga.modo, 'incubando');
  Acoes.tiqueDaPraga(e, e.hunt, 250);
  assert.equal(usar(e, null, { passo: 0 }).r.motivo, 'SEM_VALOR');
  e.hunt.praga.valor = 1000;
  const u = usar(e, null, { passo: 1000 });
  assert.ok(u.r.ok, JSON.stringify(u.r));
  assert.equal(e.hunt.praga.modo, 'infestando', 'à mão, fora do Valor Máximo');
  // (o raio: na chance de 1 casa só o colado; na de 2, os dois)
  const hp = [b1.hp, b2.hp];
  travado(0.99, () => Acoes.tiqueDaPraga(e, e.hunt, 250));
  assert.ok(b1.hp < hp[0] && b2.hp === hp[1], `1 casa: ${hp} → ${[b1.hp, b2.hp]}`);
  travado(0.1, () => Acoes.tiqueDaPraga(e, e.hunt, 250));
  assert.ok(b2.hp < hp[1], '2 casas na chance');
  // (à mão de novo, depois da recarga: volta a Incubar com o que sobrou)
  const v = e.hunt.praga.valor;
  assert.ok(usar(e, null, { passo: 600 }).r.ok);
  assert.equal(e.hunt.praga.modo, 'incubando');
  assert.equal(e.hunt.praga.valor, v);
  // (o automático da barra continua recusando: a troca sozinha é a do tique)
  assert.equal(usar(e, null, { passo: 600, manual: false }).r.motivo, 'SOZINHA');
});

// ---------------------------------------------------------------- os Duplos do Golpe Duplo Vaal

test('P4: os Duplos do Golpe Duplo Vaal — dois por uso, 6 s, no máximo 8, com o aumento da Velocidade de Movimento; o golpe deles é o seu, sem gastar almas nem impedir', { skip: SEM }, async () => {
  assert.deepEqual(P4.duplosDasLinhas(G.textosDaGema('Vaal_Double_Strike', 20).linhas), { movimentoPct: 57, maximo: 8, duracaoMs: 6000 });
  const { e, b } = await montar([['Vaal_Double_Strike']], { arma: 'One_Hand_Swords/Rusted_Sword', vocacao: 'knight', classe: 'Duelist' });
  const acao = G.doSlug('Vaal_Double_Strike').acao;
  const u = usar(e, b);
  assert.ok(u.r.ok, JSON.stringify(u.r));
  const duplos = () => e.hunt.lacaios.filter((l) => l.p4Duplo === acao && l.hp > 0 && !(l.ate && (e.hunt.ultimoTique ?? 0) >= l.ate));
  assert.equal(duplos().length, 2, 'um por golpe');
  const [d] = duplos();
  assert.equal(d.ate - d.desde, 6000);
  assert.equal(d.poe.movimentoPct, 57);
  assert.ok(d.intocavel);
  assert.ok(Math.max(Math.abs(d.x - e.hunt.pos.x), Math.abs(d.y - e.hunt.pos.y)) <= 1, 'ao seu lado');
  // (o golpe do Duplo: com a sua força, no inimigo colado nele; a sua recarga e o impedimento ficam como estavam; nenhum Duplo novo)
  const cd = { ...e.hunt.cooldowns[acao] };
  const fim = e.hunt.poeAlmasImpedidasAte;
  Object.assign(b, { x: d.x + 1, y: d.y });
  const hp = b.hp;
  const g = travado(0.5, () => Acoes.golpeDoDuploP4(e, e.hunt, PERSONAGEM, d, b));
  assert.ok(b.hp < hp, 'o Duplo acertou');
  assert.ok(g.eventos.some((x) => x.t === 'gatilho' && x.suporte === 'Duplo'));
  assert.ok(g.intervaloMs >= 250);
  assert.deepEqual(e.hunt.cooldowns[acao], cd);
  assert.equal(e.hunt.poeAlmasImpedidasAte, fim);
  assert.equal(duplos().length, 2);
  // (no máximo 8: os mais velhos saem)
  for (let i = 0; i < 4; i++) { Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y }); e.hunt.ultimoTique = (e.hunt.ultimoTique ?? 0) + 1; assert.ok(usar(e, b).r.ok); }
  assert.equal(duplos().length, 8);
  assert.ok(!duplos().includes(d), 'o mais velho saiu');
});
