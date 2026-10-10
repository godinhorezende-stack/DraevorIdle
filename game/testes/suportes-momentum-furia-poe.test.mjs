// Os suportes MOMENTUM e FÚRIA do PoE com a velocidade CONDICIONAL (auditoria da velocidade de ataque, 10/10 — "faça o Momentum e a Fúria
// condicionais"), numa caçada de verdade (`Cacadas.entrar` + `Cacadas.tique`):
//  - Momentum: +1 a cada uso, "N% de Velocidade de Ataque por Momentum", perde tudo ao se mover, e ao chegar no máximo perde tudo e ganha
//    Rapidez (velocidade de movimento por Momentum perdido). Antes o suporte não fazia NADA: ficava travado como "sem sistema" por citar a
//    canalização (um outro jeito de ganhar Momentum, que o jogo não tem);
//  - Fúria: "N% enquanto você tiver ao menos 10 de Fúria" e "Ganhe 3 de Fúria no Acerto com Ataques". Antes os 14% valiam sempre e a Fúria
//    do suporte não vinha;
//  - os números da tabela do poedb no lugar certo do texto (a célula pode vir em outra ordem, ou com menos números que o texto).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const GP = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

/** Um Duelista com a Rusted Sword (645 ms) e a Cutilada (80%: 806 ms) ligada ao `suporte` (nível 10), no slot 1 da barra. */
function montar(suporte) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), { classePoe: 'Duelist' });
  const arma = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'One_Hand_Swords/Rusted_Sword', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  arma.soquetes = { abertos: 2, links: [true], gemas: [null, null], cores: ['W', 'W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  delete e.equipment.shield;
  e.inventory = [GS.itemDaGema({ id: GP.doSlug('Cleave').itemId, nivel: 10, xp: 0, raridade: 'comum' }), GS.itemDaGema({ id: SP.doSlug(suporte).itemId, nivel: 10, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 1 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GP.doSlug('Cleave').acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  return e;
}
const entry = () => Acoes.POR_ID_PUBLICO(GP.doSlug('Cleave').acao);
const SEM_NADA = Math.round(Math.round(1000 / 1.55) / 0.8); // 806
/** `tiques` de caçada contra um alvo imortal (colado, ou a `distancia` casas). Cada uso da Cutilada: o tempo dele e o Momentum depois. */
// (Um relógio só, sempre para a frente, em todas as caçadas do arquivo: recomeçar do `Date.now()` voltava o tempo da caçada.)
let relogio = Date.now();
function cacar(e, tiques, { distancia = 1, antes = null } = {}) {
  const usos = [];
  let ultimo = null;
  for (let i = 0; i < tiques; i++) {
    const h = e.hunt;
    h.monstros = h.monstros.slice(0, 1);
    Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + distancia, y: h.pos.y });
    h.alvo = h.monstros[0].uid;
    Object.assign(e, { hp: e.maxHp, mana: 1e6, maxMana: 1e6 });
    antes?.(e);
    Cacadas.tique(e, PERSONAGEM, (relogio += 250));
    const g = h.cooldowns?.[Acoes.GRUPO_DO_POE];
    if (g && g !== ultimo && !g.basico) usos.push({ total: g.total, momentum: h.momentum?.n ?? 0 });
    ultimo = g;
  }
  return usos;
}

test('a tabela do poedb no lugar certo do texto: o Momentum, o Trauma e o Intensificar no nível 10', { skip: SEM }, () => {
  const mods = (slug) => SP.textosDoNivel(SP.doSlug(slug).suporte, 10).mods.join(' | ');
  // A célula "1.5, 4" é "Rapidez por 1.5 segundos" e "Ao atingir 4" (o texto tem os dois na outra ordem); "0.61" é o "a cada 0.61 segundos".
  assert.match(mods('Momentum_Support'), /^Ganhe 1 de Momentum quando você Usar uma Habilidade Suportada Ganhe 1 de Momentum a cada 0\.61 segundos/);
  assert.match(mods('Momentum_Support'), /Ao atingir 4 de Momentum, perca todo o Momentum e ganhe Rapidez por 1\.5 segundos/);
  assert.match(mods('Trauma_Support'), /Ganha 1 Traumatismo na primeira vez .* Sofre 52 de Dano Físico .* Traumatismos duram 5\.9 segundos/);
  assert.match(mods('Intensify_Support'), /máximo de 3 Habilidades Suportadas causam 14% mais Dano em Área/);
});

test('Momentum: +1 por uso e 17% de velocidade por Momentum; no 4º perde tudo e ganha Rapidez (60% de movimento); ao andar, perde tudo', { skip: SEM }, () => {
  assert.equal(SP.doSlug('Momentum_Support').status, 'funciona', 'antes: "sem sistema"');
  const e = montar('Momentum_Support');
  const ef = GS.efeitoNaSkill(e, GP.doSlug('Cleave').acao);
  assert.deepEqual([ef.momentumPorUso, ef.velAtaquePorMomentumPct, ef.momentumMaximo, ef.rapidezMs, ef.rapidezMovimentoPct], [1, 17, 4, 1500, 15]);
  // Parado (alvo colado): o ciclo 0, 1, 2, 3 de Momentum — 806, 806/1,17, 806/1,34, 806/1,51 — e volta.
  const ciclo = [0, 1, 2, 3].map((m) => Math.round(Math.round(1000 / 1.55) / 0.8 / (1 + (17 * m) / 100)));
  let rapidez = null;
  const usos = cacar(e, 60, { antes: (x) => { if (x.hunt.poeBuffs?.rapidez > (x.hunt.clock ?? 0) && !rapidez) rapidez = { pct: x.hunt.rapidez?.movimentoPct, velocidade: Ficha.combate(x).speed }; } });
  const tempos = usos.slice(0, 8).map((u) => u.total);
  for (let i = 0; i < tempos.length; i++) assert.ok(Math.abs(tempos[i] - ciclo[i % 4]) <= 1, `uso ${i}: ${tempos.join(', ')} (o ciclo ${ciclo.join(', ')})`);
  assert.ok(rapidez, 'ganhou Rapidez ao chegar em 4');
  assert.equal(rapidez.pct, 60, '15% × 4 de Momentum perdido');
  // A Rapidez soma na velocidade de movimento da ficha.
  e.hunt.poeBuffs = { ...(e.hunt.poeBuffs ?? {}), rapidez: (e.hunt.clock ?? 0) + 10_000 };
  e.hunt.rapidez = { movimentoPct: 60 };
  Ficha.invalidar(e);
  const comRapidez = Ficha.combate(e).speed;
  delete e.hunt.poeBuffs.rapidez;
  Ficha.invalidar(e);
  assert.ok(comRapidez > Ficha.combate(e).speed, `com Rapidez ${comRapidez} > sem ${Ficha.combate(e).speed}`);
  // Andar zera: com 3 de Momentum, o primeiro passo (o andar do teclado, numa direção andável) leva tudo — e a Cutilada volta a 806 ms.
  e.hunt.momentum = { n: 3 };
  const pos = { ...e.hunt.pos };
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (e.hunt.pos.x !== pos.x || e.hunt.pos.y !== pos.y) break;
    e.hunt.momentum = { n: 3 };
    Cacadas.andar(e, { dx, dy });
    e.hunt.rumoValidoAte = relogio + 1000; // (o rumo do teclado vale meio segundo — no relógio da caçada)
    cacar(e, 2, { distancia: 6 });
  }
  assert.notDeepEqual({ x: e.hunt.pos.x, y: e.hunt.pos.y }, { x: pos.x, y: pos.y }, 'andou');
  assert.equal(ModsPoe.momentumAtual(e), 0, 'perdeu todo o Momentum ao se mover');
  assert.equal(Acoes.temposDaGemaPoe(e, entry()).uso, SEM_NADA);
});

test('Fúria: os 14% só com pelo menos 10 de Fúria (antes, sempre); e o acerto do ataque suportado dá 3 de Fúria', { skip: SEM }, () => {
  assert.equal(SP.doSlug('Rage_Support').status, 'funciona', 'antes: parcial ("Ganhe 3 de Fúria" não simulado)');
  const e = montar('Rage_Support');
  const uso = () => Acoes.temposDaGemaPoe(e, entry()).uso;
  e.hunt.furia = { n: 0, ganhou: e.hunt.clock ?? 0, perdeu: e.hunt.clock ?? 0 };
  assert.equal(uso(), SEM_NADA, 'sem Fúria: 806 ms');
  e.hunt.furia.n = 9;
  assert.equal(uso(), SEM_NADA, 'com 9: ainda 806');
  e.hunt.furia.n = 10;
  assert.equal(uso(), Math.round(Math.round(1000 / 1.55) / 0.8 / 1.14), 'com 10: 14% mais rápida');
  // Na caçada: a Fúria sobe de 3 em 3 a cada acerto da Cutilada, e a partir do 4º acerto (12 de Fúria) os usos ficam 14% mais rápidos.
  const f = montar('Rage_Support');
  const furias = [];
  const usos = cacar(f, 24, { antes: (x) => furias.push(ModsPoe.furiaAtual(x)) });
  const subidas = furias.slice(1).map((v, i) => v - furias[i]).filter((d) => d > 0);
  assert.ok(subidas.length >= 3 && subidas.every((d) => d === 3), `a Fúria sobe 3 por acerto: ${furias.join(',')}`);
  assert.equal(usos[0].total, SEM_NADA, 'o 1º uso, sem Fúria');
  assert.ok(usos.slice(4).every((u) => u.total === Math.round(Math.round(1000 / 1.55) / 0.8 / 1.14)), `com 10+ de Fúria: ${usos.map((u) => u.total).join(', ')}`);
});
