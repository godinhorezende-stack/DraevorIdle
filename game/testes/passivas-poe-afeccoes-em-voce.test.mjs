// As AFECÇÕES EM VOCÊ da árvore do PoE de ponta a ponta (09/10 — docs/auditorias/dependencias-arvore-gemas-itens-combate.md, "afecções em
// você"): o nó real alocado pelo servidor → a ficha → o dano contínuo que o monstro põe em você (`ModsPoe.dotNoJogador`), o controle
// (`ModsPoe.controleNoJogador`/`Controle.tentar`), a magia do monstro (`Poderes.dispararMagia`), o pulso que fere (`Mecanicas.tique`) e a
// Adrenalina (`ModsPoe.ganharBuff`/os eventos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Controle = await import('../systems/combate/controle.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Mecanicas = await import('../systems/mobs/mecanicas.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');

const PECA = (classe, af = {}) => ({ id: 3357, count: 1, poe: { classe, base: `${classe}/X`, af, prefixos: [], sufixos: [], implicitos: [] } });
function novo(classe = 'Scion') {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: classe });
  delete e.classe;
  P.garantir(e);
  e.equipment = {};
  return e;
}
const fichaDe = (e) => { Ficha.invalidar(e); return Ficha.combate(e); };
/** O nó (ou a opção de maestria) com um efeito cuja chave casa `re`: a principal primeiro, depois as maestrias. */
function achar(re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  const comum = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  if (comum) return { no: comum, efeitos: comum.efeitos };
  for (const n of arv.nos.filter((x) => x.tipo === 'mastery' && !x.ascendencia)) {
    const o = (n.opcoes ?? []).find((x) => tem(x.efeitos));
    if (o) return { no: n, opcao: o.id, efeitos: o.efeitos };
  }
  return null;
}
/** Aloca o caminho até o nó (até o notável que abre a maestria) e o próprio nó (com a opção). */
function alocar(e, achado) {
  assert.ok(achado, 'há nó na árvore');
  const { no, opcao } = achado;
  const ate = no.tipo === 'mastery' ? P.arvore().nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia).id : no.id;
  const caminho = P.caminhoAte(e, ate);
  const antes = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
  if (antes.length) assert.equal(Comandos.comando(e, { action: 'alocar', ids: antes }).feitos, antes.length);
  const r = Comandos.comando(e, { action: 'alocar', id: no.id, ...(opcao ? { opcao } : {}) });
  assert.ok(r.ok, JSON.stringify(r));
}
/** Um personagem na ascendência do nó que tem o efeito, com o caminho até ele alocado. */
function naAscendencia(re) {
  const no = P.arvore().nos.find((n) => n.ascendencia && (n.efeitos ?? []).some((x) => re.test(x.add ?? '')));
  assert.ok(no, `há nó de ascendência com ${re}`);
  const e = novo(P.arvore().ascendencias[no.ascendencia].classe);
  e.passivas.ascendencia = no.ascendencia;
  Comandos.depoisDeMudar(e);
  assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) }).ok);
  return e;
}
/** A caçada de teste do personagem, com a ficha dele (a que `dotNoJogador`/`ganharBuff` leem). */
function cacada(e, extra = {}) {
  e.hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [], efeitosDoJogador: { hp: 1, dots: [] }, ...extra };
  ModsPoe.definirFichaDaCacada(e.hunt, () => Ficha.combate(e));
  Ficha.invalidar(e);
  return e.hunt;
}
const por = (hunt, tipo, uid = 1) => ModsPoe.dotNoJogador(hunt, { tipo, total: 100, origem: { fonte: 'mob', mob: 'Rato', uid, key: 'rat' } }, hunt.clock, () => 0.99);
const tipos = (hunt) => (hunt.efeitosDoJogador.dots ?? []).filter((d) => d.falta > 0).map((d) => d.tipo).sort();

