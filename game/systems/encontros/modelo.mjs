// O MODELO de dados de um encontro e a sua validação. Os encontros moram no arquivo do mapa (`<id>-map.json`),
// no bloco `encontros`, ao lado dos `spawns` (mesmo arquivo, mesmo editor — ver `mapa/spawns.mjs`):
//
//   "encontros": [{
//     "id": "bau-da-cripta",            // único no mapa
//     "tipo": "bau-raro",               // ver `tipos.mjs`
//     "nome": "Baú da cripta",
//     "x": 20, "y": 13, "z": 7,         // onde ele está (opcional para os que não têm lugar)
//     "ativo": true,                    // desligado = nunca entra numa instância (conteúdo em obra)
//     "probabilidade": 100,             // 0–100: a chance de EXISTIR nesta instância (sorteada UMA vez, ver `sorteio.mjs`)
//     "quantidade": 1,                  // até quantos desta definição (cada um é sorteado à parte)
//     "obrigatorio": false,             // true = a instância só fica CLEAR com ele concluído (exige 100%)
//     "condicao": { "tipo": "sempre" }, // quando fica disponível: sempre | monstros-limpos | apos-encontro (+ "encontro": id)
//     "expiraMs": 120000,               // opcional (só para opcionais): sem ninguém, expira no idle
//     "recompensa": { ... }             // das etapas 2 e 3 (tabelas do loot atual); aqui é só carregado
//   }]
//
// A probabilidade é por INSTÂNCIA (decisão do dono: uma vez, na criação, com semente gravada) — nunca por tique,
// por reconexão ou por comando. Ver `sorteio.mjs` e `estado.mjs`.
import { tipoDe } from './tipos.mjs';

export const CONDICOES = ['sempre', 'monstros-limpos', 'apos-encontro'];
export const PADRAO = { ativo: true, probabilidade: 100, quantidade: 1, obrigatorio: false };
/** Campos que só alguns tipos usam: baú (recompensa, armadilha, guardioes, invocacao, chanceDeInvocacao, requisitos) e altar (efeitos, duracaoMs, penalidade). */
const CAMPOS_DOS_TIPOS = ['recompensa', 'armadilha', 'guardioes', 'invocacao', 'chanceDeInvocacao', 'requisitos', 'efeitos', 'duracaoMs', 'penalidade', 'ondas', 'pausaMs', 'limiteMs', 'crescimento', 'captores', 'invasores', 'bencao', 'prisioneiro', 'ocupantes', 'protegido', 'descricao'];

/** O encontro completo, com os padrões preenchidos (`null` se não é um objeto com id e tipo). */
export function normalizar(e) {
  if (!e || typeof e !== 'object' || e.id == null || !e.tipo) return null;
  const condicao = e.condicao && typeof e.condicao === 'object' ? { ...e.condicao } : { tipo: 'sempre' };
  return {
    id: String(e.id),
    tipo: String(e.tipo),
    nome: e.nome != null ? String(e.nome) : String(e.id),
    ...(Number.isInteger(e.x) && Number.isInteger(e.y) ? { x: e.x, y: e.y, ...(Number.isInteger(e.z) ? { z: e.z } : {}) } : {}),
    ativo: e.ativo !== false,
    probabilidade: e.probabilidade == null ? PADRAO.probabilidade : Number(e.probabilidade),
    quantidade: e.quantidade == null ? PADRAO.quantidade : Number(e.quantidade),
    obrigatorio: e.obrigatorio === true,
    condicao: { tipo: condicao.tipo ?? 'sempre', ...(condicao.encontro != null ? { encontro: String(condicao.encontro) } : {}) },
    ...(e.expiraMs != null ? { expiraMs: Number(e.expiraMs) } : {}),
    ...(e.bossId != null ? { bossId: String(e.bossId) } : {}),
    // Os campos específicos dos baús e altares (validados pelo tipo — ver `tipos-de-bau.mjs`).
    ...Object.fromEntries(CAMPOS_DOS_TIPOS.filter((k) => e[k] != null).map((k) => [k, e[k]])),
  };
}

/** Os encontros de um arquivo de mapa, normalizados (lista vazia = o mapa não tem nenhum). */
export function encontrosDoMapa(mapa) {
  return Array.isArray(mapa?.encontros) ? mapa.encontros.map(normalizar).filter(Boolean) : [];
}

/**
 * Os erros de uma lista de encontros (vazia = pode gravar/usar). `largura`/`altura`: a grade do mapa.
 * Só os ATIVOS são cobrados da implementação do tipo; os desligados só precisam ser coerentes.
 */
