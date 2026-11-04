// O lote "luz" (dono, 02/11: "escuridão em volta" — "tem que estar tudo 100%"): o RAIO DE ILUMINAÇÃO do PoE. O stat na ficha (a soma dos
// "aumento/redução do Raio de Iluminação" das peças, da árvore, das maestrias e dos frascos), o raio na tela da caçada (a base × o aumentado ×
// a vida — ou o Escudo, com o "Campo de Visão é baseado no Escudo de Energia" — × a Cegueira), o que depende da luz (o dano e a área da Coroa
// de Phrecia, a Precisão, o Fogo do Eclipse Solaris, a Glória Dourada do Luminary no mercenário), o tamanho no desenho (o personagem, os
// zumbis, os golens, os monstros "Enormes") e a escuridão do cliente (`frontend/client/src/iluminacao.mjs`, `map.mjs`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Luz = await import('../systems/itens-poe/iluminacao.mjs');
const Vinculos = await import('../systems/itens-poe/vinculos.mjs');
const Frascos = await import('../systems/itens-poe/frascos.mjs');
const MM = await import('../systems/itens-poe/modificadores-monstro.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const Tela = await import('../frontend/client/src/iluminacao.mjs');

const traduz = (texto, valores) => T.traduzirParte(texto, valores ?? (texto.match(/\{(\d+)\}/g) ?? []).map(() => 10));
function comAf(af, extra = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ring: { id: 1, poe: { af } } };
  Object.assign(e, extra);
  Ficha.invalidar(e);
  return e;
}
const afDe = (e) => { Ficha.invalidar(e); return Ficha.combate(e).afPoe; };

test('as linhas da luz e do tamanho têm efeito (nenhuma "não se aplica ao jogo")', { skip: SEM }, () => {
  const casos = {
    '{0}% de aumento do Raio de Iluminação': [['light_radius', 10]],
    '{0}% de redução do Raio de Iluminação': [['light_radius', -10]],
    'Raio de Iluminação aumentado em {0}%': [['light_radius', 10]],
    'Raio aumentado em {0}% durante o Efeito': [['light_radius', 10]],
    'Campo de Visão é baseado no Escudo de Energia em vez de na Vida': [['luz_pelo_escudo', 1]],
    'Cegueira não afeta seu Campo de Visão': [['cegueira_sem_luz', 1]],
    'Cegueira não afeta seu Raio de Iluminação': [['cegueira_sem_luz', 1]],
    'Aumentos e Reduções ao Raio de Iluminação também são aplicados ao Dano': [['dmg_inc%stat:light_radius', 1]],
    'Aumentos e Reduções ao Raio de Iluminação também são aplicados ao Efeito em Área em {0}% de seu valor': [['area_inc%stat:light_radius', 0.5]],
    'Aumentos e Reduções ao Raio de Iluminação também se aplicam à Precisão': [['accuracy_inc%stat:light_radius', 1]],
    'Adiciona de {0} a {1} de dano de fogo aos ataques por {2}% de campo de visão aumentada': [['added_fire_dmg_min%stat:light_radius', 2], ['added_fire_dmg_max%stat:light_radius', 5]],
    'Aumentos e reduções de campo de visão também se aplicam ao efeito dos seus bônus de habilidade de conexão no seu mercenário': [['luz_no_vinculo_mercenario', 1]],
    'Tamanho do Personagem aumentado em {0}%': [['tamanho_personagem', 10]],
    'Tamanho do Zumbi aumentado em {0}%': [['tamanho_zumbi', 10]],
    '{0}% de redução do Tamanho dos Golens': [['tamanho_golem', -10]],
  };
  const valores = { 'Aumentos e Reduções ao Raio de Iluminação também são aplicados ao Efeito em Área em {0}% de seu valor': [50], 'Adiciona de {0} a {1} de dano de fogo aos ataques por {2}% de campo de visão aumentada': [2, 5, 1] };
  for (const [texto, esperado] of Object.entries(casos)) {
    const t = traduz(texto, valores[texto]);
    assert.equal(t.estado, 'novo', texto);
    assert.deepEqual(t.efeitos.map((x) => [x.stat, x.valor]), esperado, texto);
    assert.ok(!/não se aplica/.test(t.nota ?? ''), texto);
  }
  // (o híbrido do sufixo: a Precisão e a luz, as duas com efeito)
  const h = T.traduzirMod({ modelo: '{0}% de aumento da Precisão Global / {1}% de aumento do Raio de Iluminação', valores: [12, 10] });
  assert.equal(h.estado, 'novo');
  assert.deepEqual(h.efeitos.map((x) => x.stat), ['accuracy_inc', 'light_radius']);
  // (nenhuma regra da tradução fala de luz/visão/tamanho como "não se aplica")
  const tab = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/traducao.json', import.meta.url), 'utf8'));
  const sobra = tab.regras.filter((r) => /raio de luz|campo de vis|luz, visão, tamanho/i.test(r.nota ?? '') && /não se aplica/.test(r.nota ?? ''));
  assert.deepEqual(sobra.map((r) => r.padrao), []);
});

