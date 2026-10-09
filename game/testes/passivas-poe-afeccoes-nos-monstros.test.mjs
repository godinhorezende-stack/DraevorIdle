// As AFECÇÕES DO PERSONAGEM NOS MONSTROS da árvore do PoE de ponta a ponta (09/10): o nó real alocado pelo servidor → a ficha → a ficha do
// GOLPE (as afecções dele — `fichaDoGolpe`) → o acerto (`AfeccoesPoe.aoAcertar`, `ModsPoe.aoAcertar`, `ModsPoe.aoPorAfeccoes`) → o monstro
// (a Eletrização, o Resfriamento, o Congelamento, o Empalamento, o Sangramento, o Veneno) → o dano que ele recebe (`resistido`) e o que ele
// causa (`doBicho`, `criticoDoBicho`).
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
const Estados = await import('../systems/skills/estados.mjs');
await import('../systems/cacadas.mjs'); // (registra a Redução de Dano Física do empalamento)
const { resistido, resistenciaDe } = await import('../systems/hunt/resistencia.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

const PECA = (classe, af = {}) => ({ id: 3357, count: 1, poe: { classe, base: `${classe}/X`, af, prefixos: [], sufixos: [], implicitos: [] } });
function novo(classe = 'Scion') {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 100 }), { sistema: 'poe', classePoe: classe });
  delete e.classe;
  P.garantir(e);
  e.equipment = {};
  return e;
}
/** O nó (ou a opção de maestria) com um efeito cuja chave casa `re`: a principal primeiro, depois as maestrias. */
function achar(re) {
  const tem = (efs) => (efs ?? []).some((x) => re.test(x.add ?? ''));
  const arv = P.arvore();
  const comum = arv.nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && tem(n.efeitos));
  if (comum) return { no: comum };
  for (const n of arv.nos.filter((x) => x.tipo === 'mastery' && !x.ascendencia)) {
    const o = (n.opcoes ?? []).find((x) => tem(x.efeitos));
    if (o) return { no: n, opcao: o.id };
  }
  return null;
}
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
const com = (re) => { const e = novo(); alocar(e, achar(re)); return e; };
function naAscendencia(re) {
  const no = P.arvore().nos.find((n) => n.ascendencia && (n.efeitos ?? []).some((x) => re.test(x.add ?? '')));
  assert.ok(no, `há nó de ascendência com ${re}`);
  const e = novo(P.arvore().ascendencias[no.ascendencia].classe);
  e.passivas.ascendencia = no.ascendencia;
  Comandos.depoisDeMudar(e);
  assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, no.id) }).ok);
  return e;
}
const keystone = (nome) => { const e = novo(); alocar(e, { no: P.arvore().nos.find((n) => n.tipo === 'keystone' && n.nome === nome) }); return e; };
const golpe = (e, tags = ['ataque', 'corpo', 'fisico']) => { Ficha.invalidar(e); return ModsPoe.fichaDoGolpe(Ficha.combate(e), tags, { estado: e }); };
const bicho = (extra = {}) => ({ uid: 9, key: 'rat', name: 'Rato', x: 1, y: 0, hp: 1e6, maxHp: 100, ...extra });
const acertar = (e, b, partes, opcoes = {}) => AfeccoesPoe.aoAcertar(b, partes, { afeccoes: golpe(e).afeccoes, agora: 1000, rng: () => 0, ...opcoes });

