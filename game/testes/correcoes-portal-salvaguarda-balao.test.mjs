// AS CORREÇÕES DAS 3 REVISÕES (02/11) do Portal, da Salvaguarda e do balão de todas as gemas — os achados altos e médios (e os baixos simples), pela regra do
// PoE ou do PoB:
//   - a Salvaguarda: o Frasco de Ferro não diz mais "ainda sem efeito"; o Conjurar ao Perder Salvaguarda mostra "+2%"/"+4%" no 14 e no 15 (o sinal do efeito); a
//     magia do monstro passa pela Salvaguarda antes do Escudo de Energia (o caminho de `Poderes.dispararMagia`);
//   - o balão: as linhas da QUALIDADE que não se aplicam (o Morto Volátil) marcadas, como as do nível; os gatilhos em português; a nota curta da Mina de Fumaça com o
//     porquê; as três linhas dos Vínculos separadas;
//   - o custo: o Vínculo de Mana cobra os 5% da Mana máxima (o PoB: ManaPercent = 5); o custo por segundo dos Vínculos passa pelos multiplicadores do custo;
//   - o Portal: o tique da sessão leva à cidade mesmo com a fase seguinte pronta; a instância da party que fechou fecha o portal; o relatório e as recargas seguem
//     na volta pelo mapa e pela sala da party.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Salvaguarda = await import('../systems/personagem/salvaguarda.mjs');
const PortalDaGema = await import('../systems/itens-poe/portal-da-gema.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const Dispositivo = await import('../systems/mapas-dispositivo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { partesDoBalaoDaGema } = await import('../frontend/client/src/balao-da-gema.mjs');

const AREA = 'poe-a1-the-coast';
const peca = (base, extra = {}) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5, ...extra }));
function travado(v, fn) {
  const antes = Math.random;
  Math.random = typeof v === 'function' ? v : () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const fichaDoItem = (slug, n, q) => JSON.parse(JSON.stringify(G.fichaNoNivel(slug, n, q) ?? SP.fichaNoNivel(slug, n, q)));

/** O personagem com as gemas `gemas` (`[slug, nível]`) ligadas na varinha (a primeira no slot 1 da barra) e as peças `equip`, numa caçada; o monstro colado, imortal. */
function montar({ gemas = [], equip = {}, vocacao = 'sorcerer', classePoe = 'Witch' } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao, level: 90 }), { classePoe, sistema: 'poe' });
  const arma = peca('Wands/Driftwood_Wand', { ilvl: 60 });
  const n = Math.max(1, gemas.length);
  arma.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: arma, ...equip };
  delete e.equipment.shield;
  e.inventory = gemas.map(([s, nivel]) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < gemas.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  if (gemas.length) e.actions[0] = { id: G.doSlug(gemas[0][0]).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: AREA, mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12 });
  return { e, b };
}

// ---------------------------------------------------------------- 1. a Salvaguarda

test('o Frasco de Ferro: o efeito da base diz que restaura a Salvaguarda (não mais "ainda sem efeito no Draevor")', { skip: SEM }, () => {
  const ferro = peca('Utility_Flasks/Iron_Flask');
  const r = Frascos.resumo(ferro);
  assert.doesNotMatch(r.efeitoDaBase ?? '', /sem efeito/i);
  assert.match(r.efeitoDaBase ?? '', /Restaura a Salvaguarda/);
  assert.equal(Frascos.parametros(ferro).restauraSalvaguarda, true, 'e restaura de fato');
});

