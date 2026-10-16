// LOTE 56 — as únicas de joia SORTEADAS (J31, a segunda leva): a Doutrina Racional (1 a 3 implícitos de Síntese da Joia Cobalto, como o Nebulis;
// "Você tem Solo Sagrado ao seu redor enquanto parado se a Força for seu maior Atributo"), a Visão Sublime (1 das 17 combinações do poedb — "as
// outras Habilidades de Aura são Desabilitadas"), a Fuga Impossível (a pedra fundamental sorteada: o raio Pequeno em volta dela aloca sem
// conexão) e a Chama / Carne Proibida (o mesmo notável de ascendência nas duas: ele vale como alocado — o da sua classe).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const anel = (af) => ({ id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id), count: 1, af: [], poe: { af } });
const semente = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const unica = (slug) => Catalogo.catalogo().classes.Jewels.unicos.find((u) => u.slug === slug);
const gerar = (slug, rng = semente(5)) => {
  const base = Catalogo.catalogo().classes.Jewels.bases.find((b) => b.nome === unica(slug).base);
  return gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 84, rng, unico: slug });
};
const encaixes = () => P.arvore().nos.filter((n) => P.ehEncaixeDeJoia(n)).slice(0, 2).map((n) => n.id);
function marauder() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  e.passivas.alocados.push(...encaixes());
  P.garantir(e);
  e.inventory = [];
  return e;
}
const encaixar = (e, peca, no) => { e.inventory.push(peca); return Comandos.comando(e, { action: 'encaixarJoia', no, pilha: e.inventory.length - 1, id: peca.id }); };

test('a DOUTRINA RACIONAL: a marcação vira 1 a 3 implícitos de Síntese da Joia Cobalto; o Solo Sagrado parado se a Força for o maior Atributo', { skip: SEM }, () => {
  const vistos = new Set();
  for (let s = 1; s <= 30; s++) {
    const g = gerar('Rational_Doctrine', semente(s));
    assert.ok(!g.implicitos.some((m) => /random synthesis/.test(m.modelo ?? '')), 'sem a marcação');
    assert.ok(g.implicitos.length >= 1 && g.implicitos.length <= 3, `${g.implicitos.length}`);
    assert.ok(g.implicitos.every((m) => m.origem === 'synthesis'));
    vistos.add(g.implicitos.length);
  }
  assert.equal(vistos.size, 3, 'sai 1, 2 e 3');
  assert.deepEqual(tr('Você tem Solo Sagrado ao seu redor enquanto parado se a Força for seu maior Atributo').efeitos, [{ stat: 'periodico:1:soloSagrado:2@parado+maiorAtributo:str', valor: 100 }]);
  // a condição: a Força não perde para nenhum (o empate vale)
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  Ficha.invalidar(e);
  const af = Ficha.combate(e).afPoe;
  assert.ok(ModsPoe.vale(ModsPoe.condicoesDe(e, af, { str: 50, dex: 10, int: 50 }), 'maiorAtributo:str'));
  assert.ok(ModsPoe.vale(ModsPoe.condicoesDe(e, af, { str: 50, dex: 10, int: 50 }), 'maiorAtributo:int'), 'o empate');
  assert.ok(!ModsPoe.vale(ModsPoe.condicoesDe(e, af, { str: 10, dex: 60, int: 50 }), 'maiorAtributo:str'));
});

