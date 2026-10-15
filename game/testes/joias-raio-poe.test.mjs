// OS RAIOS DAS JOIAS ÚNICAS (dono, 15/10: "faça as pendências e os efeitos que não funcionam"; o raio "Como no PoE/PoB": 960/1440/1800 nas
// unidades da árvore): os nós do raio de cada joia única num encaixe alocado mudam como no PoE — os atributos transformados (a Inércia), os
// aumentos convertidos (a Armadura Energizada, a Mente Saudável, a Queda de Lioneye), "por cada N de Força nas Passivas (não)
// Alocadas" (as Temperadas e as Transcendentais), a Poder do Pacífico, o Instindo Sobrenatural, a Luz do Significado, os Sonhos e os
// Pesadelos, os Pactos; o Salto Intuitivo deixa alocar sem ligação; e o "Limitado a: N".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');

J.iniciar(ITEM_CATALOG);
const ENCAIXE = '6230'; // o Básico do centro
const unicos = () => Catalogo.catalogo().classes.Jewels.unicos;
/** A joia única `slug` (na base dela), com as linhas no menor valor. */
function unica(slug) {
  const u = unicos().find((x) => x.slug === slug);
  const base = Catalogo.catalogo().classes.Jewels.bases.find((b) => b.nome === u.base);
  return J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 80, rng: () => 0, unico: slug }));
}
function personagem(alocados = [], encaixe = ENCAIXE) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  e.passivas.alocados.push(encaixe, ...alocados);
  P.garantir(e);
  e.inventory = [];
  return e;
}
const encaixarEm = (e, peca, no = ENCAIXE) => {
  e.inventory.push(peca);
  return Comandos.comando(e, { action: 'encaixarJoia', no, pilha: e.inventory.length - 1, id: peca.id });
};
const encaixar = (e, peca, no = ENCAIXE) => encaixarEm(e, peca, no);
const s = () => P.arvore().porId.get(ENCAIXE);
const dist = (n, x = s()) => Math.hypot(n.x - x.x, n.y - x.y);
const ehPassiva = (n) => !n.ascendencia && ['small', 'notable', 'keystone'].includes(n.tipo) && !/Jewel Socket|Proxy/i.test(`${n.nomeEn ?? ''} ${n.nome ?? ''}`);
/** Um nó do raio `r` do encaixe `x` que passa no filtro. */
const noRaio = (filtro, r = P.RAIOS_DE_JOIA.grande, x = s()) => P.arvore().nos.find((n) => ehPassiva(n) && dist(n, x) <= r && filtro(n));
/** O primeiro ENCAIXE com nós de todos os filtros no raio `r`: `{ encaixe, nos }`. */
function acharEncaixe(filtros, r = P.RAIOS_DE_JOIA.grande) {
  for (const x of P.arvore().nos.filter((n) => P.ehEncaixeDeJoia(n))) {
    const nos = filtros.map((f) => noRaio(f, r, x));
    if (nos.every(Boolean) && new Set(nos.map((n) => n.id)).size === nos.length) return { encaixe: x.id, nos };
  }
  return null;
}
const so = (add) => (n) => n.efeitos?.length === 1 && n.efeitos[0].add === add;
const adds = (e) => ({ ...P.efeitos(e).adds });
// (na árvore, a Vida% e a Mana% são de especialização: `stats.life`, `stats.mana`)
const stats = (e) => ({ ...P.efeitos(e).stats });
const vidaPct = (n) => n.efeitos?.length === 1 && n.efeitos[0].stat === 'life';
const delta = (antes, depois, k) => Math.round(((depois[k] ?? 0) - (antes[k] ?? 0)) * 100) / 100;

