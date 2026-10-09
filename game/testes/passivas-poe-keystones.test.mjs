// As KEYSTONES do PoE que eram só texto e ganharam a mecânica inteira (auditoria da árvore, 09/10 — docs/auditorias/arvore-passivas-poe.md):
// cada uma alocada pelo servidor num personagem de teste, e o efeito medido onde o jogo o usa (a ficha, a absorção e a recarga do escudo, a
// regeneração, o roubo). Todas as linhas de cada uma — a vantagem E a desvantagem; nada pela metade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Defesa = await import('../systems/personagem/defesa.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

const PECA = (classe, base, af = {}) => ({ id: 3357, count: 1, base, poe: { classe, base: `${classe}/X`, af, prefixos: [], sufixos: [], implicitos: [] } });
/** Personagem Scion level 100 com a peça `corpo` vestida; o caminho até a keystone `nome` alocado (sem ela). */
function antesDa(nome, { corpo = null, anel = null } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: 'Scion' });
  delete e.classe;
  P.garantir(e);
  e.equipment = { ...(corpo ? { body: corpo } : {}), ...(anel ? { ring: anel } : {}) };
  const ks = P.arvore().nos.find((n) => n.tipo === 'keystone' && n.nome === nome);
  assert.ok(ks, nome);
  const c = P.caminhoAte(e, ks.id);
  assert.ok(Comandos.comando(e, { action: 'alocar', ids: c.slice(0, -1) }).ok);
  return { e, ks, ficha: () => { Ficha.invalidar(e); return Ficha.combate(e); } };
}
const alocar = (e, ks) => assert.ok(Comandos.comando(e, { action: 'alocar', id: ks.id }).ok);

test('Solipsismo: a Inteligência deixa de dar o Escudo de Energia inerente, e cada 15 de Int reduz 2% a duração das afecções elementais em você', { skip: SEM }, () => {
  const { e, ks, ficha } = antesDa('Solipsismo', { corpo: PECA('Body_Armours', { es: [400, 400] }) });
  const antes = ficha();
  const pctDaInt = antes.efeitosDosAtributos.energyShieldPct;
  assert.ok(pctDaInt > 0, 'a Int dava escudo antes');
  alocar(e, ks);
  const f = ficha();
  assert.equal(f.efeitosDosAtributos.energyShieldPct, 0);
  assert.ok(Math.abs(f.energyShield - (antes.energyShield / (1 + (pctDaInt + (Number(antes.afPoe.es_pct) || 0)) / 100)) * (1 + (Number(f.afPoe.es_pct) || 0) / 100)) <= 1, `escudo ${antes.energyShield} → ${f.energyShield}`);
  const esperado = -2 * Math.floor(f.atributos.int / 15);
  assert.equal(Number(f.afPoe.duracao_afeccoes_elementais_propria) || 0, esperado);
  // e o congelamento em você dura menos de verdade
  assert.ok(Math.abs(ModsPoe.controleNoJogador(f, 'congelado', () => 0.99).duracaoFator - (1 + esperado / 100)) < 1e-9);
});

test('Terror dos Magos: a Destreza deixa de dar a Evasão inerente; +1% de supressão por 15 de Des', { skip: SEM }, () => {
  const { e, ks, ficha } = antesDa('Terror dos Magos', { corpo: PECA('Body_Armours', { evasion: [400, 400] }) });
  const antes = ficha();
  alocar(e, ks);
  const f = ficha();
  assert.equal(f.efeitosDosAtributos.evasaoPct, 0);
  if (antes.efeitosDosAtributos.evasaoPct > 0) assert.ok(f.evasion < antes.evasion, 'a evasão cai sem o % da Des');
  assert.equal((Number(f.afPoe.spell_suppression) || 0) - (Number(antes.afPoe.spell_suppression) || 0), Math.floor(f.atributos.dex / 15));
});

test('Empunhadura de Ferro: o bônus de dano da Força passa a valer nos ataques de projétil (no corpo a corpo já valia; magia não)', { skip: SEM }, () => {
  const { e, ks, ficha } = antesDa('Empunhadura de Ferro');
  const tiro = ['attack', 'ranged', 'projectile', 'single', 'physical'];
  assert.equal(Ficha.forcaNoGolpe(ficha(), tiro), false);
  assert.equal(Ficha.forcaNoGolpe(ficha(), ['attack', 'melee', 'single', 'physical']), true);
  alocar(e, ks);
  const f = ficha();
  assert.equal(Ficha.forcaNoGolpe(f, tiro), true);
  assert.equal(Ficha.forcaNoGolpe(f, ['spell', 'fire']), false, 'magia não');
  assert.ok(f.danoFisicoDaForca > 0, 'a Força dá dano físico');
});

