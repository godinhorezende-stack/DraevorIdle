// O ABISMO do PoE nas caçadas (08/11, balão 0 sem efeito — o dono: "Criar a Fenda do Abismo": nos mapas e nas áreas do fim, a chance de uma
// fenda que solta ondas de monstros Abissais do poedb; no fim, um baú com chance de Joia Abissal). Só no modo PoE.
//
// No PoE "por toda a segunda parte […] você encontrará fissuras (chamadas de Abismos) que se abrem quando você se aproxima e monstros aparecerão
// dela" (o painel de ajuda do poedb); "cada área geralmente contém apenas um desses grupos" (os Obscurecidos, os Sangue-negro e a Legião do
// Fosso); fechado o fosso, "pode gerar um Repositório Abissal". Aqui:
//   - a instância de um MAPA ou de uma área dos atos 6 a 10 (`hunt.poeMapa` / `hunt.poeArea`) tem a chance de `regras.abismo.chance` de um
//     Abismo, numa casa livre perto de um monstro (como os baús — `baus-poe.mjs`), com UM grupo sorteado;
//   - ABRE AO CHEGAR PERTO (`abrirAoPassar`, a até `alcance` casas): as ondas do motor de ondas (`encontros/ondas.mjs`) com os monstros do grupo
//     (+ o Caminhante e o Estrangulador Abissais), no nível da área — a Vida, o Dano e a Experiência do poedb em % do monstro padrão do nível
//     (`gamedata/itens-poe/abismo.json`); a última onda é o FOSSO, com o comandante e Raros; o tempo (`limiteMs`) fecha o Abismo, como a fenda;
//   - os monstros saem marcados (`abissal`): "contra Monstros Abissais" (o Nebulis) vale neles (`condicoes-poe` → `alvoAbissal`);
//   - vencidas as ondas, no lugar do Abismo nasce o REPOSITÓRIO ABISSAL: um baú Raro do PoE (`baus-poe.mjs`, o mesmo loot) que ainda tem
//     `chanceDaJoiaPct` de uma Joia Abissal a mais.
import { readFileSync } from 'node:fs';
import { registrarTipo } from '../encontros/tipos.mjs';
import * as Encontros from '../encontros/estado.mjs';
import { iniciar as iniciarOndas, avancar } from '../encontros/ondas.mjs';
import { bichosDaSala, avisarSala } from '../encontros/sala.mjs';
import { novaSemente } from '../encontros/sorteio.mjs';
import { casasAlcancaveis, daSala } from '../hunt/instancia.mjs';
import { andarDaGrade } from '../hunt/andares.mjs';
import * as Protecao from '../protecao.mjs';
import { ligado, REGRAS } from './catalogo.mjs';
import * as Monstros from './monstros.mjs';
import { rngDaSemente, tipoDoBau } from './baus-poe.mjs';

export const DADOS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/abismo.json', import.meta.url), 'utf8'));
export const TIPO = 'abismo-poe';
export const NOME = 'Abismo';
export const NOME_DO_REPOSITORIO = 'Repositório Abissal';
const CFG = () => REGRAS?.abismo ?? {};
const ABISSAIS = new Set([...Object.values(DADOS.grupos).flatMap((g) => g.monstros), ...DADOS.comuns]);
export const ehAbissal = (slug) => ABISSAIS.has(slug);

/** O monstro abissal no nível (os status do poedb: o padrão do nível × a % dele), registrado no bestiário; a chave. */
export function chaveDoMonstro(slug, nivel) {
  const d = DADOS.monstros[slug];
  if (!d) return null;
  const n = Math.max(1, Math.min(100, Math.round(Number(nivel) || 1)));
  const padrao = (k) => DADOS.porNivel[k][n - 1];
  const vida = (padrao('vida') * d.vidaPct) / 100;
  return Monstros.registrar({
    slug, nome: d.nome, nivel: n, vida, escudoDeEnergia: (vida * (d.esDaVidaPct ?? 0)) / 100, dano: (padrao('dano') * d.danoPct) / 100,
    tempoAtaque: d.tempoAtaque, experiencia: (padrao('experiencia') * d.expPct) / 100, armadura: 0, evasao: 0, resistencias: { ...d.resistencias },
  }, 'demon');
}

