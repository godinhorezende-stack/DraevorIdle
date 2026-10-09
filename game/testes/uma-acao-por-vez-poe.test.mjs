// UMA AÇÃO POR VEZ no modo PoE (09/10): o golpe básico e as gemas da barra dividem um relógio só (`Acoes.GRUPO_DO_POE`, no relógio da
// caçada). Medido antes: um Duelista com Rusted Sword e a Cleave na barra, contra um alvo imortal colado, fazia num minuto 30 golpes
// básicos + 24 Cleaves EM PARALELO — a gema empurrava `hunt.proximoGolpeEm` com um instante do relógio da caçada (pequeno) num campo do
// relógio de parede (~1,8e12), e o básico ainda saía antes da barra no tique. A regra agora: a barra decide primeiro; o básico só sai
// com o relógio livre e o ocupa pelo intervalo dele (a gema automática espera); o clique do jogador interrompe o resto do golpe.
// Tudo numa caçada de verdade (`Cacadas.entrar` + `Cacadas.tique`, 250 ms).
// E no DUELO da arena: o golpe no adversário tinha relógio próprio (`proximoGolpePvp`) — mirando nele, 30 golpes + 24 Cleaves nos bichos
// por minuto. Ele entra no mesmo relógio e vem antes da barra (mirar no adversário é o comando do jogador). Num duelo de verdade
// (`Arena.comando` + `Arena.antesDoTique` + `Cacadas.tique`, a ordem da sessão).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const GP = await import('../systems/itens-poe/gemas-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');

