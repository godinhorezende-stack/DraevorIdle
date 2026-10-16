// A árvore do PoE, as linhas que ainda não funcionavam — o lote das KEYSTONES e das ASCENDÊNCIAS (dono, 11/10: "resolver depois as linhas que
// não funcionam ainda" / "pode seguir"): Tempestade Turbulenta, Chama Voraz, Dança da Flecha, Acrobacia, Mobilização e Vínculo Ancestral
// inteiras; o Desafio (Berserker), a Força dos Ventos (Deadeye), as Cargas Fanáticas (Inquisidor), a Convergência (Elementalista) e as auras nos
// inimigos próximos das ascendências; as linhas soltas. Cada teste aloca o nó REAL pelo servidor e mede onde a linha age.
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
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Dot = await import('../systems/combate/dot.mjs');
const Defesa = await import('../systems/personagem/defesa.mjs');
const Mecanicas = await import('../systems/mobs/mecanicas.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const HuntCombate = await import('../systems/hunt/combate.mjs');
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

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);
const comAnel = (e, af) => { e.equipment.ring = { id: ANEL, count: 1, af: [], poe: { af } }; Ficha.invalidar(e); return e; };

test('TEMPESTADE TURBULENTA (inteira): só Raio; "-50% de dano elétrico mínimo", "+25% de dano elétrico máximo"', { skip: SEM }, () => {
  const { e } = com(/^raio_max_mais$/);
  const f = ficha(e);
  const p = ModsPoe.transformarPartes(f, { energy: [10, 100], fire: [20, 30] });
  assert.deepEqual(Object.keys(p), ['energy'], 'só o Raio fica');
  assert.deepEqual(p.energy, [10 * (1 + f.afPoe.raio_min_mais / 100), 100 * (1 + f.afPoe.raio_max_mais / 100)]);
  assert.ok(f.afPoe.raio_min_mais < 0 && f.afPoe.raio_max_mais > 0);
});

test('CHAMA VORAZ (inteira): só Fogo; o incêndio dura 1 s de base; um incêndio a mais em cada inimigo; menos dano de incêndio', { skip: SEM }, () => {
  const { e } = com(/^incendios_extra$/);
  const f = ficha(e);
  assert.ok(f.afPoe['so_dano:fire'] > 0 && f.afPoe.incendio_mais < 0);
  const a = { ...f.afeccoes ?? AfeccoesPoe.daSoma(f.afPoe), chance: { incendio: 100 } };
  const b = bicho({ hp: 1e6, maxHp: 1e6 });
  AfeccoesPoe.aoAcertar(b, [{ elemento: 'fire', dano: 1000 }], { afeccoes: a, agora: 1000, rng: () => 0 });
  AfeccoesPoe.aoAcertar(b, [{ elemento: 'fire', dano: 1000 }], { afeccoes: a, agora: 1000, rng: () => 0 });
  AfeccoesPoe.aoAcertar(b, [{ elemento: 'fire', dano: 1000 }], { afeccoes: a, agora: 1000, rng: () => 0 });
  const incendios = b.dots.filter((d) => d.tipo === 'queimadura');
  assert.equal(incendios.length, 2, 'dois incêndios, não três');
  const sem = AfeccoesPoe.daSoma(ficha(novo()).afPoe);
  const c = bicho({ hp: 1e6, maxHp: 1e6 });
  AfeccoesPoe.aoAcertar(c, [{ elemento: 'fire', dano: 1000 }], { afeccoes: { ...sem, chance: { incendio: 100 } }, agora: 1000, rng: () => 0 });
  AfeccoesPoe.aoAcertar(c, [{ elemento: 'fire', dano: 1000 }], { afeccoes: { ...sem, chance: { incendio: 100 } }, agora: 1000, rng: () => 0 });
  assert.equal(c.dots.filter((d) => d.tipo === 'queimadura').length, 1, 'sem a keystone, um só');
  assert.ok(incendios[0].ate - 1000 < c.dots[0].ate - 1000, `a duração base de 1 s: ${incendios[0].ate - 1000} < ${c.dots[0].ate - 1000}`);
});

