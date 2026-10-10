// Os MAPAS ÚNICOS do endgame (dono, 10/10: "monte os únicos em português" → "até T16: a área não vai ser só de nível 68" → "2% dos mapas
// que caem" → "desenho do PoE com o número romano em cima" → "aqui são 26 únicos"): os 26 do poedb em todos os tiers (a área do tier em que caiu), as linhas com
// efeito e as sem (com a nota), o drop (a chance própria, no tier do drop, com a Raridade de Itens; a projeção offline também), os efeitos
// na instância, em você e no chefe (mapas e moedas a mais), os ícones (um id por tier) e o importador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Dispositivo = await import('../systems/mapas-dispositivo.mjs');
const Mapas = await import('../systems/itens-poe/mapas.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const MoedasPoe = await import('../systems/itens-poe/moedas.mjs');
const Afeccoes = await import('../systems/itens-poe/afeccoes.mjs');
const Poderes = await import('../systems/poderes.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { BESTIARY } = await import('../systems/hunt/monstros.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
const { decodificarPng } = await import('../engine/png-minimo.mjs');
const Importador = await import('../tools/importar-mapas-unicos.mjs');

const PASTA_DOS_ICONES = new URL('../gamedata/itens-poe/icones-itens/', import.meta.url);
/** Os 26 da aba "Mapas Únicos" do poedb, na ordem dela, com o nome em português. */
const NOMES = {
  Actons_Nightmare: 'Pesadelo de Acton',
  The_Cowards_Trial: 'Julgamento do Covarde',
  'Maelström_of_Chaos': 'Vórtice do Caos',
  Mao_Kun: 'Mao Kun',
  Olmecs_Sanctum: 'Santuário Olmeca',
  Poorjoys_Asylum: 'Hospício de Poorjoy',
  Vaults_of_Atziri: 'Relíquias de Atziri',
  Death_and_Taxes: 'Morte e Impostos',
  Obas_Cursed_Trove: 'Tesouro Maldito de Oba',
  Whakawairua_Tuahu: 'Whakawairua Tuahu',
  Hall_of_Grandmasters: 'Salão dos Grão-Mestres',
  The_Vinktar_Square: 'A Praça Vinktar',
  'Caer_Blaidd,_Wolfpacks_Den': 'Caer Blaidd, Toca dos Lobos',
  The_Putrid_Cloister: 'O Claustro Pútrido',
  Hallowed_Ground: 'Terras Sagradas',
  Pillars_of_Arun: 'Pilares de Arun',
  The_Twilight_Temple: 'Templo do Crepúsculo',
  Doryanis_Machinarium: 'Maquinário de Doryani',
  Cortex: 'Cortex',
  Altered_Distant_Memory: 'Memória Distante Alterada',
  Augmented_Distant_Memory: 'Memória Distante Aumentada',
  Twisted_Distant_Memory: 'Memória Distante Distorcida',
  Rewritten_Distant_Memory: 'Memória Distante Reescrita',
  Replica_Cortex: 'Réplica: Córtex',
  Replica_Pillars_of_Arun: 'Réplica: Pilares de Arun',
  Replica_Poorjoys_Asylum: 'Réplica: Hospício de Poorjoy',
};

/** Os 7 primeiros (os da primeira leva — o que cada um ainda não tem fica conferido linha a linha). */
const SETE = ['Olmecs_Sanctum', 'The_Vinktar_Square', 'Caer_Blaidd,_Wolfpacks_Den', 'Death_and_Taxes', 'Hallowed_Ground', 'The_Putrid_Cloister', 'Mao_Kun'];

/** Um rng que devolve a sequência dada (e repete o último). */
const sequencia = (...v) => {
  let i = 0;
  return () => v[Math.min(i++, v.length - 1)];
};
/** O único `slug` no tier, como o drop o gera. */
const unicoNoTier = (slug, tier, rng = Math.random) => Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: Mapas.baseDoTier(tier), raridade: 'unico', ilvl: Mapas.nivelDoTier(tier), rng, unico: slug }));
/** O valor sorteado na linha do único (pelo começo do modelo). */
const valorDa = (peca, re, k = 0) => peca.poe.modificadores.find((m) => re.test(m.modelo)).valores[k];

