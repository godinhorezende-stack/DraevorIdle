// As MALDIÇÕES e o DRENO INSTANTÂNEO do PoE de ponta a ponta (09/10, "continue com as maldições e o dreno instantâneo" — auditoria de
// dependências, docs/auditorias/dependencias-arvore-gemas-itens-combate.md): o nó real alocado pelo servidor → a ficha → a gema de maldição
// (`acoes.efeitosDaMaldicao`) → o monstro amaldiçoado (`Reforcos.marcar`: o limite, a duração, o "expirou", a lentidão) → o combate (o dano
// a mais, o crítico do amaldiçoado, o passo do monstro, o evento "ao Amaldiçoar um Inimigo sem Maldições" numa caçada de verdade). E o dreno:
// a parte instantânea (Garra, Pacto Vaal), o teto por recurso, o dreno de escudo nos ataques e o "Não pode Recuperar Vida fora o Dreno".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
const Gemas = await import('../systems/skills/gemas.mjs');
const Fr = await import('../systems/itens-poe/frascos.mjs');
const { moverMonstros } = await import('../systems/hunt/monstros.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
if (!SEM) Jogo.iniciar(ITEM_CATALOG);

const semente = (s = 3) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const PECA = (classe, af = {}) => ({ id: 3357, count: 1, poe: { classe, base: `${classe}/X`, af, prefixos: [], sufixos: [], implicitos: [] } });
/** Uma peça NORMAL de verdade desta base (a arma do golpe básico, o frasco). */
const peca = (base) => Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: semente() }));
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
/** Aloca o caminho até o nó (até o notável que abre a maestria) e devolve a função que aloca o nó (com a opção). */
function ateO(e, achado) {
  assert.ok(achado, 'há nó na árvore');
  const { no, opcao } = achado;
  const ate = no.tipo === 'mastery' ? P.arvore().nos.find((n) => n.tipo === 'notable' && n.grupo === no.grupo && !n.ascendencia).id : no.id;
  const caminho = P.caminhoAte(e, ate);
  const antes = no.tipo === 'mastery' ? caminho : caminho.slice(0, -1);
  if (antes.length) assert.equal(Comandos.comando(e, { action: 'alocar', ids: antes }).feitos, antes.length);
  return () => { const r = Comandos.comando(e, { action: 'alocar', id: no.id, ...(opcao ? { opcao } : {}) }); assert.ok(r.ok, JSON.stringify(r)); };
}
const valorDe = (achado, re) => achado.efeitos.filter((x) => re.test(x.add ?? '')).reduce((s, x) => s + x.valor, 0);
const keystone = (nome) => P.arvore().nos.find((n) => n.tipo === 'keystone' && n.nome === nome);

/** Liga a gema de maldição `slug` (nível 10) no `hunt`, lançada em `desde` — o mesmo buff que `Acoes.disparar` grava. */
function ligar(e, hunt, slug, desde = 0) {
  const r = GemasPoe.doSlug(slug);
  assert.ok(r?.buff, `${slug}: gema de maldição com reforço`);
  const entry = { id: r.acao, poeGema: { slug, arquetipo: r.arquetipo } };
  Ficha.invalidar(e);
  (hunt.buffs ??= {})[entry.id] = { ate: Number.MAX_SAFE_INTEGER, desde, tipo: 'poe-maldicao', fator: 1, efeitosPoe: Acoes.efeitosDaMaldicao(GemasPoe.buffNoNivel(slug, 10).efeitos, null, e, entry) };
  return entry.id;
}
const bicho = () => ({ uid: 1, key: 'rat', x: 0, y: 0, hp: 100, maxHp: 100 });

test('maldições: o LIMITE é 1 — vale a lançada por último (sem trocar a cada acerto), a Marca tem o limite dela, e "Você pode aplicar uma Maldição adicional" (o nó real) segura as duas', { skip: SEM }, () => {
  const e = novo();
  const hunt = { clock: 0, buffs: {} };
  const vul = ligar(e, hunt, 'Vulnerability', 0);
  const enf = ligar(e, hunt, 'Enfeeble', 100);
  const b = bicho();
  assert.equal(Reforcos.marcar(hunt, b, 1000).amaldicoouSemMaldicao, true, 'o monstro sem maldição foi amaldiçoado');
  assert.deepEqual(Object.keys(b.maldicoes), [enf], 'a lançada por último');
  assert.equal(Reforcos.marcar(hunt, b, 1500).amaldicoouSemMaldicao, false, 'já tinha maldição');
  assert.deepEqual(Object.keys(b.maldicoes), [enf], 'o acerto seguinte não troca');
  assert.equal(b.maldicoes[enf].ate, 1000 + b.maldicoes[enf].dur, 'nem renova a duração');
  // relançar a Vulnerabilidade: ela tira o Enfraquecer (a nova substitui a mais antiga)
  hunt.buffs[vul].desde = 2000;
  Reforcos.marcar(hunt, b, 2500);
  assert.deepEqual(Object.keys(b.maldicoes), [vul]);
  assert.ok(Reforcos.forcaDoBicho(b, 2500) === (b.forca ?? 1), 'sem o Enfraquecer, o monstro bate o normal');
  // a Marca entra à parte (o limite dela é 1, fora o das outras)
  const marca = ligar(e, hunt, 'Warlords_Mark', 3000);
  Reforcos.marcar(hunt, b, 3500);
  assert.deepEqual(Object.keys(b.maldicoes).sort(), [vul, marca].sort());
  // o nó real: +1 maldição — as duas ficam
  const achado = achar(/^maldicoes_adicionais$/);
  ateO(e, achado)();
  const h2 = { clock: 0, buffs: {} };
  ligar(e, h2, 'Vulnerability', 0);
  ligar(e, h2, 'Enfeeble', 100);
  const b2 = bicho();
  Reforcos.marcar(h2, b2, 1000);
  assert.equal(Object.keys(b2.maldicoes).length, 2, 'as duas maldições no monstro');
  assert.ok(Reforcos.forcaDoBicho(b2, 1000) < 1 && Reforcos.vulnerabilidade(b2, 'fire', 1000) > 1, 'e as duas valem');
});

