// O CONVOCAR O AÇO do PoE (Call of Steel — dono, 12/10: "pode seguir com convocar o aço") de ponta a ponta: as gemas de Aço concedem o
// Convocar o Aço, que sai sozinho, chama os empalamentos dos inimigos vivos e dos cadáveres, reflete o dano em volta de cada um e recarrega os
// Fragmentos de Aço; as gemas reais gastam os fragmentos como no PoE; e os nós REAIS da árvore de cada linha (uma opção da Maestria de
// Empalamento por personagem, como no PoE).
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
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Aco = await import('../systems/itens-poe/convocar-o-aco.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const { resistido } = await import('../systems/hunt/resistencia.mjs');

/** Uma Duelista com `gemas` encaixadas (sem ligação) num Machado Vaal, na barra, numa caçada do PoE; `af`: atributos no machado. */
async function duelistaCom(gemas, af = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.sistema = 'poe';
  e.classePoe = 'Duelist';
  const n = gemas.length;
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: Math.max(1, n), links: Array.from({ length: Math.max(0, n - 1) }, () => false), gemas: Array(Math.max(1, n)).fill(null), cores: Array(Math.max(1, n)).fill('W') };
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 1, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  gemas.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 100_000;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  return e;
}
/** Os primeiros bichos da caçada parados em `posicoes` ([dx, dy] de você), com muita vida; os outros longe. */
function bichos(e, posicoes) {
  const lista = e.hunt.monstros;
  lista.forEach((m, i) => {
    const p = posicoes[i];
    Object.assign(m, p ? { x: e.hunt.pos.x + p[0], y: e.hunt.pos.y + p[1], hp: 1e9, maxHp: 1e9 } : { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
    m.estados = {};
  });
  return lista.slice(0, posicoes.length);
}
/** Usa o slot no alvo com `fragmentos` Fragmentos de Aço, `ms` depois do último uso. Devolve os eventos. */
function usar(e, slot, alvo, fragmentos = null, ms = 10_000) {
  e.hunt.clock += ms;
  if (fragmentos != null) Aco.aco(e.hunt).fragmentos = fragmentos;
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, alvo, {});
  assert.ok(r.ok, r.erro);
  return r.eventos ?? [];
}
const tiros = (eventos) => eventos.filter((x) => x.t === 'shot').length;
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const empalamentos = (e, lista) => lista.map(([valor, acertos]) => ({ valor, acertos, ate: e.hunt.clock + 5000 }));
const reflexo = (e, m, bruto) => Math.max(1, Math.round(resistido(e.hunt, m, 'physical', bruto, null, { armadura: false })));
function passar(e, ms) {
  for (let t = 0; t < ms; t += 250) {
    e.hunt.clock += 250;
    Acoes.tiqueDoAco(e, e.hunt, PERSONAGEM);
  }
}

/** Aloca o nó (principal ou maestria) com um efeito cuja chave casa `re`. */
function alocar(e, re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  let no = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  let opcao = null;
  if (!no) for (const n of arv.nos.filter((x) => x.tipo === 'mastery' && !x.ascendencia)) { const o = (n.opcoes ?? []).find((x) => tem(x.efeitos)); if (o) { no = n; opcao = o.id; break; } }
  assert.ok(no, `há nó com ${re}`);
  const ate = no.tipo === 'mastery' ? arv.nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia).id : no.id;
  const caminho = P.caminhoAte(e, ate);
  const antes = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
  if (antes.length) assert.equal(Comandos.comando(e, { action: 'alocar', ids: antes }).feitos, antes.length);
  assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id, ...(opcao ? { opcao } : {}) }).ok);
  Ficha.invalidar(e);
}

test('as GEMAS de Aço: as linhas dos Fragmentos de Aço contam como feitas; a divisão do Aço Violento ("se Partem na direção de N alvos") sai', { skip: SEM }, async () => {
  await duelistaCom([]);
  assert.equal(G.doSlug('Shattering_Steel_of_Ammunition').statusNoJogo, 'funciona');
  for (const s of ['Lancing_Steel', 'Splitting_Steel_of_Ammunition', 'Shrapnel_Ballista_of_Steel', 'Shattering_Steel_of_Ammunition']) {
    assert.ok(!G.doSlug(s).motivosNoJogo.some((m) => /Fragmento|Proteção de Aço/.test(m)), `${s}: ${G.doSlug(s).motivosNoJogo}`);
  }
  // (o que ainda falta: "Acertos após o primeiro em cada Inimigo causam 60% menos Dano" do Aço Perfurador)
  assert.deepEqual(G.doSlug('Lancing_Steel').motivosNoJogo, ['efeito não simulado: Acertos aós o primeiro em cada Inimigo causam 60 % menos Dano']);
  assert.equal(G.alvosNoNivel('Splitting_Steel', 1).divide, 2);
  assert.equal(G.alvosNoNivel('Splitting_Steel_of_Ammunition', 1).divide, 4);
});

