// O sistema de itens no modelo do PoE (Fase 1, desligado em produção): o importador entende os textos e os arquétipos, e o gerador
// segue as regras da documentação (Normal 0; Mágico até 1+1; Raro 4–6 com até 3+3; Único fixo), o Item Level dos tiers, a família
// única e as faixas. Os testes usam um catálogo mínimo montado aqui (a coleção do PoE fica fora do repositório); o último confere o
// catálogo importado de verdade, quando ele existe nesta máquina.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { analisarTexto, arquetipoDaBase } from '../../tools/importar-poe-itens.mjs';
import { gerarPeca, elegiveis, sortearNaFaixa, escrever } from '../systems/itens-poe/gerar.mjs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const tier = (t, ilvl, texto, peso = 100) => ({ tier: t, nome: `N${t}`, ilvl, peso, texto, ...analisarTexto(texto) });
const familia = (familia, lado, tiers) => ({ familia, lado, tags: [], peso: tiers.reduce((n, t) => n + t.peso, 0), tiers });
const POOL = {
  prefixos: [
    familia('Vida', 'prefixo', [tier(1, 50, '+(50—60) de Vida'), tier(2, 1, '+(10—20) de Vida')]),
    familia('Armadura', 'prefixo', [tier(1, 1, '+(5—9) de Armadura')]),
    familia('Mana', 'prefixo', [tier(1, 1, '+(5—9) de Mana')]),
    familia('Fisico', 'prefixo', [tier(1, 1, '(10—15)% de Dano Físico aumentado')]),
  ],
  sufixos: [
    familia('Fogo', 'sufixo', [tier(1, 1, '+(6—11)% de Resistência a Fogo')]),
    familia('Gelo', 'sufixo', [tier(1, 1, '+(6—11)% de Resistência a Gelo')]),
    familia('Raio', 'sufixo', [tier(1, 1, '+(6—11)% de Resistência a Raio')]),
    familia('Forca', 'sufixo', [tier(1, 1, '+(8—12) de Força')]),
  ],
};
const CATALOGO = {
  classes: {
    Teste: {
      id: 'Teste',
      paginas: { str: POOL },
      bases: [{ id: 'Teste/Colete', slug: 'Colete', nome: 'Colete', requisitos: { forca: 10 }, atributos: { armadura: { min: 19, max: 27 }, dano_fisico: { min: 15, max: 21 } }, implicitos: [{ texto: '+(3—5) de Vida', ...analisarTexto('+(3—5) de Vida') }], pool: 'str' }],
      unicos: [{ slug: 'Espinho', nome: 'Espinho', base: 'Colete', modificadores: [{ tipo: 'explicit', texto: '+(30—60) de Vida', ...analisarTexto('+(30—60) de Vida') }] }],
    },
  },
};
const R = Catalogo.REGRAS;
const gerar = (raridade, ilvl, rng) => gerarPeca({ catalogo: CATALOGO, regras: R, base: 'Teste/Colete', raridade, ilvl, rng });

test('importador: faixas do texto viram modelo + números; arquétipo pelos requisitos', () => {
  assert.deepEqual(analisarTexto('+(175—189) de Vida máxima'), { modelo: '+{0} de Vida máxima', faixas: [[175, 189]] });
  assert.deepEqual(analisarTexto('Adiciona (3—5) a (7—9) de Dano Físico'), { modelo: 'Adiciona {0} a {1} de Dano Físico', faixas: [[3, 5], [7, 9]] });
  assert.deepEqual(analisarTexto('(-15—-10) de Dano Físico sofrido').faixas, [[-15, -10]]);
  assert.equal(analisarTexto('1000% do Dano refletido').faixas[0][0], 1000);
  assert.equal(arquetipoDaBase({ requisitos: { forca: 12 } }), 'str');
  assert.equal(arquetipoDaBase({ requisitos: { forca: 5, inteligencia: 5 } }), 'str_int');
  assert.equal(arquetipoDaBase({ requisitos: { nivel: 5 } }), null);
});

