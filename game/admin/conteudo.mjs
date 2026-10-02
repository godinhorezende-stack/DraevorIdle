// O EDITOR DE CONTEÚDO da campanha (fases, encontros, bosses): funções puras — quem fala HTTP é `backend/index.mjs`,
// sob `/api/mapas/_conteudo/…`, o MESMO prefixo que o nginx já tranca ao público (só quem chega por túnel SSH).
//
// Nada aqui valida por conta própria: a validação é a do jogo (`encontros/modelo.mjs`, `encontros/tipos-*.mjs`,
// `bosses-unicos/catalogo.mjs`), mais o que só o editor sabe fazer — conferir no MAPA se o ponto é andável e se dá para
// chegar a pé. O que se grava é o que o servidor lê:
//   - `gamedata/encontros/<huntId>.json`, um arquivo por fase (ver `encontros/arquivos.mjs`: o mapa tem 1 MB e, em produção,
//     `gamedata/hunts` é sobreposto por `data/mapas`; o arquivo de encontros viaja com o código);
//   - `gamedata/bosses-unicos.json` (o cadastro dos bosses);
//   - `gamedata/campanha-conteudo.json` (descrição, ambiente, conexões e requisitos de cada fase — o que a tela WORLD
//     mostra; a campanha em si, `campanha.json`, não é tocada).
// Os encontros e o cadastro são lidos no BOOT do servidor: depois de salvar um encontro, reinicie o servidor de
// desenvolvimento para jogá-lo (o cadastro de bosses já vale na hora).
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as Campanha from '../systems/campanha.mjs';
import * as Mapas from './mapas.mjs';
import * as Modelo from '../systems/encontros/modelo.mjs';
import { TIPOS } from '../systems/encontros/tipos.mjs';
import '../systems/encontros/tipos-de-boss.mjs';
import '../systems/encontros/tipos-de-bau.mjs';
import { CATEGORIAS_DO_TIPO } from '../systems/encontros/tipos-de-boss.mjs';
import { CONFIG } from '../systems/encontros/config.mjs';
import { AFIXOS_DE_ALTAR } from '../systems/encontros/altares.mjs';
import { valorEsperado } from '../systems/encontros/recompensas.mjs';
import { impactoEconomico } from '../systems/encontros/economia.mjs';
import * as Arquivos from '../systems/encontros/arquivos.mjs';
import * as Catalogo from '../systems/bosses-unicos/catalogo.mjs';
import { FICHAS } from '../systems/afixos.mjs';
import { gradeDaHunt, huntOuMapaCustom } from '../systems/hunt/terreno.mjs';
import { andarDaGrade } from '../systems/hunt/andares.mjs';
import { casasAlcancaveis } from '../systems/hunt/instancia.mjs';
import { CATALOGO, ITEM_CATALOG } from '../systems/dados.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
/** Onde ler e gravar (os testes apontam para uma pasta temporária; o editor usa o `gamedata` do jogo). */
export const CAMINHOS = { bosses: join(RAIZ, 'bosses-unicos.json'), fases: join(RAIZ, 'campanha-conteudo.json'), hunts: join(RAIZ, 'hunts'), encontros: Arquivos.PASTA };
const ID_VALIDO = /^[a-z0-9-]{3,40}$/;
const arquivoDoMapa = (id) => join(CAMINHOS.hunts, `${id}-map.json`);
/** Os encontros brutos da fase: o arquivo próprio (`gamedata/encontros/`) ou, sem ele, o bloco do mapa (formato antigo). */
const lerEncontros = (huntId) => Arquivos.brutosDaFase(huntId, carregarMapa(huntId), CAMINHOS.encontros);
const carregarMapa = (id) => (ID_VALIDO.test(id) && existsSync(arquivoDoMapa(id)) ? JSON.parse(readFileSync(arquivoDoMapa(id), 'utf8')) : null);

