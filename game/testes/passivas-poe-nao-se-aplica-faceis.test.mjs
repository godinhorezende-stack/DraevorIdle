// A árvore do PoE, as linhas que "não se aplicavam ao jogo" — o lote das FÁCEIS (dono, 11/10: "depois faça os fáceis"): o jogo ganhou a
// mecânica e a linha passou a valer. O modificador de monstro "Vida Não Pode ser Drenada", a trava do bloqueio (Recuperação de Bloqueio), o
// Impelir fora do deslocamento, os totens que não ficam lentos e a distância do Empurrão. Cada teste aloca o nó REAL pelo servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Controle = await import('../systems/combate/controle.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const Raridade = await import('../systems/mobs/raridade.mjs');
const ModsMonstro = await import('../systems/itens-poe/modificadores-monstro.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

function novo(classe = 'Scion') {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: classe });
  delete e.classe;
  P.garantir(e);
  e.equipment = {};
  e.hunt = { clock: 10000, monstros: [], lacaios: [], pos: { x: 0, y: 0 } };
  return e;
}
/** O nó (ou a opção de maestria) com um efeito cuja chave casa `re`. */
function achar(re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  const comum = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  if (comum) return { no: comum, valor: comum.efeitos.find((x) => re.test(x.add)).valor };
  for (const n of arv.nos.filter((x) => x.tipo === 'mastery' && !x.ascendencia)) {
    const o = (n.opcoes ?? []).find((x) => tem(x.efeitos));
    if (o) return { no: n, opcao: o.id, valor: o.efeitos.find((x) => re.test(x.add)).valor };
  }
  const asc = arv.nos.find((n) => n.ascendencia && tem(n.efeitos));
  return asc ? { no: asc, asc: true, valor: asc.efeitos.find((x) => re.test(x.add)).valor } : null;
}
function com(re) {
  const achado = achar(re);
  assert.ok(achado, `há nó com ${re}`);
  const { no, opcao } = achado;
  const e = novo(achado.asc ? P.arvore().ascendencias[no.ascendencia].classe : 'Scion');
  if (achado.asc) { e.passivas.ascendencia = no.ascendencia; Comandos.depoisDeMudar(e); assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) }).ok); }
  else {
    const ate = no.tipo === 'mastery' ? P.arvore().nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia).id : no.id;
    const caminho = P.caminhoAte(e, ate);
    const antes = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
    if (antes.length) assert.equal(Comandos.comando(e, { action: 'alocar', ids: antes }).feitos, antes.length);
    assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id, ...(opcao ? { opcao } : {}) }).ok);
  }
  Ficha.invalidar(e);
  const chave = [...(no.efeitos ?? []), ...((no.opcoes ?? []).find((o) => o.id === opcao)?.efeitos ?? [])].find((x) => re.test(x.add ?? '')).add;
  return { e, valor: Number(Ficha.combate(e).afPoe[chave]) || achado.valor, chave };
}
const ficha = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
const golpe = (e, tags, alvo = null) => ModsPoe.fichaDoGolpe(ficha(e), tags, { estado: e, alvo });
const bicho = (extra = {}) => ({ uid: 9, key: 'rat', name: 'Rato', x: 1, y: 0, hp: 1000, maxHp: 1000, ...extra });

test('VIDA NÃO PODE SER DRENADA: o modificador de monstro entra no sorteio e tira o dreno de vida; "X% mais Dano contra Inimigos que não podem ter Vida Drenada"', { skip: SEM }, () => {
  const mod = ModsMonstro.DADOS.mods.find((m) => m.id === 'MonsterModCannotLeech');
  assert.ok(ModsMonstro.elegivel(mod, 'raro', 80) > 0, 'sorteia (antes ficava fora: sem efeito)');
  assert.ok(!ModsMonstro.elegivel(ModsMonstro.DADOS.mods.find((m) => m.id === 'MonsterArchnemesisVampiric'), 'raro', 80), 'o Vampírico (o monstro que drena) continua fora');
  const m = { key: 'rat', hp: 100, maxHp: 100 };
  Raridade.aplicar(m, { raridade: 'raro', modificadores: [`${ModsMonstro.PREFIXO}MonsterModCannotLeech`] });
  assert.equal(m.semDreno, true);
  const { e, valor } = com(/^mais_dano@alvoSemDreno$/);
  const fator = (alvo) => golpe(e, ['ataque', 'corpo'], alvo).fatorDasCargas ?? 1;
  const comum = bicho();
  const blindado = bicho({ semDreno: true });
  assert.ok(Math.abs(fator(blindado) / fator(comum) - (1 + valor / 100)) < 1e-9);
  // o dreno de vida não pega nele
  const d = novo();
  d.maxHp = d.hp = 10000;
  d.hp = 1000;
  const f = { ...ficha(d), lifeLeech: 0.5 };
  Ficha.aplicarLeech(d, 1000, [], 'x', null, f, null, { semDrenoDeVida: 1000 });
  assert.equal(d.hunt.roubos?.filter((r) => r.recurso === 'vida').length ?? 0, 0);
  Ficha.aplicarLeech(d, 1000, [], 'x', null, f, null, { semDrenoDeVida: 0 });
  assert.ok(d.hunt.roubos.some((r) => r.recurso === 'vida'));
});

