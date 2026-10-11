// A árvore do PoE, as linhas que "não se aplicavam ao jogo" — o lote das MÉDIAS (dono, 11/10: "depois faça os fáceis depois, médios"): o
// Sangramento em movimento e o Agravar, o alcance corpo a corpo em metros, a área e a duração das auras (e a aura dos companheiros de grupo),
// a janela da Retaliação, a Furtividade, os baús abertos ao conjurar e (decisões do dono) o Estandarte PLANTADO e o Sangramento em você. Cada teste aloca o nó REAL pelo servidor e mede onde a linha age.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Dot = await import('../systems/combate/dot.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');
const Monstros = await import('../systems/hunt/monstros.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Mecanicas = await import('../systems/mobs/mecanicas.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

function novo(classe = 'Scion') {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: classe });
  delete e.classe;
  P.garantir(e);
  e.equipment = {};
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  return e;
}
/** O nó (ou a opção de maestria) com um efeito cuja chave casa `re`. */
function achar(re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  const comum = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  if (comum) return { no: comum, valor: comum.efeitos.find((x) => re.test(x.add)).valor };
  for (const n of arv.nos.filter((x) => x.tipo === 'mastery' && !x.ascendencia)) {
    const o = (n.opcoes ?? []).find((x) => tem(x.efeitos));
    if (o) return { no: n, opcao: o.id, valor: o.efeitos.find((x) => re.test(x.add)).valor };
  }
  const asc = arv.nos.find((n) => n.ascendencia && tem(n.efeitos));
  return asc ? { no: asc, asc: true, valor: asc.efeitos.find((x) => re.test(x.add)).valor } : null;
}
function com(re) {
  const achado = achar(re);
  assert.ok(achado, `há nó com ${re}`);
  const { no, opcao } = achado;
  const e = novo(achado.asc ? P.arvore().ascendencias[no.ascendencia].classe : 'Scion');
  if (achado.asc) { e.passivas.ascendencia = no.ascendencia; Comandos.depoisDeMudar(e); assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) }).ok); }
  else {
    const ate = no.tipo === 'mastery' ? P.arvore().nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia).id : no.id;
    const caminho = P.caminhoAte(e, ate);
    const antes = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
    if (antes.length) assert.equal(Comandos.comando(e, { action: 'alocar', ids: antes }).feitos, antes.length);
    assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id, ...(opcao ? { opcao } : {}) }).ok);
  }
  Ficha.invalidar(e);
  const chave = [...(no.efeitos ?? []), ...((no.opcoes ?? []).find((o) => o.id === opcao)?.efeitos ?? [])].find((x) => re.test(x.add ?? '')).add;
  return { e, valor: Number(Ficha.combate(e).afPoe[chave]) || achado.valor, chave };
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const golpe = (e, tags, alvo = null) => ModsPoe.fichaDoGolpe(ficha(e), tags, { estado: e, alvo });
const bicho = (extra = {}) => ({ uid: 9, key: 'rat', name: 'Rato', x: 1, y: 0, hp: 1000, maxHp: 1000, ...extra });

const entrada = (slug) => Acoes.POR_ID_PUBLICO(GemasPoe.doSlug(slug).acao);
/** Um bicho com um Sangramento (2000 a pagar em 4 s); o dano do primeiro pulso. */
function pulso(extra = {}, sangramento = {}) {
  const m = bicho({ uid: 20, hp: 1e6, maxHp: 1e6, ...extra });
  const hunt = { clock: 10000, monstros: [m] };
  Dot.aplicar(m, { tipo: 'sangramento', total: 2000, duracaoMs: 4000, ...sangramento }, 10000);
  const antes = m.hp;
  Dot.tique(hunt, [], 11000);
  return { dano: antes - m.hp, m };
}

test('SANGRAMENTO: o bicho que anda sofre o triplo por pulso ("O Dano é 200% maior enquanto em movimento"); o Agravado, sempre', { skip: SEM }, () => {
  const parado = pulso().dano;
  assert.ok(parado > 0);
  assert.equal(pulso({ andouEm: 10900 }).dano, 3 * parado, 'andou há menos de 1 s');
  assert.equal(pulso({ andouEm: 9000 }).dano, parado, 'andou há mais de 1 s');
  assert.equal(pulso({}, { agravado: true }).dano, 3 * parado, 'Agravado: como se andasse');
  // "Seu Sangramento não causa Dano extra enquanto o Inimigo se move" (a Dança Carmesim): nem andando, nem Agravado
  const { e } = com(/^sangramento_sem_movimento$/);
  assert.equal(ModsPoe.valor(ficha(e), 'sangramento_sem_movimento'), 1);
  const dc = pulso({ andouEm: 10900 }, { semMovimento: true });
  assert.equal(dc.dano, parado);
  assert.equal(Dot.agravar(dc.m, 11000), 0, 'o da Dança Carmesim não se Agrava');
});

