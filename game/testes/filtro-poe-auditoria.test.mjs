// A AUDITORIA do Loot Filter do PoE (dono, 10/10: "jogadores estão reclamando do funcionamento do Loot Filter"): uma regressão para cada
// falha reproduzida — o filtro da conta sem as seções do PoE, os orbes de socket que ignoravam o "Não coletar", a volta do offline rendendo
// menos que a caçada (a projeção sorteava de novo só o que tinha sido coletado) e as listas "Sempre coletar"/"Não coletar" que a tela
// promete exclusivas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const FiltroDaConta = await import('../systems/filtro-da-conta.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Campanha = await import('../systems/campanha.mjs');
const { matarMonstro } = await import('../systems/hunt/combate.mjs');
const { novaSessao } = await import('../systems/hunt/relatorio.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Afixos = await import('../systems/afixos.mjs');

const JOALHEIRO = 915001;
const FUSAO = 915002;
const CROMATICO = 915003;

function quem(settings = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  Bolsa.garantir(e);
  e.settings = { ...e.settings, ...settings };
  return e;
}

test('"Toda a conta" leva as seções do PoE (raridade, mods, tier, Item Level, R-G-B) e mudar uma delas publica', { skip: SEM }, () => {
  const SECOES = { guardarRaridadePoe: 2, guardarModsPoe: 4, guardarTierPoe: 3, guardarIlvlPoe: 75, guardarRgbPoe: true, guardarSockets: 4, guardarLigados: 5 };
  const dono = quem(SECOES);
  const filtro = FiltroDaConta.copia(dono);
  for (const [k, v] of Object.entries(SECOES)) assert.equal(filtro.guardar[k], v, `${k} vai para a conta`);
  const outro = quem();
  FiltroDaConta.aplicar(outro, filtro);
  for (const [k, v] of Object.entries(SECOES)) assert.equal(outro.settings[k], v, `${k} chega no outro personagem`);
  for (const k of Object.keys(SECOES)) assert.equal(FiltroDaConta.mudaOFiltro({ t: 'settings', [k]: 1 }), true, `mudar ${k} publica na conta`);
  // Desligada no dono, a seção sai do outro também (a conta manda inteira).
  const semRgb = FiltroDaConta.copia(quem({ ...SECOES, guardarRgbPoe: null }));
  FiltroDaConta.aplicar(outro, semRgb);
  assert.equal(outro.settings.guardarRgbPoe, undefined);
});

test('os orbes de socket que caem (Joalheiro, Fusão, Cromático) respeitam o "Não coletar"', { skip: SEM }, () => {
  const e = quem();
  e.itemRules.noLoot = [JOALHEIRO, FUSAO, CROMATICO];
  const fase = Campanha.FASES.find((f) => f.ato === 1);
  assert.ok(Cacadas.entrar(e, { huntId: fase.huntId, mode: 'auto', dificuldade: 'facil' }).ok);
  const alvo = e.hunt.monstros.find((m) => m.hp > 0);
  const aleatorio = Math.random;
  // Todo sorteio "acerta": os três orbes caem.
  Math.random = () => 0;
  try {
    alvo.hp = 0;
    matarMonstro(e, e.hunt, PERSONAGEM, alvo, []);
  } finally {
    Math.random = aleatorio;
  }
  const naBolsa = e.pouch.filter((p) => [JOALHEIRO, FUSAO, CROMATICO].includes(p.id));
  assert.deepEqual(naBolsa, [], 'os orbes da lista "Não coletar" ficam no chão');
  const ignorados = e.hunt.sessao.itens.ignorado;
  for (const id of [JOALHEIRO, FUSAO, CROMATICO]) assert.equal(ignorados[id], 1, `o orbe ${id} conta como "Ignorado" no relatório`);
});

test('a volta do offline projeta os DROPS (os coletados e os que o filtro deixou), não só o que foi coletado', { skip: SEM }, () => {
  const e = quem();
  const fase = Campanha.FASES.find((f) => f.ato === 1);
  assert.ok(Cacadas.entrar(e, { huntId: fase.huntId, mode: 'auto', dificuldade: 'facil' }).ok);
  // Nos 30 min simulados, de uma base caíram 10: 2 coletadas e 8 que o filtro de então deixou no chão. Agora o filtro pega tudo.
  const base = Jogo.idDaBase('Body_Armours/Plate_Vest');
  assert.ok(base, 'a base do teste existe');
  const agora = Date.now();
  const sessaoBase = novaSessao(e, 'teste', 'auto', agora - 30 * 60_000);
  sessaoBase.itens.loot[base] = 2;
  sessaoBase.itens.ignorado[base] = 8;
  e.hunt.offlineDesde = agora;
  e.hunt.ausencia = { inicio: agora - 30 * 60_000, principal: novaSessao(e, 'teste', 'auto'), fora: novaSessao(e, 'teste', 'auto'), base: sessaoBase, fatorBase: 1, morreu: false, morreuEm: null, projetadoAte: agora };
  const antes = e.pouch.filter((p) => p.id === base).length;
  // Mais 30 min projetados (o mesmo ritmo).
  Cacadas.consolidarAusencia(e, PERSONAGEM, agora + 30 * 60_000);
  const projetadas = e.pouch.filter((p) => p.id === base).length - antes;
  assert.equal(projetadas, 10, `${projetadas} peças: as 10 que caíram, todas pegas pelo filtro de agora`);
});

test('"Sempre coletar" e "Não coletar" são exclusivas no PoE (como a tela promete): marcar uma tira da outra', { skip: SEM }, () => {
  const e = quem();
  const id = 7000001;
  assert.ok(Bolsa.regraDeItem(e, { rule: 'noSell', id }).ok);
  assert.deepEqual([e.itemRules.noSell.includes(id), e.itemRules.noLoot.includes(id)], [true, false]);
  assert.ok(Bolsa.regraDeItem(e, { rule: 'noLoot', id }).ok);
  assert.deepEqual([e.itemRules.noSell.includes(id), e.itemRules.noLoot.includes(id)], [false, true], 'a última marcação vale: Não coletar');
  assert.ok(Bolsa.regraDeItem(e, { rule: 'noSell', id }).ok);
  assert.deepEqual([e.itemRules.noSell.includes(id), e.itemRules.noLoot.includes(id)], [true, false], 'e de volta: Sempre coletar');
  // Clicar de novo na mesma lista desmarca (como sempre).
  assert.ok(Bolsa.regraDeItem(e, { rule: 'noSell', id }).ok);
  assert.deepEqual([e.itemRules.noSell.includes(id), e.itemRules.noLoot.includes(id)], [false, false]);
});

test('as listas mandam antes de tudo: "Sempre coletar" pega mesmo com as seções e uma regra contra; "Não coletar" deixa até o Único', { skip: SEM }, () => {
  const peca = (raridade, id) => ({ id, count: 1, soquetes: { abertos: 1, links: [], gemas: [], cores: ['R'] }, poe: { raridade, classe: 'Body_Armours', ilvl: 40, prefixos: [], sufixos: [] } });
  const e = quem({ guardarRaridadePoe: 3 });
  e.lootRegras = [{ poe: true, raridade: 'normal', acima: false, classe: null, quantos: null, tier: 0, ilvl: 0, ligados: 0, acao: 'naoColetar', ativa: true }];
  const normal = peca('normal', 7000001);
  assert.equal(Afixos.decisaoDoLoot(e, normal).acao, 'naoColetar', 'sem lista: a regra (e as seções) deixam no chão');
  Bolsa.regraDeItem(e, { rule: 'noSell', id: normal.id });
  assert.equal(Bolsa.ignora(e, normal.id, normal), false, '"Sempre coletar" pega');
  assert.equal(Afixos.decisaoDoLoot(e, normal).motivo, 'lista "Não vender"');
  const unico = peca('unico', 7000002);
  assert.equal(Bolsa.ignora(e, unico.id, unico), false, 'o Único vem sempre…');
  Bolsa.regraDeItem(e, { rule: 'noLoot', id: unico.id });
  assert.equal(Bolsa.ignora(e, unico.id, unico), true, '…a não ser que esteja em "Não coletar"');
  // A moeda: só a lista decide (as seções são de equipamento).
  assert.equal(Bolsa.ignora(e, 915001), false);
  Bolsa.regraDeItem(e, { rule: 'noLoot', id: 915001 });
  assert.equal(Bolsa.ignora(e, 915001), true);
});

