// LOTE 72 — as RAMIFICADORAS, os NOTÁVEIS (a 7ª parte): 24 → 10 sem efeito. Os "Você e Aliados próximos" (a regeneração; a Agressividade ao
// Clamar), o Quebra-Maldições, +X% de Resistência a Caos contra o dano contínuo, o Esconjuro do Amaldiçoado (e o do Cegado com os dois lados do
// lembrete), o Emissário, o Definhar se houver N ou menos, os Clamores por Poder (a carga aleatória, a Armadura), a Chama Santificada dos
// Clamores, "se você Gastou Vida Recentemente" e as mãos principal/secundária.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const A = await import('../systems/itens-poe/arvore.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const Mecanicas = await import('../systems/mobs/mecanicas.mjs');
const Dot = await import('../systems/combate/dot.mjs');
const Ficha = await import('../systems/ficha.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) Jogo.iniciar(ITEM_CATALOG);

const efeitos = (linha) => Object.fromEntries(A.traduzirLinha(linha).efeitos.map((e) => [e.add, e.valor]));
const fichaCom = (af) => ({ afPoe: af, eventosPoe: ModsPoe.eventosDa(af) });
/** Um personagem do PoE com um anel com estes atributos, numa caçada mínima. */
function personagem(af = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: 'Scion' });
  delete e.classe;
  P.garantir(e);
  e.equipment = { ring: { id: 3357, count: 1, poe: { classe: 'Rings', base: 'Rings/X', af, prefixos: [], sufixos: [], implicitos: [] } } };
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  Ficha.invalidar(e);
  return e;
}

test('as linhas', { skip: SEM }, () => {
  assert.deepEqual(efeitos('Você e Aliados próximos Regeneram 1.00% de Vida por segundo'), { 'aliados:life_regen_max_pct': 1 });
  assert.deepEqual(efeitos('Quando você Clamar, você e Aliados próximos ganham Agressividade por 4 segundos'), { 'aliados:sempre:agressividade@clamouRecente': 1 });
  assert.deepEqual(efeitos('Remove uma Maldição após Canalizar por 2 segundos'), { canalizar_remove_maldicao_s: 2 });
  assert.deepEqual(efeitos('+30% de Resistência a Caos contra Dano Degenerativo'), { chaos_res_contra_degen: 30 });
  assert.deepEqual(efeitos('Inimigos Amaldiçoados por você tem Esconjuro se 33% da Duração da Maldição expirou'), { amaldicoados_esconjuro_apos_pct: 33 });
  assert.deepEqual(efeitos('Auras das suas Habilidades têm Efeito reduzido em 8% em você\npara cada Arauto te afetando, até 40%'), { aura_em_voce_menos_por_arauto: 8, aura_em_voce_menos_por_arauto_max: 40 });
  assert.deepEqual(efeitos('50% de chance de infligir Definhar por dois segundos ao Acertar se houver 5 ou menos Debuffs de Definhar no Inimigo'), { 'ev:acertar:alvo:definhado:2@alvoDefinhadosAte:5': 50 });
  assert.deepEqual(efeitos('Clamores têm 5% de Chance de conceder uma Carga de Tolerância, Frenesi ou Poder por Poder'), { 'ev:usarClamor:cargaAleatoriaPorPoder': 5 });
  assert.deepEqual(efeitos('Ganha Armadura aumentada em 25% por cada 5 de Poder por 8 segundos ao Clamar, máximo de 100%'), { 'ev:usarClamor:statTempPorPoder:armour_pct:8:5:100': 25 });
  assert.deepEqual(efeitos('Chama Santificada infligida por você tem a intensidade aumentada em 1% por 2% de chance de bloquear ataques'), { 'chama_santificada_efeito%bloqueio:2': 1 });
  assert.deepEqual(efeitos('Seus clamores infligem Chama Santificada'), { clamor_chama_santificada: 1 });
  assert.deepEqual(efeitos('+6% de Multiplicador de Dano Físico Degenerativo se você Gastou Vida Recentemente'), { 'dot_multi_phys@gastouVidaRecente': 6 });
  assert.deepEqual(efeitos('Velocidade de Ataque aumentada em 10% caso você tenha Acertado com sua Arma da Mão Principal Recentemente'), { 'atk_speed@acertouMaoPrincipalRecente': 10 });
  assert.deepEqual(efeitos('Velocidade de Movimento aumentada em 10% caso você tenha Acertado com sua Arma da Mão Secundária Recentemente'), { 'move_speed@acertouMaoSecundariaRecente': 10 });
});