test('"Suas Maldições têm Efeito aumentado em X% se Y% da Duração da Maldição expirou" (a maestria real): a vulnerabilidade sobe na razão exata depois de Y%', { skip: SEM }, () => {
  const e = novo();
  const achado = achar(/^efeito_maldicao_expirou:\d+$/);
  ateO(e, achado)();
  const ef = achado.efeitos.find((x) => /^efeito_maldicao_expirou:/.test(x.add));
  const apos = Number(ef.add.split(':')[1]) / 100;
  const hunt = { clock: 0, buffs: {} };
  const id = ligar(e, hunt, 'Flammability', 0);
  const b = bicho();
  Reforcos.marcar(hunt, b, 0);
  const m = b.maldicoes[id];
  const base = m.efeitos[0].pct;
  assert.ok(base > 0 && m.dur > 0);
  assert.ok(Math.abs(Reforcos.vulnerabilidade(b, 'fire', m.dur * apos - 1) - (1 + base / 100)) < 1e-9, 'antes: o efeito normal');
  assert.ok(Math.abs(Reforcos.vulnerabilidade(b, 'fire', m.dur * apos + 1) - (1 + (base * (1 + ef.valor / 100)) / 100)) < 1e-9, 'depois: +X% de efeito');
  assert.equal(Reforcos.vulnerabilidade(b, 'fire', m.dur + 1), 1, 'vencida, acabou');
});

test('"Inimigos Amaldiçoados por você são Desacelerados" (a maestria real): o monstro amaldiçoado anda mais devagar na razão exata (moverMonstros)', { skip: SEM }, () => {
  const e = novo();
  const achado = achar(/^maldicao_desacelera$/);
  ateO(e, achado)();
  const pct = valorDe(achado, /^maldicao_desacelera$/);
  const hunt = { clock: 0, buffs: {} };
  ligar(e, hunt, 'Vulnerability', 0);
  const corredor = () => { const andavel = new Set(); for (let x = 0; x <= 10; x++) andavel.add(`${x},5`); return { minX: 0, maxX: 10, minY: 5, maxY: 5, andavel }; };
  const passo = (amaldicoar) => {
    const m = { uid: 1, key: 'rat', x: 2, y: 5, dir: 2, hp: 100, maxHp: 100, perseguindo: true, proximoPasso: 0 };
    if (amaldicoar) Reforcos.marcar(hunt, m, 1000);
    const h = { pos: { x: 8, y: 5 }, monstros: [m] };
    moverMonstros(h, corredor(), 1000);
    assert.equal(m.x, 3, 'andou');
    return m.moveMs;
  };
  const normal = passo(false);
  const lento = passo(true);
  assert.ok(Math.abs(lento - normal / (1 - pct / 100)) < 1e-6, `${normal} → ${lento} (${pct}%)`);
});

test('"Recupera X% de Mana quando você Amaldiçoar um Inimigo sem Maldições" (a maestria real) numa CAÇADA de verdade: o golpe básico amaldiçoa e o evento devolve a mana', { skip: SEM }, async () => {
  const Cacadas = await import('../systems/cacadas.mjs');
  (await import('../systems/itens-poe/campanha.mjs')).iniciar();
  const e = novo();
  const achado = achar(/^ev:amaldicoarSemMaldicao:manaPct$/);
  ateO(e, achado)();
  const pct = valorDe(achado, /^ev:amaldicoarSemMaldicao:manaPct$/);
  // a espada na mão (o golpe básico corpo a corpo) e um anel que tira a regeneração de mana: a mana só volta pelo evento
  e.equipment = { weapon: peca('One_Hand_Swords/Charans_Sword'), ring: PECA('Rings', { sem_regen_mana: 1 }) };
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.frascos = [null, null, null, null, null];
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  let t = Date.now();
  const id = ligar(e, e.hunt, 'Vulnerability', t);
  e.mana = 0;
  let amaldicoados = 0;
  for (let i = 0; i < 40 && e.hunt; i++) {
    const h = e.hunt;
    if (!h.monstros?.length) break;
    h.monstros = h.monstros.slice(0, 1);
    Object.assign(h.monstros[0], { hp: 1e12, maxHp: 1e12, x: h.pos.x + 1, y: h.pos.y });
    h.alvo = h.monstros[0].uid;
    e.hp = e.maxHp;
    Cacadas.tique(e, PERSONAGEM, (t += 250));
    if (h.monstros[0].maldicoes?.[id]) amaldicoados++;
  }
  assert.ok(amaldicoados > 0, 'o golpe básico amaldiçoou o monstro');
  assert.ok(e.mana >= Math.floor((e.maxMana * pct) / 100) - 1 && e.mana > 0, `a mana voltou pelo evento: ${e.mana} de ${e.maxMana} (${pct}%)`);
});

test('"Você sofre Dano Extra dos Golpes Críticos de Inimigos Amaldiçoados reduzido em X%" (a maestria real): só no crítico do monstro amaldiçoado por você', { skip: SEM }, () => {
  const e = novo();
  const achado = achar(/^crit_dmg_taken_red_amaldicoado$/);
  ateO(e, achado)();
  const red = valorDe(achado, /^crit_dmg_taken_red_amaldicoado$/);
  const f = fichaDe(e);
  const base = { chance: 1, fator: 2.5 };
  const b = bicho();
  const semMaldicao = ModsPoe.criticoDoBicho(base, b, f, 1000, () => 0);
  const hunt = { clock: 0, buffs: {} };
  ligar(e, hunt, 'Vulnerability', 0);
  Reforcos.marcar(hunt, b, 1000);
  const comMaldicao = ModsPoe.criticoDoBicho(base, b, f, 1000, () => 0);
  const red0 = Number(f.afPoe.crit_dmg_taken_red) || 0;
  assert.ok(Math.abs((semMaldicao?.fator ?? 2.5) - (1 + 1.5 * (1 - red0 / 100))) < 1e-9, 'sem maldição: o crítico normal');
  assert.ok(Math.abs(comMaldicao.fator - (1 + 1.5 * (1 - (red0 + red) / 100))) < 1e-9, `amaldiçoado: −${red}% do dano extra`);
});

