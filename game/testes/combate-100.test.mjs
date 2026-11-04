// 100% — COMBATE (02/11, o dono: "resolva essas que não se aplicam ao jogo, tem que estar tudo 100%"): as linhas do combate que estavam como "não se aplica
// ao jogo" passam a valer — os lacaios sangram (e o Sangramento em movimento neles), o Agravar no Amaldiçoado, o alcance em décimos de metro (a fração vira
// chance de uma casa a mais), o empurrão dos monstros em você ("Não Pode ser Empurrado"), a Furtividade, a janela da Retaliação, o Arqueiro Ilusório grudado (a
// Força Ocupante), a Vida dos Cadáveres, o Solo Congelado dos monstros e o Re-armar das Minas (a Mina de Fumaça "não pode ser Re-armada" vale de fato).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Terreno = await import('../systems/hunt/terreno.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const A = await import('../systems/itens-poe/arvore.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Mecanicas = await import('../systems/mobs/mecanicas.mjs');
const Habilidades = await import('../systems/itens-poe/habilidades.mjs');
const Dot = await import('../systems/combate/dot.mjs');
const C = await import('../systems/itens-poe/combate-100.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const { criarMonstro } = await import('../systems/hunt/monstros.mjs');
const { CAMPANHA } = await import('../systems/itens-poe/monstros.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const efeitos = (linha) => Object.fromEntries(A.traduzirLinha(linha).efeitos.map((e) => [e.add, e.valor]));
const fichaCom = (af) => ({ afPoe: af, eventosPoe: ModsPoe.eventosDa(af) });

// ---------------------------------------------------------------- as linhas

const LINHAS = {
  'Se Mover enquanto Sangrando não faz com que Lacaios sofram Dano extra': { lacaios_sangrar_andando_sem_extra: 1 },
  'Acertos de Ataques contra Inimigos Amaldiçoados têm 10% de chance de Agravar o Sangramento': { 'chance_agravar@ataque+alvoAmaldicoado': 10 },
  '+0.2 metros ao Alcance de Golpes Corpo a Corpo enquanto Portando um Escudo': { 'alcance_corpo_m@comEscudo': 0.2 },
  '+0.3 metros ao Alcance de Golpes Corpo a Corpo por Encaixe Branco': { 'alcance_corpo_m%encaixe:W': 0.3 },
  'Habilidades Suportadas têm +0.2 metros ao Alcance de Golpes Corpo a Corpo': { alcance_corpo_m: 0.2 },
  'Não Pode ser Empurrado': { imune_empurrao: 1 },
  'Furtividade aumentada em 20%': { furtividade: 20 },
  'Arqueiros Ilusórios não são grudados em você': { arqueiros_nao_grudados: 1 },
  'Não pode Convocar Arqueiros Ilusórios enquanto próximo dos seus Arqueiros Ilusórios': { arqueiro_sem_convocar_perto: 1 },
  'Cadáveres Criados por você tem Vida Máxima aumentada em 5%': { cadaver_vida_inc: 5 },
  'Inafetado por Solo Congelado': { imune_solo_congelado: 1 },
  'Imunidade a Solo Ardente, Solo Eletrizado e Solo Congelado': { imune_solo_ardente: 1, imune_solo_eletrizado: 1, imune_solo_congelado: 1 },
  'Minas podem ser Detonadas 1 vezes adicionais': { minas_detonacoes_extra: 1 },
};

test('as linhas do combate valem (nenhuma fica "não se aplica ao jogo")', { skip: SEM }, () => {
  for (const [l, esperado] of Object.entries(LINHAS)) {
    assert.deepEqual(efeitos(l), esperado, l);
    assert.doesNotMatch(String(A.traduzirLinha(l).nota ?? ''), /não se aplica/, l);
  }
  // a faixa da Retaliação (a média) e as do Sangramento em você, que já valiam
  assert.equal(T.traduzirParte('Habilidades de Retaliação se tornam Utilizáveis por um tempo ({0}—{1})% maior', [50, 100]).efeitos[0].valor, 75);
  assert.deepEqual(efeitos('Mover enquanto Sangrando faz com que você não sofra Dano extra'), { sangrar_andando_sem_extra: 1 });
  // nenhuma regra do assunto segue com "não se aplica ao jogo" (os outros assuntos têm o lote deles)
  const DO_ASSUNTO = /Sangra|Agrav|metros ao Alcance|Empurrad|Furtividade|Retaliação|Arqueiros Ilusórios|Cadáveres|Solo Congelado|Re-armad|Detonadas/;
  const restantes = T.TABELA.regras.filter((r) => /não se aplica ao jogo/.test(r.nota ?? '') && DO_ASSUNTO.test(r.padrao));
  assert.deepEqual(restantes.map((r) => r.padrao), []);
  assert.equal(J.VERSAO_DA_TRADUCAO >= 76, true);
});

test('a árvore: a Vida do Cadáver e a Força Ocupante valem', { skip: SEM }, () => {
  const nos = P.arvore().nos.filter((n) => n.nomeEn === 'Corpse Life' || n.nomeEn === 'Occupying Force');
  assert.equal(nos.length, 3);
  for (const n of nos) assert.ok(!(n.notas ?? []).some((x) => /não se aplica/.test(x ?? '')), n.nome);
  const forca = nos.find((n) => n.nomeEn === 'Occupying Force');
  assert.deepEqual(forca.efeitos.map((e) => e.add).sort(), ['arqueiro_sem_convocar_perto', 'arqueiros_nao_grudados', 'max_lacaio:arqueiro']);
});

// ---------------------------------------------------------------- os lacaios sangram

test('os lacaios SANGRAM: o golpe do monstro põe as afecções de dano dele no lacaio (a espécie e os modificadores); o golem imune ao elemental não pega as elementais', { skip: SEM }, () => {
  const afs = C.afeccoesDoGolpe([{ tipo: 'veneno', pctDoGolpe: 30, chance: 100 }], [{ gatilho: 'aoAtacar', efeito: 'debuff', elemento: 'physical', chance: 25, danoPctDoGolpe: 105, duracaoMs: 6000 }, { gatilho: 'aoAtacar', efeito: 'debuff', elemento: 'fire', chance: 100, danoPctDoGolpe: 90, duracaoMs: 4000 }]);
  assert.deepEqual(afs.map((a) => a.tipo), ['veneno', 'sangramento', 'queimadura']);
  const l = { uid: 'l', hp: 1000, maxHp: 1000, x: 0, y: 0, poe: {} };
  const postos = C.afeccoesNoLacaio(l, { name: 'Bicho', uid: 'b' }, 100, afs, 10_000, () => 0.1);
  assert.deepEqual(postos.sort(), ['envenenado', 'queimando', 'sangrando']);
  const sang = l.dots.find((d) => d.tipo === 'sangramento');
  assert.equal(sang.falta, 105, '105% do golpe');
  // a chance: 25% — o sorteio de 0,5 não põe o Sangramento
  const l2 = { uid: 'l2', hp: 1000, maxHp: 1000, poe: {} };
  C.afeccoesNoLacaio(l2, null, 100, afs.filter((a) => a.tipo === 'sangramento'), 10_000, () => 0.5);
  assert.equal(l2.dots, undefined);
  // o golem imune ao dano elemental
  const golem = { uid: 'g', hp: 1000, maxHp: 1000, poe: { imuneElemental: true } };
  C.afeccoesNoLacaio(golem, null, 100, afs, 10_000, () => 0.1);
  assert.deepEqual(golem.dots.map((d) => d.tipo).sort(), ['sangramento', 'veneno']);
});

test('o SANGRAMENTO EM MOVIMENTO no lacaio: 3× no pulso com o lacaio andando; "Se Mover enquanto Sangrando não faz com que Lacaios sofram Dano extra" tira; a resistência no elemental', { skip: SEM }, () => {
  const novo = (andouEm = null) => {
    const l = { uid: 'l', hp: 10_000, maxHp: 10_000, x: 0, y: 0, poe: {}, ...(andouEm != null ? { andouEm } : {}) };
    Dot.aplicar(l, { tipo: 'sangramento', total: 500, duracaoMs: 5000 }, 0);
    return l;
  };
  const parado = novo();
  assert.equal(C.tiqueDoLacaio(parado, 1000).dano, 100, 'um pulso: 500 ÷ 5');
  const andando = novo(900);
  assert.equal(C.tiqueDoLacaio(andando, 1000).dano, 300, '3× andando (andou há 0,1 s)');
  const semExtra = novo(900);
  assert.equal(C.tiqueDoLacaio(semExtra, 1000, { semExtraAndando: true }).dano, 100, 'a linha tira o extra');
  const andouHaMuito = novo(-5000);
  assert.equal(C.tiqueDoLacaio(andouHaMuito, 1000).dano, 100, 'andou há mais de 1 s: parado');
  // o Fogo pela resistência do lacaio (50%)
  const q = { uid: 'q', hp: 10_000, maxHp: 10_000, poe: {} };
  Dot.aplicar(q, { tipo: 'queimadura', total: 400, duracaoMs: 4000 }, 0);
  assert.equal(C.tiqueDoLacaio(q, 1000, { res: (el) => (el === 'fire' ? 50 : 0) }).dano, 50);
  // acabou: sai
  for (let t = 2000; t <= 7000; t += 1000) C.tiqueDoLacaio(parado, t);
  assert.equal(parado.dots, undefined);
});

/** Uma caçada de verdade (o primeiro bicho, com `mods`; os outros longe) e um Zumbi colado nele; o tique dos lacaios com o Math.random em `sorte`. */
function tiqueDoZumbi({ mods = [], sorte = 0.01, af = null } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { sistema: 'poe', classePoe: 'Witch' });
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  Object.assign(e, { hp: 1e6, maxHp: 1e6 });
  const [b, ...outros] = h.monstros;
  outros.forEach((o) => Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 }));
  const q = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, {});
  const l = { ...q, uid: 'l1', tipo: 'lacaio', x: h.pos.x + 2, y: h.pos.y, hp: 1e6, maxHp: 1e6, proximoGolpe: 0, alcanceDeAtaque: 1, perto: 6, poe: { ...q.poe } };
  Object.assign(b, { x: l.x + 1, y: l.y, hp: 1e9, maxHp: 1e9, mods });
  h.lacaios = [l];
  if (af) ModsPoe.definirFichaDaCacada(h, () => fichaCom(af));
  const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);
  const r = Math.random;
  Math.random = () => sorte;
  let ev;
  try { ev = Cacadas.tiqueDosLacaios(e, h, null, grade, Date.now()); } finally { Math.random = r; }
  return { e, h, l, b, ev };
}

