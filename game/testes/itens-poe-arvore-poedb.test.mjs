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

test('lotes 3 e 4 da árvore: peitoral sem Vida, armaduras com Evasão, maestrias de Vida, auras ativas, crítico que não incendeia, imune a Lento', { skip: SEM }, async () => {
  const C = await import('../systems/itens-poe/condicoes-poe.mjs');
  const Af = await import('../systems/itens-poe/afeccoes.mjs');
  const Jogo = await import('../systems/itens-poe/jogo.mjs');
  const { traduzirParte } = await import('../systems/itens-poe/traduzir.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  Jogo.iniciar(ITEM_CATALOG);
  // o Peitoral sem modificador de Vida (e com): a condição
  const peca = (base, mods = []) => ({ poe: { base, classe: base.split('/')[0], prefixos: mods.map((m) => ({ modelo: m })), sufixos: [], implicitos: [] } });
  const semVida = { maxHp: 100, hp: 100, equipment: { body: peca('Body_Armours/Plate_Vest', ['+{0} de Armadura']) } };
  assert.ok(C.condicoesDe(semVida, {}).has('peitoralSemVida'));
  assert.ok(!C.condicoesDe({ ...semVida, equipment: { body: peca('Body_Armours/Plate_Vest', ['+{0} de Vida máxima']) } }, {}).has('peitoralSemVida'));
  // as quatro armaduras com Evasão na base (Couro: evasão; Placas: armadura)
  const evas = (cls) => Catalogo.catalogo().classes[cls].bases.find((b) => (b.atributos?.evasao?.max ?? 0) > 0 && !(b.atributos?.armadura?.max > 0)).id;
  const quatro = { maxHp: 1, hp: 1, equipment: Object.fromEntries([['head', 'Helmets'], ['body', 'Body_Armours'], ['gloves', 'Gloves'], ['feet', 'Boots']].map(([s, c]) => [s, peca(evas(c))])) };
  assert.ok(C.condicoesDe(quatro, {}).has('armadurasComEvasao'));
  assert.ok(!C.condicoesDe(quatro, {}).has('armadurasComArmadura'));
  // as maestrias de Vida alocadas
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { sistema: 'poe' });
  P.garantir(e);
  const vida = Object.values(P.arvore().nos).filter((n) => n.tipo === 'mastery' && /\bVida\b/.test(n.nome)).slice(0, 2).map((n) => n.id);
  e.passivas.alocados = [...e.passivas.alocados, ...vida];
  const conds = C.condicoesDe(e, {});
  assert.ok(C.vale(conds, 'maestriasDe:Vida:2'));
  assert.ok(!C.vale(conds, 'maestriasDe:Vida:3'));
  // (bug: o nome da condição com parâmetro era pulado no `vale` — nenhuma valia: atributo mínimo, fúria, cargas…)
  const com = C.condicoesDe({ hunt: { clock: 5, furia: { n: 4 }, cargasPoe: { poder: { n: 2, ate: 9 } } } }, {}, { str: 120, dex: 30 });
  assert.ok(C.vale(com, 'atrMin:str:100') && !C.vale(com, 'atrMin:dex:100'));
  assert.ok(C.vale(com, 'atrMaior:str:dex'));
  assert.ok(C.vale(com, 'furiaMin:3') && !C.vale(com, 'furiaMin:5'));
  assert.ok(C.vale(com, 'semCargas:frenesi') && C.vale(com, 'comCargas:poder') && !C.vale(com, 'semCargas:poder'));
  // auras e arautos ligados
  assert.equal(C.fatorDaEscala({ hunt: { clock: 0, buffs: { a: { tipo: 'poe-aura', ate: 9 }, b: { tipo: 'poe-arauto', ate: 9 }, c: { tipo: 'poe-guarda', ate: 9 } } } }, {}, {}, 'aurasAtivas'), 2);
  // o crítico que não incendeia
  assert.equal(Af.daSoma({ critico_nao_incendeia: 1 }).criticoNaoIncendeia, true);
  // imune a Lento
  assert.equal(C.controleNoJogador({ afPoe: { imune_lento: 1 } }, 'lento').evitou, true);
  for (const [texto, stat] of [
    ['Vida máxima aumentada em {0}% se não houver Modificadores de Vida no Peitoral Equipado', 'life_inc@peitoralSemVida'],
    ['{0}% mais Vida Máxima se você tiver ao menos {1} Maestrias de Vida alocadas', 'life_more@maestriasDe:Vida:3'],
    ['Habilidades de Golpe Não Vaal focam em {0} Inimigo próximo adicional', 'golpe_alvos_extra'],
    ['Dano aumentadeo em {0}% para cada uma das suas Habilidades de Aura ou Arauto afetando você', 'dmg_inc%aurasAtivas'],
  ]) {
    const r = traduzirParte(texto, [10, 3]);
    assert.ok(['novo', 'equivalente', 'aproximado'].includes(r.estado), `${texto}: ${r.estado}`);
    assert.equal(r.efeitos[0].stat, stat, texto);
  }
  // o dreno instantâneo (C — a regra mudou a pedido do dono, 09/10: "continue com as maldições e o dreno instantâneo"): o dreno do PoE é ao
  // longo do tempo, e "X% do Dreno é Instantâneo" é a parte que entra na hora (`roubo_instantaneo_pct` — passivas-poe-maldicoes-dreno.test.mjs)
  const dreno = traduzirParte('{0}% do Dreno é Instantâneo', [10]);
  assert.equal(dreno.estado, 'novo');
  assert.equal(dreno.efeitos[0].stat, 'roubo_instantaneo_pct');
});

