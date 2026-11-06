// OS ÚNICOS DE FORA DA LISTA (04/11, a auditoria dos itens × poedb — docs/auditoria-itens-poedb.md): as 9 Réplicas que faltavam (a página
// Replica_unique_item do poedb) e a Ramificadora única Filho da Violência (a página Cluster_Jewel). As páginas ficam em
// gamedata/itens-poe/unicos-fora-da-lista.json; o tools/auditar-unicos-poedb.mjs as põe nos `novos` de unicos-correcoes.json e o
// tools/importar-joias-unicas.mjs, o "Limitado a" delas. Aqui: elas estão no jogo com as linhas do poedb, toda linha tem efeito ou fica
// marcada (inerte com a nota — nenhuma "registrada" calada), e as mecânicas novas: o Crescimento Frágil, a Réplica: Talento Puro, a Velocidade
// "enquanto Resfriado", o "Não Pode Drenar ou Regenerar Mana", o Dano Físico que Congela e a pedra do Filho da Violência (o Combatente).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Joias = await import('../systems/passivas/joias.mjs');
await import('../systems/passivas/ramificadoras.mjs');
const Condicoes = await import('../systems/itens-poe/condicoes-poe.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { interna, marcador } = await import('../systems/itens-poe/comparar-unicos.mjs');
if (!SEM) {
  await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const FORA = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/unicos-fora-da-lista.json', import.meta.url), 'utf8')).unicos;
const JOIAS_UNICAS = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/joias-unicas.json', import.meta.url), 'utf8')).joias;
const cat = () => Catalogo.catalogo();
const doJogo = (slug) => {
  for (const [id, c] of Object.entries(cat().classes)) {
    const u = c.unicos?.find((x) => x.slug === slug);
    if (u) return { u, classe: id, base: c.bases.find((b) => b.nome === u.base) };
  }
  return null;
};
const peca = (slug) => {
  const { base } = doJogo(slug);
  return J.pecaDoJogo(gerarPeca({ catalogo: cat(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 84, rng: () => 0.99, unico: slug }));
};
const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });

test('os 10 estão no jogo, na classe da base, com as linhas do poedb (e o "Limitado a: 1" das joias)', { skip: SEM }, () => {
  // (aval do dono 06/11: +6, os únicos base do Emissário — as Partes os formam)
  const CLASSE = {
    Replica_Soul_Taker: 'One_Hand_Axes', Replica_Forbidden_Shako: 'Helmets', The_Rippling_Thoughts: 'One_Hand_Swords', The_Unshattered_Will: 'Shields',
    The_Enmity_Divine: 'Staves', The_Flow_Untethered: 'Belts', The_Fracturing_Spinner: 'Quivers', The_Tempests_Binding: 'Helmets',
  };
  assert.equal(Object.keys(FORA).length, 16);
  for (const [slug, p] of Object.entries(FORA)) {
    const j = doJogo(slug);
    assert.ok(j?.base, `${slug}: no jogo, com a base`);
    assert.equal(j.classe, CLASSE[slug] ?? 'Jewels', slug);
    const v = p.versoes[0];
    assert.equal(j.u.nome, v.nome);
    assert.equal(j.u.base, v.base);
    const linhas = v.linhas.filter((l) => !interna(l.texto) && !marcador(l.texto)).map((l) => l.jogo.texto);
    assert.deepEqual(j.u.modificadores.map((m) => m.texto), linhas, slug);
  }
  for (const slug of ['Replica_Conquerors_Efficiency', 'Replica_Fragile_Bloom', 'Replica_Hotheaded', 'Replica_Pure_Talent']) assert.equal(JOIAS_UNICAS[slug]?.limite, 1, slug);
  for (const slug of ['Replica_Blood_Sacrifice', 'Replica_Cheap_Construction', 'Replica_Unstable_Payload']) assert.equal(JOIAS_UNICAS[slug], undefined, `${slug}: sem limite no poedb`);
});

test('a peça gerada: toda linha com efeito, lembrete ou inerte com a nota (nenhuma registrada sem efeito)', { skip: SEM }, () => {
  const inertes = [];
  for (const slug of Object.keys(FORA)) {
    const p = peca(slug);
    assert.ok(p?.poe, slug);
    p.poe.estados.forEach((e, i) => {
      assert.notEqual(e, 'registrado', `${slug}: "${p.poe.modificadores[i]?.texto}"`);
      if (e === 'inerte') inertes.push(slug);
    });
  }
  // (o que fica inerte: as 2 de "Suportadas por" do Shako Proibido — como as do Shako Proibido de sempre — e a linha de pesca do Combatente)
  // (aval do dono 06/11: e os 5 base do Emissário com "Convocar Emissário …", gema que o jogo não tem — o das Direções vale)
  assert.deepEqual([...new Set(inertes)].sort(), ['Child_of_Violence', 'Replica_Forbidden_Shako', 'The_Enmity_Divine', 'The_Flow_Untethered', 'The_Rippling_Thoughts', 'The_Tempests_Binding', 'The_Unshattered_Will']);
});

test('as linhas novas da tradução: o Dano Físico que Congela, o "Não Pode Drenar ou Regenerar Mana" e a Velocidade enquanto Resfriado', { skip: SEM }, () => {
  assert.deepEqual(tr('Seu Dano Físico pode Congelar').efeitos, [{ stat: 'pode:congelamento:physical', valor: 1 }]);
  assert.deepEqual(tr('Não Pode Drenar ou Regenerar Mana').efeitos, [{ stat: 'sem_roubo_mana', valor: 1 }, { stat: 'sem_regen_mana', valor: 1 }]);
  assert.deepEqual(tr('Velocidade de Ataque enquanto Resfriado aumentada em {0}%', [15]).efeitos, [{ stat: 'atk_speed@resfriadoProprio', valor: 15 }]);
  assert.deepEqual(tr('Velocidade de Movimento enquanto Resfriado aumentada em {0}%', [12]).efeitos, [{ stat: 'move_speed@resfriadoProprio', valor: 12 }]);
  // (a do meio da Cabeça Quente já casava pela condição no fim)
  assert.deepEqual(tr('Velocidade de Conjuração aumentada em {0}% enquanto Resfriado', [10]).efeitos, [{ stat: 'cast_speed@resfriadoProprio', valor: 10 }]);
  for (const m of ['Seu Dano Físico pode Congelar', 'Não Pode Drenar ou Regenerar Mana', 'Velocidade de Ataque enquanto Resfriado aumentada em {0}%']) assert.equal(tr(m, [10]).estado, 'novo', m);
});

/** O Marauder nível 90 com o 1º encaixe de joia da árvore alocado. */
function comEncaixe() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  const no = P.arvore().nos.find((n) => P.ehEncaixeDeJoia(n) && !n.expansao)?.id ?? P.arvore().nos.find((n) => P.ehEncaixeDeJoia(n)).id;
  e.passivas.alocados.push(no);
  P.garantir(e);
  e.inventory = [];
  return { e, no };
}
const encaixar = (e, no, p) => {
  e.inventory.push(p);
  return Joias.encaixar(e, { no, pilha: e.inventory.length - 1, id: p.id });
};
const af = (e) => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };

