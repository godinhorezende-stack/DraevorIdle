// LOTE 71 — as RAMIFICADORAS, os NOTÁVEIS (a 6ª parte): 36 → 24 sem efeito. Com o que o jogo já tem: Fortificar com Maça/Cetro/Cajado (a
// Fortificação do jogo dura os 6 s da linha), o Incêndio que se espalha (1,5 m), Intimidar e Cegar os próximos, a Carga de Poder ao Eletrizar
// um Resfriado. Novos: o Gênio Alquímico (o lembrete do catálogo), os Provocados pelos seus Clamores Intimidados, os Amaldiçoados Enervados,
// "se você Matou um Inimigo Amaldiçoado Recentemente", os Incendiados mortos pelo seu acerto destruídos, o Dano Dobrado no crítico e a
// Armadilha ou Mina adicional.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const A = await import('../systems/itens-poe/arvore.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const QuemFeriu = await import('../systems/hunt/quem-feriu.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { criarMonstro } = await import('../systems/hunt/monstros.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) Jogo.iniciar(ITEM_CATALOG);

const efeitos = (linha) => Object.fromEntries(A.traduzirLinha(linha).efeitos.map((e) => [e.add, e.valor]));
const fichaCom = (af) => ({ afPoe: af, eventosPoe: ModsPoe.eventosDa(af) });
const personagem = () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: 'Scion' });
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  return e;
};

test('as linhas: o que o jogo já tem e as mecânicas novas', { skip: SEM }, () => {
  assert.deepEqual(efeitos('Acertos Corpo a Corpo com Maças, Cetros ou Cajados Fortificam por 6 segundos'), { 'chance_fortificar@corpo+comMacaCetroOuCajado': 100 });
  assert.equal(C.FORTIFICACAO.duracaoMs, 6000, 'a Fortificação do jogo dura os 6 s da linha');
  assert.deepEqual(efeitos('Incêndios infligidos por você se espalham para outros Inimigos em um Raio de 1,5 metros'), { 'ev:incendiar:espalhar:incendioRaio': 1.5 });
  assert.deepEqual(efeitos('25% de chance de Intimidar Inimigos próximos por 4 segundos ao Matar Corpo a Corpo'), { 'ev:matar:proximos:intimidado:4@corpo': 25 });
  assert.deepEqual(efeitos('10% de chance de Cegar Inimigos próximos ao usar uma Habilidade Elemental'), { 'ev:usarHabilidade:proximos:cego@elemental': 10 });
  assert.deepEqual(efeitos('10% de chance de ganhar uma Carga de Poder ao Eletrizar um Inimigo Resfriado'), { 'ev:eletrizar:carga:poder@alvoResfriado': 10 });
  assert.deepEqual(efeitos('Ganha Gênio Alquímico ao usar um Frasco'), { 'ev:usarFrasco:buff:genioAlquimico': 4 });
  assert.deepEqual(efeitos('+1% de máximo das Resistências Elementais se você Matou um Inimigo Amaldiçoado Recentemente'), { 'fire_res_max@matouAmaldicoadoRecente': 1, 'ice_res_max@matouAmaldicoadoRecente': 1, 'energy_res_max@matouAmaldicoadoRecente': 1 });
  assert.deepEqual(efeitos('Seus Golpes Críticos têm chance de 5% de causar Dano Dobrado'), { critico_chance_dano_dobrado: 5 });
  const mina = A.traduzirLinha('10% de chance de Arremessar até 1 Armadilha ou Mina adicional');
  assert.equal(mina.estado, 'aproximado');
  assert.deepEqual(Object.fromEntries(mina.efeitos.map((e) => [e.add, e.valor])), { plantadas_extras_chance: 10, plantadas_extras_n: 1 });
  // as outras linhas com Fortificação seguem na regra de antes
  assert.equal(A.traduzirLinha('Fortificações também concedem Dano aumentado').estado, 'inerte');
});

test('o GÊNIO ALQUÍMICO ao usar um Frasco: +20% de Cargas de Frasco recebidas e +10% de efeito dos Frascos por 4 s', { skip: SEM }, () => {
  const e = personagem();
  ModsPoe.evento(e, e.hunt, 'usarFrasco', fichaCom({ 'ev:usarFrasco:buff:genioAlquimico': 4 }), {});
  assert.equal(e.hunt.poeBuffs.genioAlquimico, 14000);
  const a = C.adds(e);
  assert.equal(a.frasco_cargas_recebidas, 20);
  assert.equal(a.frasco_efeito, 10);
  e.hunt.clock = 14001;
  assert.equal(C.adds(e)?.frasco_efeito, undefined, 'depois dos 4 s');
});

test('os PROVOCADOS pelos seus Clamores são Intimidados; os AMALDIÇOADOS por você são Enervados', { skip: SEM }, () => {
  const ataque = (af) => ({ afPoe: af, tagsDoGolpe: ['ataque'] });
  const magia = (af) => ({ afPoe: af, tagsDoGolpe: ['magia'] });
  const provocado = { estados: {}, provocadoAte: 2000 };
  assert.ok(Math.abs(C.fatorRecebidoPeloBicho(provocado, 'physical', ataque({ provocados_clamor_intimidados: 1 }), 1000) - 1.1) < 1e-9);
  assert.equal(C.fatorRecebidoPeloBicho(provocado, 'physical', ataque({}), 1000), 1);
  assert.equal(C.fatorRecebidoPeloBicho(provocado, 'physical', ataque({ provocados_clamor_intimidados: 1 }), 3000), 1, 'a Provocação acabou');
  const amaldicoado = { estados: {}, maldicoes: { vulnerabilidade: { ate: 2000 } } };
  assert.ok(Math.abs(C.fatorRecebidoPeloBicho(amaldicoado, 'fire', magia({ amaldicoados_inervados: 1 }), 1000) - 1.1) < 1e-9);
  assert.equal(C.fatorRecebidoPeloBicho(amaldicoado, 'fire', ataque({ amaldicoados_inervados: 1 }), 1000), 1, 'o Enervado é das magias');
  assert.equal(C.fatorRecebidoPeloBicho({ estados: {} }, 'fire', magia({ amaldicoados_inervados: 1 }), 1000), 1, 'sem maldição');
});

