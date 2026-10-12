// O CHEFE só solta item do PoE no jogo oficial (dono, 12/10: "isso não era pra acontecer — tem itens que não são do PoE dropando boss": umas
// "Botas de Escamas de Bronze" Épicas, com estrelas e mods T1/T2, do Dominus). A causa: as peças garantidas do chefe do ato
// (`itens/equipamento-do-boss.mjs`, do clássico) sorteiam do catálogo — que no oficial tem as bases do PoE — e saem pelo gerador do
// Draevor; o filtro (`so-itens-do-poe.podeEntrar`) olhava só o id (o da base do PoE passava). Agora as peças garantidas são só do
// clássico, e a peça do gerador do Draevor (raridade do Draevor, afixos em lista, sem `poe`) não é do PoE nem com o id de uma base do PoE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const SO = await import('../systems/itens-poe/so-itens-do-poe.mjs');
const { gerarItem } = await import('../systems/itens/gerar.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}
/** A peça do gerador do Draevor (raridade do Draevor, afixos em lista, sem `poe`). */
const doDraevor = (p) => !p.poe && (Array.isArray(p.af) || typeof p.raridade === 'string');

test('a peça do gerador do Draevor numa base do PoE NÃO é do PoE; a do PoE, o item de missão e a gema seguem entrando', { skip: SEM }, () => {
  const base = Object.values(ITEM_CATALOG).find((i) => i.id >= 7_000_000 && i.slot === 'feet');
  assert.ok(base, 'há uma bota do PoE no catálogo');
  const errada = gerarItem({ itemId: base.id, itemLevel: 36, boss: true, origem: 'boss' });
  assert.ok(doDraevor(errada), `o gerador do Draevor fez: ${JSON.stringify(errada).slice(0, 120)}`);
  assert.equal(SO.ehDoPoe(errada.id, errada), false);
  assert.equal(SO.podeEntrar(errada.id, errada), false);
  // A peça do sistema do PoE na mesma base: entra.
  const certa = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Boots/Bronzescale_Boots', raridade: 'magico', ilvl: 36 }));
  assert.equal(SO.podeEntrar(certa.id, certa), true);
  // Só o id (a tabela de drop, antes de gerar) e o item de missão (`{ id, count }`): entram.
  assert.equal(SO.podeEntrar(base.id), true);
  assert.equal(SO.podeEntrar(base.id, { id: base.id, count: 1 }), true);
  // A gema do PoE (com a raridade dela) não muda.
  assert.equal(SO.podeEntrar(916_014, { id: 916_014, count: 1, raridade: 'comum' }), true);
});

test('a vitória no chefe do ato (oficial): nenhuma peça do gerador do Draevor na sacola — só o drop do PoE', { skip: SEM }, async () => {
  const Cacadas = await import('../systems/cacadas.mjs');
  const Bau = await import('../systems/bau.mjs');
  const Pinaculos = await import('../systems/itens-poe/pinaculos.mjs');
  const { vitoriaNoBoss } = await import('../systems/hunt/combate.mjs');
  const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
  Pinaculos.iniciar();
  let pecas = 0;
  // (as peças garantidas do clássico eram sorteadas: dez lutas pegam com folga a que saía numa base do PoE; um personagem por luta — o
  // chefe tem recarga)
  for (let luta = 0; luta < 10; luta++) {
    const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
    Bau.garantir(e);
    const r = Cacadas.entrar(e, { huntId: 'poe-the-maven', mode: 'auto' });
    assert.equal(r.ok, true, r.erro);
    const m = e.hunt.monstros.find((x) => x.boss);
    // O chefe de FIM DE ATO (a campanha: `bossDoAto` — o que pedia as peças garantidas, 1 na dificuldade fácil).
    e.hunt.campanha = { ...(e.hunt.campanha ?? {}), ato: 3, bossDoAto: 3, dificuldade: 'facil' };
    const antes = e.rewards.length;
    vitoriaNoBoss(e, e.hunt, m, PERSONAGEM);
    assert.equal(e.rewards.length, antes + 1, 'uma sacola do chefe');
    const itens = e.rewards.at(-1).itens;
    pecas += itens.length;
    const ruins = itens.filter((i) => doDraevor(i) || !SO.podeEntrar(i.id, i));
    assert.deepEqual(ruins.map((i) => `${i.id} ${i.raridade ?? ''}`), [], 'nada do gerador do Draevor');
  }
  assert.ok(pecas > 0, 'a sacola trouxe o drop do PoE');
});