test('as regras de raridade são as da documentação (Normal 0, Mágico 1+1, Raro 4–6 com 3+3, Único fixo)', () => {
  assert.deepEqual(R.ordem, ['normal', 'magico', 'raro', 'unico']);
  assert.deepEqual([R.raridades.magico.maxPrefixos, R.raridades.magico.maxSufixos], [1, 1]);
  assert.deepEqual([R.raridades.raro.maxPrefixos, R.raridades.raro.maxSufixos], [3, 3]);
  assert.deepEqual(R.raridades.raro.quantidade, { 4: 80, 5: 15, 6: 5 });
  assert.deepEqual(R.raridades.magico.quantidade, { 1: 1, 2: 1 });
  assert.equal(R.raridades.unico.fixos, true);
});

test('Normal não tem mods; Mágico tem 1–2 com no máximo 1 de cada lado e leva os nomes', () => {
  const rng = semente(7);
  assert.equal(gerar('normal', 80, rng).prefixos.length + gerar('normal', 80, rng).sufixos.length, 0);
  for (let i = 0; i < 300; i++) {
    const p = gerar('magico', 80, rng);
    const n = p.prefixos.length + p.sufixos.length;
    assert.ok(n >= 1 && n <= 2 && p.prefixos.length <= 1 && p.sufixos.length <= 1, JSON.stringify(p));
    if (p.prefixos[0]) assert.ok(p.nome.startsWith(p.prefixos[0].nome));
    if (p.sufixos[0]) assert.ok(p.nome.endsWith(p.sufixos[0].nome));
  }
});

test('Mágico (regra do dono, 04/10): 1 mod em ~50% (só prefixo OU só sufixo) e 2 mods em ~50% (exatamente 1+1)', () => {
  const rng = semente(21);
  const N = 4000;
  let um = 0;
  let dois = 0;
  for (let i = 0; i < N; i++) {
    const p = gerar('magico', 80, rng);
    const n = p.prefixos.length + p.sufixos.length;
    if (n === 1) {
      um++;
      assert.ok(p.prefixos.length === 1 || p.sufixos.length === 1);
    } else {
      dois++;
      assert.deepEqual([p.prefixos.length, p.sufixos.length], [1, 1], 'com 2 mods vem exatamente 1 prefixo + 1 sufixo');
    }
  }
  assert.ok(Math.abs(um / N - 0.5) < 0.03 && Math.abs(dois / N - 0.5) < 0.03, `1 mod ${um}, 2 mods ${dois}`);
});

test('Raro: 4 a 6 mods, nunca mais de 3 de um lado, família nunca repete, valores dentro das faixas', () => {
  const rng = semente(11);
  const contagem = {};
  for (let i = 0; i < 2000; i++) {
    const p = gerar('raro', 80, rng);
    const mods = [...p.prefixos, ...p.sufixos];
    assert.ok(mods.length >= 4 && mods.length <= 6);
    assert.ok(p.prefixos.length <= 3 && p.sufixos.length <= 3);
    assert.equal(new Set(mods.map((m) => m.familia)).size, mods.length, 'família repetida');
    for (const m of mods) {
      const t = [...POOL.prefixos, ...POOL.sufixos].find((g) => g.familia === m.familia).tiers.find((x) => x.tier === m.tier);
      m.valores.forEach((v, k) => assert.ok(v >= t.faixas[k][0] && v <= t.faixas[k][1], `${m.texto} fora de ${t.faixas[k]}`));
      assert.equal(m.texto, escrever(t.modelo, m.valores));
    }
    contagem[mods.length] = (contagem[mods.length] ?? 0) + 1;
  }
  // Regra do dono (04/10): 4 mods ~80%, 5 ~15%, 6 ~5%.
  assert.ok(Math.abs(contagem[4] / 2000 - 0.8) < 0.03 && Math.abs(contagem[5] / 2000 - 0.15) < 0.03 && Math.abs(contagem[6] / 2000 - 0.05) < 0.02, JSON.stringify(contagem));
});

