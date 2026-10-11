// A árvore do PoE, ciclo 7 (11/10 — "tente resolver tudo que não está funcionando"): a RETALIAÇÃO (as 7 gemas viram golpes comuns no jogo),
// os LACAIOS e TOTENS (o tique deles em `cacadas` com `lacaios-poe`) e a MARCA (a maldição Marca no monstro, com as regras da árvore de quem
// marcou). Cada teste aloca o nó REAL pelo servidor e mede onde a linha age.
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
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const GP = await import('../systems/itens-poe/gemas-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const Defesa = await import('../systems/personagem/defesa.mjs');
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
  // (o valor que conta é a SOMA do atributo: o caminho até o nó pode passar por outros nós com a mesma linha)
  const chave = [...(no.efeitos ?? []), ...((no.opcoes ?? []).find((o) => o.id === opcao)?.efeitos ?? [])].find((x) => re.test(x.add ?? '')).add;
  return { e, valor: Number(Ficha.combate(e).afPoe[chave]) || achado.valor, chave };
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const golpe = (e, tags, alvo = null) => ModsPoe.fichaDoGolpe(ficha(e), tags, { estado: e, alvo });
const entrada = (slug) => Acoes.POR_ID_PUBLICO(GP.doSlug(slug).acao);
const bicho = (extra = {}) => ({ uid: 9, key: 'rat', name: 'Rato', x: 1, y: 0, hp: 1000, maxHp: 1000, ...extra });

// ---------------------------------------------------------------- Retaliação

test('RETALIAÇÃO: o dano, a velocidade de ataque e a recarga valem só nas gemas de Retaliação', { skip: SEM }, () => {
  const { e, valor } = com(/^dmg_inc@retaliacao$/);
  const comTag = golpe(e, ['ataque', 'corpo', 'retaliacao']).danoDoElemento.physical;
  const semTag = golpe(e, ['ataque', 'corpo']).danoDoElemento.physical;
  assert.equal(comTag - semTag, valor);
  // a velocidade: o uso da Eviscerar (Retaliação) encurta; o da Cutilada (não) não muda — antes `atk_speed@<tag>` não entrava em nada
  const v = com(/^atk_speed@retaliacao$/);
  const base = novo();
  const uso = (x, slug) => Acoes.temposDaGemaPoe(x, entrada(slug), { nivel: 1 }, ficha(x)).uso;
  assert.ok(uso(v.e, 'Eviscerate') < uso(base, 'Eviscerate'), `${uso(base, 'Eviscerate')} → ${uso(v.e, 'Eviscerate')}`);
  assert.equal(uso(v.e, 'Cleave'), uso(base, 'Cleave'));
  // "Armadura aumentada em X% por cada Habilidade de Retaliação diferente que você tenha usado nos últimos N segundos"
  const a = com(/^armour_pct%distintas:retaliacao:/);
  const arm = () => ficha(a.e).afPoe.armour_pct ?? 0;
  const zero = arm();
  ModsPoe.marcarUsoPorTag(a.e.hunt, ['ataque', 'retaliacao'], 'Eviscerate');
  ModsPoe.marcarUsoPorTag(a.e.hunt, ['ataque', 'retaliacao'], 'Eviscerate');
  assert.equal(arm() - zero, a.valor, 'a mesma gema duas vezes conta uma');
  ModsPoe.marcarUsoPorTag(a.e.hunt, ['ataque', 'retaliacao'], 'Swordstorm');
  assert.equal(arm() - zero, 2 * a.valor, 'duas gemas diferentes');
  a.e.hunt.clock += 60000;
  assert.equal(arm(), zero, 'passou a janela');
});

test('RETALIAÇÃO: "se você usou uma Habilidade de Retaliação Recentemente" e o Debilitar no acerto (10% menos dano, não 19%)', { skip: SEM }, () => {
  const b = com(/^block@usouTag:retaliacao$/);
  const antes = ficha(b.e).afPoe.block ?? 0;
  ModsPoe.marcarUsoPorTag(b.e.hunt, ['ataque', 'retaliacao'], 'Eviscerate');
  assert.equal((ficha(b.e).afPoe.block ?? 0) - antes, b.valor);
  b.e.hunt.clock += ModsPoe.RECENTE_MS + 1;
  assert.equal(ficha(b.e).afPoe.block ?? 0, antes, 'passou o "recentemente"');
  const d = com(/^ev:acertar:alvo:debilitado:\d+@retaliacao$/);
  const alvo = bicho();
  ModsPoe.aoAcertar(d.e, d.e.hunt, alvo, golpe(d.e, ['ataque', 'corpo']), { dano: 1, rng: () => 0.99 });
  assert.ok(!alvo.estados?.debilitado, 'sem a tag de Retaliação, nada');
  ModsPoe.aoAcertar(d.e, d.e.hunt, alvo, golpe(d.e, ['ataque', 'corpo', 'retaliacao']), { dano: 1, rng: () => 0.99 });
  assert.ok(alvo.estados.debilitado.ate > d.e.hunt.clock);
  assert.ok(Math.abs(ModsPoe.doBicho(alvo, d.e.hunt.clock).danoFator - 0.9) < 1e-9, 'o Debilitado tira 10%');
});

// ---------------------------------------------------------------- Lacaios e totens

test('LACAIOS: o crítico, o Escudo de Energia, a Redução Física, o máximo das resistências e o dano dobrado da árvore', { skip: SEM }, () => {
  const lacaio = (re, extra = {}) => {
    const { e, valor } = com(re);
    const q = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, ficha(e).afPoe);
    return { l: LacaiosPoe.aplicarNoLacaio({ ...q, hp: q.vida, maxHp: q.vida, critChance: 5, critMult: 1.5, ...extra }), valor };
  };
  const semNada = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, ficha(novo()).afPoe);
  const c = lacaio(/^minion_crit_inc$/);
  assert.ok(Math.abs(LacaiosPoe.criticoDoLacaio(c.l).chance - 5 * (1 + c.valor / 100)) < 1e-9);
  const m = lacaio(/^minion_crit_mult$/);
  assert.ok(Math.abs(LacaiosPoe.criticoDoLacaio(m.l).mult - (1.5 + m.valor / 100)) < 1e-9);
  // o escudo: X% da vida; o golpe tira do escudo primeiro, e ele recarrega depois de 2 s sem dano
  const es = lacaio(/^minion_es_da_vida$/);
  assert.equal(es.l.maxEs, Math.round((es.l.maxHp * es.valor) / 100));
  const { dano } = LacaiosPoe.danoNoLacaio(es.l, { fisico: es.l.maxEs + 10 });
  assert.equal(dano, 10, 'o escudo segura antes da vida');
  LacaiosPoe.recarregarEscudoDoLacaio(es.l, 2000);
  LacaiosPoe.recarregarEscudoDoLacaio(es.l, 1000);
  assert.ok(es.l.es > 0, 'recarregou');
  const pr = lacaio(/^minion_phys_red$/);
  assert.ok(Math.abs(LacaiosPoe.danoNoLacaio(pr.l, { fisico: 100 }).dano - 100 * (1 - pr.valor / 100)) < 1e-9);
  const rm = lacaio(/^minion_res_max$/);
  assert.equal(LacaiosPoe.tetoDaResDoLacaio(rm.l), 75 + rm.valor);
  assert.equal(LacaiosPoe.tetoDaResDoLacaio({ poe: semNada.poe }), 75);
  const dd = lacaio(/^minion_dano_dobrado$/);
  assert.equal(LacaiosPoe.golpeDoLacaio(dd.l, bicho(), ficha(novo()), 'physical', 0, () => 0).fator, 2);
  assert.equal(LacaiosPoe.golpeDoLacaio({ poe: semNada.poe }, bicho(), ficha(novo()), 'physical', 0, () => 0).fator, 1);
});

