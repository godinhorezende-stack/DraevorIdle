// A ÁRVORE DE PASSIVAS única (etapa 7 do plano, 30/09) — o motor.
//
// Um GRAFO de nós conectados (`gamedata/passivas/arvore.json`, gerado de
// clusters.json por tools/gerar-arvore-passiva.mjs) que TODAS as classes
// dividem: cada classe começa num nó de início diferente e caminha para onde
// quiser (Knight → Fire/Spell é permitido). Os nós são DADOS — adicionar,
// tirar ou mexer num nó não passa por aqui.
//
// O servidor é a autoridade: o cliente só pede "alocar X" / "tirar X"; aqui se
// confere se o nó existe, se já é seu, se está LIGADO a um nó seu, o level, os
// pontos — e, ao tirar, se nenhum nó fica ilhado.
//
// Os efeitos NÃO têm conta própria: `efeitos(estado)` devolve as mesmas peças
// que o resto do jogo já soma — adds de item (`adds`, somados em
// `Afixos.soma`), afinidades de dano por tag e % de stat (`dano`/`stats`, no
// formato das especializações, somados em `Especializacoes.efeitos`), as
// chaves da árvore antiga sem add (`legado`) e os keystones (`keystones.mjs`).
// A ficha (`Ficha.combate`) junta tudo: é a mesma fonte da tela, do balão, da
// comparação de item e do combate.
//
// Este arquivo é PURO (só `estado` + os dados): quem precisa recalcular vida e
// ficha depois de mudar é `passivas/comandos.mjs`.
import { readFileSync } from 'node:fs';
import * as Keystones from './keystones.mjs';
import { ligado as itensPoeLigado } from '../itens-poe/catalogo.mjs';
import { classeDe as classeDoPoe } from '../itens-poe/classes.mjs';
import { definirLeitorDeMaestrias, definirLeitorDeJoias, slugDoNome } from '../itens-poe/condicoes-poe.mjs';

const ler = (arq) => JSON.parse(readFileSync(new URL(`../../gamedata/passivas/${arq}`, import.meta.url), 'utf8'));
export const CONFIG = ler('config.json');
// `mastery`: a maestria da árvore do PoE (sem ligação; abre pelo grupo — `podeAlocar`).
export const TIPOS = ['small', 'notable', 'keystone', 'start', 'mastery'];

/**
 * Confere uma árvore (a do jogo, ou uma de teste/editor): ids únicos, conexões
 * nos dois sentidos para nós que existem, tipos e efeitos conhecidos, um início
 * por classe e TUDO alcançável a partir dos inícios. Devolve a lista de problemas.
 */
export function validar(arvore) {
  const erros = [];
  const ids = new Map();
  for (const n of arvore.nos ?? []) {
    if (ids.has(n.id)) erros.push(`nó repetido: ${n.id}`);
    ids.set(n.id, n);
    if (!TIPOS.includes(n.tipo)) erros.push(`${n.id}: tipo ${n.tipo}`);
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) erros.push(`${n.id}: sem posição`);
    for (const ef of n.efeitos ?? []) if (!efeitoValido(ef)) erros.push(`${n.id}: efeito ${JSON.stringify(ef)}`);
    if (n.tipo === 'keystone' && !Keystones.valida(n.keystone)) erros.push(`${n.id}: keystone ${JSON.stringify(n.keystone)}`);
    if (n.opcaoDe != null) {
      const pai = arvore.nos.find((x) => x.id === n.opcaoDe);
      if (!pai || pai.ascendencia !== n.ascendencia || !(n.conexoes ?? []).includes(n.opcaoDe)) erros.push(`${n.id}: opção de escolha de ${n.opcaoDe}, que não existe ou não está ligado`);
    }
    if (n.tipo === 'mastery') {
      if (n.grupo == null || !n.opcoes?.length) erros.push(`${n.id}: maestria sem grupo ou sem opções`);
      for (const o of n.opcoes ?? []) for (const ef of o.efeitos ?? []) if (!efeitoValido(ef)) erros.push(`${n.id}/${o.id}: efeito ${JSON.stringify(ef)}`);
    }
  }
  if (ids.size > (CONFIG.limites?.maxNos ?? Infinity)) erros.push(`nós demais: ${ids.size}`);
  for (const n of ids.values()) for (const c of n.conexoes ?? []) {
    if (!ids.has(c)) erros.push(`${n.id}: conexão para ${c}, que não existe`);
    else if (!(ids.get(c).conexoes ?? []).includes(n.id)) erros.push(`${n.id} → ${c}: conexão de um lado só`);
  }
  const inicios = Object.values(arvore.inicios ?? {});
  for (const [classe, id] of Object.entries(arvore.inicios ?? {})) if (ids.get(id)?.tipo !== 'start') erros.push(`início de ${classe} (${id}) não é um nó de início`);
  const alcancados = alcancaveis(ids, new Set(ids.keys()), inicios);
  // A maestria não tem ligação: abre pelo notável do grupo — precisa de um notável alcançável nele.
  const gruposAlcancados = new Set([...alcancados].map((id) => ids.get(id)).filter((n) => n?.tipo === 'notable' && n.grupo != null).map((n) => n.grupo));
  for (const [id, n] of ids) {
    if (n.tipo === 'mastery') {
      if (!gruposAlcancados.has(n.grupo)) erros.push(`${id}: maestria sem notável alcançável no grupo ${n.grupo}`);
    } else if (!alcancados.has(id)) erros.push(`${id}: ninguém alcança`);
  }
  return erros;
}

// (09/10, a árvore do PoE: também as chaves dos mods com condição, escala e as dinâmicas — `ModsPoe.resolver` decide quando valem.)
// (+ ciclo 7: o `~` do teto da escala — `area_inc%matouRecente~50`)
const ADDS_PERMITIDOS = /^[a-z_][\w:%@+.~-]*$/i;
function efeitoValido(ef) {
  if (!ef || typeof ef !== 'object') return false;
  if (ef.tag) return Number.isFinite(ef.dano);
  if (ef.stat) return Number.isFinite(ef.pct);
  if (ef.add) return ADDS_PERMITIDOS.test(ef.add) && Number.isFinite(ef.valor);
  if (ef.legado) return Number.isFinite(ef.valor);
  return false;
}

/** Quem se alcança a partir de `de`, andando só por nós de `dentro`. */
function alcancaveis(porId, dentro, de) {
  const vistos = new Set();
  const fila = de.filter((id) => dentro.has(id));
  for (const id of fila) vistos.add(id);
  while (fila.length) {
    const id = fila.pop();
    for (const c of porId.get(id)?.conexoes ?? []) {
      if (!vistos.has(c) && dentro.has(c)) {
        vistos.add(c);
        fila.push(c);
      }
    }
  }
  return vistos;
}

/** Prepara uma árvore para o motor (o mapa por id). A do jogo é carregada uma vez. */
export function preparar(arvore) {
  const erros = validar(arvore);
  if (erros.length) throw new Error(`árvore de passivas inválida: ${erros.slice(0, 5).join('; ')}`);
  return { ...arvore, porId: new Map(arvore.nos.map((n) => [n.id, n])) };
}
/*
 * ---- A árvore do PoE (sistema de itens do PoE, incremento 4c — só com ITENS_POE=1) ----
 * Com o sistema ligado, a árvore em uso é a do PoE (`gamedata/itens-poe/arvore-poe.json`, gerada por tools/montar-arvore-poe.mjs):
 * cada classe do PoE parte do nó dela, cada nó custa 1 ponto e os pontos são como no PoE (1 por level). Em produção, a do Draevor.
 */
const arvoreDoPoe = () => {
  const a = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/arvore-poe.json', import.meta.url), 'utf8'));
  return { ...a, id: 'poe', clusters: [], pontos: { levelInicial: 1, levelsPorPonto: 1 } };
};
let ARVORE = preparar(itensPoeLigado() ? arvoreDoPoe() : ler('arvore.json'));
export const arvore = () => ARVORE;
/** Troca a árvore em uso (testes de desempenho, editor). Devolve a anterior. */
export function usarArvore(nova) {
  const antes = ARVORE;
  ARVORE = nova.porId ? nova : preparar(nova);
  CACHE = new WeakMap();
  NO_RAIO.clear();
  PEDRAS = null;
  return antes;
}

// ------------------------------------------------------------ o personagem

const classeDe = (estado) => {
  // Na árvore do PoE, o início é o da CLASSE do PoE (a escolhida, ou a padrão da vocação).
  if (ARVORE.id === 'poe') return classeDoPoe(estado)?.slug ?? 'Scion';
  return ARVORE.inicios[estado.vocation] ? estado.vocation : 'knight';
};
export const inicioDe = (estado) => ARVORE.inicios[classeDe(estado)];
/**
 * Os INÍCIOS EXTRAS (o "Caminho do Marauder" da Ascendente: "Pode Alocar Passivas do ponto inicial do Marauder" — `inicio_extra:<classe>`):
 * o início dessas classes vale como se fosse seu (aloca-se a partir dele). `ids`: os nós que contam (por padrão, os alocados).
 */
export function iniciosExtras(estado, ids = estado?.passivas?.alocados ?? []) {
  const extras = [];
  for (const id of ids) {
    const no = noDe(estado, id);
    if (!no) continue;
    for (const ef of efeitosDoNo(no, estado.passivas)) {
      const m = /^inicio_extra:(\w+)$/.exec(ef.add ?? '');
      if (m && ef.valor > 0 && ARVORE.inicios[m[1]] && !extras.includes(ARVORE.inicios[m[1]])) extras.push(ARVORE.inicios[m[1]]);
    }
  }
  return extras;
}
/** Todos os pontos de partida do personagem: o início da classe, o da ascendência e os extras. */
const raizesDe = (estado, ids) => [inicioDe(estado), inicioDaAscendencia(estado), ...iniciosExtras(estado, ids)].filter(Boolean);
export const custoDe = (no) => no?.custo ?? (no?.atributo ? CONFIG.custo.atributo : undefined) ?? CONFIG.custo[no?.tipo] ?? 1;
export const pontosDoLevel = (level) => {
  const regra = ARVORE.pontos ?? CONFIG.pontos;
  return Math.max(0, Math.floor(((level ?? 1) - regra.levelInicial) / regra.levelsPorPonto));
};

/**
 * `estado.passivas = { alocados: [ids], respecsGratis, migrado }` — dentro do
 * estado do personagem (decisão do dono). O início da classe vem sempre
 * alocado. Personagem da árvore ANTIGA (por vocação): os pontos voltam todos
 * (a vida/mana que ela dava sai), e ele ganha um respec completo grátis.
 * Devolve `{ migrou }` na primeira vez.
 */
