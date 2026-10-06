// A ARENA DE EFEITOS da engine (dono, 06/10): o laboratório visual das skills. Aqui ficam o lado do servidor:
//   - `obter()`: o override de efeitos (`gamedata/overrides/efeitos.json`), o que o cliente recebe, as versões, as skills do catálogo
//     com o desenho de fábrica de cada uma (o efeito, o projétil, a forma);
//   - `salvar` / `restaurar`: grava com versão anterior e revisão (o mesmo fluxo dos outros editores: em produção a engine só lê);
//   - `enviarAsset`: um spritesheet novo (PNG) para a biblioteca de efeitos;
//   - `simular`: LANÇA a skill de verdade (o `Acoes.disparar` de uma caçada, com a gema, os suportes e o nível) em bonecos na direção e
//     distância pedidas, e devolve os EVENTOS do combate (os mesmos que o jogo manda ao cliente) — a arena desenha com eles.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as Efeitos from '../systems/efeitos-visuais.mjs';
import * as O from '../systems/overrides.mjs';
import { ACTION_CATALOG, CHARACTER_TEMPLATE } from '../systems/dados.mjs';
import * as R from '../systems/regras.mjs';
import * as Inventario from '../systems/inventario.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as Gemas from '../systems/skills/gemas.mjs';
import * as GemasPoe from '../systems/itens-poe/gemas-poe.mjs';
import * as SuportesPoe from '../systems/itens-poe/suportes-poe.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { criarArquivoVersionado, revisaoDe, conferirRevisao } from './arquivo-versionado.mjs';

export const CAMINHOS = { arquivo: Efeitos.ARQUIVO, versoes: join(O.PASTA, '_versoes', 'efeitos') };
const COMO_PUBLICAR = 'Gravado em gamedata/overrides/efeitos.json neste servidor (o jogo local já usa ao recarregar a página). Para valer na produção: commit e deploy (os PNGs novos ficam em gamedata/overrides/efeitos-assets/).';
const arq = () => criarArquivoVersionado({ caminhos: CAMINHOS, valorPadrao: () => ({ assets: {}, presets: {}, skills: {} }) });

/** As skills que a arena lista: as do catálogo que têm desenho de combate (efeito, projétil ou área) — a gema do PoE com o nome dela. */
function skills() {
  const lista = [];
  for (const e of [...ACTION_CATALOG.spells, ...(ACTION_CATALOG.runes ?? [])]) {
    if (!e.efeito && !e.projetil && !e.forma) continue;
    const poe = e.poeGema ? GemasPoe.doSlug(e.poeGema.slug) : null;
    lista.push({
      id: e.id, nome: e.name, elemento: e.element ?? null, poe: !!e.poeGema, slug: e.poeGema?.slug ?? null, statusNoJogo: poe?.statusNoJogo ?? null,
      // O desenho de FÁBRICA (o que o combate manda sem configuração): a referência do "Original" na comparação.
      fabrica: { efeito: e.efeito ?? null, projetil: e.projetil ?? null, area: e.forma ? e.forma.length : 0, cadeia: !!e.cadeia, alcance: e.range ?? 1 },
    });
  }
  return lista.sort((a, b) => Number(b.poe) - Number(a.poe) || a.nome.localeCompare(b.nome));
}

export function obter() {
  const override = arq().ler();
  return {
    override, revisao: revisaoDe(CAMINHOS.arquivo), versoes: arq().versoes(), cliente: Efeitos.paraOCliente(override),
    presetsDeFabrica: Efeitos.PRESETS_DE_FABRICA, partes: Efeitos.PARTES, nomeDasPartes: Efeitos.NOME_DA_PARTE, eventosDasPartes: Efeitos.EVENTO_DA_PARTE,
    categorias: Efeitos.CATEGORIAS, ancoras: Efeitos.ANCORAS, skills: skills(),
    suportes: [...SuportesPoe.REGISTRO.values()].filter((r) => r.status !== 'nao').map((r) => ({ slug: r.suporte.slug, nome: r.suporte.nome, tags: r.suporte.tags })),
    comoPublicar: COMO_PUBLICAR,
  };
}

export function salvar(ov, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const v = Efeitos.validar(ov, { skillsExistentes: new Set(skills().map((s) => s.id)) });
  if (!v.ok) return { ok: false, erros: v.erros, avisos: v.avisos };
  arq().gravar({ _nota: 'O VISUAL das skills (systems/efeitos-visuais.mjs): assets, presets e, por skill, o preset e o que muda por cima. Editado na engine (Ferramentas → Arena de Gemas → Arena de Efeitos). Não mexe no dano.', ...v.override });
  return { ok: true, avisos: v.avisos, revisao: revisaoDe(CAMINHOS.arquivo), cliente: Efeitos.paraOCliente(), comoPublicar: COMO_PUBLICAR };
}
export function restaurar(n, revisao) {
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  const r = arq().restaurar(n);
  return r.ok ? { ...r, revisao: revisaoDe(CAMINHOS.arquivo), comoPublicar: COMO_PUBLICAR } : r;
}
export const versoes = () => arq().versoes();