test('AGRAVAR: "X% de chance de Agravar o Sangramento em alvos que você Acertar com Ataques"; "… mais antigos que N segundos"', { skip: SEM }, () => {
  const { e, valor } = com(/^chance_agravar@ataque$/);
  assert.ok(valor > 0);
  const sangrando = (desde) => { const m = bicho({ hp: 1e6, maxHp: 1e6 }); Dot.aplicar(m, { tipo: 'sangramento', total: 2000, duracaoMs: 4000 }, desde); return m; };
  const a = sangrando(e.hunt.clock);
  ModsPoe.aoAcertar(e, e.hunt, a, golpe(e, ['ataque', 'corpo']), { dano: 1, rng: () => 0 });
  assert.equal(a.dots[0].agravado, true);
  const m = sangrando(e.hunt.clock);
  ModsPoe.aoAcertar(e, e.hunt, m, golpe(e, ['magia']), { dano: 1, rng: () => 0 });
  assert.ok(!m.dots[0].agravado, 'só com Ataques');
  const v = com(/^agravar_sangramento_apos_s@ataque$/);
  const seg = Number(ficha(v.e).porTag.find((x) => x.stat === 'agravar_sangramento_apos_s')?.valor ?? v.valor);
  const novo1 = sangrando(v.e.hunt.clock - 100);
  const velho = sangrando(v.e.hunt.clock - seg * 1000);
  for (const x of [novo1, velho]) ModsPoe.aoAcertar(v.e, v.e.hunt, x, golpe(v.e, ['ataque', 'corpo']), { dano: 1, rng: () => 0.999 });
  assert.equal(velho.dots[0].agravado, true);
  assert.ok(!novo1.dots[0].agravado, `o de 0,1 s não (só os de ${seg} s ou mais)`);
  // "… que você Golpear com um Crítico com Ataques": só no crítico
  const c = com(/^chance_agravar@ataque\+critico$/);
  const semCrit = sangrando(c.e.hunt.clock);
  ModsPoe.aoAcertar(c.e, c.e.hunt, semCrit, golpe(c.e, ['ataque', 'corpo']), { dano: 1, rng: () => 0 });
  assert.ok(!semCrit.dots[0].agravado, 'sem crítico, não');
  const comCrit = sangrando(c.e.hunt.clock);
  ModsPoe.aoAcertar(c.e, c.e.hunt, comCrit, golpe(c.e, ['ataque', 'corpo']), { dano: 1, crit: true, rng: () => 0 });
  assert.equal(comCrit.dots[0].agravado, true);
  // "… que você Acertar um Ataques Impelidos": só o ataque Impelido (o Clamor)
  const i = com(/^chance_agravar@ataque\+impelido$/);
  const comum = sangrando(i.e.hunt.clock);
  ModsPoe.aoAcertar(i.e, i.e.hunt, comum, golpe(i.e, ['ataque', 'corpo']), { dano: 1, rng: () => 0 });
  assert.ok(!comum.dots[0].agravado, 'sem Impelir, não');
  i.e.hunt.impelidos = { n: 3, ate: i.e.hunt.clock + 20000 };
  const impelido = sangrando(i.e.hunt.clock);
  ModsPoe.aoAcertar(i.e, i.e.hunt, impelido, golpe(i.e, ['ataque', 'corpo']), { dano: 1, rng: () => 0 });
  assert.equal(impelido.dots[0].agravado, true);
  // "Sangramentos que você infligir são Agravados" (a Técnica Irregular do Gladiador): o Sangramento já nasce Agravado
  const t = com(/^sangramento_agravado$/);
  assert.equal(AfeccoesPoe.daSoma(ficha(t.e).afPoe).sangramentoAgravado, true);
  assert.equal(AfeccoesPoe.daSoma(ficha(novo()).afPoe).sangramentoAgravado, false);
});