test('Item Level: tier acima do iLvl da peça não sai; a base e o implícito são sorteados nas faixas', () => {
  const rng = semente(3);
  assert.deepEqual(elegiveis(POOL, 10).prefixo.filter((c) => c.familia === 'Vida').map((c) => c.tier.tier), [2]);
  for (let i = 0; i < 300; i++) {
    const p = gerar('raro', 10, rng);
    assert.ok(!p.prefixos.some((m) => m.familia === 'Vida' && m.tier === 1), 'T1 de Vida exige iLvl 50');
    assert.ok(p.atributos.armadura >= 19 && p.atributos.armadura <= 27);
    assert.deepEqual(p.atributos.dano_fisico, { min: 15, max: 21 }, 'dano de arma é faixa, não número sorteado');
    assert.ok(p.implicitos[0].valores[0] >= 3 && p.implicitos[0].valores[0] <= 5);
  }
});

test('Único: os mods fixos do cadastro (valores na faixa), sem sorteio de mods', () => {
  const p = gerar('unico', 80, semente(5));
  assert.equal(p.nome, 'Espinho');
  assert.equal(p.modificadores.length, 1);
  assert.ok(p.modificadores[0].valores[0] >= 30 && p.modificadores[0].valores[0] <= 60);
  assert.deepEqual([p.prefixos.length, p.sufixos.length], [0, 0]);
});

test('determinístico com a mesma semente; erros claros; faixa decimal respeita as casas', () => {
  assert.deepEqual(gerar('raro', 80, semente(9)), gerar('raro', 80, semente(9)));
  assert.match(gerarPeca({ catalogo: CATALOGO, regras: R, base: 'Teste/Nada', raridade: 'raro', ilvl: 1 }).erro, /base desconhecida/);
  assert.match(gerarPeca({ catalogo: CATALOGO, regras: R, base: 'Teste/Colete', raridade: 'lendario', ilvl: 1 }).erro, /raridade desconhecida/);
  const v = sortearNaFaixa([0.2, 0.4], semente(2));
  assert.ok(v >= 0.2 && v <= 0.4 && String(v).split('.')[1].length <= 1);
});

test('desligado sem a chave: o jogo atual nunca carrega o catálogo do PoE', () => {
  const antes = process.env.ITENS_POE;
  delete process.env.ITENS_POE;
  assert.equal(Catalogo.ligado(), false);
  assert.equal(Catalogo.catalogo(), null);
  if (antes != null) process.env.ITENS_POE = antes;
});

test('catálogo importado de verdade (quando existe nesta máquina): bases com pool geram peças válidas', { skip: !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina' }, () => {
  const cat = JSON.parse(readFileSync(Catalogo.ARQUIVO, 'utf8'));
  const rng = semente(13);
  let geradas = 0;
  for (const classe of Object.values(cat.classes)) {
    for (const base of classe.bases.filter((b) => b.pool).slice(0, 3)) {
      const p = gerarPeca({ catalogo: cat, regras: R, base: base.id, raridade: 'raro', ilvl: 84, rng });
      assert.ok(!p.erro, `${base.id}: ${p.erro}`);
      assert.ok(p.prefixos.length <= 3 && p.sufixos.length <= 3, base.id);
      geradas++;
    }
  }
  assert.ok(geradas > 50, `geradas ${geradas}`);
});

// ------------------------------------------------------------------ incremento 2: tradução para os atributos do Draevor

import { traduzirMod, traduzirPeca, cobertura, TABELA, NOVOS, idAutomatico } from '../systems/itens-poe/traduzir.mjs';
import { FICHAS } from '../systems/afixos.mjs';

const mod = (texto) => ({ ...analisarTexto(texto), valores: analisarTexto(texto).faixas.map((f) => f[0]) });

