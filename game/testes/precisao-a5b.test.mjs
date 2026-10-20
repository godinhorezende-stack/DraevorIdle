// (lote A5b, dono 20/10: "fazer como o PoE") A PRECISÃO NAS GEMAS DE ATAQUE: cada acerto da gema de ataque rola o acerto POR ALVO, com a precisão do USO (a
// ficha do golpe, com o "+X de Precisão" e o "% aumentada" da gema e dos suportes — a Precisão Adicional), contra a evasão do bicho, pela conta do golpe
// básico (`Defesa.errou`). As magias nunca erram. As exceções: "Acertos não podem ser Evadidos", a Técnica Resoluta e o "Não pode ser Evadido" da gema. O
// erro é o evento do golpe básico, sem dano, sem afecções e sem os efeitos do acerto; a área de um ataque erra cada alvo à parte. Os sorteios ficam travados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const L = await import('../systems/itens-poe/linhas-das-gemas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Defesa = await import('../systems/personagem/defesa.mjs');
const Atributos = await import('../systems/personagem/atributos.mjs');
const AtributosDoMob = await import('../systems/mobs/atributos.mjs');
const Formulas = await import('../systems/combate/formulas.mjs');
const Simulador = await import('../systems/combate/simulador.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));

/** Roda `fn` com o `Math.random` travado em `v`. */
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
// (o monstro EVASIVO do PoE: o Rastejador do nível 62, 5739 de evasão — o golpe do personagem de teste, com 308 de precisão, acerta 44% pela conta do PoB)
const EVASIVO = 'poe-crawler-62';
/** O personagem com as gemas na espada, numa caçada; o alvo imortal colado (evasivo, se pedido) e os outros longe. */
async function montar(slugs, { anel = null, evasivo = true } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca('One_Hand_Swords/Rusted_Sword');
  a.soquetes = { abertos: slugs.length, links: Array(Math.max(0, slugs.length - 1)).fill(true), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  if (anel) e.equipment.ring = { id: 78, poe: { af: anel } };
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: doSlug(s).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < slugs.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(slugs[0]).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, c, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, ...(evasivo ? { key: EVASIVO } : {}) });
  Object.assign(c, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 61, hp: 1e12, maxHp: 1e12, estados: {} });
  return { e, b, c };
}
/** Usa a gema do slot 0 com o sorteio travado em `v` (a magia conclui a conjuração). */
function usar(e, b, v = 0.5) {
  return travado(v, () => {
    const eventos = [];
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    eventos.push(...(r.eventos ?? []));
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM)?.eventos ?? [])); }
    return { r, eventos };
  });
}
const errosEm = (eventos, b) => eventos.filter((x) => x.t === 'block' && x.errou && x.uid === b.uid).length;
const danoEm = (eventos, b) => eventos.filter((x) => x.t === 'dmg' && x.foe && x.uid === b.uid).length;
/** A ficha do USO da gema (as linhas dela e as dos suportes, com as tags da habilidade) — o que o `acertar` passa ao `Defesa.errou`. */
function fichaDoUso(e, slug) {
  const ef = GS.efeitoNaSkill(e, G.doSlug(slug).acao);
  const entry = { id: G.doSlug(slug).acao, poeGema: { slug, ataque: true } };
  return ModsPoe.fichaDoGolpe(Acoes.comAsLinhasDaGema(e, Ficha.combate(e), entry, ef), ['habilidade', ...Acoes.tagsPoeDaSkill(entry)], { estado: e });
}