test('o Conjurar ao Perder Salvaguarda no 14 e no 15: o balão diz +2% e +4% de dano mágico, o mesmo sinal do efeito; no 1, −30%', { skip: SEM }, () => {
  const s = SP.doSlug('Cast_on_Ward_Break_Support').suporte;
  const magia = { tags: ['poe:Magia', 'poe:Fogo', 'poe:Projétil'] };
  for (const [n, v] of [[1, -30], [14, 2], [15, 4]]) {
    const linha = SP.textosDoNivel(s, n, 0).mods.find((m) => /dano mágico/.test(m));
    assert.equal(linha, `Habilidades reforçadas causam ${v > 0 ? '+' : ''}${v}% de dano mágico`, `nível ${n}`);
    assert.equal(SP.efeitoNoNivel('Cast_on_Ward_Break_Support', n, 0, magia).efeito.maisDanoMagicoPct, v, `o efeito no ${n}`);
    // (no balão do item, o mesmo texto)
    assert.ok(fichaDoItem('Cast_on_Ward_Break_Support', n, 0).mods.includes(linha), `o balão no ${n}`);
  }
});

test('a MAGIA do monstro (`Poderes.dispararMagia`): o acerto sai primeiro da Salvaguarda — o Escudo de Energia e a Vida não descem enquanto ela segura', { skip: SEM }, () => {
  const { e, b } = montar({ equip: { head: peca('Helmets/Runic_Crown'), body: peca('Body_Armours/Arcane_Vestment') } });
  e.mana = e.maxMana = 1e6;
  e.maxHp = e.hp = 1e6;
  const f = Ficha.combate(e);
  assert.ok(f.salvaguarda > 10 && f.energyShield > 0, `Salvaguarda ${f.salvaguarda}, Escudo ${f.energyShield}`);
  e.es = f.energyShield;
  Salvaguarda.restaurar(e, f);
  const antes = { salv: Salvaguarda.atual(e, f), es: e.es, hp: e.hp };
  const golpe = Math.max(1, Math.floor(antes.salv / 4));
  const eventos = [];
  travado(0.5, () => Poderes.dispararMagia({ estado: e, hunt: e.hunt, personagem: PERSONAGEM, bicho: b, eventos, agora: e.hunt.clock, ficha: f, temEscudo: false }, { min: golpe, max: golpe, elemento: 'fire' }));
  const tirou = antes.salv - Salvaguarda.atual(e, f);
  assert.ok(tirou > 0, 'a magia tirou da Salvaguarda');
  assert.ok(eventos.some((x) => x.t === 'dmg' && x.salvaguarda), 'o número da Salvaguarda');
  assert.ok(Salvaguarda.atual(e, f) > 0, 'ela segurou o acerto inteiro');
  assert.equal(e.es, antes.es, 'o Escudo de Energia não desceu');
  assert.equal(e.hp, antes.hp, 'a Vida não desceu');
});

// ---------------------------------------------------------------- 2. o balão

test('o balão: a linha da QUALIDADE que não se aplica (o Morto Volátil) vai marcada, como as do nível — e toda linha que a regra diz que não se aplica vai marcada', { skip: SEM }, () => {
  for (const slug of ['Volatile_Dead', 'Volatile_Dead_of_Seething']) {
    const p = partesDoBalaoDaGema({ poeFicha: fichaDoItem(slug, 20, 20) });
    const l = p.qualidade.linhas.find((x) => /Velocidade de Movimento do Orbe/.test(x.texto));
    assert.ok(l, `${slug}: a linha da qualidade`);
    assert.equal(l.naoSeAplica, true, `${slug}: marcada como não se aplica`);
    assert.ok(p.notas.some((n) => /Orbe/.test(n)), `${slug}: com a nota curta`);
  }
  // o confronto com a regra (`ehLinhaQueNaoSeAplica`) em todas as ativas, nas linhas do nível e nas da qualidade
  const falhas = [];
  for (const slug of G.REGISTRO.keys()) for (const q of [0, 20]) {
    const p = partesDoBalaoDaGema({ poeFicha: fichaDoItem(slug, 20, q) });
    for (const l of [...p.mods, ...(p.qualidade?.linhas ?? [])]) if (G.ehLinhaQueNaoSeAplica(l.texto) && !l.naoSeAplica) falhas.push(`${slug}@20/${q}: "${l.texto}"`);
  }
  assert.deepEqual(falhas, []);
});