test('na caçada: o monstro com a Carta Sangrenta (Sangramento em 25% dos golpes) faz o Zumbi colado SANGRAR', { skip: SEM }, () => {
  const { l, ev } = tiqueDoZumbi({ mods: ['poe:MonsterArchnemesisBloodletter_'] });
  assert.ok(ev.some((x) => x.t === 'dmg' && x.uid === 'l1' && x.lacaio && !x.dot), 'o golpe acertou o Zumbi');
  assert.ok(l.dots?.some((d) => d.tipo === 'sangramento' && d.falta > 0), JSON.stringify(l.dots));
  assert.ok(ev.some((x) => x.t === 'estado' && x.uid === 'l1' && x.estado === 'sangrando'));
  // sem o mod (e sem efeitos na espécie), o golpe não põe nada
  const sem = tiqueDoZumbi({});
  assert.ok(!sem.l.dots?.length);
});

// ---------------------------------------------------------------- o alcance em décimos de metro

test('o ALCANCE em décimos de metro: com metros a mais, a fração das casas é a chance de uma casa a mais (a sorte do golpe); sem metros a mais, como antes', { skip: SEM }, () => {
  assert.equal(C.fracaoDoAlcance(1.3, true), 0.65, '1,1 m da espada + 0,2 m: 0,65 casa');
  assert.equal(C.fracaoDoAlcance(2.0, true), 0, '1,1 + 0,9 = 2,0 m: uma casa inteira');
  assert.equal(C.fracaoDoAlcance(1.1, false), 0, 'só a arma: sem a chance');
  const hunt = { poeSorteDoAlcance: 0.5 };
  assert.equal(C.casaDaFracao(hunt, 0.65), 1);
  hunt.poeSorteDoAlcance = 0.7;
  assert.equal(C.casaDaFracao(hunt, 0.65), 0);
  C.renovarSorteDoAlcance(hunt, () => 0.1);
  assert.equal(C.casaDaFracao(hunt, 0.65), 1, 'a sorte renovada no golpe');
  // a média bate: em 1000 sortes, ~65% com a casa a mais
  let n = 0;
  for (let i = 0; i < 1000; i++) { C.renovarSorteDoAlcance(hunt, () => i / 1000); n += C.casaDaFracao(hunt, 0.65); }
  assert.equal(n, 650);
});

