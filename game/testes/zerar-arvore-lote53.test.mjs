// LOTE 53 — as ÚNICAS de JOIA (J30, a quarta leva): a Regra de Ouro (o Sangramento e o Veneno que você inflige também em você — o Veneno só
// abaixo de 100 em você), a Revolta dos Mortos (os Esqueletos com o dano de Caos adicional igual a X% do Escudo de Energia do escudo) e o Modo
// Alfa / Nadir (a Intensidade que sobe / cai sozinha a cada 0,5 s e o crítico das magias por Intensidade).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Acoes = await import('../systems/acoes.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
/** A linha da única `slug` que tem `trecho`. */
const modelo = (slug, trecho) => Catalogo.catalogo().classes.Jewels.unicos.find((x) => x.slug === slug).modificadores.find((m) => m.modelo.includes(trecho));
const anel = (af) => ({ id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id), count: 1, af: [], poe: { af } });
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 70, rng: () => 0.5 }));

test('as linhas com efeito', { skip: SEM }, () => {
  for (const [slug, trecho] of [['The_Golden_Rule', 'Sangramentos'], ['The_Golden_Rule', 'Envenenamento'], ['Dead_Reckoning', 'Esqueletos'], ['Apex_Mode', 'Chance de Golpe Crítico'],
    ['Apex_Mode', 'ganham'], ['Nadir_Mode', 'Chance de Golpe Crítico'], ['Nadir_Mode', 'perdem']]) {
    const m = modelo(slug, trecho);
    assert.equal(tr(m.modelo, (m.faixas ?? []).map((f) => f[0])).estado, 'novo', `${slug}: ${trecho}`);
  }
  // (o "reduzida" do Modo Alfa: o mesmo atributo, negativo)
  assert.deepEqual(tr('Magias têm Chance de Golpe Crítico reduzida em {0}% por Intensidade', [10]).efeitos, [{ stat: 'crit_inc_magia_por_intensidade', valor: -10 }]);
});

test('a REGRA DE OURO: o Sangramento que você põe também em você; o Veneno, só enquanto você tiver menos de N', { skip: SEM }, () => {
  assert.equal(ModsPoe.refletorDeAfeccoes({ clock: 0 }, { afPoe: {} }), null, 'sem a linha, nada');
  const hunt = { clock: 0 };
  const refletir = ModsPoe.refletorDeAfeccoes(hunt, { afPoe: { reflete_sangramento: 1, reflete_veneno_ate: 2 } });
  refletir('sangramento', 120, 5000, 0);
  const em = () => hunt.efeitosDoJogador?.dots ?? [];
  assert.equal(em().find((d) => d.tipo === 'sangramento')?.falta, 120);
  for (let i = 0; i < 4; i++) refletir('venenoPoe', 50, 2000, 0);
  assert.equal(em().filter((d) => d.tipo === 'venenoPoe').length, 2, 'o teto: menos de 2 em você');
  // o gancho de `afeccoes.aoAcertar`: o Sangramento posto no monstro chama o refletor com o total e a duração
  const bicho = { uid: 'b', hp: 1e6, maxHp: 1e6 };
  const vistos = [];
  AfeccoesPoe.aoAcertar(bicho, [{ elemento: 'physical', dano: 100 }], { afeccoes: { ...AfeccoesPoe.daSoma({ chance_bleed: 100 }) }, agora: 0, aoPor: (...x) => vistos.push(x) });
  assert.equal(vistos.length, 1);
  assert.equal(vistos[0][0], 'sangramento');
  assert.equal(Math.round(vistos[0][1]), Math.round(bicho.dots.find((d) => d.tipo === 'sangramento').falta));
});

test('a REVOLTA DOS MORTOS: os Esqueletos somam X% do Escudo de Energia do escudo vestido como dano', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.sistema = 'poe';
  const escudo = peca('Shields/Yew_Spirit_Shield');
  e.equipment = { ...e.equipment, shield: escudo, ring: anel({ esqueleto_caos_pct_es_escudo: 30 }) };
  Ficha.invalidar(e);
  const af = Ficha.combate(e).afPoe;
  const es = ModsPoe.defesaDaPecaVestida(escudo).escudo;
  assert.ok(es > 0);
  assert.ok(Math.abs(af['lacaio_somado_min:esqueleto'] - (es * 30) / 100) < 1e-9);
  const com = LacaiosPoe.oQueInvoca('Summon_Skeletons', 20, null, af).somado;
  const sem = LacaiosPoe.oQueInvoca('Summon_Skeletons', 20, null, { ...af, 'lacaio_somado_min:esqueleto': 0, 'lacaio_somado_max:esqueleto': 0 }).somado;
  assert.ok(Math.abs(com[0] - sem[0] - (es * 30) / 100) < 1e-9);
  // (o Zumbi não é Esqueleto)
  assert.deepEqual(LacaiosPoe.oQueInvoca('Raise_Zombie', 20, null, af).somado, LacaiosPoe.oQueInvoca('Raise_Zombie', 20, null, { ...af, 'lacaio_somado_min:esqueleto': 0, 'lacaio_somado_max:esqueleto': 0 }).somado);
});

test('o MODO ALFA: a Intensidade sobe 1 a cada 0,5 s depois de ganhar (até o teto); andando, o ganho e a perda se anulam', { skip: SEM }, () => {
  const efeito = { intensidadeMax: 4, intensidadePerdaMs: 500 };
  const af = { intensidade_ganho_n: 1, intensidade_ganho_s: 0.5 };
  const hunt = { poeIntensidade: { x: { n: 1, em: 0 } } };
  assert.equal(Acoes.intensidadeAgora(hunt, 'x', efeito, 1000, af), 3);
  assert.equal(Acoes.intensidadeAgora(hunt, 'x', efeito, 5000, af), 4, 'o teto');
  assert.equal(Acoes.intensidadeAgora(hunt, 'x', efeito, 5000, {}), 1, 'sem a joia: a de sempre');
  const andando = { poeIntensidade: { x: { n: 4, em: 0 } }, poeRecente: { moveu: 100 } };
  assert.equal(Acoes.intensidadeAgora(andando, 'x', efeito, 2000, af), 4);
  assert.equal(Acoes.intensidadeAgora(andando, 'x', efeito, 2000, {}), 0, 'sem a joia, andando perde');
});

test('o MODO NADIR: a Intensidade cai 1 a cada 0,5 s nos 4 s depois de ganhar; o crítico das magias por Intensidade', { skip: SEM }, () => {
  const efeito = { intensidadeMax: 4 };
  const af = { intensidade_perda_n: 1, intensidade_perda_s: 0.5 };
  const hunt = { poeIntensidade: { x: { n: 4, em: 0 } } };
  assert.equal(Acoes.intensidadeAgora(hunt, 'x', efeito, 1000, af), 2);
  assert.equal(Acoes.intensidadeAgora(hunt, 'x', efeito, 3000, af), 0);
  const ficha = { afPoe: { crit_inc_magia_por_intensidade: 40 }, critMagiaPoe: { fixa: 0, aumentada: 100 } };
  assert.equal(Acoes.comCriticoDaIntensidade(ficha, 3).critMagiaPoe.aumentada, 220);
  assert.equal(Acoes.comCriticoDaIntensidade(ficha, 0), ficha, 'sem Intensidade, a mesma ficha');
});
