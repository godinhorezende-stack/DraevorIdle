// TODAS AS GEMAS "FUNCIONA" NO JOGO (lote G16, 17/10 — o pedido do dono: "Crie testes para todas as gemas e suportes … resultados concretos"):
// cada gema ativa do PoE com o status `funciona` é usada de verdade numa caçada — com a primeira arma (de um conjunto) que a habilidade aceita
// — e precisa fazer o que o status promete: a de USO (ataque, magia, armadilha, mina, runa) causa dano no alvo; a de BUFF (aura, arauto, clamor,
// maldição, vínculo) liga o buff. E cada suporte `funciona` precisa de um efeito no nível 20 sem linha "não feita". Uma gema que o status diz
// funcionar e não faz nada é uma falha (o status mente).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Registro = await import('../systems/combate/registro.mjs');
const Areas = await import('../engine/areas.mjs');
const Runas = await import('../systems/itens-poe/runas-vinculadas.mjs');

/** As armas tentadas (a primeira que a gema aceita): a varinha, o arco, a espada com escudo, a maça de duas mãos, a adaga, o cajado. */
const ARMAS = [['Wands/Driftwood_Wand'], ['Bows/Crude_Bow'], ['One_Hand_Swords/Rusted_Sword', 'Shields/Splintered_Tower_Shield'], ['Two_Hand_Maces/Driftwood_Maul'], ['Daggers/Sai'], ['Staves/Gnarled_Branch']];
const BUFF = new Set(['aura', 'arauto', 'clamor', 'maldicao', 'guarda', 'vinculo', 'feiticeiro']);
// (lote A3b, com o aval do dono: a gema cujo dano sai por OUTRA gema — a Espiral Venenosa Vaal só cria os capturados, e as Lâminas Giratórias os soltam — é
// conferida usando-a seguida dessa outra, encaixada junto e no slot 2; o critério do dano é o mesmo das outras)
// (lote B2, com o aval do dono 20/10: a Febre Corrompedora é um buff — o uso dela não acerta; o dano é o Sangue Corrompido nos acertos de OUTRA habilidade com ela ligada:
// a montagem usa a Febre e logo depois a Bola de Fogo, e confere o Sangue Corrompido no alvo — `febre`, abaixo)
const DANO_POR_OUTRA = { Vaal_Venom_Gyre: 'Whirling_Blades', Corrupting_Fever: 'Fireball' };
// (lote B2, com o aval do dono 20/10: a Explosão de Lâminas do Descarrego detona as lâminas do SEU Vórtice de Lâminas — sem lâmina não sai: a montagem usa o Vórtice
// ANTES, encaixado junto e no slot 2; o dano conferido é o do Descarrego)
const USAR_ANTES = { Blade_Blast_of_Unloading: 'Blade_Vortex' };

