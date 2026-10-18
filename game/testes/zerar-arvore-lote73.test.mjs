// LOTE 73 — as RAMIFICADORAS, os NOTÁVEIS (a 8ª parte): 10 → 3 sem efeito. "se você sofreu um Acerto Selvagem Recentemente" (o de 15% da
// Vida máxima das Retaliações), a frequência dos Selos do Liberar, as Runas soltas (o inglês do PoE: o alcance AUMENTA por segundo solta) e a
// Runa adicional, o Caos que segue conjurando no atordoamento, o dano dos Projéteis por propagação restante e o Empalamento do acerto que
// também Sangra. Os 3 que faltam (a gema Convocar Runas e a Virulência) vêm nos lotes próprios, pelas decisões do dono.
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
const Runas = await import('../systems/itens-poe/runas-vinculadas.mjs');
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) J.iniciar(ITEM_CATALOG);

const efeitos = (linha) => Object.fromEntries(A.traduzirLinha(linha).efeitos.map((e) => [e.add, e.valor]));
const fichaCom = (af) => ({ afPoe: af, eventosPoe: ModsPoe.eventosDa(af) });
const anel = (af) => ({ id: 3357, count: 1, poe: { classe: 'Rings', base: 'Rings/X', af, prefixos: [], sufixos: [], implicitos: [] } });
/** Uma Bruxa do PoE com `gemas` na varinha (na barra), um anel com `af`, numa caçada do PoE. */
function bruxaCom(gemas, af = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 60 }), { sistema: 'poe', classePoe: 'Witch' });
  const n = gemas.length;
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: n, links: Array.from({ length: Math.max(0, n - 1) }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma, ring: anel(af) };
  e.inventory = gemas.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 1, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  gemas.forEach((s, i) => (e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }));
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  e.maxHp = e.hp = 1e6;
  P.garantir(e);
  return e;
}

test('as linhas', { skip: SEM }, () => {
  assert.deepEqual(efeitos('+30% de Multiplicador de Golpes Críticos caso você tenha sofrido um Acerto Selvagem Recentemente'), { 'crit_dmg@sofreuAcertoSelvagemRecente': 30 });
  assert.deepEqual(efeitos('Habilidades Suportadas por Liberar têm frequência de ganho de Selo aumentada em 30%'), { selo_frequencia_inc: 30 });
  const soltas = A.traduzirLinha('Runas Desvinculadas ganham Alcance do Vínculo de Runas reduzido em 20% por segundo, até 100%');
  assert.deepEqual(Object.fromEntries(soltas.efeitos.map((e) => [e.add, e.valor])), { runa_solta_alcance_por_s: 20, runa_solta_alcance_max: 100 });
  assert.match(soltas.nota, /o alcance AUMENTA/, 'como no PoE (o inglês)');
  assert.deepEqual(efeitos('Habilidades que criam Runas têm 35% de chance de criarem uma Runa adicional'), { runa_adicional_chance: 35 });
  assert.deepEqual(efeitos('Habilidades de Caos ignoram interrupções de Atordoamentos'), { caos_ignora_interrupcao: 1 });
  assert.deepEqual(efeitos('Projéteis causam dano com ataques e afecções aumentado em 20% por\ncada propagação restante, até 100%'), { proj_inc_por_ricochete_restante: 20, proj_inc_por_ricochete_restante_max: 100 });
  assert.deepEqual(efeitos('Efeito dos Empalamentos inflingidos por Acertos que também infligem Sangramento aumentado em 15%'), { efeito_empalamento_com_sangramento: 15 });
});

test('o ACERTO SELVAGEM: o acerto de ao menos 15% da Vida máxima marca "sofreu um Acerto Selvagem Recentemente" (4 s)', { skip: SEM }, () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: 'Scion' });
  e.maxHp = e.hp = 1000;
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  const bicho = { uid: 1, hp: 100, maxHp: 100, x: 1, y: 0, estados: {} };
  ModsPoe.aoSerAcertado(e, e.hunt, bicho, fichaCom({}), { dano: 140 });
  assert.ok(!C.condicoesDe(e).has('sofreuAcertoSelvagemRecente'), '14%: não');
  ModsPoe.aoSerAcertado(e, e.hunt, bicho, fichaCom({}), { dano: 150 });
  assert.ok(C.condicoesDe(e).has('sofreuAcertoSelvagemRecente'), '15%');
  e.hunt.clock += 4001;
  assert.ok(!C.condicoesDe(e).has('sofreuAcertoSelvagemRecente'));
});

