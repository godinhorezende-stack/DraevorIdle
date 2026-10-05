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
import * as Atributos from './atributos.mjs';
import * as AtributosDoMob from '../mobs/atributos.mjs';

const ES = Atributos.CONFIG.energyShield;

/** O golpe do jogador ERROU `alvo`? (boneco de treino nunca esquiva) */
export function errou(ficha, hunt, alvo) {
  if (!alvo || alvo.dummy) return false;
  // Técnica Resoluta (keystone do PoE): os acertos não podem ser evadidos.
  if (ficha?.nuncaErra) return false;
  const level = Atributos.levelDoBicho(hunt, alvo);
  const chance = Atributos.chanceDeAcerto(ficha.accuracy ?? 0, level, AtributosDoMob.evasaoDe(alvo, level));
  return !sorteioDoAcerto(chance, alvo, 'errosDoJogador');
}

/**
 * O sorteio de um acerto (ou de uma esquiva): com a `entropia` ligada (`combate/formulas.json`), a chance cresce a cada erro seguido e
 * volta ao começo no acerto — a taxa é a mesma, mas as sequências longas de sorte ou azar não saem. `quem` guarda a contagem de erros.
 */
function sorteioDoAcerto(chance, quem, campo) {
  if (!Formulas.PARAMETROS.acerto.entropia || !quem) return Math.random() < chance;
  const r = Formulas.acertoComEntropia(chance, quem[campo] ?? 0, Math.random());
  quem[campo] = r.erros;
  return r.acertou;
}

/** O jogador esquivou (Evasion) do golpe corpo a corpo de `bicho`? */
export const esquivou = (ficha, hunt, bicho) => {
  const level = Atributos.levelDoBicho(hunt, bicho);
  return sorteioDoAcerto(Atributos.chanceDeEsquiva(ficha.evasion ?? 0, level, AtributosDoMob.precisaoDe(bicho, level)), bicho, 'errosDoBicho');
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
  estado.esEspera = ES.ATRASO_MS;
  const tem = esAtual(estado, ficha);
  if (!(tem > 0)) return dano;
  const tira = Math.min(tem, dano);
  estado.es = tem - tira;
  if (eventos && evento) eventos.push({ t: 'dmg', ...evento, v: tira, color: '#b388ff', es: true });
  return dano - tira;
}

/** Recarga do Energy Shield (`ms` de tempo de jogo): depois da espera, `RECARGA_POR_SEGUNDO` da barra por segundo. */
export function recarregar(estado, ficha, ms) {
  const max = Math.max(0, Math.round(ficha.energyShield ?? 0));
  if (!(max > 0)) {
    if (estado.es) estado.es = 0;
    return;
  }
  const atual = esAtual(estado, ficha);
  let resto = ms;
  if (estado.esEspera > 0) {
    const usa = Math.min(estado.esEspera, resto);
    estado.esEspera -= usa;
    resto -= usa;
  }
  if (!(resto > 0) || atual >= max) return;
  estado.esResto = (estado.esResto ?? 0) + (max * ES.RECARGA_POR_SEGUNDO * resto) / 1000;
  const ganho = Math.floor(estado.esResto);
  estado.esResto -= ganho;
  estado.es = Math.min(max, atual + ganho);
}
