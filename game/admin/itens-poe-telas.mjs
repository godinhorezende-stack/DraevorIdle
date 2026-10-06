// Os dados das três telas da engine para o PoE (grupo "Referência PoE", só com ITENS_POE=1): a CAMPANHA (atos, grafo de áreas, mapa de
// cada área, monstros e chefes com status e habilidades), a ÁRVORE (nós, maestrias, keystones e ascendências, com o texto do PoE, a
// tradução e o estado de cada linha) e os CHEFES (pináculos e chefes de ato, com status, habilidades convertidas e arena).
// Tudo vem do que o jogo carregou de verdade (bestiário, bosses únicos, catálogo de bosses) — nada é recalculado aqui.
import { CATALOGO, ITEM_CATALOG } from '../systems/dados.mjs';
import * as DropsPorMonstro from '../systems/itens-poe/drops-por-monstro.mjs';
import { BESTIARY } from '../systems/hunt/monstros.mjs';
import { ataquesParaFicha, EFEITO_PADRAO } from '../systems/poderes.mjs';
import * as BossesUnicos from '../systems/bosses-unicos/catalogo.mjs';
import * as Monstros from '../systems/itens-poe/monstros.mjs';
import * as Habilidades from '../systems/itens-poe/habilidades.mjs';
import * as CampanhaPoe from '../systems/itens-poe/campanha.mjs';
import * as Pinaculos from '../systems/itens-poe/pinaculos.mjs';
import * as Arvore from '../systems/passivas/arvore.mjs';
import { mapaDe, spawnsDaHunt } from '../systems/hunt/terreno.mjs';
import { readFileSync as lerArquivo, existsSync as existe } from 'node:fs';
import { lerExecutaveis } from '../systems/atos-carregar.mjs';
import * as DropsPorMonstroDasMissoes from '../systems/itens-poe/drops-por-monstro.mjs';

const C = Monstros.CAMPANHA;
const desenhoDe = (key) => {
  const b = BESTIARY[key];
  return b?.look ? { tipo: 'criatura', look: b.look, cores: b.colors ?? null } : null;
};
const nomeDoMapa = (id) => CATALOGO.hunts.find((h) => h.id === id)?.name ?? id;

/** Um monstro da campanha com os status do PoE, o desenho do Draevor e as habilidades convertidas. */
function monstro(m) {
  const chave = Monstros.chaveDe(m);
  return {
    chave, nome: m.nome, slug: m.slug, nivel: m.nivel, unico: !!m.unico, vida: m.vida, escudoDeEnergia: m.escudoDeEnergia ?? 0, dano: m.dano, tempoAtaque: m.tempoAtaque,
    armadura: m.armadura ?? 0, evasao: m.evasao ?? 0, resistencias: m.resistencias ?? {}, experiencia: m.experiencia,
    desenho: desenhoDe(chave), desenhoDe: BESTIARY[chave] ? Object.entries(BESTIARY).find(([k, b]) => !k.startsWith('poe-') && b.look === BESTIARY[chave].look)?.[0] ?? null : null,
    habilidades: (m.habilidades ?? []).map((h) => ({ nome: h.nome, interno: h.interno, tags: h.tags, dano: h.dano ?? null, elemento: h.elemento ?? null, tempo: h.tempo ?? null, recarga: h.recarga ?? null, descricao: h.descricao ?? null })),
    convertidas: Habilidades.convertidas(m),
    drops: dropsDe(chave),
  };
}

/** O monstro pode ter drop próprio? Só os ÚNICOS da campanha (modelo do PoE: o comum cai pela tabela global). `k`: o slug da tabela. */
let UNICOS = null;
export function temDropProprio(k) {
  UNICOS ??= new Set(Object.values(C.areas).flatMap((a) => a.monstros ?? []).filter((m) => m.unico).map((m) => Monstros.chaveDe({ ...m, nivel: 0 }).replace(/^poe-|-0$/g, '')));
  return UNICOS.has(k);
}

/** A tabela de drop do monstro (engine), com o nome de cada item. */
export const dropsDe = (keyOuSlug) => DropsPorMonstro.tabelaDe(keyOuSlug).map((d) => ({ ...d, nome: ITEM_CATALOG[d.id]?.name ?? null }));