test('a ÁRVORE: a luz e o Luminary sem "não se aplica" — o light_radius dos nós entra na ficha', { skip: SEM }, () => {
  const linhas = [];
  for (const n of P.arvore().nos) {
    for (const [i, t] of (n.textos ?? []).entries()) linhas.push({ t, estado: n.estados?.[i], nota: n.notas?.[i] ?? '' });
    for (const o of n.opcoes ?? []) for (const [i, t] of (o.textos ?? []).entries()) linhas.push({ t, estado: o.estados?.[i], nota: o.notas?.[i] ?? '' });
  }
  const daLuz = linhas.filter((l) => /Raio de Iluminação|campo de visão/i.test(l.t));
  assert.ok(daLuz.length >= 15, `${daLuz.length} linhas de luz`);
  for (const l of daLuz) {
    assert.equal(l.estado, 'novo', l.t);
    assert.ok(!/não se aplica/.test(l.nota), l.t);
  }
  const no = P.arvore().nos.find((n) => n.nome === 'Luz da Divindade');
  assert.ok(no.efeitos.some((x) => x.add === 'light_radius' && x.valor === 10));
});

test('o RAIO na tela: a base × o aumentado × a vida (ou o Escudo) × a Cegueira, nos limites', { skip: SEM }, () => {
  const { baseCasas, pisoDaVidaPct, cegueiraMenosPct } = Luz.LUZ;
  assert.equal(Luz.raioDaLuz({ hp: 100, maxHp: 100 }, {}), baseCasas);
  // +30%: 6 × 1,3 = 7,8 casas com a vida cheia
  assert.equal(Luz.raioDaLuz({ hp: 100, maxHp: 100 }, { light_radius: 30 }), 7.8);
  // −50% (O Monarca Sombrio): 3 casas
  assert.equal(Luz.raioDaLuz({ hp: 100, maxHp: 100 }, { light_radius: -50 }), 3);
  // com metade da vida: 7,8 × (0,5 + 0,5 × 0,5) = 5,85 → 5,9 (arredonda em décimos)
  assert.equal(Luz.raioDaLuz({ hp: 50, maxHp: 100 }, { light_radius: 30 }), 5.9);
  assert.equal(pisoDaVidaPct, 50);
  // o Campo de Visão pelo Escudo: a vida não conta, o Escudo sim
  assert.equal(Luz.raioDaLuz({ hp: 10, maxHp: 100, es: 200, maxEsPoe: 200 }, { luz_pelo_escudo: 1 }), baseCasas);
  assert.equal(Luz.raioDaLuz({ hp: 100, maxHp: 100, es: 0, maxEsPoe: 200 }, { luz_pelo_escudo: 1 }), baseCasas * pisoDaVidaPct / 100);
  // a Cegueira em você encolhe a luz; "Cegueira não afeta seu Campo de Visão" tira isso
  const hunt = { clock: 1000, debuffsDoJogador: { cego: { ate: 5000 } } };
  assert.equal(Luz.raioDaLuz({ hp: 100, maxHp: 100 }, {}, hunt), baseCasas * (1 - cegueiraMenosPct / 100));
  assert.equal(Luz.raioDaLuz({ hp: 100, maxHp: 100 }, { cegueira_sem_luz: 1 }, hunt), baseCasas);
  assert.equal(Luz.raioDaLuz({ hp: 100, maxHp: 100 }, {}, { ...hunt, clock: 6000 }), baseCasas, 'a Cegueira acabou');
  // os limites: o PoE trava a redução em −90%; o desenho não passa do mínimo nem do máximo
  assert.equal(Luz.aumentoDaLuz({ light_radius: -300 }), -90);
  assert.equal(Luz.raioDaLuz({ hp: 1, maxHp: 100 }, { light_radius: -90 }), Luz.LUZ.minimoCasas);
  assert.equal(Luz.raioDaLuz({ hp: 100, maxHp: 100 }, { light_radius: 900 }), Luz.LUZ.maximoCasas);
  const c = Luz.paraCliente({ hp: 100, maxHp: 100 }, { light_radius: 30, tamanho_personagem: 15 }, hunt);
  assert.deepEqual(c, { raio: 3.9, base: baseCasas, aumento: 30, tamanho: 1.15, cego: true });
});