// ---------------------------------------------------------------- o empurrão

test('o EMPURRÃO em você: o Salto Impactante dos chefes empurra; uma casa para longe, se andável e livre; "Não Pode ser Empurrado" impede; ser empurrado é andar', { skip: SEM }, () => {
  const hillock = Object.values(CAMPANHA.areas).flatMap((a) => a.monstros ?? []).find((m) => m.slug === 'Hillock' && m.habilidades?.length);
  const salto = hillock.habilidades.find((h) => /LeapSlam/.test(h.interno));
  assert.equal(Habilidades.converter(salto, 1).empurra, true);
  assert.equal(Habilidades.converter({ ...salto, descricao: 'Causa dano.' }, 1).empurra, undefined);
  const hunt = { clock: 5000, pos: { x: 5, y: 5 }, z: 7, monstros: [] };
  ModsPoe.definirGradeDoCombate(hunt, () => ({ andavel: new Set(['5,5', '6,5', '7,5', '6,6']) }));
  const bicho = { uid: 'b', hp: 10, x: 4, y: 5 };
  assert.equal(C.empurrarJogador(hunt, bicho, fichaCom({ imune_empurrao: 1 })), false, 'Não Pode ser Empurrado');
  assert.deepEqual(hunt.pos, { x: 5, y: 5 });
  assert.equal(C.empurrarJogador(hunt, bicho, fichaCom({})), true);
  assert.deepEqual([hunt.pos.x, hunt.pos.y], [6, 5]);
  assert.equal(hunt.poeRecente?.moveu, 5000, 'ser empurrado é andar (o Sangramento em você dói mais)');
  // a casa ocupada por um monstro, ou fora da grade: não
  hunt.monstros = [{ uid: 'o', hp: 10, x: 7, y: 5 }];
  assert.equal(C.empurrarJogador(hunt, { uid: 'b', hp: 10, x: 5, y: 5 }, fichaCom({})), false);
  hunt.monstros = [];
  assert.equal(C.empurrarJogador(hunt, { uid: 'b', hp: 10, x: 5, y: 4 }, fichaCom({})), false, '(7,6) não é andável');
});

