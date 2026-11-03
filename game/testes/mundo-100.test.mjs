// "100%" — o LOTE MUNDO (dono, 03/11: "resolva essas que não se aplicam ao jogo, tem que estar tudo 100%"). As linhas que diziam "não se aplica ao
// jogo" no assunto do mundo passam a valer:
//   - os BAÚS do PoE nas caçadas (`itens-poe/baus-poe.mjs`): nascem na instância das áreas da campanha e dos mapas, perto dos monstros; abrem ao passar
//     (a até 2 casas), pelo clique e pelas linhas "abrir Baús próximos" e "Seus Clamores abrem Baús"; o loot é a tabela do monstro da raridade do baú;
//     o mapa único: "Área contém um Grande Baú" e "Baús têm a Raridade de Itens aumentada";
//   - o ESTANDARTE plantado no chão e a AURA (a área e a duração): "Bônus do seu estandarte permanecem…", "Efeito em Área de Habilidades de Aura",
//     "Habilidades de Aura Não Maldições têm Duração" — as linhas da tradução que estavam inertes;
//   - o VÍNCULO com o aliado da party ("…entre os Jogadores Vinculados");
//   - a PUNIÇÃO (a gema Castigo — Punishment no PoB): "Punição pode afetar Inimigos Infeitiçáveis".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const Jogo = await import('../systems/itens-poe/jogo.mjs');
if (!SEM) Jogo.iniciar(ITEM_CATALOG);
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { traduzirParte, TABELA } = await import('../systems/itens-poe/traduzir.mjs');
const A = await import('../systems/itens-poe/arvore.mjs');
const BausPoe = await import('../systems/itens-poe/baus-poe.mjs');
const Mapas = await import('../systems/itens-poe/mapas.mjs');
const Validacao = await import('../systems/itens-poe/mapas-validacao.mjs');
const Importador = await import('../tools/importar-mapas-unicos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Instancia = await import('../systems/hunt/instancia.mjs');
const { acharHunt, gradeDaHunt } = await import('../systems/hunt/terreno.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const Raridade = await import('../systems/mobs/raridade.mjs');
const Vinculos = await import('../systems/itens-poe/vinculos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Ficha = await import('../systems/ficha.mjs');
const { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } = await import('./apoio.mjs');

const semente = (s = 7) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
/** Traduz um texto com os números no lugar de `{n}` (como o modelo do catálogo). */
const tr = (texto) => {
  const valores = [];
  const modelo = texto.replace(/\d+(?:\.\d+)?/g, (n) => `{${valores.push(n) - 1}}`);
  return traduzirParte(modelo, valores);
};
function novo(classe = 'Scion') {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 70 }), { sistema: 'poe', classePoe: classe });
  delete e.classe;
  P.garantir(e);
  e.equipment = {};
  return e;
}
const naArea = () => {
  const e = novo();
  assert.equal(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto', strategy: 'nearest', dificuldade: 'facil' }).ok, true);
  return e;
};
const bausDe = (e) => Object.values(Instancia.daSala(e.hunt)?.encontros ?? {}).filter(BausPoe.ehBauPoe);

// ---------------------------------------------------------------- nenhuma nota "não se aplica" do assunto

test('a tradução: as linhas do lote mundo valem — nenhuma com "não se aplica ao jogo"', { skip: SEM }, () => {
  const casos = [
    ['25% de chance de abrir Baús próximos quando você Conjurar uma Magia', 'abrir_bau_ao_conjurar', 25],
    ['Seus Clamores abrem Baús', 'clamor_abre_baus', 1],
    ['Bônus do seu estandarte permanecem por 3 segundos após você sair da área', 'estandarte_fica_s', 3],
    ['Efeito em Área de Habilidades de Aura aumentado em 20%', 'area_inc@aura', 20],
    ['Habilidades de Aura Não Maldições têm Duração aumentada em 40%', 'duracao_habilidades@aura', 40],
    ['Sua Velocidade de Movimento é igual a maior Velocidade de Movimento entre os Jogadores Vinculados', 'velocidade_igual_vinculados', 1],
    ['Alvos Vinculados compartilham Cargas de Tolerância, Frenesi e Poder com você', 'vinculo_compartilha_cargas', 1],
    ['Maldições são infligidas em Você ao invés dos alvos Vinculados', 'maldicoes_em_voce_vinculo', 1],
    ['Punição pode afetar Inimigos Infeitiçáveis', 'feitico_afeta_aprova:Punishment', 1],
  ];
  for (const [texto, stat, valor] of casos) {
    const t = tr(texto);
    assert.notEqual(t.estado, 'inerte', texto);
    assert.deepEqual(t.efeitos.map((x) => [x.stat, x.valor]), [[stat, valor]], texto);
    assert.doesNotMatch(String(t.nota ?? ''), /não se aplica/, texto);
  }
  // as variantes com o espaço antes do "%" (as do poedb) também
  assert.deepEqual(traduzirParte('Habilidades de Aura Não Maldições têm Duração aumentada em {0} %', [50]).efeitos, [{ stat: 'duracao_habilidades@aura', valor: 50 }]);
  assert.deepEqual(traduzirParte('Efeito em Área de Habilidades de Aura aumentado em {0} %', [30]).efeitos, [{ stat: 'area_inc@aura', valor: 30 }]);
  // a Ramificadora com a Punição (a árvore traduz pela mesma tabela)
  assert.deepEqual(A.traduzirLinha('Punição pode afetar Inimigos Infeitiçáveis').efeitos.map((x) => x.add), ['feitico_afeta_aprova:Punishment']);
  // nenhuma regra do assunto ficou com a nota
  const doAssunto = /Baú|estandarte|Aura Não Maldições|Área de Habilidades de Aura|Vinculad|Punição/;
  const restam = TABELA.regras.filter((r) => doAssunto.test(r.padrao) && /não se aplica/.test(r.nota ?? '')).map((r) => r.padrao);
  assert.deepEqual(restam, []);
});

// ---------------------------------------------------------------- os baús

test('BAÚS: a instância da área do PoE nasce com 3 baús, em casas andáveis, alcançáveis, livres e perto dos monstros', { skip: SEM }, () => {
  const e = naArea();
  const baus = bausDe(e);
  assert.equal(baus.length, BausPoe.POR_AREA);
  const inst = Instancia.daSala(e.hunt);
  const bichos = [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];
  for (const b of baus) {
    assert.ok(BausPoe.RARIDADES.includes(b.raridade), b.raridade);
    assert.equal(b.tipo, BausPoe.tipoDoBau(b.raridade));
    assert.equal(b.estado, 'disponivel');
    assert.equal(b.obrigatorio, false, 'não segura o CLEAR');
    assert.ok(!bichos.some((m) => m.x === b.x && m.y === b.y && (m.z ?? b.z) === b.z), 'casa livre');
    assert.ok(bichos.some((m) => Math.max(Math.abs(m.x - b.x), Math.abs(m.y - b.y)) <= 3), 'perto de um monstro (a rota passa por ele)');
  }
  // o cliente vê os baús (o marcador desenhado) e a limpeza não espera por eles
  const visiveis = Instancia.encontrosVisiveis(inst).filter((x) => /^bau-poe-/.test(x.tipo));
  assert.equal(visiveis.length, BausPoe.POR_AREA);
  for (const m of bichos) m.hp = 0;
  e.hunt.monstros = [];
  e.hunt.outrosAndares = {};
  assert.equal(Instancia.marcarSeLimpou(e.hunt, 1), true, 'CLEAR com os baús fechados');
});

test('BAÚS: abrem AO PASSAR (a até 2 casas) — o loot cai; longe, nada; uma vez só', { skip: SEM }, () => {
  const e = naArea();
  const [b, ...outros] = bausDe(e);
  e.hunt.z = b.z;
  e.hunt.pos = { ...e.hunt.pos, x: b.x + 3, y: b.y };
  for (const o of outros) Object.assign(o, { x: b.x + 50, y: b.y + 50 });
  assert.equal(BausPoe.abrirAoPassar(e, e.hunt, PERSONAGEM), 0, 'a 3 casas, não');
  const ouro = e.gold ?? 0;
  e.hunt.pos = { ...e.hunt.pos, x: b.x + 2, y: b.y };
  assert.equal(BausPoe.abrirAoPassar(e, e.hunt, PERSONAGEM), 1);
  assert.equal(b.estado, 'concluido');
  assert.ok((e.gold ?? 0) > ouro, 'o ouro do baú no bolso');
  assert.equal(BausPoe.abrirAoPassar(e, e.hunt, PERSONAGEM), 0, 'já aberto');
  assert.equal(Instancia.encontrosVisiveis(Instancia.daSala(e.hunt)).some((x) => x.id === b.id), false, 'some da tela');
});

test('BAÚS: o tique da caçada abre o baú ao lado do personagem', { skip: SEM }, () => {
  const e = naArea();
  const [b] = bausDe(e);
  e.hunt.z = b.z;
  e.hunt.pos = { ...e.hunt.pos, x: b.x + 1, y: b.y };
  e.hunt.clock = (e.hunt.clock ?? 0) + 100;
  Cacadas.tique(e, PERSONAGEM, Date.now());
  assert.equal(b.estado, 'concluido');
});

test('BAÚS: o loot é a tabela do monstro da raridade do baú (Normal → Normal, Mágico → Mágico, Raro → Raro, Grande → Único)', { skip: SEM }, () => {
  assert.deepEqual(BausPoe.TIPO_DO_LOOT, { normal: 'normal', magico: 'modificado', raro: 'raro', grande: 'unico' });
  const media = (raridade) => {
    const rng = semente(11);
    let n = 0;
    for (let i = 0; i < 400; i++) n += BausPoe.lootDoBau(raridade, { nivel: 40, rng }).pecas.length;
    return n / 400;
  };
  const q = (tipo) => Jogo.quantidadeDoDrop(tipo);
  const [normal, magico, raro, grande] = ['normal', 'magico', 'raro', 'grande'].map(media);
  assert.ok(normal < magico && magico < raro && raro < grande, `${normal} < ${magico} < ${raro} < ${grande}`);
  assert.ok(Math.abs(grande - q('unico')) < 0.3, `o Grande Baú como o Único (${q('unico')}): ${grande}`);
  // o ouro do nível
  assert.ok(BausPoe.lootDoBau('normal', { nivel: 40, rng: semente(3) }).ouro > 0);
});

test('BAÚS: o Grande Baú do mapa único nasce a mais; "X% de chance de abrir Baús próximos ao Conjurar" e "Seus Clamores abrem Baús" abrem no raio', { skip: SEM }, () => {
  const e = naArea();
  const inst = Instancia.daSala(e.hunt);
  for (const b of bausDe(e)) delete inst.encontros[b.id];
  const todos = [...e.hunt.monstros.map((m) => ({ z: e.hunt.z ?? m.z, m }))];
  const grade = gradeDaHunt(acharHunt(HUNT_DE_TESTE));
  const criados = BausPoe.porNaInstancia(inst, { grade, todos, baus: { grandes: 1 }, rng: semente(5) });
  assert.equal(criados[0].raridade, 'grande');
  assert.equal(criados[0].nome, 'Grande Baú');
  assert.equal(criados.length, BausPoe.POR_AREA + 1);
  // o raio: um baú a 3 casas abre com a magia (4 casas) e com o Clamor (o raio dele); a 9, não
  const perto = { id: 'p', defId: 'bau-poe', tipo: 'bau-poe-normal', raridade: 'normal', nome: 'Baú', estado: 'disponivel', x: 3, y: 0, condicao: { tipo: 'sempre' }, obrigatorio: false, tentativas: 0 };
  const longe = { ...perto, id: 'l', x: 9 };
  const h = { clock: 1000, pos: { x: 0, y: 0 }, instancia: { id: 'i', encontros: { p: perto, l: longe } } };
  const f = novo();
  assert.equal(Acoes.abrirBausAoConjurar(f, h, null, 100, () => 0), 1);
  assert.equal(perto.estado, 'concluido');
  assert.equal(longe.estado, 'disponivel');
  Object.assign(perto, { estado: 'disponivel' });
  assert.equal(BausPoe.abrirNoRaio(f, h, null, 3), 1, 'o Clamor (raio 3) abre o de 3 casas');
  assert.equal(longe.estado, 'disponivel');
});

test('BAÚS no MAPA ÚNICO: "Área contém um Grande Baú" e "Baús têm a Raridade de Itens aumentada em X%" agem (a validação dos mapas: funciona)', { skip: SEM }, () => {
  assert.deepEqual(Importador.modificadorDe('Área contém um Grande Baú').efeitos, [{ alvo: 'instancia', stat: 'grandesBaus', fixo: 1 }]);
  assert.deepEqual(Importador.modificadorDe('Baús têm a Raridade de Itens aumentada em (2500—3500)%').efeitos, [{ alvo: 'instancia', stat: 'bausRaridadePct', de: 0 }]);
  for (const u of Mapas.unicos()) for (const m of u.modificadores) if (/Baú/.test(m.texto)) {
    assert.ok(m.efeitos.length, `${u.slug}: ${m.texto}`);
    assert.equal(Validacao.validarLinha(m).estado, 'funciona', `${u.slug}: ${m.texto}`);
  }
  const unico = (slug, tier) => Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: Mapas.baseDoTier(tier), raridade: 'unico', ilvl: Mapas.nivelDoTier(tier), rng: semente(), unico: slug }));
  const vaults = Mapas.resumo({ poe: unico('Vaults_of_Atziri', 10).poe });
  const pct = vaults.efeitos.instancia.bausRaridadePct;
  assert.ok(pct >= 2500 && pct <= 3500, String(pct));
  assert.equal(Mapas.fatoresDaInstancia(vaults).baus.raridadePct, pct);
  const acton = Mapas.resumo({ poe: unico('Actons_Nightmare', 10).poe });
  assert.equal(Mapas.fatoresDaInstancia(acton).baus.grandes, 1);
  assert.equal(Mapas.fatoresDaInstancia({}).baus.grandes, 0, 'o mapa comum não tem o Grande Baú');
});