test('o balão: o gatilho de todo suporte diz QUANDO em português (nenhuma chave do motor: "canalizar", "manaForjada", "acertoRaro"…)', { skip: SEM }, () => {
  const falhas = [];
  let vistos = 0;
  for (const slug of SP.REGISTRO.keys()) {
    const f = fichaDoItem(slug, 20, 0);
    if (!f?.gatilho) continue;
    vistos++;
    const t = partesDoBalaoDaGema({ poeFicha: f }).tempos.find(([r]) => r === 'Ativa as magias ligadas')?.[1] ?? '';
    const quando = t.split(' · ')[0];
    if (!quando || quando === f.gatilho.quando || /\b[a-z]+[A-Z]\w*\b/.test(quando) || !/\s/.test(quando)) falhas.push(`${slug}: "${t}"`);
  }
  assert.ok(vistos >= 9, `suportes de gatilho: ${vistos}`);
  assert.deepEqual(falhas, []);
});

test('o balão: a nota curta da Mina de Fumaça leva o porquê; os Vínculos com as três linhas separadas', { skip: SEM }, () => {
  const notas = fichaDoItem('Smoke_Mine', 20, 0).notas ?? [];
  assert.ok(notas.some((n) => /Re-armadas.*o jogo não tem Re-armar Minas/.test(n)), JSON.stringify(notas));
  for (const slug of ['Flame_Link', 'Soul_Link', 'Destructive_Link', 'Protective_Link', 'Vampiric_Link'].filter((s) => G.doSlug(s))) {
    const mods = fichaDoItem(slug, 20, 20).mods;
    assert.ok(!mods.some((m) => /segundos Máximo|por alvo Você/.test(m)), `${slug}: nada grudado`);
    assert.ok(mods.includes('Máximo de 1 Vínculo de qualquer fonte por alvo'), `${slug}: a 2ª linha`);
    assert.ok(mods.includes('Você morre se o alvo Vinculado Morrer'), `${slug}: a 3ª linha`);
    assert.ok(mods.some((m) => /^Vínculos se quebram se o alvo deixar o alcance ou linha de visão por [\d.]+ segundos$/.test(m)), `${slug}: a 1ª linha`);
  }
});

// ---------------------------------------------------------------- 3. o custo

test('o Vínculo de Mana: o custo é 5% da Mana máxima (o PoB: ManaPercent = 5) — no catálogo e no uso; antes saía de graça', { skip: SEM }, () => {
  assert.equal(G.custoPctDaManaNoNivel('Manabond', 20), 5);
  assert.equal(G.custoPctDaManaNoNivel('Fireball', 20), 0);
  const { e, b } = montar({ gemas: [['Manabond', 20]] });
  e.maxMana = 2000;
  e.mana = 2000;
  const entry = Acoes.catalogo(e).spells.find((x) => x.id === G.doSlug('Manabond').acao);
  assert.equal(entry.mana, 100, '5% de 2000');
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
  assert.equal(r.ok, true, r.erro);
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
  assert.equal(2000 - e.mana, 100, 'pagou os 5% no uso');
});

test('os Vínculos: o custo por segundo passa pelo multiplicador de custo dos suportes (o Fortalecer: 130%) — 15/s sem nada, 19,5/s com ele', { skip: SEM }, () => {
  const custo = (gemas) => {
    const { e, b } = montar({ gemas });
    e.mana = e.maxMana = 1e6;
    e.maxHp = e.hp = 1e6;
    (e.hunt.lacaios ??= []).push({ uid: 'aliado', nome: 'Aliado', mercenario: true, hp: 1000, maxHp: 1000, x: e.hunt.pos.x - 1, y: e.hunt.pos.y });
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    assert.equal(r.ok, true, r.erro);
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
    assert.ok(e.hunt.vinculos?.length, 'vinculou');
    return e.hunt.vinculos[0].custoPorSegundo;
  };
  assert.equal(custo([['Flame_Link', 1]]), 15);
  const pct = SP.efeitoNoNivel('Empower_Support', 1, 0).efeito.custoPct;
  assert.equal(custo([['Flame_Link', 1], ['Empower_Support', 1]]), Math.round(15 * (1 + pct / 100) * 10) / 10);
});