test('A5b: as linhas da precisão viram os atributos do uso, e a Precisão Adicional sai de parcial', { skip: SEM }, () => {
  assert.deepEqual(L.atributosDaLinha('+1034 de Precisão'), { accuracy: 1034 });
  assert.deepEqual(L.atributosDaLinha('20% de Precisão aumentada'), { accuracy_inc: 20 });
  assert.deepEqual(L.atributosDaLinha('Não pode ser Evadido'), { nunca_erra: 1 });
  const s = SP.doSlug('Additional_Accuracy_Support');
  assert.equal(s.status, 'funciona', JSON.stringify(s.motivos));
  const ef = SP.efeitoNoNivel('Additional_Accuracy_Support', 20, 20, { tags: ['poe:Ataque'] }).efeito;
  assert.deepEqual([ef['af:accuracy'], ef['af:accuracy_inc']], [1034, 20]);
  // as gemas "Não pode ser Evadido" (as Vaal de ataque, a Evisceração, o Punho Esmagador…) levam o `nunca_erra` local
  for (const slug of ['Vaal_Cleave', 'Eviscerate', 'Crushing_Fist', 'Vaal_Double_Strike']) assert.equal(G.linhasLocaisNoNivel(slug, 20, 0).af.nunca_erra, 1, slug);
});

test('A5b: a precisão do uso — a da ficha com o "+X" e o "% aumentada" do suporte; sem linhas, a mesma da ficha', { skip: SEM }, async () => {
  const sem = await montar(['Heavy_Strike']);
  const com = await montar(['Heavy_Strike', 'Additional_Accuracy_Support']);
  const f = Ficha.combate(sem.e);
  assert.equal(f.accuracy, 308);
  assert.deepEqual(f.contaDaPrecisao, { base: 180, fixos: 40, pct: 40, fator: 1, localPrincipal: 0, localSecundaria: 0 });
  assert.equal(fichaDoUso(sem.e, 'Heavy_Strike').accuracy, 308, 'sem suporte: a precisão da ficha');
  // (180 + 40 + 1034) × (1 + 40%) = 1755,6 — a gema na qualidade 0
  assert.equal(fichaDoUso(com.e, 'Heavy_Strike').accuracy, 1756);
  assert.equal(Ficha.combate(com.e).accuracy, 308, 'a ficha do personagem não muda: só o uso');
  // a chance contra o evasivo, pela conta do PoB: round(1,25 × 308 / (308 + (5739 / 5)^0,9) × 100) / 100 = 0,44; com o suporte, 0,94
  const lv = Atributos.levelDoBicho(sem.e.hunt, sem.b);
  const ev = AtributosDoMob.evasaoDe(sem.b, lv);
  assert.equal(ev, 5739);
  const ch = (p) => Atributos.chanceDeAcerto(p, lv, ev);
  assert.equal(ch(308), Math.round(((1.25 * 308) / (308 + (5739 / 5) ** 0.9)) * 100) / 100);
  assert.deepEqual([ch(308), ch(1756)], [0.44, 0.94]);
});

test('A5b: a gema de ataque erra o evasivo — o evento do golpe básico, sem dano nem afecção; com a Precisão Adicional, acerta', { skip: SEM }, async () => {
  const sem = await montar(['Heavy_Strike']);
  const hp = sem.b.hp;
  const u = usar(sem.e, sem.b, 0.5);
  assert.ok(u.r.ok, u.r.erro);
  assert.equal(errosEm(u.eventos, sem.b), 1, 'errou');
  assert.equal(danoEm(u.eventos, sem.b), 0, 'sem dano');
  assert.equal(sem.b.hp, hp);
  assert.deepEqual(Object.keys(sem.b.estados ?? {}).filter((k) => !/^errosDo/.test(k)), [], 'sem afecção nem estado');
  const ev = u.eventos.find((x) => x.t === 'block' && x.errou);
  assert.deepEqual({ ...ev, uid: 0, x: 0, y: 0 }, { t: 'block', uid: 0, x: 0, y: 0, color: '#999999', esquiva: true, errou: true });
  // o mesmo sorteio, com a Precisão Adicional: acerta
  const com = await montar(['Heavy_Strike', 'Additional_Accuracy_Support']);
  const u2 = usar(com.e, com.b, 0.5);
  assert.ok(u2.r.ok, u2.r.erro);
  assert.equal(errosEm(u2.eventos, com.b), 0);
  assert.equal(danoEm(u2.eventos, com.b), 1);
  assert.ok(com.b.hp < 1e12);
  // o monstro sem evasão: 100% (o teto do PoE 1) — acerta até no sorteio de 0,999
  assert.equal(Formulas.PARAMETROS.acerto.poe.maximo, 1);
  const comum = await montar(['Heavy_Strike'], { evasivo: false });
  assert.equal(danoEm(usar(comum.e, comum.b, 0.999).eventos, comum.b), 1);
});

