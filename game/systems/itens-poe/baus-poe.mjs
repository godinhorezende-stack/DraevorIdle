// Os BAÚS do PoE nas caçadas (dono, 03/11 — "tem que estar tudo 100%": a nota "as caçadas não têm baús" deixa de valer). Só no modo PoE.
//
// No PoE as áreas da campanha e os mapas têm baús espalhados (Normais, Mágicos e Raros), que se abrem ao passar perto e soltam itens. Aqui:
//   - cada INSTÂNCIA de uma área do PoE (`hunt.poeArea`) ou de um mapa (`hunt.poeMapa`) ganha `POR_AREA` baús, cada um numa casa livre e
//     alcançável perto de um monstro sorteado (a rota do personagem passa pelos monstros — o idle também passa pelos baús); o mapa único com
//     "Área contém um Grande Baú" põe o Grande Baú a mais (`fatoresDaInstancia(...).baus.grandes`);
//   - a RARIDADE do baú sai do mesmo sorteio da raridade dos monstros do PoE (`modificadores-monstro.sortearRaridade`: Mágico 10%, Raro 2%);
//   - o baú é um ENCONTRO da instância (`instancia.encontros`, tipos `bau-poe-normal`/`-magico`/`-raro`/`-grande`): o cliente já desenha os
//     baús (`encontros-na-tela.mjs`), o clique abre (`sessao.interagirComEncontro`, a até 2 casas), "X% de chance de abrir Baús próximos
//     quando você Conjurar uma Magia" e "Seus Clamores abrem Baús" também (`acoes.abrirBausAoConjurar`, `abrirNoRaio`). Não é obrigatório e
//     não expira; o baú que fica fechado quando a instância acaba se perde com ela (a instância seguinte sorteia os dela — 03/11: o comentário
//     antigo dizia que "a seguinte leva os que ficaram fechados", o que o código nunca fez);
//   - o lugar dos baús sai da SEMENTE da instância (`instancia.semente`, a dos encontros — `encontros/sorteio.mjs`): recalcular dá o mesmo;
//   - ABRE AO PASSAR: a cada tique, o baú disponível a até `ALCANCE` casas de você (no seu andar) abre (`abrirAoPassar`);
//   - (03/11) O IDLE PASSA PELOS BAÚS, como o jogador do PoE que abre os baús no caminho (a sonda: 1/3 dos baús ficava fechado — 36 de 54 em 18
//     áreas; os de quem ataca de longe, que para no alcance da arma, quase nunca): sem nada à vista, a Caça Automática vai ao baú fechado mais
//     perto A PÉ quando nenhum monstro da instância está mais perto (`bauMaisPerto`, no `cacadas.tique`), e (nas áreas da campanha) os baús alcançáveis do seu andar
//     SEGURAM o fim da sala no automático (`seguramOClear`) até abertos — no máximo `SEGURA_O_CLEAR_MS` depois do último monstro;
//   - o LOOT pela tabela do jogo — a mesma do monstro da raridade do baú (`jogo.dropsDoMonstro`, `moedas.dropDoMonstro`, `jogo.ouroDoMonstro`):
//     Normal = a do monstro Normal, Mágico = Mágico, Raro = Raro, Grande Baú = Único; no nível da área; × a sua quantidade de itens (Buff Power,
//     o afixo Loot) e a do mapa; a Raridade de Itens sua + a do mapa + "Baús têm a Raridade de Itens aumentada em X%" (o mapa único).
import { registrarTipo } from '../encontros/tipos.mjs';
import * as Encontros from '../encontros/estado.mjs';
import * as Eventos from '../encontros/eventos.mjs';
import { casasAlcancaveis, daSala } from '../hunt/instancia.mjs';
import { bfsDistancias, distancia } from '../hunt/caminho.mjs';
import { novaSemente, rolar } from '../encontros/sorteio.mjs';
import { nomeDaHunt } from '../hunt/terreno.mjs';
import * as Mapas from './mapas.mjs';
import { REGRAS as REGRAS_POE } from './catalogo.mjs';
import * as Anuncios from '../anuncios.mjs';
import * as DropsDoSite from '../drops-do-site.mjs';
import { andarDaGrade } from '../hunt/andares.mjs';
import { salaDe } from '../hunt/sala.mjs';
import * as Protecao from '../protecao.mjs';
import { ligado } from './catalogo.mjs';
import { sortearRaridade } from './modificadores-monstro.mjs';
import * as ItensPoeJogo from './jogo.mjs';
import * as MoedasPoe from './moedas.mjs';
import * as ModsPoe from './mods-poe.mjs';
import * as Bolsa from '../bolsa.mjs';
import * as Ficha from '../ficha.mjs';
import * as BuffPower from '../buffpower.mjs';
import * as Afixos from '../afixos.mjs';
import { VALOR_DA_MOEDA } from '../inventario.mjs';