test('Mestre dos Feitiços: os Feitiços têm duração INFINITA no monstro e 20% menos efeito; "+N ao Nível das Gemas de Maldição" (o nó real) sobe a gema', { skip: SEM }, () => {
  const ks = keystone('Mestre dos Feitiços');
  assert.ok(ks, 'a keystone existe');
  const e = novo();
  ateO(e, { no: ks })();
  const efeitos = (x) => { const h = { clock: 0, buffs: {} }; const id = ligar(x, h, 'Flammability', 0); return h.buffs[id].efeitosPoe.find((y) => y.efeito === 'marcaVulneravel'); };
  const depois = efeitos(e);
  const sem = novo();
  const antes = efeitos(sem);
  assert.equal(depois.durMarca, Acoes.DURACAO_INFINITA_MS, 'duração infinita');
  const outros = Number(fichaDe(e).afPoe.efeito_maldicao) || 0;
  assert.ok(Math.abs(depois.pct - antes.pct * (1 + outros / 100) * 0.8) < 1e-9, `${antes.pct} → ${depois.pct}`);
  const b = bicho();
  const h = { clock: 0, buffs: {} };
  const id = ligar(e, h, 'Flammability', 0);
  Reforcos.marcar(h, b, 0);
  assert.ok(Reforcos.vulnerabilidade(b, 'fire', 3_600_000) > 1, 'uma hora depois, ainda amaldiçoado');
  assert.ok(b.maldicoes[id]);
  // "+N ao Nível de todas as Gemas de Habilidade Maldição": o nível que a gema ganha pela árvore
  const g = novo();
  const achado = achar(/^gem_level@maldicao$/);
  const alocarNivel = ateO(g, achado);
  const def = GemasPoe.doSlug('Flammability').gema;
  const nivelAntes = Gemas.extrasDaGemaPoe(g, null, def).nivel;
  alocarNivel();
  assert.equal(Gemas.extrasDaGemaPoe(g, null, def).nivel - nivelAntes, valorDe(achado, /^gem_level@maldicao$/));
  assert.equal(Gemas.extrasDaGemaPoe(g, null, GemasPoe.doSlug('Fireball').gema).nivel, Gemas.extrasDaGemaPoe(novo(), null, GemasPoe.doSlug('Fireball').gema).nivel, 'gema que não é maldição: nada');
});

test('"Remove Afecções Elementais quando você Conjurar uma Magia Maldição" (o nó real): o Incêndio, a Eletrização, o Resfriamento e o Congelamento em você saem', { skip: SEM }, () => {
  const e = novo();
  const achado = achar(/^ev:conjurarMaldicao:removerAfeccao:elementais$/);
  ateO(e, achado)();
  const f = fichaDe(e);
  e.hunt = { clock: 1000, controle: { congelado: { ate: 5000 }, lento: { ate: 5000, pct: 30 } } };
  (e.hunt.efeitosDoJogador ??= { hp: 1, dots: [] }).dots.push({ tipo: 'queimadura', falta: 10 }, { tipo: 'choque', falta: 10 }, { tipo: 'sangramento', falta: 10 });
  ModsPoe.evento(e, e.hunt, 'conjurarMaldicao', f, {});
  assert.deepEqual(e.hunt.efeitosDoJogador.dots.map((d) => d.tipo), ['sangramento'], 'só a não elemental fica');
  assert.equal(e.hunt.controle.congelado, undefined);
  assert.equal(e.hunt.controle.lento, undefined);
});

test('Pacto Vaal: o dreno de vida do golpe CORPO A CORPO entra na hora (fora do teto por segundo); o de projétil segue ao longo do tempo', { skip: SEM }, () => {
  const ks = keystone('Pacto Vaal');
  assert.ok(ks, 'a keystone existe');
  const e = novo();
  e.equipment = { ring: PECA('Rings', { life_leech: 5 }) };
  ateO(e, { no: ks })();
  const f = fichaDe(e);
  const dano = 1000;
  const esperado = Math.floor(Math.min(dano * f.lifeLeech, e.maxHp * 0.1));
  assert.ok(esperado > 0);
  e.hunt = { clock: 0 };
  e.hp = 1;
  const eventos = [];
  Ficha.aplicarLeech(e, dano, eventos, 'x', { x: 0, y: 0 }, ModsPoe.fichaDoGolpe(f, ['ataque', 'corpo', 'fisico'], { estado: e }), null, { ataque: true });
  assert.equal(e.hp, 1 + esperado, 'a vida na hora');
  assert.equal((e.hunt.roubos ?? []).filter((r) => r.recurso === 'vida').length, 0, 'sem instância ao longo do tempo');
  assert.ok(eventos.some((x) => x.leech === 'life' && x.instantaneo));
  // de projétil: a instância de sempre
  e.hp = 1;
  Ficha.aplicarLeech(e, dano, [], 'x', { x: 0, y: 0 }, ModsPoe.fichaDoGolpe(f, ['ataque', 'projetil', 'fisico'], { estado: e }), null, { ataque: true });
  assert.equal(e.hp, 1, 'nada na hora');
  assert.ok(e.hunt.roubos.some((r) => r.recurso === 'vida' && r.restante > 0));
});