export function garantir(estado) {
  const p = (estado.passivas ??= { alocados: [], respecsGratis: 0 });
  p.alocados ??= [];
  p.respecsGratis ??= 0;
  /*
   * ---- Uma alocação por ÁRVORE (a do Draevor e a do PoE, sistema de itens do PoE) ----
   * Trocar de árvore guarda a alocação da outra (e a versão dela) e traz a desta: ligar o PoE no jogo local não apaga os nós da
   * árvore do Draevor, e desligar devolve tudo como estava.
   */
  const idDaArvore = ARVORE.id ?? 'draevor';
  if ((p.arvore ?? 'draevor') !== idDaArvore) {
    (p.porArvore ??= {})[p.arvore ?? 'draevor'] = { alocados: [...p.alocados], versao: p.versaoDaArvore ?? 1 };
    const guardada = p.porArvore[idDaArvore];
    p.alocados.splice(0, p.alocados.length, ...(guardada?.alocados ?? []));
    p.versaoDaArvore = guardada?.versao ?? ARVORE.versao;
    delete p.porArvore[idDaArvore];
    p.arvore = idDaArvore;
  }
  let migrou = false;
  if (!p.migrado) {
    p.migrado = true;
    const antiga = estado.arvore;
    if (antiga && (Object.keys(antiga.graus ?? {}).length || antiga.escolhidas?.length)) {
      antiga.graus = {};
      antiga.escolhidas = [];
      antiga.montagens = (antiga.montagens ?? []).map(() => null);
      p.respecsGratis += 1;
      migrou = true;
    }
    // A vida/mana % que a árvore antiga tinha posto nos máximos sai (ver o antigo `Arvore.recalcularVida`).
    if (estado.arvoreMax) {
      estado.maxHp = Math.max(1, (estado.maxHp ?? 0) - (estado.arvoreMax.hp ?? 0));
      estado.maxMana = Math.max(0, (estado.maxMana ?? 0) - (estado.arvoreMax.mana ?? 0));
      estado.hp = Math.min(estado.hp ?? 0, estado.maxHp);
      estado.mana = Math.min(estado.mana ?? 0, estado.maxMana);
      delete estado.arvoreMax;
    }
  }
  // Só nós que existem (a árvore pode ter mudado), sem repetir, e o início da classe.
  // (No MESMO array, e só se mudou: quem guardou a referência continua vendo a lista certa,
  // e o cache de `efeitos` não é refeito à toa.)
  const inicio = inicioDe(estado);
  // A ascendência escolhida (árvore do PoE): o início dela fica alocado; nós de outra ascendência saem.
  const inicioAsc = inicioDaAscendencia(estado);
  // (lote 64: na árvore do PERSONAGEM — os nós das Ramificadoras encaixadas também existem)
  let limpos = [inicio, ...(inicioAsc ? [inicioAsc] : []), ...[...new Set(p.alocados)].filter((id) => {
    const no = noDe(estado, id);
    return no && no.tipo !== 'start' && (!no.ascendencia || no.ascendencia === p.ascendencia);
  })];
  /*
   * ---- A ÁRVORE MUDOU de versão (ex.: a 2, com os caminhos de atributo) ----
   * Nó que sumiu ou que ficou sem caminho até o início sai, com os pontos de
   * volta — e, se saiu algum, um respec completo grátis (para remontar). Uma
   * vez por versão.
   */
  let arvoreMudou = false;
  if ((p.versaoDaArvore ?? 1) !== ARVORE.versao) {
    const antes = new Set(p.alocados);
    const liberados = p.joias ? [...liberadosPorJoias(estado).keys()] : [];
    const ligados = alcancaveis(grafoDe(estado).porId, new Set([...limpos, ...iniciosExtras(estado, limpos)]), [inicio, ...(inicioAsc ? [inicioAsc] : []), ...iniciosExtras(estado, limpos), ...liberados.filter((x) => limpos.includes(x))]);
    const grupos = gruposComNotavel([...ligados]);
    limpos = limpos.filter((id) => ligados.has(id) || (ARVORE.porId.get(id)?.tipo === 'mastery' && grupos.has(ARVORE.porId.get(id).grupo)));
    const sairam = [...antes].filter((id) => id !== inicio && !limpos.includes(id) && ARVORE.porId.get(id)?.tipo !== 'start').length;
    if (sairam > 0) {
      p.respecsGratis += 1;
      arvoreMudou = true;
    }
    p.versaoDaArvore = ARVORE.versao;
  }
  if (limpos.length !== p.alocados.length || limpos.some((id, i) => id !== p.alocados[i])) p.alocados.splice(0, p.alocados.length, ...limpos);
  // A opção de maestria só fica enquanto a maestria está alocada (respec, troca de árvore).
  if (p.maestrias) for (const id of Object.keys(p.maestrias)) if (!p.alocados.includes(id)) delete p.maestrias[id];
  // (lote 27) A joia de um encaixe que não está mais alocado volta para a mochila.
  // (lote 64) e os nós da Ramificadora que saiu somem da alocação (os pontos voltam, como no PoE) — o que pode soltar o encaixe interno de
  // dentro dela e a joia menor nele: até ficar estável.
  for (let volta = 0; p.joias && volta < 6; volta++) {
    const antes = p.joiasVersao ?? 0;
    devolverJoiasSoltas(estado, p);
    if ((p.joiasVersao ?? 0) === antes) break;
    const g = grafoDe(estado);
    const ficam = p.alocados.filter((id) => g.porId.has(id));
    if (ficam.length !== p.alocados.length) p.alocados.splice(0, p.alocados.length, ...ficam);
  }
  return { passivas: p, migrou, arvoreMudou };
}

export function pontos(estado) {
  const { passivas } = garantir(estado);
  // (+ os nós que concedem pontos de passiva — "Concede 1 Ponto de Habilidade Passiva", na Ascendente: `pontos_passiva`.)
  const total = pontosDoLevel(estado.level) + Math.max(0, Math.round(efeitos(estado).adds?.pontos_passiva ?? 0));
  // Os nós de ascendência gastam os pontos de ASCENDÊNCIA (`pontosDeAscendencia`), não estes.
  const usados = passivas.alocados.reduce((s, id) => (noDe(estado, id)?.ascendencia ? s : s + custoDe(noDe(estado, id))), 0);
  // `deficit`: pontos gastos A MAIS do que o personagem tem (um personagem antigo que caiu de level na morte, antes da regra do PoE; um nó
  // que concedia pontos e saiu). Não se aloca nada enquanto houver déficit; a tela mostra (auditoria da árvore, 09/10).
  return { total, usados, livres: Math.max(0, total - usados), ...(usados > total ? { deficit: usados - total } : {}) };
}

/** Os pontos gastos e o total se só `ficam` estivessem alocados (o respec confere antes de tirar um nó que concede pontos). */
function pontosSe(estado, ficam) {
  let concedidos = 0;
  let usados = 0;
  for (const id of ficam) {
    const no = noDe(estado, id);
    if (!no) continue;
    if (!no.ascendencia) usados += custoDe(no);
    for (const ef of efeitosDoNo(no, estado.passivas)) if (ef.add === 'pontos_passiva') concedidos += ef.valor;
  }
  return { total: pontosDoLevel(estado.level) + Math.max(0, Math.round(concedidos)), usados };
}

// ------------------------------------------------------------ as ascendências (árvore do PoE, incremento 4e)

/** O teto de pontos de ascendência (o do PoE: 8). */
export const MAXIMO_DE_PONTOS_DE_ASCENDENCIA = 8;
/** Os atos com o boss de fim de ato vencido (em qualquer dificuldade, cada ato uma vez). */
const atosVencidos = (estado) => new Set(Object.values(estado?.campanha ?? {}).flatMap((d) => (Array.isArray(d?.bosses) ? d.bosses.map(Number) : []))).size;
/** O início da ascendência escolhida, ou null (sem escolha, ou na árvore do Draevor). */
export const inicioDaAscendencia = (estado) => (estado?.passivas?.ascendencia ? ARVORE.inicios[`asc:${estado.passivas.ascendencia}`] ?? null : null);

/** Pontos de ascendência (decisão do dono, 05/10): 2 por boss de fim de ato vencido, até 8 (como no PoE). */
export function pontosDeAscendencia(estado) {
  if (!ARVORE.ascendencias) return { total: 0, usados: 0, livres: 0 };
  const { passivas } = garantir(estado);
  const total = Math.min(MAXIMO_DE_PONTOS_DE_ASCENDENCIA, 2 * atosVencidos(estado));
  const usados = passivas.alocados.reduce((s, id) => (noDe(estado, id)?.ascendencia ? s + custoDe(noDe(estado, id)) : s), 0);
  return { total, usados, livres: Math.max(0, total - usados) };
}

/** As ascendências que a classe do personagem pode escolher (`[{ slug, nome }]`). */
export function ascendenciasDaClasse(estado) {
  if (!ARVORE.ascendencias) return [];
  const classe = classeDe(estado);
  return Object.values(ARVORE.ascendencias).filter((a) => a.classe === classe).map((a) => ({ slug: a.slug, nome: a.nome }));
}

/** Escolhe a ascendência (decisão do dono: no primeiro ponto; uma vez). `{ ok }` ou o erro. */
export function ascender(estado, slug) {
  const { passivas } = garantir(estado);
  if (!ARVORE.ascendencias) return erro('SEM_ASCENDENCIA', 'Não há ascendências nesta árvore.');
  if (passivas.ascendencia) return erro('JA_ASCENDEU', `Você já é ${ARVORE.ascendencias[passivas.ascendencia]?.nome ?? passivas.ascendencia}.`);
  if (!ascendenciasDaClasse(estado).some((a) => a.slug === slug)) return erro('OUTRA_CLASSE', 'Essa ascendência não é da sua classe.');
  if (pontosDeAscendencia(estado).total < 1) return erro('SEM_PONTOS', 'Vença um boss de fim de ato para ganhar os primeiros pontos de ascendência.');
  passivas.ascendencia = slug;
  garantir(estado);
  return { ok: true, mudou: true };
}

const erro = (motivo, texto) => ({ ok: false, motivo, erro: texto });

