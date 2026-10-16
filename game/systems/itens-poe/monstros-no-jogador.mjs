// O que os MONSTROS do PoE fazem no personagem ao acertá-lo (dono, 12/10: "ligar os modificadores" de monstro e de mapa — o que a árvore de
// passivas combate: "Não pode ser Cegado", "Você não pode ser Mutilado", "Não pode ser Empalado", "Efeito de Exposições em você reduzido",
// "Golpes Críticos contra você não infligem Afecções Elementais de forma Inerente", "Evita X% do dano refletido"…). Só no modo PoE.
// Os números são os do PoE 1:
//   Cegueira     — "Estar Cego causa 20% menos Precisão e Evasão, por 4 segundos" (× o "Efeito do Cegamento aumentado" de quem cega);
//   Mutilar      — 30% de Velocidade de Movimento reduzida, 4 s;
//   Empalar      — guarda 10% do Dano Físico do acerto; os próximos 5 acertos em você causam o guardado de novo; até 5, 8 s;
//   Exposição    — −10% (ou o valor do modificador: "aplicando −25%") na resistência daquele elemento, 4 s; a mais forte vale;
//   Eletrização  — (a do crítico) Dano recebido aumentado em 50 × (dano ÷ vida máxima)^0,4 % — de 5% a 50% —, 2 s;
//   Congelamento — (o do crítico) 0,06 s por 1% da vida máxima em dano de Gelo, de 0,3 s a 3 s;
//   Incêndio     — (o do crítico) o dano contínuo de Fogo do jogo: 90% da parte de Fogo do acerto em 4 s, a mesma conta dos modificadores
//                  que incendeiam (`tools/montar-modificadores-monstro-poe.mjs`);
//   Cargas do monstro — as do personagem (`itens-poe/cargas.mjs`): até 3 de cada, 10 s; Tolerância +4% de redução física e de resistências
//                  elementais, Frenesi +4% de velocidade de ataque e 4% de dano, Poder +50% de chance de crítico;
//   Dreno do monstro — a vida drenada volta a 2% da vida máxima dele por segundo (× a "Recuperação do Dreno de Vida aumentada").
// O estado mora na caçada (`hunt.debuffsDoJogador`), no relógio dela; o que muda a ficha entra por `addsDosDebuffsNoJogador` (`Afixos.soma`).
// Quem aplica (o golpe e a magia do monstro, os espinhos, o dreno, as cargas) é `mobs/mecanicas.mjs`.
import { ligado } from './catalogo.mjs';
import { NO_ACERTO, imunidadeApos, fatorDosDebuffs } from './condicoes-poe.mjs';

export const NUMEROS = {
  cegueira: { duracaoMs: 4000, menosPct: 20 },
  mutilar: { duracaoMs: NO_ACERTO.mutilar.duracaoMs, lentidaoPct: NO_ACERTO.mutilar.lentidaoPct },
  empalar: NO_ACERTO.empalar,
  exposicao: { duracaoMs: 4000, pct: 10 },
  eletrizacao: { duracaoMs: 2000, minimoPct: 5, maximoPct: 50 },
  congelamento: { msPorPct: 60, minimoMs: 300, maximoMs: 3000 },
  incendio: { pctDoFogo: 90, duracaoMs: 4000 },
  cargas: { maximo: 3, duracaoMs: 10_000, recentementeMs: 4000, tolerancia: { resist: 4 }, frenesi: { danoPct: 4, velocidadeDeAtaquePct: 4 }, poder: { critAumentadoPct: 50 } },
  dreno: { taxaPct: 2 },
};
/** Os elementos da Exposição (o do jogo → a resistência do personagem). */
const RES = { fire: 'fire_res', ice: 'ice_res', energy: 'energy_res' };

const v = (ficha, k) => Number(ficha?.afPoe?.[k]) || 0;
const ativo = (x, agora) => !!x && x.ate > agora;
const registro = (hunt) => (hunt.debuffsDoJogador ??= {});

/** "X% de chance de Evitar …" / "Imune a …": a afecção do monstro não entra? (sorteia a chance de evitar; `elemental`: + "Evitar Afecções Elementais"). */
function evitou(hunt, ficha, nome, { elemental = false, rng = Math.random, agora = hunt?.clock ?? 0 } = {}) {
  if (v(ficha, `imune_${nome}`) > 0 || (hunt?.imunidadesPoe?.[nome] ?? 0) > agora) return true;
  const chance = v(ficha, `evitar_${nome}`) + (elemental ? v(ficha, 'avoid_elem_ailments') : 0);
  return chance > 0 && rng() * 100 < chance;
}
/** A duração de uma afecção elemental em você ("Duração do … em você", "das Afecções Elementais em você", "X% mais Duração…"). */
// (lote 30: + "Debuffs em você expiram X% mais rápido" — `fatorDosDebuffs`)
const fatorDaDuracao = (ficha, nome) => Math.max(0.1, 1 + (v(ficha, `duracao_${nome}_propria`) + v(ficha, 'duracao_afeccoes_propria') + v(ficha, 'duracao_afeccoes_elementais_propria')) / 100) * Math.max(0, 1 + v(ficha, 'duracao_afeccoes_propria_mais') / 100) * fatorDosDebuffs(ficha?.afPoe);