const lerJson = (arq, padrao) => (existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8')) : padrao);

// ------------------------------------------------------------------ fases

const lerArquivoDeFases = () => lerJson(CAMINHOS.fases, { _nota: 'Descrição, ambiente, conexões, requisitos e o índice do que cada fase tem (o que a tela WORLD mostra). Editado em /editor/conteudo.', fases: {} });
const gravarArquivoDeFases = (dados) => writeFileSync(CAMINHOS.fases, `${JSON.stringify(dados, null, 2)}\n`, 'utf8');

/**
 * O ÍNDICE do que a fase tem, para a tela WORLD (`campanha-conteudo.json`, chave `mundo`): o boss principal e os
 * obrigatórios (a condição de conclusão, que o jogador pode ver) e a lista de TODOS os encontros ativos — esta última só
 * para o servidor dar nome ao que o jogador já encontrou; ela nunca vai inteira para o cliente.
 */
export function indiceDoMundo(encontros) {
  const ativos = Modelo.encontrosDoMapa({ encontros }).filter((e) => e.ativo);
  const bossNome = (e) => (e.bossId ? Catalogo.bossUnico(e.bossId)?.nome ?? e.bossId : null);
  const principal = ativos.find((e) => e.obrigatorio && BOSS_TIPOS.includes(e.tipo) && Catalogo.bossUnico(e.bossId)?.categoria === 'principal');
  return {
    bossPrincipal: principal ? { bossId: principal.bossId, nome: bossNome(principal) } : null,
    obrigatorios: ativos.filter((e) => e.obrigatorio).map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo })),
    todos: ativos.map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo, ...(e.bossId ? { bossId: e.bossId, bossNome: bossNome(e) } : {}) })),
  };
}

function gravarIndice(huntId, encontros) {
  const arq = lerArquivoDeFases();
  const indice = indiceDoMundo(encontros);
  const atual = arq.fases[huntId] ?? {};
  if (indice.todos.length) atual.mundo = indice;
  else delete atual.mundo;
  if (Object.keys(atual).length) arq.fases[huntId] = atual;
  else delete arq.fases[huntId];
  gravarArquivoDeFases(arq);
}

const faseDe = (huntId) => Campanha.faseDe(huntId); // com o `indice` na campanha

/** Os metadados editáveis da fase (o que a tela WORLD mostra). */
export const metaDasFases = () =>
  Object.fromEntries(
    Object.entries(lerJson(CAMINHOS.fases, { fases: {} }).fases ?? {}).map(([id, v]) => {
      const { mundo, ...meta } = v; // o índice do WORLD (`mundo`) não é dado editável
      return [id, meta];
    })
  );

/** Os erros de um bloco `meta` (vazio = pode gravar). */
export function validarMeta(huntId, meta) {
  const erros = [];
  if (!faseDe(huntId)) return ['Fase desconhecida.'];
  if (meta.descricao != null && String(meta.descricao).length > 600) erros.push('descricao: no máximo 600 caracteres.');
  if (meta.ambiente != null && String(meta.ambiente).length > 40) erros.push('ambiente: no máximo 40 caracteres.');
  for (const c of meta.conexoes ?? []) {
    if (!faseDe(c)) erros.push(`conexoes: "${c}" não é uma fase da campanha.`);
    if (c === huntId) erros.push('conexoes: uma fase não conecta a si mesma.');
  }
  const r = meta.requisitos ?? {};
  if (r.levelMin != null && !(Number.isInteger(r.levelMin) && r.levelMin >= 1)) erros.push('requisitos.levelMin (level recomendado) inválido.');
  // `exige`: fases que precisam estar completas para ENTRAR (o servidor impõe). Só de trás: assim nunca fecha um ciclo
  // com a cadeia do ato (A exige B, e B só abre depois de A).
  for (const id of r.exige ?? []) {
    const outra = faseDe(id);
    if (!outra) erros.push(`requisitos.exige: "${id}" não é uma fase da campanha.`);
    else if (outra.pular) erros.push(`requisitos.exige: "${outra.nome}" está travada (conta como completa sozinha).`);
    else if (outra.indice >= faseDe(huntId).indice) erros.push(`requisitos.exige: "${outra.nome}" vem depois desta fase — só dá para exigir fases anteriores.`);
  }
  return erros;
}

