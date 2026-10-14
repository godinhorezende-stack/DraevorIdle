// OS PARCIAIS EXATOS da árvore do PoE (dono, 13/10: "siga na 1 depois as outras" — o item 2 do relatório): as linhas que tinham efeito com
// diferença do PoE e que ficam iguais com o que o jogo já tem — as afecções que os Clamores, o Frasco de Vida e o Estandarte tiram, a maldição
// que Cega só quem não estava amaldiçoado, a Garra na mão secundária, os prazos "nos últimos N segundos", os frascos certos, o Inspirador nos
// aliados, os totens do Ritual do Despertar, a Sobrecarga Elemental, o Avatar do Fogo e a Postura Inabalável.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const Aliados = await import('../systems/itens-poe/aliados.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const Dot = await import('../systems/combate/dot.mjs');
const Keystones = await import('../systems/passivas/keystones.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
/** Um personagem do PoE numa caçada, com `af` na varinha e `equipamento` vestido. */
function personagem(af = {}, equipamento = {}) {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 80 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = peca('Wands/Driftwood_Wand');
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma, ...equipamento };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.hunt.efeitosDoJogador ??= { dots: [] };
  P.garantir(e);
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
/** As linhas da árvore com o texto que casa `re`. */
const linhas = (re) => P.arvore().nos.flatMap((n) => [n, ...(n.opcoes ?? [])].flatMap((o) => (o.textos ?? []).map((t, i) => ({ t, estado: o.estados?.[i], nota: o.notas?.[i] ?? null, efeitos: o.efeitos, no: n })))).filter((l) => re.test(l.t));
/** A linha existe, ficou exata (sem nota) e dá `stat`. */
function exata(re, stat) {
  const ls = linhas(re);
  assert.ok(ls.length > 0, `há linha ${re}`);
  for (const l of ls) {
    assert.ok(['equivalente', 'novo'].includes(l.estado), `${l.t}: ${l.estado} (${l.nota})`);
    assert.equal(l.nota, null, l.t);
    if (stat) assert.ok(l.efeitos.some((x) => x.add === stat), `${l.t}: ${JSON.stringify(l.efeitos)}`);
  }
}
/** Põe um dano contínuo de `tipo` em você. */
const dot = (e, tipo) => Dot.aplicar(e.hunt.efeitosDoJogador, { tipo, total: 500 }, e.hunt.clock);
const tem = (e, tipo) => (e.hunt.efeitosDoJogador.dots ?? []).some((d) => d.tipo === tipo && d.falta > 0);
/** Aloca a keystone pelo nome em inglês (o caminho até ela junto). */
function alocarKeystone(e, nomeEn) {
  const no = P.arvore().nos.find((n) => n.tipo === 'keystone' && n.nomeEn === nomeEn);
  assert.ok(no, nomeEn);
  const caminho = P.caminhoAte(e, no.id);
  if (caminho.length > 1) assert.equal(Comandos.comando(e, { action: 'alocar', ids: caminho.slice(0, -1) }).feitos, caminho.length - 1);
  assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id }).ok);
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
}

test('as AFECÇÕES que saem: o Clamor tira TODAS as de dano; o Frasco de Vida, uma não elemental ao acaso; o Estandarte, qualquer uma ao acaso', { skip: SEM }, () => {
  exata(/^Remove todas as Afecções Danificadoras quando você Clamar$/, 'ev:usarClamor:removerAfeccao:danificadoras');
  exata(/^Remove uma Afecção não Elemental aleatória quando você usar um Frasco de Vida$/, 'ev:usarFrascoVida:removerAfeccao:naoElemental');
  exata(/^Remove uma Afecção aleatória de você quando você consumir/, 'estandarte_remove_afeccao_min');
  // (o Clamor: Incêndio, Sangramento e Veneno saem; o Congelamento, não — não é de dano)
  const c = personagem({ 'ev:usarClamor:removerAfeccao:danificadoras': 100 });
  for (const t of ['queimadura', 'sangramento', 'venenoPoe']) dot(c, t);
  c.hunt.controle = { congelado: { ate: c.hunt.clock + 5000 } };
  ModsPoe.evento(c, c.hunt, 'usarClamor', ficha(c));
  assert.ok(!tem(c, 'queimadura') && !tem(c, 'sangramento') && !tem(c, 'venenoPoe'), 'as três de dano saíram');
  assert.ok(c.hunt.controle.congelado, 'o Congelamento fica');
  // (o Frasco de Vida: só uma, e nunca o Incêndio; o de Mana não tira nada)
  const f = personagem({ 'ev:usarFrascoVida:removerAfeccao:naoElemental': 100 });
  for (const t of ['queimadura', 'sangramento', 'venenoPoe']) dot(f, t);
  ModsPoe.eventosDoFrasco(f, 'Mana_Flasks', ficha(f), { rng: () => 0 });
  assert.ok(tem(f, 'sangramento') && tem(f, 'venenoPoe'), 'o de Mana não tira');
  ModsPoe.eventosDoFrasco(f, 'Life_Flasks', ficha(f), { rng: () => 0 });
  assert.equal([tem(f, 'sangramento'), tem(f, 'venenoPoe')].filter(Boolean).length, 1, 'saiu uma não elemental');
  assert.ok(tem(f, 'queimadura'), 'o Incêndio (elemental) fica');
  // (o Estandarte: qualquer uma — só o Congelamento em você, ele sai)
  const s = personagem({ estandarte_remove_afeccao_min: 10 });
  s.hunt.controle = { congelado: { ate: s.hunt.clock + 5000 } };
  s.hunt.valor = { n: 20, ultimo: 0 };
  ModsPoe.plantarEstandarte(s, s.hunt, ficha(s), {}, s.hunt.clock, () => 0);
  assert.equal(s.hunt.controle.congelado, undefined, 'a elemental também sai');
});

