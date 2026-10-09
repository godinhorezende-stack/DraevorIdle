// A AUDITORIA DA ÁRVORE DE PASSIVAS DO PoE (dono, 09/10: "identificar tudo que está representado na árvore, mas ainda não existe, não
// está conectado ao sistema de jogo ou não funciona corretamente"). Para CADA nó (a principal, as maestrias opção por opção e as
// ascendências), quatro verificações — nenhuma confia só no texto do nó:
//
//   dados     — as linhas do nó e o estado da tradução de cada uma (funciona / pendente / inexiste / lembrete);
//   alocação  — um personagem de teste chega ao nó pelo motor de verdade (`Passivas.caminhoAte` + `Passivas.alocar`, as mesmas regras do
//               servidor: ligação, pontos, maestria pelo notável do grupo, ascendência pelos pontos dela);
//   cálculo   — o que o nó soma ENTRA na soma que a ficha usa (`Afixos.soma` para os `add`, `Especializacoes.efeitos` para `stat`/`tag`):
//               a diferença antes × depois de alocar é exatamente o valor do nó; e, tirando o nó (`Passivas.respec`), volta ao que era;
//   efeito    — cada atributo/condição/escala/evento que o nó produz tem QUEM o leia no código do jogo (leitura estática do código de
//               `systems/` e `websocket/`), e o formato `tag` (afinidade do Draevor) é marcado: no modo PoE o golpe não a usa.
//
// A situação do nó sai das quatro: funcional (tudo com efeito e verificado), funcional-aproximado (com efeito, alguma linha aproximada),
// parcial (parte com efeito), sem-efeito (nada com efeito), nao-classificado (sem linhas: encaixe de joia, início).
// Uso: `auditarArvore()` (o relatório: `tools/auditar-arvore-passivas.mjs` → docs/auditorias/).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Passivas from '../systems/passivas/arvore.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Especializacoes from '../systems/personagem/especializacoes.mjs';
import * as Cond from '../systems/itens-poe/condicoes-poe.mjs';
import { NOVOS } from '../systems/itens-poe/traduzir.mjs';
import { ligado as itensPoeLigado } from '../systems/itens-poe/catalogo.mjs';
import { traduzirLinha } from '../systems/itens-poe/arvore.mjs';
import * as Comandos from '../systems/passivas/comandos.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as ModsPoe from '../systems/itens-poe/mods-poe.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
export const DA_LINHA = { equivalente: 'funciona', aproximado: 'funciona', novo: 'funciona', registrado: 'pendente', inerte: 'inexiste', nota: 'lembrete' };

// ------------------------------------------------------------ a leitura estática do código