export function salvarMeta(huntId, bruto) {
  const meta = {
    ...(bruto.descricao ? { descricao: String(bruto.descricao) } : {}),
    ...(bruto.ambiente ? { ambiente: String(bruto.ambiente) } : {}),
    ...(bruto.conexoes?.length ? { conexoes: bruto.conexoes.map(String) } : {}),
    ...(bruto.requisitos && Object.keys(bruto.requisitos).length ? { requisitos: bruto.requisitos } : {}),
  };
  const erros = validarMeta(huntId, meta);
  if (erros.length) return { ok: false, erros };
  const atual = lerArquivoDeFases();
  // `mundo` (o índice dos encontros) é do `salvarEncontros`: salvar os dados da fase não o apaga.
  const mundo = atual.fases[huntId]?.mundo;
  const novo = { ...meta, ...(mundo ? { mundo } : {}) };
  if (Object.keys(novo).length) atual.fases[huntId] = novo;
  else delete atual.fases[huntId];
  gravarArquivoDeFases(atual);
  return { ok: true };
}

// ------------------------------------------------------------------ validação de encontros no mapa

/**
 * Os erros e avisos de uma lista de encontros NA fase `huntId`: a validação do jogo + o ponto (andável, alcançável).
 * `erros` impedem de gravar; `avisos` só informam.
 */
export function validarFase(huntId, encontros) {
  const fase = faseDe(huntId);
  const mapa = carregarMapa(huntId);
  const erros = [];
  const avisos = [];
  if (!fase || !mapa) return { erros: ['Esta fase não tem mapa.'], avisos };
  erros.push(...Modelo.validar(encontros, { largura: mapa.width, altura: mapa.height }));
  const lista = Modelo.encontrosDoMapa({ encontros });
  // Sem encontros não há ponto a conferir (e ler o terreno de 48 fases só para dizer "vazio" seria lento).
  if (!lista.length) return { erros, avisos, economia: null };
  let grade = null;
  try {
    grade = gradeDaHunt(huntOuMapaCustom(huntId));
  } catch {
    avisos.push('Não deu para ler o terreno do mapa: o ponto dos encontros não foi conferido.');
  }
  const alcancaveis = grade ? casasAlcancaveis(grade) : null;
  for (const e of lista) {
    if (!e.ativo) {
      avisos.push(`encontro ${e.id}: desligado.`);
      continue;
    }
    if (e.x != null && grade) {
      const z = e.z ?? mapa.z ?? grade.z;
      const g = andarDaGrade(grade, z);
      const k = `${e.x},${e.y}`;
      if (!g?.andavel?.has(k)) erros.push(`encontro ${e.id}: o ponto (${e.x}, ${e.y}, andar ${z}) não é andável no mapa.`);
      else if (!alcancaveis?.get(z)?.has(k)) (e.obrigatorio ? erros : avisos).push(`encontro ${e.id}: o ponto não é alcançável a pé a partir da entrada.`);
    }
    if (e.recompensa && valorEsperado(e.recompensa) > CONFIG.limites.valorEsperadoPorEncontro * 0.8) avisos.push(`encontro ${e.id}: o valor esperado da recompensa está perto do teto.`);
    if (e.obrigatorio && fase.pular) erros.push(`encontro ${e.id}: a fase está travada (em obras) — um obrigatório não tem como ser cumprido.`);
  }
  // O impacto econômico: os encontros são um EXTRA da fase, não a fonte de ouro dela.
  let economia = null;
  if (!erros.length) {
    economia = impactoEconomico(huntId, lista);
    const pct = `${Math.round(economia.fracao * 100)}%`;
    const detalhe = `os encontros somam ~${economia.valorDosEncontros.toLocaleString('pt-BR')} de ouro por instância, ${pct} do valor de limpar a fase (~${economia.valorDaFase.toLocaleString('pt-BR')})`;
    if (economia.fracao > CONFIG.limites.fracaoDaFaseErro) erros.push(`economia: ${detalhe} — acima do teto de ${Math.round(CONFIG.limites.fracaoDaFaseErro * 100)}%.`);
    else if (economia.fracao > CONFIG.limites.fracaoDaFaseAviso) avisos.push(`economia: ${detalhe} — acima de ${Math.round(CONFIG.limites.fracaoDaFaseAviso * 100)}%, revise.`);
  }
  return { erros, avisos, economia };
}

