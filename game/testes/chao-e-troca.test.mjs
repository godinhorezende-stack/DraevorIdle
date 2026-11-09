// Os dois bugs reportados (01/10):
//   1. "A Assassin Star Mítica caiu no chão e, quando o Paladino pegou, virou comum":
//      largar guardava só { id, count } e pegar recriava o item-base pelo id.
//   2. "O trade não funciona": o cliente tinha a mesa de troca, o servidor não tinha
//      o lado dele (`{t:'trade'}` caía no `default` silencioso da sessão).
// Com personagens de verdade no banco de teste (como conta-char.test.mjs).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import * as Inventario from '../systems/inventario.mjs';
import * as Troca from '../systems/troca.mjs';
import * as R from '../systems/regras.mjs';
import { gerarItem } from '../systems/itens/gerar.mjs';
import { camposDaPeca, VERSAO_DOS_ITENS } from '../systems/itens/item.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as JogoDoPoe from '../systems/itens-poe/jogo.mjs';
import { gerarPeca } from '../systems/itens-poe/gerar.mjs';
import * as MoedasPoe from '../systems/itens-poe/moedas.mjs';
import * as GemasDeSkill from '../systems/skills/gemas.mjs';
import { aAdaptar, soNoOficial } from './apoio-migracao.mjs';

const ESTRELA = 7368; // assassin star
const POCAO = 236; // strong health potion (empilha)
const LOBO = 4007; // dead wolf (peso 260: 17 passam da capacidade de um level 200)
const instancia = (p) => JSON.stringify({ id: p.id, ...camposDaPeca(p) });

/*
 * (08/11, adaptado ao PoE — o dono: "Adaptar antes") No jogo oficial só peça do PoE entra (pegar do chão, a troca): no lugar da Assassin
 * Star nas raridades do Draevor, uma peça do PoE (o Colete de Placas) nas raridades do PoE — a mais alta, a Única, no lugar da Mítica; no
 * lugar das poções empilháveis, Orbes do Caos (empilham); e a capacidade do PoE é a mochila de vagas, não o peso.
 */
const BASE_DO_POE = 'Body_Armours/Plate_Vest';
const pecaDoPoe = (raridade, sorte = 0.37) =>
  JogoDoPoe.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: BASE_DO_POE, raridade, ilvl: 60, rng: () => sorte }));
const PECA = Catalogo.ligado() ? pecaDoPoe('normal').id : null; // Colete de Placas (no clássico o PoE está desligado: estes testes pulam)
const ORBE = MoedasPoe.idDa('Chaos_Orb'); // empilha, como a poção
const RARIDADES_DO_POE = ['normal', 'magico', 'raro', 'unico'];

// ---------------------------------------------------------------- 1. o chão

function personagemNaPraca() {
  const e = personagemDeTeste({ vocacao: 'paladin', level: 200 });
  e.pos = { x: 500, y: 500, z: 7 };
  e.inventory = [];
  return e;
}

test('chão: largar e pegar com OUTRO personagem preserva a peça inteira — em toda raridade (a peça Única do PoE continua Única)', { skip: soNoOficial('as peças do PoE (adaptado ao PoE)') }, () => {
  for (const raridade of RARIDADES_DO_POE) {
    const dono = personagemNaPraca();
    const paladino = personagemNaPraca();
    const peca = pecaDoPoe(raridade);
    dono.inventory.push(structuredClone(peca));
    assert.ok(Inventario.largar(dono, { id: PECA, count: 1, x: 500, y: 500, alvo: { indice: 0, tier: peca.tier, af: peca.af } }).ok, raridade);
    assert.equal(dono.inventory.length, 0);
    assert.ok(Inventario.pegar(paladino, { x: 500, y: 500, indice: null }).ok, raridade);
    assert.equal(paladino.inventory.length, 1);
    assert.equal(instancia(paladino.inventory[0]), instancia(peca), `${raridade}: a peça mudou no caminho`);
    if (raridade !== 'normal') assert.equal(paladino.inventory[0].poe.raridade, raridade);
  }
});

