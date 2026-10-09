// A ÁRVORE DE PASSIVAS DO PoE no motor do jogo (auditoria da árvore, 09/10 — docs/auditorias/arvore-passivas-poe.md). No jogo oficial os
// testes da engine da árvore em `passivas.test.mjs` estão marcados "a adaptar" (usam a árvore do Draevor): aqui as MESMAS regras, com a
// árvore do PoE — alocação, caminho, recusas do servidor (o `Comandos.comando` que a sessão chama), respec, pontos, nós de escolha e
// persistência — e os modificadores com conta explícita: valor fixo, aumento aditivo, "mais", condição, sem duplicar, remoção, e o efeito
// chegando ao combate (dano de verdade, resistência, vida, velocidade).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const Afixos = await import('../systems/afixos.mjs');
const Ficha = await import('../systems/ficha.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Especializacoes = await import('../systems/personagem/especializacoes.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');

/** Um personagem da classe do PoE `classe` no level `level`, com a árvore do PoE garantida e os máximos sincronizados. */
function novo({ level = 60, classe = 'Scion', ascendencia = null } = {}) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level }), { sistema: 'poe', classePoe: classe });
  delete e.classe;
  P.garantir(e);
  if (ascendencia) e.passivas.ascendencia = ascendencia;
  P.garantir(e);
  Comandos.depoisDeMudar(e);
  return e;
}
/** O primeiro nó da principal com este texto (uma linha só). */
const achar = (texto) => {
  const n = P.arvore().nos.find((x) => !x.ascendencia && x.tipo !== 'mastery' && (x.textos ?? []).join('|') === texto);
  assert.ok(n, `nó "${texto}"`);
  return n;
};
/** Aloca o caminho até `id`, sem ele (pelo comando do servidor). Devolve o caminho inteiro. */
function ateAntes(e, id) {
  const c = P.caminhoAte(e, id);
  assert.ok(c?.length, `caminho até ${id}`);
  if (c.length > 1) {
    const r = Comandos.comando(e, { action: 'alocar', ids: c.slice(0, -1) });
    assert.ok(r.ok && r.feitos === c.length - 1, JSON.stringify(r));
  }
  return c;
}
const alocar = (e, id, opcao) => Comandos.comando(e, { action: 'alocar', id, ...(opcao != null ? { opcao } : {}) });
/** Um caminho com N nós comuns (as pontas que custam 1), para gastar pontos. */
const vizinhoLivre = (e) => {
  const meus = new Set(e.passivas.alocados);
  for (const id of e.passivas.alocados) for (const c of P.arvore().porId.get(id)?.conexoes ?? []) {
    const n = P.arvore().porId.get(c);
    if (!meus.has(c) && n && !n.ascendencia && n.tipo !== 'start' && n.tipo !== 'mastery' && P.custoDe(n) === 1) return c;
  }
  return null;
};

// ------------------------------------------------------------ a árvore no servidor

test('personagem novo: o início da classe do PoE vem alocado e os pontos são os do PoE (1 por level depois do 1º)', { skip: SEM }, () => {
  const e = novo({ level: 30, classe: 'Ranger' });
  assert.deepEqual(e.passivas.alocados, [P.arvore().inicios.Ranger]);
  assert.deepEqual(P.pontos(e), { total: 29, usados: 0, livres: 29 });
  e.level = 31;
  assert.equal(P.pontos(e).total, 30, 'subir de level dá o ponto');
});

test('alocar: o nó ligado entra e gasta 1 ponto; o desligado, o repetido, o que não existe, o início de outra classe e o pedido desconhecido são recusados', { skip: SEM }, () => {
  const e = novo({ level: 10 });
  const ligado = vizinhoLivre(e);
  assert.ok(alocar(e, ligado).ok);
  assert.equal(P.pontos(e).usados, 1);
  // Longe de tudo (o início do Marauder fica do outro lado): sem caminho.
  const longe = P.arvore().porId.get(P.arvore().inicios.Marauder).conexoes.find((c) => P.arvore().porId.get(c)?.tipo !== 'start');
  assert.equal(alocar(e, longe).motivo, 'SEM_CAMINHO');
  assert.equal(alocar(e, ligado).motivo, 'JA_ALOCADO');
  assert.equal(alocar(e, 'nao-existe').motivo, 'NAO_EXISTE');
  assert.equal(alocar(e, P.arvore().inicios.Marauder).motivo, 'INICIO');
  assert.equal(Comandos.comando(e, { action: 'hackear' }).motivo, 'DESCONHECIDO');
  assert.equal(P.pontos(e).usados, 1, 'nada do que foi recusado gastou ponto');
});

