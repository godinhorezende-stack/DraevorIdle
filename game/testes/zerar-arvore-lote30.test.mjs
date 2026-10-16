// ZERAR A ÁRVORE — LOTE 30 (dono, 15/10: "zerar as pendências da árvore passiva do PoE"; a auditoria em docs/arvore-poe-auditoria.md): as
// regras e contas que estavam erradas — P007 a Precisão da Destreza (somava +3 em cima dos 2), P016/P076 "X% mais Dano de Caos/Gelo" (era o
// golpe inteiro), P017 "Debuffs em você expiram X% mais rápido" (era −X% de duração só nas afecções), P006 "menos Dano Físico Sofrido"
// (era redução física, aditiva com a armadura), P027 o Vento Favorável (8% de Velocidade de Ação), P029 a Parada Cardíaca (as duas partes se
// alternam; "menos Dano de Acertos" só nos acertos) — e as que já eram a conta do PoE (P050 a Guarda do Vento, P054 o "+% de Chance de
// Crítico" nos pontos base).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Atributos = await import('../systems/personagem/atributos.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Poderes = await import('../systems/poderes.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
function personagem(af = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.sistema = 'poe';
  e.classePoe = 'Duelist';
  const arma = peca('One_Hand_Swords/Rusted_Sword');
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  P.garantir(e);
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const traduzir = (modelo, valores) => T.traduzirMod({ modelo, valores });

test('P007 — a PRECISÃO da Destreza: com a linha, 3 por ponto (no lugar dos 2), não 2 + 3', { skip: SEM }, () => {
  assert.deepEqual(traduzir('Bônus de Precisão da Destreza concede +{0} de Precisão por Destreza', [3]).efeitos, [{ stat: 'precisao_por_dex', valor: 3 }]);
  const p = { str: 0, dex: 100, int: 0 };
  assert.equal(Atributos.efeitos(p, {}).precisao, 200);
  assert.equal(Atributos.efeitos(p, { precisao_por_dex: 3 }).precisao, 300, 'era 500 (2 da Destreza + 3 da linha)');
  // (na ficha: a Precisão FIXA da Destreza sobe 1 por ponto — a final é ela × a Precisão aumentada)
  const sem = personagem();
  const com = personagem({ precisao_por_dex: 3 });
  const pr = Atributos.principais(com, Afixos.soma(com));
  assert.equal(Atributos.efeitos(pr, ficha(com).afPoe).precisao - Atributos.efeitos(pr, ficha(sem).afPoe).precisao, Math.floor(pr.dex));
  assert.ok(ficha(com).accuracy > ficha(sem).accuracy);
});

test('P016/P076 — "X% mais Dano de Caos": só a parte de Caos do golpe; com a condição do alvo (o Escudo de Energia dele)', { skip: SEM }, () => {
  assert.deepEqual(traduzir('{0}% mais Dano de Caos', [10]).efeitos, [{ stat: 'mais_dano_caos', valor: 10 }]);
  assert.deepEqual(traduzir('{0}% mais Dano de Gelo', [15]).efeitos, [{ stat: 'mais_dano_gelo', valor: 15 }]);
  const alvo = { estados: {} };
  const f = { afPoe: { mais_dano_caos: 10 } };
  assert.equal(C.fatorRecebidoPeloBicho(alvo, 'chaos', f, 0), 1.1);
  assert.equal(C.fatorRecebidoPeloBicho(alvo, 'physical', f, 0), 1, 'o Físico do mesmo golpe não ganha');
  assert.equal(C.fatorRecebidoPeloBicho(alvo, 'ice', { afPoe: { mais_dano_gelo: 15 } }, 0), 1.15);
  // (a Maestria de Caos: "Causa 10% mais Dano de Caos aos inimigos que tiverem Escudo de Energia")
  const e = personagem({ 'mais_dano_caos@alvoComEscudo': 10 });
  const comEscudo = { uid: 'a', hp: 100, maxHp: 100, estados: {}, esPoe: { atual: 50, max: 50 } };
  const semEscudo = { uid: 'b', hp: 100, maxHp: 100, estados: {} };
  const g1 = C.fichaDoGolpe(ficha(e), ['ataque', 'caos'], { alvo: comEscudo, estado: e });
  const g2 = C.fichaDoGolpe(ficha(e), ['ataque', 'caos'], { alvo: semEscudo, estado: e });
  assert.equal(C.fatorRecebidoPeloBicho(comEscudo, 'chaos', g1, 0), 1.1);
  assert.equal(C.fatorRecebidoPeloBicho(semEscudo, 'chaos', g2, 0), 1);
  assert.equal(C.fatorRecebidoPeloBicho(comEscudo, 'physical', g1, 0), 1);
  assert.equal(g1.fatorDasCargas ?? 1, ficha(e).fatorDasCargas ?? 1, 'o golpe inteiro não é mais multiplicado');
});

test('P017 — "Debuffs em você expiram X% mais rápido": a duração ÷ (1 + X%) nas afecções, nas maldições e nos debuffs; o Atordoamento não', { skip: SEM }, () => {
  assert.deepEqual(traduzir('Debuffs em você expiram {0}% mais rápido', [15]).efeitos, [{ stat: 'debuffs_expiram_rapido', valor: 15 }]);
  assert.equal(C.fatorDosDebuffs({ debuffs_expiram_rapido: 15 }), 1 / 1.15);
  assert.equal(C.fatorDosDebuffs({}), 1);
  const sem = { afPoe: {} };
  const com = { afPoe: { debuffs_expiram_rapido: 15 } };
  const lento = (f) => C.controleNoJogador(f, 'lento', () => 0.99).duracaoFator;
  assert.ok(Math.abs(lento(com) - lento(sem) / 1.15) < 1e-9, `${lento(com)} ~ ${lento(sem) / 1.15}`);
  const atordoado = (f) => C.controleNoJogador(f, 'atordoado', () => 0.99).duracaoFator;
  assert.equal(atordoado(com), atordoado(sem), 'o Atordoamento não é debuff');
  // (a maldição do monstro em você)
  const amaldicoar = (af) => {
    const hunt = { clock: 1000 };
    C.definirFichaDaCacada(hunt, () => ({ afPoe: af }));
    C.amaldicoarJogador(hunt, 'x', { nome: 'X', af: { fire_res: -10 } }, 1000);
    return hunt.maldicoesNoJogador.x.ate - 1000;
  };
  assert.equal(amaldicoar({}), C.DURACAO_DA_MALDICAO_DO_MONSTRO_MS);
  assert.equal(amaldicoar({ debuffs_expiram_rapido: 15 }), Math.round(C.DURACAO_DA_MALDICAO_DO_MONSTRO_MS / 1.15));
});

test('P006 — "X% menos Dano Físico Sofrido enquanto em Escudo de Energia Cheio": multiplicativo, só no Físico; P050 e P054 já eram o PoE', { skip: SEM }, () => {
  assert.deepEqual(traduzir('{0}% menos Dano Físico Sofrido enquanto em Escudo de Energia Cheio', [10]).efeitos, [{ stat: 'dano_physical_recebido_mais@escudoCheio', valor: -10 }]);
  const f = { afPoe: { dano_physical_recebido_mais: -10 } };
  assert.equal(C.fatorDoDanoRecebido(f, 'physical'), 0.9);
  assert.equal(C.fatorDoDanoRecebido(f, 'fire'), 1);
  // (os outros tipos também têm o "mais/menos" deles)
  assert.equal(C.fatorDoDanoRecebido({ afPoe: { dano_fire_recebido_mais: -20 } }, 'fire'), 0.8);
  // (P054: "+X% de Chance de Crítico" soma nos pontos base, antes do aumentado — a conta do PoE)
  const sem = ficha(personagem({ crit_chance_inc: 100 }));
  const com = ficha(personagem({ crit_chance_inc: 100, crit_chance: 0.75 }));
  assert.ok(Math.abs((com.critPontos - sem.critPontos) - 0.0075) < 1e-9);
  assert.ok(Math.abs((com.critChance - sem.critChance) - 0.0075 * 2) < 1e-9, 'o +0,75 também é dobrado pelo 100% aumentado');
  assert.equal(traduzir('+{0}% de Chance de Golpe Crítico', [0.75]).estado, 'equivalente');
});

test('P027 — o VENTO FAVORÁVEL: 8% de Velocidade de Ação (o lembrete do nó)', { skip: SEM }, () => {
  assert.deepEqual(C.BUFFS.ventoFavoravel.af, { action_speed: 8 });
  assert.equal(Ficha.fatorDeAcao({ action_speed: 8 }), 1.08);
});

test('P029 — a PARADA CARDÍACA: a cada 10 s, 5 s de menos dano de Acertos e DEPOIS 5 s de menos Degenerativo (consecutivamente)', { skip: SEM }, () => {
  const acerto = traduzir('Sofre {0}% menos Dano de Acertos por {1} segundos', [50, 5]).efeitos[0];
  const degen = traduzir('Sofre {0}% menos Dano Degenerativo por {1} segundos', [50, 5]).efeitos[0];
  assert.deepEqual([acerto.stat, degen.stat], ['periodico:10:stat:menos_dano_acertos:5', 'periodico:10d5:stat:dano_degen_recebido_menos:5']);
  const e = personagem();
  const hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [] };
  e.hunt = hunt;
  const f = { afPoe: { [acerto.stat]: 50, [degen.stat]: 50 } };
  const ativos = (t) => Object.entries(hunt.poeBonusPorTempo ?? {}).filter(([, b]) => b.ate > t).map(([k]) => k).sort();
  for (let t = 0; t <= 26000; t += 500) {
    hunt.clock = t;
    ModsPoe.aurasProximas(e, hunt, f, t);
    if (t === 12000) assert.deepEqual(ativos(t), ['menos_dano_acertos']);
    if (t === 17000) assert.deepEqual(ativos(t), ['dano_degen_recebido_menos']);
    if (t === 22000) assert.deepEqual(ativos(t), ['menos_dano_acertos']);
  }
});

test('P029 — "menos Dano de Acertos" só nos acertos: o dano de mecânica/contínuo em você não muda', { skip: SEM }, () => {
  const sem = personagem();
  const com = personagem({ menos_dano_acertos: 50 });
  for (const e of [sem, com]) assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const bicho = { uid: 'm', name: 'M', key: sem.hunt.monstros[0]?.key ?? 'x' };
  const mecanica = (e) => { e.hp = e.maxHp = 100000; e.es = 0; Poderes.danoDeElementoNoJogador(e, e.hunt, PERSONAGEM, bicho, 1000, 'fire', [], 'Aura', ficha(e), false); return 100000 - e.hp; };
  assert.equal(mecanica(com), mecanica(sem));
});
