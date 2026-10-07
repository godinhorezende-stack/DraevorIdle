// Os efeitos do PoE que mexem nos ESTADOS dos bichos e no dano contínuo (o atordoamento, Mutilar, Cegar, Empalar…; o que o personagem
// recebe). O resto (condições, soma, ficha do golpe, leitura dos mods) mora em `condicoes-poe.mjs` — sem dependências pesadas, para os
// módulos de base (afixos, gemas, tradução, resistência) poderem usar sem ciclo de importação. Este módulo reexporta tudo de lá.
import { ligado } from './catalogo.mjs';
import * as Estados from '../skills/estados.mjs';
import * as Dot from '../combate/dot.mjs';
import { valor, marcar, ganharFuria, ativo, fichaDa, NO_ACERTO, RECUPERACAO_MS, AO_BLOQUEAR, condicoesDe, vale, ehCondDeEstado, ganharBuff, tagsDoAlvo, somaPorTags as somaPorTagsDe } from './condicoes-poe.mjs';
export * from './condicoes-poe.mjs';



/**
 * O que um ACERTO do personagem faz além do dano (sistema do PoE): o atordoamento, Mutilar, Cegar, Desacelerar, Empurrar, Provocar,
 * Empalar (e solta os empalamentos do alvo), a Fúria e o Escudo de Energia por acerto. `ficha`: a do golpe (`fichaDoGolpe`, com as tags).
 * `dano`: o total do acerto; `fisico`: a parte Física. Devolve `{ atordoou, extra }` — `extra`: o dano dos empalamentos soltos (já tirado).
 */