test('pontos: sem ponto livre não aloca; o caminho pedido para no primeiro que não cabe (os de antes ficam)', { skip: SEM }, () => {
  const e = novo({ level: 3 });
  const alvo = achar('Dano Corpo a Corpo aumentado em 12%');
  const c = P.caminhoAte(e, alvo.id);
  assert.ok(c.length > 2);
  const r = Comandos.comando(e, { action: 'alocar', ids: c });
  assert.equal(r.feitos, 2, 'só os 2 pontos do level 3');
  assert.match(r.aviso, /Faltam pontos/);
  assert.equal(P.pontos(e).livres, 0);
  assert.equal(alocar(e, c[2]).motivo, 'SEM_PONTOS');
});

test('caminho: o menor caminho até um nó longe sai na ordem de alocar; o que já é seu é vazio; alocado nó a nó pelo servidor', { skip: SEM }, () => {
  const e = novo({ level: 90 });
  const alvo = achar('+5% de todas Resistências Elementais');
  const c = P.caminhoAte(e, alvo.id);
  assert.equal(c[c.length - 1], alvo.id);
  // cada nó do caminho é vizinho do anterior (ou de um nó seu)
  const meus = new Set(e.passivas.alocados);
  for (const id of c) {
    assert.ok(P.arvore().porId.get(id).conexoes.some((x) => meus.has(x)), `${id} ligado`);
    meus.add(id);
  }
  assert.ok(Comandos.comando(e, { action: 'alocar', ids: c }).ok);
  assert.deepEqual(P.caminhoAte(e, alvo.id), []);
});

test('respec: tirar um nó do meio ilharia os de depois (recusa, com a lista); com "junto" tira todos e devolve os pontos; o completo tira tudo', { skip: SEM }, () => {
  const e = novo({ level: 90 });
  const alvo = achar('+5% de todas Resistências Elementais');
  const c = P.caminhoAte(e, alvo.id);
  Comandos.comando(e, { action: 'alocar', ids: c });
  const usados = P.pontos(e).usados;
  const meio = c[Math.floor(c.length / 2)];
  const recusa = Comandos.comando(e, { action: 'respec', id: meio });
  assert.equal(recusa.motivo, 'ILHARIA');
  assert.ok(recusa.ilhados.includes(alvo.id));
  const r = Comandos.comando(e, { action: 'respec', id: meio, junto: true });
  assert.ok(r.ok);
  assert.ok(!e.passivas.alocados.includes(alvo.id));
  assert.equal(P.pontos(e).usados, usados - r.tirados);
  assert.ok(Comandos.comando(e, { action: 'respec', tudo: true }).ok);
  assert.deepEqual(e.passivas.alocados, [P.inicioDe(e)]);
  assert.equal(P.pontos(e).usados, 0);
});

test('maestria: abre com um notável do grupo, escolhe UMA opção (não a mesma em outra maestria igual) e sai junto com o notável', { skip: SEM }, () => {
  const e = novo({ level: 90 });
  const maestria = P.arvore().nos.find((n) => n.tipo === 'mastery' && /Vida/.test(n.nome) && n.opcoes.length > 1);
  const notavel = P.arvore().nos.find((n) => n.tipo === 'notable' && n.grupo === maestria.grupo && !n.ascendencia);
  assert.equal(alocar(e, maestria.id, maestria.opcoes[0].id).motivo, 'SEM_NOTAVEL');
  Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, notavel.id) });
  assert.equal(alocar(e, maestria.id).motivo, 'SEM_OPCAO');
  assert.ok(alocar(e, maestria.id, maestria.opcoes[0].id).ok);
  assert.equal(e.passivas.maestrias[maestria.id], maestria.opcoes[0].id);
  // outra maestria de mesmo nome não repete a opção
  const outra = P.arvore().nos.find((n) => n.tipo === 'mastery' && n.nome === maestria.nome && n.id !== maestria.id);
  if (outra) {
    const n2 = P.arvore().nos.find((n) => n.tipo === 'notable' && n.grupo === outra.grupo && !n.ascendencia);
    Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, n2.id) });
    assert.equal(alocar(e, outra.id, maestria.opcoes[0].id).motivo, 'OPCAO_REPETIDA');
  }
  assert.ok(Comandos.comando(e, { action: 'respec', id: notavel.id, junto: true }).ok);
  assert.ok(!e.passivas.alocados.includes(maestria.id), 'a maestria saiu com o notável');
  assert.equal(e.passivas.maestrias?.[maestria.id], undefined);
});