let CODIGO = null;
let ARQUIVOS = null;
/** Os arquivos do jogo (servidor) que podem ler um atributo: `systems/` e `websocket/` — `[{ arquivo, texto }]`. */
function arquivosDoJogo() {
  if (ARQUIVOS) return ARQUIVOS;
  const lista = [];
  const andar = (d) => {
    for (const n of readdirSync(d)) {
      const c = join(d, n);
      if (statSync(c).isDirectory()) { if (!/node_modules|_versoes/.test(c)) andar(c); } else if (n.endsWith('.mjs')) lista.push(c);
    }
  };
  andar(join(RAIZ, 'systems'));
  andar(join(RAIZ, 'websocket'));
  ARQUIVOS = lista.map((f) => ({ arquivo: f.slice(RAIZ.length), texto: readFileSync(f, 'utf8') }));
  return ARQUIVOS;
}
/** O código do jogo inteiro (uma string). */
function codigo() {
  CODIGO ??= arquivosDoJogo().map((x) => x.texto).join('\n');
  return CODIGO;
}
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Os pedaços dos nomes montados no código (`${el}_pen`, `added_${el}_dmg_min`…).
const VARIAVEIS = ['elemental', 'fire', 'ice', 'energy', 'chaos', 'physical', 'poder', 'frenesi', 'tolerancia', 'min', 'max', 'incendio', 'resfriamento', 'congelamento', 'eletrizacao', 'veneno', 'sangramento', 'atordoamento', 'maldicao'];
/** Alguém no código LÊ este atributo? (a chave literal, `af.x`, `['x']`, ou montada com um pedaço variável). */
export function atributoLido(k) {
  const c = codigo();
  if (new RegExp(`['"\`.]${esc(k)}['"\`]|\\.${esc(k)}\\b|\\[['"]${esc(k)}['"]\\]`).test(c)) return true;
  // (a chave com prefixo — `inicio_extra:Marauder`, `concede:<gema>` — o motor lê pelo prefixo)
  if (k.includes(':') && c.includes(`${k.split(':')[0]}:`)) return true;
  const partes = k.split('_');
  // todos os pedaços variáveis de uma vez (`recebe_${el}_como_${outro}`), depois cada um sozinho
  if (partes.filter((x) => VARIAVEIS.includes(x)).length > 1 && new RegExp(partes.map((x) => (VARIAVEIS.includes(x) ? '\\$\\{[^}]+\\}' : esc(x))).join('_')).test(c)) return true;
  for (let i = 0; i < partes.length; i++) {
    if (!VARIAVEIS.includes(partes[i])) continue;
    const esq = partes.slice(0, i).join('_');
    const dir = partes.slice(i + 1).join('_');
    if (new RegExp(`${esc(esq ? `${esq}_` : '')}\\$\\{[^}]+\\}${esc(dir ? `_${dir}` : '')}`).test(c)) return true;
  }
  return false;
}
/** OS ARQUIVOS que leem este atributo (o sistema consumidor, para o mapa de dependências). Mesma regra de `atributoLido`. */
export function arquivosQueLeem(k) {
  const esc2 = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const literal = new RegExp(`['"\`.]${esc2(k)}['"\`]|\\.${esc2(k)}\\b|\\[['"]${esc2(k)}['"]\\]`);
  const prefixo = k.includes(':') ? `${k.split(':')[0]}:` : null;
  const partes = k.split('_');
  const montado = partes.some((x) => VARIAVEIS.includes(x)) ? new RegExp(partes.map((x) => (VARIAVEIS.includes(x) ? '\\$\\{[^}]+\\}' : esc2(x))).join('_')) : null;
  const umPedaco = partes.map((x, i) => (VARIAVEIS.includes(x) ? new RegExp(`${esc2(partes.slice(0, i).join('_') ? `${partes.slice(0, i).join('_')}_` : '')}\\$\\{[^}]+\\}${esc2(partes.slice(i + 1).join('_') ? `_${partes.slice(i + 1).join('_')}` : '')}`) : null)).filter(Boolean);
  return arquivosDoJogo().filter(({ texto }) => literal.test(texto) || (prefixo && texto.includes(prefixo)) || (montado && montado.test(texto)) || umPedaco.some((re) => re.test(texto))).map((x) => x.arquivo);
}
/** Uma condição de estado/tag de golpe é PRODUZIDA em algum lugar (além da declaração)? */
function condicaoProduzida(x) {
  if (/^(atrMin|atrMaior|buff|semCargas|comCargas|cargasMax|furiaMin|lacaio|escudoMin|resMin|maestriasDe|alvoVenenos):/.test(x)) return true; // `vale` lê o estado (`alvoVenenos:N`: `tagsDoAlvo`)
  const n = (codigo().match(new RegExp(`['"]${esc(x)}['"]`, 'g')) ?? []).length;
  return n >= 2;
}
/** O evento é DISPARADO por alguém (`ModsPoe.evento(…, 'nome', …)` ou o nome montado)? */
function eventoDisparado(nome) {
  const c = codigo();
  return new RegExp(`evento\\([^)]*['"\`]${esc(nome)}['"\`]`).test(c) || new RegExp(`['"\`]${esc(nome)}['"\`]`).test(c.replace(/export const EVENTOS[^\n]*\n[^\n]*\n[^\n]*/, ''));
}

/**
 * O que falta para um `add` ter efeito (lista vazia = conectado): o atributo base sem leitor, a escala/condição desconhecida, o evento sem
 * disparo. `{ ok, faltas: [...] }`.
 */
export function conexaoDoAdd(chave) {
  const faltas = [];
  const { stat, escala, conds } = Cond.partir(chave);
  if (stat.startsWith('ev:')) {
    const [, evento, acao] = stat.split(':');
    if (!Cond.EVENTOS.has(evento)) faltas.push(`evento desconhecido: ${evento}`);
    else if (!eventoDisparado(evento)) faltas.push(`evento nunca disparado: ${evento}`);
    if (!Cond.ACOES.has(acao)) faltas.push(`ação desconhecida: ${acao}`);
  } else if (!(Cond.dinamicoValido(stat) || atributoLido(stat))) faltas.push(`atributo sem leitor: ${stat}`);
  if (escala && !Cond.escalaValida(escala)) faltas.push(`escala desconhecida: ${escala}`);
  for (const x of conds) {
    if (!(Cond.ehCondDeEstado(x) || Cond.TAGS_DE_GOLPE.has(x))) faltas.push(`condição desconhecida: ${x}`);
    else if (!condicaoProduzida(x)) faltas.push(`condição nunca produzida: ${x}`);
  }
  return { ok: !faltas.length, faltas, stat };
}
/** Os `stat` do formato das especializações que a ficha lê (`espStat('x')`, `stats.life`, `stats.mana`). */
function statsLidos() {
  const c = codigo();
  const s = new Set([...c.matchAll(/espStat\('(\w+)'\)/g)].map((m) => m[1]));
  for (const m of c.matchAll(/\.stats\.(\w+)/g)) s.add(m[1]);
  return s;
}