test('o CONVOCAR O AÇO só com gema de Aço (ou "Concede Chamado do Aço"); sai sozinho com os fragmentos acabando, ocupa 0,5 s e recarrega 4 a cada 0,5 s até 12', { skip: SEM }, async () => {
  const sem = await duelistaCom(['Splitting_Steel']);
  bichos(sem, [[2, 0]]);
  assert.deepEqual(Acoes.convocarOAco(sem, sem.hunt, PERSONAGEM), [], 'o Aço Violento (sem o tipo Aço) não concede');
  assert.equal(sem.hunt.aco, undefined);
  const verme = await duelistaCom(['Splitting_Steel'], { concede_convocar_aco: 1 });
  bichos(verme, [[2, 0]]);
  assert.ok(Acoes.convocarOAco(verme, verme.hunt, PERSONAGEM).length, '"Concede Chamado do Aço" (o Verme de Aço)');

  const e = await duelistaCom(['Lancing_Steel']);
  bichos(e, [[2, 0]]);
  const ev = Acoes.convocarOAco(e, e.hunt, PERSONAGEM);
  assert.ok(ev.length);
  assert.equal(e.hunt.cooldowns[Acoes.GRUPO_DO_POE].total, 500, 'o tempo de uso: 0,5 s');
  assert.deepEqual(Acoes.convocarOAco(e, e.hunt, PERSONAGEM), [], 'com o relógio de ação ocupado, não sai de novo');
  const linha = [];
  for (let i = 0; i < 8; i++) { passar(e, 250); linha.push(e.hunt.aco.fragmentos); }
  assert.deepEqual(linha, [0, 4, 4, 8, 8, 12, 12, 12]);
  assert.equal(e.hunt.aco.recarregando, false, 'no máximo, a recarga para');
  assert.deepEqual(Acoes.convocarOAco(e, e.hunt, PERSONAGEM), [], 'cheio, não chama (sem empalamentos)');
  // ("Grants 4 Steel Shards every 0.5 seconds" é do tipo Recarga: a Recuperação de Recarga acelera.)
  assert.equal(Aco.intervaloMs({ recuperacaoDeRecarga: 100 }), 250);
  // Sem inimigo perto, não sai (o automático é em combate).
  const longe = await duelistaCom(['Lancing_Steel']);
  bichos(longe, [[20, 0]]);
  assert.deepEqual(Acoes.convocarOAco(longe, longe.hunt, PERSONAGEM), []);
});

