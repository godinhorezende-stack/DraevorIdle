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

const ler = (arq) => JSON.parse(readFileSync(new URL(`../../gamedata/passivas/${arq}`, import.meta.url), 'utf8'));
export const CONFIG = ler('config.json');
export const TIPOS = ['small', 'notable', 'keystone', 'start'];

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
  }
  if (ids.size > (CONFIG.limites?.maxNos ?? Infinity)) erros.push(`nós demais: ${ids.size}`);
  for (const n of ids.values()) for (const c of n.conexoes ?? []) {
    if (!ids.has(c)) erros.push(`${n.id}: conexão para ${c}, que não existe`);
    else if (!(ids.get(c).conexoes ?? []).includes(n.id)) erros.push(`${n.id} → ${c}: conexão de um lado só`);
  }
  const inicios = Object.values(arvore.inicios ?? {});
  for (const [classe, id] of Object.entries(arvore.inicios ?? {})) if (ids.get(id)?.tipo !== 'start') erros.push(`início de ${classe} (${id}) não é um nó de início`);
  const alcancados = alcancaveis(ids, new Set(ids.keys()), inicios);
  for (const id of ids.keys()) if (!alcancados.has(id)) erros.push(`${id}: ninguém alcança`);
  return erros;
}

const ADDS_PERMITIDOS = /^[a-z_]+$/;
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
  let limpos = [inicio, ...[...new Set(p.alocados)].filter((id) => ARVORE.porId.has(id) && ARVORE.porId.get(id).tipo !== 'start')];
  /*
   * ---- A ÁRVORE MUDOU de versão (ex.: a 2, com os caminhos de atributo) ----
   * Nó que sumiu ou que ficou sem caminho até o início sai, com os pontos de
   * volta — e, se saiu algum, um respec completo grátis (para remontar). Uma
   * vez por versão.
   */
  let arvoreMudou = false;
  if ((p.versaoDaArvore ?? 1) !== ARVORE.versao) {
    const antes = new Set(p.alocados);
    const ligados = alcancaveis(ARVORE.porId, new Set(limpos), [inicio]);
    limpos = limpos.filter((id) => ligados.has(id));
    const sairam = [...antes].filter((id) => id !== inicio && !limpos.includes(id) && ARVORE.porId.get(id)?.tipo !== 'start').length;
    if (sairam > 0) {
      p.respecsGratis += 1;
      arvoreMudou = true;
    }
    p.versaoDaArvore = ARVORE.versao;
  }
  if (limpos.length !== p.alocados.length || limpos.some((id, i) => id !== p.alocados[i])) p.alocados.splice(0, p.alocados.length, ...limpos);
  return { passivas: p, migrou, arvoreMudou };
}

export function pontos(estado) {
  const { passivas } = garantir(estado);
  const total = pontosDoLevel(estado.level);
  const usados = passivas.alocados.reduce((s, id) => s + custoDe(ARVORE.porId.get(id)), 0);
  return { total, usados, livres: Math.max(0, total - usados) };
}

const erro = (motivo, texto) => ({ ok: false, motivo, erro: texto });

/** Pode alocar este nó agora? `{ok}` ou `{ok:false, motivo, erro}`. */
export function podeAlocar(estado, id) {
  const no = ARVORE.porId.get(id);
  if (!no) return erro('NAO_EXISTE', 'Esse nó não existe.');
  const { passivas } = garantir(estado);
  const meus = new Set(passivas.alocados);
  if (meus.has(id)) return erro('JA_ALOCADO', 'Você já tem esse nó.');
  if (no.tipo === 'start') return erro('INICIO', 'O início de outra classe não se aloca.');
  if (!(no.conexoes ?? []).some((c) => meus.has(c))) return erro('SEM_CAMINHO', 'Esse nó não está ligado a nenhum nó seu.');
  if ((estado.level ?? 1) < (no.levelMinimo ?? 0)) return erro('LEVEL', `Precisa do level ${no.levelMinimo}.`);
  if (pontos(estado).livres < custoDe(no)) return erro('SEM_PONTOS', `Faltam pontos: esse nó custa ${custoDe(no)}.`);
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
  const fila = [...meus];
  for (const x of fila) veioDe.set(x, null);
  for (let i = 0; i < fila.length; i++) {
    const atual = fila[i];
    for (const c of ARVORE.porId.get(atual)?.conexoes ?? []) {
      if (veioDe.has(c) || ARVORE.porId.get(c)?.tipo === 'start') continue;
      veioDe.set(c, atual);
      if (c === id) {
        const caminho = [];
        for (let x = c; x && !meus.has(x); x = veioDe.get(x)) caminho.unshift(x);
        return caminho;
      }
      fila.push(c);
    }
  }
  return null;
}

