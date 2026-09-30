// A ÁRVORE DE PASSIVAS única (etapa 7): o motor (systems/passivas/), os dados
// (gamedata/passivas/) e a integração com a ficha — os 30 casos do prompt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../systems/passivas/arvore.mjs';
import * as Comandos from '../systems/passivas/comandos.mjs';
import * as Keystones from '../systems/passivas/keystones.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Gemas from '../systems/gemas.mjs';
import * as Comparar from '../systems/itens/comparar.mjs';
import * as Arvore from '../systems/arvore.mjs';
import * as Treino from '../systems/treino.mjs';
import * as Reforcos from '../systems/skills/reforcos.mjs';
import { ITEM_CATALOG, ACTION_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, comSkills } from './apoio.mjs';

const A = P.arvore();
const no = (id) => A.porId.get(id);
function novo(vocacao = 'knight', level = 400) {
  const e = personagemDeTeste({ vocacao, level });
  Treino.garantir(e);
  P.garantir(e);
  Comandos.depoisDeMudar(e);
  return e;
}
/** Aloca o caminho até `id` (cada nó validado pelo motor). */
function ate(e, id) {
  const caminho = P.caminhoAte(e, id);
  assert.ok(caminho, `sem caminho até ${id}`);
  const r = Comandos.comando(e, { action: 'alocar', ids: caminho });
  assert.equal(r.ok, true, r.erro);
  assert.ok(!r.aviso, r.aviso);
  return caminho;
}
const ficha = (e) => {
  Ficha.invalidar(e);
  return Ficha.combate(e);
};
const distancia = (a, b) => Math.hypot(no(a).x - no(b).x, no(a).y - no(b).y);

// ---------- os dados ----------

test('a árvore do jogo é válida: ids únicos, conexões dos dois lados, tudo alcançável, 5 inícios', () => {
  assert.deepEqual(P.validar(A), []);
  assert.deepEqual(Object.keys(A.inicios).sort(), ['druid', 'knight', 'monk', 'paladin', 'sorcerer']);
  const tipos = new Set(A.nos.map((n) => n.tipo));
  for (const t of ['small', 'notable', 'keystone', 'start']) assert.ok(tipos.has(t), t);
  assert.ok(A.nos.length >= 250, `${A.nos.length} nós`);
  for (const n of A.nos.filter((x) => x.tipo === 'keystone')) assert.ok(Keystones.valida(n.keystone), n.id);
});

test('o validador pega árvore quebrada (conexão de um lado só, nó ilhado, efeito desconhecido)', () => {
  const quebrada = structuredClone({ inicios: A.inicios, nos: A.nos.slice(0, 50), conexoes: [] });
  quebrada.nos.push({ id: 'solto', tipo: 'small', x: 0, y: 0, conexoes: [], efeitos: [{ xpto: 1 }] });
  const erros = P.validar(quebrada);
  assert.ok(erros.some((x) => x.includes('solto: efeito')));
  assert.ok(erros.some((x) => x.includes('solto: ninguém alcança')));
});

// ---------- 1, 2: personagem e pontos ----------

test('1-2: personagem novo começa no início da classe e ganha pontos pelo level (a conta de antes)', () => {
  const e = novo('knight', 8);
  assert.deepEqual(e.passivas.alocados, ['inicio_knight']);
  assert.equal(P.pontos(e).total, 0);
  e.level = 10;
  assert.equal(P.pontos(e).total, 1);
  e.level = 300;
  assert.deepEqual(P.pontos(e), { total: 146, usados: 0, livres: 146 });
});

// ---------- 3, 4, 5: alocar ----------

test('3: alocar um SMALL ligado ao início — o ponto sai', () => {
  const e = novo();
  const r = Comandos.comando(e, { action: 'alocar', id: 'armour_e' });
  assert.equal(r.ok, true, r.erro);
  assert.ok(e.passivas.alocados.includes('armour_e'));
  assert.equal(P.pontos(e).usados, P.CONFIG.custo.small);
});

