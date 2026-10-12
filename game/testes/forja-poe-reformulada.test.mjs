// A FORJA do PoE reformulada (dono, 12/10: "reformulação completa da Forja" — `systems/itens-poe/forja.mjs`): as cinco categorias (e as
// Outras), a validação do resultado desejado (nada impossível), a repetição em lotes controlada pelo servidor, as paradas, o cancelar, a
// falta de material, as mensagens repetidas e fora de ordem, a sessão (`forjaRepetir` → `forjaResultado` + o estado) e o que já existia
// (`{t:'moeda'}` e o orbe pelo Gem Atelier). Cada tentativa é a moeda de sempre (`MoedasPoe.usar`): não há motor novo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const M = await import('../systems/itens-poe/moedas.mjs');
const F = await import('../systems/itens-poe/forja.mjs');
const Gemas = await import('../systems/skills/gemas.mjs');
const Regras = await import('../engine/forja-poe.mjs');
const SocketsPoe = await import('../systems/itens-poe/sockets.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

/** Um sorteio com semente (o mesmo resultado a cada rodada). */
function rngDe(semente) {
  let s = typeof semente === 'number' ? semente : [...String(semente)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const gerar = (base, raridade, ilvl) => Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl, rng: rngDe(`${base}${raridade}${ilvl}`) }));
const soquetes = (abertos, { max = 6, links = [], cores = null, gemas = [] } = {}) => ({
  abertos, links: Array.from({ length: max - 1 }, (_, i) => !!links[i]), gemas: Array.from({ length: max }, (_, i) => gemas[i] ?? null),
  cores: cores ?? Array(max).fill('R'),
});
/** Um personagem com as peças na mochila (na ordem) e as moedas `{ slug: quantidade }` depois delas. */
function personagem(pecas = [], moedas = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.inventory = [...pecas, ...Object.entries(moedas).map(([slug, n]) => ({ id: M.idDa(slug), count: n }))];
  return e;
}
const quantas = (e, slug) => (e.inventory ?? []).filter((x) => x.id === M.idDa(slug)).reduce((t, x) => t + (x.count ?? 1), 0);
const NA_MOCHILA = { onde: 'inventory', indice: 0 };
/** Roda uma repetição inteira (lote a lote, como a tela faz): devolve a última resposta, todas e o guardado. */
function rodar(e, m, { rng = rngDe(m.id ?? 'x'), guardado = null, lotes = 400 } = {}) {
  let g = guardado;
  let r;
  const respostas = [];
  let passo = 0;
  do {
    r = F.repetir(e, g, { ...m, passo }, rng);
    g = r.guardado;
    respostas.push(r.resposta);
    passo++;
  } while (!r.resposta.fim && passo < lotes);
  return { resposta: r.resposta, respostas, guardado: g };
}

// ---------------------------------------------------------------- as categorias
test('as categorias: TODA moeda com efeito está numa lista (sem cair por sobra), a sem efeito em "Sem efeito no jogo"; o catálogo leva a categoria e o "repete"', { skip: SEM }, () => {
  // (dono, 12/10: "quero que veja todas moeda para colocar em algum desses, podendo ser criado mais abas")
  const listadas = Object.values(M.MOEDAS_DA_CATEGORIA).flat();
  assert.equal(new Set(listadas).size, listadas.length, 'nenhuma moeda em duas categorias');
  for (const m of M.MOEDAS) {
    if (M.STATUS[m.slug].status === 'nao') assert.equal(M.categoriaDaMoeda(m.slug), 'semEfeito', m.slug);
    else assert.ok(listadas.includes(m.slug), `${m.slug} com efeito e sem categoria`);
  }
  assert.deepEqual(Object.keys(M.MOEDAS_DA_CATEGORIA).sort(), Regras.CATEGORIAS.filter((c) => c !== 'semEfeito').sort(), 'as categorias da tela e as das moedas são as mesmas');
  const esperado = {
    Jewellers_Orb: 'sockets', Chromatic_Orb: 'cores', Orb_of_Fusing: 'links', Chaos_Orb: 'atributos', Orb_of_Alteration: 'atributos', Divine_Orb: 'atributos',
    Exalted_Orb: 'atributos', Orb_of_Alchemy: 'raridade', Orb_of_Chance: 'raridade', Orb_of_Scouring: 'raridade', Blessed_Orb: 'implicitos', Sacred_Orb: 'implicitos',
    Shapers_Exalted_Orb: 'influencia', Orb_of_Dominance: 'influencia', Lesser_Eldritch_Ember: 'ancestral', Orb_of_Conflict: 'ancestral',
    Blacksmiths_Whetstone: 'qualidade', Glassblowers_Bauble: 'qualidade', Vaal_Orb: 'corrupcao', Tainted_Chaos_Orb: 'corrupcao',
    Mirror_of_Kalandra: 'especiais', Orb_of_Regret: 'especiais', Gemcutters_Prism: 'gemas', Chaos_Shard: 'lascas', Portal_Scroll: 'semEfeito',
  };
  for (const [slug, cat] of Object.entries(esperado)) {
    assert.equal(M.categoriaDaMoeda(slug), cat, slug);
    const meta = ITEM_CATALOG[M.idDa(slug)];
    assert.equal(meta?.moedaPoe?.categoria, cat, `catálogo: ${slug}`);
    assert.equal(meta.moedaPoe.repete, M.REPETE.has(slug), `repete: ${slug}`);
  }
  for (const m of M.MOEDAS) assert.ok(Regras.CATEGORIAS.includes(M.categoriaDaMoeda(m.slug)), m.slug);
  // Só as categorias com resultado desejado repetem.
  for (const slug of M.REPETE) assert.ok(Regras.COM_DESEJO.has(M.categoriaDaMoeda(slug)), `${slug} repete fora de uma categoria com desejo`);
  // As que somam ou tiram não repetem; as que sorteiam de novo, sim.
  for (const slug of ['Exalted_Orb', 'Orb_of_Annulment', 'Orb_of_Augmentation', 'Orb_of_Transmutation']) assert.equal(M.REPETE.has(slug), false, slug);
  for (const slug of ['Jewellers_Orb', 'Chromatic_Orb', 'Orb_of_Fusing', 'Chaos_Orb', 'Orb_of_Alteration', 'Divine_Orb', 'Orb_of_Chance']) assert.equal(M.REPETE.has(slug), true, slug);
});