test('ALCANCE: "+X metros ao Alcance de Golpes Corpo a Corpo" soma em metros (cada 2 m uma casa); "enquanto com ao menos N Inimigos Próximos"', { skip: SEM }, () => {
  const { e, valor } = com(/^alcance_corpo_m$/);
  const m = (x) => Number(ficha(x).afPoe.alcance_corpo_m) || 0;
  assert.ok(Math.abs(m(e) - m(novo()) - valor) < 1e-9);
  const anel = (x, metros) => { x.equipment.ring = { id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id), count: 1, af: [], poe: { af: { alcance_corpo_m: metros } } }; };
  const sem = novo();
  anel(sem, 2 - valor);
  anel(e, 2 - valor);
  assert.equal(ficha(sem).alcanceCorpoExtra, 0);
  assert.equal(ficha(e).alcanceCorpoExtra, 1, 'com o nó, os 2 m fecham uma casa');
  const p = com(/^alcance_corpo_m@inimigosPertoMin:\d+$/);
  const n = Number(p.chave.split(':')[1]);
  const perto = (k) => { p.e.hunt.monstros = Array.from({ length: k }, (_, i) => bicho({ uid: 30 + i, x: 1, y: i % 2 })); return m(p.e); };
  const poucos = perto(n - 1);
  assert.equal(poucos, perto(0), `com ${n - 1} por perto, não vale`);
  assert.ok(Math.abs(perto(n) - poucos - p.valor) < 1e-9, `com ${n} por perto`);
});

test('AURA: "Efeito em Área de Habilidades de Aura aumentado" alarga o raio (o companheiro de grupo a essa distância a recebe); "Duração aumentada" das auras', { skip: SEM }, () => {
  const { e, valor } = com(/^area_inc@aura$/);
  const sem = novo();
  assert.equal(Acoes.raioDaAuraDe(e, entrada('Hatred'), 20), Math.round(20 * Math.sqrt(1 + valor / 100)));
  assert.equal(Acoes.raioDaAuraDe(sem, entrada('Hatred'), 20), 20);
  assert.equal(Acoes.raioDaAuraDe(e, entrada('Cleave'), 20), 20, 'só nas auras');
  // a aura do companheiro vale em você a até o raio dela
  const dono = novo();
  dono.hunt.buffs = { 'poe-gema:Hatred': { ate: 1e9, tipo: 'poe-aura', raio: 3, afPoe: { dmg_inc: 10 } } };
  const eu = novo();
  eu.hunt.partilha = { naSala: [dono, eu] };
  eu.hunt.pos = { x: 3, y: 0 };
  assert.equal(GemasPoe.adds(eu)?.dmg_inc, 10);
  eu.hunt.pos = { x: 4, y: 0 };
  assert.ok(!GemasPoe.adds(eu)?.dmg_inc, 'fora do raio');
  const d = com(/^duracao_habilidades@aura$/);
  assert.equal(Acoes.duracaoDasPecas(d.e, entrada('Vaal_Grace')) - Acoes.duracaoDasPecas(novo(), entrada('Vaal_Grace')), d.valor);
  assert.equal(Acoes.duracaoDasPecas(d.e, entrada('Cleave')), Acoes.duracaoDasPecas(novo(), entrada('Cleave')), 'só nas auras');
});

