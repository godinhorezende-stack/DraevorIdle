// As defesas NOVAS da reestruturação de itens, num lugar só — o combate
// (`hunt/combate.mjs`, golpe e troco) e as magias dos bichos (`poderes.mjs`)
// chamam daqui, para a regra ser uma só:
//   - Accuracy: o golpe da arma/wand do jogador pode ERRAR (magia sempre acerta);
//   - Evasion: esquiva do golpe corpo a corpo do bicho;
//   - Chance to Avoid Damage: evita um dano inteiro (golpe ou magia);
//   - Energy Shield: barra que absorve o dano ANTES da vida e recarrega sozinha
//     depois de um tempo sem apanhar.
// Os números moram em `gamedata/atributos-principais.json` (via `Atributos.CONFIG`).
import * as Formulas from '../combate/formulas.mjs';
import { ligado as itensPoeLigado } from '../itens-poe/catalogo.mjs';
import * as Atributos from './atributos.mjs';
import * as AtributosDoMob from '../mobs/atributos.mjs';
import * as ModsPoe from '../itens-poe/condicoes-poe.mjs';
import { RECENTE_MS } from '../itens-poe/condicoes-poe.mjs';

const ES = Atributos.CONFIG.energyShield;

/** O golpe do jogador ERROU `alvo`? (boneco de treino nunca esquiva) */
/** (lote A5d: `rng`, o sorteio — o da Rajada Vulcânica, travado nos testes; sem ele, o `Math.random`.) */
export function errou(ficha, hunt, alvo, rng = Math.random) {
  if (!alvo || alvo.dummy) return false;
  // Técnica Resoluta (keystone do PoE): os acertos não podem ser evadidos.
  if (ficha?.nuncaErra) return false;
  // (ciclo 7, lote D) "Inimigos Provocados por você não podem Evadir Ataques".
  // (lote 31: "Provocados por você" — também pelo Clamor; não o do totem nem o do lacaio)
  if (itensPoeLigado() && Number(ficha?.afPoe?.provocados_nao_evadem) > 0 && ModsPoe.provocadoPorVoce(alvo, hunt?.clock ?? 0)) return false;
  const level = Atributos.levelDoBicho(hunt, alvo);
  // (ciclo 7) "X% mais Precisão contra o Inimigo Marcado / contra Inimigos Únicos / em Curta Distância": a precisão contra ESTE alvo.
  const contraOAlvo = itensPoeLigado() ? precisaoMaisContra(ficha, hunt, alvo) : 1;
  const chance = Atributos.chanceDeAcerto((ficha.accuracy ?? 0) * contraOAlvo, level, AtributosDoMob.evasaoDe(alvo, level));
  return !sorteioDoAcerto(chance, alvo, 'errosDoJogador', rng);
}

/** (ciclo 7) O fator da precisão contra o `alvo` (o "mais" com a tag do alvo: `accuracy_mais@alvoMarcado`, `@alvoUnico`, `@alvoPerto`). */
export function precisaoMaisContra(ficha, hunt, alvo) {
  const agora = hunt?.clock ?? 0;
  const tags = ModsPoe.tagsDoAlvo(alvo, agora);
  if (hunt?.pos && Math.max(Math.abs(alvo.x - hunt.pos.x), Math.abs(alvo.y - hunt.pos.y)) <= 2) tags.push('alvoPerto');
  const mais = ModsPoe.somaPorTags(ficha, tags).accuracy_mais ?? 0;
  return Math.max(0, 1 + mais / 100);
}

/**
 * O sorteio de um acerto (ou de uma esquiva): com a `entropia` ligada (`combate/formulas.json`), a chance cresce a cada erro seguido e
 * volta ao começo no acerto — a taxa é a mesma, mas as sequências longas de sorte ou azar não saem. `quem` guarda a contagem de erros.
 */
function sorteioDoAcerto(chance, quem, campo, rng = Math.random) {
  if (!Formulas.PARAMETROS.acerto.entropia || !quem) return rng() < chance;
  const r = Formulas.acertoComEntropia(chance, quem[campo] ?? 0, rng());
  quem[campo] = r.erros;
  return r.acertou;
}

