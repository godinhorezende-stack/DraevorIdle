// As AFECÇÕES e as CONDIÇÕES DE ARMA da árvore do PoE de ponta a ponta (auditoria de dependências, 09/10 —
// docs/auditorias/dependencias-arvore-gemas-itens-combate.md): o nó real alocado pelo servidor → a ficha → a ficha do GOLPE (as tags e a arma na
// mão) → o acerto → o dano contínuo POSTO no monstro / o atordoamento no monstro. É o fluxo que a árvore, as gemas (as chances delas) e os
// itens dividem.
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
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

const PECA = (classe) => ({ id: 3357, count: 1, poe: { classe, base: `${classe}/X`, af: {}, prefixos: [], sufixos: [], implicitos: [] } });
const NA_MAO = { comMaca: 'One_Hand_Maces', comCetro: 'Sceptres', comMachado: 'One_Hand_Axes', comEspada: 'One_Hand_Swords', comAdaga: 'Daggers', comGarra: 'Claws', comArco: 'Bows', comVarinha: 'Wands', comCajado: 'Staves' };
function novo() {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: 'Scion' });
  delete e.classe;
  P.garantir(e);
  e.equipment = {};
  return e;
}
/** O primeiro nó (comum ou notável) cujo ÚNICO efeito é `chave`. */
const noSo = (chave) => P.arvore().nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && n.efeitos?.length && n.efeitos.every((x) => x.add === chave));
const golpe = (e, tags) => { Ficha.invalidar(e); return ModsPoe.fichaDoGolpe(Ficha.combate(e), tags, { estado: e }); };

test('condições de ARMA (Maça, Cetro, Machado, Espada, Adaga, Garra, Arco, Varinha, Cajado): o nó real só vale com a arma na mão, no golpe de ataque', { skip: SEM }, () => {
  let testadas = 0;
  for (const [cond, classe] of Object.entries(NA_MAO)) {
    // (o nó de arma junta as irmãs — "Dano Físico com Maças e Cetros": `@comMaca` e `@comCetro` — todos do MESMO atributo de ataque)
    // (o nó de arma junta várias linhas — "Dano Físico com Maças e Cetros", o crítico, o dano com afecções…: o dano FÍSICO do golpe muda pelo
    // `phys_dmg`/`dmg_inc` daquela arma; o resto não mexe nesse número. Sem nós com dano sem condição de arma, que mudaria junto.)
    const danoDaArma = (x) => new RegExp(`^(phys_dmg|dmg_inc)@ataque\\+${cond}$`).test(x.add ?? '');
    const no = P.arvore().nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && n.efeitos?.some(danoDaArma) && !n.efeitos.some((x) => /^(phys_dmg|dmg_inc)(@|$)/.test(x.add ?? '') && !/@ataque\+com\w+$/.test(x.add)));
    if (!no) continue;
    const stat = 'phys_dmg/dmg_inc';
    const v = no.efeitos.filter(danoDaArma).reduce((s2, x) => s2 + x.valor, 0);
    const e = novo();
    Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id).slice(0, -1) });
    const medir = () => golpe(e, ['ataque']).danoDoElemento.physical;
    e.equipment.weapon = PECA(classe);
    const antes = medir();
    assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id }).ok);
    assert.equal(medir() - antes, v, `${cond}: ${stat} com a arma`);
    // sem a arma (outra classe na mão), o nó não vale
    e.equipment.weapon = PECA(classe === 'Wands' ? 'Daggers' : 'Wands');
    const comOutra = medir();
    Comandos.comando(e, { action: 'respec', id: no.id });
    assert.equal(medir(), comOutra, `${cond}: sem a arma o nó não muda o golpe`);
    testadas++;
  }
  assert.ok(testadas >= 6, `condições de arma testadas: ${testadas}`);
});

test('"Ataques com Machados causam Dano com Afecções aumentado": com o machado o golpe de ataque leva o % às afecções — e o INCÊNDIO posto no monstro sobe na razão exata', { skip: SEM }, () => {
  const no = P.arvore().nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && n.efeitos?.some((x) => x.add === 'ailment_dmg_inc@ataque+comMachado'));
  assert.ok(no, 'há nó com o dano com afecções de machado');
  const v = no.efeitos.filter((x) => x.add === 'ailment_dmg_inc@ataque+comMachado').reduce((s, x) => s + x.valor, 0);
  const e = novo();
  e.equipment.weapon = PECA('One_Hand_Axes');
  Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id).slice(0, -1) });
  const incendio = () => {
    const a = golpe(e, ['ataque', 'corpo']).afeccoes;
    const bicho = { uid: 1, x: 0, y: 0, hp: 1e9, maxHp: 1e9, estados: {} };
    AfeccoesPoe.aoAcertar(bicho, [{ elemento: 'fire', dano: 1000 }], { afeccoes: { ...a, chance: { ...a.chance, incendio: 100 } }, ataque: true, agora: 0, rng: () => 0 });
    return { a, total: (bicho.dots ?? []).filter((d) => d.tipo === 'queimadura').reduce((s, d) => s + d.falta, 0) };
  };
  const antes = incendio();
  assert.ok(antes.total > 0, 'o acerto de fogo incendeia');
  assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id }).ok);
  const depois = incendio();
  assert.equal(depois.a.danoComAfeccoes - antes.a.danoComAfeccoes, v);
  const base = (antes.a.danoAumentado ?? 0) + (antes.a.danoComAfeccoes ?? 0) + (antes.a.danoIncendio ?? 0);
  const esperado = (antes.total * (1 + (base + v) / 100)) / (1 + base / 100);
  assert.ok(Math.abs(depois.total - esperado) < 1e-6 * esperado + 1, `${antes.total} → ${depois.total} (esperado ${esperado})`);
  // sem machado (espada na mão): o nó não muda as afecções do golpe
  e.equipment.weapon = PECA('One_Hand_Swords');
  const comNo = golpe(e, ['ataque', 'corpo']).afeccoes.danoComAfeccoes;
  assert.ok(Comandos.comando(e, { action: 'respec', id: no.id }).ok);
  assert.equal(golpe(e, ['ataque', 'corpo']).afeccoes.danoComAfeccoes, comNo);
});