test('a FICHA soma a luz (peças, frasco) e o que depende dela vale: dano, área, precisão, o Fogo do Eclipse Solaris', { skip: SEM }, () => {
  const sem = afDe(comAf({}));
  const e = comAf({ light_radius: 20, 'dmg_inc%stat:light_radius': 1, 'area_inc%stat:light_radius': 0.5, 'accuracy_inc%stat:light_radius': 1, 'added_fire_dmg_min%stat:light_radius': 2, 'added_fire_dmg_max%stat:light_radius': 5 });
  const af = afDe(e);
  assert.equal(af.light_radius, 20);
  assert.equal((af.dmg_inc ?? 0) - (sem.dmg_inc ?? 0), 20, 'Phrecia: o aumentado da luz no Dano');
  assert.equal((af.area_inc ?? 0) - (sem.area_inc ?? 0), 10, 'Phrecia: metade na Área');
  assert.equal((af.accuracy_inc ?? 0) - (sem.accuracy_inc ?? 0), 20, 'o aumentado da luz na Precisão');
  assert.equal((af.added_fire_dmg_min ?? 0) - (sem.added_fire_dmg_min ?? 0), 40, 'o Eclipse Solaris: 2 por 1%');
  assert.equal((af.added_fire_dmg_max ?? 0) - (sem.added_fire_dmg_max ?? 0), 100, 'o Eclipse Solaris: 5 por 1%');
  // a redução também entra (o PoB soma o INC: "Aumentos e Reduções")
  const r = afDe(comAf({ light_radius: -40, 'dmg_inc%stat:light_radius': 1 }));
  assert.equal((r.dmg_inc ?? 0) - (sem.dmg_inc ?? 0), -40);
  // o frasco: "Raio aumentado em 25% durante o Efeito" (o Destilado da Adivinhação)
  const par = Frascos.parametros({ poe: { classe: 'Utility_Flasks', base: 'Utility_Flasks/x', modificadores: [{ modelo: 'Raio aumentado em {0}% durante o Efeito', valores: [25] }] } });
  assert.equal(par.durante?.af?.light_radius ?? par.af?.light_radius, 25);
});