export function aoAcertar(estado, hunt, alvo, ficha, { dano = 0, fisico = 0, crit = false, eventos = null, agora = hunt?.clock ?? 0, rng = Math.random, mover = null, elementos = [], personagem = null } = {}) {
  const saida = { atordoou: false, extra: 0 };
  if (!ligado() || !alvo || alvo.dummy || !ficha?.afPoe) return saida;
  const v = (k) => valor(ficha, k);
  const tags = new Set(ficha.tagsDoGolpe ?? []);
  const salaDeBoss = !!hunt?.isBoss;
  const ev = (estado2) => eventos?.push({ t: 'estado', uid: alvo.uid, x: alvo.x, y: alvo.y, estado: estado2 });
  if (crit) {
    marcar(hunt, 'critico', agora);
    // (Os frascos com "chance de ganhar uma Carga de Frasco ao causar um Golpe Crítico" — `frascos.tique`.)
    if (hunt) hunt.poeCriticosParaFrascos = (hunt.poeCriticosParaFrascos ?? 0) + 1;
  }
  const e = (alvo.estados ??= {});
  // Os EMPALAMENTOS do alvo: cada acerto solta o guardado (passa pela redução física do alvo como um golpe físico).
  if (Array.isArray(e.empalado) && e.empalado.length && alvo.hp > 0) {
    let total = 0;
    for (const x of e.empalado) if (x.ate > agora && x.acertos > 0) { total += x.valor; x.acertos--; }
    e.empalado = e.empalado.filter((x) => x.ate > agora && x.acertos > 0);
    if (total > 0) {
      const d = Math.max(1, Math.round(total));
      alvo.hp -= d;
      saida.extra = d;
      eventos?.push({ t: 'dmg', uid: alvo.uid, x: alvo.x, y: alvo.y, v: d, foe: true, alvo: alvo.name, color: '#b0b0b0', empalamento: true });
    }
  }
  if (alvo.hp <= 0) return saida;
  // ATORDOAMENTO (o do PoE: pelo tamanho do acerto em relação à vida do alvo).
  const limiar = Math.max(1, (alvo.maxHp ?? alvo.hp) * Math.max(0.05, 1 - v('enemy_stun_threshold_red') / 100));
  const chanceAtordoar = (NO_ACERTO.atordoamento.fator * dano) / limiar;
  if (chanceAtordoar >= NO_ACERTO.atordoamento.minimoPct && rng() * 100 < Math.min(100, chanceAtordoar)) {
    let dur = NO_ACERTO.atordoamento.duracaoMs * (1 + v('stun_duration') / 100);
    if (rng() * 100 < v('chance_dobrar_atordoamento')) dur *= 2;
    if (Estados.atordoar(alvo, Math.round(dur), agora, salaDeBoss)) {
      saida.atordoou = true;
      ev('atordoado');
    }
  }
  const sorte = (pct) => pct > 0 && rng() * 100 < pct;
  const lentidao = (pct, ms) => {
    const l = e.lento;
    const ate = agora + ms;
    e.lento = ativo(l, agora) ? { ate: Math.max(l.ate, ate), pct: Math.max(l.pct, pct) } : { ate, pct };
  };
  if (sorte(v('chance_mutilar'))) {
    e.mutilado = { ate: agora + NO_ACERTO.mutilar.duracaoMs };
    lentidao(NO_ACERTO.mutilar.lentidaoPct, NO_ACERTO.mutilar.duracaoMs);
    ev('mutilado');
  }
  if (sorte(v('chance_cegar'))) {
    e.cego = { ate: agora + NO_ACERTO.cegar.duracaoMs, criticoMenosPct: v('cegados_critico_red'), ...(v('cegos_esconjuro') > 0 ? { esconjuro: true } : {}) };
    ev('cego');
  }
  if (tags.has('magia') && sorte(v('chance_desacelerar'))) {
    e.desacelerado = { ate: agora + NO_ACERTO.desacelerar.duracaoMs, regenMenosPct: v('desacelerados_regen_red') };
    lentidao(NO_ACERTO.desacelerar.lentidaoPct, NO_ACERTO.desacelerar.duracaoMs);
    ev('lento');
  }
  if (sorte(v('chance_provocar'))) {
    e.provocado = { ate: agora + NO_ACERTO.provocar.duracaoMs, por: estado?.nome ?? null };
    ev('provocado');
  }
  if (sorte(v('chance_empurrar')) && typeof mover === 'function' && mover(alvo)) ev('empurrado');
  if (fisico > 0 && sorte(v('chance_empalar'))) {
    const valor2 = (fisico * NO_ACERTO.empalar.pctDoFisico * (1 + v('efeito_empalamento') / 100)) / 100;
    const lista = (e.empalado ??= []);
    lista.push({ valor: valor2, acertos: NO_ACERTO.empalar.acertos, ate: agora + NO_ACERTO.empalar.duracaoMs });
    if (lista.length > NO_ACERTO.empalar.maximo) lista.splice(0, lista.length - NO_ACERTO.empalar.maximo);
    ev('empalado');
  }
  // EQUILÍBRIO ELEMENTAL (keystone da peça): o alvo acertado por dano elemental fica com +25% de resistência a esses elementos e −50% aos
  // outros, por 5 s (vale para os próximos acertos).
  const elementaisDoAcerto = [...new Set(elementos)].filter((el) => ['fire', 'ice', 'energy'].includes(el));
  if (v('keystone_equilibrio') > 0 && elementaisDoAcerto.length) e.equilibrio = { ate: agora + 5000, atingidos: elementaisDoAcerto };
  // SEGREDOS DO SOFRIMENTO (keystone da peça): o crítico inflige Causticar, Fragilizar e Exaurir.
  if (crit && v('keystone_sofrimento') > 0) {
    const ate = agora + AO_BLOQUEAR.duracaoMs;
    e.causticado = { ate, pct: AO_BLOQUEAR.causticar };
    e.fragilizado = { ate, pct: AO_BLOQUEAR.enfraquecer };
    e.exaurido = { ate, pct: AO_BLOQUEAR.exaurir };
  }
  // A Fúria ("Ganhe N de Fúria com Acertos Corpo a Corpo").
  const furia = v('furia_por_acerto');
  if (furia > 0) ganharFuria(hunt, furia, agora);
  // Escudo de Energia por acerto ("Ganha N de Escudo de Energia por Inimigo Acertado com Ataques").
  const es = tags.has('ataque') ? v('es_on_hit') : 0;
  if (es > 0 && estado) estado.es = Math.min(Math.max(0, Math.round(ficha.energyShield ?? 0)), (estado.es ?? 0) + es);
  // GOLPE DE MISERICÓRDIA (Culling Strike): o alvo com 10% da vida ou menos (5% se Raro ou Único) morre. Com condição: "Acertos Críticos
  // possuem Golpe de Misericórdia", "contra Inimigos Amaldiçoados/Incendiados/Congelados", "Ataques com Arcos têm Golpe Abatedor".
  const comCulling = v('culling') + (crit ? somaPorTagsDe(ficha, [...tags, 'critico']).culling ?? 0 : 0);
  if (comCulling > 0 && alvo.hp > 0 && !alvo.dummy && alvo.maxHp > 0) {
    const limiar = /raro|unico/.test(alvo.raridade ?? alvo.raridadePoe ?? '') || alvo.boss || alvo.chefe ? 0.05 : 0.1;
    if (alvo.hp <= alvo.maxHp * limiar) {
      alvo.hp = 0;
      eventos?.push({ t: 'estado', uid: alvo.uid, x: alvo.x, y: alvo.y, estado: 'misericordia' });
      evento(estado, hunt, 'golpeDeMisericordia', ficha, { alvo, eventos, personagem, agora });
    }
  }
  // Os EVENTOS dos únicos: no acerto, no crítico e ao atordoar (com o alvo e as tags do golpe).
  marcar(hunt, 'acertou', agora);
  if (saida.atordoou) marcar(hunt, 'atordoou', agora);
  const ctx = { alvo, eventos, personagem, agora, tags: [...tags, ...(crit ? [] : ['naoCritico'])] };
  evento(estado, hunt, 'acertar', ficha, ctx);
  if (crit) evento(estado, hunt, 'critico', ficha, ctx);
  if (saida.atordoou) evento(estado, hunt, 'atordoar', ficha, ctx);
  return saida;
}

