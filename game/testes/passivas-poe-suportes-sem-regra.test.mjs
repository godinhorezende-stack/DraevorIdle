// A árvore do PoE, as linhas que ainda não funcionavam — o lote dos SUPORTES e das SEM REGRA (dono, 11/10: "pode seguir com os suportes e as sem
// regra"). Os suportes que não agiam (Crueldade, Impiedade, Lâmina Noturna, Libertar, Intensificar) passam a agir na gema de verdade, encaixada e
// usada numa caçada; as linhas da árvore que falam deles medem ali. As sem regra: as Oferendas em você (Necromante), o Mestre Destilador, o
// Toxista e a Cirurgiã (Pathfinder), a Causticação (Warden), a Marca do Assassino no crítico, os suportes do peitoral (Chefe Tribal), a
// Ambidestria, a Força Concussiva, as Forças Profanadas, a Fúria Tribal e a área da Repetição Final. Cada linha da árvore é a de um nó REAL.
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
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');
const FrascosPoe = await import('../systems/itens-poe/frascos.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Registro = await import('../systems/combate/registro.mjs');
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
/** Um personagem novo com o nó real da linha `re` alocado (o caminho até ele; na ascendência, a classe dela). */
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
  return { e, valor: achado.valor };
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const golpe = (e, tags, alvo = null) => ModsPoe.fichaDoGolpe(ficha(e), tags, { estado: e, alvo });
const bicho = (extra = {}) => ({ uid: 9, key: 'rat', name: 'Rato', x: 1, y: 0, hp: 1e6, maxHp: 1e6, ...extra });
/** O Math.random fixo durante `fn` (o sorteio do dano, do acerto e do crítico iguais em todos os usos). */
function comSorte(valor, fn) {
  const antes = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = antes; }
}

const peca = (base) => Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);
const comAnel = (e, af) => { e.equipment.ring = { id: ANEL, count: 1, af: [], poe: { af } }; Ficha.invalidar(e); return e; };

/**
 * Um personagem do PoE numa caçada da Costa com a gema ativa `gema` e os `suportes` ligados na arma (a habilidade no slot 1 da barra), e
 * `monstros` monstros imortais em fila a partir da casa ao lado (o primeiro é o alvo).
 */
