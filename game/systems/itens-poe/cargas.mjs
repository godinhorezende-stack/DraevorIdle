// As CARGAS do PoE — Tolerância, Frenesi e Poder (sistema de itens do PoE — só com ITENS_POE=1; em produção nada disto roda).
//
// Números base do PoE: até 3 de cada (+ "+N ao Máximo de Cargas de X"), 10 s; ganhar uma renova a duração de TODAS daquele tipo; quando
// a duração acaba, todas daquele tipo voltam ao MÍNIMO (0, ou o "+N ao Mínimo de Cargas de X"). Por carga:
//   Tolerância — +4% de redução de dano físico (phys_res) e +4% em todas as resistências elementais.
//   Frenesi    — +4% de velocidade de ataque e de conjuração, e 4% MAIS dano (multiplica o golpe — `fatorDeDano`).
//   Poder      — +50% de chance de crítico (aumentada: crit_chance_inc) — o número do PoE 1 atual (a tela de personagem do PoE: "+50%").
//   (+ os mods "por carga" — ver `adds` e `fatorDeDano`.)
// Como se ganha: ao matar, ao acertar um Inimigo Único, quando acertado, ao bloquear, ao atordoar, no crítico (geral, com varinhas,
// corpo a corpo) e no acerto não crítico, por segundo se foi acertado recentemente, a cada N s enquanto se move, a cada N de mana gasta.
// A keystone Conduíte compartilha cada carga ganha com a party na mesma sala.
// As cargas moram na CAÇADA (`hunt.cargasPoe`): saiu da caçada, acabaram. Os efeitos entram como atributos somados (`adds`, juntados em
// `Afixos.soma`), então a ficha é refeita quando o número muda (`Ficha.invalidar`, por quem chama). `af`/`regras`: os atributos de carga
// do personagem (a ficha guarda em `ficha.cargas` — `regrasDaSoma`).
import { ligado } from './catalogo.mjs';

export const TIPOS = ['tolerancia', 'frenesi', 'poder'];
export const NOME = { tolerancia: 'Tolerância', frenesi: 'Frenesi', poder: 'Poder' };
export const BASE = { maximo: 3, duracaoMs: 10_000, recentementeMs: 4000 };

const n = (af, k) => Number(af?.[k]) || 0;
/** O máximo de cargas do tipo (3 + os mods; o Executor: Tolerância = o máximo de Frenesi). */
export function maximo(af, tipo) {
  if (tipo === 'tolerancia' && n(af, 'max_tolerancia_igual_frenesi')) return maximo(af, 'frenesi');
  return Math.max(0, BASE.maximo + n(af, `max_${tipo}`));
}
/** O mínimo de cargas do tipo (0 + "+N ao Mínimo"), nunca acima do máximo. */
export const minimo = (af, tipo) => Math.max(0, Math.min(maximo(af, tipo), n(af, `min_${tipo}`)));
/** A duração (ms) das cargas do tipo (+ a duração das cargas em geral). */
export const duracao = (af, tipo) => Math.round(BASE.duracaoMs * (1 + (n(af, `duracao_${tipo}`) + n(af, 'duracao_cargas')) / 100));

/** As chaves dos atributos de carga (o que a ficha guarda em `ficha.cargas`, para os ganchos não somarem tudo a cada acerto). */
const CHAVES = [
  ...TIPOS.flatMap((t) => [`max_${t}`, `min_${t}`, `duracao_${t}`, `carga_${t}_ao_matar`, `carga_${t}_ao_bloquear`]),
  'duracao_cargas', 'carga_qualquer_ao_matar', 'carga_frenesi_ao_acertar_unico', 'dano_por_poder', 'dano_por_tolerancia', 'dano_por_frenesi', 'dano_por_carga',
  'max_tolerancia_igual_frenesi', 'chance_tolerancia_maxima', 'carga_tolerancia_ao_ser_acertado', 'carga_tolerancia_ao_atordoar', 'carga_poder_ao_atordoar',
  'carga_poder_ao_critico', 'carga_poder_ao_critico_varinha', 'carga_tolerancia_ao_critico_corpo', 'carga_poder_ao_acerto_nao_critico',
  'tolerancia_por_segundo_acertado', 'frenesi_a_cada_s_movendo', 'poder_por_mana_gasta', 'carga_periodica_n', 'carga_periodica_s',
  'frenesi_a_cada_s', 'poder_a_cada_s', 'tolerancia_a_cada_s',
];
export const regrasDaSoma = (af) => Object.fromEntries(CHAVES.filter((k) => n(af, k)).map((k) => [k, n(af, k)]));

