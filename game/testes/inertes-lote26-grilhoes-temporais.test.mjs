// (07/11, lote 26 das inertes — dono: "Continue então resolvendo") os GRILHÕES TEMPORAIS em você (os Grilhões da Emancipação, o Fecho do Tempo),
// a maldição ao bloquear o projétil (a Resposta de Sentari) e as imunidades "enquanto afetado por" do Olho do Vigia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Condicoes = await import('../systems/itens-poe/condicoes-poe.mjs');
await import('../systems/acoes.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');

if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
const INFLIGEM = ['Acertos Inimigos infligem Grilhões Temporais em você'];
const AO_PERDER = ['Ao perder Grilhões Temporais você ganha Fúria máxima'];
const IMUNE = ['Imune a Grilhões Temporais'];
const SENTARI = ['Amaldiçoa Inimigos com Grilhões Temporais quando você Bloquear seu Dano de Ataques com Projéteis, ignorando o Limite de Maldições'];
const LINHAS = [INFLIGEM, AO_PERDER, IMUNE, SENTARI, ['Imune a Grilhões Temporais enquanto afetado por Ímpeto'], ['Imune a Solo Eletrizado enquanto afetado por Pureza Elétrica'], ['Imune a Solo Ardente enquanto afetado por Pureza Ardente']];

/** O personagem com as linhas na varinha, na Costa, com um alvo ao lado e os outros longe. */
function personagem(linhas) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 90 }), { classePoe: 'Witch', sistema: 'poe' });
  const arma = peca('Wands/Driftwood_Wand');
  const af = { ...(arma.poe.af ?? {}) };
  for (const [m, v] of linhas) for (const x of tr(m, v ?? []).efeitos) af[x.stat] = (af[x.stat] ?? 0) + Number(x.valor);
  arma.poe.af = af;
  e.equipment = { ...e.equipment, weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  h.clock = 100_000;
  e.maxHp = e.hp = 10_000;
  const [b, ...resto] = h.monstros;
  for (const m of resto) Object.assign(m, { x: h.pos.x + 60, y: h.pos.y + 60 });
  Object.assign(b, { x: h.pos.x + 1, y: h.pos.y, hp: 1e9, maxHp: 1e9, estados: {} });
  ModsPoe.definirFichaDaCacada(h, () => Ficha.combate(e));
  return { e, h, b };
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const comGrilhoes = (h) => Object.values(h.maldicoesNoJogador ?? {}).some((m) => m?.nome === 'Grilhões Temporais' && m.ate > h.clock);

test('as linhas do lote saem com efeito (e o Anel da Fenda segue inerte: as Fendas não existem no jogo)', { skip: SEM }, () => {
  for (const [m, v] of LINHAS) assert.ok(!['inerte', 'registrado'].includes(tr(m, v ?? []).estado), m);
  // (aval do dono 08/11: a maldição no nível 1 do PoB)
  assert.deepEqual(tr(SENTARI[0]).efeitos.map((x) => x.stat), ['ev:bloquearProjetil:maldicao:grilhoes-temporais:1:semLimite']);
  assert.equal(tr('Propriedades são dobradas enquanto em uma Fenda').estado, 'inerte');
});

test('os GRILHÕES TEMPORAIS em você: −9% de Velocidade de Ação e os debuffs expiram 12,5% mais devagar (a gema no 20, com 50% menos efeito)', { skip: SEM }, () => {
  assert.deepEqual(Condicoes.MALDICOES_DOS_MONSTROS.grilhoesTemporais.af, { action_speed: -9, debuffs_expiram_rapido: -12.5 });
  const { e, h } = personagem([]);
  const antes = Number(ficha(e).afPoe.action_speed) || 0;
  Condicoes.amaldicoarJogador(h, 'grilhoesTemporais', Condicoes.MALDICOES_DOS_MONSTROS.grilhoesTemporais, h.clock);
  assert.equal((Number(ficha(e).afPoe.action_speed) || 0) - antes, -9);
});

test('os GRILHÕES DA EMANCIPAÇÃO: o acerto inimigo te põe os Grilhões; imune (o Fecho do Tempo), não; sem a linha, não', { skip: SEM }, () => {
  for (const [linhas, espera] of [[[], false], [[INFLIGEM], true], [[INFLIGEM, IMUNE], false]]) {
    const { e, h, b } = personagem(linhas);
    ModsPoe.aoSerAcertado(e, h, b, ficha(e), { dano: 100, corpoACorpo: true });
    assert.equal(comGrilhoes(h), espera, JSON.stringify(linhas));
  }
});

test('"Ao perder Grilhões Temporais você ganha Fúria máxima": quando a maldição acaba, a Fúria enche; sem a linha, não', { skip: SEM }, () => {
  for (const [linhas, espera] of [[[INFLIGEM], 0], [[INFLIGEM, AO_PERDER], null]]) {
    const { e, h, b } = personagem(linhas);
    ModsPoe.aoSerAcertado(e, h, b, ficha(e), { dano: 100, corpoACorpo: true });
    Condicoes.tique(e, h, ficha(e), 100, h.clock);
    assert.equal(h.furia?.n ?? 0, 0, 'com os Grilhões, nada ainda');
    h.clock += Condicoes.DURACAO_DA_MALDICAO_DO_MONSTRO_MS + 1;
    Condicoes.tique(e, h, ficha(e), 100, h.clock);
    assert.equal(h.furia?.n ?? 0, espera ?? Condicoes.maximoDeFuria(ficha(e).afPoe));
  }
});

test('a RESPOSTA DE SENTARI: o projétil de ataque bloqueado amaldiçoa o atacante com os Grilhões Temporais', { skip: SEM }, () => {
  const { e, h, b } = personagem([SENTARI]);
  assert.equal(Condicoes.maldicoesNoAlvo(b, h.clock), 0);
  ModsPoe.evento(e, h, 'bloquearAtaque', ficha(e), { alvo: b, eventos: [], personagem: PERSONAGEM });
  assert.equal(Condicoes.maldicoesNoAlvo(b, h.clock), 0, 'o bloqueio corpo a corpo não vale');
  ModsPoe.evento(e, h, 'bloquearProjetil', ficha(e), { alvo: b, eventos: [], personagem: PERSONAGEM });
  assert.equal(Condicoes.maldicoesNoAlvo(b, h.clock), 1);
});

test('a maldição da peça leva os efeitos do lote G-A/G-C: o Castigo da Resposta de Sentari também pega ao bloquear o ataque', { skip: SEM }, () => {
  const { e, h, b } = personagem([['Amaldiçoa Inimigos com Punição quando você Bloquear seu Dano Corpo a Corpo, ignorando o Limite de Maldições']]);
  ModsPoe.evento(e, h, 'bloquearAtaque', ficha(e), { alvo: b, eventos: [], personagem: PERSONAGEM });
  assert.equal(Condicoes.maldicoesNoAlvo(b, h.clock), 1);
  assert.ok(Object.values(b.maldicoes).some((m) => m.efeitos.some((x) => x.tipo === 'gac:vidaBaixa')));
});