test('Pacto Vaal: "Não pode Recuperar Vida fora o Dreno" — a regeneração, a vida por acerto, o "Recupera X% de Vida" e o frasco não enchem a vida; a mana e o dreno, sim', { skip: SEM }, () => {
  const e = novo();
  e.equipment = { ring: PECA('Rings', { life_regen: 50 }) };
  const antes = fichaDe(e);
  assert.ok(antes.regenPoe.vidaPorSegundo > 0, 'regenerava');
  ateO(e, { no: keystone('Pacto Vaal') })();
  const f = fichaDe(e);
  assert.equal(f.regenPoe.vidaPorSegundo, 0, 'sem regeneração de vida');
  e.hunt = { clock: 0 };
  // a vida/mana por acerto (Ficha.curar)
  e.hp = 10; e.mana = 0;
  Ficha.curar(e, 50, 20, [], 'x', { x: 0, y: 0 });
  assert.equal(e.hp, 10, 'vida por acerto: nada');
  assert.equal(e.mana, 20, 'a mana volta');
  // o evento "Recupera X% de Vida ao Matar" (a ação dos eventos)
  ModsPoe.evento(e, e.hunt, 'matar', { ...f, eventosPoe: [{ evento: 'matar', acao: 'vidaPct', param: '', conds: [], valor: 10 }] }, {});
  assert.equal(e.hp, 10, 'evento: nada');
  // o frasco de vida
  e.frascos = [peca('Life_Flasks/Divine_Life_Flask'), null, null, null, null];
  e.frascos[0].poe.cargas = 999;
  e.hp = e.maxHp;
  Fr.tique(e);
  e.hp = 10;
  assert.ok(Fr.usar(e, 0), 'o frasco é usado');
  for (let t = 250; t <= 10_000; t += 250) { e.hunt.clock = t; Fr.tique(e); }
  assert.equal(e.hp, 10, 'frasco de vida: nada');
  // o dreno, sim
  e.hunt.roubos = [{ recurso: 'vida', restante: 100, porSegundo: 1e9 }];
  Ficha.recuperarRoubo(e, 1000);
  assert.equal(e.hp, 110, 'o dreno enche');
});

test('"X% do Dreno é Instantâneo por Garra Equipada" (a maestria real): com a garra na mão, essa parte do dreno entra na hora e o resto vira instância', { skip: SEM }, () => {
  const e = novo();
  const achado = achar(/^roubo_instantaneo_pct%armas:comGarra$/);
  ateO(e, achado)();
  const pct = valorDe(achado, /^roubo_instantaneo_pct%armas:comGarra$/);
  e.equipment = { ring: PECA('Rings', { life_leech: 5 }) };
  const medir = () => {
    const f = fichaDe(e);
    e.hunt = { clock: 0 };
    e.hp = 1;
    Ficha.aplicarLeech(e, 1000, [], 'x', { x: 0, y: 0 }, f, null, { ataque: true });
    const quanto = Math.min(1000 * f.lifeLeech, e.maxHp * 0.1);
    return { naHora: e.hp - 1, resto: (e.hunt.roubos ?? []).filter((r) => r.recurso === 'vida').reduce((s, r) => s + r.restante, 0), quanto };
  };
  const sem = medir();
  assert.equal(sem.naHora, 0, 'sem garra: nada na hora');
  e.equipment.weapon = PECA('Claws');
  const com = medir();
  assert.equal(com.naHora, Math.floor((com.quanto * pct) / 100), `com garra: ${pct}% na hora`);
  assert.ok(Math.abs(com.naHora + com.resto - com.quanto) < 1e-6, 'o resto ao longo do tempo');
});

test('o TETO do dreno por recurso: "Recuperação de Mana Máxima total do Dreno por segundo aumentada" (o nó real) sobe só o da mana; "enquanto no máximo de Fúria" só com a Fúria cheia', { skip: SEM }, () => {
  const e = novo();
  const achado = achar(/^roubo_teto_mana_inc$/);
  const alocar = ateO(e, achado);
  const fa = fichaDe(e);
  const antes = { vida: Ficha.tetoDoRouboPct(fa, 'vida'), manaInc: ModsPoe.valor(fa, 'roubo_teto_mana_inc') };
  alocar();
  const f = fichaDe(e);
  assert.equal(ModsPoe.valor(f, 'roubo_teto_mana_inc') - antes.manaInc, valorDe(achado, /^roubo_teto_mana_inc$/));
  assert.ok(Math.abs(Ficha.tetoDoRouboPct(f, 'mana') - Ficha.LEECH_POE.porSegundoPct * (1 + (ModsPoe.valor(f, 'roubo_teto_inc') + ModsPoe.valor(f, 'roubo_teto_mana_inc')) / 100)) < 1e-9, 'o teto da mana: 20% × (1 + o aumentado)');
  assert.equal(Ficha.tetoDoRouboPct(f, 'vida'), antes.vida, 'o da vida não muda');
  // o teto na recuperação de verdade
  e.hunt = { clock: 0, roubos: [{ recurso: 'mana', restante: 1e9, porSegundo: 1e9 }] };
  e.mana = 0;
  Ficha.recuperarRoubo(e, 1000);
  assert.ok(Math.abs(e.mana - Math.floor((e.maxMana * Ficha.tetoDoRouboPct(f, 'mana')) / 100)) <= 1, `${e.mana}`);
  // a Fúria cheia
  const g = novo();
  const furia = achar(/^roubo_teto_vida_inc@furiaCheia$/);
  ateO(g, furia)();
  // (o máximo de Fúria: 30 + "+N à Fúria máxima" — o caminho pode ter)
  const maximo = 30 + (Number(fichaDe(g).afPoe.furia_max) || 0);
  g.hunt = { clock: 0, furia: { n: maximo - 1, ganhou: 0, perdeu: 0 } };
  const quase = fichaDe(g);
  const quaseInc = ModsPoe.valor(quase, 'roubo_teto_inc') + ModsPoe.valor(quase, 'roubo_teto_vida_inc');
  g.hunt.furia.n = maximo;
  const cheia = fichaDe(g);
  assert.equal(ModsPoe.valor(cheia, 'roubo_teto_inc') + ModsPoe.valor(cheia, 'roubo_teto_vida_inc') - quaseInc, valorDe(furia, /^roubo_teto_vida_inc@furiaCheia$/), 'só com a Fúria cheia');
  assert.ok(Ficha.tetoDoRouboPct(cheia, 'vida') > Ficha.tetoDoRouboPct(quase, 'vida'));
});