/** As afecções que um acerto PÔS no alvo (`queimando`, `congelado`, `eletrizado`, `envenenado`…) → os eventos e os "recentemente". */
const EVENTO_DA_AFECCAO = { queimando: ['incendiar', 'incendiou'], congelado: ['congelar', 'congelou'], eletrizado: ['eletrizar', 'eletrizou'], envenenado: ['envenenar', null] };
export function aoPorAfeccoes(estado, hunt, alvo, ficha, postos = [], { eventos = null, personagem = null } = {}) {
  if (!ligado() || !postos?.length) return;
  for (const p of new Set(postos)) {
    const [ev, rec] = EVENTO_DA_AFECCAO[p] ?? [];
    if (!ev) continue;
    if (rec) marcar(hunt, rec);
    evento(estado, hunt, ev, ficha, { alvo, eventos, personagem });
  }
}


/**
 * O personagem levou um acerto de `bicho` (`dano`: o que passou de vida/escudo; `corpoACorpo`: o golpe de perto). O "acertado/dano
 * recentemente", o Reflexo de dano físico aos agressores corpo a corpo, o "Dano sofrido é Recuperado como Vida/Mana" (em 4 s, como o
 * Recoup do PoE) e o "chance de Congelar Inimigos quando te Acertarem". Devolve os eventos.
 */

export function aoSerAcertado(estado, hunt, bicho, ficha, { dano = 0, corpoACorpo = false, agora = hunt?.clock ?? 0, rng = Math.random, eventos = [] } = {}) {
  if (!ligado() || !hunt || !ficha?.afPoe) return eventos;
  marcar(hunt, 'acertado', agora);
  if (dano > 0) marcar(hunt, 'dano', agora);
  // (Os frascos com "Ganhe N Cargas ao ser Acertado" — `frascos.tique`.)
  hunt.poeAcertosParaFrascos = (hunt.poeAcertosParaFrascos ?? 0) + 1;
  const v = (k) => valor(ficha, k);
  evento(estado, hunt, 'serAcertado', ficha, { alvo: bicho, eventos, agora });
  // (+ os Reflexos elementais e de Caos dos únicos, e o "X% do Dano Físico Corpo a Corpo recebido é refletido aos Agressores".)
  const reflete = corpoACorpo ? v('reflect_phys_melee') + v('reflect_fire_melee') + v('reflect_ice_melee') + v('reflect_energy_melee') + v('reflect_chaos_melee') + (dano * v('reflete_fisico_pct')) / 100 : 0;
  if (reflete > 0 && bicho && bicho.hp > 0 && !bicho.dummy) {
    const d = Math.max(1, Math.round(reflete));
    bicho.hp -= d;
    eventos.push({ t: 'dmg', uid: bicho.uid, x: bicho.x, y: bicho.y, v: d, foe: true, alvo: bicho.name, color: '#c0c0c0', reflexo: true });
  }
  for (const [recurso, k] of [['hp', 'recoup_life'], ['mana', 'recoup_mana']]) {
    const pct = v(k);
    if (pct > 0 && dano > 0) (hunt.recuperacoes ??= []).push({ recurso, porMs: (dano * pct) / 100 / RECUPERACAO_MS, ate: agora + RECUPERACAO_MS });
  }
  if (bicho && bicho.hp > 0 && rng() * 100 < v('congelar_agressor')) {
    const dur = Math.round(1000 * (v('congelar_agressor_s') || 1));
    if (congelar(bicho, dur, agora, !!hunt.isBoss)) eventos.push({ t: 'estado', uid: bicho.uid, x: bicho.x, y: bicho.y, estado: 'congelado' });
  }
  return eventos;
}