// ------------------------------------------------------------ o personagem de teste

/** Um personagem mínimo da classe `classePoe`, no level `level`, com a árvore do PoE garantida. */
export function personagemDeTeste({ classePoe = 'Scion', level = 100, ascendencia = null } = {}) {
  const e = {
    level, xp: 0, vocation: 'knight', classePoe, hp: 100, maxHp: 100, mana: 50, maxMana: 50, es: 0,
    equipment: {}, inventory: [], gold: 0, bank: 0, sistema: 'poe',
    // 2 pontos de ascendência por boss de fim de ato: os 10 atos dão os 8 do teto.
    campanha: { normal: { bosses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } },
    passivas: { alocados: [], respecsGratis: 0, migrado: true, ...(ascendencia ? { ascendencia } : {}) },
  };
  Passivas.garantir(e);
  return e;
}

/** A soma que a ficha usa, só com o que interessa (os números). */
const somaDe = (e) => {
  const s = Afixos.soma(e);
  const esp = Especializacoes.efeitos(e);
  return { add: s, stat: esp.stats, tag: esp.dano };
};
const diferenca = (antes, depois) => {
  const d = {};
  for (const k of new Set([...Object.keys(antes), ...Object.keys(depois)])) {
    const v = (Number(depois[k]) || 0) - (Number(antes[k]) || 0);
    if (Math.abs(v) > 1e-9) d[k] = Math.round(v * 1000) / 1000;
  }
  return d;
};
/** O esperado de uma lista de efeitos (somando as chaves repetidas). */
const esperado = (efeitos) => {
  const r = { add: {}, stat: {}, tag: {} };
  for (const ef of efeitos ?? []) {
    if (ef.add) r.add[ef.add] = (r.add[ef.add] ?? 0) + ef.valor;
    else if (ef.stat) r.stat[ef.stat] = (r.stat[ef.stat] ?? 0) + ef.pct;
    else if (ef.tag) r.tag[ef.tag] = (r.tag[ef.tag] ?? 0) + ef.dano;
  }
  return r;
};
const iguais = (a, b) => {
  const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...ks].every((k) => Math.abs((Number(a[k]) || 0) - (Number(b[k]) || 0)) < 1e-6);
};

// ------------------------------------------------------------ a ficha EFETIVA (o "aplicado aos atributos")

const FORA_DO_RETRATO = new Set(['afPoe', 'porTag', 'eventosPoe', 'origens', 'recalcularAfeccoes', 'fontesDasAfinidades', 'passivas', 'classe', 'armaEquipada', 'magiasDasGemas', 'tagsDoGolpe']);
function achatar(o, pre = '', saida = {}) {
  for (const [k, v] of Object.entries(o ?? {})) {
    if (FORA_DO_RETRATO.has(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) saida[pre + k] = Math.round(v * 1e6) / 1e6;
    else if (v && typeof v === 'object' && !Array.isArray(v)) achatar(v, `${pre}${k}.`, saida);
  }
  return saida;
}
/** O retrato numérico do que o personagem É depois do servidor refazer tudo (`depoisDeMudar`): a ficha de combate, a vida e a mana máximas e o
 * golpe com cada conjunto de tags pedido. `{ numeros, ficha }`. */
function retrato(original, golpes) {
  // (numa CÓPIA: refazer os máximos mexe na vida atual — e a vida mexe nas condições "vida cheia/baixa" que a verificação compara)
  const e = structuredClone(original);
  Comandos.depoisDeMudar(e);
  const f = Ficha.combate(e);
  const numeros = { ...achatar(f), maxHp: e.maxHp, maxMana: e.maxMana };
  for (const tags of golpes) Object.assign(numeros, achatar(ModsPoe.fichaDoGolpe(f, tags, { estado: e }), `golpe[${tags.join('+')}].`));
  return { numeros, ficha: f };
}
const mudou = (a, b) => Object.keys({ ...a, ...b }).some((k) => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) > 1e-6);
/** Os CENÁRIOS que satisfazem as condições de estado comuns (a peça na mão, a vida baixa): para medir uma chave condicional na ficha. */
const PECA = (classe) => ({ id: 3357, count: 1, poe: { classe, base: `${classe}/X`, af: {}, prefixos: [], sufixos: [], implicitos: [] } });
const NA_MAO = { comMaca: 'One_Hand_Maces', comCetro: 'Sceptres', comMachado: 'One_Hand_Axes', comEspada: 'One_Hand_Swords', comAdaga: 'Daggers', comGarra: 'Claws', comArco: 'Bows', comVarinha: 'Wands', comCajado: 'Staves' };
export const CENARIOS = {
  ...Object.fromEntries(Object.entries(NA_MAO).map(([c, classe]) => [c, (e) => { e.equipment.weapon = PECA(classe); }])),
  comEscudo: (e) => { e.equipment.shield = PECA('Shields'); },
  duasArmas: (e) => { e.equipment.weapon ??= PECA('One_Hand_Swords'); e.equipment.shield = PECA('One_Hand_Swords'); },
  duasMaos: (e) => { e.equipment.weapon = PECA('Two_Hand_Swords'); delete e.equipment.shield; },
  umaMao: (e) => { e.equipment.weapon ??= PECA('One_Hand_Swords'); },
  armaCorpo: (e) => { e.equipment.weapon ??= PECA('One_Hand_Swords'); },
  vidaBaixa: (e) => { e.hp = 1; },
};
/** As condições de estado e as tags de golpe das chaves de uma lista de efeitos (para montar o cenário e o golpe). */
function condicoesDosEfeitos(efeitos) {
  const estado = new Set();
  const golpes = [];
  for (const ef of efeitos) {
    if (!ef.add || ef.add.startsWith('ev:')) continue;
    const { conds } = Cond.partir(ef.add);
    for (const c of conds) if (Cond.ehCondDeEstado(c)) estado.add(c);
    const tags = conds.filter((c) => !Cond.ehCondDeEstado(c));
    if (tags.length && !golpes.some((g) => g.join('+') === tags.join('+'))) golpes.push(tags);
  }
  return { estado: [...estado], golpes };
}