test('"X% do Dano é Drenado como Escudo de Energia" vale nos ATAQUES também; com o recurso cheio o dreno acaba, menos o escudo com "não são removidos quando o Escudo se Encher"', { skip: SEM }, () => {
  const e = novo();
  e.equipment = { body: { ...PECA('Body_Armours', { es_leech: 2 }), base: { es: [400, 400] } } };
  const f = fichaDe(e);
  const esMax = Math.round(f.energyShield);
  assert.ok(esMax > 0);
  e.hunt = { clock: 0 };
  Ficha.aplicarLeech(e, 1000, [], 'x', { x: 0, y: 0 }, f, null, { ataque: true });
  const es = e.hunt.roubos.find((r) => r.recurso === 'es');
  assert.ok(es && Math.abs(es.restante - Math.min(20, esMax * 0.1)) < 1e-9, 'a instância de escudo do ataque');
  // o escudo cheio encerra o dreno dele
  e.es = esMax;
  Ficha.recuperarRoubo(e, 250);
  assert.equal(e.hunt.roubos.filter((r) => r.recurso === 'es').length, 0, 'cheio: acabou');
  // com "não são removidos": segue
  e.equipment.ring = PECA('Rings', { roubo_es_nao_para_no_cheio: 1 });
  const g = fichaDe(e);
  Ficha.aplicarLeech(e, 1000, [], 'x', { x: 0, y: 0 }, g, null, { ataque: true });
  e.es = Math.round(g.energyShield);
  Ficha.recuperarRoubo(e, 250);
  assert.ok(e.hunt.roubos.some((r) => r.recurso === 'es' && r.restante > 0), 'não removido');
});

test('a VIDA NÃO RESERVADA cheia encerra o dreno de vida (e marca o "se o Dreno foi removido Preenchendo a Vida Não Reservada" — a maestria real dá o Recoup); "não são removidos" (o nó real) segura', { skip: SEM }, () => {
  const e = novo();
  const achado = achar(/^recoup_life@drenoRemovidoCheio$/);
  ateO(e, achado)();
  const pct = valorDe(achado, /^recoup_life@drenoRemovidoCheio$/);
  Ficha.invalidar(e);
  // uma aura reservando 50% da vida: o "cheio" é a metade livre
  e.hunt = { clock: 1000, buffs: { aura: { ate: Number.MAX_SAFE_INTEGER, reserva: { recurso: 'vida', pct: 50, fator: 1 } } } };
  const livre = e.maxHp - Math.ceil(e.maxHp * 0.5);
  const recoupAntes = ModsPoe.valor(fichaDe(e), 'recoup_life');
  e.hp = livre;
  e.hunt.roubos = [{ recurso: 'vida', restante: 50, porSegundo: 10 }];
  Ficha.recuperarRoubo(e, 250);
  assert.equal(e.hunt.roubos.length, 0, 'a vida livre cheia encerrou o dreno');
  assert.equal(ModsPoe.valor(fichaDe(e), 'recoup_life') - recoupAntes, pct, 'e o Recoup da maestria vale (recentemente)');
  e.hunt.clock = 1000 + 5000;
  assert.equal(ModsPoe.valor(fichaDe(e), 'recoup_life'), recoupAntes, 'passado o "recentemente", não vale');
  // abaixo da livre: segue
  e.hp = livre - 100;
  e.hunt.roubos = [{ recurso: 'vida', restante: 50, porSegundo: 10 }];
  Ficha.recuperarRoubo(e, 250);
  assert.ok(e.hunt.roubos.length === 1 && e.hunt.roubos[0].restante < 50, 'recupera');
  // "Efeitos do Dreno de Vida não são removidos quando a Vida Não Reservada estiver Cheia" (o nó real: só nas ascendências — o Carrasco)
  const no = P.arvore().nos.find((n) => n.ascendencia && (n.efeitos ?? []).some((x) => x.add === 'roubo_vida_nao_para_no_cheio'));
  assert.ok(no, 'há nó de ascendência com o efeito');
  const g = novo(P.arvore().ascendencias[no.ascendencia].classe);
  g.passivas.ascendencia = no.ascendencia;
  Comandos.depoisDeMudar(g);
  assert.ok(Comandos.comando(g, { action: 'alocar', ids: P.caminhoAte(g, no.id) }).ok);
  assert.equal(ModsPoe.valor(fichaDe(g), 'roubo_vida_nao_para_no_cheio') > 0, true);
  g.hunt = { clock: 0 };
  g.hp = g.maxHp;
  g.hunt.roubos = [{ recurso: 'vida', restante: 50, porSegundo: 10 }];
  Ficha.recuperarRoubo(g, 250);
  assert.ok(g.hunt.roubos.length === 1, 'não removido');
});

