// Os PODERES Legendary e Mythic das peças vestidas — separados dos adds: um add
// soma um número na ficha; um poder muda uma regra do jogo.
//
// O dono: "não codificar esse efeito diretamente em uma classe específica de
// item. Criar um sistema de efeitos/poderes reutilizável." Por isso nenhum
// poder tem nome aqui: cada um é `condicao` + `efeito` em
// gamedata/itens/efeitos.json, e este motor só conhece os TIPOS de condição e
// de efeito. Poder novo com as peças que já existem = uma entrada no JSON.
//
// O combate os conhece em TRÊS pontos, e nenhum sabe qual poder é qual:
//   - `fatorDeDano`: todo golpe do jogador (arma, wand, magia, runa) passa por
//     `Ficha.rolarCritico`, que multiplica por isto;
//   - `reducaoDeDano`: todo dano recebido (golpe e magia do bicho) é cortado;
//   - `aoMatar`: chamado por `matarMonstro`.
//
// A peça guarda só `{ tipo, id }`; os números vêm da configuração na hora, para
// rebalancear valer também para o que já caiu. Dois equipados com o MESMO
// poder não somam: vale um.
import { EFEITOS } from './config.mjs';

/** Os poderes das peças vestidas: `Map(id -> definição)`. */
export function ativos(estado) {
  const achados = new Map();
  for (const peca of Object.values(estado?.equipment ?? {})) {
    const e = peca?.efeito;
    const def = e && EFEITOS[e.tipo]?.[e.id];
    if (def && !achados.has(e.id)) achados.set(e.id, def);
  }
  return achados;
}

/** A condição do poder vale agora? (sem condição: sempre) */
function vale(condicao, estado, alvo) {
  if (!condicao) return true;
  const c = condicao;
  if (c.vidaAbaixo != null && !((estado.hp ?? 0) < ((estado.maxHp ?? 1) * c.vidaAbaixo) / 100)) return false;
  if (c.alvoVidaAbaixo != null && !(alvo && (alvo.maxHp ?? 0) > 0 && alvo.hp < (alvo.maxHp * c.alvoVidaAbaixo) / 100)) return false;
  if (c.naoBoss && estado.hunt?.isBoss) return false;
  if (c.soBoss && !estado.hunt?.isBoss) return false;
  return true;
}

const agora = () => Date.now();

/** Multiplicador do dano de um golpe do jogador contra `alvo`. */
export function fatorDeDano(estado, alvo) {
  const a = ativos(estado);
  if (!a.size) return 1;
  let f = 1;
  for (const [id, def] of a) {
    const e = def.efeito ?? {};
    if (e.danoPct && vale(def.condicao, estado, alvo)) f *= 1 + e.danoPct / 100;
    // O acúmulo por morte (Colheita de Almas): o bônus guardado na caçada, enquanto durar.
    const acumulo = e.acumuloAoMatar;
    const guardado = acumulo && estado.hunt?.acumulos?.[id];
    if (guardado && guardado.ate > agora()) f *= 1 + (guardado.n * acumulo.porKill) / 100;
  }
  return f;
}

/** Fração do dano recebido que os poderes cortam AGORA (0..1; vários multiplicam). */
export function reducaoDeDano(estado) {
  let passa = 1;
  for (const def of ativos(estado).values()) {
    const r = def.efeito?.reducaoPct;
    if (r && vale(def.condicao, estado, null)) passa *= 1 - r / 100;
  }
  return 1 - passa;
}

/** Uma criatura morreu pela mão deste personagem. */
export function aoMatar(estado, hunt, alvo, eventos, quem) {
  const a = ativos(estado);
  if (!a.size) return;
  for (const [id, def] of a) {
    if (!vale(def.condicao, estado, alvo)) continue;
    const e = def.efeito ?? {};
    for (const [chave, campo, cor] of [['curaAoMatarPct', 'hp', '#00ff66'], ['manaAoMatarPct', 'mana', '#4fc3ff']]) {
      if (!e[chave]) continue;
      const maximo = campo === 'hp' ? estado.maxHp ?? 0 : estado.maxMana ?? 0;
      const ganho = Math.min(Math.round((maximo * e[chave]) / 100), Math.max(0, maximo - (estado[campo] ?? 0)));
      if (ganho > 0) {
        estado[campo] += ganho;
        eventos?.push({ t: 'heal', uid: 'player', quem, x: hunt.pos.x, y: hunt.pos.y, v: ganho, color: cor });
      }
    }
    const acumulo = e.acumuloAoMatar;
    if (acumulo && hunt) {
      hunt.acumulos ??= {};
      const antes = hunt.acumulos[id] && hunt.acumulos[id].ate > agora() ? hunt.acumulos[id].n : 0;
      hunt.acumulos[id] = { n: Math.min(acumulo.max, antes + 1), ate: agora() + acumulo.segundos * 1000 };
    }
  }
}

/** Os números de um poder, achatados (condição + efeito + acúmulo) — o que o `texto` usa. */
export const parametrosDoPoder = (def) => ({ ...(def?.condicao ?? {}), ...(def?.efeito ?? {}), ...(def?.efeito?.acumuloAoMatar ?? {}) });

/** O texto do poder, com os números da configuração ("+20% de dano ..."). */
export function textoDoEfeito(efeito) {
  const def = efeito && EFEITOS[efeito.tipo]?.[efeito.id];
  if (!def) return null;
  const p = parametrosDoPoder(def);
  return { nome: def.nome, tipo: efeito.tipo, texto: def.texto.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? '')) };
}
