// Arquivos de `gamedata/` que o SERVIDOR lê mas o público NÃO pode baixar (o resto da pasta é servida como estático: o
// cliente precisa de sprites e catálogos). O conteúdo de encontros e bosses guarda os SEGREDOS do jogo — onde estão os
// baús, que boss secreto existe e com que chance —; servi-lo seria entregar o mapa do tesouro. A tela WORLD recebe do
// servidor só o que o jogador pode saber (ver `Campanha.paraCliente`).
const PRIVADOS = ['encontros/', 'encontros.json', 'bosses-unicos.json', 'campanha-conteudo.json'];

/** `caminho` é o que vem depois de `/gamedata/` (já decodificado e normalizado). */
export const ehPrivado = (caminho) => PRIVADOS.some((p) => caminho === p || (p.endsWith('/') && caminho.startsWith(p)));
