// A ENTREGA da recompensa de um encontro, em dois pedaços que cada tipo combina como precisa:
//   - `pagarRolagens`: sorteia a tabela `n` vezes pelo loot de sempre (bônus, filtros, capacidade, rodízio da party);
//   - `pagarConclusao`: registra a conclusão de cada membro presente e paga o prêmio de PRIMEIRA conclusão (uma vez por
//     personagem — `Entrega.reivindicar` — nunca duas pela mesma instância).
// O baú paga os dois de uma vez, ao abrir; as ondas pagam uma rolagem por onda vencida e a conclusão no fim.
import * as Recompensas from './recompensas.mjs';
import * as Entrega from './entrega.mjs';
import * as Eventos from './eventos.mjs';
import { quemEstaNaSala } from './sala.mjs';
import { lootDoEncontro, pagarPremio } from '../hunt/combate.mjs';

export const lootOrigem = (e) => ({ key: `encontro:${e.defId}`, name: e.nome, exp: e.recompensa?.moedasMedia ?? 100, expDasMoedas: e.recompensa?.moedasMedia ?? 100 });

/** Sorteia a tabela do encontro `n` vezes (as moedas e os itens passam pelas regras de loot do jogo). */
export function pagarRolagens(ctx, e, n) {
  const { estado, personagem, hunt } = ctx;
  const r = e.recompensa;
  if (!r || !estado || !(n > 0)) return;
  const eventos = [];
  for (let i = 0; i < n; i++) lootDoEncontro(estado, hunt, personagem, lootOrigem(e), Recompensas.dropsDe(r), eventos);
  Eventos.empurrar(hunt, eventos);
}

/** A conclusão: conta para cada membro presente e paga a primeira conclusão (uma vez por personagem). */
export function pagarConclusao(ctx, e) {
  const { estado, hunt, instancia } = ctx;
  if (!estado) return;
  const pc = e.recompensa?.primeiraConclusao;
  for (const quem of quemEstaNaSala(hunt, estado)) {
    const { primeira } = Entrega.registrarConclusao(quem, hunt.huntId, e.defId);
    if (primeira && pc && Entrega.reivindicar(quem, instancia.id, e.id).ok) {
      pagarPremio({ estado: quem, gold: Number(pc.gold ?? 0), exp: Number(pc.exp ?? 0), itens: (pc.itens ?? []).map((i) => ({ id: i.id, count: i.count })), nome: e.nome });
    }
  }
}
