// As APIs do site no formato do original (api-mapeada/captura-site-0926/):
// as mesmas chaves em /api/status, /api/personagem, /api/online, /api/drops e
// /api/guilda — e a exp de hoje / da última hora contando de verdade.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as B from '../database/banco.mjs';
import * as Site from '../systems/site.mjs';
import * as DropsDoSite from '../systems/drops-do-site.mjs';
import * as Guildas from '../systems/guildas.mjs';
import * as Ranking from '../systems/ranking.mjs';
import { personagemDeTeste, comMarcaNova } from './apoio.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { aAdaptar } from './apoio-migracao.mjs';

const ler = (n) => comMarcaNova(JSON.parse(readFileSync(new URL(`../../api-mapeada/captura-site-0926/${n}`, import.meta.url), 'utf8')));
const chaves = (o) => Object.keys(o).sort();
const NOME = 'Sitetesteum';

const s = { personagem: { nome: NOME }, estado: personagemDeTeste({ vocacao: 'druid', level: 300 }) };
const vivas = new Map([[NOME, s]]);
Site.ligar(vivas);
Ranking.ligar(vivas); // no jogo quem liga é a sessão
DropsDoSite.gravarNosTestes(); // este teste confere a gravação (e apaga o que gravou)
after(() => B.db.prepare("DELETE FROM site_drops WHERE dados LIKE ?").run(`%"quem":"${NOME}"%`));

test('/api/status: as chaves e as linhas do original', async () => {
  const nosso = await Site.status('magic');
  const original = ler('status-magic.json');
  assert.deepEqual(chaves(nosso), chaves(original));
  // Diverge do original de propósito: aqui o melee é UMA perícia (fist, club, sword e axe juntas).
  assert.deepEqual(nosso.categorias, ['exp', 'level', 'magic', 'melee', 'distance', 'shielding', 'fishing']);
  const linha = nosso.highscore.find((l) => l.name === NOME);
  assert.ok(linha, 'quem está online entra no ranking com o valor ao vivo');
  assert.deepEqual(chaves(linha), chaves(original.highscore[0]));
  assert.equal(nosso.online, 1);
});

test('exp de hoje e da última hora contam a partir da primeira amostra', { skip: aAdaptar("O personagem de teste é legado arquivado e não gera amostras") }, async () => {
  const t0 = Date.now();
  Site.amostrar(t0);
  s.estado.xp += 5_000_000;
  s.estado.level += 2;
  const agora = t0 + 1000;
  const corpo = await Site.status('exp', agora + 20_000); // fura a guarda de 15 s da categoria
  const hoje = corpo.expHoje.find((l) => l.name === NOME);
  const hora = corpo.expHora.find((l) => l.name === NOME);
  assert.equal(hoje.value, 5_000_000);
  assert.equal(hoje.levels, 2);
  assert.deepEqual(chaves(hoje), chaves(ler('status-level.json').expHoje[0]));
  assert.equal(hora.value, 5_000_000);
  assert.deepEqual(chaves(hora), chaves(ler('status-level.json').expHora[0]));
});

test('/api/personagem: a ficha inteira e o "não existe"', async () => {
  const nosso = await Site.personagem(NOME.toLowerCase());
  const original = ler('personagem-zoros.json');
  assert.equal(nosso.ok, true);
  assert.deepEqual(chaves(nosso.personagem), chaves(original.personagem));
  // (Menos `proficiencias`: a proficiência de arma saiu do jogo — dono, 06/10.)
  assert.deepEqual(chaves(nosso.personagem.draevor), chaves(original.personagem.draevor).filter((k) => k !== 'proficiencias'));
  // As réguas do original, mais os poderes Lendário/Mítico (o texto deles no balão do equipamento).
  const { efeitosDeItem, ...catalogoDoOriginal } = nosso.personagem.catalogo;
  assert.deepEqual(chaves(catalogoDoOriginal), chaves(original.personagem.catalogo));
  assert.ok(efeitosDeItem?.lendario && efeitosDeItem?.mitico);
  assert.deepEqual(chaves(nosso.personagem.equipamento), chaves(original.personagem.equipamento));
  assert.equal(nosso.personagem.jogando, true);
  assert.equal(nosso.personagem.atividade.onde, 'cidade');
  assert.deepEqual(await Site.personagem('Ninguemaquixyz'), { ok: false, reason: 'não existe ninguém chamado Ninguemaquixyz' });
});