test('os DADOS: o raio de cada única pelo nome (960/1440/1800, como no PoE/PoB), o anel do Fio de Esperança e o "Limitado a"', { skip: SEM }, () => {
  assert.deepEqual([P.RAIOS_DE_JOIA.pequeno, P.RAIOS_DE_JOIA.medio, P.RAIOS_DE_JOIA.grande], [960, 1440, 1800]);
  assert.deepEqual(P.raioDaJoia(unica('Inertia')), { min: 0, max: 1800 });
  assert.deepEqual(P.raioDaJoia(unica('Intuitive_Leap')), { min: 0, max: 960 });
  assert.deepEqual(P.raioDaJoia(unica('Tempered_Flesh')), { min: 0, max: 1440 });
  assert.deepEqual(P.raioDaJoia({ poe: { af: { raio_anel: 1 } } }), { min: 960, max: 1320 });
  assert.deepEqual(P.raioDaJoia({ poe: { af: { raio_anel: 5 } } }), { min: 2400, max: 2880 });
  assert.equal(P.dadosDaJoiaUnica(unica('The_Light_of_Meaning')).limite, 1);
  assert.equal(P.raioDaJoia(gerarPecaRara()), null, 'a joia não única não tem raio próprio');
});
function gerarPecaRara() {
  return J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Jewels/Crimson_Jewel', raridade: 'raro', ilvl: 80, rng: () => 0.5 }));
}

test('a INÉRCIA (Destreza → Força), a ARMADURA ENERGIZADA (ES → Armadura × 2) e a MENTE SAUDÁVEL (Vida% → Mana% × 2) nos nós alocados do raio', { skip: SEM }, () => {
  const inercia = acharEncaixe([so('dex')]);
  const e = personagem([inercia.nos[0].id], inercia.encaixe);
  const sem = adds(e);
  assert.ok(encaixarEm(e, unica('Inertia'), inercia.encaixe).ok);
  assert.equal(delta(sem, adds(e), 'dex'), -inercia.nos[0].efeitos[0].valor);
  assert.equal(delta(sem, adds(e), 'str'), inercia.nos[0].efeitos[0].valor);
  const armadura = acharEncaixe([so('es_pct')]);
  const e2 = personagem([armadura.nos[0].id], armadura.encaixe);
  const sem2 = adds(e2);
  assert.ok(encaixarEm(e2, unica('Energised_Armour'), armadura.encaixe).ok);
  assert.equal(delta(sem2, adds(e2), 'es_pct'), -armadura.nos[0].efeitos[0].valor);
  assert.equal(delta(sem2, adds(e2), 'armour_pct'), armadura.nos[0].efeitos[0].valor * 2);
  const mente = acharEncaixe([vidaPct]);
  const e3 = personagem([mente.nos[0].id], mente.encaixe);
  const sem3 = stats(e3);
  assert.ok(encaixarEm(e3, unica('Healthy_Mind'), mente.encaixe).ok);
  assert.equal(delta(sem3, stats(e3), 'life'), -mente.nos[0].efeitos[0].pct);
  assert.equal(delta(sem3, stats(e3), 'mana'), mente.nos[0].efeitos[0].pct * 2);
  // (a Energia Interior: a Vida% vira Escudo de Energia%)
  const e4 = personagem([mente.nos[0].id], mente.encaixe);
  const sem4 = adds(e4);
  assert.ok(encaixarEm(e4, unica('Energy_From_Within'), mente.encaixe).ok);
  assert.equal(delta(sem4, adds(e4), 'es_pct'), mente.nos[0].efeitos[0].pct);
});

test('a QUEDA DO OLHO DE LEÃO: o corpo a corpo dos nós do raio vira "com Arco"', { skip: SEM }, () => {
  const achou = acharEncaixe([(n) => (n.efeitos ?? []).some((ef) => /@(?:.*\+)?(armaCorpo|corpo)(\+|$)/.test(ef.add ?? ''))], P.RAIOS_DE_JOIA.medio);
  assert.ok(achou);
  const [no] = achou.nos;
  const e = personagem([no.id], achou.encaixe);
  const sem = adds(e);
  assert.ok(encaixarEm(e, unica('Lioneyes_Fall'), achou.encaixe).ok);
  const com = adds(e);
  const doNo = no.efeitos.find((ef) => /@(?:.*\+)?(armaCorpo|corpo)(\+|$)/.test(ef.add));
  assert.equal(delta(sem, com, doNo.add), -doNo.valor);
  assert.ok(Object.keys(com).some((k) => k.startsWith(doNo.add.split('@')[0]) && /comArco/.test(k)), JSON.stringify(Object.keys(com).filter((k) => /comArco/.test(k))));
});

