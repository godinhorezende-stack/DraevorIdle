// O FILTRO DE LOOT do PoE (dono, 07/10: "arrume o filtro de loot de acordo com o PoE; só vai ter itens do PoE"). Só com ITENS_POE=1:
// a peça do PoE é decidida pela raridade do PoE, mods e tier (T1 é o melhor), Item Level, sockets (até 6, ligados, R-G-B) e classe.
// Ele decide a COLETA, como o filtro de loot do PoE (dono, 08/10: "o filtro de loot não está funcionando, está pegando itens mesmo
// setando as coisas"; "só dá para limpar, vender não pode"): `naoVender` = pega, `naoColetar` = fica no chão. Até 08/10 as seções
// decidiam a "venda automática" — que nunca vendia nada, porque a peça do PoE não tem preço no NPC — e tudo ia para a bolsa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';

/** Uma peça do PoE de teste: raridade, os tiers dos mods, Item Level, sockets (`ligados` = o 1º grupo), cores e classe. */
function peca({ raridade = 'normal', tiers = [], ilvl = 50, abertos = 1, ligados = 1, cores = null, classe = 'Body_Armours', id = 7000001 } = {}) {
  return {
    id, count: 1,
    soquetes: { abertos, links: Array.from({ length: Math.max(0, abertos - 1) }, (_, i) => i < ligados - 1), gemas: [], cores: cores ?? Array(abertos).fill('R') },
    poe: { raridade, classe, ilvl, prefixos: tiers.slice(0, 3).map((tier) => ({ tier })), sufixos: tiers.slice(3).map((tier) => ({ tier })) },
  };
}
function quem(settings = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  Bolsa.garantir(e);
  e.settings = { ...settings };
  return e;
}
const acao = (e, p) => Afixos.decisaoDoLoot(e, p).acao;

test('padrão do PoE: sem seção escolhida, pega tudo; com uma, só o que ela pega — o resto fica no chão; o Único sempre vem', { skip: SEM }, () => {
  const e = quem();
  for (const raridade of ['normal', 'magico', 'raro', 'unico']) assert.equal(acao(e, peca({ raridade })), 'naoVender', `sem filtro: pega o ${raridade}`);
  assert.equal(Afixos.decisaoDoLoot(e, peca()).motivo, 'sem filtro: pega tudo');
  assert.equal(acao(quem({ guardarRaridadePoe: 2 }), peca({ raridade: 'raro' })), 'naoVender', 'Raro para cima');
  assert.equal(acao(quem({ guardarRaridadePoe: 2 }), peca({ raridade: 'magico', tiers: [7] })), 'naoColetar', 'o Mágico fica no chão');
  assert.equal(Afixos.decisaoDoLoot(quem({ guardarRaridadePoe: 2 }), peca({ raridade: 'normal' })).motivo, 'nenhuma seção pega — fica no chão');
  assert.equal(acao(quem({ guardarRaridadePoe: 3 }), peca({ raridade: 'raro', tiers: [1, 2, 3, 4, 5, 6] })), 'naoColetar', 'Só Único: o Raro fica');
  assert.equal(acao(quem({ guardarModsPoe: 6 }), peca({ raridade: 'unico' })), 'naoVender', 'o Único vem mesmo sem passar na seção');
});

test('mods e tier: quantos mods e um deles T-N ou melhor (T1 é o melhor)', { skip: SEM }, () => {
  const e = quem({ guardarModsPoe: 4, guardarTierPoe: 2 });
  assert.equal(acao(e, peca({ raridade: 'raro', tiers: [2, 5, 6, 7] })), 'naoVender');
  assert.equal(acao(e, peca({ raridade: 'raro', tiers: [3, 5, 6, 7] })), 'naoColetar', 'sem T2 ou melhor');
  assert.equal(acao(e, peca({ raridade: 'raro', tiers: [1, 5, 6] })), 'naoColetar', 'só 3 mods');
  assert.equal(acao(quem({ guardarTierPoe: 1 }), peca({ raridade: 'magico', tiers: [1] })), 'naoVender', 'só o tier: um mod T1 basta');
  assert.equal(Afixos.decisaoDoLoot(e, peca({ raridade: 'raro', tiers: [2, 5, 6, 7] })).motivo, 'mods da peça');
});