/** Pode alocar este nó agora? `{ok}` ou `{ok:false, motivo, erro}`. */
export function podeAlocar(estado, id, opcao = null) {
  const { passivas } = garantir(estado);
  const no = noDe(estado, id);
  if (!no) return erro('NAO_EXISTE', 'Esse nó não existe.');
  const meus = new Set(passivas.alocados);
  if (meus.has(id)) return erro('JA_ALOCADO', 'Você já tem esse nó.');
  if (no.tipo === 'start') return erro('INICIO', 'O início de outra classe não se aloca.');
  // (lote 60, as Ramificadoras) o PROXY e o encaixe interno (Pequeno, Médio) só existem com uma Joia Ramificadora encaixada — como no PoE
  // (lote 64: o encaixe interno de uma Ramificadora encaixada existe — `grafoDe`)
  if (soDaRamificadora(no) && !grafoDe(estado).internos.has(id)) return erro('RAMIFICADORA', 'Esse nó só existe com uma Joia Ramificadora encaixada.');
  if (no.tipo === 'mastery') return podeAlocarMaestria(estado, no, opcao, meus);
  const extras = new Set(iniciosExtras(estado));
  // (lote 29) o nó no raio de uma joia "pode ser atribuída sem estar conectada à sua árvore" (o Salto Intuitivo, o Fio de Esperança)
  if (!(no.conexoes ?? []).some((c) => meus.has(c) || extras.has(c)) && !liberadosPorJoias(estado).has(id)) return erro('SEM_CAMINHO', 'Esse nó não está ligado a nenhum nó seu.');
  if ((estado.level ?? 1) < (no.levelMinimo ?? 0)) return erro('LEVEL', `Precisa do level ${no.levelMinimo}.`);
  if (no.ascendencia) {
    if (passivas.ascendencia !== no.ascendencia) return erro('OUTRA_ASCENDENCIA', 'Esse nó é de outra ascendência.');
    // A OPÇÃO DE ESCOLHA (como no PoE): abre pelo nó-pai alocado, não gasta ponto, e é uma só por pai.
    if (no.opcaoDe != null) {
      if (!meus.has(no.opcaoDe)) return erro('SEM_PAI', `Aloque "${ARVORE.porId.get(no.opcaoDe)?.nome ?? no.opcaoDe}" para escolher uma das opções dele.`);
      const outra = passivas.alocados.find((x) => x !== id && ARVORE.porId.get(x)?.opcaoDe === no.opcaoDe);
      if (outra) return erro('OPCAO_REPETIDA', `Você já escolheu "${ARVORE.porId.get(outra)?.nome}" — tire-a para escolher outra.`);
    }
    if (pontosDeAscendencia(estado).livres < custoDe(no)) return erro('SEM_PONTOS', 'Faltam pontos de ascendência: vença o boss de fim de ato seguinte.');
    return { ok: true };
  }
  if (pontos(estado).livres < custoDe(no) || (custoDe(no) > 0 && pontos(estado).deficit)) return erro('SEM_PONTOS', `Faltam pontos: esse nó custa ${custoDe(no)}.`);
  return { ok: true };
}

/**
 * O MENOR caminho de nós ainda não alocados, de algum nó seu até `id` (ele
 * incluso), na ordem de alocar — o "clicar num nó longe aloca o caminho" da
 * tela. `[]` se já é seu; `null` se não há caminho (nó de início de outra classe).
 */
export function caminhoAte(estado, id) {
  const { passivas } = garantir(estado);
  const g = grafoDe(estado);
  if (!g.porId.has(id)) return null;
  const meus = new Set(passivas.alocados);
  if (meus.has(id)) return [];
  // (lote 29) os nós liberados pelas joias ("sem estar conectada à sua árvore"): o caminho pode começar neles (eles entram no caminho).
  const liberados = [...liberadosPorJoias(estado).keys()].filter((x) => !meus.has(x));
  if (liberados.includes(id)) return [id];
  const veioDe = new Map();
  const fila = [...meus, ...iniciosExtras(estado).filter((x) => !meus.has(x))];
  for (const x of fila) veioDe.set(x, null);
  const origens = new Set(fila);
  for (const x of liberados) if (!veioDe.has(x)) { veioDe.set(x, null); fila.push(x); }
  for (let i = 0; i < fila.length; i++) {
    const atual = fila[i];
    for (const c of g.porId.get(atual)?.conexoes ?? []) {
      if (veioDe.has(c) || g.porId.get(c)?.tipo === 'start' || (soDaRamificadora(g.porId.get(c)) && !g.internos.has(c))) continue;
      veioDe.set(c, atual);
      if (c === id) {
        const caminho = [];
        for (let x = c; x && !origens.has(x); x = veioDe.get(x)) caminho.unshift(x);
        return caminho;
      }
      fila.push(c);
    }
  }
  return null;
}

export function alocar(estado, id, opcao = null) {
  const pode = podeAlocar(estado, id, opcao);
  if (!pode.ok) return pode;
  estado.passivas.alocados.push(id);
  if (noDe(estado, id)?.tipo === 'mastery') (estado.passivas.maestrias ??= {})[id] = String(opcao);
  return { ok: true, mudou: true };
}

// ------------------------------------------------------------ as maestrias (árvore do PoE)

/** Os notáveis alocados por grupo (a maestria do grupo abre com um deles). */
const gruposComNotavel = (ids) => new Set(ids.map((id) => ARVORE.porId.get(id)).filter((n) => n?.tipo === 'notable' && n.grupo != null).map((n) => n.grupo));

/**
 * A maestria (como no PoE): abre com um notável alocado no MESMO grupo, custa os pontos dela, e escolhe-se UMA opção — que não pode
 * estar escolhida em outra maestria do mesmo tipo (o mesmo nome).
 */
function podeAlocarMaestria(estado, no, opcao, meus) {
  if (!gruposComNotavel([...meus]).has(no.grupo)) return erro('SEM_NOTAVEL', 'A maestria abre quando você tem um notável do grupo dela.');
  const escolhida = no.opcoes?.find((o) => o.id === String(opcao ?? ''));
  if (!escolhida) return erro('SEM_OPCAO', 'Escolha um dos efeitos da maestria.');
  const ja = Object.entries(estado.passivas.maestrias ?? {}).find(([outra, op]) => op === escolhida.id && ARVORE.porId.get(outra)?.nome === no.nome && meus.has(outra));
  if (ja) return erro('OPCAO_REPETIDA', 'Esse efeito já está escolhido em outra maestria do mesmo tipo.');
  if (pontos(estado).livres < custoDe(no)) return erro('SEM_PONTOS', `Faltam pontos: esse nó custa ${custoDe(no)}.`);
  return { ok: true };
}

/** Os efeitos que um nó dá: o da maestria é o da opção escolhida. */
const efeitosDoNo = (no, passivas) => (no.tipo === 'mastery' ? no.opcoes?.find((o) => o.id === passivas?.maestrias?.[no.id])?.efeitos ?? [] : no.efeitos ?? []);

/**
 * Tirar estes nós deixaria algum outro ilhado (sem caminho até o início)?
 * Devolve os ilhados (vazio = pode).
 */
export function ilhadosSemEles(estado, ids, semJoiaEm = []) {
  const { passivas } = garantir(estado);
  const tirar = new Set(ids);
  const fica = new Set(passivas.alocados.filter((x) => !tirar.has(x)));
  // (lote 29) os nós liberados pelas joias que ficam (o encaixe alocado e a joia nele — `semJoiaEm`: as joias que saem) são raízes.
  const liberados = [...liberadosPorJoias(estado, new Set([...tirar, ...semJoiaEm])).keys()].filter((x) => fica.has(x));
  const raizes = [...raizesDe(estado, [...fica]), ...liberados];
  const ligados = alcancaveis(grafoDe(estado).porId, new Set([...fica, ...raizes]), raizes);
  // A maestria fica enquanto houver um notável LIGADO no grupo dela.
  const grupos = gruposComNotavel([...ligados]);
  return [...fica].filter((x) => (ARVORE.porId.get(x)?.tipo === 'mastery' ? !grupos.has(ARVORE.porId.get(x).grupo) : !ligados.has(x)));
}

/** As regras do respec: no jogo oficial (a árvore do PoE) as de `respec.oficial` — de graça e também na caçada (dono, 09/10). */
export const regrasDoRespec = () => (ARVORE.id === 'poe' ? { ...CONFIG.respec, ...(CONFIG.respec.oficial ?? {}) } : CONFIG.respec);
export const precoDoRespec = (estado, quantos) => (regrasDoRespec().gratis ? 0 : Math.round(regrasDoRespec().ouroPorNoPorLevel * (estado.level ?? 1) * quantos));

/**
 * O que um respec tiraria e custaria: `ids` (os pedidos) e, com `junto`, os
 * que ficariam ilhados. `{ ok, tirar, preco, gratis }` ou o erro.
 */
export function planoDeRespec(estado, { ids, tudo = false, junto = false }, emCacada = false) {
  const { passivas } = garantir(estado);
  const regras = regrasDoRespec();
  if (regras.soForaDaCacada && emCacada) return erro('EM_CACADA', 'Só dá para tirar nós fora da caçada.');
  const inicio = inicioDe(estado);
  const inicioAsc = inicioDaAscendencia(estado);
  let tirar = tudo ? passivas.alocados.filter((x) => x !== inicio && x !== inicioAsc) : [...new Set(ids ?? [])];
  if (!tirar.length) return erro('NADA', 'Nenhum nó para tirar.');
  for (const id of tirar) {
    if (id === inicio || id === inicioAsc) return erro('INICIO', 'O início da classe (e o da ascendência) não sai.');
    if (!passivas.alocados.includes(id)) return erro('NAO_ALOCADO', 'Você não tem esse nó.');
  }
  const ilhados = ilhadosSemEles(estado, tirar);
  if (ilhados.length && !junto) return { ...erro('ILHARIA', `Tirar isso deixaria ${ilhados.length} nó(s) sem caminho até o início — tire-os junto.`), ilhados };
  tirar = [...tirar, ...ilhados];
  // Tirar um nó que CONCEDE pontos ("Concede 1 Ponto de Habilidade Passiva", na Ascendente/Caçadora de Relíquias) não pode deixar mais
  // pontos gastos do que o total — como no PoE, tire outros nós antes (o respec completo sempre pode).
  if (!tudo) {
    const sai = new Set(tirar);
    const antes = pontosSe(estado, passivas.alocados);
    const depois = pontosSe(estado, passivas.alocados.filter((x) => !sai.has(x)));
    const faltaDepois = depois.usados - depois.total;
    if (faltaDepois > 0 && faltaDepois > antes.usados - antes.total) return erro('PONTOS_NEGATIVOS', `Tirar isso deixaria ${faltaDepois} ponto(s) gasto(s) a mais do que você tem — tire outros nós antes.`);
  }
  // Respec sempre de graça (o jogo oficial): nada se gasta — nem o respec grátis da migração, nem os pontos do Orbe do Remorso.
  if (regras.gratis) return { ok: true, tirar, gratis: true, semCusto: true, restituicoes: 0, preco: 0 };
  const gratis = tudo && passivas.respecsGratis > 0;
  // Os pontos de RESTITUIÇÃO (o Orbe do Remorso do PoE — `itens-poe/moedas.mjs`): cada um tira um nó sem pagar.
  const restituicoes = gratis ? 0 : Math.min(tirar.length, passivas.restituicoes ?? 0);
  return { ok: true, tirar, gratis, restituicoes, preco: gratis ? 0 : precoDoRespec(estado, tirar.length - restituicoes) };
}

