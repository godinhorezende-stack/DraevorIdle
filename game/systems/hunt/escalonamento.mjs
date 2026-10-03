// ESCALONAMENTO da dificuldade pelos jogadores ATIVOS da instância compartilhada (party). Config em `ESCALONAMENTO`: nada de número solto.
//
// O bicho ganha VIDA e DANO por jogador a mais, por tipo (normal, modificado, raro, elite, único, boss). Quanto cada bicho "sente" os
// outros jogadores depende do modelo:
//   'setor' (padrão): conta inteiro quem está no MESMO setor do bicho e só `pesoDeFora` (35%) de quem está noutros — um grupo espalhado
//                     não deixa cada setor com a dificuldade de um grupo reunido. Chefe (boss/único) sente a party ativa INTEIRA.
//   'ativos'          : todos os ativos da instância, em qualquer setor, contam inteiros.
//   'total'           : o tamanho da party (online), esteja o jogador ativo ou não.
// O que muda é o POOL de vida (`maxHp`, mantendo a fração de vida atual: entrar ou sair gente nunca cura nem mata o bicho) e a força
// (`forca`). O valor-base fica guardado no bicho (`m.escalaDaParty`), então sair gente DESFAZ o escalonamento sem acumular.
// Sozinho (1 ativo), o fator é 1 e nada é tocado.
import { mapaDeSetores } from './setores.mjs';

export const ESCALONAMENTO = Object.freeze({
  ativo: true,
  modelo: 'setor',
  pesoDeFora: 0.35,
  atualizarMs: 1000,
  porJogador: Object.freeze({
    normal: Object.freeze({ vida: 0.3, dano: 0.1 }),
    modificado: Object.freeze({ vida: 0.3, dano: 0.1 }),
    raro: Object.freeze({ vida: 0.35, dano: 0.1 }),
    elite: Object.freeze({ vida: 0.4, dano: 0.12 }),
    unico: Object.freeze({ vida: 0.5, dano: 0.15 }),
    boss: Object.freeze({ vida: 0.5, dano: 0.15 }),
  }),
  teto: Object.freeze({ vida: 3, dano: 1.6 }),
});

/** O tipo de escalonamento do bicho (pela raridade; `boss`/`unico` também pelas marcas antigas). */
export const tipoDoBicho = (m) => (m.raridade && ESCALONAMENTO.porJogador[m.raridade] ? m.raridade : m.isBoss || m.boss ? 'boss' : 'normal');
const sentePartyInteira = (tipo) => tipo === 'boss' || tipo === 'unico';

/** Quantos jogadores o bicho "sente" (≥ 1). `noSetor`: ativos no setor dele; `ativos`: ativos na instância; `total`: party online. */
export function jogadoresQueOBichoSente({ modelo, tipo, noSetor, ativos, total, pesoDeFora }) {
  if (modelo === 'total') return Math.max(1, total);
  if (modelo === 'ativos' || sentePartyInteira(tipo)) return Math.max(1, ativos);
  return Math.max(1, noSetor + (ativos - noSetor) * pesoDeFora);
}

/** Os multiplicadores `{ vida, dano }` de um bicho que sente `n` jogadores. */
export function fatoresPara(tipo, n, cfg = ESCALONAMENTO) {
  const p = cfg.porJogador[tipo] ?? cfg.porJogador.normal;
  const extra = Math.max(0, n - 1);
  return { vida: Math.min(cfg.teto.vida, 1 + p.vida * extra), dano: Math.min(cfg.teto.dano, 1 + p.dano * extra) };
}

/** Reescala UM bicho para os fatores (guarda o base na primeira vez; fator 1 devolve ao base). */
export function reescalar(m, f) {
  const base = (m.escalaDaParty ??= { vida: 1, dano: 1, baseMaxHp: m.maxHp ?? m.hp, baseForca: m.forca ?? 1 });
  if (Math.abs(base.vida - f.vida) < 1e-9 && Math.abs(base.dano - f.dano) < 1e-9) return false;
  const fracao = m.maxHp > 0 ? m.hp / m.maxHp : 1;
  m.maxHp = Math.max(1, Math.round(base.baseMaxHp * f.vida));
  if (m.hp > 0) m.hp = Math.max(1, Math.min(m.maxHp, Math.round(fracao * m.maxHp)));
  m.forca = base.baseForca * f.dano;
  base.vida = f.vida;
  base.dano = f.dano;
  return true;
}

/**
 * Aplica o escalonamento em todos os bichos da sala. `jogadores`: `[{ x, y, z }]` dos ATIVOS na sala (online, vivos, não parados);
 * `totalDaParty`: quantos há na party; `grade`: a grade da hunt (para os setores). Devolve quantos bichos mudaram.
 * Chamado pelo dono da sala no máximo a cada `atualizarMs` do relógio da caçada.
 */
export function aplicarNaSala(sala, { jogadores, totalDaParty = jogadores.length, grade = null, cfg = ESCALONAMENTO }) {
  if (!cfg.ativo) return 0;
  const agora = sala.clock ?? 0;
  if (sala.escalonadoEm != null && agora - sala.escalonadoEm < cfg.atualizarMs) return 0;
  Object.defineProperty(sala, 'escalonadoEm', { value: agora, enumerable: false, writable: true, configurable: true });
  const bichos = [...sala.monstros, ...Object.values(sala.outrosAndares ?? {}).flat()];
  const ativos = jogadores.length;
  const mapa = grade && sala.instancia?.setores ? mapaDeSetores(grade.alcancaveis) : null;
  // Quantos ativos há em cada setor (uma vez por rodada).
  const porSetor = {};
  if (mapa) for (const j of jogadores) { const id = mapa.setorDe(j.x, j.y, j.z); if (id) porSetor[id] = (porSetor[id] ?? 0) + 1; }
  let mudou = 0;
  for (const m of bichos) {
    if (m.hp <= 0 && !m.escalaDaParty) continue;
    const tipo = tipoDoBicho(m);
    const n = ativos <= 1 && totalDaParty <= 1 ? 1 : jogadoresQueOBichoSente({ modelo: cfg.modelo, tipo, noSetor: porSetor[m.setor] ?? 0, ativos, total: totalDaParty, pesoDeFora: cfg.pesoDeFora });
    if (n === 1 && !m.escalaDaParty) continue; // sozinho e nunca escalonado: não toca
    if (reescalar(m, fatoresPara(tipo, n, cfg))) mudou++;
  }
  return mudou;
}
