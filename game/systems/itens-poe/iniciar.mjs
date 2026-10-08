// A INICIALIZAÇÃO do jogo do PoE (o oficial): as bases do PoE no catálogo de itens, os chefes pináculo, a campanha do PoE (os 10 atos e
// as áreas sobre os mapas do Draevor), os modificadores de monstro, as gemas e os suportes do PoE e as moedas. Uma função só, para TODO
// processo ou thread que roda o jogo carregar o MESMO jogo: o servidor (`backend/index.mjs`), a thread da caçada offline
// (`simulacao-offline-worker.mjs`), as threads do tique (`simulador-tique-worker.mjs`) e o processo da Validação
// (`admin/validacao-runner.mjs`). Antes só o servidor carregava: a caçada offline numa área do PoE quebrava ("reading 'andares'") e a
// Validação dava as fases do poe-ato-1 como "hunt que não existe".
//
// Só PONTOS DE ENTRADA importam este arquivo (nenhum módulo de `systems/` o importa): é isso que deixa ele depender de tudo sem criar
// ciclo. Os ganchos do motor (`acoes`, `skills/gemas`, `skills/reforcos`, o catálogo de itens) entram por import dinâmico, só na chamada.
import { ligado } from './catalogo.mjs';
import * as ItensPoeJogo from './jogo.mjs';
import * as Pinaculos from './pinaculos.mjs';
import * as CampanhaPoe from './campanha.mjs';
import * as ModificadoresMonstroPoe from './modificadores-monstro.mjs';
import * as GemasPoe from './gemas-poe.mjs';
import * as SuportesPoe from './suportes-poe.mjs';
import * as MoedasPoe from './moedas.mjs';

/** Os ganchos do jogo de verdade (a magia de cada gema, a gema ativa, o reforço, o suporte) e o catálogo de itens. */
async function ganchosDoJogo() {
  const [{ ITEM_CATALOG }, Acoes, GemasDeSkill, Reforcos] = await Promise.all([
    import('../dados.mjs'),
    import('../acoes.mjs'),
    import('../skills/gemas.mjs'),
    import('../skills/reforcos.mjs'),
  ]);
  return {
    catalogoDeItens: ITEM_CATALOG,
    registrarGema: (g) => (Acoes.registrarAcao(g.entry), GemasDeSkill.registrarAtiva(g)),
    registrarReforco: Reforcos.registrar,
    registrarSuporte: GemasDeSkill.registrarSuporte,
  };
}

let iniciando = null;

/**
 * Carrega o jogo do PoE neste processo/thread (uma vez: chamar de novo devolve a mesma promessa). No modo clássico
 * (`DRAEVOR_CLASSICO=1`) não faz nada e devolve null. Os ganchos (`catalogoDeItens`, `registrar*`) vêm do jogo se não forem passados.
 * `log`: as linhas do resumo (o servidor imprime).
 */
export function iniciarJogoDoPoe(opcoes = {}) {
  if (!ligado()) return Promise.resolve(null);
  return (iniciando ??= carregar(opcoes));
}

async function carregar({ log = () => {}, ...dados }) {
  const { catalogoDeItens, registrarGema, registrarReforco, registrarSuporte } = { ...(await ganchosDoJogo()), ...dados };
  const r = ItensPoeJogo.iniciar(catalogoDeItens);
  if (r.porBase.size) log(`itens do PoE: ${r.porBase.size} bases no catálogo (ids ${ItensPoeJogo.PRIMEIRO_ID}+); sem slot: ${r.naoEquipaveis.join(', ')}`);
  const pinaculos = Pinaculos.iniciar();
  if (pinaculos.length) log(`chefes pináculo do PoE: ${pinaculos.length} no painel de Bosses (${pinaculos.join(', ')})`);
  // A campanha do PoE no lugar da do Draevor (os 10 atos, as áreas sobre os mapas do Draevor, os chefes de ato).
  const campanha = CampanhaPoe.iniciar();
  // Os modificadores de monstro do PoE (Mágico 1, Raro 2 a 4) e os ocultos de cada raridade.
  const modsDeMonstro = ModificadoresMonstroPoe.iniciar();
  if (modsDeMonstro.modificadores) log(`modificadores de monstro do PoE: ${modsDeMonstro.modificadores}`);
  // As GEMAS do PoE no jogo (substituem as ativas do Draevor; a coleção do dono, poe-gemas-poedb): a magia, o item e o buff de cada uma.
  const gemasPoe = await GemasPoe.iniciar({ registrarGema, registrarReforco });
  if (gemasPoe.gemas) log(`gemas do PoE: ${gemasPoe.gemas} (${Object.entries(gemasPoe.porStatus).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  const suportesPoe = SuportesPoe.iniciar({ registrarSuporte });
  // As moedas empilháveis do PoE (os itens, a loja da Zuma; o efeito na Forja do PoE — `itens-poe/moedas.mjs`).
  const moedasPoe = MoedasPoe.iniciar();
  if (moedasPoe) log(`moedas do PoE: ${moedasPoe} novas no catálogo (${MoedasPoe.MOEDAS.length} ao todo)`);
  if (suportesPoe.suportes) log(`suportes do PoE: ${suportesPoe.suportes} (${Object.entries(suportesPoe.porStatus).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  if (campanha.atos.length) log(`campanha do PoE: ${campanha.atos.length} atos, ${campanha.areas} áreas${campanha.problemas.length ? ` — ${campanha.problemas.length} problemas: ${campanha.problemas.slice(0, 3).join(' | ')}` : ''}`);
  return { bases: r.porBase.size, campanha, gemas: gemasPoe.gemas ?? 0, suportes: suportesPoe.suportes ?? 0 };
}