test('RETALIAÇÃO: só se usa na janela depois de bloquear (ou do Acerto Selvagem); uma vez por gema; "por um tempo X% maior"; "X% de chance de não consumir"; "de outra se tornar Utilizável"', { skip: SEM }, () => {
  assert.equal(GemasPoe.gatilhoDeRetaliacao('Eviscerate'), 'bloquear');
  assert.equal(GemasPoe.gatilhoDeRetaliacao('Vengeful_Cry'), 'selvagem');
  assert.equal(GemasPoe.gatilhoDeRetaliacao('Cleave'), null);
  const h = { clock: 10000 };
  assert.equal(ModsPoe.retaliacaoUsavel(h, 'bloquear', 'Eviscerate'), false, 'sem bloquear, não');
  ModsPoe.abrirRetaliacao(h, 'bloquear', {});
  assert.equal(ModsPoe.retaliacaoUsavel(h, 'bloquear', 'Eviscerate'), true);
  ModsPoe.usarRetaliacao(h, 'bloquear', 'Eviscerate', {}, h.clock, () => 0.999);
  assert.equal(ModsPoe.retaliacaoUsavel(h, 'bloquear', 'Eviscerate'), false, 'uma vez');
  assert.equal(ModsPoe.retaliacaoUsavel(h, 'bloquear', 'Swordstorm'), true, 'a outra ainda pode');
  assert.equal(ModsPoe.retaliacaoUsavel(h, 'bloquear', 'Swordstorm', h.clock + 2000), false, 'acaba em 2 s');
  const j = com(/^retaliacao_janela_inc$/);
  ModsPoe.abrirRetaliacao(j.e.hunt, 'bloquear', ficha(j.e).afPoe);
  assert.equal(j.e.hunt.retaliacao.bloquear.ate, j.e.hunt.clock + 2000 * (1 + j.valor / 100));
  const js = com(/^retaliacao_janela_s$/);
  ModsPoe.abrirRetaliacao(js.e.hunt, 'bloquear', ficha(js.e).afPoe);
  assert.equal(js.e.hunt.retaliacao.bloquear.ate, js.e.hunt.clock + 2000 + 1000 * js.valor);
  const c = com(/^retaliacao_nao_consumir$/);
  ModsPoe.abrirRetaliacao(c.e.hunt, 'bloquear', ficha(c.e).afPoe);
  ModsPoe.usarRetaliacao(c.e.hunt, 'bloquear', 'Eviscerate', ficha(c.e).afPoe, c.e.hunt.clock, () => 0);
  assert.equal(ModsPoe.retaliacaoUsavel(c.e.hunt, 'bloquear', 'Eviscerate'), true, 'não consumiu');
  const o = com(/^retaliacao_outra_chance$/);
  const ho = o.e.hunt;
  ModsPoe.abrirRetaliacao(ho, 'bloquear', ficha(o.e).afPoe);
  const seq = [0.999, 0];
  ModsPoe.usarRetaliacao(ho, 'bloquear', 'Eviscerate', ficha(o.e).afPoe, ho.clock, () => seq.shift());
  assert.equal(ModsPoe.retaliacaoUsavel(ho, 'selvagem', 'Vengeful_Cry'), true, 'a outra se tornou Utilizável');
  assert.equal(ModsPoe.retaliacaoUsavel(ho, 'bloquear', 'Eviscerate'), false, 'a usada, não');
});

/** Um Duelista com a Rusted Sword e a gema `slug` no soquete (a habilidade no slot 1 da barra), na Costa (como em `uma-acao-por-vez-poe`). */
function duelistaCom(slug) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 40 }), { classePoe: 'Duelist' });
  const arma = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'One_Hand_Swords/Rusted_Sword', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  delete e.equipment.shield;
  e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug(slug).itemId, nivel: 10, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GemasPoe.doSlug(slug).acao, enabled: true, minMana: 0, conditions: [] };
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  Object.assign(e, { mana: 1e6, maxMana: 1e6 });
  const h = e.hunt;
  h.monstros = h.monstros.slice(0, 1);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
  return { e, h, alvo: h.monstros[0] };
}

test('RETALIAÇÃO na barra: sem bloquear, recusada (RETALIACAO); depois do bloqueio sai uma vez; "Cada quarta Habilidade de Retaliação … sempre será um Golpe Crítico"', { skip: SEM }, () => {
  const { e, h, alvo } = duelistaCom('Eviscerate');
  const r0 = Acoes.disparar(e, h, PERSONAGEM, 0, alvo);
  assert.deepEqual([r0.ok, r0.motivo], [false, 'RETALIACAO']);
  ModsPoe.abrirRetaliacao(h, 'bloquear', ficha(e).afPoe);
  const r1 = Acoes.disparar(e, h, PERSONAGEM, 0, alvo);
  assert.equal(r1.ok, true, r1.erro);
  assert.equal(ModsPoe.retaliacaoUsavel(h, 'bloquear', 'Eviscerate'), false, 'gastou o uso da janela');
  assert.equal(h.retaliacaoUsos, 1);
  // a quarta: crítico garantido (com a linha — num anel, como a "Retaliação Cruel" da árvore)
  e.equipment.ring = { id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id), count: 1, af: [], poe: { af: { retaliacao_quarta_critica: 1 } } };
  Ficha.invalidar(e);
  for (let i = 0; i < 3; i++) {
    h.retaliacaoUsos = 3;
    h.cooldowns = {};
    h.clock += 10000;
    ModsPoe.abrirRetaliacao(h, 'bloquear', ficha(e).afPoe);
    const r = Acoes.disparar(e, h, PERSONAGEM, 0, alvo);
    assert.equal(r.ok, true, r.erro);
    const golpes = (r.eventos ?? []).filter((x) => x.t === 'dmg' && x.uid === alvo.uid);
    assert.ok(golpes.length && golpes.every((x) => x.crit), 'a quarta é crítica');
  }
});