test('ELETRIZAÇÃO: o máximo a mais (a maestria real), o mínimo (o Elementalista), a parte da Mana (a maestria) e as N Eletrizações somadas (o Warden)', { skip: SEM }, () => {
  const pct = (e, raio, opcoes) => { const b = bicho(); acertar(e, b, [{ elemento: 'energy', dano: raio }], { crit: true, ...opcoes }); return b.estados?.chocado?.pct ?? 0; };
  // um raio enorme: a força passa do teto — vale o máximo
  assert.equal(pct(novo(), 1e4), 50, 'o teto do PoE');
  const mx = com(/^eletrizacao_maximo$/);
  assert.equal(pct(mx, 1e4), 50 + (Number(golpe(mx).afPoe.eletrizacao_maximo) || 0), 'o máximo a mais');
  // um raio minúsculo: abaixo do mínimo de 5% a Eletrização nem entra — com "sempre … ao menos X%", entra com X
  assert.equal(pct(novo(), 0.001), 0);
  const mn = naAscendencia(/^eletrizacao_minima$/);
  const minimo = Number(golpe(mn).afPoe.eletrizacao_minima) || 0;
  assert.ok(minimo > 0 && pct(mn, 0.001) === minimo, `o mínimo: ${pct(mn, 0.001)}`);
  // a Mana máxima aumentada no efeito
  const mana = com(/^eletrizacao_da_mana_pct$/);
  mana.equipment = { ring: PECA('Rings', { mana_inc: 100 }) };
  const base = pct(novo(), 10);
  const comMana = pct(mana, 10);
  assert.ok(comMana > base, `${base} → ${comMana}`);
  // o Warden: até 50 Eletrizações, cada uma até 2% — somam
  const w = naAscendencia(/^eletrizacoes_max$/);
  const b = bicho();
  for (let i = 0; i < 5; i++) acertar(w, b, [{ elemento: 'energy', dano: 1e4 }], { crit: true });
  assert.equal(b.estados.chocadosPilha.length, 5);
  assert.ok(Math.abs(AfeccoesPoe.fatorDeEletrizacao(b, 1000) - 1.1) < 1e-9, 'cinco de 2%: +10%');
});

test('ELETRIZAÇÃO que se espalha (a maestria real): os monstros perto do eletrizado recebem a mesma', { skip: SEM }, () => {
  const e = com(/^eletrizacao_espalha_m$/);
  const alvo = bicho();
  const perto = bicho({ uid: 10, x: 2, y: 0 });
  const longe = bicho({ uid: 11, x: 30, y: 0 });
  const hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [alvo, perto, longe] };
  const f = golpe(e);
  const postos = AfeccoesPoe.aoAcertar(alvo, [{ elemento: 'energy', dano: 1e4 }], { afeccoes: f.afeccoes, crit: true, agora: 1000 });
  ModsPoe.aoPorAfeccoes(e, hunt, alvo, f, postos, {});
  assert.equal(perto.estados?.chocado?.pct, alvo.estados.chocado.pct);
  assert.equal(longe.estados?.chocado, undefined);
});

test('RESFRIAMENTO: o mínimo (a maestria real), o máximo de 40% e o "reduz o Dano causado pela metade do Efeito" (o Elementalista)', { skip: SEM }, () => {
  const lento = (e, gelo) => { const b = bicho(); acertar(e, b, [{ elemento: 'ice', dano: gelo }]); return b; };
  assert.equal(lento(novo(), 0.001).estados?.lento, undefined, 'gelo minúsculo: nada');
  const mn = com(/^resfriamento_minimo$/);
  assert.equal(lento(mn, 0.001).estados.lento.pct, Number(golpe(mn).afPoe.resfriamento_minimo));
  assert.equal(lento(novo(), 1e4).estados.lento.pct, 30, 'o teto do PoE');
  const el = naAscendencia(/^resfriamento_maximo$/);
  const b = lento(el, 1e4);
  assert.equal(b.estados.lento.pct, 40, 'o máximo do Elementalista');
  assert.ok(Math.abs(ModsPoe.doBicho(b, 1000).danoFator - 0.8) < 1e-9, 'metade de 40%: 20% menos dano');
});

