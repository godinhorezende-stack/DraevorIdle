// Os FRASCOS de ponta a ponta (auditoria de dependências, 09/10): o nó real da árvore → a soma do personagem (o leitor dos frascos) → o frasco
// NO CINTO → usar (`Frascos.usar`) e o tique (`Frascos.tique`) → a vida recuperada / a duração do efeito; e as cargas por abate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Fr = await import('../systems/itens-poe/frascos.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) Jogo.iniciar(ITEM_CATALOG);

const semente = (s = 3) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
/** Um frasco NORMAL desta base, sem qualidade (só a árvore mexe nele). */
const frasco = (base) => {
  const p = Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: semente() }));
  p.poe.qualidade = 0;
  return p;
};
const noSo = (chave) => P.arvore().nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && (n.efeitos ?? []).length && n.efeitos.every((x) => x.add === chave));
function antesDo(id, base) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: 'Scion' });
  delete e.classe;
  P.garantir(e);
  e.equipment = {};
  Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, id).slice(0, -1) });
  e.frascos = [frasco(base), null, null, null, null];
  e.frascos[0].poe.cargas = 999;
  const soma = (k) => { Ficha.invalidar(e); return Number(Ficha.combate(e).afPoe[k]) || 0; };
  return { e, soma, alocar: () => assert.ok(Comandos.comando(e, { action: 'alocar', id }).ok) };
}

test('"Recuperação dos Frascos de Vida aumentada" (o nó real): usar o frasco do cinto recupera a vida na razão exata (o frasco de verdade, ao longo do efeito)', { skip: SEM }, () => {
  const no = noSo('frasco_vida_rec');
  assert.ok(no, 'há nó só com a recuperação dos frascos de vida');
  const { e, soma, alocar } = antesDo(no.id, 'Life_Flasks/Divine_Life_Flask');
  const base = Fr.parametros(e.frascos[0], {}).quantidade;
  const recupera = () => {
    Ficha.invalidar(e);
    e.hunt = { clock: 0 };
    e.maxHp = 1e7;
    // (a 1ª passada da caçada enche o cinto — a regra do PoE; com a vida cheia, o uso automático não bebe)
    e.hp = e.maxHp;
    Fr.tique(e);
    e.hp = 1;
    assert.ok(Fr.usar(e, 0), 'o frasco é usado');
    e.frascos[0].poe.cargas = 0; // UMA dose (o uso automático não repete)
    for (let t = 250; t <= 20_000; t += 250) { e.hunt.clock = t; Fr.tique(e); }
    return e.hp - 1;
  };
  const antes = recupera();
  assert.ok(Math.abs(antes - base * (1 + soma('frasco_vida_rec') / 100)) <= 2, `antes: ${antes}`);
  alocar();
  const depois = recupera();
  assert.ok(Math.abs(depois - base * (1 + soma('frasco_vida_rec') / 100)) <= 2, `depois: ${depois} (base ${base}, +${soma('frasco_vida_rec')}%)`);
  assert.ok(depois > antes);
});

test('"Duração dos Frascos aumentada" (o nó real): o frasco de Utilidade usado fica ativo mais tempo, na razão exata', { skip: SEM }, () => {
  const no = noSo('frasco_duracao');
  assert.ok(no);
  const { e, soma, alocar } = antesDo(no.id, 'Utility_Flasks/Quicksilver_Flask');
  const base = Fr.parametros(e.frascos[0], {}).duracaoMs;
  const ativo = () => { e.hunt = { clock: 0 }; Ficha.invalidar(e); assert.ok(Fr.usar(e, 0)); return e.hunt.frascosPoe.ativos[0].ate; };
  assert.equal(ativo(), Math.round(base * (1 + soma('frasco_duracao') / 100)));
  alocar();
  assert.equal(ativo(), Math.round(base * (1 + soma('frasco_duracao') / 100)));
});

test('"Cargas de Frasco recebidas aumentadas" (o nó real): o abate enche os frascos do cinto na razão exata', { skip: SEM }, () => {
  const no = noSo('frasco_cargas_recebidas');
  assert.ok(no);
  const { e, soma, alocar } = antesDo(no.id, 'Life_Flasks/Divine_Life_Flask');
  const ganho = () => { Ficha.invalidar(e); e.frascos[0].poe.cargas = 0; Fr.aoMatar(e, 'normal'); return e.frascos[0].poe.cargas; };
  const antes = ganho();
  assert.ok(antes > 0);
  const [p0] = [soma('frasco_cargas_recebidas')];
  alocar();
  const depois = ganho();
  assert.ok(Math.abs(depois - (antes / (1 + p0 / 100)) * (1 + soma('frasco_cargas_recebidas') / 100)) < 1e-9, `${antes} → ${depois}`);
});

test('"Frascos de Vida ganham 1 Carga a cada 3 segundos" (a maestria real): o tique do cinto dá a carga no tempo', { skip: SEM }, () => {
  const maestria = P.arvore().nos.find((n) => n.tipo === 'mastery' && n.opcoes.some((o) => o.efeitos.some((x) => x.add === 'frasco_regen_n:vida')));
  const opcao = maestria.opcoes.find((o) => o.efeitos.some((x) => x.add === 'frasco_regen_n:vida'));
  const notavel = P.arvore().nos.find((n) => n.tipo === 'notable' && n.grupo === maestria.grupo && !n.ascendencia);
  const { e } = antesDo(notavel.id, 'Life_Flasks/Divine_Life_Flask');
  assert.ok(Comandos.comando(e, { action: 'alocar', id: notavel.id }).ok);
  assert.ok(Comandos.comando(e, { action: 'alocar', id: maestria.id, opcao: opcao.id }).ok);
  Ficha.invalidar(e);
  e.hunt = { clock: 0 };
  Fr.tique(e); // (a 1ª passada enche o cinto e agenda a regeneração)
  e.frascos[0].poe.cargas = 0;
  const n = opcao.efeitos.find((x) => x.add === 'frasco_regen_n:vida').valor;
  const s = opcao.efeitos.find((x) => x.add === 'frasco_regen_s:vida').valor;
  for (let t = 250; t <= s * 1000 * 3; t += 250) { e.hunt.clock = t; Fr.tique(e); }
  assert.equal(e.frascos[0].poe.cargas, n * 3, 'três intervalos, três vezes as cargas');
});
