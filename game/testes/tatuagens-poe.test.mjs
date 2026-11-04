// AS TATUAGENS DO PoE (100% — lote "dados", 03/11: "nada pode ficar como 'não se aplica ao jogo'"): os dados do poedb (as 60 — 50 comuns, 3 da
// Jornada, 7 Proibidas), o item no catálogo, a regra de onde cada uma entra (a pequena de um atributo, o notável de +30, o notável da sua
// ascendência), o efeito no lugar do nó, o máximo de 50 e o "Limitado a: 1" das Proibidas, a Jornada por tatuagem alocada, o Conto do Guerreiro
// ("Efeito das Tatuagens no Raio aumentado em 100%"), a tela e o drop (a fonte simples, sem a liga Ancestral).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const T = await import('../systems/passivas/tatuagens.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const { traduzirLinha } = await import('../systems/itens-poe/arvore.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

J.iniciar(ITEM_CATALOG);
T.iniciar(ITEM_CATALOG);

function personagem(alocados = [], { classe = 'Marauder', ascendencia = null } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.sistema = 'poe';
  e.classePoe = classe;
  P.garantir(e);
  if (ascendencia) e.passivas.ascendencia = ascendencia;
  e.passivas.alocados.push(...alocados);
  P.garantir(e);
  e.inventory = [];
  return e;
}
const daSlug = (slug) => T.daSlug(slug);
const dar = (e, slug, n = 1) => e.inventory.push({ id: daSlug(slug).itemId, count: n });
const tatuar = (e, no, slug) => Comandos.comando(e, { action: 'tatuar', no, id: daSlug(slug).itemId });
const so = (add, valor) => (n) => !n.ascendencia && n.efeitos?.length === 1 && n.efeitos[0].add === add && n.efeitos[0].valor === valor;
const nos = (filtro) => P.arvore().nos.filter(filtro);
const adds = (e) => ({ ...P.efeitos(e).adds });
const quantas = (e, slug) => e.inventory.filter((p) => p.id === daSlug(slug).itemId).reduce((t, p) => t + (p.count ?? 1), 0);

test('os DADOS do poedb: 60 tatuagens (50 comuns, 3 da Jornada, 7 Proibidas), o alvo de cada uma, o ícone, o máximo de 50 e os ids estáveis', { skip: SEM }, () => {
  assert.equal(T.TATUAGENS.length, 60);
  const por = (tipo) => T.TATUAGENS.filter((t) => t.tipo === tipo);
  assert.equal(por('comum').length, 50);
  assert.equal(por('jornada').length, 3);
  assert.equal(por('proibida').length, 7);
  assert.equal(T.MAXIMO, 50);
  assert.ok(por('comum').every((t) => t.alvo.tipo === 'pequena' && ['str', 'dex', 'int'].includes(t.alvo.atributo)));
  assert.deepEqual(por('jornada').map((t) => t.alvo).sort((a, b) => a.atributo.localeCompare(b.atributo)), [{ tipo: 'notavel30', atributo: 'dex' }, { tipo: 'notavel30', atributo: 'int' }, { tipo: 'notavel30', atributo: 'str' }]);
  assert.ok(por('proibida').every((t) => t.alvo.tipo === 'ascendencia' && t.limite?.n === 1 && t.classe));
  assert.ok(por('jornada').every((t) => t.nivelDoDrop === 81));
  assert.equal(new Set(T.TATUAGENS.map((t) => t.itemId)).size, 60);
  assert.ok(T.TATUAGENS.every((t) => t.itemId >= 917001 && t.itemId <= 917060));
  for (const t of T.TATUAGENS) assert.ok(t.icone && existsSync(new URL(`../gamedata/itens-poe/icones-moedas/${t.icone}`, import.meta.url)), `ícone de ${t.slug}`);
  assert.deepEqual(daSlug('Tattoo_of_the_Ngamahu_Firewalker').linhas, ['+6% de Resistência a Fogo']);
});

test('o ITEM no catálogo: empilhável, o ícone do PoE, o "Substitui …" e as linhas', { skip: SEM }, () => {
  const t = daSlug('Tattoo_of_the_Valako_Warrior');
  const item = ITEM_CATALOG[t.itemId];
  assert.equal(item.name, 'Tatuagem do Guerreiro de Valako');
  assert.equal(item.stackable, true);
  assert.equal(item.poeMoeda.icone, t.icone);
  assert.equal(item.tatuagemPoe.substitui, 'Substitui uma Habilidade Passiva Pequena de Inteligência');
  assert.deepEqual(item.tatuagemPoe.linhas, ['Dano de Raio aumentado em 5%']);
  assert.ok(!item.moedaPoe, 'não é moeda da Forja');
});

