// Gera `game/gamedata/gemas.json` a partir do que o original mandou
// (Zoros e os outros personagens da conta, 2026-09-25,
// `api-mapeada/captura-gemas-0925/`): as views do Gem Atelier das 5 vocações e
// o `catalog.gemas` (o drop).
//
// Cada grau de cada modificador vem do original como texto ("+1,1% físico",
// "+300 vida", "-900s recarga de Avatar of Steel"). Aqui o texto vira também
// NÚMERO (`efeitos`), que é o que o servidor aplica na ficha — e o texto segue
// igual para a tela.
//
// Uso: node tools/gerar-gemas.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const RAIZ = new URL('../', import.meta.url);
const CAP = new URL('api-mapeada/captura-gemas-0925/', RAIZ);
const ler = (nome) => JSON.parse(readFileSync(new URL(nome, CAP), 'utf8'));

const VIEWS = { knight: ler('gemas-zoros.json').view };
for (const v of ['paladin', 'sorcerer', 'druid', 'monk']) VIEWS[v] = ler(`gemas-${v}.json`).view;
const catalogo = ler('hello-catalogo-0925.json');

const numero = (texto) => Number(texto.match(/^[+-]?[\d.]*\d(?:,\d+)?/)[0].replace(/\./g, '').replace(',', '.'));

/** O efeito de uma parte do texto de um grau. */
function efeitoDaParte(parte, mod) {
  const t = parte.texto;
  const v = numero(t);
  const magia = mod.tipo === 'supremo' && String(mod.id).startsWith('spell-') ? String(mod.id).split(':')[0] : null;
  const el = parte.icone?.startsWith('el-') ? parte.icone.slice(3) : null;
  if (el) return { tipo: 'resistencia', elemento: el, v };
  switch (parte.icone) {
    case 'ficha-defesa': return { tipo: 'mitigacao', v: -v }; // "-2% dano recebido" → corta 2%
    case 'bar-hp': return { tipo: 'vida', v };
    case 'bar-mana': return { tipo: 'mana', v };
    case 'ficha-capacidade': return { tipo: 'capacidade', v };
    case 'ficha-bloqueio': return { tipo: 'esquiva', v };
    case 'ficha-life-leech': return { tipo: 'lifeLeech', v };
    case 'ficha-mana-leech': return { tipo: 'manaLeech', v };
    case 'ficha-critico': return magia ? { tipo: 'criticoDaMagia', magia, v } : { tipo: 'critico', v };
    case 'ficha-dano': return { tipo: 'danoDaMagia', magia, v };
    case 'ficha-regen-vida': return { tipo: 'curaDaMagia', magia, v };
    case 'ficha-tempo': {
      const momentum = t.match(/\+([\d,]+)% momentum/);
      return { tipo: 'recargaDaMagia', magia, segundos: -v, momentum: momentum ? Number(momentum[1].replace(',', '.')) : 0 };
    }
    default: throw new Error(`parte sem regra: ${JSON.stringify(parte)} de ${mod.id}`);
  }
}

const modDe = (m) => ({
  tipo: m.tipo,
  id: m.id,
  icone: m.icone,
  nome: m.nome,
  porGrau: m.porGrau,
  efeitos: m.porGrau.map((partes) => partes.map((p) => efeitoDaParte(p, m))),
});

const base = VIEWS.knight;
const saida = {
  _fonte: 'ravoxidle.com.br, views do Gem Atelier das 5 vocações + catalog.gemas (2026-09-25); ver tools/gerar-gemas.mjs',
  levelMinimo: Number((VIEWS.sorcerer.motivo ?? '').match(/\d+/)?.[0] ?? 51),
  cores: base.folha.cores,
  vocacoes: base.folha.vocacoes,
  marcas: base.marcas,
  nomesDosVessels: base.vessels.nomes,
  itensDosFragmentos: base.itensDosFragmentos,
  precos: base.precos,
  // O item fechado de cada vocação, por qualidade.
  fechadas: Object.fromEntries(Object.entries(VIEWS).map(([voc, v]) => [voc, Object.fromEntries(Object.entries(v.fechadas).map(([q, f]) => [q, f.itemId]))])),
  // Os mesmos 42 nas 5 vocações, mas vida, mana e capacidade mudam com ela
  // (knight: +300 vida; sorcerer: +100 vida e +600 mana — como no Tibia).
  basicos: Object.fromEntries(Object.entries(VIEWS).map(([voc, v]) => [voc, v.oficina.basicos.map(modDe)])),
  supremos: Object.fromEntries(Object.entries(VIEWS).map(([voc, v]) => [voc, v.oficina.supremos.map(modDe)])),
  drop: catalogo.gemas,
};
writeFileSync(new URL('game/gamedata/gemas.json', RAIZ), JSON.stringify(saida, null, 1));
console.log(`gemas.json: ${saida.basicos.knight.length} básicos por vocação, supremos ${Object.entries(saida.supremos).map(([k, s]) => `${k} ${s.length}`).join(', ')}, level ${saida.levelMinimo}`);
