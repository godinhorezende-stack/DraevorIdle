// (08/11 — o dono: "Criar a Fenda do Abismo") o ABISMO do PoE (`systems/itens-poe/abismo.mjs`): nos mapas e nos atos 6 a 10, abre ao chegar perto,
// solta as ondas de monstros Abissais do poedb (marcados para o "contra Monstros Abissais" do Nebulis) e, fechado, deixa o Repositório Abissal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const Abismo = await import('../systems/itens-poe/abismo.mjs');
const BausPoe = await import('../systems/itens-poe/baus-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Instancia = await import('../systems/hunt/instancia.mjs');
const Encontros = await import('../systems/encontros/estado.mjs');
const { BESTIARY } = await import('../systems/hunt/monstros.mjs');
const { tagsDoAlvo } = await import('../systems/itens-poe/condicoes-poe.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Campanha = await import('../systems/campanha.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');

const AREA = 'poe-a6-the-coast';

test('os monstros Abissais do poedb: os 3 grupos e os status no nível (o padrão do nível × a % do monstro)', { skip: SEM }, () => {
  assert.deepEqual(Object.keys(Abismo.DADOS.grupos), ['obscurecidos', 'sangueNegro', 'fosso']);
  const k = Abismo.chaveDoMonstro('Lightless_Serpent', 70);
  const vida = Abismo.DADOS.porNivel.vida[69] * 1.4;
  assert.equal(BESTIARY[k].name, 'Serpente Obscurecida');
  assert.equal(BESTIARY[k].hp, Math.round(vida * 1.4), 'a Vida × 140% e o Escudo de Energia de 40% da Vida');
  const ondas = Abismo.ondasDo('obscurecidos', 70, () => 0.3);
  assert.equal(ondas.length, 3);
  assert.ok(ondas.every((o) => o.criaturas.every((c) => BESTIARY[c.key])), 'todas no bestiário');
  assert.equal(ondas[2].raridade, 'raro', 'o fosso: Raros');
  assert.ok(ondas[2].criaturas.some((c) => BESTIARY[c.key].name === 'Pesadelo Obscuro'), 'com o comandante');
  assert.equal(Abismo.valeNaArea({ poeMapa: 5 }), 'mapa');
  assert.equal(Abismo.valeNaArea({ poeArea: true, id: AREA }), 'campanha');
  assert.equal(Abismo.valeNaArea({ poeArea: true, id: 'poe-a1-the-coast' }), null, 'a primeira parte não tem Abismo');
});

test('o Nebulis: "contra Monstros Abissais" vale no monstro das ondas', { skip: SEM }, () => {
  const t = T.traduzirMod({ modelo: 'Dano com Acertos e Afecções contra Monstros Abissais aumentado em {0}%', valores: [40] });
  assert.equal(t.estado, 'equivalente');
  assert.deepEqual(t.efeitos.map((x) => x.stat), ['dmg_inc@alvoAbissal', 'ailment_dmg_inc@alvoAbissal']);
  assert.ok(tagsDoAlvo({ abissal: true, hp: 1, maxHp: 2 }, 0).includes('alvoAbissal'));
  assert.ok(!tagsDoAlvo({ hp: 1, maxHp: 2 }, 0).includes('alvoAbissal'));
});

test('caçando no ato 6: o Abismo abre ao chegar perto, as 3 ondas de Abissais e, fechado, o Repositório com a Joia Abissal', { skip: SEM }, () => {
  const cfg = Catalogo.REGRAS.abismo;
  const antes = cfg.chance.campanha;
  cfg.chance.campanha = 1;
  let e;
  try {
    e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 70 }), { sistema: 'poe', classePoe: 'Marauder' });
    delete e.classe;
    P.garantir(e);
    e.campanha = { facil: { completas: Campanha.FASES.map((x) => x.huntId).filter((id) => id !== AREA), bosses: [1, 2, 3, 4, 5] } };
    const r = Cacadas.entrar(e, { huntId: AREA, mode: 'auto', strategy: 'nearest', dificuldade: 'facil' });
    assert.equal(r.ok, true, r.erro);
  } finally {
    cfg.chance.campanha = antes;
  }
  const h = e.hunt;
  const inst = Instancia.daSala(h);
  const ab = inst.encontros['abismo-poe-1'];
  assert.ok(ab, 'a instância tem o Abismo');
  assert.ok(Instancia.encontrosVisiveis(inst).some((x) => x.tipo === Abismo.TIPO), 'a tela vê o Abismo');
  // longe, não abre; perto, abre
  h.pos = { x: ab.x + 10, y: ab.y };
  assert.equal(Abismo.abrirAoPassar(e, h, PERSONAGEM), false);
  h.pos = { x: ab.x + 2, y: ab.y };
  h.z = ab.z;
  assert.equal(Abismo.abrirAoPassar(e, h, PERSONAGEM), true);
  assert.equal(ab.estado, 'ativo');
  const daOnda = () => [...h.monstros, ...Object.values(h.outrosAndares ?? {}).flat()].filter((m) => m.encontro === ab.id && m.hp > 0);
  let agora = h.clock ?? 0;
  for (let onda = 0; onda < 3; onda++) {
    const vivos = daOnda();
    assert.ok(vivos.length > 0, `a onda ${onda + 1} nasceu`);
    assert.ok(vivos.every((m) => m.abissal), 'marcados como Abissais');
    for (const m of vivos) m.hp = 0;
    agora += 100;
    Encontros.avaliar(inst, { hunt: h, agora, estado: e, personagem: PERSONAGEM });
    agora += ab.pausaMs + 1;
    Encontros.avaliar(inst, { hunt: h, agora, estado: e, personagem: PERSONAGEM });
  }
  assert.equal(ab.estado, 'concluido');
  const repo = inst.encontros[`${ab.id}-repositorio`];
  assert.ok(repo && repo.abissal && repo.nome === Abismo.NOME_DO_REPOSITORIO, 'o Repositório Abissal');
  assert.ok(BausPoe.ehBauPoe(repo), 'um baú do PoE (o desenho, abrir ao passar)');
  const joia = BausPoe.joiaDoRepositorio(70, 0, () => 0.01);
  assert.equal(joia?.poe?.classe, 'Abyss_Jewels', 'a Joia Abissal');
  assert.equal(BausPoe.joiaDoRepositorio(70, 0, () => 0.99), null, 'pela chance');
});

