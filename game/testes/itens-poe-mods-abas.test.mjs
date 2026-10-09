// As ABAS do poedb no jogo (dono, 09/10: "entre em cada aba para extrair as coisas que faltam, utilizando para estudar o PoE e implementar
// tudo" e "eu quero que tenha efeito real, funcione 100%"): os pools que faltavam (o corrompido das Espadas de Duas Mãos, o "+1 ao Mínimo de
// Cargas de Poder", o Labirinto), as traduções novas dos implícitos eldritch/influências/corrompidos e o EFEITO de cada uma no motor — efeito
// de aura/buff de UMA gema (também com o Único na presença) e dos golens, efeito das maldições, Intimidar/Inervar/Exposição no acerto, a
// recuperação do dano sofrido de um elemento, a velocidade de recuperação, o sangramento mais rápido e as cargas a cada N segundos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const R = await import('../systems/skills/reforcos.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const Cargas = await import('../systems/itens-poe/cargas.mjs');
const A = await import('../systems/itens-poe/afeccoes.mjs');
const Dot = await import('../systems/combate/dot.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const M = await import('../systems/itens-poe/moedas.mjs');
const { traduzirParte } = await import('../systems/itens-poe/traduzir.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  Jogo.iniciar(ITEM_CATALOG);
  await G.iniciar({ registrarGema: (g) => (Acoes.registrarAcao(g.entry), GS.registrarAtiva(g)), registrarReforco: R.registrar });
}
const rngDe = (s) => { let x = s; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };
const sempre = () => 0;
/** O slug da gema no registro pelo nome (pt). */
const slugDa = (nome) => [...G.REGISTRO].find(([, r]) => r.gema?.nome === nome)?.[0];

/** Um personagem do PoE com um anel do PoE com estes atributos já traduzidos. */
function personagem(af = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), { classePoe: 'Duelist' });
  e.equipment = { ...(e.equipment ?? {}), ring: { id: Jogo.idDaBase('Rings/Iron_Ring'), count: 1, poe: { base: 'Rings/Iron_Ring', classe: 'Rings', af, tv: Jogo.VERSAO_DA_TRADUCAO } } };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return e;
}

test('os pools das abas: o corrompido das Espadas de Duas Mãos (o Orbe Vaal agora sorteia), o "+1 ao Mínimo de Cargas de Poder", o Labirinto para qualquer luva', { skip: SEM }, () => {
  const espadas = Catalogo.poolEspecialDa('corrupted', 'Two_Hand_Swords', '*');
  assert.ok(espadas?.implicitos.length >= 12, 'o corrompido das Espadas de Duas Mãos');
  assert.ok(Catalogo.poolEspecialDa('corrupted', 'Amulets', '*').implicitos.some((f) => f.tiers.some((t) => t.texto === '+1 ao Mínimo de Cargas de Poder')));
  // O Labirinto é igual para qualquer luva: gravado uma vez (`*`), achado pela variante de atributo.
  const lab = Catalogo.poolEspecialDa('labirinto', 'Gloves', 'dex');
  assert.ok(lab?.implicitos.length > 0);
  assert.equal(lab, Catalogo.poolEspecialDa('labirinto', 'Gloves', 'str_int'));
  // Juntar o complemento de novo não repete família.
  const base = Catalogo.poolEspecial('corrupted');
  assert.equal(Catalogo.juntarPools(base, base).familias, base.familias);
  // O Orbe Vaal numa espada de duas mãos: o implícito corrompido sai (antes não havia pool).
  const espada = Catalogo.catalogo().classes.Two_Hand_Swords.bases.find((b) => b.pool && (b.requisitos?.nivel ?? 1) <= 60).id;
  const p = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: espada, raridade: 'raro', ilvl: 84, rng: rngDe(5) }));
  let achou = null;
  for (let s = 1; s < 200 && !achou; s++) {
    const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { inventory: [structuredClone(p), { id: M.idDa('Vaal_Orb'), count: 1 }] });
    assert.equal(M.usar(e, { moeda: M.idDa('Vaal_Orb'), alvo: { onde: 'inventory', indice: 0 } }, rngDe(s * 104_729)).ok, true);
    if (e.inventory[0].poe.implicitos?.[0]?.corrompido) achou = e.inventory[0];
  }
  assert.ok(achou, 'o implícito corrompido da espada de duas mãos saiu');
  assert.equal(achou.poe.implicitos[0].origem, 'corrupted');
});