test('nós de ESCOLHA da ascendência (como no PoE): abrem pelo nó-pai, não gastam ponto e são UMA por pai — a Assassina escolhe Na Jugular OU Apunhalada', { skip: SEM }, () => {
  const e = novo({ level: 90, classe: 'Shadow', ascendencia: 'Assassin' });
  const pai = P.arvore().nos.find((n) => n.ascendencia === 'Assassin' && /Estilo de Assassinato/.test(n.nome));
  const [a, b] = P.arvore().nos.filter((n) => n.opcaoDe === pai.id);
  assert.ok(a && b, 'as duas opções');
  assert.equal(P.custoDe(a), 0);
  assert.equal(alocar(e, a.id).motivo, 'SEM_CAMINHO', 'sem o pai não há nem ligação');
  Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, pai.id) });
  const usados = P.pontosDeAscendencia(e).usados;
  assert.ok(alocar(e, a.id).ok);
  assert.equal(P.pontosDeAscendencia(e).usados, usados, 'a opção não gasta ponto de ascendência');
  assert.equal(alocar(e, b.id).motivo, 'OPCAO_REPETIDA');
  // trocar: tira a escolhida, escolhe a outra
  assert.ok(Comandos.comando(e, { action: 'respec', id: a.id }).ok);
  assert.ok(alocar(e, b.id).ok);
});

test('Caçadora de Relíquias: os notáveis de escolha (a 9 nós do início) cabem nos 8 pontos de ascendência, como no PoE', { skip: SEM }, () => {
  const e = novo({ level: 90, classe: 'Scion', ascendencia: 'Reliquarian' });
  assert.equal(P.pontosDeAscendencia(e).total, 8);
  const alvo = P.arvore().porId.get('2768');
  assert.ok(alvo.opcaoDe, 'União da Carne é opção de escolha');
  const c = P.caminhoAte(e, alvo.id);
  assert.equal(c.length, 9);
  const r = Comandos.comando(e, { action: 'alocar', ids: c });
  assert.ok(r.ok && r.feitos === 9, JSON.stringify(r));
  assert.equal(P.pontosDeAscendencia(e).usados, 8);
});

test('pontos que um nó CONCEDE (Ascendente: "Concede 1 Ponto de Habilidade Passiva"): somam no total; tirar o nó com os pontos gastos é recusado', { skip: SEM }, () => {
  const e = novo({ level: 4, classe: 'Scion', ascendencia: 'Ascendant' });
  const concede = P.arvore().nos.find((n) => n.ascendencia === 'Ascendant' && (n.efeitos ?? []).some((x) => x.add === 'pontos_passiva' && x.valor === 1) && (n.textos ?? []).length === 1);
  Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, concede.id) });
  assert.ok(e.passivas.alocados.includes(concede.id));
  assert.equal(P.pontos(e).total, 4, '3 do level + 1 do nó');
  for (let i = 0; i < 4; i++) assert.ok(alocar(e, vizinhoLivre(e)).ok);
  assert.equal(P.pontos(e).livres, 0);
  const r = Comandos.comando(e, { action: 'respec', id: concede.id, junto: true });
  assert.equal(r.motivo, 'PONTOS_NEGATIVOS', JSON.stringify(r));
  assert.ok(e.passivas.alocados.includes(concede.id), 'nada saiu');
  // o respec completo sempre pode
  assert.ok(Comandos.comando(e, { action: 'respec', tudo: true }).ok);
});

test('déficit de pontos (um personagem antigo que caiu de level): a tela recebe o déficit, nada novo se aloca, e tirar nós volta ao normal', { skip: SEM }, () => {
  const e = novo({ level: 5 });
  for (let i = 0; i < 4; i++) assert.ok(alocar(e, vizinhoLivre(e)).ok);
  e.level = 3; // (antes da regra do PoE, a morte derrubava level)
  assert.deepEqual(P.pontos(e), { total: 2, usados: 4, livres: 0, deficit: 2 });
  assert.equal(P.vista(e).pontos.deficit, 2);
  assert.equal(alocar(e, vizinhoLivre(e)).motivo, 'SEM_PONTOS');
  const pontas = e.passivas.alocados.filter((id) => id !== P.inicioDe(e) && !P.ilhadosSemEles(e, [id]).length).slice(0, 2);
  assert.ok(Comandos.comando(e, { action: 'respec', ids: pontas }).ok);
  assert.equal(P.pontos(e).deficit, undefined);
});

test('persistência: o estado gravado (JSON, como o autosave) volta com os mesmos nós, maestrias, ascendência e a mesma soma', { skip: SEM }, () => {
  const e = novo({ level: 90, classe: 'Shadow', ascendencia: 'Assassin' });
  const maestria = P.arvore().nos.find((n) => n.tipo === 'mastery' && /Vida/.test(n.nome));
  const notavel = P.arvore().nos.find((n) => n.tipo === 'notable' && n.grupo === maestria.grupo && !n.ascendencia);
  Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, notavel.id) });
  alocar(e, maestria.id, maestria.opcoes[0].id);
  const pai = P.arvore().nos.find((n) => n.ascendencia === 'Assassin' && /Estilo de Assassinato/.test(n.nome));
  Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, pai.id) });
  const gravado = JSON.parse(JSON.stringify(e));
  P.garantir(gravado);
  assert.deepEqual(gravado.passivas.alocados, e.passivas.alocados);
  assert.deepEqual(gravado.passivas.maestrias, e.passivas.maestrias);
  assert.equal(gravado.passivas.ascendencia, 'Assassin');
  assert.deepEqual(P.efeitos(gravado).adds, P.efeitos(e).adds);
  assert.deepEqual(P.pontos(gravado), P.pontos(e));
});

