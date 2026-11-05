// (04/11, auditoria dos itens — frente A) Os FRASCOS HÍBRIDOS do PoE 1 (classe "Frascos Híbridos" — `Hybrid_Flasks`): o Pequeno, o Médio, o
// Colossal e o Sagrado, com os números do poedb (os cards da página Flasks: "Recupera 100 de Vida por 5 Segundo", "Recupera 70 de Mana por 5
// Segundo", "Consome 20 de 40 Cargas na utilização"; o DropLevel de cada um), o pool dos mods que nascem no híbrido (as páginas de Vida e de
// Mana, pelo `spawn_no` do poedb — tools/importar-poe-itens.mjs `classeHibrida`) e o EFEITO: Vida E Mana no mesmo uso (frascos.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Fr = await import('../systems/itens-poe/frascos.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { poolHibrido } = await import('../../tools/importar-poe-itens.mjs');
const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
if (!SEM) Jogo.iniciar(ITEM_CATALOG);

const frasco = (base, raridade = 'normal', s = 3, ilvl = 60) => Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl, rng: semente(s) }));
const comMod = (p, modelo, valores, lado = 'prefixos') => {
  p.poe[lado] = [...(p.poe[lado] ?? []), { modelo, valores, texto: modelo }];
  return p;
};

test('as 6 bases do poedb (dono, 04/11: a linha inteira): Vida e Mana por 5 s, 20 de 40 cargas, o requisito pelo DropLevel (10 a 60)', { skip: SEM }, () => {
  const c = Catalogo.catalogo().classes.Hybrid_Flasks;
  assert.equal(c.grupo, 'Frascos');
  const numeros = c.bases.map((b) => [b.slug, b.nome, b.requisitos.nivel, b.atributos.recupera.quantidade, b.atributos.recupera_mana.quantidade, b.atributos.recupera.segundos, b.atributos.recupera_mana.segundos, b.atributos.cargas_por_uso, b.atributos.cargas_maximas]);
  assert.deepEqual(numeros, [
    ['Small_Hybrid_Flask', 'Frasco Híbrido Pequeno', 10, 100, 70, 5, 5, 20, 40],
    ['Medium_Hybrid_Flask', 'Frasco Híbrido Médio', 20, 230, 100, 5, 5, 20, 40],
    ['Large_Hybrid_Flask', 'Frasco Híbrido Grande', 30, 510, 140, 5, 5, 20, 40],
    ['Colossal_Hybrid_Flask', 'Frasco Híbrido Colossal', 40, 690, 200, 5, 5, 20, 40],
    ['Sacred_Hybrid_Flask', 'Frasco Híbrido Sagrado', 50, 1440, 400, 5, 5, 20, 40],
    ['Hallowed_Hybrid_Flask', 'Frasco Híbrido Consagrado', 60, 1740, 480, 5, 5, 20, 40],
  ]);
  assert.deepEqual(c.bases.map((b) => [b.atributos.recupera.recurso, b.atributos.recupera_mana.recurso]), Array(6).fill(['vida', 'mana']));
});

test('o pool do híbrido: os mods de Vida e de Mana que nascem nele (sem o "Vida/Mana Recuperada… / Retira…" e sem o adicional em 10 s da Vida)', { skip: SEM }, () => {
  const pool = Catalogo.catalogo().classes.Hybrid_Flasks.paginas['*'];
  const familias = (lado) => pool[lado].map((g) => g.familia);
  assert.deepEqual(familias('prefixos'), ['FlaskRecoverySpeed', 'FlaskRecoveryAmount', 'FlaskBuffWhileHealing', 'FlaskNumCharges', 'FlaskRechargeRate', 'FlaskChargesUsed', 'FlaskIncreasedHealingCharges', 'FlaskManaRecoveryAtEnd', 'FlaskEffectNotRemovedOnFullMana']);
  assert.ok(!familias('sufixos').includes('LocalLifeFlaskAdditionalLifeRecovery'), 'o "Recupera um adicional…" é só do Frasco de Vida (tag life_flask)');
  const textos = [...pool.prefixos, ...pool.sufixos].flatMap((g) => g.tiers.map((t) => t.texto));
  assert.ok(!textos.some((t) => /^(Vida|Mana) Recuperada aumentada/.test(t)), 'o poedb põe hybrid_flask no spawn_no deles');
  assert.ok(textos.includes('(125—130)% mais Recuperação se usado enquanto em Vida Baixa'), 'o de Vida Baixa nasce no híbrido');
  assert.ok(textos.includes('Quantidade Recuperada aumentada em 66% / Recuperação de Mana ocorre instantaneamente no término do Efeito'), 'o Agourento do de Mana também');
  // O Desacelerar dos dois (o "não estiver em Vida Cheia" do de Vida e o "…Mana Cheia" do de Mana) na mesma família, sem repetir os outros.
  const desacelera = pool.sufixos.find((g) => g.familia === 'LocalManaFlaskHinderNearbyEnemies');
  assert.equal(desacelera.tiers.length, 8);
  assert.equal(pool.prefixos.find((g) => g.familia === 'FlaskNumCharges').tiers.length, 5);
  // O Antídoto com o texto do poedb (a coleção de Vida/Mana traz "Adiciona a de Dano de Raio").
  assert.equal(pool.sufixos.find((g) => g.familia === 'FlaskDispellPoison').tiers[0].texto, 'Concede Imunidade a Envenenamento por (15—17) segundos se usado enquanto Envenenado');
});

