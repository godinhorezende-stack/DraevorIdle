// O EDITOR DE CONJUNTOS por overrides: `gamedata/conjuntos.json` (fábrica) nunca é editado; o dono grava só o NOVO ou DIFERENTE em `gamedata/overrides/conjuntos.json`
// (`systems/conjuntos.mjs` aplica no boot e o Hot Reload re-aplica). Mesmo fluxo dos outros editores: propor (valida, sem gravar) → salvar (arquivo + versão anterior, com revisão)
// → publicar (commit + deploy). Ferramenta de balanceamento: nenhuma mecânica de jogo muda. Os totais de atributos vêm da ficha REAL do jogo (`Ficha.combate`), sem fórmula própria.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as Con from '../systems/conjuntos.mjs';
import * as P from '../systems/progressao.mjs';
import * as O from '../systems/overrides.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Afixos from '../systems/afixos.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { desenhoDoItem } from './biblioteca.mjs';
import { criarArquivoVersionado, revisaoDe, conferirRevisao } from './arquivo-versionado.mjs';

export const CAMINHOS = { arquivo: Con.ARQUIVO_DE_OVERRIDE, versoes: join(O.PASTA, '_versoes', 'conjuntos') };
const COMO_PUBLICAR = 'O arquivo gamedata/overrides/conjuntos.json foi gravado neste servidor e o Hot Reload local já o aplicou. Para valer na produção: faça commit e publique pelo deploy. Conjuntos não mudam combate nem drop.';
const arq = () => criarArquivoVersionado({ caminhos: CAMINHOS, valorPadrao: () => ({ ativo: true, conjuntos: {} }) });
export const lerOverride = () => { const d = arq().ler(); return d && typeof d === 'object' && !Array.isArray(d) ? { ativo: true, conjuntos: {}, ...d } : { ativo: true, conjuntos: {} }; };

/** O conjunto com cada peça resolvida (ficha + sprite + problema) — lida do catálogo EFETIVO a cada chamada: editar o item reflete aqui. */
export function resolver(c) {
  const pecas = {};
  for (const slot of Con.SLOTS) {
    const id = c.pecas?.[slot];
    if (id == null) { pecas[slot] = null; continue; }
    const f = Con.fichaDoItem(id);
    pecas[slot] = f ? { ...f, desenho: desenhoDoItem(ITEM_CATALOG[id]), problema: f.slot !== slot ? `é do slot ${f.slot}` : (f.vocations.length && !f.vocations.includes(c.classe) ? `restrito a ${f.vocations.join('/')}` : null) } : { id: Number(id), inexistente: true, problema: 'o item não existe mais no catálogo' };
  }
  return { ...c, pecasResolvidas: pecas };
}

/** O que a tela precisa de uma vez. */
export function obter() {
  const ctx = Con.contextoDoJogo();
  const override = lerOverride();
  const mapa = Con.efetivo(Con.ORIGINAL, override); // o que está GRAVADO (o Hot Reload aplica em seguida): a tela nunca fica um passo atrás do arquivo
  return {
    original: Con.ORIGINAL, override, revisao: revisaoDe(CAMINHOS.arquivo), versoes: arq().versoes(),
    conjuntos: Object.values(mapa).map(resolver), painel: Con.painel(mapa, ctx), validacao: Con.validarTodos(mapa, ctx),
    classes: Con.CLASSES, slots: Con.SLOTS, rotulos: Con.ROTULO_DO_SLOT, regras: Con.ORIGINAL.regras, planejamento: Con.ORIGINAL.planejamento,
    atos: P.EM_USO.progressao.atos.map((a) => ({ ...a, tiers: P.tiersDoAtoCom(P.EM_USO.progressao.tier, a) })), nivelMaximo: P.nivelMaximo(), carga: { aplicado: Con.resultadoDaCarga.aplicado, erros: Con.resultadoDaCarga.erros },
  };
}

/** Remove do override o que é igual à fábrica (só a diferença). Pura. */
export function minimizar(original, ov) {
  const saida = {};
  for (const [id, c] of Object.entries(ov?.conjuntos ?? {})) {
    const base = original.conjuntos?.[id];
    if (c === null || c?.excluido === true) { if (base) saida[id] = { excluido: true }; continue; } // excluir algo que só existia no override = simplesmente não aparece
    if (!base) { saida[id] = c; continue; }
    const dif = {};
    for (const [k, v] of Object.entries(c)) {
      if (k === 'pecas') { const p = {}; for (const [s, id2] of Object.entries(v ?? {})) if ((base.pecas?.[s] ?? null) !== (id2 ?? null)) p[s] = id2 ?? null; if (Object.keys(p).length) dif.pecas = p; }
      else if (k !== 'id' && JSON.stringify(v) !== JSON.stringify(base[k])) dif[k] = v;
    }
    if (Object.keys(dif).length) saida[id] = dif;
  }
  return { ...ov, conjuntos: saida };
}