test('os "Você e ALIADOS próximos": a regeneração em você; a Agressividade enquanto você Clamou há até 4 s', { skip: SEM }, () => {
  const sem = Ficha.combate(personagem()).afPoe;
  const e = personagem({ 'aliados:life_regen_max_pct': 1, 'aliados:sempre:agressividade@clamouRecente': 1 });
  const antes = Ficha.combate(e).afPoe;
  assert.equal((antes.life_regen_max_pct ?? 0) - (sem.life_regen_max_pct ?? 0), 1);
  assert.equal(antes.atk_speed ?? 0, sem.atk_speed ?? 0, 'sem Clamar: sem Agressividade');
  ModsPoe.marcar(e.hunt, 'clamou');
  Ficha.invalidar(e);
  const depois = Ficha.combate(e).afPoe;
  assert.equal((depois.atk_speed ?? 0) - (sem.atk_speed ?? 0), C.BUFFS.agressividade.af.atk_speed, 'Clamou: a Agressividade');
  e.hunt.clock += 4001;
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).afPoe.atk_speed ?? 0, sem.atk_speed ?? 0, 'depois dos 4 s');
});

test('o QUEBRA-MALDIÇÕES: uma Maldição sai depois de 2 s de Canalização — uma por canalização', { skip: SEM }, () => {
  const e = personagem();
  const h = e.hunt;
  const ficha = fichaCom({ canalizar_remove_maldicao_s: 2 });
  h.maldicoesNoJogador = { a: { ate: 99999 }, b: { ate: 99999 } };
  h.canalizacao = { acao: 'x', desde: 10000, ate: 20000 };
  C.tique(e, h, ficha, 100, 11500);
  assert.equal(Object.keys(h.maldicoesNoJogador).length, 2, '1,5 s: nada');
  C.tique(e, h, ficha, 100, 12100);
  assert.equal(Object.keys(h.maldicoesNoJogador).length, 1, '2 s: uma sai');
  C.tique(e, h, ficha, 100, 13000);
  assert.equal(Object.keys(h.maldicoesNoJogador).length, 1, 'a mesma canalização não tira outra');
  h.canalizacao = { acao: 'x', desde: 14000, ate: 30000 };
  C.tique(e, h, ficha, 100, 16100);
  assert.equal(Object.keys(h.maldicoesNoJogador).length, 0, 'a canalização nova tira a outra');
});

test('+30% de Resistência a CAOS contra o dano contínuo: o Caos contínuo em você cai pela resistência a mais (até o máximo)', { skip: SEM }, () => {
  const dano = (af) => {
    const e = personagem();
    e.maxHp = e.hp = 1e6;
    e.es = 0;
    const h = e.hunt;
    ModsPoe.definirFichaDaCacada(h, () => fichaCom(af));
    Dot.aplicarNoJogador(h, { tipo: 'degenCaos', total: 10000, duracaoMs: 4000 }, h.clock);
    h.clock += 4000;
    Mecanicas.tique(e, h, null, []);
    return 1e6 - e.hp;
  };
  const f = Ficha.combate(personagem());
  const res = Math.min(100, f.protection.chaos ?? 0);
  const comX = Math.min(Ficha.maximoDaResistencia(f.afPoe, 'chaos'), res + 30);
  const sem = dano({});
  const com = dano({ chaos_res_contra_degen: 30 });
  assert.ok(sem > 0);
  assert.ok(Math.abs(com / sem - (1 - comX / 100) / (1 - res / 100)) < 0.02, `${com}/${sem} (res ${res} → ${comX})`);
});

