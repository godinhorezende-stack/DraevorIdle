// Os efeitos do PoE que mexem nos ESTADOS dos bichos e no dano contínuo (o atordoamento, Mutilar, Cegar, Empalar…; o que o personagem
// recebe). O resto (condições, soma, ficha do golpe, leitura dos mods) mora em `condicoes-poe.mjs` — sem dependências pesadas, para os
// módulos de base (afixos, gemas, tradução, resistência) poderem usar sem ciclo de importação. Este módulo reexporta tudo de lá.
import { ligado } from './catalogo.mjs';
import * as Estados from '../skills/estados.mjs';
import * as Dot from '../combate/dot.mjs';
import { valor, marcar, ganharFuria, ativo, fichaDa, NO_ACERTO, RECUPERACAO_MS, AO_BLOQUEAR } from './condicoes-poe.mjs';
export * from './condicoes-poe.mjs';



/**
 * O que um ACERTO do personagem faz além do dano (sistema do PoE): o atordoamento, Mutilar, Cegar, Desacelerar, Empurrar, Provocar,
 * Empalar (e solta os empalamentos do alvo), a Fúria e o Escudo de Energia por acerto. `ficha`: a do golpe (`fichaDoGolpe`, com as tags).
 * `dano`: o total do acerto; `fisico`: a parte Física. Devolve `{ atordoou, extra }` — `extra`: o dano dos empalamentos soltos (já tirado).
 */
export function aoAcertar(estado, hunt, alvo, ficha, { dano = 0, fisico = 0, crit = false, eventos = null, agora = hunt?.clock ?? 0, rng = Math.random, mover = null, elementos = [] } = {}) {
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
    e.cego = { ate: agora + NO_ACERTO.cegar.duracaoMs, criticoMenosPct: v('cegados_critico_red') };
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
  return saida;
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
  const reflete = corpoACorpo ? v('reflect_phys_melee') : 0;
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

