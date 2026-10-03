// O CONTEÚDO de cada fase da campanha que a tela WORLD mostra (`gamedata/campanha-conteudo.json`, editado em
// `/editor/conteudo`): descrição, ambiente, conexões, requisitos e o ÍNDICE do que a fase tem (`mundo`, derivado dos
// encontros do mapa e gravado pelo editor).
//
// Só lê JSON — de propósito não importa o jogo (campanha.mjs importa este módulo; um import de volta fecharia ciclo).
//
//   fases[huntId] = {
//     descricao, ambiente, conexoes: [huntId], requisitos: { levelMin (RECOMENDADO), exige: [huntId] },
//     mundo: { bossPrincipal: {bossId, nome}|null, obrigatorios: [{id, nome, tipo}], todos: [{id, nome, tipo, bossId?, bossNome?}] }
//   }
//
// REGRA DO DONO: "para entrar, só o progresso conta, não o level" — `levelMin` é só uma RECOMENDAÇÃO exibida;
// o que o servidor impõe é `exige` (fases que precisam estar completas, além da cadeia do ato).
//
// SEGREDOS: `todos` guarda TODOS os encontros ativos (inclusive os secretos) só para o servidor dar nome ao que o
// jogador já ENCONTROU; a tela WORLD nunca recebe a lista inteira (ver `Campanha.paraCliente`).
import { readFileSync, existsSync } from 'node:fs';

const ARQUIVO = new URL('../gamedata/campanha-conteudo.json', import.meta.url);
const BRUTO = existsSync(ARQUIVO) ? JSON.parse(readFileSync(ARQUIVO, 'utf8')) : {};
const DADOS = BRUTO.fases ?? {};
/** Metadados de cada Ato para a tela WORLD (`atos[n] = { nome, parte, tema, descricao }`): tudo opcional, editado em /editor/conteudo. */
export const atosDoConteudo = () => BRUTO.atos ?? {};

/**
 * Registra o conteúdo de uma fase de ato do EDITOR (`Campanha.registrarAto`): o mesmo formato do arquivo (conexões, mapa, requisitos).
 * Devolve uma função que desfaz (só os testes).
 */
export function registrarConteudo(huntId, dados) {
  const antes = DADOS[huntId];
  DADOS[huntId] = dados;
  return () => (antes === undefined ? delete DADOS[huntId] : (DADOS[huntId] = antes));
}
/** Metadados (nome, tema, descrição...) de um ato registrado. */
export function registrarMetaDeAto(numero, meta) {
  (BRUTO.atos ??= {})[String(numero)] = meta;
  return () => delete BRUTO.atos[String(numero)];
}

/** Só os testes: troca o conteúdo carregado (devolve uma função que o restaura). */
export function _definirParaTestes(novo) {
  const antes = { ...DADOS };
  for (const k of Object.keys(DADOS)) delete DADOS[k];
  Object.assign(DADOS, novo);
  return () => {
    for (const k of Object.keys(DADOS)) delete DADOS[k];
    Object.assign(DADOS, antes);
  };
}

export const conteudoDaFase = (huntId) => DADOS[huntId] ?? {};
/** Os ids das fases que precisam estar completas para entrar nesta (além da cadeia do ato). */
export const exigidasDaFase = (huntId) => DADOS[huntId]?.requisitos?.exige ?? [];

/** Nome dos bosses que o índice conhece (id → nome), para o registro de bosses derrotados. */
export function nomesDeBosses() {
  const nomes = {};
  for (const f of Object.values(DADOS)) for (const e of f.mundo?.todos ?? []) if (e.bossId) nomes[e.bossId] = e.bossNome ?? e.bossId;
  return nomes;
}