// ------------------------------------------------------------ os modificadores (conta explícita)

test('valor fixo: "+10 de Força" soma 10 na Força da soma (e só uma vez — o mesmo nó não entra duas vezes)', { skip: SEM }, () => {
  const e = novo();
  const no = achar('+10 de Força');
  ateAntes(e, no.id);
  const antes = Afixos.soma(e).str ?? 0;
  assert.ok(alocar(e, no.id).ok);
  assert.equal((Afixos.soma(e).str ?? 0) - antes, 10);
  assert.equal(alocar(e, no.id).motivo, 'JA_ALOCADO');
  assert.equal((Afixos.soma(e).str ?? 0) - antes, 10, 'sem duplicar');
  assert.ok(Comandos.comando(e, { action: 'respec', id: no.id }).ok);
  assert.equal(Afixos.soma(e).str ?? 0, antes, 'tirou: o efeito saiu');
});

test('aumento aditivo: dois "Vida máxima aumentada em X%" somam no mesmo % (vida = base × (1 + soma/100)), e tirar devolve a vida', { skip: SEM }, () => {
  const e = novo({ level: 90 });
  const a = achar('Vida máxima aumentada em 5%');
  ateAntes(e, a.id);
  const pctAntes = (Especializacoes.efeitos(e).stats.life ?? 0) + (Afixos.soma(e).life_inc ?? 0);
  const vidaAntes = e.maxHp;
  const base = vidaAntes / (1 + pctAntes / 100);
  assert.ok(alocar(e, a.id).ok);
  assert.ok(Math.abs(e.maxHp - base * (1 + (pctAntes + 5) / 100)) <= 1, `${e.maxHp} ≈ ${base * (1 + (pctAntes + 5) / 100)}`);
  // O segundo: o caminho até ele pode ter Força (vida fixa) — a base se mede de novo logo antes dele.
  const b = P.arvore().nos.find((n) => n.id !== a.id && !n.ascendencia && (n.textos ?? []).join('|') === 'Vida máxima aumentada em 6%');
  ateAntes(e, b.id);
  const pct2 = (Especializacoes.efeitos(e).stats.life ?? 0) + (Afixos.soma(e).life_inc ?? 0);
  assert.ok(pct2 >= pctAntes + 5, 'o % do primeiro continua na soma');
  const base2 = e.maxHp / (1 + pct2 / 100);
  assert.ok(alocar(e, b.id).ok);
  assert.ok(Math.abs(e.maxHp - base2 * (1 + (pct2 + 6) / 100)) <= 1, 'o segundo soma no MESMO % (aditivo), não multiplica');
  // tirar devolve: o respec completo zera o % da árvore e a vida volta à base sem nó nenhum
  assert.ok(Comandos.comando(e, { action: 'respec', tudo: true }).ok);
  assert.equal((Especializacoes.efeitos(e).stats.life ?? 0) + (Afixos.soma(e).life_inc ?? 0), 0);
  assert.ok(e.maxHp < vidaAntes, 'sem os nós de vida a vida cai');
});

test('aumento aditivo da defesa: "Armadura aumentada em 14%" sobre a armadura da peça vestida = base × (1 + 14/100)', { skip: SEM }, () => {
  const e = novo({ level: 90 });
  // só a peça medida (as do personagem de teste também têm armadura)
  e.equipment = { body: { id: 3357, count: 1, base: { armor: [500, 500] }, poe: { classe: 'Body_Armours', base: 'Body_Armours/X', af: {}, prefixos: [], sufixos: [], implicitos: [] } } };
  const no = achar('Armadura aumentada em 14%');
  ateAntes(e, no.id);
  Ficha.invalidar(e);
  const pct = Afixos.soma(e).armour_pct ?? 0;
  const flat = Afixos.soma(e).armor_flat ?? 0;
  assert.equal(Ficha.combate(e).armor, Math.round((500 + flat) * (1 + pct / 100)));
  assert.ok(alocar(e, no.id).ok);
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).armor, Math.round((500 + flat) * (1 + (pct + 14) / 100)));
  // trocar a peça (equipamento) refaz: sem a armadura da peça, o % não tem onde agir
  delete e.equipment.body;
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).armor, Math.round(flat * (1 + (pct + 14) / 100)));
});