test('atordoamento: "Duração de Atordoamentos em Inimigos aumentada" alonga o atordoamento POSTO no monstro pelo acerto, na razão exata', { skip: SEM }, () => {
  const no = noSo('stun_duration');
  assert.ok(no, 'há nó só com a duração do atordoamento');
  const e = novo();
  Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id).slice(0, -1) });
  const atordoa = () => {
    Ficha.invalidar(e);
    const f = ModsPoe.fichaDoGolpe(Ficha.combate(e), ['ataque', 'corpo'], { estado: e });
    const alvo = { uid: 1, x: 0, y: 0, hp: 1000, maxHp: 1000, estados: {} };
    ModsPoe.aoAcertar(e, { clock: 0 }, alvo, f, { dano: 900, fisico: 0, agora: 0, rng: () => 0.99 });
    return { pct: ModsPoe.valor(f, 'stun_duration'), ate: alvo.estados.atordoado?.ate ?? 0 };
  };
  // (rng 0,99: só passa se a chance de atordoar for ≥ 99 — o acerto de 900 numa vida de 1000 garante)
  const antes = atordoa();
  assert.ok(antes.ate > 0, 'o acerto grande atordoa');
  assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id }).ok);
  const depois = atordoa();
  assert.equal(depois.pct - antes.pct, no.efeitos[0].valor);
  assert.ok(Math.abs(depois.ate - (antes.ate * (1 + depois.pct / 100)) / (1 + antes.pct / 100)) <= 1, `${antes.ate} → ${depois.ate}`);
});

test('"X% de chance de Evitar Afecções Elementais": o congelamento do monstro em você é evitado no sorteio dentro da chance', { skip: SEM }, () => {
  const no = noSo('avoid_elem_ailments');
  assert.ok(no);
  const e = novo();
  Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) });
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  const chance = ModsPoe.valor(f, 'avoid_elem_ailments');
  assert.ok(chance >= no.efeitos[0].valor);
  assert.equal(ModsPoe.controleNoJogador(f, 'congelado', () => (chance - 1) / 100).evitou, true);
  assert.equal(ModsPoe.controleNoJogador(f, 'congelado', () => (chance + 1) / 100).evitou, false);
});

test('maldição: "Duração da Maldição aumentada" (o nó real) alonga a MARCA posta no monstro pela Vulnerabilidade — gema → buff → marca, na razão exata', { skip: SEM }, async () => {
  const Acoes = await import('../systems/acoes.mjs');
  const Reforcos = await import('../systems/skills/reforcos.mjs');
  const GemasPoe = await import('../systems/itens-poe/gemas-poe.mjs');
  const no = P.arvore().nos.find((n) => !n.ascendencia && (n.efeitos ?? []).some((x) => x.add === 'duracao_maldicao'));
  assert.ok(no, 'há nó com a duração da maldição');
  const v = no.efeitos.filter((x) => x.add === 'duracao_maldicao').reduce((s, x) => s + x.valor, 0);
  const slug = 'Vulnerability';
  const r = GemasPoe.doSlug(slug);
  assert.ok(r, 'a Vulnerabilidade existe');
  const entry = { id: r.acao, poeGema: { slug } };
  const doPoe = GemasPoe.buffNoNivel(slug, 10);
  assert.ok(doPoe.efeitos.some((x) => x.durMarca > 0), 'a maldição marca o monstro por um tempo');
  const marcaNoMonstro = (e) => {
    Ficha.invalidar(e);
    const hunt = { clock: 0, buffs: { [entry.id]: { ate: 60_000, tipo: 'poe-maldicao', fator: 1, efeitosPoe: Acoes.efeitosDaMaldicao(doPoe.efeitos, null, e, entry) } } };
    const bicho = { uid: 1, x: 0, y: 0, hp: 100, maxHp: 100 };
    Reforcos.marcar(hunt, bicho, 0);
    return bicho.marcas?.vulneravel?.ate ?? bicho.marcas?.enfraquecido?.ate ?? 0;
  };
  const e = novo();
  Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id).slice(0, -1) });
  const antes = marcaNoMonstro(e);
  assert.ok(antes > 0, 'a marca entra no monstro');
  assert.ok(Comandos.comando(e, { action: 'alocar', id: no.id }).ok);
  const pctAntes = ModsPoe.valor((Ficha.invalidar(e), Ficha.combate(e)), 'duracao_maldicao') - v;
  const depois = marcaNoMonstro(e);
  assert.ok(Math.abs(depois - (antes * (1 + (pctAntes + v) / 100)) / (1 + pctAntes / 100)) <= 1, `${antes} → ${depois}`);
});