test('as TEMPERADAS e as TRANSCENDENTES: "por cada N de Força nas Passivas Alocadas / Não Alocadas no Raio"', { skip: SEM }, () => {
  const fortes = P.arvore().nos.filter((n) => ehPassiva(n) && dist(n) <= P.RAIOS_DE_JOIA.medio && so('str')(n));
  assert.ok(fortes.length >= 2);
  const e = personagem([fortes[0].id]);
  const sem = adds(e);
  const temperada = unica('Tempered_Flesh');
  assert.ok(encaixar(e, temperada).ok);
  const com = adds(e);
  const forcaAlocada = fortes[0].efeitos[0].valor;
  assert.equal(delta(sem, com, 'str'), -forcaAlocada, '−1 de Força por 1 de Força alocada');
  const porDez = Number(temperada.poe.af.raio_vida_rec_por_str_alocada);
  assert.equal(delta(sem, com, 'recuperacao_vida_inc'), porDez * Math.floor(forcaAlocada / 10));
  // (a Transcendente: o Multiplicador por cada 10 de Força NÃO alocada no raio)
  const e2 = personagem([]);
  const sem2 = adds(e2);
  const trans = unica('Transcendent_Flesh');
  assert.ok(encaixar(e2, trans).ok);
  const livre = P.arvore().nos.filter((n) => ehPassiva(n) && dist(n) <= P.RAIOS_DE_JOIA.medio).reduce((t, n) => t + (n.efeitos ?? []).reduce((x, ef) => x + (ef.add === 'str' ? ef.valor : 0), 0), 0);
  assert.equal(delta(sem2, adds(e2), 'crit_dmg'), Number(trans.poe.af.raio_crit_multi_por_str_livre) * Math.floor(livre / 10));
});

test('a FORÇA DOS HUMILDES (notável nada, pequena × 1,5), o INSTINTO ANTINATURAL e a LUZ DO SIGNIFICADO', { skip: SEM }, () => {
  const achou = acharEncaixe([(n) => n.tipo === 'notable' && n.efeitos?.some((ef) => ef.add === 'phys_dmg'), (n) => n.tipo === 'small' && so('dex')(n)]);
  assert.ok(achou);
  const [notavel, pequena] = achou.nos;
  const e = personagem([notavel.id, pequena.id], achou.encaixe);
  const sem = adds(e);
  const encaixar = (x, peca) => encaixarEm(x, peca, achou.encaixe);
  assert.ok(encaixar(e, unica('Might_of_the_Meek')).ok);
  const com = adds(e);
  assert.equal(delta(sem, com, 'phys_dmg'), -notavel.efeitos.find((ef) => ef.add === 'phys_dmg').valor);
  assert.equal(delta(sem, com, 'dex'), pequena.efeitos[0].valor * 0.5);
  // (a Luz do Significado: +5 de Vida por passiva alocada no raio — o encaixe não conta)
  assert.ok(encaixar(e, unica('The_Light_of_Meaning')).ok);
  const luz = adds(e);
  assert.equal(delta(sem, luz, 'life'), 5 * 2);
  // (o Instindo Sobrenatural, Raio Pequeno: as pequenas alocadas nada; as NÃO alocadas dão tudo)
  const peq = P.arvore().nos.filter((n) => ehPassiva(n) && n.tipo === 'small' && dist(n) <= P.RAIOS_DE_JOIA.pequeno && n.efeitos?.length);
  assert.ok(peq.length >= 2);
  const e2 = personagem([peq[0].id]);
  const sem2 = adds(e2);
  assert.ok(encaixarEm(e2, unica('Unnatural_Instinct'), ENCAIXE).ok);
  const com2 = adds(e2);
  const esperado = {};
  const conta = (ef, sinal) => { const k = ef.add ?? `stat:${ef.stat}`; esperado[k] = (esperado[k] ?? 0) + sinal * (ef.add ? ef.valor : ef.pct); };
  for (const ef of peq[0].efeitos) conta(ef, -1);
  for (const n of peq.slice(1)) for (const ef of n.efeitos) conta(ef, 1);
  const st2 = { antes: stats(personagem([peq[0].id])), depois: P.efeitos(e2).stats };
  for (const [k, v] of Object.entries(esperado)) {
    if (k.startsWith('stat:')) assert.equal(Math.round(((st2.depois[k.slice(5)] ?? 0) - (st2.antes[k.slice(5)] ?? 0)) * 100) / 100, Math.round(v * 100) / 100, k);
    else assert.equal(delta(sem2, com2, k), Math.round(v * 100) / 100, k);
  }
});

