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