export function alocar(estado, id) {
  const pode = podeAlocar(estado, id);
  if (!pode.ok) return pode;
  estado.passivas.alocados.push(id);
  return { ok: true, mudou: true };
}

/**
 * Tirar estes nós deixaria algum outro ilhado (sem caminho até o início)?
 * Devolve os ilhados (vazio = pode).
 */
export function ilhadosSemEles(estado, ids) {
  const { passivas } = garantir(estado);
  const tirar = new Set(ids);
  const fica = new Set(passivas.alocados.filter((x) => !tirar.has(x)));
  const ligados = alcancaveis(ARVORE.porId, fica, [inicioDe(estado)]);
  return [...fica].filter((x) => !ligados.has(x));
}

export const precoDoRespec = (estado, quantos) => Math.round(CONFIG.respec.ouroPorNoPorLevel * (estado.level ?? 1) * quantos);

/**
 * O que um respec tiraria e custaria: `ids` (os pedidos) e, com `junto`, os
 * que ficariam ilhados. `{ ok, tirar, preco, gratis }` ou o erro.
 */
export function planoDeRespec(estado, { ids, tudo = false, junto = false }, emCacada = false) {
  const { passivas } = garantir(estado);
  if (CONFIG.respec.soForaDaCacada && emCacada) return erro('EM_CACADA', 'Só dá para tirar nós fora da caçada.');
  const inicio = inicioDe(estado);
  let tirar = tudo ? passivas.alocados.filter((x) => x !== inicio) : [...new Set(ids ?? [])];
  if (!tirar.length) return erro('NADA', 'Nenhum nó para tirar.');
  for (const id of tirar) {
    if (id === inicio) return erro('INICIO', 'O início da classe não sai.');
    if (!passivas.alocados.includes(id)) return erro('NAO_ALOCADO', 'Você não tem esse nó.');
  }
  const ilhados = ilhadosSemEles(estado, tirar);
  if (ilhados.length && !junto) return { ...erro('ILHARIA', `Tirar isso deixaria ${ilhados.length} nó(s) sem caminho até o início — tire-os junto.`), ilhados };
  tirar = [...tirar, ...ilhados];
  const gratis = tudo && passivas.respecsGratis > 0;
  return { ok: true, tirar, gratis, preco: gratis ? 0 : precoDoRespec(estado, tirar.length) };
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
  if (plano.gratis) estado.passivas.respecsGratis -= 1;
  const sai = new Set(plano.tirar);
  const ficam = estado.passivas.alocados.filter((x) => !sai.has(x));
  estado.passivas.alocados.splice(0, estado.passivas.alocados.length, ...ficam);
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
    for (const ef of no.efeitos ?? []) {
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
      if (no.keystone.regra === 'habilidade') r.habilidades.add(no.keystone.id);
    }
  }
  CACHE.set(estado, { assinatura, valor: r, ref: alocados, n: alocados.length, ultimo: alocados[alocados.length - 1], primeiro: alocados[0] });
  return r;
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
    pontos: pontos(estado),
    respecsGratis: passivas.respecsGratis,
    precoPorNo: precoDoRespec(estado, 1),
    podeTirar: !(CONFIG.respec.soForaDaCacada && emCacada),
  };
}

/** A árvore para a tela: nós (sem o que é só do servidor) e clusters. */
export function arvoreParaCliente() {
  return {
    versao: ARVORE.versao,
    ...(ARVORE.id === 'poe' ? { poe: true } : {}),
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