test('o CRESCIMENTO FRÁGIL (a Réplica: Florescer Frágil): o máximo quando Acertado, menos 1 por segundo; 0,7% de Vida Regenerada por cada', { skip: SEM }, () => {
  const total = { crescimento_fragil_max: 5, crescimento_fragil_perda_por_s: 1, crescimento_fragil_ao_ser_acertado: 1 };
  assert.equal(Condicoes.crescimentoFragil(total, { clock: 10_000, poeRecente: {} }), 0, 'sem acerto sofrido');
  assert.equal(Condicoes.crescimentoFragil(total, { clock: 10_000, poeRecente: { acertado: 10_000 } }), 5);
  assert.equal(Condicoes.crescimentoFragil(total, { clock: 12_999, poeRecente: { acertado: 10_000 } }), 3);
  assert.equal(Condicoes.crescimentoFragil(total, { clock: 30_000, poeRecente: { acertado: 10_000 } }), 0);
  assert.equal(Condicoes.crescimentoFragil({ ...total, crescimento_fragil_ao_ser_acertado: 0 }, { clock: 10_000, poeRecente: { acertado: 10_000 } }), 0, 'sem a linha do acerto');
  assert.equal(Condicoes.fatorDaEscala({ hunt: { clock: 11_000, poeRecente: { acertado: 10_000 } } }, total, null, 'crescimentoFragil'), 4);
  // na árvore: a joia no encaixe, o acerto sofrido há 2 s → 3 Crescimentos → +2,1% de Vida Regenerada por segundo
  const { e, no } = comEncaixe();
  e.hunt = { clock: 100_000, poeEntrou: 90_000, pos: { x: 0, y: 0 }, monstros: [], lacaios: [], buffs: {}, poeRecente: {} };
  const antes = af(e).life_regen_max_pct ?? 0;
  assert.ok(encaixar(e, no, peca('Replica_Fragile_Bloom')).ok);
  assert.equal(af(e).life_regen_max_pct ?? 0, antes, 'sem acerto, nada');
  e.hunt.poeRecente.acertado = 98_000;
  assert.ok(Math.abs((af(e).life_regen_max_pct ?? 0) - antes - 2.1) < 1e-9);
});