// ---------------------------------------------------------------- 4. o Portal (as sessões de verdade)

const criadas = [];
after(async () => {
  if (!criadas.length) return;
  const B = await import('../database/banco.mjs');
  const { vivas } = await import('../websocket/sessao.mjs');
  for (const { s, nome, conta } of criadas) {
    s.desconectar();
    vivas.delete(nome);
    await B.db.prepare('DELETE FROM melhorias_da_conta WHERE conta = ?').run(conta);
    await B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta);
  }
});
async function jogador(i, { comPortal = false } = {}) {
  const B = await import('../database/banco.mjs');
  const { Sessao } = await import('../websocket/sessao.mjs');
  const R = await import('../systems/regras.mjs');
  const conta = await B.criarConta({ email: `correcoes-portal-${randomUUID()}@teste.local`, senha: 'senha-123' });
  const enviados = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => enviados.push(JSON.parse(d)) });
  s.conta = { id: conta.id };
  const nome = `Cp${i}${randomUUID().replace(/[^a-z]/g, '').slice(0, 6)}`;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), comPortal ? { classePoe: 'Scion', sistema: 'poe' } : {});
  e.pos = { ...R.POSICAO_INICIAL };
  if (comPortal) {
    const a = peca('One_Hand_Swords/Rusted_Sword', { ilvl: 60 });
    a.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
    e.equipment = { ...e.equipment, weapon: a };
    delete e.equipment.shield;
    e.inventory = [GS.itemDaGema({ id: G.doSlug('Portal').itemId, nivel: 1, xp: 0, raridade: 'comum' })];
    GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
    e.actions = Array(Acoes.SLOTS).fill(null);
    e.actions[0] = { id: G.doSlug('Portal').acao, enabled: true, minMana: 0, conditions: [] };
  }
  await s.concluirEntrada({ id: randomUUID(), nome }, e, null, null);
  s.gravadoEm = Infinity;
  criadas.push({ s, nome, conta: conta.id });
  return { s, nome, enviados };
}

test('o tique da sessão: a conjuração do Portal que termina no tique leva à cidade — a fase seguinte e o portal do boss esperam (antes a caçada trocava e a saída sumia)', { skip: SEM }, async () => {
  const eu = await jogador(0, { comPortal: true });
  eu.s.receber({ t: 'startHunt', huntId: AREA, mode: 'auto' });
  assert.ok(eu.s.estado.hunt, 'entrou');
  eu.s.segurarNaEntrada = () => false;
  const chamados = [];
  // (a fase seguinte "pronta" neste tique: se ela rodasse antes, trocaria a caçada)
  eu.s.seguirParaAProximaFase = () => { chamados.push('fase'); };
  eu.s.entrarAutomaticoNoPortal = () => { chamados.push('portal do boss'); };
  eu.s.dispararAcaoManual({ slot: 0 });
  const h = eu.s.estado.hunt;
  assert.equal(h.conjurando?.id, G.doSlug('Portal').acao, 'conjurando o Portal');
  h.conjurando.fim = h.conjurando.castFim = h.clock;
  await eu.s.tique();
  assert.deepEqual(chamados, [], 'nem a fase seguinte nem o portal do boss rodaram no tique da saída');
  assert.equal(eu.s.estado.hunt, null, 'na cidade');
  assert.equal(PortalDaGema.doPersonagem(eu.s.estado)?.huntId, AREA, 'o portal aberto para a área');
});