test('condição: "+3% de Chance de Bloquear… enquanto Segurar Duas Armas ou um Escudo" só vale com escudo (ou duas armas)', { skip: SEM }, () => {
  const e = novo({ level: 90 });
  const no = achar('+3% de Chance de Bloquear o Dano de Ataques enquanto Segurar Duas Armas ou um Escudo');
  ateAntes(e, no.id);
  const bloqueio = () => { Ficha.invalidar(e); return ModsPoe.valor(Ficha.combate(e), 'block'); };
  // sem escudo: o nó não muda nada
  delete e.equipment.shield;
  const semEscudoAntes = bloqueio();
  assert.ok(alocar(e, no.id).ok);
  assert.equal(bloqueio(), semEscudoAntes, 'sem escudo (nem duas armas) a condição não vale');
  // com escudo: o nó soma os 3
  e.equipment.shield = { id: 3357, count: 1, poe: { classe: 'Shields', base: 'Shields/X', af: {}, prefixos: [], sufixos: [], implicitos: [] } };
  const comEscudo = bloqueio();
  assert.ok(Comandos.comando(e, { action: 'respec', id: no.id }).ok);
  assert.equal(comEscudo - bloqueio(), 3);
});

test('"mais" (multiplicador independente): "10% mais Dano com Acertos e Afecções contra Inimigos em Vida Baixa" multiplica o golpe por 1,10 só no alvo em vida baixa', { skip: SEM }, () => {
  const e = novo({ level: 90 });
  // (é a opção de uma maestria: abre com um notável do grupo)
  const maestria = P.arvore().nos.find((n) => n.tipo === 'mastery' && n.opcoes.some((o) => o.efeitos.some((x) => x.add === 'mais_dano@alvoVidaBaixa')));
  assert.ok(maestria, 'há opção de maestria com o "mais" condicional');
  const opcao = maestria.opcoes.find((o) => o.efeitos.some((x) => x.add === 'mais_dano@alvoVidaBaixa'));
  const valor = opcao.efeitos.find((x) => x.add === 'mais_dano@alvoVidaBaixa').valor;
  const notavel = P.arvore().nos.find((n) => n.tipo === 'notable' && n.grupo === maestria.grupo && !n.ascendencia);
  Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, notavel.id) });
  assert.ok(alocar(e, maestria.id, opcao.id).ok);
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  const alvo = (hp) => ({ uid: 1, x: 99, y: 99, hp, maxHp: 100, estados: {} });
  const cheio = ModsPoe.fichaDoGolpe(f, ['ataque', 'corpo'], { alvo: alvo(100), estado: e });
  const baixo = ModsPoe.fichaDoGolpe(f, ['ataque', 'corpo'], { alvo: alvo(10), estado: e });
  assert.equal((cheio.fatorDasCargas ?? 1), (f.fatorDasCargas ?? 1));
  assert.ok(Math.abs((baixo.fatorDasCargas ?? 1) - (f.fatorDasCargas ?? 1) * (1 + valor / 100)) < 1e-9);
});

// ------------------------------------------------------------ a integração com o combate

test('dano de verdade: "Dano Corpo a Corpo aumentado em 12%" soma 12 no físico do golpe corpo a corpo (e nada no de projétil) — a afinidade por tag não é mais usada', { skip: SEM }, () => {
  const e = novo({ level: 90 });
  const no = achar('Dano Corpo a Corpo aumentado em 12%');
  assert.deepEqual(no.efeitos, [{ add: 'dmg_inc@corpo', valor: 12 }]);
  ateAntes(e, no.id);
  Ficha.invalidar(e);
  const golpe = (tags) => ModsPoe.fichaDoGolpe(Ficha.combate(e), tags, { estado: e }).danoDoElemento?.physical ?? 0;
  const antes = { corpo: golpe(['ataque', 'corpo']), proj: golpe(['ataque', 'projetil']) };
  assert.ok(alocar(e, no.id).ok);
  Ficha.invalidar(e);
  assert.equal(golpe(['ataque', 'corpo']) - antes.corpo, 12);
  assert.equal(golpe(['ataque', 'projetil']), antes.proj);
  // nenhum nó da árvore do PoE usa o formato `tag` (a afinidade do Draevor, que o golpe do PoE não lê)
  const comTag = P.arvore().nos.filter((n) => [...(n.efeitos ?? []), ...(n.opcoes ?? []).flatMap((o) => o.efeitos ?? [])].some((x) => x.tag));
  assert.deepEqual(comTag.map((n) => n.id), []);
});

