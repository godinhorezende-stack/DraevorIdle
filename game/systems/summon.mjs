// Summon (familiar) — os números e o formato do personagem real capturado
// (`character.summon`) e das regras que o client e a Ravox Store escrevem:
//
// - "O familiar já bate 25% do seu golpe no nível 0. Cada nível soma +0,25%
//   (até 50% no nível 100) e encurta a espera para invocá-lo de novo: 17 min no
//   nível 0, 9min30 no 50, 2 min no 100. Ele fica 7min30 em campo de cada vez —
//   do nível 80 em diante a espera já é menor que isso e ele não sai mais do
//   seu lado." — recarga = 1020s − 9s por nível (bate nos três pontos).
//   O real capturado (nível 0): fracao 0,25, recarga 1.020.000, duracao 450.000,
//   presenca 0,441 (= duracao/recarga).
// - Sobe com o Summon Upgrade Store (item 55779: 1 por nível, até o 100) ou com
//   o Summon Upgrade Dropped (item 55637: 100 por nível, só até o 20).
// - A magia de cada vocação (level 200, `spell-summon-*-familiar`) invoca; o
//   slot guarda "Fica a até (casas) de você" (`summonPerto`) e "Bate num raio
//   de (casas) do alvo" (`summonAlcance`), padrão 3. "Ele fica colado em você e
//   bate em volta do SEU alvo — nunca sai caçando sozinho."
// - Na tela: `hunt.summon` `{uid, x, y, dir, look, name, nivel}` (map.mjs) e o
//   analisador lê `session.danoDoFamiliar`/`acertosDoFamiliar`.
import { CHARACTER_TEMPLATE } from './dados.mjs';

export const ITEM_DA_LOJA = 55779;
export const ITEM_DROPADO = 55637;
const TETO = 100;
const TETO_DO_DROPADO = 20;
const POR_NIVEL_DROPADO = 100;
const DURACAO_MS = 450_000;

// Os familiares de cada vocação. O look do knight é o do personagem real (991);
// os outros são os outfits vizinhos, conferidos no sprite (992 o pássaro
// dourado do paladin, 993 a árvore do druid, 994 o djinn do sorcerer). O do
// monk não está no atlas capturado — usa o do knight até capturar.
const FAMILIARES = {
  knight: { key: 'knight-familiar', nome: 'Knight familiar', look: 991, magia: 'spell-summon-knight-familiar', fx: 1 },
  paladin: { key: 'paladin-familiar', nome: 'Paladin familiar', look: 992, magia: 'spell-summon-paladin-familiar', fx: 40, elemento: 'holy' },
  druid: { key: 'druid-familiar', nome: 'Druid familiar', look: 993, magia: 'spell-summon-druid-familiar', fx: 44, elemento: 'ice' },
  sorcerer: { key: 'sorcerer-familiar', nome: 'Sorcerer familiar', look: 994, magia: 'spell-summon-sorcerer-familiar', fx: 38, elemento: 'energy' },
  monk: { key: 'monk-familiar', nome: 'Monk familiar', look: 991, magia: 'spell-monk-familiar', fx: 1 },
};

export const nivel = (estado) => Math.max(0, Math.min(TETO, Math.floor(estado.summon?.nivel ?? 0)));
export const fracao = (estado) => 0.25 + 0.0025 * nivel(estado);
export const recarga = (estado) => 1_020_000 - 9_000 * nivel(estado);
export const familiarDe = (estado) => FAMILIARES[estado.vocation] ?? FAMILIARES.knight;

/** Pode invocar agora (sem familiar em campo e fora da recarga)? */
export function podeInvocar(estado, hunt, agora) {
  if (hunt.summon) return { ok: false, erro: 'O familiar já está em campo.' };
  const pronto = estado.summonProntoEm ?? 0;
  if (agora < pronto) return { ok: false, erro: `O familiar volta em ${Math.ceil((pronto - agora) / 60000)} min.` };
  return { ok: true };
}

/** Invoca ao lado do personagem. `action` é o slot (com as distâncias). */
export function invocar(estado, hunt, action, agora) {
  const f = familiarDe(estado);
  estado.summonProntoEm = agora + recarga(estado);
  hunt.summon = {
    uid: `familiar:${f.key}`,
    x: hunt.pos.x,
    y: hunt.pos.y,
    dir: hunt.pos.dir ?? 2,
    look: f.look,
    name: estado.summon?.nome ?? f.nome,
    nivel: nivel(estado),
    fx: f.fx,
    elemento: f.elemento ?? 'physical',
    ate: agora + DURACAO_MS,
    perto: Math.max(1, Math.min(5, Number(action?.summonPerto) || 3)),
    alcance: Math.max(1, Math.min(7, Number(action?.summonAlcance) || 3)),
    proximoGolpe: 0,
  };
}

/** Usar um Summon Upgrade (da loja ou dropado). `null` se o item não é deles. */
export function usarUpgrade(estado, id, quantosTem, consumir) {
  if (id !== ITEM_DA_LOJA && id !== ITEM_DROPADO) return null;
  estado.summon ??= { nivel: 0 };
  const n = nivel(estado);
  if (id === ITEM_DA_LOJA) {
    if (n >= TETO) return { ok: false, erro: `O familiar já está no nível ${TETO}.` };
    consumir(1);
  } else {
    if (n >= TETO_DO_DROPADO) return { ok: false, erro: `O Summon Upgrade Dropped só sobe até o nível ${TETO_DO_DROPADO} — daqui para cima, o da loja.` };
    if (quantosTem < POR_NIVEL_DROPADO) return { ok: false, erro: `São ${POR_NIVEL_DROPADO} Summon Upgrade Dropped por nível (você tem ${quantosTem}).` };
    consumir(POR_NIVEL_DROPADO);
  }
  estado.summon.nivel = n + 1;
  const r = recarga(estado);
  return {
    ok: true,
    notice: `Familiar no nível ${n + 1}: bate ${(fracao(estado) * 100).toFixed(2).replace('.', ',')}% do seu golpe e volta a cada ${Math.floor(r / 60000)}min${String(Math.round((r % 60000) / 1000)).padStart(2, '0')}.`,
  };
}

/** `character.summon`, no formato real. */
export function paraCliente(estado) {
  const molde = CHARACTER_TEMPLATE.summon ?? {};
  const f = familiarDe(estado);
  const r = recarga(estado);
  return {
    ...molde,
    nivel: nivel(estado),
    teto: TETO,
    familiar: { key: f.key, nome: estado.summon?.nome ?? f.nome, look: f.look, magia: f.magia, nomeDeFabrica: f.nome, lookDeFabrica: f.look },
    nome: estado.summon?.nome ?? null,
    fracao: fracao(estado),
    fracaoMaxima: 0.5,
    recarga: r,
    duracao: DURACAO_MS,
    presenca: Math.min(1, DURACAO_MS / r),
    dropado: { item: ITEM_DROPADO, precisa: POR_NIVEL_DROPADO, teto: TETO_DO_DROPADO, chance: molde.dropado?.chance ?? 0.7 },
    loja: { item: ITEM_DA_LOJA, precisa: 1, teto: TETO },
    prontoEm: estado.summonProntoEm ?? 0,
  };
}