/** Quantos baús comuns por instância (sem fonte no PoE — decisão registrada: "poucos por área"). */
export const POR_AREA = 3;
/** Até onde (casas) o baú abre ao passar: o alcance de interação do jogo (`encontros-na-tela.ALCANCE_DE_INTERACAO`, o "Chegue mais perto"). */
export const ALCANCE = 2;
/** O raio (casas) em volta do monstro-âncora onde o baú procura casa livre. */
const RAIO_DA_ANCORA = 3;
const ID_DO_OURO = 3031;
/** (03/11) Quanto (ms do relógio da caçada) os baús ainda fechados seguram o CLEAR depois do último monstro (escolha sem fonte: a rede de segurança
 * contra o baú que o idle não alcança). */
export const SEGURA_O_CLEAR_MS = 60_000;

export const RARIDADES = ['normal', 'magico', 'raro', 'grande'];
export const NOMES = { normal: 'Baú', magico: 'Baú Mágico', raro: 'Baú Raro', grande: 'Grande Baú' };
/** A tabela de loot (o tipo do monstro em `regras.json → drop`) de cada raridade de baú. */
export const TIPO_DO_LOOT = { normal: 'normal', magico: 'modificado', raro: 'raro', grande: 'unico' };
const DA_RARIDADE_DO_MONSTRO = { normal: 'normal', modificado: 'magico', raro: 'raro' };

export const tipoDoBau = (raridade) => `bau-poe-${raridade}`;
export const ehBauPoe = (e) => /^bau-poe-/.test(String(e?.tipo ?? ''));

const embaralhar = (lista, rng) => {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
};

/** A casa livre, andável (sem Safe Zone) e alcançável mais perto de `p` (anel por anel até `RAIO_DA_ANCORA`, sem a casa do próprio `p`). */
function casaPerto(grade, alcancaveis, p, ocupadas) {
  const z = p.z ?? grade.z;
  const casas = alcancaveis.get(z);
  if (!casas) return null;
  const g = Protecao.gradeDosBichos(andarDaGrade(grade, z));
  for (let r = 1; r <= RAIO_DA_ANCORA; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = p.x + dx;
        const y = p.y + dy;
        const k = `${x},${y}`;
        if (!g.andavel.has(k) || !casas.has(k) || ocupadas.has(`${k},${z}`)) continue;
        return { x, y, z };
      }
    }
  }
  return null;
}

/**
 * (03/11) O caminho do loot do MONSTRO (`hunt/combate.mjs`: `fatorDaCacaOnline`, `entregarMoedas`), registrado por `cacadas.mjs` — importar o
 * combate daqui fecharia um ciclo de módulos (combate → acoes → baus-poe). Sem o registro (um teste que só carrega este módulo): sem bônus e
 * o ouro inteiro no bolso de quem abriu.
 */
let doMonstro = null;
export function definirLootDoMonstro(f) {
  doMonstro = f;
}
const fatorOnline = (hunt) => doMonstro?.fatorDaCacaOnline?.(hunt) ?? 1;
function darOuroDoBau(ctx, n) {
  if (!(n > 0)) return;
  if (doMonstro?.entregarMoedas) return doMonstro.entregarMoedas(ctx, ID_DO_OURO, n);
  const valor = n * (VALOR_DA_MOEDA[ID_DO_OURO] ?? 1);
  ctx.estado.gold = (ctx.estado.gold ?? 0) + valor;
  if (ctx.estado.hunt?.sessao) ctx.estado.hunt.sessao.gold = (ctx.estado.hunt.sessao.gold ?? 0) + valor;
  Ficha.totais(ctx.estado).gold += valor;
  ctx.caiu.push({ id: ID_DO_OURO, count: n });
  ctx.conta('loot', ID_DO_OURO, n);
}