/** O jogador esquivou (Evasion) do golpe corpo a corpo de `bicho`? */
export const esquivou = (ficha, hunt, bicho, { projetil = false } = {}) => {
  // (ciclo 7, lote F: "Não Evade Ataques inimigos".)
  if (itensPoeLigado() && Number(ficha?.afPoe?.sem_evasao) > 0) return false;
  const level = Atributos.levelDoBicho(hunt, bicho);
  // (PoE: o bicho Cego tem 20% menos precisão — `itens-poe/mods-poe.mjs`.)
  // (+ lote F: "X% mais chance de Evadir Ataques [Corpo a Corpo / se você foi Acertado por um Ataque Recentemente]" — o golpe do monstro aqui é o ataque dele.)
  const mais = itensPoeLigado() ? Math.max(0, 1 + (Number(ficha?.afPoe?.chance_evadir_mais) || 0) / 100) : 1;
  // (a Dança da Flecha: "Evasão é Dobrada contra Ataques de Projéteis"; "X% menos Evasão contra Ataques Corpo a Corpo".)
  const af = itensPoeLigado() ? ficha?.afPoe ?? {} : {};
  const daEvasao = projetil ? (Number(af.evasao_projetil_dobrada) > 0 ? 2 : 1) : Math.max(0, 1 - (Number(af.evasao_corpo_menos) || 0) / 100);
  // (lote 55, o Olho do Vigia: "+X% de chance de Evadir Acertos de Ataques" — soma à chance da Evasão, no teto de 95%)
  const fixa = (Number(af.chance_evadir) || 0) / 100;
  return sorteioDoAcerto(Math.min(0.95, Atributos.chanceDeEsquiva((ficha.evasion ?? 0) * daEvasao, level, AtributosDoMob.precisaoDe(bicho, level) * ModsPoe.doBicho(bicho, hunt?.clock ?? 0).precisaoFator) * mais + fixa), bicho, 'errosDoBicho');
};

/** "Chance to Avoid Damage": o dano inteiro não pega. */
export const evitou = (ficha) => (ficha.evitarDano ?? 0) > 0 && Math.random() < ficha.evitarDano;

/** O Energy Shield atual (nunca acima do máximo da ficha). */
export function esAtual(estado, ficha) {
  const max = Math.max(0, Math.round(ficha.energyShield ?? 0));
  if (estado.es == null || estado.es > max) estado.es = max;
  return estado.es;
}

/**
 * O Energy Shield absorve `dano` (o que sobra passa para a mana do magic
 * shield / a vida). Qualquer dano recebido — mesmo o que o ES engoliu — reinicia
 * a espera da recarga. Devolve o que sobrou.
 */
export function absorver(estado, ficha, dano, eventos, evento) {
  if (!(dano > 0)) return dano;
  const v = (k) => Number(ficha?.afPoe?.[k]) || 0;
  // (Proteção Perversa: "Recarga do Escudo de Energia não é interrompida por Dano se a Recarga começou recentemente" — 4 s, o "recente".)
  const agora = estado.hunt?.clock ?? 0;
  const recargaRecente = v('recarga_nao_interrompida') > 0 && !(estado.esEspera > 0) && estado.esRecargaDesde != null && agora - estado.esRecargaDesde <= RECENTE_MS;
  if (!recargaRecente) estado.esEspera = esperaDaRecarga(ficha);
  // (Bateria Anciã: "Escudo de Energia protege a Mana ao invés da Vida" — o escudo não segura o dano da vida; ele paga os custos.)
  if (v('es_protege_mana') > 0) return dano;
  const tem = esAtual(estado, ficha);
  const tira = tem > 0 ? Math.min(tem, dano) : 0;
  if (tira > 0) {
    estado.es = tem - tira;
    if (eventos && evento) eventos.push({ t: 'dmg', ...evento, v: tira, color: '#b388ff', es: true });
  }
  // (ciclo 7, lote H) "X% de Dano é removido da Mana antes da Vida" (a Mente sobre a Matéria do PoE): do que passou do escudo.
  const pct = itensPoeLigado() ? Math.min(100, v('dano_pela_mana_pct')) : 0;
  const daMana = pct > 0 ? Math.min(estado.mana ?? 0, Math.round(((dano - tira) * pct) / 100)) : 0;
  if (daMana > 0) {
    estado.mana -= daMana;
    if (eventos && evento) eventos.push({ t: 'dmg', ...evento, v: daMana, color: '#4fc3ff' });
  }
  return dano - tira - daMana;
}

