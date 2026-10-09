// A ÁRVORE do PoE contra a do poedb (dono, 09/10: "veja também a árvore, crie uma aba de tudo que está funcionando e pendente e se existe
// ou não … verifique se tem implementado todas as abas de Ascendancy_class e de Bloodline_Ascendancy_class") e o EFEITO dos nós: os textos
// atuais (poedb) com as quebras de linha juntadas, e a mesma tradução dos itens — com condição, escala e os dinâmicos — dando efeito.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const { linhasDoNo, traduzirLinha } = await import('../systems/itens-poe/arvore.mjs');
const P = await import('../systems/passivas/arvore.mjs');
const A = await import('../admin/itens-poe-arvore-poedb.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

test('as linhas de um nó: a quebra que continua a frase junta; a que começa outro efeito separa; a marcação do poedb vira texto', () => {
  assert.deepEqual(linhasDoNo(['Se a vida do seu mercenário for maior que a sua, 20% do dano recebido de ataques\nserá subtraído']), ['Se a vida do seu mercenário for maior que a sua, 20% do dano recebido de ataques será subtraído']);
  assert.deepEqual(linhasDoNo(['Ativa Égide Primitiva Nível 20 quando Alocado\nÉgide Primitiva pode sofrer 75 de Dano Elemental']), ['Ativa Égide Primitiva Nível 20 quando Alocado', 'Égide Primitiva pode sofrer 75 de Dano Elemental']);
  assert.deepEqual(linhasDoNo(['Frascos ganham 2 cargas quando você Acertar um\nInimigo']), ['Frascos ganham 2 cargas quando você Acertar um Inimigo']);
  assert.deepEqual(linhasDoNo(['Ganha [SpiritInfusion|Infusão Espiritual] a cada 0.5 segundos']), ['Ganha Infusão Espiritual a cada 0.5 segundos']);
});

test('a tradução de uma linha da árvore aceita o que os itens aceitam: condição, escala e dinâmicos (antes ficavam registrados)', { skip: SEM }, () => {
  const duasArmas = traduzirLinha('Chance de Acerto Crítico de Ataque enquanto em Empunhadura Dupla aumentada em 100%');
  assert.equal(duasArmas.estado, 'novo');
  assert.deepEqual(duasArmas.efeitos, [{ add: 'crit_chance_inc@ataque+duasArmas', valor: 100 }]);
  assert.deepEqual(traduzirLinha('10% de aumento de Dano por cada 10 de Força').efeitos, [{ add: 'dmg_inc%atr:str:10', valor: 10 }]);
  assert.equal(traduzirLinha('Linha que nenhuma regra conhece de jeito nenhum 7').estado, 'registrado');
});

test('a árvore do jogo: válida, e o nó "Terrores Gêmeos" agora dá o crítico com duas armas (o mesmo resolvedor dos itens)', { skip: SEM }, () => {
  const arvore = P.arvore();
  assert.deepEqual(P.validar(arvore), []);
  const no = Object.values(arvore.nos).find((n) => n.nomeEn === 'Twin Terrors');
  assert.ok(no, 'o nó');
  assert.deepEqual(no.efeitos, [{ add: 'crit_chance_inc@ataque+duasArmas', valor: 100 }]);
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { sistema: 'poe' });
  P.garantir(e);
  e.passivas.alocados = [...new Set([...e.passivas.alocados, no.id])];
  assert.equal(P.efeitos(e).adds['crit_chance_inc@ataque+duasArmas'], 100, 'a soma da árvore leva a chave com a condição');
});