let J;
let gerarPeca;
const pecas = new Map();
const peca = (base) => {
  if (!pecas.has(base)) pecas.set(base, J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 })));
  return structuredClone(pecas.get(base));
};
/** Um personagem com a arma (e o escudo) e a gema no slot 1, numa caçada, com um alvo imortal colado e os outros longe. */
function montar(slug, [arma, escudo], suportes = []) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  const n = 1 + suportes.length;
  a.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  if (escudo) e.equipment.shield = peca(escudo);
  else delete e.equipment.shield;
  e.inventory = [slug, ...suportes].map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(slug).acao, enabled: true, minMana: 0, conditions: [] };
  // (lote A3b, com o aval do dono: a outra gema no slot 2)
  if (DANO_POR_OUTRA[slug] || USAR_ANTES[slug]) e.actions[1] = { id: G.doSlug(DANO_POR_OUTRA[slug] ?? USAR_ANTES[slug]).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  if (!Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok) return null;
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  // (lote A2, com o aval do dono: só a MONTAGEM das gemas novas — o Berserk precisa de 5 de Fúria para entrar; a Lâmina de Energia custa Escudo de
  // Energia; o Cajado Impregnado de Mana usa o cajado, que já está na lista das armas)
  if (slug === 'Berserk') e.hunt.furia = { n: 5, ganhou: e.hunt.clock, perdeu: e.hunt.clock };
  if (slug === 'Energy_Blade') e.es = 1e7;
  // (lote A5, com o aval do dono: o Golpe Selvagem dos Extremos paga Mana, Vida e Escudo de Energia juntos, como no PoB)
  if (slug === 'Wild_Strike_of_Extremes') e.es = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {} });
  // (lote B1, com o aval do dono 20/10 — a regra do PoE: a Descarga descarrega as SUAS cargas, sem carga ela não sai: a montagem dá Poder, Frenesi e Tolerância à
  // Descarga e à da Miséria; o Condutor Elétrico só acerta o inimigo Eletrizado: a montagem Eletriza o alvo)
  if (/^Discharge/.test(slug)) e.hunt.cargasPoe = Object.fromEntries(['poder', 'frenesi', 'tolerancia'].map((t) => [t, { n: 1, ate: e.hunt.clock + 60_000 }]));
  if (slug === 'Lightning_Conduit') b.estados.chocado = { ate: e.hunt.clock + 60_000, pct: 20, dur: 60_000 };
  // (as gemas de cadáver precisam de um cadáver perto do alvo; as de Retaliação, da janela aberta — o bloqueio, o Acerto Selvagem; os Vínculos,
  // de um aliado perto — o mercenário)
  e.hunt.cadaveres = [{ key: 'x', nome: 'Morto', look: 1, x: b.x, y: b.y, maxHp: 10000 }];
  const retaliacao = G.gatilhoDeRetaliacao(slug);
  if (retaliacao) e.hunt.retaliacao = { [retaliacao]: { ate: Infinity, usados: [] } };
  if (G.doSlug(slug).arquetipo === 'vinculo') (e.hunt.lacaios ??= []).push({ uid: 'aliado', nome: 'Aliado', mercenario: true, hp: 1000, maxHp: 1000, x: e.hunt.pos.x - 1, y: e.hunt.pos.y });
  // (merge com o lote 74, com o aval do dono: a Convocar Runas ativa as SUAS Runas vinculadas — uma Marca da Tempestade encaixada e a Runa dela
  // vinculada no alvo; o dano é o da Runa ativada)
  if (slug === 'Brand_Recall') {
    const f = Ficha.combate(e);
    Runas.vincular(e.hunt, f, Runas.conjurar(e.hunt, f, { acao: G.doSlug('Storm_Brand').acao, slot: null, x: b.x, y: b.y, props: Runas.daGema([]), agora: e.hunt.clock, custo: { valor: 1, em: 'mana' } }), e.hunt.clock, { preferido: b });
  }
  return { e, b };
}
/** Usa a gema (conjuração, armadilha/mina/gêiser pelo tique) e devolve `{ ok, dano, buff, erro }`. */
function usar({ e, b }, slug) {
  // (lote A1, com o aval do dono: a gema de MOVIMENTO pode ter como efeito o deslocamento — o personagem mudou de casa, ou o contador de teleportes
  // andou, no Avanço Flamejante de Retorno que volta para onde começou)
  const de = { x: e.hunt.pos.x, y: e.hunt.pos.y, teleportes: e.hunt.teleportes ?? 0 };
  // (a que CARREGA — a Rajada de Chamas — só explode no último estágio: usa até lá)
  const estagios = G.estagiosDaGema(slug, 20);
  const vezes = estagios?.modo === 'carrega' ? estagios.max : 1;
  const ev = [];
  // (lote B2, com o aval do dono: a gema usada ANTES — o Vórtice de Lâminas do Descarrego; os eventos dela não contam no dano)
  if (USAR_ANTES[slug]) {
    const r0 = Acoes.disparar(e, e.hunt, PERSONAGEM, 1, b, { manual: true });
    if (!r0.ok) return { ok: false, erro: `${USAR_ANTES[slug]}: ${r0.motivo ?? r0.erro}` };
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
    e.hunt.clock = Math.max(e.hunt.clock, e.hunt.cooldowns?.[Acoes.GRUPO_DO_POE]?.ate ?? e.hunt.clock);
    b.hp = b.maxHp;
  }
  for (let i = 0; i < vezes; i++) {
    // (o próximo uso logo depois do fim deste: a canalização continua)
    if (i) e.hunt.clock = Math.max(e.hunt.clock, e.hunt.canalizacao?.ate ?? e.hunt.clock);
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    if (!r.ok) return { ok: false, erro: r.motivo ?? r.erro };
    ev.push(...(r.eventos ?? []));
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; ev.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])); }
  }
  // (lote A3b, com o aval do dono: a gema cujo dano sai por outra — a outra logo depois, no fim do tempo de uso desta)
  if (DANO_POR_OUTRA[slug]) {
    e.hunt.clock = Math.max(e.hunt.clock, e.hunt.cooldowns?.[Acoes.GRUPO_DO_POE]?.ate ?? e.hunt.clock);
    const r2 = Acoes.disparar(e, e.hunt, PERSONAGEM, 1, b, { manual: true });
    if (!r2.ok) return { ok: false, erro: `${DANO_POR_OUTRA[slug]}: ${r2.motivo ?? r2.erro}` };
    ev.push(...(r2.eventos ?? []));
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; ev.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])); }
  }
  // (a Mina detona com você parado e o inimigo perto; a Armadilha, com o inimigo a 1 casa; o gêiser e a torre, no tempo)
  for (let i = 0; i < 6; i++) { e.hunt.clock += 400; ev.push(...Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [])); ev.push(...Acoes.tiqueDasRunas(e, e.hunt, PERSONAGEM, [])); }
  // (lote B2, com o aval do dono 20/10: a Explosão Voltáxica solta 2,5 s × a Duração depois do uso — a montagem espera mais 200 ms, além dos 2,4 s acima)
  if (slug === 'Voltaxic_Burst') { e.hunt.clock += 200; ev.push(...Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [])); }
  // (lote G20a, com o aval do dono: o TOTEM — o seu uso o coloca; o dano é o do totem usando a habilidade, uma vez, no alvo)
  if (G.doSlug(slug).arquetipo === 'totem') for (const l of (e.hunt.lacaios ?? []).filter((x) => x.tipo === 'totem' && x.hp > 0)) ev.push(...Cacadas.golpeDoTotem(e, e.hunt, l, b, Ficha.combate(e), PERSONAGEM, e.hunt.clock));
  // (lote G20c, com o aval do dono: o totem SEM golpe é conferido pelo efeito dele — a aura do Rejuvenescedor na sua soma, perto dele; o Devorador
  // consumindo o cadáver e o dreno vindo para você, ferido; o feixe do Vínculo Abrasador queimando o alvo)
  let efeitoDoTotem = false;
  for (const l of (e.hunt.lacaios ?? []).filter((x) => x.tipo === 'totem' && x.hp > 0)) {
    if (l.auraDoTotem && (G.adds(e)?.life_regen ?? 0) > 0) efeitoDoTotem = true;
    // (lote G20d: o Vínculo Abrasador — o feixe queima o alvo perto de você, uma ponta dele)
    if (/^Searing_Bond/.test(l.gema ?? '')) ev.push(...Acoes.feixeDoVinculo(e, e.hunt, l, e.hunt.clock));
    if (l.devorador) {
      e.hp = e.maxHp - 1000;
      e.hunt.roubos = [];
      Cacadas.devorarCadaver(e, e.hunt, l, Ficha.combate(e), PERSONAGEM, e.hunt.clock);
      if (e.hunt.roubos.some((r) => r.recurso === 'vida' && r.restante > 0)) efeitoDoTotem = true;
    }
  }
  const dano = ev.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + (x.v ?? 0), 0) + (b.dots?.length ? 1 : 0) + (efeitoDoTotem ? 1 : 0);
  const deslocou = e.hunt.pos.x !== de.x || e.hunt.pos.y !== de.y || (e.hunt.teleportes ?? 0) > de.teleportes;
  // (lote C4, com o aval do dono 21/10: a MAGIA SEM ACERTO — a Praga, o Definhar, o Contágio… — não fere no uso; o efeito dela é o DEBUFF no alvo: o degenerativo,
  // o Definhamento ou o Tolhimento)
  // (o relógio já andou os tiques acima: vale o debuff que o uso pôs, mesmo que já tenha acabado)
  const debuff = (b.dots ?? []).length > 0 || ['definhado', 'tolhido'].some((k) => !!b.estados?.[k]);
  return { ok: true, dano, debuff, buff: !!e.hunt.buffs?.[G.doSlug(slug).acao] || !!e.hunt.vinculos?.length, deslocou, febre: (b.dots ?? []).some((d) => d.chave === 'Corrupting_Fever' && d.falta > 0) };
}