test('combate de verdade: com "Dano Corpo a Corpo aumentado em 12%" os golpes da espada (mesma semente) causam (100 + p + 12)/(100 + p) do dano', { skip: SEM }, async () => {
  const Cacadas = await import('../systems/cacadas.mjs');
  const Treino = await import('../systems/treino.mjs');
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const { criarMonstro } = await import('../systems/hunt/monstros.mjs');
  const { round } = await import('../systems/hunt/combate.mjs');
  const { PERSONAGEM, HUNT_DE_TESTE } = await import('./apoio.mjs');
  const espada = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'fire sword').id);
  const montar = (comNo) => {
    const e = novo({ level: 90, classe: 'Marauder' });
    Treino.garantir(e);
    e.equipment = { weapon: { id: espada, count: 1 } };
    const no = achar('Dano Corpo a Corpo aumentado em 12%');
    const c = P.caminhoAte(e, no.id);
    Comandos.comando(e, { action: 'alocar', ids: comNo ? c : c.slice(0, -1) });
    e.maxHp = e.hp = 1e9;
    e.maxMana = e.mana = 1e9;
    Ficha.invalidar(e);
    assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
    const h = e.hunt;
    delete h.instancia;
    h.respawns = [];
    h.outrosAndares = {};
    const m = criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null);
    m.hp = m.maxHp = 1e12;
    delete m.spawn;
    h.monstros.splice(0, h.monstros.length, m);
    h.alvo = m.uid;
    return e;
  };
  const dano = (e) => {
    const original = Math.random;
    let s = 99;
    Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    try {
      let d = 0;
      for (let i = 0; i < 200; i++) for (const x of round(e, PERSONAGEM).eventos) if (x.t === 'dmg' && x.foe) d += x.v;
      return d;
    } finally {
      Math.random = original;
    }
  };
  const sem = montar(false);
  const com = montar(true);
  const p = ModsPoe.fichaDoGolpe(Ficha.combate(sem), ['ataque', 'corpo'], { estado: sem }).danoDoElemento.physical;
  const razao = dano(com) / dano(sem);
  const esperado = (100 + p + 12) / (100 + p);
  assert.ok(Math.abs(razao - esperado) < 0.01, `razão ${razao.toFixed(4)} × esperado ${esperado.toFixed(4)} (físico ${p}%)`);
});

test('resistência: "+5% de todas Resistências Elementais" sobe 5 em fogo, gelo e raio na ficha (abaixo do teto)', { skip: SEM }, () => {
  const e = novo({ level: 90 });
  const no = achar('+5% de todas Resistências Elementais');
  ateAntes(e, no.id);
  Ficha.invalidar(e);
  const antes = { ...Ficha.combate(e).protection };
  assert.ok(alocar(e, no.id).ok);
  Ficha.invalidar(e);
  const depois = Ficha.combate(e).protection;
  for (const el of ['fire', 'ice', 'energy']) if (antes[el] + 5 <= 75) assert.equal(depois[el] - antes[el], 5, el);
  assert.equal(depois.chaos, antes.chaos, 'o caos não muda');
});

test('velocidade: "Velocidade de Ataque aumentada em 4%" encurta o intervalo do golpe na razão (1 + s/100) / (1 + (s + 4)/100)', { skip: SEM }, () => {
  const e = novo({ level: 90 });
  const no = achar('Velocidade de Ataque aumentada em 4%');
  ateAntes(e, no.id);
  Ficha.invalidar(e);
  const s = Afixos.soma(e).atk_speed ?? 0;
  const antes = Ficha.combate(e).intervaloDoGolpeMs;
  assert.ok(alocar(e, no.id).ok);
  Ficha.invalidar(e);
  const esperado = (antes * (1 + s / 100)) / (1 + (s + 4) / 100);
  assert.ok(Math.abs(Ficha.combate(e).intervaloDoGolpeMs - esperado) <= 1, `${Ficha.combate(e).intervaloDoGolpeMs} ≈ ${esperado}`);
});