test('RECUPERAÇÃO DE BLOQUEIO: bloquear o golpe de um Elite/Chefe trava a próxima ação 0,35 s ÷ (1 + X%); o de um comum, não', { skip: SEM }, () => {
  const { e, valor } = com(/^block_recovery$/);
  const f = ficha(e);
  assert.equal(Controle.travarNoBloqueio(e.hunt, bicho(), f), 0);
  const ms = Controle.travarNoBloqueio(e.hunt, bicho({ elite: true }), f);
  assert.equal(ms, Math.round(350 / (1 + ((Number(f.afPoe.block_recovery) || 0) + (Number(f.afPoe.stun_recovery) || 0)) / 100)));
  assert.ok(ms < 350 && valor > 0);
  assert.equal(e.hunt.cooldowns['grupo:poe'].ate, e.hunt.clock + ms);
});

test('IMPELIR: "Clamores não podem Impelir Habilidades de Deslocamento" — o golpe de Movimento não leva nem gasta o Impelir', { skip: SEM }, () => {
  const { e } = com(/^clamor_nao_impele_movimento$/);
  e.hunt.impelidos = { n: 3, ate: e.hunt.clock + 20000 };
  assert.ok(!golpe(e, ['ataque', 'corpo', 'movimento']).tagsDoGolpe.includes('impelido'));
  assert.ok(golpe(e, ['ataque', 'corpo']).tagsDoGolpe.includes('impelido'));
  const sem = novo();
  sem.hunt.impelidos = { n: 3, ate: sem.hunt.clock + 20000 };
  assert.ok(golpe(sem, ['ataque', 'corpo', 'movimento']).tagsDoGolpe.includes('impelido'), 'sem a linha, o deslocamento gasta');
});

test('TOTENS: o golpe de um Elite deixa o lacaio lento (o golpe dele demora mais); "A Velocidade de Ação dos Totens não pode ser modificada para abaixo do valor base"', { skip: SEM }, () => {
  const { e } = com(/^totem_sem_lentidao$/);
  const slug = [...GemasPoe.REGISTRO].find(([, r]) => r.arquetipo === 'totem')?.[0];
  assert.ok(slug, 'há gema de totem');
  const totem = { ...LacaiosPoe.oQueInvoca(slug, 1, null, ficha(e).afPoe), tipo: 'totem' };
  assert.equal(totem.poe.semLentidao, true);
  const elite = bicho({ elite: true });
  assert.equal(LacaiosPoe.controleNoLacaio(totem, elite, e.hunt, 1000, () => 0), false);
  const outro = { ...LacaiosPoe.oQueInvoca(slug, 1, null, ficha(novo()).afPoe), tipo: 'totem' };
  assert.equal(LacaiosPoe.controleNoLacaio(outro, elite, e.hunt, 1000, () => 0), true);
  assert.ok(LacaiosPoe.fatorDeLentidao(outro, 1500) > 1);
  assert.equal(LacaiosPoe.controleNoLacaio(outro, bicho(), e.hunt, 1000, () => 0), false, 'o comum não controla');
});

test('EMPURRÃO: "Distância do Empurrão aumentada em X%" — mais casas além da primeira', { skip: SEM }, () => {
  const { e, valor } = com(/^distancia_empurrao$/);
  const f = { ...golpe(e, ['ataque']), afPoe: { ...ficha(e).afPoe, chance_empurrar: 100 } };
  let passos = 0;
  ModsPoe.aoAcertar(e, e.hunt, bicho(), f, { dano: 1, rng: () => 0, mover: () => (passos++, true) });
  assert.equal(passos, 1 + Math.floor(valor / 100) + (valor % 100 > 0 ? 1 : 0));
  passos = 0;
  ModsPoe.aoAcertar(e, e.hunt, bicho(), f, { dano: 1, rng: () => 0.999, mover: () => (passos++, true) });
  assert.equal(passos, 1 + Math.floor(valor / 100), 'sem a sorte, só a parte inteira');
});