/** Carteira primeiro, o resto do banco (como o respec da árvore antiga). */
function pagar(estado, valor) {
  if (!valor) return null;
  const total = (estado.gold ?? 0) + (estado.bank ?? 0);
  if (total < valor) return `Faltam ${(valor - total).toLocaleString('pt-BR')} de ouro (bolso + banco).`;
  const doBolso = Math.min(estado.gold ?? 0, valor);
  estado.gold = (estado.gold ?? 0) - doBolso;
  estado.bank = (estado.bank ?? 0) - (valor - doBolso);
  return null;
}

/** Respec parcial (`ids`, com `junto` para levar os ilhados) ou completo (`tudo`). */
export function respec(estado, pedido, emCacada = false) {
  const plano = planoDeRespec(estado, pedido, emCacada);
  if (!plano.ok) return plano;
  const falta = pagar(estado, plano.preco);
  if (falta) return erro('SEM_OURO', falta);
  if (plano.gratis && !plano.semCusto) estado.passivas.respecsGratis -= 1;
  if (plano.restituicoes) estado.passivas.restituicoes -= plano.restituicoes;
  const sai = new Set(plano.tirar);
  const ficam = estado.passivas.alocados.filter((x) => !sai.has(x));
  estado.passivas.alocados.splice(0, estado.passivas.alocados.length, ...ficam);
  // A maestria que saiu leva a opção escolhida (dá para escolher outra ao alocar de novo).
  for (const id of sai) delete estado.passivas.maestrias?.[id];
  return { ok: true, mudou: true, tirados: plano.tirar.length, preco: plano.preco };
}

// ------------------------------------------------------ os encaixes de joia

/*
 * ---- (15/10, lote 27) Os ENCAIXES DE JOIA da árvore do PoE ----
 * Dono, 14/10: "Criar os encaixes de joia". Os 21 encaixes da árvore principal — os 15 "Básicos" e os 6 "Grandes" da borda; os "Médios" e
 * os "Pequenos" são os das Joias Ramificadoras (fora) — recebem uma Joia (`itens-poe/jogo.JOIAS`; quem põe e tira é `passivas/joias.mjs`).
 * A joia vale com o encaixe ALOCADO: os mods dela somam como os de uma peça (`Afixos.somaDeItens`). O encaixe que deixa de estar alocado
 * (respec, troca de classe, a árvore mudou) devolve a joia à mochila em `garantir` — a peça nunca some.
 */
const ENCAIXES_DE_JOIA = new Set(['Basic Jewel Socket', 'Large Jewel Socket']);
export const ehEncaixeDeJoia = (no) => !!no && !no.ascendencia && ENCAIXES_DE_JOIA.has(no.nomeEn);
/** (lote 60) O nó que só existe com uma Joia Ramificadora: o proxy de posicionamento e o encaixe de expansão interno (Pequeno, Médio). */
export const soDaRamificadora = (no) => !!no && (!!no.placeholder || (no.expansao != null && no.expansao.tamanho < 2));
/**
 * Os raios das joias do PoE nas unidades da árvore (as mesmas de `x`/`y`): desde a 3.16, com a árvore espaçada, 20% maiores que o número do
 * item ("Raio: Grande (1500)" → 1800) — como no Path of Building (dono, 15/10: "Como no PoE/PoB"). `aneis`: os anéis do Fio de Esperança
 * ("Só afeta Passivas em um Raio Pequeno … Massivo" — os nós ENTRE o de dentro e o de fora), os do Path of Building.
 */
export const RAIOS_DE_JOIA = Object.freeze({ pequeno: 960, medio: 1440, grande: 1800, aneis: [[960, 1320], [1320, 1680], [1680, 2040], [2040, 2400], [2400, 2880]] });
/** O raio e o "Limitado a: N" de cada joia única (`tools/importar-joias-unicas.mjs`). */
const JOIAS_UNICAS = (() => {
  try {
    return JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/joias-unicas.json', import.meta.url), 'utf8')).joias ?? {};
  } catch {
    return {};
  }
})();
/*
 * ---- (lote 64) As RAMIFICADORAS na árvore do PERSONAGEM ----
 * Quem monta os nós da joia é `passivas/ramificadoras.mjs` (o `BuildSubgraph` do PoB), que se REGISTRA aqui — sem import de volta: o
 * tradutor da árvore importa as fichas, que importam esta árvore. A árvore do personagem (`grafoDe`) é a do jogo + os nós que as Ramificadoras
 * encaixadas criam: a joia num encaixe Grande da borda (alocado — o encaixe só aceita joia alocado) e, nos encaixes internos dela, as joias
 * menores. É por ela que se aloca, se acha o caminho, se tira, se conta o ponto e se soma; o raio das outras joias não a vê ("Habilidades
 * Passivas Adicionadas nunca são consideradas como estando no Raio por outras Joias" — `passivasNoRaio` só olha os nós da árvore).
 */
let RAMIFICADORAS = null;
let GRAFOS = new WeakMap();
/** `{ montar, dados }` (`passivas/ramificadoras.mjs`). */
export function definirRamificadoras(r) { RAMIFICADORAS = r; GRAFOS = new WeakMap(); }
/** O tamanho da Ramificadora → o índice (o encaixe de expansão aceita a joia de índice até o tamanho dele). */
export const INDICE_DO_TAMANHO = Object.freeze({ Small: 0, Medium: 1, Large: 2 });
/** A árvore do personagem: `{ porId, extras, internos, porEncaixe }` (sem Ramificadora encaixada, a do jogo). Em cache pela versão das joias. */
let GRAFO_DA_ARVORE = null;
/** A árvore do jogo como árvore do personagem (sem Ramificadora) — uma só por árvore. */
const grafoDaArvore = () => (GRAFO_DA_ARVORE?.arvore === ARVORE ? GRAFO_DA_ARVORE : (GRAFO_DA_ARVORE = { arvore: ARVORE, porId: ARVORE.porId, extras: new Map(), internos: new Set(), porEncaixe: new Map() }));
export function grafoDe(estado) {
  const p = estado?.passivas;
  if (!RAMIFICADORAS || ARVORE.id !== 'poe' || !p?.joias) return grafoDaArvore();
  const chave = p.joiasVersao ?? 0;
  const guardado = GRAFOS.get(p);
  if (guardado && guardado.chave === chave && guardado.arvore === ARVORE) return guardado.grafo;
  if (!Object.values(p.joias).some((j) => j?.poe?.ramificadora)) {
    GRAFOS.set(p, { chave, arvore: ARVORE, grafo: grafoDaArvore() });
    return grafoDaArvore();
  }
  const extras = new Map();
  const entradas = new Map();
  const dados = RAMIFICADORAS.dados();
  for (const [id, peca] of Object.entries(p.joias)) {
    const no = ARVORE.porId.get(id);
    if (!peca?.poe?.ramificadora || no?.expansao?.tamanho !== 2) continue;
    const r = RAMIFICADORAS.montar({ dados, arvore: ARVORE, encaixe: no, poe: peca.poe, joiaNoEncaixe: (x) => p.joias[x] ?? null });
    if (!r) continue;
    for (const n of r.nos) extras.set(n.id, n);
    entradas.set(id, r.entrada);
  }
  const porId = extras.size ? new Map(ARVORE.porId) : ARVORE.porId;
  for (const [id, n] of extras) porId.set(id, n);
  for (const [id, entrada] of entradas) { const no = ARVORE.porId.get(id); porId.set(id, { ...no, conexoes: [...(no.conexoes ?? []), entrada] }); }
  const internos = new Set([...extras.values()].filter((n) => n.encaixeInterno).map((n) => n.id));
  // os nós de cada encaixe (o da borda e os internos): os dele e os das joias menores dentro dele
  const porEncaixe = new Map();
  const deDentro = (encaixe) => [...extras.values()].filter((n) => n.ramificadora.encaixe === encaixe).flatMap((n) => [n.id, ...(n.encaixeInterno ? deDentro(n.id) : [])]);
  for (const id of [...entradas.keys(), ...internos]) porEncaixe.set(id, deDentro(id));
  const novo = { arvore: ARVORE, porId, extras, internos, porEncaixe };
  GRAFOS.set(p, { chave, arvore: ARVORE, grafo: novo });
  return novo;
}
/** O nó `id` na árvore do personagem. */
const noDe = (estado, id) => grafoDe(estado).porId.get(id);
/** O encaixe de joia do personagem: os da árvore e os internos das Ramificadoras encaixadas. */
export const ehEncaixeDoPersonagem = (estado, no) => !!no && (ehEncaixeDeJoia(no) || grafoDe(estado).internos.has(no.id));
/** Os nós que a Ramificadora do encaixe `id` cria (com os das joias menores dentro dela). */
export const nosDaRamificadora = (estado, id) => grafoDe(estado).porEncaixe.get(String(id)) ?? [];
export const dadosDaJoiaUnica = (peca) => (peca?.poe?.raridade === 'unico' ? JOIAS_UNICAS[peca.poe.unico] ?? null : null);

/** As joias que valem: `[{ no, peca }]` — encaixe da árvore do PoE, alocado e com joia. */
export function joiasAtivas(estado) {
  const joias = ARVORE.id === 'poe' ? estado?.passivas?.joias : null;
  if (!joias) return [];
  const meus = new Set(estado.passivas.alocados ?? []);
  const lista = [];
  for (const [id, peca] of Object.entries(joias)) {
    const no = noDe(estado, id);
    if (peca && meus.has(id) && ehEncaixeDoPersonagem(estado, no)) lista.push({ no, peca });
  }
  return lista;
}

/**
 * (lote 77) As joias cujo RAIO vale: as dos encaixes da árvore. O encaixe que uma Ramificadora cria não tem raio — no PoB o nó dele é novo, sem
 * `nodesInRadius`, e a joia de raio ali não alcança nada (`CalcSetup`: `nodes = node.nodesInRadius and … or { }`) — então a joia nele vale só
 * pelas linhas dela: sem o raio, sem os nós liberados pelo raio, sem a conquista da Atemporal e sem o Raio Grande do Chieftain (o Talento Puro e
 * a Fuga Impossível, que não usam o raio do encaixe, valem).
 */
export function joiasComRaio(estado) {
  const ativas = joiasAtivas(estado);
  if (!ativas.length) return ativas;
  const { internos } = grafoDe(estado);
  return internos.size ? ativas.filter((j) => !internos.has(j.no.id)) : ativas;
}

// (lote 28) as joias da árvore para as condições do PoE ("por Joia Abissal afetando você").
definirLeitorDeJoias((estado) => joiasAtivas(estado).map((j) => j.peca));