test('LACAIOS: ignorar a Redução Física, penetrar o amaldiçoado, os buffs ao matar, a recuperação e a vida na morte de outro lacaio', { skip: SEM }, () => {
  const lacaioDe = (re) => { const { e, valor } = com(re); const q = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, ficha(e).afPoe); return { l: { ...q, hp: 50, maxHp: 100 }, valor, e }; };
  const ig = lacaioDe(/^minion_ignora_reducao_fisica$/);
  assert.equal(LacaiosPoe.golpeDoLacaio(ig.l, bicho(), ficha(novo()), 'physical', 0, () => 0).ficha.ignoraReducaoFisica, true);
  const pen = lacaioDe(/^minion_pen_amaldicoados$/);
  const amaldicoado = bicho({ maldicoes: { x: { ate: 5000 } } });
  assert.equal(LacaiosPoe.golpeDoLacaio(pen.l, amaldicoado, ficha(novo()), 'fire', 1000).ficha.penetracao.elemental - (ficha(novo()).penetracao?.elemental ?? 0), pen.valor);
  const base = ficha(novo());
  assert.equal(LacaiosPoe.golpeDoLacaio(pen.l, bicho(), base, 'fire', 1000).ficha, base, 'sem maldição, nada');
  const pp = lacaioDe(/^minion_poder_profano_ao_matar$/);
  LacaiosPoe.aoMatarDoLacaio(pp.l, 1000, () => 0);
  assert.ok(LacaiosPoe.buffDoLacaio(pp.l, 'poderProfano', 1000));
  assert.equal(LacaiosPoe.golpeDoLacaio(pp.l, bicho(), ficha(novo()), 'physical', 1000).caosExtra, 1, 'o Poder Profano: o físico como Caos extra');
  const ag = lacaioDe(/^minion_agressividade_ao_matar$/);
  LacaiosPoe.aoMatarDoLacaio(ag.l, 1000, () => 0);
  assert.equal(LacaiosPoe.velocidadeDoLacaio(ag.l, 1000), 20);
  const rec = lacaioDe(/^minion_recuperacao$/);
  LacaiosPoe.curarLacaio(rec.l, 10);
  assert.ok(Math.abs(rec.l.hp - (50 + 10 * (1 + rec.valor / 100))) < 1e-9, 'a recuperação (reduzida) da árvore');
  const morte = lacaioDe(/^minion_vida_na_morte_lacaio$/);
  LacaiosPoe.naMorteDeUmLacaio([morte.l]);
  assert.ok(morte.l.hp > 50);
});

