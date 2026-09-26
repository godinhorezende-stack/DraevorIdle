/*
 * ---- As duas portas de acesso, num lugar só ----
 *
 * Instance Hunts e Divine Hunts abrem com um pergaminho de 24 horas, e as duas
 * cobram a MESMA dupla de condições: premium ativo e um level mínimo.
 *
 * Este arquivo existe porque o level estava prestes a virar três cópias — uma
 * no servidor (que RECUSA o uso), uma na vitrine da loja (que AVISA antes da
 * compra) e uma na tela (que avisa antes do uso e no balão do item). Três
 * números iguais divergem no primeiro conserto feito só de um lado, e aí a tela
 * promete um level que o servidor não cobra.
 *
 * O que mora aqui é só o que os dois lados precisam saber. O resto de cada
 * porta — onde o vencimento é guardado no personagem, qual marca do arquivo de
 * hunt pertence a ela — é assunto do servidor e continua em
 * `server/src/instance.mjs`.
 *
 * ---- O level é o da hunt MAIS BARATA da porta ----
 *
 * Não é um número escolhido: é o menor `level` entre as hunts daquela porta.
 * `tools/test-porta-das-hunts.mjs` confere isso contra os arquivos de hunt de
 * verdade — criar uma Divine de level 900 amanhã derruba o teste em vez de
 * abrir a porta cedo demais em silêncio.
 */
export const PORTAS_DE_ACESSO = {
  instance: {
    id: 'instance',
    /** O item que dá o acesso: 22771 no `items.xml` dele, "Instance Hunts". */
    item: 22771,
    nome: 'Instance Hunts',
    level: 800,
  },
  divina: {
    id: 'divina',
    /*
     * O 55335 — "hunting scroll" no client dele, "Divine Hunts Scroll" aqui.
     * Ele não existe no `items.xml` de servidor nenhum: só no client, e o
     * `hunting_scroll.lua` o usa pelo id.
     */
    item: 55335,
    nome: 'Divine Hunts',
    // Seis das onze pedem 1000; as cinco novas pedem 1300.
    level: 1000,
  },
};

/** A porta que este item abre, ou `null` quando ele não abre nenhuma. */
export const portaDoItemDeAcesso = (id) =>
  Object.values(PORTAS_DE_ACESSO).find((porta) => porta.item === Number(id)) ?? null;