/**
 * Aloca o nó `id` num personagem novo pelo motor (o caminho mais curto, nó por nó, com as regras do servidor) e mede o que ele soma; depois
 * tira (respec) e confere que voltou. `{ alocacao, calculo, remocao, detalhe }`.
 */
export function verificarNo(id, { opcao = null } = {}) {
  const arv = Passivas.arvore();
  const no = arv.porId.get(id);
  const e = personagemDeTeste({ ascendencia: no?.ascendencia ?? null, classePoe: no?.ascendencia ? arv.ascendencias?.[no.ascendencia]?.classe ?? 'Scion' : 'Scion' });
  const r = { alocacao: 'ok', calculo: 'ok', remocao: 'ok', aplicado: 'n/a', detalhe: null };
  const efeitosDoNo = no.tipo === 'mastery' ? no.opcoes.find((o) => o.id === String(opcao))?.efeitos ?? [] : no.efeitos ?? [];
  // o cenário: as condições de estado comuns das chaves do nó, satisfeitas (a arma, o escudo, a vida baixa); o resto fica como está
  const { estado: condsDeEstado, golpes } = condicoesDosEfeitos(efeitosDoNo);
  const montaveis = condsDeEstado.filter((c) => CENARIOS[c]);
  for (const c of montaveis) CENARIOS[c](e);
  // A maestria abre por um notável do grupo: o caminho até ele primeiro.
  const alvoDoCaminho = no.tipo === 'mastery' ? arv.nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia)?.id : id;
  const caminho = alvoDoCaminho ? Passivas.caminhoAte(e, alvoDoCaminho) : null;
  if (!caminho) return { ...r, alocacao: 'sem caminho', calculo: 'n/a', remocao: 'n/a' };
  const antesDoNo = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
  for (const x of antesDoNo) {
    const a = Passivas.alocar(e, x);
    if (!a.ok) return { ...r, alocacao: `falha no caminho (${a.motivo})`, calculo: 'n/a', remocao: 'n/a', detalhe: `${x}: ${a.erro}` };
  }
  const antes = somaDe(e);
  // (+ a keystone com mecânica: o efeito dela não é somável — vê-se na ficha ou na lista de keystones que o combate consulta)
  const keystoneComMecanica = no.tipo === 'keystone' && no.keystone && no.keystone.regra !== 'texto';
  const fotoAntes = efeitosDoNo.length || keystoneComMecanica ? retrato(e, golpes) : null;
  const a = Passivas.alocar(e, id, opcao);
  if (!a.ok) return { ...r, alocacao: `recusado (${a.motivo})`, calculo: 'n/a', remocao: 'n/a', detalhe: a.erro };
  const depois = somaDe(e);
  const efeitos = efeitosDoNo;
  const esp = esperado(efeitos);
  // APLICADO: a ficha efetiva mudou ('ficha'); senão, o atributo está no que o combate lê no acerto/tique ('combate': `afPoe`, eventos) —
  // a ficha não tem número para ele; senão, as chaves dependem de condição que o cenário não monta ('condicional'); senão, 'nao'.
  if (fotoAntes) {
    const fotoDepois = retrato(e, golpes);
    if (mudou(fotoAntes.numeros, fotoDepois.numeros)) r.aplicado = 'ficha';
    else {
      const chaves = efeitos.filter((x) => x.add).map((x) => x.add);
      const condicional = (k) => { const p = Cond.partir(k); return p.conds.some((c) => Cond.ehCondDeEstado(c) && !CENARIOS[c]) || (!!p.escala && !Cond.ESCALAS_DA_FICHA.test(p.escala)); };
      // (as listas somam a mesma chave: compara-se o VALOR de cada entrada, não o tamanho)
      const lista = (l, chave) => JSON.stringify((l ?? []).map(chave).sort());
      const evento = (x) => `${x.evento}:${x.acao}:${x.param}:${x.conds.join('+')}=${x.valor}`;
      const porTag = (x) => `${x.stat}@${x.tags.join('+')}=${x.valor}`;
      const lidoNoCombate = (k) => (k.startsWith('ev:')
        ? lista(fotoDepois.ficha.eventosPoe, evento) !== lista(fotoAntes.ficha.eventosPoe, evento)
        : Cond.partir(k).conds.some((c) => !Cond.ehCondDeEstado(c))
          ? lista(fotoDepois.ficha.porTag, porTag) !== lista(fotoAntes.ficha.porTag, porTag)
          : (Number(fotoDepois.ficha.afPoe?.[k]) || 0) !== (Number(fotoAntes.ficha.afPoe?.[k]) || 0) || (Number(fotoDepois.ficha.afPoe?.[Cond.partir(k).stat]) || 0) !== (Number(fotoAntes.ficha.afPoe?.[Cond.partir(k).stat]) || 0));
      const firmes = chaves.filter((k) => !condicional(k));
      const keystoneConsultada = keystoneComMecanica && (fotoDepois.ficha.passivas?.keystones ?? []).includes(no.nome);
      r.aplicado = firmes.some(lidoNoCombate) || keystoneConsultada ? 'combate' : !firmes.length && chaves.length ? 'condicional' : 'nao';
    }
  }
  const dAdd = diferenca(antes.add, depois.add);
  // (o `add` que outra parte da soma consome — cargas, buffs — pode mudar outras chaves: confere só as do nó)
  // (a escala do personagem — "-2 de Precisão por Nível": `accuracy%nivel` — a soma já aplica no atributo base; esse base não se compara)
  const comEscala = new Set(Object.keys(esp.add).map((k) => Cond.partir(k)).filter((x) => x.escala && !Cond.ESCALAS_DA_FICHA.test(x.escala) && !x.conds.length).map((x) => x.stat));
  const addOk = Object.entries(esp.add).every(([k, v]) => comEscala.has(k) || Math.abs((dAdd[k] ?? 0) - v) < 1e-6);
  const statOk = iguais(diferenca(antes.stat, depois.stat), esp.stat);
  const tagOk = iguais(diferenca(antes.tag, depois.tag), esp.tag);
  if (!(addOk && statOk && tagOk)) r.calculo = 'diferente do nó';
  const t = Passivas.respec(e, { ids: [id] });
  if (!t.ok) r.remocao = `recusada (${t.motivo})`;
  else {
    const voltou = somaDe(e);
    if (!(iguais(voltou.add, antes.add) && iguais(voltou.stat, antes.stat) && iguais(voltou.tag, antes.tag))) r.remocao = 'não voltou';
  }
  return r;
}