/** O monstro CEGA você (`efeitoPct`: o "Efeito do Cegamento aumentado" dele). Devolve se pegou. */
export function cegar(hunt, ficha, { efeitoPct = 0, agora = hunt?.clock ?? 0, rng = Math.random } = {}) {
  if (!ligado() || !hunt || evitou(hunt, ficha, 'cegueira', { rng, agora })) return false;
  const d = registro(hunt);
  const efeito = Math.max(0, 1 + efeitoPct / 100);
  const antes = ativo(d.cego, agora) ? d.cego : null;
  d.cego = { ate: Math.max(antes?.ate ?? 0, agora + NUMEROS.cegueira.duracaoMs), efeito: Math.max(antes?.efeito ?? 0, efeito) };
  return true;
}

/** O monstro MUTILA você (só com Ataques). Devolve se pegou. */
export function mutilar(hunt, ficha, { agora = hunt?.clock ?? 0 } = {}) {
  if (!ligado() || !hunt || v(ficha, 'imune_mutilar') > 0) return false;
  const d = registro(hunt);
  d.mutilado = { ate: Math.max(ativo(d.mutilado, agora) ? d.mutilado.ate : 0, agora + NUMEROS.mutilar.duracaoMs) };
  return true;
}

/** O monstro EMPALA você: guarda 10% do Físico que o acerto causou (`fisico`). Cheio (5), o novo tira o mais antigo. Devolve se pegou. */
export function empalar(hunt, ficha, fisico, { agora = hunt?.clock ?? 0, rng = Math.random } = {}) {
  if (!ligado() || !hunt || !(fisico > 0) || evitou(hunt, ficha, 'empalar', { rng, agora })) return false;
  const d = registro(hunt);
  const E = NUMEROS.empalar;
  const lista = (d.empalamentos ?? []).filter((x) => x.ate > agora && x.restam > 0);
  while (lista.length >= E.maximo) lista.shift();
  lista.push({ ate: agora + E.duracaoMs, dano: (fisico * E.pctDoFisico) / 100, restam: E.acertos });
  d.empalamentos = lista;
  return true;
}

/** Um acerto em você SOLTA os empalamentos (cada um causa o guardado e gasta um dos 5 acertos): devolve o dano Físico a causar. */
export function dispararEmpalamentos(hunt, agora = hunt?.clock ?? 0) {
  const d = hunt?.debuffsDoJogador;
  if (!d?.empalamentos?.length) return 0;
  let total = 0;
  for (const x of d.empalamentos) {
    if (!(x.ate > agora) || !(x.restam > 0)) continue;
    total += x.dano;
    x.restam -= 1;
  }
  d.empalamentos = d.empalamentos.filter((x) => x.ate > agora && x.restam > 0);
  return total;
}
/** Os empalamentos em você agora (o número). */
export const empalamentosEmVoce = (hunt, agora = hunt?.clock ?? 0) => (hunt?.debuffsDoJogador?.empalamentos ?? []).filter((x) => x.ate > agora && x.restam > 0).length;

/** A EXPOSIÇÃO do monstro ao elemento (`pct`: o que ela tira da resistência). × o "Efeito de Exposições em você". A mais forte vale. */
export function expor(hunt, ficha, elemento, pct = NUMEROS.exposicao.pct, { agora = hunt?.clock ?? 0 } = {}) {
  if (!ligado() || !hunt || !RES[elemento]) return false;
  const valor = pct * Math.max(0, 1 + v(ficha, 'efeito_exposicao_proprio') / 100);
  if (!(valor > 0)) return false;
  const d = registro(hunt);
  const exp = (d.exposicao ??= {});
  const antes = ativo(exp[elemento], agora) ? exp[elemento] : null;
  exp[elemento] = { ate: agora + NUMEROS.exposicao.duracaoMs, pct: Math.max(antes?.pct ?? 0, valor) };
  return true;
}