test('RETALIAÇÃO: o Acerto Selvagem (≥ 15% da Vida) abre a do Clamor Vingativo; o Arsenal da Vingança abre a cada sexto acerto sofrido', { skip: SEM }, () => {
  const e = novo();
  e.maxHp = e.hp = 1000;
  ModsPoe.aoSerAcertado(e, e.hunt, bicho(), ficha(e), { dano: 149 });
  assert.equal(ModsPoe.retaliacaoUsavel(e.hunt, 'selvagem', 'Vengeful_Cry'), false);
  ModsPoe.aoSerAcertado(e, e.hunt, bicho(), ficha(e), { dano: 150 });
  assert.equal(ModsPoe.retaliacaoUsavel(e.hunt, 'selvagem', 'Vengeful_Cry'), true);
  const a = com(/^retaliacao_a_cada_acertos$/);
  a.e.maxHp = a.e.hp = 1e6;
  for (let i = 1; i <= 5; i++) ModsPoe.aoSerAcertado(a.e, a.e.hunt, bicho(), ficha(a.e), { dano: 1 });
  assert.equal(ModsPoe.retaliacaoUsavel(a.e.hunt, 'bloquear', 'Eviscerate'), false);
  ModsPoe.aoSerAcertado(a.e, a.e.hunt, bicho(), ficha(a.e), { dano: 1 });
  assert.equal(ModsPoe.retaliacaoUsavel(a.e.hunt, 'bloquear', 'Eviscerate'), true, 'no sexto');
});

test('FURTIVIDADE: o raio em que os monstros notam você encolhe — 8 casas ÷ (1 + X%)', { skip: SEM }, () => {
  const { e } = com(/^furtividade@acertouRecente\+comGarra$/);
  assert.ok(ficha(e).afPoe['furtividade@acertouRecente+comGarra'] > 0);
  assert.equal(ModsPoe.percepcaoComFurtividade(8, { afPoe: { furtividade: 100 } }), 4);
  assert.equal(ModsPoe.percepcaoComFurtividade(8, { afPoe: {} }), 8);
  // (um corredor reto, como em `moverMonstros.test`)
  const hunt = { pos: { x: 0, y: 5 }, monstros: [{ uid: 1, key: 'rat', dir: 2, hp: 10, maxHp: 10, x: 6, y: 5, proximoPasso: 0 }] };
  const grade = { minX: 0, maxX: 10, minY: 5, maxY: 5, andavel: new Set(Array.from({ length: 11 }, (_, x) => `${x},5`)) };
  Monstros.moverMonstros(hunt, grade, 1000, { percepcao: 4 });
  assert.ok(!hunt.monstros[0].perseguindo, 'a 6 casas, com a percepção em 4, não nota');
  Monstros.moverMonstros(hunt, grade, 1000, { percepcao: 8 });
  assert.equal(hunt.monstros[0].perseguindo, true);
});

test('BAÚS: "X% de chance de abrir Baús próximos quando você Conjurar uma Magia" — os da sala a até 4 casas', { skip: SEM }, () => {
  const e = novo();
  const perto = { id: 'b1', tipo: 'bau-raro', estado: 'disponivel', x: 3, y: 0, nome: 'Baú' };
  const longe = { id: 'b2', tipo: 'bau-raro', estado: 'disponivel', x: 9, y: 0, nome: 'Baú' };
  e.hunt.instancia = { id: 'i', encontros: { b1: perto, b2: longe } };
  assert.equal(Acoes.abrirBausAoConjurar(e, e.hunt, null, 0, () => 0), 0, 'sem a linha, nada');
  assert.equal(Acoes.abrirBausAoConjurar(e, e.hunt, null, 50, () => 0.6), 0, 'a chance não saiu');
  assert.equal(Acoes.abrirBausAoConjurar(e, e.hunt, null, 50, () => 0.1), 1);
  assert.notEqual(perto.estado, 'disponivel');
  assert.equal(longe.estado, 'disponivel', 'o de longe, não');
});