test('a CHAMADA: os empalamentos dos vivos e dos CADÁVERES a até 6 casas; o reflexo em volta de cada um = o dano × os acertos que restavam; +1 fragmento por empalamento; O Empalador segura os seus', { skip: SEM }, async () => {
  const e = await duelistaCom(['Lancing_Steel']);
  const [b1, b2, b3, b4] = bichos(e, [[2, 0], [3, 0], [2, 3], [10, 0]]);
  b1.estados.empalado = empalamentos(e, [[100, 3], [50, 5]]);
  // ("Por 5 segundos após você Empalar Inimigos, … Chamado do Aço não pode remover Empalamentos deles")
  b3.estados.empalado = empalamentos(e, [[70, 5]]);
  b3.estados.empalarBloqueadoAte = e.hunt.clock + 5000;
  b4.estados.empalado = empalamentos(e, [[70, 5]]);
  const cadaver = { key: 'x', nome: 'morto', x: e.hunt.pos.x + 4, y: e.hunt.pos.y + 1, empalado: empalamentos(e, [[40, 2]]) };
  e.hunt.cadaveres = [cadaver];
  const vida = [b1, b2, b3, b4].map((m) => m.hp);
  Object.assign(Aco.aco(e.hunt), { fragmentos: 9, recarregando: true, proxima: e.hunt.clock + 400 });
  // (cheio de fragmentos e recarregando, chama pelos empalamentos do cadáver — que senão se perdem)
  assert.ok(Aco.quer(e.hunt, ficha(e), { consumo: 4, centro: e.hunt.pos, raio: 6 }));
  assert.ok(Acoes.convocarOAco(e, e.hunt, PERSONAGEM).length);
  assert.equal(vida[0] - b1.hp, reflexo(e, b1, 550), 'b1: os dele (100×3 + 50×5)');
  assert.equal(vida[1] - b2.hp, reflexo(e, b2, 550) + reflexo(e, b2, 80), 'b2, ao lado de b1 e do cadáver: os dois reflexos');
  assert.equal(vida[2] - b3.hp, 0);
  assert.equal(vida[3] - b4.hp, 0);
  assert.deepEqual(b1.estados.empalado, []);
  assert.deepEqual(cadaver.empalado, []);
  assert.equal(b3.estados.empalado.length, 1, 'O Empalador: ainda não pode remover');
  assert.equal(b4.estados.empalado.length, 1, 'fora das 6 casas');
  assert.equal(e.hunt.aco.fragmentos, 12, '9 + 3 empalamentos');
  // O automático: 5 empalamentos nos vivos chamam; 4, não (com os fragmentos cheios).
  Object.assign(e.hunt.aco, { fragmentos: 12, recarregando: false });
  b1.estados.empalado = empalamentos(e, [[1, 1], [1, 1], [1, 1], [1, 1]]);
  assert.equal(Aco.quer(e.hunt, ficha(e), { consumo: 4, centro: e.hunt.pos, raio: 6 }), false);
  b1.estados.empalado.push(...empalamentos(e, [[1, 1]]));
  assert.equal(Aco.quer(e.hunt, ficha(e), { consumo: 4, centro: e.hunt.pos, raio: 6 }), true);
});

test('o CADÁVER guarda os empalamentos do morto (o Convocar o Aço os chama "de inimigos, vivos ou mortos")', { skip: SEM }, async () => {
  const e = await duelistaCom(['Lancing_Steel']);
  const [b] = bichos(e, [[2, 0]]);
  b.estados.empalado = empalamentos(e, [[30, 4], [20, 1]]);
  b.hp = 0;
  e.hunt.cadaveres = [];
  Combate.processarMortes(e, PERSONAGEM, []);
  assert.equal(e.hunt.cadaveres.at(-1).empalado.length, 2);
});

test('o AÇO PERFURADOR gasta até 4: 4 projéteis sem fragmento, 12 com 4 ("50% mais Projéteis por Fragmento de Aço consumido"); gastar PARA a recarga', { skip: SEM }, async () => {
  const e = await duelistaCom(['Lancing_Steel']);
  const [b] = bichos(e, [[2, 0]]);
  Object.assign(Aco.aco(e.hunt), { recarregando: true, proxima: e.hunt.clock + 20_000 });
  assert.equal(tiros(usar(e, 0, b, 12)), 12);
  assert.equal(e.hunt.aco.fragmentos, 8);
  assert.equal(e.hunt.aco.recarregando, false, '"até você chegar ao máximo ou gastá-los"');
  assert.equal(tiros(usar(e, 0, b, 2)), 8, 'com 2: 4 × 2');
  assert.equal(e.hunt.aco.fragmentos, 0);
  assert.equal(tiros(usar(e, 0, b, 0)), 4);
});

test('o AÇO ESTRAÇALHADOR DA MUNIÇÃO: sem fragmento só 1 projétil; com 2+, gasta 2, dispara 3 e ganha uma Proteção de Aço (+8% de Bloquear o Dano de Ataques de Projéteis, 6 s, até 6); o dano a mais cai com a distância', { skip: SEM }, async () => {
  const e = await duelistaCom(['Shattering_Steel_of_Ammunition']);
  const [b] = bichos(e, [[1, 0]]);
  assert.equal(tiros(usar(e, 0, b, 0)), 1);
  assert.equal(e.hunt.aco.protecoes.length, 0);
  assert.equal(tiros(usar(e, 0, b, 1)), 3, 'com 1 fragmento: os 3 (mas sem Proteção)');
  assert.equal(e.hunt.aco.protecoes.length, 0, 'a Proteção pede ao menos 2');
  assert.equal(tiros(usar(e, 0, b, 12)), 3);
  assert.equal(e.hunt.aco.fragmentos, 10);
  assert.equal(ficha(e).afPoe.bloqueio_projetil, 8);
  passar(e, 6250);
  assert.equal(ficha(e).afPoe.bloqueio_projetil ?? 0, 0, 'acabou em 6 s');
  const d = Aco.daGema(G.textosDaGema('Shattering_Steel_of_Ammunition', 20).linhas);
  for (let i = 0; i < 7; i++) Aco.ganharProtecao(e.hunt, d, 2, 6000);
  assert.equal(e.hunt.aco.protecoes.length, 6, 'máximo de 6');
  assert.equal(ficha(e).afPoe.bloqueio_projetil, 48);
  assert.equal(d.maisDanoPct, 110);
  assert.equal(d.consome, 2);
  assert.ok(Math.abs(Aco.fatorDoDano(d, 2, 1) - (1 + (220 * 50) / 60 / 100)) < 1e-9, 'a 1 casa (20 unidades): 5/6 do bônus');
  assert.equal(Aco.fatorDoDano(d, 2, 4), 1, 'a 4 casas: nada');
  assert.equal(Aco.fatorDoDano(d, 0, 1), 1);
});