test('"se você Matou um Inimigo Amaldiçoado Recentemente": o abate de um Amaldiçoado marca (4 s); o de um sem maldição não', { skip: SEM }, () => {
  const e = personagem();
  ModsPoe.evento(e, e.hunt, 'matar', fichaCom({}), { alvo: { estados: {}, maldicoes: {} } });
  assert.ok(!C.condicoesDe(e).has('matouAmaldicoadoRecente'));
  ModsPoe.evento(e, e.hunt, 'matar', fichaCom({}), { alvo: { estados: {}, maldicoes: { enfraquecer: { ate: 20000 } } } });
  assert.ok(C.condicoesDe(e).has('matouAmaldicoadoRecente'));
  e.hunt.clock += 4001;
  assert.ok(!C.condicoesDe(e).has('matouAmaldicoadoRecente'));
});

test('o DANO DOBRADO no crítico: dobra o crítico; não dobra o golpe que já saiu Dobrado; as partes do golpe usam a mesma rolagem', { skip: SEM }, () => {
  const e = personagem();
  const alvo = { uid: 1, key: 'troll', x: 1, y: 0, hp: 1e9, maxHp: 1e9, estados: {} };
  const base = { ...Ficha.combate(e), afPoe: { critico_chance_dano_dobrado: 100 } };
  const simples = Ficha.rolarCritico(e, 1000, alvo, [], base, { crit: true, onslaught: false });
  const dobrado = Ficha.rolarCritico(e, 1000, alvo, [], base, { crit: true, onslaught: false, dobraNoCritico: true });
  assert.ok(Math.abs(dobrado.dano - 2 * simples.dano) <= 1, `${dobrado.dano} × ${simples.dano}`);
  assert.equal(Ficha.rolarCritico(e, 1000, alvo, [], { ...base, danoDobradoNoGolpe: true }, { crit: true, onslaught: false, dobraNoCritico: true }).dano, simples.dano, 'já Dobrado');
  // a rolagem: com 100% e o crítico garantido, sai dobrado; sem crítico, nunca
  const sempre = { ...base, critChance: 1, critTeto: 1 };
  assert.equal(Ficha.rolarCritico(e, 1000, alvo, [], sempre).dobraNoCritico, true);
  assert.equal(Ficha.rolarCritico(e, 1000, alvo, [], { ...base, critChance: 0 }).dobraNoCritico, undefined);
});

test('o CREMADOR: o Incendiado morto pelo SEU acerto não deixa cadáver; o do lacaio, o não Incendiado e, sem a linha, todos deixam', { skip: SEM }, async () => {
  (await import('../systems/itens-poe/campanha.mjs')).iniciar();
  const cena = (af) => {
    const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: 'Scion' });
    delete e.classe;
    P.garantir(e);
    e.equipment = { ring: { id: 3357, count: 1, poe: { classe: 'Rings', base: 'Rings/X', af, prefixos: [], sufixos: [], implicitos: [] } } };
    Ficha.invalidar(e);
    assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
    const h = e.hunt;
    const key = h.monstros[0].key;
    h.monstros.length = 0;
    const morto = (x, quem, queimando) => {
      const m = criarMonstro({ key, x, y: 0 }, null);
      m.hp = 0;
      if (queimando) m.dots = [{ tipo: 'queimadura', falta: 50 }];
      QuemFeriu.carimbar(m, quem, ['ataque', 'corpo']);
      h.monstros.push(m);
    };
    morto(3, QuemFeriu.VOCE, true);
    morto(5, QuemFeriu.LACAIO, true);
    morto(7, QuemFeriu.VOCE, false);
    const antes = (h.cadaveres ?? []).length;
    Combate.processarMortes(e, PERSONAGEM, []);
    return (h.cadaveres ?? []).slice(antes).map((c) => c.x);
  };
  assert.deepEqual(cena({ incendiados_mortos_destruidos: 1 }), [5, 7], 'o Incendiado do seu acerto foi destruído');
  assert.deepEqual(cena({}), [3, 5, 7], 'sem a linha: todos deixam cadáver');
});

test('a ARMADILHA OU MINA adicional: na chance, 1 a mais nas duas', { skip: SEM }, () => {
  const f = { afPoe: { plantadas_extras_chance: 10, plantadas_extras_n: 1 } };
  assert.equal(Plantadas.extrasDoArremesso(f, 'mina', () => 0), 1);
  assert.equal(Plantadas.extrasDoArremesso(f, 'armadilha', () => 0), 1);
  assert.equal(Plantadas.extrasDoArremesso(f, 'mina', () => 0.5), 0, 'fora da chance');
  assert.equal(Plantadas.extrasDoArremesso({ afPoe: {} }, 'mina', () => 0), 0);
});

test('o RELATÓRIO: os notáveis sem efeito caem para no máximo 24', { skip: SEM }, async () => {
  const { linhasDasRamificadoras } = await import('../tools/relatorio-arvore-poe.mjs');
  const { grupos } = await linhasDasRamificadoras(Catalogo.catalogo());
  assert.ok(grupos.notavel.sem <= 24, `${grupos.notavel.sem}`);
});