/** A joia de um encaixe que não está alocado (ou que não existe mais) volta inteira para a mochila. */
function devolverJoiasSoltas(estado, p) {
  if (ARVORE.id !== 'poe') return;
  const meus = new Set(p.alocados);
  for (const [id, peca] of Object.entries(p.joias)) {
    if (meus.has(id) && ehEncaixeDoPersonagem(estado, noDe(estado, id))) continue;
    if (peca) (estado.inventory ??= []).push({ ...peca, count: 1 });
    delete p.joias[id];
    p.joiasVersao = (p.joiasVersao ?? 0) + 1;
  }
}

/*
 * ---- (lote 29) O RAIO das joias ----
 * Os nós "no Raio" de uma joia num encaixe alocado: as passivas da árvore principal (pequenas, notáveis e keystones — não as maestrias, os
 * encaixes nem os nós de posição das Ramificadoras) a até o raio dela (ou, no anel, entre o de dentro e o de fora). O que cada joia faz com
 * eles vem das linhas dela (`poe.af` da joia, chaves `raio_*` — as regras de tradução do lote 29):
 *   - os ATRIBUTOS transformados (a Inércia: "Destreza das Passivas em Alcance são Transformadas em Força" — `raio_dex_para_str` …);
 *   - os AUMENTOS convertidos ("Aumentos e Reduções de Escudo de Energia em Alcance são Transformados para … Armadura em 200%" — `raio_es_para_armadura`;
 *     de Vida para o Escudo de Energia — `raio_vida_para_es`; de Vida para Mana em 200% — `raio_vida_para_mana`; a Queda de Lioneye: "Corpo a Corpo e Arma Corpo
 *     a Corpo … em Modificadores de Arcos" — `raio_corpo_para_arco`);
 *   - os nós MUDADOS (o Poder do Pacífico: "50% de aumento do Efeito de Habilidades Passivas não-Angulares" e "Notáveis … concedem nada";
 *     o Instindo Sobrenatural: "Pequenas … Alocadas … não concedem nada" e "Concede todos os bônus das Pequenas … Não Alocadas"; os Pactos e a
 *     Mente Febril: "Notáveis no Raio são Transformadas para conceder: …");
 *   - o que os nós do raio DÃO A MAIS (a Luz do Significado: "+5 de Vida Máxima" por passiva alocada; os Sonhos: a resistência a Fogo/Gelo/Raio
 *     dá a mesma chance de Carga ao Matar; os Pesadelos: o Bloqueio de Ataque / a Supressão / o Bloqueio Mágico em 50%/70% dela);
 *   - "por cada N de Força nas Passivas Alocadas / Não Alocadas no Raio" (as Temperadas e as Transcendentais — `POR_ATRIBUTO_NO_RAIO`);
 *   - "podem ser atribuídas sem estarem conectadas à sua árvore" (o Salto Intuitivo e o Fio de Esperança — `liberadosPorJoias`).
 * E o CHIEFTAIN (Ngamahu, Avanço da Chama — lote 27): "Joias Não Únicas fazem com que Aumentos e Reduções aos Tipos de Dano em um Grande Raio
 * sejam Transformados para … Fogo" (`joia_transforma_fogo`) e "… Pequenas e Notáveis em um Raio Grande também concedam +4 de Força"
 * (`joia_forca_no_raio`), no Raio Grande de cada joia não única.
 */
const ehPassivaDoRaio = (no) => !!no && !no.ascendencia && ['small', 'notable', 'keystone'].includes(no.tipo) && !/Jewel Socket|Proxy/i.test(`${no.nomeEn ?? ''} ${no.nome ?? ''}`);
const ehPequena = (no) => no.tipo === 'small';
/**
 * (lote 48) As JOIAS ATEMPORAIS (`itens-poe/atemporais.mjs`, que se registra aqui — sem import de volta): `daPeca(peca)` → a conquista da
 * joia (`{ tipo, id, semente }`) ou null; `doNo(no, c)` → `{ substitui, nome, linhas, keystone }` ou null; `efeitos(linhas)` → os efeitos.
 */
let CONQUISTA = null;
export function definirConquista(f) { CONQUISTA = f; NO_RAIO.clear?.(); }
/** A conquista do nó `id` alocado, pelas joias que o alcançam (`raiosDasJoias().porNo`): `{ c, conquista }` ou null. */
function conquistaDoNo(no, joias) {
  const x = CONQUISTA && joias?.find((j) => j.conquista);
  if (!x) return null;
  const c = CONQUISTA.doNo(no, x.conquista);
  return c ? { c, conquista: x.conquista } : null;
}
/** O raio de uma joia (`{ min, max }`, nas unidades da árvore): o anel do Fio de Esperança ou o da única; sem raio, null. */
export function raioDaJoia(peca) {
  const anel = Math.round(Number(peca?.poe?.af?.raio_anel) || 0);
  if (anel > 0) {
    const [min, max] = RAIOS_DE_JOIA.aneis[Math.min(anel, RAIOS_DE_JOIA.aneis.length) - 1];
    return { min, max };
  }
  const nome = dadosDaJoiaUnica(peca)?.raio;
  return nome && RAIOS_DE_JOIA[nome] ? { min: 0, max: RAIOS_DE_JOIA[nome] } : null;
}
const dentro = (no, s, r) => { const d = Math.hypot(no.x - s.x, no.y - s.y); return d <= r.max && (r.min <= 0 || d > r.min); };
/** As passivas no raio `r` do encaixe `s` (todas, alocadas ou não). Memorizado por encaixe e raio. */
const NO_RAIO = new Map();
function passivasNoRaio(s, r) {
  const chave = `${s.id}|${r.min}|${r.max}`;
  if (!NO_RAIO.has(chave)) NO_RAIO.set(chave, ARVORE.nos.filter((n) => ehPassivaDoRaio(n) && dentro(n, s, r)));
  return NO_RAIO.get(chave);
}
const v0 = (af, k) => Number(af?.[k]) || 0;

const TIPOS_DE_DANO_PARA_FOGO = new Set(['phys_dmg', 'ice_dmg', 'energy_dmg', 'chaos_dmg']);
/** O aumento de um tipo de dano passado para Fogo, com a condição que tinha (`phys_dmg@ataque+comMaca` → `fire_dmg@ataque+comMaca`). */
function paraFogo(ef) {
  const m = /^([a-z_]+)(.*)$/.exec(ef.add ?? '');
  return m && TIPOS_DE_DANO_PARA_FOGO.has(m[1]) ? { ...ef, add: `fire_dmg${m[2]}` } : ef;
}
/** Os atributos transformados (`raio_dex_para_str` …): a chave do atributo que a joia troca. */
const TRANSFORMA_ATRIBUTO = { 'raio_dex_para_str': ['dex', 'str'], 'raio_int_para_str': ['int', 'str'], 'raio_str_para_dex': ['str', 'dex'], 'raio_int_para_dex': ['int', 'dex'], 'raio_dex_para_int': ['dex', 'int'], 'raio_str_para_int': ['str', 'int'] };
/**
 * Os aumentos convertidos: `[de, para]` (o fator é o % da linha). Na árvore, a Vida% e a Mana% são `{ stat: 'life'|'mana', pct }` (o formato das
 * especializações) e o Escudo de Energia%/Armadura% são `{ add: 'es_pct'|'armour_pct', valor }`.
 */
const CONVERTE = { 'raio_es_para_armadura': [{ add: 'es_pct' }, { add: 'armour_pct' }], 'raio_vida_para_es': [{ stat: 'life' }, { add: 'es_pct' }], 'raio_vida_para_mana': [{ stat: 'life' }, { stat: 'mana' }] };
const valorDoEf = (ef) => (ef.add ? ef.valor : ef.stat ? ef.pct : ef.tag ? ef.dano : ef.valor) ?? 0;
const comValor = (ef, v) => (ef.add ? { ...ef, valor: v } : ef.stat ? { ...ef, pct: v } : ef.tag ? { ...ef, dano: v } : { ...ef, valor: v });
const ehDo = (ef, x) => (x.add ? ef.add === x.add : ef.stat === x.stat);
/** As condições de corpo a corpo que a Queda de Lioneye passa para Arcos. */
const CORPO_A_CORPO = /^(corpo|armaCorpo|comEspada|comMachado|comMaca|comCetro|comAdaga|comGarra|comCajado|umaMao|duasMaos|desarmado)$/;
function paraArco(ef) {
  const i = (ef.add ?? '').indexOf('@');
  if (i < 0) return ef;
  const conds = ef.add.slice(i + 1).split('+');
  if (!conds.some((c) => CORPO_A_CORPO.test(c))) return ef;
  const novas = [...new Set(conds.map((c) => (CORPO_A_CORPO.test(c) ? 'comArco' : c)))];
  return { ...ef, add: `${ef.add.slice(0, i)}@${novas.join('+')}` };
}
/** "por cada N de <atributo> nas Passivas Alocadas / Não Alocadas no Raio": `[atributo, alocadas?, a chave que ganha, a chave do N]`. */
const POR_ATRIBUTO_NO_RAIO = {
  'raio_menos_str_por_str': ['str', true, 'str', 'raio_menos_str_por_str_cada'], 'raio_vida_rec_por_str_alocada': ['str', true, 'recuperacao_vida_inc', 'raio_vida_rec_por_str_alocada_cada'],
  'raio_crit_multi_por_str_livre': ['str', false, 'crit_dmg', 'raio_crit_multi_por_str_livre_cada'], 'raio_vida_rec_por_str_livre': ['str', false, 'recuperacao_vida_inc', 'raio_vida_rec_por_str_livre_cada'],
  'raio_menos_dex_por_dex': ['dex', true, 'dex', 'raio_menos_dex_por_dex_cada'], 'raio_mov_por_dex_alocada': ['dex', true, 'move_speed', 'raio_mov_por_dex_alocada_cada'],
  'raio_precisao_por_dex_livre': ['dex', false, 'accuracy', 'raio_precisao_por_dex_livre_cada'], 'raio_mov_por_dex_livre': ['dex', false, 'move_speed', 'raio_mov_por_dex_livre_cada'],
  'raio_menos_int_por_int': ['int', true, 'int', 'raio_menos_int_por_int_cada'], 'raio_mana_rec_por_int_alocada': ['int', true, 'recuperacao_mana_inc', 'raio_mana_rec_por_int_alocada_cada'],
  'raio_dot_multi_por_int_livre': ['int', false, 'dot_multi', 'raio_dot_multi_por_int_livre_cada'], 'raio_mana_rec_por_int_livre': ['int', false, 'recuperacao_mana_inc', 'raio_mana_rec_por_int_livre_cada'],
};
/** "Notáveis no Raio são Transformadas para conceder: …" — a chave da joia → o que o notável passa a dar. */
const NOTAVEL_VIRA = { 'raio_notaveis_lacaio_mov': 'minion_move', 'raio_notaveis_lacaio_dano_recebido': 'lacaios_dano_recebido', 'raio_notaveis_custo_mana': 'custo_mana_inc', 'raio_notaveis_dano_magico': 'spell_dmg' };
/** Os Sonhos e os Pesadelos: `[resistência do nó, a chave que ganha, % do valor]` (o % vem da linha da joia). */
const DA_RESISTENCIA = { 'raio_res_fogo_tolerancia': ['fire_res', 'carga_tolerancia_ao_matar'], 'raio_res_gelo_frenesi': ['ice_res', 'carga_frenesi_ao_matar'], 'raio_res_raio_poder': ['energy_res', 'carga_poder_ao_matar'], 'raio_res_fogo_bloqueio': ['fire_res', 'block'], 'raio_res_gelo_supressao': ['ice_res', 'spell_suppression'], 'raio_res_raio_bloqueio_magico': ['energy_res', 'spell_block'] };
/** O atributo que o nó dá (a soma dos `str`/`dex`/`int` dele). */
const atributoDoNo = (no, passivas, atr) => efeitosDoNo(no, passivas).reduce((n, ef) => n + (ef.add === atr ? ef.valor : 0), 0);

