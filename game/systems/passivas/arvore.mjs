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
import { definirLeitorDeMaestrias } from '../itens-poe/condicoes-poe.mjs';

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
const ADDS_PERMITIDOS = /^[a-z_][\w:%@+.-]*$/i;
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
    const no = ARVORE.porId.get(id);
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
  let limpos = [inicio, ...(inicioAsc ? [inicioAsc] : []), ...[...new Set(p.alocados)].filter((id) => {
    const no = ARVORE.porId.get(id);
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
    const ligados = alcancaveis(ARVORE.porId, new Set([...limpos, ...iniciosExtras(estado, limpos)]), [inicio, ...(inicioAsc ? [inicioAsc] : []), ...iniciosExtras(estado, limpos)]);
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
  return { passivas: p, migrou, arvoreMudou };
}

export function pontos(estado) {
  const { passivas } = garantir(estado);
  // (+ os nós que concedem pontos de passiva — "Concede 1 Ponto de Habilidade Passiva", na Ascendente: `pontos_passiva`.)
  const total = pontosDoLevel(estado.level) + Math.max(0, Math.round(efeitos(estado).adds?.pontos_passiva ?? 0));
  // Os nós de ascendência gastam os pontos de ASCENDÊNCIA (`pontosDeAscendencia`), não estes.
  const usados = passivas.alocados.reduce((s, id) => (ARVORE.porId.get(id)?.ascendencia ? s : s + custoDe(ARVORE.porId.get(id))), 0);
  // `deficit`: pontos gastos A MAIS do que o personagem tem (um personagem antigo que caiu de level na morte, antes da regra do PoE; um nó
  // que concedia pontos e saiu). Não se aloca nada enquanto houver déficit; a tela mostra (auditoria da árvore, 09/10).
  return { total, usados, livres: Math.max(0, total - usados), ...(usados > total ? { deficit: usados - total } : {}) };
}

/** Os pontos gastos e o total se só `ficam` estivessem alocados (o respec confere antes de tirar um nó que concede pontos). */
function pontosSe(estado, ficam) {
  let concedidos = 0;
  let usados = 0;
  for (const id of ficam) {
    const no = ARVORE.porId.get(id);
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
  const usados = passivas.alocados.reduce((s, id) => (ARVORE.porId.get(id)?.ascendencia ? s + custoDe(ARVORE.porId.get(id)) : s), 0);
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
  const no = ARVORE.porId.get(id);
  if (!no) return erro('NAO_EXISTE', 'Esse nó não existe.');
  const { passivas } = garantir(estado);
  const meus = new Set(passivas.alocados);
  if (meus.has(id)) return erro('JA_ALOCADO', 'Você já tem esse nó.');
  if (no.tipo === 'start') return erro('INICIO', 'O início de outra classe não se aloca.');
  if (no.tipo === 'mastery') return podeAlocarMaestria(estado, no, opcao, meus);
  const extras = new Set(iniciosExtras(estado));
  if (!(no.conexoes ?? []).some((c) => meus.has(c) || extras.has(c))) return erro('SEM_CAMINHO', 'Esse nó não está ligado a nenhum nó seu.');
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
  if (!ARVORE.porId.has(id)) return null;
  const { passivas } = garantir(estado);
  const meus = new Set(passivas.alocados);
  if (meus.has(id)) return [];
  const veioDe = new Map();
  const fila = [...meus, ...iniciosExtras(estado).filter((x) => !meus.has(x))];
  for (const x of fila) veioDe.set(x, null);
  const origens = new Set(fila);
  for (let i = 0; i < fila.length; i++) {
    const atual = fila[i];
    for (const c of ARVORE.porId.get(atual)?.conexoes ?? []) {
      if (veioDe.has(c) || ARVORE.porId.get(c)?.tipo === 'start') continue;
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
  if (ARVORE.porId.get(id)?.tipo === 'mastery') (estado.passivas.maestrias ??= {})[id] = String(opcao);
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
export function ilhadosSemEles(estado, ids) {
  const { passivas } = garantir(estado);
  const tirar = new Set(ids);
  const fica = new Set(passivas.alocados.filter((x) => !tirar.has(x)));
  const raizes = raizesDe(estado, [...fica]);
  const ligados = alcancaveis(ARVORE.porId, new Set([...fica, ...raizes]), raizes);
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

// --------------------------------------------------------------- os efeitos

/*
 * ---- Cache por personagem, pela ASSINATURA dos nós alocados ----
 * A ficha é pedida várias vezes por tique; a árvore só muda quando um nó entra
 * ou sai. A soma é refeita só quando a lista muda (o prompt: "não recalcular
 * a árvore a cada frame").
 */
let CACHE = new WeakMap();
const VAZIO = Object.freeze({ adds: {}, dano: {}, stats: {}, legado: {}, keystones: [], habilidades: new Set(), fontes: {}, dominios: {} });

/** A soma dos efeitos dos nós alocados. */
export function efeitos(estado) {
  if (!estado) return VAZIO;
  const alocados = estado.passivas?.alocados ?? [];
  const guardado = CACHE.get(estado);
  // Caminho rápido: o mesmo array, do mesmo tamanho e com a mesma ponta (alocar põe no fim; respec muda o tamanho).
  if (guardado && guardado.ref === alocados && guardado.n === alocados.length && guardado.ultimo === alocados[alocados.length - 1] && guardado.primeiro === alocados[0]) return guardado.valor;
  const assinatura = alocados.join(',');
  if (guardado?.assinatura === assinatura) {
    Object.assign(guardado, { ref: alocados, n: alocados.length, ultimo: alocados[alocados.length - 1], primeiro: alocados[0] });
    return guardado.valor;
  }
  const r = { adds: {}, dano: {}, stats: {}, legado: {}, keystones: [], habilidades: new Set(), fontes: {}, dominios: {} };
  const fonte = (chave, nome, v) => (r.fontes[chave] ??= []).push({ especializacao: `Árvore: ${nome}`, pct: v });
  for (const id of alocados) {
    const no = ARVORE.porId.get(id);
    if (!no) continue;
    if (no.dominio) r.dominios[no.dominio] = (r.dominios[no.dominio] ?? 0) + 1;
    for (const ef of efeitosDoNo(no, estado.passivas)) {
      if (ef.tag) {
        r.dano[ef.tag] = (r.dano[ef.tag] ?? 0) + ef.dano;
        fonte(ef.tag, no.nome, ef.dano);
      } else if (ef.stat) {
        r.stats[ef.stat] = (r.stats[ef.stat] ?? 0) + ef.pct;
        fonte(ef.stat, no.nome, ef.pct);
      } else if (ef.add) r.adds[ef.add] = (r.adds[ef.add] ?? 0) + ef.valor;
      else if (ef.legado) r.legado[ef.legado] = (r.legado[ef.legado] ?? 0) + ef.valor;
    }
    if (no.tipo === 'keystone' && no.keystone) {
      r.keystones.push({ ...no.keystone, no: no.id, nome: no.nome });
      // A habilidade da árvore antiga e a keystone do PoE com mecânica: o combate pergunta por elas (`temHabilidade`).
      if (no.keystone.regra === 'habilidade' || no.keystone.regra === 'poe') r.habilidades.add(no.keystone.id);
    }
  }
  CACHE.set(estado, { assinatura, valor: r, ref: alocados, n: alocados.length, ultimo: alocados[alocados.length - 1], primeiro: alocados[0] });
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
  };
}

/** A árvore para a tela: nós (sem o que é só do servidor) e clusters. */
export function arvoreParaCliente() {
  return {
    versao: ARVORE.versao,
    ...(ARVORE.id === 'poe' ? { poe: true, ascendencias: ARVORE.ascendencias ?? {} } : {}),
    inicios: ARVORE.inicios,
    clusters: ARVORE.clusters,
    custo: CONFIG.custo,
    nos: ARVORE.nos.map((n) => ({
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
      ...(n.nomeEn ? { nomeEn: n.nomeEn } : {}),
      ...(n.ascendencia ? { ascendencia: n.ascendencia } : {}),
      // O ícone do PoE da passiva de ascendência (servido em /api/jogo/poe/icone/ascendencia/).
      ...(n.icone ? { icone: n.icone } : {}),
      ...(n.grupo != null ? { grupo: n.grupo } : {}),
      // A opção de escolha de uma ascendência (o nó-pai deixa escolher uma, sem gastar ponto).
      ...(n.opcaoDe != null ? { opcaoDe: n.opcaoDe } : {}),
      // A keystone do PoE aproximada: a diferença para o PoE (o balão mostra).
      ...(n.keystone?.nota ? { notaDoDraevor: n.keystone.nota } : {}),
      ...(n.opcoes ? { opcoes: n.opcoes.map((o) => ({ id: o.id, textos: o.textos, estados: o.estados, efeitos: o.efeitos })) } : {}),
      descricao: n.descricao ?? null,
      // O texto de sabor (o itálico do balão, como no Path of Exile), o atributo do nó de caminho e a órbita da roda (arcos).
      flavor: n.flavor ?? null,
      atributo: n.atributo ?? null,
      orbita: n.orbita ?? null,
      tags: n.tags ?? [],
      cluster: n.cluster,
      classe: n.classe ?? null,
      conexoes: n.conexoes ?? [],
    })),
  };
}

// (09/10) "se você tiver ao menos N Maestrias de Vida alocadas" (as maestrias da árvore do PoE): as maestrias alocadas cujo nome tem o tema.
definirLeitorDeMaestrias((estado, tema) => (estado?.passivas?.alocados ?? []).filter((id) => {
  const n = ARVORE.porId.get(id);
  return n?.tipo === 'mastery' && new RegExp(`\\b${tema}\\b`, 'i').test(n.nome ?? '');
}).length);
