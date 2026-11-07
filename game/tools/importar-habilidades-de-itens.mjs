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

// (07/11, lote 19 das inertes — o dono: "Aproximar com números meus") as que NÃO têm página no poedb nem dado no PoB: entram à mão, sem números (o efeito é o de
// `systems/itens-poe/habilidades-de-itens.mjs`, com a nota "sem fonte")
export const MANUAIS = [
  { slug: 'Bloody_Shockwave', nome: 'Onda de Choque Sangrenta', en: 'Bloody Shockwave', cor: 'vermelha', nivelReq: 1, tags: ['Área', 'Físico', 'Ativação', 'Nova'], tipos: ['Area', 'Physical', 'Triggered', 'Nova'], props: ['Nível: 20'], mods: [], qualidade: [], desc: 'O acerto corpo a corpo libera uma onda de choque sangrenta.', icone: null, colunas: ['Nível'], linhas: [['20']], semFonte: true },
  // (o Impacto Ardente das Maças Quebradora e Explosiva: o poedb não tem o quadro; os números do PoB — FieryImpactHeistMaceImplicit, níveis 10/15/20)
  { slug: 'Fiery_Impact', nome: 'Impacto Ardente', en: 'Fiery Impact', cor: 'vermelha', nivelReq: 30, tags: ['Ataque', 'Área', 'Corpo a Corpo', 'Ativação', 'Fogo'], tipos: ['Attack', 'Area', 'Melee', 'Triggered', 'Cooldown'], props: ['Nível: (10 — 20)', 'Recarga: (2.16 — 1.40) seg', 'Dano de Ataque: (280 — 420)% de base', 'Eficácia do Dano Adicionado: (280 — 420)%'], mods: ['60% do Dano Físico Convertido para Dano de Fogo', 'Esta Habilidade é Ativada por um Item Único'], qualidade: [], desc: 'Causa dano de ataque numa área.', icone: null, colunas: ['Nível', 'RequerNível', 'Base Damage', 'Experiência'], linhas: Array.from({ length: 20 }, (_, i) => { const n = i + 1; const base = n <= 10 ? 280 : n <= 15 ? 280 + (n - 10) * 14 : 350 + (n - 15) * 14; return [String(n), String(Math.min(70, 30 + Math.max(0, n - 10) * 4)), `${base}%`, '']; }), dePob: true },
  // (o Abraçar a Loucura do Farol da Loucura: o poedb não tem o quadro; o PoB — EmbraceMadness: recarga de 1 s, 8 s ao tirar a Loucura Gloriosa)
  { slug: 'Embrace_Madness', nome: 'Abraçar a Loucura', en: 'Embrace Madness', cor: 'azul', nivelReq: 1, tags: ['Magia'], tipos: ['Spell', 'Cooldown'], props: ['Nível: 1', 'Recarga: 1.00 seg'], mods: [], qualidade: [], desc: 'Concede Loucura Gloriosa; usar de novo a remove.', icone: null, colunas: ['Nível'], linhas: [['1']], dePob: true },
  { slug: 'Summon_Volatile_Anomaly', nome: 'Convocar Anomalia Volátil', en: 'Summon Volatile Anomaly', cor: 'azul', nivelReq: 1, tags: ['Magia', 'Área', 'Fogo', 'Ativação'], tipos: ['Spell', 'Area', 'Fire', 'Triggered'], props: ['Nível: 20'], mods: [], qualidade: [], desc: 'Uma anomalia instável que explode.', icone: null, colunas: ['Nível'], linhas: [['20']], semFonte: true },
];

const fonte = JSON.parse(readFileSync(FONTE, 'utf8'));
const habilidades = [...fonte.filter((h) => !APELIDOS[h.slug] && !MANUAIS.some((m) => m.slug === h.slug)), ...MANUAIS].map((h) => ({ ...h, soDoItem: true }));
writeFileSync(SAIDA, `${JSON.stringify({ _nota: 'As habilidades que só os únicos do PoE concedem, no formato de gemas-poe.json (soDoItem: não caem nem são vendidas). Gerado por tools/importar-habilidades-de-itens.mjs.', habilidades }, null, 1)}\n`);
console.log(`habilidades-de-itens.json: ${habilidades.length} habilidades (${Object.keys(APELIDOS).length} já existem com outro nome)`);