test('a RÉPLICA: TALENTO PURO: o bônus da classe cujo início a árvore alcança (o Marauder: 1% de Vida Regenerada; a Caçadora com a passiva encostada)', { skip: SEM }, () => {
  const { e, no } = comEncaixe();
  const antes = af(e);
  assert.ok(encaixar(e, no, peca('Replica_Pure_Talent')).ok);
  const com = af(e);
  assert.ok(Math.abs((com.life_regen_max_pct ?? 0) - (antes.life_regen_max_pct ?? 0) - 1) < 1e-9, 'Marauder: a sua');
  assert.equal((com.frasco_cargas_recebidas ?? 0) - (antes.frasco_cargas_recebidas ?? 0), 0, 'a Caçadora, não');
  const ranger = P.arvore().nos.find((n) => n.id === P.arvore().inicios.Ranger);
  e.passivas.alocados.push(ranger.conexoes[0]);
  P.garantir(e);
  assert.equal((af(e).frasco_cargas_recebidas ?? 0) - (antes.frasco_cargas_recebidas ?? 0), 20, 'agora a da Caçadora');
});

test('o FILHO DA VIOLÊNCIA: a Pequena da pedra Combatente (1 nó, a do PoB "Pitfighter"); a linha dela, de pesca, fica inerte com a nota', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  e.inventory = [];
  e.level = 100;
  for (const x of P.caminhoAte(e, '2491')) assert.ok(P.alocar(e, x).ok);
  const p = peca('Child_of_Violence');
  assert.equal(p.poe.ramificadora?.tamanho, 'Small');
  assert.ok(encaixar(e, '2491', p).ok);
  const nos = P.nosDaRamificadora(e, '2491').map((id) => P.grafoDe(e).porId.get(id));
  assert.equal(nos.length, 1);
  assert.equal(nos[0].nomeEn, 'Pitfighter');
  assert.equal(nos[0].nome, 'Combatente');
  assert.deepEqual(nos[0].textos, ['Força da Linha de Pesca aumentada em 1%']);
  assert.deepEqual(nos[0].estados, ['inerte']);
  assert.match(nos[0].notas?.[0] ?? '', /pesca/);
  assert.deepEqual(p.poe.estados, ['inerte']);
});