test('a VISÃO SUBLIME: 1 das 17 combinações; as outras auras de gema ficam Desabilitadas (não ligam)', { skip: SEM }, () => {
  const u = unica('Sublime_Vision');
  assert.equal(u.linhasSorteadas.linhas.length, 17);
  for (const l of u.linhasSorteadas.linhas) assert.ok(['novo', 'equivalente', 'aproximado'].includes(tr(l.modelo, l.faixas.map((f) => f[0])).estado), l.modelo);
  const g = gerar('Sublime_Vision');
  assert.equal(g.modificadores.filter((m) => m.sorteada).length, 1);
  assert.deepEqual(tr('Habilidades de Aura diferentes de Cólera são Desabilitadas').efeitos, [{ stat: 'aura_unica:colera', valor: 1 }]);
  // a Graça na barra: com "só a Cólera", não liga; com "só a Graça", liga
  const comGraca = (af) => {
    const e = personagemDeTeste({ vocacao: 'paladin', level: 70 });
    e.classePoe = 'Ranger';
    const arco = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Bows/Crude_Bow', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
    arco.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.equipment = { ...e.equipment, weapon: arco, ring: anel(af) };
    e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug('Grace').itemId, nivel: 10, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
    Ficha.invalidar(e);
    Afixos.sincronizarMaximos(e);
    e.actions = Array(Acoes.SLOTS).fill(null);
    e.actions[0] = { id: GemasPoe.doSlug('Grace').acao, enabled: true, minMana: 0, conditions: [] };
    assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
    Object.assign(e, { mana: 1e6, maxMana: 1e6 });
    e.hunt.clock = 100_000;
    return Acoes.disparar(e, e.hunt, PERSONAGEM, 0, null, { manual: true });
  };
  const desabilitada = comGraca({ 'aura_unica:colera': 1 });
  assert.equal(desabilitada.ok, false);
  assert.equal(desabilitada.motivo, 'AURA_DESABILITADA');
  assert.equal(comGraca({ 'aura_unica:graca': 1 }).ok, true);
  assert.equal(Acoes.auraPermitida({ afPoe: {} }), null, 'sem a joia, nenhuma regra');
});

test('a FUGA IMPOSSÍVEL: a pedra fundamental sorteada; o raio Pequeno em volta dela aloca sem conexão', { skip: SEM }, () => {
  const u = unica('Impossible_Escape');
  assert.equal(u.nomeSorteado.nomes.length, 48);
  const g = J.pecaDoJogo(gerar('Impossible_Escape'));
  const chave = Object.keys(g.poe.af).find((k) => k.startsWith('fuga_impossivel:'));
  const pedra = P.arvore().nos.find((n) => n.tipo === 'keystone' && !n.ascendencia && ModsPoe.slugDoNome(n.nome) === chave?.slice('fuga_impossivel:'.length));
  assert.ok(pedra, `${chave}: a pedra fundamental sorteada está na árvore`);
  const e = marauder();
  assert.equal(encaixar(e, g, encaixes()[0]).ok, true);
  const livres = P.liberadosPorJoias(e);
  assert.ok(livres.has(pedra.id), 'a própria pedra');
  assert.ok(livres.size > 1);
  for (const id of livres.keys()) {
    const n = P.arvore().nos.find((x) => x.id === id);
    assert.ok(Math.hypot(n.x - pedra.x, n.y - pedra.y) <= P.RAIOS_DE_JOIA.pequeno, `${n.nome}: no raio Pequeno da pedra`);
  }
});

test('a CHAMA e a CARNE PROIBIDA: o mesmo notável de ascendência da sua classe nas duas vale como alocado; de outra classe, não', { skip: SEM }, () => {
  assert.equal(unica('Forbidden_Flame').nomeSorteado.nomes.length, 161);
  const asc = (classe) => P.arvore().nos.find((n) => n.ascendencia && n.tipo === 'notable' && P.arvore().ascendencias[n.ascendencia].classe === classe && (n.efeitos ?? []).some((ef) => ef.add));
  const doMarauder = asc('Marauder');
  const daBruxa = asc('Witch');
  for (const [no, vale] of [[doMarauder, true], [daBruxa, false]]) {
    const e = marauder();
    const [a, b] = encaixes();
    const chama = J.pecaDoJogo(gerar('Forbidden_Flame'));
    const carne = J.pecaDoJogo(gerar('Forbidden_Flesh'));
    chama.poe.af = { [`proibida_chama:${ModsPoe.slugDoNome(no.nome)}`]: 1 };
    carne.poe.af = { [`proibida_carne:${ModsPoe.slugDoNome(no.nome)}`]: 1 };
    assert.equal(encaixar(e, chama, a).ok, true);
    assert.deepEqual(P.alocadosPelasProibidas(e), [], 'só a Chama: nada');
    assert.equal(encaixar(e, carne, b).ok, true);
    assert.deepEqual(P.alocadosPelasProibidas(e), vale ? [no.id] : [], no.nome);
    if (vale) {
      const ef = no.efeitos.find((x) => x.add && typeof x.valor === 'number');
      assert.ok((P.efeitos(e).adds[ef.add] ?? 0) >= ef.valor, `${no.nome}: ${ef.add}`);
    }
  }
  assert.deepEqual(tr('Aloca Inspirador se você possuir o modificador correspondente na Carne Proibida').efeitos, [{ stat: 'proibida_chama:inspirador', valor: 1 }]);
});
