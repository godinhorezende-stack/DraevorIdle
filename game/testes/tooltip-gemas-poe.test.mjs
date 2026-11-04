// O BALÃO DE TODAS AS GEMAS DO PoE (dono, 02/11: "atualize o tooltip de todas"): com todas as gemas feitas, o balão — no inventário, nos encaixes, na barra e
// na "Configurar ação" — mostra o estado de agora. Percorre TODAS as ativas e todos os suportes pela parte pura do balão (`frontend/client/src/balao-da-gema.mjs`)
// sobre a ficha do servidor (`GemasPoe.fichaNoNivel`, `SuportesPoe.fichaNoNivel`): nenhuma linha vazia, nenhum texto em inglês, nenhuma marca velha
// ("parcial", "não simulado", "sem efeito", "limitação"), nenhuma linha não feita mostrada como feita, os números que o jogo usa nas propriedades e o mesmo
// texto nos três lugares.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
// (o apoio dos testes liga o jogo do PoE — `iniciarJogoDoPoe`: as gemas registradas de verdade, como o catálogo da barra precisa)
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const { partesDoBalaoDaGema, textoDoBalaoDaGema } = await import('../frontend/client/src/balao-da-gema.mjs');
const { propDoBalao, notaCurta, ehLinhaInterna } = await import('../systems/itens-poe/balao-das-gemas.mjs');

// A ficha como o item a pede (`/api/jogo/poe/gema` — `backend/index.mjs`: a da ativa, senão a do suporte), passada por JSON como na rede.
const fichaDoItem = (slug, n, q) => JSON.parse(JSON.stringify(G.fichaNoNivel(slug, n, q) ?? SP.fichaNoNivel(slug, n, q)));
const NIVEIS = [1, 10, 20, 21];
const QUALIDADES = [0, 20];
// As palavras em INGLÊS que o poedb deixava passar (os rótulos de raio, os "metres per Second", os "Times", o stat interno "CooldownTime").
const INGLES = new Set(['the', 'of', 'and', 'with', 'per', 'second', 'seconds', 'times', 'radius', 'length', 'width', 'damage', 'increased', 'reduced', 'cooldowntime', 'cooldown',
  'supported', 'skill', 'skills', 'spell', 'spells', 'attack', 'attacks', 'metres', 'explosion', 'projectile', 'aoe', 'wide', 'long', 'small', 'big', 'charging', 'end', 'circle',
  'chilled', 'ground', 'sand', 'blood', 'utilização', 'seg', 'support', 'minion', 'minions', 'cast', 'strike', 'area', 'effect', 'duration', 'level', 'requires']);
const palavrasEmIngles = (t) => String(t).split(/[^\p{L}]+/u).filter((w) => INGLES.has(w.toLowerCase()) && !(w.toLowerCase() === 'seg'));
const MARCA_VELHA = /não simulad|funciona em parte|ainda não funciona|sem efeito|limitação|parcial/i;
const todas = () => [...[...G.REGISTRO.keys()].map((s) => ['ativa', s]), ...[...SP.REGISTRO.keys()].map((s) => ['suporte', s])];

