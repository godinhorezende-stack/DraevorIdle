// (Frente D, 04/11) O BALÃO das peças do PoE com o que o PoE mostra e o jogo não mostrava: o "Corrompido" (e os únicos e bases que o PoE já dá
// corrompidos caem corrompidos — o card do poedb com a classe "corrupted"), o TEXTO DE SABOR do card (FlavourText) e o "Histórico" das Joias
// Atemporais. Os dados: `gamedata/itens-poe/sabores.json` (tools/importar-sabores-poedb.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Moedas = await import('../systems/itens-poe/moedas.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { saborDaPeca, URL_DOS_SABORES } = await import('../frontend/client/src/itens-poe-balao.mjs');
const { textoDoSabor, cardsDaPagina } = await import('../tools/importar-sabores-poedb.mjs');

const SABORES = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/sabores.json', import.meta.url), 'utf8'));
const cat = () => Catalogo.catalogo();
/** A base (id) e a classe do único `slug` no catálogo do jogo. */
function baseDoUnico(slug) {
  for (const c of Object.values(cat().classes)) {
    const u = (c.unicos ?? []).find((x) => x.slug === slug);
    const b = u && c.bases.find((x) => x.nome === u.base);
    if (b) return b.id;
  }
  return null;
}
const gerar = (base, raridade, unico = null, rng = () => 0.5) => gerarPeca({ catalogo: cat(), regras: Catalogo.REGRAS, base, raridade, ilvl: 75, rng, unico });
const unico = (slug) => J.pecaDoJogo(gerar(baseDoUnico(slug), 'unico', slug));

test('o sabores.json: os textos do poedb com as quebras, as marcas de fábrica e as 11 Históricas', () => {
  assert.equal(SABORES.unicos.Lifesprig.sabor, 'Das menores sementes\nAté as maiores sequoias,\na Vida resiste em Wraeclast.');
  assert.equal(SABORES.unicos.Voices.corrompidoDeFabrica, true);
  assert.equal(SABORES.unicos.Lifesprig.corrompidoDeFabrica, undefined);
  assert.equal(SABORES.bases['Rings/Breach_Ring'].corrompidoDeFabrica, true);
  assert.equal(SABORES.bases['Trinkets/Thiefs_Trinket'].corrompidoDeFabrica, true);
  // (os 51 únicos do jogo que o poedb marca "Corrompido" + as 2 bases)
  assert.equal(SABORES.contagem.corrompidosDeFabrica, 53);
  const historicas = Object.entries(SABORES.unicos).filter(([, e]) => e.historico).map(([s]) => s).sort();
  assert.deepEqual(historicas, ['Baleful_Dominion', 'Brutal_Restraint', 'Destructive_Aspiration', 'Elegant_Hubris', 'Extinguishing_Grasp', 'Festering_Vengeance', 'Glorious_Vanity', 'Heroic_Tragedy', 'Lethal_Pride', 'Militant_Faith', 'Reclaimed_Malevolence']);
  // nenhum texto ficou com a marcação do PoE ou do HTML
  for (const e of [...Object.values(SABORES.unicos), ...Object.values(SABORES.bases)]) if (e.sabor) assert.doesNotMatch(e.sabor, /[<>{}]|&[a-z]+;/);
});

test('o importador: <br> vira quebra, a marcação de tamanho e as chaves do PoE saem, o card certo da página', () => {
  assert.equal(textoDoSabor('\n   <size:24>{Os ezomytas<br>foram sepultados}\n  '), 'Os ezomytas\nforam sepultados');
  assert.equal(textoDoSabor('Grandes obras requerem tempo.<br>{Este item pode ser transformado no Altar Sacrificial}'), 'Grandes obras requerem tempo.\nEste item pode ser transformado no Altar Sacrificial');
  assert.equal(textoDoSabor('<tamanho:23>{A &amp; B}'), 'A & B');
  const html = '<div class="newItemPopup UniquePopup"><div class="itemName"><span class="lc">Vozes</span></div><div class="content"><div class="corrupted">Corrompido</div><div class="FlavourText">Um<br>Dois</div></div>';
  assert.deepEqual(cardsDaPagina(html), [{ nomes: ['Vozes'], sabor: 'Um\nDois', corrompido: true }]);
});