export function validar(encontros, { largura, altura } = {}) {
  const erros = [];
  if (encontros == null) return erros;
  if (!Array.isArray(encontros)) return ['`encontros` precisa ser uma lista.'];
  const lista = encontros.map((e, i) => ({ bruto: e, e: normalizar(e), i }));
  const ids = new Map();
  for (const { bruto, e, i } of lista) {
    if (!e) {
      erros.push(`encontro #${i + 1}: precisa de "id" e "tipo".`);
      continue;
    }
    if (ids.has(e.id)) erros.push(`encontro ${e.id}: id repetido.`);
    ids.set(e.id, e);
  }
  for (const { e } of lista) {
    if (!e) continue;
    const onde = `encontro ${e.id}`;
    const tipo = tipoDe(e.tipo);
    if (!tipo) erros.push(`${onde}: tipo "${e.tipo}" desconhecido.`);
    else if (e.ativo && !tipo.implementado) erros.push(`${onde}: o tipo "${e.tipo}" ainda não está disponível — deixe "ativo": false até ele chegar.`);
    if (!(e.probabilidade >= 0 && e.probabilidade <= 100)) erros.push(`${onde}: probabilidade precisa estar entre 0 e 100.`);
    if (!(Number.isInteger(e.quantidade) && e.quantidade >= 1 && e.quantidade <= 20)) erros.push(`${onde}: quantidade precisa ser um inteiro de 1 a 20.`);
    if (e.x != null && largura && altura && (e.x < 0 || e.y < 0 || e.x >= largura || e.y >= altura)) erros.push(`${onde}: fora da grade.`);
    if (!CONDICOES.includes(e.condicao.tipo)) erros.push(`${onde}: condição "${e.condicao.tipo}" desconhecida.`);
    if (e.condicao.tipo === 'apos-encontro') {
      if (!e.condicao.encontro) erros.push(`${onde}: "apos-encontro" precisa de "encontro".`);
      else if (!ids.has(e.condicao.encontro)) erros.push(`${onde}: depende de "${e.condicao.encontro}", que não existe.`);
      else if (e.condicao.encontro === e.id) erros.push(`${onde}: não pode depender de si mesmo.`);
    }
    // Cada tipo valida o que é só dele (ex.: o `bossId` dos encontros de boss).
    if (tipo?.validar && e.ativo) erros.push(...tipo.validar(e).map((m) => `${onde}: ${m}`));
    if (e.expiraMs != null && !(e.expiraMs > 0)) erros.push(`${onde}: expiraMs precisa ser positivo.`);
    if (e.obrigatorio) {
      // Obrigatório trava a conclusão da fase: nada de sorte, de expiração nem de decisão que o idle não toma.
      if (e.probabilidade !== 100) erros.push(`${onde}: obrigatório precisa de probabilidade 100 (ele não pode "não aparecer" e travar ou liberar a fase por sorte).`);
      if (e.expiraMs != null) erros.push(`${onde}: obrigatório não expira.`);
      if (tipo?.idle === 'escolha') erros.push(`${onde}: o tipo "${e.tipo}" pede uma decisão do jogador — só pode ser opcional (o idle não decide por ele).`);
      if (e.quantidade !== 1 && e.quantidade != null) erros.push(`${onde}: obrigatório aparece uma vez só (quantidade 1).`);
    }
  }
  // Um obrigatório não pode depender (direta ou indiretamente) de quem pode não aparecer: a fase travaria por sorte.
  for (const { e } of lista) {
    if (!e?.obrigatorio) continue;
    for (let dep = ids.get(e.condicao.encontro); e.condicao.tipo === 'apos-encontro' && dep; dep = dep.condicao.tipo === 'apos-encontro' ? ids.get(dep.condicao.encontro) : null) {
      if (dep === e) break;
      if (dep.probabilidade !== 100 || !dep.ativo) {
        erros.push(`encontro ${e.id}: obrigatório depende de "${dep.id}", que pode não existir nesta instância.`);
        break;
      }
    }
  }
  // Dependência circular entre encontros (A depende de B que depende de A).
  for (const { e } of lista) {
    if (!e) continue;
    const vistos = new Set();
    for (let atual = e; atual?.condicao?.tipo === 'apos-encontro'; atual = ids.get(atual.condicao.encontro)) {
      if (vistos.has(atual.id)) {
        erros.push(`encontro ${e.id}: dependência circular.`);
        break;
      }
      vistos.add(atual.id);
    }
  }
  return erros;
}
