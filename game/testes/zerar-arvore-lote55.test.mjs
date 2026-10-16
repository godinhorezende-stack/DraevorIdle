// LOTE 55 — as LINHAS SORTEADAS das únicas de joia (J31): o pool de cada uma, do poedb (`gamedata/itens-poe/linhas-sorteadas.json`), troca a
// linha de marcação na peça — o Olho do Vigia (2 ou 3 das 87 "enquanto afetado por <Aura>"), a Personalidade Dividida (2 das 9, e o "efeito
// aumentado por Passiva Alocada entre o encaixe e o início da classe", como o PoB) e o Equilíbrio do Terror (2 das 18 "se você conjurou
// <Maldição> nos últimos 10 segundos"); as condições novas, as imunidades a cada maldição dos monstros, a Exposição, o Evadir fixo.
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
const P = await import('../systems/passivas/arvore.mjs');
const Comandos = await import('../systems/passivas/comandos.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const MonstrosNoJogador = await import('../systems/itens-poe/monstros-no-jogador.mjs');
const Defesa = await import('../systems/personagem/defesa.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { gerarPeca, modificadoresDoUnico } = await import('../systems/itens-poe/gerar.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });
const anel = (af) => ({ id: Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id), count: 1, af: [], poe: { af } });
const unicas = (slug) => Catalogo.catalogo().classes.Jewels.unicos.filter((u) => u.slug === slug);
/** Uma semente repetível (mulberry32). */
const semente = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gerar = (slug, i = 0, rng = semente(7)) => {
  const u = unicas(slug)[i];
  const base = Catalogo.catalogo().classes.Jewels.bases.find((b) => b.nome === u.base);
  return gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 80, rng, unico: slug });
};

test('os POOLS do poedb no catálogo: o Olho do Vigia (87), a Personalidade Dividida (9), o Equilíbrio do Terror (18) — todas as linhas traduzem (as inertes, com o porquê)', { skip: SEM }, () => {
  for (const [slug, n] of [['Watchers_Eye', 87], ['Split_Personality', 9], ['The_Balance_of_Terror', 18]]) {
    const u = unicas(slug)[0];
    assert.equal(u.linhasSorteadas?.linhas.length, n, slug);
    for (const l of u.linhasSorteadas.linhas) {
      const t = tr(l.modelo, l.faixas.map((f) => f[0]));
      assert.ok(t.estado !== 'registrado', `${slug}: ${l.modelo}`);
      if (t.estado === 'inerte') assert.ok(t.partes.find((p) => p.nota)?.nota, l.modelo);
    }
  }
});

test('a PEÇA: a marcação vira as linhas sorteadas, distintas — o Olho do Vigia com 2 e com 3; o Orbe Divino mantém as linhas', { skip: SEM }, () => {
  for (const [i, n] of [[0, 2], [1, 3]]) {
    const u = unicas('Watchers_Eye')[i];
    const marca = u.modificadores.find((m) => u.linhasSorteadas.substitui[m.modelo]).modelo;
    for (let s = 1; s <= 20; s++) {
      const mods = modificadoresDoUnico(u, semente(s));
      assert.ok(!mods.some((m) => m.modelo === marca), 'sem a marcação');
      const sorteadas = mods.filter((m) => m.sorteada);
      assert.equal(sorteadas.length, n);
      assert.equal(new Set(sorteadas.map((m) => m.modelo)).size, n, 'distintas');
      for (const m of sorteadas) assert.ok(u.linhasSorteadas.linhas.some((l) => l.modelo === m.modelo));
    }
  }
  const u = unicas('Watchers_Eye')[0];
  const antes = modificadoresDoUnico(u, semente(3));
  const depois = modificadoresDoUnico(u, semente(99), new Set(antes.map((m) => m.modelo)));
  assert.deepEqual(depois.filter((m) => m.sorteada).map((m) => m.modelo), antes.filter((m) => m.sorteada).map((m) => m.modelo));
  // (a peça gerada: as linhas sorteadas vão para o `af` dela)
  const peca = J.pecaDoJogo(gerar('Watchers_Eye'));
  assert.equal(peca.poe.modificadores.filter((m) => m.sorteada).length, 2);
});

test('"ENQUANTO AFETADO POR <Aura>": vale com a aura da gema ligada (e a do mercenário); sem ela, não', { skip: SEM }, () => {
  assert.deepEqual(tr('+{0}% de chance de Suprimir Dano Mágico enquanto afetado por Graça', [12]).efeitos, [{ stat: 'spell_suppression@afetadoPor:graca', valor: 12 }]);
  assert.deepEqual(tr('{0}% de chance de causar Dano Dobrado enquanto usando Orgulho', [10]).efeitos, [{ stat: 'chance_dano_dobrado@afetadoPor:orgulho', valor: 10 }]);
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.equipment = { ...e.equipment, ring: anel({ 'spell_suppression@afetadoPor:graca': 12 }) };
  e.hunt = { clock: 1000, buffs: {} };
  const supressao = () => { Ficha.invalidar(e); return Ficha.combate(e).afPoe.spell_suppression ?? 0; };
  const sem = supressao();
  e.hunt.buffs['poe-gema:Grace'] = { ate: 1e12, tipo: 'poe-aura' };
  assert.equal(supressao() - sem, 12);
  delete e.hunt.buffs['poe-gema:Grace'];
  e.hunt.lacaios = [{ mercenario: true, hp: 10, auraEfeitos: { id: 'poe-gema:Grace' } }];
  assert.equal(supressao() - sem, 12, 'a aura do mercenário vivo');
});