test('DEFEITO corrigido: a maldição da GEMA conta como "Inimigo Amaldiçoado" nas regras da árvore — "Recupera X% de Vida ao Matar um Inimigo Amaldiçoado" (o nó real) não via a maldição posta pelo acerto', { skip: SEM }, () => {
  const e = novo();
  const achado = achar(/^ev:matar:vidaPct@alvoAmaldicoado$/);
  ateO(e, achado)();
  const f = fichaDe(e);
  // (o caminho até o nó pode passar por outro com o mesmo efeito: vale o total que a ficha soma)
  const pct = f.eventosPoe.filter((x) => x.evento === 'matar' && x.acao === 'vidaPct' && x.conds.includes('alvoAmaldicoado')).reduce((t, x) => t + x.valor, 0);
  assert.ok(pct >= valorDe(achado, /^ev:matar:vidaPct@alvoAmaldicoado$/));
  const hunt = { clock: 1000, buffs: {} };
  e.hunt = hunt;
  ligar(e, hunt, 'Vulnerability', 0);
  const b = bicho();
  assert.ok(![...ModsPoe.tagsDoAlvo(b, 1000)].includes('alvoAmaldicoado'));
  e.hp = 10;
  ModsPoe.evento(e, hunt, 'matar', f, { alvo: b, agora: 1000 });
  assert.equal(e.hp, 10, 'sem maldição: nada');
  Reforcos.marcar(hunt, b, 1000);
  assert.ok([...ModsPoe.tagsDoAlvo(b, 1000)].includes('alvoAmaldicoado'), 'a maldição da gema no monstro');
  ModsPoe.evento(e, hunt, 'matar', f, { alvo: b, agora: 1000 });
  assert.ok(Math.abs(e.hp - (10 + (e.maxHp * pct) / 100)) < 1e-9, `${e.hp}`);
  // vencida, não conta
  assert.ok(![...ModsPoe.tagsDoAlvo(b, 1000 + b.maldicoes[Object.keys(b.maldicoes)[0]].dur + 1)].includes('alvoAmaldicoado'));
});

// ---------------------------------------------------------------- os totens, o excedente, os monstros à prova e amaldiçoados, as maldições em você

const Raridade = await import('../systems/mobs/raridade.mjs');
const Estados = await import('../systems/skills/estados.mjs');
const Mecanicas = await import('../systems/mobs/mecanicas.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
/** O monstro com estes modificadores do PoE (`poe:<id>`), sem os multiplicadores escondidos da raridade (os números ficam limpos). */
const monstro = (mods, vida = 1000) => Raridade.aplicar({ uid: 77, key: 'rat', name: 'Rato', x: 1, y: 0, hp: vida, maxHp: vida }, { raridade: 'raro', modificadores: mods.map((id) => `poe:${id}`), multiplicadores: { vida: 1, dano: 1, exp: 1, levelExtra: 0 } });
/** Um personagem na ascendência do nó de ascendência que tem o efeito (`re`), com o caminho até ele alocado. */
function naAscendencia(re) {
  const no = P.arvore().nos.find((n) => n.ascendencia && (n.efeitos ?? []).some((x) => re.test(x.add ?? '')));
  assert.ok(no, `há nó de ascendência com ${re}`);
  const e = novo(P.arvore().ascendencias[no.ascendencia].classe);
  e.passivas.ascendencia = no.ascendencia;
  Comandos.depoisDeMudar(e);
  assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) }).ok);
  return { e, no };
}

test('"X% do Dano Físico de Ataques causado pelos seus Totens é Drenado como Vida para você" (a maestria real): o golpe do totem de ATAQUE drena para o dono; o de magia, não', { skip: SEM }, () => {
  const e = novo();
  const achado = achar(/^totem_roubo_vida_fisico$/);
  const alocar = ateO(e, achado);
  const pct = valorDe(achado, /^totem_roubo_vida_fisico$/);
  const golpe = (slug) => {
    const f = fichaDe(e);
    const alvo = { uid: 5, key: 'rat', name: 'Rato', x: 1, y: 0, hp: 1e6, maxHp: 1e6 };
    e.hunt = { clock: 0, pos: { x: 0, y: 0 }, monstros: [alvo] };
    const totem = { uid: 't', acao: GemasPoe.doSlug(slug).acao, tipo: 'totem', x: 0, y: 0, hp: 100, maxHp: 100, dano: { min: 10, max: 10 }, elemento: 'physical', intervaloMs: 1000, alcanceDeAtaque: 6, proximoGolpe: 0 };
    Cacadas.golpeDoTotem(e, e.hunt, totem, alvo, f, PERSONAGEM, 0);
    return { dano: 1e6 - alvo.hp, vida: (e.hunt.roubos ?? []).filter((r) => r.recurso === 'vida').reduce((s, r) => s + r.restante, 0) };
  };
  assert.equal(golpe('Ancestral_Warchief').vida, 0, 'sem o nó: nada');
  alocar();
  const ataque = golpe('Ancestral_Warchief');
  assert.ok(ataque.dano > 0);
  assert.ok(Math.abs(ataque.vida - Math.min((ataque.dano * pct) / 100, e.maxHp * 0.1)) < 1e-9, `${ataque.dano} de dano → ${ataque.vida} de dreno (${pct}%)`);
  assert.equal(golpe('Shockwave_Totem').vida, 0, 'o totem de magia não drena');
});

test('"X% do Dano Excedente é Drenado como Vida" (o Carrasco, nó real): só o acerto que MATA drena — o que passou da vida que restava', { skip: SEM }, () => {
  const { e } = naAscendencia(/^roubo_excedente$/);
  const f = fichaDe(e);
  const pct = ModsPoe.valor(f, 'roubo_excedente');
  assert.ok(pct > 0);
  const golpe = ModsPoe.fichaDoGolpe(f, ['ataque', 'corpo', 'fisico'], { estado: e });
  const drenado = (hpDepois, dano) => {
    e.hunt = { clock: 0, pos: { x: 0, y: 0 } };
    ModsPoe.aoAcertar(e, e.hunt, { uid: 9, key: 'rat', x: 1, y: 0, hp: hpDepois, maxHp: 1000 }, golpe, { dano });
    return (e.hunt.roubos ?? []).filter((r) => r.recurso === 'vida').reduce((s, r) => s + r.restante, 0);
  };
  assert.ok(Math.abs(drenado(-30, 80) - (30 * pct) / 100) < 1e-9, 'matou com 30 a mais');
  assert.equal(drenado(10, 80), 0, 'não matou');
  assert.equal(drenado(-100, 80), 0, 'já estava morto antes do acerto');
});