test('os SELOS do Liberar com a frequência aumentada: o intervalo ÷ (1 + X%)', { skip: SEM }, () => {
  const efeito = { seloIntervaloMs: 1000, selosMax: 10 };
  const h = {};
  Acoes.selosAgora(h, 'a', efeito, 0, 0);
  assert.equal(Acoes.selosAgora(h, 'a', efeito, 0, 3000), 3);
  Acoes.selosAgora(h, 'b', efeito, 0, 0, 50);
  assert.equal(Acoes.selosAgora(h, 'b', efeito, 0, 3000, 50), 4, '+50%: um a cada 667 ms');
  // o múltiplo exato não perde um Selo (2000 ÷ (800 ÷ 1,2) = 3)
  Acoes.selosAgora(h, 'c', { seloIntervaloMs: 800, selosMax: 10 }, 0, 0, 20);
  assert.equal(Acoes.selosAgora(h, 'c', { seloIntervaloMs: 800, selosMax: 10 }, 0, 2000, 20), 3);
});

test('as RUNAS SOLTAS: o alcance de vínculo aumenta 20% por segundo solta, até 100%', { skip: SEM }, () => {
  const ficha = { afPoe: { runa_solta_alcance_por_s: 20, runa_solta_alcance_max: 100 } };
  const r = { x: 0, y: 0, alvo: null, desde: 0, soltaDesde: 0 };
  assert.equal(Runas.alcanceDaSolta(ficha, r, 2500), 50);
  assert.equal(Runas.alcanceDaSolta(ficha, r, 9000), 100, 'até 100%');
  assert.equal(Runas.alcanceDaSolta(ficha, { ...r, alvo: 7 }, 9000), 0, 'vinculada: nada');
  assert.equal(Runas.alcanceDaSolta({ afPoe: {} }, r, 9000), 0);
  // o bicho a 5 casas (o alcance base é 3): na hora, não; 5 s solta (+100%: 6 casas), vincula
  const hunt = { monstros: [{ uid: 9, hp: 10, maxHp: 10, x: 5, y: 0 }], runas: [r] };
  assert.equal(Runas.vincular(hunt, ficha, r, 0), null);
  assert.equal(Runas.vincular(hunt, ficha, r, 5000)?.uid, 9);
});

test('a RUNA ADICIONAL: com a chance, a Runa da gema sai em dobro', { skip: SEM }, () => {
  const conjurar = (af) => {
    const e = bruxaCom(['Storm_Brand'], af);
    const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Storm_Brand').acao);
    const [b, c] = e.hunt.monstros;
    Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e9, maxHp: 1e9 });
    if (c) Object.assign(c, { x: e.hunt.pos.x + 2, y: e.hunt.pos.y, hp: 1e9, maxHp: 1e9 });
    Acoes.conjurarRuna(e, e.hunt, PERSONAGEM, 0, entry, entry, { x: b.x, y: b.y }, b, { nivel: 1 }, e.hunt.clock);
    return Runas.ativas(e.hunt).length;
  };
  assert.equal(conjurar({}), 1);
  assert.equal(conjurar({ runa_adicional_chance: 100 }), 2);
});

test('o MAL INABALÁVEL: atordoado, a conjuração de Caos segue; a de Fogo, ou congelado, não', { skip: SEM }, () => {
  const e = bruxaCom(['Essence_Drain'], { caos_ignora_interrupcao: 1 });
  const h = e.hunt;
  const caos = G.doSlug('Essence_Drain').acao;
  const fogo = G.doSlug('Fireball').acao;
  h.controle = { atordoado: { ate: h.clock + 1000 } };
  h.conjurando = { id: caos };
  assert.equal(Acoes.conjuracaoSegueNoAtordoamento(e, h), true);
  h.conjurando = { id: fogo };
  assert.equal(Acoes.conjuracaoSegueNoAtordoamento(e, h), false, 'não é de Caos');
  h.conjurando = { id: caos };
  h.controle = { atordoado: { ate: h.clock + 1000 }, congelado: { ate: h.clock + 1000 } };
  assert.equal(Acoes.conjuracaoSegueNoAtordoamento(e, h), false, 'congelado');
  const sem = bruxaCom(['Essence_Drain']);
  sem.hunt.controle = { atordoado: { ate: sem.hunt.clock + 1000 } };
  sem.hunt.conjurando = { id: caos };
  assert.equal(Acoes.conjuracaoSegueNoAtordoamento(sem, sem.hunt), false, 'sem a linha');
});

