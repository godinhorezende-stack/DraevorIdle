// As LINHAS LOCAIS das gemas ativas do PoE (lote G1, 17/10 — `itens-poe/linhas-das-gemas.mjs`): a linha que é um modificador que o jogo já
// calcula vale SÓ nos usos daquela gema, e a QUALIDADE da gema ativa passa a valer. Mede o resultado no uso (o dano do balão, o intervalo do
// ataque, a área), não só a chave.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Gerar = await import('../systems/itens-poe/gerar.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const GP = await import('../systems/itens-poe/gemas-poe.mjs');
const Linhas = await import('../systems/itens-poe/linhas-das-gemas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Acoes = await import('../systems/acoes.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}

function peca(base, mods = null) {
  const p = Jogo.pecaDoJogo(Gerar.gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: mods ? 'magico' : 'normal', ilvl: 1, rng: () => 0.5 }));
  if (!mods) return p;
  p.poe.prefixos = mods.map(({ modelo, valor }) => ({ modelo, valores: [valor], texto: modelo.replace('{0}', valor) }));
  p.poe.sufixos = [];
  return Jogo.recalcular(p);
}
/** Personagem do PoE com a arma, o anel (opcional) e a gema ativa (nível, qualidade) na arma e no slot 1. */
function montar({ arma, anel = null, gema, nivel = 20, qualidade = 0 }) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { classePoe: 'Duelist' });
  e.equipment = { ...e.equipment, weapon: arma };
  delete e.equipment.shield;
  if (anel) e.equipment.ring = anel;
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.inventory = [GS.itemDaGema({ id: GP.doSlug(gema).itemId, nivel, xp: 0, raridade: 'comum', qualidade })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: GP.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return e;
}
const entryDe = (slug) => Acoes.POR_ID_PUBLICO(GP.doSlug(slug).acao);
const media = (d) => (d.min + d.max) / 2;

test('as linhas locais no nível e na qualidade: os números do PoE', { skip: SEM }, () => {
  // Raio Cinético: "200 % de Poder Arcano" (nível) + "+(0 — 50) % de Poder Arcano" (qualidade 20 = +50).
  assert.equal(GP.linhasLocaisNoNivel('Kinetic_Bolt', 20, 0).af.poder_arcano, 200);
  assert.equal(GP.linhasLocaisNoNivel('Kinetic_Bolt', 20, 20).af.poder_arcano, 250);
  assert.equal(GP.linhasLocaisNoNivel('Kinetic_Bolt', 20, 10).af.poder_arcano, 225);
  // Golpe Pesado: a chance de Dano Dobrado da qualidade ("(0 — 20) % de chance de causar Dano Dobrado").
  const pesado = GP.linhasLocaisNoNivel('Heavy_Strike', 20, 20);
  assert.ok(pesado.qualidade.some((l) => /20 ?% de chance de causar Dano Dobrado/.test(l)), JSON.stringify(pesado));
  assert.ok(pesado.af.chance_dano_dobrado >= 20, JSON.stringify(pesado.af));
  // Frenesi: "por Carga de Frenesi" vira a escala da carga.
  const frenesi = GP.linhasLocaisNoNivel('Frenzy', 20, 0).af;
  assert.ok(frenesi['mais_dano%carga:frenesi'] > 0 && frenesi['atk_speed_mais%carga:frenesi'] > 0, JSON.stringify(frenesi));
  // Postura (Perfurar): menos dano na Postura de Sangue, mais área na da Areia.
  const perfurar = GP.linhasLocaisNoNivel('Perforate', 20, 0).af;
  assert.ok(perfurar['mais_dano@posturaSangue'] < 0 && perfurar['area_mais@posturaAreia'] > 0, JSON.stringify(perfurar));
  // As gemas de BUFF e de LACAIO não usam linhas locais (o efeito delas não é um golpe).
  assert.deepEqual(GP.linhasLocaisNoNivel('Vaal_Impurity_of_Fire', 20, 20).af, {});
});

test('o status: a linha local que o jogo faz sai de "efeito não simulado"; a que ele não lê no uso, não', { skip: SEM }, () => {
  const motivos = GP.doSlug('Kinetic_Bolt').motivosNoJogo.join(' | ');
  assert.doesNotMatch(motivos, /Poder Arcano/);
  // "Lacaios possuem +X% de todas Resistências Elementais" vale na ficha do personagem (não num uso): não é linha local.
  assert.equal(Linhas.ehLinhaLocalDaGema('Lacaios possuem +20 % de todas Resistências Elementais'), false);
  assert.equal(Linhas.ehLinhaLocalDaGema('200 % de Poder Arcano'), true);
  assert.equal(Linhas.ehLinhaLocalDaGema('Ganhe 2 de Fúria no Acerto com Ataques'), true);
});

