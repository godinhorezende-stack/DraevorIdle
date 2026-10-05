// Incremento 4b: a árvore de passivas do PoE convertida para o formato da árvore do Draevor, com os efeitos traduzidos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { traduzirLinha, converterArvore, paraModelo } from '../systems/itens-poe/arvore.mjs';
import { validar } from '../systems/passivas/arvore.mjs';

test('as linhas da árvore viram efeitos da árvore do Draevor (atributo somado ou dano por tag); parênteses viram nota', () => {
  assert.deepEqual(paraModelo('Evasão aumentada em 14%'), { modelo: 'Evasão aumentada em {0}%', valores: [14] });
  assert.deepEqual(traduzirLinha('Vida máxima aumentada em 8%').efeitos, [{ add: 'hp_max', valor: 8 }]);
  assert.deepEqual(traduzirLinha('+10 de Força').efeitos, [{ add: 'str', valor: 10 }], 'as regras dos mods valem também');
  assert.deepEqual(traduzirLinha('Dano de Projétil aumentado em 12%').efeitos, [{ tag: 'projectile', dano: 12 }]);
  assert.deepEqual(traduzirLinha('Evasão e Armadura aumentadas em 6%').efeitos, [{ add: 'armour_pct', valor: 6 }, { add: 'evasion_pct', valor: 6 }]);
  const nota = traduzirLinha('(Recentemente se refere aos últimos 4 segundos)');
  assert.deepEqual([nota.estado, nota.efeitos.length], ['nota', 0]);
  const reg = traduzirLinha('Lacaios causam Dano aumentado em 10%');
  assert.equal(reg.estado, 'registrado');
  assert.equal(reg.efeitos.length, 0, 'sem regra: registrado, sem efeito (a chave automática não entra na árvore)');
  assert.ok(reg.registrados[0].stat.startsWith('poe.'));
});

test('converter: início por classe, custo 1, só o que um início alcança, ligações nos dois sentidos, keystone de texto', () => {
  const poe = {
    classes_iniciais: { Marauder: { no: 1 }, Witch: { no: 5 } },
    nos: [
      { id: 1, x: 0, y: 0, tipo: 'comum', nome: 'M', efeitos: [], vizinhos: [2] },
      { id: 2, x: 1, y: 0, tipo: 'comum', nome: 'Força', efeitos: ['+10 de Força'], vizinhos: [] },
      { id: 3, x: 2, y: 0, tipo: 'keystone', nome: 'Resoluto', efeitos: ['Não pode Evadir'], vizinhos: [2] },
      { id: 4, x: 9, y: 9, tipo: 'notavel', nome: 'Solto', efeitos: [], vizinhos: [] },
      { id: 5, x: 3, y: 0, tipo: 'comum', nome: 'W', efeitos: [], vizinhos: [3] },
    ],
    ligacoes: [],
  };
  const { arvore, relatorio } = converterArvore(poe);
  assert.deepEqual(arvore.inicios, { Marauder: '1', Witch: '5' });
  assert.equal(relatorio.foraDaArvore, 1, 'o nó solto fica de fora');
  const p = new Map(arvore.nos.map((n) => [n.id, n]));
  assert.equal(p.get('1').tipo, 'start');
  assert.deepEqual(p.get('2').efeitos, [{ add: 'str', valor: 10 }]);
  assert.equal(p.get('2').custo, 1);
  assert.deepEqual(p.get('3').keystone, { regra: 'texto', texto: 'Não pode Evadir' });
  assert.ok(p.get('2').conexoes.includes('1') && p.get('2').conexoes.includes('3'));
  assert.deepEqual(validar(arvore), []);
});

test('o arquivo gerado (gamedata/itens-poe/arvore-poe.json) é uma árvore válida do Draevor, com as 7 classes', () => {
  const a = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/arvore-poe.json', import.meta.url), 'utf8'));
  assert.deepEqual(validar(a), []);
  assert.deepEqual(Object.keys(a.inicios).filter((k) => !k.startsWith('asc:')).sort(), ['Duelist', 'Marauder', 'Ranger', 'Scion', 'Shadow', 'Templar', 'Witch']);
  assert.equal(Object.keys(a.ascendencias).length, 21, 'as 21 ascendências');
  assert.ok(a.nos.length > 2000);
  assert.ok(a.relatorio.estados.equivalente > 700);
});