test('o ESCONJURO: o Amaldiçoado depois de 33% da duração; o Cegado com Esconjuro — 10% menos dano causado e 10% mais dano sofrido', { skip: SEM }, () => {
  const af = { amaldicoados_esconjuro_apos_pct: 33 };
  const bicho = { estados: {}, maldicoes: { vulnerabilidade: { desde: 0, dur: 9000, ate: 9000 } } };
  assert.equal(C.esconjurado(bicho, af, 2000), false, '22%: ainda não');
  assert.equal(C.esconjurado(bicho, af, 3000), true, '33%');
  assert.equal(C.esconjurado(bicho, {}, 3000), false, 'sem a linha');
  assert.ok(Math.abs(C.doBicho(bicho, 3000, { ficha: { afPoe: af } }).danoFator - 0.9) < 1e-9);
  assert.ok(Math.abs(C.fatorRecebidoPeloBicho(bicho, 'physical', { afPoe: af, tagsDoGolpe: ['ataque'] }, 3000) - 1.1) < 1e-9);
  const cego = { estados: { cego: { ate: 5000, esconjuro: true } } };
  assert.ok(Math.abs(C.doBicho(cego, 1000, { ficha: { afPoe: {} } }).danoFator - 0.9) < 1e-9, 'o Cegado: 10% menos dano causado (como antes)');
  assert.ok(Math.abs(C.fatorRecebidoPeloBicho(cego, 'physical', { afPoe: {}, tagsDoGolpe: ['ataque'] }, 1000) - 1.1) < 1e-9, 'e 10% mais dano sofrido');
});

test('o EMISSÁRIO DO PROPÓSITO: as suas Auras em você −8% por Arauto, até 40%', { skip: SEM }, () => {
  const total = (af, arautos) => {
    const e = personagem(af);
    e.hunt.buffs = { 'teste-aura': { tipo: 'poe-aura', ate: 99999, afPoe: { teste_aura: 100 } } };
    for (let i = 0; i < arautos; i++) e.hunt.buffs[`teste-arauto-${i}`] = { tipo: 'poe-arauto', ate: 99999, afPoe: { teste_arauto: 1 } };
    return GemasPoe.adds(e).teste_aura;
  };
  const af = { aura_em_voce_menos_por_arauto: 8, aura_em_voce_menos_por_arauto_max: 40 };
  assert.equal(total({}, 2), 100);
  assert.ok(Math.abs(total(af, 0) - 100) < 1e-9);
  assert.ok(Math.abs(total(af, 2) - 84) < 1e-9, '2 Arautos: −16%');
  assert.ok(Math.abs(total(af, 6) - 60) < 1e-9, 'até 40%');
});

test('o DEFINHAR se houver N ou menos: até 5 põe; com 6, não', { skip: SEM }, () => {
  const e = personagem();
  const ficha = fichaCom({ 'ev:acertar:alvo:definhado:2@alvoDefinhadosAte:5': 100 });
  const alvo = { uid: 1, hp: 100, maxHp: 100, x: 1, y: 0, estados: { definhado: { ate: 99999, n: 5 } } };
  ModsPoe.evento(e, e.hunt, 'acertar', ficha, { alvo });
  assert.equal(alvo.estados.definhado.n, 6);
  ModsPoe.evento(e, e.hunt, 'acertar', ficha, { alvo });
  assert.equal(alvo.estados.definhado.n, 6, 'com 6: não põe');
});