/** Um personagem com a campanha vencida (o dispositivo liberado), vida que não acaba e o Machado Vaal (como em mapas-endgame). */
function personagem() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.equipment = { ...(e.equipment ?? {}), weapon: Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 64, rng: () => 0.5 })) };
  e.hp = e.maxHp = 1e9;
  for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = Array.from({ length: 10 }, (_, i) => i + 1);
  Bolsa.garantir(e);
  return e;
}
/** Põe a peça na mochila e abre pelo dispositivo, como a tela faz. */
function abrir(e, peca) {
  e.inventory.push(peca);
  const m = Dispositivo.mapasCarregados(e).find((x) => x.peca === peca);
  return Dispositivo.abrir(e, { onde: m.onde, indice: m.indice, assinatura: m.assinatura, mode: 'auto' });
}
const todos = (e) => [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares ?? {}).flat()];
const comuns = (e) => todos(e).filter((m) => !m.chefeDoMapa && (m.raridade ?? 'normal') === 'normal' && !m.mods?.length);
function andar(e, n, relogio) {
  for (let i = 0; i < n && e.hunt; i++) Cacadas.tique(e, PERSONAGEM, (relogio.agora += 250));
}

test('os 26 mapas únicos, em português, em TODOS os tiers: a peça sai no tier do drop, com a área dele (68–83), os efeitos e as notas', { skip: SEM }, () => {
  assert.deepEqual(Mapas.unicos().map((u) => [u.slug, u.nome]), Object.entries(NOMES));
  const classe = Catalogo.catalogo().classes[Mapas.CLASSE];
  for (let t = 1; t <= 16; t++) {
    const base = Mapas.bases().find((b) => b.atributos.tier === t);
    assert.deepEqual(classe.unicos.filter((u) => u.base === base.nome).map((u) => u.slug), Object.keys(NOMES), `T${t}: os 26 na base do tier`);
    for (const u of Mapas.unicos()) {
      const p = unicoNoTier(u.slug, t);
      assert.equal(p.poe.raridade, 'unico');
      assert.equal(p.poe.nome, NOMES[u.slug]);
      assert.equal(p.poe.unico, u.slug);
      assert.equal(Mapas.tierDaPeca(p), t, `${u.slug} T${t}`);
      assert.equal(p.poe.mapa.tier, t);
      assert.equal(p.poe.mapa.nivel, 67 + t, 'a área do tier em que caiu');
      // Cada linha: com efeito (age), ou sem efeito com o motivo (o balão mostra).
      const linhas = p.poe.mapa.linhas;
      assert.equal(linhas.length, u.modificadores.length);
      u.modificadores.forEach((m, i) => {
        assert.equal(linhas[i].estado, m.efeitos.length ? 'equivalente' : 'inerte', m.texto);
        if (!m.efeitos.length) assert.equal(linhas[i].nota, m.nota, m.texto);
      });
      const notas = p.poe.notas.slice(-u.modificadores.length);
      assert.deepEqual(notas, u.modificadores.map((m) => (m.efeitos.length ? null : m.nota)));
    }
  }
  // As linhas sem mecânica no jogo (e só elas) ficam sem efeito — cada uma com o SEU motivo (nenhuma com o genérico).
  for (const u of Mapas.unicos()) for (const m of u.modificadores) if (!m.efeitos.length) assert.notEqual(m.nota, 'ainda não tem a mecânica no jogo', `${u.slug}: ${m.texto}`);
  const semEfeito = Object.fromEntries(Mapas.unicos().filter((u) => SETE.includes(u.slug)).map((u) => [u.slug, u.modificadores.filter((m) => !m.efeitos.length).map((m) => m.texto)]));
  assert.deepEqual(semEfeito, {
    Olmecs_Sanctum: ['Chefe Final derruba Itens de Níveis maiores'],
    The_Vinktar_Square: [],
    'Caer_Blaidd,_Wolfpacks_Den': [],
    Death_and_Taxes: [],
    Hallowed_Ground: ['(-2—2) ao Nível dos Monstros da Área'],
    The_Putrid_Cloister: ['Chefe Único derruba cartas de adivinhação'],
    Mao_Kun: ['% do Dano dos Monstros é convertido em Raio', 'Monstros ganham uma Carga de Tolerância ao Acertar', 'Monstros ganham uma Carga de Poder ao Acertar'],
  });
  // Os que o PoE define por mecânicas que o jogo ainda não tem ficam sem nenhuma linha com efeito (a aba Mapas da engine mostra).
  assert.deepEqual(Mapas.unicos().filter((u) => !u.modificadores.some((m) => m.efeitos.length)).map((u) => u.slug), ['The_Cowards_Trial', 'Vaults_of_Atziri', 'Hall_of_Grandmasters']);
  // As linhas cruas do poedb (Quantidade/Raridade/Grupo, "map item drop quantity +% [100]") viram a linha em português e agem.
  const cortex = unicoNoTier('Cortex', 12);
  assert.deepEqual([cortex.poe.mapa.quantidade, cortex.poe.mapa.grupo], [100, 25]);
  // A velocidade e o crítico dos monstros: as mesmas mecânicas dos mapas comuns.
  const replica = unicoNoTier('Replica_Poorjoys_Asylum', 4);
  const ef = replica.poe.mapa.efeitos.monstros;
  assert.deepEqual([ef.velocidadePct, ef.velocidadeDeAtaquePct, ef.velocidadeDeConjuracaoPct], [25, 25, 25]);
  // (A soma do mapa fica em 2 casas — `Mapas.somar`: 838 × 0,05 = 41,9, não 41,900000000000006.)
  assert.equal(ef.critChance, Math.round(valorDa(replica, /Chance de Crítico/) * 0.05 * 100) / 100);
  assert.equal(ef.critMultiplicador, valorDa(replica, /Multiplicador de Crítico/));
});