test('as traduções novas: cada texto vira o atributo que o motor lê (e a gema que o jogo não tem fica "não existe", com o porquê)', { skip: SEM }, () => {
  const casos = [
    ['Ira possui {0}% de aumento do Efeito de Aura', 'efeito_buff_gema:ira'],
    ['Enquanto um Inimigo Único estiver em sua presença, Ira possui {0}% de aumento do Efeito de Aura', 'efeito_buff_gema:ira@unicoNaPresenca'],
    ['Pureza do Fogo tem Efeito de Aura aumentado em {0}%', 'efeito_buff_gema:pureza-ardente'],
    ['Efeito do Buff da Armadura Ártica aumentado em {0}%', 'efeito_buff_gema:armadura-artica'],
    ['Oferenda Espiritual tem Efeito aumentado em {0}%', 'efeito_buff_gema:oferenda-espiritual'],
    ['Efeitos do Buff concedido pelos seus Golens de Chamas aumentados em {0}%', 'efeito_buff_gema:convocar-golem-flamejante'],
    ['Efeitos de Buffs concedidos pelos seus Golens aumentados em {0}%', 'efeito_buff_gema:golem'],
    ['Efeito das suas Maldições aumentado em {0}%', 'efeito_maldicao'],
    ['Efeito da Maldição Flamabilidade aumentado em {0}%', 'efeito_maldicao_gema:flamabilidade'],
    ['Velocidade de Recuperação de Vida aumentada em {0}%', 'recuperacao_vida_inc'],
    ['{0}% do Dano de Fogo sofrido é Recuperado como Vida', 'recoup_life_fire'],
    ['{0}% do Dano Físico Recebido como Dano de Gelo', 'recebe_physical_como_ice'],
    ['{0}% de aumento de Dano por cada {1} de Força', 'dmg_inc%atr:str:5'],
    ['Chance de Acerto Crítico para Ataques aumentada em {0}%', 'crit_chance_inc@ataque'],
    ['{0}% de chance de Intimidar Inimigos por {1} segundos no Acerto', 'chance_intimidar'],
    ['Inflige Exposição a Raio ao Acertar, aplicando {0}% de Resistência a Raio', 'exposicao_acerto_raio'],
    ['Sangramentos infligidos por você causam Dano {0}% mais rápido', 'sangramento_mais_rapido'],
    ['Ganha uma Carga de Frenesi a cada {0} segundos', 'frenesi_a_cada_s'],
    ['{0}% de chance de ganhar Agressividade por {1} segundos ao Matar', 'ev:matar:buffChance:agressividade:5'],
  ];
  for (const [texto, stat] of casos) {
    const r = traduzirParte(texto, [20, 5]);
    assert.ok(['equivalente', 'aproximado', 'novo'].includes(r.estado), `${texto}: ${r.estado} ${r.nota ?? ''}`);
    assert.equal(r.efeitos[0].stat, stat, texto);
  }
  const punicao = traduzirParte('Efeito da Maldição Punição aumentado em {0}%', [20]);
  assert.equal(punicao.estado, 'inerte');
  assert.match(punicao.nota, /Punição/);
});

test('no acerto: Intimidar e Inervar pela duração do mod, e a Exposição com o valor do mod (a mais forte vale)', { skip: SEM }, () => {
  const e = personagem({ chance_intimidar: 100, intimidar_s: 6, chance_inervar: 100, exposicao_acerto_fogo: -20 });
  e.hunt = { clock: 0, monstros: [], pos: { x: 0, y: 0, z: 7 } };
  const f = Ficha.combate(e);
  const alvo = { uid: 'a', name: 'a', hp: 1000, maxHp: 1000, x: 1, y: 0, estados: {} };
  ModsPoe.aoAcertar(e, e.hunt, alvo, f, { dano: 10, rng: sempre, agora: 0 });
  assert.equal(alvo.estados.intimidado.ate, 6000);
  assert.equal(alvo.estados.inervado.ate, 4000, 'sem duração no mod: os 4 s do PoE');
  assert.equal(C.exposicao(alvo, 100, 'fire'), 20);
  assert.equal(C.exposicao(alvo, 100, 'ice'), 0);
  assert.equal(C.exposicao(alvo, 5000, 'fire'), 0, 'passa em 4 s');
  // O Inervado: as magias causam 10% mais; o Intimidado, os ataques.
  assert.equal(C.fatorRecebidoPeloBicho(alvo, 'fire', { tagsDoGolpe: ['magia'] }, 100), 1.1);
  assert.equal(C.fatorRecebidoPeloBicho(alvo, 'fire', { tagsDoGolpe: ['ataque'] }, 100), 1.1);
});