test('chão: armadura com atributos aleatórios, qualidade, corrompida e sockets (ligados, com gema) volta idêntica (nada é sorteado de novo)', { skip: soNoOficial('as peças do PoE (adaptado ao PoE)') }, () => {
  const dono = personagemNaPraca();
  const outro = personagemNaPraca();
  // (adaptado ao PoE) A armadura Rara do PoE: no lugar do tier e do imbuement do Draevor, a qualidade e a corrupção do PoE; os sockets
  // ligados e com uma gema encaixada.
  const rara = pecaDoPoe('raro');
  const gema = [...GemasDeSkill.ITEM_DA_ACAO.values()].find((id) => id >= 916_001);
  const peca = { ...rara, poe: { ...rara.poe, qualidade: 20, corrompido: true }, soquetes: { ...rara.soquetes, abertos: 4, links: [true, true, true, false, false], gemas: [GemasDeSkill.novaGema(gema), null, null, null, null, null] } };
  dono.inventory.push(structuredClone(peca));
  assert.ok(Inventario.largar(dono, { id: PECA, count: 1, x: 501, y: 500, alvo: { indice: 0, tier: peca.tier, af: peca.af } }).ok);
  assert.ok(Inventario.pegar(outro, { x: 501, y: 500, indice: null }).ok);
  assert.equal(instancia(outro.inventory[0]), instancia(peca));
});

test('chão: larga a CÓPIA apontada — com uma comum e uma mítica iguais, sai a que foi arrastada; sem apontar, sai a comum', () => {
  const dono = personagemNaPraca();
  const mitica = gerarItem({ itemId: ESTRELA, raridade: 'mítico' });
  dono.inventory = [{ id: ESTRELA, count: 1 }, structuredClone(mitica)];
  assert.ok(Inventario.largar(dono, { id: ESTRELA, count: 1, x: 502, y: 500, alvo: { indice: 1, tier: mitica.tier, af: mitica.af } }).ok);
  assert.deepEqual(dono.inventory, [{ id: ESTRELA, count: 1 }], 'ficou a comum');
  dono.inventory.push(structuredClone(mitica));
  assert.ok(Inventario.largar(dono, { id: ESTRELA, count: 1, x: 503, y: 500 }).ok);
  assert.equal(dono.inventory.length, 1);
  assert.equal(dono.inventory[0].raridade, 'mítico', 'sem apontar, a mítica fica');
});

test('chão: sem duplicar — dois pegando a mesma peça, só um leva; sem capacidade, a peça fica no chão e nada some', { skip: soNoOficial('as peças do PoE (adaptado ao PoE)') }, () => {
  const dono = personagemNaPraca();
  const [a, b] = [personagemNaPraca(), personagemNaPraca()];
  const mitica = pecaDoPoe('unico');
  dono.inventory.push(structuredClone(mitica));
  Inventario.largar(dono, { id: PECA, count: 1, x: 499, y: 500, alvo: { indice: 0, tier: mitica.tier, af: mitica.af } });
  // Sem capacidade (no PoE, a mochila cheia: todas as vagas ocupadas): recusa, e a peça continua lá (e nada entra na mochila de quem tentou).
  const fraco = personagemNaPraca();
  fraco.inventory = Array(Inventario.vagasDaMochila(fraco)).fill(null).map(() => pecaDoPoe('normal'));
  const antes = JSON.stringify(fraco.inventory);
  const r0 = Inventario.pegar(fraco, { x: 499, y: 500, indice: null });
  assert.equal(r0.ok, false);
  assert.equal(JSON.stringify(fraco.inventory), antes);
  // Dois pegando: um leva, o outro ouve "não há nada aí".
  const r1 = Inventario.pegar(a, { x: 499, y: 500, indice: null });
  const r2 = Inventario.pegar(b, { x: 499, y: 500, indice: null });
  assert.equal([r1.ok, r2.ok].filter(Boolean).length, 1);
  const quem = r1.ok ? a : b;
  assert.equal(instancia(quem.inventory[0]), instancia(mitica));
});

// ---------------------------------------------------------------- sessões de verdade