test('importador: a regra do spawn_no do poedb (hybrid_flask ou a tag da própria página tira; o resto entra uma vez, com o peso dele)', () => {
  const mod = (Name, Level, str, spawn_no, ModFamilyList = ['F'], ModGenerationTypeID = '1') => ({ Name, Level: String(Level), str, spawn_no, ModFamilyList, ModGenerationTypeID, DropChance: 600 });
  const vida = { normal: [mod('A', 1, 'Um', ['utility_flask', 'default']), mod('B', 5, 'Dois', ['mana_flask', 'hybrid_flask', 'default']), mod('C', 9, 'Tres', ['life_flask', 'default'], ['G'], '2')] };
  const mana = { normal: [mod('A', 1, 'Um', ['utility_flask', 'default']), mod('<if:MS>{D}<elif:FS>{Da}', 9, 'Quatro<br>Cinco', ['life_flask', 'utility_flask', 'default'])] };
  const p = poolHibrido([[vida, 'life_flask'], [mana, 'mana_flask']]);
  assert.deepEqual(p.sufixos, []);
  assert.deepEqual(p.prefixos.map((g) => [g.familia, g.peso, g.ilvlMax, g.tiers.map((t) => [t.tier, t.nome, t.ilvl, t.texto])]), [['F', 1200, 9, [[1, 'D', 9, 'Quatro / Cinco'], [2, 'A', 1, 'Um']]]]);
});

test('o jogo: os híbridos vão para o cinto (ids depois de todos os outros, o requisito de nível) e caem pelo nível do item', { skip: SEM }, () => {
  const ids = [...Jogo.registro().porBase.keys()];
  const hibridos = ids.filter((b) => b.startsWith('Hybrid_Flasks/'));
  assert.equal(hibridos.length, 6);
  const maiorOutro = Math.max(...ids.filter((b) => !b.startsWith('Hybrid_Flasks/') && !Jogo.JOIAS[b]).map(Jogo.idDaBase));
  assert.ok(hibridos.every((b) => Jogo.idDaBase(b) > maiorOutro), 'nenhum id que já existia muda');
  const meta = ITEM_CATALOG[Jogo.idDaBase('Hybrid_Flasks/Sacred_Hybrid_Flask')];
  assert.deepEqual([meta.frasco, meta.slot, meta.type, meta.minLevel], [true, undefined, 'flasks', 50]);
  // O Item Level do bicho: o Sagrado (nível 50) não cai num bicho de nível 30 (nem com a janela de 3 do dono); um dos de até 30 cai.
  const rng = semente(11);
  const vistos = new Set();
  for (let i = 0; i < 6000; i++) {
    const p = Jogo.pecaSorteada(30, rng);
    if (p?.poe?.classe === 'Hybrid_Flasks') {
      vistos.add(p.poe.base);
      assert.notEqual(p.poe.raridade, 'raro', 'frasco não é Raro no PoE');
    }
  }
  assert.ok(['Small', 'Medium', 'Large'].some((t) => vistos.has(`Hybrid_Flasks/${t}_Hybrid_Flask`)), [...vistos].join());
  assert.ok(!vistos.has('Hybrid_Flasks/Sacred_Hybrid_Flask') && !vistos.has('Hybrid_Flasks/Colossal_Hybrid_Flask') && !vistos.has('Hybrid_Flasks/Hallowed_Hybrid_Flask'));
  // O Mágico com mods do pool do híbrido.
  const magico = frasco('Hybrid_Flasks/Colossal_Hybrid_Flask', 'magico', 5, 70);
  assert.ok((magico.poe.prefixos?.length ?? 0) + (magico.poe.sufixos?.length ?? 0) >= 1);
});

