// A FENDA do PoE (Breach) nos mapas (08/11, balão 0 sem efeito — o dono: "Criar os sistemas", pelo Anel da Fenda: "Propriedades são dobradas
// enquanto em uma Fenda"). Só no modo PoE.
//
// No PoE a Fenda é a mão no chão que, tocada, abre um círculo que se expande: dentro dele saem os monstros de UM dos cinco Senhores da Fenda (Xoph,
// Tul, Esh, Uul-Netol e Chayula) e você está "em uma Fenda" enquanto está no círculo; ela se fecha com o tempo. Aqui (no molde do Abismo —
// `abismo.mjs`):
//   - a instância de um MAPA do endgame tem a chance de `regras.fenda.chance` de uma Fenda, perto de um monstro, de um Senhor sorteado;
//   - ABRE AO CHEGAR PERTO (`alcance`): as ondas dos monstros do Senhor (`gamedata/itens-poe/fenda.json`, os status do poedb no nível do mapa),
//     a última com o comandante e Raros; fecha em `limiteMs`;
//   - aberta, você está EM UMA FENDA enquanto está a até `raio` casas dela (`hunt.poeEmFenda`): a condição `emFenda` e o Anel da Fenda, que
//     dobra os números da peça (`afixos.somarPeca`, `dobrado_em_fenda`).
import { readFileSync } from 'node:fs';
import { registrarTipo } from '../encontros/tipos.mjs';
import * as Encontros from '../encontros/estado.mjs';
import { iniciar as iniciarOndas, avancar } from '../encontros/ondas.mjs';
import { bichosDaSala, avisarSala } from '../encontros/sala.mjs';
import { novaSemente } from '../encontros/sorteio.mjs';
import { casasAlcancaveis, daSala } from '../hunt/instancia.mjs';
import { ligado, REGRAS } from './catalogo.mjs';
import { registrarDoPoedb, casaDoEncontro } from './abismo.mjs';
import { rngDaSemente } from './baus-poe.mjs';

export const DADOS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/fenda.json', import.meta.url), 'utf8'));
export const TIPO = 'fenda-poe';
const CFG = () => REGRAS?.fenda ?? {};

/** O monstro da Fenda no nível, registrado no bestiário; a chave. */
export const chaveDoMonstro = (slug, nivel) => registrarDoPoedb(DADOS.monstros[slug], slug, nivel);

/** As ondas de um Senhor no nível: a tropa e, na última, o comandante e Raros. */
export function ondasDo(senhor, nivel, rng = Math.random) {
  const lista = DADOS.senhores[senhor]?.monstros ?? [];
  const comandante = lista.find((s) => DADOS.monstros[s]?.comandante) ?? null;
  const tropa = lista.filter((s) => s !== comandante).length ? lista.filter((s) => s !== comandante) : lista;
  const grupoDe = (n) => {
    const conta = new Map();
    for (let i = 0; i < n; i++) {
      const slug = tropa[Math.floor(rng() * tropa.length)];
      conta.set(slug, (conta.get(slug) ?? 0) + 1);
    }
    return [...conta].map(([slug, qtd]) => ({ key: chaveDoMonstro(slug, nivel), qtd: Math.min(8, qtd) })).filter((c) => c.key);
  };
  const [a, b, c] = CFG().monstrosPorOnda ?? [5, 7, 8];
  return [
    { criaturas: grupoDe(a) },
    { criaturas: grupoDe(b), raridade: 'modificado' },
    { criaturas: [...grupoDe(c), ...(comandante ? [{ key: chaveDoMonstro(comandante, nivel), qtd: 1 }] : [])], raridade: 'raro' },
  ];
}