test('o AÇO VIOLENTO DA MUNIÇÃO: com fragmento, a divisão; sem, os projéteis "contam como se já tivessem se Partido"', { skip: SEM }, async () => {
  const e = await duelistaCom(['Splitting_Steel_of_Ammunition', 'Splitting_Steel']);
  const [b] = bichos(e, [[2, 0]]);
  assert.equal(tiros(usar(e, 0, b, 12)), 5, '1 + a divisão em 4 alvos');
  assert.equal(e.hunt.aco.fragmentos, 10);
  assert.equal(tiros(usar(e, 0, b, 0)), 1);
  assert.equal(tiros(usar(e, 1, b, 0)), 3, 'o Aço Violento comum divide sempre (2 alvos no nível 1)');
});

test('a BALISTA DE CERCO DO AÇO: o ataque do totem gasta 1 dos SEUS fragmentos; sem fragmento, só 1 projétil', { skip: SEM }, async () => {
  const e = await duelistaCom(['Shrapnel_Ballista_of_Steel']);
  const [b] = bichos(e, [[2, 0]]);
  assert.deepEqual(Acoes.convocarOAco(e, e.hunt, PERSONAGEM), [], 'a Balista não concede o Convocar o Aço (não tem o tipo Aço)');
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Shrapnel_Ballista_of_Steel').acao);
  const totem = (frag) => {
    Aco.aco(e.hunt).fragmentos = frag;
    return Acoes.projeteisDoTotem(e, entry, { origem: { x: b.x - 1, y: b.y }, alvo: b, vivos: [b] }).emitidos.length;
  };
  assert.equal(totem(5), 3, '"Dispara 3 Flechas"');
  assert.equal(e.hunt.aco.fragmentos, 4);
  assert.equal(totem(0), 1);
});

test('o VERME DE AÇO: "Consomem até 1 Fragmentos de Aço adicionais" e "3 Projéteis adicionais por 4 segundos após você consumir um total de 8"', { skip: SEM }, async () => {
  const e = await duelistaCom(['Lancing_Steel'], { aco_consome_extra: 1, aco_proj_extra: 3, aco_proj_extra_s: 4, aco_proj_extra_total: 8 });
  const [b] = bichos(e, [[2, 0]]);
  assert.equal(tiros(usar(e, 0, b, 12)), 12, 'o "mais Projéteis" vai só até os 4 da gema');
  assert.equal(e.hunt.aco.fragmentos, 7, 'gastou 5');
  usar(e, 0, b, 12);
  assert.equal(e.hunt.aco.bonusAte, e.hunt.clock + 4000, '10 consumidos: a janela de 4 s abriu');
  assert.equal(tiros(usar(e, 0, b, 0, 2000)), 4 + 3, 'os 3 a mais');
  assert.equal(tiros(usar(e, 0, b, 0, 2500)), 4, 'passaram os 4 s');
});