test('os números: Vida e Mana com os mods do frasco (quantidade, velocidade, qualidade) e os do personagem por recurso', { skip: SEM }, () => {
  const par = Fr.parametros(frasco('Hybrid_Flasks/Sacred_Hybrid_Flask'));
  assert.deepEqual([par.tipo, par.recurso, par.quantidade, par.ms, par.quantidadeMana, par.msMana, par.cargasPorUso, par.cargasMaximas], ['hibrido', 'vida', 1440, 5000, 400, 5000, 20, 40]);
  // "Quantidade Recuperada aumentada" e a "Velocidade de Recuperação" valem nos dois.
  const mod = Fr.parametros(comMod(frasco('Hybrid_Flasks/Sacred_Hybrid_Flask'), 'Quantidade Recuperada aumentada em {0}% / Velocidade de Recuperação reduzida em {1}%', [50, 33]));
  assert.deepEqual([mod.quantidade, mod.quantidadeMana, mod.ms, mod.msMana], [2160, 600, 7463, 7463]);
  // "Vida Recuperada aumentada" só na Vida; o do personagem: a "Recuperação de Vida dos Frascos" na Vida e a de Mana na Mana.
  const soVida = Fr.parametros(comMod(frasco('Hybrid_Flasks/Small_Hybrid_Flask'), 'Vida Recuperada aumentada em {0}%', [50]), { frasco_mana_rec: 100 });
  assert.deepEqual([soVida.quantidade, soVida.quantidadeMana], [150, 140]);
  // A qualidade (a Bolha do Vidreiro): +q% nos dois.
  const q = frasco('Hybrid_Flasks/Small_Hybrid_Flask');
  q.poe.qualidade = 20;
  assert.deepEqual([Fr.parametros(q).quantidade, Fr.parametros(q).quantidadeMana], [120, 84]);
  // O resumo do balão leva a Mana.
  const r = Fr.resumo(frasco('Hybrid_Flasks/Medium_Hybrid_Flask'));
  assert.deepEqual([r.tipo, r.quantidade, r.segundos, r.quantidadeMana, r.segundosMana], ['hibrido', 230, 5, 100, 5]);
  // Os mods do pool com efeito (nenhuma linha só registrada).
  for (let s = 1; s <= 30; s++) {
    const m = frasco('Hybrid_Flasks/Sacred_Hybrid_Flask', 'magico', s, 84);
    const p = Fr.parametros(m);
    assert.ok(p.linhas.every((l) => l.estado === 'efeito'), `${m.poe.nome}: ${p.linhas.filter((l) => l.estado !== 'efeito').map((l) => l.texto).join('; ')}`);
  }
});