/**
 * A espera até a recarga começar: a do Draevor (`ATRASO_MS`) ou, com o PoE, a do PoE 1 (`ATRASO_MS_POE`, 2 s) — dividida por (1 + "Início
 * da Recarga X% mais rápido" das peças e da árvore, `ficha.esInicioPct`).
 */
export function esperaDaRecarga(ficha) {
  const base = itensPoeLigado() ? ES.ATRASO_MS_POE ?? ES.ATRASO_MS : ES.ATRASO_MS;
  return Math.round(base / Math.max(0.1, 1 + (ficha?.esInicioPct ?? 0) / 100));
}

/** A fração do escudo recarregada por segundo: a do Draevor (`RECARGA_POR_SEGUNDO`, 20%) ou, com o PoE, a do PoE 1 (`RECARGA_POR_SEGUNDO_POE`, 33%). */
export const recargaPorSegundo = () => (itensPoeLigado() ? ES.RECARGA_POR_SEGUNDO_POE ?? ES.RECARGA_POR_SEGUNDO : ES.RECARGA_POR_SEGUNDO) ?? 0;

/** Recarga do Energy Shield (`ms` de tempo de jogo): depois da espera, `recargaPorSegundo()` da barra por segundo (× "Recarga aumentada"). */
export function recarregar(estado, ficha, ms) {
  const max = Math.max(0, Math.round(ficha.energyShield ?? 0));
  if (!(max > 0)) {
    if (estado.es) estado.es = 0;
    return;
  }
  const atual = esAtual(estado, ficha);
  const v = (k) => Number(ficha?.afPoe?.[k]) || 0;
  // (Devastador Fantasma: "Não Pode Recarregar Escudo de Energia".)
  if (v('sem_recarga_es') > 0) return;
  let resto = ms;
  if (estado.esEspera > 0) {
    const usa = Math.min(estado.esEspera, resto);
    estado.esEspera -= usa;
    resto -= usa;
    // a recarga COMEÇOU agora (a Proteção Perversa conta o "recentemente" daqui)
    if (!(estado.esEspera > 0)) estado.esRecargaDesde = (estado.hunt?.clock ?? 0) - resto;
  }
  // ("Recarga do Escudo de Energia é aplicada à Vida" — a Juventude Eterna: o mesmo ritmo, mas quem enche é a vida; o escudo não recarrega.)
  const naVida = v('recarga_es_na_vida') > 0;
  if (!(resto > 0) || (naVida ? (estado.hp ?? 0) >= (estado.maxHp ?? 0) || !((estado.hp ?? 0) > 0) : atual >= max)) return;
  // ("X% menos Recarga do Escudo de Energia" — Bateria Anciã 50%, Proteção Perversa 40%: multiplica a recarga.)
  const menos = Math.max(0, 1 - v('es_recarga_menos') / 100);
  estado.esResto = (estado.esResto ?? 0) + (max * recargaPorSegundo() * (1 + (ficha.esRecargaPct ?? 0) / 100) * menos * resto) / 1000;
  if (naVida) {
    const ganhoNaVida = Math.floor(estado.esResto);
    estado.esResto -= ganhoNaVida;
    // (o Pacto Vaal: "Não pode Recuperar Vida fora o Dreno")
    if (!ModsPoe.vidaSoPeloDreno(ficha?.afPoe)) estado.hp = Math.min(estado.maxHp ?? 0, (estado.hp ?? 0) + ganhoNaVida);
    return;
  }
  const ganho = Math.floor(estado.esResto);
  estado.esResto -= ganho;
  estado.es = Math.min(max, atual + ganho);
}