/** Grava os encontros da fase em `gamedata/encontros/<huntId>.json` (o mapa não é tocado). */
export function salvarEncontros(huntId, bruto) {
  if (!Array.isArray(bruto)) return { ok: false, erros: ['`encontros` precisa ser uma lista.'] };
  const { erros, avisos } = validarFase(huntId, bruto);
  if (erros.length) return { ok: false, erros, avisos };
  const normalizados = Modelo.encontrosDoMapa({ encontros: bruto });
  const arquivo = Arquivos.caminhoDos(huntId, CAMINHOS.encontros);
  try {
    mkdirSync(CAMINHOS.encontros, { recursive: true });
    // Só o arquivo da fase: o mapa (1 MB) não é tocado. Lista vazia remove o arquivo — e então vale o formato antigo (bloco do mapa, se houver).
    if (normalizados.length) writeFileSync(arquivo, `${JSON.stringify({ encontros: normalizados }, null, 2)}\n`, 'utf8');
    else if (existsSync(arquivo)) unlinkSync(arquivo);
    Arquivos.esquecerCache();
  } catch (e) {
    return { ok: false, erros: [`Não deu para gravar (${e.code ?? e.message}) — o editor grava no servidor de desenvolvimento.`] };
  }
  gravarIndice(huntId, normalizados);
  return { ok: true, avisos, reiniciar: 'Reinicie o servidor de desenvolvimento para jogar esta fase com os encontros novos.' };
}

// ------------------------------------------------------------------ resumo e visão geral

const BOSS_TIPOS = Object.keys(CATEGORIAS_DO_TIPO);

/** O resumo de uma lista de encontros: o que a visão geral mostra por fase. */
export function resumoDosEncontros(encontros) {
  const lista = Modelo.encontrosDoMapa({ encontros });
  const r = { total: lista.length, ativos: 0, desligados: 0, obrigatorios: 0, opcionais: 0, bosses: { principal: 0, miniboss: 0, secreto: 0, evento: 0, endgame: 0 }, baus: 0, altares: 0, bossesObrigatorios: [] };
  for (const e of lista) {
    if (!e.ativo) {
      r.desligados++;
      continue;
    }
    r.ativos++;
    if (e.obrigatorio) r.obrigatorios++;
    else r.opcionais++;
    if (BOSS_TIPOS.includes(e.tipo)) {
      const cat = Catalogo.bossUnico(e.bossId)?.categoria;
      if (cat) r.bosses[cat]++;
      if (e.obrigatorio) r.bossesObrigatorios.push(e.bossId);
    }
    if (e.tipo.startsWith('bau')) r.baus++;
    if (e.tipo === 'altar') r.altares++;
  }
  return r;
}

/** A condição de conclusão da fase, em palavras (derivada dos encontros obrigatórios — ela não é cadastrada à parte). */
export function condicaoDeConclusao(encontros) {
  const obrig = Modelo.encontrosDoMapa({ encontros }).filter((e) => e.ativo && e.obrigatorio);
  const partes = ['Eliminar os monstros da fase'];
  for (const e of obrig) partes.push(`${e.nome} (${e.tipo})`);
  return partes;
}