test('DANÇA DA FLECHA (inteira): Evasão dobrada contra o projétil físico do monstro, menos contra o corpo a corpo', { skip: SEM }, () => {
  const { e } = com(/^evasao_projetil_dobrada$/);
  const f = { ...ficha(e), evasion: 1000 };
  const m = bicho({ level: 50 });
  const hunt = { clock: 10000 };
  const taxa = (opcoes) => { let n = 0; const antes = Math.random; let i = 0; Math.random = () => ((i++ * 0.6180339887) % 1); try { for (let k = 0; k < 2000; k++) if (Defesa.esquivou(f, hunt, { ...m }, opcoes)) n++; } finally { Math.random = antes; } return n / 2000; };
  const corpo = taxa({});
  const projetil = taxa({ projetil: true });
  assert.ok(projetil > corpo, `${projetil} > ${corpo}`);
  const semNada = { ...ficha(novo()), evasion: 1000 };
  const base = (() => { let n = 0; const antes = Math.random; let i = 0; Math.random = () => ((i++ * 0.6180339887) % 1); try { for (let k = 0; k < 2000; k++) if (Defesa.esquivou(semNada, hunt, { ...m })) n++; } finally { Math.random = antes; } return n / 2000; })();
  assert.ok(corpo < base, `corpo a corpo: ${corpo} < ${base} (25% menos Evasão)`);
});

test('ACROBACIA (inteira): a Supressão vira Esquiva Mágica (50% dela), no máximo 75%', { skip: SEM }, () => {
  const { e } = com(/^acrobacia_esquiva_pct$/);
  comAnel(e, { spell_suppression: 60 });
  const f = ficha(e);
  assert.equal(f.supressaoDeMagia, 0);
  assert.ok(Math.abs(f.esquivaMagica - Math.min(0.75, ((Number(f.afPoe.spell_suppression) || 0) * 0.5) / 100)) < 1e-9);
  comAnel(e, { spell_suppression: 400 });
  assert.equal(ficha(e).esquivaMagica, 0.75, 'o teto');
});