// ---------------------------------------------------------------- o Solo Congelado

function cena(mod, af = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: 'Scion' });
  e.maxHp = e.hp = 1e6;
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 }, z: 7 };
  ModsPoe.definirFichaDaCacada(e.hunt, () => fichaCom(af));
  const m = criarMonstro({ key: 'troll', x: 1, y: 0 }, null);
  m.mods = [`poe:${mod}`];
  e.hunt.monstros.push(m);
  return { e, hunt: e.hunt, m };
}

test('o SOLO CONGELADO ("Solo Resfriado ao Morrer"): Resfria (10%) quem está nele; "Inafetado por Solo Congelado" e a Imunidade aos três solos não', { skip: SEM }, () => {
  const { e, hunt, m } = cena('MonsterModChilledGroundOnDeath');
  m.hp = 0;
  Mecanicas.aoMorrer(e, hunt, null, m, []);
  const [solo] = hunt.solosDosMonstros ?? [];
  assert.equal(solo?.tipo, 'congelado');
  assert.equal(solo.ate, 16000, '6 s');
  Mecanicas.tique(e, hunt, null, []);
  assert.equal(hunt.controle?.lento?.pct, 10);
  assert.ok(hunt.controle.lento.ate > hunt.clock);
  // fora do solo, o Resfriamento acaba logo
  hunt.pos = { x: 6, y: 0 };
  hunt.clock += 1000;
  Mecanicas.tique(e, hunt, null, []);
  assert.ok(!(hunt.controle.lento.ate > hunt.clock), 'fora do solo: sem Resfriamento');
  for (const af of [{ imune_solo_congelado: 1 }, efeitos('Imunidade a Solo Ardente, Solo Eletrizado e Solo Congelado')]) {
    const imune = cena('MonsterModChilledGroundOnDeath', af);
    imune.m.hp = 0;
    Mecanicas.aoMorrer(imune.e, imune.hunt, null, imune.m, []);
    Mecanicas.tique(imune.e, imune.hunt, null, []);
    assert.equal(imune.hunt.controle?.lento, undefined, JSON.stringify(af));
  }
});

// ---------------------------------------------------------------- o Arqueiro Ilusório