test('CONGELAMENTO: "continuam Congelados por ao menos 2 segundos" (o Warden), "Resfriados ao Descongelarem" e o dano PERMANENTE por segundo Congelado/Resfriado (nós reais)', { skip: SEM }, () => {
  const w = naAscendencia(/^congelamento_minimo_s$/);
  const b = bicho();
  acertar(w, b, [{ elemento: 'ice', dano: 1 }], { crit: true });
  assert.ok(b.estados.congelado.ate - 1000 >= 2000, `${b.estados.congelado.ate - 1000} ms`);
  // ao descongelar, o Resfriamento
  const d = com(/^resfriar_ao_descongelar$/);
  const b2 = bicho();
  acertar(d, b2, [{ elemento: 'ice', dano: 1e4 }], { crit: true });
  delete b2.estados.lento;
  const fim = b2.estados.congelado.ate;
  Estados.tique({ monstros: [b2] }, [], fim + 1);
  assert.equal(b2.estados.lento?.pct, Number(golpe(d).afPoe.resfriar_ao_descongelar));
  // o dano permanente por segundo Resfriado (1%/s, até 10%)
  const j = com(/^dano_perm_resfriado$/);
  const b3 = bicho({ hp: 1e9, maxHp: 1e9 });
  const hunt = { clock: 1000, monstros: [b3] };
  acertar(j, b3, [{ elemento: 'ice', dano: 1e12 }]);
  b3.estados.lento.ate = 1e9;
  for (let t = 1000; t <= 6000; t += 250) Estados.tique(hunt, [], t);
  const f = golpe(j);
  const pctPorS = Number(f.afPoe.dano_perm_resfriado);
  const fator = ModsPoe.fatorRecebidoPeloBicho(b3, 'physical', f, 6000);
  assert.ok(Math.abs(fator - (1 + Math.min(Number(f.afPoe.dano_perm_resfriado_max), pctPorS * 5) / 100)) < 1e-9, `5 s resfriado: ${fator}`);
  for (let t = 6250; t <= 30_000; t += 250) Estados.tique(hunt, [], t);
  assert.ok(Math.abs(ModsPoe.fatorRecebidoPeloBicho(b3, 'physical', f, 30_000) - (1 + Number(f.afPoe.dano_perm_resfriado_max) / 100)) < 1e-9, 'no máximo');
});

test('EMPALAMENTO: os acertos a mais, a duração e o efeito em não Empalados (nós reais); "ignoram a Redução de Dano Físico"; o acerto que não gasta; O Empalador (espalha, extras, a espera)', { skip: SEM }, () => {
  const empalar = (e, alvo, hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [alvo] }, agora = 1000) => {
    const f = golpe(e);
    ModsPoe.aoAcertar(e, hunt, alvo, { ...f, afPoe: { ...f.afPoe, chance_empalar: 100 } }, { dano: 100, fisico: 100, agora, rng: () => 0 });
    return alvo.estados.empalado;
  };
  const base = empalar(novo(), bicho())[0];
  const e = com(/^efeito_empalamento_nao_empalado$/);
  const af = golpe(e).afPoe;
  const x = empalar(e, bicho())[0];
  assert.ok(Math.abs(x.valor - base.valor * (1 + ((Number(af.efeito_empalamento) || 0) + Number(af.efeito_empalamento_nao_empalado)) / 100)) < 1e-9, 'o efeito em não Empalado');
  const du = com(/^duracao_empalamento$/);
  assert.equal(empalar(du, bicho())[0].ate - 1000, Math.round((base.ate - 1000) * (1 + Number(golpe(du).afPoe.duracao_empalamento) / 100)), 'a duração a mais');
  const a = com(/^empalar_acertos_extra$/);
  assert.equal(empalar(a, bicho())[0].acertos, base.acertos + Number(golpe(a).afPoe.empalar_acertos_extra));
  // a Redução de Dano Física do monstro no empalamento solto (50% de resistência física), e o nó que a ignora
  const solta = (e2) => {
    const alvo = bicho({ resist: { physical: 50 } });
    alvo.estados = { empalado: [{ valor: 100, acertos: 5, ate: 9000 }] };
    const hunt = { clock: 1000, monstros: [alvo] };
    const f = golpe(e2);
    return ModsPoe.aoAcertar(e2, hunt, alvo, f, { dano: 1, fisico: 0, agora: 1000, rng: () => 0.99 }).extra;
  };
  assert.equal(solta(novo()), resistido({ clock: 1000 }, bicho({ resist: { physical: 50 } }), 'physical', 100, null, { armadura: false }));
  assert.equal(solta(com(/^empalar_ignora_reducao$/)), 100, 'ignora a redução');
  // "X% de chance … durarem por um Acerto adicional": este acerto não gasta
  const g = com(/^empalar_acerto_extra_chance$/);
  const alvo = bicho();
  alvo.estados = { empalado: [{ valor: 10, acertos: 5, ate: 9000 }] };
  ModsPoe.aoAcertar(g, { clock: 1000, monstros: [alvo] }, alvo, golpe(g), { dano: 1, fisico: 0, agora: 1000, rng: () => 0 });
  assert.equal(alvo.estados.empalado[0].acertos, 5);
  // O Empalador: os próximos também, +5 empalamentos (o máximo é 5), e a espera
  const k = keystone('O Empalador');
  const a1 = bicho();
  const a2 = bicho({ uid: 12, x: 2, y: 0 });
  const hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [a1, a2] };
  empalar(k, a1, hunt);
  assert.equal(a1.estados.empalado.length, 5, 'o empalamento + os adicionais (até o máximo)');
  assert.ok(a2.estados?.empalado?.length > 0, 'o vizinho também');
  const antes = a1.estados.empalado.map((y) => y.ate);
  empalar(k, a1, hunt, 2000);
  assert.deepEqual(a1.estados.empalado.map((y) => y.ate), antes, 'na espera, não empala de novo');
  const espera = Number(golpe(k).afPoe.empalar_bloqueio_s) * 1000;
  empalar(k, a1, hunt, 1000 + espera + 1);
  assert.ok(a1.estados.empalado.some((y) => y.ate > Math.max(...antes)), 'passada a espera, empala');
});