/** A ELETRIZAÇÃO do crítico do monstro (`dano`: o de Raio que o acerto causou; `vidaMax`: o limiar). Devolve o % posto (0: nada). */
export function eletrizar(hunt, ficha, dano, vidaMax, { agora = hunt?.clock ?? 0, rng = Math.random } = {}) {
  const E = NUMEROS.eletrizacao;
  if (!ligado() || !hunt || !(dano > 0) || !(vidaMax > 0)) return 0;
  const pct = Math.min(E.maximoPct, 50 * (dano / vidaMax) ** 0.4) * Math.max(0, 1 + v(ficha, 'efeito_eletrizacao_proprio') / 100);
  if (pct < E.minimoPct || evitou(hunt, ficha, 'eletrizacao', { elemental: true, rng, agora })) return 0;
  const d = registro(hunt);
  const antes = ativo(d.eletrizado, agora) ? d.eletrizado : null;
  const final = Math.round(Math.max(antes?.pct ?? 0, pct) * 10) / 10;
  d.eletrizado = { ate: Math.max(antes?.ate ?? 0, agora + Math.round(E.duracaoMs * fatorDaDuracao(ficha, 'eletrizacao'))), pct: final };
  imunidadeApos(hunt, ficha, 'eletrizacao', agora);
  return final;
}
/** A duração do CONGELAMENTO do crítico do monstro (ms; 0 abaixo do mínimo do PoE): `dano` de Gelo que o acerto causou. */
export function msDoCongelamento(dano, vidaMax) {
  const C = NUMEROS.congelamento;
  if (!(dano > 0) || !(vidaMax > 0)) return 0;
  const ms = Math.min(C.maximoMs, (C.msPorPct * 100 * dano) / vidaMax);
  return ms >= C.minimoMs ? Math.round(ms) : 0;
}

/**
 * O fator do DANO REFLETIDO em você (os espinhos dos monstros raros do mapa, o "Devolve X% do dano" dos modificadores): "Dano não pode ser
 * Refletido", "Não pode sofrer Dano Físico/Elemental Refletido" (0) e o "Evita +X% do dano [físico/elemental] refletido" (somados).
 */
export function fatorDoReflexo(ficha, tipo) {
  if (!ligado() || !ficha?.afPoe) return 1;
  const fisico = tipo === 'physical';
  const elemental = ['fire', 'ice', 'energy'].includes(tipo);
  if (v(ficha, 'imune_reflexo') > 0 || (fisico && v(ficha, 'imune_reflexo_fisico') > 0) || (elemental && v(ficha, 'imune_reflexo_elemental') > 0)) return 0;
  const evita = v(ficha, 'reflexo_evitado') + (fisico ? v(ficha, 'reflexo_fisico_evitado') : 0) + (elemental ? v(ficha, 'reflexo_elemental_evitado') : 0);
  return Math.max(0, 1 - evita / 100);
}

/** Os efeitos em você agora (para a tela e o teste): `{ cego, mutilado, empalamentos, exposicao: { fire… }, eletrizado }`. */
export function ativosEmVoce(hunt, agora = hunt?.clock ?? 0) {
  const d = hunt?.debuffsDoJogador ?? {};
  const exposicao = Object.fromEntries(Object.entries(d.exposicao ?? {}).filter(([, x]) => ativo(x, agora)).map(([el, x]) => [el, x.pct]));
  return {
    cego: ativo(d.cego, agora), mutilado: ativo(d.mutilado, agora), empalamentos: empalamentosEmVoce(hunt, agora),
    exposicao, eletrizado: ativo(d.eletrizado, agora) ? d.eletrizado.pct : 0,
  };
}
/** Você está Eletrizado pelo crítico de um monstro? (`condicoes-poe` junta à Eletrização do dano contínuo.) */
export const eletrizadoPeloMonstro = (hunt, agora = hunt?.clock ?? 0) => ativo(hunt?.debuffsDoJogador?.eletrizado, agora);

/**
 * O que os efeitos dos monstros em você SOMAM na ficha agora (`Afixos.soma`): a Cegueira (menos Precisão e Evasão), a Mutilação (menos
 * Velocidade de Movimento), a Exposição (menos resistência) e a Eletrização (Dano recebido aumentado).
 */
export function addsDosDebuffsNoJogador(estado) {
  if (!ligado()) return null;
  const h = estado?.hunt;
  const d = h?.debuffsDoJogador;
  if (!d) return null;
  const agora = h.clock ?? 0;
  const s = {};
  const somar = (k, x) => (s[k] = (s[k] ?? 0) + x);
  if (ativo(d.cego, agora)) {
    const menos = NUMEROS.cegueira.menosPct * (d.cego.efeito ?? 1);
    somar('accuracy_less', menos);
    somar('evasion_mais', -menos);
  }
  if (ativo(d.mutilado, agora)) somar('move_speed', -NUMEROS.mutilar.lentidaoPct);
  for (const [el, x] of Object.entries(d.exposicao ?? {})) if (RES[el] && ativo(x, agora)) somar(RES[el], -x.pct);
  if (ativo(d.eletrizado, agora)) somar('dano_recebido_inc', d.eletrizado.pct);
  return Object.keys(s).length ? s : null;
}