const CLEAVE = 'Cleave';
/** Um Duelista com a Rusted Sword e a Cleave (gema no soquete da arma, habilidade no slot 1 da barra), já na Costa. */
function duelista({ level = 40, nivelDaGema = 10 } = {}) {
  const e = equipado({ level, nivelDaGema });
  assert.equal(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok, true);
  e.mana = e.maxMana;
  return e;
}
/** O Duelista, fora da caçada. */
function equipado({ level = 40, nivelDaGema = 10 } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level }), { classePoe: 'Duelist' });
  const arma = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'One_Hand_Swords/Rusted_Sword', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  delete e.equipment.shield;
  e.inventory = [GS.itemDaGema({ id: GP.doSlug(CLEAVE).itemId, nivel: nivelDaGema, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GP.doSlug(CLEAVE).acao, enabled: true, minMana: 0, conditions: [] };
  return e;
}
/** O bicho mais perto vira imortal e fica colado (o resto sai); ele é o alvo. */
function alvoColado(e) {
  const h = e.hunt;
  h.monstros = h.monstros.slice(0, 1);
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
  h.alvo = h.monstros[0].uid;
  e.hp = e.maxHp;
  return h.monstros[0];
}

/**
 * `segundos` de caçada depois de 5 s de aquecimento. Por tique: saiu o golpe básico (só ele mexe em `proximoGolpeEm`)? E a Cleave (o
 * evento `skill` dela)? `acoes`: cada ação que ocupou o relógio comum, no relógio da caçada (`inicio`, `dur`, `basico`).
 */
function rodar(e, { segundos = 60, manaInfinita = true } = {}) {
  const acao = GP.doSlug(CLEAVE).acao;
  let t = Date.now();
  const comeco = t + 5000;
  const r = { basicos: 0, cleaves: 0, juntos: 0, acoes: [] };
  while (t < comeco + segundos * 1000) {
    const h = e.hunt;
    alvoColado(e);
    if (manaInfinita) Object.assign(e, { mana: 1e6, maxMana: 1e6 });
    const golpeAntes = h.proximoGolpeEm;
    const grupoAntes = h.cooldowns?.[Acoes.GRUPO_DO_POE];
    const eventos = Cacadas.tique(e, PERSONAGEM, (t += 250)) ?? [];
    if (t <= comeco) continue;
    const basico = h.proximoGolpeEm !== golpeAntes;
    const cleave = eventos.some((x) => x.t === 'skill' && x.sk === acao);
    r.basicos += basico ? 1 : 0;
    r.cleaves += cleave ? 1 : 0;
    r.juntos += basico && cleave ? 1 : 0;
    const g = h.cooldowns?.[Acoes.GRUPO_DO_POE];
    if (g && g !== grupoAntes) r.acoes.push({ inicio: g.ate - g.total, dur: g.total, basico: !!g.basico });
  }
  return r;
}
/** Nenhuma ação começa antes de a anterior terminar (o golpe básico seguido de outro é o ritmo da arma — `velocidade-de-ataque`). */
function semSobreposicao(acoes) {
  for (let i = 1; i < acoes.length; i++) {
    const [a, b] = [acoes[i - 1], acoes[i]];
    if (a.basico && b.basico) continue;
    assert.ok(b.inicio >= a.inicio + a.dur, `${b.basico ? 'golpe básico' : 'Cleave'} em ${b.inicio} ms, antes do fim d${a.basico ? 'o golpe básico' : 'a Cleave'} (${a.inicio} + ${a.dur})`);
  }
}

test('a Cleave na barra e o golpe básico, num minuto: a Cleave no ritmo dela e nenhum golpe básico por cima (antes: 30 + 24 em paralelo)', { skip: SEM }, () => {
  const e = duelista();
  const uso = Acoes.temposDaGemaPoe(e, Acoes.POR_ID_PUBLICO(GP.doSlug(CLEAVE).acao)).uso;
  const r = rodar(e);
  // Com mana sobrando a Cleave sempre pode: o golpe básico não tem vez (é o ataque de quando nenhuma gema sai).
  assert.equal(r.basicos, 0, `${r.basicos} golpes básicos e ${r.cleaves} Cleaves no mesmo minuto`);
  assert.ok(Math.abs(r.cleaves - 60_000 / uso) <= 1, `${r.cleaves} Cleaves em 60 s (uma a cada ${uso} ms)`);
  assert.equal(r.juntos, 0);
  semSobreposicao(r.acoes);
});

test('sem mana para a Cleave, o golpe básico preenche as brechas — nunca no mesmo tique, nunca por cima dela, e o minuto não estica', { skip: SEM }, () => {
  const e = duelista({ level: 10, nivelDaGema: 1 });
  // Sem mana: a Cleave sai quando a regeneração junta o custo dela.
  e.mana = 0;
  const r = rodar(e, { manaInfinita: false });
  assert.ok(r.cleaves > 0 && r.basicos > 0, `${r.cleaves} Cleaves, ${r.basicos} golpes básicos`);
  assert.equal(r.juntos, 0, 'o golpe básico e a Cleave no mesmo tique');
  semSobreposicao(r.acoes);
  // Uma por vez: o tempo das ações cabe no minuto (só a última pode passar do fim, e o golpe básico pode adiantar meio tique cada).
  const ocupado = r.acoes.reduce((s, a) => s + a.dur, 0);
  const maior = Math.max(...r.acoes.map((a) => a.dur));
  assert.ok(ocupado <= 60_000 + maior + r.basicos * 125, `${ocupado} ms de ações em 60 s`);
});

test('o golpe básico ocupa o relógio comum: a barra automática espera ele terminar; o CLIQUE do jogador o interrompe', { skip: SEM }, () => {
  const e = duelista();
  const h = e.hunt;
  // Manual, sem a barra automática, com o alvo clicado: só o golpe básico sai sozinho.
  Cacadas.definirAutomatico(e, { on: false });
  Cacadas.definirAssistencia(e, { tipo: 'barra', on: false });
  const bicho = alvoColado(e);
  assert.ok(Cacadas.definirAlvo(e, { uid: bicho.uid }).ok);
  let t = Date.now();
  for (let i = 0; i < 40 && !h.cooldowns?.[Acoes.GRUPO_DO_POE]?.basico; i++) {
    alvoColado(e);
    Object.assign(e, { mana: 1e6, maxMana: 1e6 });
    Cacadas.tique(e, PERSONAGEM, (t += 250));
  }
  const golpe = h.cooldowns[Acoes.GRUPO_DO_POE];
  assert.ok(golpe?.basico && golpe.ate > h.clock, 'o golpe básico saiu e segura o relógio comum');
  // O caminho da barra automática (`autoDisparo` / combo): recusado até o golpe acabar.
  const pelaBarra = Acoes.disparar(e, h, PERSONAGEM, 0, bicho);
  assert.deepEqual([pelaBarra.ok, pelaBarra.motivo], [false, 'COOLDOWN_DO_GRUPO']);
  // O clique: sai na hora, e agora é a Cleave que segura o relógio (o golpe básico espera o uso dela).
  const clique = Cacadas.disparoManual(e, PERSONAGEM, 0);
  assert.equal(clique.ok, true, clique.erro);
  const cleave = h.cooldowns[Acoes.GRUPO_DO_POE];
  assert.equal(cleave.basico, undefined);
  assert.equal(cleave.ate, h.clock + Acoes.temposDaGemaPoe(e, Acoes.POR_ID_PUBLICO(GP.doSlug(CLEAVE).acao)).uso);
  while (h.clock < cleave.ate) {
    const antes = h.proximoGolpeEm;
    alvoColado(e);
    Cacadas.tique(e, PERSONAGEM, (t += 250));
    if (h.clock < cleave.ate) assert.equal(h.proximoGolpeEm, antes, `golpe básico em ${h.clock}, no meio da Cleave (até ${cleave.ate})`);
  }
});

// ------------------------------------------------------------------------------------------------- o duelo da arena

const Banco = await import('../database/banco.mjs');
const Arena = await import('../systems/arena.mjs');
const NOMES = ['Acaoporvezum', 'Acaoporvezdois', 'Acaoporveztres', 'Acaoporvezquatro'];
after(() => {
  for (const n of NOMES) Banco.db?.prepare('DELETE FROM arena_historico WHERE vencedor LIKE ? OR perdedor LIKE ?').run(`%"${n}"%`, `%"${n}"%`);
});

/** Um duelo de verdade, já depois da largada: `a` (a Cleave na barra) contra `b` (barra vazia). `fim()`: `b` sai (derrota dele). */
async function duelo([nomeA, nomeB]) {
  const sessao = (nome) => {
    const s = { personagem: { nome }, estado: equipado({ level: 600 }), msgs: [] };
    s.enviar = (m) => s.msgs.push(m);
    return s;
  };
  const [a, b] = [sessao(nomeA), sessao(nomeB)];
  b.estado.actions = Array(Acoes.SLOTS).fill(null);
  Arena.ligar(new Map([a, b].map((s) => [s.personagem.nome, s])));
  const arenaId = (await Arena.vista(a)).view.arenas[0].id;
  assert.equal(await Arena.comando(b, { action: 'alistar', arenaId }), null);
  assert.equal(await Arena.comando(a, { action: 'enfrentar', quem: nomeB, arenaId }), null);
  await Arena.comando(a, { action: 'pronto' });
  await Arena.comando(b, { action: 'pronto' });
  assert.equal(await Arena.comando(a, { action: 'comecar' }), null);
  return {
    a, b, h: a.estado.hunt, agora: Date.now() + 6000,
    fim: async () => {
      Arena.saiuDoJogo(b);
      await new Promise((r) => setImmediate(r));
    },
  };
}
/**
 * Um tique do duelo para `a`, na ordem da sessão (`Arena.antesDoTique`, depois `Cacadas.tique`): um bicho imortal colado nele, `b` a
 * `longe` casas, vida e mana cheias. Saiu o golpe no adversário? E a Cleave (no bicho)?
 */
function tiqueDoDuelo(d, { longe = 1 } = {}) {
  const { a, b, h } = d;
  h.monstros.length = 1;
  Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x, y: h.pos.y - 1 });
  Object.assign(b.estado.hunt.pos, { x: h.pos.x + longe, y: h.pos.y });
  for (const s of [a, b]) Object.assign(s.estado, { hp: s.estado.maxHp, mana: 1e6, maxMana: 1e6 });
  h.guia = null; // a sessão recalcula o guia a cada tique
  const n = a.msgs.length;
  Arena.antesDoTique(a, (d.agora += 250));
  const golpe = a.msgs.slice(n).some((m) => m.t === 'events' && m.events.some((e) => e.t === 'dmg' && e.alvo === b.personagem.nome));
  const eventos = Cacadas.tique(a.estado, a.personagem, d.agora) ?? [];
  return { golpe, cleave: eventos.some((x) => x.t === 'skill' && x.sk === GP.doSlug(CLEAVE).acao) };
}