test('lote 5 da árvore — a defesa de UMA peça: "Evasão do seu Peitoral", "Defesas do Escudo", o elmo com mais armadura, o "por X no Escudo"', { skip: SEM }, async () => {
  const C = await import('../systems/itens-poe/condicoes-poe.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const { traduzirParte } = await import('../systems/itens-poe/traduzir.mjs');
  // as regras: cada linha vira a chave da peça (o aumento só daquela base)
  for (const [texto, stats] of [
    ['Evasão do seu Peitoral aumentada em {0}%', ['evasion_pct_peitoral']],
    ['Defesas do Escudo equipado aumentadas em {0}%', ['defesas_pct_escudo']],
    ['Escudo de Energia do Elmo Equipado aumentado em {0}%', ['es_pct_elmo']],
    ['Armadura das Botas e Luvas Equipadas aumentada em {0}%', ['armour_pct_botas', 'armour_pct_luvas']],
    ['Dano de Ataque aumentado em {0}% por cada {1} de Armadura ou Evasão no Escudo', ['dmg_inc%armEvaEscudo:10@ataque']],
    ['Imune a Sangramento se o Elmo Equipado tiver maior Armadura do que Evasão', ['imune_sangramento@elmoArmaduraMaior']],
  ]) {
    const r = traduzirParte(texto, [30, 10]);
    assert.ok(['novo', 'equivalente', 'aproximado'].includes(r.estado), `${texto}: ${r.estado}`);
    assert.deepEqual(r.efeitos.map((e) => e.stat), stats, texto);
  }
  // o elmo: mais armadura que evasão (a base da peça vestida)
  const elmo = (armor, evasion) => ({ poe: { classe: 'Helmets', base: 'Helmets/X', prefixos: [], sufixos: [], implicitos: [] }, base: { armor: [armor, armor], evasion: [evasion, evasion] } });
  assert.ok(C.condicoesDe({ equipment: { head: elmo(100, 20) } }, {}).has('elmoArmaduraMaior'));
  assert.ok(C.condicoesDe({ equipment: { head: elmo(10, 200) } }, {}).has('elmoEvasaoMaior'));
  // a escala "no Escudo": a armadura + a evasão da peça do escudo
  const escudo = { poe: { classe: 'Shields', af: { block: 24 } }, base: { armor: [150, 150], evasion: [50, 50], es: [30, 30] } };
  const extras = C.escalasDaFicha({ equipment: { shield: escudo } }, { 'dmg_inc%armEvaEscudo:10@ataque': 1, 'crit_dmg%esEscudo:10': 2, 'block%bloqueioEscudo:5': 1 }, { accuracy: 0 });
  assert.deepEqual(extras, { 'dmg_inc@ataque': 20, crit_dmg: 6, block: 4 });
  // a ficha: o aumento do Peitoral só multiplica a base do Peitoral (somado aos aumentos gerais), não a das outras peças
  const { personagemDeTeste } = await import('./apoio.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 50 }), { sistema: 'poe' });
  const peca = (classe, campo, v) => ({ id: e.equipment?.body?.id ?? 'x', count: 1, base: { [campo]: [v, v] }, poe: { classe, base: `${classe}/X`, af: {}, prefixos: [], sufixos: [], implicitos: [] } });
  e.equipment = { body: peca('Body_Armours', 'evasion', 400), feet: peca('Boots', 'evasion', 100) };
  Ficha.invalidar(e);
  const antes = Ficha.combate(e).evasion;
  e.equipment.body.poe.af = { evasion_pct_peitoral: 50 };
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).evasion - antes, 200);
});