test('o balão liga o sabor pelo que a peça guarda: o único pelo slug, a peça comum pela base', () => {
  assert.equal(URL_DOS_SABORES, '/gamedata/itens-poe/sabores.json');
  assert.equal(saborDaPeca({ unico: 'Lifesprig', base: 'Wands/Driftwood_Wand' }, SABORES), SABORES.unicos.Lifesprig.sabor);
  assert.equal(saborDaPeca({ base: 'Amulets/Ape_Talisman', raridade: 'raro' }, SABORES), SABORES.bases['Amulets/Ape_Talisman'].sabor);
  // (o único sem sabor não herda o da base)
  assert.equal(saborDaPeca({ unico: 'Nao_Existe', base: 'Amulets/Ape_Talisman' }, SABORES), null);
  assert.equal(saborDaPeca({ base: 'Rings/Gold_Ring' }, SABORES), null);
  assert.equal(saborDaPeca({ unico: 'Lifesprig' }, null), null);
});

test('os únicos que o PoE dá corrompidos caem corrompidos (e os outros não)', { skip: SEM }, () => {
  for (const slug of ['Skin_of_the_Lords', 'Voices', 'Megalomaniac', 'Atziris_Reign', 'Blood_of_Corruption', 'Replica_Fragility']) {
    const p = unico(slug);
    assert.ok(p?.poe, slug);
    assert.equal(p.poe.unico, slug);
    assert.equal(p.poe.corrompido, true, `${slug} cai corrompido`);
  }
  for (const slug of ['Lifesprig', 'Glorious_Vanity']) assert.ok(!unico(slug).poe.corrompido, `${slug} não é corrompido`);
  // a Corda da Servidão continua corrompida (a regra antiga, dos implícitos sorteados)
  assert.equal(unico('String_of_Servitude').poe.corrompido, true);
});

test('a base que o PoE dá corrompida (o Anel da Fenda) cai corrompida em toda raridade', { skip: SEM }, () => {
  for (const raridade of ['normal', 'magico', 'raro']) {
    const p = J.pecaDoJogo(gerar('Rings/Breach_Ring', raridade));
    assert.equal(p.poe.corrompido, true, raridade);
  }
  assert.ok(!J.pecaDoJogo(gerar('Rings/Gold_Ring', 'raro')).poe.corrompido);
});

test('o mapa único que o PoE dá corrompido (o Córtex) leva o "corrompido" na peça', { skip: SEM }, () => {
  const p = unico('Cortex');
  assert.equal(p.poe.classe, 'Maps');
  assert.equal(p.poe.corrompido, true);
});

test('corrompido de fábrica não aceita moeda que altere (só as Corroídas), como no PoE', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 70 });
  e.sistema = 'poe';
  const caos = Moedas.idDa('Chaos_Orb');
  const divino = Moedas.idDa('Divine_Orb');
  e.inventory = [unico('Skin_of_the_Lords'), { id: caos, count: 1 }, { id: divino, count: 1 }];
  const antes = JSON.stringify(e.inventory[0]);
  for (const moeda of [caos, divino]) {
    const r = Moedas.usar(e, { moeda, alvo: { onde: 'inventory', indice: 0 } });
    assert.equal(r.ok, false);
    assert.match(r.erro ?? r.notice ?? '', /corrompida/i);
  }
  assert.equal(JSON.stringify(e.inventory[0]), antes, 'a peça não mudou');
});

test('as Joias Atemporais trazem a linha "Histórico" (o "Limitado a: 1 Histórico")', { skip: SEM }, () => {
  for (const slug of ['Glorious_Vanity', 'Lethal_Pride', 'Brutal_Restraint', 'Militant_Faith', 'Elegant_Hubris', 'Heroic_Tragedy']) {
    const u = Object.values(cat().classes).flatMap((c) => c.unicos ?? []).find((x) => x.slug === slug);
    assert.equal(u.historico, true, slug);
    assert.ok(u.modificadores.some((m) => m.texto === 'Histórico'), slug);
    const p = unico(slug);
    assert.ok(p.poe.modificadores.some((m) => m.texto === 'Histórico'), slug);
    assert.ok(Number(p.poe.af.historico) > 0, `${slug}: o af do Histórico`);
  }
});