// ---------------------------------------------------------------- a Punição, o Vínculo

test('PUNIÇÃO: "Punição pode afetar Inimigos Infeitiçáveis" — o Castigo pega no monstro à Prova de Maldições; sem a linha, não', { skip: SEM }, () => {
  const castigo = (af) => {
    const e = novo();
    if (af) e.equipment = { ring: { id: 3357, count: 1, poe: { classe: 'Rings', base: 'Rings/X', af, prefixos: [], sufixos: [], implicitos: [] } } };
    const r = GemasPoe.doSlug('Punishment');
    assert.ok(r?.buff, 'o Castigo é a gema de maldição Punishment');
    const entry = { id: r.acao, poeGema: { slug: 'Punishment', arquetipo: r.arquetipo } };
    Ficha.invalidar(e);
    const hunt = { clock: 0, buffs: { [entry.id]: { ate: Number.MAX_SAFE_INTEGER, desde: 0, tipo: 'poe-maldicao', fator: 1, efeitosPoe: Acoes.efeitosDaMaldicao(GemasPoe.buffNoNivel('Punishment', 10).efeitos, null, e, entry) } } };
    const m = Raridade.aplicar({ uid: 77, key: 'rat', name: 'Rato', x: 1, y: 0, hp: 1000, maxHp: 1000 }, { raridade: 'raro', modificadores: ['poe:MonsterModHexproof'], multiplicadores: { vida: 1, dano: 1, exp: 1, levelExtra: 0 } });
    assert.equal(m.aProvaDeMaldicoes, true);
    Reforcos.marcar(hunt, m, 0);
    return m.maldicoes?.[entry.id];
  };
  assert.equal(castigo(null), undefined, 'sem a linha: o Feitiço não pega');
  assert.ok(castigo({ 'feitico_afeta_aprova:Punishment': 1 }), 'com a linha: pega');
  assert.equal(castigo({ 'feitico_afeta_aprova:Temporal_Chains': 1 }), undefined, 'a linha de outra maldição não serve');
});