test('4c — com ITENS_POE=1 a árvore em uso é a do PoE: início da classe, 1 ponto por level, 1 por nó, efeito na ficha, alocação do Draevor guardada', { skip: !existsSync('/home/deploy/referencias-poe/importado/itens-poe.json') && 'catálogo do PoE não importado' }, async () => {
  // Processo à parte: a árvore é escolhida ao carregar o módulo (com a variável ligada).
  const { execFileSync } = await import('node:child_process');
  const codigo = `
    process.env.ITENS_POE = '1';
    const P = await import('./systems/passivas/arvore.mjs');
    const Atributos = await import('./systems/personagem/atributos.mjs');
    const Afixos = await import('./systems/afixos.mjs');
    const { personagemDeTeste } = await import('./testes/apoio.mjs');
    const e = personagemDeTeste({ vocacao: 'knight', level: 30 });
    e.passivas = { alocados: ['inicio_knight', 'anel_0'], respecsGratis: 0, migrado: true, versaoDaArvore: 2 };
    P.garantir(e);
    const inicio = P.inicioDe(e);
    const viz = P.arvore().porId.get(inicio).conexoes.map((id) => P.arvore().porId.get(id));
    const vida = viz.find((n) => n.efeitos.some((x) => x.add === 'life')) ?? null;
    const antes = Afixos.soma(e).life ?? 0;
    const r = vida ? P.alocar(e, vida.id) : { ok: false };
    const depois = Afixos.soma(e).life ?? 0;
    console.log(JSON.stringify({ id: P.arvore().id, inicio, alocados: e.passivas.alocados, guardada: e.passivas.porArvore?.draevor?.alocados, pontos: P.pontos(e), alocou: r.ok, antes, depois, ganho: vida?.efeitos.find((x) => x.add === 'life')?.valor ?? null }));
  `;
  const r = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' }).trim().split('\n').pop());
  assert.equal(r.id, 'poe');
  assert.equal(r.inicio, '47175', 'knight sem escolha = Marauder, o nó inicial dele');
  assert.deepEqual(r.guardada, ['inicio_knight', 'anel_0'], 'a alocação da árvore do Draevor fica guardada');
  assert.equal(r.pontos.total, 29, 'level 30 = 29 pontos (1 por level, como no PoE)');
  assert.ok(r.alocou, 'aloca o vizinho de vida do início');
  assert.equal(r.pontos.usados, 1);
  assert.equal(r.depois - r.antes, r.ganho, 'o +Vida do nó entra na soma da ficha');
});

test('4e — ascendências: 2 pontos por boss de fim de ato (até 8), escolha no primeiro ponto (só da classe), nós com pontos próprios', { skip: !existsSync('/home/deploy/referencias-poe/importado/itens-poe.json') && 'catálogo do PoE não importado' }, async () => {
  const { execFileSync } = await import('node:child_process');
  const codigo = `
    process.env.ITENS_POE = '1';
    const P = await import('./systems/passivas/arvore.mjs');
    const { personagemDeTeste } = await import('./testes/apoio.mjs');
    const e = personagemDeTeste({ vocacao: 'knight', level: 30 });
    e.campanha = {}; // o personagem de teste vem com a campanha feita
    const r = {};
    r.semPontos = P.pontosDeAscendencia(e).total;
    r.recusaSemPonto = P.ascender(e, 'Juggernaut').ok;
    e.campanha = { facil: { bosses: [1] } };
    r.umAto = P.pontosDeAscendencia(e).total;
    r.opcoes = P.ascendenciasDaClasse(e).map((a) => a.slug).sort();
    r.outraClasse = P.ascender(e, 'Necromancer').ok;
    r.ascendeu = P.ascender(e, 'Juggernaut').ok;
    r.denovo = P.ascender(e, 'Berserker').ok;
    const ini = P.inicioDaAscendencia(e);
    r.inicioAlocado = e.passivas.alocados.includes(ini);
    const viz = P.arvore().porId.get(ini).conexoes[0];
    const antes = P.pontos(e).usados;
    r.alocouAsc = P.alocar(e, viz).ok;
    r.ptsAsc = P.pontosDeAscendencia(e);
    r.principalIgual = P.pontos(e).usados === antes;
    const outro = P.arvore().nos.find((n) => n.ascendencia === 'Berserker' && n.tipo !== 'start');
    r.outraAsc = P.podeAlocar(e, outro.id).ok;
    r.ilhados = P.ilhadosSemEles(e, []).length;
    e.campanha = { facil: { bosses: [1, 2, 3, 4] }, normal: { bosses: [1, 2] }, extra: { bosses: [5] } };
    r.teto = P.pontosDeAscendencia(e).total;
    console.log(JSON.stringify(r));
  `;
  const r = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' }).trim().split('\n').pop());
  assert.equal(r.semPontos, 0);
  assert.equal(r.recusaSemPonto, false, 'sem boss vencido não ascende');
  assert.equal(r.umAto, 2, '1 boss de fim de ato = 2 pontos');
  assert.deepEqual(r.opcoes, ['Berserker', 'Chieftain', 'Juggernaut'], 'as 3 do Marauder');
  assert.equal(r.outraClasse, false);
  assert.equal(r.ascendeu, true);
  assert.equal(r.denovo, false, 'uma vez só');
  assert.ok(r.inicioAlocado);
  assert.ok(r.alocouAsc);
  assert.deepEqual(r.ptsAsc, { total: 2, usados: 1, livres: 1 });
  assert.ok(r.principalIgual, 'o nó de ascendência não gasta ponto da árvore');
  assert.equal(r.outraAsc, false, 'nó de outra ascendência: recusa');
  assert.equal(r.ilhados, 0, 'a ascendência não conta como ilhada');
  assert.equal(r.teto, 8, 'até 8 pontos, como no PoE');
});

