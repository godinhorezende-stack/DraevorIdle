// A árvore do PoE, ciclo 7, lote D (11/10 — "tente resolver tudo que não está funcionando"): a FORTIFICAÇÃO (acúmulos de 1% menos dano de
// acertos, até 20, 6 s), o que acontece QUANDO VOCÊ É ATORDOADO, o que o golpe FEZ nas tags dele (Crítico, Atordoou), Esmagar, Provocar,
// a Cegueira e o "Defender com X% de Armadura". Cada teste aloca o nó REAL pelo servidor e mede onde a linha age.
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
const Defesa = await import('../systems/personagem/defesa.mjs');
const Resistencia = await import('../systems/hunt/resistencia.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
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
const nunca = () => 0.999;

// ---------------------------------------------------------------- Fortificação

test('FORTIFICAÇÃO: o acerto corpo a corpo Fortifica pelo tamanho do acerto, até 20; cada uma é 1% menos dano de acertos, e acaba em 6 s', { skip: SEM }, () => {
  const { e } = com(/^chance_fortificar@corpo$/);
  const alvo = bicho();
  const recebido = () => ficha(e).danoRecebidoDasGemas ?? 0;
  const sem = recebido();
  // um golpe de longe (sem a tag corpo) não Fortifica
  ModsPoe.aoAcertar(e, e.hunt, alvo, golpe(e, ['ataque', 'projetil'], alvo), { dano: 50 });
  assert.equal(ModsPoe.fortificacao(e), 0);
  // 5% da vida do alvo → 5 Fortificações; mais 300 (30%) → no teto de 20
  ModsPoe.aoAcertar(e, e.hunt, alvo, golpe(e, ['ataque', 'corpo'], alvo), { dano: 50 });
  assert.equal(ModsPoe.fortificacao(e), 5);
  ModsPoe.aoAcertar(e, e.hunt, alvo, golpe(e, ['ataque', 'corpo'], alvo), { dano: 300 });
  // (a opção da maestria que dá "Acertos Corpo a Corpo Fortificam" vem com "-3 ao máximo de Fortificações": o teto é 17)
  const teto = 20 + (Number(ficha(e).afPoe.max_fortificacao) || 0);
  assert.equal(ModsPoe.fortificacao(e), teto);
  // cada Fortificação = 1% menos dano de acertos (multiplica com o resto)
  assert.ok(Math.abs((1 - recebido()) - (1 - sem) * (1 - teto / 100)) < 1e-9, `${sem} → ${recebido()}`);
  assert.ok(ModsPoe.condicoesDe(e, ficha(e).afPoe).has('fortificado'));
  // acabou: 6 s depois
  e.hunt.clock += 6001;
  assert.equal(ModsPoe.fortificacao(e), 0);
  assert.equal(recebido(), sem);
});

test('FORTIFICAÇÃO: "+N ao máximo de Fortificações" sobe o teto, e "Recupera N de Vida por cada Fortificação perdida" cura quando acaba', { skip: SEM }, () => {
  const m = com(/^max_fortificacao$/);
  ModsPoe.ganharFortificacao(m.e.hunt, 100, ficha(m.e).afPoe);
  assert.equal(ModsPoe.fortificacao(m.e), 20 + m.valor);
  const v = com(/^vida_por_fortificacao_perdida$/);
  const e = v.e;
  ModsPoe.ganharFortificacao(e.hunt, 3, ficha(e).afPoe);
  e.hp = 10;
  e.maxHp = 100000;
  e.hunt.clock += 7000;
  ModsPoe.tique(e, e.hunt, ficha(e), 250);
  assert.equal(e.hp, 10 + 3 * v.valor);
  assert.equal(e.hunt.fortificacao, undefined);
});

test('FORTIFICAÇÃO: "Acertos Corpo a Corpo que Atordoam têm X% de chance de Fortificar" só Fortifica no acerto que atordoou', { skip: SEM }, () => {
  const { e, valor } = com(/^chance_fortificar@corpo\+golpeAtordoou$/);
  assert.equal(valor, 10);
  // o acerto pequeno (não atordoa): nada; o grande (atordoa com certeza) com o sorteio favorável: Fortifica
  const sorte = () => 0;
  ModsPoe.aoAcertar(e, e.hunt, bicho(), golpe(e, ['ataque', 'corpo']), { dano: 1, rng: sorte });
  assert.equal(ModsPoe.fortificacao(e), 0);
  const alvo = bicho();
  const s = ModsPoe.aoAcertar(e, e.hunt, alvo, golpe(e, ['ataque', 'corpo'], alvo), { dano: 400, rng: sorte });
  assert.ok(s.atordoou);
  assert.ok(ModsPoe.fortificacao(e) > 0);
});

// ---------------------------------------------------------------- Atordoamento: o golpe e quem é atordoado

test('GOLPE: "Acertos Críticos possuem Golpe de Misericórdia" e "Acertos que Atordoarem … possuem Golpe de Misericórdia"', { skip: SEM }, () => {
  const c = com(/^culling@critico$/);
  const fraco = () => bicho({ hp: 80 });
  const a = fraco();
  ModsPoe.aoAcertar(c.e, c.e.hunt, a, golpe(c.e, ['ataque']), { dano: 1, crit: false, rng: nunca });
  assert.ok(a.hp > 0, 'sem crítico, não');
  const b = fraco();
  ModsPoe.aoAcertar(c.e, c.e.hunt, b, golpe(c.e, ['ataque']), { dano: 1, crit: true, rng: nunca });
  assert.equal(b.hp, 0, 'com crítico, o alvo com 8% da vida morre');
  const s = com(/^culling@golpeAtordoou$/);
  const d = fraco();
  ModsPoe.aoAcertar(s.e, s.e.hunt, d, golpe(s.e, ['ataque']), { dano: 1, rng: nunca });
  assert.ok(d.hp > 0, 'sem atordoar, não');
  const f = fraco();
  const r = ModsPoe.aoAcertar(s.e, s.e.hunt, f, golpe(s.e, ['ataque']), { dano: 300, rng: () => 0 });
  assert.ok(r.atordoou);
  assert.equal(f.hp, 0, 'o acerto que atordoou mata quem ficou em Vida Baixa de misericórdia');
});

test('ATORDOADO: "Regenera X% de Vida durante 1 segundo quando Atordoado" e a Adrenalina pela duração do atordoamento', { skip: SEM }, () => {
  const { e, valor } = com(/^ev:serAtordoado:regenPct:hp:/);
  e.maxHp = 10000;
  e.hp = 1000;
  const agora = e.hunt.clock;
  e.hunt.controle = { atordoado: { ate: agora + 1500, desde: agora, ms: 1500 } };
  ModsPoe.aoSerAcertado(e, e.hunt, bicho(), ficha(e), { dano: 100, corpoACorpo: true, tipo: 'physical' });
  assert.ok(ModsPoe.condicoesDe(e, ficha(e).afPoe).has('atordoadoRecente'));
  e.hunt.clock += 1000;
  ModsPoe.tique(e, e.hunt, ficha(e), 1000);
  assert.equal(e.hp, 1000 + (10000 * valor) / 100);
  // reage UMA vez a cada atordoamento
  ModsPoe.aoSerAcertado(e, e.hunt, bicho(), ficha(e), { dano: 100, corpoACorpo: true, tipo: 'physical' });
  assert.equal(e.hunt.recuperacoes?.length ?? 0, 0);
  const a = com(/^adrenalina_por_atordoamento:/);
  const [, ms] = a.chave.split(':');
  const t = a.e.hunt.clock;
  a.e.hunt.controle = { atordoado: { ate: t + 1500, desde: t, ms: 1500 } };
  ModsPoe.aoSerAcertado(a.e, a.e.hunt, bicho(), ficha(a.e), { dano: 0, corpoACorpo: true, tipo: 'physical' });
  assert.equal(a.e.hunt.poeBuffs.adrenalina, t + Math.round(((a.valor * 1500) / Number(ms)) * 1000));
});

test('ATORDOADO: "Não pode ser Atordoado por Acertos que causem apenas Dano Físico" e o Escudo de Energia no Ponto de Atordoamento', { skip: SEM }, () => {
  const { e } = com(/^imune_atordoamento_so_fisico$/);
  const f = ficha(e);
  assert.equal(ModsPoe.controleNoJogador(f, 'atordoado', nunca, e.hunt, { soFisico: true }).evitou, true);
  assert.equal(ModsPoe.controleNoJogador(f, 'atordoado', nunca, e.hunt, { soFisico: false }).evitou, false);
  const s = com(/^es_no_ponto_atordoamento$/);
  const fs = { ...ficha(s.e), energyShield: 1000 };
  s.e.maxHp = 1000;
  const chance = ModsPoe.controleNoJogador(fs, 'atordoado', nunca, s.e.hunt, { estado: s.e }).chanceFator;
  assert.ok(Math.abs(chance - 1 / (1 + s.valor / 100)) < 1e-9, `${chance}`);
});

// ---------------------------------------------------------------- Esmagar, Provocar, Cegueira, Defender com Armadura

test('ESMAGAR: "Esmaga Inimigos … enquanto estiverem em Vida Cheia" tira 15 da redução física do alvo; com a vida não cheia, nada', { skip: SEM }, () => {
  const { e } = com(/^esmagar_s@alvoVidaCheia$/);
  const cheio = bicho();
  const antes = Resistencia.resistenciaDe(e.hunt, cheio, 'physical');
  ModsPoe.aoAcertar(e, e.hunt, cheio, golpe(e, ['ataque'], cheio), { dano: 1, rng: nunca });
  assert.ok(cheio.estados.esmagado);
  assert.equal(Resistencia.resistenciaDe(e.hunt, cheio, 'physical'), antes - 15);
  const ferido = bicho({ hp: 500 });
  ModsPoe.aoAcertar(e, e.hunt, ferido, golpe(e, ['ataque'], ferido), { dano: 1, rng: nunca });
  assert.equal(ferido.estados?.esmagado, undefined);
});

test('PROVOCAR: "Inimigos Provocados por você não podem Evadir Ataques" — o provocado não esquiva', { skip: SEM }, () => {
  const { e } = com(/^provocados_nao_evadem$/);
  const f = { ...ficha(e), accuracy: 1 };
  const alvo = bicho({ evasao: 1e9 });
  const erros = (a) => Array.from({ length: 60 }, () => Defesa.errou(f, e.hunt, a)).filter(Boolean).length;
  assert.ok(erros(alvo) > 0, 'sem provocar, a precisão 1 erra');
  alvo.estados = { provocado: { ate: e.hunt.clock + 3000 } };
  assert.equal(erros(alvo), 0);
});

test('CEGUEIRA e DEFESA: a duração da Cegueira, o dano de Inimigos Cegos reduzido e o "Defender com X% de Armadura"', { skip: SEM }, () => {
  const d = com(/^duracao_cegueira$/);
  const ficha2 = { ...golpe(d.e, ['ataque']), afPoe: { ...ficha(d.e).afPoe, chance_cegar: 100 } };
  const alvo = bicho();
  ModsPoe.aoAcertar(d.e, d.e.hunt, alvo, ficha2, { dano: 1, rng: nunca });
  assert.equal(alvo.estados.cego.ate - d.e.hunt.clock, Math.round(4000 * (1 + d.valor / 100)));
  const c = com(/^dano_de_cegos_red$/);
  const cego = bicho({ estados: { cego: { ate: c.e.hunt.clock + 1000 } } });
  assert.ok(Math.abs(ModsPoe.doBicho(cego, c.e.hunt.clock, { ficha: ficha(c.e) }).danoFator - ModsPoe.doBicho(cego, c.e.hunt.clock).danoFator * (1 - c.valor / 100)) < 1e-9);
  const a = com(/^defender_armadura:\d+$/);
  const pct = Number(a.chave.split(':')[1]);
  assert.equal(ModsPoe.armaduraDefendida(ficha(a.e), () => 0), pct / 100);
});
