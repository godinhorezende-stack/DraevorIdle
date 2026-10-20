// ZERAR A ÁRVORE — LOTE 31 (dono, 15/10: "zerar as pendências da árvore passiva do PoE"; a auditoria em docs/arvore-poe-auditoria.md):
// S001 o abate é de quem deu o golpe fatal (`hunt/quem-feriu.mjs` — o do lacaio e o do totem não são seus: os eventos deles, e "qualquer
// morte"), P025 o "ao Matar Corpo a Corpo" pelo golpe fatal, P037/P063 o Provocado pelo Clamor, P044 a explosão com o tipo da linha e a defesa
// dos atingidos, P034 o atordoamento "como se causasse mais Dano de Fogo" só na parte de Fogo, P018 a Força Concussiva, o Azarado, os Sortudos
// e a penetração no não crítico também no golpe básico, P043 o Mestre do Metal como dano Físico adicional do golpe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const QuemFeriu = await import('../systems/hunt/quem-feriu.mjs');
const { resistido } = await import('../systems/hunt/resistencia.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const Registro = await import('../systems/combate/registro.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
  (await import('../systems/itens-poe/campanha.mjs')).iniciar();
}

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
function personagem(af = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.sistema = 'poe';
  e.classePoe = 'Duelist';
  const arma = peca('One_Hand_Swords/Rusted_Sword');
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  delete e.equipment.shield;
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  P.garantir(e);
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const traduzir = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const naCosta = (e) => {
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  return e.hunt;
};
/** Os monstros da caçada em volta do personagem: `n` vivos nas casas pedidas (imortais até o teste matar). */
function emVolta(h, casas) {
  const vivos = h.monstros.filter((m) => m.hp > 0 && !m.dummy);
  assert.ok(vivos.length >= casas.length, `monstros na Costa: ${vivos.length}`);
  h.monstros = vivos.slice(0, casas.length);
  return h.monstros.map((m, i) => Object.assign(m, { x: h.pos.x + casas[i][0], y: h.pos.y + casas[i][1], hp: 1e6, maxHp: 1e6, estados: {}, resist: {} }));
}
/** O Math.random numa sequência (depois dela, 0,99) durante `fn`. */
function comSequencia(seq, fn) {
  const antes = Math.random;
  let i = 0;
  Math.random = () => (i < seq.length ? seq[i++] : 0.99);
  try { return fn(); } finally { Math.random = antes; }
}

test('S001 — o abate é de quem deu o golpe fatal: o do lacaio e o do totem não dão o "ao Matar" seu nem o Matou Recentemente; dão os eventos deles e a Relíquia', { skip: SEM }, () => {
  const e = personagem({ 'ev:matar:vida': 50, 'ev:matarLacaio:vida': 7, 'ev:matarTotem:vida': 3 });
  const h = naCosta(e);
  const bichos = emVolta(h, [[1, 0], [2, 0], [3, 0], [4, 0]]);
  const matar = (m, quem, tags = null) => {
    if (quem) QuemFeriu.carimbar(m, quem, tags);
    m.hp = 0;
    e.hp = 1;
    const mortes = (h.poeMortesRecentes ?? []).length;
    const reliquia = h.poeReliquiaPendente ?? 0;
    Combate.processarMortes(e, PERSONAGEM, []);
    return { vida: e.hp - 1, matou: (h.poeMortesRecentes ?? []).length - mortes, reliquia: (h.poeReliquiaPendente ?? 0) - reliquia };
  };
  assert.deepEqual(matar(bichos[0], QuemFeriu.LACAIO), { vida: 7, matou: 0, reliquia: 1 }, 'o abate do lacaio: o evento dele; a Relíquia ("você ou um Aliado próximo")');
  assert.deepEqual(matar(bichos[1], QuemFeriu.TOTEM), { vida: 3, matou: 0, reliquia: 1 }, 'o do totem');
  assert.deepEqual(matar(bichos[2], QuemFeriu.VOCE, ['ataque', 'corpo']), { vida: 50, matou: 1, reliquia: 1 }, 'o seu');
  assert.deepEqual(matar(bichos[3], null), { vida: 50, matou: 1, reliquia: 1 }, 'sem carimbo: seu, como antes');
  // o carimbo: o último a ferir; o dano contínuo não é acerto (sem tags)
  const m = { hp: 10 };
  QuemFeriu.carimbar(m, QuemFeriu.VOCE, ['ataque', 'corpo']);
  assert.deepEqual(QuemFeriu.tagsDoAbate(m), ['ataque', 'corpo', 'acerto']);
  QuemFeriu.carimbar(m, QuemFeriu.LACAIO);
  assert.equal(QuemFeriu.abateSeu(m), false);
  assert.deepEqual(QuemFeriu.tagsDoAbate(m), []);
  assert.equal(QuemFeriu.eventoDoAbate(m), 'matarLacaio');
});

test('P025 — "ao Matar Corpo a Corpo" = o golpe fatal corpo a corpo: não a arma na mão, nem o projétil, nem o dano contínuo', { skip: SEM }, () => {
  assert.deepEqual(traduzir('{0}% de chance de Ganhar Poder Profano por {1} segundos ao Matar Corpo a Corpo', [100, 4]).efeitos, [{ stat: 'ev:matar:buffChance:poderProfano:4@corpo', valor: 100 }]);
  const fort = traduzir('Ganha {0} Fortificação ao Matar Corpo a Corpo contra um Inimigo Raro ou Único', [20]);
  assert.equal(fort.estado, 'novo');
  assert.deepEqual(fort.efeitos.map((x) => x.stat), ['ev:matar:fortificacao@corpo+alvoRaro', 'ev:matar:fortificacao@corpo+alvoUnico']);
  const e = personagem({ 'ev:matar:buffChance:poderProfano:4@corpo': 100 });
  const h = naCosta(e);
  const bichos = emVolta(h, [[1, 0], [2, 0], [3, 0], [4, 0]]);
  const deuOBuff = (m, quem, tags) => {
    delete h.poeBuffs?.poderProfano;
    QuemFeriu.carimbar(m, quem, tags);
    m.hp = 0;
    Combate.processarMortes(e, PERSONAGEM, []);
    return C.buffAtivo(e, 'poderProfano');
  };
  assert.equal(deuOBuff(bichos[0], QuemFeriu.VOCE, ['ataque', 'projetil']), false, 'o projétil (com a espada na mão): não');
  assert.equal(deuOBuff(bichos[1], QuemFeriu.VOCE, null), false, 'o dano contínuo: não');
  assert.equal(deuOBuff(bichos[2], QuemFeriu.LACAIO, ['ataque', 'corpo']), false, 'o corpo a corpo do lacaio: não é seu');
  assert.equal(deuOBuff(bichos[3], QuemFeriu.VOCE, ['ataque', 'corpo']), true, 'o seu golpe corpo a corpo: sim');
});

test('P037/P063 — "Provocados por seus Clamores": o dano sofrido só no do Clamor; a explosão no do Clamor morto por qualquer um', { skip: SEM }, () => {
  assert.deepEqual(traduzir('Inimigos Provocados por seus Clamores sofrem Dano aumentado em {0}%', [8]).efeitos, [{ stat: 'provocados_clamor_dano_sofrido', valor: 8 }]);
  assert.equal(traduzir('Inimigos Provocados por seus Clamores sofrem Dano aumentado em {0}%', [8]).estado, 'novo');
  const agora = 10000;
  const clamor = { estados: {}, provocadoAte: agora + 1000 };
  const doAcerto = { estados: { provocado: { ate: agora + 1000 } } };
  const doLacaio = { estados: { provocado: { ate: agora + 1000, deLacaio: true } } };
  const fClamor = { afPoe: { provocados_clamor_dano_sofrido: 8 } };
  const fVoce = { afPoe: { provocados_dano_sofrido: 10 } };
  assert.equal(C.fatorRecebidoPeloBicho(clamor, 'physical', fClamor, agora), 1.08);
  assert.equal(C.fatorRecebidoPeloBicho(doAcerto, 'physical', fClamor, agora), 1, 'o Provocado pelo acerto: não é do Clamor');
  // "Inimigos que você Provocar": o seu (o Clamor e o acerto), não o do totem nem o do lacaio
  assert.equal(C.fatorRecebidoPeloBicho(clamor, 'physical', fVoce, agora), 1.1);
  assert.equal(C.fatorRecebidoPeloBicho(doAcerto, 'physical', fVoce, agora), 1.1);
  assert.equal(C.fatorRecebidoPeloBicho(doLacaio, 'physical', fVoce, agora), 1);
  assert.ok(C.tagsDoAlvo(clamor, agora).includes('alvoProvocadoClamor') && C.tagsDoAlvo(clamor, agora).includes('alvoProvocado'));
  assert.ok(!C.tagsDoAlvo(doAcerto, agora).includes('alvoProvocadoClamor'));
  assert.equal(C.tagsDoAlvo(clamor, agora + 2000).includes('alvoProvocado'), false, 'acabou a provocação');
  // a explosão (a Lâmina de Cinturão Verde): o Provocado pelo Clamor que o LACAIO matou explode; o Provocado pelo acerto, não
  const linha = traduzir('Inimigos Provocados por seus Clamores Explodem ao morrer, causando {0}% de sua Vida máxima como Dano de Caos', [8]);
  assert.equal(linha.estado, 'novo');
  const e = personagem(Object.fromEntries(linha.efeitos.map((x) => [x.stat, x.valor])));
  const h = naCosta(e);
  const [a, vizA, b, vizB] = emVolta(h, [[1, 0], [1, 1], [5, 0], [5, 1]]);
  a.provocadoAte = (h.clock ?? 0) + 5000;
  b.estados.provocado = { ate: (h.clock ?? 0) + 5000 };
  for (const m of [a, b]) { QuemFeriu.carimbar(m, QuemFeriu.LACAIO); m.hp = 0; }
  Combate.processarMortes(e, PERSONAGEM, []);
  const esperado = resistido(h, vizA, 'chaos', Math.round(1e6 * 0.08), {});
  assert.equal(1e6 - vizA.hp, esperado, 'o vizinho do Provocado pelo Clamor: 8% da vida dele, como Caos');
  assert.equal(vizB.hp, 1e6, 'o vizinho do Provocado pelo acerto: nada');
  assert.equal(vizA.poeUltimoDano.quem, QuemFeriu.VOCE, 'a explosão é sua');
});

test('P044 — a explosão do morto: o tipo de dano da linha, pela defesa de cada vizinho (a resistência dele); em quem está a 1 casa', { skip: SEM }, () => {
  const linha = traduzir('Inimigos com Sangramento Explodem quando você matá-los, causando {0}% de suas Vidas Máximas com Dano Físico', [20]);
  assert.equal(linha.estado, 'novo');
  assert.deepEqual(linha.efeitos, [{ stat: 'ev:matar:explodirChance:20:physical@alvoSangrando', valor: 100 }]);
  assert.deepEqual(traduzir('Inimigos Eletrizados que você Matar Explodem, causando {0}% de suas Vidas Máximas como Dano de Raio que não pode Eletrizar', [5]).efeitos, [{ stat: 'ev:matar:explodirChance:5:energy@alvoEletrizado', valor: 100 }]);
  const e = personagem();
  const h = naCosta(e);
  const [morto, perto, longe] = emVolta(h, [[1, 0], [2, 0], [4, 0]]);
  perto.resist = { physical: 30, chaos: 40, fire: 50 };
  const golpe = (tipo, quem) => {
    perto.hp = 1e6;
    ModsPoe.explodirMorto(h, morto, 20, [], { tipo, ...(quem ? { quem } : {}) });
    return 1e6 - perto.hp;
  };
  const bruto = Math.round(1e6 * 0.2);
  for (const tipo of ['physical', 'chaos', 'fire']) {
    const v = golpe(tipo);
    assert.equal(v, resistido(h, perto, tipo, bruto, {}), tipo);
    assert.ok(v < bruto, `${tipo}: a resistência do vizinho tira parte (${v} de ${bruto})`);
  }
  assert.equal(longe.hp, 1e6, 'a 3 casas: fora');
  golpe('fire', QuemFeriu.LACAIO);
  assert.equal(perto.poeUltimoDano.quem, QuemFeriu.LACAIO, 'a explosão do Zumbi é do lacaio');
  // pela regra da linha: o Sangrando morto por você explode em Físico
  const v = personagem(Object.fromEntries(linha.efeitos.map((x) => [x.stat, x.valor])));
  const h2 = naCosta(v);
  const [sangrando, vizinho] = emVolta(h2, [[1, 0], [2, 0]]);
  vizinho.resist = { physical: 30 };
  sangrando.dots = [{ tipo: 'sangramento', elemento: 'physical', falta: 1e5, porPulso: 1, proximo: 1e12, ate: 1e12 }];
  sangrando.hp = 0;
  Combate.processarMortes(v, PERSONAGEM, []);
  assert.equal(1e6 - vizinho.hp, resistido(h2, vizinho, 'physical', bruto, {}));
});

test('P034 — "Acertos Atordoam como se causassem X% mais Dano de Fogo Corpo a Corpo": só a parte de Fogo do acerto conta a mais', { skip: SEM }, () => {
  assert.equal(traduzir('Acertos Atordoam como se causassem {0}% mais Dano de Fogo Corpo a Corpo', [50]).estado, 'novo');
  const e = personagem({ atordoar_como_fogo_mais: 50 });
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  const g = C.fichaDoGolpe(ficha(e), ['ataque', 'corpo', 'fisico'], { estado: e });
  // limiar 1000 (a vida), 100 de dano: 20% de chance; com 100 de Fogo e 50% a mais: 30%; com 50 de Fogo: 25%
  const atordoou = (fogo, sorteio, tags = g) => ModsPoe.aoAcertar(e, e.hunt, { uid: 'a', x: 1, y: 0, hp: 1000, maxHp: 1000, estados: {} }, tags, { dano: 100, fogo, elementos: fogo ? ['physical', 'fire'] : ['physical', 'fire'], rng: () => sorteio }).atordoou;
  assert.equal(atordoou(0, 0.25), false, 'sem a parte de Fogo, nada a mais (antes: o golpe inteiro com Fogo contava 50% a mais)');
  assert.equal(atordoou(100, 0.25), true, 'todo de Fogo: 30%');
  assert.equal(atordoou(50, 0.25), false, 'metade de Fogo: 25% — não passa de 25');
  assert.equal(atordoou(50, 0.24), true);
  assert.equal(atordoou(100, 0.25, C.fichaDoGolpe(ficha(e), ['ataque', 'projetil'], { estado: e })), false, 'de longe: não é corpo a corpo');
});

test('P018 — no GOLPE BÁSICO também: a Força Concussiva (o Incêndio do acerto corpo a corpo que atordoou), o Azarado, os Sortudos e a penetração no não crítico', { skip: SEM }, () => {
  for (const [modelo, v] of [['Incêndios de Acertos Corpo a Corpo Atordoantes causam {0}% mais Dano', [20]], ['Dano com Acertos é Azarado', []], ['Acertos Não Críticos penetram {0}% das Resistências Elementais do Inimigo', [10]], ['Dano de Raio com Golpes Não-Críticos é Sortudo', []]]) {
    assert.equal(traduzir(modelo, v).estado, 'novo', modelo);
  }
  // o Incêndio do golpe básico que atordoou: o mesmo golpe (o mesmo sorteio), com e sem a linha
  const incendio = (af) => {
    const e = personagem({ chance_ignite: 100, phys_as_extra_fire: 100, ...af });
    const h = naCosta(e);
    const [alvo] = emVolta(h, [[1, 0]]);
    Object.assign(alvo, { hp: 1e9, maxHp: 10 });
    h.alvo = alvo.uid;
    const antes = Math.random;
    Math.random = () => 0.5;
    try { Combate.round(e, PERSONAGEM); } finally { Math.random = antes; }
    assert.ok(alvo.estados.atordoado, 'atordoou');
    return Math.max(0, ...(alvo.dots ?? []).filter((d) => d.tipo === 'queimadura').map((d) => d.falta));
  };
  const sem = incendio({});
  assert.ok(sem > 0, 'incendiou');
  const com = incendio({ incendio_atordoante_mais: 20 });
  assert.ok(Math.abs(com - sem * 1.2) <= 1, `20% mais (${com} × ${sem})`);
  // as partes somadas do golpe básico: o Azarado fica com o menor sorteio, o Sortudo com o maior; os dois juntos, um sorteio só
  const e = personagem();
  const h = naCosta(e);
  const [alvo] = emVolta(h, [[1, 0]]);
  alvo.resist = { fire: 40, energy: 40 };
  const parte = (af, seq, rolagem = { crit: false }, tipo = 'fire') => {
    const f = { ...C.fichaDoGolpe(ficha(e), ['ataque', 'corpo', 'fisico'], { estado: e, alvo }), danoSomado: { [tipo]: [0, 100] } };
    f.afPoe = { ...f.afPoe, ...af };
    alvo.hp = 1e6;
    return comSequencia(seq, () => Combate.danoSomadoDoPoe(e, h, alvo, f, rolagem))[0].v;
  };
  assert.equal(parte({ dano_acertos_azarado: 1 }, [0.9, 0.1]), parte({}, [0.1]), 'azarado: o menor');
  assert.equal(parte({ elemental_sortudo: 1 }, [0.1, 0.9]), parte({}, [0.9]), 'sortudo: o maior');
  assert.equal(parte({ elemental_sortudo: 1, dano_acertos_azarado: 1 }, [0.9, 0.1]), parte({}, [0.9]), 'os dois: um sorteio');
  assert.equal(parte({ raio_nao_critico_sortudo: 1 }, [0.1, 0.9], { crit: false }, 'energy'), parte({}, [0.9], { crit: false }, 'energy'), 'o Raio no não crítico: o maior');
  assert.equal(parte({ raio_nao_critico_sortudo: 1 }, [0.1, 0.9], { crit: false }, 'fire'), parte({}, [0.1], { crit: false }, 'fire'), 'o Fogo, não');
  // a penetração no não crítico: só sem crítico, só no elemental
  assert.ok(parte({ pen_nao_critico: 10 }, [0.5]) > parte({}, [0.5]), 'não crítico: penetra');
  assert.equal(parte({ pen_nao_critico: 10 }, [0.5], { crit: true }), parte({}, [0.5], { crit: true }), 'crítico: não');
});

test('P043 — o Mestre do Metal: o Físico adicional por Empalamento no alvo entra no golpe (com os aumentos), não mais depois do acerto', { skip: SEM }, () => {
  assert.equal(traduzir('Você e Aliados próximos causam de {0} a {1} de Dano Físico adicional para cada Empalar no Inimigo', [6, 12]).estado, 'novo');
  const agora = 10000;
  const f = { afPoe: { empalar_fisico_add_min: 6, empalar_fisico_add_max: 12 } };
  const empalado = (n, ate = agora + 5000) => ({ estados: { empalado: Array.from({ length: n }, () => ({ valor: 0, acertos: 1, ate })) } });
  assert.deepEqual(C.fisicoPorEmpalamento(f, empalado(3), agora), [18, 36]);
  assert.equal(C.fisicoPorEmpalamento(f, empalado(3, agora - 1), agora), null, 'os vencidos não contam');
  assert.equal(C.fisicoPorEmpalamento(f, empalado(0), agora), null);
  assert.equal(C.fisicoPorEmpalamento({ afPoe: {} }, empalado(3), agora), null, 'sem a linha');
  // depois do acerto não soma mais nada (o `extra` do acerto)
  const e = personagem({ empalar_fisico_add_min: 6, empalar_fisico_add_max: 12 });
  e.hunt = { clock: agora, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  const b = { uid: 'b', x: 1, y: 0, hp: 1e9, maxHp: 1e9, ...empalado(3) };
  const r = ModsPoe.aoAcertar(e, e.hunt, b, ficha(e), { dano: 1, fisico: 0, rng: () => 0.99 });
  assert.equal(r.extra, 0);
  // no golpe básico: a parte Física somada ganha o "aumentado" do Físico (o dobro com +100%) — sem a armadura do alvo na conta (o golpe que
  // ignora a Redução de Dano Física), que reduz menos, em proporção, o golpe maior
  const h = naCosta(e);
  const [alvo] = emVolta(h, [[1, 0]]);
  const parte = (inc) => {
    const g = C.fichaDoGolpe(ficha(e), ['ataque', 'corpo', 'fisico'], { estado: e, alvo });
    const fp = { ...g, ignoraReducaoFisica: true, danoSomado: { physical: C.fisicoPorEmpalamento(g, empalado(3, (h.clock ?? 0) + 5000), h.clock ?? 0) }, danoDoElemento: { ...(g.danoDoElemento ?? {}), physical: inc } };
    alvo.hp = 1e6;
    return comSequencia([0.5], () => Combate.danoSomadoDoPoe(e, h, alvo, fp, { crit: false }))[0].v;
  };
  const base = parte(0);
  assert.ok(base > 0);
  assert.ok(Math.abs(parte(100) - 2 * base) <= 2, `com +100% de Físico: ${parte(100)} × ${base}`);
});

test('P043 — no golpe da GEMA (Golpe Pesado): o Físico adicional por Empalamento escala como o Físico da arma no mesmo golpe', { skip: SEM }, () => {
  if (!GemasPoe.doSlug('Heavy_Strike')) return; // (sem a coleção de gemas nesta máquina)
  // o dano antes das defesas do golpe da gema no alvo com 3 Empalamentos e sem nenhum (o mesmo sorteio)
  const bruto = (af, empalamentos) => {
    const e = personagem(af);
    const arma = e.equipment.weapon;
    arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug('Heavy_Strike').itemId, nivel: 10, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
    e.actions = Array(Acoes.SLOTS).fill(null);
    e.actions[0] = { id: GemasPoe.doSlug('Heavy_Strike').acao, enabled: true, minMana: 0, conditions: [] };
    Ficha.invalidar(e);
    Afixos.sincronizarMaximos(e);
    const h = naCosta(e);
    Object.assign(e, { mana: 1e6, maxMana: 1e6 });
    const [alvo] = emVolta(h, [[1, 0]]);
    Object.assign(alvo, { hp: 1e12, maxHp: 1e12, raridade: 'normal' });
    alvo.estados.empalado = Array.from({ length: empalamentos }, () => ({ valor: 0, acertos: 1, ate: (h.clock ?? 0) + 5000 }));
    const nivel = Registro.nivelDoRegistro();
    Registro.definirNivel(2);
    Registro.limparRegistro();
    const antes = Math.random;
    Math.random = () => 0.5;
    try {
      assert.equal(Acoes.disparar(e, h, PERSONAGEM, 0, alvo, { manual: true }).ok, true);
      const g = Registro.ultimosGolpes(50).filter((x) => x.origem === 'gema');
      assert.ok(g.length, 'acertou');
      return g[0].danoAntesDaResistencia;
    } finally {
      Math.random = antes;
      Registro.definirNivel(nivel);
      Registro.limparRegistro();
    }
  };
  const add = { empalar_fisico_add_min: 500, empalar_fisico_add_max: 500 };
  const [semA, comA] = [bruto(add, 0), bruto(add, 3)];
  const [semB, comB] = [bruto({ ...add, phys_dmg: 100 }, 0), bruto({ ...add, phys_dmg: 100 }, 3)];
  // o "aumentado" do Físico que o personagem já tem (a Força, no corpo a corpo): o adicional sai × (1 + ele) e, com +100%, × (2 + ele) — como
  // a arma (o golpe da arma é pequeno: a razão dele, arredondada, não serve de régua)
  const inc = (ficha(personagem(add)).danoDoElemento?.physical ?? 0) / 100;
  // (aval do dono, 20/10 — "eficácia como no PoE": o Físico adicional por Empalamento é dano ADICIONADO ao ataque, × a eficácia do dano adicionado do
  // Golpe Pesado no nível 10 — a do PoB, `damageEffectiveness` 3,433 (`GemasPoe.eficaciaDoAdicionado`): 3 × 500 × 1,04 × 3,433 ≈ 5356; antes, × 1 = 1560)
  const ef = GemasPoe.eficaciaDoAdicionado('Heavy_Strike', 10);
  assert.ok(Math.abs((comA - semA) - 1500 * (1 + inc) * ef) <= 1, `3 × 500 × ${1 + inc} × ${ef}: ${comA - semA}`);
  assert.ok(Math.abs((comB - semB) - 1500 * (2 + inc) * ef) <= 1, `3 × 500 × ${2 + inc} × ${ef}: ${comB - semB}`);
  assert.ok(Math.abs(semB / semA - (2 + inc) / (1 + inc)) < 0.05, 'a arma, na mesma proporção (com o arredondamento)');
});

test('a área do Estandarte plantado ("Inimigos Mortos próximos ao seu Estandarte") e os eventos novos válidos', { skip: SEM }, () => {
  const h = { clock: 0, buffs: { War_Banner: { ate: 5000, estandarte: { x: 0, y: 0 }, raio: 3 } } };
  assert.equal(C.pertoDoEstandarte(h, { x: 2, y: -3 }), true);
  assert.equal(C.pertoDoEstandarte(h, { x: 4, y: 0 }), false);
  assert.equal(C.pertoDoEstandarte({ clock: 6000, buffs: h.buffs }, { x: 0, y: 0 }), false, 'o Estandarte acabou');
  assert.deepEqual(traduzir('Inimigos Mortos próximos ao seu Estandarte têm {0}% de chance de Explodir, causando um décimo de sua Vida como Dano Físico', [10]).efeitos, [{ stat: 'ev:inimigoMorrer:explodirChance:10:physical@alvoPertoDoEstandarte', valor: 10 }]);
  assert.deepEqual(traduzir('Inimigos que você ou seus Totens Matarem têm {0}% de chance de Explodir, causando {1}% de sua Vida Máxima como Dano de Fogo', [25, 10]).efeitos.map((x) => x.stat), ['ev:matar:explodirChance:10:fire', 'ev:matarTotem:explodirChance:10:fire']);
  for (const k of ['ev:inimigoMorrer:explodirChance', 'ev:matarLacaio:vida', 'ev:matarTotem:vida']) assert.equal(C.dinamicoValido(k), true, k);
});