/** Valida e mostra o que MUDARIA (sem gravar). `ov` = o arquivo de override inteiro proposto. */
export function propor(ov) {
  if (!ov || typeof ov !== 'object' || Array.isArray(ov)) return { ok: false, erros: ['O override precisa ser um objeto.'], avisos: [] };
  const erros = [];
  for (const k of Object.keys(ov)) if (!['ativo', 'conjuntos', '_nota'].includes(k)) erros.push(`O campo "${k}" não existe (permitidos: ativo, conjuntos).`);
  if (ov.conjuntos != null && (typeof ov.conjuntos !== 'object' || Array.isArray(ov.conjuntos))) return { ok: false, erros: ['"conjuntos" precisa ser um objeto { id: conjunto }.'], avisos: [] };
  for (const [id, c] of Object.entries(ov.conjuntos ?? {})) if (c !== null && (typeof c !== 'object' || Array.isArray(c))) erros.push(`conjunto ${id}: precisa ser um objeto.`);
  // `origem` e `pecasResolvidas` são DERIVADOS pelo servidor (a tela os devolve junto): nunca fazem parte do que se grava.
  const limpos = Object.fromEntries(Object.entries(ov.conjuntos ?? {}).map(([id, c]) => [id, c && typeof c === 'object' && !Array.isArray(c) ? Object.fromEntries(Object.entries(c).filter(([k]) => !['origem', 'pecasResolvidas'].includes(k))) : c]));
  const minimo = minimizar(Con.ORIGINAL, { ...ov, conjuntos: limpos });
  const candidato = Con.efetivo(Con.ORIGINAL, { ...minimo, ativo: ov.ativo !== false });
  const ctx = Con.contextoDoJogo();
  const v = Con.validarTodos(candidato, ctx);
  const salvo = Con.efetivo(Con.ORIGINAL, lerOverride());
  const ids = new Set([...Object.keys(salvo), ...Object.keys(candidato)]);
  const impacto = [...ids].map((id) => (!salvo[id] ? { id, mudanca: 'novo' } : !candidato[id] ? { id, mudanca: 'removido' } : JSON.stringify(salvo[id]) !== JSON.stringify(candidato[id]) ? { id, mudanca: 'alterado' } : null)).filter(Boolean);
  return { ok: !erros.length && !v.erros.length, erros: [...erros, ...v.erros], avisos: v.avisos, override: minimo, conjuntos: v.erros.length ? null : Object.values(candidato).map(resolver), painel: Con.painel(candidato, ctx), impacto, comoPublicar: COMO_PUBLICAR };
}