// ---------------------------------------------------------------- SOCKETS
test('Sockets: o máximo é o da peça (classe × item level); desejo fora dele é recusado; a repetição para no desejo e nunca passa do máximo', { skip: SEM }, () => {
  const baixa = gerar('Body_Armours/Plate_Vest', 'raro', 20); // item level 20: até 3 sockets (o 4º pede 25)
  baixa.soquetes = soquetes(1, { max: 3 });
  const alta = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  alta.soquetes = soquetes(1);
  const anel = gerar('Rings/Ruby_Ring', 'raro', 60);
  assert.equal(Gemas.maximoDeSockets(ITEM_CATALOG[baixa.id], baixa), 3);
  assert.equal(Gemas.maximoDeSockets(ITEM_CATALOG[alta.id], alta), 6);
  assert.match(F.validarDesejo(baixa, 'Jewellers_Orb', 'sockets', { abertos: 4 }).erro, /de 1 a 3 sockets/);
  assert.match(F.validarDesejo(baixa, 'Jewellers_Orb', 'sockets', { abertos: 0 }).erro, /de 1 a 3/);
  assert.equal(F.validarDesejo(alta, 'Jewellers_Orb', 'sockets', { abertos: 6 }).ok, true);
  assert.match(F.validarDesejo(anel, 'Jewellers_Orb', 'sockets', { abertos: 1 }).erro, /não tem sockets/);
  // A repetição na peça da MOCHILA (a lacuna de antes: o Joalheiro só valia na vestida).
  const e = personagem([baixa], { Jewellers_Orb: 300 });
  const { resposta } = rodar(e, { id: 's1', moeda: M.idDa('Jewellers_Orb'), alvo: NA_MOCHILA, categoria: 'sockets', desejo: { abertos: 3 }, modo: 'ate' });
  assert.equal(resposta.motivo, 'atingiu', resposta.mensagem);
  assert.equal(baixa.soquetes.abertos, 3);
  assert.equal(300 - quantas(e, 'Jewellers_Orb'), resposta.feitas, 'uma moeda por tentativa');
  assert.equal(resposta.gastos[0].n, resposta.feitas);
  // No máximo, o Joalheiro não vale (e não gasta).
  const r = F.repetir(e, null, { id: 's2', passo: 0, moeda: M.idDa('Jewellers_Orb'), alvo: NA_MOCHILA, categoria: 'sockets', modo: 'uma' });
  assert.equal(r.resposta.motivo, 'erro');
  assert.match(r.resposta.mensagem, /máximo \(3 sockets\)/);
  assert.equal(r.mudou, false);
});

test('Sockets: a peça com gemas e a de "Encaixes não podem ser modificados" recusam o Joalheiro, a Fusão e o Cromático sem gastar', { skip: SEM }, () => {
  const comGema = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  const gema = Object.values(ITEM_CATALOG).find((i) => i?.gemaDef && i?.poeGema)?.id;
  comGema.soquetes = soquetes(3, { gemas: [{ id: gema, nivel: 1, xp: 0 }] });
  const e = personagem([comGema], { Jewellers_Orb: 5, Chromatic_Orb: 5 });
  for (const [slug, cat, desejo] of [['Jewellers_Orb', 'sockets', { abertos: 4 }], ['Chromatic_Orb', 'cores', { G: 1 }]]) {
    const r = F.repetir(e, null, { id: `g-${slug}`, passo: 0, moeda: M.idDa(slug), alvo: NA_MOCHILA, categoria: cat, desejo, modo: 'ate' });
    assert.match(r.resposta.mensagem, /Tire as gemas/, slug);
    assert.equal(quantas(e, slug), 5, `${slug} não foi gasto`);
  }
  // O único "Encaixes não podem ser modificados": nem pela Forja, nem pela moeda direta, nem pelo Gem Atelier.
  const travada = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  travada.soquetes = soquetes(3);
  travada.poe.af = { ...travada.poe.af, encaixes_inalteraveis: 1 };
  const e2 = personagem([travada], { Jewellers_Orb: 5, Orb_of_Fusing: 5, Chromatic_Orb: 5 });
  e2.equipment.body = travada;
  for (const slug of ['Jewellers_Orb', 'Orb_of_Fusing', 'Chromatic_Orb']) {
    const r = M.usar(e2, { moeda: M.idDa(slug), alvo: NA_MOCHILA }, rngDe(slug));
    assert.equal(r.ok, false, slug);
    assert.match(r.erro, /não podem ser modificados/, slug);
    assert.equal(quantas(e2, slug), 5, `${slug} não foi gasto`);
  }
  const tipo = { Jewellers_Orb: 'joalheiro', Orb_of_Fusing: 'fusao', Chromatic_Orb: 'cromatico' };
  for (const [slug, t] of Object.entries(tipo)) assert.match(Gemas.usarOrbeDoPoe(e2, { slot: 'body', tipo: t }).erro ?? '', /não podem ser modificados/, `Gem Atelier: ${slug}`);
  assert.match(F.validarDesejo(travada, 'Jewellers_Orb', 'sockets', { abertos: 4 }).erro, /não podem ser modificados/);
});

