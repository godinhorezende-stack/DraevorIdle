// Os FRASCOS do PoE (systems/itens-poe/frascos.mjs): entram no catálogo e no drop, os mods mudam os números do frasco, o cinto (pôr/tirar),
// as cargas (gasta ao usar, ganha ao matar, enche ao entrar na caçada), o uso automático e o efeito na ficha enquanto dura.
// Usa o catálogo importado (fica fora do repositório): sem ele nesta máquina, os testes são pulados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Fr = await import('../systems/itens-poe/frascos.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
if (!SEM) Jogo.iniciar(ITEM_CATALOG);

const frasco = (base, raridade = 'normal', s = 3, ilvl = 60) => Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl, rng: semente(s) }));
/** Um frasco com um mod escolhido (o modelo e os valores, como o gerador grava). */
const comMod = (p, modelo, valores, lado = 'prefixos') => {
  p.poe[lado] = [...(p.poe[lado] ?? []), { modelo, valores, texto: modelo }];
  return p;
};

test('os frascos de Vida, Mana e Utilidade entram no catálogo (sem slot, para o cinto) e caem; Royale e Tinturas não', { skip: SEM }, () => {
  const ids = [...Jogo.registro().porBase.keys()];
  assert.ok(ids.includes('Life_Flasks/Divine_Life_Flask') && ids.includes('Mana_Flasks/Small_Mana_Flask') && ids.includes('Utility_Flasks/Quicksilver_Flask'));
  assert.ok(!ids.some((b) => /_Flasks\/Royale_/.test(b)) && !ids.some((b) => b.startsWith('Tinctures/')));
  const meta = ITEM_CATALOG[Jogo.idDaBase('Life_Flasks/Small_Life_Flask')];
  assert.deepEqual([meta.frasco, meta.slot, meta.type], [true, undefined, 'flasks']);
  // As peças de antes não mudam de id: os frascos vêm depois de todas as bases equipáveis.
  const maiorEquipavel = Math.max(...ids.filter((b) => !Jogo.FRASCOS.includes(b.split('/')[0])).map(Jogo.idDaBase));
  assert.ok(ids.filter((b) => Jogo.FRASCOS.includes(b.split('/')[0])).every((b) => Jogo.idDaBase(b) > maiorEquipavel));
  // No drop: aparecem, e nunca Raros (o PoE não tem frasco raro).
  const rng = semente(9);
  let n = 0;
  for (let i = 0; i < 4000; i++) {
    const p = Jogo.pecaSorteada(50, rng);
    if (p && Fr.ehFrasco(p)) {
      n++;
      assert.notEqual(p.poe.raridade, 'raro');
      assert.ok(p.poe.frasco && p.poe.af && !Object.keys(p.poe.af).length, 'frasco não soma atributo ao personagem fora do efeito');
    }
  }
  assert.ok(n > 50, `${n} frascos em 4000 peças`);
});