/** As cargas ATIVAS agora (`{ tolerancia, frenesi, poder }`, números). */
export function ativas(estado) {
  const c = estado?.hunt?.cargasPoe;
  const agora = estado?.hunt?.clock ?? 0;
  return Object.fromEntries(TIPOS.map((t) => [t, c?.[t] && c[t].ate > agora ? c[t].n : 0]));
}

/** As cargas ativas como cartões de buff da caçada (o cliente desenha junto dos buffs de magia). */
export function buffs(estado) {
  const c = estado?.hunt?.cargasPoe;
  const agora = estado?.hunt?.clock ?? 0;
  if (!c) return [];
  return TIPOS.filter((t) => c[t] && c[t].ate > agora && c[t].n > 0).map((t) => ({ icone: null, nome: `Cargas de ${NOME[t]} ×${c[t].n}`, resta: c[t].ate - agora, tipo: 'cargaPoe', carga: t, n: c[t].n }));
}

/*
 * Quem lê as regras de carga de OUTRO personagem (o Conduíte reparte com a party) e quem diz se o personagem tem a keystone Conduíte: a
 * ficha registra os dois (`definirLeitores`) — assim este módulo não importa a ficha (que importa ele).
 */
let leitorDeRegras = () => ({});
let temConduite = () => false;
export function definirLeitores({ regras, conduite }) {
  if (regras) leitorDeRegras = regras;
  if (conduite) temConduite = conduite;
}

/** Põe `quantas` cargas do tipo (até o máximo) e renova a duração de todas dele, só neste personagem. */
function por(estado, tipo, af, quantas = 1, rng = Math.random) {
  const hunt = estado?.hunt;
  const max = maximo(af, tipo);
  if (!hunt || max <= 0) return false;
  const agora = hunt.clock ?? 0;
  const c = (hunt.cargasPoe ??= {});
  const atual = c[tipo] && c[tipo].ate > agora ? c[tipo].n : 0;
  // O Destruidor: chance de, ao ganhar Tolerância, ir direto ao máximo.
  const tudo = tipo === 'tolerancia' && n(af, 'chance_tolerancia_maxima') > 0 && rng() * 100 < n(af, 'chance_tolerancia_maxima');
  // ("X% de chance de que se você fosse ganhar Cargas de Poder, você ganha o seu número máximo" — o mesmo do Destruidor, para o Poder.)
  const tudoPoder = tipo === 'poder' && n(af, 'chance_poder_maxima') > 0 && rng() * 100 < n(af, 'chance_poder_maxima');
  const novo = tudo || tudoPoder ? max : Math.min(max, atual + quantas);
  c[tipo] = { n: novo, ate: agora + duracao(af, tipo) };
  // O "ganhou uma Carga de X Recentemente" e o evento "ao atingir o Máximo de Cargas" (os únicos — `mods-poe.evento`).
  (hunt.poeRecente ??= {})[tipo === 'poder' ? 'ganhouPoder' : tipo === 'frenesi' ? 'ganhouFrenesi' : 'ganhouTolerancia'] = agora;
  if (novo >= max && atual < max) aoMudar?.(estado, tipo, 'max');
  return true;
}
/** Quem ouve as cargas chegando no máximo / sendo perdidas (a ficha registra: os eventos dos únicos). */
// eslint-disable-next-line no-var
var aoMudar;
export function definirAoMudar(fn) { aoMudar = fn; }

/**
 * Ganha cargas do tipo (até o máximo) e renova a duração de todas dele. Com a keystone Conduíte, a party na mesma sala ganha também (cada
 * um com o máximo e a duração dele). Devolve true se mudou.
 */