test('VENENO: em não-Envenenados (a maestria), em Sangrando (a maestria), "Envenenados por você não podem causar Golpes Críticos" e o mais dano contra "ao menos N Venenos"', { skip: SEM }, () => {
  const veneno = (e, b) => { acertar(e, b, [{ elemento: 'chaos', dano: 100 }], { afeccoes: { ...golpe(e).afeccoes, chance: { ...golpe(e).afeccoes.chance, veneno: 100 } } }); return b.dots.filter((d) => d.tipo === 'venenoPoe').at(-1).falta; };
  const base = veneno(novo(), bicho());
  const n = com(/^veneno_nao_envenenado_inc$/);
  const inc = Number(golpe(n).afPoe.veneno_nao_envenenado_inc);
  const b = bicho();
  const primeiro = veneno(n, b);
  const segundo = veneno(n, b);
  assert.ok(Math.abs(primeiro / segundo - (1 + inc / 100)) < 1e-6, `o 1º (não envenenado) ${primeiro}, o 2º ${segundo}`);
  const s = com(/^dot_multi_poison_sangrando$/);
  const sangrando = bicho({ dots: [{ tipo: 'sangramento', falta: 10 }] });
  assert.ok(veneno(s, sangrando) > veneno(s, bicho()), 'mais no sangrando');
  // o crítico do monstro envenenado
  const c = com(/^envenenados_sem_critico$/);
  const f = golpe(c);
  const mob = bicho({ dots: [{ tipo: 'venenoPoe', falta: 10 }] });
  assert.deepEqual(ModsPoe.criticoDoBicho({ chance: 1, fator: 2 }, mob, f, 1000, () => 0), { critico: false, fator: 1 });
  assert.equal(ModsPoe.criticoDoBicho({ chance: 1, fator: 2 }, bicho(), f, 1000, () => 0)?.critico ?? true, true);
  // "X% mais Dano … contra Inimigos Afetados por ao menos N Venenos"
  const m = com(/^mais_dano@alvoVenenos:\d+$/);
  const k = P.arvore().nos.flatMap((x) => x.opcoes ?? []).flatMap((o) => o.efeitos ?? []).find((x) => /^mais_dano@alvoVenenos:/.test(x.add));
  const precisa = Number(k.add.split(':').at(-1));
  const pouco = bicho({ dots: Array.from({ length: precisa - 1 }, () => ({ tipo: 'venenoPoe', falta: 1 })) });
  const muito = bicho({ dots: Array.from({ length: precisa }, () => ({ tipo: 'venenoPoe', falta: 1 })) });
  // (o "mais dano" condicional do golpe: a soma pelas tags do golpe e do alvo)
  const mais = (alvo) => ModsPoe.somaPorTags((Ficha.invalidar(m), Ficha.combate(m)), ['ataque', ...ModsPoe.tagsDoAlvo(alvo, 1000)]).mais_dano ?? 0;
  assert.equal(Number(mais(muito)) - Number(mais(pouco)), k.valor, `${precisa} venenos`);
});