test('4-5: alocar um NOTABLE e um KEYSTONE pelo caminho', () => {
  const e = novo();
  ate(e, 'armour_na');
  assert.ok(e.passivas.alocados.includes('armour_na'));
  ate(e, 'armour_k');
  assert.ok(P.efeitos(e).keystones.some((k) => k.no === 'armour_k'));
  assert.ok(P.efeitos(e).habilidades.has('ultimaMuralha'));
});

// ---------- 6, 7, 8, 29: o servidor recusa ----------

test('6: nó sem conexão com um nó seu é recusado (não basta mandar "unlock node X")', () => {
  const e = novo();
  const r = Comandos.comando(e, { action: 'alocar', id: 'fire_na' });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'SEM_CAMINHO');
  assert.ok(!e.passivas.alocados.includes('fire_na'));
});

test('7: sem pontos, não aloca', () => {
  const e = novo('knight', 10); // 1 ponto; o small custa 2
  const r = Comandos.comando(e, { action: 'alocar', id: 'armour_e' });
  assert.equal(r.motivo, 'SEM_PONTOS');
});

test('8: keystone pede level mínimo', () => {
  const e = novo('knight', 55);
  e.passivas.alocados.push(...P.caminhoAte(e, 'armour_na')); // (o caminho, direto — o que está em teste é o keystone)
  const r = P.podeAlocar(e, 'armour_k');
  assert.equal(r.motivo, 'LEVEL');
});

test('29: o servidor recusa o inválido — nó que não existe, repetido, início de outra classe, pedido desconhecido', () => {
  const e = novo();
  assert.equal(Comandos.comando(e, { action: 'alocar', id: 'nao_existe' }).motivo, 'NAO_EXISTE');
  Comandos.comando(e, { action: 'alocar', id: 'armour_e' });
  assert.equal(Comandos.comando(e, { action: 'alocar', id: 'armour_e' }).motivo, 'JA_ALOCADO');
  assert.equal(P.podeAlocar(e, 'inicio_paladin').ok, false);
  assert.equal(Comandos.comando(e, { action: 'apagarTudo' }).ok, false);
  // Estado adulterado (nó que não existe, início de outra classe, repetido): `garantir` limpa.
  e.passivas.alocados.push('xpto', 'inicio_sorcerer', 'armour_e');
  P.garantir(e);
  assert.deepEqual(e.passivas.alocados, ['inicio_knight', 'armour_e']);
});

// ---------- 9, 11: respec ----------

test('9: respec — não tira nó que ilharia outros (a não ser junto); devolve o ponto e cobra o ouro', () => {
  const e = novo();
  ate(e, 'armour_na');
  const antes = P.pontos(e).usados;
  const r = Comandos.comando(e, { action: 'respec', id: 'armour_e' });
  assert.equal(r.motivo, 'ILHARIA');
  const plano = Comandos.comando(e, { action: 'planoRespec', id: 'armour_e', junto: true }).plano;
  assert.equal(plano.tirar.length, e.passivas.alocados.length - 1);
  e.gold = 10;
  e.bank = 0;
  assert.equal(Comandos.comando(e, { action: 'respec', id: 'armour_na' }).motivo, 'SEM_OURO');
  e.gold = 1e9;
  const r2 = Comandos.comando(e, { action: 'respec', id: 'armour_na' });
  assert.equal(r2.ok, true, r2.erro);
  assert.equal(r2.preco, P.CONFIG.respec.ouroPorNoPorLevel * e.level);
  assert.equal(P.pontos(e).usados, antes - P.CONFIG.custo.notable);
  assert.equal(Comandos.comando(e, { action: 'respec', id: 'inicio_knight' }).motivo, 'INICIO');
});

test('9b: full respec (o grátis da migração primeiro) e só fora da caçada', () => {
  const e = novo();
  ate(e, 'life_na');
  e.passivas.respecsGratis = 1;
  e.gold = 0;
  e.bank = 0;
  assert.equal(Comandos.comando(e, { action: 'respec', tudo: true }, true).motivo, 'EM_CACADA');
  const r = Comandos.comando(e, { action: 'respec', tudo: true });
  assert.equal(r.ok, true, r.erro);
  assert.equal(r.preco, 0);
  assert.equal(e.passivas.respecsGratis, 0);
  assert.deepEqual(e.passivas.alocados, ['inicio_knight']);
});