test('a sessão (WebSocket) entrega o pedido `passivas` ao comando validado pelo servidor e manda a vista com os pontos (com o déficit)', { skip: SEM }, () => {
  const sessao = readFileSync(new URL('../websocket/sessao.mjs', import.meta.url), 'utf8');
  assert.match(sessao, /case 'passivas':/);
  assert.match(sessao, /ComandosDasPassivas\.comando\(this\.estado, m, emCacada\)/);
  assert.match(sessao, /view: Passivas\.vista\(this\.estado, emCacada\)/);
  // o uso de frasco dispara os eventos "ao usar um Frasco" (a Maestria de Frascos)
  assert.match(sessao, /ModsPoe\.eventosDoFrasco\(this\.estado, classeDoFrasco/);
});

// ------------------------------------------------------------ as correções da auditoria (mecanismos compartilhados)

test('as tags das gemas viram tags de golpe (Runa = Brand, Marca, Feitiço, Vínculo, Golpear, Impacto…): "Chance de Crítico de Runas" só vale nas Runas', { skip: SEM }, () => {
  assert.deepEqual(ModsPoe.tagsDoPoe(['Runa', 'Magia']).sort(), ['magia', 'runa']);
  for (const [poe, golpe] of [['Golpear', 'golpe'], ['Impacto', 'pancada'], ['Marca', 'marca'], ['Feitiço', 'feitico'], ['Vínculo', 'vinculo'], ['Canalização', 'canalizar'], ['Ativação', 'ativada'], ['Retaliação', 'retaliacao'], ['Nova', 'nova']]) {
    assert.ok(ModsPoe.tagsDoPoe([poe]).includes(golpe), poe);
  }
  const ficha = { afPoe: {}, porTag: [{ stat: 'crit_chance_inc', tags: ['runa'], valor: 30 }] };
  assert.equal(ModsPoe.somaPorTags(ficha, ModsPoe.tagsDoPoe(['Runa', 'Magia'])).crit_chance_inc, 30);
  assert.equal(ModsPoe.somaPorTags(ficha, ModsPoe.tagsDoPoe(['Magia', 'Projétil'])).crit_chance_inc, undefined);
});

test('frascos: "Recupera 4% de Vida ao usar um Frasco" e "… ao usar um Frasco de Mana" disparam; "25% de chance de ganhar Carga de Frasco no Crítico" ganha a carga', { skip: SEM }, () => {
  const estado = { hp: 50, maxHp: 100, mana: 10, maxMana: 100, es: 0, equipment: {}, hunt: { clock: 0, efeitosDoJogador: { dots: [{ tipo: 'veneno', falta: 9 }] } }, frascos: [{ poe: { cargas: 3 } }, null] };
  const af = { 'ev:usarFrasco:vidaPct': 4, 'ev:usarFrascoMana:removerAfeccao': 100 };
  const ficha = { energyShield: 0, afPoe: af, eventosPoe: ModsPoe.eventosDa(af) };
  ModsPoe.eventosDoFrasco(estado, 'Life_Flasks', ficha);
  assert.equal(estado.hp, 54);
  assert.equal(estado.hunt.efeitosDoJogador.dots.length, 1, 'o de vida não dispara o "de Mana"');
  ModsPoe.eventosDoFrasco(estado, 'Mana_Flasks', ficha);
  assert.equal(estado.hp, 58, 'qualquer frasco dispara o "ao usar um Frasco"');
  assert.equal(estado.hunt.efeitosDoJogador.dots.length, 0, 'o de mana remove a afecção');
  // a carga no crítico (a chance 100 para o teste ser exato)
  const fc = { afPoe: { 'ev:critico:frascoChance': 100 }, eventosPoe: ModsPoe.eventosDa({ 'ev:critico:frascoChance': 100 }) };
  ModsPoe.evento(estado, estado.hunt, 'critico', fc, {});
  assert.equal(estado.frascos[0].poe.cargas, 4);
});

test('auditoria: todo nó da árvore do PoE com efeito aloca pelo motor, soma exatamente o que diz e sai no respec (2.000+ nós, alocados de verdade)', { skip: SEM }, async () => {
  const A = await import('../admin/auditoria-arvore-passivas.mjs');
  const r = A.auditarArvore();
  assert.ok(r.resumo.verificadosNoMotor > 2000);
  const falhas = r.nos.filter((n) => n.verificacao && n.verificacao !== 'ok');
  assert.deepEqual(falhas.map((n) => `${n.id} ${n.nome}: ${JSON.stringify(n.verificacao)}`), []);
  // nenhum efeito traduzido fica no formato `tag` (morto no modo PoE)
  assert.ok(!r.nos.some((n) => n.desconectados.some((d) => d.efeito.startsWith('tag:'))));
});

test('"Caminho do Marauder" (Ascendente): o início do Marauder vale como seu — aloca a partir dele; tirar o Caminho ilha o que só se ligava por ele', { skip: SEM }, () => {
  const e = novo({ level: 90, classe: 'Scion', ascendencia: 'Ascendant' });
  const caminho = P.arvore().nos.find((n) => n.nome === 'Caminho do Marauder');
  assert.deepEqual(caminho.efeitos.map((x) => x.add), ['inicio_extra:Marauder', 'pontos_passiva']);
  const inicioM = P.arvore().inicios.Marauder;
  const vizinho = P.arvore().porId.get(inicioM).conexoes.find((c) => { const n = P.arvore().porId.get(c); return n && n.tipo !== 'start' && !n.ascendencia; });
  // antes do Caminho: o vizinho do início do Marauder não se liga a nada do Scion (no centro)
  assert.equal(alocar(e, vizinho).motivo, 'SEM_CAMINHO');
  assert.deepEqual(P.iniciosExtras(e), []);
  assert.ok(Comandos.comando(e, { action: 'alocar', ids: P.caminhoAte(e, caminho.id) }).ok);
  assert.deepEqual(P.iniciosExtras(e), [inicioM]);
  assert.deepEqual(P.vista(e).iniciosExtras, [inicioM]);
  assert.deepEqual(P.caminhoAte(e, vizinho), [vizinho], 'o caminho parte do início do Marauder');
  assert.ok(alocar(e, vizinho).ok);
  // tirar o Caminho deixaria o vizinho sem raiz
  const r = Comandos.comando(e, { action: 'respec', id: caminho.id });
  assert.equal(r.motivo, 'ILHARIA');
  assert.ok(r.ilhados.includes(vizinho));
  assert.ok(Comandos.comando(e, { action: 'respec', id: caminho.id, junto: true }).ok);
  assert.ok(!e.passivas.alocados.includes(vizinho));
  assert.deepEqual(P.iniciosExtras(e), []);
});

test('dreno "de Ataques" (a regra própria da árvore, antes aproximada): o nó dá o roubo da ficha, o ataque cria a instância de roubo e a magia não rouba — o roubo do PoE', { skip: SEM }, () => {
  const e = novo({ level: 90 });
  const linha = /^\d+(\.\d+)?% do Dano de Ataques é Drenado como Vida$/;
  const no = P.arvore().nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && (n.textos ?? []).some((t) => linha.test(t)));
  assert.ok(no, 'há nó com o dreno de ataques');
  const i = no.textos.findIndex((t) => linha.test(t));
  assert.equal(no.estados[i], 'equivalente');
  const dreno = no.efeitos.filter((x) => x.add === 'life_leech').reduce((s2, x) => s2 + x.valor, 0);
  assert.ok(dreno > 0);
  ateAntes(e, no.id);
  Ficha.invalidar(e);
  const antes = Ficha.combate(e).lifeLeech;
  assert.ok(alocar(e, no.id).ok);
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  assert.ok(Math.abs(f.lifeLeech - antes - dreno / 100) < 1e-9);
  e.hunt = { clock: 0 };
  Ficha.aplicarLeech(e, 1000, [], 'x', { x: 0, y: 0 }, f, null, { ataque: false });
  assert.equal((e.hunt.roubos ?? []).filter((r) => r.recurso === 'vida').length, 0, 'a magia não rouba vida (o PoE)');
  Ficha.aplicarLeech(e, 1000, [], 'x', { x: 0, y: 0 }, f, null, { ataque: true });
  const instancia = e.hunt.roubos.find((r) => r.recurso === 'vida');
  assert.ok(instancia, 'o ataque cria a instância de roubo');
  assert.equal(instancia.restante, Math.min(Math.floor(1000 * f.lifeLeech), (e.maxHp * 10) / 100), 'no máximo 10% da vida por instância');
});