test('"Afecções Danificadoras/Não Danificadoras Não Podem ser infligidas em você enquanto você já tiver uma" (a maestria real): a segunda do mesmo grupo não entra; a do outro grupo, sim', { skip: SEM }, () => {
  const sem = novo();
  const h0 = cacada(sem);
  for (const t of ['sangramento', 'queimadura', 'choque', 'gelo']) por(h0, t);
  assert.deepEqual(tipos(h0), ['choque', 'gelo', 'queimadura', 'sangramento'], 'sem o nó: todas entram');
  const e = novo();
  alocar(e, achar(/^afeccao_dano_unica$/));
  const h = cacada(e);
  assert.ok(por(h, 'sangramento'));
  assert.equal(por(h, 'queimadura'), null, 'já tem uma Danificadora: o Incêndio não entra');
  assert.ok(por(h, 'choque'), 'a Não Danificadora entra');
  assert.equal(por(h, 'gelo'), null, 'já tem uma Não Danificadora: o Resfriamento não entra');
  assert.deepEqual(tipos(h), ['choque', 'sangramento']);
  // o CONTROLE: Eletrizado, não se Congela nem se Resfria; o Atordoamento (não é afecção) segue
  const f = fichaDe(e);
  assert.equal(ModsPoe.controleNoJogador(f, 'congelado', () => 0.99, h).evitou, true);
  assert.equal(ModsPoe.controleNoJogador(f, 'lento', () => 0.99, h).evitou, true);
  assert.equal(ModsPoe.controleNoJogador(f, 'atordoado', () => 0.99, h).evitou, false);
  // Congelado pelo controle também conta como a Não Danificadora
  const h2 = cacada(e, { controle: { congelado: { ate: 5000 } } });
  assert.equal(por(h2, 'choque'), null);
});

test('"Efeito do Resfriamento e Eletrização em você reduzido" (o nó real) e "100% mais Duração de Afecções em você" (Sombra Fluvial): na lentidão, no dano da Eletrização e na duração', { skip: SEM }, () => {
  const medir = (e) => {
    const h = cacada(e);
    const f = fichaDe(e);
    por(h, 'choque');
    const choque = h.efeitosDoJogador.dots.find((d) => d.tipo === 'choque');
    const c = ModsPoe.controleNoJogador(f, 'congelado', () => 0.99, h);
    const l = ModsPoe.controleNoJogador(f, 'lento', () => 0.99, h);
    return { total: choque.falta, ate: choque.ate - h.clock, lentidao: l.pctFator, congela: c.duracaoFator, af: f.afPoe };
  };
  const base = medir(novo());
  const e = novo();
  alocar(e, achar(/^efeito_eletrizacao_proprio$/));
  const r = medir(e);
  const efEl = Number(r.af.efeito_eletrizacao_proprio) || 0;
  const efRe = Number(r.af.efeito_resfriamento_proprio) || 0;
  assert.ok(efEl < 0 && efRe < 0);
  // (o dano total da Eletrização em você = o do golpe × a duração em você × o efeito em você — o nó pode mexer nos dois)
  const durEl = (x) => (1 + ((Number(x.af.duracao_eletrizacao_propria) || 0) + (Number(x.af.duracao_afeccoes_propria) || 0) + (Number(x.af.duracao_afeccoes_elementais_propria) || 0)) / 100) * (1 + (Number(x.af.duracao_afeccoes_propria_mais) || 0) / 100);
  assert.ok(Math.abs(r.total - (base.total / durEl(base)) * durEl(r) * (1 + efEl / 100)) <= 1, `Eletrização ${base.total} → ${r.total}`);
  assert.ok(Math.abs(r.lentidao - (1 + efRe / 100)) < 1e-9, 'a lentidão do Resfriamento');
  // Sombra Fluvial: 100% mais duração (o Congelamento e o dano contínuo)
  const ks = P.arvore().nos.find((n) => n.tipo === 'keystone' && n.nome === 'Sombra Fluvial');
  const s = novo();
  alocar(s, { no: ks });
  const rs = medir(s);
  const somado = (x) => 1 + ((Number(x.af.duracao_afeccoes_propria) || 0) + (Number(x.af.duracao_afeccoes_elementais_propria) || 0)) / 100;
  assert.ok(Math.abs(rs.congela - 2 * somado(rs)) < 1e-9, `Congelamento ×2: ${rs.congela}`);
  assert.ok(Math.abs(rs.ate / (base.ate * somado(rs) / somado(base)) - 2) < 0.01, `Eletrização ×2: ${base.ate} → ${rs.ate}`);
});