const limpar = [];
after(async () => {
  for (const f of limpar.reverse()) await f();
  Troca.limpar();
});
const nomeNovo = (p) => `${p}${randomUUID().replace(/[^a-z]/g, '').slice(0, 8)}`;

async function jogador({ vocacao = 'paladin', mexer } = {}) {
  const c = await B.criarConta({ email: `troca-${randomUUID()}@teste.local`, senha: 'senha-123' });
  const e = personagemDeTeste({ vocacao, level: 200 });
  e.pos = { ...R.POSICAO_INICIAL };
  e.inventory = [];
  e.gold = 10_000;
  // (adaptado ao PoE) Um personagem que já entrou no jogo uma vez (os itens já na versão de agora): sem isto, a primeira entrada passa a
  // conversão das peças antigas do Draevor (`converterPersonagem`) também nas peças do PoE postas aqui, e a peça mudava antes da troca.
  e.versaoDosItens = VERSAO_DOS_ITENS;
  mexer?.(e);
  const nome = nomeNovo('Tr');
  const p = await B.criarPersonagem({ conta: c.id, nome, vocacao, sexo: 'male', estadoInicial: e });
  const recebidas = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => recebidas.push(JSON.parse(d)) });
  s.conta = await B.contaPorId(c.id);
  await s.entrarNoPersonagem({ name: nome });
  assert.ok(s.personagem, `entrou em ${nome}`);
  limpar.push(async () => {
    const v = vivas.get(nome);
    if (v) v.desconectar();
    vivas.delete(nome);
    await B.excluirPersonagem(p.id);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(c.id);
  });
  return { s, nome, c, recebidas, estado: () => s.estado, erro: () => recebidas.findLast((m) => m.t === 'error')?.message, ultimoState: () => recebidas.findLast((m) => m.t === 'state') };
}
const trade = (j, m) => j.s.receber({ t: 'trade', ...m });
const noBanco = async (nome) => JSON.parse((await B.personagemPorNome(nome)).estado);
async function abrirTroca(a, b) {
  await trade(a, { action: 'invite', name: b.nome });
  assert.equal(b.ultimoState()?.conviteDeTroca?.de, a.nome, 'o convite chegou');
  await trade(b, { action: 'accept' });
  assert.equal(a.ultimoState()?.troca?.com, b.nome);
  assert.equal(b.ultimoState()?.troca?.com, a.nome);
}

test('trade: convite, aceite, ofertas (única + ouro), as duas confirmações — entrega exata e GRAVADA no banco para os dois', { skip: soNoOficial('as peças do PoE (adaptado ao PoE)') }, async () => {
  // (adaptado ao PoE) A peça Única do PoE no lugar da Assassin Star Mítica; Orbes do Caos no lugar das poções.
  const mitica = pecaDoPoe('unico');
  const a = await jogador({ mexer: (e) => e.inventory.push(structuredClone(mitica), { id: ORBE, count: 5 }) });
  const b = await jogador();
  await abrirTroca(a, b);
  await trade(a, { action: 'offer', id: PECA, count: 1, alvo: { indice: 0, tier: mitica.tier, af: mitica.af } });
  await trade(a, { action: 'offer', id: ORBE, count: 3 });
  await trade(b, { action: 'gold', value: 2500 });
  // O outro lado vê a oferta, com a raridade.
  const visto = b.ultimoState().troca.dele.itens;
  assert.equal(visto.length, 2);
  assert.equal(visto.find((x) => x.id === PECA).poe.raridade, 'unico');
  await trade(a, { action: 'confirm' });
  assert.equal(b.ultimoState().troca.dele.confirmou, true);
  await trade(b, { action: 'confirm' });
  // Fechou para os dois.
  assert.equal(a.ultimoState().troca, undefined);
  assert.equal(b.ultimoState().troca, undefined);
  // A entrega: a MESMA cópia única; as 3 orbes; o ouro.
  const recebida = b.estado().inventory.find((p) => p.id === PECA);
  assert.equal(instancia(recebida), instancia(mitica));
  assert.equal(b.estado().inventory.find((p) => p.id === ORBE)?.count, 3);
  assert.equal(a.estado().inventory.find((p) => p.id === ORBE)?.count, 2);
  assert.ok(!a.estado().inventory.some((p) => p.id === PECA));
  assert.equal(a.estado().gold, 12_500);
  assert.equal(b.estado().gold, 7_500);
  // Gravado no banco, os dois, na mesma transação.
  const [ba, bb] = [await noBanco(a.nome), await noBanco(b.nome)];
  assert.equal(instancia(bb.inventory.find((p) => p.id === PECA)), instancia(mitica));
  assert.ok(!ba.inventory.some((p) => p.id === PECA));
  assert.equal(ba.gold, 12_500);
  assert.equal(bb.gold, 7_500);
  // Confirmar de novo depois de fechada: nada acontece (sem entrega dupla).
  await trade(b, { action: 'confirm' });
  assert.equal(b.erro(), 'Você não está numa troca.');
  assert.equal(b.estado().inventory.filter((p) => p.id === PECA).length, 1);
});