test('G16: toda gema ativa "funciona" faz no jogo o que o status promete (o dano, ou o buff ligado)', { skip: SEM, timeout: 600_000 }, async () => {
  J = await import('../systems/itens-poe/jogo.mjs');
  ({ gerarPeca } = await import('../systems/itens-poe/gerar.mjs'));
  const falhas = [];
  let testadas = 0;
  for (const [slug, r] of G.REGISTRO) {
    if (r.statusNoJogo !== 'funciona') continue;
    testadas++;
    const buff = BUFF.has(r.arquetipo);
    let feito = null;
    const erros = [];
    for (const armas of ARMAS) {
      const m = montar(slug, armas, slug === 'Brand_Recall' ? ['Storm_Brand'] : DANO_POR_OUTRA[slug] ? [DANO_POR_OUTRA[slug]] : USAR_ANTES[slug] ? [USAR_ANTES[slug]] : []);
      if (!m) continue;
      let u;
      try { u = usar(m, slug); } catch (err) { u = { ok: false, erro: `exceção: ${err.message}` }; }
      if (!u.ok) { erros.push(`${armas[0]}: ${u.erro}`); continue; }
      // (lote A1, com o aval do dono: no arquétipo `movimento`, "deslocou" é o efeito só da gema SEM dano — o Avanço, o Passo Rápido; a que tem
      // dano segue exigindo o acerto)
      const semDano = !r.ataque && !Object.keys(G.compilada(slug, 20)?.stats?.dano ?? {}).length && !(G.compilada(slug, 20)?.stats?.dot ?? []).length;
      // (lote A1b, com o aval do dono: a Emboscada colada no alvo não se move e não causa dano — o efeito dela é o buff, `hunt.emboscada`)
      // (lote B2, com o aval do dono: a Febre Corrompedora — o Sangue Corrompido no alvo, pelo acerto da outra gema)
      // (lote C4, com o aval do dono 21/10: a magia sem acerto é conferida pelo debuff — `GemasPoe.magiaSemAcerto`)
      if (slug === 'Corrupting_Fever' ? u.febre : buff ? u.buff : G.magiaSemAcerto(slug, 20) ? u.debuff : u.dano > 0 || (r.arquetipo === 'movimento' && semDano && u.deslocou) || (slug === 'Ambush' && !!m.e.hunt.emboscada)) { feito = armas[0]; break; }
      erros.push(`${armas[0]}: saiu sem ${buff ? 'buff' : 'dano'}`);
    }
    if (!feito) falhas.push(`${slug} (${r.arquetipo}) — ${erros.slice(0, 3).join(' · ')}`);
  }
  assert.ok(testadas > 100, `gemas testadas: ${testadas}`);
  assert.deepEqual(falhas, [], `${falhas.length} de ${testadas} gemas "funciona" não fizeram o prometido:\n${falhas.join('\n')}`);
});