test('Poder Arcano: o Dano Mágico aumentado entra no dano do ataque da gema, a 200% (250% com qualidade 20)', { skip: SEM }, () => {
  const varinha = () => peca('Wands/Driftwood_Wand');
  const magico = () => peca('Rings/Coral_Ring', [{ modelo: 'Dano Mágico aumentado em {0}%', valor: 50 }]);
  const sem = montar({ arma: varinha(), gema: 'Kinetic_Bolt' });
  const com = montar({ arma: varinha(), anel: magico(), gema: 'Kinetic_Bolt' });
  assert.equal((Ficha.combate(com).afPoe.spell_dmg ?? 0) - (Ficha.combate(sem).afPoe.spell_dmg ?? 0), 50);
  const d0 = media(Acoes.danoMostrado(sem, entryDe('Kinetic_Bolt')));
  const d1 = media(Acoes.danoMostrado(com, entryDe('Kinetic_Bolt')));
  // 50% de Dano Mágico × 200% = +100% de dano de ataque (aditivo com os outros "aumentado": a razão é (1 + a + 1) / (1 + a)).
  const a = d1 / d0;
  assert.ok(a > 1.6 && a <= 2.0001, `razão ${a}`);
  // Com qualidade 20 (250%): +125%.
  const comQ = montar({ arma: varinha(), anel: magico(), gema: 'Kinetic_Bolt', qualidade: 20 });
  const semQ = montar({ arma: varinha(), gema: 'Kinetic_Bolt', qualidade: 20 });
  const b = media(Acoes.danoMostrado(comQ, entryDe('Kinetic_Bolt'))) / media(Acoes.danoMostrado(semQ, entryDe('Kinetic_Bolt')));
  assert.ok(b > a, `qualidade: ${b} > ${a}`);
  // Uma magia (sem Poder Arcano na gema) não ganha nada a mais do que já ganhava: o Poder Arcano é da gema, não do personagem.
  assert.equal(Ficha.combate(com).afPoe.poder_arcano ?? 0, 0);
});

test('Frenesi: "X% mais Velocidade de Ataque por Carga de Frenesi" encurta o intervalo de ataque da gema pelas cargas', { skip: SEM }, () => {
  // A razão do intervalo com 3 Cargas de Frenesi contra sem nenhuma, numa gema de ataque: o Frenesi (com a linha) e o Golpe Duplo (sem ela) —
  // as cargas dão a todos a velocidade inerente do PoE; a linha do Frenesi multiplica por cima (1 + 3 × X%).
  const razaoDe = (gema) => {
    const e = montar({ arma: peca('Claws/Nailed_Fist'), gema });
    e.hunt = { clock: 1000, cargasPoe: {} };
    Ficha.invalidar(e);
    const sem = Acoes.temposDaGemaPoe(e, entryDe(gema)).uso;
    e.hunt.cargasPoe = { frenesi: { n: 3, ate: 1e12 } };
    Ficha.invalidar(e);
    const com = Acoes.temposDaGemaPoe(e, entryDe(gema)).uso;
    assert.ok(sem > 0 && com > 0, `${gema}: ${sem} → ${com}`);
    return { razao: sem / com, e };
  };
  const pct = GP.linhasLocaisNoNivel('Frenzy', 20, 0).af['atk_speed_mais%carga:frenesi'];
  const { razao, e } = razaoDe('Frenzy');
  const outra = razaoDe('Double_Strike').razao;
  // (o tempo de uso é arredondado ao ms: a tolerância é de 2%)
  assert.ok(Math.abs(razao / outra - (1 + (3 * pct) / 100)) < 0.02, `Frenesi ${razao}, Golpe Duplo ${outra}, esperado ×${1 + (3 * pct) / 100}`);
  // E o "X% mais Dano com Ataques por Carga de Frenesi": o fator do golpe (`fatorDasCargas`, o "mais" do PoE) do Frenesi contra o do Golpe Duplo,
  // os dois com 3 cargas.
  const fatorDe = (gema) => {
    const x = montar({ arma: peca('Claws/Nailed_Fist'), gema });
    x.hunt = { clock: 1000, cargasPoe: { frenesi: { n: 3, ate: 1e12 } } };
    Ficha.invalidar(x);
    const entry = entryDe(gema);
    return ModsPoe.fichaDoGolpe(Acoes.comAsLinhasDaGema(x, Ficha.combate(x), entry), Acoes.tagsPoeDaSkill(entry), { estado: x }).fatorDasCargas ?? 1;
  };
  const maisPct = GP.linhasLocaisNoNivel('Frenzy', 20, 0).af['mais_dano%carga:frenesi'];
  const f = fatorDe('Frenzy') / fatorDe('Double_Strike');
  assert.ok(Math.abs(f - (1 + (3 * maisPct) / 100)) < 1e-6, `fator ${f}, esperado ${1 + (3 * maisPct) / 100}`);
  void e;
});