export function ganhar(estado, tipo, af, quantas = 1, rng = Math.random) {
  if (!ligado() || !estado?.hunt || !TIPOS.includes(tipo)) return false;
  const mudou = por(estado, tipo, af, quantas, rng);
  if (mudou && temConduite(estado)) {
    const partilha = estado.hunt.partilha;
    for (const m of partilha?.ativa ? partilha.membros ?? [] : []) {
      const outro = m?.estado;
      if (outro && outro !== estado && outro.hunt) por(outro, tipo, leitorDeRegras(outro) ?? {}, quantas, rng);
    }
  }
  return mudou;
}

/**
 * O tique da caçada: as cargas vencidas voltam ao mínimo; o mínimo vale sempre; e os ganhos por tempo (Tolerância por segundo se acertado
 * recentemente; Frenesi a cada N s enquanto se move). Devolve true se algo mudou (a ficha precisa ser refeita).
 */
export function tique(estado, af = {}) {
  const hunt = estado?.hunt;
  if (!ligado() || !hunt) return false;
  const agora = hunt.clock ?? 0;
  const c = hunt.cargasPoe;
  let mudou = false;
  for (const t of TIPOS) {
    const min = minimo(af, t);
    const atual = c?.[t];
    if (atual && atual.ate <= agora) {
      aoMudar?.(estado, t, 'perdeu');
      if (min > 0) {
        atual.n = min;
        atual.ate = agora + duracao(af, t);
      } else delete c[t];
      mudou = true;
    } else if (min > 0 && (!atual || atual.n < min)) {
      (hunt.cargasPoe ??= {})[t] = { n: min, ate: agora + duracao(af, t) };
      mudou = true;
    }
  }
  const tempo = (hunt.cargasPoeTempo ??= {});
  // Tolerância por segundo se foi acertado recentemente (4 s).
  const porSegundo = n(af, 'tolerancia_por_segundo_acertado');
  if (porSegundo > 0 && agora - (tempo.acertadoEm ?? -Infinity) <= BASE.recentementeMs && agora >= (tempo.proximaTolerancia ?? 0)) {
    tempo.proximaTolerancia = agora + 1000;
    mudou = ganhar(estado, 'tolerancia', af, porSegundo) || mudou;
  }
  // Frenesi a cada N s enquanto se move (a posição mudou desde o último tique).
  const cadaS = n(af, 'frenesi_a_cada_s_movendo');
  const pos = hunt.pos ? `${hunt.pos.x},${hunt.pos.y},${hunt.pos.z ?? ''}` : null;
  const moveu = !!(pos && tempo.ultimaPos && pos !== tempo.ultimaPos);
  tempo.ultimaPos = pos;
  if (cadaS > 0 && moveu) {
    tempo.movendoDesde ??= agora;
    if (agora - tempo.movendoDesde >= cadaS * 1000) {
      tempo.movendoDesde = agora;
      mudou = ganhar(estado, 'frenesi', af) || mudou;
    }
  } else if (!moveu) delete tempo.movendoDesde;
  // (09/10) "Ganha uma Carga de Frenesi/Poder/Tolerância a cada N segundos" (os implícitos eldritch: com um Único na presença).
  for (const t of TIPOS) {
    const cada = n(af, `${t}_a_cada_s`);
    const chave = `proxima_${t}`;
    if (!(cada > 0)) { delete tempo[chave]; continue; }
    tempo[chave] ??= agora + cada * 1000;
    if (agora >= tempo[chave]) {
      tempo[chave] = agora + cada * 1000;
      mudou = ganhar(estado, t, af) || mudou;
    }
  }
  // "Ganha N Cargas de Tolerância, Frenesi ou Poder a cada S segundos": o tipo é sorteado a cada vez.
  const periodoS = n(af, 'carga_periodica_s');
  if (periodoS > 0 && n(af, 'carga_periodica_n') > 0) {
    tempo.proximaPeriodica ??= agora + periodoS * 1000;
    while (agora >= tempo.proximaPeriodica) {
      tempo.proximaPeriodica += periodoS * 1000;
      mudou = ganhar(estado, TIPOS[Math.floor(Math.random() * TIPOS.length)], af, n(af, 'carga_periodica_n')) || mudou;
    }
  }
  return mudou;
}