test('Sombra Fluvial: "Sofre 50% menos Dano Degenerativo se você começou a sofrer Dano Degenerativo no último segundo" — o primeiro segundo do dano contínuo dói a metade', { skip: SEM }, () => {
  const doer = (e) => {
    const h = cacada(e, { clock: 0 });
    h.efeitosDoJogador.dots = [];
    ModsPoe.dotNoJogador(h, { tipo: 'sangramento', total: 400, duracaoMs: 4000, origem: { fonte: 'mob', mob: 'Rato', uid: 1, key: 'rat' } }, 0, () => 0.99);
    e.hp = e.maxHp;
    const vidas = [];
    for (const t of [0, 1000, 2000, 3000]) {
      h.clock = t;
      const antes = e.hp;
      Mecanicas.tique(e, h, PERSONAGEM, []);
      vidas.push(antes - e.hp);
    }
    return vidas;
  };
  const sem = doer(novo());
  const ks = P.arvore().nos.find((n) => n.tipo === 'keystone' && n.nome === 'Sombra Fluvial');
  const e = novo();
  alocar(e, { no: ks });
  const com = doer(e);
  // (o 1º pulso cai 1 s depois de o dano contínuo começar: ainda "no último segundo")
  assert.ok(sem[1] > 0 && sem[2] > 0, JSON.stringify(sem));
  assert.ok(Math.abs(com[1] - sem[1] * 0.5) <= 1, `o 1º pulso pela metade: ${sem[1]} → ${com[1]}`);
  assert.ok(com.slice(2).every((x, i) => Math.abs(x - sem[i + 2]) <= 1), `depois do 1º segundo, igual: ${JSON.stringify(sem)} × ${JSON.stringify(com)}`);
});

test('"Inimigos Sangrando não infligem Sangramento em você", "Inimigos Incendiados não podem te Incendiar" (Cauterização, nó real): o monstro que bate tem a afecção', { skip: SEM }, () => {
  const e = novo();
  alocar(e, achar(/^sem_sangramento_de_sangrando$/));
  const bicho = { uid: 7, key: 'rat', x: 1, y: 0, hp: 100, maxHp: 100, dots: [{ tipo: 'sangramento', falta: 50 }] };
  const h = cacada(e, { monstros: [bicho] });
  assert.equal(por(h, 'sangramento', 7), null, 'o monstro sangrando não te faz sangrar');
  assert.ok(por(h, 'queimadura', 7), 'mas te incendeia (ele não está incendiado)');
  bicho.dots.push({ tipo: 'queimadura', falta: 30 });
  const h2 = cacada(e, { monstros: [bicho] });
  assert.equal(por(h2, 'queimadura', 7), null, 'incendiado, não te incendeia');
  const h3 = cacada(e, { monstros: [{ ...bicho, uid: 8, dots: [] }] });
  assert.ok(por(h3, 'sangramento', 8), 'o monstro sem afecção, sim');
});

test('"Dano Mágico Suprimido não pode infligir Afecções Elementais em você" (a maestria real): a magia suprimida não incendeia, não eletriza e não congela; o sangramento dela, sim', { skip: SEM }, () => {
  const magia = { min: 10, max: 10, elemento: 'fire', efeitos: [{ tipo: 'queimadura', chance: 100, pctDoGolpe: 50 }, { tipo: 'sangramento', chance: 100, pctDoGolpe: 50 }] };
  const lancar = (e) => {
    const h = cacada(e);
    const bicho = { uid: 3, key: 'rat', name: 'Rato', x: 1, y: 0, hp: 100, maxHp: 100 };
    h.monstros = [bicho];
    e.hp = e.maxHp;
    Poderes.dispararMagia({ estado: e, hunt: h, personagem: PERSONAGEM, bicho, eventos: [], agora: h.clock, ficha: fichaDe(e), temEscudo: false }, magia);
    return tipos(h);
  };
  const sup = { ring: PECA('Rings', { spell_suppression: 100 }) };
  const sem = novo();
  sem.equipment = sup;
  assert.deepEqual(lancar(sem), ['queimadura', 'sangramento'], 'suprimida sem o nó: as duas');
  const e = novo();
  alocar(e, achar(/^suprimido_sem_afeccao_elemental$/));
  e.equipment = sup;
  assert.deepEqual(lancar(e), ['sangramento'], 'com o nó: o Incêndio não entra');
  // o controle: Congelar e Resfriar não, o Atordoamento sim
  const vistos = new Set();
  let i = 0;
  const rng = () => ((i = (i * 7 + 3) % 97) / 97);
  for (let k = 0; k < 400; k++) {
    const h = { clock: k * 10_000, isBoss: true, controle: {} };
    const r = Controle.tentar(h, { key: 'rat', boss: true, hp: 100, maxHp: 100 }, fichaDe(e), h.clock, rng, { semAfeccaoElemental: true });
    if (r) vistos.add(r);
  }
  assert.ok(!vistos.has('congelado') && !vistos.has('lento'), [...vistos].join(','));
});