// ------------------------------------------------------------ a auditoria

/** A categoria do nó (a do PoE). */
export function categoriaDo(no) {
  if (no.tipo === 'start') return no.ascendencia ? 'ascendencia-inicio' : 'inicio';
  if (/^Encaixe de Joia/.test(no.nome ?? '')) return 'encaixe-de-joia';
  if (no.ascendencia) return no.tipo === 'notable' ? 'ascendencia-notavel' : 'ascendencia-comum';
  return { small: 'comum', notable: 'notavel', keystone: 'keystone', mastery: 'maestria' }[no.tipo] ?? no.tipo;
}

/** A forma de um efeito (a matriz de cobertura por tipo de modificador). */
export function formaDoEfeito(ef) {
  if (ef.tag) return 'afinidade por tag (formato do Draevor)';
  if (ef.stat) return '% de stat (formato das especializações)';
  const k = ef.add;
  if (k.startsWith('ev:')) return 'evento (ao matar, bloquear…)';
  if (/^(sempre|efeito_buff|efeito_buff_gema|efeito_maldicao_gema|concede|suporte_local|keystone|pode|sem_dano|so_dano|aura_proximos):/.test(k)) return 'dinâmico (buff, gema, keystone…)';
  const { escala, conds } = Cond.partir(k);
  const golpe = conds.some((x) => Cond.TAGS_DE_GOLPE.has(x));
  const estado = conds.some((x) => Cond.ehCondDeEstado(x));
  if (escala && Cond.ESCALAS_DA_FICHA.test(escala)) return 'escala da ficha (por X de armadura, bloqueio…)';
  if (escala) return golpe || estado ? 'escala com condição' : 'escala (por X)';
  if (golpe && estado) return 'condição de estado + tag de golpe';
  if (golpe) return 'tag de golpe (ataque, magia, projétil…)';
  if (estado) return 'condição de estado (com escudo, vida baixa…)';
  return 'soma simples';
}