/** A PRÉVIA de um override ainda não gravado: validado e resolvido como o cliente recebe (a arena desenha o "Customizado" com isto). */
export function previa(ov) {
  const v = Efeitos.validar(ov ?? {});
  return { ok: v.ok, erros: v.erros, avisos: v.avisos, cliente: Efeitos.paraOCliente(v.override) };
}

/**
 * Um SPRITESHEET novo para a biblioteca: o PNG (base64) vai para `gamedata/overrides/efeitos-assets/<id>.png` e a definição (categoria,
 * colunas × linhas, fps, quadros, loop...) entra no override — gravado com versão, como o resto.
 */
export function enviarAsset({ id, png, definicao }, revisao) {
  if (!/^[\w-]{1,60}$/.test(String(id ?? ''))) return { ok: false, erros: ['id do asset: só letras, números, _ e - (até 60).'] };
  const bruto = String(png ?? '').replace(/^data:image\/png;base64,/, '');
  const dados = Buffer.from(bruto, 'base64');
  if (dados.length < 8 || dados.readUInt32BE(0) !== 0x89504e47) return { ok: false, erros: ['O arquivo precisa ser um PNG.'] };
  if (dados.length > 4 * 1024 * 1024) return { ok: false, erros: ['PNG maior que 4 MB.'] };
  const conflito = conferirRevisao(revisao, CAMINHOS.arquivo);
  if (conflito) return conflito;
  mkdirSync(Efeitos.PASTA_DOS_ASSETS, { recursive: true });
  const arquivo = `${id}.png`;
  writeFileSync(join(Efeitos.PASTA_DOS_ASSETS, arquivo), dados);
  const atual = arq().ler();
  return salvar({ ...atual, assets: { ...(atual.assets ?? {}), [id]: { ...(definicao ?? {}), arquivo } } }, revisaoDe(CAMINHOS.arquivo));
}

// ---------------------------------------------------------------- a simulação (o combate de verdade)

const DIRECOES = { n: [0, -1], ne: [1, -1], l: [1, 0], se: [1, 1], s: [0, 1], so: [-1, 1], o: [-1, 0], no: [-1, -1] };
const VIDA_DO_BONECO = 1e12;

function personagem(nivel) {
  const vocacao = 'sorcerer';
  const { maxHp, maxMana } = R.statsBase(vocacao, nivel);
  const tudo = { kills: {}, completas: Campanha.FASES.map((f) => f.huntId), bosses: [1, 2, 3, 4] };
  const e = {
    level: nivel, xp: R.expForLevel(nivel), vocation: vocacao, sex: 'male', outfit: { type: R.LOOK_DA_VOCACAO[vocacao].male, head: 78, body: 88, legs: 58, feet: 76, mount: 0, addons: 0 },
    hp: maxHp, maxHp, mana: maxMana, maxMana, gold: 0, bank: 0, coins: 0, stamina: 2520, maxStamina: 2520,
    equipment: Inventario.equipamentoInicial(vocacao), inventory: [], pos: { ...R.POSICAO_INICIAL }, actions: Array(Acoes.SLOTS).fill(null),
    hotkeys: [...CHARACTER_TEMPLATE.hotkeys], actionPresets: [], settings: { ...CHARACTER_TEMPLATE.settings },
    campanha: Object.fromEntries(Campanha.DIFICULDADES.map((d) => [d, structuredClone(tudo)])),
  };
  Afixos.sincronizarMaximos(e);
  return e;
}

/**
 * Lança `skill` (com a gema no `nivel` e os `suportes` do PoE ligados) em `alvos` bonecos: o principal na `direcao` (n, ne, l, se, s,
 * so, o, no) a `distancia` casas, os outros em volta dele. Devolve `{ ok, eventos, pos, alvos, conjuracaoMs, ataque }` — os eventos do
 * combate como o cliente recebe (com `sk`), e os de uma conjuração já concluída.
 */