// ---- lote G2: a área no raio do PoE e a qualidade nas linhas que o compilador lê ----
const Areas = await import('../engine/areas.mjs');

test('G2: a forma da área no raio do PoE da gema (1 casa = 2 m; a fração é a chance de uma casa a mais)', { skip: SEM }, () => {
  // Nova de Gelo: "O raio Base é de 3 metros" → 1,5 casa: 1 ou 2 (o molde, o Hell's Core, tinha 5).
  assert.equal(GP.areaNoNivel('Ice_Nova', 20).raioM, 3);
  const nova = entryDe('Ice_Nova');
  assert.equal(Areas.raioDaForma(nova.forma), 5, 'a forma do molde');
  assert.equal(Areas.raioDaForma(Acoes.formaNoRaioDoPoe(nova, { nivel: 20 }, () => 0.99).forma), 1);
  assert.equal(Areas.raioDaForma(Acoes.formaNoRaioDoPoe(nova, { nivel: 20 }, () => 0).forma), 2);
  // A média das casas bate com os metros: 1,5 casa em 2.000 usos.
  let soma = 0;
  let semente = 1;
  const rng = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2000; i++) soma += Areas.raioDaForma(Acoes.formaNoRaioDoPoe(nova, { nivel: 20 }, rng).forma);
  assert.ok(Math.abs(soma / 2000 - 1.5) < 0.05, `média ${soma / 2000}`);
  // Sem raio publicado no PoE, a forma do molde fica.
  const semRaio = [...GP.REGISTRO.values()].find((r) => r.acao && GP.areaNoNivel(r.gema.slug, 20).raioM == null && Acoes.POR_ID_PUBLICO(r.acao)?.forma);
  if (semRaio) { const e = Acoes.POR_ID_PUBLICO(semRaio.acao); assert.equal(Acoes.formaNoRaioDoPoe(e, { nivel: 20 }).forma, e.forma); }
});

test('G2: a qualidade nas linhas que o compilador lê — raio, duração, recarga e projéteis', { skip: SEM }, () => {
  // Explosão Divina: "+(0 — 0.3) metros de raio".
  assert.ok(Math.abs(GP.areaNoNivel('Divine_Blast', 20, 20).raioM - GP.areaNoNivel('Divine_Blast', 20, 0).raioM - 0.3) < 1e-9);
  // Clamor Resistente: a recarga é a do PoE (8 s — a "Velocidade de Clamor" do nível é o tempo de uso, não a recarga), e a qualidade
  // "Velocidade de Recarga aumentada em (0 — 40) %" a divide por 1,4.
  const r0 = GP.temposNoNivel('Enduring_Cry', 20, 0).recargaMs;
  const r20 = GP.temposNoNivel('Enduring_Cry', 20, 20).recargaMs;
  assert.equal(r0, 8000);
  assert.equal(GP.temposNoNivel('Enduring_Cry', 20, 0).velClamor, 38);
  assert.ok(Math.abs(r0 / r20 - 1.4) < 0.01, `${r0} → ${r20}`);
  // Lâminas Congelantes: "Dispara +(0 — 2) projéteis".
  assert.equal(GP.alvosNoNivel('Frost_Blades', 20, 20).projeteis - GP.alvosNoNivel('Frost_Blades', 20, 0).projeteis, 2);
  assert.equal(GP.alvosNoNivel('Frost_Blades', 20, 10).projeteis - GP.alvosNoNivel('Frost_Blades', 20, 0).projeteis, 1);
  // Exsanguinar: "+(0 — 1.5) segundos à duração base".
  const d0 = GP.compilada('Exsanguinate', 20, 0).stats.duracao;
  assert.ok(d0 > 0 && Math.abs(GP.compilada('Exsanguinate', 20, 20).stats.duracao - d0 - 1.5) < 1e-9);
  // Raiva (aura): "Área de Efeito aumentada em (0 — 40) %" → o raio da aura × √1,4.
  const a0 = GP.buffNoNivel('Anger', 20, 0).raioM;
  const a20 = GP.buffNoNivel('Anger', 20, 20).raioM;
  assert.ok(Math.abs(a20 / a0 - Math.sqrt(1.4)) < 1e-6, `${a0} → ${a20}`);
  // Profanar: "Velocidade de Conjuração aumentada em (0 — 20) %" vira linha local da gema (a da conjuração).
  assert.equal(GP.linhasLocaisNoNivel('Desecrate', 20, 20).af.cast_speed_tag, 20);
});