/** As ondas de um grupo no nível: duas fendas e o fosso (a última, com o comandante e Raros). */
export function ondasDo(grupo, nivel, rng = Math.random) {
  const lista = DADOS.grupos[grupo]?.monstros ?? [];
  const comandante = lista.find((s) => DADOS.monstros[s]?.comandante) ?? null;
  const tropa = [...lista.filter((s) => s !== comandante), ...DADOS.comuns];
  const sortear = () => tropa[Math.floor(rng() * tropa.length)];
  const grupoDe = (n) => {
    const conta = new Map();
    for (let i = 0; i < n; i++) {
      const slug = sortear();
      conta.set(slug, (conta.get(slug) ?? 0) + 1);
    }
    return [...conta].map(([slug, qtd]) => ({ key: chaveDoMonstro(slug, nivel), qtd: Math.min(8, qtd) })).filter((c) => c.key);
  };
  const [a, b, c] = CFG().monstrosPorOnda ?? [4, 6, 8];
  return [
    { criaturas: grupoDe(a) },
    { criaturas: grupoDe(b), raridade: 'modificado' },
    { criaturas: [...grupoDe(c), ...(comandante ? [{ key: chaveDoMonstro(comandante, nivel), qtd: 1 }] : [])], raridade: 'raro' },
  ];
}

/** O Abismo vale nesta instância? (o mapa do endgame, ou uma área dos atos 6 a 10) */
export function valeNaArea(hunt) {
  if (hunt?.poeMapa) return 'mapa';
  // (`poeArea`: true nos dados da hunt — o id da área é o da hunt)
  const area = hunt?.poeArea ? Monstros.CAMPANHA.areas[typeof hunt.poeArea === 'string' ? hunt.poeArea : hunt.id ?? hunt.huntId] : null;
  return area && !area.cidade && Number(area.ato) >= 6 ? 'campanha' : null;
}

/** A casa livre, andável e alcançável mais perto de `p` (de 2 a 4 casas dele), fora as `ocupadas`. */
function casaPerto(grade, alcancaveis, p, ocupadas) {
  const z = p.z ?? grade.z;
  const casas = alcancaveis.get(z);
  if (!casas) return null;
  const g = Protecao.gradeDosBichos(andarDaGrade(grade, z));
  for (let r = 2; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const k = `${p.x + dx},${p.y + dy}`;
        if (g.andavel.has(k) && casas.has(k) && !ocupadas.has(`${k},${z}`)) return { x: p.x + dx, y: p.y + dy, z };
      }
    }
  }
  return null;
}

/**
 * Põe (ou não, pela chance) o Abismo na instância nova (`Cacadas.povoar`, depois dos baús). `onde`: 'mapa' ou 'campanha' (`valeNaArea`);
 * `nivel`: o nível dos monstros. Pela semente da instância. Devolve o encontro, ou null.
 */