test('Juramento do Zelote: a regeneração de vida vira regeneração de Escudo de Energia (a vida para de regenerar; o escudo ganha o mesmo por segundo)', { skip: SEM }, () => {
  const { e, ks, ficha } = antesDa('Juramento do Zelote', { corpo: PECA('Body_Armours', { es: [400, 400] }), anel: PECA('Rings', undefined, { life_regen: 50 }) });
  const antes = ficha().regenPoe;
  assert.ok(antes.vidaPorSegundo > 0);
  alocar(e, ks);
  const f = ficha();
  assert.equal(f.regenPoe.vidaPorSegundo, 0);
  assert.ok(Math.abs(f.regenPoe.esDaVida - antes.vidaPorSegundo) < 1e-9);
  // no tique: 2 s dão 2 × o que a vida regeneraria
  e.hunt = { clock: 0 };
  e.es = 0;
  ModsPoe.tique(e, e.hunt, f, 2000);
  assert.equal(e.es, Math.floor(2 * f.regenPoe.esDaVida));
});

test('Devastador Fantasma: o roubo de vida enche o Escudo (com o teto do escudo dobrado) e o Escudo não recarrega', { skip: SEM }, () => {
  const { e, ks, ficha } = antesDa('Devastador Fantasma', { corpo: PECA('Body_Armours', { es: [400, 400] }), anel: PECA('Rings', undefined, { life_leech: 5 }) });
  alocar(e, ks);
  const f = ficha();
  e.hunt = { clock: 0 };
  Ficha.aplicarLeech(e, 1000, [], 'x', { x: 0, y: 0 }, f, null, { ataque: true });
  assert.equal(e.hunt.roubos.filter((r) => r.recurso === 'vida').length, 0, 'não rouba vida');
  const es = e.hunt.roubos.find((r) => r.recurso === 'es');
  assert.ok(es && es.restante > 0 && es.max === Math.round(f.energyShield), 'rouba escudo');
  // o teto por segundo do escudo dobrado: 10% → 20% do máximo por segundo
  e.es = 0;
  es.restante = 1e9;
  es.porSegundo = 1e9;
  Ficha.recuperarRoubo(e, 1000);
  assert.equal(e.es, Math.floor(f.energyShield * 0.2));
  // não recarrega
  e.es = 0;
  e.esEspera = 0;
  Defesa.recarregar(e, f, 5000);
  assert.equal(e.es, 0);
});

test('Bateria Anciã: o Escudo paga os custos, NÃO segura o dano da vida, e recarrega 50% menos', { skip: SEM }, () => {
  const { e, ks, ficha } = antesDa('Bateria Anciã', { corpo: PECA('Body_Armours', { es: [400, 400] }) });
  const antes = ficha();
  e.hunt = { clock: 0 };
  // antes: o escudo segura o dano
  e.es = 100;
  assert.equal(Defesa.absorver(e, antes, 60, null, null), 0);
  e.es = 0;
  e.esEspera = 0;
  Defesa.recarregar(e, antes, 1000);
  const recargaSem = e.es;
  assert.ok(recargaSem > 0);
  alocar(e, ks);
  const f = ficha();
  assert.ok(ModsPoe.escudoParaOCusto({ ...e, es: 100 }, null, f) > 0, 'o escudo paga o custo');
  e.es = 100;
  assert.equal(Defesa.absorver(e, f, 60, null, null), 60, 'o dano passa todo para a vida');
  assert.equal(e.es, 100, 'o escudo não perde nada');
  e.es = 0;
  e.esEspera = 0;
  e.esResto = 0;
  Defesa.recarregar(e, f, 1000);
  assert.ok(Math.abs(e.es - Math.floor(recargaSem * 0.5)) <= 1, `recarga ${recargaSem} → ${e.es}`);
});

test('Proteção Perversa: a recarga que começou há menos de 4 s não é interrompida pelo dano; 40% menos recarga', { skip: SEM }, () => {
  const { e, ks, ficha } = antesDa('Proteção Perversa', { corpo: PECA('Body_Armours', { es: [400, 400] }) });
  e.hunt = { clock: 10_000 };
  alocar(e, ks);
  const f = ficha();
  // a recarga começou há 1 s: o golpe não a interrompe
  e.es = 50;
  e.esEspera = 0;
  e.esRecargaDesde = 9_000;
  Defesa.absorver(e, f, 10, null, null);
  assert.equal(e.esEspera, 0);
  // começou há 5 s: interrompe (volta a esperar)
  e.esRecargaDesde = 5_000;
  Defesa.absorver(e, f, 10, null, null);
  assert.ok(e.esEspera > 0);
  // 40% menos recarga: o mesmo segundo recarrega 60% do normal
  const comNo = (() => { e.es = 0; e.esEspera = 0; e.esResto = 0; Defesa.recarregar(e, f, 1000); return e.es; })();
  const semNo = (() => { const g = { ...f, afPoe: { ...f.afPoe, es_recarga_menos: 0 } }; e.es = 0; e.esEspera = 0; e.esResto = 0; Defesa.recarregar(e, g, 1000); return e.es; })();
  assert.ok(Math.abs(comNo - Math.floor(semNo * 0.6)) <= 1, `${semNo} → ${comNo}`);
});