test('os valores saem na faixa do poedb (as decimais também) e a Quantidade/Raridade/Grupo do único somam no resumo do mapa', { skip: SEM }, () => {
  for (let i = 0; i < 30; i++) {
    const olmec = unicoNoTier('Olmecs_Sanctum', 5);
    const q = valorDa(olmec, /^Quantidade de Itens/);
    assert.ok(q >= 120 && q <= 200, `quantidade ${q}`);
    assert.equal(olmec.poe.mapa.quantidade, q);
    const vida = valorDa(olmec, /mais Vida de Monstros/);
    assert.ok(vida >= 40 && vida <= 50);
    assert.equal(olmec.poe.mapa.efeitos.monstros.vidaPct, vida);
    const dt = unicoNoTier('Death_and_Taxes', 10);
    const moedas = valorDa(dt, /Itens Monetários adicionais/);
    assert.ok(moedas >= 12 && moedas <= 20);
    assert.equal(dt.poe.mapa.efeitos.chefe.moedasExtras, moedas);
  }
  const terras = unicoNoTier('Hallowed_Ground', 3);
  assert.deepEqual(terras.poe.mapa.efeitos.jogador, { 'frasco_regen_n:todos': 0.5, 'frasco_regen_s:todos': 3 }, '0,5 carga a cada 3 s');
  assert.equal(terras.poe.mapa.efeitos.chefe.mapasExtras, 3);
  assert.deepEqual([terras.poe.mapa.quantidade, terras.poe.mapa.raridade], [100, 100]);
  const vinktar = unicoNoTier('The_Vinktar_Square', 16);
  const grupo = valorDa(vinktar, /^Tamanho do Grupo/);
  assert.equal(vinktar.poe.mapa.grupo, grupo);
  assert.equal(Mapas.fatoresDaInstancia(vinktar.poe.mapa).fatorDoGrupo, 1 + grupo / 100);
  assert.deepEqual(unicoNoTier('The_Putrid_Cloister', 8).poe.mapa.efeitos.maldicoes, ['vulnerabilidade', 'flamabilidade', 'congelabilidade', 'condutividade', 'desespero']);
});