test('TATUAR a pequena de Força: o nó deixa de dar +10 de Força e passa a dar a linha da tatuagem; a tatuagem é gasta', { skip: SEM }, () => {
  const [no] = nos(so('str', 10)).filter((n) => n.tipo === 'small');
  const e = personagem([no.id]);
  dar(e, 'Tattoo_of_the_Ngamahu_Firewalker', 2);
  const antes = adds(e);
  const r = tatuar(e, no.id, 'Tattoo_of_the_Ngamahu_Firewalker');
  assert.equal(r.ok, true, r.erro);
  assert.equal(quantas(e, 'Tattoo_of_the_Ngamahu_Firewalker'), 1);
  const depois = adds(e);
  assert.equal((depois.str ?? 0) - (antes.str ?? 0), -10);
  assert.equal((depois.fire_res ?? 0) - (antes.fire_res ?? 0), 6);
  assert.equal(e.passivas.tatuagens[no.id].slug, 'Tattoo_of_the_Ngamahu_Firewalker');
  // outra no mesmo nó toma o lugar (a de antes se perde)
  dar(e, 'Tattoo_of_the_Ngamahu_Warrior');
  assert.equal(tatuar(e, no.id, 'Tattoo_of_the_Ngamahu_Warrior').ok, true);
  assert.equal(Object.keys(e.passivas.tatuagens).length, 1);
  const troca = adds(e);
  assert.equal((troca.fire_res ?? 0) - (antes.fire_res ?? 0), 0);
  assert.equal((troca.fire_dmg ?? 0) - (antes.fire_dmg ?? 0), 5);
  // a tatuagem fica no nó; tirar a passiva tira o efeito (o nó não está alocado)
  e.passivas.alocados.splice(e.passivas.alocados.indexOf(no.id), 1);
  P.garantir(e);
  assert.equal(e.passivas.tatuagens[no.id].slug, 'Tattoo_of_the_Ngamahu_Warrior');
  assert.equal(adds(e).fire_dmg ?? 0, antes.fire_dmg ?? 0);
});

test('onde ENTRA: o atributo certo, só alocada, não no notável/keystone, nem sem a tatuagem na mochila', { skip: SEM }, () => {
  const [forca] = nos(so('str', 10)).filter((n) => n.tipo === 'small');
  const [dex] = nos(so('dex', 10)).filter((n) => n.tipo === 'small');
  const outro = nos((n) => n.tipo === 'small' && !n.ascendencia && n.efeitos?.length && !['str', 'dex', 'int'].includes(n.efeitos[0].add))[0];
  const e = personagem([forca.id, outro.id]);
  dar(e, 'Tattoo_of_the_Ngamahu_Firewalker', 5);
  assert.match(tatuar(e, dex.id, 'Tattoo_of_the_Ngamahu_Firewalker').erro, /alocada/);
  assert.match(tatuar(e, outro.id, 'Tattoo_of_the_Ngamahu_Firewalker').erro, /Pequena de Força/);
  e.passivas.alocados.push(dex.id);
  assert.match(tatuar(e, dex.id, 'Tattoo_of_the_Ngamahu_Firewalker').erro, /Pequena de Força/);
  const sem = personagem([forca.id]);
  assert.match(tatuar(sem, forca.id, 'Tattoo_of_the_Ngamahu_Firewalker').erro, /não tem/);
  assert.equal(T.alvoDoNo(forca).tipo, 'pequena');
  assert.equal(T.alvoDoNo(outro), null);
});

test('o MÁXIMO de 50 Tatuagens', { skip: SEM }, () => {
  const lista = nos(so('str', 10)).filter((n) => n.tipo === 'small');
  const dexs = nos(so('dex', 10)).filter((n) => n.tipo === 'small');
  const todos = [...lista, ...dexs].slice(0, 51);
  assert.equal(todos.length, 51);
  const e = personagem(todos.map((n) => n.id));
  e.passivas.tatuagens = Object.fromEntries(todos.slice(0, 50).map((n) => [n.id, { slug: n.efeitos[0].add === 'str' ? 'Tattoo_of_the_Kitava_Warrior' : 'Tattoo_of_the_Ramako_Scout' }]));
  dar(e, 'Tattoo_of_the_Ramako_Scout', 3);
  const ultimo = todos[50];
  const slug = ultimo.efeitos[0].add === 'str' ? 'Tattoo_of_the_Kitava_Warrior' : 'Tattoo_of_the_Ramako_Scout';
  dar(e, slug);
  assert.match(tatuar(e, ultimo.id, slug).erro, /Máximo de 50/);
  // trocar uma das 50 pode (o mesmo nó não conta)
  const primeiro = todos[0].efeitos[0].add === 'str' ? 'Tattoo_of_the_Kitava_Rebel' : 'Tattoo_of_the_Ramako_Archer';
  dar(e, primeiro);
  assert.equal(tatuar(e, todos[0].id, primeiro).ok, true);
  assert.equal(Object.keys(e.passivas.tatuagens).length, 50);
});

