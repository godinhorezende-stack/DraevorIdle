// (100% — combate, 02/11: "resolva essas que não se aplicam ao jogo, tem que estar tudo 100%") O que faltava do COMBATE do PoE para as linhas que
// estavam como "não se aplica ao jogo" passarem a valer. Só no modo PoE (ITENS_POE=1). Em casas: 1 casa = 2 m.
//
//   - os LACAIOS SANGRAM: o golpe do monstro no lacaio põe as mesmas afecções de dano que ele põe em você (os `efeitos` da espécie — o Sangramento,
//     o Veneno, a Queimadura — e os `debuff` dos modificadores de monstro do PoE), no relógio da caçada, com as mesmas regras de acumulação do motor
//     (`combate/dot.mjs`); o pulso passa pela resistência do lacaio ao elemento (o Físico não: dano contínuo, a armadura não vale);
//   - o SANGRAMENTO EM MOVIMENTO no lacaio: o lacaio que andou no último segundo sofre 3× no pulso ("O Dano é 200% maior enquanto em movimento" —
//     o mesmo `Dot.MOVIMENTO` do monstro e de você); "Se Mover enquanto Sangrando não faz com que Lacaios sofram Dano extra" o tira;
//   - o ALCANCE em décimos de metro: a fração das casas (os metros ÷ 2) vira a CHANCE de uma casa a mais, como na área (a sorte de cada golpe:
//     `hunt.poeSorteDoAlcance`, renovada a cada golpe — entre dois golpes o alcance não muda, para o andar não oscilar);
//   - o EMPURRÃO em você: a habilidade de monstro do PoE que empurra (o "Salto Impactante" dos chefes — "empurrando inimigos ao cair") leva você
//     uma casa para longe dele, se a casa é andável e livre; "Não Pode ser Empurrado" impede. Ser empurrado é andar (o Sangramento dói mais);
//   - o SOLO CONGELADO dos monstros ("Solo Resfriado ao Morrer"): Resfria quem está nele (10%, o do PoE), enquanto está; "Inafetado por Solo
//     Congelado" (e a "Imunidade a Solo Ardente, Solo Eletrizado e Solo Congelado") impede;
//   - o ARQUEIRO ILUSÓRIO grudado em você (o PoE: anda com você); a Força Ocupante do Deadeye: "não são grudados em você" (fica onde nasceu), "+2 ao
//     número máximo" e "Não pode Convocar Arqueiros Ilusórios enquanto próximo dos seus Arqueiros Ilusórios" (próximo = a até 2 casas, como os
//     outros "Próximos" do jogo);
//   - o RE-ARMAR das Minas: "Minas podem ser Detonadas N vezes adicionais" — a Mina detonada volta a ficar armada no mesmo lugar (até N vezes);
//     a Mina com "Minas não podem ser Re-armadas" (a Mina de Fumaça) não volta.
import * as Dot from '../combate/dot.mjs';
import * as ModsPoe from './condicoes-poe.mjs';
import { ligado } from './catalogo.mjs';

const v = (ficha, k) => Number(ficha?.afPoe?.[k]) || 0;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// ---------------------------------------------------------------- os lacaios sangram

/** As afecções de dano que o golpe do monstro põe (as da espécie e as dos modificadores): `[{ tipo, pct, chance, duracaoMs }]`. */
export function afeccoesDoGolpe(efeitosDaEspecie = [], mecanicas = []) {
  const lista = [];
  for (const ef of efeitosDaEspecie ?? []) if (ef?.tipo && ef.pctDoGolpe > 0) lista.push({ tipo: ef.tipo, pct: ef.pctDoGolpe, chance: ef.chance ?? 100, duracaoMs: ef.duracaoMs ?? null });
  for (const mec of mecanicas ?? []) {
    if (mec?.gatilho !== 'aoAtacar' || mec.efeito !== 'debuff') continue;
    const tipo = Dot.tipoDoElemento(mec.elemento ?? 'earth');
    if (tipo) lista.push({ tipo, pct: mec.danoPctDoGolpe ?? 30, chance: mec.chance ?? 100, duracaoMs: Math.max(1, Math.round((mec.duracaoMs ?? 4000) / 1000)) * 1000 });
  }
  return lista;
}