test('O Campeão (nó real): "Ganhe Adrenalina ao atingir Vida Baixa", "Recupera 25% de Vida ao ganhar Adrenalina" e "Remove todas as Afecções e Incêndios ao ganhar Adrenalina"', { skip: SEM }, () => {
  const e = naAscendencia(/^adrenalina_remove_afeccoes$/);
  const h = cacada(e);
  por(h, 'sangramento');
  por(h, 'queimadura');
  h.controle = { congelado: { ate: 9000 }, lento: { ate: 9000, pct: 30 } };
  const f = fichaDe(e);
  e.hp = Math.floor(e.maxHp * 0.3);
  const antes = e.hp;
  ModsPoe.evento(e, h, 'vidaBaixa', f, {});
  assert.ok((h.poeBuffs?.adrenalina ?? 0) > h.clock, 'ganhou a Adrenalina');
  assert.deepEqual(tipos(h), [], 'as afecções saíram');
  assert.equal(h.controle.congelado, undefined);
  assert.equal(h.controle.lento, undefined);
  const pct = f.eventosPoe.filter((x) => x.evento === 'ganharAdrenalina' && x.acao === 'vidaPct').reduce((s, x) => s + x.valor, 0);
  // (a vida é inteira: a parte inteira da cura entra agora e a fração fica guardada para a próxima — 25% de 1250 = 312,5: +312 e 0,5 no resto)
  const cura = (e.maxHp * pct) / 100;
  assert.ok(pct > 0 && e.hp === Math.min(e.maxHp, antes + Math.trunc(cura)), `recuperou ${pct}%: ${antes} → ${e.hp}`);
  assert.ok(Math.abs(h.poeRestoDosEventos.hp - (cura - Math.trunc(cura))) < 1e-9, `resto ${h.poeRestoDosEventos.hp}`);
});

test('"Você é Inafetado por Sangramento enquanto Drenando" (o Carrasco, nó real): drenando, o sangramento corre em você mas não fere', { skip: SEM }, () => {
  const e = naAscendencia(/^inafetado_sangramento/);
  const doi = (drenando) => {
    const h = cacada(e, { clock: 0 });
    if (drenando) h.roubos = [{ recurso: 'vida', restante: 1e6, porSegundo: 0.0001 }];
    ModsPoe.dotNoJogador(h, { tipo: 'sangramento', total: 400, duracaoMs: 4000, origem: { fonte: 'mob', mob: 'Rato', uid: 1, key: 'rat' } }, 0, () => 0.99);
    Ficha.invalidar(e);
    e.hp = e.maxHp;
    let perdeu = 0;
    for (const t of [0, 1000, 2000]) { h.clock = t; const a = e.hp; Mecanicas.tique(e, h, PERSONAGEM, []); perdeu += a - e.hp; }
    return { perdeu, falta: h.efeitosDoJogador.dots.find((d) => d.tipo === 'sangramento')?.falta ?? 0 };
  };
  const normal = doi(false);
  const drenando = doi(true);
  assert.ok(normal.perdeu > 0, 'sem drenar, sangra');
  assert.equal(drenando.perdeu, 0, 'drenando, não fere');
  assert.equal(drenando.falta, normal.falta, 'mas o sangramento corre igual');
});