test('no duelo, mirando o adversário: o golpe nele vem antes da barra e a Cleave nos bichos espera (antes: 30 golpes + 24 Cleaves em paralelo)', { skip: SEM }, async () => {
  const d = await duelo(NOMES.slice(0, 2));
  assert.ok(Cacadas.definirAlvo(d.a.estado, { uid: `aliado:${NOMES[1]}` }).ok);
  let golpes = 0;
  let cleaves = 0;
  for (let i = 0; i < 240; i++) {
    const t = tiqueDoDuelo(d);
    golpes += t.golpe ? 1 : 0;
    cleaves += t.cleave ? 1 : 0;
  }
  assert.equal(cleaves, 0, `${golpes} golpes no adversário e ${cleaves} Cleaves no mesmo minuto`);
  const intervalo = Ficha.combate(d.a.estado).intervaloDoGolpeMs;
  assert.ok(Math.abs(golpes - 60_000 / intervalo) <= 1, `${golpes} golpes no adversário em 60 s (um a cada ${intervalo} ms)`);
  assert.equal(d.h.cooldowns[Acoes.GRUPO_DO_POE].adversario, true, 'o golpe no adversário marca o relógio comum');
  // Fora do alcance (ele vai atrás do adversário), a barra fica com o tempo: a Cleave volta no bicho colado.
  const longe = Array.from({ length: 20 }, () => tiqueDoDuelo(d, { longe: 10 }));
  assert.equal(longe.filter((t) => t.golpe).length, 0);
  assert.ok(longe.filter((t) => t.cleave).length > 0, 'a Cleave volta com o adversário fora do alcance');
  await d.fim();
});