/** Põe (ou não, pela chance) a Fenda na instância nova de um MAPA (`Cacadas.povoar`). Pela semente da instância. Devolve o encontro, ou null. */
export function porNaInstancia(instancia, { grade, inicio = null, todos = [], nivel = null, ehMapa = false, rng = null } = {}) {
  if (!ligado() || !instancia || !grade || !ehMapa || !(Number(nivel) > 0)) return null;
  if (!rng) rng = rngDaSemente((instancia.semente ??= novaSemente()), 'fenda-poe');
  if (!(rng() < (Number(CFG().chance) || 0))) return null;
  const senhores = Object.keys(DADOS.senhores);
  const senhor = senhores[Math.floor(rng() * senhores.length)];
  const ocupadas = new Set(todos.map(({ z, m }) => `${m.x},${m.y},${z ?? grade.z}`));
  for (const e of Object.values(instancia.encontros ?? {})) if (e.x != null) ocupadas.add(`${e.x},${e.y},${e.z ?? grade.z}`);
  if (inicio) ocupadas.add(`${inicio.x},${inicio.y},${inicio.z ?? grade.z}`);
  const casa = casaDoEncontro({ grade, alcancaveis: casasAlcancaveis(grade, inicio), todos, ocupadas, rng });
  if (!casa) return null;
  const e = {
    id: 'fenda-poe-1', defId: TIPO, tipo: TIPO, nome: `Fenda de ${DADOS.senhores[senhor].nome}`, senhor, nivel: Number(nivel), estado: 'disponivel', disponivelEm: 0,
    tentativas: 0, obrigatorio: false, condicao: { tipo: 'sempre' }, x: casa.x, y: casa.y, z: casa.z, raio: Number(CFG().raio) || 6,
    ondas: ondasDo(senhor, nivel, rng), pausaMs: Number(CFG().pausaMs) || 2000, limiteMs: Number(CFG().limiteMs) || 90000,
  };
  (instancia.encontros ??= {})[e.id] = e;
  return e;
}

registrarTipo(TIPO, {
  // abre ao chegar perto (`abrirAoPassar`), como no PoE — o idle não a ativa de longe
  idle: 'escolha',
  podeAtivar: () => ({ ok: true }),
  aoAtivar(ctx) {
    if (ctx.estado && ctx.hunt) avisarSala(ctx.hunt, ctx.estado, `A ${ctx.encontro.nome} se abriu!`);
    iniciarOndas(ctx, ctx.encontro);
  },
  verificar(ctx) {
    avancar(ctx, ctx.encontro);
    if (ctx.hunt) for (const m of bichosDaSala(ctx.hunt)) if (m.encontro === ctx.encontro.id && !m.fenda) m.fenda = ctx.encontro.senhor;
  },
});

/** Você está EM UMA FENDA? (a Fenda aberta, a até o raio dela, no seu andar) */
export function dentro(hunt) {
  const inst = daSala(hunt);
  if (!inst || !hunt?.pos) return false;
  return Object.values(inst.encontros ?? {}).some((e) => e.tipo === TIPO && e.estado === 'ativo' && (e.z == null || e.z === (hunt.z ?? e.z))
    && Math.max(Math.abs(hunt.pos.x - e.x), Math.abs(hunt.pos.y - e.y)) <= (e.raio ?? 6));
}

/**
 * A cada tique: a Fenda disponível a até `alcance` casas se abre; e o "em uma Fenda" (`hunt.poeEmFenda`) acompanha você — mudou, a ficha é
 * refeita (`invalidar`: o Anel da Fenda dobra ou desdobra). Devolve se a Fenda abriu.
 */
export function tique(estado, hunt, personagem, invalidar = () => {}) {
  if (!ligado() || !hunt?.pos) return false;
  const inst = daSala(hunt);
  let abriu = false;
  const alcance = Number(CFG().alcance) || 3;
  if (estado?.hp > 0) {
    for (const e of Object.values(inst?.encontros ?? {})) {
      if (e.tipo !== TIPO || e.estado !== 'disponivel' || (e.z != null && e.z !== (hunt.z ?? e.z))) continue;
      if (Math.max(Math.abs(hunt.pos.x - e.x), Math.abs(hunt.pos.y - e.y)) > alcance) continue;
      abriu = Encontros.ativar(inst, e.id, { quem: personagem?.nome ?? null, agora: (hunt.anfitriao ?? hunt).clock ?? 0, hunt, estado, personagem }).ok;
      break;
    }
  }
  const agora = dentro(hunt);
  if (agora !== !!hunt.poeEmFenda) {
    if (agora) hunt.poeEmFenda = true;
    else delete hunt.poeEmFenda;
    invalidar(estado);
  }
  return abriu;
}