test('/api/online: quem está no jogo, com onde está', () => {
  const [j] = Site.jogadoresOnline().jogadores;
  assert.deepEqual(chaves(j), chaves(ler('online.json').jogadores[0]));
  assert.deepEqual([j.name, j.onde, j.hunt], [NOME, 'cidade', null]);
});

test('/api/drops: só o raro entra, no formato do original', async () => {
  // Uma bag entra; um item comum sem afixo não.
  await DropsDoSite.anotarDrop({ quem: NOME, onde: 'Teste', bicho: 'Bicho', id: 34109 });
  await DropsDoSite.anotarDrop({ quem: NOME, onde: 'Teste', bicho: 'Bicho', id: 3081 });
  const vista = await DropsDoSite.vista();
  const meus = vista.drops.filter((d) => d.quem === NOME);
  assert.deepEqual(meus.map((d) => d.nome), ['Bag You Desire']);
  // Os campos do original, mais a PEÇA inteira (o balão do jogo, à Path of Exile, desenha com ela).
  const { peca, ...doOriginal } = meus[0];
  assert.deepEqual(chaves(doOriginal), chaves(ler('drops.json').drops.find((d) => d.afixos)));
  assert.equal(peca.id, 34109);
  // E a rota manda o catálogo dessas peças e as réguas de afixo/poder.
  assert.ok(vista.itens[34109], 'o catálogo da peça');
  assert.ok(vista.catalogo.afixos && vista.catalogo.efeitosDeItem, 'afixos e poderes');
  assert.equal(meus[0].chance, 0.01);
  // Com três afixos dourados, até um comum entra (como o stone skin amulet capturado).
  assert.equal(DropsDoSite.valeAnotar(3081, [{ id: 'armor_flat', tier: 3, value: 99 }, { id: 'ice_res', tier: 3, value: 99 }, { id: 'fire_res', tier: 3, value: 99 }]), true);
  // A raridade que conta é a do DROP: Épico para cima entra (o mesmo corte do anúncio para todos); Raro não.
  const ESPADA = Number(Object.keys(ITEM_CATALOG).find((k) => ITEM_CATALOG[k].name === 'fire sword'));
  for (const raridade of ['épico', 'lendário', 'mítico']) assert.equal(DropsDoSite.valeAnotar(ESPADA, [], { raridade }), true, raridade);
  for (const raridade of ['comum', 'incomum', 'raro']) assert.equal(DropsDoSite.valeAnotar(ESPADA, [], { raridade }), false, raridade);
  // A raridade do catálogo sozinha (sem a do drop) não entra — era o que enchia a lista.
  assert.equal(DropsDoSite.valeAnotar(Number(Object.keys(ITEM_CATALOG).find((k) => ITEM_CATALOG[k].rarity === 'épico' && !DropsDoSite.ehBag(Number(k)))), null), false);
});

test('/api/guilda e /api/guildas: o formato do original', async () => {
  const lista = await Guildas.listaDoSite();
  if (lista.length) assert.deepEqual(chaves(lista[0]), chaves(ler('guildas.json').guildas[0]));
  assert.equal((await Guildas.fichaDoSite('Nao Existe Essa')).ok, false);
  if (lista.length) {
    const g = (await Guildas.fichaDoSite(lista[0].nome)).guilda;
    const o = ler('guilda-taka.json').guilda;
    assert.deepEqual(chaves(g), chaves(o));
    assert.deepEqual(chaves(g.membros[0]), chaves(o.membros[0]));
  }
});