test('a recuperação do dano sofrido de UM elemento, a velocidade de recuperação e a regeneração', { skip: SEM }, () => {
  const e = personagem({ recoup_life_fire: 50, recuperacao_vida_inc: 100 });
  e.hunt = { clock: 0, monstros: [], efeitosDoJogador: {} };
  const f = Ficha.combate(e);
  const bicho = { uid: 'b', name: 'b', hp: 100, maxHp: 100, x: 0, y: 0 };
  ModsPoe.aoSerAcertado(e, e.hunt, bicho, f, { dano: 100, tipo: 'physical' });
  assert.equal(e.hunt.recuperacoes?.length ?? 0, 0, 'o golpe Físico não recupera pelo mod de Fogo');
  ModsPoe.aoSerAcertado(e, e.hunt, bicho, f, { dano: 100, tipo: 'fire' });
  const rec = e.hunt.recuperacoes[0];
  assert.equal(rec.ate, 2000, '+100% de velocidade de recuperação: em 2 s em vez de 4');
  assert.ok(Math.abs(rec.porMs * 2000 - 50) < 1e-9, 'os mesmos 50 de vida');
  assert.equal(Ficha.regenDoPoe(e, { life_regen: 10, recuperacao_vida_inc: 50 }).vidaPorSegundo, 15);
  assert.equal(Ficha.regenDoPoe(e, { recuperacao_mana_inc: 100 }).manaAumentada, 100);
});

test('o efeito das maldições das peças aumenta as marcas da maldição (o de todas e o de UMA)', { skip: SEM }, () => {
  const e = personagem({ efeito_maldicao: 20, 'efeito_maldicao_gema:flamabilidade': 30 });
  const flamabilidade = slugDa('Flamabilidade');
  assert.ok(flamabilidade, 'a gema Flamabilidade');
  const marcas = [{ efeito: 'marcaVulneravel', pct: 10, tipos: ['fire'] }];
  assert.equal(Acoes.efeitosDaMaldicao(marcas, {}, e, { poeGema: { slug: flamabilidade } })[0].pct, 15);
  const desespero = slugDa('Desespero');
  assert.equal(Acoes.efeitosDaMaldicao(marcas, {}, e, { poeGema: { slug: desespero } })[0].pct, 12, 'outra maldição: só o efeito de todas');
});

test('o efeito do buff de UMA aura (com o Único na presença) e o dos golens', { skip: SEM }, () => {
  const ira = slugDa('Ira');
  const golem = slugDa('Convocar Golem Flamejante');
  assert.ok(ira && golem);
  const e = personagem({ 'efeito_buff_gema:ira@unicoNaPresenca': 50, 'efeito_buff_gema:golem': 100 });
  e.hunt = { clock: 0, pos: { x: 0, y: 0, z: 7 }, monstros: [], buffs: { [`poe-gema:${ira}`]: { tipo: 'poe-aura', ate: 99_999, afPoe: { added_energy_dmg_max: 20 } } }, lacaios: [{ hp: 10, golem: true, gema: golem, tipo: 'lacaio', afDono: { dmg_inc: 20 } }] };
  let t = G.adds(e);
  assert.equal(t.added_energy_dmg_max, 20, 'sem Único por perto: a aura normal');
  assert.equal(t.dmg_inc, 40, 'o golem com +100% de efeito do buff');
  e.hunt.monstros.push({ hp: 100, x: 2, y: 1, raridade: 'unico' });
  t = G.adds(e);
  assert.equal(t.added_energy_dmg_max, 30, 'o Único na presença: +50% de efeito da Ira');
});

test('o sangramento mais rápido (o mesmo total em menos tempo) e uma carga de Frenesi a cada N segundos', { skip: SEM }, () => {
  const b = { uid: 1, hp: 10_000, maxHp: 10_000, x: 0, y: 0 };
  const af = A.daSoma({ sangramento_mais_rapido: 100 });
  A.aoAcertar(b, [{ elemento: 'physical', dano: 200 }], { afeccoes: { ...af, chance: { ...af.chance, sangramento: 100 } }, rng: sempre, agora: 0 });
  const s = Dot.dosDoTipo(b, 'sangramento')[0];
  assert.ok(Math.abs(s.falta - 200 * 0.7 * 5) < 1e-6, 'o mesmo total');
  assert.ok(s.ate <= 2500, `em metade do tempo (acaba em ${s.ate} ms; sem o mod, 5000)`);
  const e = personagem();
  e.hunt = { clock: 0, monstros: [] };
  const regras = { frenesi_a_cada_s: 2 };
  Cargas.tique(e, regras);
  assert.equal(e.hunt.cargasPoe?.frenesi?.n ?? 0, 0);
  e.hunt.clock = 2000;
  Cargas.tique(e, regras);
  assert.equal(e.hunt.cargasPoe.frenesi.n, 1);
  assert.ok(Cargas.regrasDaSoma({ poder_a_cada_s: 4 }).poder_a_cada_s, 'a ficha passa o atributo às cargas');
});