// ---------------------------------------------------------------- CORES
test('Cores: combinação impossível é recusada (mais cores que sockets, branco no Cromático, nada pedido); a ordem não importa', { skip: SEM }, () => {
  const p = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  p.soquetes = soquetes(3, { cores: ['R', 'R', 'R', 'R', 'R', 'R'] });
  assert.match(F.validarDesejo(p, 'Chromatic_Orb', 'cores', { R: 2, G: 2 }).erro, /4 cores para 3 sockets/);
  assert.match(F.validarDesejo(p, 'Chromatic_Orb', 'cores', { W: 1 }).erro, /não faz socket branco/);
  assert.equal(F.validarDesejo(p, 'Tainted_Chromatic_Orb', 'cores', { W: 1 }).ok, true, 'o Corroído faz branco');
  assert.match(F.validarDesejo(p, 'Chromatic_Orb', 'cores', { R: 0, G: 0, B: 0 }).erro, /pelo menos uma cor/);
  assert.match(F.validarDesejo(p, 'Chromatic_Orb', 'cores', { R: -1, G: 2 }).erro, /inteiros/);
  // A ordem não importa (como a bancada do PoE): G-B-G e G-G-B cumprem "2 verdes e 1 azul".
  const desejo = { G: 2, B: 1 };
  assert.equal(Regras.atingiu('cores', desejo, { s: { abertos: 3, cores: ['G', 'B', 'G'] } }), true);
  assert.equal(Regras.atingiu('cores', desejo, { s: { abertos: 3, cores: ['B', 'G', 'G'] } }), true);
  assert.equal(Regras.atingiu('cores', desejo, { s: { abertos: 3, cores: ['G', 'B', 'R'] } }), false);
  // Só os sockets ABERTOS contam.
  assert.equal(Regras.atingiu('cores', { G: 1 }, { s: { abertos: 1, cores: ['R', 'G'] } }), false);
  const e = personagem([p], { Chromatic_Orb: 400 });
  const { resposta } = rodar(e, { id: 'c1', moeda: M.idDa('Chromatic_Orb'), alvo: NA_MOCHILA, categoria: 'cores', desejo, modo: 'ate' });
  assert.equal(resposta.motivo, 'atingiu', resposta.mensagem);
  const n = Regras.contarCores(Gemas.soquetesDe(p));
  assert.ok(n.G >= 2 && n.B >= 1, JSON.stringify(n));
  assert.equal(p.soquetes.abertos, 3, 'o Cromático não muda o número de sockets');
});

// ---------------------------------------------------------------- LINKS
test('Links: só de 2 até os sockets abertos; o grupo ligado é de vizinhos abertos; a Fusão para no desejo e recusa a peça toda ligada', { skip: SEM }, () => {
  const p = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  p.soquetes = soquetes(4);
  assert.match(F.validarDesejo(p, 'Orb_of_Fusing', 'links', { ligados: 5 }).erro, /de 2 a 4/);
  assert.match(F.validarDesejo(p, 'Orb_of_Fusing', 'links', { ligados: 1 }).erro, /de 2 a 4/);
  const um = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  um.soquetes = soquetes(1);
  assert.match(F.validarDesejo(um, 'Orb_of_Fusing', 'links', { ligados: 2 }).erro, /pelo menos 2 sockets/);
  // O link de um socket fechado não conta (a conectividade é a do motor: `gruposLigados`).
  assert.equal(Regras.maiorGrupo({ abertos: 2, links: [true, true, true] }), 2);
  assert.equal(Regras.maiorGrupo({ abertos: 4, links: [true, false, true] }), 2);
  const e = personagem([p], { Orb_of_Fusing: 300 });
  const { resposta } = rodar(e, { id: 'l1', moeda: M.idDa('Orb_of_Fusing'), alvo: NA_MOCHILA, categoria: 'links', desejo: { ligados: 3 }, modo: 'ate' });
  assert.equal(resposta.motivo, 'atingiu', resposta.mensagem);
  assert.ok(Regras.maiorGrupo(Gemas.soquetesDe(p)) >= 3);
  // Toda ligada: a Fusão não vale (e não gasta).
  p.soquetes = soquetes(4, { links: [true, true, true] });
  const antes = quantas(e, 'Orb_of_Fusing');
  const r = F.repetir(e, null, { id: 'l2', passo: 0, moeda: M.idDa('Orb_of_Fusing'), alvo: NA_MOCHILA, categoria: 'links', modo: 'uma' });
  assert.match(r.resposta.mensagem, /toda ligada/);
  assert.equal(quantas(e, 'Orb_of_Fusing'), antes);
});