test('Juventude Eterna: a recarga do Escudo enche a VIDA (o escudo não recarrega), 50% menos regeneração de vida e 50% menos teto do roubo de vida', { skip: SEM }, () => {
  const { e, ks, ficha } = antesDa('Juventude Eterna', { corpo: PECA('Body_Armours', { es: [400, 400] }), anel: PECA('Rings', undefined, { life_regen: 50 }) });
  const antes = ficha();
  e.hunt = { clock: 0 };
  e.es = 0; e.esEspera = 0; e.esResto = 0;
  Defesa.recarregar(e, antes, 1000);
  const recarga = e.es;
  assert.ok(recarga > 0);
  alocar(e, ks);
  const f = ficha();
  assert.ok(Math.abs(f.regenPoe.vidaPorSegundo - antes.regenPoe.vidaPorSegundo * 0.5) < 1e-9, 'metade da regeneração');
  // a recarga vai para a vida
  e.es = 0; e.esEspera = 0; e.esResto = 0;
  e.hp = 10;
  Defesa.recarregar(e, f, 1000);
  assert.equal(e.es, 0, 'o escudo não recarrega');
  assert.equal(e.hp, 10 + recarga, 'a vida ganha o que o escudo ganharia');
  // o teto do roubo de vida: 20% → 10% da vida máxima por segundo
  e.hp = 1;
  e.hunt.roubos = [{ recurso: 'vida', restante: 1e9, porSegundo: 1e9 }];
  Ficha.recuperarRoubo(e, 1000);
  assert.equal(e.hp, 1 + Math.floor(e.maxHp * 0.1));
});

test('Equilíbrio Elemental (o do PoE atual): o acerto de Fogo TIRA a Exposição a Fogo e EXPÕE Gelo e Raio em −25% (o sistema de Exposição de sempre)', { skip: SEM }, () => {
  const { e, ks, ficha } = antesDa('Equilíbrio Elemental');
  alocar(e, ks);
  const f = ficha();
  assert.equal(Number(f.afPoe.equilibrio_exposicao), 1);
  const hunt = { clock: 1000 };
  const alvo = { uid: 1, x: 0, y: 0, hp: 1000, maxHp: 1000, estados: { exposicao: { fire: 5000 }, exposicaoPct: { fire: 10 } } };
  ModsPoe.aoAcertar(e, hunt, alvo, f, { dano: 100, elementos: ['fire'], agora: 1000, rng: () => 0.99 });
  assert.equal(ModsPoe.exposicao(alvo, 1000, 'fire'), 0, 'a Exposição a Fogo saiu');
  assert.equal(ModsPoe.exposicao(alvo, 1000, 'ice'), 25);
  assert.equal(ModsPoe.exposicao(alvo, 1000, 'energy'), 25);
  // acerto físico não mexe
  const outro = { uid: 2, x: 0, y: 0, hp: 1000, maxHp: 1000, estados: {} };
  ModsPoe.aoAcertar(e, hunt, outro, f, { dano: 100, elementos: ['physical'], agora: 1000, rng: () => 0.99 });
  assert.equal(ModsPoe.exposicao(outro, 1000, 'ice'), 0);
});

test('Juramento do Zelote vindo de uma PEÇA (keystone:juramentoDoZelote) passa pelo MESMO caminho da árvore (um cálculo só, sem duplicar)', { skip: SEM }, async () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), { sistema: 'poe', classePoe: 'Scion' });
  delete e.classe;
  P.garantir(e);
  e.equipment = { body: PECA('Body_Armours', { es: [400, 400] }), ring: PECA('Rings', undefined, { life_regen: 50, 'keystone:juramentoDoZelote': 1 }) };
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  assert.equal(f.regenPoe.vidaPorSegundo, 0);
  assert.ok(f.regenPoe.esDaVida > 0);
  const cacadas = (await import('node:fs')).readFileSync(new URL('../systems/cacadas.mjs', import.meta.url), 'utf8');
  assert.ok(!/keystone:juramentoDoZelote/.test(cacadas), 'o caso especial antigo saiu da regeneração da caçada');
});