test('trade: mudar a oferta depois de uma confirmação desmarca as duas — e só entrega com as duas de novo', { skip: soNoOficial('as peças do PoE (adaptado ao PoE)') }, async () => {
  // (adaptado ao PoE) Orbes do Caos no lugar das poções.
  const a = await jogador({ mexer: (e) => e.inventory.push({ id: ORBE, count: 5 }) });
  const b = await jogador();
  await abrirTroca(a, b);
  await trade(a, { action: 'offer', id: ORBE, count: 2 });
  await trade(b, { action: 'confirm' });
  await trade(a, { action: 'offer', id: ORBE, count: 1 }); // mudou
  assert.equal(a.ultimoState().troca.dele.confirmou, false, 'a confirmação de B caiu');
  await trade(a, { action: 'confirm' });
  assert.ok(!b.estado().inventory.some((p) => p.id === ORBE), 'não entregou só com uma');
  await trade(b, { action: 'confirm' });
  assert.equal(b.estado().inventory.find((p) => p.id === ORBE)?.count, 3);
});

test('trade: o servidor recusa — item fixo, mais do que tem, item que sumiu da mochila antes de fechar, ouro que não tem', { skip: soNoOficial('as peças do PoE (adaptado ao PoE)') }, async () => {
  // (adaptado ao PoE) Orbes do Caos no lugar das poções.
  const fixo = Object.values(ITEM_CATALOG).find((i) => i.fixo);
  const a = await jogador({ mexer: (e) => e.inventory.push({ id: ORBE, count: 2 }, ...(fixo ? [{ id: Number(fixo.id), count: 1 }] : [])) });
  const b = await jogador();
  await abrirTroca(a, b);
  if (fixo) {
    await trade(a, { action: 'offer', id: Number(fixo.id), count: 1 });
    assert.match(a.erro(), /fixa/);
  }
  await trade(a, { action: 'offer', id: ORBE, count: 5 });
  assert.match(a.erro(), /não tem tudo isso/);
  await trade(a, { action: 'gold', value: 999_999 });
  assert.match(a.erro(), /não tem esse ouro/);
  // Oferece 2 orbes e depois as vende/larga: a confirmação final confere e recusa.
  await trade(a, { action: 'offer', id: ORBE, count: 2 });
  a.estado().inventory = [];
  await trade(a, { action: 'confirm' });
  await trade(b, { action: 'confirm' });
  assert.match(b.erro(), /não tem mais/);
  assert.ok(!b.estado().inventory.some((p) => p.id === ORBE), 'nada apareceu do nada');
  assert.equal(b.ultimoState().troca.minha.confirmou, false, 'confirmações desfeitas');
});