// ---------------------------------------------------------------- ATRIBUTOS
test('Atributos: os modificadores possíveis são os da base e do item level; o impossível é recusado; o Caos repete até o desejo e preserva a peça', { skip: SEM }, () => {
  const p = gerar('Body_Armours/Plate_Vest', 'raro', 30);
  p.soquetes = soquetes(2);
  const o = F.opcoes(personagem([p], { Chaos_Orb: 1 }), { alvo: NA_MOCHILA, categoria: 'atributos' });
  const vida = o.familias.find((x) => x.familia === 'IncreasedLife');
  assert.ok(vida, 'a Vida está no pool da armadura');
  assert.ok(vida.tiers.every((t) => t.ilvl <= 30), 'só os tiers que o item level 30 alcança');
  assert.ok(!vida.tiers.some((t) => t.tier === 1), 'o T1 da Vida (item level 54) não sai no 30');
  assert.match(F.validarDesejo(p, 'Chaos_Orb', 'atributos', { mods: [{ familia: 'IncreasedLife', tierMax: 1 }] }).erro, /pede item level/);
  assert.match(F.validarDesejo(p, 'Chaos_Orb', 'atributos', { mods: [{ familia: 'NaoExiste' }] }).erro, /não sai nesta peça/);
  assert.match(F.validarDesejo(p, 'Chaos_Orb', 'atributos', { mods: [{ familia: 'IncreasedLife' }, { familia: 'IncreasedLife' }] }).erro, /duas vezes/);
  assert.match(F.validarDesejo(p, 'Chaos_Orb', 'atributos', { mods: [{ familia: 'IncreasedLife', minimo: 999 }] }).erro, /no máximo até/);
  assert.match(F.validarDesejo(p, 'Exalted_Orb', 'atributos', { mods: [{ familia: 'IncreasedLife' }] }).erro, /não sorteia os modificadores de novo/);
  // Dois prefixos numa peça Mágica (a Alteração) não cabem.
  const prefixos = o.familias.filter((x) => x.lado === 'prefixo').slice(0, 2).map((x) => ({ familia: x.familia }));
  assert.match(F.validarDesejo({ ...p, poe: { ...p.poe, raridade: 'magico' } }, 'Orb_of_Alteration', 'atributos', { mods: prefixos }).erro, /cabem 1 prefixo/);
  // A repetição: a peça continua a mesma (base, raridade, implícitos, sockets), com no máximo 3 prefixos e 3 sufixos.
  const implicitos = JSON.stringify(p.poe.implicitos);
  const e = personagem([p], { Chaos_Orb: 400 });
  // (um modificador que a peça ainda não tem)
  const pedido = o.familias.find((x) => !Regras.temMod(p.poe, { familia: x.familia }));
  const desejo = { mods: [{ familia: pedido.familia }], modo: 'todos' };
  const { resposta } = rodar(e, { id: 'a1', moeda: M.idDa('Chaos_Orb'), alvo: NA_MOCHILA, categoria: 'atributos', desejo, modo: 'ate' });
  assert.equal(resposta.motivo, 'atingiu', resposta.mensagem);
  assert.ok(Regras.temMod(p.poe, { familia: pedido.familia }));
  assert.equal(p.poe.raridade, 'raro');
  assert.equal(p.poe.base, 'Body_Armours/Plate_Vest');
  assert.equal(JSON.stringify(p.poe.implicitos), implicitos, 'os implícitos ficam');
  assert.equal(p.soquetes.abertos, 2, 'os sockets ficam');
  assert.ok(p.poe.prefixos.length <= 3 && p.poe.sufixos.length <= 3);
  assert.equal(new Set([...p.poe.prefixos, ...p.poe.sufixos].map((m) => m.familia)).size, p.poe.prefixos.length + p.poe.sufixos.length, 'sem família repetida');
  // O Divino só sorteia os valores: o mod pedido precisa estar na peça.
  const fora = o.familias.find((x) => !Regras.temMod(p.poe, { familia: x.familia }));
  assert.match(F.validarDesejo(p, 'Divine_Orb', 'atributos', { mods: [{ familia: fora.familia }] }).erro, /já está na peça/);
});

// ---------------------------------------------------------------- RARIDADE
test('Raridade: as transições da Forja são as do motor (cada moeda aplicada de verdade) e o desejo inalcançável é recusado', { skip: SEM }, () => {
  const slugs = ['Orb_of_Transmutation', 'Orb_of_Alchemy', 'Regal_Orb', 'Orb_of_Scouring', 'Orb_of_Chance', 'Orb_of_Binding'];
  for (const raridade of ['normal', 'magico', 'raro']) {
    for (const slug of slugs) {
      const regra = F.resultadosDeRaridade(slug, gerar('Body_Armours/Plate_Vest', raridade, 80).poe);
      const vistos = new Set();
      for (let i = 0; i < 40; i++) {
        const p = gerar('Body_Armours/Plate_Vest', raridade, 80);
        const e = personagem([p], { [slug]: 1 });
        const r = M.usar(e, { moeda: M.idDa(slug), alvo: NA_MOCHILA }, rngDe(`${slug}${raridade}${i}`));
        if (regra.erro) {
          assert.equal(r.ok, false, `${slug} em ${raridade}: a Forja diz que não vale`);
          break;
        }
        assert.equal(r.ok, true, `${slug} em ${raridade}: ${r.erro}`);
        vistos.add(p.poe.raridade);
      }
      for (const v of vistos) assert.ok(regra.para.includes(v), `${slug} em ${raridade} deu ${v}; a Forja diz ${regra.para}`);
    }
  }
  const normal = gerar('Body_Armours/Plate_Vest', 'normal', 80);
  assert.match(F.validarDesejo(normal, 'Orb_of_Transmutation', 'raridade', { raridades: ['raro'] }).erro, /não deixa a peça Raro/);
  assert.equal(F.validarDesejo(normal, 'Orb_of_Chance', 'raridade', { raridades: ['unico'] }).ok, true, 'a base tem único');
  assert.match(F.validarDesejo(gerar('Body_Armours/Plate_Vest', 'raro', 80), 'Orb_of_Alchemy', 'raridade', { raridades: ['raro'] }).erro, /Vale em peça Normal/);
});