test('A5b: as exceções — "Acertos não podem ser Evadidos" (a peça), a Técnica Resoluta e o "Não pode ser Evadido" da gema', { skip: SEM }, async () => {
  // a peça: o anel com "Acertos não podem ser Evadidos" — a gema acerta o evasivo até no sorteio de 0,999
  const comAnel = await montar(['Heavy_Strike'], { anel: { nunca_erra: 1 } });
  assert.equal(Ficha.combate(comAnel.e).nuncaErra, true);
  const u = usar(comAnel.e, comAnel.b, 0.999);
  assert.equal(errosEm(u.eventos, comAnel.b), 0);
  assert.equal(danoEm(u.eventos, comAnel.b), 1);
  // a Técnica Resoluta (a keystone põe `nuncaErra` na ficha): a ficha do golpe o carrega, e `Defesa.errou` não rola
  const { e, b } = await montar(['Heavy_Strike']);
  const f = fichaDoUso(e, 'Heavy_Strike');
  assert.equal(travado(0.999, () => Defesa.errou(f, e.hunt, b)), true, 'sem a exceção, erra');
  assert.equal(travado(0.999, () => Defesa.errou({ ...f, nuncaErra: true }, e.hunt, b)), false, 'a Técnica Resoluta');
  // a gema Vaal "Não pode ser Evadido": a ficha do uso dela leva `nuncaErra`
  const vaal = ModsPoe.fichaDoGolpe(Acoes.comAsLinhasDaGema(e, Ficha.combate(e), { id: 'x', poeGema: { slug: 'Vaal_Cleave', ataque: true } }, { nivel: 20, qualidade: 0 }), ['habilidade', 'ataque', 'corpo', 'area'], { estado: e });
  assert.equal(vaal.nuncaErra, true);
  assert.equal(travado(0.999, () => Defesa.errou(vaal, e.hunt, b)), false);
  assert.equal(Ficha.combate(e).nuncaErra, undefined, 'só no uso da gema');
});

test('A5b: a magia nunca erra — o mesmo evasivo, o sorteio que faz o ataque errar', { skip: SEM }, async () => {
  const { e, b } = await montar(['Fireball']);
  const u = usar(e, b, 0.999);
  assert.ok(u.r.ok, u.r.erro);
  assert.equal(errosEm(u.eventos, b), 0);
  assert.ok(b.hp < 1e12, 'a Bola de Fogo acertou');
});

test('A5b: a área do ataque rola o acerto de cada alvo — o evasivo é errado, o sem evasão é acertado', { skip: SEM }, async () => {
  const { e, b, c } = await montar(['Cleave']);
  // os dois colados na frente: `b` evasivo, `c` sem evasão
  Object.assign(c, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y + 1 });
  const u = usar(e, b, 0.5);
  assert.ok(u.r.ok, u.r.erro);
  assert.equal(errosEm(u.eventos, b), 1, 'o evasivo foi errado');
  assert.equal(b.hp, 1e12);
  assert.equal(errosEm(u.eventos, c), 0);
  assert.ok(c.hp < 1e12, 'o outro foi acertado');
});