test('a ÁRVORE (uma opção da Maestria de Empalamento por personagem): +4 ao máximo e Dano Refletido +10%; Área do reflexo +40% e Velocidade de Uso +40%', { skip: SEM }, async () => {
  const e = await duelistaCom(['Lancing_Steel']);
  alocar(e, /^fragmentos_aco_max$/);
  assert.equal(Aco.maximo(ficha(e)), 16);
  const [b] = bichos(e, [[2, 0]]);
  b.estados.empalado = empalamentos(e, [[100, 1]]);
  const vida = b.hp;
  assert.ok(Acoes.convocarOAco(e, e.hunt, PERSONAGEM).length);
  assert.equal(vida - b.hp, reflexo(e, b, 110), '100 × 1,10');
  passar(e, 2500);
  assert.equal(e.hunt.aco.fragmentos, 16);

  const u = await duelistaCom(['Lancing_Steel']);
  alocar(u, /^aco_uso_inc$/);
  bichos(u, [[2, 0]]);
  assert.ok(Acoes.convocarOAco(u, u.hunt, PERSONAGEM).length);
  assert.equal(u.hunt.cooldowns[Acoes.GRUPO_DO_POE].total, Math.round(500 / 1.4));
  assert.equal(Aco.raioDoReflexo(ficha(u), () => 0.99), 2, '+40%: +1 casa (a fração vira chance)');
  assert.equal(Aco.raioDoReflexo(ficha(u), () => 0), 3);
  assert.equal(Aco.raioDoReflexo({ afPoe: {} }, () => 0), 1);
});

test('"20% de chance de, ao Acertar, remover todos os Empalamentos" + "Empalamentos removidos desta forma multiplicam…": o acerto que remove solta o dano × os acertos que restavam', { skip: SEM }, async () => {
  const e = await duelistaCom(['Lancing_Steel']);
  alocar(e, /^empalar_removidos_multiplicam$/);
  assert.equal(ficha(e).afPoe.empalar_remover_chance, 20);
  assert.equal(ficha(e).afPoe.empalar_removidos_multiplicam, 1);
  const extra = (multiplica) => {
    const [b] = bichos(e, [[2, 0]]);
    b.estados.empalado = empalamentos(e, [[100, 3], [50, 5]]);
    const f = { ...ficha(e), afPoe: { ...ficha(e).afPoe, empalar_remover_chance: 100, empalar_removidos_multiplicam: multiplica } };
    const r = ModsPoe.aoAcertar(e, e.hunt, b, f, { dano: 1, fisico: 0, rng: () => 0 });
    assert.deepEqual(b.estados.empalado, [], 'removidos');
    return { extra: r.extra, b };
  };
  const com = extra(1);
  assert.equal(com.extra, reflexo(e, com.b, 100 * 3 + 50 * 5));
  const sem = extra(0);
  assert.equal(sem.extra, reflexo(e, sem.b, 150), 'sem a linha: só o deste acerto');
});

test('na CAÇADA: com o Aço Perfurador na barra, o Convocar o Aço sai sozinho e os golpes gastam os fragmentos', { skip: SEM }, async () => {
  const e = await duelistaCom(['Lancing_Steel']);
  bichos(e, [[2, 0]]);
  let t = Date.now();
  let chamadas = 0;
  let golpesComFragmentos = 0;
  for (let i = 0; i < 40; i++) {
    const r = Cacadas.tique(e, PERSONAGEM, (t += 250));
    const ev = Array.isArray(r) ? r : r?.eventos ?? [];
    chamadas += ev.filter((x) => x.t === 'fx' && x.id === 13 && x.uid === 'player').length;
    // (o golpe com 4 fragmentos: os 12 projéteis)
    if (ev.some((x) => x.t === 'skill' && x.sk === 'poe-gema:Lancing_Steel') && tiros(ev) >= 12) golpesComFragmentos++;
  }
  assert.ok(chamadas >= 2, `chamou ${chamadas}`);
  assert.ok(golpesComFragmentos >= 2, `golpes com 4 fragmentos: ${golpesComFragmentos}`);
});

test('a ÁRVORE: as linhas do Convocar o Aço e a dos Empalamentos removidos têm efeito no balão', { skip: SEM }, () => {
  const linhas = P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i] }))));
  for (const re of [/^Convocar o Aço causa Dano Refletido com Área/, /^Convocar o Aço tem Velocidade de Uso/, /^Chamado do Aço tem \+\d+ ao máximo/, /^Convocar o Aço causa Dano Refletido aumentado/, /^Empalamentos removidos desta forma/, /Chamado do Aço não pode remover/]) {
    const achadas = linhas.filter((l) => re.test(l.t));
    assert.ok(achadas.length > 0, `há linha ${re}`);
    for (const l of achadas) assert.ok(['equivalente', 'novo', 'aproximado'].includes(l.estado), `${l.t}: ${l.estado}`);
  }
});