test('lote 6 da árvore: bloquear ataque × magia, duas armas diferentes, "por Adaga empunhada", "por Arauto", com Escudo de Energia, os dois anéis', { skip: SEM }, async () => {
  const C = await import('../systems/itens-poe/condicoes-poe.mjs');
  const M = await import('../systems/itens-poe/mods-poe.mjs');
  // as armas: espada + machado são diferentes; duas adagas contam 2 para "por Adaga"
  const arma = (classe) => ({ poe: { classe, base: `${classe}/X`, prefixos: [], sufixos: [], implicitos: [] } });
  assert.ok(C.condicoesDe({ equipment: { weapon: arma('One_Hand_Swords'), shield: arma('One_Hand_Axes') } }, {}).has('armasDiferentes'));
  assert.ok(!C.condicoesDe({ equipment: { weapon: arma('Daggers'), shield: arma('Rune_Daggers') } }, {}).has('armasDiferentes'));
  assert.equal(C.fatorDaEscala({ equipment: { weapon: arma('Daggers'), shield: arma('Daggers') } }, {}, {}, 'armas:comAdaga'), 2);
  assert.equal(C.fatorDaEscala({ equipment: { weapon: arma('Daggers'), shield: arma('Shields') } }, {}, {}, 'armas:comAdaga'), 1);
  // os arautos (só eles) e o escudo de energia
  assert.equal(C.fatorDaEscala({ hunt: { clock: 0, buffs: { a: { tipo: 'poe-aura', ate: 9 }, b: { tipo: 'poe-arauto', ate: 9 } } } }, {}, {}, 'arautosAtivos'), 1);
  assert.ok(C.condicoesDe({ es: 10 }, {}).has('comEscudoDeEnergia'));
  assert.ok(!C.condicoesDe({ es: 0 }, {}).has('comEscudoDeEnergia'));
  // os dois anéis com modificador de Evasão
  const anel = (m) => ({ poe: { classe: 'Rings', base: 'Rings/X', prefixos: [{ modelo: m }], sufixos: [], implicitos: [] } });
  assert.ok(C.condicoesDe({ equipment: { ring: anel('+{0} de Evasão'), ring2: anel('+{0} de Evasão') } }, {}).has('aneisComEvasao'));
  assert.ok(!C.condicoesDe({ equipment: { ring: anel('+{0} de Evasão'), ring2: anel('+{0} de Vida máxima') } }, {}).has('aneisComEvasao'));
  // "ao Bloquear Dano Mágico" recupera o escudo só no bloqueio de magia (o de ataque não)
  const estado = { hp: 100, maxHp: 100, es: 0, equipment: {} };
  const hunt = { clock: 0 };
  const ficha = { energyShield: 200, afPoe: { 'ev:bloquearMagia:es': 30 }, eventosPoe: C.eventosDa({ 'ev:bloquearMagia:es': 30 }) };
  M.evento(estado, hunt, 'bloquearAtaque', ficha, {});
  assert.equal(estado.es, 0);
  M.evento(estado, hunt, 'bloquearMagia', ficha, {});
  assert.equal(estado.es, 30);
});