test('AGONIA PERFEITA: sem crítico não há afecção; o multiplicador degenerativo das afecções é o de crítico (+ "+X% … dos Golpes Críticos")', { skip: SEM }, () => {
  const e = keystone('Agonia Perfeita');
  const f = golpe(e);
  const b = bicho();
  const sempre = (x) => ({ ...x.afeccoes, chance: { ...x.afeccoes.chance, incendio: 100 } });
  assert.deepEqual(AfeccoesPoe.aoAcertar(bicho(), [{ elemento: 'fire', dano: 100 }], { afeccoes: sempre(golpe(novo())), crit: false, agora: 1000, rng: () => 0 }), ['queimando'], 'sem a keystone, o não crítico incendeia');
  assert.deepEqual(AfeccoesPoe.aoAcertar(b, [{ elemento: 'fire', dano: 100 }], { afeccoes: sempre(f), crit: false, agora: 1000, rng: () => 0 }), [], 'não crítico: nada');
  const incendio = (ficha) => { const x = bicho(); AfeccoesPoe.aoAcertar(x, [{ elemento: 'fire', dano: 100 }], { afeccoes: ficha.afeccoes, crit: true, agora: 1000 }); return x.dots.find((d) => d.tipo === 'queimadura').falta; };
  const sem = golpe(novo());
  const mult = f.afeccoes.multiplicadorDoCritico;
  assert.ok(mult > 1, `multiplicador de crítico ${mult}`);
  // o mesmo incêndio, com o multiplicador degenerativo trocado pelo de crítico
  const ratio = incendio(f) / incendio(sem);
  const esperado = (1 + ((mult * 100 - 100) + (f.afeccoes.multiplicadorFogo ?? 0)) / 100) / (1 + ((sem.afeccoes.multiplicador ?? 0) + (sem.afeccoes.multiplicadorFogo ?? 0)) / 100) * ((1 + ((f.afeccoes.danoAumentado ?? 0) + (f.afeccoes.danoIncendio ?? 0)) / 100) / (1 + ((sem.afeccoes.danoAumentado ?? 0) + (sem.afeccoes.danoIncendio ?? 0)) / 100));
  assert.ok(Math.abs(ratio - esperado) < 1e-6, `${ratio} × ${esperado}`);
  assert.equal(f.critMultiplier, 1, 'e o crítico não dá dano extra');
});

