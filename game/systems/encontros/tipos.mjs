// O REGISTRO dos tipos de encontro. Cada tipo declara COMO o idle o resolve e traz os seus ganchos; o resto do
// sistema (estado, sorteio, objetivos, recompensa única) é o mesmo para todos.
//
// Etapa 1 entrega a base: nenhum tipo concreto está IMPLEMENTADO ainda (baús, altar e bosses chegam nas etapas 2 e 3).
// Um mapa só pode usar um tipo `implementado` — o validador recusa o resto —, então conteúdo pela metade nunca
// chega a uma instância (e nunca deixa um personagem preso num objetivo que ninguém resolve).
//
// `idle`: como o personagem em Caça AUTOMÁTICA (e a caçada offline) lida com o encontro, para nunca ficar preso:
//   'auto'    — se resolve sozinho (o baú abre, o altar liga com a escolha padrão);
//   'combate' — o encontro é uma luta (amaldiçoado, miniboss, boss secreto): o combate de sempre resolve;
//   'escolha' — pede uma decisão do jogador: só pode ser OPCIONAL, e EXPIRA no idle (`expiraMs`).
// Ganchos: `aoAtivar(ctx)` e `resolverNoIdle(ctx)` (obrigatório para idle 'auto'), `ctx = { hunt, instancia, encontro, agora }`.
// Na Caça Automática o encontro disponível é ATIVADO pelo próprio idle (o personagem "vai até ele") — exceto os de `escolha`.

/** Os tipos planejados (o `implementado` diz se já podem ser usados em um mapa). */
export const TIPOS = {
  'bau-comum': { idle: 'auto', implementado: false },
  'bau-raro': { idle: 'combate', implementado: false },
  'bau-amaldicoado': { idle: 'combate', implementado: false },
  altar: { idle: 'auto', implementado: false },
  miniboss: { idle: 'combate', implementado: false },
  'boss-secreto': { idle: 'combate', implementado: false },
  // Versão 2 (a arquitetura já os comporta; o conteúdo não existe ainda).
  fenda: { idle: 'combate', implementado: false, v2: true },
  aprisionado: { idle: 'combate', implementado: false, v2: true },
  invasor: { idle: 'combate', implementado: false, v2: true },
  'area-secreta': { idle: 'escolha', implementado: false, v2: true },
  sobrevivencia: { idle: 'combate', implementado: false, v2: true },
  escolta: { idle: 'escolha', implementado: false, v2: true },
};

/** Registra (ou troca) um tipo. As próximas etapas chamam isto; os testes registram tipos de teste. */
export function registrarTipo(nome, definicao) {
  const tipo = { idle: 'auto', implementado: true, ...definicao };
  // Quem se resolve sozinho no idle PRECISA dizer como (senão um obrigatório deste tipo travaria a fase offline).
  if (tipo.idle === 'auto' && !tipo.resolverNoIdle) throw new Error(`tipo "${nome}": idle 'auto' exige resolverNoIdle`);
  TIPOS[nome] = tipo;
  return tipo;
}

export const tipoDe = (nome) => TIPOS[nome] ?? null;