test('a FENDA (Breach): abre ao chegar perto, as ondas do Senhor; dentro do círculo você está "em uma Fenda" e o Anel da Fenda dobra', { skip: SEM }, async () => {
  const Fenda = await import('../systems/itens-poe/fenda.mjs');
  const Afixos = await import('../systems/afixos.mjs');
  const Jogo = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const { acharHunt, gradeDaHunt } = await import('../systems/hunt/terreno.mjs');
  assert.deepEqual(Object.keys(Fenda.DADOS.senhores), ['xoph', 'tul', 'esh', 'uulNetol', 'chayula']);
  const ondas = Fenda.ondasDo('xoph', 75, () => 0.3);
  assert.ok(ondas.every((o) => o.criaturas.every((c) => BESTIARY[c.key])));
  assert.ok(ondas[2].criaturas.some((c) => BESTIARY[c.key].name === 'Fiel de Xoph'), 'o comandante na última');
  // numa instância de verdade (a Costa do ato 6), forçada como mapa
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 70 }), { sistema: 'poe', classePoe: 'Marauder' });
  delete e.classe;
  P.garantir(e);
  e.campanha = { facil: { completas: Campanha.FASES.map((x) => x.huntId).filter((id) => id !== AREA), bosses: [1, 2, 3, 4, 5] } };
  assert.equal(Cacadas.entrar(e, { huntId: AREA, mode: 'auto', strategy: 'nearest', dificuldade: 'facil' }).ok, true);
  const h = e.hunt;
  const inst = Instancia.daSala(h);
  const todos = h.monstros.map((m) => ({ z: h.z, m }));
  const cfg = Catalogo.REGRAS.fenda;
  const antes = cfg.chance;
  cfg.chance = 1;
  let fe;
  try {
    fe = Fenda.porNaInstancia(inst, { grade: gradeDaHunt(acharHunt(AREA)), inicio: h.pos, todos, nivel: 75, ehMapa: true });
  } finally {
    cfg.chance = antes;
  }
  assert.ok(fe && Instancia.encontrosVisiveis(inst).some((x) => x.tipo === Fenda.TIPO && x.raio === fe.raio));
  assert.equal(Fenda.porNaInstancia({ encontros: {} }, { grade: gradeDaHunt(acharHunt(AREA)), todos, nivel: 75, ehMapa: false }), null, 'só nos mapas');
  // o Anel da Fenda: os números da peça em dobro dentro da Fenda
  const anel = Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Rings/Breach_Ring', raridade: 'magico', ilvl: 80, rng: () => 0.4 }));
  anel.poe.af.fire_res = 30;
  e.equipment = { ...(e.equipment ?? {}), ring: anel };
  assert.equal(anel.poe.af.dobrado_em_fenda, 1);
  assert.equal(Afixos.somaDeItens(e).fire_res, 30, 'fora da Fenda');
  let invalidou = 0;
  h.pos = { ...h.pos, x: fe.x + 2, y: fe.y };
  h.z = fe.z;
  assert.equal(Fenda.tique(e, h, PERSONAGEM, () => invalidou++), true, 'abriu');
  assert.equal(fe.estado, 'ativo');
  assert.equal(h.poeEmFenda, true);
  assert.equal(invalidou, 1, 'a ficha é refeita ao entrar');
  assert.equal(Afixos.somaDeItens(e).fire_res, 60, 'dentro da Fenda, em dobro');
  h.pos = { ...h.pos, x: fe.x + fe.raio + 3 };
  Fenda.tique(e, h, PERSONAGEM, () => invalidou++);
  assert.equal(h.poeEmFenda, undefined);
  assert.equal(invalidou, 2);
  assert.ok(T.traduzirMod({ modelo: 'Propriedades são dobradas enquanto em uma Fenda', valores: [] }).estado === 'equivalente');
});