/** Só o vencimento (sem as regras do personagem). */
export const vencer = (estado) => tique(estado, {});

/** Os números BASE de cada carga do PoE (por carga ativa). */
export const POR_CARGA = { reducaoFisica: 4, resElemental: 4, velAtaque: 4, velConjuracao: 4, danoMais: 4, critAumentado: 50 };
/** O que UMA carga de cada tipo dá, com os mods "por Carga de X" do personagem (`af`) — o mesmo número do combate e da ficha. */
export function porCarga(af) {
  return {
    tolerancia: { reducaoFisica: POR_CARGA.reducaoFisica + n(af, 'phys_res_por_tolerancia'), resElemental: POR_CARGA.resElemental + n(af, 'elem_res_por_tolerancia') },
    frenesi: { velAtaque: POR_CARGA.velAtaque + n(af, 'atk_speed_por_frenesi'), velConjuracao: POR_CARGA.velConjuracao, danoMais: POR_CARGA.danoMais },
    poder: { critAumentado: POR_CARGA.critAumentado + n(af, 'crit_chance_inc_por_poder') },
  };
}

/** O que as cargas ativas somam (`adds`, as mesmas chaves dos itens). `af`: a soma sem as cargas (para os mods "por carga"). */
export function adds(estado, af) {
  if (!ligado()) return null;
  const { tolerancia, frenesi, poder } = ativas(estado);
  if (!tolerancia && !frenesi && !poder) return null;
  const s = {};
  const mais = (k, v) => {
    if (v) s[k] = (s[k] ?? 0) + v;
  };
  const pc = porCarga(af);
  mais('phys_res', pc.tolerancia.reducaoFisica * tolerancia);
  for (const el of ['fire_res', 'ice_res', 'energy_res']) mais(el, pc.tolerancia.resElemental * tolerancia);
  mais('armour_pct', n(af, 'armour_pct_por_tolerancia') * tolerancia);
  mais('life_regen_pct', n(af, 'life_regen_pct_por_tolerancia') * tolerancia);
  mais('atk_speed', pc.frenesi.velAtaque * frenesi);
  mais('cast_speed', pc.frenesi.velConjuracao * frenesi);
  mais('move_speed', n(af, 'move_speed_por_frenesi') * frenesi);
  mais('evasion_pct', n(af, 'evasion_pct_por_frenesi') * frenesi);
  mais('crit_chance_inc', pc.poder.critAumentado * poder);
  mais('crit_dmg', n(af, 'crit_dmg_por_poder') * poder);
  mais('spell_dmg', n(af, 'spell_dmg_por_poder') * poder);
  mais('mana_regen_pct', n(af, 'mana_regen_pct_por_poder') * poder);
  return s;
}

/** O fator do dano do golpe pelas cargas: 4% MAIS por Frenesi e os "Dano aumentado por Carga" (`Ficha.rolarCritico`). */
export function fatorDeDano(estado, af) {
  if (!ligado()) return 1;
  const { tolerancia, frenesi, poder } = ativas(estado);
  const aumentado = n(af, 'dano_por_poder') * poder + n(af, 'dano_por_tolerancia') * tolerancia + n(af, 'dano_por_frenesi') * frenesi + n(af, 'dano_por_carga') * (tolerancia + frenesi + poder);
  return (1 + (POR_CARGA.danoMais / 100) * frenesi) * (1 + aumentado / 100);
}

const tentar = (estado, tipo, af, chance, rng) => chance > 0 && rng() * 100 < chance && ganhar(estado, tipo, af, 1, rng);

/** Ao matar um bicho: "Carga de X ao Matar" e "Poder, Frenesi ou Tolerância ao Matar" (sorteia o tipo). Devolve os tipos ganhos. */
export function aoMatar(estado, af, rng = Math.random) {
  const ganhos = [];
  for (const t of TIPOS) if (tentar(estado, t, af, n(af, `carga_${t}_ao_matar`), rng)) ganhos.push(t);
  if (n(af, 'carga_qualquer_ao_matar') > 0 && rng() * 100 < n(af, 'carga_qualquer_ao_matar')) {
    const t = TIPOS[Math.floor(rng() * TIPOS.length)];
    if (ganhar(estado, t, af, 1, rng)) ganhos.push(t);
  }
  return ganhos;
}