/** A visão geral da campanha: os atos com o grafo (o mesmo que o runtime de atos recebe), as áreas e os mapas do Draevor. */
export function campanha() {
  const atos = C.atos.map((a, i) => {
    const r = CampanhaPoe.atoDoRuntime(a.numero, i ? `poe-ato-${C.atos[i - 1].numero}` : null);
    const ch = C.chefes[a.numero];
    return {
      numero: a.numero, nome: a.nome, areas: a.areas,
      conexoes: r?.conexoes ?? [], inicio: r?.inicio ?? null, faseDoChefe: r?.bossFinal?.faseAnterior ?? null,
      chefe: ch ? { nome: ch.nome, nivel: ch.nivel, area: ch.area, bossId: CampanhaPoe.idDoChefe(a.numero), vida: ch.monstro?.vida ?? null, desenho: desenhoDe(Monstros.desenhoPeloNome(ch.nome) ?? 'demon') } : null,
    };
  });
  const areas = Object.fromEntries(Object.values(C.areas).map((a) => [a.id, {
    id: a.id, nome: a.nome, ato: a.ato, nivel: a.nivel, cidade: !!a.cidade, posicao: a.posicao ?? null, conexoes: a.conexoes ?? [], chefes: a.chefes ?? [],
    mapa: a.cidade ? null : a.mapa, nomeDoMapa: a.mapa ? nomeDoMapa(a.mapa) : null, trocado: !!CampanhaPoe.MAPAS_TROCADOS[a.id],
    monstros: (a.monstros ?? []).length, unicos: (a.monstros ?? []).filter((m) => m.unico).map((m) => m.nome),
  }]));
  return { atos, areas, mapas: CampanhaPoe.mapasDoDraevor() };
}

/** Uma área: o mapa (e o que o jogo usa agora), os monstros com status e habilidades e, se for a área do chefe do ato, o chefe. */
export function area(id) {
  const a = C.areas[id];
  if (!a) return null;
  const chefeDoAto = Object.values(C.chefes).find((c) => c.monstro && c.ato === a.ato && (c.area === a.nome || CampanhaPoe.atoDoRuntime(a.ato)?.bossFinal?.faseAnterior === id));
  return {
    id: a.id, nome: a.nome, ato: a.ato, nivel: a.nivel, cidade: !!a.cidade, notas: a.notas ?? '', tags: a.tags ?? [], slug: a.slug,
    poedb: a.slug ? `https://poedb.tw/pt/${encodeURIComponent(a.slug)}` : null,
    mapa: a.mapa ?? null, nomeDoMapa: a.mapa ? nomeDoMapa(a.mapa) : null, mapaNoJogo: a.cidade ? null : mapaDe(a.id), trocado: !!CampanhaPoe.MAPAS_TROCADOS[a.id],
    monstros: (a.monstros ?? []).map(monstro),
    chefeDoAto: chefeDoAto ? chefeDeAto(chefeDoAto.ato) : null,
  };
}

/** O chefe de ato como o jogo o registrou (boss único) + os status do PoE e as habilidades de origem. */
function chefeDeAto(numero) {
  const c = C.chefes[numero];
  if (!c?.monstro) return null;
  const id = CampanhaPoe.idDoChefe(numero);
  const def = BossesUnicos.bossUnico(id);
  const entrada = CATALOGO.bosses.find((b) => b.id === id);
  const base = def?.base ?? Monstros.desenhoPeloNome(c.nome) ?? 'demon';
  const arena = CATALOGO.bosses.find((b) => !b.custom && b.creatures?.[0]?.key === base);
  return {
    id, tipo: 'ato', ato: numero, nome: c.nome, nomeEn: c.nomeEn ?? null, area: c.area, nivel: c.nivel,
    status: monstro(c.monstro), desenho: desenhoDe(base), base,
    noJogo: def ? { vida: def.atributos.vida ?? null, melee: def.melee, resistencias: def.atributos.resistencias ?? {}, comportamentos: def.comportamentos } : null,
    arena: entrada ? { nome: arena?.name ?? null, deOutroBoss: !!arena, partida: entrada.partida ?? null } : null,
    acompanhantes: c.acompanhantes ?? [],
  };
}