test('sockets (até 6, ligados, R-G-B ligados) e Item Level pegam com OU, mesmo Normal', { skip: SEM }, () => {
  assert.equal(acao(quem({ guardarSockets: 6 }), peca({ abertos: 6 })), 'naoVender');
  assert.equal(acao(quem({ guardarLigados: 5 }), peca({ abertos: 6, ligados: 5 })), 'naoVender');
  assert.equal(acao(quem({ guardarLigados: 5 }), peca({ abertos: 6, ligados: 4 })), 'naoColetar');
  assert.equal(acao(quem({ guardarRgbPoe: true }), peca({ abertos: 3, ligados: 3, cores: ['R', 'G', 'B'] })), 'naoVender', 'o Cromático');
  assert.equal(acao(quem({ guardarRgbPoe: true }), peca({ abertos: 3, ligados: 2, cores: ['R', 'G', 'B'] })), 'naoColetar', 'B solto: não conta');
  assert.equal(acao(quem({ guardarIlvlPoe: 84 }), peca({ ilvl: 84 })), 'naoVender');
  assert.equal(acao(quem({ guardarIlvlPoe: 84 }), peca({ ilvl: 83 })), 'naoColetar');
  // Com OU: a peça que passa em uma das seções vem, mesmo sem passar nas outras.
  assert.equal(acao(quem({ guardarIlvlPoe: 84, guardarSockets: 6 }), peca({ ilvl: 40, abertos: 6 })), 'naoVender');
});

test('regras específicas do PoE: raridade E classe E mods E tier E Item Level E ligados; a primeira decide, antes das seções', { skip: SEM }, () => {
  const e = quem();
  assert.equal(Bolsa.definirRegrasDeLoot(e, { regras: [
    { raridade: 'unico', acao: 'naoColetar' },
    { raridade: 'magico', acima: true, classe: 'Rings', tier: 3, acao: 'naoVender' },
    { raridade: 'xyz', classe: 'nada<script>', ilvl: 999 },
  ] }).ok, true);
  assert.deepEqual(e.lootRegras.map((r) => [r.poe, r.raridade, r.classe, r.ilvl]), [[true, 'unico', null, 0], [true, 'magico', 'Rings', 0], [true, null, null, 100]], 'saneadas: raridade e classe inválidas viram "qualquer", o ilvl tem teto');
  e.lootRegras.pop();
  assert.equal(acao(e, peca({ raridade: 'unico' })), 'naoColetar', 'a regra vem antes da seção de raridade');
  assert.equal(acao(e, peca({ raridade: 'raro', classe: 'Rings', tiers: [3, 8] })), 'naoVender');
  assert.equal(acao(e, peca({ raridade: 'raro', classe: 'Amulets', tiers: [3, 8] })), 'naoVender', 'outra classe: nenhuma regra bate e, sem seção, pega tudo');
  assert.equal(acao({ ...e, settings: { guardarRaridadePoe: 3 } }, peca({ raridade: 'raro', classe: 'Amulets', tiers: [3, 8] })), 'naoColetar', 'outra classe, com "Só Único": fica');
  assert.equal(acao({ ...e, settings: { guardarRaridadePoe: 3 } }, peca({ raridade: 'raro', classe: 'Rings', tiers: [3, 8] })), 'naoVender', 'a regra "Coletar" pega antes das seções');
  // As listas por base continuam valendo primeiro ("Sempre coletar" é a lista "Não vender" de antes).
  e.itemRules.noSell.push(7000001);
  e.settings = { guardarRaridadePoe: 3 };
  assert.equal(Afixos.decisaoDoLoot(e, peca({ raridade: 'normal' })).motivo, 'lista "Não vender"');
  assert.equal(acao(e, peca({ raridade: 'normal' })), 'naoVender', 'na lista: vem mesmo com "Só Único"');
});