test('SANGRAMENTO EM VOCÊ: triplica enquanto você anda (o lembrete do PoE); "Mover enquanto Sangrando faz com que você não sofra Dano extra"', { skip: SEM }, () => {
  const pulsoEmMim = (e, andando) => {
    const h = e.hunt;
    e.maxHp = e.hp = 1e6;
    ModsPoe.definirFichaDaCacada(h, () => ficha(e));
    Dot.aplicarNoJogador(h, { tipo: 'sangramento', total: 3000, duracaoMs: 3000, origem: { fonte: 'mob', mob: 'Rato' } }, h.clock);
    h.clock += 1000;
    if (andando) (h.poeRecente ??= {}).moveu = h.clock - 200;
    const antes = e.hp;
    Mecanicas.tique(e, h, PERSONAGEM, []);
    return antes - e.hp;
  };
  const parado = pulsoEmMim(novo(), false);
  assert.ok(parado > 0);
  assert.equal(pulsoEmMim(novo(), true), 3 * parado);
  const { e } = com(/^sangrar_andando_sem_extra$/);
  assert.equal(pulsoEmMim(e, true), parado);
});

test('ESTANDARTE PLANTADO na barra: sem Valor não sai; no automático só com o Valor no máximo, no clique com o que tiver; consome o Valor; sair da área o encerra', { skip: SEM }, () => {
  const { e, h, alvo } = duelistaCom('War_Banner');
  const r0 = Acoes.disparar(e, h, PERSONAGEM, 0, alvo);
  assert.deepEqual([r0.ok, r0.motivo], [false, 'SEM_VALOR']);
  h.valor = { n: 10, ultimo: -Infinity };
  const r1 = Acoes.disparar(e, h, PERSONAGEM, 0, alvo);
  assert.deepEqual([r1.ok, r1.motivo], [false, 'SEM_VALOR'], 'o automático espera o Valor máximo');
  const r2 = Acoes.disparar(e, h, PERSONAGEM, 0, alvo, { manual: true });
  assert.equal(r2.ok, true, r2.erro);
  const b = h.buffs['poe-gema:War_Banner'];
  const porValor = GemasPoe.buffNoNivel('War_Banner', 10).porValor;
  assert.deepEqual([b.estandarte.valor, b.estandarte.efeitoMais, ModsPoe.valorAtual(h)], [10, 10 * porValor.efeito, 0]);
  assert.equal(b.fator, 1 + (10 * porValor.efeito) / 100, 'os efeitos do nível crescem pelo Valor');
  assert.equal(b.raio, Math.max(1, Math.round(1.2 * Math.sqrt(1 + (10 * porValor.area) / 100))));
  assert.equal(b.ate, h.clock + 10000, '10 s (a gema)');
  assert.equal(ModsPoe.estandarteAtivo(h), true);
  // sair da área: acaba
  h.pos = { ...h.pos, x: b.estandarte.x + b.raio + 1 };
  ModsPoe.aurasProximas(e, h, ficha(e));
  assert.equal(ModsPoe.estandarteAtivo(h), false);
});