function congelar(bicho, dur, agora, salaDeBoss) {
  const e = (bicho.estados ??= {});
  if (Estados.atordoar(bicho, dur, agora, salaDeBoss)) {
    // Mesmas regras de controle; o estado posto é o Congelamento (o atordoar acabou de pôr o atordoado: vira congelado).
    e.congelado = e.atordoado;
    delete e.atordoado;
    return true;
  }
  return false;
}


/** O tipo de dano contínuo do motor (`combate/dot.json`) → a afecção do PoE e se é Elemental. */
const AFECCAO_DO_DOT = {
  queimadura: { nome: 'incendio', elemental: true }, choque: { nome: 'eletrizacao', elemental: true }, gelo: { nome: 'resfriamento', elemental: true },
  veneno: { nome: 'veneno' }, venenoPoe: { nome: 'veneno' }, sangramento: { nome: 'sangramento' }, maldicao: { nome: 'maldicao' },
};

/**
 * O dano contínuo de um monstro NO PERSONAGEM, pelos mods do PoE: "X% de chance de Evitar ser Incendiado" (e Afecções Elementais),
 * "Imunidade a …", "Duração do … em você reduzida" (a mesma dor por segundo, por mais ou menos tempo) e o efeito das Maldições/Eletrização/
 * Resfriamento em você. Devolve o estado posto (ou null). Sem o PoE, igual a `Dot.aplicarNoJogador`.
 */
export function dotNoJogador(hunt, ef, agora, rng = Math.random) {
  const ficha = ligado() ? fichaDa(hunt) : null;
  const a = ficha?.afPoe ? AFECCAO_DO_DOT[ef.tipo] : null;
  if (!a) return Dot.aplicarNoJogador(hunt, ef, agora);
  const v = (k) => Number(ficha.afPoe[k]) || 0;
  if (v(`imune_${a.nome}`) > 0 || (hunt.imunidadesPoe?.[a.nome] ?? 0) > agora) return null;
  const evitar = v(`evitar_${a.nome}`) + (a.elemental ? v('avoid_elem_ailments') : 0);
  if (evitar > 0 && rng() * 100 < evitar) return null;
  const dur = Math.max(0.1, 1 + (v(`duracao_${a.nome}_propria`) + v('duracao_afeccoes_propria') + (a.elemental ? v('duracao_afeccoes_elementais_propria') : 0)) / 100);
  const efeito = Math.max(0, 1 + v(`efeito_${a.nome}_proprio`) / 100);
  const base = Dot.CONFIG.tipos[ef.tipo]?.duracaoMs ?? 4000;
  return Dot.aplicarNoJogador(hunt, { ...ef, total: ef.total * dur * efeito, duracaoMs: Math.round((ef.duracaoMs ?? base) * dur) }, agora);
}


// ---------------------------------------------------------------- os EVENTOS dos únicos

/** O disparo de uma habilidade ATIVADA por item ("Ativa X Nível N quando…"): quem registra é `acoes.mjs` (evita o ciclo de importação). */
// eslint-disable-next-line no-var
var disparoDeGatilho;
export function definirDisparo(fn) { disparoDeGatilho = fn; }
/** O ganho de cargas (`cargas.mjs`): registrado pela ficha (o máximo depende da soma). */
// eslint-disable-next-line no-var
var leitorDeCargas;
export function definirCargas(fn) { leitorDeCargas = fn; }