/**
 * (lote 55, a Personalidade Dividida: "Este Encaixe de Joia tem efeito aumentado em 25% por Habilidade Passiva Alocada entre ele e o ponto de
 * início da sua Classe" — "Sempre conta o caminho mais curto possível") Quantas passivas alocadas há entre o encaixe e o início da sua classe:
 * como o PoB (`PassiveSpec:SetNodeDistanceToClassStart`), a busca em largura do encaixe pelas passivas ALOCADAS (sem passar por Maestria nem por
 * outro início), até um vizinho ser o início — a distância menos 1. 0 sem caminho.
 */
export function passivasAteOInicio(estado, idDoEncaixe) {
  const inicio = inicioDe(estado);
  const meus = new Set(estado?.passivas?.alocados ?? []);
  if (!inicio || !meus.has(idDoEncaixe)) return 0;
  const dist = new Map([[idDoEncaixe, 0]]);
  const fila = [idDoEncaixe];
  for (let i = 0; i < fila.length; i++) {
    const no = noDe(estado, fila[i]);
    const d = dist.get(fila[i]) + 1;
    for (const c of no?.conexoes ?? []) {
      if (c === inicio) return d - 1;
      const outro = noDe(estado, c);
      if (!meus.has(c) || dist.has(c) || !outro || outro.tipo === 'start' || outro.ascendencia || no.tipo === 'mastery') continue;
      dist.set(c, d);
      fila.push(c);
    }
  }
  return 0;
}
/** (lote 52) O Talento Puro: a linha de cada classe → a classe e os atributos que ela dá (os mesmos das linhas comuns do PoE). */
const TALENTO_PURO = {
  'talento_puro_marauder': ['Marauder', ['area_inc@corpo']], 'talento_puro_duelist': ['Duelist', ['life_leech']], 'talento_puro_ranger': ['Ranger', ['move_speed']],
  'talento_puro_shadow': ['Shadow', ['crit_chance']], 'talento_puro_witch': ['Witch', ['mana_regen_max_pct']], 'talento_puro_templar': ['Templar', ['elem_pen']],
  'talento_puro_scion': ['Scion', ['str', 'dex', 'int']],
};
/** A árvore alocada (`meus`) se conecta ao início de `classe`? O da sua classe, sempre; o de outra, com uma passiva sua encostada nele. */
function conectaAoInicio(estado, meus, classe) {
  if (classeDe(estado) === classe) return true;
  const id = ARVORE.inicios[classe];
  const no = id ? ARVORE.porId.get(id) : null;
  return !!no && (meus.has(id) || (no.conexoes ?? []).some((c) => meus.has(c)));
}
/**
 * O que as joias fazem nos nós do raio delas: `{ porNo: Map(id → [joia]), extras: {add: valor}, chieftain }` — `porNo` (os alocados) e os
 * `extras` (o que vem por joia, não por nó: as Temperadas, as pequenas não alocadas do Instindo Sobrenatural). Null sem joia com raio.
 */
function raiosDasJoias(estado, alocados) {
  const ativas = joiasAtivas(estado);
  if (!ativas.length) return null;
  // (lote 77) a joia do encaixe que a Ramificadora cria não tem raio (`joiasComRaio`) — mas o que não é raio dela vale (o Talento Puro)
  const comRaio = new Set(joiasComRaio(estado).map((j) => j.no.id));
  // (o Chieftain: as joias NÃO ÚNICAS ganham o Raio Grande)
  let transforma = 0;
  let forca = 0;
  for (const id of alocados) {
    for (const ef of efeitosDoNo(noDe(estado, id) ?? {}, estado.passivas)) {
      if (ef.add === 'joia_transforma_fogo') transforma += ef.valor;
      else if (ef.add === 'joia_forca_no_raio') forca += ef.valor;
    }
  }
  const meus = new Set(alocados);
  const porNo = new Map();
  const extras = {};
  const daJoia = []; // (os efeitos de especialização — Vida%, Mana% — das pequenas não alocadas do Instindo Sobrenatural)
  const somar = (k, v) => { if (v) extras[k] = (extras[k] ?? 0) + v; };
  for (const { no: s, peca } of ativas) {
    const af = peca.poe?.af ?? {};
    const raios = [];
    const temRaio = comRaio.has(s.id);
    const r = temRaio ? raioDaJoia(peca) : null;
    // (lote 48) a Atemporal: as passivas do raio são Conquistadas (`conquista` — `itens-poe/atemporais.mjs`)
    const conquista = CONQUISTA?.daPeca(peca) ?? null;
    if (r) raios.push({ r, af, chieftain: null, ...(conquista ? { conquista } : {}) });
    if (temRaio && (transforma > 0 || forca > 0) && peca.poe?.raridade !== 'unico') raios.push({ r: { min: 0, max: RAIOS_DE_JOIA.grande }, af: {}, chieftain: { transforma: transforma > 0, forca } });
    for (const x of raios) {
      const nos = passivasNoRaio(s, x.r);
      for (const no of nos) if (meus.has(no.id)) (porNo.get(no.id) ?? porNo.set(no.id, []).get(no.id)).push(x);
      // "por cada N de <atributo> nas Passivas Alocadas / Não Alocadas no Raio"
      for (const [k, [atr, alocadas, destino, kCada]] of Object.entries(POR_ATRIBUTO_NO_RAIO)) {
        if (!v0(x.af, k)) continue;
        const soma = nos.filter((n) => meus.has(n.id) === alocadas).reduce((t, n) => t + atributoDoNo(n, estado.passivas, atr), 0);
        const cada = Math.max(1, v0(x.af, kCada) || 1);
        somar(destino, v0(x.af, k) * Math.floor(soma / cada));
      }
      // o Instindo Sobrenatural: "Concede todos os bônus das Pequenas Habilidades Passivas Não Alocadas no Raio"
      if (v0(x.af, 'raio_pequenos_livres_concedem') > 0) for (const n of nos) if (!meus.has(n.id) && ehPequena(n)) for (const ef of efeitosDoNo(n, estado.passivas)) if (ef.add) somar(ef.add, ef.valor); else if (ef.stat || ef.tag) daJoia.push(ef);
      // (lote 51) o Aprendizado Inspirado: "Com 4 Notáveis Alocados no Raio, Ao Matar um monstro Raro, você recebe 1 de seus Modificadores
      // por 20 segundos" — com os notáveis no raio, o abate do Raro dá o modificador (`mods-poe.aprenderDoRaro`)
      const pede = v0(x.af, 'raio_aprendizado_notaveis');
      if (pede > 0 && nos.filter((n) => meus.has(n.id) && n.tipo === 'notable').length >= pede) {
        somar('aprendizado_inspirado_n', v0(x.af, 'raio_aprendizado_n') || 1);
        extras.aprendizado_inspirado_s = Math.max(extras.aprendizado_inspirado_s ?? 0, v0(x.af, 'raio_aprendizado_s'));
      }
      // (lote 54) a Fome Eterna: "Com ao menos 40 de Inteligência no Raio, Espectros Erguidos tem 50% de chance de ganhar Devorador de Almas por
      // 20 segundos ao Matar" — a Inteligência das passivas ALOCADAS no raio (`LacaiosPoe.oQueInvoca` → `aoMatarDoLacaio`)
      const inteligencia = v0(x.af, 'raio_fome_int');
      if (inteligencia > 0 && nos.filter((n) => meus.has(n.id)).reduce((t, n) => t + atributoDoNo(n, estado.passivas, 'int'), 0) >= inteligencia) {
        somar('espectro_devorador_chance', v0(x.af, 'raio_fome_chance'));
        extras.espectro_devorador_s = Math.max(extras.espectro_devorador_s ?? 0, v0(x.af, 'raio_fome_s'));
      }
    }
    // (lote 52) o TALENTO PURO: "Enquanto sua Árvore Passiva se conectar com a de outra classe, receba: …" — o bônus de cada classe cujo início a
    // árvore alcança (o da sua classe sempre; o de outra, com uma passiva sua encostada nele). Sem raio: vale de qualquer encaixe.
    for (const [k, [classe, destinos]] of Object.entries(TALENTO_PURO)) if (v0(af, k) && conectaAoInicio(estado, meus, classe)) for (const d of destinos) somar(d, v0(af, k));
  }
  return { porNo, extras, daJoia };
}

/** Os efeitos de um nó alocado com as joias que o alcançam (`raiosDasJoias().porNo`): a lista nova (sem as joias, a de sempre). */
function efeitosNoRaio(no, efs, joias) {
  // (lote 48) o nó CONQUISTADO por uma Atemporal: as linhas da conquista no lugar das dele (ou somadas a elas); "Habilidades Passivas
  // Conquistadas não podem ser modificadas por outras joias" — as outras joias do raio não mexem nele.
  const cq = conquistaDoNo(no, joias);
  if (cq) {
    const novos = CONQUISTA.efeitos(cq.c.linhas);
    return cq.c.substitui ? novos : [...efs, ...novos];
  }
  let lista = efs;
  let mais = [];
  for (const { af, chieftain } of joias) {
    if (chieftain) {
      if (chieftain.transforma) lista = lista.map(paraFogo);
      if (chieftain.forca > 0 && (no.tipo === 'small' || no.tipo === 'notable')) mais.push({ add: 'str', valor: chieftain.forca });
      continue;
    }
    if (ehPequena(no) && v0(af, 'raio_pequenos_alocados_nada') > 0) return [];
    if (no.tipo === 'notable' && v0(af, 'raio_notaveis_nada') > 0) return [];
    const vira = Object.entries(NOTAVEL_VIRA).filter(([k]) => v0(af, k));
    if (no.tipo === 'notable' && vira.length) {
      lista = vira.map(([k, add]) => ({ add, valor: v0(af, k) }));
      continue;
    }
    if (no.tipo !== 'notable' && no.tipo !== 'keystone' && v0(af, 'raio_efeito_nao_notaveis')) {
      const f = 1 + v0(af, 'raio_efeito_nao_notaveis') / 100;
      lista = lista.map((ef) => comValor(ef, valorDoEf(ef) * f));
    }
    for (const [k, [de, para]] of Object.entries(TRANSFORMA_ATRIBUTO)) if (v0(af, k) > 0) lista = lista.map((ef) => (ef.add === de ? { ...ef, add: para } : ef));
    for (const [k, [de, para]] of Object.entries(CONVERTE)) {
      const pct = v0(af, k);
      if (pct) lista = lista.map((ef) => (ehDo(ef, de) ? (para.add ? { add: para.add, valor: (valorDoEf(ef) * pct) / 100 } : { stat: para.stat, pct: (valorDoEf(ef) * pct) / 100 }) : ef));
    }
    if (v0(af, 'raio_corpo_para_arco') > 0) lista = lista.map(paraArco);
    if (v0(af, 'raio_passivas_vida')) mais.push({ add: 'life', valor: v0(af, 'raio_passivas_vida') });
    for (const [k, [res, add]] of Object.entries(DA_RESISTENCIA)) {
      const pct = v0(af, k);
      if (!pct) continue;
      const valor = lista.reduce((t, ef) => t + (ef.add === res ? ef.valor : 0), 0);
      if (valor) mais.push({ add, valor: (valor * pct) / 100 });
    }
  }
  return mais.length ? [...lista, ...mais] : lista;
}