/** O tipo de MODIFICADOR (o que o efeito mexe), pelo atributo base. */
export function tipoDoModificador(ef) {
  if (ef.tag) return `dano % por tag (${ef.tag})`;
  if (ef.stat) return { life: 'vida %', mana: 'mana %', accuracy: 'precisão %' }[ef.stat] ?? `stat ${ef.stat}`;
  const { stat } = Cond.partir(ef.add);
  if (stat.startsWith('ev:')) return 'efeito por evento';
  const T = [
    [/^(str|dex|int|all_attrs|atributos)\b|^(str|dex|int)_/, 'atributos (For/Des/Int)'],
    [/^life|_life$|^vida|recoup_life|life_regen|life_leech|life_more/, 'vida, regeneração e dreno de vida'],
    [/^mana|mana_regen|mana_leech|eficiencia_custo|custo/, 'mana e custo'],
    [/^(es_|energy_shield|es$)|_es_|esPct/, 'escudo de energia'],
    [/armour|armor|evasion|defesas_pct/, 'armadura e evasão'],
    [/block|bloqueio|spell_block/, 'bloqueio'],
    [/spell_suppression|supressao/, 'supressão de magia'],
    [/_res$|_res@|res_max|max_res|resist/, 'resistências'],
    [/crit/, 'crítico'],
    [/atk_speed|cast_speed|move_speed|velocidade|speed/, 'velocidades'],
    [/accuracy|precisao/, 'precisão'],
    [/_pen$|pen@|penetra/, 'penetração'],
    [/^added_|_added_|somado/, 'dano somado (fixo)'],
    [/phys_dmg|fire_dmg|ice_dmg|energy_dmg|chaos_dmg|dmg_inc|spell_dmg|mais_dano|dano_/, 'dano % (aumentado e "mais")'],
    [/dot|ailment|bleed|poison|ignite|chance_|duracao_|efeito_resfriamento|efeito_eletriz/, 'afecções e chance no acerto'],
    [/as_extra|conversao|convert/, 'conversão / dano extra'],
    [/minion|lacaio|totem|golem/, 'lacaios e totens'],
    [/stun|atordoa/, 'atordoamento'],
    [/area|projectile|projeteis|perfurar|ricochete/, 'área e projéteis'],
    [/frasco|flask/, 'frascos'],
    [/furia|cargas?|max_(poder|frenesi|tolerancia)|_frenesi|_poder|_tolerancia/, 'cargas e fúria'],
    [/aura|reserva|arauto|maldicao|curse/, 'auras, maldições e reserva'],
  ];
  for (const [re, nome] of T) if (re.test(stat)) return nome;
  return 'outros';
}

/**
 * Um efeito está COBERTO por teste (a tabela `testes/cobertura-arvore.mjs`, passada pela ferramenta)? O atributo base tem medida na ficha
 * efetiva E cada condição/escala/evento da chave tem teste próprio.
 */
export function cobertoPorTeste(cobertura, ef) {
  if (!cobertura) return false;
  const condCoberta = (c) => !!cobertura.CONDICOES[c] || !!cobertura.CONDICOES[`${c.split(':')[0]}:*`];
  if (ef.stat) return !!cobertura.MEDIDAS[`stat:${ef.stat}`];
  if (!ef.add) return false;
  const k = ef.add;
  const { stat, escala, conds } = Cond.partir(k);
  if (stat.startsWith('ev:')) {
    const [, evento, acao] = stat.split(':');
    return !!cobertura.EVENTOS[`${evento}:${acao}`] && conds.every(condCoberta);
  }
  if (cobertura.MEDIDAS[k]) return true;
  // (a mecânica com teste próprio — keystones, inícios extras — conta pelo nome; a dinâmica `inicio_extra:Marauder` pelo prefixo)
  const mecanica = !!cobertura.MECANICAS?.[stat] || !!cobertura.MECANICAS?.[stat.split(':')[0]];
  const baseMedida = mecanica || !!cobertura.MEDIDAS[stat] || Object.keys(cobertura.MEDIDAS).some((m) => Cond.partir(m).stat === stat);
  if (!baseMedida) return false;
  if (escala && !cobertura.ESCALAS[escala.split(':')[0]]) return false;
  return conds.every(condCoberta);
}

/** Os NÍVEIS da escada, na ordem (o nó fica no último que alcança). */
export const NIVEIS = ['exibido', 'alocavel', 'interpretado', 'aplicado', 'validado'];

/**
 * A auditoria inteira. `{ geradoEm, resumo, porCategoria, porForma, porTipo, nos: [...] }`. `verificar: false` pula a alocação de verdade
 * (só dados e leitura estática — rápido); `limite` corta quantos nós alocar (testes); `cobertura` (a tabela dos testes) marca o
 * "validado por teste".
 */