test('o drop: 2% dos mapas que caem são únicos (mapas.json → drop.chanceDoUnico), no tier do drop, com a Raridade de Itens', { skip: SEM }, () => {
  const c = Mapas.DROP.chanceDoUnico;
  assert.equal(c, 0.02, 'a decisão do dono');
  for (const t of [1, 9, 16]) {
    // O 1º sorteio é o da raridade comum (0,5 → Normal); o 2º, o do único.
    const u = Jogo.mapaSorteado(t, { rng: sequencia(0.5, c * 0.99) });
    assert.equal(u.poe.raridade, 'unico', `T${t}`);
    assert.equal(Mapas.tierDaPeca(u), t, 'no tier do drop');
    assert.ok(Mapas.unicoDoMapa(u.poe.unico));
    assert.equal(Jogo.mapaSorteado(t, { rng: sequencia(0.5, c * 1.01) }).poe.raridade, 'normal');
  }
  // +100% de Raridade de Itens (a do mapa em que caiu) dobra a chance.
  assert.equal(Jogo.mapaSorteado(5, { rng: sequencia(0.5, c * 1.99), raridadeAumentada: 100 }).poe.raridade, 'unico');
  assert.notEqual(Jogo.mapaSorteado(5, { rng: sequencia(0.5, c * 2.01), raridadeAumentada: 100 }).poe.raridade, 'unico');
  // O Único sai da chance própria, não do sorteio comum: o fim do sorteio comum (onde estaria o Único do loot) dá Raro.
  assert.equal(Jogo.mapaSorteado(5, { rng: sequencia(0.999999, 0.99) }).poe.raridade, 'raro');
  // A raridade fixa (o T1 do Kitava) não sorteia único.
  assert.equal(Jogo.mapaSorteado(1, { raridade: 'magico', rng: () => 0 }).poe.raridade, 'magico');
  // A projeção offline repõe o mapa pela base (`baseFixa`): a mesma chance; e a regra não vaza para as outras bases.
  const offline = Jogo.pecaSorteada(Mapas.nivelDoTier(4), sequencia(0.5, 0.001), undefined, 0, Mapas.baseDoTier(4));
  assert.equal(offline.poe.raridade, 'unico');
  assert.equal(Mapas.tierDaPeca(offline), 4);
  assert.equal(Jogo.pecaSorteada(70, sequencia(0.5, 0.001), undefined, 0, 'Two_Hand_Axes/Vaal_Axe').poe.raridade, 'normal');
  // Na prática: ~2% de 20.000 mapas T6, e os 7 únicos aparecem.
  const vistos = new Set();
  let unicos = 0;
  for (let i = 0; i < 20_000; i++) {
    const p = Jogo.mapaSorteado(6);
    if (p.poe.raridade !== 'unico') continue;
    unicos++;
    vistos.add(p.poe.unico);
    assert.equal(Mapas.tierDaPeca(p), 6);
  }
  assert.ok(unicos >= 320 && unicos <= 480, `${unicos} únicos em 20.000 (esperado ~400)`);
  assert.equal(vistos.size, Mapas.unicos().length);
});

test('o ícone: cada único tem um id por tier (7.701.001…) com o desenho do PoE e o número romano; a peça usa o do tier dela', { skip: SEM }, () => {
  const ids = new Set();
  for (const u of Mapas.unicos()) {
    assert.ok(u.itemIdBase >= Importador.PRIMEIRO_ID && u.itemIdBase % Importador.PASSO_DO_ID === 0, u.slug);
    assert.ok(existsSync(new URL(u.icone, PASTA_DOS_ICONES)), `${u.icone}: o desenho sem número`);
    for (let t = 1; t <= 16; t++) {
      const id = Mapas.idDoUnico(u.slug, t);
      assert.equal(id, u.itemIdBase + t);
      assert.ok(!ids.has(id), `id repetido: ${id}`);
      ids.add(id);
      const meta = ITEM_CATALOG[id];
      assert.equal(meta?.name, u.nome);
      assert.equal(meta.mapa, true);
      assert.equal(meta.poe.classe, Mapas.CLASSE);
      assert.equal(meta.poe.base, Mapas.baseDoTier(t));
      assert.equal(meta.poe.icone, Mapas.iconeDoUnico(u, t));
      assert.equal(meta.poe.icone, `poe-itens/Mapas/unicos/${Importador.arquivoDoIconeNoTier(u.slug, t)}`, 'o nome que o importador grava');
      const png = decodificarPng(readFileSync(new URL(meta.poe.icone, PASTA_DOS_ICONES)));
      assert.deepEqual([png.w, png.h, meta.poe.iconeLado], [80, 80, 80], meta.poe.icone);
    }
    const p = unicoNoTier(u.slug, 11);
    assert.equal(p.id, u.itemIdBase + 11, 'a peça leva o id do tier dela');
    assert.ok(Mapas.ehMapa(p));
  }
  assert.equal(ids.size, 26 * 16);
  // Nenhum id de único cai em cima de outro item do catálogo (os mapas comuns são 7.700.001–7.700.016).
  for (const id of ids) assert.ok(id > Mapas.idDoTier(16));
  assert.equal(Mapas.idDoUnico('Olmecs_Sanctum', 17), null);
  assert.equal(Mapas.idDoUnico('Nao_Existe', 3), null);
});