test('10-11: os stats são refeitos ao alocar e ao tirar (Life % na vida máxima, Armour % na armadura)', () => {
  const e = novo();
  const vida0 = e.maxHp;
  const arm0 = ficha(e).armor;
  ate(e, 'life_na');
  assert.ok(e.maxHp > vida0, `vida ${vida0} → ${e.maxHp}`);
  ate(e, 'armour_s2');
  assert.ok(ficha(e).armor >= arm0);
  e.gold = 1e12;
  Comandos.comando(e, { action: 'respec', tudo: true });
  assert.equal(e.maxHp, vida0, 'o respec devolve a vida de antes');
  assert.equal(ficha(e).armor, arm0);
});

// ---------- 12-16: inícios ----------

const INICIO_PERTO = {
  knight: ['physical', 'armour', 'life', 'melee'],
  paladin: ['physical', 'holy', 'ranged', 'accuracy'],
  sorcerer: ['fire', 'energy', 'death', 'spell'],
  druid: ['ice', 'earth', 'holy', 'spell'],
  monk: ['energy', 'melee', 'mobility', 'evasion'],
};
for (const [classe, clusters] of Object.entries(INICIO_PERTO)) {
  test(`12-16: ${classe} começa no início dele, ligado direto a ${clusters.join('/')}`, () => {
    const e = novo(classe);
    assert.equal(e.passivas.alocados[0], `inicio_${classe}`);
    for (const c of clusters) assert.equal(P.caminhoAte(e, `${c}_e`)?.length, 1, `${classe} → ${c}`);
  });
}

// ---------- 17-20: cross-build ----------

for (const [classe, destino, rotulo] of [
  ['knight', 'fire_na', 'Knight → Fire/Spell'],
  ['paladin', 'spell_na', 'Paladin → Spell'],
  ['druid', 'ice_nb', 'Druid → Ice'],
  ['monk', 'energy_na', 'Monk → Energy'],
]) {
  test(`17-20: cross-build ${rotulo} — dá para chegar, e o dano da tag sobe`, () => {
    const e = novo(classe, 1500);
    const tag = no(destino).efeitos.find((x) => x.tag)?.tag;
    const antes = ficha(e).afinidades?.[tag] ?? 0;
    ate(e, destino);
    assert.ok((ficha(e).afinidades?.[tag] ?? 0) > antes, `${tag}: ${antes} → ${ficha(e).afinidades?.[tag]}`);
  });
}
test('17b: o Knight chega ao Fire pelo anel, e o Sorcerer chega MAIS PERTO (o início define onde começa)', () => {
  const k = novo('knight', 3000);
  const s = novo('sorcerer', 3000);
  assert.ok(P.caminhoAte(k, 'fire_e').length > P.caminhoAte(s, 'fire_e').length);
});

// ---------- 21-24: com os outros sistemas ----------

test('21: árvore + equipamento somam no mesmo número (STR da árvore + STR do item)', () => {
  const e = novo();
  const str0 = ficha(e).atributos.str;
  e.passivas.alocados.push('anel_0');
  Comandos.depoisDeMudar(e);
  assert.equal(ficha(e).atributos.str, str0 + P.arvore().porId.get('anel_0').efeitos[0].valor);
  assert.equal(Afixos.soma(e).str, P.arvore().porId.get('anel_0').efeitos[0].valor);
});

test('22: árvore + gema — o dano da skill (o mesmo do balão) sobe com Fire da árvore', () => {
  const e = comSkills(novo('sorcerer', 800), ['spell-flame-strike']);
  const entry = ACTION_CATALOG.spells.find((x) => x.id === 'spell-flame-strike');
  const antes = Acoes.danoMostrado(e, entry);
  ate(e, 'fire_na');
  Ficha.invalidar(e);
  const depois = Acoes.danoMostrado(e, entry);
  assert.ok(depois.max > antes.max, `${antes.max} → ${depois.max}`);
});