test('Raridade: a Chance repete com o Expurgo entre as tentativas (voltando a Normal) e para no Único ou quando o Expurgo acaba', { skip: SEM }, () => {
  const p = gerar('Body_Armours/Plate_Vest', 'normal', 80);
  const e = personagem([p], { Orb_of_Chance: 400, Orb_of_Scouring: 400 });
  const { resposta } = rodar(e, { id: 'ch1', moeda: M.idDa('Orb_of_Chance'), alvo: NA_MOCHILA, categoria: 'raridade', desejo: { raridades: ['unico'] }, modo: 'ate', reiniciar: true }, { rng: rngDe(7) });
  assert.equal(resposta.motivo, 'atingiu', resposta.mensagem);
  assert.equal(p.poe.raridade, 'unico');
  const gastoChance = 400 - quantas(e, 'Orb_of_Chance');
  const gastoExpurgo = 400 - quantas(e, 'Orb_of_Scouring');
  assert.equal(gastoChance, resposta.feitas);
  assert.equal(gastoExpurgo, resposta.feitas - 1, 'um Expurgo entre uma Chance e a próxima');
  // Sem Expurgo: a segunda tentativa já não vale (a peça deixou de ser Normal) — para.
  const q = gerar('Body_Armours/Plate_Vest', 'normal', 80);
  const e2 = personagem([q], { Orb_of_Chance: 10, Orb_of_Scouring: 1 });
  const r2 = rodar(e2, { id: 'ch2', moeda: M.idDa('Orb_of_Chance'), alvo: NA_MOCHILA, categoria: 'raridade', desejo: { raridades: ['unico'] }, modo: 'limite', limite: 10, reiniciar: true }, { rng: rngDe(3) });
  assert.ok(['semMaterial', 'atingiu'].includes(r2.resposta.motivo), r2.resposta.motivo);
  if (r2.resposta.motivo === 'semMaterial') assert.match(r2.resposta.mensagem, /Expurgo/);
});

// ---------------------------------------------------------------- a REPETIÇÃO e as PARADAS
test('Repetição: lotes de no máximo LOTE tentativas; o limite para exatamente nele; "uma tentativa" é uma', { skip: SEM }, () => {
  const p = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  p.soquetes = soquetes(6, { cores: ['R', 'R', 'R', 'R', 'R', 'R'] });
  const e = personagem([p], { Chromatic_Orb: 500 });
  // Seis azuis numa armadura de Força: chance pequena — o limite para antes.
  const { resposta, respostas } = rodar(e, { id: 'r1', moeda: M.idDa('Chromatic_Orb'), alvo: NA_MOCHILA, categoria: 'cores', desejo: { B: 6 }, modo: 'limite', limite: 60 }, { rng: rngDe(11) });
  if (resposta.motivo !== 'atingiu') {
    assert.equal(resposta.motivo, 'limite');
    assert.equal(resposta.feitas, 60);
    assert.equal(500 - quantas(e, 'Chromatic_Orb'), 60);
  }
  assert.ok(respostas.length >= 2, 'mais de um lote');
  assert.ok(respostas.slice(0, -1).every((r) => r.continua && !r.fim && r.feitas % F.LOTE === 0), 'cada lote do meio faz exatamente LOTE');
  // Uma tentativa.
  const um = F.repetir(e, null, { id: 'r2', passo: 0, moeda: M.idDa('Chromatic_Orb'), alvo: NA_MOCHILA, categoria: 'cores', modo: 'uma' }, rngDe(1));
  assert.equal(um.resposta.fim, true);
  assert.equal(um.resposta.feitas, 1);
  assert.equal(um.resposta.motivo, 'feito');
  // Limite fora da faixa e repetição com moeda de uma tentativa: recusados.
  assert.match(F.repetir(e, null, { id: 'r3', passo: 0, moeda: M.idDa('Chromatic_Orb'), alvo: NA_MOCHILA, categoria: 'cores', desejo: { G: 1 }, modo: 'limite', limite: 0 }).resposta.mensagem, /limite vai de 1/);
  const ex = personagem([gerar('Body_Armours/Plate_Vest', 'raro', 80)], { Exalted_Orb: 3 });
  assert.match(F.repetir(ex, null, { id: 'r4', passo: 0, moeda: M.idDa('Exalted_Orb'), alvo: NA_MOCHILA, categoria: 'atributos', modo: 'ate', desejo: { mods: [] } }).resposta.mensagem, /uma tentativa por vez/);
  // Sem desejo, não há "até atingir".
  assert.match(F.repetir(e, null, { id: 'r5', passo: 0, moeda: M.idDa('Chromatic_Orb'), alvo: NA_MOCHILA, categoria: 'cores', modo: 'ate' }).resposta.mensagem, /Configure o resultado/);
});