test('a MALDIÇÃO que não é aura Cega só o inimigo que não estava amaldiçoado (a Blasfêmia, não)', { skip: SEM }, () => {
  exata(/^Inimigos Não Amaldiçoados que você inflija Maldições não Auras/, 'ev:amaldicoarSemMaldicaoNaoAura:alvo:cego:4');
  const e = personagem({ 'ev:amaldicoarSemMaldicaoNaoAura:alvo:cego:4': 100 });
  const h = e.hunt;
  const id = G.doSlug('Vulnerability').acao;
  const efeitosPoe = [{ efeito: 'marcaVulneravel', pct: 10, tipos: ['physical'], durMarca: 6000 }];
  const bicho = { hp: 100, maxHp: 100, x: 1, y: 1, estados: {} };
  h.buffs = { [id]: { ate: h.clock + 60_000, desde: h.clock, tipo: 'poe-maldicao', fator: 1, efeitosPoe } };
  const primeira = Reforcos.marcar(h, bicho, h.clock);
  assert.deepEqual(primeira, { amaldicoouSemMaldicao: true, semMaldicaoNaoAura: true });
  assert.deepEqual(Reforcos.marcar(h, bicho, h.clock + 100), { amaldicoouSemMaldicao: false, semMaldicaoNaoAura: false }, 'já amaldiçoado');
  // (a mesma maldição como aura — a Blasfêmia reserva —: amaldiçoa, mas não é "não Aura")
  const outro = { hp: 100, maxHp: 100, x: 2, y: 1, estados: {} };
  h.buffs[id].reserva = { recurso: 'mana', pct: 35, fator: 1 };
  assert.deepEqual(Reforcos.marcar(h, outro, h.clock), { amaldicoouSemMaldicao: true, semMaldicaoNaoAura: false });
  // (o evento Cega o alvo por 4 s)
  ModsPoe.evento(e, h, 'amaldicoarSemMaldicaoNaoAura', ficha(e), { alvo: bicho });
  assert.ok(bicho.estados.cego?.ate >= h.clock + 4000, JSON.stringify(bicho.estados));
});

test('a GARRA na mão secundária; os prazos "nos últimos N segundos" (não o "recentemente" de 4 s); o efeito de um Frasco de MANA correndo', { skip: SEM }, () => {
  exata(/Garras na Mão Secundária$/, 'mana_on_hit@garraNaSecundaria+ataque+maoSecundaria');
  exata(/se você usou um Frasco de Mana nos últimos 10 segundos$/, 'mana_on_hit@ataque+nosUltimos:10:ev:usarFrascoMana');
  exata(/se a Recarga do Escudo de Energia iniciou nos últimos 2 segundos$/, 'evasion_pct@nosUltimos:2:recargaEs');
  exata(/se você usou um Frasco de Vida nos últimos 10 segundos$/, 'life_regen_max_pct@nosUltimos:10:usouFrascoVida');
  exata(/durante o Efeito de qualquer Frasco de Mana$/, 'recuperacao_mana_inc@duranteFrascoMana');
  const garra = peca('Claws/Nailed_Fist');
  const comGarra = personagem({}, { weapon: peca('Claws/Nailed_Fist'), shield: garra });
  assert.ok(ModsPoe.condicoesDe(comGarra, Afixos.soma(comGarra)).has('garraNaSecundaria'));
  const soNaPrincipal = personagem({}, { weapon: peca('Claws/Nailed_Fist') });
  assert.ok(!ModsPoe.condicoesDe(soNaPrincipal, Afixos.soma(soNaPrincipal)).has('garraNaSecundaria'), 'a Garra só na principal não conta');
  const e = personagem();
  const conds = () => ModsPoe.condicoesDe(e, Afixos.soma(e));
  e.hunt.poeRecente = { usouFrascoVida: e.hunt.clock - 9000, recargaEs: e.hunt.clock - 2500, 'ev:usarFrascoMana': e.hunt.clock - 10_000 };
  assert.ok(ModsPoe.vale(conds(), 'nosUltimos:10:usouFrascoVida'), 'há 9 s: nos últimos 10 s');
  assert.ok(!ModsPoe.vale(conds(), 'nosUltimos:2:recargaEs'), 'há 2,5 s: não nos últimos 2 s');
  assert.ok(ModsPoe.vale(conds(), 'nosUltimos:10:ev:usarFrascoMana'), 'há 10 s, no limite');
  e.hunt.clock += 1;
  assert.ok(!ModsPoe.vale(conds(), 'nosUltimos:10:ev:usarFrascoMana'), 'passou dos 10 s');
  e.hunt.frascosPoe = { ativos: { 1: { ate: e.hunt.clock + 1000, recurso: 'vida' } } };
  assert.ok(conds().has('duranteFrasco') && !conds().has('duranteFrascoMana'), 'o de Vida não é o de Mana');
  e.hunt.frascosPoe.ativos[2] = { ate: e.hunt.clock + 1000, recurso: 'mana' };
  assert.ok(conds().has('duranteFrascoMana'));
});