test('na caçada: o mesmo gole recupera Vida e Mana ao longo de 5 s; usa sozinho com a vida OU a mana baixa; acaba com as duas cheias', { skip: SEM }, async () => {
  const { personagemDeTeste } = await import('./apoio.mjs');
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.inventory = [frasco('Hybrid_Flasks/Small_Hybrid_Flask')];
  assert.equal(Fr.por(e, { pilha: 0 }).ok, true);
  e.hunt = { clock: 0, monstros: [{ hp: 10 }], pos: { x: 1, y: 1 } };
  e.maxHp = 1000;
  e.hp = 1000;
  e.maxMana = 1000;
  e.mana = 1000;
  Fr.tique(e, [], 'Teste');
  assert.equal(Fr.cinto(e)[0].poe.cargas, 40, 'cheio e sem uso (vida e mana cheias)');
  // Só a MANA baixa: o híbrido sai sozinho (a regra padrão, 50%) e recupera as duas.
  e.mana = 300;
  e.hp = 900;
  e.hunt.clock = 100;
  const eventos = [];
  Fr.tique(e, eventos, 'Teste');
  assert.equal(Fr.cinto(e)[0].poe.cargas, 20);
  e.hunt.clock = 2600;
  Fr.tique(e, eventos, 'Teste');
  assert.equal(Math.round(e.hp), 950, 'metade dos 100 de Vida em 2,5 s');
  assert.equal(Math.round(e.mana), 335, 'metade dos 70 de Mana');
  // A Vida encheu, a Mana não: o efeito segue até a Mana também (no PoE, o do híbrido acaba com as duas cheias).
  e.hp = 1000;
  e.hunt.clock = 3600;
  Fr.tique(e, eventos, 'Teste');
  assert.equal(Math.round(e.mana), 349);
  assert.ok(Fr.paraCliente(e)[0].ativoAte > 0, 'ainda ativo');
  e.hunt.clock = 5200;
  Fr.tique(e, eventos, 'Teste');
  assert.equal(Math.round(e.mana), 370, 'os 70 inteiros');
  assert.ok(eventos.some((ev) => ev.t === 'heal' && ev.frasco && ev.color === '#4fc3ff'), 'o número azul da mana');
  // A Mana segue abaixo de 50% e o efeito acabou: bebe de novo.
  assert.equal(Fr.cinto(e)[0].poe.cargas, 0);
  // A tela: o tipo e a regra (a vida ou a mana abaixo de X%).
  const tela = Fr.paraCliente(e)[0];
  assert.deepEqual([tela.tipo, tela.cargasMaximas, tela.cargasPorUso, tela.regra.abaixoPct], ['hibrido', 40, 20, 50]);
  assert.ok(tela.ativoAte > 0);
  assert.match(Fr.configurar(e, { vaga: 0, abaixoPct: 40 }).notice, /vida ou a mana estiver abaixo de 40%/);
  // Com as duas cheias, o efeito acaba antes do tempo.
  e.mana = 1000;
  e.hp = 1000;
  e.hunt.clock = 5400;
  Fr.tique(e, [], 'Teste');
  assert.equal(Fr.paraCliente(e)[0].ativoAte, 0, 'vida e mana cheias: acabou');
  // Só a VIDA baixa (abaixo dos 40% da regra): bebe também.
  e.hp = 300;
  Fr.cinto(e)[0].poe.cargas = 40;
  e.hunt.clock = 5500;
  Fr.tique(e, [], 'Teste');
  assert.equal(Fr.cinto(e)[0].poe.cargas, 20);
});

test('conta como de Vida e de Mana: as condições e o instantâneo da Mana Baixa; o "mais Recuperação em Vida Baixa" só na Vida', { skip: SEM }, async () => {
  const { personagemDeTeste } = await import('./apoio.mjs');
  const Cond = await import('../systems/itens-poe/condicoes-poe.mjs');
  const p = frasco('Hybrid_Flasks/Small_Hybrid_Flask');
  assert.deepEqual([Fr.contaComo(p, 'vida'), Fr.contaComo(p, 'mana'), Fr.contaComo(p, 'utilidade')], [true, true, false]);
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.inventory = [comMod(frasco('Hybrid_Flasks/Small_Hybrid_Flask'), '{0}% mais Recuperação se usado enquanto em Vida Baixa', [100])];
  Fr.por(e, { pilha: 0 });
  e.hunt = { clock: 0, monstros: [], pos: { x: 1, y: 1 } };
  e.maxHp = 1000;
  e.hp = 300;
  e.maxMana = 1000;
  e.mana = 300;
  Fr.tique(e, [], 'Teste');
  const ativo = e.hunt.frascosPoe.ativos[0];
  assert.deepEqual([Math.round(ativo.porMs * 5000), Math.round(ativo.mana.porMs * 5000)], [200, 70], 'o dobro na Vida, a Mana igual');
  const v = Cond.condicoesDe(e);
  assert.ok(v.has('duranteFrascoVida') && v.has('duranteFrascoMana'));
  // "Frascos de Mana usados enquanto em Mana Baixa aplicam sua Recuperação Instantaneamente" vale no híbrido (é de Mana também).
  const inst = Fr.parametros(frasco('Hybrid_Flasks/Small_Hybrid_Flask'), { 'frasco_instantaneo_baixa:mana': 1 });
  assert.deepEqual([inst.instantaneoNaManaBaixa, inst.instantaneoNaVidaBaixa], [true, false]);
});
