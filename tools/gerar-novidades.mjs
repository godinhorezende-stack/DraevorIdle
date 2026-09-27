// Gera `game/gamedata/novidades.json` — a faixa "O que mudou nesta versão"
// do cliente (`pintarNovidades`/`abrirNovidades` em main.mjs), no formato do
// `welcome.novidades` do original: {versao, titulo, em, itens, anteriores}.
//
// A versão ATUAL é a deste servidor (NOSSAS_NOVIDADES, abaixo — acrescente uma
// entrada nova no topo a cada atualização). As anteriores são o histórico do
// original, lido da captura mais nova que tiver `novidades`.
//
// Uso: node tools/gerar-novidades.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

const NOSSAS_NOVIDADES = [
  {
    versao: '2026-09-26-guildas-arena-e-mercado',
    em: '26 de setembro — guildas com brasão, arena de fila e a aba Mercado',
    itens: [
      'A JANELA DE GUILDAS FOI REFEITA: Minha guilda, Baú, Servidor (com pódio) e Pedidos, o card de cada membro com o equipamento, e o menu de Opções do líder.',
      'O BRASÃO É SEU: forma, símbolo, iniciais, cores e efeitos. Fundar paga só os efeitos pagos; trocar depois custa 50 Draevor Coins, e um efeito comprado nunca se paga de novo.',
      'NO BAÚ DA GUILDA, UM CLIQUE GUARDA: com o baú aberto, clicar numa peça da mochila já leva ela para lá — e vai a peça CLICADA, mesmo com duas iguais de afixos diferentes.',
      'A ARENA X1 VIROU FILA: "Alistar-se ao lobby" põe o seu card para os outros; "Enfrentar" abre a sala na hora, e os dois recebem o aviso para abrir o lobby.',
      'NO DUELO, OS DOIS SE ACHAM: ir atrás do adversário segue o caminho da caverna (antes travava na primeira parede, com a sala inteira entre os dois).',
      'A MOEDA DA ARENA ANDA: +1 para quem vence, −1 para quem perde. A tela de fim mostra pontos, moedas e patente de antes e depois, e quem perde acorda no templo.',
      'OS BICHOS DA ARENA BATIAM DEMAIS: a Livraria de Fogo e o Skeletinho usavam uma conta genérica (um Burning Book tirava 9 mil num golpe). Agora batem o que batem no Tibia — e mais 10 bichos de hunt e 3 bosses que tinham o dano mínimo trocado também foram acertados.',
      'O SITE FICOU COMPLETO: a capa mostra quem está online, o top 5 por level e skill, o TOP EXP DE HOJE e o da última hora, os drops raros e as bags; e voltaram as páginas Quem está online, Guildas (com a ficha de cada uma) e a do personagem, com equipamento e estatísticas.',
      'ABA MERCADO NO CHAT: compra e venda para o servidor inteiro, uma mensagem a cada 30 segundos — e todo anúncio novo do balcão do Mercado aparece nela sozinho.',
    ],
  },
];

/** A captura mais nova (por data do arquivo) que traz `welcome.novidades`. */
function historicoDoOriginal() {
  const pasta = join(RAIZ, 'api-mapeada');
  const candidatos = [];
  for (const sub of readdirSync(pasta)) {
    const dir = join(pasta, sub);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) if (/^welcome.*\.json$/.test(f)) candidatos.push(join(dir, f));
  }
  candidatos.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const f of candidatos) {
    const j = JSON.parse(readFileSync(f, 'utf8'));
    const n = (j.welcome ?? j).novidades;
    if (n?.itens?.length) return { fonte: f.slice(RAIZ.length), n };
  }
  return { fonte: null, n: null };
}

const { fonte, n } = historicoDoOriginal();
const doOriginal = n ? [{ em: n.em, itens: n.itens }, ...(n.anteriores ?? [])] : [];
const [atual, ...nossasAntigas] = NOSSAS_NOVIDADES;
const saida = {
  _fonte: `nossas (tools/gerar-novidades.mjs) + histórico do original (${fonte})`,
  versao: atual.versao,
  titulo: 'O que mudou nesta versão',
  em: atual.em,
  itens: atual.itens,
  anteriores: [...nossasAntigas.map(({ em, itens }) => ({ em, itens })), ...doOriginal],
};
writeFileSync(join(RAIZ, 'game/gamedata/novidades.json'), JSON.stringify(saida, null, 1));
console.log(`novidades.json: versão ${saida.versao}, ${saida.itens.length} itens, ${saida.anteriores.length} anteriores (original: ${fonte})`);