function cacada({ classe = 'Duelist', base = 'One_Hand_Swords/Rusted_Sword', gema, suportes = [], nivel = 10, monstros = 1, af = null }) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), { classePoe: classe });
  const arma = peca(base);
  const n = 1 + suportes.length;
  arma.soquetes = { abertos: n, links: Array(n - 1).fill(true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: arma };
  delete e.equipment.shield;
  e.inventory = [gema, ...suportes].map((s) => GS.itemDaGema({ id: (GemasPoe.doSlug(s) ?? SP.doSlug(s)).itemId, nivel, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  if (af) comAnel(e, af);
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GemasPoe.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  Object.assign(e, { mana: 1e6, maxMana: 1e6 });
  const h = e.hunt;
  h.clock = 10000;
  assert.ok(h.monstros.length >= monstros);
  h.monstros = h.monstros.slice(0, monstros);
  h.monstros.forEach((m, i) => Object.assign(m, { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1 + i, y: h.pos.y, raridade: 'normal' }));
  return { e, h, alvo: h.monstros[0], entry: Acoes.POR_ID_PUBLICO(GemasPoe.doSlug(gema).acao) };
}
/** Usa a habilidade do slot 1 no alvo (a magia conclui a conjuração) e devolve o dano no alvo; o relógio anda `depois` ms (a recarga passa). */
function usar({ e, h, alvo }, depois = 5000) {
  const antes = alvo.hp;
  const r = Acoes.disparar(e, h, PERSONAGEM, 0, alvo, { manual: true });
  assert.equal(r.ok, true, r.erro);
  if (h.conjurando) { h.clock = h.conjurando.fim; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
  arguments[0].liberou = h.clock;
  const dano = antes - alvo.hp;
  h.clock += depois;
  Object.assign(e, { hp: e.maxHp, mana: 1e6 });
  return dano;
}
const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= Math.max(2, Math.abs(b) * tol);
/**
 * Os acertos da gema durante `fn` (o registro de golpes ligado só ali): o dano ANTES das defesas do monstro (`bruto` — o monstro da caçada é
 * sorteado, com a armadura e as resistências dele), o depois delas (`base`), o final (`final`, com o crítico) e se foi crítico.
 */
function golpes(fn) {
  const nivel = Registro.nivelDoRegistro();
  Registro.definirNivel(2);
  Registro.limparRegistro();
  try {
    fn();
    return Registro.ultimosGolpes(1000).filter((g) => g.origem === 'gema').map((g) => ({ bruto: g.danoAntesDaResistencia, base: g.danoAposResistencia, final: g.danoFinal, crit: g.critico }));
  } finally {
    Registro.definirNivel(nivel);
    Registro.limparRegistro();
  }
}

// ---------------------------------------------------------------- os suportes que não agiam

test('CRUELDADE: os acertos concedem Crueldade (40% mais Dano Degenerativo × o efeito do suporte); "Efeito da Crueldade aumentado" da árvore', { skip: SEM }, () => {
  const o = cacada({ gema: 'Cleave', suportes: ['Cruelty_Support'] });
  const efeitoDoSuporte = SP.efeitoNoNivel('Cruelty_Support', 10, 0, { tags: ['poe:Ataque'] }).efeito.crueldadeEfeitoPct;
  assert.ok(efeitoDoSuporte > 0);
  assert.ok(!ModsPoe.buffAtivo(o.e, 'crueldade'));
  usar(o, 0);
  assert.ok(ModsPoe.buffAtivo(o.e, 'crueldade'), 'o acerto concedeu Crueldade');
  assert.ok(perto(Number(Ficha.combate(o.e).afPoe.dano_dot_mais), 40 * (1 + efeitoDoSuporte / 100), 1e-9), 'a ficha guardada já foi refeita');
  o.h.clock += 4100;
  assert.ok(!ModsPoe.buffAtivo(o.e, 'crueldade'), 'dura 4 s');
  // (o tique em que ela acaba manda refazer a ficha: o bônus sai na hora)
  ModsPoe.tique(o.e, o.h, Ficha.combate(o.e), 250, o.h.clock);
  assert.equal(o.h.poeFichaMudou, true);
  // O "mais Dano Degenerativo" multiplica a afecção.
  const incendio = (af) => {
    const b = bicho();
    AfeccoesPoe.aoAcertar(b, [{ elemento: 'fire', dano: 1000 }], { afeccoes: { ...AfeccoesPoe.daSoma(af), chance: { incendio: 100 } }, agora: 1000, rng: () => 0 });
    return b.dots.find((d) => d.tipo === 'queimadura').falta;
  };
  assert.ok(perto(incendio({ dano_dot_mais: 40 }), incendio({}) * 1.4, 1e-9));
  // A árvore: "Efeito da Crueldade aumentado em N%".
  const t = com(/^efeito_buff:crueldade$/);
  ModsPoe.ganharBuff(t.e.hunt, 'crueldade', 4, t.e.hunt.clock);
  assert.ok(perto(Number(ficha(t.e).afPoe.dano_dot_mais), 40 * (1 + t.valor / 100), 1e-9));
});

test('IMPIEDADE: cada terceiro ataque corpo a corpo é Impiedoso (mais dano, atordoa); "Acertos Impiedosos Intimidam" da árvore', { skip: SEM }, () => {
  const ef = SP.efeitoNoNivel('Ruthless_Support', 10, 0, { tags: ['poe:Ataque', 'poe:Corpo a Corpo'] }).efeito;
  const t = com(/^impiedoso_intimida_s$/);
  const o = cacada({ gema: 'Heavy_Strike', suportes: ['Ruthless_Support'], af: { impiedoso_intimida_s: t.valor } });
  const dois = golpes(() => comSorte(0.5, () => { usar(o); usar(o); }));
  assert.equal(dois.length, 2);
  assert.equal(dois[0].bruto, dois[1].bruto, 'os dois primeiros iguais');
  assert.ok(!o.alvo.estados?.atordoado, 'sem atordoar');
  const agora = o.h.clock;
  const [terceiro] = golpes(() => comSorte(0.5, () => usar(o, 0)));
  assert.ok(perto(terceiro.bruto, dois[0].bruto * (1 + ef.impiedosoMaisDanoPct / 100)), `o terceiro: ${terceiro.bruto} ≈ ${dois[0].bruto} × ${1 + ef.impiedosoMaisDanoPct / 100}`);
  assert.ok(o.alvo.estados.atordoado?.ate > agora, 'o Golpe Impiedoso atordoa');
  assert.equal(o.alvo.estados.intimidado?.ate, agora + t.valor * 1000, 'e Intimida pelos segundos da árvore');
  o.h.clock += 5000;
  const [quarto] = golpes(() => comSorte(0.5, () => usar(o)));
  assert.equal(quarto.bruto, dois[0].bruto, 'o quarto volta ao normal');
});

test('LÂMINA NOTURNA: só com Garras e Adagas; Elusivo no crítico; crítico e Multiplicador a mais enquanto Elusivo (o do suporte e o da árvore)', { skip: SEM }, () => {
  const espada = cacada({ gema: 'Viper_Strike', suportes: ['Nightblade_Support'] });
  const r = Acoes.disparar(espada.e, espada.h, PERSONAGEM, 0, espada.alvo, { manual: true });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'ARMA');
  const ef = SP.efeitoNoNivel('Nightblade_Support', 10, 0, { tags: ['poe:Ataque'] }).efeito;
  const efeitoDaArvore = com(/^lamina_elusivo_efeito$/).valor;
  const multDaArvore = com(/^lamina_crit_mult_elusivo$/).valor;
  // (o dano aumentado do anel: um golpe grande, para o arredondamento não pesar na razão)
  const o = cacada({ classe: 'Shadow', base: 'Daggers/Glass_Shank', gema: 'Viper_Strike', suportes: ['Nightblade_Support'], af: { lamina_elusivo_efeito: efeitoDaArvore, lamina_crit_mult_elusivo: multDaArvore, phys_dmg: 5000 } });
  const m = ficha(o.e).critMultiplier;
  // (o sorteio em 0: acerta, critica e rola o dano mínimo)
  const [primeiro] = golpes(() => comSorte(0, () => usar(o, 1000)));
  assert.ok(primeiro.crit);
  assert.ok(ModsPoe.buffAtivo(o.e, 'elusivo'), 'o crítico concedeu Elusivo');
  assert.equal(o.h.poeEfeitoDeBuff.elusivo, ef.elusivoEfeitoPct + efeitoDaArvore, 'o efeito do suporte + o da árvore');
  assert.equal(Number(ficha(o.e).afPoe.move_speed) || 0, 30 * (1 + (ef.elusivoEfeitoPct + efeitoDaArvore) / 100), 'o Elusivo com o efeito');
  const [segundo] = golpes(() => comSorte(0, () => usar(o, 0)));
  // (o crítico: o final ÷ o depois das defesas — o Multiplicador; enquanto Elusivo, + o do suporte e o da árvore)
  const razao = (m + (ef.critMultElusivo + multDaArvore) / 100) / m;
  const antes = primeiro.final / primeiro.base;
  const depois = segundo.final / segundo.base;
  assert.ok(Math.abs(depois / antes - razao) < 0.01, `enquanto Elusivo: ×${depois.toFixed(3)} ≈ ×${antes.toFixed(3)} × ${razao.toFixed(3)}`);
});

test('LIBERTAR: um Selo a cada N s (até o máximo, + "+1 ao número máximo de Selos" da árvore); a magia Ocorre Novamente por Selo, com menos dano', { skip: SEM }, () => {
  const ef = SP.efeitoNoNivel('Unleash_Support', 10, 0, { tags: ['poe:Magia'] }).efeito;
  const o = cacada({ classe: 'Witch', base: 'Wands/Driftwood_Wand', gema: 'Fireball', suportes: ['Unleash_Support'] });
  const primeira = golpes(() => comSorte(0.5, () => usar(o, ef.seloIntervaloMs * 10)));
  assert.equal(primeira.length, 1, 'a primeira conjuração, sem Selos');
  const cheia = golpes(() => comSorte(0.5, () => usar(o, 0)));
  assert.equal(cheia.length, 1 + ef.selosMax, `${ef.selosMax} Selos: ${ef.selosMax} vezes de novo`);
  assert.equal(cheia[0].bruto, primeira[0].bruto);
  for (const g of cheia.slice(1)) assert.ok(perto(g.bruto, primeira[0].bruto * (1 - ef.selosMenosDanoPct / 100)), `Ocorrendo Novamente: ${g.bruto} ≈ ${primeira[0].bruto} × ${1 - ef.selosMenosDanoPct / 100}`);
  // (a conjuração também conta: os Selos são os intervalos inteiros entre uma liberação e a outra)
  const t2 = o.liberou;
  o.h.clock += ef.seloIntervaloMs;
  const parcial = golpes(() => comSorte(0.5, () => usar(o)));
  const selos = Math.min(ef.selosMax, Math.floor((o.liberou - t2) / ef.seloIntervaloMs));
  assert.ok(selos >= 1 && selos < ef.selosMax);
  assert.equal(parcial.length, 1 + selos);
  const t = com(/^selos_max_extra$/);
  const x = cacada({ classe: 'Witch', base: 'Wands/Driftwood_Wand', gema: 'Fireball', suportes: ['Unleash_Support'], af: { selos_max_extra: t.valor } });
  comSorte(0.5, () => usar(x, ef.seloIntervaloMs * 10));
  assert.equal(golpes(() => comSorte(0.5, () => usar(x))).length, 1 + ef.selosMax + t.valor, `${ef.selosMax + t.valor} Selos`);
});

test('INTENSIFICAR: ganha Intensidade ao conjurar (até o máximo, + o da árvore); mais dano em área por Intensidade; perde andando', { skip: SEM }, () => {
  const ef = SP.efeitoNoNivel('Intensify_Support', 10, 0, { tags: ['poe:Magia', 'poe:Área'] }).efeito;
  const o = cacada({ classe: 'Witch', base: 'Wands/Driftwood_Wand', gema: 'Ice_Nova', suportes: ['Intensify_Support'] });
  const d = Array.from({ length: ef.intensidadeMax + 2 }, () => golpes(() => comSorte(0.5, () => usar(o, 1000)))[0].bruto);
  assert.ok(d[0] > 0);
  for (let i = 1; i < d.length; i++) {
    const n = Math.min(i, ef.intensidadeMax);
    assert.ok(perto(d[i], d[0] * (1 + (n * ef.intensidadeMaisDanoPct) / 100)), `com ${n} de Intensidade: ${d[i]} ≈ ${d[0]} × ${1 + (n * ef.intensidadeMaisDanoPct) / 100}`);
  }
  // Andando: perde 1 a cada N s (o tempo desde a última conjuração conta como andando).
  const em = o.h.poeIntensidade[o.entry.id].em;
  (o.h.poeRecente ??= {}).moveu = em + 1;
  o.h.clock = em + ef.intensidadePerdaMs * 2;
  assert.equal(Acoes.intensidadeAgora(o.h, o.entry.id, ef, o.h.clock), ef.intensidadeMax - 2);
  const t = com(/^intensidade_max_extra$/);
  const x = cacada({ classe: 'Witch', base: 'Wands/Driftwood_Wand', gema: 'Ice_Nova', suportes: ['Intensify_Support'], af: { intensidade_max_extra: t.valor } });
  comSorte(0.5, () => { for (let i = 0; i < ef.intensidadeMax + 3; i++) usar(x, 1000); });
  assert.equal(Acoes.intensidadeAgora(x.h, x.entry.id, ef, x.h.clock), ef.intensidadeMax + t.valor);
});

// ---------------------------------------------------------------- as sem regra

test('NECROMANTE: "Suas Habilidades de Oferenda também afetam você", com "X% de redução do Efeito em você"', { skip: SEM }, () => {
  const { e, valor } = com(/^oferenda_em_voce$/);
  const reduzido = Number(ficha(e).afPoe.oferenda_efeito_reduzido);
  assert.ok(valor > 0 && reduzido > 0);
  const antes = ficha(e).afPoe;
  e.hunt.oferendaEmVoce = { velAtaquePct: 20, critInc: 0, critMult: 0, bloqueioPct: 10, regenPct: 0, ate: e.hunt.clock + 4000 };
  const f = ficha(e).afPoe;
  assert.equal((Number(f.atk_speed) || 0) - (Number(antes.atk_speed) || 0), 20 * (1 - reduzido / 100));
  assert.equal((Number(f.block) || 0) - (Number(antes.block) || 0), 10 * (1 - reduzido / 100));
  const sem = novo();
  const antesSem = ficha(sem).afPoe;
  sem.hunt.oferendaEmVoce = { velAtaquePct: 20, ate: sem.hunt.clock + 4000 };
  assert.equal(Number(ficha(sem).afPoe.atk_speed) || 0, Number(antesSem.atk_speed) || 0, 'sem a linha, nada');
  // Na caçada: a Oferenda usada (com um lacaio em campo) passa a valer em você.
  const o = cacada({ classe: 'Witch', base: 'Wands/Driftwood_Wand', gema: 'Flesh_Offering', af: { oferenda_em_voce: 1, oferenda_efeito_reduzido: reduzido } });
  o.h.lacaios = [{ uid: 'l1', tipo: 'lacaio', hp: 100, maxHp: 100, x: o.h.pos.x, y: o.h.pos.y + 1 }];
  usar(o, 0);
  assert.ok(o.h.oferendaEmVoce?.ate > o.h.clock && o.h.oferendaEmVoce.velAtaquePct > 0, 'a Oferenda vale em você');
});

test('MESTRE DESTILADOR: a habilidade não canalizada consome 3 Cargas do Diamante, do Bismuto e da Ametista e ganha o bônus de cada', { skip: SEM }, () => {
  const { e } = com(/^destilador_diamante_crit$/);
  const f = ficha(e);
  const frasco = (base, cargas) => { const p = peca(base); p.poe.cargas = cargas; return p; };
  e.frascos = [frasco('Utility_Flasks/Diamond_Flask', 10), frasco('Utility_Flasks/Bismuth_Flask', 10), frasco('Utility_Flasks/Amethyst_Flask', 2), null, null];
  const cleave = Acoes.POR_ID_PUBLICO(GemasPoe.doSlug('Cleave').acao);
  const g = Acoes.doDestilador(e, f, cleave);
  assert.ok(Math.abs(g.critChance - Math.min(f.critTeto ?? 1, f.critPontos * (1 + (f.critInc + f.afPoe.destilador_diamante_crit) / 100) * (f.critMais ?? 1))) < 1e-9, 'o Diamante');
  assert.equal(g.penetracao.elemental, (Number(f.penetracao?.elemental) || 0) + f.afPoe.destilador_bismuto_pen, 'o Bismuto');
  assert.equal(Number(g.afPoe.phys_as_extra_chaos) || 0, Number(f.afPoe.phys_as_extra_chaos) || 0, 'a Ametista com 2 cargas não dá');
  assert.deepEqual(e.frascos.slice(0, 3).map((p) => p.poe.cargas), [7, 7, 2]);
  const ciclone = Acoes.POR_ID_PUBLICO(GemasPoe.doSlug('Cyclone').acao);
  assert.equal(Acoes.doDestilador(e, f, ciclone), f, 'a canalizada não consome');
  assert.equal(Acoes.doDestilador(novo(), ficha(novo()), cleave).critChance, ficha(novo()).critChance, 'sem o nó, nada');
});

test('MESTRE TOXISTA e MESTRE CIRURGIÃ: o Veneno mais forte durante o Efeito de Frascos; o Frasco de Vida não se Enfileira', { skip: SEM }, () => {
  const t = com(/^veneno_mais_chance@duranteFrasco$/);
  assert.equal(Number(ficha(t.e).afPoe.veneno_mais_chance) || 0, 0, 'sem frasco ativo');
  (t.e.hunt.frascosPoe ??= { ativos: {} }).ativos[0] = { ate: t.e.hunt.clock + 5000 };
  const f = ficha(t.e);
  assert.equal(Number(f.afPoe.veneno_mais_chance), t.valor);
  const mais = Number(f.afPoe.veneno_mais_pct);
  assert.ok(mais > 0);
  // No Veneno: na chance (o sorteio abaixo dela), X% mais Dano.
  const veneno = (af, sorte) => {
    const b = bicho();
    AfeccoesPoe.aoAcertar(b, [{ elemento: 'physical', dano: 1000 }], { afeccoes: { ...AfeccoesPoe.daSoma(af), chance: { veneno: 100 } }, agora: 1000, rng: () => sorte });
    return b.dots.filter((d) => /veneno/i.test(d.tipo)).reduce((n, d) => n + d.falta, 0);
  };
  const base = veneno({}, 0);
  assert.ok(base > 0);
  assert.ok(perto(veneno({ veneno_mais_chance: t.valor, veneno_mais_pct: mais }, (t.valor - 1) / 100), base * (1 + mais / 100), 1e-9), 'dentro da chance');
  assert.equal(veneno({ veneno_mais_chance: t.valor, veneno_mais_pct: mais }, (t.valor + 1) / 100), base, 'fora dela');
  const c = com(/^frasco_vida_sem_fila$/);
  const usarDuasVezes = (e) => {
    const p = peca('Life_Flasks/Small_Life_Flask');
    e.frascos = [p, null, null, null, null];
    p.poe.cargas = FrascosPoe.parametros(p).cargasMaximas;
    e.hp = 1;
    return [FrascosPoe.usar(e, 0), FrascosPoe.usar(e, 0)];
  };
  assert.deepEqual(usarDuasVezes(c.e), [true, true], 'o segundo uso troca o efeito que corre');
  assert.deepEqual(usarDuasVezes(novo()), [true, false], 'sem a linha, espera');
});

test('WARDEN (Juramento do Verão): o Incêndio vira Causticação (até 30% menos Resistências, pelo Fogo do acerto); uma a mais em cada inimigo', { skip: SEM }, () => {
  const { e } = com(/^incendio_vira_causticacao$/);
  const a = { ...AfeccoesPoe.daSoma(ficha(e).afPoe), chance: { incendio: 100 } };
  const b = bicho({ hp: 1000, maxHp: 1000 });
  AfeccoesPoe.aoAcertar(b, [{ elemento: 'fire', dano: 50 }], { afeccoes: a, agora: 1000, rng: () => 0 });
  assert.ok(!(b.dots ?? []).some((d) => d.tipo === 'queimadura'), 'não Incendeia');
  const um = ModsPoe.causticado(b, 1000);
  assert.ok(um > 0 && um <= AfeccoesPoe.CAUSTICACAO.maximo);
  AfeccoesPoe.aoAcertar(b, [{ elemento: 'fire', dano: 200 }], { afeccoes: a, agora: 1000, rng: () => 0 });
  const dois = ModsPoe.causticado(b, 1000);
  assert.equal(b.estados.causticadosPilha.length, 2, 'duas Causticações');
  assert.ok(dois > um);
  AfeccoesPoe.aoAcertar(b, [{ elemento: 'fire', dano: 10 }], { afeccoes: a, agora: 1000, rng: () => 0 });
  assert.equal(ModsPoe.causticado(b, 1000), dois, 'ficam as duas mais fortes');
  assert.equal(ModsPoe.causticado(b, 1000 + AfeccoesPoe.CAUSTICACAO.duracaoMs + 1), 0, 'por 4 s');
  const s = bicho({ hp: 1000, maxHp: 1000 });
  AfeccoesPoe.aoAcertar(s, [{ elemento: 'fire', dano: 50 }], { afeccoes: { ...AfeccoesPoe.daSoma({}), chance: { incendio: 100 } }, agora: 1000, rng: () => 0 });
  assert.ok(s.dots.some((d) => d.tipo === 'queimadura') && ModsPoe.causticado(s, 1000) === 0, 'sem a linha, Incendeia');
});

test('ASSASSINO (Mortífero): o crítico de ataque num Raro ou Único, sem Marca nenhuma, ativa a Marca do Assassino no nível do nó', { skip: SEM }, () => {
  const { valor } = com(/^marca_assassino_ao_critico$/);
  const marcaDaGema = GemasPoe.doSlug('Assassins_Mark').acao;
  const comum = cacada({ classe: 'Shadow', base: 'Daggers/Glass_Shank', gema: 'Viper_Strike', af: { marca_assassino_ao_critico: valor } });
  comSorte(0, () => usar(comum, 0));
  assert.ok(!comum.h.buffs?.[marcaDaGema], 'o monstro comum não');
  const o = cacada({ classe: 'Shadow', base: 'Daggers/Glass_Shank', gema: 'Viper_Strike', af: { marca_assassino_ao_critico: valor } });
  o.alvo.raridade = 'raro';
  comSorte(0, () => usar(o, 0));
  assert.ok(o.h.buffs?.[marcaDaGema], 'a Marca do Assassino');
  assert.ok(ModsPoe.marcaNoBicho(o.alvo, o.h.clock), 'no alvo');
  const ate = o.h.buffs[marcaDaGema].ate;
  o.h.clock += 2000;
  comSorte(0, () => usar(o, 0));
  assert.equal(o.h.buffs[marcaDaGema].ate, ate, 'com uma Marca, não ativa de novo');
  const sem = cacada({ classe: 'Shadow', base: 'Daggers/Glass_Shank', gema: 'Viper_Strike' });
  sem.alvo.raridade = 'raro';
  comSorte(0, () => usar(sem, 0));
  assert.ok(!sem.h.buffs?.[marcaDaGema], 'sem a linha, nada');
});

test('CHEFE TRIBAL (Tukohama): "Habilidades do Peitoral Equipado são Suportadas por Chamado Ancestral / Punho da Guerra Nível N"', { skip: SEM }, () => {
  const { e, valor } = com(/^suporte_peitoral:chamado-ancestral$/);
  const punho = Number(ficha(e).afPoe['suporte_peitoral:punho-da-guerra']);
  assert.ok(punho > 0, 'o mesmo nó: o Punho da Guerra');
  const peitoral = peca('Body_Armours/Plate_Vest');
  peitoral.soquetes = { abertos: 2, links: [false], gemas: [null, null], cores: ['W', 'W'] };
  e.equipment.body = peitoral;
  const arma = peca('One_Hand_Swords/Rusted_Sword');
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment.weapon = arma;
  e.inventory = ['Heavy_Strike', 'Ground_Slam', 'Double_Strike'].map((s) => GS.itemDaGema({ id: GemasPoe.doSlug(s).itemId, nivel: 10, xp: 0, raridade: 'comum' }));
  GS.encaixar(e, { de: 0, slot: 'body', indice: 0 });
  GS.encaixar(e, { de: 0, slot: 'body', indice: 1 });
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  const ativas = GS.skillsAtivas(e);
  const doPeitoral = ativas.get(GemasPoe.doSlug('Heavy_Strike').acao);
  const daArma = ativas.get(GemasPoe.doSlug('Double_Strike').acao);
  const chamado = doPeitoral.supports.find((s) => s.def.id === GS.suportePeloNome('chamado-ancestral').id);
  assert.ok(chamado, 'o Golpe Pesado do peitoral, com o Chamado Ancestral');
  assert.equal(chamado.nivel, valor);
  assert.ok(!daArma.supports.some((s) => s.def.id === GS.suportePeloNome('chamado-ancestral').id), 'o da arma, não');
  // O Punho da Guerra é de ataque corpo a corpo em Área: a Pancada no Chão, sim; o Golpe Pesado, não.
  const pancada = ativas.get(GemasPoe.doSlug('Ground_Slam').acao).supports.find((s) => s.def.id === GS.suportePeloNome('punho-da-guerra').id);
  assert.equal(pancada?.nivel, punho);
  assert.ok(!doPeitoral.supports.some((s) => s.def.id === GS.suportePeloNome('punho-da-guerra').id));
});

test('AMBIDESTRIA: "Velocidade de Ataque com a Mão Secundária aumentada em X% enquanto em Dupla Empunhadura" — só o golpe da secundária', { skip: SEM }, () => {
  const { e, valor } = com(/^atk_speed_mao_secundaria@duasArmas$/);
  const a = { aps: { intervaloMs: 800 } };
  const b = { aps: { intervaloMs: 600 } };
  assert.equal(Ficha.intervaloBaseDoGolpe(a, b, { atk_speed_mao_secundaria: valor }), (800 + 600 / (1 + valor / 100)) / 2);
  assert.equal(Ficha.intervaloBaseDoGolpe(a, null, { atk_speed_mao_secundaria: valor }), 800, 'com uma arma, nada');
  assert.equal(Number(ficha(e).afPoe.atk_speed_mao_secundaria) || 0, 0, 'sem duas armas, a linha não vale');
  const duas = (x) => { x.equipment = { weapon: peca('One_Hand_Swords/Rusted_Sword'), shield: peca('One_Hand_Swords/Rusted_Sword') }; return ficha(x); };
  const comLinha = duas(e);
  assert.equal(Number(comLinha.afPoe.atk_speed_mao_secundaria), valor);
  assert.ok(comLinha.intervaloDoGolpeMs < duas(novo()).intervaloDoGolpeMs, 'o golpe com duas armas fica mais curto');
});

test('FORÇA CONCUSSIVA: "Incêndios de Acertos Corpo a Corpo Atordoantes causam X% mais Dano" — o acerto que atordoou', { skip: SEM }, () => {
  const { valor } = com(/^incendio_atordoante_mais$/);
  // (o mesmo monstro: três usos sem a linha, três com ela — o terceiro e o sexto são Impiedosos e atordoam)
  const o = cacada({ gema: 'Heavy_Strike', suportes: ['Ruthless_Support'], af: { chance_ignite: 100, phys_as_extra_fire: 100 } });
  const incendioDoTerceiro = () => {
    comSorte(0.5, () => { usar(o); usar(o); });
    o.alvo.dots = [];
    comSorte(0.5, () => usar(o));
    assert.ok(o.alvo.estados.atordoado, 'o terceiro (Impiedoso) atordoou');
    return Math.max(...o.alvo.dots.filter((d) => d.tipo === 'queimadura').map((d) => d.falta));
  };
  const sem = incendioDoTerceiro();
  assert.ok(sem > 0);
  comAnel(o.e, { chance_ignite: 100, phys_as_extra_fire: 100, incendio_atordoante_mais: valor });
  o.h.clock += 10000;
  assert.ok(perto(incendioDoTerceiro(), sem * (1 + valor / 100)));
});

test('FORÇAS PROFANADAS: o acerto no inimigo amaldiçoado por você renova o Resfriamento e a Eletrização', { skip: SEM }, () => {
  const { e } = com(/^renova_frio_choque_amaldicoado$/);
  const agora = e.hunt.clock;
  const alvo = (maldito) => bicho({ maldicoes: maldito ? { x: { ate: agora + 5000 } } : {}, estados: { lento: { ate: agora + 300, pct: 10 }, chocado: { ate: agora + 300, pct: 10 } } });
  const m = alvo(true);
  ModsPoe.aoAcertar(e, e.hunt, m, golpe(e, ['ataque']), { dano: 1, rng: () => 0.99 });
  assert.equal(m.estados.lento.ate, agora + 2000);
  assert.equal(m.estados.chocado.ate, agora + 2000);
  const n = alvo(false);
  ModsPoe.aoAcertar(e, e.hunt, n, golpe(e, ['ataque']), { dano: 1, rng: () => 0.99 });
  assert.equal(n.estados.lento.ate, agora + 300, 'o não amaldiçoado, não');
  const s = novo();
  const k = alvo(true);
  ModsPoe.aoAcertar(s, s.hunt, k, golpe(s, ['ataque']), { dano: 1, rng: () => 0.99 });
  assert.equal(k.estados.lento.ate, agora + 300, 'sem a linha, não');
});

test('FÚRIA TRIBAL: "Habilidades de Golpe Corpo a Corpo causam Dano Propagado aos alvos ao redor" — os vizinhos do atingido', { skip: SEM }, () => {
  const { valor } = com(/^golpe_corpo_propaga$/);
  const vizinho = (af) => {
    const o = cacada({ gema: 'Heavy_Strike', monstros: 2, af });
    const v = o.h.monstros[1];
    const antes = v.hp;
    const noAlvo = comSorte(0.5, () => usar(o, 0));
    return [noAlvo, antes - v.hp];
  };
  const [alvo, propagado] = vizinho({ golpe_corpo_propaga: valor });
  assert.ok(alvo > 0 && propagado > 0, `o vizinho levou ${propagado}`);
  assert.equal(vizinho({})[1], 0, 'sem a linha, só o alvo');
});

test('REPETIÇÃO FINAL: "Repetição Final das Magias têm Efeito em Área aumentado em X%" — a última repetição pega a área maior', { skip: SEM }, () => {
  const { valor } = com(/^repeticao_final_area$/);
  const longe = (af) => {
    const o = cacada({ classe: 'Witch', base: 'Wands/Driftwood_Wand', gema: 'Ice_Nova', suportes: ['Spell_Echo_Support'], monstros: 2, af });
    const fora = o.h.monstros[1];
    // o segundo monstro um pouco além da área da Nova de Gelo
    let d = 2;
    for (; d < 12; d++) { Object.assign(fora, { x: o.h.pos.x + d, y: o.h.pos.y }); const a = fora.hp; comSorte(0.5, () => usar(o, 5000)); if (fora.hp === a) break; fora.hp = a; }
    return { d, o, fora };
  };
  const sem = longe({});
  const com_ = cacada({ classe: 'Witch', base: 'Wands/Driftwood_Wand', gema: 'Ice_Nova', suportes: ['Spell_Echo_Support'], monstros: 2, af: { repeticao_final_area: valor } });
  Object.assign(com_.h.monstros[1], { x: com_.h.pos.x + sem.d, y: com_.h.pos.y });
  const antes = com_.h.monstros[1].hp;
  comSorte(0.5, () => usar(com_, 0));
  assert.ok(com_.h.monstros[1].hp < antes, `o monstro a ${sem.d} casas (fora da área) é atingido na Repetição Final`);
});