/**
 * Ao acertar: Frenesi ao acertar um Inimigo Único (chefe); Poder no crítico (e no crítico com varinha), Tolerância no crítico corpo a
 * corpo, Poder no acerto NÃO crítico; e — se o acerto atordoou — Tolerância/Poder ao atordoar. Devolve os tipos ganhos.
 */
export function aoAcertar(estado, af, alvo, { crit = false, varinha = false, corpoACorpo = false, atordoou = false } = {}, rng = Math.random) {
  const ganhos = [];
  const chefe = !!(alvo?.boss || alvo?.chefe || alvo?.raridade === 'unico' || alvo?.raridade === 'boss');
  if (chefe && tentar(estado, 'frenesi', af, n(af, 'carga_frenesi_ao_acertar_unico'), rng)) ganhos.push('frenesi');
  if (crit) {
    if (tentar(estado, 'poder', af, n(af, 'carga_poder_ao_critico') + (varinha ? n(af, 'carga_poder_ao_critico_varinha') : 0), rng)) ganhos.push('poder');
    if (corpoACorpo && tentar(estado, 'tolerancia', af, n(af, 'carga_tolerancia_ao_critico_corpo'), rng)) ganhos.push('tolerancia');
  } else if (tentar(estado, 'poder', af, n(af, 'carga_poder_ao_acerto_nao_critico'), rng)) ganhos.push('poder');
  if (atordoou) {
    if (tentar(estado, 'tolerancia', af, n(af, 'carga_tolerancia_ao_atordoar'), rng)) ganhos.push('tolerancia');
    if (tentar(estado, 'poder', af, n(af, 'carga_poder_ao_atordoar'), rng)) ganhos.push('poder');
  }
  return ganhos;
}

/** Os ganchos de acerto só precisam rodar com alguma destas regras (a ficha guarda só as que o personagem tem). */
export const reageAoAcerto = (af) => !!(af && (af.carga_frenesi_ao_acertar_unico || af.carga_poder_ao_critico || af.carga_poder_ao_critico_varinha || af.carga_tolerancia_ao_critico_corpo || af.carga_poder_ao_acerto_nao_critico || af.carga_tolerancia_ao_atordoar || af.carga_poder_ao_atordoar));

/** Quando o personagem é acertado: marca o "acertado recentemente" e a chance de Tolerância. Devolve os tipos ganhos. */
export function aoSerAcertado(estado, af, rng = Math.random) {
  const hunt = estado?.hunt;
  if (!ligado() || !hunt) return [];
  (hunt.cargasPoeTempo ??= {}).acertadoEm = hunt.clock ?? 0;
  return tentar(estado, 'tolerancia', af, n(af, 'carga_tolerancia_ao_ser_acertado'), rng) ? ['tolerancia'] : [];
}

/** Ao bloquear: "Carga de X ao Bloquear". Devolve os tipos ganhos. */
export function aoBloquear(estado, af, rng = Math.random) {
  return TIPOS.filter((t) => tentar(estado, t, af, n(af, `carga_${t}_ao_bloquear`), rng));
}

/** Ao gastar mana: o Ocultista ganha uma Carga de Poder a cada N de mana gasta. Devolve os tipos ganhos. */
export function aoGastarMana(estado, af, mana) {
  const cada = n(af, 'poder_por_mana_gasta');
  const hunt = estado?.hunt;
  if (!ligado() || !hunt || !(cada > 0) || !(mana > 0)) return [];
  const tempo = (hunt.cargasPoeTempo ??= {});
  tempo.manaGasta = (tempo.manaGasta ?? 0) + mana;
  let ganhos = 0;
  while (tempo.manaGasta >= cada) {
    tempo.manaGasta -= cada;
    if (ganhar(estado, 'poder', af)) ganhos++;
  }
  return ganhos ? ['poder'] : [];
}