test('VÍNCULO: a gema foca o aliado da PARTY (outro jogador) na sala, a até 10 casas; sem party, só o lacaio com a linha', { skip: SEM }, () => {
  const ana = novo();
  const bia = novo();
  ana.hunt = { clock: 0, pos: { x: 0, y: 0 }, z: 7, lacaios: [], monstros: [] };
  bia.hunt = { clock: 0, pos: { x: 4, y: 0 }, z: 7, lacaios: [], monstros: [] };
  assert.deepEqual(Vinculos.candidatos(ana, ana.hunt, {}), [], 'sozinha, sem alvo');
  const membros = [{ estado: ana, nome: 'Ana' }, { estado: bia, nome: 'Bia' }];
  for (const m of membros) m.estado.hunt.partilha = { ativa: true, membros, naSala: [ana, bia] };
  assert.deepEqual(Vinculos.candidatos(ana, ana.hunt, {}), [{ tipo: 'jogador', nome: 'Bia' }]);
  bia.hunt.pos.x = 11;
  assert.deepEqual(Vinculos.candidatos(ana, ana.hunt, {}), [], 'longe, não');
});

test('"Seus Clamores abrem Baús" na barra: usar o Clamor abre o baú no raio dele; sem a linha, não', { skip: SEM }, async () => {
  const GS = await import('../systems/skills/gemas.mjs');
  const Afixos = await import('../systems/afixos.mjs');
  const clamor = (comLinha) => {
    const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 40 }), { classePoe: 'Duelist' });
    const arma = Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'One_Hand_Swords/Rusted_Sword', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
    arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    const anel = { id: 3357, count: 1, poe: { classe: 'Rings', base: 'Rings/X', af: { clamor_abre_baus: 1 }, prefixos: [], sufixos: [], implicitos: [] } };
    e.equipment = { ...e.equipment, weapon: arma, ...(comLinha ? { ring: anel } : {}) };
    delete e.equipment.shield;
    e.inventory = [GS.itemDaGema({ id: GemasPoe.doSlug('Enduring_Cry').itemId, nivel: 10, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
    Ficha.invalidar(e);
    Afixos.sincronizarMaximos(e);
    e.actions = Array(Acoes.SLOTS).fill(null);
    e.actions[0] = { id: GemasPoe.doSlug('Enduring_Cry').acao, enabled: true, minMana: 0, conditions: [] };
    assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
    Object.assign(e, { mana: 1e6, maxMana: 1e6 });
    const h = e.hunt;
    h.monstros = h.monstros.slice(0, 1);
    Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
    const inst = Instancia.daSala(h);
    for (const b of bausDe(e)) delete inst.encontros[b.id];
    const bau = { id: 'c', defId: 'bau-poe', tipo: 'bau-poe-normal', raridade: 'normal', nome: 'Baú', estado: 'disponivel', x: h.pos.x + 3, y: h.pos.y, z: h.z, condicao: { tipo: 'sempre' }, obrigatorio: false, tentativas: 0 };
    inst.encontros.c = bau;
    const r = Acoes.disparar(e, h, PERSONAGEM, 0, h.monstros[0]);
    assert.ok(r.ok, JSON.stringify(r));
    if (h.conjurando) { h.clock = h.conjurando.fim; Acoes.concluirConjuracao(e, h, PERSONAGEM); }
    return bau.estado;
  };
  assert.equal(clamor(false), 'disponivel', 'sem a linha, o baú fica');
  assert.equal(clamor(true), 'concluido', 'com a linha, o Clamor abre');
});
