// As HABILIDADES DE ITEM do PoE (07/11, lote 13 das inertes — dono: "Importar e fazer à mão"): as habilidades que só os únicos concedem ("Concede a Habilidade
// Disparo Elétrico", "Ativa Inveja…") viram gemas OCULTAS do jogo (`soDoItem`: não caem, não são vendidas, não saem da Lente — só existem pela peça), no formato de
// `gemas-poe.json`, para o compilador de gemas. A fonte: as páginas do poedb em português, extraídas pelo Scrapling (`/home/deploy/scrapling/extrair/
// habilidades_de_itens.py` → `saida/habilidades-de-itens.json`).
// Ficam de fora as que o jogo já tem com outro nome (`APELIDOS` — a Explosão Vulcânica é a Rajada Vulcânica do Reliquarian; o Convocar Fantasma, o do suporte).
// Uso: node tools/importar-habilidades-de-itens.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const FONTE = process.env.HABILIDADES_DE_ITENS ?? '/home/deploy/scrapling/saida/habilidades-de-itens.json';
const SAIDA = new URL('../gamedata/itens-poe/habilidades-de-itens.json', import.meta.url);
export const APELIDOS = { Molten_Burst: 'Rajada Vulcânica', Summon_Phantasm: 'Convocar Fantasma (o suporte)' };

const fonte = JSON.parse(readFileSync(FONTE, 'utf8'));
const habilidades = fonte.filter((h) => !APELIDOS[h.slug]).map((h) => ({ ...h, soDoItem: true }));
writeFileSync(SAIDA, `${JSON.stringify({ _nota: 'As habilidades que só os únicos do PoE concedem, no formato de gemas-poe.json (soDoItem: não caem nem são vendidas). Gerado por tools/importar-habilidades-de-itens.mjs.', habilidades }, null, 1)}\n`);
console.log(`habilidades-de-itens.json: ${habilidades.length} habilidades (${Object.keys(APELIDOS).length} já existem com outro nome)`);