test('LACAIOS: a Instabilidade (explode em Vida Baixa), o "mais Vida", o dano de lacaio que também te afeta e a recarga de UMA gema', { skip: SEM }, () => {
  const inst = com(/^minion_explode_vida_baixa$/);
  const q = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, ficha(inst.e).afPoe);
  const l = { ...q, hp: q.vida, maxHp: q.vida, x: 0, y: 0 };
  assert.equal(LacaiosPoe.explosaoDoLacaio(l, [bicho()]), null, 'com a vida cheia, não');
  l.hp = q.vida * 0.4;
  const atingidos = LacaiosPoe.explosaoDoLacaio(l, [bicho(), bicho({ uid: 10, x: 5 })]);
  assert.equal(atingidos.length, 1, 'só o bicho colado');
  assert.ok(Math.abs(atingidos[0].dano - (q.vida * inst.valor) / 100) < 1e-9);
  assert.equal(l.hp, 0, 'o lacaio morre');
  const mais = com(/^lacaio_vida_mais:qualquer$/);
  const af = ficha(mais.e).afPoe;
  const vida = (x) => LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, x).vida;
  assert.ok(Math.abs(vida(af) / vida({ ...af, 'lacaio_vida_mais:qualquer': 0 }) - (1 + mais.valor / 100)) < 0.02);
  const te = com(/^lacaio_dano_te_afeta$/);
  const semAnel = ficha(te.e).danoDoElemento.physical;
  te.e.equipment = { ring: { id: 3357, count: 1, poe: { classe: 'Rings', base: 'Rings/X', af: { minion_dmg: 30 }, prefixos: [], sufixos: [], implicitos: [] } } };
  assert.equal(ficha(te.e).danoDoElemento.physical - semAnel, 30, 'o "Dano dos Lacaios" do anel também em você');
  const outro = novo();
  outro.equipment = { ring: te.e.equipment.ring };
  assert.equal(ficha(outro).danoDoElemento.physical, ficha(novo()).danoDoElemento.physical, 'sem a linha, o dano de lacaio não é seu');
  const cv = com(/^recarga_gema:Convocation$/);
  const recarga = (x) => Acoes.temposDaGemaPoe(x, entrada('Convocation'), { nivel: 1 }, ficha(x)).recarga;
  assert.ok(recarga(cv.e) < recarga(novo()), `${recarga(novo())} → ${recarga(cv.e)}`);
});

// ---------------------------------------------------------------- a Marca