test('bloqueio da regra própria da árvore: "+X% de Chance de Bloquear o Dano de Ataques enquanto portar um Escudo" só vale com escudo (antes valia sempre, aproximado)', { skip: SEM }, () => {
  const e = novo({ level: 90 });
  const linha = /^\+\d+% de Chance de Bloquear o Dano de Ataques enquanto portar um Escudo$/;
  const no = P.arvore().nos.find((n) => !n.ascendencia && n.tipo !== 'mastery' && (n.textos ?? []).some((t) => linha.test(t)));
  assert.ok(no, 'há nó com o bloqueio com escudo');
  assert.equal(no.estados[no.textos.findIndex((t) => linha.test(t))], 'equivalente');
  const valor = no.efeitos.filter((x) => x.add === 'block@comEscudo').reduce((s2, x) => s2 + x.valor, 0);
  assert.ok(valor > 0);
  ateAntes(e, no.id);
  const bloqueio = () => { Ficha.invalidar(e); return ModsPoe.valor(Ficha.combate(e), 'block'); };
  delete e.equipment.shield;
  const semEscudo = bloqueio();
  assert.ok(alocar(e, no.id).ok);
  assert.equal(bloqueio(), semEscudo, 'sem escudo o nó não dá bloqueio');
  e.equipment.shield = { id: 3357, count: 1, poe: { classe: 'Shields', base: 'Shields/X', af: {}, prefixos: [], sufixos: [], implicitos: [] } };
  const comEscudo = bloqueio();
  assert.ok(Comandos.comando(e, { action: 'respec', id: no.id }).ok);
  assert.equal(comEscudo - bloqueio(), valor, 'com escudo soma o valor do nó');
});