export function listarFases() {
  const metas = metaDasFases();
  return Campanha.FASES.map((f, indice) => {
    const mapa = carregarMapa(f.huntId);
    const encontros = mapa ? lerEncontros(f.huntId) : [];
    const v = mapa ? validarFase(f.huntId, encontros) : { erros: [], avisos: [] };
    return {
      huntId: f.huntId, nome: f.nome, ato: f.ato, indice, pular: !!f.pular, nivel: f.nivel,
      temMapa: !!mapa, meta: metas[f.huntId] ?? {}, resumo: resumoDosEncontros(encontros), erros: v.erros.length, avisos: v.avisos.length,
    };
  });
}

export function carregarFase(huntId) {
  const fase = faseDe(huntId);
  const mapa = carregarMapa(huntId);
  if (!fase || !mapa) return null;
  const encontros = lerEncontros(huntId);
  return {
    fase: { huntId: fase.huntId, nome: fase.nome, ato: fase.ato, nivel: fase.nivel, pular: !!fase.pular },
    meta: metaDasFases()[huntId] ?? {},
    mapa: { largura: mapa.width, altura: mapa.height, z: mapa.z ?? 7 },
    encontros,
    condicaoDeConclusao: condicaoDeConclusao(encontros),
    resumo: resumoDosEncontros(encontros),
    validacao: validarFase(huntId, encontros),
    economia: impactoEconomico(huntId, Modelo.encontrosDoMapa({ encontros })),
    conexoesDeEntrada: Object.entries(metaDasFases()).filter(([, m]) => m.conexoes?.includes(huntId)).map(([id]) => id),
  };
}

// ------------------------------------------------------------------ bosses

/** Onde cada boss é usado: `{ bossId: [{ huntId, encontro }] }`. */
export function usosDosBosses() {
  const usos = {};
  for (const f of Campanha.FASES) {
    for (const e of lerEncontros(f.huntId)) if (e.bossId) (usos[e.bossId] ??= []).push({ huntId: f.huntId, encontro: e.id });
  }
  return usos;
}

export function listarBosses() {
  const usos = usosDosBosses();
  return Catalogo.todos().map((b) => ({ ...b, usos: usos[b.id] ?? [] }));
}

export function salvarBoss(bruto) {
  const erros = Catalogo.validar(bruto);
  if (erros.length) return { ok: false, erros };
  const arquivo = lerJson(CAMINHOS.bosses, { bosses: {} });
  arquivo.bosses ??= {};
  // O que se grava é o que o editor mandou, sem os campos que o normalizador preenche sozinho.
  const def = JSON.parse(JSON.stringify(Catalogo.normalizar(bruto)));
  arquivo.bosses[def.id] = def;
  try {
    writeFileSync(CAMINHOS.bosses, `${JSON.stringify(arquivo, null, 2)}\n`, 'utf8');
  } catch (e) {
    return { ok: false, erros: [`Não deu para gravar (${e.code ?? e.message}).`] };
  }
  Catalogo.registrar(def); // vale na hora neste servidor
  return { ok: true };
}

export function excluirBoss(id) {
  const usos = usosDosBosses()[id] ?? [];
  if (usos.length) return { ok: false, erros: [`O boss "${id}" é usado por ${usos.map((u) => `${u.huntId}/${u.encontro}`).join(', ')}: tire-o dos encontros antes.`] };
  const arquivo = lerJson(CAMINHOS.bosses, { bosses: {} });
  if (!arquivo.bosses?.[id]) return { ok: false, erros: ['Boss não encontrado.'] };
  delete arquivo.bosses[id];
  writeFileSync(CAMINHOS.bosses, `${JSON.stringify(arquivo, null, 2)}\n`, 'utf8');
  Catalogo.esquecer(id);
  return { ok: true };
}

// ------------------------------------------------------------------ auditoria e opções