test('a Coroa de Phrecia de verdade: a luz da peça no Dano e na Área', { skip: SEM }, async () => {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  J.iniciar(ITEM_CATALOG);
  const cat = Catalogo.catalogo();
  const [classe, u] = Object.entries(cat.classes).map(([k, c]) => [k, (c.unicos ?? []).find((x) => x.slug === 'Wreath_of_Phrecia')]).find(([, x]) => x) ?? [];
  assert.ok(u, 'a Coroa de Phrecia no catálogo');
  const base = cat.classes[classe].bases.find((b) => b.nome === u.base);
  const peca = J.pecaDoJogo(gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 80, rng: () => 0, unico: 'Wreath_of_Phrecia' }));
  const sem = afDe(comAf({}));
  const e = comAf({});
  e.equipment.head = peca;
  const af = afDe(e);
  assert.ok(af.light_radius >= 15, `luz ${af.light_radius}`);
  assert.equal((af.dmg_inc ?? 0) - (sem.dmg_inc ?? 0), af.light_radius);
  assert.equal((af.area_inc ?? 0) - (sem.area_inc ?? 0), af.light_radius / 2);
});

test('a GLÓRIA DOURADA: o aumentado da luz soma no Efeito do Vínculo só no mercenário', { skip: SEM }, () => {
  assert.equal(Luz.luzNoMercenarioPct({ light_radius: 25 }), 0, 'sem o nó, nada');
  assert.equal(Luz.luzNoMercenarioPct({ light_radius: 25, luz_no_vinculo_mercenario: 1 }), 25);
  const lk = { desde: 0, ate: 10_000, efeitos: { critMult: 20 }, foto: { efeitoPct: 10, luzNoMercenarioPct: 25 }, alvos: [{ tipo: 'lacaio', uid: 'm1', mercenario: true }, { tipo: 'lacaio', uid: 'z1' }] };
  const hunt = { clock: 1000, vinculos: [lk] };
  // no mercenário: × (1 + (10 + 25)%) = 27; no lacaio comum: × 1,1 = 22
  assert.equal(Math.round(Vinculos.doLacaio(hunt, { uid: 'm1', mercenario: true }).critMult * 100) / 100, 27);
  assert.equal(Math.round(Vinculos.doLacaio(hunt, { uid: 'z1' }).critMult * 100) / 100, 22);
});

test('o TAMANHO no desenho: o personagem, os zumbis, os golens e os monstros Enormes', { skip: SEM }, () => {
  assert.equal(Luz.tamanhoDoPersonagem({}), 1);
  assert.equal(Luz.tamanhoDoPersonagem({ tamanho_personagem: 15 }), 1.15);
  assert.equal(Luz.tamanhoDoPersonagem({ tamanho_personagem: 500 }), Luz.TAMANHO.maximo);
  assert.equal(Luz.tamanhoDoLacaio({ tamanho_zumbi: 25 }, { nome: 'Zumbi' }), 1.25);
  assert.equal(Luz.tamanhoDoLacaio({ tamanho_zumbi: 25, tamanho_golem: -25 }, { nome: 'Golem de Pedra' }), 0.75);
  assert.equal(Luz.tamanhoDoLacaio({ tamanho_zumbi: 25 }, { nome: 'Esqueleto' }), 1);
  // o Enorme (Gargantuan): "Tamanho do Personagem aumentado em 40%"
  const enorme = MM.DADOS.mods.find((m) => m.nomeEn === 'Gargantuan');
  assert.ok(enorme);
  assert.equal(Luz.tamanhoDoMonstro({ mods: [`poe:${enorme.id}`] }, MM.DADOS), 1.4);
  assert.equal(Luz.tamanhoDoMonstro({ mods: [] }, MM.DADOS), 1);
});