/** Os estados que um evento põe no ALVO (`ev:<evento>:alvo:<estado>` = segundos ou chance). */
const ESTADOS_NO_ALVO = {
  cego: (e, ate) => (e.cego = { ate }), mutilado: (e, ate) => { e.mutilado = { ate }; e.lento = { ate, pct: Math.max(e.lento?.pct ?? 0, 30) }; },
  intimidado: (e, ate) => (e.intimidado = { ate }), debilitado: (e, ate) => { e.debilitado = { ate }; e.exaurido = { ate, pct: 10 }; e.lento = { ate, pct: Math.max(e.lento?.pct ?? 0, 20) }; },
  cinzas: (e, ate) => { e.cinzas = { ate }; e.lento = { ate, pct: Math.max(e.lento?.pct ?? 0, 20) }; }, causticado: (e, ate) => (e.causticado = { ate, pct: 10 }),
  fragilizado: (e, ate) => (e.fragilizado = { ate, pct: 6 }), exaurido: (e, ate) => (e.exaurido = { ate, pct: 10 }), lento: (e, ate) => (e.lento = { ate, pct: Math.max(e.lento?.pct ?? 0, 30) }),
  provocado: (e, ate) => (e.provocado = { ate }), resfriado: (e, ate) => (e.lento = { ate, pct: Math.max(e.lento?.pct ?? 0, 10) }),
  exposicaoFogo: (e, ate) => (e.exposicao = { ...(e.exposicao ?? {}), fire: ate }), exposicaoGelo: (e, ate) => (e.exposicao = { ...(e.exposicao ?? {}), ice: ate }),
  exposicaoRaio: (e, ate) => (e.exposicao = { ...(e.exposicao ?? {}), energy: ate }), amaldicoado: (e, ate) => (e.amaldicoado = { ate }),
  definhado: (e, ate) => (e.definhado = { ate, n: Math.min(15, (e.definhado?.ate > 0 ? e.definhado.n : 0) + 1) }),
};
const SEGUNDOS_PADRAO = 4;

/**
 * Um EVENTO do PoE aconteceu (`matar`, `critico`, `bloquear`, `serAcertado`…): roda os mods `ev:<evento>:<ação>` da ficha cujas condições
 * valem (as de estado e as do alvo). `ctx`: `{ alvo, eventos, personagem, rng, agora }`. Ações: vida/mana/escudo (fixo ou %), cargas,
 * buffs, estados no alvo e em volta, dano em você, Fúria, cargas de frasco, recarga do escudo, explosão do morto, habilidade ativada.
 */
export function evento(estado, hunt, nome, ficha, ctx = {}) {
  const lista = ficha?.eventosPoe;
  if (!ligado() || !hunt || !lista?.length) return;
  const agora = ctx.agora ?? hunt.clock ?? 0;
  const rng = ctx.rng ?? Math.random;
  const alvo = ctx.alvo ?? null;
  const tagsAlvo = new Set([...tagsDoAlvo(alvo, agora), ...(ctx.tags ?? [])]);
  let conds = null;
  for (const ev of lista) {
    if (ev.evento !== nome) continue;
    if (ev.conds.length) {
      conds ??= condicoesDe(estado, ficha.afPoe);
      if (!ev.conds.every((c) => (ehCondDeEstado(c) ? vale(conds, c) : tagsAlvo.has(c)))) continue;
    }
    aplicarAcao(estado, hunt, ev, ficha, { ...ctx, alvo, agora, rng });
  }
}