test('A5b: a conta do acerto do PoE 1 pelo PoB — 1,25 × a / (a + (e/5)^0,9), em 2 casas, de 5% a 100%; a esquiva é o complemento', { skip: SEM }, () => {
  const pob = (a, e) => Math.min(1, Math.max(0.05, Math.round(((1.25 * a) / (a + (e / 5) ** 0.9)) * 100) / 100));
  for (const [a, e] of [[308, 5739], [1756, 5739], [1000, 2373], [500, 1000], [100, 20000], [1e9, 0], [0, 1000]]) assert.equal(Formulas.chanceDeAcertoPoe(a, e), a > 0 ? pob(a, e) : 0.05, `${a} × ${e}`);
  assert.equal(Formulas.chanceDeAcertoPoe(1e9, 0), 1);
  assert.equal(Formulas.chanceDeAcertoPoe(1, 1e7), 0.05);
  // a esquiva do jogador: 1 − a chance do monstro (o mesmo PoB)
  assert.equal(Atributos.chanceDeEsquiva(5739, 62, 308), 1 - 0.44);
});

test('A5b: duas armas — a precisão LOCAL da arma vale só na mão dela (`fichaDaMao`)', { skip: SEM }, async () => {
  const { e } = await montar(['Heavy_Strike']);
  e.equipment.shield = peca('One_Hand_Swords/Rusted_Sword');
  e.equipment.weapon.poe.af = { ...e.equipment.weapon.poe.af, accuracy_local: 500 };
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  assert.equal(f.duasArmas, true);
  assert.deepEqual([f.contaDaPrecisao.localPrincipal, f.contaDaPrecisao.localSecundaria], [500, 0], JSON.stringify(f.contaDaPrecisao));
  // (as duas Espadas Enferrujadas: 40% de Precisão Global cada — o implícito, global — = 80%) (180 + 40 + 500) × 1,8 = 1296 na principal; (180 + 40) × 1,8 = 396
  // na secundária; a média das locais no golpe das duas (a Cutilada)
  assert.deepEqual([f.contaDaPrecisao.fixos, f.contaDaPrecisao.pct], [40, 80]);
  assert.equal(f.accuracy, 1296);
  assert.equal(Ficha.fichaDaMao(f, 'secundaria').accuracy, 396);
  assert.equal(Ficha.fichaDaMao(f, 'ambas', [1, 1]).accuracy, Math.round((220 + 250) * 1.8));
  // e a ficha do golpe da secundária com a Precisão Adicional: a local da secundária (0) + 1034 — (220 + 1034) × 1,8
  const ent = { id: G.doSlug('Heavy_Strike').acao, poeGema: { slug: 'Heavy_Strike', ataque: true } };
  const daSec = ModsPoe.fichaDoGolpe(Acoes.comAsLinhasDaGema(e, Ficha.fichaDaMao(f, 'secundaria'), ent, { nivel: 20, qualidade: 0, 'af:accuracy': 1034 }), ['habilidade', 'ataque', 'corpo'], { estado: e });
  assert.equal(daSec.accuracy, Math.round(1254 * 1.8));
});

