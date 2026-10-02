// O impacto econômico dos encontros, em ouro de NPC por INSTÂNCIA da fase (a mesma conta do validador do editor).
//
//   node tools/impacto-economico.mjs                      → o valor de limpar cada fase (os 3 níveis de dificuldade)
//   node tools/impacto-economico.mjs <huntId> [facil]     → idem para uma fase, e os encontros que o mapa já tem
//
// Serve para o dono ajustar os tetos (`gamedata/encontros.json`, `limites.fracaoDaFase*`) olhando números reais.
import * as Campanha from '../game/systems/campanha.mjs';
import * as Eco from '../game/systems/encontros/economia.mjs';
import * as Modelo from '../game/systems/encontros/modelo.mjs';
import { CONFIG } from '../game/systems/encontros/config.mjs';
import { mapaRealCapturado } from '../game/systems/hunt/terreno.mjs';

const [huntId, dif = 'facil'] = process.argv.slice(2);
const n = (v) => Math.round(v).toLocaleString('pt-BR');

if (huntId) {
  const fase = Campanha.faseDe(huntId);
  if (!fase) throw new Error(`fase desconhecida: ${huntId}`);
  const encontros = Modelo.encontrosDoMapa(mapaRealCapturado(huntId));
  const r = Eco.impactoEconomico(huntId, encontros, dif);
  console.log(`${fase.nome} (${dif}): ${r.bichos} bichos por instância valem ~${n(r.valorDaFase)} de ouro de NPC`);
  console.log(`encontros: ~${n(r.valorDosEncontros)} por instância (${Math.round(r.fracao * 100)}% da fase; aviso > ${CONFIG.limites.fracaoDaFaseAviso * 100}%, teto ${CONFIG.limites.fracaoDaFaseErro * 100}%)`);
  for (const e of r.porEncontro) console.log(`  ${e.id} (${e.tipo}): ~${n(e.valor)}`);
} else {
  console.log('fase'.padEnd(34), ...Campanha.DIFICULDADES.map((d) => d.padStart(12)));
  for (const f of Campanha.FASES) {
    if (f.pular) continue;
    console.log(f.huntId.padEnd(34), ...Campanha.DIFICULDADES.map((d) => n(Eco.valorDaInstancia(f.huntId, d).valor).padStart(12)));
  }
  console.log('\n(ouro de NPC esperado por instância: bichos dos spawns × tabela de loot × preço do NPC, na escala da fase)');
}