function aplicarAcao(estado, hunt, ev, ficha, ctx) {
  const { alvo, agora, rng, eventos } = ctx;
  const v = ev.valor;
  const curar = (campo, max, quanto) => { if (quanto > 0 && (estado.hp ?? 0) > 0) estado[campo] = Math.min(max, (estado[campo] ?? 0) + quanto); };
  const esMax = Math.max(0, Math.round(ficha?.energyShield ?? 0));
  const sorte = (pct) => pct >= 100 || rng() * 100 < pct;
  switch (ev.acao) {
    case 'vida': return curar('hp', estado.maxHp ?? 0, v);
    case 'vidaPct': return curar('hp', estado.maxHp ?? 0, ((estado.maxHp ?? 0) * v) / 100);
    case 'mana': return curar('mana', estado.maxMana ?? 0, v);
    case 'manaPct': return curar('mana', estado.maxMana ?? 0, ((estado.maxMana ?? 0) * v) / 100);
    case 'es': return curar('es', esMax, v);
    case 'esPct': return curar('es', esMax, (esMax * v) / 100);
    case 'perdeVidaPct': estado.hp = Math.max(1, (estado.hp ?? 0) - ((estado.maxHp ?? 0) * v) / 100); return;
    case 'perdeEsPct': estado.es = Math.max(0, (estado.es ?? 0) - (esMax * v) / 100); return;
    case 'perdeManaPct': estado.mana = Math.max(0, (estado.mana ?? 0) - ((estado.maxMana ?? 0) * v) / 100); return;
    case 'carga': if (sorte(v)) leitorDeCargas?.(estado, 'ganhar', ev.param, 1); return;
    case 'cargaMax': if (sorte(v)) leitorDeCargas?.(estado, 'max', ev.param); return;
    case 'perdeCargas': if (sorte(v)) leitorDeCargas?.(estado, 'perder', ev.param); return;
    case 'cargaAleatoria': if (sorte(v)) leitorDeCargas?.(estado, 'ganhar', ['frenesi', 'poder', 'tolerancia'][Math.floor(rng() * 3)], 1); return;
    case 'roubarCargas': if (sorte(v)) for (const t of ['frenesi', 'poder', 'tolerancia']) leitorDeCargas?.(estado, 'ganhar', t, 1); return;
    case 'buff': return ganharBuff(hunt, ev.param, v, agora);
    case 'furia': return ganharFuria(hunt, v, agora);
    case 'frasco': { for (const p of estado.frascos ?? []) if (p?.poe) p.poe.cargas = (p.poe.cargas ?? 0) + v; return; }
    case 'recargaEs': if (sorte(v)) estado.esEspera = 0; return;
    case 'removerAfeccao': if (sorte(v)) { const d = hunt.efeitosDoJogador?.dots; if (d?.length) d.shift(); } return;
    case 'alvo': {
      // `alvo:<estado>[:segundos]` = a CHANCE (%) de pôr o estado no alvo (100 = sempre).
      if (!alvo || alvo.hp <= 0) return;
      const [nomeDoEstado, seg] = String(ev.param).split(':');
      const fazer = ESTADOS_NO_ALVO[nomeDoEstado];
      if (!fazer || !sorte(v)) return;
      fazer((alvo.estados ??= {}), agora + (Number(seg) || SEGUNDOS_PADRAO) * 1000);
      eventos?.push({ t: 'estado', uid: alvo.uid, x: alvo.x, y: alvo.y, estado: nomeDoEstado });
      return;
    }
    case 'proximos': {
      // `proximos:<estado>[:segundos]` = a chance de pôr o estado em quem está a até 3 casas.
      const [nomeDoEstado, seg] = String(ev.param).split(':');
      const fazer = ESTADOS_NO_ALVO[nomeDoEstado];
      if (!fazer || !hunt.pos || !sorte(v)) return;
      for (const m of hunt.monstros ?? []) {
        if (m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) > 3) continue;
        fazer((m.estados ??= {}), agora + (Number(seg) || SEGUNDOS_PADRAO) * 1000);
      }
      return;
    }
    case 'dano': estado.hp = Math.max(0, (estado.hp ?? 0) - v); return;
    case 'vidaFaltaPct': return curar('hp', estado.maxHp ?? 0, (((estado.maxHp ?? 0) - (estado.hp ?? 0)) * v) / 100);
    case 'perdeMana': estado.mana = Math.max(0, (estado.mana ?? 0) - v); return;
    case 'perdeUmaCarga': { if (!sorte(v)) return; const c = hunt.cargasPoe?.[ev.param]; if (c?.n > 0) { c.n--; if (!c.n) delete hunt.cargasPoe[ev.param]; } return; }
    case 'refletir': {
      // "Reflete N a M de Dano Físico para Atacantes ao Bloquear": o dano no alvo do evento.
      if (!alvo || alvo.hp <= 0 || alvo.dummy) return;
      const d = Math.max(1, Math.round(v));
      alvo.hp -= d;
      eventos?.push({ t: 'dmg', uid: alvo.uid, x: alvo.x, y: alvo.y, v: d, foe: true, alvo: alvo.name, color: '#c0c0c0', reflexo: true });
      return;
    }
    case 'danoPctVida': estado.hp = Math.max(0, (estado.hp ?? 0) - ((estado.maxHp ?? 0) * v) / 100); return;
    case 'explodir': {
      // O morto explode: X% da vida máxima dele em quem está em volta (1 casa).
      if (!alvo || !hunt.pos) return;
      const dano = Math.max(1, Math.round(((alvo.maxHp ?? 0) * v) / 100));
      for (const m of hunt.monstros ?? []) {
        if (m === alvo || m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - alvo.x), Math.abs(m.y - alvo.y)) > 1) continue;
        m.hp -= dano;
        eventos?.push({ t: 'dmg', uid: m.uid, x: m.x, y: m.y, v: dano, foe: true, alvo: m.name, color: '#ff9000' });
      }
      eventos?.push({ t: 'explosao', id: 6, x: alvo.x, y: alvo.y, lado: 3 });
      return;
    }
    case 'espalhar': {
      // "Quando você Matar um Inimigo Incendiado/Eletrizado, uma afecção equivalente é infligida em um Inimigo próximo".
      if (!alvo) return;
      const perto = (hunt.monstros ?? []).filter((m) => m !== alvo && m.hp > 0 && !m.dummy).sort((a, b) => Math.max(Math.abs(a.x - alvo.x), Math.abs(a.y - alvo.y)) - Math.max(Math.abs(b.x - alvo.x), Math.abs(b.y - alvo.y)))[0];
      if (!perto) return;
      if (ev.param === 'incendio') for (const d of (alvo.dots ?? []).filter((x) => x.tipo === 'queimadura' && x.falta > 0)) Dot.aplicar(perto, { tipo: 'queimadura', total: d.falta, origem: { fonte: 'poe' } }, agora);
      if (ev.param === 'eletrizacao' && alvo.estados?.chocado?.ate > agora) (perto.estados ??= {}).chocado = { ...alvo.estados.chocado };
      // "Congelamentos/Eletrizações infligidos por você se espalham para outros Inimigos dentro de N metros" (N = o valor; 1 casa = 2 m).
      if (ev.param === 'congelamentoRaio' || ev.param === 'eletrizacaoRaio') {
        const casas = Math.max(1, Math.floor(v / 2));
        const chave = ev.param === 'congelamentoRaio' ? 'congelado' : 'chocado';
        if (!(alvo.estados?.[chave]?.ate > agora)) return;
        for (const m of hunt.monstros ?? []) if (m !== alvo && m.hp > 0 && !m.dummy && Math.max(Math.abs(m.x - alvo.x), Math.abs(m.y - alvo.y)) <= casas) (m.estados ??= {})[chave] = { ...alvo.estados[chave] };
      }
      return;
    }
    // `gatilho:<gema>[:chance]` = o NÍVEL da habilidade ativada.
    case 'gatilho': { const [gema, chance] = String(ev.param).split(':'); if (disparoDeGatilho && sorte(Number(chance) || 100)) disparoDeGatilho(estado, hunt, ctx.personagem, gema, v, alvo, eventos); return; }
    default: return;
  }
}