test('os FRASCOS certos: as cargas só nos de Vida (e no máximo uma vez por segundo ao acertar); o Efeito só nos Utilitários Mágicos', { skip: SEM }, () => {
  exata(/^Frascos de Vida ganham \d+ quando você Suprimir Dano Mágico$/, 'ev:suprimir:frasco:vida');
  exata(/^Frascos de Vida ganham uma Carga quando você acertar um Inimigo, não mais que uma vez por segundo$/, 'ev:acertar:frasco:vida:1');
  exata(/^Frascos Utilitários Mágicos aplicados em você têm Efeito aumentado em/, 'frasco_efeito_magico');
  const e = personagem({ 'ev:suprimir:frasco:vida': 3, 'ev:acertar:frasco:vida:1': 1 });
  const vida = peca('Life_Flasks/Divine_Life_Flask');
  const mana = peca('Mana_Flasks/Divine_Mana_Flask');
  vida.poe.cargas = 0;
  mana.poe.cargas = 0;
  e.frascos = [vida, mana];
  const f = ficha(e);
  ModsPoe.evento(e, e.hunt, 'suprimir', f);
  assert.equal(vida.poe.cargas, 3);
  assert.equal(mana.poe.cargas, 0, 'o de Mana não ganha');
  ModsPoe.evento(e, e.hunt, 'acertar', f);
  ModsPoe.evento(e, e.hunt, 'acertar', f, { agora: e.hunt.clock + 500 });
  assert.equal(vida.poe.cargas, 4, 'uma por segundo');
  ModsPoe.evento(e, e.hunt, 'acertar', f, { agora: e.hunt.clock + 1000 });
  assert.equal(vida.poe.cargas, 5);
  const normal = peca('Utility_Flasks/Diamond_Flask');
  const magico = structuredClone(normal);
  magico.poe.raridade = 'magico';
  const af = { frasco_efeito_magico: 30 };
  assert.equal(Frascos.parametros(magico, af).efeitoPct - Frascos.parametros(magico, {}).efeitoPct, 30);
  assert.equal(Frascos.parametros(normal, af).efeitoPct, Frascos.parametros(normal, {}).efeitoPct, 'o Normal não');
});

test('o INSPIRADOR nos aliados na área do seu Estandarte; o RITUAL DO DESPERTAR nos totens (X% por totem)', { skip: SEM }, () => {
  exata(/Aliados próximos dos seus Estandartes Regeneram/, 'aliados_estandarte:life_regen_max_pct%valorDoEstandarte');
  exata(/^Você e seus Totens Regeneram/, 'totem_regen_pct_por_totem');
  const dono = personagem();
  const amigo = personagem();
  const h = dono.hunt;
  h.buffs = { estandarte: { ate: h.clock + 10_000, raio: 2, estandarte: { x: 10, y: 10, z: h.z ?? 0, valor: 30 } } };
  Aliados.fotografar(dono, { 'aliados_estandarte:life_regen_max_pct': 3 });
  amigo.hunt.z = h.z ?? 0;
  amigo.hunt.partilha = { naSala: [dono, amigo] };
  dono.hunt.pos = { x: 30, y: 30 };
  amigo.hunt.pos = { x: 11, y: 10 };
  assert.equal(Aliados.aplicar(amigo, {}).life_regen_max_pct, 3, 'na área do Estandarte (o dono longe)');
  amigo.hunt.pos = { x: 13, y: 10 };
  assert.equal(Aliados.aplicar(amigo, {}).life_regen_max_pct, undefined, 'fora da área');
  // (os totens: 1% por totem vivo — dois totens, 2% cada)
  const lacaios = [{ nome: 'Totem', hp: 10, maxHp: 100 }, { nome: 'Totem de Fogo', hp: 10, maxHp: 100 }, { nome: 'Zumbi', hp: 10, maxHp: 100 }, { nome: 'Totem', hp: 0, maxHp: 100 }];
  assert.equal(LacaiosPoe.regenPctDosTotens({ totem_regen_pct_por_totem: 1 }, lacaios), 2);
  assert.ok(LacaiosPoe.ehTotem(lacaios[1]) && !LacaiosPoe.ehTotem(lacaios[2]));
});