/** (03/11) O sorteio pela SEMENTE da instância (o mesmo número para a mesma instância — `encontros/sorteio.rolar`). */
export const rngDaSemente = (semente, chave = 'baus-poe') => {
  let i = 0;
  return () => rolar(semente, `${chave}#${i++}`) / 100;
};

/**
 * Põe os baús na instância nova (`Cacadas.povoar`): `POR_AREA` sorteados + os Grandes Baús do mapa (`baus.grandes`). `todos`: os monstros
 * que nasceram (`[{ z, m }]`, as âncoras); `nivel`: o nível da área (o loot). Devolve os baús criados. (03/11: sem `rng`, sorteia pela
 * semente da instância — a dos encontros, criada aqui se a área não tem encontros.)
 */
export function porNaInstancia(instancia, { grade, inicio = null, todos = [], nivel = null, baus = null, rng = null } = {}) {
  if (!ligado() || !instancia || !grade) return [];
  if (!rng) rng = rngDaSemente((instancia.semente ??= novaSemente()));
  const alcancaveis = casasAlcancaveis(grade, inicio);
  const ocupadas = new Set(todos.map(({ z, m }) => `${m.x},${m.y},${z ?? grade.z}`));
  if (inicio) ocupadas.add(`${inicio.x},${inicio.y},${inicio.z ?? grade.z}`);
  for (const e of Object.values(instancia.encontros ?? {})) if (e.x != null) ocupadas.add(`${e.x},${e.y},${e.z ?? grade.z}`);
  const ancoras = embaralhar(todos.map(({ z, m }) => ({ x: m.x, y: m.y, z: z ?? grade.z })), rng);
  const grandes = Math.max(0, Math.round(Number(baus?.grandes) || 0));
  const raridades = [...Array.from({ length: grandes }, () => 'grande'), ...Array.from({ length: POR_AREA }, () => DA_RARIDADE_DO_MONSTRO[sortearRaridade(rng)] ?? 'normal')];
  const criados = [];
  let a = 0;
  for (const raridade of raridades) {
    let casa = null;
    while (!casa && a < ancoras.length) casa = casaPerto(grade, alcancaveis, ancoras[a++], ocupadas);
    if (!casa) break;
    ocupadas.add(`${casa.x},${casa.y},${casa.z}`);
    const id = `bau-poe-${criados.length + 1}`;
    const slot = {
      id, defId: 'bau-poe', tipo: tipoDoBau(raridade), nome: NOMES[raridade], raridade, estado: 'disponivel', disponivelEm: 0, tentativas: 0,
      obrigatorio: false, condicao: { tipo: 'sempre' }, x: casa.x, y: casa.y, z: casa.z, ...(Number(nivel) > 0 ? { nivel: Number(nivel) } : {}),
    };
    (instancia.encontros ??= {})[id] = slot;
    criados.push(slot);
  }
  return criados;
}

/**
 * O que um baú solta (puro, para o teste): `{ pecas, moedas, ouro }` pela tabela do monstro da raridade dele. `quantidade`: o fator de
 * quantidade de itens; `raridadeAumentada`: a Raridade de Itens (%); `achado`: o fator do ouro.
 */
export function lootDoBau(raridade, { nivel = 1, quantidade = 1, raridadeAumentada = 0, achado = 1, rng = Math.random } = {}) {
  const tipo = TIPO_DO_LOOT[raridade] ?? 'normal';
  return {
    pecas: ItensPoeJogo.dropsDoMonstro(nivel, tipo, rng, undefined, quantidade, raridadeAumentada),
    moedas: MoedasPoe.dropDoMonstro(tipo, rng, quantidade),
    ouro: ItensPoeJogo.ouroDoMonstro(nivel, tipo, rng, undefined, achado),
  };
}

/** O nível do loot do baú: o da instância (gravado no baú), o do mapa ou o da escala da fase; sem nenhum, o do personagem. */
const nivelDoBau = (e, hunt, estado) => e.nivel ?? salaDe(hunt)?.mapa?.nivel ?? hunt?.escala?.nivel ?? estado?.level ?? 1;