test('ESTANDARTE PLANTADO: as linhas — duração e área, vida por Valor, remover afecção, cargas no Valor máximo, Valor com ele plantado, sair da área', { skip: SEM }, () => {
  const plantar = (e, n, porValor = { efeito: 10, area: 10 }) => { e.hunt.valor = { n, ultimo: -Infinity }; return ModsPoe.plantarEstandarte(e, e.hunt, ficha(e), porValor); };
  const comBuff = (e, p, raio = 2) => { e.hunt.buffs = { 'poe-gema:War_Banner': { ate: e.hunt.clock + 10000, tipo: 'poe-aura', raio, afPoe: {}, estandarte: { x: 0, y: 0, z: 0, valor: p.valor, efeitoMais: p.efeitoMais } } }; return e.hunt.buffs['poe-gema:War_Banner']; };
  // a duração e a área ("Habilidades de Estandarte têm …")
  const d = com(/^duracao_habilidades@estandarte$/);
  assert.equal(Acoes.duracaoDasPecas(d.e, entrada('War_Banner')) - Acoes.duracaoDasPecas(novo(), entrada('War_Banner')), d.valor);
  assert.equal(Acoes.duracaoDasPecas(d.e, entrada('Hatred')), Acoes.duracaoDasPecas(novo(), entrada('Hatred')), 'só nos Estandartes');
  const ar = com(/^area_inc@estandarte$/);
  assert.equal(Acoes.raioDaAuraDe(ar.e, entrada('War_Banner'), 20), Math.round(20 * Math.sqrt(1 + ar.valor / 100)));
  // "Recupera X% da Vida por cada N de Valor consumido"
  const v = com(/^estandarte_vida_por_valor:\d+$/);
  const cada = Number(v.chave.split(':')[1]);
  v.e.maxHp = 10000;
  v.e.hp = 1000;
  plantar(v.e, 2 * cada);
  assert.equal(v.e.hp, 1000 + (10000 * v.valor * 2) / 100);
  // "Remove uma Afecção aleatória de você quando você consumir ao menos N de Valor"
  const r = com(/^estandarte_remove_afeccao_min$/);
  const sangra = () => Dot.aplicarNoJogador(r.e.hunt, { tipo: 'sangramento', total: 3000, duracaoMs: 3000, origem: { fonte: 'mob' } }, r.e.hunt.clock);
  sangra();
  plantar(r.e, r.valor - 1);
  assert.equal(r.e.hunt.efeitosDoJogador.dots.length, 1, 'com menos Valor, fica');
  plantar(r.e, r.valor);
  assert.equal(r.e.hunt.efeitosDoJogador.dots.length, 0);
  // "Ganhe N Cargas de Frenesi ao consumir o Valor máximo"
  const c = com(/^estandarte_cargas_cheio:frenesi$/);
  plantar(c.e, 49);
  assert.equal(c.e.hunt.cargasPoe?.frenesi?.n ?? 0, 0, 'sem o máximo, nada');
  plantar(c.e, ModsPoe.valorMaximo(ficha(c.e).afPoe));
  assert.equal(c.e.hunt.cargasPoe.frenesi.n, Math.min(c.valor, 3 + (Number(ficha(c.e).afPoe.max_frenesi) || 0)));
  // "Ter um Estandarte plantado não impede que você ganhe Valor"
  const g = com(/^valor_com_estandarte_plantado$/);
  g.e.actions = [{ id: 'poe-gema:War_Banner', enabled: true }];
  ModsPoe.aurasProximas(g.e, g.e.hunt, ficha(g.e));
  comBuff(g.e, plantar(g.e, 10));
  ModsPoe.ganharValor(g.e.hunt, 1, ficha(g.e).afPoe);
  assert.equal(ModsPoe.valorAtual(g.e.hunt), 1);
  // sair da área: "Bônus … permanecem por N segundos"; "recupere X% do Valor consumido"
  const f = com(/^estandarte_fica_s$/);
  const bf = comBuff(f.e, plantar(f.e, 20));
  f.e.hunt.pos = { x: 5, y: 0 };
  ModsPoe.aurasProximas(f.e, f.e.hunt, ficha(f.e));
  assert.equal(bf.ate, f.e.hunt.clock + 1000 * f.valor);
  const rv = com(/^estandarte_sair_recupera_valor_pct$/);
  comBuff(rv.e, plantar(rv.e, 20));
  rv.e.hunt.pos = { x: 5, y: 0 };
  ModsPoe.aurasProximas(rv.e, rv.e.hunt, ficha(rv.e));
  assert.equal(ModsPoe.valorAtual(rv.e.hunt), (20 * rv.valor) / 100);
  assert.equal(ModsPoe.estandarteAtivo(rv.e.hunt), false, 'sem a outra linha, acaba na hora');
  // "Você e Aliados próximos dos seus Estandartes Regeneram X% de Vida por segundo por cada Valor consumido por tal Estandarte"
  const rg = com(/^life_regen_max_pct%valorDoEstandarte@estandarteAtivo$/);
  const base = ModsPoe.valor(ficha(rg.e), 'life_regen_max_pct');
  comBuff(rg.e, plantar(rg.e, 20));
  assert.ok(Math.abs(ModsPoe.valor(ficha(rg.e), 'life_regen_max_pct') - base - 20 * rg.valor) < 1e-9);
});