test('no duelo, o golpe no adversário espera: a gema em uso (o clique a pôs por cima do golpe) e o golpe no bicho de quem trocou de alvo', { skip: SEM }, async () => {
  const d = await duelo(NOMES.slice(2, 4));
  const { a, h } = d;
  // Manual, sem a barra automática: só o golpe e o clique.
  Cacadas.definirAutomatico(a.estado, { on: false });
  Cacadas.definirAssistencia(a.estado, { tipo: 'barra', on: false });
  assert.ok(Cacadas.definirAlvo(a.estado, { uid: `aliado:${NOMES[3]}` }).ok);
  let saiu = false;
  for (let i = 0; i < 40 && !saiu; i++) saiu = tiqueDoDuelo(d).golpe;
  assert.ok(saiu, 'saiu um golpe no adversário');
  // O clique na Cleave interrompe o resto do golpe; o próximo golpe no adversário só depois do uso dela.
  const clique = Cacadas.disparoManual(a.estado, a.personagem, 0);
  assert.equal(clique.ok, true, clique.erro);
  const cleave = h.cooldowns[Acoes.GRUPO_DO_POE];
  assert.equal(cleave.basico, undefined);
  let depois = null;
  for (let i = 0; i < 40 && depois == null; i++) if (tiqueDoDuelo(d).golpe) depois = h.clock;
  assert.ok(depois != null && depois >= cleave.ate, `golpe no adversário em ${depois}, a Cleave ia até ${cleave.ate}`);
  // Mira o bicho (o golpe básico nele) e, no meio do golpe, troca para o adversário — o golpe nele espera o do bicho acabar.
  assert.ok(Cacadas.definirAlvo(a.estado, { uid: h.monstros[0].uid }).ok);
  let noBicho = null;
  for (let i = 0; i < 40 && !noBicho; i++) {
    const antes = h.proximoGolpeEm;
    tiqueDoDuelo(d);
    // (O fim dele no relógio da caçada: `proximoGolpeEm` é do relógio de parede, `ultimoTique - clock` a diferença.)
    if (h.proximoGolpeEm !== antes) noBicho = { ate: h.proximoGolpeEm - (h.ultimoTique - h.clock) };
  }
  assert.ok(noBicho, 'saiu um golpe básico no bicho');
  assert.ok(Cacadas.definirAlvo(a.estado, { uid: `aliado:${NOMES[3]}` }).ok);
  depois = null;
  for (let i = 0; i < 40 && depois == null; i++) if (tiqueDoDuelo(d).golpe) depois = h.clock;
  assert.ok(depois != null && depois >= noBicho.ate, `golpe no adversário em ${depois}, o golpe no bicho ia até ${noBicho.ate}`);
  await d.fim();
});