/** Os chefes: os pináculos (endgame) e os chefes de cada ato. */
export function chefes() {
  const pinaculos = Pinaculos.DADOS.chefes.map((c) => {
    const def = BossesUnicos.bossUnico(c.id);
    const entrada = CATALOGO.bosses.find((b) => b.id === c.id);
    const arena = CATALOGO.bosses.find((b) => !b.custom && b.creatures?.[0]?.key === c.base);
    return {
      id: c.id, tipo: 'pinaculo', nome: c.nome, poedb: c.poedb ?? null, nivel: Pinaculos.DADOS.regra.nivel, base: c.base, baseNome: BESTIARY[c.base]?.name ?? c.base, desenho: desenhoDe(c.base),
      poe: { vidaPct: c.vidaPct, danoPct: c.danoPct, expPct: c.expPct, raridadeDoDropPct: c.raridadeDoDropPct ?? null },
      noJogo: entrada ? { vida: entrada.hp, exp: entrada.exp, resistencias: def?.atributos.resistencias ?? c.resistencias, vidaMult: def?.atributos.vidaMult, danoMult: def?.atributos.danoMult, cooldownHoras: entrada.cooldownHours } : null,
      ataques: ataquesParaFicha(c.base) ?? [],
      registrado: !!def,
      arena: arena ? arena.name : null,
      unicos: c.unicos,
    };
  });
  const atos = C.atos.map((a) => chefeDeAto(a.numero)).filter(Boolean);
  return { regra: Pinaculos.DADOS.regra, pinaculos, atos };
}

// ---------------------------------------------------------------- árvore

/** A árvore do PoE compacta para a tela (posições, ligações, tipo, textos, estados e efeitos), com as ascendências à parte. */
export function arvore() {
  const A = Arvore.arvore();
  if (A?.id !== 'poe') return { ligada: false };
  const nos = Object.values(A.nos).map((n) => ({
    id: n.id, nome: n.nome, en: n.nomeEn ?? null, t: n.tipo, x: n.x, y: n.y, c: n.conexoes ?? [], asc: n.ascendencia ?? null,
    textos: n.textos ?? [], estados: n.estados ?? [], efeitos: n.efeitos ?? [],
    ...(n.keystone ? { keystone: n.keystone } : {}),
    ...(n.opcoes ? { opcoes: n.opcoes } : {}), ...(n.grupo != null ? { grupo: n.grupo } : {}),
  }));
  return { ligada: true, relatorio: A.relatorio ?? null, inicios: A.inicios, ascendencias: A.ascendencias ?? {}, pontos: A.pontos ?? null, nos };
}

/** O resumo de cobertura da árvore (por tipo: quantas linhas em cada estado). */
export function coberturaDaArvore() {
  const A = Arvore.arvore();
  const por = {};
  for (const n of Object.values(A?.nos ?? {})) {
    const k = n.ascendencia ? 'ascendencia' : n.tipo;
    por[k] ??= { nos: 0, estados: {} };
    por[k].nos++;
    for (const e of [...(n.estados ?? []), ...(n.opcoes ?? []).flatMap((o) => o.estados ?? [])]) por[k].estados[e] = (por[k].estados[e] ?? 0) + 1;
  }
  return por;
}

// ---------------------------------------------------------------- mobs (aba Mobs com o PoE ligado)

/** Os monstros do PoE da campanha (um por slug), com o desenho, onde aparecem (área, nível e os status do PoE em cada uma) e os drops dos únicos. */
export function mobs() {
  const por = new Map();
  for (const a of Object.values(C.areas)) {
    if (a.cidade) continue;
    for (const m of a.monstros ?? []) {
      const x = por.get(m.slug) ?? { slug: m.slug, nome: m.nome, unico: !!m.unico, ocorrencias: [] };
      x.unico ||= !!m.unico;
      x.ocorrencias.push({ area: a.id, areaNome: a.nome, ato: a.ato, nivel: m.nivel, vida: m.vida, escudoDeEnergia: m.escudoDeEnergia ?? 0, dano: m.dano, tempoAtaque: m.tempoAtaque, armadura: m.armadura ?? 0, evasao: m.evasao ?? 0, resistencias: m.resistencias ?? {}, experiencia: m.experiencia, habilidades: (m.habilidades ?? []).length });
      por.set(m.slug, x);
    }
  }
  return [...por.values()].map((x) => {
    const chave = Monstros.chaveDe(x.ocorrencias[0] ? { slug: x.slug, nivel: x.ocorrencias[0].nivel } : x);
    const base = Monstros.AJUSTES.desenhos[x.slug] ?? (BESTIARY[chave] ? Object.entries(BESTIARY).find(([k, b]) => !k.startsWith('poe-') && b.look === BESTIARY[chave].look)?.[0] : null);
    return { ...x, ocorrencias: x.ocorrencias.sort((a, b) => a.ato - b.ato || a.nivel - b.nivel), desenho: desenhoDe(chave), desenhoDe: base ?? null, desenhoAjustado: !!Monstros.AJUSTES.desenhos[x.slug], drops: x.unico ? dropsDe(x.slug) : [] };
  }).sort((a, b) => (a.ocorrencias[0]?.ato ?? 99) - (b.ocorrencias[0]?.ato ?? 99) || a.nome.localeCompare(b.nome));
}