test('MOBILIZAÇÃO (inteira): o Clamor não deixa buff em você; a provocação dura o dobro', { skip: SEM }, () => {
  // (o Clamor tem tempo de uso: sai no fim da conjuração — `Acoes.concluirConjuracao`)
  const usar = ({ e, h, alvo }) => {
    const r = Acoes.disparar(e, h, PERSONAGEM, 0, alvo, { manual: true });
    assert.equal(r.ok, true, r.erro);
    if (h.conjurando) { h.clock = h.conjurando.fim; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
    return h.clock;
  };
  const dur = GemasPoe.buffNoNivel('Enduring_Cry', 10).dur;
  const o = duelistaCom('Enduring_Cry');
  const t1 = usar(o);
  assert.ok(o.h.buffs?.['poe-gema:Enduring_Cry'], 'sem a keystone, o buff fica');
  assert.equal(o.alvo.provocadoAte, t1 + dur);
  const x = duelistaCom('Enduring_Cry');
  comAnel(x.e, { clamor_sem_buff_em_voce: 1, clamor_duracao_mais: 100 });
  const t2 = usar(x);
  assert.ok(!x.h.buffs?.['poe-gema:Enduring_Cry'], 'sem buff em você');
  assert.equal(x.alvo.provocadoAte, t2 + 2 * dur);
});

test('VÍNCULO ANCESTRAL (inteiro): as gemas do personagem e o golpe básico não ferem', { skip: SEM }, () => {
  const { e, h, alvo } = duelistaCom('Cleave');
  comAnel(e, { sem_dano_proprio: 1 });
  const antes = alvo.hp;
  const r = Acoes.disparar(e, h, PERSONAGEM, 0, alvo, { manual: true });
  assert.equal(r.ok, true, r.erro);
  assert.equal(alvo.hp, antes, 'a Cutilada não fere');
  assert.equal(HuntCombate.round(e, PERSONAGEM).bateu, false, 'o golpe básico não sai');
  const o = duelistaCom('Cleave');
  const antes2 = o.alvo.hp;
  assert.equal(Acoes.disparar(o.e, o.h, PERSONAGEM, 0, o.alvo, { manual: true }).ok, true);
  assert.ok(o.alvo.hp < antes2, 'sem a keystone, fere');
});

test('DESAFIO (Berserker): ganha ao perder vida (a cada 0,3 s), cura 3% da vida faltante por Desafio, perde tudo em 10', { skip: SEM }, () => {
  const { e, valor } = com(/^desafio_cura_faltante_pct$/);
  e.maxHp = 10000;
  const f = ficha(e);
  e.hp = 5000;
  ModsPoe.aoSerAcertado(e, e.hunt, bicho(), f, { dano: 100 });
  assert.equal(e.hunt.desafio.n, 1);
  assert.equal(e.hp, 5000, 'sem Desafio antes, nada a curar');
  e.hunt.clock += 100;
  // (15/10, lote 32 — P046, ajuste aprovado pelo dono: "Gain 3% of Missing Unreserved Life BEFORE being Hit" — a vida é ganha antes do acerto
  // (`antesDeSerAcertado`, que o golpe e a magia do monstro chamam), da Vida não reservada que falta: 5000 aqui; antes, 10000 − 5100 depois)
  ModsPoe.antesDeSerAcertado(e, e.hunt, f);
  ModsPoe.aoSerAcertado(e, e.hunt, bicho(), f, { dano: 100 });
  assert.equal(e.hunt.desafio.n, 1, 'a cada 0,3 s');
  assert.equal(e.hp, 5000 + Math.round((10000 - 5000) * valor / 100), 'curou pelo Desafio que tinha');
  for (let i = 0; i < 9; i++) { e.hunt.clock += 300; ModsPoe.aoSerAcertado(e, e.hunt, bicho(), f, { dano: 1 }); }
  assert.equal(e.hunt.desafio.n, 0, 'perde tudo ao chegar a 10');
});

test('FORÇA DOS VENTOS (Deadeye): +1 ao usar uma habilidade, até 10, por 4 s; "4% menos Dano sofrido por Força dos Ventos"; perde ao ser acertado', { skip: SEM }, () => {
  const v = com(/^forca_ventos_ao_usar$/);
  for (let i = 0; i < 12; i++) ModsPoe.ganharForcaDosVentos(v.e.hunt, ficha(v.e));
  assert.equal(v.e.hunt.forcaDosVentos.n, 10);
  const g = com(/^dmg_reduction%forcaDosVentos$/);
  const base = Number(ficha(g.e).afPoe.dmg_reduction) || 0;
  g.e.hunt.forcaDosVentos = { n: 5, ate: g.e.hunt.clock + 4000 };
  assert.equal((Number(ficha(g.e).afPoe.dmg_reduction) || 0) - base, 5 * g.valor);
  ModsPoe.aoSerAcertado(g.e, g.e.hunt, bicho(), ficha(g.e), { dano: 1 });
  assert.equal(g.e.hunt.forcaDosVentos, undefined, 'perdeu tudo');
  g.e.hunt.forcaDosVentos = { n: 5, ate: g.e.hunt.clock - 1 };
  assert.equal((Number(ficha(g.e).afPoe.dmg_reduction) || 0) - base, 0, 'acabou em 4 s');
});

test('CARGAS FANÁTICAS (Inquisidor): +1 por segundo atacando; no máximo, Fanatismo por 5 s e perde as cargas', { skip: SEM }, () => {
  const { e } = com(/^fanaticas_max$/);
  const f = ficha(e);
  const max = f.afPoe.fanaticas_max;
  const h = e.hunt;
  ModsPoe.tique(e, h, f, 250, h.clock);
  for (let s = 1; s < max; s++) {
    (h.poeRecente ??= {})['usou:ataque'] = h.clock + 500;
    h.clock += 1000;
    ModsPoe.tique(e, h, f, 1000, h.clock);
  }
  assert.equal(h.fanaticas.n, max - 1);
  h.clock += 1000;
  ModsPoe.tique(e, h, f, 1000, h.clock);
  assert.equal(h.fanaticas.n, max - 1, 'sem atacar no segundo, nada');
  h.poeRecente['usou:ataque'] = h.clock + 500;
  h.clock += 1000;
  ModsPoe.tique(e, h, f, 1000, h.clock);
  assert.equal(h.fanaticas.n, 0, 'no máximo: perde todas');
  assert.ok(ModsPoe.buffAtivo(e, 'fanatismo'));
  assert.ok(ModsPoe.somaPorTags(ficha(e), ['magia']).custo_mana_inc < 0 && ModsPoe.somaPorTags(ficha(e), ['magia']).area_inc > 0, 'o Fanatismo nas magias');
});

test('CONVERGÊNCIA (Elementalista): ao acertar um Único (a cada 8 s); a Área de Efeito a mais só sem ela', { skip: SEM }, () => {
  const { e } = com(/^convergencia_cada_s$/);
  const area = () => Number(ficha(e).afPoe.area_inc) || 0;
  const semConv = area();
  ModsPoe.aoAcertar(e, e.hunt, bicho(), golpe(e, ['ataque']), { dano: 1, rng: () => 0.99 });
  assert.ok(!ModsPoe.buffAtivo(e, 'convergencia'), 'o comum não dá');
  ModsPoe.aoAcertar(e, e.hunt, bicho({ raridade: 'unico' }), golpe(e, ['ataque']), { dano: 1, rng: () => 0.99 });
  assert.ok(ModsPoe.buffAtivo(e, 'convergencia'));
  assert.ok(area() < semConv, 'com Convergência, a área a mais sai');
  // (15/10, lote 32 — P073, ajuste aprovado pelo dono: "Convergence grants 30% more Elemental Damage" — as partes de Fogo, Gelo e Raio do
  // golpe, não o golpe inteiro com a tag elemental)
  assert.ok(Math.abs(ModsPoe.fatorDoDanoElemental(ficha(e), e.hunt, 'golpe', 'fire') - 1.3) < 1e-9, '30% mais no Fogo');
  assert.equal(ModsPoe.fatorDoDanoElemental(ficha(e), e.hunt, 'golpe', 'physical'), 1, 'o Físico, não');
});

test('AURAS DAS ASCENDÊNCIAS: o Multiplicador de crítico (Slayer), o Elemental a menos (Inquisidor), o Físico em Fogo (Reliquarian/Elementalista), a Recarga (Sabotador)', { skip: SEM }, () => {
  const s = com(/^aura_crit_mult_menos$/);
  const perto = bicho({ x: 2, y: 0 });
  const longe = bicho({ uid: 10, x: 9, y: 0 });
  s.e.hunt.monstros = [perto, longe];
  ModsPoe.aurasProximas(s.e, s.e.hunt, ficha(s.e));
  const crit = (m) => ModsPoe.criticoDoBicho({ chance: 1, fator: 1.5 }, m, ficha(s.e), s.e.hunt.clock, () => 0);
  assert.ok(Math.abs(crit(perto).fator - (1.5 - Math.abs(s.valor) / 100)) < 1e-9);
  assert.equal(crit(longe)?.fator ?? 1.5, 1.5);
  for (const [re, campo] of [[/^aura_dano_elem_menos$/, 'elemMenos'], [/^aura_fisico_em_fogo$/, 'fisicoEmFogo'], [/^aura_recarga_menos$/, 'recargaMenos']]) {
    const a = com(re);
    const m = bicho({ x: 1, y: 0 });
    a.e.hunt.monstros = [m];
    ModsPoe.aurasProximas(a.e, a.e.hunt, ficha(a.e));
    assert.equal(m.estados[campo].pct, a.valor, campo);
  }
  const i = com(/^incendiados_fisico_em_fogo$/);
  const incendiado = bicho({ x: 9, y: 0, hp: 1e6, maxHp: 1e6 });
  Dot.aplicar(incendiado, { tipo: 'queimadura', total: 1000, duracaoMs: 4000 }, i.e.hunt.clock);
  i.e.hunt.monstros = [incendiado];
  ModsPoe.aurasProximas(i.e, i.e.hunt, ficha(i.e));
  assert.equal(incendiado.estados.fisicoEmFogo.pct, i.valor, 'o Incendiado, mesmo longe');
});

test('JUGGERNAUT, CHEFE TRIBAL, OCULTISTA: 15% da Armadura no Caos; "-20% de Dano Degenerativo enquanto Parado"; menos degenerativo do lento perto', { skip: SEM }, () => {
  const j = com(/^armadura_no_caos_pct$/);
  const fj = { ...ficha(j.e), armor: 20000 };
  assert.ok(ModsPoe.armaduraNoElemento(fj, 'chaos', 500) < 1);
  assert.equal(ModsPoe.armaduraNoElemento({ ...ficha(novo()), armor: 20000 }, 'chaos', 500), 1);
  const pulso = (e, extra = () => {}) => {
    const h = e.hunt;
    e.maxHp = e.hp = 1e6;
    ModsPoe.definirFichaDaCacada(h, () => ficha(e));
    extra(h);
    Dot.aplicarNoJogador(h, { tipo: 'veneno', total: 3000, duracaoMs: 3000, origem: { fonte: 'mob', uid: 77 } }, h.clock);
    h.clock += 1000;
    const antes = e.hp;
    Mecanicas.tique(e, h, PERSONAGEM, []);
    return antes - e.hp;
  };
  const base = pulso(novo());
  const c = com(/^dano_degen_recebido_pct@parado$/);
  assert.equal(pulso(c.e), Math.round(base * (1 + c.valor / 100)), 'parado');
  const o = com(/^proximos_lentos_degen_menos$/);
  assert.equal(pulso(o.e, (h) => { h.monstros = [bicho({ uid: 77, x: 1, y: 0, estados: { lento: { ate: h.clock + 5000, pct: 30 } } })]; }), Math.round(base * (1 - o.valor / 100)));
});

test('GLADIADOR, SLAYER, DEFINHAMENTO, DANO FÍSICO MÁXIMO e o CUSTO EM VIDA', { skip: SEM }, () => {
  const g = com(/^bloqueio_escudo_fixo$/);
  const escudo = { id: ANEL, count: 1, af: [], poe: { classe: 'Shields', af: { block: 20 } } };
  const comEscudo = (e) => { e.equipment.shield = escudo; const com = Number(Afixos.soma(e).block) || 0; delete e.equipment.shield; return com - (Number(Afixos.soma(e).block) || 0); };
  assert.equal(comEscudo(g.e), g.valor, 'o bloqueio-base do escudo vira N');
  assert.equal(comEscudo(novo()), 20, 'sem a linha, o do escudo');
  const d = com(/^definhamento_expira_lento$/);
  const m1 = bicho();
  const m2 = bicho({ uid: 10 });
  const alvo = (e, m) => ModsPoe.evento(e, e.hunt, 'acertar', { ...ficha(e), eventosPoe: [{ evento: 'acertar', acao: 'alvo', param: 'definhado:2', conds: [], valor: 100 }] }, { alvo: m, rng: () => 0.99 });
  alvo(d.e, m1);
  alvo(novo(), m2);
  assert.ok(m1.estados.definhado.ate > m2.estados.definhado.ate, 'expira mais devagar');
  const q = com(/^definhamento_maximo_chance$/);
  const m3 = bicho({ uid: 11 });
  ModsPoe.evento(q.e, q.e.hunt, 'acertar', { ...ficha(q.e), eventosPoe: [{ evento: 'acertar', acao: 'alvo', param: 'definhado:2', conds: [], valor: 100 }] }, { alvo: m3, rng: () => 0 });
  assert.equal(m3.estados.definhado.n, 15);
  const v = com(/^phys_dmg@custaVida$/);
  assert.equal((ModsPoe.somaPorTags(ficha(v.e), ['ataque', 'custaVida']).phys_dmg ?? 0) - (ModsPoe.somaPorTags(ficha(v.e), ['ataque']).phys_dmg ?? 0), v.valor);
  const fm = com(/^fisico_max_mais$/);
  assert.equal(ModsPoe.valor(ficha(fm.e), 'fisico_max_mais'), fm.valor);
});

test('SLAYER: "Chance de Acerto Crítico Base para Ataques com Armas é de 8%" — a espada de 5% passa a 8%', { skip: SEM }, () => {
  const { e } = duelistaCom('Cleave');
  const antes = ficha(e).critChance;
  comAnel(e, { crit_base_arma_fixa: 8 });
  const depois = ficha(e).critChance;
  assert.ok(depois > antes, `${antes} → ${depois}`);
  const base = Number(e.equipment.weapon?.critChance?.base ?? ficha(e).arma?.critChance?.base) || 500;
  assert.ok(Math.abs((depois - antes) / ((800 - base) / 10000) - (ficha(e).critInc != null ? 1 + ficha(e).critInc / 100 : 1)) < 0.5, 'na proporção da base trocada');
});