/**
 * (lote 29) As passivas que se pode ALOCAR SEM LIGAÇÃO ("Habilidades passivas ao alcance podem ser atribuídas sem estarem conectadas à sua
 * árvore": o Salto Intuitivo, o Fio de Esperança): `Map(id do nó → id do encaixe)`, as do raio das joias com a linha nos encaixes alocados
 * (`semEncaixes`: os encaixes que não contam — o respec que os tira).
 */
export function liberadosPorJoias(estado, semEncaixes = null) {
  const lista = new Map();
  // (lote 77) o raio do ENCAIXE não vale no que a Ramificadora cria (`joiasComRaio`); o da Fuga Impossível é em volta da pedra fundamental — vale
  const comRaio = new Set(joiasComRaio(estado).map((j) => j.no.id));
  for (const { no: s, peca } of joiasAtivas(estado)) {
    if (semEncaixes?.has(s.id)) continue;
    const r = raioDaJoia(peca);
    if (r && comRaio.has(s.id) && v0(peca.poe?.af, 'raio_aloca_sem_conexao') > 0) for (const n of passivasNoRaio(s, r)) if (!lista.has(n.id)) lista.set(n.id, s.id);
    // (lote 56, a Fuga Impossível: "Habilidades passivas ao alcance de <Pedra Fundamental> podem ser atribuídas sem estarem conectadas à sua
    // árvore") — o raio da joia em volta da PEDRA FUNDAMENTAL sorteada, não do encaixe (`fuga_impossivel:<pedra>`)
    for (const [k, v] of Object.entries(peca.poe?.af ?? {})) {
      const pedra = r && v > 0 && k.startsWith('fuga_impossivel:') ? PEDRA_PELO_SLUG().get(k.slice('fuga_impossivel:'.length)) : null;
      if (pedra) for (const n of passivasNoRaio(pedra, r)) if (!lista.has(n.id)) lista.set(n.id, s.id);
    }
  }
  return lista;
}
/** (lote 56) As pedras fundamentais da árvore pelo nome (`slugDoNome` — a chave da Fuga Impossível). */
let PEDRAS = null;
const PEDRA_PELO_SLUG = () => (PEDRAS ??= new Map(ARVORE.nos.filter((n) => n.tipo === 'keystone' && !n.ascendencia).map((n) => [slugDoNome(n.nome), n])));
/**
 * (lote 56) A CHAMA PROIBIDA e a CARNE PROIBIDA: "Aloca <Notável> se você possuir o modificador correspondente na Carne/Chama Proibida" — com as
 * duas encaixadas e o MESMO notável de ascendência nelas, ele vale como alocado; no PoE as joias pedem a classe do notável — aqui, o notável de uma
 * ascendência da sua classe (de qualquer uma dela, como no PoE). Os ids dos notáveis (fora os já alocados).
 */
export function alocadosPelasProibidas(estado) {
  const chama = new Set();
  const carne = new Set();
  for (const { peca } of joiasAtivas(estado)) {
    for (const [k, v] of Object.entries(peca.poe?.af ?? {})) {
      if (!(v > 0)) continue;
      if (k.startsWith('proibida_chama:')) chama.add(k.slice('proibida_chama:'.length));
      if (k.startsWith('proibida_carne:')) carne.add(k.slice('proibida_carne:'.length));
    }
  }
  if (!chama.size || !carne.size) return [];
  const classe = classeDe(estado);
  const meus = new Set(estado?.passivas?.alocados ?? []);
  return ARVORE.nos.filter((n) => n.ascendencia && n.tipo === 'notable' && ARVORE.ascendencias?.[n.ascendencia]?.classe === classe && !meus.has(n.id) && chama.has(slugDoNome(n.nome)) && carne.has(slugDoNome(n.nome))).map((n) => n.id);
}

// --------------------------------------------------------------- os efeitos

/*
 * ---- Cache por personagem, pela ASSINATURA dos nós alocados ----
 * A ficha é pedida várias vezes por tique; a árvore só muda quando um nó entra
 * ou sai. A soma é refeita só quando a lista muda (o prompt: "não recalcular
 * a árvore a cada frame"). (lote 27: ou quando uma joia entra ou sai de um encaixe — `joiasVersao`.)
 */
let CACHE = new WeakMap();
const VAZIO = Object.freeze({ adds: {}, dano: {}, stats: {}, legado: {}, keystones: [], habilidades: new Set(), fontes: {}, dominios: {} });

/** A soma dos efeitos dos nós alocados. */
export function efeitos(estado) {
  if (!estado) return VAZIO;
  const alocados = estado.passivas?.alocados ?? [];
  const joias = estado.passivas?.joiasVersao ?? 0;
  const guardado = CACHE.get(estado);
  // Caminho rápido: o mesmo array, do mesmo tamanho e com a mesma ponta (alocar põe no fim; respec muda o tamanho).
  if (guardado && guardado.ref === alocados && guardado.n === alocados.length && guardado.ultimo === alocados[alocados.length - 1] && guardado.primeiro === alocados[0] && guardado.joias === joias) return guardado.valor;
  const assinatura = `${alocados.join(',')}|${joias}`;
  if (guardado?.assinatura === assinatura) {
    Object.assign(guardado, { ref: alocados, n: alocados.length, ultimo: alocados[alocados.length - 1], primeiro: alocados[0] });
    return guardado.valor;
  }
  const r = { adds: {}, dano: {}, stats: {}, legado: {}, keystones: [], habilidades: new Set(), fontes: {}, dominios: {} };
  const fonte = (chave, nome, v) => (r.fontes[chave] ??= []).push({ especializacao: `Árvore: ${nome}`, pct: v });
  // (lotes 27 e 29) o que as joias fazem nos nós do raio delas, e o que dão por joia.
  const raios = raiosDasJoias(estado, alocados);
  for (const [k, v] of Object.entries(raios?.extras ?? {})) r.adds[k] = (r.adds[k] ?? 0) + v;
  for (const ef of raios?.daJoia ?? []) {
    if (ef.tag) { r.dano[ef.tag] = (r.dano[ef.tag] ?? 0) + ef.dano; fonte(ef.tag, 'Joia (raio)', ef.dano); }
    else if (ef.stat) { r.stats[ef.stat] = (r.stats[ef.stat] ?? 0) + ef.pct; fonte(ef.stat, 'Joia (raio)', ef.pct); }
  }
  // (lote 56) + os notáveis de ascendência que a Chama e a Carne Proibida alocam
  for (const id of [...alocados, ...alocadosPelasProibidas(estado)]) {
    const no = noDe(estado, id);
    if (!no) continue;
    if (no.dominio) r.dominios[no.dominio] = (r.dominios[no.dominio] ?? 0) + 1;
    const doRaio = raios?.porNo.get(id);
    for (const ef of doRaio ? efeitosNoRaio(no, efeitosDoNo(no, estado.passivas), doRaio) : efeitosDoNo(no, estado.passivas)) {
      if (ef.tag) {
        r.dano[ef.tag] = (r.dano[ef.tag] ?? 0) + ef.dano;
        fonte(ef.tag, no.nome, ef.dano);
      } else if (ef.stat) {
        r.stats[ef.stat] = (r.stats[ef.stat] ?? 0) + ef.pct;
        fonte(ef.stat, no.nome, ef.pct);
      } else if (ef.add) r.adds[ef.add] = (r.adds[ef.add] ?? 0) + ef.valor;
      else if (ef.legado) r.legado[ef.legado] = (r.legado[ef.legado] ?? 0) + ef.valor;
    }
    // (lote 48) a keystone CONQUISTADA: a do líder da Atemporal no lugar (as linhas dela valem pelos efeitos acima; a mecânica da de antes sai)
    const cqk = no.tipo === 'keystone' && doRaio ? conquistaDoNo(no, doRaio) : null;
    if (cqk) r.keystones.push({ regra: 'texto', texto: cqk.c.linhas.join(' '), no: no.id, nome: cqk.c.nome ?? no.nome, conquistada: true });
    else if (no.tipo === 'keystone' && no.keystone) {
      r.keystones.push({ ...no.keystone, no: no.id, nome: no.nome });
      // A habilidade da árvore antiga e a keystone do PoE com mecânica: o combate pergunta por elas (`temHabilidade`).
      if (no.keystone.regra === 'habilidade' || no.keystone.regra === 'poe') r.habilidades.add(no.keystone.id);
    }
  }
  CACHE.set(estado, { assinatura, valor: r, ref: alocados, n: alocados.length, ultimo: alocados[alocados.length - 1], primeiro: alocados[0], joias });
  return r;
}

/** O personagem tem a keystone/habilidade `id` alocada? (as do PoE: `keystones.IDS_DO_POE`) */
export const temHabilidade = (estado, id) => efeitos(estado).habilidades.has(id) || keystoneDasPecas(estado, id);
/** A keystone que uma PEÇA do PoE dá (únicos: "Mente Sobre Matéria", "Postura Inabalável"… — `keystone:<id>` no `poe.af` da peça vestida). */
export function keystoneDasPecas(estado, id) {
  for (const [slot, p] of Object.entries(estado?.equipment ?? {})) if (p && slot !== 'backpack' && Number(p.poe?.af?.[`keystone:${id}`]) > 0) return true;
  return false;
}

