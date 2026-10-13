// O "MAIS" e o "MENOS" exatos da árvore do PoE (dono, 13/10: "pode seguir com o mais e menos exatos"): o "X% mais/menos" MULTIPLICA, em vez
// de somar ao aumentado — a Área de Efeito, a Duração do Efeito de Habilidades, a Vida Recuperada dos Frascos e o dano degenerativo das magias.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Um personagem numa caçada do PoE, com `af` na arma. */
function personagem(af = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 70 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = peca('Wands/Driftwood_Wand');
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  P.garantir(e);
  return e;
}
const entrada = (slug) => Acoes.POR_ID_PUBLICO(G.doSlug(slug).acao);

test('a DURAÇÃO: "10% mais Duração do Efeito de Habilidades" multiplica o aumentado (50% aumentada e 10% mais = ×1,65, não ×1,60)', { skip: SEM }, () => {
  const e = personagem({ duracao_habilidades: 50, duracao_mais: 10 });
  const entry = entrada('Steelskin');
  assert.ok(Math.abs(Acoes.fatorDeDuracao(e, entry, { duracaoPct: 0 }) - 1.5 * 1.1) < 1e-9);
  const menos = personagem({ duracao_habilidades: 50, duracao_mais: -10 });
  assert.ok(Math.abs(Acoes.fatorDeDuracao(menos, entry, { duracaoPct: 20 }) - 1.7 * 0.9) < 1e-9, 'o da gema soma ao aumentado; o "menos" multiplica tudo');
});

test('a ÁREA: "X% mais Área de Efeito" multiplica o aumentado — 50% aumentada e 20% mais = 80% (3 casas a mais, a fração como chance), não 70%', { skip: SEM }, () => {
  const e = personagem();
  const entry = entrada('Steelskin');
  const casas = (afPoe, rng) => ModsPoe.alvosDasPecas(e, { afPoe }, entry, ['area'], 'weapon', rng).area;
  assert.equal(casas({ area_inc: 50, area_mais: 20 }, () => 0.99), 3);
  assert.equal(casas({ area_inc: 50, area_mais: 20 }, () => 0), 4, '80/25 = 3,2: a fração vira chance');
  assert.equal(casas({ area_inc: 50 }, () => 0.99), 2, 'sem o mais, 50% = 2 casas');
  // (o raio da aura: √(1,5 × 1,2) em vez de √1,5)
  const comMais = personagem({ area_inc: 50, area_mais: 20 });
  const sem = personagem({ area_inc: 50 });
  assert.equal(Acoes.raioDaAuraDe(comMais, entry, 10), Math.round(10 * Math.sqrt(1.5 * 1.2)));
  assert.equal(Acoes.raioDaAuraDe(sem, entry, 10), Math.round(10 * Math.sqrt(1.5)));
});

test('o FRASCO: "50% menos Vida Recuperada de Frascos" multiplica (20% aumentada e 50% menos = ×0,6, não ×0,7)', { skip: SEM }, () => {
  const f = peca('Life_Flasks/Divine_Life_Flask');
  const base = Frascos.parametros(f, {}).quantidade;
  const q = Frascos.parametros(f, { frasco_vida_rec: 20, frasco_vida_rec_mais: -50 }).quantidade;
  assert.ok(Math.abs(q - base * 1.2 * 0.5) <= 1, `${q} vs ${base * 0.6}`);
  const mana = peca('Mana_Flasks/Divine_Mana_Flask');
  assert.equal(Frascos.parametros(mana, { frasco_vida_rec_mais: -50 }).quantidade, Frascos.parametros(mana, {}).quantidade, 'só nos de Vida');
});

test('o DEGENERATIVO das magias: "Mais X% de dano degenerativo com habilidades mágicas" é o "mais" de verdade (`dano_dot_mais`), só nas magias', { skip: SEM }, () => {
  const e = personagem({ 'dano_dot_mais@magia': 30 });
  const ficha = Ficha.combate(e);
  const magia = ModsPoe.fichaDoGolpe(ficha, ['magia'], { estado: e });
  const ataque = ModsPoe.fichaDoGolpe(ficha, ['ataque'], { estado: e });
  assert.equal(magia.afeccoes?.dotMais, 30);
  assert.equal(ataque.afeccoes?.dotMais ?? 0, 0);
});

test('a ÁRVORE: as 9 linhas de "mais"/"menos" ficaram exatas (sem a nota "o mais entra como aumentado")', { skip: SEM }, () => {
  const linhas = P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i], nota: o.notas?.[i] }))));
  const achadas = linhas.filter((l) => /mais Área de Efeito enquanto empunhando|menos Vida Recuperada de Frascos|de dano degenerativo com habilidades mágicas|(mais|menos) Duração do Efeito de Habilidades/.test(l.t));
  // (as 9 que eram parciais e as do mesmo texto em outros nós)
  assert.ok(achadas.length >= 9, `${achadas.length}`);
  for (const l of achadas) {
    assert.ok(['equivalente', 'novo'].includes(l.estado), `${l.t}: ${l.estado}`);
    assert.doesNotMatch(String(l.nota ?? ''), /entra como (aumentado|reduzido)/);
  }
});