/** As criaturas do Draevor (para escolher o desenho de um monstro do PoE): `[{ key, nome, desenho }]`, pela busca. */
export function criaturasDoDraevor(q = '') {
  const t = String(q).toLowerCase().trim();
  return Object.entries(BESTIARY).filter(([k, b]) => !k.startsWith('poe-') && b.look && (!t || k.includes(t) || String(b.name ?? '').toLowerCase().includes(t))).slice(0, 40).map(([k, b]) => ({ key: k, nome: b.name ?? k, desenho: desenhoDe(k) }));
}

/**
 * Os ATAQUES e EFEITOS de um monstro do PoE (aba Mobs): o golpe básico e as habilidades, como o jogo usa (com o ajuste da Engine) e como vieram do PoE (sem ajuste),
 * no nível da ocorrência `nivel` (padrão: a primeira). O efeito na tela de cada um: o escolhido ou o padrão do elemento.
 */
export function ataquesDe(slug, nivel = null) {
  const ocorrencias = Object.values(C.areas).flatMap((a) => (a.monstros ?? []).filter((m) => m.slug === slug).map((m) => ({ m, area: a })));
  const chefe = Object.values(C.chefes).find((c) => c.monstro?.slug === slug);
  const alvo = ocorrencias.find((o) => o.m.nivel === Number(nivel)) ?? ocorrencias[0] ?? (chefe ? { m: chefe.monstro, area: { nome: chefe.area } } : null);
  if (!alvo) return null;
  const m = alvo.m;
  const aj = Monstros.AJUSTES.ataques[slug] ?? null;
  const efeitoDe = (h) => h.efeito ?? EFEITO_PADRAO[h.elemento] ?? EFEITO_PADRAO.physical;
  const comAjuste = Habilidades.comAjuste(m, aj).map((h) => ({ ...h, efeitoNaTela: efeitoDe(h) }));
  return {
    slug, nome: m.nome, nivel: m.nivel, area: alvo.area.nome, chefeDeAto: !!chefe, niveis: [...new Set(ocorrencias.map((o) => o.m.nivel))].sort((a, b) => a - b),
    desenho: desenhoDe(Monstros.chaveDe(m)) ?? (chefe ? desenhoDe(Monstros.desenhoPeloNome(chefe.nome) ?? 'demon') : null),
    basico: { dano: m.dano, tempoAtaque: m.tempoAtaque, efeito: aj?.basico?.efeito ?? null, efeitoNaTela: aj?.basico?.efeito ?? 1 },
    habilidades: comAjuste,
    originais: Habilidades.convertidas(m).map((h) => ({ ...h, efeitoNaTela: efeitoDe(h) })),
    doPoedb: (m.habilidades ?? []).map((h) => ({ nome: h.nome, interno: h.interno, tags: h.tags, dano: h.dano ?? null, elemento: h.elemento ?? null, descricao: h.descricao ?? null })),
    ajuste: aj ?? {}, efeitoPadrao: EFEITO_PADRAO, elementos: Habilidades.ELEMENTOS_DO_AJUSTE, formas: Habilidades.FORMAS,
  };
}

// ---------------------------------------------------------------- mapas (Campanha → Mapas)
/** Os mapas do Draevor que as áreas do PoE usam como terreno (e os livres): quem usa cada um, o nível e um bicho nativo para o desenho. */
export function mapas() {
  const porMapa = new Map(CampanhaPoe.mapasDoDraevor().map((m) => [m.id, { ...m, areas: [] }]));
  for (const a of Object.values(C.areas)) {
    if (a.cidade || !a.mapa) continue;
    const x = porMapa.get(a.mapa) ?? { id: a.mapa, nome: nomeDoMapa(a.mapa), nivel: null, areas: [] };
    x.areas.push({ id: a.id, nome: a.nome, ato: a.ato, nivel: a.nivel, trocado: !!CampanhaPoe.MAPAS_TROCADOS[a.id] });
    porMapa.set(a.mapa, x);
  }
  return [...porMapa.values()].map((m) => {
    const nativo = (spawnsDaHunt(m.id) ?? []).flatMap((sp) => (sp.criaturas ?? []).map((c) => c.key)).find((k) => BESTIARY[k]?.look);
    return { ...m, desenho: nativo ? desenhoDe(nativo) : null, areas: m.areas.sort((a, b) => a.ato - b.ato || a.nivel - b.nivel) };
  }).sort((a, b) => b.areas.length - a.areas.length || String(a.nome).localeCompare(String(b.nome)));
}