test('os CLAMORES por Poder: a Armadura por cada 5 de Poder (até 100%) por 8 s; a carga aleatória com 5% por Poder', { skip: SEM }, () => {
  const e = personagem();
  const raro = (x) => ({ uid: x, hp: 100, maxHp: 100, x, y: 0, raridade: 'raro', estados: {} });
  e.hunt.monstros = [raro(1)];
  ModsPoe.evento(e, e.hunt, 'usarClamor', fichaCom({ 'ev:usarClamor:statTempPorPoder:armour_pct:8:5:100': 25 }), {});
  assert.deepEqual(e.hunt.poeTemporarios.armour_pct, { stat: 'armour_pct', valor: 50, ate: 18000 }, '10 de Poder: 2 × 25%');
  e.hunt.monstros = [raro(1), raro(2), raro(3)];
  ModsPoe.evento(e, e.hunt, 'usarClamor', fichaCom({ 'ev:usarClamor:statTempPorPoder:armour_pct:8:5:100': 25 }), {});
  assert.equal(e.hunt.poeTemporarios.armour_pct.valor, 100, '30 de Poder: até 100%');
  // 20 de Poder × 5% = 100%: uma carga
  e.hunt.monstros = [raro(1), raro(2)];
  ModsPoe.evento(e, e.hunt, 'usarClamor', fichaCom({ 'ev:usarClamor:cargaAleatoriaPorPoder': 5 }), {});
  const cargas = Object.values(e.hunt.cargasPoe ?? {}).reduce((n, c) => n + (c?.n ?? 0), 0);
  assert.equal(cargas, 1);
});

test('a CHAMA SANTIFICADA dos Clamores: o Clamor põe a Chama mesmo sem o "ao atingir corpo a corpo"', { skip: SEM }, () => {
  const e = personagem();
  const alvo = { uid: 1, hp: 100, maxHp: 100, x: 1, y: 0, estados: {} };
  assert.equal(C.porChamaSantificada(e.hunt, alvo, {}, 10000), false);
  assert.equal(C.porChamaSantificada(e.hunt, alvo, {}, 10000, { doClamor: true }), true);
  assert.equal(alvo.estados.chamas.length, 1);
});

test('"se você Gastou Vida Recentemente" e as MÃOS: o acerto de ataque marca a mão da ficha do golpe', { skip: SEM }, () => {
  const e = personagem();
  e.equipment.weapon = { id: 1, count: 1 };
  const alvo = { uid: 1, hp: 1e6, maxHp: 1e6, x: 1, y: 0, estados: {} };
  ModsPoe.aoAcertar(e, e.hunt, alvo, { afPoe: {}, tagsDoGolpe: ['ataque', 'corpo'], mao: 'secundaria' }, { rng: () => 0.99 });
  let c = C.condicoesDe(e);
  assert.ok(c.has('acertouMaoSecundariaRecente') && !c.has('acertouMaoPrincipalRecente'));
  ModsPoe.aoAcertar(e, e.hunt, alvo, { afPoe: {}, tagsDoGolpe: ['ataque', 'corpo'] }, { rng: () => 0.99 });
  assert.ok(C.condicoesDe(e).has('acertouMaoPrincipalRecente'));
  ModsPoe.marcar(e.hunt, 'gastouVida');
  c = C.condicoesDe(e);
  assert.ok(c.has('gastouVidaRecente'));
  e.hunt.clock += 4001;
  c = C.condicoesDe(e);
  assert.ok(!c.has('gastouVidaRecente') && !c.has('acertouMaoPrincipalRecente'));
});

test('o RELATÓRIO: os notáveis sem efeito caem para no máximo 10', { skip: SEM }, async () => {
  const { linhasDasRamificadoras } = await import('../tools/relatorio-arvore-poe.mjs');
  const { grupos } = await linhasDasRamificadoras(Catalogo.catalogo());
  assert.ok(grupos.notavel.sem <= 10, `${grupos.notavel.sem}`);
});
