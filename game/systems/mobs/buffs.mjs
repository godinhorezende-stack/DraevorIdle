// Os BUFFS TEMPORÁRIOS de um mob — o que as mecânicas dos modificadores põem
// nele (Enfurecido, Vingativo, Endurecido...): `{ chave, ate, danoPct,
// velocidadeDeAtaquePct, resist: { elemento: % }, pilhas }`. Puro: quem lê são
// as contas que já existem — a força do golpe (`Reforcos.forcaDoBicho`), o
// intervalo do golpe (`golpesDosMonstros`) e a resistência (`resistenciaDe`).
// `ate: Infinity` = até o mob morrer (o enrage).

const ativos = (m, agora) => (m?.buffsDeMob ?? []).filter((b) => b.ate > agora);

/**
 * Põe (ou renova) um buff. Com `acumulaAte`, a mesma `chave` empilha até esse
 * número (cada pilha soma o efeito inteiro de novo) e renova a duração.
 */
export function por(m, buff, agora) {
  const lista = (m.buffsDeMob = ativos(m, agora));
  const atual = lista.find((b) => b.chave === buff.chave);
  if (atual) {
    atual.pilhas = Math.min(buff.acumulaAte ?? 1, (atual.pilhas ?? 1) + (buff.acumulaAte ? 1 : 0));
    atual.ate = Math.max(atual.ate, buff.ate);
    return atual;
  }
  const novo = { ...buff, pilhas: 1 };
  lista.push(novo);
  return novo;
}

/** A soma de um campo numérico dos buffs ativos (× as pilhas). */
export const soma = (m, agora, campo) => ativos(m, agora).reduce((s, b) => s + (b[campo] ?? 0) * (b.pilhas ?? 1), 0);

/** A resistência a mais (em %) dos buffs ativos para o `tipo` de dano. */
export const resistencia = (m, agora, tipo) => ativos(m, agora).reduce((s, b) => s + (b.resist?.[tipo] ?? 0) * (b.pilhas ?? 1), 0);