test('o ARQUEIRO ILUSÓRIO: grudado em você (anda com você); a Força Ocupante — não grudado, +2 ao máximo, e não convoca a até 2 casas de um seu', { skip: SEM }, () => {
  const espelhos = [{ x: 0, y: 0 }];
  C.grudarArqueiros(espelhos, { x: 4, y: 3 }, fichaCom({}));
  assert.deepEqual(espelhos[0], { x: 4, y: 3 }, 'grudado: vai com você');
  C.grudarArqueiros(espelhos, { x: 9, y: 9 }, fichaCom({ arqueiros_nao_grudados: 1 }));
  assert.deepEqual(espelhos[0], { x: 4, y: 3 }, 'não grudado: fica');
  assert.equal(C.maximoDeArqueiros(1, fichaCom({ 'max_lacaio:arqueiro': 2 })), 3);
  assert.equal(C.maximoDeArqueiros(1, null), 1);
  const ocupante = fichaCom({ arqueiro_sem_convocar_perto: 1 });
  assert.equal(C.podeConvocarArqueiro(espelhos, { x: 6, y: 3 }, ocupante), false, 'a 2 casas: não');
  assert.equal(C.podeConvocarArqueiro(espelhos, { x: 7, y: 3 }, ocupante), true, 'a 3 casas: sim');
  assert.equal(C.podeConvocarArqueiro(espelhos, { x: 4, y: 3 }, fichaCom({})), true, 'sem a linha: sempre');
});

// ---------------------------------------------------------------- o Re-armar das Minas

test('o RE-ARMAR das Minas: "Minas podem ser Detonadas 1 vezes adicionais" — a Mina detonada volta uma vez; a da Mina de Fumaça ("não podem ser Re-armadas") não', { skip: SEM }, () => {
  const hunt = { clock: 1000, plantadas: [] };
  const ficha = fichaCom({ minas_detonacoes_extra: 1 });
  const p = { id: 'mina-1', tipo: 'mina', acao: 'x', x: 3, y: 3, desde: 0, ate: 5000, detonaEm: 900, anteriores: 0 };
  const r = C.rearmarMina(hunt, p, ficha);
  assert.ok(r);
  assert.deepEqual([r.x, r.y, r.rearmes, r.detonaEm, r.ate], [3, 3, 1, undefined, 5000]);
  assert.equal(hunt.plantadas.length, 1);
  assert.equal(C.rearmarMina(hunt, r, ficha), null, 'só uma vez a mais');
  assert.equal(C.rearmarMina({ clock: 1000 }, p, fichaCom({})), null, 'sem a linha: não volta');
  assert.equal(C.rearmarMina({ clock: 1000 }, p, ficha, { naoRearma: true }), null, 'a gema que não pode ser Re-armada');
  assert.equal(C.rearmarMina({ clock: 6000 }, p, ficha, { agora: 6000 }), null, 'vencida: não volta');
  // a Mina de Fumaça: a linha vale de fato (não é mais "não se aplica"), e a gema segue completa
  const linhas = G.textosDaGema('Smoke_Mine', 20).linhas;
  assert.ok(linhas.some(C.ehLinhaCombate100), linhas.join(' | '));
  assert.deepEqual(G.linhasQueNaoSeAplicam(['Minas não podem ser Re-armadas']), []);
  assert.ok(!G.doSlug('Smoke_Mine').motivosNoJogo.some((m) => /Re-armadas/.test(m)));
});

// ---------------------------------------------------------------- a Vida dos Cadáveres

test('a VIDA DOS CADÁVERES: a "Vida do Cadáver" da árvore (+5%) soma na Vida Máxima do cadáver criado (o Desenterrar)', { skip: SEM }, () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { sistema: 'poe', classePoe: 'Witch' });
  e.hunt = { clock: 1000, monstros: [{ key: 'x', name: 'X', maxHp: 1000, hp: 1000, x: 9, y: 9 }], cadaveres: [], pos: { x: 0, y: 0 }, z: 7 };
  const vida = () => { e.hunt.cadaveres = []; Ficha.invalidar(e); Acoes.criarCadaveres(e, e.hunt, 'Unearth', 20, e.hunt.pos, () => 0.5); return e.hunt.cadaveres.at(-1).maxHp; };
  const sem = vida();
  assert.equal(sem, 1000);
  P.garantir(e);
  const no = P.arvore().nos.find((n) => n.nomeEn === 'Corpse Life');
  const caminho = P.caminhoAte(e, no.id);
  if (caminho.length > 1) Comandos.comando(e, { action: 'alocar', ids: caminho.slice(0, -1) });
  assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id }).ok);
  // (o caminho até ela passa pela outra "Vida do Cadáver": +5% cada uma)
  const n = e.passivas.alocados.filter((id) => P.arvore().porId.get(id)?.nomeEn === 'Corpse Life').length;
  assert.ok(n >= 1);
  assert.equal(vida(), 1000 * (1 + 0.05 * n));
});