test('Paradas: já está como quer (nada gasto), sem material no meio, a peça não aceita mais, a peça saiu', { skip: SEM }, () => {
  const p = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  p.soquetes = soquetes(4);
  const e = personagem([p], { Jewellers_Orb: 3 });
  const ja = F.repetir(e, null, { id: 'p1', passo: 0, moeda: M.idDa('Jewellers_Orb'), alvo: NA_MOCHILA, categoria: 'sockets', desejo: { abertos: 3 }, modo: 'ate' });
  assert.equal(ja.resposta.motivo, 'jaEsta');
  assert.equal(quantas(e, 'Jewellers_Orb'), 3, 'nada gasto');
  // Seis sockets com 3 Joalheiros: acaba o material.
  const fim = rodar(e, { id: 'p2', moeda: M.idDa('Jewellers_Orb'), alvo: NA_MOCHILA, categoria: 'sockets', desejo: { abertos: 6 }, modo: 'ate' }, { rng: rngDe(5) });
  if (fim.resposta.motivo !== 'atingiu') {
    assert.equal(fim.resposta.motivo, 'semMaterial');
    assert.equal(fim.resposta.feitas, 3);
    assert.equal(quantas(e, 'Jewellers_Orb'), 0);
  }
  // A peça não aceita mais: a Chance sem Expurgo (a peça deixa de ser Normal na primeira).
  const n = gerar('Body_Armours/Plate_Vest', 'normal', 80);
  const e2 = personagem([n], { Orb_of_Chance: 5 });
  const r2 = rodar(e2, { id: 'p3', moeda: M.idDa('Orb_of_Chance'), alvo: NA_MOCHILA, categoria: 'raridade', desejo: { raridades: ['unico'] }, modo: 'ate' }, { rng: rngDe(2) });
  if (r2.resposta.motivo !== 'atingiu') {
    assert.equal(r2.resposta.motivo, 'naoPode');
    assert.equal(r2.resposta.feitas, 1);
    assert.equal(quantas(e2, 'Orb_of_Chance'), 4, 'a tentativa que não valeu não gastou');
  }
  // A peça SAIU entre um lote e outro (vendida, guardada): para sem mexer em outra peça.
  const q = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  q.soquetes = soquetes(6, { cores: ['R', 'R', 'R', 'R', 'R', 'R'] });
  const outra = gerar('Boots/Bronzescale_Boots', 'raro', 80);
  const e3 = personagem([q, outra], { Chromatic_Orb: 200 });
  const r3 = F.repetir(e3, null, { id: 'p4', passo: 0, moeda: M.idDa('Chromatic_Orb'), alvo: NA_MOCHILA, categoria: 'cores', desejo: { B: 6 }, modo: 'limite', limite: 100 }, rngDe(9));
  if (!r3.resposta.fim) {
    e3.inventory.splice(0, 1); // a peça saiu; a bota foi para o índice 0
    const botaAntes = JSON.stringify(outra);
    const r4 = F.repetir(e3, r3.guardado, { id: 'p4', passo: 1 }, rngDe(10));
    assert.equal(r4.resposta.motivo, 'saiu');
    assert.equal(JSON.stringify(outra), botaAntes, 'a bota que ficou no lugar não foi tocada');
  }
});

test('A peça é seguida pela identidade: a mochila mudar de ordem no meio da repetição não troca a peça', { skip: SEM }, () => {
  const q = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  q.soquetes = soquetes(6, { cores: ['R', 'R', 'R', 'R', 'R', 'R'] });
  const outra = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  outra.soquetes = soquetes(6, { cores: ['R', 'R', 'R', 'R', 'R', 'R'] });
  const e = personagem([q, outra], { Chromatic_Orb: 300 });
  const r = F.repetir(e, null, { id: 'id1', passo: 0, moeda: M.idDa('Chromatic_Orb'), alvo: NA_MOCHILA, categoria: 'cores', desejo: { B: 6 }, modo: 'limite', limite: 50 }, rngDe(21));
  if (r.resposta.fim) return; // (saiu nas primeiras: nada a conferir)
  e.inventory.reverse(); // a peça foi parar no fim
  const antesDaOutra = JSON.stringify(outra.soquetes);
  const r2 = F.repetir(e, r.guardado, { id: 'id1', passo: 1 }, rngDe(22));
  assert.equal(JSON.stringify(outra.soquetes), antesDaOutra, 'a outra armadura não mudou');
  assert.deepEqual(r2.resposta.alvo, { onde: 'inventory', indice: e.inventory.indexOf(q) }, 'a resposta diz onde a peça está agora');
});

