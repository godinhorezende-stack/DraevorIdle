// Gera assets_raw/gamedata/tarefas.json — as definições FIXAS das tarefas, tiradas
// do original (Zoros, 2026-09-26, api-mapeada/captura-tarefas-0926/):
// - tasks de bicho: a lista de 322 (chave, level, boss, semSala), as escadas e as faixas;
// - tasks de montaria: alvo por criatura, Task Token e a montaria;
// - entregas (outfits e montarias): os itens pedidos, de quem caem e o ouro;
// - e o calendário da Recompensa Diária (gamedata/diario.json).
// Tudo o que é do PERSONAGEM (mortes, entregue, feita...) fica de fora: é o
// servidor quem calcula (sistemas/tarefas.mjs e sistemas/entregas.mjs).
//
// Uso: node tools/gerar-tarefas.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
const ler = (p) => JSON.parse(readFileSync(new URL(p, raiz), 'utf8'));
const CAP = 'api-mapeada/captura-tarefas-0926/';

const ficha = ler(CAP + 'tasksDeBicho-zoros.json').ficha;
const w = ler(CAP + 'welcome-zoros.json').character;

const saida = {
  fonte: 'original — Zoros, 2026-09-26 (tasksDeBicho, welcome: mountTasks e entregas)',
  escada: ficha.escada,
  escadaDeBoss: ficha.escadaDeBoss,
  teto: ficha.teto,
  faixas: ficha.faixas,
  bichos: ficha.bichos.map((b) => ({ key: b.key, level: b.level, ...(b.boss ? { boss: true } : {}), ...(b.semSala ? { semSala: true } : {}) })),
  mountTasks: w.mountTasks.map(({ feito, alvos, ...t }) => ({ ...t, alvos: alvos.map(({ kills, ...a }) => a) })),
  entregas: w.entregas.map(({ temOuro, ouroEntregue, pronta, podeAdiantar, adiantada, feita, indisponivel, itens, ...e }) => ({
    ...e,
    itens: itens.map(({ tem, entregue, falta, ...i }) => i),
  })),
};
writeFileSync(new URL('assets_raw/gamedata/tarefas.json', raiz), JSON.stringify(saida));

// O calendário da Recompensa Diária (os 30 dias do original; `pego`/`aVez` são do personagem).
const diario = w.diario.dias.map(({ pego, aVez, ...d }) => d);
writeFileSync(new URL('assets_raw/gamedata/diario.json', raiz), JSON.stringify({ fonte: saida.fonte, dias: diario }));
console.log('bichos', saida.bichos.length, 'mountTasks', saida.mountTasks.length, 'entregas', saida.entregas.length);