test('os números do frasco: a base e os mods (velocidade, quantidade, instantâneo, cargas, duração, efeito, "durante o Efeito")', { skip: SEM }, () => {
  const vida = Fr.parametros(frasco('Life_Flasks/Divine_Life_Flask'));
  assert.deepEqual([vida.tipo, vida.recurso, vida.quantidade, vida.ms, vida.cargasPorUso, vida.cargasMaximas], ['vida', 'vida', 2400, 3500, 15, 45]);
  const rapido = Fr.parametros(comMod(frasco('Life_Flasks/Divine_Life_Flask'), 'Velocidade de Recuperação aumentada em {0}%', [100]));
  assert.equal(rapido.ms, 1750);
  const instantaneo = Fr.parametros(comMod(frasco('Life_Flasks/Divine_Life_Flask'), 'Quantidade Recuperada reduzida em {0}% / Recuperação Instantânea', [25]));
  assert.deepEqual([instantaneo.instantaneo, instantaneo.quantidade], [true, 1800]);
  const cargas = Fr.parametros(comMod(comMod(frasco('Life_Flasks/Divine_Life_Flask'), '+{0} ao Máximo de Cargas', [10]), 'Cargas reduzidas em {0}% por uso', [20]));
  assert.deepEqual([cargas.cargasMaximas, cargas.cargasPorUso], [55, 12]);
  const rubi = Fr.parametros(frasco('Utility_Flasks/Ruby_Flask'));
  assert.deepEqual([rubi.tipo, rubi.duracaoMs, rubi.af.fire_res], ['utilidade', 8000, 50]);
  const rubiForte = Fr.parametros(comMod(comMod(frasco('Utility_Flasks/Ruby_Flask'), 'Duração aumentada em {0}%', [25]), 'Velocidade de Movimento aumentada em {0}% durante o Efeito', [8], 'sufixos'));
  assert.deepEqual([rubiForte.duracaoMs, rubiForte.af.move_speed, rubiForte.af.fire_res], [10000, 8, 50]);
  const fraco = Fr.parametros(comMod(frasco('Utility_Flasks/Ruby_Flask'), 'Recuperação de Cargas aumentada em {0}% / Efeito reduzido em {1}%', [50, 25]));
  assert.deepEqual([fraco.recargaPct, fraco.af.fire_res], [50, 37.5]);
  // O que o Draevor ainda não tem fica registrado (aparece, não faz nada).
  const imune = Fr.parametros(comMod(frasco('Utility_Flasks/Ruby_Flask'), '{0}% menos Duração / Imunidade a Congelamento e Resfriamento durante o Efeito', [33], 'sufixos'));
  assert.deepEqual(imune.linhas.map((l) => l.estado), ['efeito', 'registrado']);
  assert.equal(imune.duracaoMs, Math.round(8000 * 0.67));
});

test('o cinto: pôr da mochila, tirar de volta; a vaga ocupada devolve o frasco que estava nela', { skip: SEM }, async () => {
  const { personagemDeTeste } = await import('./apoio.mjs');
  const e = personagemDeTeste({ vocacao: 'knight', level: 30 });
  e.inventory = [frasco('Life_Flasks/Small_Life_Flask'), frasco('Mana_Flasks/Small_Mana_Flask'), frasco('Life_Flasks/Medium_Life_Flask')];
  assert.equal(Fr.por(e, { pilha: 0 }).ok, true);
  assert.equal(Fr.cinto(e).length, 5);
  assert.equal(Fr.cinto(e)[0].poe.base, 'Life_Flasks/Small_Life_Flask');
  assert.equal(e.inventory.length, 2);
  assert.equal(Fr.por(e, { pilha: 1, vaga: 0 }).ok, true, 'troca a da vaga 0');
  assert.equal(Fr.cinto(e)[0].poe.base, 'Life_Flasks/Medium_Life_Flask');
  assert.ok(e.inventory.some((p) => p.poe?.base === 'Life_Flasks/Small_Life_Flask'), 'a que estava voltou à mochila');
  assert.equal(Fr.tirar(e, { vaga: 0 }).ok, true);
  assert.equal(Fr.cinto(e)[0], null);
  assert.equal(e.inventory.length, 3);
  e.inventory.push({ id: 3031, count: 1 });
  assert.equal(Fr.por(e, { pilha: e.inventory.length - 1 }).ok, false, 'só frasco');
  const alto = frasco('Life_Flasks/Divine_Life_Flask');
  e.inventory.push(alto);
  assert.match(Fr.por(e, { pilha: e.inventory.length - 1 }).erro, /level 60/);
});