test('a JORNADA: o notável de +30 do atributo; "+25 de Vida máxima por Tatuagem da Jornada do Corpo Alocada" — 25 × as alocadas, em cada uma', { skip: SEM }, () => {
  const notaveis = nos((n) => n.tipo === 'notable' && so('str', 30)(n));
  assert.ok(notaveis.length >= 2);
  const e = personagem(notaveis.slice(0, 2).map((n) => n.id));
  const base = traduzirLinha('+25 de Vida máxima').efeitos[0];
  assert.ok(base?.add, 'a linha-base tem efeito');
  dar(e, 'Journey_Tattoo_of_the_Body', 2);
  const antes = adds(e);
  assert.equal(tatuar(e, notaveis[0].id, 'Journey_Tattoo_of_the_Body').ok, true);
  const uma = adds(e);
  assert.equal((uma[base.add] ?? 0) - (antes[base.add] ?? 0), 25);
  assert.equal((uma.str ?? 0) - (antes.str ?? 0), -30);
  assert.equal(tatuar(e, notaveis[1].id, 'Journey_Tattoo_of_the_Body').ok, true);
  const duas = adds(e);
  assert.equal((duas[base.add] ?? 0) - (antes[base.add] ?? 0), 100, '2 × (25 × 2)');
  // a pequena de Força não aceita a da Jornada
  const [pequena] = nos(so('str', 10)).filter((n) => n.tipo === 'small');
  e.passivas.alocados.push(pequena.id);
  dar(e, 'Journey_Tattoo_of_the_Body');
  assert.match(tatuar(e, pequena.id, 'Journey_Tattoo_of_the_Body').erro, /\+30 de Força Notável/);
});

test('a PROIBIDA: só num notável da SUA ascendência; sorteia um notável das ascendências da classe da tatuagem; "Limitado a: 1"', { skip: SEM }, () => {
  const meus = nos((n) => n.ascendencia === 'Juggernaut' && n.tipo === 'notable').slice(0, 2);
  const e = personagem(meus.map((n) => n.id), { ascendencia: 'Juggernaut' });
  assert.ok(meus.every((n) => e.passivas.alocados.includes(n.id)), 'os notáveis da ascendência ficam');
  dar(e, 'Forbidden_Tattoo_of_the_Witch', 2);
  const antes = adds(e);
  const r = Comandos.comando(e, { action: 'tatuar', no: meus[0].id, id: daSlug('Forbidden_Tattoo_of_the_Witch').itemId });
  assert.equal(r.ok, true, r.erro);
  const x = e.passivas.tatuagens[meus[0].id];
  const s = P.arvore().porId.get(x.sorteado);
  assert.equal(P.arvore().ascendencias[s.ascendencia].classe, 'Witch');
  assert.equal(s.tipo, 'notable');
  // o nó dá as linhas do sorteado no lugar das dele
  const depois = adds(e);
  const soma = (efs) => Object.fromEntries(efs.filter((ef) => ef.add).map((ef) => [ef.add, ef.valor]));
  for (const [k, v] of Object.entries(soma(s.efeitos))) assert.ok(Math.abs((depois[k] ?? 0) - (antes[k] ?? 0) - v + (soma(meus[0].efeitos)[k] ?? 0)) < 1e-9, k);
  // "Limitado a: 1 Tatuagem de Ascendência"
  assert.match(Comandos.comando(e, { action: 'tatuar', no: meus[1].id, id: daSlug('Forbidden_Tattoo_of_the_Witch').itemId }).erro, /Limitado a: 1/);
  // o notável de outra ascendência (não é a sua) não aceita
  const outro = nos((n) => n.ascendencia === 'Berserker' && n.tipo === 'notable')[0];
  assert.equal(T.porqueNao(e, outro.id, daSlug('Forbidden_Tattoo_of_the_Witch')) != null, true);
});