export function simular({ skill, nivel = 10, suportes = [], alvos = 1, distancia = 4, direcao = 'l' } = {}) {
  const entry = ACTION_CATALOG.spells.find((x) => x.id === skill) ?? ACTION_CATALOG.runes?.find((x) => x.id === skill);
  if (!entry) return { ok: false, erros: ['Skill desconhecida.'] };
  const itemDaSkill = Gemas.ITEM_DA_ACAO.get(entry.id);
  if (!itemDaSkill) return { ok: false, erros: ['Esta skill não vem de gema (não dá para lançar na arena).'] };
  const e = personagem(70);
  // A gema e os suportes numa peça com sockets ligados (a arma do personagem novo; sem sockets, um molde).
  const ids = [itemDaSkill, ...suportes.map((s) => SuportesPoe.doSlug(s)?.itemId).filter(Boolean)].slice(0, 6);
  const arma = e.equipment.weapon ?? { id: 3074, count: 1 };
  e.equipment.weapon = { ...arma, soquetes: { abertos: ids.length, links: Array(Math.max(0, ids.length - 1)).fill(true), gemas: ids.map((id) => ({ ...Gemas.novaGema(id), nivel: Math.max(1, Math.min(40, Number(nivel) || 1)) })) } };
  Ficha.invalidar(e);
  Afixos.sincronizarMaximos(e);
  e.mana = e.maxMana = 1e9;
  e.hp = e.maxHp = 1e9;
  const slot = Acoes.PAPEL_DO_SLOT.indexOf(entry.papeis?.[0] === 'attack' ? 'attack' : entry.papeis?.[0] ?? 'attack');
  e.actions[slot < 0 ? 0 : slot] = { id: entry.id, enabled: true, minMana: 0, minTargets: 1, conditions: [] };
  const usado = slot < 0 ? 0 : slot;
  let entrou = null;
  for (const huntId of ['poe-a1-the-coast', 'troll-cave']) {
    entrou = Cacadas.entrar(e, { huntId, mode: 'auto' });
    if (entrou?.ok) break;
  }
  if (!entrou?.ok) return { ok: false, erros: [`Não consegui abrir uma caçada para o teste: ${entrou?.erro ?? '?'}`] };
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  // Os BONECOS: o principal na direção/distância; os outros em volta dele (um anel).
  const [dx, dy] = DIRECOES[direcao] ?? DIRECOES.l;
  // Não passa do alcance da skill (senão o combate recusa "fora de alcance"); a resposta diz a distância usada.
  const d = Math.max(1, Math.min(8, entry.range > 1 ? entry.range : 1, Number(distancia) || 4));
  const centro = { x: h.pos.x + dx * d, y: h.pos.y + dy * d };
  const volta = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [0, 2]];
  const n = Math.max(1, Math.min(10, Number(alvos) || 1));
  h.monstros = [];
  for (let i = 0; i < n; i++) {
    const [ox, oy] = i === 0 ? [0, 0] : volta[i - 1];
    h.monstros.push(Object.assign(criarMonstro({ key: 'troll', x: centro.x + ox, y: centro.y + oy }, null), { hp: VIDA_DO_BONECO, maxHp: VIDA_DO_BONECO }));
  }
  h.cooldowns = {};
  delete h.ultimoAtaqueEm;
  delete h.conjurando;
  const quem = { id: 0, nome: 'Arena' };
  const alvo = h.monstros[0];
  let r = Acoes.disparar(e, h, quem, usado, alvo);
  const eventos = [...(r.eventos ?? [])];
  let conjuracaoMs = 0;
  if (r.ok && r.conjurando) {
    conjuracaoMs = (h.conjurando?.fim ?? 0) - (h.conjurando?.inicio ?? 0);
    h.clock = h.conjurando.fim;
    // A conclusão devolve a lista de eventos (`castFim` + os da skill, ou `castCancel`).
    const fim = Acoes.concluirConjuracao(e, h, quem) ?? [];
    eventos.push(...fim);
    const cancelou = fim.find((x) => x.t === 'castCancel');
    r = cancelou ? { ok: false, erro: `a conjuração foi cancelada: ${cancelou.motivo}` } : { ok: true };
  }
  if (!r.ok) return { ok: false, erros: [r.erro ?? 'A skill não saiu.'] };
  return {
    ok: true, eventos, conjuracaoMs, pos: { x: h.pos.x, y: h.pos.y }, distancia: d, alcance: entry.range ?? 1,
    alvos: h.monstros.map((m) => ({ uid: m.uid, x: m.x, y: m.y, look: m.look, colors: m.colors ?? null, nome: m.name })),
    jogador: { look: e.outfit.type, colors: { head: e.outfit.head, body: e.outfit.body, legs: e.outfit.legs, feet: e.outfit.feet } },
    visual: Efeitos.visualDaSkill(entry.id), skill: { id: entry.id, nome: entry.name },
  };
}