test('A5b: a Técnica Precisa por uso — a precisão DO USO contra a vida máxima', { skip: SEM }, async () => {
  const { e } = await montar(['Heavy_Strike', 'Additional_Accuracy_Support']);
  e.maxHp = 1500;
  const ent = { id: G.doSlug('Heavy_Strike').acao, poeGema: { slug: 'Heavy_Strike', ataque: true } };
  const ef = GS.efeitoNaSkill(e, ent.id);
  const tags = ['habilidade', 'ataque', 'corpo'];
  // a ficha não passou (308 < 1500), o uso passa (1756 > 1500): 40% mais
  const f0 = { ...Ficha.combate(e), tecnicaPrecisa: { fator: 1.4, aplicada: false } };
  const comSuporte = ModsPoe.fichaDoGolpe(Acoes.comAsLinhasDaGema(e, f0, ent, ef), tags, { estado: e, rng: () => 0.999 });
  assert.ok(Math.abs((comSuporte.fatorDasCargas ?? 1) / (f0.fatorDasCargas ?? 1) - 1.4) < 1e-9, String(comSuporte.fatorDasCargas));
  // sem o suporte: a do uso (308) não passa — nada muda
  const semLinhas = ModsPoe.fichaDoGolpe(f0, tags, { estado: e, rng: () => 0.999 });
  assert.equal(semLinhas.fatorDasCargas ?? 1, f0.fatorDasCargas ?? 1);
  // a ficha passou (vida baixa) e o uso também: nada a mais; o uso abaixo da vida desfaz os 40%
  e.maxHp = 1000;
  const f1 = { ...Ficha.combate(e), tecnicaPrecisa: { fator: 1.4, aplicada: true }, accuracy: 1100 };
  const igual = ModsPoe.fichaDoGolpe(Acoes.comAsLinhasDaGema(e, f1, ent, ef), tags, { estado: e, rng: () => 0.999 });
  assert.equal(igual.fatorDasCargas ?? 1, f1.fatorDasCargas ?? 1, 'a ficha e o uso passam: os 40% da ficha, uma vez');
  // (a conta da ficha com −2000 de fixos: o uso, mesmo com +1034, fica abaixo da vida — os 40% que a ficha já pôs saem)
  const baixo = { ...f1, contaDaPrecisao: { ...f1.contaDaPrecisao, fixos: -2000 } };
  const desfeito = ModsPoe.fichaDoGolpe(Acoes.comAsLinhasDaGema(e, baixo, ent, ef), tags, { estado: e, rng: () => 0.999 });
  assert.ok(Math.abs((desfeito.fatorDasCargas ?? 1) * 1.4 - (f1.fatorDasCargas ?? 1)) < 1e-9, String(desfeito.fatorDasCargas));
});

test('A5b: os acertos de ataque que saem por fora do uso (a Onda de Choque e a Tormenta do Vazio, a Torre Óssea) rolam o acerto; os Arautos não', { skip: SEM }, async () => {
  const { e, b } = await montar(['Heavy_Strike']);
  const id = G.doSlug('Heavy_Strike').acao;
  const ev = [];
  assert.equal(travado(0.5, () => Acoes.acertoDoArauto(e, e.hunt, id, b, 1000, 'physical', { eventos: ev, ataque: true })), null, 'errou');
  assert.equal(errosEm(ev, b), 1);
  assert.equal(b.hp, 1e12);
  // sem `ataque` (os Arautos, a Onda Arcana): não rola
  const ev2 = [];
  assert.ok(travado(0.5, () => Acoes.acertoDoArauto(e, e.hunt, id, b, 1000, 'physical', { eventos: ev2 })) > 0);
  assert.equal(errosEm(ev2, b), 0);
});

test('A5b: o simulador — a gema de ataque com a precisão do uso; a magia e o "não pode ser evadido" com 1', { skip: SEM }, async () => {
  const sem = await montar(['Heavy_Strike']);
  const com = await montar(['Heavy_Strike', 'Additional_Accuracy_Support']);
  const id = G.doSlug('Heavy_Strike').acao;
  const s1 = Simulador.simular(sem.e, id, { level: 62, evasao: 5739 });
  const s2 = Simulador.simular(com.e, id, { level: 62, evasao: 5739 });
  assert.ok(s1.ok, s1.erro);
  assert.deepEqual([s1.alvo.chanceDeAcerto, s2.alvo.chanceDeAcerto], [0.44, 0.94]);
  const mag = await montar(['Fireball']);
  assert.equal(Simulador.simular(mag.e, G.doSlug('Fireball').acao, { level: 62, evasao: 5739 }).alvo.chanceDeAcerto, 1);
  const anel = await montar(['Heavy_Strike'], { anel: { nunca_erra: 1 } });
  assert.equal(Simulador.simular(anel.e, id, { level: 62, evasao: 5739 }).alvo.chanceDeAcerto, 1);
});