// ---------------------------------------------------------------- missões (Campanha → Missões)
const DRIVE = '/home/deploy/referencias-poe/original/poe-atos';
const lerDrive = (rel) => (existe(`${DRIVE}/${rel}`) ? JSON.parse(lerArquivo(`${DRIVE}/${rel}`, 'utf8')) : null);
let MISSOES = null;
/**
 * As missões da campanha (a coleção do Drive): nome, tipo, descrição, recompensa, as áreas por onde passa (com os objetivos de cada etapa) e o que no jogo
 * está ligado a ela — o item de missão e as FASES cuja conclusão vem dela (o alvo a matar, o item a pegar).
 */
export function missoes() {
  if (!MISSOES) {
    const geral = new Map((lerDrive('Missoes/missoes.json') ?? []).map((m) => [m.slug, m]));
    const por = new Map();
    for (let n = 1; n <= 10; n++) {
      const d = lerDrive(`Ligacoes/Ato_${String(n).padStart(2, '0')}/ato-ligado.json`);
      for (const ar of d?.areas ?? []) {
        const area = Object.values(C.areas).find((x) => x.ato === n && x.slug === ar.slug);
        for (const et of ar.missoes_nesta_area ?? []) {
          const x = por.get(et.slug) ?? { slug: et.slug, nome: et.missao, ato: n, tipo: geral.get(et.slug)?.tipo ?? null, descricao: geral.get(et.slug)?.descricao ?? null, recompensa: et.recompensa_resumo ?? geral.get(et.slug)?.recompensa_texto ?? null, icone: geral.get(et.slug)?.icone ?? null, areas: new Map() };
          const a = x.areas.get(ar.slug) ?? { slug: ar.slug, nome: ar.nome, id: area?.id ?? null, cidade: !!ar.cidade, etapas: [] };
          a.etapas.push({ etapa: et.etapa, titulo: et.titulo, objetivos: (et.objetivos ?? []).filter((o) => o.length < 200), alvos: et.monstros_alvo ?? [], npcs: et.npcs ?? [] });
          x.areas.set(ar.slug, a);
          por.set(et.slug, x);
        }
      }
    }
    MISSOES = [...por.values()].map((m) => ({ ...m, areas: [...m.areas.values()].map((a) => ({ ...a, etapas: a.etapas.sort((p, q) => p.etapa - q.etapa) })) }));
  }
  // O que o jogo liga a cada missão (lido na hora: as fases mudam no editor).
  const fases = lerExecutaveis().filter((a) => a.id.startsWith('poe-ato-')).flatMap((a) => a.fases.map((f) => ({ ato: a.id, atoNome: a.nome, ...f })));
  const itens = DropsPorMonstroDasMissoes.ITENS_DE_MISSAO;
  return MISSOES.map((m) => {
    const item = itens.find((i) => i.missao === m.nome && i.ato === m.ato) ?? null;
    const idsDasAreas = new Set(m.areas.map((a) => a.id).filter(Boolean));
    const ligadas = fases.filter((f) => idsDasAreas.has(f.huntId) && ((f.conclusao?.tipo === 'item-de-missao' && item && Number(f.conclusao.item) === Number(item.id)) || (f.conclusao?.tipo === 'matar-chefe' && m.areas.some((a) => a.id === f.huntId && a.etapas.some((e) => e.alvos.some((al) => f.conclusao.nome && String(f.conclusao.nome).startsWith(al.split(',')[0])))))));
    return { ...m, item, fasesLigadas: ligadas.map((f) => ({ ato: f.ato, atoNome: f.atoNome, fase: f.id, nome: f.nome, conclusao: f.conclusao })), fasesDaMissao: fases.filter((f) => idsDasAreas.has(f.huntId)).map((f) => ({ ato: f.ato, fase: f.id, nome: f.nome })) };
  });
}