// (o efeito do suporte é lido pelo jogo: cada chave que o suporte escreve — fora as `af:` dos atributos, que a ficha do uso lê — aparece no
// código de quem usa o efeito: um suporte cujo efeito ninguém lê seria "funciona" de mentira)
function codigoDoJogo() {
  const raiz = new URL('../systems/', import.meta.url).pathname;
  let tudo = '';
  const ler = (d) => { for (const n of readdirSync(d)) { const c = `${d}${n}`; if (statSync(c).isDirectory()) ler(`${c}/`); else if (n.endsWith('.mjs') && n !== 'suportes-poe.mjs') tudo += readFileSync(c, 'utf8'); } };
  ler(raiz);
  return tudo;
}
test('G16: todo suporte "funciona" tem efeito, nenhuma linha não feita, e cada efeito é lido pelo jogo', { skip: SEM }, () => {
  const codigo = codigoDoJogo();
  const lido = new Map();
  const ehLido = (k) => { if (!lido.has(k)) lido.set(k, new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(codigo)); return lido.get(k); };
  const falhas = [];
  let n = 0;
  for (const [slug, r] of SP.REGISTRO) {
    if (r.status !== 'funciona') continue;
    n++;
    const nivel = Math.min(20, r.suporte.linhas.length || 1);
    const tags = ['Magia', 'Ataque', 'Projétil', 'Área', 'Corpo a Corpo', 'Fogo', 'Gelo', 'Raio', 'Caos', 'Físico', 'Duração', 'Aura', 'Golpe'].map((x) => `poe:${x}`);
    const { efeito, naoFeitas } = SP.efeitoNoNivel(slug, nivel, 20, { tags });
    const gatilho = !!SP.fichaNoNivel(slug, nivel)?.gatilho;
    const chaves = Object.keys(efeito).filter((k) => !k.startsWith('af:'));
    const naoLidas = chaves.filter((k) => !ehLido(k.split(':')[0]));
    if ((!Object.keys(efeito).length && !gatilho) || naoFeitas.length || naoLidas.length) falhas.push(`${slug}: ${!Object.keys(efeito).length && !gatilho ? 'sem efeito ' : ''}${naoFeitas.join(' | ')}${naoLidas.length ? ` chaves que ninguém lê: ${naoLidas.join(', ')}` : ''}`);
  }
  assert.ok(n > 40, `suportes: ${n}`);
  assert.deepEqual(falhas, [], falhas.join('\n'));
});

