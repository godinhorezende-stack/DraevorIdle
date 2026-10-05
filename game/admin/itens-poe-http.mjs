// As rotas da engine para o sistema de itens no modelo do PoE (Fase 1): SÓ LEITURA, sob `/api/mapas/_engine/itens-poe/` (prefixo que o
// nginx de produção tranca), e só com o sistema ligado (`ITENS_POE=1` + o catálogo importado — que não existe no container de produção).
// Também serve as imagens da coleção local (`ref/<caminho>`), para a engine mostrar os ícones sem copiá-los para o repositório.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { normalize, join, extname } from 'node:path';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import { gerarPeca, elegiveis, poolDa, acharBase } from '../systems/itens-poe/gerar.mjs';
import * as Traduzir from '../systems/itens-poe/traduzir.mjs';
import * as Jogo from '../systems/itens-poe/jogo.mjs';
import * as Telas from './itens-poe-telas.mjs';
import * as CampanhaPoe from '../systems/itens-poe/campanha.mjs';
import * as DropsPorMonstro from '../systems/itens-poe/drops-por-monstro.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';

const PREFIXO = '/api/mapas/_engine/itens-poe/';
const TIPOS = { '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.gif': 'image/gif' };

/** Semente → rng (mulberry32): a mesma semente, as mesmas peças. */
function rngDe(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** O resumo das famílias de um pool para a tabela da engine (peso do grupo, % no lado, tiers liberados no iLvl). */
function resumoDoPool(pool, ilvl) {
  const liberados = elegiveis(pool, ilvl);
  const lado = (lista, nome) => {
    const total = lista.reduce((n, g) => n + g.peso, 0) || 1;
    return lista.map((g) => ({ traducao: Traduzir.traduzirMod({ modelo: g.tiers[0]?.modelo, valores: (g.tiers[0]?.faixas ?? []).map((f) => f[1]) }), familia: g.familia, lado: nome, tags: g.tags, peso: g.peso, pct: Number(((g.peso / total) * 100).toFixed(2)), ilvlMin: Math.min(...g.tiers.map((t) => t.ilvl ?? 1)), ilvlMax: g.ilvlMax, tiers: g.tiers.map((t) => ({ tier: t.tier, nome: t.nome, ilvl: t.ilvl, peso: t.peso, texto: t.texto })), liberados: liberados[nome].filter((c) => c.familia === g.familia).length }));
  };
  return { prefixos: lado(pool.prefixos, 'prefixo'), sufixos: lado(pool.sufixos, 'sufixo') };
}

/** As peças de exemplo de uma semente (o mesmo sorteio da tela: dar a peça N regera a mesma peça, sem confiar no navegador). */
function pecasDe(cat, q) {
  const rng = rngDe(Number(q.get('semente')) || 1);
  const n = Math.min(24, Math.max(1, Number(q.get('n')) || 6));
  return Array.from({ length: n }, () => gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base: q.get('base'), raridade: q.get('raridade') ?? 'raro', ilvl: Number(q.get('ilvl')) || 84, rng, unico: q.get('unico') || null }));
}