test('a tela recebe o modo PoE e a prévia com peças do PoE', { skip: SEM }, () => {
  const e = quem({ guardarRgbPoe: true });
  const estado = Bolsa.paraCliente(e);
  const previa = Afixos.previaDoFiltro(e);
  assert.ok(previa.some((l) => /Único/.test(l.rotulo) && l.acao === 'naoVender'));
  assert.ok(previa.some((l) => /R-G-B/.test(l.rotulo) && l.acao === 'naoVender'));
  assert.ok(previa.some((l) => /Normal, sem mods/.test(l.rotulo) && l.acao === 'naoColetar'), 'o que nenhuma seção pega fica no chão');
  assert.ok(previa.every((l) => l.acao !== 'vender'), 'no jogo oficial não há venda');
  assert.equal(estado.filtroPoe, true);
});

test('o filtro decide o que entra na bolsa: `Bolsa.ignora` da peça do PoE pelas seções e regras; a moeda, pela lista "Não coletar"', { skip: SEM }, async () => {
  const MoedasPoe = await import('../systems/itens-poe/moedas.mjs');
  const e = quem({ guardarRaridadePoe: 2 });
  const p = peca({ raridade: 'magico', tiers: [7] });
  assert.equal(Bolsa.ignora(e, p.id, p), true, 'o Mágico com "Raro para cima" fica no chão (antes ia para a bolsa: o ignora só olhava a lista e as regras)');
  assert.equal(Bolsa.ignora(e, p.id, peca({ raridade: 'raro' })), false);
  assert.equal(Bolsa.ignora(quem(), p.id, p), false, 'sem filtro: pega');
  const moeda = MoedasPoe.dropDoMonstro('unico', () => 0, 50)[0]?.id ?? Object.values((await import('../systems/dados.mjs')).ITEM_CATALOG).find((i) => i.type === 'moeda')?.id;
  assert.ok(moeda, 'uma moeda do PoE');
  assert.equal(Bolsa.ignora(e, moeda), false, 'a moeda não passa pelas seções (elas são de peça)');
  e.itemRules.noLoot.push(Number(moeda));
  assert.equal(Bolsa.ignora(e, moeda), true, 'na lista "Não coletar": fica no chão');
});

test('caçando no PoE: com "Só Único" nenhuma peça Normal/Mágica/Rara entra na bolsa (ficam no chão como "Ignorado"); sem filtro, entram', { skip: SEM }, async () => {
  const Cacadas = await import('../systems/cacadas.mjs');
  const Combate = await import('../systems/hunt/combate.mjs');
  const { PERSONAGEM } = await import('./apoio.mjs');
  const cacar = (settings) => {
    const e = quem({ ...settings, autoSellPouch: false });
    e.sistema = 'poe';
    assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
    const modelo = structuredClone(e.hunt.monstros[0]);
    // O mesmo monstro (Raro, para cair bastante) morre 300 vezes pelo caminho de verdade do loot.
    for (let i = 0; i < 300 && e.hunt; i++) Combate.matarMonstro(e, e.hunt, PERSONAGEM, { ...structuredClone(modelo), raridade: 'raro' }, []);
    const pecas = e.pouch.filter((x) => x.poe);
    const ignoradas = Object.values(e.hunt?.sessao?.itens?.ignorado ?? {}).reduce((a, b) => a + b, 0);
    return { pecas, ignoradas };
  };
  const solto = cacar({});
  assert.ok(solto.pecas.length > 0, 'sem filtro: as peças entram na bolsa');
  assert.ok(solto.pecas.some((x) => x.poe.raridade !== 'unico'), 'inclusive as não Únicas');
  assert.equal(solto.ignoradas, 0);
  const soUnico = cacar({ guardarRaridadePoe: 3 });
  // (Os frascos vêm sempre — o teste seguinte: as seções são para equipamento.)
  const FrascosPoe = await import('../systems/itens-poe/frascos.mjs');
  assert.deepEqual(soUnico.pecas.filter((x) => x.poe.raridade !== 'unico' && !FrascosPoe.ehFrasco(x)), [], 'nenhum equipamento não Único na bolsa');
  assert.ok(soUnico.ignoradas > 0, 'ficaram no chão ("Ignorado" no relatório da caçada)');
});

