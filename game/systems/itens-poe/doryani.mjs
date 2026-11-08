// O MAQUINÁRIO DE DORYANI (08/11 — o dono: "Janela de escolha"): "Chefe Único é ampliado pelas escolhas do Jogador". O poedb: "há três caminhos e
// uma escada para a sala do chefe, vazia. Cada caminho leva a um dos braços do chefe; no fim de cada um, três botões: cada botão amplia aquele braço
// com um elemento — fogo, gelo ou raio. Depois de ampliar os braços, você enfrenta o chefe que criou. A recompensa é a das escolhas. A Assembleia
// Ápice sempre derruba a Ilusão de Doryani." Aqui:
//   - os três BRAÇOS DE DORYANI são marcadores no mapa (os pontos mais longe da entrada, longe um do outro): perto de cada um, a janela pede o
//     elemento (`escolhas` — `cacadas`/a tela; em grupo, o líder decide; o idle não escolhe);
//   - cada braço ampliado dá ao chefe do mapa o dano do elemento (`DANO_POR_BRACO`: X% do Físico como dano extra daquele elemento) e um Raro a
//     mais no drop dele (o PoE não publica os números);
//   - o chefe sempre derruba a ILUSÃO DE DORYANI na base do elemento mais escolhido (Fogo: Grevas do Leviatã; Gelo: Botas de Fuga; Raio: Botas do
//     Feiticeiro); sem escolha, uma das três.
import { registrarTipo } from '../encontros/tipos.mjs';
import * as Encontros from '../encontros/estado.mjs';
import { bichosDaSala, avisarSala } from '../encontros/sala.mjs';
import { bfsDistancias } from '../hunt/caminho.mjs';
import { andarDaGrade } from '../hunt/andares.mjs';

export const TIPO = 'braco-doryani';
/** Os elementos de cada braço: o do jogo, o nome e a base da Ilusão de Doryani. */
export const ELEMENTOS = Object.freeze({
  fire: { nome: 'Fogo', base: 'Grevas do Leviatã' },
  ice: { nome: 'Gelo', base: 'Botas de Fuga' },
  energy: { nome: 'Raio', base: 'Botas do Feiticeiro' },
});
/** O Físico do chefe como dano extra do elemento, por braço ampliado (%). */
export const DANO_POR_BRACO = 40;
export const NOMES_DOS_BRACOS = Object.freeze(['Braço Esquerdo de Doryani', 'Braço Direito de Doryani', 'Braço Central de Doryani']);

/** Os três Braços na instância: os pontos alcançáveis do andar da entrada mais longe dela, a pelo menos 12 casas um do outro. */
export function porNaInstancia(instancia, { grade, inicio, alcancaveis } = {}) {
  if (!instancia || !grade || !inicio) return [];
  const z = inicio.z ?? grade.z ?? 0;
  const dist = bfsDistancias(andarDaGrade(grade, z), inicio);
  const casas = [...(alcancaveis?.get(z) ?? [])].map((k) => [k.split(',').map(Number), dist.get(k)]).filter(([, d]) => Number.isFinite(d)).sort((a, b) => b[1] - a[1]);
  const escolhidas = [];
  for (const [[x, y]] of casas) {
    if (escolhidas.length >= 3) break;
    if (escolhidas.every((c) => Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) >= 12)) escolhidas.push({ x, y });
  }
  return escolhidas.map((c, i) => {
    const e = {
      id: `${TIPO}-${i + 1}`, defId: TIPO, tipo: TIPO, nome: NOMES_DOS_BRACOS[i], descricao: 'Amplie este braço do chefe com um elemento: ele fica mais forte e a recompensa sobe.',
      estado: 'disponivel', disponivelEm: 0, tentativas: 0, obrigatorio: false, condicao: { tipo: 'sempre' }, x: c.x, y: c.y, z,
      escolhas: Object.entries(ELEMENTOS).map(([valor, el]) => ({ valor, rotulo: el.nome })),
    };
    (instancia.encontros ??= {})[e.id] = e;
    return e;
  });
}

/** Os braços ampliados da instância: `['fire', 'ice', …]`. */
export const escolhas = (instancia) => Object.values(instancia?.encontros ?? {}).filter((e) => e.tipo === TIPO && e.estado === 'concluido' && ELEMENTOS[e.escolha]).map((e) => e.escolha);
/** O elemento mais escolhido (o empate e a falta de escolha: ao acaso entre os empatados / os três). */
export function elementoDaIlusao(lista, rng = Math.random) {
  const cont = {};
  for (const el of lista ?? []) cont[el] = (cont[el] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(cont));
  const empatados = max ? Object.keys(cont).filter((k) => cont[k] === max) : Object.keys(ELEMENTOS);
  return empatados[Math.floor(rng() * empatados.length)];
}

/** O braço ampliado vale no chefe do mapa (vivo): o dano do elemento e o Raro a mais. */
function ampliarOChefe(hunt, elemento) {
  for (const m of bichosDaSala(hunt)) {
    if (!m.chefeDoMapa || !(m.hp > 0)) continue;
    m.danoExtraPct = { ...(m.danoExtraPct ?? {}), [elemento]: (m.danoExtraPct?.[elemento] ?? 0) + DANO_POR_BRACO };
    m.rarosExtras = (m.rarosExtras ?? 0) + 1;
    m.rarosClasse ??= 'Boots';
  }
}

registrarTipo(TIPO, {
  // a escolha é do jogador (o idle não escolhe; em grupo, o líder)
  idle: 'escolha',
  decisaoDoLider: true,
  podeAtivar: ({ encontro }) => (ELEMENTOS[encontro.escolha] ? { ok: true } : { ok: false, motivo: 'escolha o elemento do braço' }),
  aoAtivar(ctx) {
    const e = ctx.encontro;
    if (ctx.hunt) ampliarOChefe(ctx.hunt, e.escolha);
    Encontros.concluir(ctx.instancia, e.id, { agora: ctx.agora });
    if (ctx.estado && ctx.hunt) avisarSala(ctx.hunt, ctx.estado, `${e.nome}: ampliado com ${ELEMENTOS[e.escolha].nome}.`);
  },
});