test('Cancelar: para depois do lote que já rodou; o próximo passo não faz nada', { skip: SEM }, () => {
  const p = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  p.soquetes = soquetes(6, { cores: ['R', 'R', 'R', 'R', 'R', 'R'] });
  const e = personagem([p], { Chromatic_Orb: 300 });
  const r = F.repetir(e, null, { id: 'x1', passo: 0, moeda: M.idDa('Chromatic_Orb'), alvo: NA_MOCHILA, categoria: 'cores', desejo: { B: 6 }, modo: 'ate' }, rngDe(31));
  if (r.resposta.fim) return;
  const c = F.cancelar(r.guardado, 'x1');
  assert.equal(c.resposta.motivo, 'cancelado');
  assert.equal(c.resposta.feitas, F.LOTE);
  const sobrou = quantas(e, 'Chromatic_Orb');
  const depois = F.repetir(e, c.guardado, { id: 'x1', passo: 1 }, rngDe(32));
  assert.equal(depois.resposta.motivo, 'encerrada');
  assert.equal(quantas(e, 'Chromatic_Orb'), sobrou, 'nada mais foi gasto');
  assert.equal(F.cancelar(c.guardado, 'x1').resposta.motivo, 'encerrada', 'cancelar duas vezes não muda nada');
});

test('Falta de material: sem a moeda não começa; a moeda que a peça não aceita não é gasta', { skip: SEM }, () => {
  const p = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  p.soquetes = soquetes(2);
  const e = personagem([p], {});
  const r = F.repetir(e, null, { id: 'f1', passo: 0, moeda: M.idDa('Jewellers_Orb'), alvo: NA_MOCHILA, categoria: 'sockets', desejo: { abertos: 3 }, modo: 'ate' });
  assert.equal(r.resposta.motivo, 'erro');
  assert.match(r.resposta.mensagem, /não tem/);
  // Alteração numa peça Rara: não vale, nada gasto.
  const e2 = personagem([p], { Orb_of_Alteration: 4 });
  const r2 = F.repetir(e2, null, { id: 'f2', passo: 0, moeda: M.idDa('Orb_of_Alteration'), alvo: NA_MOCHILA, categoria: 'atributos', modo: 'uma' });
  assert.match(r2.resposta.mensagem, /Mágico/);
  assert.equal(quantas(e2, 'Orb_of_Alteration'), 4);
  // Material de outra categoria: recusado.
  assert.match(F.repetir(e2, null, { id: 'f3', passo: 0, moeda: M.idDa('Orb_of_Alteration'), alvo: NA_MOCHILA, categoria: 'sockets', modo: 'uma' }).resposta.mensagem, /não é desta categoria/);
});

test('Mensagens repetidas e fora de ordem: a repetida não faz nada duas vezes; a fora de ordem para; a nova toma o lugar da anterior', { skip: SEM }, () => {
  const p = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  p.soquetes = soquetes(6, { cores: ['R', 'R', 'R', 'R', 'R', 'R'] });
  const e = personagem([p], { Chromatic_Orb: 300 });
  const m = { id: 'd1', passo: 0, moeda: M.idDa('Chromatic_Orb'), alvo: NA_MOCHILA, categoria: 'cores', desejo: { B: 6 }, modo: 'ate' };
  const r1 = F.repetir(e, null, m, rngDe(41));
  if (r1.resposta.fim) return;
  const gasto = 300 - quantas(e, 'Chromatic_Orb');
  // O clique duplo: a mesma mensagem de novo.
  const dup = F.repetir(e, r1.guardado, m, rngDe(42));
  assert.equal(dup.resposta.duplicada, true);
  assert.equal(dup.mudou, false);
  assert.equal(300 - quantas(e, 'Chromatic_Orb'), gasto, 'nada gasto pela repetida');
  // Uma repetição NOVA (outro id) toma o lugar; o passo da antiga não anda mais.
  const nova = F.repetir(e, r1.guardado, { ...m, id: 'd2', modo: 'uma', desejo: null }, rngDe(43));
  assert.equal(nova.resposta.feitas, 1);
  const velha = F.repetir(e, nova.guardado, { id: 'd1', passo: 1 }, rngDe(44));
  assert.equal(velha.resposta.motivo, 'encerrada');
  // Fora de ordem: pula um passo → para.
  const r3 = F.repetir(e, null, { ...m, id: 'd3' }, rngDe(45));
  if (r3.resposta.fim) return;
  const pulou = F.repetir(e, r3.guardado, { id: 'd3', passo: 2 }, rngDe(46));
  assert.equal(pulou.resposta.motivo, 'erro');
  assert.match(pulou.resposta.mensagem, /fora de ordem/);
  // Pedido sem id: recusado.
  assert.match(F.repetir(e, null, { passo: 0 }).resposta.mensagem, /inválido/);
});

test('A estimativa só sai onde a conta é exata (sockets, cores, links, Chance); nos modificadores, não', { skip: SEM }, () => {
  const p = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  p.soquetes = soquetes(3);
  const e = personagem([p], { Jewellers_Orb: 10, Orb_of_Fusing: 10, Chromatic_Orb: 10, Chaos_Orb: 10 });
  const est = (categoria, slug, desejo) => F.opcoes(e, { alvo: NA_MOCHILA, categoria, moeda: M.idDa(slug), desejo }).estimativa;
  for (const [cat, slug, d] of [['sockets', 'Jewellers_Orb', { abertos: 4 }], ['links', 'Orb_of_Fusing', { ligados: 3 }], ['cores', 'Chromatic_Orb', { G: 1 }]]) {
    const x = est(cat, slug, d);
    assert.ok(x.chance > 0 && x.chance <= 1, `${slug}: ${JSON.stringify(x)}`);
    assert.ok(x.media >= 1, `${slug}: média`);
    assert.ok(x.comOQueTem >= x.chance, `${slug}: com 10 é pelo menos a de 1`);
  }
  // Fusão (independente): a média é 1 / chance.
  const fu = est('links', 'Orb_of_Fusing', { ligados: 3 });
  assert.ok(Math.abs(fu.media - 1 / fu.chance) < 1e-9);
  assert.ok(est('atributos', 'Chaos_Orb', { mods: [{ familia: 'IncreasedLife' }] }).semEstimativa);
  // A conta da Fusão confere com o sorteio do motor (10 mil tentativas, ±3 desvios).
  let ok = 0;
  const rng = rngDe(99);
  const N = 10000;
  for (let i = 0; i < N; i++) if (Regras.maiorGrupo({ abertos: 3, links: SocketsPoe.sortearLinks(3, 6, rng, 0) }) >= 3) ok++;
  const s = Math.sqrt((fu.chance * (1 - fu.chance)) / N);
  assert.ok(Math.abs(ok / N - fu.chance) < 3 * s + 1e-3, `motor ${ok / N} × conta ${fu.chance}`);
});