test('o CONTO DO GUERREIRO: "Efeito das Tatuagens no Raio aumentado em 100%" dobra os números da tatuagem do nó alocado no raio', { skip: SEM }, () => {
  const tr = traduzirLinha('Efeito das Tatuagens no Raio aumentado em 100%');
  assert.equal(tr.estado, 'equivalente');
  assert.deepEqual(tr.efeitos, [{ add: 'raio_efeito_tatuagens', valor: 100 }]);
  const u = Catalogo.catalogo().classes.Jewels.unicos.find((x) => x.slug === 'Warriors_Tale');
  const base = Catalogo.catalogo().classes.Jewels.bases.find((b) => b.nome === u.base);
  const joia = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 80, rng: () => 0, unico: 'Warriors_Tale' }));
  const r = P.raioDaJoia(joia);
  assert.ok(r?.max > 0, 'a joia tem raio');
  let achado = null;
  for (const s of P.arvore().nos.filter((n) => P.ehEncaixeDeJoia(n))) {
    const no = P.arvore().nos.find((n) => n.tipo === 'small' && so('str', 10)(n) && Math.hypot(n.x - s.x, n.y - s.y) <= r.max && Math.hypot(n.x - s.x, n.y - s.y) >= r.min);
    if (no) { achado = { s, no }; break; }
  }
  assert.ok(achado);
  const e = personagem([achado.s.id, achado.no.id]);
  dar(e, 'Tattoo_of_the_Ngamahu_Firewalker');
  const antes = adds(e);
  assert.equal(tatuar(e, achado.no.id, 'Tattoo_of_the_Ngamahu_Firewalker').ok, true);
  const sem = adds(e);
  assert.equal((sem.fire_res ?? 0) - (antes.fire_res ?? 0), 6);
  e.inventory.push(joia);
  const enc = Comandos.comando(e, { action: 'encaixarJoia', no: achado.s.id, pilha: e.inventory.length - 1, id: joia.id });
  assert.equal(enc.ok, true, enc.erro);
  const com = adds(e);
  assert.equal((com.fire_res ?? 0) - (antes.fire_res ?? 0), 12);
});

test('a TELA: as tatuagens dos nós e os nós alocados que aceitam uma', { skip: SEM }, () => {
  const [no] = nos(so('int', 10)).filter((n) => n.tipo === 'small');
  const e = personagem([no.id]);
  dar(e, 'Tattoo_of_the_Hinekora_Warrior');
  let v = P.vista(e);
  assert.deepEqual(v.tatuaveis[no.id], { tipo: 'pequena', atributo: 'int' });
  assert.equal(v.maximoDeTatuagens, 50);
  assert.equal(tatuar(e, no.id, 'Tattoo_of_the_Hinekora_Warrior').ok, true);
  v = P.vista(e);
  assert.equal(v.tatuagens[no.id].nome, 'Tatuagem do Guerreiro de Hinekora');
  assert.deepEqual(v.tatuagens[no.id].linhas, ['Escudo de Energia máximo aumentado em 3%']);
});

test('o DROP (a fonte simples, sem a liga Ancestral): a chance pela raridade, os pesos e a Jornada só na área 81+', { skip: SEM }, () => {
  assert.deepEqual(T.dropDoMonstro('normal', 70, () => 0.5), []);
  const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
  const [d] = T.dropDoMonstro('boss', 70, seq(0, 0));
  assert.ok(T.ehTatuagem(d.id));
  // sem a Jornada abaixo de 81: o último sorteio (rng → 0.9999) nunca é da Jornada
  const lista = Array.from({ length: 200 }, (_, i) => T.dropDoMonstro('boss', 70, seq(0, i / 200))[0]);
  assert.ok(lista.every((x) => T.doItem(x.id).tipo !== 'jornada'));
  const altas = Array.from({ length: 200 }, (_, i) => T.dropDoMonstro('boss', 83, seq(0, i / 200))[0]);
  assert.ok(altas.some((x) => T.doItem(x.id).tipo === 'jornada'));
  assert.ok(T.DROP.chancePorMonstro.boss > T.DROP.chancePorMonstro.raro && T.DROP.chancePorMonstro.raro > T.DROP.chancePorMonstro.normal);
});

test('as LINHAS das tatuagens comuns valem (nenhuma "não se aplica"); a do Devorador de Corações consome o cadáver do Golpe de Misericórdia', { skip: SEM }, () => {
  for (const t of T.TATUAGENS.filter((x) => x.tipo === 'comum')) {
    for (const l of t.linhas) {
      const r = traduzirLinha(l);
      assert.ok(r.efeitos.length > 0, `${t.slug}: ${l} → ${r.estado}`);
      assert.ok(!/não se aplica/.test(r.nota ?? ''), l);
    }
  }
  assert.deepEqual(traduzirLinha('Golpes Abatedores têm 4% de chance de Consumir cadáveres para recuperar 10% da Vida Máxima').efeitos, [{ add: 'ev:golpeDeMisericordia:consumirCadaverChance:hp:10', valor: 4 }]);
});