test('tradução: equivalente, aproximado (média da faixa), elemento, híbrido e os sem equivalente', () => {
  assert.deepEqual(traduzirMod(mod('+175 de Vida máxima')).efeitos, [{ stat: 'life', valor: 175 }]);
  assert.equal(traduzirMod(mod('+175 de Vida máxima')).estado, 'equivalente');
  const r = traduzirMod(mod('+30% de Resistência a Gelo'));
  assert.deepEqual(r.efeitos, [{ stat: 'ice_res', valor: 30 }]);
  assert.deepEqual(traduzirMod(mod('+12% de Resistência a Raio')).efeitos, [{ stat: 'energy_res', valor: 12 }]);
  // Decisão do dono (04/10): o Caos é um elemento próprio → chaos_res (atributo NOVO).
  const caos = traduzirMod(mod('+20% de Resistência a Caos'));
  assert.deepEqual([caos.estado, caos.efeitos], ['novo', [{ stat: 'chaos_res', valor: 20 }]]);
  const fis = traduzirMod(mod('Adiciona 5 a 9 de Dano Físico'));
  assert.deepEqual([fis.estado, fis.efeitos], ['aproximado', [{ stat: 'phys_add', valor: 7 }]]);
  const hib = traduzirMod(mod('Armadura aumentada em 20% / Recuperação de Atordoamentos e Bloqueios aumentada em 11%'));
  assert.equal(hib.partes.length, 2);
  assert.equal(hib.estado, 'novo', 'o estado do híbrido é o pior das partes');
  assert.deepEqual(hib.efeitos, [{ stat: 'armour_pct', valor: 20 }, { stat: 'stun_recovery', valor: 11 }], 'cada parte vira o seu atributo');
  assert.deepEqual(traduzirMod(mod('Chance de Crítico aumentada em 25%')).efeitos, [{ stat: 'crit_chance_inc', valor: 25 }]);
  assert.deepEqual(traduzirMod(mod('Adiciona 3 a 7 de Dano de Fogo')).efeitos, [{ stat: 'added_fire_dmg_min', valor: 3 }, { stat: 'added_fire_dmg_max', valor: 7 }]);
  // Sem regra: nada fica de fora — vira o atributo automático do texto.
  const auto = traduzirMod(mod('Algo que ninguém escreveu 3'));
  assert.deepEqual([auto.estado, auto.efeitos], ['registrado', [{ stat: idAutomatico('Algo que ninguém escreveu {0}'), valor: 3 }]]);
  assert.equal(idAutomatico('Dano com Arcos aumentado em {0}%'), 'poe.dano-com-arcos-aumentado-em-n');
});

test('tradução: toda regra aponta para um atributo do Draevor ou para um atributo novo cadastrado (nada de chave solta)', () => {
  const elementos = Object.entries(TABELA.elementos).filter(([k]) => !k.startsWith('_')).map(([, v]) => v);
  for (const r of TABELA.regras) {
    assert.ok(r.efeitos.length > 0, `${r.padrao}: regra sem efeito (todo texto vira atributo)`);
    for (const e of r.efeitos) {
      const stats = e.stat.includes('{E}') ? elementos.map((x) => e.stat.replace('{E}', x)) : [e.stat];
      for (const s of stats) assert.ok(FICHAS[s] || NOVOS[s], `${r.padrao} → ${s} não existe (nem no Draevor nem em atributos-novos.json)`);
    }
  }
  for (const [id, a] of Object.entries(NOVOS)) assert.ok(a.nome && 'combate' in a, id);
});

test('tradução de uma peça: soma por atributo, no formato que a ficha lê (af)', () => {
  const p = gerar('raro', 80, semente(17));
  const t = traduzirPeca(p);
  assert.equal(t.linhas.length, p.implicitos.length + p.prefixos.length + p.sufixos.length);
  for (const [k, v] of Object.entries(t.af)) assert.ok((FICHAS[k] || NOVOS[k] || k.startsWith('poe.')) && (Number.isFinite(v) || Array.isArray(v)), `${k}=${v}`);
  const vida = t.linhas.filter((l) => l.efeitos.some((e) => e.stat === 'life')).flatMap((l) => l.efeitos.filter((e) => e.stat === 'life')).reduce((n, e) => n + e.valor, 0);
  if (vida) assert.equal(t.af.life, vida);
});

test('cobertura com o catálogo real (quando existe): a maior parte do drop já vira atributo', { skip: !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina' }, () => {
  const c = cobertura(JSON.parse(readFileSync(Catalogo.ARQUIVO, 'utf8')));
  assert.ok(c.pct.equivalente + c.pct.aproximado >= 55, JSON.stringify(c.pct));
  assert.ok(Math.abs(c.pct.equivalente + c.pct.aproximado + c.pct.novo + c.pct.registrado - 100) < 0.5, 'todo o drop vira atributo');
  assert.ok(c.pct.registrado <= 15, JSON.stringify(c.pct));
});