test('G16: a Penetração do suporte entra no golpe — a resistência a Fogo efetiva do alvo cai 34 pontos com a Bola de Fogo', { skip: SEM }, async () => {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const resistencia = (suportes) => {
    const m = montar('Fireball', ARMAS[0], suportes);
    m.b.resist = { fire: 60 };
    Registro.definirNivel(1);
    Registro.limparRegistro();
    try { usar(m, 'Fireball'); } finally { Registro.definirNivel(0); }
    const g = Registro.ultimosGolpes(50).find((x) => x.origem === 'gema' && x.tipo === 'fire');
    assert.ok(g, 'a Bola de Fogo acertou com Fogo');
    return { pen: g.penetracao, efetiva: g.resistenciaEfetiva };
  };
  const sem = resistencia([]);
  const com = resistencia(['Fire_Penetration_Support']);
  assert.equal(com.pen - sem.pen, 34);
  assert.equal(sem.efetiva - com.efetiva, 34, `${sem.efetiva} → ${com.efetiva}`);
});

test('G16: o cone esticado começa colado em quem usa (a fileira da frente não some) e abre para trás', () => {
  const tem = (f, x, y) => f.some(([dx, dy]) => dx === x && dy === y);
  const cone = [[-1, -1], [0, -1], [1, -1]];
  for (const r of [2, 3, 4, 6]) {
    const f = Areas.escalarForma(cone, r);
    assert.ok(tem(f, 0, -1) && tem(f, -1, -1) && tem(f, 1, -1), `as 3 casas coladas no raio ${r}`);
    assert.ok(tem(f, r, -r) && tem(f, -r, -r), `a largura toda na última fileira do raio ${r}`);
    assert.ok(!f.some(([, dy]) => dy >= 0), `nada do lado ou atrás no raio ${r}`);
  }
  // (a forma com o centro não muda: a cruz segue cruz — e o losango da Nova segue losango, o teste do lote 36)
  assert.deepEqual(Areas.escalarForma([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], 2), [[0, -2], [0, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [0, 1], [0, 2]]);
});