test('DANÇA CARMESIM: até 8 Sangramentos no mesmo inimigo, cada um 50% menos; "+X% … Sangramentos por Empalamento no Inimigo" (a maestria)', { skip: SEM }, () => {
  const sangra = (e, b) => acertar(e, b, [{ elemento: 'physical', dano: 100 }], { afeccoes: { ...golpe(e).afeccoes, chance: { ...golpe(e).afeccoes.chance, sangramento: 100 } } });
  const um = bicho();
  sangra(novo(), um);
  sangra(novo(), um);
  assert.equal(um.dots.filter((d) => d.tipo === 'sangramento').length, 1, 'sem a keystone: um só');
  const e = keystone('Dança Carmesim');
  const b = bicho();
  for (let i = 0; i < 10; i++) sangra(e, b);
  const pilhas = b.dots.filter((d) => d.tipo === 'sangramento');
  assert.equal(pilhas.length, 8);
  const x = bicho();
  sangra(novo(), x);
  const af = golpe(e).afeccoes;
  const semAf = golpe(novo()).afeccoes;
  const ratio = pilhas[0].falta / x.dots[0].falta;
  const esperado = 0.5 * ((1 + ((af.multiplicador ?? 0) + (af.multiplicadorSangramento ?? 0)) / 100) / (1 + ((semAf.multiplicador ?? 0) + (semAf.multiplicadorSangramento ?? 0)) / 100));
  assert.ok(Math.abs(ratio - esperado) < 1e-6, `50% menos: ${ratio}`);
  // por empalamento
  const p = com(/^dot_multi_bleed_por_empalamento$/);
  const comEmp = bicho();
  comEmp.estados = { empalado: [{ valor: 1, acertos: 5, ate: 9000 }, { valor: 1, acertos: 5, ate: 9000 }] };
  const semEmp = bicho();
  sangra(p, comEmp);
  sangra(p, semEmp);
  const pa = golpe(p).afeccoes;
  const r2 = comEmp.dots[0].falta / semEmp.dots[0].falta;
  const base2 = 1 + ((pa.multiplicador ?? 0) + (pa.multiplicadorSangramento ?? 0)) / 100;
  assert.ok(Math.abs(r2 - (base2 + (2 * pa.multiplicadorSangramentoPorEmpalamento) / 100) / base2) < 1e-6, `dois empalamentos: ${r2}`);
});

test('as RESISTÊNCIAS a menos: "Incendiados ou Resfriados por você têm −X% de Resistências Elementais", "Envenenados por você têm −X% de Resistência a Caos" (nós reais)', { skip: SEM }, () => {
  const hunt = { clock: 1000 };
  const e = com(/^res_menos_incendiado_resfriado$/);
  const b = bicho();
  acertar(e, b, [{ elemento: 'fire', dano: 100 }], { crit: true });
  const pct = Math.abs(Number(golpe(e).afPoe.res_menos_incendiado_resfriado));
  // (o rato do bestiário tem resistências próprias: vale a diferença)
  assert.equal(resistenciaDe(hunt, b, 'ice'), resistenciaDe(hunt, bicho(), 'ice') - pct, 'incendiado: −X% no gelo também');
  const c = com(/^res_menos_caos_envenenado$/);
  const v = bicho();
  acertar(c, v, [{ elemento: 'chaos', dano: 100 }], { afeccoes: { ...golpe(c).afeccoes, chance: { ...golpe(c).afeccoes.chance, veneno: 100 } } });
  const pc = Math.abs(Number(golpe(c).afPoe.res_menos_caos_envenenado));
  assert.equal(resistenciaDe(hunt, v, 'chaos'), resistenciaDe(hunt, bicho(), 'chaos') - pc);
  assert.equal(resistenciaDe(hunt, bicho({ estados: { resMenosCaos: pc } }), 'chaos'), resistenciaDe(hunt, bicho(), 'chaos'), 'sem veneno: nada');
});