/** Os vessels do Gem Atelier: nós de cada domínio ÷ a referência (0..1). */
export function fracaoDosDominios(estado) {
  const ef = efeitos(estado);
  const ref = CONFIG.vessels;
  const total = Object.values(ef.dominios).reduce((a, b) => a + b, 0);
  const f = (n, r) => Math.min(1, n / Math.max(1, r));
  return { verde: f(total, ref.verde), vermelho: f(ef.dominios.defesa ?? 0, ref.vermelho), roxo: f(ef.dominios.dano ?? 0, ref.roxo), azul: f(ef.dominios.sustento ?? 0, ref.azul) };
}

/** O que o cliente precisa do personagem (a árvore em si vai à parte, uma vez: `arvoreParaCliente`). */
export function vista(estado, emCacada = false) {
  const { passivas } = garantir(estado);
  return {
    alocados: [...passivas.alocados],
    inicio: inicioDe(estado),
    // os inícios de outras classes liberados por um nó ("Caminho do Marauder" da Ascendente)
    ...(iniciosExtras(estado).length ? { iniciosExtras: iniciosExtras(estado) } : {}),
    pontos: pontos(estado),
    respecsGratis: passivas.respecsGratis,
    // Árvore do PoE: a ascendência (escolhida ou não), os pontos dela e as opções da classe.
    ...(passivas.maestrias && Object.keys(passivas.maestrias).length ? { maestrias: { ...passivas.maestrias } } : {}),
    ...(ARVORE.ascendencias ? { ascendencia: passivas.ascendencia ?? null, inicioAscendencia: inicioDaAscendencia(estado), pontosAscendencia: pontosDeAscendencia(estado), ascendencias: ascendenciasDaClasse(estado) } : {}),
    precoPorNo: precoDoRespec(estado, 1),
    // o respec de graça (jogo oficial): a tela diz "grátis" em vez do preço
    ...(regrasDoRespec().gratis ? { respecGratis: true } : {}),
    podeTirar: !(regrasDoRespec().soForaDaCacada && emCacada),
    // (lote 27) as joias nos encaixes (a peça inteira: a tela mostra o ícone e o balão dela).
    ...(passivas.joias && Object.keys(passivas.joias).length ? { joias: structuredClone(passivas.joias) } : {}),
    // (lote 29) os nós que as joias deixam alocar sem ligação → o encaixe de cada um (a tela: o caminho e o "sem este nó").
    ...(passivas.joias ? (() => { const l = liberadosPorJoias(estado); return l.size ? { liberados: Object.fromEntries(l) } : {}; })() : {}),
    // (lote 29) o raio de cada joia encaixada (`{ min, max }`: o anel do Fio de Esperança tem o de dentro) — a tela desenha.
    ...(passivas.joias ? (() => { const r = Object.fromEntries(joiasComRaio(estado).map((j) => [j.no.id, raioDaJoia(j.peca)]).filter(([, x]) => x)); return Object.keys(r).length ? { raios: r } : {}; })() : {}),
    // (lote 64) os nós que as Ramificadoras encaixadas criam (no formato da árvore da tela) e a entrada de cada encaixe da borda
    // (lote 77: o encaixe interno vai como encaixe de joia — a tela mostra a joia nele e o quadro de pôr e tirar)
    ...(() => { const g = grafoDe(estado); return g.extras.size ? { ramificadoras: { nos: [...g.extras.values()].map(noDaRamificadoraParaCliente), encaixes: Object.fromEntries([...g.porEncaixe.keys()].map((id) => [id, g.porId.get(id)?.conexoes ?? []])) } } : {}; })(),
    // (lote 48) as passivas CONQUISTADAS pelas Atemporais encaixadas (as do raio, alocadas ou não): o balão mostra as linhas da conquista
    ...(passivas.joias && CONQUISTA ? (() => { const c = conquistasParaATela(estado); return Object.keys(c).length ? { conquistas: c } : {}; })() : {}),
  };
}
const CONQUISTADORES = { vaal: 'pelos Vaal', karui: 'pelos Karui', maraketh: 'pelos Maraketh', templar: 'pelos Templários', eternal: 'pelo Império Eterno', kalguur: 'pelos Kalguuranos' };
/** (lote 48) `{ nó: { nome, linhas, estados, substitui, por } }` dos nós no raio das Atemporais encaixadas (a primeira que alcança vale). */
function conquistasParaATela(estado) {
  const saida = {};
  for (const { no: s, peca } of joiasComRaio(estado)) {
    const c = CONQUISTA.daPeca(peca);
    const r = c ? raioDaJoia(peca) : null;
    if (!r) continue;
    for (const n of passivasNoRaio(s, r)) {
      if (saida[n.id]) continue;
      const x = CONQUISTA.doNo(n, c);
      if (!x) continue;
      saida[n.id] = { ...(x.nome ? { nome: x.nome } : {}), linhas: x.linhas, estados: x.linhas.map((l) => (CONQUISTA.efeitos([l]).length ? 'novo' : 'registrado')), substitui: !!x.substitui, por: CONQUISTADORES[c.tipo] ?? c.tipo };
    }
  }
  return saida;
}

/** (lote 64) Um nó que a Ramificadora cria, para a tela: existe (sem a marca de "só com a joia"); o encaixe interno é encaixe de joia (lote 77). */
function noDaRamificadoraParaCliente(n) {
  const c = noParaCliente(n);
  delete c.soDaRamificadora;
  if (n.encaixeInterno) c.encaixeDeJoia = true;
  return c;
}

/** O nó para a tela (sem o que é só do servidor). (lote 64: + os das Ramificadoras — a posição, o encaixe e o índice na joia.) */
function noParaCliente(n) {
  return {
    id: n.id,
    nome: n.nome,
    tipo: n.tipo,
    x: n.x,
    y: n.y,
    custo: custoDe(n),
    levelMinimo: n.levelMinimo ?? 0,
    efeitos: n.efeitos ?? [],
    // Árvore do PoE: os textos originais de cada linha e o estado da tradução (o balão mostra como no PoE).
    ...(n.textos ? { textos: n.textos, estados: n.estados ?? [] } : {}),
    // (ciclo 7) o porquê de cada linha sem efeito igual ("não se aplica ao jogo: …", a diferença do aproximado) — o balão mostra.
    ...(n.notas ? { notas: n.notas } : {}),
    ...(n.nomeEn ? { nomeEn: n.nomeEn } : {}),
    // (lote 27) o encaixe de joia que aceita joia (os das Ramificadoras, não).
    ...(ehEncaixeDeJoia(n) ? { encaixeDeJoia: true } : {}),
    // (lote 60) o proxy e o encaixe interno das Ramificadoras: só com a joia encaixada (a tela não os oferece).
    ...(soDaRamificadora(n) ? { soDaRamificadora: true } : {}),
    ...(n.ascendencia ? { ascendencia: n.ascendencia } : {}),
    // O ícone do PoE da passiva de ascendência (servido em /api/jogo/poe/icone/ascendencia/).
    ...(n.icone ? { icone: n.icone } : {}),
    ...(n.grupo != null ? { grupo: n.grupo } : {}),
    // A opção de escolha de uma ascendência (o nó-pai deixa escolher uma, sem gastar ponto).
    ...(n.opcaoDe != null ? { opcaoDe: n.opcaoDe } : {}),
    // A keystone do PoE aproximada: a diferença para o PoE (o balão mostra).
    ...(n.keystone?.nota ? { notaDoDraevor: n.keystone.nota } : {}),
    ...(n.opcoes ? { opcoes: n.opcoes.map((o) => ({ id: o.id, textos: o.textos, estados: o.estados, ...(o.notas ? { notas: o.notas } : {}), efeitos: o.efeitos })) } : {}),
    descricao: n.descricao ?? null,
    // O texto de sabor (o itálico do balão, como no Path of Exile), o atributo do nó de caminho e a órbita da roda (arcos).
    flavor: n.flavor ?? null,
    atributo: n.atributo ?? null,
    orbita: n.orbita ?? null,
    tags: n.tags ?? [],
    cluster: n.cluster,
    classe: n.classe ?? null,
    conexoes: n.conexoes ?? [],
    ...(n.ramificadora ? { ramificadora: n.ramificadora } : {}),
    // (lote 78) o ícone do nó da Ramificadora nas folhas da árvore (a chave de `arvore-sprites.json` — `tools/sprites-ramificadoras.mjs`): o id
    // dele não é da árvore, então a tela não o acha por id
    ...(n.ramificadora && n.icone ? { arte: String(n.icone).replace(/^Art\/2DArt\/SkillIcons\/passives\//, '').replace(/\.png$/i, '') } : {}),
    ...(n.encaixeInterno ? { encaixeInterno: true } : {}),
    // (lote 77) o encaixe de EXPANSÃO: o tamanho (2 Grande, 1 Médio, 0 Pequeno — a tela só oferece a Ramificadora que cabe) e o proxy dele; o
    // PROXY: o centro do grupo dele (a tela esconde o fundo do grupo sem a joia e, com ela, desenha o do tamanho da joia ali — como o PoB)
    ...(n.expansao ? { expansao: { tamanho: n.expansao.tamanho, ...(n.expansao.proxy != null ? { proxy: String(n.expansao.proxy) } : {}) } } : {}),
    ...(n.placeholder && n.proxy?.grupo ? { grupoDoProxy: [Math.round(n.proxy.grupo.x), Math.round(n.proxy.grupo.y)] } : {}),
  };
}

/** A árvore para a tela: nós (sem o que é só do servidor) e clusters. */
export function arvoreParaCliente() {
  return {
    versao: ARVORE.versao,
    // (lote 27) o raio das joias (a tela desenha o Raio Grande em volta do encaixe escolhido).
    ...(ARVORE.id === 'poe' ? { poe: true, ascendencias: ARVORE.ascendencias ?? {}, raiosDeJoia: RAIOS_DE_JOIA } : {}),
    inicios: ARVORE.inicios,
    clusters: ARVORE.clusters,
    custo: CONFIG.custo,
    nos: ARVORE.nos.map(noParaCliente),
  };
}

// (09/10) "se você tiver ao menos N Maestrias de Vida alocadas" (as maestrias da árvore do PoE): as maestrias alocadas cujo nome tem o tema.
// (ciclo 7, lote F) `tema` null: todas as maestrias alocadas ("por Habilidade Passiva de Maestria Alocada"); '*': os TIPOS diferentes (os nomes
// distintos — "para cada tipo diferente de Maestria Alocada por você").
definirLeitorDeMaestrias((estado, tema) => {
  const maestrias = (estado?.passivas?.alocados ?? []).map((id) => ARVORE.porId.get(id)).filter((n) => n?.tipo === 'mastery');
  if (tema == null) return maestrias.length;
  if (tema === '*') return new Set(maestrias.map((n) => n.nome)).size;
  return maestrias.filter((n) => new RegExp(`\\b${tema}\\b`, 'i').test(n.nome ?? '')).length;
});