export function auditarArvore({ verificar = true, limite = Infinity, cobertura = null } = {}) {
  const arv = Passivas.arvore();
  if (arv.id !== 'poe') return { ok: false, erro: 'A árvore em uso não é a do PoE (suba com ITENS_POE=1).' };
  const lidos = statsLidos();
  const poe = itensPoeLigado();
  const nos = [];
  let verificados = 0;
  for (const no of arv.nos) {
    const categoria = categoriaDo(no);
    // A maestria: cada OPÇÃO conta como uma linha (o jogador escolhe uma).
    const opcoes = no.tipo === 'mastery' ? no.opcoes ?? [] : [null];
    const textos = no.tipo === 'mastery' ? opcoes.flatMap((o) => o.textos ?? []) : no.textos ?? [];
    const efeitos = no.tipo === 'mastery' ? opcoes.flatMap((o) => o.efeitos ?? []) : no.efeitos ?? [];
    const linhas = { funciona: 0, aproximado: 0, pendente: 0, inexiste: 0, lembrete: 0, efetivas: 0 };
    const desconectados = [];
    const efeitosEfetivos = [];
    // Linha a linha (a MESMA tradução do montador — `traduzirLinha`): a linha tem efeito quando funciona e TODOS os efeitos dela
    // estão conectados (alguém no código os lê).
    const conexao = (ef) => {
      if (ef.add) { const c = conexaoDoAdd(ef.add); return c.ok ? null : { efeito: ef.add, faltas: c.faltas }; }
      if (ef.stat) return lidos.has(ef.stat) ? null : { efeito: `stat:${ef.stat}`, faltas: ['stat que a ficha não lê'] };
      if (ef.tag && poe) return { efeito: `tag:${ef.tag}`, faltas: ['afinidade por tag: no modo PoE o golpe não a usa (acoes.mjs / hunt/combate.mjs)'] };
      return null;
    };
    // A keystone com MECÂNICA (as do mapa `traducao-arvore.json` → keystones: `poe`, `conversao`): o estado é o da mecânica (o montador
    // guarda em `estados`), e a mecânica precisa ser consultada no código (`temHabilidade(…, '<id>')` / `aplicarNaFicha`).
    const mecanica = no.tipo === 'keystone' && no.keystone && no.keystone.regra !== 'texto';
    if (mecanica && no.keystone.regra === 'poe' && !condicaoProduzida(no.keystone.id)) desconectados.push({ efeito: `keystone:${no.keystone.id}`, faltas: ['mecânica da keystone sem consulta no código'] });
    for (const [i, texto] of textos.entries()) {
      const t = mecanica ? { estado: no.estados?.[i] ?? 'registrado', efeitos: i === 0 ? no.efeitos ?? [] : [] } : traduzirLinha(texto);
      const d = DA_LINHA[t.estado] ?? 'pendente';
      linhas[d]++;
      if (t.estado === 'aproximado') linhas.aproximado++;
      if (d !== 'funciona') continue;
      const faltas = t.efeitos.map(conexao).filter(Boolean);
      desconectados.push(...faltas);
      if (!faltas.length) {
        linhas.efetivas++;
        efeitosEfetivos.push(...t.efeitos);
      }
    }
    let verificacao = null;
    // (todo nó que não é início: a alocação vale também para o que não tem efeito — o encaixe de joia, o pai de escolha)
    if (verificar && verificados < limite && !['inicio', 'ascendencia-inicio'].includes(categoria)) {
      verificados++;
      verificacao = no.tipo === 'mastery' ? opcoes.map((o) => ({ opcao: o.id, ...verificarNo(no.id, { opcao: o.id }) })) : [verificarNo(no.id)];
    }
    const falhaDeMotor = verificacao?.find((v) => v.alocacao !== 'ok' || v.calculo !== 'ok' || v.remocao !== 'ok') ?? null;
    // O APLICADO do nó: o melhor das verificações (a da maestria é por opção).
    const aplicado = ['ficha', 'combate', 'condicional', 'nao'].find((x) => verificacao?.some((v) => v.aplicado === x)) ?? null;
    const cobertos = efeitosEfetivos.filter((ef) => cobertoPorTeste(cobertura, ef)).length;
    const niveis = {
      exibido: true,
      alocavel: !!verificacao && verificacao.every((v) => v.alocacao === 'ok'),
      interpretado: linhas.efetivas > 0,
      aplicado: linhas.efetivas > 0 && ['ficha', 'combate'].includes(aplicado),
      validado: linhas.efetivas > 0 && ['ficha', 'combate'].includes(aplicado) && efeitosEfetivos.length > 0 && cobertos === efeitosEfetivos.length,
    };
    // o nível: o último da escada alcançado SEM pular degrau
    let nivel = 'exibido';
    for (const n of NIVEIS.slice(1)) { if (!niveis[n]) break; nivel = n; }
    const comLinhas = linhas.funciona + linhas.pendente + linhas.inexiste;
    let situacao;
    if (['inicio', 'ascendencia-inicio'].includes(categoria)) situacao = 'inicio';
    else if (!comLinhas) situacao = 'nao-classificado';
    else if (!linhas.efetivas) situacao = 'sem-efeito';
    else if (linhas.efetivas < comLinhas || falhaDeMotor) situacao = 'parcial';
    else situacao = linhas.aproximado ? 'funcional-aproximado' : 'funcional';
    nos.push({
      id: no.id, nome: no.nome, nomeEn: no.nomeEn ?? null, categoria, ...(no.ascendencia ? { ascendencia: no.ascendencia } : {}),
      ...(no.tipo === 'keystone' ? { keystone: no.keystone?.regra ?? null } : {}),
      linhas, situacao, nivel, niveis, aplicado, cobertura: efeitosEfetivos.length ? `${cobertos}/${efeitosEfetivos.length}` : null,
      chaves: [...new Set(efeitos.map((ef) => ef.add ?? (ef.stat ? `stat:${ef.stat}` : `tag:${ef.tag}`)))],
      desconectados, verificacao: falhaDeMotor ?? (verificacao ? 'ok' : null),
      pendentes: no.tipo === 'keystone' && no.keystone?.regra !== 'texto' ? textos.filter((_, i) => DA_LINHA[no.estados?.[i]] === 'pendente') : textos.filter((x) => (DA_LINHA[traduzirLinha(x).estado] ?? 'pendente') === 'pendente'),
      formas: [...new Set(efeitos.map(formaDoEfeito))], tipos: [...new Set(efeitos.map(tipoDoModificador))],
    });
  }
  // Os resumos.
  const contar = (lista) => lista.reduce((o, n) => ((o[n.situacao] = (o[n.situacao] ?? 0) + 1), o), {});
  const auditaveis = nos.filter((n) => n.situacao !== 'inicio');
  const porCategoria = {};
  for (const n of nos) (porCategoria[n.categoria] ??= []).push(n);
  // A matriz por FORMA e por TIPO de modificador: quantos efeitos, quantos conectados, e se o motor somou certo nos nós verificados.
  const matriz = (chaveDe) => {
    const m = {};
    for (const no of arv.nos) {
      const efs = no.tipo === 'mastery' ? (no.opcoes ?? []).flatMap((o) => o.efeitos ?? []) : no.efeitos ?? [];
      const reg = nos.find((x) => x.id === no.id);
      for (const ef of efs) {
        const k = chaveDe(ef);
        const x = (m[k] ??= { efeitos: 0, nos: new Set(), conectados: 0, alocacaoOk: 0, calculoOk: 0, verificados: 0 });
        x.efeitos++;
        x.nos.add(no.id);
        const chave = ef.add ?? (ef.stat ? `stat:${ef.stat}` : `tag:${ef.tag}`);
        if (!reg.desconectados.some((d) => d.efeito === chave)) x.conectados++;
        if (reg.verificacao) {
          x.verificados++;
          if (reg.verificacao === 'ok' || reg.verificacao.alocacao === 'ok') x.alocacaoOk++;
          if (reg.verificacao === 'ok' || reg.verificacao.calculo === 'ok') x.calculoOk++;
        }
      }
    }
    return Object.fromEntries(Object.entries(m).sort((a, b) => b[1].efeitos - a[1].efeitos).map(([k, x]) => [k, { ...x, nos: x.nos.size }]));
  };
  return {
    geradoEm: new Date().toISOString(),
    resumo: {
      nos: nos.length, auditaveis: auditaveis.length, porSituacao: contar(auditaveis),
      verificadosNoMotor: nos.filter((n) => n.verificacao).length,
      falhasDeMotor: nos.filter((n) => n.verificacao && n.verificacao !== 'ok').length,
      porNivel: Object.fromEntries(NIVEIS.map((n) => [n, auditaveis.filter((x) => x.nivel === n).length])),
      porAplicado: auditaveis.reduce((o, n) => ((o[n.aplicado ?? 'sem efeito'] = (o[n.aplicado ?? 'sem efeito'] ?? 0) + 1), o), {}),
    },
    porCategoria: Object.fromEntries(Object.entries(porCategoria).map(([k, l]) => [k, { nos: l.length, porSituacao: contar(l) }])),
    porForma: matriz(formaDoEfeito),
    porTipo: matriz(tipoDoModificador),
    nos,
  };
}

/** Os NOVOS atributos têm o campo `efeito` (onde agem) — para o relatório citar. */
export const ondeAge = (stat) => NOVOS[stat]?.efeito ?? null;