export function porNaInstancia(instancia, { grade, inicio = null, todos = [], nivel = null, onde = null, rng = null } = {}) {
  if (!ligado() || !instancia || !grade || !onde || !(Number(nivel) > 0)) return null;
  if (!rng) rng = rngDaSemente((instancia.semente ??= novaSemente()), 'abismo-poe');
  if (!(rng() < (Number(CFG().chance?.[onde]) || 0))) return null;
  const grupos = Object.keys(DADOS.grupos);
  const grupo = grupos[Math.floor(rng() * grupos.length)];
  const alcancaveis = casasAlcancaveis(grade, inicio);
  const ocupadas = new Set(todos.map(({ z, m }) => `${m.x},${m.y},${z ?? grade.z}`));
  for (const e of Object.values(instancia.encontros ?? {})) if (e.x != null) ocupadas.add(`${e.x},${e.y},${e.z ?? grade.z}`);
  if (inicio) ocupadas.add(`${inicio.x},${inicio.y},${inicio.z ?? grade.z}`);
  // (a âncora: um monstro da metade do caminho para a frente — o Abismo não nasce em cima da entrada)
  const ancoras = todos.slice(Math.floor(todos.length / 3));
  let casa = null;
  for (let i = 0; i < 12 && !casa && ancoras.length; i++) {
    const { z, m } = ancoras[Math.floor(rng() * ancoras.length)];
    casa = casaPerto(grade, alcancaveis, { x: m.x, y: m.y, z: z ?? grade.z }, ocupadas);
  }
  if (!casa) return null;
  const e = {
    id: 'abismo-poe-1', defId: TIPO, tipo: TIPO, nome: `${NOME} (${DADOS.grupos[grupo].nome})`, grupo, nivel: Number(nivel), estado: 'disponivel', disponivelEm: 0,
    tentativas: 0, obrigatorio: false, condicao: { tipo: 'sempre' }, x: casa.x, y: casa.y, z: casa.z,
    ondas: ondasDo(grupo, nivel, rng), pausaMs: Number(CFG().pausaMs) || 3000, limiteMs: Number(CFG().limiteMs) || 120000,
  };
  (instancia.encontros ??= {})[e.id] = e;
  return e;
}

/** Os monstros das ondas deste Abismo saem marcados como Abissais (`alvoAbissal`). */
function marcar(hunt, e) {
  for (const m of bichosDaSala(hunt)) if (m.encontro === e.id && !m.abissal) m.abissal = true;
}

/** Fechado o Abismo: o Repositório Abissal nasce no lugar dele (um baú Raro do PoE que ainda pode trazer uma Joia Abissal). */
function porRepositorio(instancia, e) {
  const id = `${e.id}-repositorio`;
  if (instancia.encontros[id]) return;
  instancia.encontros[id] = {
    id, defId: 'bau-poe', tipo: tipoDoBau('raro'), nome: NOME_DO_REPOSITORIO, raridade: 'raro', abissal: true, estado: 'disponivel', disponivelEm: 0, tentativas: 0,
    obrigatorio: false, condicao: { tipo: 'sempre' }, x: e.x, y: e.y, ...(e.z != null ? { z: e.z } : {}), nivel: e.nivel,
  };
}

registrarTipo(TIPO, {
  // abre ao chegar perto (`abrirAoPassar`), como no PoE — o idle não o ativa de longe
  idle: 'escolha',
  podeAtivar: () => ({ ok: true }),
  aoAtivar(ctx) {
    if (ctx.estado && ctx.hunt) avisarSala(ctx.hunt, ctx.estado, `O ${ctx.encontro.nome} se abriu!`);
    iniciarOndas(ctx, ctx.encontro);
    if (ctx.hunt) marcar(ctx.hunt, ctx.encontro);
  },
  verificar(ctx) {
    const e = ctx.encontro;
    avancar(ctx, e);
    if (ctx.hunt) marcar(ctx.hunt, e);
    if (e.estado === 'concluido') porRepositorio(ctx.instancia, e);
  },
});

/** A cada tique: o Abismo disponível a até `alcance` casas de você (no seu andar) se abre. Devolve se abriu. */
export function abrirAoPassar(estado, hunt, personagem) {
  if (!ligado() || !(estado?.hp > 0) || !hunt?.pos) return false;
  const inst = daSala(hunt);
  const alcance = Number(CFG().alcance) || 4;
  for (const e of Object.values(inst?.encontros ?? {})) {
    if (e.tipo !== TIPO || e.estado !== 'disponivel' || (e.z != null && e.z !== (hunt.z ?? e.z))) continue;
    if (Math.max(Math.abs(hunt.pos.x - e.x), Math.abs(hunt.pos.y - e.y)) > alcance) continue;
    return Encontros.ativar(inst, e.id, { quem: personagem?.nome ?? null, agora: (hunt.anfitriao ?? hunt).clock ?? 0, hunt, estado, personagem }).ok;
  }
  return false;
}