test('a SOBRECARGA ELEMENTAL: 40% MAIS dano elemental só na habilidade que causou um crítico nos últimos 8 s (antes, +40% aumentado sempre)', { skip: SEM }, () => {
  for (const re of [/^Habilidades que causaram um Golpe Crítico nos últimos 8 segundos/, /^Seus Golpes Críticos não causam Dano extra$/, /^Afecções nunca contam como sendo de um Golpe Crítico$/]) exata(re);
  const e = personagem();
  alocarKeystone(e, 'Elemental Overload');
  const f = ficha(e);
  assert.ok(f.sobrecargaElemental);
  assert.equal(f.critMultiplier, 1, 'o crítico sem dano extra');
  const soAKeystone = Keystones.aplicarNaFicha({ critMultiplier: 1.5, danoDoElemento: { fire: 10, ice: 0 } }, [{ regra: 'poe', id: 'sobrecargaElemental' }], {});
  assert.deepEqual(soAKeystone.danoDoElemento, { fire: 10, ice: 0 }, 'sem o +40% aumentado sempre ligado');
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Fireball').acao);
  const sem = Acoes.danoMostrado(e, entry);
  ModsPoe.marcarCriticoDaHabilidade(e.hunt, entry.id, e.hunt.clock);
  const com = Acoes.danoMostrado(e, entry);
  assert.ok(Math.abs(com.max / sem.max - 1.4) < 0.02, `${sem.max} → ${com.max}`);
  e.hunt.clock += 8001;
  assert.equal(Acoes.danoMostrado(e, entry).max, sem.max, 'passados 8 s, acabou');
  // (a conta: só Fogo, Gelo e Raio; só a habilidade que critou)
  e.hunt.clock -= 8001;
  assert.equal(ModsPoe.fatorDaSobrecarga(f, e.hunt, entry.id, 'physical'), 1);
  assert.equal(ModsPoe.fatorDaSobrecarga(f, e.hunt, 'outra', 'fire'), 1);
  assert.equal(ModsPoe.fatorDaSobrecarga({}, e.hunt, entry.id, 'fire'), 1, 'sem a keystone, nada');
});

test('o AVATAR DO FOGO: Físico, Gelo e Raio 50% viram Fogo e só o Fogo causa dano; a POSTURA INABALÁVEL: imune só a Atordoamento', { skip: SEM }, () => {
  exata(/de Dano Físico, Gelo e Raio Convertidos para Dano de Fogo$/);
  exata(/^Não causa Dano que não seja de Fogo$/);
  exata(/^Não pode ser Atordoado$/);
  const avatar = P.arvore().nos.find((n) => n.tipo === 'keystone' && n.nomeEn === 'Avatar of Fire');
  const af = Object.fromEntries(avatar.efeitos.map((x) => [x.add, x.valor]));
  assert.deepEqual(af, { phys_conv_fire: 50, conv_ice_fire: 50, conv_energy_fire: 50, 'so_dano:fire': 1 });
  const fichaDoAvatar = { afPoe: af };
  const doFisico = ModsPoe.extrasDoFisico(fichaDoAvatar, [100, 100]);
  assert.deepEqual(doFisico.extras.fire, [50, 50]);
  assert.equal(doFisico.convertidoPct, 50);
  const partes = ModsPoe.transformarPartes(fichaDoAvatar, { physical: [50, 50], ice: [100, 100], energy: [100, 100], fire: [50, 50], chaos: [20, 20] });
  assert.deepEqual(partes, { fire: [150, 150] }, 'metade do Gelo e do Raio vira Fogo; o resto (e o Caos) não causa dano');
  const e = personagem();
  const base = ficha(e).resistenciaAControle ?? 0;
  alocarKeystone(e, 'Unwavering Stance');
  const f = ficha(e);
  assert.equal(f.evasion, 0, 'não evade');
  assert.equal(f.resistenciaAControle ?? 0, base, 'sem o teto da resistência a todo controle');
  assert.equal(ModsPoe.controleNoJogador(f, 'atordoado').evitou, true, 'imune a Atordoamento');
  assert.equal(ModsPoe.controleNoJogador(f, 'congelado', () => 0.99).evitou, false, 'o Congelamento pega');
});