test('"Eletrizados ou Congelados por você sofrem Dano Elemental aumentado"; o Coberto de Gelo e de Cinzas ao Congelar/Incendiar (o Relicário); "ao Incendiar um Inimigo não Incendiado" (nós reais)', { skip: SEM }, () => {
  const e = com(/^dano_elemental_eletrizado_congelado$/);
  const f = golpe(e);
  const pct = Number(f.afPoe.dano_elemental_eletrizado_congelado);
  const b = bicho({ estados: { chocado: { ate: 9000, pct: 0 } } });
  assert.ok(Math.abs(ModsPoe.fatorRecebidoPeloBicho(b, 'fire', f, 1000) - (1 + pct / 100)) < 1e-9);
  assert.equal(ModsPoe.fatorRecebidoPeloBicho(b, 'physical', f, 1000), 1, 'o físico não');
  // o Relicário: Congelar cobre de Gelo (+20% de Gelo recebido, metade da chance de crítico); Incendiar cobre de Cinzas
  const r = naAscendencia(/cobertoGelo/);
  const fr = golpe(r);
  const alvo = bicho();
  const hunt = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [alvo] };
  const postos = AfeccoesPoe.aoAcertar(alvo, [{ elemento: 'ice', dano: 1e4 }, { elemento: 'fire', dano: 100 }], { afeccoes: fr.afeccoes, crit: true, agora: 1000 });
  ModsPoe.aoPorAfeccoes(r, hunt, alvo, fr, postos, {});
  assert.ok(alvo.estados.cobertoGelo?.ate > 1000 && alvo.estados.cinzas?.ate > 1000, JSON.stringify(Object.keys(alvo.estados)));
  assert.ok(Math.abs(ModsPoe.fatorRecebidoPeloBicho(alvo, 'ice', fr, 1000) - 1.2) < 1e-9);
  assert.equal(ModsPoe.doBicho(alvo, 1000).criticoFator, 0.5);
  // "Recupera X% de Vida ao Incendiar um Inimigo não Incendiado"
  const v = com(/^ev:incendiarNovo:vidaPct$/);
  const fv = golpe(v);
  const h2 = { clock: 1000, pos: { x: 0, y: 0 }, monstros: [] };
  ModsPoe.definirFichaDaCacada(h2, () => Ficha.combate(v));
  const m1 = bicho();
  v.hp = 10;
  ModsPoe.aoPorAfeccoes(v, h2, m1, fv, AfeccoesPoe.aoAcertar(m1, [{ elemento: 'fire', dano: 100 }], { afeccoes: fv.afeccoes, crit: true, agora: 1000 }), {});
  const depois1 = v.hp;
  assert.ok(depois1 > 10, 'o primeiro incêndio cura');
  ModsPoe.aoPorAfeccoes(v, h2, m1, fv, AfeccoesPoe.aoAcertar(m1, [{ elemento: 'fire', dano: 200 }], { afeccoes: fv.afeccoes, crit: true, agora: 1100 }), {});
  assert.equal(v.hp, depois1, 'já incendiado: não');
});

test('o CRÍTICO nas afecções: o efeito das não-Danificadoras (a maestria) e o "+X% de Multiplicador … das Afecções dos Golpes Críticos" (nó real)', { skip: SEM }, () => {
  const e = com(/^efeito_nao_dano_critico$/);
  const ef = Number(golpe(e).afPoe.efeito_nao_dano_critico);
  const choque = (x, crit) => { const b = bicho(); acertar(x, b, [{ elemento: 'energy', dano: 5 }], { crit, afeccoes: { ...golpe(x).afeccoes, chance: { ...golpe(x).afeccoes.chance, eletrizacao: 100 } } }); return b.estados?.chocado?.pct ?? 0; };
  const normal = choque(e, false);
  const critico = choque(e, true);
  assert.ok(normal > 0 && Math.abs(critico - Math.round(normal * (1 + ef / 100) * 10) / 10) <= 0.1, `${normal} → ${critico}`);
  const d = com(/^dot_multi_critico$/);
  const fogo = (crit) => { const b = bicho(); acertar(d, b, [{ elemento: 'fire', dano: 100 }], { crit, afeccoes: { ...golpe(d).afeccoes, chance: { ...golpe(d).afeccoes.chance, incendio: 100 } } }); return b.dots[0].falta; };
  const a = golpe(d).afeccoes;
  const base = 1 + ((a.multiplicador ?? 0) + (a.multiplicadorFogo ?? 0)) / 100;
  assert.ok(Math.abs(fogo(true) / fogo(false) - 1.5 * (base + a.multiplicadorCritico / 100) / base) < 1e-6, 'o crítico: 50% mais e o multiplicador');
});