test('frasco e moeda: a raridade e as outras seções não decidem (são para equipamento) — só a lista ou uma regra da classe do frasco', { skip: SEM }, async () => {
  // Dono, 08/10: "frascos e moedas têm raridade, mas no loot filter não era para ser considerado". Com "Raro para cima" o frasco
  // Normal/Mágico ficava no chão.
  const frasco = (raridade) => peca({ raridade, tiers: raridade === 'magico' ? [7] : [], abertos: 0, ilvl: 20, classe: 'Life_Flasks', id: 7001009 });
  for (const settings of [{ guardarRaridadePoe: 2 }, { guardarRaridadePoe: 3 }, { guardarModsPoe: 4 }, { guardarIlvlPoe: 84 }, { guardarSockets: 4 }, { guardarLigados: 4 }]) {
    for (const raridade of ['normal', 'magico']) {
      const d = Afixos.decisaoDoLoot(quem(settings), frasco(raridade));
      assert.deepEqual([d.acao, d.motivo], ['naoVender', 'frasco (sempre)'], `${JSON.stringify(settings)}: o frasco ${raridade} vem`);
    }
  }
  assert.equal(acao(quem({ guardarRaridadePoe: 2 }), peca({ raridade: 'normal' })), 'naoColetar', 'o equipamento Normal continua no chão');
  // A regra específica sem classe (ou de outra classe) não pega o frasco; a da classe dele, sim.
  const e = quem({ guardarRaridadePoe: 2 });
  e.lootRegras = [Afixos.sanearRegraDeLootPoe({ raridade: 'normal', acao: 'naoColetar' })];
  assert.equal(acao(e, frasco('normal')), 'naoVender', 'a regra de raridade sem classe é de equipamento');
  assert.equal(acao(e, peca({ raridade: 'normal' })), 'naoColetar');
  e.lootRegras = [Afixos.sanearRegraDeLootPoe({ classe: 'Life_Flasks', acao: 'naoColetar' })];
  assert.equal(acao(e, frasco('magico')), 'naoColetar', 'a regra da classe do frasco decide');
  assert.equal(acao(e, peca({ raridade: 'normal', classe: 'Mana_Flasks', abertos: 0 })), 'naoVender', 'outra classe de frasco não');
  // A lista "Não coletar".
  const f = frasco('normal');
  assert.equal(Bolsa.ignora(quem({ guardarRaridadePoe: 3 }), f.id, f), false, 'com "Só Único" o frasco entra');
  const naLista = quem({ guardarRaridadePoe: 3 });
  naLista.itemRules.noLoot.push(f.id);
  assert.equal(Bolsa.ignora(naLista, f.id, f), true, 'na lista: fica no chão');
  // A moeda: nenhuma seção (nem "Só Único") a deixa no chão.
  const MoedasPoe = await import('../systems/itens-poe/moedas.mjs');
  for (const m of MoedasPoe.dropDoMonstro('unico', () => 0, 50)) assert.equal(Bolsa.ignora(quem({ guardarRaridadePoe: 3, guardarModsPoe: 6, guardarIlvlPoe: 86 }), m.id), false, `a moeda ${m.id} vem`);
  // A prévia da tela mostra o frasco vindo.
  assert.ok(Afixos.previaDoFiltro(quem({ guardarRaridadePoe: 3 })).some((l) => /Frasco/.test(l.rotulo) && l.acao === 'naoVender'));
});