test('23: árvore + especialização da classe somam na mesma afinidade (Physical do Knight + Physical da árvore)', () => {
  const e = novo();
  const base = ficha(e).afinidades.physical;
  ate(e, 'physical_s1');
  const f = ficha(e);
  assert.equal(f.afinidades.physical, base + 6);
  assert.ok(f.fontesDasAfinidades.physical.some((x) => x.especializacao.startsWith('Árvore')), 'a origem aparece');
});

test('24: árvore + buff — o Blood Rage (+15% melee) soma por cima da árvore no termo do golpe, sem substituir', () => {
  const e = novo();
  const tags = ['physical', 'melee'];
  const hunt = { buffs: { 'spell-blood-rage': { ate: 1e15, tipo: 'rage', fator: 1 } }, clock: 1000 };
  // O termo do golpe da arma (hunt/combate.mjs): afinidade (classe + árvore) + reforço.
  const termo = () => Ficha.afinidadePara(ficha(e), tags).pct + Reforcos.bonus(hunt, 'dano', tags);
  const antes = termo();
  ate(e, 'melee_s1');
  assert.equal(termo(), antes + 3, 'o nó de +3% melee da árvore soma');
  assert.equal(Reforcos.bonus(hunt, 'dano', tags), 15, 'e o buff continua inteiro');
  delete hunt.buffs['spell-blood-rage'];
  assert.equal(termo(), antes + 3 - 15, 'sem o buff, só a árvore (e a classe)');
});

// ---------- 25-28: todos leem a mesma fonte ----------

test('25: a ficha mostra a árvore (afinidades, origem e keystones)', () => {
  const e = novo();
  ate(e, 'armour_k');
  const f = ficha(e);
  assert.ok(f.passivas.keystones.includes('Última Muralha'));
});

test('26: o balão da skill (catálogo) reflete a árvore', () => {
  const e = comSkills(novo('sorcerer', 800), ['spell-flame-strike']);
  const noBalao = () => Acoes.catalogo(e).spells.find((x) => x.id === 'spell-flame-strike').damage.max;
  const antes = noBalao();
  ate(e, 'fire_na');
  Ficha.invalidar(e);
  assert.ok(noBalao() > antes);
});

test('27: a comparação de item enxerga a árvore (o personagem da comparação já tem os nós)', () => {
  const e = novo();
  const peca = { id: Number(Object.values(ITEM_CATALOG).find((i) => i.slot === 'body' && !i.stackable).id), count: 1 };
  const sem = Comparar.comparar(e, peca);
  ate(e, 'life_na');
  const com = Comparar.comparar(e, peca);
  assert.equal(sem.ok, true);
  assert.equal(com.ok, true);
  // A vida máxima que a comparação parte é a de quem tem os nós.
  const vida = (r) => r.personagem.find((l) => l.chave === 'vidaMaxima');
  if (vida(sem) && vida(com)) assert.ok(vida(com).de >= vida(sem).de);
});

test('28: o combate usa a árvore — golpe da arma com Physical e o keystone de conversão (físico → fogo)', () => {
  const e = novo('knight', 1500);
  const f0 = ficha(e);
  ate(e, 'physical_na');
  assert.ok(ficha(e).afinidades.physical > f0.afinidades.physical);
  ate(e, 'spell_k');
  assert.deepEqual(ficha(e).imbuElemental, { tipo: 'fire', pct: 50 });
});

test('keystones de regra: Arqueiro Arcano (INT → Ranged) e Guerreiro de Sangue (Life Leech ×1,5)', () => {
  const e = novo('paladin', 1500);
  const r0 = ficha(e).afinidades.ranged ?? 0;
  ate(e, 'accuracy_k');
  const f = ficha(e);
  assert.ok(f.afinidades.ranged > r0 + 0.5, `ranged ${r0} → ${f.afinidades.ranged}`);
  const s = novo('sorcerer', 1500);
  s.equipment.ring = null;
  ate(s, 'death_na'); // o keystone fica atrás do 1º notável: tudo que dá leech no caminho já entra antes da medida
  const leech = ficha(s).lifeLeech;
  ate(s, 'death_k');
  assert.ok(Math.abs(ficha(s).lifeLeech - leech * 1.5) < 1e-9);
});