/**
 * Abre o baú `e` para `estado`: o loot na bolsa dele (o filtro de loot vale), o ouro no bolso, o evento "Loot of a" na tela. (03/11) O MESMO
 * caminho do loot do monstro do PoE (`hunt/combate.matarMonstro`): a Caça Online (`fatorDaCacaOnline`), os MAPAS dentro de um mapa
 * (`Mapas.sortearDrops`, pela tabela do monstro da raridade do baú), o ouro DIVIDIDO na party (`entregarMoedas`) e o anúncio do Único
 * (`Anuncios.dropRaro`, `DropsDoSite`); a Raridade dos baús do mapa único pelos fatores da instância (`Mapas.fatoresDaInstancia(...).baus`).
 */
export function pagar(estado, hunt, e, rng = Math.random, personagem = null) {
  if (!estado || !hunt) return [];
  const mapa = salaDe(hunt)?.mapa ?? null;
  const ficha = Ficha.combate(estado);
  const tipo = TIPO_DO_LOOT[e.raridade] ?? 'normal';
  const quantidade = BuffPower.fatorDeLoot(estado) * (1 + Afixos.de(estado, 'loot_bonus') / 100) * fatorOnline(hunt) * (1 + Math.max(0, Number(mapa?.quantidade) || 0) / 100);
  const raridadeAumentada = ModsPoe.valor(ficha, 'item_rarity') + (Number(mapa?.raridade) || 0) + (mapa ? Mapas.fatoresDaInstancia(mapa).baus.raridadePct : 0);
  const achado = 1 + (ficha.goldFind ?? 0) / 100;
  const { pecas, moedas, ouro } = lootDoBau(e.raridade, { nivel: nivelDoBau(e, hunt, estado), quantidade, raridadeAumentada, achado, rng });
  const sessao = hunt.sessao;
  const conta = (grupo, id, n, ses = sessao) => { if (ses?.itens?.[grupo]) ses.itens[grupo][id] = (ses.itens[grupo][id] ?? 0) + n; };
  const caiu = [];
  const onde = nomeDaHunt(hunt.huntId);
  for (const peca of pecas) {
    if (Bolsa.ignora(estado, peca.id, peca)) { conta('ignorado', peca.id, 1); continue; }
    if (!Bolsa.porNaBolsa(estado, peca.id, 1, peca)) break;
    caiu.push({ id: peca.id, count: 1 });
    conta('loot', peca.id, 1);
    // o Único do PoE: o servidor inteiro fica sabendo (como o do monstro)
    Anuncios.dropRaro({ quem: personagem?.nome ?? estado.nome ?? null, peca, bicho: e.nome, onde });
    DropsDoSite.anotarDropPoe({ quem: personagem?.nome ?? estado.nome ?? null, onde, bicho: e.nome, peca, estado }).catch((err) => console.error('drops-do-site', err.message));
  }
  // os MAPAS (dentro de um mapa): o sorteio do monstro da raridade do baú
  if (mapa) {
    for (const { tier } of Mapas.sortearDrops({ tierDaArea: mapa.tier, tipo, bonusDeQuantidade: Number(REGRAS_POE.drop?.bonusDeQuantidade?.[tipo]) || 0, quantidadePct: mapa.quantidade, rng })) {
      const m = ItensPoeJogo.mapaSorteado(tier, { raridadeAumentada });
      if (!m) continue;
      if (Bolsa.ignora(estado, m.id, m)) { conta('ignorado', m.id, 1); continue; }
      if (!Bolsa.porNaBolsa(estado, m.id, 1, m)) break;
      caiu.push({ id: m.id, count: 1 });
      conta('loot', m.id, 1);
    }
  }
  for (const moeda of moedas) {
    if (Bolsa.ignora(estado, moeda.id)) { conta('ignorado', moeda.id, moeda.count); continue; }
    if (!Bolsa.porNaBolsa(estado, moeda.id, moeda.count)) break;
    caiu.push(moeda);
    conta('loot', moeda.id, moeda.count);
  }
  // o OURO: no bolso, dividido na party como o do monstro
  const part = hunt.partilha;
  const juntos = part?.ativa && part.membros.length > 1 ? part.membros.filter((m) => m.estado === estado || m.estado?.hunt) : null;
  darOuroDoBau({ estado, juntos, sala: juntos ? salaDe(hunt) : null, caiu, conta }, ouro);
  Eventos.empurrar(hunt, [{ t: 'loot', name: e.nome, items: caiu }]);
  return caiu;
}

/**
 * (03/11) O baú do PoE disponível mais perto A PÉ no seu andar (`grade`: a do andar), fora o que se mostrou sem caminho há pouco: `{ e, d }`
 * (`d`: os passos até ele) ou null.
 */
