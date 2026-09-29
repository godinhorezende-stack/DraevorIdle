// Os OUTROS jogadores da mesma sala de caçada (a caçada em grupo — ver
// party.mjs), no mesmo andar: `"x,y"` -> a hunt dele.
//
// "Na party, junta os 2 players na hunt ou mais: nunca podem andar em cima do
// outro, tem que ter colisão." A lista vem da partilha que o tique da sessão
// calcula (`hunt.partilha.membros`, não-enumerável): ela tem o estado VIVO de
// cada um da sala, então a posição lida aqui é a de agora. Sozinho (ou na
// simulação offline, no worker), não há partilha — e nada muda.
export function aliadosPorCasa(hunt) {
  const casas = new Map();
  const membros = hunt?.partilha?.membros;
  if (!membros || membros.length < 2) return casas;
  for (const m of membros) {
    const h = m.estado?.hunt;
    if (!h || h === hunt || !h.pos || (h.z ?? null) !== (hunt.z ?? null)) continue;
    casas.set(`${h.pos.x},${h.pos.y}`, h);
  }
  return casas;
}