test('keystone de habilidade liga o gancho do combate (os 15 da árvore antiga valem na nova)', () => {
  const e = novo('sorcerer', 1500);
  ate(e, 'fire_k');
  assert.ok(P.efeitos(e).habilidades.has('cataclismo'));
  const ids = A.nos.filter((n) => n.keystone?.regra === 'habilidade').map((n) => n.keystone.id).sort();
  assert.equal(ids.length, 15);
});

// ---------- migração ----------

test('migração: quem tinha a árvore antiga recebe os pontos de volta, 1 respec grátis, e a vida % dela sai', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 400 });
  Arvore.garantir(e);
  const cat = Arvore.catalogoDe(e);
  e.arvore.graus = { [cat.nos[0].id]: 1 };
  e.arvoreMax = { hp: 300, mana: 0 };
  e.maxHp += 300;
  const vida = e.maxHp;
  const r = P.garantir(e);
  assert.equal(r.migrou, true);
  assert.deepEqual(e.arvore.graus, {});
  assert.equal(e.passivas.respecsGratis, 1);
  assert.equal(e.maxHp, vida - 300);
  assert.equal(P.garantir(e).migrou, false, 'uma vez só');
  // A árvore antiga não compra mais nada (os pontos não contam duas vezes).
  assert.equal(Arvore.comando(e, { action: 'aplicar', plano: {} }, false).ok, false);
});

test('vessels do Gem Atelier contam os nós da árvore nova por domínio', () => {
  const e = novo('knight', 3000);
  const v0 = Gemas.vessels(e);
  ate(e, 'armour_k');
  ate(e, 'life_k');
  const v = Gemas.vessels(e);
  assert.ok(v.fracao.vermelho > v0.fracao.vermelho);
});

// ---------- 30: desempenho ----------

test('30: desempenho — árvore de 3.000 nós: validar, caminho e efeitos rápidos; efeitos em cache', () => {
  const grande = { versao: 99, inicios: {}, clusters: [], nos: [] };
  const classes = ['knight', 'paladin', 'sorcerer', 'druid', 'monk'];
  classes.forEach((c, i) => {
    grande.inicios[c] = `inicio_${c}`;
    grande.nos.push({ id: `inicio_${c}`, tipo: 'start', x: i, y: 0, efeitos: [], conexoes: [] });
  });
  const N = 3000;
  for (let i = 0; i < N; i++) grande.nos.push({ id: `n${i}`, tipo: i % 50 === 49 ? 'notable' : 'small', x: i, y: 1, efeitos: [{ dano: 1, tag: 'fire' }, { add: 'str', valor: 1 }], conexoes: [] });
  const ligar = (a, b) => {
    grande.nos.find((n) => n.id === a).conexoes.push(b);
    grande.nos.find((n) => n.id === b).conexoes.push(a);
  };
  for (let i = 1; i < N; i++) ligar(`n${i - 1}`, `n${i}`);
  classes.forEach((c, i) => ligar(`inicio_${c}`, `n${i * 600}`));
  const antes = P.usarArvore(grande);
  try {
    let t = performance.now();
    assert.deepEqual(P.validar(grande), []);
    const tValidar = performance.now() - t;
    const e = personagemDeTeste({ vocacao: 'knight', level: 20000 });
    P.garantir(e);
    t = performance.now();
    const caminho = P.caminhoAte(e, 'n2999');
    const tCaminho = performance.now() - t;
    e.passivas.alocados.push(...caminho);
    t = performance.now();
    const ef = P.efeitos(e);
    const tEfeitos = performance.now() - t;
    assert.equal(ef.dano.fire, caminho.length);
    t = performance.now();
    for (let i = 0; i < 1000; i++) P.efeitos(e);
    const tCache = performance.now() - t;
    assert.ok(tValidar < 500 && tCaminho < 200 && tEfeitos < 100, `validar ${tValidar} caminho ${tCaminho} efeitos ${tEfeitos}`);
    assert.ok(tCache < 50, `1000 leituras com cache: ${tCache}ms`);
  } finally {
    P.usarArvore(antes);
  }
});