export function bauMaisPerto(hunt, grade) {
  if (!ligado() || !hunt?.pos || !grade) return null;
  const inst = daSala(hunt);
  if (inst?.status !== 'ativa') return null;
  const z = hunt.z ?? grade.z;
  const agora = hunt.clock ?? 0;
  const baus = Object.values(inst.encontros ?? {}).filter((e) => ehBauPoe(e) && e.estado === 'disponivel' && e.x != null && (e.z ?? z) === z && (e.semCaminhoAte ?? 0) <= agora);
  if (!baus.length) return null;
  const dist = bfsDistancias(grade, hunt.pos);
  let melhor = null;
  for (const e of baus) {
    const d = distancia(hunt.pos, e) <= ALCANCE ? 0 : dist.em(e.x, e.y);
    if (d != null && (!melhor || d < melhor.d)) melhor = { e, d };
  }
  return melhor;
}

/**
 * (03/11) Os baús SEGURAM o CLEAR? Nas áreas da campanha, na Caça Automática (não na manual: lá quem anda é o jogador), vivo, com um baú do PoE
 * fechado e alcançável no seu andar — até `SEGURA_O_CLEAR_MS` depois de a sala ficar sem monstros (`instancia.bausSeguramDesde`).
 */
export function seguramOClear(estado, hunt, grade) {
  if (!ligado() || !hunt || hunt.modo === 'online' || !(estado?.hp > 0)) return false;
  // (só nas áreas da campanha: o MAPA do endgame se conclui ao limpar — a regra do dono, o loop de mapas —, e lá o idle só passa pelos baús que
  // estão mais perto que os monstros)
  if (salaDe(hunt)?.mapa) return false;
  const inst = daSala(hunt);
  if (!inst || !bauMaisPerto(hunt, grade)) return false;
  const agora = hunt.clock ?? 0;
  inst.bausSeguramDesde ??= agora;
  return agora - inst.bausSeguramDesde <= SEGURA_O_CLEAR_MS;
}

function definicao() {
  return {
    // O baú abre ao passar (`abrirAoPassar`; 03/11: o idle anda até ele — `bauMaisPerto` no `cacadas.tique`): 'escolha' tira o baú da ativação
    // automática à distância (`Encontros.avaliar`) sem pedir decisão nenhuma (o baú é opcional e não expira).
    idle: 'escolha',
    podeAtivar: () => ({ ok: true }),
    aoAtivar(ctx) {
      const { instancia, encontro: e, hunt, estado, agora, personagem } = ctx;
      if (estado && hunt) pagar(estado, hunt, e, Math.random, personagem ?? null);
      Encontros.concluir(instancia, e.id, { agora });
    },
  };
}
for (const r of RARIDADES) registrarTipo(tipoDoBau(r), definicao());

/** Os baús (qualquer `bau-*` disponível do seu andar) a até `raio` casas de você abrem, cada um com a `chance` (%). Devolve quantos abriram. */
export function abrirNoRaio(estado, hunt, personagem, raio, { chance = 100, so = null, rng = Math.random } = {}) {
  if (!ligado() || !hunt?.pos || !(raio >= 0) || !(chance > 0)) return 0;
  const inst = daSala(hunt);
  let abertos = 0;
  for (const e of Object.values(inst?.encontros ?? {})) {
    if (!String(e.tipo).startsWith('bau') || e.estado !== 'disponivel' || e.x == null || (e.z != null && e.z !== (hunt.z ?? e.z))) continue;
    if (so && !so(e)) continue;
    if (Math.max(Math.abs(hunt.pos.x - e.x), Math.abs(hunt.pos.y - e.y)) > raio || !(rng() * 100 < chance)) continue;
    if (Encontros.ativar(inst, e.id, { quem: personagem?.nome ?? null, agora: (hunt.anfitriao ?? hunt).clock ?? 0, hunt, estado, personagem }).ok) abertos++;
  }
  return abertos;
}

/** A cada tique (de cada um da sala): os baús do PoE a até `ALCANCE` casas abrem — "ao passar". */
export const abrirAoPassar = (estado, hunt, personagem) => (estado?.hp > 0 ? abrirNoRaio(estado, hunt, personagem, ALCANCE, { so: ehBauPoe }) : 0);