/** O monstro com a Marca do Senhor da Guerra posta por `e` (a gema de Marca — `efeitosDaMaldicao` + `Reforcos.marcar`). */
function marcar(e, alvo) {
  const entry = entrada('Warlords_Mark');
  const regras = Acoes.efeitosDaMaldicao([], { nivel: 1 }, e, entry);
  e.hunt.buffs = { [entry.id]: { ate: 1e12, desde: 0, tipo: 'poe-maldicao', fator: 1, efeitosPoe: regras } };
  Reforcos.registrar?.(entry.id, { dur: 4000, tipo: 'poe-maldicao', efeitos: regras });
  Reforcos.marcar(e.hunt, alvo, e.hunt.clock);
  return alvo;
}

test('MARCA: o alvo Marcado (dano contra ele, precisão contra ele) e as regras de quem marcou (sem crítico, sem regenerar, menos precisão, mais dano sofrido)', { skip: SEM }, () => {
  const dano = com(/^dmg_inc@alvoMarcado$/);
  const alvo = marcar(dano.e, bicho());
  assert.ok(ModsPoe.tagsDoAlvo(alvo, dano.e.hunt.clock).includes('alvoMarcado'), 'o monstro está Marcado');
  assert.equal(golpe(dano.e, ['ataque'], alvo).danoDoElemento.physical - golpe(dano.e, ['ataque'], bicho()).danoDoElemento.physical, dano.valor);
  const prec = com(/^accuracy_mais@alvoMarcado$/);
  const m2 = marcar(prec.e, bicho());
  assert.ok(Math.abs(Defesa.precisaoMaisContra(ficha(prec.e), prec.e.hunt, m2) - (1 + prec.valor / 100)) < 1e-9);
  assert.equal(Defesa.precisaoMaisContra(ficha(prec.e), prec.e.hunt, bicho()), 1);
  const sc = com(/^marcado_sem_critico$/);
  const m3 = marcar(sc.e, bicho());
  assert.deepEqual(ModsPoe.criticoDoBicho({ chance: 1 }, m3, ficha(sc.e), sc.e.hunt.clock, () => 0), { critico: false, fator: 1 });
  const sr = com(/^marcado_sem_regen$/);
  assert.equal(Reforcos.regrasDasMaldicoes(marcar(sr.e, bicho()), sr.e.hunt.clock).regenMenos, 100);
  const pm = com(/^marcado_precisao_menos$/);
  assert.ok(Math.abs(ModsPoe.doBicho(marcar(pm.e, bicho()), pm.e.hunt.clock).precisaoFator - (1 - pm.valor / 100)) < 1e-9);
  const ds = com(/^marcado_dano_sofrido$/);
  assert.ok(Math.abs(ModsPoe.fatorRecebidoPeloBicho(marcar(ds.e, bicho()), 'physical', ficha(ds.e), ds.e.hunt.clock) - (1 + ds.valor / 100)) < 1e-9);
});

test('MARCA: transfere ao matar o Marcado e cega os vizinhos dele; "Efeito das suas Marcas" só nas Marcas', { skip: SEM }, () => {
  const t = com(/^marca_transfere$/);
  const morto = marcar(t.e, bicho());
  const vizinho = bicho({ uid: 11, x: 3, y: 0 });
  t.e.hunt.monstros = [morto, vizinho];
  morto.hp = 0;
  ModsPoe.evento(t.e, t.e.hunt, 'matar', ficha(t.e), { alvo: morto });
  assert.ok(ModsPoe.marcaNoBicho(vizinho, t.e.hunt.clock), 'a Marca passou ao vizinho');
  assert.ok(!ModsPoe.marcaNoBicho(morto, t.e.hunt.clock));
  const cg = com(/^marcado_cega_proximos$/);
  const marcado = marcar(cg.e, bicho());
  const perto = bicho({ uid: 12, x: 2, y: 0 });
  cg.e.hunt.monstros = [marcado, perto];
  ModsPoe.tique(cg.e, cg.e.hunt, ficha(cg.e), 250, cg.e.hunt.clock);
  assert.ok(perto.estados?.cego?.ate > cg.e.hunt.clock, 'o vizinho do Marcado ficou Cego');
  const ef = com(/^efeito_marca$/);
  const pctDe = (x, slug) => (Acoes.efeitosDaMaldicao([{ efeito: 'marcaVulneravel', pct: 10, tipos: ['physical'], durMarca: 4000 }], { nivel: 1 }, x, entrada(slug))[0].pct);
  assert.ok(Math.abs(pctDe(ef.e, 'Warlords_Mark') - 10 * (1 + ef.valor / 100)) < 1e-9, 'na Marca');
  assert.equal(pctDe(ef.e, 'Despair'), 10, 'na maldição que não é Marca, nada');
});
