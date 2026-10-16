// ZERAR A ÁRVORE — LOTE 33 (dono, 16/10: "ok, siga"; a auditoria em docs/arvore-poe-auditoria.md): os primeiros sistemas B — P009 o "Efeito
// de Afecções Não-Danificadoras" também no Causticar, Fragilizar e Exaurir; P013/P021/P030/P052 as rampas de distância do Path of Building
// (DistanceRamp: 35 → 70 unidades; 1 casa = 2 m = 20 unidades, a decisão do dono); P045 a proximidade do corpo a corpo (MeleeProximity: o
// máximo até 15 unidades, 0 em 40); P015/P055 o Elusivo que perde 20% de efeito por segundo (o poedb) e não se ganha de novo enquanto há um.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const C = await import('../systems/itens-poe/condicoes-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');

const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));
function personagem(af = {}, base = 'Bows/Crude_Bow') {
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.sistema = 'poe';
  e.classePoe = 'Ranger';
  const arma = peca(base);
  arma.poe.af = { ...(arma.poe.af ?? {}), ...af };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  delete e.equipment.shield;
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  P.garantir(e);
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  return e;
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const traduzir = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const bicho = (x, extra = {}) => ({ uid: `b${x}`, x, y: 0, hp: 1e6, maxHp: 1e6, estados: {}, ...extra });

test('as linhas do lote 33 com efeito', { skip: SEM }, () => {
  for (const [modelo, v] of [
    ['Efeito de Afecções Não-Danificadoras aumentado em {0}%', [10]],
    ['Flechas ganham Chance de Golpe Crítico enquanto viajam adiante, máximo de até {0}% de Chance de Golpe Crítico', [100]],
    ['Projéteis causam Dano com Acertos aumentado em {0}% aos alvos no início de seu movimento, reduzido para {1}% na medida em que viajam adiante', [40, 0]],
    ['Projéteis ganham Dano ao viajar adiante, causando até {0}% mais Dano com Acertos e Afecções', [30]],
    ['Causa até {0}% mais Dano Corpo a Corpo aos Inimigos, baseado na proximidade', [15]],
    ['{0}% de chance de ganhar Elusivo no Golpe Crítico', [10]],
    ['{0}% de chance de ganhar Elusivo ao Bloquear enquanto em Empunhadura Dupla', [20]],
  ]) assert.ok(['novo', 'equivalente'].includes(traduzir(modelo, v).estado), modelo);
  assert.deepEqual(traduzir('Efeito de Afecções Não-Danificadoras aumentado em {0}%', [10]).efeitos.map((e) => e.stat).sort(), ['efeito_eletrizacao', 'efeito_nao_dano', 'efeito_resfriamento']);
  assert.deepEqual(traduzir('Acertos dos Ataques de Projéteis causam até {0}% mais Dano aos alvos no inicio de seu movimento, causando menos Dano aos alvos na medida em que o projétil viaja adiante', [30]).efeitos, [{ stat: 'queima_roupa', valor: 1 }], 'a keystone Queima-Roupa');
  assert.deepEqual(traduzir('Causa até {0}% mais Dano Corpo a Corpo aos Inimigos, baseado na proximidade', [15]).efeitos, [{ stat: 'mais_dano_proximidade', valor: 15 }]);
});

test('P009 — "Efeito de Afecções Não-Danificadoras aumentado": também o Causticar, o Fragilizar e o Exaurir que você inflige', { skip: SEM }, () => {
  const agora = 10000;
  const f = (af) => ({ afPoe: { bloqueio_causticar: 1, bloqueio_enfraquecer: 1, bloqueio_exaurir: 1, ...af } });
  const pcts = (af) => { const b = bicho(1); C.aoBloquear({ clock: agora }, b, f(af), { agora }); return [b.estados.causticado.pct, b.estados.fragilizado.pct, b.estados.exaurido.pct]; };
  assert.deepEqual(pcts({}), [10, 6, 10]);
  assert.deepEqual(pcts({ efeito_nao_dano: 50 }), [15, 9, 15]);
  // pela chance no acerto ("X% de chance de Exaurir Inimigos") e pela aura ("Inimigos Próximos são Causticados")
  const e = personagem({ efeito_nao_dano: 50, 'ev:acertar:alvo:exaurido': 100 });
  const alvo = bicho(1);
  ModsPoe.evento(e, e.hunt, 'acertar', ficha(e), { alvo, rng: () => 0 });
  assert.equal(alvo.estados.exaurido.pct, 15);
  const a = personagem({ efeito_nao_dano: 50, 'aura_proximos:causticado': 1 });
  const perto = bicho(1);
  a.hunt.monstros = [perto];
  ModsPoe.aurasProximas(a, a.hunt, ficha(a));
  assert.equal(perto.estados.causticado.pct, 15);
  // a Causticação do Warden (pelo dano de Fogo): × o efeito, no teto de 30%
  const queima = (efeitoNaoDano) => { const m = bicho(1, { maxHp: 1000, hp: 1000 }); AfeccoesPoe.aoAcertar(m, [{ elemento: 'fire', dano: 100 }], { afeccoes: { ...AfeccoesPoe.daSoma({}), incendioViraCausticacao: true, chance: { incendio: 100 }, efeitoNaoDano }, agora, rng: () => 0 }); return m.estados.causticado?.pct ?? 0; };
  const base = queima(0);
  assert.ok(base > 0 && base < 30, `base ${base}`);
  assert.ok(Math.abs(queima(50) - Math.min(30, base * 1.5)) <= 0.1, `${queima(50)} × ${base}`);
  assert.equal(queima(1000), 30, 'no teto');
});

test('P013/P021/P030/P052 — as rampas do PoB (35 → 70 unidades; 1 casa = 20): "ganham conforme viajam" e "no início do movimento"', { skip: SEM }, () => {
  const e = personagem({ projetil_longe_inc: 60, projetil_perto_dmg_inc: 40, projetil_longe_mais: 30 });
  const f = ficha(e);
  const no = (casas) => C.projetilNoAlvo(f, ['ataque', 'projetil', 'arco'], bicho(casas), e);
  // a 1 casa (20 unidades): o "início" inteiro, nada do "viajam"; a 2 (40): 1/7 do caminho; a 3 (60): 5/7; a 4 (80) em diante: tudo
  const perto = (u) => (u <= 35 ? 1 : u >= 70 ? 0 : 1 - (u - 35) / 35);
  for (const casas of [1, 2, 3, 4, 6]) {
    const u = casas * 20;
    const viajando = 1 - perto(u);
    const r = no(casas);
    assert.ok(Math.abs(r.incPct - (40 * perto(u) + 60 * viajando)) < 1e-9, `${casas} casas: ${r.incPct}`);
    assert.ok(Math.abs(r.mais - (1 + (30 * viajando) / 100)) < 1e-9, `${casas} casas: ${r.mais}`);
  }
  // o crítico das flechas ("até 100%"): nada colado, tudo de 4 casas em diante
  const comCrit = personagem({ flecha_longe_crit_inc: 100 });
  const sem = personagem();
  const crit = (x, casas) => C.fichaDoGolpe(ficha(x), ['ataque', 'projetil', 'arco'], { alvo: bicho(casas), estado: x }).critChance;
  assert.equal(crit(comCrit, 1), crit(sem, 1));
  assert.ok(crit(comCrit, 2) > crit(sem, 2) && crit(comCrit, 2) < crit(comCrit, 4));
  assert.equal(crit(comCrit, 4), crit(comCrit, 6));
});

test('P045 — o Impacto ("até 15% mais Dano Corpo a Corpo baseado na proximidade"): o MeleeProximity do PoB — o máximo até 15 unidades, 0 em 40', { skip: SEM }, () => {
  assert.deepEqual([0, 15, 16, 20, 39, 40, 60].map((u) => Math.round(C.proximidadeCorpoACorpo(u) * 1000) / 1000), [1, 1, 0.96, 0.8, 0.04, 0, 0]);
  const e = personagem({}, 'One_Hand_Swords/Rusted_Sword');
  const f = { afPoe: { mais_dano_proximidade: 15 } };
  assert.ok(Math.abs(C.maisPelaProximidade(f, ['ataque', 'corpo'], bicho(1), e) - 1.12) < 1e-9, 'o vizinho colado: 20 unidades, 80% de 15%');
  assert.equal(C.maisPelaProximidade(f, ['ataque', 'corpo'], bicho(2), e), 1, 'a 2 casas: 40 unidades');
  assert.equal(C.maisPelaProximidade(f, ['ataque', 'projetil'], bicho(1), e), 1, 'não corpo a corpo');
  // no golpe básico (a ficha do golpe com o alvo)
  const s = personagem({ mais_dano_proximidade: 15 }, 'One_Hand_Swords/Rusted_Sword');
  const g = C.fichaDoGolpe(ficha(s), ['ataque', 'corpo'], { alvo: bicho(1), estado: s });
  const g0 = C.fichaDoGolpe(ficha(personagem({}, 'One_Hand_Swords/Rusted_Sword')), ['ataque', 'corpo'], { alvo: bicho(1), estado: s });
  assert.ok(Math.abs((g.fatorDasCargas ?? 1) / (g0.fatorDasCargas ?? 1) - 1.12) < 1e-9);
});

test('P015/P055 — o Elusivo: começa no efeito cheio (com o aumentado), perde 20 pontos por segundo e sai em 0%; não se ganha outro enquanto há um', { skip: SEM }, () => {
  const e = personagem({ 'efeito_buff:elusivo': 50 });
  const h = e.hunt;
  ModsPoe.definirFichaDaCacada(h, () => ficha(e));
  const t0 = h.clock;
  ModsPoe.ganharBuff(h, 'elusivo', 4, t0);
  assert.equal(h.poeBuffs.elusivo, t0 + 7500, '150% de efeito ÷ 20 por segundo = 7,5 s (não os 4 s da linha)');
  assert.equal(C.efeitoDoElusivo(h, t0), 150);
  assert.equal(C.efeitoDoElusivo(h, t0 + 2500), 100);
  // a Esquiva e o Movimento do buff, pelo efeito de agora
  const soma = (agora) => { h.clock = agora; return Afixos.soma(e); };
  const cheio = soma(t0);
  const depois = soma(t0 + 5000);
  assert.ok(Math.abs((cheio.avoid_damage ?? 0) - (depois.avoid_damage ?? 0) - 15 * (150 - 50) / 100) < 1e-9, `${cheio.avoid_damage} → ${depois.avoid_damage}`);
  // não se ganha outro enquanto há um; acabou, ganha de novo
  ModsPoe.ganharBuff(h, 'elusivo', 4, t0 + 3000);
  assert.equal(h.poeBuffs.elusivo, t0 + 7500);
  ModsPoe.ganharBuff(h, 'elusivo', 4, t0 + 8000);
  assert.equal(h.poeBuffs.elusivo, t0 + 8000 + 7500);
  // o efeito da Lâmina Noturna entra no efeito inicial
  const n = personagem();
  ModsPoe.definirFichaDaCacada(n.hunt, () => ficha(n));
  ModsPoe.ganharBuff(n.hunt, 'elusivo', 4, n.hunt.clock, { efeitoExtra: 40 });
  assert.equal(C.efeitoDoElusivo(n.hunt, n.hunt.clock), 140);
  assert.equal(C.ELUSIVO.perdaPorSegundo, 20);
});