test('maestrias (como no PoE): abrem com um notável do grupo, escolhe-se 1 opção (sem repetir no mesmo tipo), o efeito entra, e saem com o notável', { skip: !existsSync('/home/deploy/referencias-poe/importado/itens-poe.json') && 'catálogo do PoE não importado' }, async () => {
  const { execFileSync } = await import('node:child_process');
  const codigo = `
    process.env.ITENS_POE = '1';
    const P = await import('./systems/passivas/arvore.mjs');
    const Afixos = await import('./systems/afixos.mjs');
    const { personagemDeTeste } = await import('./testes/apoio.mjs');
    const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
    e.campanha = {};
    P.garantir(e);
    const a = P.arvore();
    // a maestria de Vida mais perto do início, com uma opção que dá "+N de Vida máxima"
    const maestrias = a.nos.filter((n) => n.tipo === 'mastery' && n.opcoes.some((o) => o.efeitos.some((x) => x.add === 'life')));
    const notavelDe = (m) => a.nos.filter((n) => n.tipo === 'notable' && n.grupo === m.grupo).map((n) => ({ n, c: P.caminhoAte(e, n.id) })).filter((x) => x.c).sort((x, y) => x.c.length - y.c.length)[0];
    const alvo = maestrias.map((m) => ({ m, ...notavelDe(m) })).filter((x) => x.c).sort((x, y) => x.c.length - y.c.length)[0];
    const opc = alvo.m.opcoes.find((o) => o.efeitos.some((x) => x.add === 'life'));
    const r = {};
    r.semNotavel = P.podeAlocar(e, alvo.m.id, opc.id).motivo;
    for (const id of alvo.c) P.alocar(e, id);
    r.semOpcao = P.alocar(e, alvo.m.id).motivo;
    const antes = Afixos.soma(e).life ?? 0;
    r.alocou = P.alocar(e, alvo.m.id, opc.id).ok;
    r.ganhoDeVida = (Afixos.soma(e).life ?? 0) - antes;
    r.esperado = opc.efeitos.find((x) => x.add === 'life').valor;
    r.escolhida = e.passivas.maestrias[alvo.m.id] === opc.id;
    // outra maestria do mesmo tipo: a mesma opção não pode
    const outra = a.nos.find((n) => n.tipo === 'mastery' && n.nome === alvo.m.nome && n.id !== alvo.m.id);
    const nOutra = notavelDe(outra);
    for (const id of nOutra.c) P.alocar(e, id);
    r.repetida = P.alocar(e, outra.id, opc.id).motivo;
    r.outraOpcao = P.alocar(e, outra.id, outra.opcoes.find((o) => o.id !== opc.id).id).ok;
    // tirar o notável do grupo leva a maestria junto
    r.ilhada = P.ilhadosSemEles(e, [alvo.n.id]).includes(alvo.m.id);
    e.gold = 1e12;
    r.respec = P.respec(e, { ids: [alvo.n.id], junto: true }).ok;
    r.saiu = !e.passivas.alocados.includes(alvo.m.id) && !(alvo.m.id in (e.passivas.maestrias ?? {}));
    console.log(JSON.stringify(r));
  `;
  const r = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' }).trim().split('\n').pop());
  assert.equal(r.semNotavel, 'SEM_NOTAVEL');
  assert.equal(r.semOpcao, 'SEM_OPCAO');
  assert.ok(r.alocou && r.escolhida);
  assert.equal(r.ganhoDeVida, r.esperado, 'o efeito da opção escolhida entra na soma');
  assert.equal(r.repetida, 'OPCAO_REPETIDA');
  assert.ok(r.outraOpcao, 'outra opção na outra maestria do mesmo tipo pode');
  assert.ok(r.ilhada, 'sem o notável, a maestria fica sem grupo');
  assert.ok(r.respec && r.saiu, 'o respec do notável leva a maestria e a escolha');
});
