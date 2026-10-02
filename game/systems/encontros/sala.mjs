// Ajudantes da SALA para quem põe bichos e encontros na caçada (bosses, guardiões, invasores): os bichos da sala,
// uma casa livre perto de um ponto e quem está na luta. Uma sala só, em todos os andares — a mesma que `hunt/sala.mjs`.
import { salaDe } from '../hunt/sala.mjs';
import { gradeDaHunt, huntOuMapaCustom } from '../hunt/terreno.mjs';
import { andarDaGrade } from '../hunt/andares.mjs';
import { casaLivrePerto } from '../hunt/caminho.mjs';
import { criarMonstro } from '../hunt/monstros.mjs';
import { aplicarEscala } from '../campanha.mjs';
import * as Raridade from '../mobs/raridade.mjs';

/** Todos os bichos da sala, em todos os andares. */
export const bichosDaSala = (hunt) => {
  const sala = salaDe(hunt);
  return sala ? [...sala.monstros, ...Object.values(sala.outrosAndares ?? {}).flat()] : [];
};

/** A lista de bichos do andar `z` da sala (a do andar atual é `sala.monstros`). */
export const listaDoAndar = (hunt, z) => {
  const sala = salaDe(hunt);
  if (z == null || z === sala.z) return sala.monstros;
  return (sala.outrosAndares ??= {})[z] ?? (sala.outrosAndares[z] = []);
};

/** Uma casa livre perto de `p` no andar `z`. `null` = sem lugar. */
export function casaLivre(hunt, p, z) {
  const sala = salaDe(hunt);
  const grade = andarDaGrade(gradeDaHunt(huntOuMapaCustom(sala.huntId)), z ?? sala.z);
  const lista = listaDoAndar(hunt, z);
  return casaLivrePerto(grade, p, (c) => lista.some((m) => m.hp > 0 && m.x === c.x && m.y === c.y) || (sala.pos.x === c.x && sala.pos.y === c.y));
}

/** Os estados de quem está na luta: o `estado` dado + os da partilha da party que estão na caçada. */
export function quemEstaNaSala(hunt, estado) {
  const partilha = hunt?.partilha;
  const outros = partilha?.ativa ? partilha.membros.map((m) => m.estado).filter((e) => e && e !== estado && e.hunt) : [];
  return [estado, ...outros];
}

/**
 * Nasce um grupo de bichos de um encontro (guardiões de um baú, invasores, penalidade de altar) perto de `ponto`.
 * Cada um leva a escala da fase, a raridade/modificadores pedidos, e o `encontro` que o chamou. `opcional`: não
 * conta para o CLEAR (mas o encontro em andamento segura a instância). Devolve os uids que nasceram.
 */
export function nascerGrupo(hunt, { criaturas, raridade = null, modificadores = [], ponto, instanciaId = null, encontro, opcional = true, marca = 'guardiao' }) {
  const sala = salaDe(hunt);
  const z = ponto?.z ?? sala.z;
  const uids = [];
  for (const { key, qtd = 1 } of criaturas) {
    for (let i = 0; i < qtd; i++) {
      const casa = casaLivre(hunt, ponto ?? { x: sala.pos.x + 3, y: sala.pos.y }, z);
      if (!casa) return uids;
      const m = criarMonstro({ key, x: casa.x, y: casa.y, z }, null);
      if (!m) continue;
      delete m.spawn;
      if (sala.escala) aplicarEscala(m, sala.escala);
      if (raridade || modificadores.length) Raridade.aplicar(m, { raridade: raridade ?? 'normal', modificadores });
      if (instanciaId) m.instancia = instanciaId;
      m.objetivo = 1;
      m.encontro = encontro;
      m[marca] = true;
      if (opcional) m.opcional = true;
      listaDoAndar(hunt, z).push(m);
      uids.push(m.uid);
    }
  }
  return uids;
}