// ---------------------------------------------------------------- a SESSÃO (persistência e sincronização) e o que já existia
test('Sessão: `forjaRepetir` responde `forjaResultado`, marca o personagem para gravar e manda o catálogo de ações; `forjaOpcoes` só lê', { skip: SEM }, async () => {
  const { Sessao, conexoes } = await import('../websocket/sessao.mjs');
  const recebidas = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => recebidas.push(JSON.parse(d)) });
  try {
    const p = gerar('Body_Armours/Plate_Vest', 'raro', 80);
    p.soquetes = soquetes(2);
    s.estado = personagem([p], { Jewellers_Orb: 50 });
    s.personagem = { id: 'teste-forja', nome: 'Forjador' };
    s.semAba = true; // (sem aba não monta o quadro do estado; a gravação é pela marca `characterSujo`)
    const antes = JSON.stringify(s.estado);
    await s.receber({ t: 'forjaOpcoes', pedido: 3, alvo: NA_MOCHILA, categoria: 'sockets', moeda: M.idDa('Jewellers_Orb'), desejo: { abertos: 3 } });
    const op = recebidas.findLast((x) => x.t === 'forjaOpcoes');
    assert.equal(op.pedido, 3);
    assert.equal(op.validacao.ok, true);
    assert.equal(JSON.stringify(s.estado), antes, 'as opções não mudam nada');
    s.characterSujo = false;
    await s.receber({ t: 'forjaRepetir', id: 'sess1', passo: 0, moeda: M.idDa('Jewellers_Orb'), alvo: NA_MOCHILA, categoria: 'sockets', desejo: { abertos: 3 }, modo: 'ate' });
    let res = recebidas.findLast((x) => x.t === 'forjaResultado');
    for (let passo = 1; !res.fim && passo < 20; passo++) {
      await s.receber({ t: 'forjaRepetir', id: 'sess1', passo });
      res = recebidas.findLast((x) => x.t === 'forjaResultado');
    }
    assert.equal(res.motivo, 'atingiu', res.mensagem);
    assert.equal(s.estado.inventory[0].soquetes.abertos >= 3, true);
    assert.equal(s.characterSujo, true, 'o personagem vai para o banco no próximo autosave');
    assert.ok(recebidas.some((x) => x.t === 'actionCatalog'), 'a barra de ações sincroniza (as gemas podem ter mudado)');
    // O estado que vai para o banco (JSON) leva a peça forjada e o saldo novo.
    const gravado = JSON.parse(JSON.stringify(s.estado));
    assert.deepEqual(gravado.inventory[0].soquetes, s.estado.inventory[0].soquetes);
    assert.equal(gravado.inventory.find((x) => x.id === M.idDa('Jewellers_Orb'))?.count ?? 0, 50 - res.feitas);
    // Cancelar sem nada em andamento.
    await s.receber({ t: 'forjaCancelar', id: 'sess1' });
    assert.equal(recebidas.findLast((x) => x.t === 'forjaResultado').motivo, 'encerrada');
  } finally {
    conexoes.delete(s);
  }
});

test('O que já existia continua: `{t:"moeda"}` direto (peça vestida e na mochila) e o orbe pelo Gem Atelier na peça vestida', { skip: SEM }, () => {
  const vestida = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  vestida.soquetes = soquetes(2);
  const solta = gerar('Body_Armours/Plate_Vest', 'raro', 80);
  solta.soquetes = soquetes(2);
  const e = personagem([solta], { Jewellers_Orb: 5, Chaos_Orb: 2 });
  e.equipment.body = vestida;
  assert.equal(M.usar(e, { moeda: M.idDa('Jewellers_Orb'), alvo: { onde: 'equipment', slot: 'body' } }, rngDe(1)).ok, true, 'vestida');
  assert.equal(M.usar(e, { moeda: M.idDa('Jewellers_Orb'), alvo: NA_MOCHILA }, rngDe(2)).ok, true, 'na mochila (antes: recusada)');
  assert.equal(M.usar(e, { moeda: M.idDa('Chaos_Orb'), alvo: NA_MOCHILA }, rngDe(3)).ok, true, 'o Caos na mochila');
  assert.equal(Gemas.usarOrbeDoPoe(e, { slot: 'body', tipo: 'joalheiro' }, rngDe(4)).ok, true, 'Gem Atelier');
  assert.equal(quantas(e, 'Jewellers_Orb'), 2);
});
