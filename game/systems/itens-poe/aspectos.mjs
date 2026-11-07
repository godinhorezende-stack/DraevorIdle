// OS ASPECTOS do PoE (06/11, lote 7 das inertes — dono: "Continue resolvendo até dar zero nos itens"): as quatro habilidades que os únicos de Farrul, Saqawal,
// Craiceann e Fenumus concedem ("Concede a Habilidade Aspecto do Gato Nível 20"). Como o resto das habilidades concedidas, sai sozinha (o jogo usa as habilidades
// sozinho) e fica ligada, reservando 25% da Mana (`reservaPct`; "Aspecto do Gato não possui Reserva" tira a dele). Os números: o PoB (Skills/other.lua — AspectOfThe*)
// e o poedb (as páginas Aspect_of_the_*):
//
//   GATO: Furtividade Felina por 4 s (100% de Chance de Crítico aumentada, 15% de chance de evitar o dano de cada tipo dos Ataques), depois Agilidade Felina por 6 s
//         (10% de Velocidade de Ataque e de Conjuração), e de novo — os dois em sequência.
//   AVE: Poder da Ave por 4 s (10% de chance de Dano Dobrado, você e os lacaios), depois Voo da Ave por 4 s (10% de Velocidade de Movimento, você e os lacaios).
//   CARANGUEJO: uma Barreira de Caranguejo a cada 0,5 s (a wiki do poedb e o fórum), até 10; 2% de Redução de Dano Físico adicional por Barreira; perde todas
//         quando sofre Dano Físico de um Acerto (`perderBarreiras`).
//   ARANHA: a cada 1 s, uma Teia de Aranha nos inimigos a até 3 m (o raio não é publicado: o das áreas pequenas do jogo), até 3 por inimigo, 6 s; cada Teia, 5% de
//         Dano sofrido aumentado; e Tolhe (o Hinder: 30%, o do PoE sem número próprio).
import { ganharBuff, ativo } from './condicoes-poe.mjs';
import { tolher } from '../skills/estados.mjs';

export const ASPECTOS = Object.freeze({
  gato: {
    nome: 'Aspecto do Gato', stat: 'aspecto_gato', marca: 'aspectoDoGato', semReserva: 'aspecto_gato_sem_reserva',
    fases: [
      { buff: 'furtividadeFelina', s: 4, extra: 'furtividade_felina_s', ganhar: 'ganharFurtividadeFelina', perder: 'perderFurtividadeFelina' },
      { buff: 'agilidadeFelina', s: 6, extra: 'agilidade_felina_s', ganhar: 'ganharAgilidadeFelina' },
    ],
  },
  ave: {
    nome: 'Aspecto da Ave', stat: 'aspecto_ave', marca: 'aspectoDaAve',
    fases: [
      { buff: 'poderDaAve', s: 4, extra: 'poder_da_ave_s', ganhar: 'ganharBuffDaAve' },
      { buff: 'vooDaAve', s: 4, extra: 'voo_da_ave_s', ganhar: 'ganharBuffDaAve' },
    ],
  },
  caranguejo: { nome: 'Aspecto do Caranguejo', stat: 'aspecto_caranguejo', marca: 'aspectoDoCaranguejo', ganhoMs: 500, maximo: 10, reducaoPorBarreira: 2 },
  aranha: { nome: 'Aspecto da Aranha', stat: 'aspecto_aranha', marca: 'aspectoDaAranha', intervaloMs: 1000, duracaoMs: 6000, teiasMax: 3, danoSofridoPorTeia: 5, raioM: 3, tolherPct: 30 },
});
export const RESERVA_PCT = 25;
/** "Recentemente" do PoE (4 s): "Não pode perder Barreiras de Caranguejo caso tenha perdido Barreiras de Caranguejo Recentemente". */
const RECENTE_MS = 4000;
const n = (af, k) => Number(af?.[k]) || 0;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Os aspectos ligados agora (o nível > 0 no `afPoe`). */
export const ligados = (af) => Object.entries(ASPECTOS).filter(([, d]) => n(af, d.stat) > 0).map(([k]) => k);