/** A visão geral: por fase, o resumo e os problemas — inclusive o que está INCOMPLETO. */
export function auditar() {
  const problemas = [];
  const fases = listarFases();
  for (const f of fases) {
    const v = f.temMapa ? validarFase(f.huntId, lerEncontros(f.huntId)) : { erros: [], avisos: [] };
    // O índice que a tela WORLD lê precisa bater com os encontros do mapa (nome de boss mudou? encontro editado à mão?).
    const esperado = JSON.stringify(indiceDoMundo(lerEncontros(f.huntId)));
    const gravado = lerArquivoDeFases().fases?.[f.huntId]?.mundo;
    if (esperado !== JSON.stringify(gravado ?? indiceDoMundo([]))) problemas.push({ nivel: 'aviso', onde: f.huntId, mensagem: 'o índice da tela WORLD está desatualizado — salve os encontros desta fase de novo no editor.' });
    for (const m of v.erros) problemas.push({ nivel: 'erro', onde: f.huntId, mensagem: m });
    for (const m of v.avisos) problemas.push({ nivel: 'aviso', onde: f.huntId, mensagem: m });
  }
  for (const b of listarBosses()) {
    if (!b.usos.length) problemas.push({ nivel: 'aviso', onde: `boss ${b.id}`, mensagem: 'cadastrado mas não usado por nenhum encontro.' });
    if (!b.recompensas.loot.length && !b.recompensas.primeiraVitoria) problemas.push({ nivel: 'aviso', onde: `boss ${b.id}`, mensagem: 'sem recompensa própria (usa o loot da criatura-base).' });
    if (!b.comportamentos.length && !b.fases.length && !b.melee) problemas.push({ nivel: 'aviso', onde: `boss ${b.id}`, mensagem: 'sem melee, comportamentos nem fases: não faz nada na luta.' });
  }
  for (const m of Catalogo.ERROS_DO_ARQUIVO) problemas.push({ nivel: 'erro', onde: 'bosses-unicos.json', mensagem: m });
  return {
    fases,
    problemas,
    totais: { fases: fases.length, comEncontros: fases.filter((f) => f.resumo.total).length, comBoss: fases.filter((f) => Object.values(f.resumo.bosses).some((n) => n)).length, erros: problemas.filter((p) => p.nivel === 'erro').length, avisos: problemas.filter((p) => p.nivel === 'aviso').length },
  };
}

/** Tudo que os formulários do editor precisam saber (tipos, categorias, condições, atributos de altar, limites, bichos). */
export function opcoes() {
  return {
    tipos: Object.entries(TIPOS).map(([id, t]) => ({ id, idle: t.idle, disponivel: !!t.implementado, v2: !!t.v2 })).filter((t) => !t.id.startsWith('t-')),
    categoriasDoTipo: CATEGORIAS_DO_TIPO,
    categoriasDeBoss: Catalogo.CATEGORIAS,
    condicoes: Modelo.CONDICOES,
    comportamentos: Catalogo.TIPOS_DE_COMPORTAMENTO,
    limites: CONFIG.limites,
    limitesDoBoss: Catalogo.LIMITES,
    tabelas: Object.keys(CONFIG.tabelas),
    afixosDeAltar: AFIXOS_DE_ALTAR.map((id) => ({ id, nome: FICHAS[id]?.nome ?? id, max: FICHAS[id]?.max })),
    elementos: ['physical', 'fire', 'ice', 'earth', 'energy', 'death', 'holy', 'lifedrain', 'manadrain', 'drown'],
    raridades: Mapas.raridadesParaEditor?.() ?? {},
    bestiario: Mapas.bestiarioParaEditor(),
    bosses: Catalogo.todos().map((b) => ({ id: b.id, nome: b.nome, categoria: b.categoria })),
    fases: Campanha.FASES.map((f) => ({ huntId: f.huntId, nome: f.nome, ato: f.ato })),
  };
}

/** Busca itens por nome ou id (para as recompensas): até 30 resultados. */
export function buscarItens(q) {
  const t = String(q ?? '').trim().toLowerCase();
  if (t.length < 2) return [];
  const saida = [];
  for (const i of Object.values(ITEM_CATALOG)) {
    if (String(i.id) === t || String(i.name ?? '').toLowerCase().includes(t)) {
      saida.push({ id: Number(i.id), name: i.name });
      if (saida.length >= 30) break;
    }
  }
  return saida;
}

export const _para_testes = { faseDe, CATALOGO };
