// Os efeitos ESPECIAIS (Lendário) e SUPREMOS (Mítico) das peças vestidas —
// separados dos atributos: um atributo soma um número na ficha; um efeito muda
// uma regra do jogo.
//
// O combate os conhece em TRÊS pontos só, e nenhum sabe qual efeito é qual:
//   - `fatorDeDano`: todo golpe do jogador (arma, wand, magia, runa) passa por
//     `Ficha.rolarCritico`, que multiplica por isto;
//   - `reducaoDeDano`: entra na ficha junto com a mitigação das gemas, que o
//     golpe e a magia dos bichos já aplicam;
//   - `aoMatar`: chamado por `matarMonstro`.
// Efeito novo = um caso a mais aqui e uma entrada em gamedata/itens/efeitos.json.
//
// A peça guarda só `{ tipo, id }`; os números vêm da configuração na hora, para
// rebalancear valer também para o que já caiu. Dois equipados com o MESMO
// efeito não somam: vale um.
import { EFEITOS } from './config.mjs';

/** Os efeitos das peças vestidas: `Map(id -> parâmetros)`. */
export function ativos(estado) {
  const achados = new Map();
  for (const peca of Object.values(estado?.equipment ?? {})) {
    const e = peca?.efeito;
    const ficha = e && EFEITOS[e.tipo]?.[e.id];
    if (ficha && !achados.has(e.id)) achados.set(e.id, ficha);
  }
  return achados;
}

const agoraDe = (hunt) => Date.now();

/** Multiplicador do dano de um golpe do jogador contra `alvo`. */
export function fatorDeDano(estado, alvo) {
  const a = ativos(estado);
  if (!a.size) return 1;
  let f = 1;
  const desespero = a.get('desespero');
  if (desespero && (estado.hp ?? 0) < ((estado.maxHp ?? 1) * desespero.vida) / 100) f *= 1 + desespero.bonus / 100;
  const carrasco = a.get('carrasco');
  if (carrasco && alvo && !estado.hunt?.isBoss && (alvo.maxHp ?? 0) > 0 && alvo.hp < (alvo.maxHp * carrasco.vida) / 100) f *= 1 + carrasco.bonus / 100;
  const colheita = a.get('colheita-de-almas');
  const almas = estado.hunt?.almas;
  if (colheita && almas && almas.ate > agoraDe(estado.hunt)) f *= 1 + (almas.n * colheita.porKill) / 100;
  return f;
}

/** Fração do dano recebido que os efeitos cortam (0..1). */
export function reducaoDeDano(estado) {
  const pele = ativos(estado).get('pele-de-pedra');
  return pele ? pele.reducao / 100 : 0;
}

/** Uma criatura morreu pela mão deste personagem. */
export function aoMatar(estado, hunt, alvo, eventos, quem) {
  const a = ativos(estado);
  if (!a.size) return;
  const sede = a.get('sede-de-sangue');
  if (sede) {
    const ganho = Math.min(Math.round(((estado.maxHp ?? 0) * sede.cura) / 100), Math.max(0, (estado.maxHp ?? 0) - (estado.hp ?? 0)));
    if (ganho > 0) {
      estado.hp += ganho;
      eventos?.push({ t: 'heal', uid: 'player', quem, x: hunt.pos.x, y: hunt.pos.y, v: ganho, color: '#00ff66' });
    }
  }
  const colheita = a.get('colheita-de-almas');
  if (colheita && hunt) {
    const agora = agoraDe(hunt);
    const antes = hunt.almas && hunt.almas.ate > agora ? hunt.almas.n : 0;
    hunt.almas = { n: Math.min(colheita.max, antes + 1), ate: agora + colheita.segundos * 1000 };
  }
}

/** O texto do efeito, com os números da configuração ("+30% de dano ..."). */
export function textoDoEfeito(efeito) {
  const ficha = efeito && EFEITOS[efeito.tipo]?.[efeito.id];
  if (!ficha) return null;
  return { nome: ficha.nome, tipo: efeito.tipo, texto: ficha.texto.replace(/\{(\w+)\}/g, (_, k) => String(ficha[k] ?? '')) };
}
