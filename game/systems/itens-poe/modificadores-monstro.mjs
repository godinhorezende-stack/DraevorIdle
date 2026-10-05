// Os MODIFICADORES DE MONSTRO do PoE (pedido do dono, 05/10 — só com ITENS_POE=1): `gamedata/itens-poe/modificadores-monstro.json`, montado
// por `tools/montar-modificadores-monstro-poe.mjs` a partir do poedb (Monster_Modifiers).
//   - TODOS os bichos (os do PoE e os do Draevor) usam só estes: os modificadores do Draevor saem do catálogo com o PoE ligado.
//   - RARIDADE: o monstro comum que nasce de um spawn de caçada sem raridade sorteia uma (`sorteioDaRaridade`: Mágico, Raro). O spawn
//     que já diz a raridade (editor de mapas) manda — mas só os modificadores do PoE valem nele (os do Draevor ficam de fora); os ÚNICOS do PoE (Hillock, Brutus...) já vêm com a vida e a exp de único no status.
//   - MODIFICADORES: Normal nenhum; Mágico 1; Raro 2 a 4 (`quantos`). Pelo PESO da raridade, só os de nível até o do monstro, sem repetir a
//     família, e só os que têm efeito no Draevor (`soComEfeito`). Entram em `mobs/raridade.MODIFICADORES` como `poe:<id>` (nome e texto
//     em português): o mob guarda os ids e o resto do jogo (tela, mecânicas, combate) os lê como os modificadores do Draevor.
//   - OCULTOS: o que a raridade dá sem aparecer (vida, dano, velocidade, exp do PoE) TROCA os multiplicadores da raridade do Draevor.
import { readFileSync, existsSync } from 'node:fs';
import { ligado } from './catalogo.mjs';
import { BESTIARY } from '../hunt/monstros.mjs';
import * as Raridade from '../mobs/raridade.mjs';

const ARQUIVO = new URL('../../gamedata/itens-poe/modificadores-monstro.json', import.meta.url);
export const DADOS = existsSync(ARQUIVO) ? JSON.parse(readFileSync(ARQUIVO, 'utf8')) : { mods: [], ocultos: {}, quantos: {} };
export const PREFIXO = 'poe:';

/** A raridade do Draevor → a do PoE (o PoE tem 4: o Elite conta como Raro; o Chefe e o Chefe único como Único). */
export const RARIDADE_DO_POE = { normal: 'normal', modificado: 'magico', raro: 'raro', elite: 'raro', unico: 'unico', boss: 'unico' };
const POR_ID = new Map(DADOS.mods.map((m) => [m.id, m]));

/**
 * O monstro recebe os modificadores do PoE? Com o PoE ligado, TODO bicho (decisão do dono, 05/10: "não é pra ficar o do Draevor") — menos
 * os chefes e os únicos do PoE, que já trazem a raridade no status.
 */
const doPoe = (m) => !!m && !BESTIARY[m.key]?.poe?.unico && !m.isBoss && !m.chefe && !m.bossUnico;

/** O nível do monstro para o sorteio: o do PoE; num bicho do Draevor, o da curva de `levelDoBicho` (pela exp). */
const nivelDe = (m) => BESTIARY[m.key]?.poe?.nivel ?? Math.min(100, Math.max(1, Math.round(Math.sqrt(Math.max(1, m.exp ?? BESTIARY[m.key]?.exp ?? 1)) * 3)));

/** O modificador entra no sorteio desta raridade do PoE e deste nível? */
export function elegivel(mod, raridadePoe, nivel, { soComEfeito = DADOS.soComEfeito !== false } = {}) {
  const peso = raridadePoe === 'magico' ? mod.pesoMagico : raridadePoe === 'raro' ? mod.pesoRaro : 0;
  if (!(peso > 0) || (mod.nivel ?? 1) > nivel) return 0;
  if (soComEfeito && mod.estado === 'registrado') return 0;
  return peso;
}

/** Sorteia os modificadores (ids do PoE) de um monstro: quantos pela raridade, pelo peso, sem repetir a família. */
export function sortearMods(raridadePoe, nivel, rng = Math.random, opcoes = {}) {
  const [min, max] = DADOS.quantos?.[raridadePoe] ?? [0, 0];
  const n = min + Math.floor(rng() * (max - min + 1));
  let pool = DADOS.mods.map((m) => [m, elegivel(m, raridadePoe, nivel, opcoes)]).filter(([, p]) => p > 0);
  const saida = [];
  while (saida.length < n && pool.length) {
    const total = pool.reduce((t, [, p]) => t + p, 0);
    let sorte = rng() * total;
    const [m] = pool.find(([, p]) => (sorte -= p) < 0) ?? pool[pool.length - 1];
    saida.push(m.id);
    pool = pool.filter(([o]) => o !== m && (!m.familia || o.familia !== m.familia));
  }
  return saida;
}