test('o MAL INABALÁVEL de ponta a ponta: a conjuração de Caos começada antes do atordoamento SAI no fim; sem a linha, se perde', { skip: SEM }, () => {
  const fim = (af) => {
    const e = bruxaCom(['Essence_Drain'], af);
    const h = e.hunt;
    const [b] = h.monstros;
    Object.assign(b, { x: h.pos.x + 2, y: h.pos.y, hp: 1e9, maxHp: 1e9 });
    const r = Acoes.disparar(e, h, PERSONAGEM, 0, b, { manual: true });
    assert.ok(r.ok && r.conjurando, JSON.stringify(r).slice(0, 200));
    // atordoado no meio da conjuração, até depois do fim dela
    h.controle = { atordoado: { ate: h.conjurando.fim + 2000 } };
    if (!Acoes.conjuracaoSegueNoAtordoamento(e, h)) h.conjurando = null; // (o que o tique faz — `cacadas.tique`)
    h.clock = (h.conjurando?.fim ?? h.clock) + 1;
    return Acoes.concluirConjuracao(e, h, PERSONAGEM).map((x) => x.t);
  };
  assert.ok(fim({ caos_ignora_interrupcao: 1 }).includes('castFim'), 'a magia sai');
  assert.ok(!fim({}).includes('castFim'), 'sem a linha: se perde');
});

test('as PROPAGAÇÕES RESTANTES: cada salto do projétil leva quantas ainda faltam', { skip: SEM }, () => {
  const bichos = [1, 2, 3].map((i) => ({ uid: i, hp: 100, maxHp: 100, x: i * 2, y: 0 }));
  const { golpes } = Secundarios.resolver({ efeito: { encadear: 2 }, tags: ['projectile', 'single', 'hit'], origem: { x: 0, y: 0 }, alvo: bichos[0], atingidos: [bichos[0]], vivos: bichos, alcance: 8 });
  const saltos = golpes.filter((g) => g.tipo !== 'explosao').map((g) => g.restantes);
  assert.deepEqual(saltos, [1, 0], 'o 2º atingido: falta 1; o 3º: nenhuma (o 1º, o direto, tem as 2)');
  // a VOLTA (Retornar) de quem não teve para onde saltar: as 2 ainda restam
  const so = [{ uid: 9, hp: 100, maxHp: 100, x: 2, y: 0 }];
  const volta = Secundarios.resolver({ efeito: { encadear: 2, retornar: 1 }, tags: ['projectile', 'single', 'hit'], origem: { x: 0, y: 0 }, alvo: so[0], atingidos: [so[0]], vivos: so, alcance: 8 }).golpes.filter((g) => g.tipo === 'retorno');
  assert.deepEqual(volta.map((g) => g.restantes), [2]);
});

test('o EMPALAMENTO do acerto que também Sangra: +X% de efeito; sem Sangrar, o de sempre', { skip: SEM }, () => {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: 'Scion' });
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  const ficha = fichaCom({ chance_empalar: 100, efeito_empalamento: 20, efeito_empalamento_com_sangramento: 15 });
  // (quem chama confere o Sangramento de TODAS as fontes do acerto — as afecções do PoE e a gema de suporte: `acoes`, `hunt/combate`)
  const valorDoEmpalamento = (sangrou) => {
    const alvo = { uid: 1, hp: 1e9, maxHp: 1e9, x: 1, y: 0, estados: {} };
    ModsPoe.aoAcertar(e, e.hunt, alvo, { ...ficha, tagsDoGolpe: ['ataque', 'corpo'] }, { dano: 1000, fisico: 1000, rng: () => 0 });
    ModsPoe.empalamentoComSangramento(alvo, ficha, sangrou);
    assert.equal(alvo.estados.empalamentoDoAcerto, undefined, 'a marca do acerto sai');
    return alvo.estados.empalado[0].valor;
  };
  const semSangue = valorDoEmpalamento(false);
  const comSangue = valorDoEmpalamento(true);
  assert.ok(Math.abs(semSangue - 1000 * 0.1 * 1.2) < 1e-6, `${semSangue}`);
  assert.ok(Math.abs(comSangue - 1000 * 0.1 * 1.35) < 1e-6, `${comSangue}: o 15% soma aos 20%`);
});

test('o RELATÓRIO: os notáveis sem efeito caem para no máximo 3', { skip: SEM }, async () => {
  const { linhasDasRamificadoras } = await import('../tools/relatorio-arvore-poe.mjs');
  const { grupos } = await linhasDasRamificadoras(Catalogo.catalogo());
  assert.ok(grupos.notavel.sem <= 3, `${grupos.notavel.sem}`);
});