test('todas as gemas, ativas e suportes, em 4 níveis e 2 qualidades: o balão sem linha vazia, sem inglês, sem faixa "(a — b)" e sem marca velha', { skip: SEM }, () => {
  const falhas = [];
  let vistas = 0;
  for (const [tipo, slug] of todas()) for (const n of NIVEIS) for (const q of QUALIDADES) {
    const f = fichaDoItem(slug, n, q);
    if (!f) { falhas.push(`${slug}: sem ficha`); continue; }
    vistas++;
    const linhas = textoDoBalaoDaGema({ poeFicha: f });
    for (const l of linhas) {
      if (!String(l).trim()) falhas.push(`${slug}@${n}/${q}: linha vazia`);
      const en = palavrasEmIngles(l);
      if (en.length) falhas.push(`${slug}@${n}/${q}: inglês (${en.join(', ')}) em "${l}"`);
      if (/\(-?\d[\d.]*\s*—\s*-?\d/.test(l)) falhas.push(`${slug}@${n}/${q}: faixa em "${l}"`);
      if (ehLinhaInterna(l)) falhas.push(`${slug}@${n}/${q}: stat interno "${l}"`);
    }
    for (const [r, v] of f.props) if (!String(r).trim() || (v != null && /undefined|NaN|null/.test(String(v)))) falhas.push(`${slug}@${n}/${q}: propriedade "${r}: ${v}"`);
    if (f.status === 'funciona') {
      const p = partesDoBalaoDaGema({ poeFicha: f });
      assert.equal(p.status, null, `${slug}: a gema que funciona não leva marca`);
      // (a parte do jogo no balão: as notas — a descrição do PoE pode dizer "sem efeito bônus")
      for (const l of p.notas) if (MARCA_VELHA.test(l)) falhas.push(`${slug}@${n}/${q}: marca velha em "${l}"`);
    }
    if (tipo === 'ativa' && !f.nivelMax) falhas.push(`${slug}: sem nivelMax`);
  }
  assert.equal(vistas, todas().length * NIVEIS.length * QUALIDADES.length);
  assert.deepEqual(falhas.slice(0, 20), [], `${falhas.length} falhas`);
});

test('nenhuma linha não feita mostrada como feita: a gema que funciona não risca nada em nível nenhum (os Vínculos, a Praga e a Convocar Runas também); toda linha riscada está no balão', { skip: SEM }, () => {
  const falhas = [];
  for (const [, slug] of todas()) for (const n of NIVEIS) for (const q of QUALIDADES) {
    const f = fichaDoItem(slug, n, q);
    const p = partesDoBalaoDaGema({ poeFicha: f });
    const riscadas = [...p.mods, ...(p.qualidade?.linhas ?? [])].filter((l) => l.fora).map((l) => l.texto);
    // (toda linha não feita da ficha aparece riscada no balão — nas do nível ou nas da qualidade)
    for (const l of f.naoFeitas) if (!riscadas.includes(l)) falhas.push(`${slug}@${n}/${q}: "${l}" não feita, mas não riscada`);
    if (f.status === 'funciona' && (riscadas.length || f.motivos.length)) falhas.push(`${slug}@${n}/${q}: funciona e risca ${riscadas.join(' | ')} ${f.motivos.join(' | ')}`);
  }
  assert.deepEqual(falhas.slice(0, 20), [], `${falhas.length} falhas`);
  // (antes a ficha usava só a regra das gemas de uso: o Vínculo Flamejante riscava "Alvo Vinculado ganha … de Dano de Fogo Adicional", que o jogo faz)
  for (const s of ['Flame_Link', 'Soul_Link', 'Plague_Bearer', 'Brand_Recall', 'Intuitive_Link']) assert.deepEqual(G.fichaNoNivel(s, 10, 20).naoFeitas, [], s);
});

test('a gema que não se aplica (o Portal, a Conjurar ao Perder Salvaguarda, se ainda estiverem) leva "Não se aplica ao jogo" e a nota curta, sem arquivo nem data', { skip: SEM }, () => {
  const nsa = todas().filter(([tipo, s]) => (tipo === 'ativa' ? G.doSlug(s) : SP.doSlug(s))?.naoSeAplica);
  for (const [, slug] of nsa) {
    const p = partesDoBalaoDaGema({ poeFicha: fichaDoItem(slug, 1, 0) });
    assert.deepEqual(p.status, { texto: 'Não se aplica ao jogo', classe: 'nao' }, slug);
    const nota = p.notas[0];
    assert.ok(nota && nota.length <= 160, `${slug}: "${nota}"`);
    assert.doesNotMatch(nota, /\.mjs|aval|dono|\d{1,2}\/\d{1,2}|^não se aplica/i, slug);
    assert.match(nota, /^[A-ZÀ-Ú].*\.$/, slug);
  }
  assert.equal(notaCurta('não se aplica: o jogo não tem Salvaguarda (Ward), então a salvaguarda nunca quebra e a magia nunca seria ativada (aval do dono 27/10)'),
    'O jogo não tem Salvaguarda (Ward), então a salvaguarda nunca quebra e a magia nunca seria ativada.');
});

test('as notas do registro vão discretas no balão: a escolha do dono no Arauto Agonizante e a linha que não se aplica da Lança de Gelo (em cinza, sem riscar)', { skip: SEM }, () => {
  const agonia = partesDoBalaoDaGema({ poeFicha: fichaDoItem('Herald_of_Agony', 20, 20) });
  assert.equal(agonia.status, null);
  assert.ok(agonia.notas.some((n) => /^A Virulência fica no máximo .* como o PoB mostra\.$/.test(n)), agonia.notas.join(' | '));
  const lanca = partesDoBalaoDaGema({ poeFicha: fichaDoItem('Ice_Spear', 20, 0) });
  const segunda = lanca.mods.find((l) => /^A Segunda forma possui .* mais Velocidade de Projétil$/.test(l.texto));
  // aval do dono 03/11: 100% — projétil, o voo de verdade: a 2ª forma da Lança de Gelo vale (antes "não se aplica", com a nota da trajetória)
  assert.deepEqual([segunda.fora, segunda.naoSeAplica], [false, false]);
  assert.ok(!lanca.notas.some((n) => /só muda a trajetória da segunda forma\.$/.test(n)), lanca.notas.join(' | '));
});

test('os números que o jogo usa nas propriedades: o custo, a eficácia do dano adicionado (a do PoB), o dano de ataque, a conjuração e a recarga com os usos', { skip: SEM }, () => {
  const falhas = [];
  const seg = (ms) => `${(ms / 1000).toFixed(2)} seg`;
  for (const slug of G.REGISTRO.keys()) for (const n of [1, 20]) for (const q of QUALIDADES) {
    const f = G.fichaNoNivel(slug, n, q);
    const prop = (r) => f.props.find(([x]) => x === r)?.[1];
    const t = G.temposNoNivel(slug, n, q);
    const custo = prop('Custo');
    if (custo && !/%/.test(custo) && !custo.startsWith(`${G.custoPorSegundoNoNivel(slug, n) || G.custoNoNivel(slug, n)} `)) falhas.push(`${slug}@${n}: Custo ${custo} ≠ ${G.custoNoNivel(slug, n)}`);
    const ef = prop('Eficácia do Dano Adicionado');
    if (ef && ef !== `${Math.round(G.eficaciaDoAdicionado(slug, n) * 100)}%`) falhas.push(`${slug}@${n}: Eficácia ${ef}`);
    const conj = prop('Tempo de Conjuração');
    if (conj && t.conjuracaoMs && conj !== seg(t.conjuracaoMs)) falhas.push(`${slug}@${n}/${q}: Conjuração ${conj} ≠ ${seg(t.conjuracaoMs)}`);
    const rec = prop('Recarga');
    if (rec && t.recargaMs && rec !== `${seg(t.recargaMs)}${t.cargas > 1 ? ` (${t.cargas} usos)` : ''}`) falhas.push(`${slug}@${n}/${q}: Recarga ${rec}`);
    for (const [r] of f.props) if (/Radius|Utilização|^Raio$/.test(r)) falhas.push(`${slug}: propriedade "${r}" no balão`);
  }
  assert.deepEqual(falhas.slice(0, 20), [], `${falhas.length} falhas`);
  // os exemplos: a Bola de Fogo (eficácia 300% → 480% do PoB, antes "100%"), a Fúria Sangrenta (custo em Vida), a Vaal (os usos em português)
  const p = (s, n, r) => G.fichaNoNivel(s, n, 0).props.find(([x]) => x === r)?.[1];
  assert.deepEqual([p('Fireball', 1, 'Eficácia do Dano Adicionado'), p('Fireball', 20, 'Eficácia do Dano Adicionado')], ['300%', '480%']);
  assert.equal(p('Blood_Rage', 20, 'Custo'), '29 Vida');
  assert.deepEqual(G.fichaNoNivel('Vaal_Fireball', 1, 0).props.filter(([r]) => /Almas|Armazenar/.test(r)), [['Almas por Uso', '30'], ['Pode Armazenar 1 Uso', ''], ['Impedimento de Ganho de Almas', '4 seg']]);
  assert.equal(p('Fireball', 1, 'Velocidade de Projétil'), '10.4 metros por segundo');
  assert.equal(SP.fichaNoNivel('Cast_on_Ward_Break_Support', 1, 0).mods.some((m) => /CooldownTime/.test(m)), false, 'o stat interno fora');
  assert.match(SP.fichaNoNivel('Added_Fire_Damage_Support', 20, 0).props[0][1], /^20 \(Máx\)$/);
});

test('o custo dos Vínculos é POR SEGUNDO (o PoB: ManaPerMinute 900 → 15/s): nada no uso; e as transfiguradas sem a coluna "Mana" cobram o do PoB', { skip: SEM }, () => {
  assert.deepEqual([G.custoNoNivel('Flame_Link', 1), G.custoPorSegundoNoNivel('Flame_Link', 1), G.custoPorSegundoNoNivel('Flame_Link', 20)], [0, 15, 32.7]);
  assert.equal(G.fichaNoNivel('Soul_Link', 1, 0).props.find(([r]) => r === 'Custo')[1], '15 Mana por segundo');
  assert.equal(G.custoPorSegundoNoNivel('Fireball', 20), 0);
  assert.deepEqual([G.custoNoNivel('Raise_Zombie_of_Slamming', 1), G.custoNoNivel('Raise_Zombie_of_Slamming', 20)], [9, 28]);
  assert.deepEqual([G.custoNoNivel('Icicle_Mine_of_Sabotage', 1), G.custoNoNivel('Kinetic_Blast_of_Clustering', 20)], [3, 9]);
  assert.deepEqual([G.custoNoNivel('Pyroclast_Mine_of_Sabotage', 1), G.custoNoNivel('Pyroclast_Mine_of_Sabotage', 20)], [4, 6]);
});

test('o mesmo texto nos três lugares: a ficha da barra (o catálogo) e a do item (inventário e encaixe, pela rota) dão o mesmo balão', { skip: SEM }, async () => {
  const GS = await import('../systems/skills/gemas.mjs');
  const J = await import('../systems/itens-poe/jogo.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const slugs = ['Fireball', 'Hatred', 'Flame_Link'];
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  e.sistema = 'poe';
  e.classePoe = 'Witch';
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 20, rng: () => 0.99 }));
  arma.soquetes = { abertos: slugs.length, links: slugs.slice(1).map(() => false), gemas: slugs.map(() => null), cores: slugs.map(() => 'W') };
  e.equipment = { ...(e.equipment ?? {}), weapon: arma };
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel: 7, xp: 0, raridade: 'comum' }));
  slugs.forEach((_, i) => GS.encaixar(e, { de: 0, slot: 'weapon', indice: i }));
  Ficha.invalidar(e);
  const cat = Acoes.catalogo(e);
  for (const s of slugs) {
    const naBarra = cat.spells.find((a) => a.id === G.doSlug(s).acao);
    assert.ok(naBarra?.poeFicha, `${s}: ${cat.spells.filter((a) => a.poeFicha).map((a) => a.id).join(', ')}`);
    const nivel = naBarra.gema?.nivel ?? 7;
    const q = naBarra.gema?.efeito?.qualidade ?? 0;
    assert.deepEqual(textoDoBalaoDaGema({ poeFicha: JSON.parse(JSON.stringify(naBarra.poeFicha)) }), textoDoBalaoDaGema({ poeFicha: fichaDoItem(s, nivel, q) }), s);
  }
});