test('na caçada: enche ao entrar, usa sozinho com a vida baixa, recupera ao longo do tempo, gasta e ganha cargas; Utilidade soma na ficha enquanto dura', { skip: SEM }, async () => {
  const { personagemDeTeste } = await import('./apoio.mjs');
  const Afixos = await import('../systems/afixos.mjs');
  const e = personagemDeTeste({ vocacao: 'knight', level: 30 });
  e.inventory = [frasco('Life_Flasks/Small_Life_Flask'), frasco('Utility_Flasks/Ruby_Flask')];
  Fr.por(e, { pilha: 0 });
  Fr.por(e, { pilha: 0 });
  Fr.cinto(e)[0].poe.cargas = 0;
  e.hunt = { clock: 0, monstros: [{ hp: 10 }], pos: { x: 1, y: 1 } };
  e.maxHp = 1000;
  e.hp = 1000;
  const eventos = [];
  Fr.tique(e, eventos, 'Teste');
  assert.equal(Fr.cinto(e)[0].poe.cargas, 21 - 0, 'entrar na caçada enche (o de Vida não foi usado: vida cheia)');
  // O Rubi foi usado sozinho (há monstro vivo): +50% de resistência a fogo na ficha enquanto dura.
  assert.equal(Fr.cinto(e)[1].poe.cargas, 50 - 20);
  assert.equal(Afixos.soma(e).fire_res >= 50, true);
  // A vida cai abaixo de 50%: o de Vida sai sozinho e recupera 70 em 3 s.
  e.hp = 400;
  e.hunt.clock = 100;
  Fr.tique(e, eventos, 'Teste');
  assert.equal(Fr.cinto(e)[0].poe.cargas, 21 - 7);
  e.hunt.clock = 1600;
  Fr.tique(e, eventos, 'Teste');
  assert.equal(Math.round(e.hp), 435, 'metade dos 70 em 1,5 s');
  e.hunt.clock = 5000;
  Fr.tique(e, eventos, 'Teste');
  assert.equal(Math.round(e.hp), 470);
  // A vida segue abaixo de 50% e a recuperação acabou: o mesmo frasco sai de novo.
  assert.equal(Fr.cinto(e)[0].poe.cargas, 14 - 7);
  assert.ok(eventos.some((ev) => ev.t === 'heal' && ev.frasco));
  // O Rubi acabou (8 s): o efeito sai da ficha.
  e.hunt.clock = 8200;
  e.hunt.monstros = [];
  Fr.tique(e, eventos, 'Teste');
  assert.ok(!(Afixos.soma(e).fire_res >= 50));
  // Matar dá cargas a todos (pela raridade do monstro), sem passar do máximo.
  Fr.aoMatar(e, 'raro');
  assert.equal(Fr.cinto(e)[0].poe.cargas, 7 + 6);
  assert.equal(Fr.cinto(e)[1].poe.cargas, 30 + 6);
  for (let i = 0; i < 20; i++) Fr.aoMatar(e, 'boss');
  assert.equal(Fr.cinto(e)[1].poe.cargas, 50);
  // Para a tela.
  const tela = Fr.paraCliente(e);
  assert.deepEqual([tela.length, tela[0].tipo, tela[1].cargas, tela[1].cargasPorUso, tela[2]], [5, 'vida', 50, 20, null]);
});

test('cargas por monstro como o dono pediu (Comum 1, Mágico 3,5, Raro 6, Único 11) e a cidade enche os frascos na hora', { skip: SEM }, async () => {
  const F = await import('../systems/itens-poe/frascos.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const Jogo = await import('../systems/itens-poe/jogo.mjs');
  const { personagemDeTeste } = await import('./apoio.mjs');
  Jogo.iniciar(ITEM_CATALOG);
  const e = personagemDeTeste({ vocacao: 'knight', level: 10 });
  e.inventory = [Jogo.frascoInicial()];
  assert.ok(F.por(e, { pilha: 0 }).ok);
  const f = F.cinto(e)[0];
  f.poe.cargas = 0;
  for (const [tipo, n] of [['normal', 1], ['modificado', 3.5], ['raro', 6], ['unico', 11]]) {
    f.poe.cargas = 0;
    F.aoMatar(e, tipo);
    assert.equal(f.poe.cargas, Math.min(n, F.parametros(f).cargasMaximas), tipo);
  }
  f.poe.cargas = 2;
  e.hunt = null;
  assert.equal(F.paraCliente(e)[0].cargas, F.parametros(f).cargasMaximas, 'na cidade, cheio');
});

test('morreu e acordou na cidade: os frascos do cinto cheios (a sessão chama encherNaCidade na morte)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../websocket/sessao.mjs', import.meta.url), 'utf8');
  const morte = src.slice(src.indexOf('const morte = real ? Morte.morrer'), src.indexOf('return morte;', src.indexOf('const morte = real ? Morte.morrer')));
  assert.match(morte, /FrascosPoe\.encherNaCidade\(this\.estado\)/);
  const main = (await import('node:fs')).readFileSync(new URL('../frontend/client/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main.slice(main.indexOf('const bagKey = ['), main.indexOf('const bagKey = [') + 600), /character\.frascosPoe/, 'o inventário redesenha quando as cargas mudam');
});