export async function atender(req, res, caminho, url, { json, corpoJson }) {
  if (!caminho.startsWith(PREFIXO)) return false;
  const rota = caminho.slice(PREFIXO.length);
  // A única escrita: dar uma peça a um personagem ONLINE no servidor local (para testar jogando).
  if (req.method === 'POST' && rota === 'dar') {
    const cat = Catalogo.catalogo();
    if (!cat) return json(res, 409, { ok: false, erros: ['Sistema de itens do PoE desligado neste servidor.'] }), true;
    const d = await corpoJson(req).catch(() => null);
    const q = new URLSearchParams({ base: d?.base ?? '', raridade: d?.raridade ?? 'raro', ilvl: d?.ilvl ?? 84, semente: d?.semente ?? 1, n: Number(d?.indice ?? 0) + 1, ...(d?.unico ? { unico: d.unico } : {}) });
    const gerada = pecasDe(cat, q)[Number(d?.indice ?? 0)];
    const peca = Jogo.pecaDoJogo(gerada);
    if (!peca) return json(res, 400, { ok: false, erros: [gerada?.erro ?? 'Esta base não é equipável no Draevor (sem slot).'] }), true;
    const r = Jogo.entregar(d?.personagem, peca);
    return json(res, r.ok ? 200 : 400, r.ok ? { ok: true, nome: r.nome, peca } : { ok: false, erros: [r.erro] }), true;
  }
  // A outra escrita: trocar o MAPA (terreno) de uma área da campanha do PoE (vale na hora e fica salvo em campanha-mapas.json).
  if (req.method === 'POST' && rota === 'campanha/mapa') {
    if (!Catalogo.ligado()) return json(res, 409, { ok: false, erros: ['Sistema de itens do PoE desligado neste servidor.'] }), true;
    const d = await corpoJson(req).catch(() => null);
    const r = CampanhaPoe.trocarMapa(String(d?.area ?? ''), String(d?.mapa ?? ''));
    return json(res, r.ok ? 200 : 400, r.ok ? { ok: true, area: Telas.area(d.area) } : { ok: false, erros: [r.erro] }), true;
  }
  // A tabela de drop de um monstro (Acts / Campanha do PoE): grava em gamedata/itens-poe/drops-por-monstro.json e vale na hora.
  if (req.method === 'POST' && rota === 'drops') {
    if (!Catalogo.ligado()) return json(res, 409, { ok: false, erros: ['Sistema de itens do PoE desligado neste servidor.'] }), true;
    const d = await corpoJson(req).catch(() => null);
    const r = DropsPorMonstro.salvar(String(d?.monstro ?? ''), d?.lista, { existe: (id) => !!ITEM_CATALOG[id], podeTer: Telas.temDropProprio });
    return json(res, r.ok ? 200 : 400, r.ok ? { ok: true, drops: Telas.dropsDe(String(d.monstro)) } : { ok: false, erros: r.erros }), true;
  }
  // Os mobs de uma área (aba Acts) e o desenho de um monstro (aba Mobs): gravam em gamedata/itens-poe/campanha-ajustes.json e valem na próxima entrada na área.
  if (req.method === 'POST' && rota === 'campanha/area/monstros') {
    if (!Catalogo.ligado()) return json(res, 409, { ok: false, erros: ['Sistema de itens do PoE desligado neste servidor.'] }), true;
    const d = await corpoJson(req).catch(() => null);
    const r = CampanhaPoe.salvarMonstrosDaArea(String(d?.area ?? ''), d?.monstros);
    return json(res, r.ok ? 200 : 400, r.ok ? { ok: true, area: Telas.area(d.area) } : { ok: false, erros: r.erros }), true;
  }
  if (req.method === 'POST' && rota === 'mobs/ataques') {
    if (!Catalogo.ligado()) return json(res, 409, { ok: false, erros: ['Sistema de itens do PoE desligado neste servidor.'] }), true;
    const d = await corpoJson(req).catch(() => null);
    const r = CampanhaPoe.definirAtaques(String(d?.slug ?? ''), d?.ajuste ?? {});
    return json(res, r.ok ? 200 : 400, r.ok ? { ok: true, ataques: Telas.ataquesDe(String(d.slug), d?.nivel) } : { ok: false, erros: r.erros }), true;
  }
  if (req.method === 'POST' && rota === 'mobs/desenho') {
    if (!Catalogo.ligado()) return json(res, 409, { ok: false, erros: ['Sistema de itens do PoE desligado neste servidor.'] }), true;
    const d = await corpoJson(req).catch(() => null);
    const r = CampanhaPoe.definirDesenho(String(d?.slug ?? ''), d?.desenho ? String(d.desenho) : null);
    return json(res, r.ok ? 200 : 400, r.ok ? { ok: true } : { ok: false, erros: r.erros }), true;
  }
  if (req.method !== 'GET') return json(res, 405, { ok: false, erros: ['Somente leitura.'] }), true;
  const q = url.searchParams;
  if (rota === 'estado') return json(res, 200, { ligado: Catalogo.ligado(), arquivo: Catalogo.ARQUIVO, regras: Catalogo.REGRAS, como: 'Ligue com ITENS_POE=1 e importe com: node tools/importar-poe-itens.mjs' }), true;
  const cat = Catalogo.catalogo();
  if (!cat) return json(res, 409, { ok: false, erros: ['Sistema de itens do PoE desligado neste servidor (ITENS_POE=1 + catálogo importado).'] }), true;

  if (rota.startsWith('ref/')) {
    // A imagem da coleção local (só arquivos de imagem, sem sair da pasta).
    const alvo = normalize(join(Catalogo.PASTA_ORIGINAL, decodeURIComponent(rota.slice(4))));
    if (!alvo.startsWith(Catalogo.PASTA_ORIGINAL) || !TIPOS[extname(alvo)] || !existsSync(alvo) || !statSync(alvo).isFile()) return json(res, 404, { ok: false }), true;
    res.writeHead(200, { 'content-type': TIPOS[extname(alvo)], 'cache-control': 'private, max-age=3600' });
    createReadStream(alvo).pipe(res);
    return true;
  }
  if (rota === 'classes') {
    return json(res, 200, { relatorio: cat.relatorio, classes: Object.values(cat.classes).map((c) => ({ id: c.id, grupo: c.grupo, bases: c.bases.length, unicos: c.unicos.length, paginas: Object.keys(c.paginas), semPool: c.bases.filter((b) => !b.pool).length })) }), true;
  }
  if (rota === 'classe') {
    const c = cat.classes[q.get('id')];
    if (!c) return json(res, 404, { ok: false, erros: ['Classe desconhecida.'] }), true;
    return json(res, 200, { id: c.id, grupo: c.grupo, fontes: c.fontes, paginas: Object.keys(c.paginas), bases: c.bases.map((b) => ({ id: b.id, nome: b.nome, requisitos: b.requisitos, atributos: b.atributos, implicitos: b.implicitos.map((i) => i.texto), icone: b.icone, pool: b.pool })), unicos: c.unicos.map((u) => ({ slug: u.slug, nome: u.nome, base: u.base, requisitos: u.requisitos, modificadores: u.modificadores.map((m) => m.texto), icone: u.icone })) }), true;
  }
  if (rota === 'pool') {
    const achado = acharBase(cat, q.get('base'));
    const pool = achado ? poolDa(achado.classe, achado.base) : null;
    if (!pool) return json(res, 404, { ok: false, erros: ['A coleção não tem pool de mods para esta base.'] }), true;
    return json(res, 200, { base: achado.base.id, pagina: achado.base.pool, ilvl: Number(q.get('ilvl')) || 84, ...resumoDoPool(pool, Number(q.get('ilvl')) || 84) }), true;
  }
  if (rota === 'campanha') return json(res, 200, Telas.campanha()), true;
  if (rota === 'campanha/area') {
    const a = Telas.area(q.get('id'));
    return a ? json(res, 200, a) : json(res, 404, { ok: false, erros: ['Área desconhecida.'] }), true;
  }
  if (rota === 'chefes') return json(res, 200, Telas.chefes()), true;
  if (rota === 'mobs') return json(res, 200, { mobs: Telas.mobs() }), true;
  if (rota === 'mobs/ataques') {
    const a = Telas.ataquesDe(q.get('slug') ?? '', q.get('nivel'));
    return a ? json(res, 200, a) : json(res, 404, { ok: false, erros: ['Monstro desconhecido.'] }), true;
  }
  if (rota === 'criaturas') return json(res, 200, { criaturas: Telas.criaturasDoDraevor(q.get('q') ?? '') }), true;
  if (rota === 'drops') return json(res, 200, { drops: Telas.dropsDe(q.get('monstro') ?? '') }), true;
  if (rota === 'itens-de-missao') return json(res, 200, { itens: DropsPorMonstro.ITENS_DE_MISSAO }), true;
  if (rota === 'arvore') return json(res, 200, { ...Telas.arvore(), cobertura: Telas.coberturaDaArvore() }), true;
  if (rota === 'online') return json(res, 200, { online: Jogo.online(), equipavel: Object.keys(Jogo.CLASSES_DO_JOGO), naoEquipaveis: Jogo.registro().naoEquipaveis }), true;
  if (rota === 'gerar') {
    const pecas = pecasDe(cat, q);
    // Cada peça vem com a TRADUÇÃO para os atributos do Draevor (o que somaria na ficha) e o estado de cada mod.
    return json(res, 200, { pecas: pecas.map((p) => (p.erro ? p : { ...p, traducao: Traduzir.traduzirPeca(p) })) }), true;
  }
  if (rota === 'cobertura') {
    const c = Traduzir.cobertura(cat);
    return json(res, 200, { ...c, semRegra: c.semRegra.slice(0, 80), totalSemRegra: c.semRegra.length, elementos: Traduzir.TABELA.elementos, regras: Traduzir.TABELA.regras.length }), true;
  }
  return json(res, 404, { ok: false, erros: ['Rota desconhecida.'] }), true;
}