test('a árvore do poedb × a do jogo: a principal inteira, as 21 ascendências de classe e as 161 passivas da página; as Linhagens ainda não', { skip: (SEM || !existsSync(A.ARQUIVO)) && 'sem o manifesto' }, () => {
  A.esquecer();
  const d = A.arvorePoedb();
  const principal = d.grupos.find((g) => g.id === 'principal');
  assert.equal(principal.noJogo, principal.nos, 'todo nó da árvore principal do poedb está no jogo');
  const classe = d.grupos.filter((g) => g.tipo === 'classe');
  assert.equal(classe.length, 21);
  for (const g of classe) assert.equal(g.noJogo, g.nos, `${g.nome}: todos os nós`);
  const asc = d.paginas.Ascendancy_class.abas;
  assert.equal(asc.find((a) => /passivas/.test(a.titulo)).noJogo, 161);
  assert.equal(asc.find((a) => /Classes/.test(a.titulo)).noJogo, 7);
  const linhagens = d.grupos.filter((g) => g.tipo === 'linhagem');
  assert.equal(linhagens.length, 13);
  assert.ok(linhagens.every((g) => g.noJogo === 0), 'as Linhagens ainda não estão no jogo (a aba mostra)');
  assert.equal(d.paginas.Bloodline_Ascendancy_class.abas.find((a) => /Passive/.test(a.titulo)).itens.length, 101);
  // O nó que o jogo não tem também mostra o estado de cada linha ("se entrar, já funciona?").
  const deAul = d.nos.filter((n) => n.grupo === 'asc:Aul');
  assert.ok(deAul.length > 0 && deAul.every((n) => !n.noJogo));
  assert.ok(deAul.filter((n) => n.linhas.length).length >= 5, 'os nós com efeito mostram as linhas (o início da Linhagem não tem texto)');
});

test('as mecânicas novas das linhas da árvore: limiar de vida baixa, fúria máxima, "por inimigo perto", dano com afecções, cegueira, pontos de passiva', { skip: SEM }, async () => {
  const C = await import('../systems/itens-poe/condicoes-poe.mjs');
  const Af = await import('../systems/itens-poe/afeccoes.mjs');
  const { traduzirParte } = await import('../systems/itens-poe/traduzir.mjs');
  // "Você conta como em Vida Baixa enquanto em 75% da Vida máxima ou abaixo"
  const e = { maxHp: 100, hp: 70, maxMana: 10, mana: 10, hunt: null };
  assert.ok(!C.condicoesDe(e, {}).has('vidaBaixa'));
  assert.ok(C.condicoesDe(e, { limiar_vida_baixa: 75 }).has('vidaBaixa'));
  assert.ok(C.condicoesDe({ ...e, hp: 92 }, { limiar_vida_cheia: 90 }).has('vidaCheia'));
  // "por Inimigo em Curto Alcance": os vivos a até 2 casas
  const h = { clock: 0, pos: { x: 0, y: 0 }, monstros: [{ hp: 1, x: 1, y: 1 }, { hp: 1, x: 2, y: 0 }, { hp: 1, x: 5, y: 0 }, { hp: 0, x: 1, y: 0 }] };
  assert.equal(C.fatorDaEscala({ hunt: h }, {}, {}, 'inimigosPerto:2'), 2);
  // "Ataques com Machados causam Dano com Afecções aumentado": o dano com afecções entra nas afecções de dano
  assert.equal(Af.daSoma({ ailment_dmg_inc: 30 }).danoComAfeccoes, 30);
  for (const [texto, stat] of [
    ['Ataques com Machados causam Dano com Afecções aumentado em {0}%', 'ailment_dmg_inc@ataque+comMachado'],
    ['Dano Físico com Armas Corpo a Corpo de Duas Mãos aumentado em {0}%', 'phys_dmg@ataque+armaCorpo+duasMaos'],
    ['Habilidades de Ataque causam Dano aumentado em {0}% enquanto portando um Escudo', 'dmg_inc@ataque+comEscudo'],
    ['Concede {0} Ponto de Habilidade Passiva', 'pontos_passiva'],
    ['Velocidade de Ataque aumentado em {0}% por Inimigo em Curto Alcance', 'atk_speed%inimigosPerto:2'],
  ]) {
    const r = traduzirParte(texto, [12]);
    assert.ok(['novo', 'equivalente', 'aproximado'].includes(r.estado), `${texto}: ${r.estado}`);
    assert.equal(r.efeitos[0].stat, stat, texto);
  }
  // a cegueira mais forte: a precisão a menos do Cego cresce
  const cego = { estados: { cego: { ate: 1000, efeito: 1.5 } } };
  assert.equal(C.doBicho(cego, 0).precisaoFator, 1 - (C.NO_ACERTO.cegar.precisaoMenosPct * 1.5) / 100);
  // os pontos de passiva a mais vêm da soma da árvore
  const e2 = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 50 }), { sistema: 'poe' });
  P.garantir(e2);
  const base = P.pontos(e2).total;
  const comPonto = Object.values(P.arvore().nos).find((n) => (n.efeitos ?? []).some((x) => x.add === 'pontos_passiva'));
  assert.ok(comPonto, 'algum nó concede ponto de passiva (a Ascendente)');
  assert.ok(base > 0);
});