test('a parte pura: a linha da qualidade não feita sai riscada; a que funciona não leva marca; propriedades e notas', () => {
  const f = { tags: ['Magia'], props: [['Nível', '1']], nivelReq: 1, desc: '', mods: ['a'], modsDaQualidade: ['q1', 'q2'], qualidade: 20, naoFeitas: ['q2'], status: 'parcial', motivos: [], tempos: { conjuracaoMs: 500 } };
  const p = partesDoBalaoDaGema({ poeFicha: f });
  assert.deepEqual(p.qualidade.linhas.map((l) => l.fora), [false, true]);
  assert.equal(p.status.classe, 'parcial');
  assert.ok(p.notas.includes('Riscado: o efeito ainda não age no jogo.'));
  assert.equal(partesDoBalaoDaGema({ poeFicha: { ...f, naoFeitas: [], status: 'funciona' } }).status, null);
  assert.equal(partesDoBalaoDaGema(null), null);
  assert.equal(propDoBalao(['AoE Radius', '9']), null);
  assert.deepEqual(propDoBalao(['Pode Armazenar 3 Utilização', '']), ['Pode Armazenar 3 Usos', '']);
  assert.deepEqual(propDoBalao(['Recarga', '0.80 Seg (6 Times)']), ['Recarga', '0.80 seg (6 usos)']);
});