test('os SONHOS e os PESADELOS (a resistência do nó dá Carga ao Matar / Bloqueio em 50%) e os PACTOS (o notável vira o do Pacto)', { skip: SEM }, () => {
  const fogo = noRaio((n) => n.efeitos?.some((ef) => ef.add === 'fire_res'));
  const notavel = noRaio((n) => n.tipo === 'notable', P.RAIOS_DE_JOIA.medio);
  assert.ok(fogo && notavel);
  const res = fogo.efeitos.find((ef) => ef.add === 'fire_res').valor;
  const e = personagem([fogo.id]);
  const sem = adds(e);
  assert.ok(encaixar(e, unica('The_Red_Dream')).ok);
  assert.equal(delta(sem, adds(e), 'carga_tolerancia_ao_matar'), res);
  assert.ok(encaixar(e, unica('The_Red_Nightmare')).ok);
  const pesadelo = adds(e);
  assert.equal(delta(sem, pesadelo, 'block'), res / 2);
  assert.equal(delta(sem, pesadelo, 'carga_tolerancia_ao_matar'), 0, 'trocou o Sonho pelo Pesadelo');
  // (o Pacto da Aceleração: o notável do raio passa a dar só "Lacaios tem Velocidade de Movimento reduzida em 25%")
  const e2 = personagem([notavel.id]);
  const sem2 = adds(e2);
  const pacto = unica('Quickening_Covenant');
  assert.ok(encaixar(e2, pacto).ok);
  const com2 = adds(e2);
  for (const ef of notavel.efeitos) if (ef.add !== 'minion_move') assert.equal(delta(sem2, com2, ef.add) + (ef.add === 'minion_move' ? 0 : 0), -ef.valor, ef.add);
  assert.equal(delta(sem2, com2, 'minion_move') - (pacto.poe.af.minion_move ?? 0), Number(pacto.poe.af.raio_notaveis_lacaio_mov));
});

test('o SALTO INTUITIVO: aloca no raio sem ligação; a joia não sai enquanto segura nós; o respec do encaixe leva os nós junto', { skip: SEM }, () => {
  const longe = P.arvore().nos.find((n) => ehPassiva(n) && n.tipo === 'small' && dist(n) <= P.RAIOS_DE_JOIA.pequeno && dist(n) > 300);
  assert.ok(longe);
  const e = personagem([]);
  e.level = 90;
  assert.equal(P.podeAlocar(e, longe.id).motivo, 'SEM_CAMINHO');
  assert.ok(encaixar(e, unica('Intuitive_Leap')).ok);
  assert.deepEqual(P.caminhoAte(e, longe.id), [longe.id]);
  assert.ok(P.alocar(e, longe.id).ok);
  assert.ok(P.vista(e).liberados[longe.id] === ENCAIXE);
  assert.equal(Comandos.comando(e, { action: 'retirarJoia', no: ENCAIXE }).motivo, 'JOIA_SEGURA_NOS');
  const plano = P.planoDeRespec(e, { ids: [ENCAIXE], junto: true });
  assert.ok(plano.ok && plano.tirar.includes(longe.id), JSON.stringify(plano));
});

test('"LIMITADO A: 1": a segunda Luz do Significado não encaixa em outro encaixe', { skip: SEM }, () => {
  const outro = P.arvore().nos.find((n) => P.ehEncaixeDeJoia(n) && n.id !== ENCAIXE);
  const e = personagem([outro.id]);
  assert.ok(encaixar(e, unica('The_Light_of_Meaning')).ok);
  assert.equal(encaixar(e, unica('The_Light_of_Meaning'), outro.id).motivo, 'LIMITE');
  assert.ok(encaixar(e, unica('The_Light_of_Meaning')).ok, 'no mesmo encaixe, troca');
});