test('trade: quem recebe sem capacidade — recusa e nada se move', { skip: aAdaptar("No PoE a troca não recusa por falta de vaga: o que passa das 20 vagas da mochila vai para o Depósito (`Deposito.excessoParaODeposito`, dono 07–08/10: todo caminho), nada se perde — o \"recusa e nada se move\" é da capacidade por peso do Draevor; verificado com as peças do PoE (B com 19 peças recebe 2: fica com 20 e a outra no Depósito, sem erro)") }, async () => {
  const a = await jogador({ mexer: (e) => e.inventory.push({ id: LOBO, count: 1 }, { id: LOBO, count: 1 }) });
  // B com 16 lobos (4.160 de 4.310): mais dois (520) passam da capacidade.
  const b = await jogador({ mexer: (e) => e.inventory.push(...Array(16).fill(null).map(() => ({ id: LOBO, count: 1 }))) });
  await abrirTroca(a, b);
  await trade(a, { action: 'offer', id: LOBO, count: 2 });
  await trade(a, { action: 'confirm' });
  const [antesA, antesB] = [JSON.stringify(a.estado().inventory), JSON.stringify(b.estado().inventory)];
  await trade(b, { action: 'confirm' });
  assert.match(b.erro() ?? '', /capacidade/);
  assert.equal(JSON.stringify(a.estado().inventory), antesA);
  assert.equal(JSON.stringify(b.estado().inventory), antesB);
});

test('trade: cancelar, desconectar e uma segunda troca com quem já está trocando', async () => {
  const a = await jogador({ mexer: (e) => e.inventory.push({ id: POCAO, count: 2 }) });
  const b = await jogador();
  const c = await jogador();
  await abrirTroca(a, b);
  // C não abre outra troca com A (o mesmo item nunca está em duas).
  await trade(c, { action: 'invite', name: a.nome });
  assert.match(c.erro(), /já está numa troca/);
  // Cancelar fecha para os dois, sem mexer em nada.
  await trade(a, { action: 'offer', id: POCAO, count: 2 });
  await trade(b, { action: 'cancel' });
  assert.equal(a.ultimoState().troca, undefined);
  assert.equal(a.estado().inventory.find((p) => p.id === POCAO)?.count, 2);
  // Desconectar no meio: a troca do outro fecha.
  await abrirTroca(a, c);
  c.s.desconectar();
  assert.equal(a.ultimoState().troca, undefined);
  assert.match(a.recebidas.findLast((m) => m.t === 'notice')?.notice ?? '', /saiu do jogo/);
});

test('trade: caçando não troca; recusar o convite avisa quem convidou', async () => {
  const a = await jogador();
  const b = await jogador();
  b.estado().hunt = { huntId: HUNT_DE_TESTE };
  await trade(a, { action: 'invite', name: b.nome });
  assert.match(a.erro(), /caçando/);
  b.estado().hunt = null;
  await trade(a, { action: 'invite', name: b.nome });
  await trade(b, { action: 'decline' });
  assert.match(a.recebidas.findLast((m) => m.t === 'notice')?.notice ?? '', /recusou/);
  assert.equal(b.ultimoState()?.conviteDeTroca, undefined);
});

test('chão pela sessão: largar a única, outro jogador pega, sai do jogo e volta — continua única (gravada no banco)', { skip: soNoOficial('as peças do PoE (adaptado ao PoE)') }, async () => {
  // (adaptado ao PoE) A peça Única do PoE no lugar da Assassin Star Mítica.
  const mitica = pecaDoPoe('unico');
  const a = await jogador({ mexer: (e) => e.inventory.push(structuredClone(mitica)) });
  const b = await jogador();
  const pos = a.estado().pos;
  b.estado().pos = { ...pos };
  await a.s.receber({ t: 'largar', id: PECA, count: 1, x: pos.x, y: pos.y, alvo: { indice: 0, tier: mitica.tier, af: mitica.af } });
  await b.s.receber({ t: 'pegar', x: pos.x, y: pos.y, indice: null });
  assert.equal(instancia(b.estado().inventory.find((p) => p.id === PECA)), instancia(mitica));
  // Sai (grava) e volta: a peça vem do banco do jeito que foi.
  await b.s.desconectar();
  const salvo = await noBanco(b.nome);
  assert.equal(instancia(salvo.inventory.find((p) => p.id === PECA)), instancia(mitica));
});