const ELEMENTAIS = new Set(['queimadura', 'choque', 'gelo']);
/**
 * O golpe do monstro `b` ACERTOU o lacaio `l` (`golpe`: o dano do golpe antes das defesas do lacaio): as afecções de dano dele no lacaio, como em
 * você (`afeccoesDoGolpe`). O golem "Imune ao Dano Elemental" não pega as elementais. Devolve os estados postos (sem repetir).
 */
export function afeccoesNoLacaio(l, b, golpe, afeccoes, agora, rng = Math.random) {
  if (!ligado() || !l || !(l.hp > 0) || !(golpe > 0) || !afeccoes?.length) return [];
  const postos = [];
  for (const a of afeccoes) {
    if (l.poe?.imuneElemental && ELEMENTAIS.has(a.tipo)) continue;
    if (rng() * 100 >= a.chance) continue;
    const e = Dot.aplicar(l, { tipo: a.tipo, total: (golpe * a.pct) / 100, duracaoMs: a.duracaoMs, origem: { fonte: 'mob', mob: b?.name ?? null, uid: b?.uid ?? null } }, agora);
    if (e && !postos.includes(e)) postos.push(e);
  }
  return postos;
}

/** O lacaio está "em movimento" (andou no último segundo — `andouEm`, o passo do lacaio)? */
export const lacaioAndando = (l, agora) => l?.andouEm != null && agora - l.andouEm <= Dot.MOVIMENTO.janelaMs;

/**
 * Um tique do dano contínuo NO LACAIO (`l.dots`, o mesmo formato do monstro): os pulsos vencidos, × 3 no Sangramento do lacaio em movimento (sem
 * `semExtraAndando` — "Se Mover enquanto Sangrando não faz com que Lacaios sofram Dano extra"), × (1 − a resistência do lacaio ao elemento — `res(el)`,
 * em %; o Físico passa inteiro). Os que acabaram saem. Devolve `{ dano, eventos }`.
 */
export function tiqueDoLacaio(l, agora, { semExtraAndando = false, res = () => 0 } = {}) {
  const eventos = [];
  let dano = 0;
  if (!l?.dots?.length) return { dano, eventos };
  if (!(l.hp > 0)) { delete l.dots; return { dano, eventos }; }
  for (const d of l.dots) {
    const t = Dot.CONFIG.tipos[d.tipo];
    if (!t) continue;
    while (d.falta > 0 && agora >= d.proximo && d.proximo <= d.ate + t.pulsoMs && l.hp > 0) {
      const parte = Math.max(1, Math.round(Math.min(d.falta, d.porPulso)));
      d.falta -= parte;
      d.proximo += t.pulsoMs;
      const andando = d.tipo === 'sangramento' && !semExtraAndando && (d.agravado || lacaioAndando(l, agora)) ? Dot.MOVIMENTO.fator : 1;
      const el = d.elemento === 'earth' ? 'chaos' : d.elemento;
      const resistencia = el === 'physical' ? 0 : Math.min(100, Number(res(el)) || 0);
      const valor = Math.max(0, Math.round(parte * andando * (1 - resistencia / 100)));
      if (!(valor > 0)) continue;
      l.hp -= valor;
      dano += valor;
      eventos.push({ t: 'dmg', uid: l.uid, x: l.x, y: l.y, v: valor, foe: false, lacaio: true, dot: d.tipo, de: d.origem?.mob ?? null, color: t.cor });
    }
  }
  l.dots = l.dots.filter((d) => d.falta > 0 && d.proximo <= d.ate + (Dot.CONFIG.tipos[d.tipo]?.pulsoMs ?? 1000));
  if (!l.dots.length) delete l.dots;
  return { dano, eventos };
}