test('a CAÇADA manda a luz e os tamanhos no retrato', { skip: SEM }, async () => {
  const Cacadas = await import('../systems/cacadas.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Marauder', sistema: 'poe' });
  e.equipment = { ...e.equipment, ring: { id: 1, poe: { af: { light_radius: 50, tamanho_personagem: 20 } } } };
  Ficha.invalidar(e);
  const o = Math.random;
  Math.random = () => 0.999;
  try { assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok); } finally { Math.random = o; }
  e.hp = e.maxHp;
  Ficha.invalidar(e);
  const s = Cacadas.snapshotDaHunt(e);
  assert.equal(s.luz.raio, 9);
  assert.equal(s.luz.tamanho, 1.2);
  assert.equal(s.luz.aumento, 50);
  // a vida pela metade: 9 × 0,75 = 6,75 → 6,8
  e.hp = e.maxHp / 2;
  assert.equal(Cacadas.snapshotDaHunt(e).luz.raio, 6.8);
  // o monstro Enorme sai maior
  const enorme = MM.DADOS.mods.find((m) => m.nomeEn === 'Gargantuan');
  e.hunt.monstros[0].mods = [`poe:${enorme.id}`];
  assert.equal(Cacadas.snapshotDaHunt(e).monsters[0].escala, 1.4);
});

test('o CLIENTE: a escuridão em volta, os monstros apagados fora da luz e o desenho na escala', () => {
  assert.equal(Tela.raioEmPixels(null), null);
  assert.equal(Tela.raioEmPixels({ raio: 6 }, 32), 192);
  const g = Tela.gradienteDaLuz(192);
  assert.ok(g.interno < 192 && g.externo > 192);
  // escuro suave, não preto total
  assert.ok(Tela.LUZ_DA_TELA.escuridao > 0.3 && Tela.LUZ_DA_TELA.escuridao < 0.8);
  assert.match(g.paradas[0][1], /,0\)$/);
  assert.equal(Tela.alfaNaLuz(100, 192), 1);
  assert.equal(Tela.alfaNaLuz(192 * 2, 192), Tela.LUZ_DA_TELA.apagado);
  const meio = Tela.alfaNaLuz(192 * (1 + Tela.LUZ_DA_TELA.borda) / 2, 192);
  assert.ok(meio < 1 && meio > Tela.LUZ_DA_TELA.apagado);
  assert.equal(Tela.escalaDoDesenho(undefined), 1);
  assert.equal(Tela.escalaDoDesenho(1.15), 1.15);
  assert.equal(Tela.escalaDoDesenho(9), Tela.LUZ_DA_TELA.escalaMaxima);
  // o raio anda até o do servidor, sem pulo
  const r1 = Tela.suavizarRaio(192, 96, 16);
  assert.ok(r1 < 192 && r1 > 96);
  assert.equal(Tela.suavizarRaio(null, 96, 16), 96);
  assert.equal(Tela.suavizarRaio(100, 96, 5000), 96);
  // o desenho no canvas: um gradiente radial com as paradas, a tela inteira
  const chamadas = [];
  const grad = { addColorStop: (p, c) => chamadas.push(['parada', p, c]) };
  const ctx = { save() {}, restore() {}, set fillStyle(v) { chamadas.push(['fill', v === grad]); }, createRadialGradient: (...a) => { chamadas.push(['radial', ...a]); return grad; }, fillRect: (...a) => chamadas.push(['rect', ...a]) };
  assert.equal(Tela.desenharEscuridao(ctx, 368, 208, 192, 736, 416), true);
  assert.deepEqual(chamadas.find((c) => c[0] === 'radial').slice(1, 3), [368, 208]);
  assert.deepEqual(chamadas.find((c) => c[0] === 'rect'), ['rect', 0, 0, 736, 416]);
  assert.equal(Tela.desenharEscuridao(ctx, 0, 0, 0, 10, 10), false);
  // o map.mjs usa: a luz do retrato, a escuridão depois dos efeitos e a escala/apagado no drawEntity
  const map = readFileSync(new URL('../frontend/client/src/map.mjs', import.meta.url), 'utf8');
  assert.match(map, /this\.luz = payload\.luz \?\? null/);
  assert.match(map, /this\.drawEscuridao\(\);/);
  assert.match(map, /escalaDoDesenho\(entity\.isPlayer \? this\.luz\?\.tamanho : entity\.escala\)/);
});
