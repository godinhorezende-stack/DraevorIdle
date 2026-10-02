// A ENTREGA ÚNICA e o REGISTRO do personagem (`estado.encontros`): é aqui que "a recompensa vale uma vez" é
// garantido, e é daqui que sai a diferença entre PRIMEIRA conclusão e repetição (decisão do dono: a primeira paga
// o prêmio do encontro; as repetições pagam só o loot normal da fase).
//
//   estado.encontros = {
//     entregues: { "<instância>:<encontro>": instante },   // o que JÁ foi pago (mais novos; teto de 300)
//     concluidos: { "<hunt>": { "<encontro>": vezes } },   // o histórico: o registro de encontros concluídos
//   }
//
// A chave leva o id da instância: reconectar, salvar/carregar, clicar duas vezes ou dois membros da party
// pedirem a mesma recompensa caem na MESMA chave.
const TETO_DE_ENTREGAS = 300;

const registro = (estado) => (estado.encontros ??= { entregues: {}, concluidos: {} });

/** Reivindica a recompensa de `encontroId` na `instanciaId`: `{ ok: true }` UMA vez; depois `ja-entregue`. */
export function reivindicar(estado, instanciaId, encontroId, agora = Date.now()) {
  const r = registro(estado);
  const chave = `${instanciaId}:${encontroId}`;
  if (r.entregues[chave]) return { ok: false, motivo: 'ja-entregue' };
  r.entregues[chave] = agora;
  const chaves = Object.keys(r.entregues);
  if (chaves.length > TETO_DE_ENTREGAS) {
    chaves.sort((a, b) => r.entregues[a] - r.entregues[b]);
    for (const velha of chaves.slice(0, chaves.length - TETO_DE_ENTREGAS)) delete r.entregues[velha];
  }
  return { ok: true };
}

/** Conta a conclusão no histórico. `primeira`: nunca tinha concluído este encontro (desta definição) nesta hunt. */
export function registrarConclusao(estado, huntId, defId) {
  const r = registro(estado);
  const da = (r.concluidos[huntId] ??= {});
  da[defId] = (da[defId] ?? 0) + 1;
  return { primeira: da[defId] === 1, vezes: da[defId] };
}

export const vezesConcluido = (estado, huntId, defId) => estado.encontros?.concluidos?.[huntId]?.[defId] ?? 0;