// ---------------------------------------------------------------- o alcance em décimos de metro

/** A sorte do alcance do golpe (0 a 1): a mesma até o próximo golpe (`renovarSorteDoAlcance`). */
const sorteDoAlcance = (hunt) => {
  if (!hunt) return 0.5;
  if (!(typeof hunt.poeSorteDoAlcance === 'number' && hunt.poeSorteDoAlcance >= 0 && hunt.poeSorteDoAlcance < 1)) hunt.poeSorteDoAlcance = Math.random();
  return hunt.poeSorteDoAlcance;
};
/** O golpe saiu: a sorte do próximo é outra. */
export function renovarSorteDoAlcance(hunt, rng = Math.random) {
  if (hunt) hunt.poeSorteDoAlcance = rng();
}
/** A fração das casas do alcance em `metros` (os metros ÷ 2, sem a parte inteira), só quando há metros a mais (`temExtra`). */
export const fracaoDoAlcance = (metros, temExtra) => {
  if (!temExtra) return 0;
  const c = Math.max(0, Number(metros) || 0) / 2;
  return Math.round((c - Math.floor(c)) * 1000) / 1000;
};
/** A casa a mais do alcance agora: 1 na chance da fração (`fracaoDoAlcance`), pela sorte do golpe. */
export const casaDaFracao = (hunt, fracao) => (ligado() && fracao > 0 && sorteDoAlcance(hunt) < fracao ? 1 : 0);

// ---------------------------------------------------------------- o empurrão em você

/** A habilidade de monstro do PoE empurra? (a descrição do poedb: "empurrando inimigos", "são empurrados"; o stat `global_knockback`) */
export const habilidadeEmpurra = (h) => /empurr/i.test(String(h?.descricao ?? '')) || (h?.stats ?? []).includes?.('global_knockback');

/**
 * O monstro `bicho` EMPURRA você: uma casa para longe dele, se ela é andável (a grade do combate) e livre (sem monstro vivo). "Não Pode ser Empurrado"
 * (`imune_empurrao`) impede. Ser empurrado conta como andar ("se moveu" — o Sangramento em você dói mais). Devolve true se moveu.
 */
export function empurrarJogador(hunt, bicho, ficha, agora = hunt?.clock ?? 0) {
  if (!ligado() || !hunt?.pos || !bicho || v(ficha, 'imune_empurrao') > 0) return false;
  const dx = Math.sign(hunt.pos.x - bicho.x);
  const dy = Math.sign(hunt.pos.y - bicho.y);
  if (!dx && !dy) return false;
  const para = { x: hunt.pos.x + dx, y: hunt.pos.y + dy };
  const grade = ModsPoe.gradeDoCombate(hunt);
  if (!grade?.andavel || !grade.andavel.has(`${para.x},${para.y}`)) return false;
  if ((hunt.monstros ?? []).some((m) => m.hp > 0 && m.x === para.x && m.y === para.y && (m.z ?? hunt.z ?? 0) === (hunt.z ?? 0))) return false;
  hunt.pos = { ...hunt.pos, x: para.x, y: para.y };
  ModsPoe.marcar(hunt, 'moveu', agora);
  return true;
}

// ---------------------------------------------------------------- o Solo Congelado

/** A lentidão do Resfriamento do Solo Congelado (o PoE: 10%) e quanto ela fica depois de sair do solo (o tique seguinte a renova). */
export const SOLO_CONGELADO = { pct: 10, ms: 500 };
/**
 * Você está no Solo Congelado de um monstro: Resfriado (a lentidão do controle — `hunt.controle.lento`) enquanto está nele, pelo "Efeito do Resfriamento
 * em você", o evitar e as imunidades do Resfriamento (`ModsPoe.controleNoJogador`). Devolve se resfriou.
 */