test('na PARTY: o relatório segue na volta para a sala; a instância da party que fechou (todos saíram) fecha o portal — os mortos não voltam vivos', { skip: SEM }, async () => {
  const Party = await import('../systems/party.mjs');
  const lider = await jogador(1);
  const outro = await jogador(2);
  assert.equal(Party.comandoDoGrupo(lider.s, { action: 'convidar', name: outro.nome }).ok, true);
  assert.equal(Party.comandoDoGrupo(outro.s, { action: 'aceitar' }).ok, true);
  lider.s.receber({ t: 'startHunt', huntId: HUNT_DE_TESTE, mode: 'auto', dificuldade: 'facil' });
  assert.equal(Party.comandoDaCaca(lider.s, { action: 'invite', name: outro.nome }).ok, true);
  assert.equal(Party.comandoDaCaca(outro.s, { action: 'accept' }).ok, true);

  // 1) a volta para a sala: o relatório de antes do Portal continua
  lider.s.estado.hunt.sessao.marcaDoTeste = 'antes do portal';
  lider.s.estado.hunt.saidaPeloPortal = { em: 0 };
  assert.equal(lider.s.entrarNoPortalDaGema(), true);
  assert.equal(lider.s.estado.portalDaGema.compartilhada, true, 'a sala era da party');
  lider.s.receber({ t: 'voltarPeloPortal' });
  assert.ok(lider.s.estado.hunt, 'voltou para a sala');
  assert.equal(lider.s.estado.hunt.sessao?.marcaDoTeste, 'antes do portal', 'o relatório de antes do Portal');

  // 2) sai pelo Portal de novo; o outro sai também — a instância fecha
  lider.s.estado.hunt.saidaPeloPortal = { em: 0 };
  assert.equal(lider.s.entrarNoPortalDaGema(), true);
  outro.s.receber({ t: 'stopHunt' });
  assert.equal(outro.s.estado.hunt, null, 'o outro saiu');
  lider.s.receber({ t: 'voltarPeloPortal' });
  assert.equal(lider.s.estado.hunt, null, 'sem volta: a instância fechou');
  assert.equal(lider.s.estado.portalDaGema, null, 'o portal sumiu com ela');
  assert.ok(lider.enviados.some((m) => m.t === 'error' && /portal fechou/i.test(m.msg ?? m.erro ?? m.message ?? JSON.stringify(m))), 'com o aviso');
});

test('no MAPA: o relatório e as recargas de antes do Portal seguem na volta (as recargas no relógio da caçada da volta)', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.hp = e.maxHp = 1e9;
  for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = Array.from({ length: 10 }, (_, i) => i + 1);
  Bolsa.garantir(e);
  const p = J.mapaSorteado(1, { raridade: 'normal' });
  e.inventory.push(p);
  const m = Dispositivo.mapasCarregados(e).find((x) => x.peca === p);
  assert.equal(Dispositivo.abrir(e, { onde: m.onde, indice: m.indice, assinatura: m.assinatura, mode: 'auto' }).ok, true, 'abriu o mapa');
  e.hunt.sessao.marcaDoTeste = 'antes do portal';
  const inicio = e.hunt.startedAt;
  e.hunt.clock = 50_000;
  (e.hunt.cooldowns ??= {}).teste = { ate: 53_000, total: 5000 };
  assert.equal(PortalDaGema.guardar(e).ok, true);
  Cacadas.sair(e, { manterLoop: true });
  const r = Cacadas.voltarPeloPortalDaGema(e);
  assert.equal(r.ok, true, r.erro);
  assert.equal(e.hunt.sessao?.marcaDoTeste, 'antes do portal', 'o relatório continua');
  assert.equal(e.hunt.startedAt, inicio);
  assert.equal(e.hunt.cooldowns?.teste?.ate, e.hunt.clock + 3000, 'faltavam 3 s: faltam 3 s');
});