export function salvar(ov, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const r = propor(ov);
  if (!r.ok) return { ok: false, erros: r.erros, avisos: r.avisos };
  arq().gravar({ _nota: 'Overrides de conjuntos (systems/conjuntos.mjs): só o NOVO ou DIFERENTE sobre gamedata/conjuntos.json. Editado em /editor/conteudo (Conjuntos).', ativo: ov.ativo !== false, conjuntos: r.override.conjuntos });
  return { ok: true, avisos: r.avisos, impacto: r.impacto, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}
/** Descarta TODAS as alterações locais (volta à fábrica). */
export function reverter(revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  if (!existsSync(CAMINHOS.arquivo)) return { ok: false, erros: ['Não há override para reverter.'] };
  arq().gravar({ _nota: 'Sem diferenças: valem os conjuntos da fábrica (gamedata/conjuntos.json).', ativo: true, conjuntos: {} });
  return { ok: true, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}
/** Restaura UM conjunto ao estado original (apaga a diferença dele; um conjunto novo é removido). */
export function reverterConjunto(id, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const atual = lerOverride();
  if (!(id in (atual.conjuntos ?? {}))) return { ok: false, erros: [`O conjunto "${id}" não tem alteração local.`] };
  const conjuntos = { ...atual.conjuntos }; delete conjuntos[id];
  arq().gravar({ ...atual, conjuntos });
  return { ok: true, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}
export function definirAtivo(ativo, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  arq().gravar({ ...lerOverride(), ativo: !!ativo });
  return { ok: true, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR };
}
export function restaurar(n, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const r = arq().restaurar(n);
  return r.ok ? { ...r, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR } : r;
}
export const versoes = () => arq().versoes();

/** A busca de itens para os slots: só equipamento; filtros por nome/ID, slot, classe (restrição do item), tier da base e level. */
export function buscarItens({ q = '', slot = '', classe = '', tier = '', nivelMin = '', nivelMax = '', limite = 60, incluirCraft = false } = {}) {
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norm(q).trim();
  const lim = Math.min(200, Math.max(1, Number(limite) || 60));
  const lista = [];
  for (const m of Object.values(ITEM_CATALOG)) {
    if (!m.slot || !Con.SLOTS.includes(m.slot) || m.stackable) continue;
    if (slot && m.slot !== slot) continue;
    if (!incluirCraft && /^Crafted /.test(m.name ?? '')) continue;
    if (classe && m.vocations?.length && !m.vocations.includes(classe)) continue;
    const nv = m.minLevel ?? 0;
    if (nivelMin !== '' && nv < Number(nivelMin)) continue;
    if (nivelMax !== '' && nv > Number(nivelMax)) continue;
    if (tier !== '' && P.tierDaBaseCom(P.EM_USO.progressao.tier, Math.max(1, nv)) !== Number(tier)) continue;
    if (t && !norm(m.name).includes(t) && String(m.id) !== t) continue;
    lista.push(m);
  }
  lista.sort((a, b) => (a.minLevel ?? 0) - (b.minLevel ?? 0) || String(a.name).localeCompare(String(b.name)));
  return { total: lista.length, itens: lista.slice(0, lim).map((m) => ({ ...Con.fichaDoItem(m.id), desenho: desenhoDoItem(m) })) };
}

/**
 * Os ATRIBUTOS TOTAIS de um conjunto, pela ficha REAL do jogo (`Ficha.combate`): um personagem de teste da classe, no `level` pedido, vestindo as peças (bases, sem raridade nem
 * atributos sorteados). Nenhuma fórmula de combate é reescrita aqui. `c`: o conjunto (salvo ou em edição). Devolve os números da ficha e avisos (peça acima do level, etc.).
 */
export function totais(c, { level = null } = {}) {
  const lv = Math.max(1, Math.floor(Number(level ?? c.levelRecomendado ?? c.levelMax) || 1));
  const equipment = {};
  const avisos = [];
  for (const slot of Con.SLOTS) {
    const id = c.pecas?.[slot];
    if (id == null) continue;
    const m = ITEM_CATALOG[id];
    if (!m || m.slot !== slot) { avisos.push(`${Con.ROTULO_DO_SLOT[slot]}: item ${id} ignorado (inexistente ou de outro slot).`); continue; }
    if ((m.minLevel ?? 0) > lv) avisos.push(`${Con.ROTULO_DO_SLOT[slot]}: "${m.name}" exige level ${m.minLevel} e o personagem de teste tem ${lv} (no jogo ele não poderia vestir).`);
    equipment[slot] = { id: Number(id), count: 1 };
  }
  if (Con.CLASSES.includes(c.classe) === false) return { ok: false, erros: [`Classe desconhecida: ${c.classe}`] };
  const estado = { level: lv, xp: 0, vocation: c.classe, hp: 1, maxHp: 1, mana: 1, maxMana: 1, equipment, inventory: [] };
  try { Afixos.sincronizarMaximos(estado); } catch { /* sem add nenhum: nada a sincronizar */ }
  Ficha.invalidar(estado);
  const f = Ficha.combate(estado);
  const n = (x) => (typeof x === 'number' ? Math.round(x * 1000) / 1000 : x);
  return {
    ok: true, level: lv, classe: c.classe, pecas: Object.keys(equipment).length, avisos,
    totais: { ataque: { min: n(f.ataqueMin), max: n(f.ataqueMax) }, defesaDoEscudo: n(f.defense), armadura: n(f.armor), evasao: n(f.evasion), energyShield: n(f.energyShield), bloqueio: n(f.blockChance), critico: n(f.critChance), multiplicadorCritico: n(f.critMultiplier), precisao: n(f.accuracy), vidaPorGolpe: n(f.lifeLeech), manaPorGolpe: n(f.manaLeech), velocidadeDeAtaque: n(f.velocidadeDeAtaque), intervaloDoGolpeMs: n(f.intervaloDoGolpeMs), alcance: n(f.attackRange) },
    atributos: f.atributos ?? null, fonte: 'Ficha.combate (a ficha real do jogo)',
  };
}