test('À PROVA DE MALDIÇÕES ("Infeitiçável", o mod do PoE): o Feitiço não pega, a Marca pega; "Seus Feitiços podem afetar Inimigos a Prova de Maldições" (a Ocultista, nó real) passa', { skip: SEM }, () => {
  const m = monstro(['MonsterModHexproof']);
  assert.equal(m.aProvaDeMaldicoes, true);
  const e = novo();
  const hunt = { clock: 0, buffs: {} };
  const fla = ligar(e, hunt, 'Flammability', 0);
  Reforcos.marcar(hunt, m, 0);
  assert.equal(m.maldicoes?.[fla], undefined, 'o Feitiço não pegou');
  const marca = ligar(e, hunt, 'Warlords_Mark', 10);
  Reforcos.marcar(hunt, m, 100);
  assert.ok(m.maldicoes?.[marca], 'a Marca pegou');
  const { e: oc } = naAscendencia(/^feitico_afeta_aprova$/);
  const h2 = { clock: 0, buffs: {} };
  const id = ligar(oc, h2, 'Flammability', 0);
  const m2 = monstro(['MonsterModHexproof']);
  Reforcos.marcar(h2, m2, 0);
  assert.ok(m2.maldicoes?.[id], 'com a Ocultista, o Feitiço pega');
});

test('"Reflete Feitiços" (o mod do PoE): o Feitiço posto no monstro volta para VOCÊ — a Inflamabilidade tira a sua resistência a Fogo', { skip: SEM }, () => {
  const e = novo();
  e.hunt = { clock: 0, buffs: {} };
  const antes = fichaDe(e).protection.fire;
  ligar(e, e.hunt, 'Flammability', 0);
  const m = monstro(['MonsterModReflectHexes']);
  Reforcos.marcar(e.hunt, m, 0);
  const refletida = Object.entries(e.hunt.maldicoesNoJogador ?? {}).find(([k]) => k.startsWith('refletida:'))?.[1];
  assert.ok(refletida && refletida.af.fire_res < 0, 'voltou para você');
  assert.ok(Math.abs(fichaDe(e).protection.fire - (antes + refletida.af.fire_res)) < 1e-9, `${antes} → ${fichaDe(e).protection.fire}`);
  e.hunt.clock = refletida.ate + 1;
  assert.equal(fichaDe(e).protection.fire, antes, 'vencida, acabou');
});

test('"Amaldiçoa" (o mod do PoE): o golpe do monstro põe a Fraqueza Elemental em VOCÊ (−20% antes do máximo); "Suas Resistências Elementais não podem ser reduzidas por Maldições" (a maestria real) segura; Imune e o Efeito em você valem', { skip: SEM }, () => {
  const amaldicoar = (e, qual) => {
    e.hunt = { clock: 0, buffs: {}, pos: { x: 0, y: 0 } };
    const m = monstro(['MonsterModHexingEffigy']);
    m.maldicaoDoMonstro = qual;
    const eventos = [];
    Mecanicas.aoAtacar(e, e.hunt, PERSONAGEM, m, 50, eventos);
    assert.ok(eventos.some((x) => x.estado === 'amaldicoado'));
    return fichaDe(e);
  };
  const e = novo();
  e.hunt = { clock: 0 };
  const antes = fichaDe(e).protection;
  const f = amaldicoar(e, 'fraquezaElemental');
  for (const el of ['fire', 'ice', 'energy']) assert.equal(f.protection[el], antes[el] - 20, el);
  assert.equal(f.protection.chaos, antes.chaos, 'o Caos não');
  assert.ok(ModsPoe.condicoesDe(e, f.afPoe).has('amaldicoadoProprio'), 'você está amaldiçoado');
  // Vulnerabilidade e Enfraquecer
  assert.ok(Math.abs(ModsPoe.fatorDoDanoRecebido(amaldicoar(novo(), 'vulnerabilidade'), 'physical') - 1.2) < 1e-9);
  assert.equal(Number(amaldicoar(novo(), 'enfraquecer').afPoe.mais_dano), -20);
  // a maestria: a resistência elemental não cai (a Vulnerabilidade, sim)
  const g = novo();
  ateO(g, achar(/^res_elem_nao_reduzida_maldicao$/))();
  g.hunt = { clock: 0 };
  const gAntes = fichaDe(g).protection;
  const gf = amaldicoar(g, 'fraquezaElemental');
  for (const el of ['fire', 'ice', 'energy']) assert.equal(gf.protection[el], gAntes[el], `${el} protegida`);
  g.hunt = { clock: 0 };
  const gs = fichaDe(g).afPoe;
  const fisicoAntes = Number(gs.dano_physical_recebido_inc) || 0;
  // (o caminho da maestria pode ter "Efeito das Maldições em você reduzido": a Vulnerabilidade vale × esse efeito)
  const efeitoEmVoce = 1 + (Number(gs.efeito_maldicao_proprio) || 0) / 100;
  assert.ok(Math.abs((Number(amaldicoar(g, 'vulnerabilidade').afPoe.dano_physical_recebido_inc) || 0) - fisicoAntes - 20 * efeitoEmVoce) < 1e-9, 'a Vulnerabilidade não é resistência: vale');
  // Imune a Maldições; Efeito das Maldições em você reduzido em 50%
  const imune = novo();
  imune.equipment = { ring: PECA('Rings', { imune_maldicao: 1 }) };
  imune.hunt = { clock: 0 };
  const iAntes = fichaDe(imune).protection.fire;
  assert.equal(amaldicoar(imune, 'fraquezaElemental').protection.fire, iAntes, 'imune');
  const meio = novo();
  meio.equipment = { ring: PECA('Rings', { efeito_maldicao_proprio: -50 }) };
  meio.hunt = { clock: 0 };
  const mAntes = fichaDe(meio).protection.fire;
  assert.equal(amaldicoar(meio, 'fraquezaElemental').protection.fire, mAntes - 10, 'metade do efeito');
});