test('o único abre pelo dispositivo e age: monstros (vida, imunes a Eletrização, resistência e dano de Raio), grupo e quantidade', { skip: SEM }, () => {
  const e = personagem();
  const peca = unicoNoTier('The_Vinktar_Square', 11);
  assert.ok(abrir(e, peca).ok);
  assert.equal(e.mapas.aberto?.tier ?? Mapas.tierDaPeca(peca), 11);
  const lista = comuns(e);
  assert.ok(lista.length > 0);
  for (const m of lista) {
    assert.equal(m.maxHp, Math.round(BESTIARY[m.key].hp * 1.2), `${m.key}: 20% mais vida`);
    assert.equal(m.imuneChoque, true);
    assert.equal(m.resist.energy, 35);
    assert.deepEqual(m.danoExtraPct, { energy: 35 });
  }
  // "Monstros não são Afetados por Eletrizações": o crítico de Raio não eletriza (o mesmo golpe eletriza um monstro comum).
  const golpe = () => ({ afeccoes: Afeccoes.daSoma({}), crit: true, rng: () => 0, agora: 0 });
  const imune = lista[0];
  assert.ok(!Afeccoes.aoAcertar(imune, [{ elemento: 'energy', dano: 5000 }], golpe()).includes('eletrizado'));
  assert.equal(imune.estados?.chocado, undefined);
  const outro = { uid: 99, hp: 10_000, maxHp: 10_000, x: 0, y: 0 };
  assert.ok(Afeccoes.aoAcertar(outro, [{ elemento: 'energy', dano: 5000 }], golpe()).includes('eletrizado'));
});

test('o único em você: as cinco maldições do Claustro e as cargas de frasco das Terras Sagradas (só enquanto está no mapa)', { skip: SEM }, () => {
  const e = personagem();
  const sem = Afixos.soma(e);
  assert.ok(abrir(e, unicoNoTier('The_Putrid_Cloister', 6)).ok);
  const com = Afixos.soma(e);
  const dif = (k) => (com[k] ?? 0) - (sem[k] ?? 0);
  assert.deepEqual([dif('fire_res'), dif('ice_res'), dif('energy_res'), dif('chaos_res'), dif('dano_physical_recebido_inc')], [-17, -17, -17, -15, 20]);
  Cacadas.sair(e);
  assert.deepEqual(Afixos.soma(e), sem, 'fora do mapa, nada');

  const f = personagem();
  assert.ok(abrir(f, unicoNoTier('Hallowed_Ground', 2)).ok);
  const naTerra = Afixos.soma(f);
  assert.equal(naTerra['frasco_regen_n:todos'], 0.5);
  assert.equal(naTerra['frasco_regen_s:todos'], 3);
});

test('o chefe do único: experiência, dano e velocidade de conjuração a mais (as magias saem mais vezes)', { skip: SEM }, () => {
  const normal = personagem();
  assert.ok(abrir(normal, Jogo.mapaSorteado(10, { raridade: 'normal' })).ok);
  const chefeNormal = todos(normal).find((m) => m.chefeDoMapa);
  const e = personagem();
  const peca = unicoNoTier('Death_and_Taxes', 10);
  assert.ok(abrir(e, peca).ok);
  const chefe = todos(e).find((m) => m.chefeDoMapa);
  assert.equal(chefe.key, chefeNormal.key, 'o mesmo chefe do tier');
  assert.equal(chefe.exp, Math.round(chefeNormal.exp * 201), '20000% de experiência a mais');
  const vel = valorDa(peca, /Velocidade de Conjuração/);
  assert.ok(Math.abs(chefe.velocidadeDeConjuracao - (1 + vel / 100)) < 1e-9);
  // A magia: o próximo lançamento vem antes (o intervalo ÷ a velocidade). Longe do alvo: a recarga corre, a magia não sai.
  const p = Poderes.poderesDe(chefe.key);
  const i = p.ataques.findIndex((a) => a.tipo === 'magia');
  assert.ok(i >= 0, 'o chefe do T10 tem magia');
  chefe.proximoPoder = { [i]: 0 };
  Poderes.lancar(e, { pos: { x: chefe.x + 500, y: chefe.y + 500 } }, PERSONAGEM, chefe, [], 10_000, {});
  assert.ok(Math.abs(chefe.proximoPoder[i] - (10_000 + p.ataques[i].intervalo / (1 + vel / 100))) < 1e-6);
  // A experiência dos monstros (Mao Kun: "Ganho de Experiência aumentado").
  const g = personagem();
  const mao = unicoNoTier('Mao_Kun', 10);
  assert.ok(abrir(g, mao).ok);
  const xp = valorDa(mao, /^Ganho de Experiência/);
  for (const m of comuns(g)) assert.equal(m.exp, Math.round(BESTIARY[m.key].exp * (1 + xp / 100)), m.key);
});