/** A Mana que os aspectos ligados reservam, em % da máxima (antes da eficácia): 25% cada, menos o que "não possui Reserva". */
export function reservaPct(af) {
  return ligados(af).reduce((s, k) => s + (ASPECTOS[k].semReserva && n(af, ASPECTOS[k].semReserva) > 0 ? 0 : RESERVA_PCT), 0);
}

/** O máximo de Barreiras de Caranguejo: 10 + o "+N ao Número Máximo de Barreiras de Caranguejo". */
export const maximoDeBarreiras = (af) => (n(af, ASPECTOS.caranguejo.stat) > 0 ? ASPECTOS.caranguejo.maximo + n(af, 'barreiras_max') : 0);
export const barreiras = (hunt) => hunt?.barreiras?.n ?? 0;

/**
 * O tique dos aspectos (`cacadas`, depois do `ModsPoe.tique`): os buffs em sequência do Gato e da Ave, as Barreiras do Caranguejo e as Teias da Aranha. Devolve os
 * EVENTOS que saíram ("ao ganhar Furtividade Felina", "quando você perder Furtividade Felina", "ao ganhar Poder da Ave ou Voo da Ave") — quem chama os dispara
 * (`ModsPoe.evento`: os gatilhos das peças).
 */
export function tique(estado, hunt, af, agora = hunt?.clock ?? 0, rng = Math.random) {
  const eventos = [];
  if (!hunt) return eventos;
  const st = (hunt.poeAspectos ??= {});
  for (const [k, d] of Object.entries(ASPECTOS)) {
    const nivel = n(af, d.stat);
    if (!(nivel > 0)) {
      if (st[k]) { delete st[k]; hunt.poeFichaMudou = true; }
      if (k === 'caranguejo' && hunt.barreiras) { delete hunt.barreiras; hunt.poeFichaMudou = true; }
      for (const f of d.fases ?? []) if (hunt.poeBuffs?.[f.buff]) { delete hunt.poeBuffs[f.buff]; hunt.poeFichaMudou = true; }
      if (hunt.poeBuffs?.[d.marca]) { delete hunt.poeBuffs[d.marca]; hunt.poeFichaMudou = true; }
      continue;
    }
    // a marca "afetado pelo Aspecto": enquanto ligado
    ganharBuff(hunt, d.marca, 2, agora);
    if (d.fases) {
      const s = (st[k] ??= { fase: -1, ate: 0 });
      // (Ninho de Saqawal: "Aspecto da Ave também concede Poder da Ave e Vôo da Ave para Aliados próximos" — o buff lê daqui)
      if (k === 'ave') s.aliados = n(af, 'aspecto_ave_aliados') > 0;
      while (agora >= s.ate) {
        const antes = d.fases[s.fase];
        if (antes?.perder) eventos.push(antes.perder);
        s.fase = (s.fase + 1) % d.fases.length;
        const f = d.fases[s.fase];
        const seg = Math.max(0.1, f.s + n(af, f.extra));
        // (o primeiro começa agora; os seguintes, no fim do anterior — o relógio não perde o resto)
        const inicio = s.ate > 0 && agora - s.ate < seg * 1000 ? s.ate : agora;
        s.ate = inicio + seg * 1000;
        if (hunt.poeBuffs?.[antes?.buff]) delete hunt.poeBuffs[antes.buff];
        ganharBuff(hunt, f.buff, (s.ate - agora) / 1000, agora);
        hunt.poeFichaMudou = true;
        if (f.ganhar) eventos.push(f.ganhar);
      }
    }
    if (k === 'caranguejo') {
      const max = maximoDeBarreiras(af);
      const b = (hunt.barreiras ??= { n: 0, ultimo: agora });
      if (b.n >= max) { b.n = max; b.ultimo = agora; continue; }
      while (agora - b.ultimo >= d.ganhoMs && b.n < max) {
        // ("10% de chance de se você fosse receber uma Barreira de Caranguejo, ao invés receberá até seu número máximo")
        b.n = rng() * 100 < n(af, 'barreira_chance_max') ? max : b.n + 1;
        b.ultimo += d.ganhoMs;
        hunt.poeFichaMudou = true;
      }
      if (b.n >= max) b.ultimo = agora;
    }
    if (k === 'aranha') {
      // ("Aspecto da Aranha causa Teia da Aranha e Lentidão a cada 0.5 Segundos" — o intervalo da peça no lugar do de 1 s)
      const intervalo = n(af, 'aranha_intervalo_s') > 0 ? n(af, 'aranha_intervalo_s') * 1000 : d.intervaloMs;
      if (agora < (st.aranhaEm ?? 0)) continue;
      st.aranhaEm = agora + intervalo;
      teiasNosProximos(hunt, af, agora);
    }
  }
  return eventos;
}