test('as luvas do Labirinto: "Ativa Mandamento das Chamas ao Acertar" — a habilidade do poedb dispara no acerto e queima os monstros perto', { skip: SEM }, async () => {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
  const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
  for (const t of ['Word', 'Edict', 'Decree', 'Commandment']) for (const f of ['Blades', 'Flames', 'Frost', 'Inferno', 'Thunder', 'the_Tempest', 'Winter', 'Ire', 'Light', 'War', 'the_Grave', 'Force', 'Fury', 'Spite', 'Reflection']) assert.ok(GemasPoe.doSlug(`${t}_of_${f}`)?.gema?.nome, `${t}_of_${f}`);
  assert.equal(GemasPoe.doSlug('Edict_of_Frost').gema.nome, 'Édito do Gelo');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 70 }), { sistema: 'poe', classePoe: 'Marauder' });
  delete e.classe;
  P.garantir(e);
  const luva = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Gloves/Iron_Gauntlets', raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
  luva.poe.implicitos.push({ modelo: 'Ativa Mandamento das Chamas ao Acertar', texto: 'Ativa Mandamento das Chamas ao Acertar', valores: [], encantamento: true, labirinto: true });
  J.recalcular(luva);
  assert.ok(!['inerte', 'registrado'].includes(luva.poe.estados.at(-1)));
  e.equipment = { gloves: luva };
  Ficha.invalidar(e);
  e.campanha = { facil: { completas: Campanha.FASES.map((x) => x.huntId), bosses: [1, 2, 3, 4, 5] } };
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'online', strategy: 'nearest', dificuldade: 'facil' }).ok, true);
  const h = e.hunt;
  const alvo = h.monstros[0];
  h.pos = { ...h.pos, x: alvo.x + 1, y: alvo.y };
  const antes = alvo.hp;
  ModsPoe.evento(e, h, 'acertar', Ficha.combate(e), { alvo, eventos: [], personagem: PERSONAGEM });
  assert.ok(alvo.hp < antes, `o Mandamento das Chamas queimou (${antes} → ${alvo.hp})`);
});