test('"SE VOCÊ CONJUROU <Maldição> NOS ÚLTIMOS 10 SEGUNDOS": o uso da gema pelo nome; depois de 10 s, não', { skip: SEM }, () => {
  assert.deepEqual(tr('Você Não é Afetado por Eletrização se conjurou Condutividade nos últimos {0} segundos', [10]).efeitos, [{ stat: 'imune_eletrizacao@nosUltimos:10:usou:gema:condutividade', valor: 1 }]);
  assert.deepEqual(tr('Imune a Dano Refletido se você conjurou Punição nos últimos {0} segundos', [10]).efeitos.map((x) => x.stat), ['imune_reflexo_fisico@nosUltimos:10:usou:gema:castigo', 'imune_reflexo_elemental@nosUltimos:10:usou:gema:castigo']);
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.equipment = { ...e.equipment, ring: anel({ 'imune_eletrizacao@nosUltimos:10:usou:gema:condutividade': 1 }) };
  e.hunt = { clock: 5000 };
  const imune = () => { Ficha.invalidar(e); return Ficha.combate(e).afPoe.imune_eletrizacao ?? 0; };
  assert.equal(imune(), 0);
  ModsPoe.marcar(e.hunt, 'usou:gema:condutividade', 5000);
  assert.equal(imune(), 1);
  e.hunt.clock = 15_500;
  assert.equal(imune(), 0, 'passou dos 10 s');
});

test('as IMUNIDADES a cada maldição dos monstros e à Exposição; o Evadir fixo soma à chance da Evasão', { skip: SEM }, () => {
  const hunt = { clock: 0 };
  const e = personagemDeTeste({ vocacao: 'knight', level: 60 });
  e.equipment = { ...e.equipment, ring: anel({ imune_vulnerabilidade: 1, imune_exposicao: 1, chance_evadir: 100 }) };
  e.hunt = hunt;
  Ficha.invalidar(e);
  const ficha = Ficha.combate(e);
  ModsPoe.definirFichaDaCacada(hunt, () => ficha);
  ModsPoe.amaldicoarJogador(hunt, 'v:1', { nome: 'Vulnerabilidade', af: { dano_physical_recebido_inc: 20 } }, 0);
  ModsPoe.amaldicoarJogador(hunt, 'f:1', { nome: 'Fraqueza Elemental', af: { fire_res: -20 } }, 0);
  assert.deepEqual(Object.values(hunt.maldicoesNoJogador ?? {}).map((m) => m.nome), ['Fraqueza Elemental'], 'a Vulnerabilidade não pega; a outra, sim');
  assert.equal(MonstrosNoJogador.expor(hunt, ficha, 'fire', 10, { agora: 0 }), false, 'imune a Exposição');
  const original = Math.random;
  try {
    Math.random = () => 0.5;
    assert.equal(Defesa.esquivou({ ...ficha, evasion: 0 }, hunt, { key: 'x', level: 10 }), true, 'com +100%: o teto de 95%');
    assert.equal(Defesa.esquivou({ ...ficha, evasion: 0, afPoe: { ...ficha.afPoe, chance_evadir: 0 } }, hunt, { key: 'x', level: 10 }), false);
  } finally { Math.random = original; }
});

test('a TAG das habilidades não canalizadoras e o "Críticos Penetram"', { skip: SEM }, () => {
  assert.ok(Acoes.tagsPoeDaSkill({ poeGema: { slug: 'Fireball' } }).includes('naoCanalizar'));
  assert.ok(!Acoes.tagsPoeDaSkill({ poeGema: { slug: 'Blight' } }).includes('naoCanalizar'), 'o Flagelo canaliza');
  assert.deepEqual(tr('Habilidades Não Canalizadoras tem {0} de Custo de Mana Total enquanto afetado por Clareza', [-10]).efeitos, [{ stat: 'custo_mana_fixo@naoCanalizar+afetadoPor:clareza', valor: -10 }]);
  assert.deepEqual(tr('Acertos Críticos Penetram {0}% da Resistência Elemental Inimiga enquanto afetado por Fanatismo', [10]).efeitos, [{ stat: 'pen_critico@afetadoPor:fanatismo', valor: 10 }]);
});

test('a PERSONALIDADE DIVIDIDA: os mods dela × (1 + 25% × as passivas alocadas entre o encaixe e o início da classe)', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 90 });
  e.sistema = 'poe';
  e.classePoe = 'Marauder';
  P.garantir(e);
  const encaixe = P.arvore().nos.filter((n) => P.ehEncaixeDeJoia(n)).map((n) => ({ n, c: P.caminhoAte(e, n.id) })).filter((x) => x.c?.length >= 3).sort((a, b) => a.c.length - b.c.length)[0];
  e.passivas.alocados.push(...encaixe.c);
  P.garantir(e);
  const d = P.passivasAteOInicio(e, encaixe.n.id);
  assert.equal(d, encaixe.c.length - 1, 'as passivas do caminho, sem o encaixe');
  const peca = J.pecaDoJogo(gerar('Split_Personality'));
  const [k, v] = Object.entries(peca.poe.af).find(([x, y]) => typeof y === 'number' && y && x !== 'joia_efeito_por_passiva_ate_inicio');
  assert.equal(peca.poe.af.joia_efeito_por_passiva_ate_inicio, 25);
  e.inventory = [peca];
  const antes = (Ficha.invalidar(e), Ficha.combate(e).afPoe[k] ?? 0);
  assert.equal(Comandos.comando(e, { action: 'encaixarJoia', no: encaixe.n.id, pilha: 0, id: peca.id }).ok, true);
  Ficha.invalidar(e);
  assert.ok(Math.abs((Ficha.combate(e).afPoe[k] ?? 0) - antes - v * (1 + (25 * d) / 100)) < 1e-6, `${k}: ${v} × ${1 + (25 * d) / 100}`);
});