/** As Teias da Aranha nos inimigos a até o raio (com a "Área de Efeito do Aspecto da Aranha aumentada"): +1 cada, até o máximo; renova a duração; e Tolhe. */
export function teiasNosProximos(hunt, af, agora = hunt?.clock ?? 0) {
  const d = ASPECTOS.aranha;
  if (!hunt?.pos) return [];
  // a área aumentada cresce o raio pela raiz (a conta das áreas do jogo); 1 casa = 2 m
  const raio = Math.max(1, Math.round((d.raioM * Math.sqrt(Math.max(0, 1 + n(af, 'aranha_area_inc') / 100))) / 2));
  const max = d.teiasMax + n(af, 'teias_extra');
  const dur = d.duracaoMs * Math.max(0, 1 + n(af, 'aranha_duracao_inc') / 100);
  const pegos = (hunt.monstros ?? []).filter((m) => m.hp > 0 && !m.dummy && dist(m, hunt.pos) <= raio);
  for (const m of pegos) {
    const e = (m.estados ??= {});
    const antes = ativo(e.teias, agora) ? e.teias.n : 0;
    // (07/11, o Talismã Fenumal: "Efeito da penalidade de Aspecto da Aranha aumentado em X%" — o Dano sofrido por Teia × (1 + X%))
    e.teias = { n: Math.min(max, antes + 1), ate: agora + dur, danoSofridoPct: d.danoSofridoPorTeia * Math.max(0, 1 + n(af, 'aranha_penalidade_efeito') / 100), danoMenos: n(af, 'teias_dano_menos'), resMenos: Math.abs(n(af, 'teias_res_menos')) };
    tolher(m, d.tolherPct, dur, agora);
  }
  return pegos;
}
/** Quantas Teias de Aranha estão no bicho agora. */
export const teiasNoAlvo = (alvo, agora) => (ativo(alvo?.estados?.teias, agora) ? alvo.estados.teias.n ?? 0 : 0);

/**
 * O Dano Físico de um Acerto em você (`ModsPoe.aoSerAcertado`): perde todas as Barreiras ("Só perde N Barreiras de Caranguejos ao sofrer Dano Físico de um Acerto" —
 * só N); "Não pode perder Barreiras de Caranguejo caso tenha perdido Barreiras de Caranguejo Recentemente" — não perde. Devolve quantas perdeu.
 */
export function perderBarreiras(hunt, af, agora = hunt?.clock ?? 0) {
  const b = hunt?.barreiras;
  if (!b || !(b.n > 0)) return 0;
  if (n(af, 'barreiras_nao_perde_recente') > 0 && b.perdeuEm != null && agora - b.perdeuEm <= RECENTE_MS) return 0;
  const so = n(af, 'barreiras_perde_so');
  const perde = so > 0 ? Math.min(b.n, so) : b.n;
  b.n -= perde;
  b.ultimo = agora;
  b.perdeuEm = agora;
  hunt.poeFichaMudou = true;
  return perde;
}