/** A raridade sorteada para um monstro comum sem raridade (`sorteioDaRaridade`: chance de cada uma). */
export function sortearRaridade(rng = Math.random) {
  let sorte = rng();
  for (const [r, chance] of Object.entries(DADOS.sorteioDaRaridade ?? {})) if ((sorte -= chance) < 0) return r;
  return 'normal';
}

/** Os multiplicadores da raridade trocados pelos ocultos do PoE (`Raridade.aplicar` → `multiplicadores`/`extra`). */
export function multiplicadoresDe(raridade) {
  const o = DADOS.ocultos?.[RARIDADE_DO_POE[raridade]];
  if (!o) return { multiplicadores: { levelExtra: 0 }, extra: null };
  return {
    multiplicadores: { vida: 1 + (o.vidaMais ?? 0), dano: 1 + (o.danoMais ?? 0), exp: 1 + (o.expMais ?? 0), levelExtra: 0 },
    extra: { velocidadeDeAtaquePct: o.velocidadeDeAtaquePct ?? 0, velocidadePct: o.velocidadePct ?? 0 },
  };
}

/** O aplicador que `Raridade.aplicar` chama: null para quem não é monstro comum do PoE. */
export function aplicador(m, { raridade = 'normal', modificadores = [], sortear = false }, rng = Math.random) {
  if (!doPoe(m)) return null;
  let r = raridade;
  // Monstro do PoE só leva modificador do PoE: os do Draevor que o spawn do mapa traga ficam de fora (o PoE manda) e ele sorteia os dele.
  let mods = modificadores.filter((id) => String(id).startsWith(PREFIXO));
  // Os do Draevor que vieram (onda de encontro, spawn antigo) dão lugar aos do PoE: sorteia mesmo sem `sortear`.
  const trocar = modificadores.length > 0 && !mods.length;
  if (sortear && r === 'normal' && !mods.length) r = sortearRaridade(rng);
  if ((sortear || trocar) && !mods.length && RARIDADE_DO_POE[r] !== 'normal') mods = sortearMods(RARIDADE_DO_POE[r], nivelDe(m), rng).map((id) => PREFIXO + id);
  if (r === 'normal' && !mods.length) return { raridade: 'normal', modificadores: [], multiplicadores: {} };
  return { raridade: r, modificadores: mods, ...multiplicadoresDe(r) };
}

/** Registra os modificadores do PoE no catálogo dos mobs e liga o aplicador. Sem o sistema ligado, nada. */
let INICIADO = false;
export function iniciar() {
  if (!ligado() || INICIADO) return { modificadores: 0 };
  INICIADO = true;
  // Só os do PoE: os do Draevor saem do catálogo (o editor de mapas, a tela do mob e o sorteio só veem os do PoE).
  for (const id of Object.keys(Raridade.MODIFICADORES)) {
    if (id.startsWith(PREFIXO)) continue;
    Raridade.IGNORADOS.add(id);
    delete Raridade.MODIFICADORES[id];
  }
  // Quantos modificadores cada raridade aceita no spawn, como no PoE: Mágico 1, Raro/Elite até 4; o Único e o Chefe, nenhum sorteado.
  for (const [r, n] of Object.entries({ modificado: DADOS.quantos?.magico?.[1] ?? 1, raro: DADOS.quantos?.raro?.[1] ?? 4, elite: DADOS.quantos?.raro?.[1] ?? 4 })) if (Raridade.CONFIG.raridades[r]) Raridade.CONFIG.raridades[r].maxModificadores = n;
  for (const m of DADOS.mods) {
    Raridade.MODIFICADORES[PREFIXO + m.id] = {
      nome: m.nome,
      descricao: (m.linhas ?? []).join('. '),
      stats: m.stats ?? {},
      ...(m.mecanicas?.length ? { mecanicas: m.mecanicas } : {}),
      raridades: [...(m.pesoMagico > 0 ? ['modificado'] : []), ...(m.pesoRaro > 0 ? ['raro', 'elite'] : [])],
      poe: { id: m.id, nomeEn: m.nomeEn, nivel: m.nivel, estado: m.estado },
    };
  }
  Raridade.definirAplicadorPoe((m, o) => aplicador(m, o));
  return { modificadores: DADOS.mods.length };
}

/** A lista para a engine (aba Mobs → Modificadores). */
export const paraEngine = () => ({
  quantos: DADOS.quantos,
  sorteioDaRaridade: DADOS.sorteioDaRaridade ?? {},
  ocultos: DADOS.ocultos,
  mods: DADOS.mods.map(({ statsPoe, ...m }) => ({ ...m, statsPoe: statsPoe ?? [] })),
});
export const mod = (id) => POR_ID.get(String(id).replace(PREFIXO, '')) ?? null;