test('o ESCUDO DE ENERGIA do monstro (mod do PoE): fica por cima da vida, sai primeiro e recarrega 20%/s depois de 2 s sem dano; "Inimigos Amaldiçoados por você não podem Recuperar Escudo de Energia" e "têm Regeneração de Vida reduzida em 50%" (o nó real)', { skip: SEM }, () => {
  const m = monstro(['MonsterModEnergyShieldAura']);
  const es = (x) => Estados.escudoDoMonstro(x);
  assert.equal(es(m).max, 400);
  assert.equal(m.maxHp, 1400);
  const hunt = { monstros: [m] };
  m.hp -= 300;
  Estados.tique(hunt, [], 1000);
  assert.deepEqual([es(m).atual, es(m).vida, m.hp], [100, 1000, 1100], 'o golpe saiu do escudo');
  m.hp -= 300;
  Estados.tique(hunt, [], 1500);
  assert.deepEqual([es(m).atual, es(m).vida, m.hp], [0, 800, 800], 'acabou o escudo, o resto saiu da vida');
  Estados.tique(hunt, [], 3400);
  assert.equal(es(m).atual, 0, 'antes dos 2 s: nada');
  Estados.tique(hunt, [], 4500);
  assert.equal(es(m).atual, 80, '1 s de recarga: 20% de 400');
  assert.equal(m.hp, 880);
  // (a sobra da recarga não se acumula: quase cheio, enche; o golpe seguinte recomeça do zero — 20%/s, nem um ponto a mais)
  const q = monstro(['MonsterModEnergyShieldAura']);
  const hq = { monstros: [q] };
  q.hp -= 10;
  Estados.tique(hq, [], 1000);
  Estados.tique(hq, [], 3000);
  Estados.tique(hq, [], 4000);
  assert.equal(es(q).atual, 400, 'encheu');
  q.hp -= 200;
  Estados.tique(hq, [], 4250);
  Estados.tique(hq, [], 6250);
  Estados.tique(hq, [], 7250);
  assert.equal(es(q).atual, 280, '1 s de recarga depois do golpe: 200 + 80');
  // o monstro que também REGENERA (3%/s da vida): a vida sobe, o escudo não
  const r = monstro(['MonsterModEnergyShieldAura', 'MonsterModLifeRegeneration']);
  const hr = { monstros: [r] };
  r.hp -= 600;
  Estados.tique(hr, [], 1000);
  assert.deepEqual([es(r).atual, es(r).vida], [0, 830], 'o golpe tirou 400 do escudo e 200 da vida; a vida regenerou 3% de 1000');
  // a maldição com as regras do nó real (Últimos Ritos)
  const e = novo();
  const achado = achar(/^amaldicoado_sem_recarga_es$/);
  ateO(e, achado)();
  const h = { clock: 0, buffs: {} };
  ligar(e, h, 'Flammability', 0);
  Reforcos.marcar(h, r, 1500);
  const regras = Reforcos.regrasDasMaldicoes(r, 1500);
  assert.ok(regras.semRecargaEs && regras.regenMenos === valorDe(achado, /^amaldicoado_regen_menos$/) && regras.destruir, JSON.stringify(regras));
  const vida = es(r).vida;
  Estados.tique(hr, [], 2000);
  assert.equal(es(r).vida - vida, Math.round(1000 * 0.03 * (1 - regras.regenMenos / 100)), 'a regeneração reduzida');
  Estados.tique(hr, [], 6000);
  assert.equal(es(r).atual, 0, 'amaldiçoado: o escudo não recarrega (5 s sem dano)');
  // a vida máxima mudada por fora (escala, teste): o escudo acompanha a fração da barra
  const x = monstro(['MonsterModEnergyShieldAura']);
  Object.assign(x, { maxHp: 2800, hp: 2800 });
  Estados.tique({ monstros: [x] }, [], 1000);
  assert.deepEqual([es(x).max, es(x).atual, x.hp], [800, 800, 2800]);
});

test('"Inimigos Amaldiçoados Mortos por você são destruídos" (o nó real): o monstro amaldiçoado que morre não deixa cadáver (o Erguer Espectro não o ergue); o outro, sim', { skip: SEM }, async () => {
  (await import('../systems/itens-poe/campanha.mjs')).iniciar();
  const e = novo();
  ateO(e, achar(/^amaldicoado_destruido$/))();
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  const h = e.hunt;
  ligar(e, h, 'Flammability', h.clock ?? 0);
  const [amaldicoado, comum] = h.monstros;
  Reforcos.marcar(h, amaldicoado, h.clock ?? 0);
  assert.ok(Reforcos.regrasDasMaldicoes(amaldicoado, h.clock ?? 0).destruir);
  Object.assign(amaldicoado, { x: 3, y: 3 });
  Object.assign(comum, { x: 4, y: 4 });
  const antes = (h.cadaveres ?? []).length;
  amaldicoado.hp = 0;
  comum.hp = 0;
  Combate.processarMortes(e, PERSONAGEM, []);
  const novos = (h.cadaveres ?? []).slice(antes);
  assert.deepEqual(novos.map((c) => [c.x, c.y]), [[4, 4]], 'só o comum deixou cadáver');
});

test('DEFEITO corrigido: no PoE a resistência pode ficar NEGATIVA pelos atributos ("−30% de Resistência a Fogo" de uma peça) — antes o limite do Draevor (0 a 100%) a cortava em 0 antes da conta do PoE', { skip: SEM }, () => {
  const e = novo();
  e.equipment = { ring: PECA('Rings', { fire_res: -30 }) };
  const f = fichaDe(e);
  const sem = novo();
  assert.equal(f.protection.fire, fichaDe(sem).protection.fire - 30);
  assert.ok(f.protection.fire < 0, `${f.protection.fire}`);
  assert.ok(Math.abs(ModsPoe.fatorDaResistenciaRecebida(f, 'fire') - (1 - f.protection.fire / 100) * ModsPoe.fatorDoDanoRecebido(f, 'fire')) < 1e-9, 'e o dano de fogo recebido aumenta');
});