test('o chefe do único derruba os mapas e as moedas a mais', { skip: SEM }, () => {
  // Os mapas: os garantidos do chefe + os do único (sem o "mais um", que é sorte).
  assert.equal(Mapas.sortearDrops({ tierDaArea: 5, chefeDoMapa: true, mapasExtras: 4, rng: () => 0.99 }).length, Mapas.DROP.chefe.garantidos + 4);
  assert.equal(Mapas.sortearDrops({ tierDaArea: 5, chefeDoMapa: false, mapasExtras: 4, rng: () => 0.99 }).length, 0, 'só o chefe');
  // As moedas avulsas: pelos pesos do drop.
  const moedas = MoedasPoe.moedasAvulsas(15);
  assert.equal(moedas.length, 15);
  assert.ok(moedas.every((m) => MoedasPoe.ehMoeda(m.id) && m.count === 1));
  assert.deepEqual(MoedasPoe.moedasAvulsas(0), []);
  // Na caçada: matar só o chefe do Caer Blaidd (4 mapas a mais) e do Morte e Impostos (12–20 moedas a mais).
  const relogio = { agora: Date.now() };
  const e = personagem();
  assert.ok(abrir(e, unicoNoTier('Caer_Blaidd,_Wolfpacks_Den', 7)).ok);
  todos(e).find((m) => m.chefeDoMapa).hp = 0;
  andar(e, 2, relogio);
  const mapas = e.pouch.filter((p) => Mapas.ehMapa(p));
  assert.ok(mapas.length >= Mapas.DROP.chefe.garantidos + 4, `${mapas.length} mapas`);
  for (const p of mapas) assert.ok([7, 8].includes(Mapas.tierDaPeca(p)));
  const f = personagem();
  const dt = unicoNoTier('Death_and_Taxes', 7);
  assert.ok(abrir(f, dt).ok);
  todos(f).find((m) => m.chefeDoMapa).hp = 0;
  andar(f, 2, relogio);
  const contadas = f.pouch.filter((p) => MoedasPoe.ehMoeda(p.id)).reduce((n, p) => n + (p.count ?? 1), 0);
  assert.ok(contadas >= valorDa(dt, /Itens Monetários adicionais/), `${contadas} moedas`);
});

test('os mods de dano extra dos mapas: cada elemento é o seu (o Gelo e o Raio dos tiers baixos davam Fogo)', { skip: SEM }, () => {
  const STAT = { Fogo: 'danoExtraPct.fire', Gelo: 'danoExtraPct.ice', Raio: 'danoExtraPct.energy' };
  let vistos = 0;
  for (const pagina of Object.values(Mapas.DADOS.classe.paginas)) {
    for (const g of [...pagina.prefixos, ...pagina.sufixos]) {
      const el = g.tiers[0].texto.match(/como Dano de (Fogo|Gelo|Raio) extra$/)?.[1];
      if (!el) continue;
      vistos++;
      assert.deepEqual(g.efeitos.map((x) => x.stat), [STAT[el]], g.tiers[0].texto);
    }
  }
  assert.equal(vistos, 9, 'três elementos em cada faixa (baixo, médio, alto)');
});

