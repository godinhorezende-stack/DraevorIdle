// IMPORTA o RAIO e o LIMITE de cada JOIA ÚNICA do poedb para `gamedata/itens-poe/joias-unicas.json` (dono, 15/10: "faça as pendências e os
// efeitos que não funcionam" — os raios das joias únicas).
//
// A fonte é a lista de únicos que o Scrapling extraiu (`/home/deploy/scrapling`, `saida/unicos/unicos.json`): de cada única de joia, as
// propriedades "Raio: Grande (1500)" e "Limitado a: N". O raio vai pelo NOME (pequeno/médio/grande): o número do poedb é o do stat da joia;
// na árvore de hoje (desde a 3.16, com a árvore espaçada) o raio em unidades da árvore é 20% maior — `passivas/arvore.RAIOS_DE_JOIA`, como
// no Path of Building (decisão do dono, 15/10: "Como no PoE/PoB").
//
//   node tools/importar-joias-unicas.mjs [caminho do unicos.json]     (padrão: /home/deploy/scrapling/saida/unicos/unicos.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = dirname(fileURLToPath(import.meta.url));
export const SAIDA = join(RAIZ, '..', 'gamedata', 'itens-poe', 'joias-unicas.json');
const FONTE_PADRAO = '/home/deploy/scrapling/saida/unicos/unicos.json';
/** As bases das joias (os nomes em português da coleção). */
const BASES = new Set(['Joia Carmesim', 'Joia Viridiana', 'Joia Cobalto', 'Joia Prismática', 'Joia Atemporal', 'Joia do Olho Assassino', 'Joia do Olho Examinador', 'Joia do Olho Hipnótico', 'Joia do Olho Pavoroso']);
const RAIO = { Pequeno: 'pequeno', 'Médio': 'medio', Grande: 'grande', 'Muito Grande': 'muitoGrande', Massivo: 'massivo' };
/** As de raio que a página do poedb não mostra (no PoE, "Radius: Large"). */
const RAIO_QUE_FALTA = { The_Red_Nightmare: 'grande', The_Green_Nightmare: 'grande', The_Blue_Nightmare: 'grande', The_Light_of_Meaning: 'grande' };

/** `{ slug: { raio?, limite? } }` das joias únicas da lista. */
export function joiasUnicas(unicos) {
  const saida = {};
  for (const [slug, u] of Object.entries(unicos ?? {})) {
    const v = u?.versoes?.[0];
    if (!v || !BASES.has(v.base)) continue;
    const props = v.propriedades ?? [];
    const raio = props.map((p) => /^Raio: (.+?) \(\d+\)$/.exec(p)?.[1]).find(Boolean);
    const limite = Number(props.map((p) => /^Limitado a: (\d+)$/.exec(p)?.[1]).find(Boolean));
    const nome = (raio && RAIO[raio]) || RAIO_QUE_FALTA[slug];
    const x = { ...(nome ? { raio: nome } : {}), ...(limite > 0 ? { limite } : {}) };
    if (Object.keys(x).length) saida[slug] = x;
  }
  return saida;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fonte = process.argv[2] ?? FONTE_PADRAO;
  const joias = joiasUnicas(JSON.parse(readFileSync(fonte, 'utf8')));
  const dados = {
    _nota: 'O RAIO (pelo nome — o tamanho em unidades da árvore está em passivas/arvore.RAIOS_DE_JOIA) e o "Limitado a: N" de cada joia única, do poedb (tools/importar-joias-unicas.mjs).',
    joias: Object.fromEntries(Object.entries(joias).sort(([a], [b]) => a.localeCompare(b))),
  };
  writeFileSync(SAIDA, `${JSON.stringify(dados, null, 2)}\n`);
  console.log(`joias únicas: ${Object.keys(joias).length} → ${SAIDA}`);
}