// (Dono, 08/10: "o máximo de slot na bag é 20" — como no inventário do PoE, a pilha também ocupa uma vaga. De 07/10 a 08/10 as pilhas não
// contavam, e a mochila passava de 20 entradas.)
test('mochila do PoE: 20 vagas no total — a peça e a pilha ocupam uma cada (como no PoE); cheia, não entra mais nada — e nada se perde', { skip: SEM }, async () => {
  const Inventario = await import('../systems/inventario.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const naoEmpilha = Number(Object.keys(ITEM_CATALOG).find((id) => ITEM_CATALOG[id].slot === 'body' && !ITEM_CATALOG[id].stackable));
  const empilha = Number(Object.keys(ITEM_CATALOG).find((id) => ITEM_CATALOG[id].stackable && !ITEM_CATALOG[id].moeda));
  const e = quem();
  e.inventory = Array.from({ length: Inventario.vagasDaMochila(e) - 1 }, () => ({ id: naoEmpilha, count: 1 }));
  assert.equal(Inventario.cabeNaMochila(e, naoEmpilha), true, 'a última vaga');
  assert.equal(Inventario.cabeNaMochila(e, empilha, 20), true, 'a última vaga serve também para uma pilha (até 20)');
  assert.equal(Inventario.cabeNaMochila(e, empilha, 21), false, '21 são duas pilhas: pediriam duas vagas (dono, 08/10: "as pilhas podem ficar no máximo 20")');
  assert.equal(Inventario.cabeNaMochila(e, naoEmpilha, 2), false, 'duas peças, uma vaga');
  e.inventory.push({ id: naoEmpilha, count: 1 });
  assert.equal(Inventario.pecasNaMochila(e), 20);
  assert.equal(Inventario.cabeNaMochila(e, naoEmpilha), false, 'cheia');
  assert.equal(Inventario.cabeNaMochila(e, empilha, 5), false, 'cheia: a pilha nova também pede vaga');
  // A pilha que já está lá recebe mais do mesmo item sem pedir vaga, até 20; o que passar disso pede vaga nova.
  e.inventory[19] = { id: empilha, count: 5 };
  assert.equal(Inventario.cabeNaMochila(e, empilha, 15), true, 'junta na pilha que já está lá (5 + 15 = 20)');
  assert.equal(Inventario.cabeNaMochila(e, empilha, 16), false, 'passa de 20: pediria uma vaga');
  assert.match(Inventario.erroDeEspaco(e, naoEmpilha), /mochila está cheia \(20 vagas\)/);
  e.inventory[19] = { id: naoEmpilha, count: 1 };
  // Tirar do corpo com a mochila cheia: recusado, a peça fica vestida.
  e.equipment.body = { id: naoEmpilha, count: 1 };
  const r = Inventario.desequipar(e, { slot: 'body' });
  assert.equal(r.ok, false);
  assert.ok(e.equipment.body, 'continua vestida');
  // Da bolsa de loot para a mochila: recusado, fica na bolsa.
  e.pouch = [{ id: naoEmpilha, count: 1, poe: { raridade: 'raro' } }];
  assert.equal(Bolsa.moverBolsa(e, { id: naoEmpilha, to: 'bag', pilha: 0 }).ok, false);
  assert.equal(e.pouch.length, 1);
});

test('mochila do PoE: o que passar das 20 peças (compra, recompensa, engine…) vai para o Depósito, as mais recentes primeiro', { skip: SEM }, async () => {
  const Inventario = await import('../systems/inventario.mjs');
  const Deposito = await import('../systems/deposito.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const naoEmpilha = Number(Object.keys(ITEM_CATALOG).find((id) => ITEM_CATALOG[id].slot === 'body' && !ITEM_CATALOG[id].stackable));
  const e = quem();
  e.inventory = [];
  for (let i = 0; i < 23; i++) Inventario.darItem(e, naoEmpilha, 1);
  e.inventory.forEach((p, i) => (p.marca = i));
  const foi = Deposito.excessoParaODeposito(e);
  assert.equal(foi.length, 3);
  assert.equal(Inventario.pecasNaMochila(e), 20);
  assert.deepEqual(e.inventory.map((p) => p.marca).slice(-1), [19], 'as 3 mais recentes saíram');
  assert.match(Deposito.avisoDoExcesso(foi), /Mochila cheia: 3 item\(ns\) foram para o Depósito/);
});

test('mochila do PoE: a pilha também conta — a 21ª entrada, mesmo pilha, vai para o Depósito (nada se perde)', { skip: SEM }, async () => {
  const Inventario = await import('../systems/inventario.mjs');
  const Deposito = await import('../systems/deposito.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const naoEmpilha = Number(Object.keys(ITEM_CATALOG).find((id) => ITEM_CATALOG[id].slot === 'body' && !ITEM_CATALOG[id].stackable));
  const empilhaveis = Object.keys(ITEM_CATALOG).filter((id) => ITEM_CATALOG[id].stackable && !ITEM_CATALOG[id].moeda).slice(0, 2).map(Number);
  const e = quem();
  e.inventory = Array.from({ length: 19 }, () => ({ id: naoEmpilha, count: 1 }));
  for (const id of empilhaveis) Inventario.darItem(e, id, 5);
  assert.equal(e.inventory.length, 21);
  const foi = Deposito.excessoParaODeposito(e);
  assert.deepEqual(foi.map((f) => [f.id, f.count]), [[empilhaveis[1], 5]], 'a pilha mais recente');
  assert.equal(Inventario.pecasNaMochila(e), 20);
  const noDeposito = Deposito.garantir(e).flatMap((c) => c.itens).filter((p) => p.id === empilhaveis[1]).reduce((s, p) => s + (p.count ?? 1), 0);
  assert.equal(noDeposito, 5, 'as 5 estão no Depósito');
});

// Dono, 08/10: "só dá para limpar, vender não pode, tira até o botão de vender" e "bolsa de loot também só opção de limpar".
test('no jogo oficial a mochila e a bolsa de loot só têm "Limpar": sem "Vender", sem o relógio e sem a chave da venda automática', async () => {
  const { readFileSync } = await import('node:fs');
  const inv = readFileSync(new URL('../frontend/client/src/inventory.mjs', import.meta.url), 'utf8');
  const vender = [...inv.matchAll(/const vender = el\('button', 'bag-clear bag-sell', 'Vender'\);\n(?:\s*\/\/[^\n]*\n)*\s*vender\.hidden = !!character\.filtroPoe;/g)];
  assert.equal(vender.length, 2, 'o "Vender" da bolsa de loot e o da mochila');
  assert.match(inv, /relogio\.hidden = !!character\.filtroPoe;/, 'o relógio da venda automática');
  assert.match(inv, /mais\.hidden = !!character\.filtroPoe;/, 'o "+" do tempo da venda');
  assert.match(inv, /toggle\.hidden = !!character\.filtroPoe;/, 'a chave "Auto venda"');
});

test('no jogo oficial o atalho "Apenas o que NPC compra" é recusado (sem comprador, mandaria todas as peças para "Não coletar")', { skip: SEM }, () => {
  const e = quem();
  const r = Bolsa.presetDeLoot(e, { preset: 'npc', ids: [7000001, 7000002] });
  assert.equal(r.ok, false);
  assert.deepEqual(e.itemRules.noLoot, [], 'nada foi para "Não coletar"');
});

test('no jogo oficial nada é vendido: nem a venda da bolsa (automática ou pelo botão) nem a da mochila', { skip: SEM }, async () => {
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const comPreco = Number(Object.keys(ITEM_CATALOG).find((id) => (ITEM_CATALOG[id].sell ?? 0) > 0 && !ITEM_CATALOG[id].moeda));
  const e = quem();
  e.pouch = [{ id: comPreco, count: 1 }, peca({ raridade: 'normal' })];
  e.inventory = [{ id: comPreco, count: 1 }];
  const ouro = e.gold ?? 0;
  assert.deepEqual(Bolsa.venderBolsa(e), { gold: 0, itens: {} });
  assert.equal(e.pouch.length, 2, 'tudo continua na bolsa');
  assert.equal(Bolsa.vendaDaMochila(e, { lugar: 'bag', vender: [{ id: comPreco, pilha: 0 }] }).ok, false);
  assert.equal(e.inventory.length, 1);
  assert.equal(e.gold ?? 0, ouro);
});
