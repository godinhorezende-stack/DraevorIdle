// As 7 CLASSES do PoE no jogo local (Fase 1, incremento 4a — só com ITENS_POE=1; em produção nada muda).
//
// A classe fica POR CIMA da vocação (decisão do dono, 05/10): a vocação do Draevor segue com skills, outfit e kit inicial; a classe dá os
// ATRIBUTOS INICIAIS (For/Des/Int), o ponto de partida na árvore do PoE (incremento 4c) e as ascendências (4e). Como no PoE, os atributos
// NÃO crescem com o level: só os da classe + árvore + equipamento (`personagem/atributos.principais`).
//
// `estado.classePoe`: o slug escolhido (Ranger, Shadow, Witch, Marauder, Duelist, Scion, Templar). Quem ainda não escolheu usa a classe
// padrão da vocação (`padraoPorVocacao`) e pode escolher uma vez.
import { readFileSync } from 'node:fs';
import { ligado } from './catalogo.mjs';

export const DADOS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/classes.json', import.meta.url), 'utf8'));
export const CLASSES = DADOS.classes;

/** A vocação sem a promoção ("elite knight" → knight). */
const vocacaoDe = (estado) => {
  const v = String(estado?.vocation ?? 'none').toLowerCase();
  return DADOS.padraoPorVocacao[v] ? v : Object.keys(DADOS.padraoPorVocacao).find((k) => v.includes(k)) ?? 'none';
};

/** A classe do PoE do personagem (o objeto), ou null com o sistema desligado. */
/** O slug do PoE pela classe do Editor de Classes (`estado.classe`: o id em minúsculas, `marauder`), ou null. */
const slugDaClasse = (id) => DADOS.ordem.find((s) => s.toLowerCase() === String(id ?? '').toLowerCase()) ?? null;
export function classeDe(estado) {
  if (!ligado()) return null;
  return CLASSES[slugDaClasse(estado?.classe)] ?? CLASSES[estado?.classePoe] ?? CLASSES[DADOS.padraoPorVocacao[vocacaoDe(estado)]] ?? CLASSES.Scion;
}

/** A classe é válida? */
export const valida = (slug) => Object.hasOwn(CLASSES, String(slug ?? ''));

/**
 * Escolhe a classe (uma vez: quem já escolheu não troca). `{ ok }` ou `{ ok: false, erro }`.
 * Na criação do personagem a sessão grava direto no estado inicial (`classePoe`).
 */
export function escolher(estado, slug) {
  if (!ligado()) return { ok: false, erro: 'As classes do PoE estão desligadas.' };
  if (!valida(slug)) return { ok: false, erro: 'Classe inválida.' };
  if (estado.classePoe || slugDaClasse(estado.classe)) return { ok: false, erro: `Você já é ${classeDe(estado)?.nome ?? estado.classePoe}.` };
  estado.classePoe = slug;
  return { ok: true };
}

/** O que o cliente precisa para desenhar a escolha (na criação e na ficha). Null com o sistema desligado. */
export function paraCliente() {
  if (!ligado()) return null;
  return DADOS.ordem.map((s) => {
    const c = CLASSES[s];
    return { slug: c.slug, nome: c.nome, nomeEn: c.nomeEn, atributos: c.atributos, ascendencias: c.ascendencias.map((a) => a.nome) };
  });
}