test('o importador: o modelo e as faixas do texto, as linhas internas e os lembretes de fora, os ids preservados e o número por cima', () => {
  assert.deepEqual(Importador.modeloDe('(40—50)% mais Vida de Monstros'), { modelo: '{0}% mais Vida de Monstros', faixas: [[40, 50]] });
  assert.deepEqual(Importador.modeloDe('0.5 Cargas de Frasco recuperadas a cada 3 segundos'), { modelo: '{0} Cargas de Frasco recuperadas a cada {1} segundos', faixas: [[0.5, 0.5], [3, 3]] });
  assert.deepEqual(Importador.modeloDe('(-2—2) ao Nível dos Monstros da Área'), { modelo: '{0} ao Nível dos Monstros da Área', faixas: [[-2, 2]] });
  assert.equal(Importador.modificadorDe('map no exiles [1]'), null, 'linha interna do poedb');
  assert.equal(Importador.modificadorDe('(Desespero é uma Maldição que inflige -15% de Resistência a Caos)'), null, 'lembrete');
  assert.deepEqual(Importador.modificadorDe('(40—50)% mais Vida de Monstros').efeitos, [{ alvo: 'monstros', stat: 'vidaPct', de: 0, mais: true }], 'começa com a faixa, mas é modificador');
  assert.deepEqual(Importador.modificadorDe('Jogadores são Amaldiçoados com Condutividade').efeitos, [{ alvo: 'jogador', stat: 'maldicao', fixo: 'condutividade' }]);
  assert.equal(Importador.modificadorDe('map item drop quantity +% [100,150]').texto, 'Quantidade de Itens encontrados nesta Área aumentada em (100—150)%', 'a linha crua vira português');
  assert.equal(Importador.modificadorDe('map pack size +% [25]').texto, 'Tamanho do Grupo aumentado em 25%');
  assert.equal(Importador.modificadorDe('map item drop rarity +% [0]'), null, 'valor 0: fora');
  const semMecanica = Importador.modificadorDe('Jogadores são Amaldiçoados com Grilhões Temporais');
  assert.deepEqual([semMecanica.efeitos, semMecanica.nota], [[], 'ainda não tem a mecânica no jogo']);
  // Os ids: o que já tinha fica; o novo pega o próximo bloco livre.
  assert.deepEqual(Importador.idsDosUnicos(['A', 'B', 'C'], { B: 7_701_000 }), { A: 7_702_000, B: 7_701_000, C: 7_703_000 });
  assert.equal(Importador.arquivoDoIcone('Caer_Blaidd,_Wolfpacks_Den'), 'Caer_Blaidd_Wolfpacks_Den.png');
  assert.equal(Importador.arquivoDoIconeNoTier('Hallowed_Ground', 5), 'Hallowed_Ground_T5.png');
  // O número por cima: onde ele é opaco, vale ele; onde é transparente, fica o desenho; meio transparente, mistura.
  const px = (...v) => new Uint8ClampedArray(v);
  const r = Importador.sobrepor({ w: 3, h: 1, data: px(10, 20, 30, 255, 10, 20, 30, 255, 0, 0, 0, 0) }, { w: 3, h: 1, data: px(200, 200, 200, 255, 0, 0, 0, 0, 100, 100, 100, 255) });
  assert.deepEqual(Array.from(r.data), [200, 200, 200, 255, 10, 20, 30, 255, 100, 100, 100, 255]);
  const meio = Importador.sobrepor({ w: 1, h: 1, data: px(0, 0, 0, 255) }, { w: 1, h: 1, data: px(255, 255, 255, 128) });
  assert.ok(Math.abs(meio.data[0] - 128) <= 1 && meio.data[3] === 255);
  assert.throws(() => Importador.sobrepor({ w: 1, h: 1, data: px(0, 0, 0, 0) }, { w: 2, h: 1, data: px(0, 0, 0, 0, 0, 0, 0, 0) }), /tamanhos diferentes/);
  // A fonte (a aba "Mapas Únicos" do Scrapling): o nome, a base, o nível, as linhas, o id e o ícone.
  const fonte = { abas: [{ id: 'MapasÚnicos', cards: [{ bases: [{ nome: 'Terras Sagradas\nMapa (Nível 1)', href: '/pt/Hallowed_Ground', props: [{ classe: 'requirements', texto: 'Requer Nível 58' }, { classe: 'explicitMod', texto: 'Chefes Únicos derrubam 3 Mapas adicionais' }, { classe: 'explicitMod', texto: 'map no exiles [1]' }] }] }] }] };
  const [u] = Importador.unicosDe(fonte, ['Hallowed_Ground']);
  assert.deepEqual([u.nome, u.base, u.requisitos.nivel, u.itemIdBase, u.icone, u.arte], ['Terras Sagradas', 'Mapa (Nível 1)', 58, Importador.PRIMEIRO_ID, 'poe-itens/Mapas/unicos/Hallowed_Ground.png', 'Art/2DItems/Maps/HallowedGround']);
  assert.deepEqual(u.modificadores.map((m) => m.efeitos), [[{ alvo: 'chefe', stat: 'mapasExtras', de: 0 }]]);
  assert.throws(() => Importador.unicosDe(fonte, ['Mao_Kun']), /não está na aba/);
});