/**
 * As AURAS dos únicos em quem está perto (a até 3 casas): "Inimigos Próximos são Cegados / Resfriados / Causticados / Intimidados / Lentos /
 * Cobertos em Cinzas" — `aura_proximos:<estado>`. A caçada chama a cada tique; o estado dura 1 s e é renovado enquanto o bicho está perto.
 */
export function aurasProximas(estado, hunt, ficha, agora = hunt?.clock ?? 0) {
  if (!ligado() || !hunt?.pos || !ficha?.afPoe) return;
  // O evento "ao atingir Vida Baixa" (cruzou os 50% para baixo).
  const baixa = (estado.maxHp ?? 0) > 0 && (estado.hp ?? 0) > 0 && estado.hp <= estado.maxHp * 0.5;
  if (baixa && !hunt.poeVidaBaixa) evento(estado, hunt, 'vidaBaixa', ficha, { agora });
  hunt.poeVidaBaixa = baixa;
  const auras = Object.entries(ficha.afPoe).filter(([k, x]) => k.startsWith('aura_proximos:') && x > 0).map(([k]) => k.slice('aura_proximos:'.length));
  if (!auras.length) return;
  for (const m of hunt.monstros ?? []) {
    if (m.hp <= 0 || m.dummy || Math.max(Math.abs(m.x - hunt.pos.x), Math.abs(m.y - hunt.pos.y)) > 3) continue;
    const e = (m.estados ??= {});
    for (const a of auras) ESTADOS_NO_ALVO[a]?.(e, agora + 1000);
  }
}