export function resfriarPeloSolo(hunt, ficha, agora = hunt?.clock ?? 0, { pct = SOLO_CONGELADO.pct, rng = Math.random, lentidaoMaxima = 40 } = {}) {
  if (!ligado() || !hunt) return false;
  const poe = ModsPoe.controleNoJogador(ficha, 'lento', rng, hunt, {});
  if (poe.evitou) return false;
  const minima = v(ficha, 'velocidade_acao_minima');
  const p = Math.min(lentidaoMaxima, minima > 0 ? 100 - minima : 100, pct * poe.pctFator);
  if (!(p > 0)) return false;
  const c = (hunt.controle ??= {});
  const atual = c.lento && c.lento.ate > agora ? c.lento : null;
  c.lento = { ate: Math.max(atual?.ate ?? 0, agora + SOLO_CONGELADO.ms), pct: Math.max(atual?.pct ?? 0, p) };
  return true;
}

// ---------------------------------------------------------------- o Arqueiro Ilusório

/** "Próximo" dos seus Arqueiros Ilusórios: a até 2 casas (os outros "Próximos" do jogo). */
export const ARQUEIRO_PERTO = 2;
/** O máximo de Arqueiros Ilusórios: o do suporte + "+N ao número máximo de Arqueiros Ilusórios Convocados" (`max_lacaio:arqueiro`). */
export const maximoDeArqueiros = (doSuporte, ficha) => Math.max(1, (doSuporte ?? 1) + Math.floor(v(ficha, 'max_lacaio:arqueiro')));
/** Pode convocar outro agora? ("Não pode Convocar Arqueiros Ilusórios enquanto próximo dos seus Arqueiros Ilusórios") */
export const podeConvocarArqueiro = (espelhos, pos, ficha) => !(v(ficha, 'arqueiro_sem_convocar_perto') > 0 && pos && (espelhos ?? []).some((m) => cheb(m, pos) <= ARQUEIRO_PERTO));
/** O Arqueiro Ilusório anda com você (o PoE: grudado em você) — menos com "Arqueiros Ilusórios não são grudados em você". */
export function grudarArqueiros(espelhos, pos, ficha) {
  if (!pos || v(ficha, 'arqueiros_nao_grudados') > 0) return;
  for (const m of espelhos ?? []) { m.x = pos.x; m.y = pos.y; }
}

// ---------------------------------------------------------------- o Re-armar das Minas

/** A linha da gema "Minas não podem ser Re-armadas" (a Mina de Fumaça; o PoB: `mine_cannot_rearm`). */
export const LINHA_NAO_REARMA = /^Minas não podem ser Re-armadas$/i;
/** As linhas do lote que o jogo faz (saem de "efeito não simulado" no status da gema). */
export const ehLinhaCombate100 = (l) => LINHA_NAO_REARMA.test(String(l ?? '').trim());
/**
 * A Mina `p` acabou de detonar: com "Minas podem ser Detonadas N vezes adicionais" (`minas_detonacoes_extra`) ela volta armada no mesmo lugar, pelo
 * tempo que faltava, até N vezes (`p.rearmes`) — menos a da gema que "não pode ser Re-armada" (`naoRearma`). Devolve a Mina re-armada ou null.
 */
export function rearmarMina(hunt, p, ficha, { naoRearma = false, agora = hunt?.clock ?? 0 } = {}) {
  if (!ligado() || !hunt || p?.tipo !== 'mina' || naoRearma) return null;
  const extra = Math.floor(v(ficha, 'minas_detonacoes_extra'));
  const feitas = p.rearmes ?? 0;
  if (!(extra > feitas) || !(p.ate > agora)) return null;
  const { detonaEm: _d, anteriores: _a, ...resto } = p;
  const nova = { ...resto, id: `${String(p.id).replace(/~r\d+$/, '')}~r${feitas + 1}`, rearmes: feitas + 1 };
  (hunt.plantadas ??= []).push(nova);
  return nova;
}
