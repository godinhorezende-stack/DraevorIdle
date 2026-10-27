// O PERSONAGEM DE TESTE (dono, 27/10: "coloque meu char ADM GODINES no lv máximo, mas não entra no ranking e ele não pode morrer — chega
// a 0 de vida e não morre, mas toma dano para testar as coisas, e tudo liberado: todos os atos completados e mapas, uns 5 de cada, no baú").
//
//   node game/admin/personagem-de-teste.mjs --nome "ADM GODINES"                 # só MOSTRA o que mudaria (antes e depois)
//   node game/admin/personagem-de-teste.mjs --nome "ADM GODINES" --gravar        # grava (com backup do estado antigo antes)
//   node game/admin/personagem-de-teste.mjs --restaurar <backup.json>            # mostra a volta ao backup
//   node game/admin/personagem-de-teste.mjs --restaurar <backup.json> --gravar   # volta ao backup (e guarda o de agora antes)
// Opções: --backup-dir <pasta> (padrão: game/database/dados/backups — no container, o volume do banco) e --todas-as-moedas (as 195 moedas
// do PoE; sem ela, só as 71 que fazem algo no jogo — as que a Forja usa).
//
// O QUE FAZ, só no personagem com o nome EXATO (sem achar, sai com erro):
//   - a marca `testador: true` (`systems/personagem/testador.mjs`): ele não morre (a vida para em 1 em vez de zerar, o dano continua
//     chegando) e fica fora de todo ranking. Nenhuma outra vantagem vem da marca;
//   - o nível máximo do PoE (100), com a experiência do nível e a vida/mana máximas refeitas (e cheias);
//   - a campanha inteira concluída: todas as fases de todos os atos no Normal (a única dificuldade do PoE) e os 10 chefes de ato. As missões
//     de gema que terminam nessas fases ficam com a gema PENDENTE para escolher (como se tivesse jogado); os prêmios de primeira vez dos atos
//     ficam marcados como pagos (não pagam depois). Os pontos de passiva são os do nível 100 e os 8 de ascendência (2 por chefe de ato, até
//     8) — o jogo os conta sozinho pelo nível e pelos chefes; não há ponto de passiva por missão neste jogo;
//   - o Atlas: o Dispositivo de Mapas abre com o chefe do Ato 10 (não há outra trava de tier no jogo) e o baú recebe o que falta para ter 5
//     de cada mapa (T1 a T16, Normais) — contando mochila, bolsa e baú;
//   - o que falta para 50 de cada moeda do PoE (mochila, bolsa e baú somados) e, no mínimo, OURO_ALVO de ouro e COINS_ALVO coins.
// IDEMPOTENTE: só põe o que falta; a segunda vez não muda nada (e não grava). `testadorPreparado` guarda a data da primeira preparação.
//
// ONLINE: o servidor guarda o personagem online NA MEMÓRIA e grava por cima a cada 30 s (o autosave, `websocket/sessao.mjs`) e ao sair —
// gravar aqui com ele online seria desfeito. O banco NÃO diz quem está online. O que dá para ler, e a ferramenta recusa se for de menos de
// JANELA_ONLINE_MS: (1) `visto_em` do personagem — o autosave o atualiza, mas ENTRAR no jogo não (o primeiro autosave vem até 30 s
// depois); (2) o login da CONTA — a tabela `sessoes` guarda, por login com senha, a hora em que o token foi criado (`criada`; voltar com
// o token salvo não cria outro). Nenhum dos dois pega todo caso (ex.: entrou pelo token salvo há menos de 30 s), por isso: DESLOGUE o
// personagem e espere 2 MINUTOS antes de --gravar (o aviso sai no topo da saída). A gravação é condicional (só se o estado no banco ainda é o lido): se a caçada offline gravou no meio, nada é gravado e é só
// rodar de novo.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { banco, regravarSeNaoMudou } from '../database/banco.mjs';
import { iniciarJogoDoPoe } from '../systems/itens-poe/iniciar.mjs';
import { ligado as itensPoeLigado } from '../systems/itens-poe/catalogo.mjs';
import * as R from '../systems/regras.mjs';
import { refazerMaximos } from '../systems/hunt/combate.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as MissoesDeGemas from '../systems/itens-poe/missoes-de-gemas.mjs';
import * as Passivas from '../systems/passivas/arvore.mjs';
import * as Dispositivo from '../systems/mapas-dispositivo.mjs';
import * as Mapas from '../systems/itens-poe/mapas.mjs';
import * as ItensPoeJogo from '../systems/itens-poe/jogo.mjs';
import * as MoedasPoe from '../systems/itens-poe/moedas.mjs';
import * as Deposito from '../systems/deposito.mjs';
import { pilhaMaxima } from '../systems/itens/pilha.mjs';
import * as Legado from '../systems/personagem/legado.mjs';
import { ehTestador } from '../systems/personagem/testador.mjs';

export const MAPAS_POR_TIER = 5;
export const MOEDAS_DE_CADA = 50;
export const OURO_ALVO = 100_000_000;
export const COINS_ALVO = 100_000;
export const JANELA_ONLINE_MS = 120_000;
export const PASTA_DE_BACKUP = fileURLToPath(new URL('../database/dados/backups/', import.meta.url));

// ---------------------------------------------------------------- o que tem

const caixasDoBau = (estado) => (estado.deposito ?? []).filter((c) => c && !c.compartilhada && Array.isArray(c.itens));
/** Todas as peças que o personagem carrega ou guarda: mochila, bolsa e as caixas do baú dele (o da conta fica de fora). */
const todasAsPecas = (estado) => [...(estado.inventory ?? []), ...(estado.pouch ?? []), ...caixasDoBau(estado).flatMap((c) => c.itens)].filter(Boolean);
const quantasDoItem = (estado, id) => todasAsPecas(estado).filter((p) => Number(p.id) === Number(id)).reduce((t, p) => t + (p.count ?? 1), 0);
/** `{ tier: n }` dos mapas que ele tem (qualquer raridade). */
function mapasPorTier(estado) {
  const n = {};
  for (const p of todasAsPecas(estado)) {
    if (!Mapas.ehMapa(p)) continue;
    const t = Mapas.tierDaPeca(p);
    if (t) n[t] = (n[t] ?? 0) + 1;
  }
  return n;
}
/** As moedas que entram: as que fazem algo no jogo (funciona/parcial) ou, com `todas`, as 195. */
export const moedasAlvo = ({ todas = false } = {}) => MoedasPoe.MOEDAS.filter((m) => todas || MoedasPoe.STATUS[m.slug]?.status !== 'nao');

/** O resumo para a tela (sem mexer no estado: tudo numa cópia). */
export function resumo(estadoOriginal, { todas = false } = {}) {
  const estado = structuredClone(estadoOriginal);
  const dif = Campanha.dificuldadesDoJogo();
  const fases = Campanha.FASES.filter((f) => !f.pular);
  const atos = atosDaCampanha();
  const completas = dif.reduce((n, d) => n + fases.filter((f) => Campanha.faseCompleta(estado, d, f.huntId)).length, 0);
  const chefes = dif.flatMap((d) => atos.filter((a) => Campanha.bossVencido(estado, d, a)));
  const pontos = Passivas.pontos(estado);
  const asc = Passivas.pontosDeAscendencia(estado);
  const porTier = mapasPorTier(estado);
  const moedas = moedasAlvo({ todas });
  return {
    testador: ehTestador(estado),
    level: estado.level ?? 1,
    xp: estado.xp ?? 0,
    maxHp: estado.maxHp ?? 0,
    maxMana: estado.maxMana ?? 0,
    fases: `${completas}/${fases.length * dif.length}`,
    chefes: `${[...new Set(chefes)].sort((a, b) => a - b).join(',') || '-'} (${new Set(chefes).size}/${atos.length})`,
    passivas: `${pontos.total} pontos (${pontos.usados} usados, ${pontos.livres} livres)`,
    ascendencia: `${asc.total} pontos (${asc.usados} usados)`,
    atlas: Dispositivo.liberado(estado) ? 'Dispositivo de Mapas aberto' : 'fechado',
    mapas: `${Mapas.TIERS.filter((t) => (porTier[t.tier] ?? 0) >= MAPAS_POR_TIER).length}/${Mapas.TIERS.length} tiers com ${MAPAS_POR_TIER}+ (${Object.values(porTier).reduce((a, b) => a + b, 0)} mapas)`,
    moedas: `${moedas.filter((m) => quantasDoItem(estado, m.itemId) >= MOEDAS_DE_CADA).length}/${moedas.length} moedas com ${MOEDAS_DE_CADA}+`,
    gold: estado.gold ?? 0,
    coins: estado.coins ?? 0,
  };
}

/** Os atos da campanha (os do runtime — no PoE, os 10 — ou os da campanha legada). */
function atosDaCampanha() {
  const doEditor = [...Campanha.ATOS_DO_EDITOR.keys()].map(Number);
  const legados = [...new Set(Campanha.FASES.map((f) => Number(f.ato)))];
  return [...new Set([...doEditor, ...legados])].filter((a) => Campanha.bossDoAto(a)).sort((a, b) => a - b);
}

// ---------------------------------------------------------------- pôr no baú

/** Põe a peça numa caixa numerada com vaga (a de `afinidade` primeiro, depois as sem afinidade, depois as outras); sem vaga, as Chegadas. */
function porNoBau(estado, peca, afinidade = null) {
  const caixas = Deposito.garantir(estado).filter((c) => !c.chegadas && !c.compartilhada);
  const ordem = [...caixas.filter((c) => afinidade && c.afinidade === afinidade), ...caixas.filter((c) => !c.afinidade), ...caixas.filter((c) => c.afinidade && c.afinidade !== afinidade)];
  for (const c of ordem) {
    if (c.itens.length >= (c.teto ?? 100)) continue;
    c.itens.push(peca);
    c.tipos = c.itens.length;
    return `${c.nome}`;
  }
  Deposito.porNasChegadas(estado, peca);
  return 'Chegadas';
}

/** Soma `n` da moeda no baú: completa as pilhas que já estão nele e o resto vai em pilhas novas. */
function porMoedaNoBau(estado, id, n) {
  const max = pilhaMaxima(id);
  let falta = n;
  for (const c of caixasDoBau(estado)) {
    if (c.chegadas) continue;
    for (const p of c.itens) {
      if (falta <= 0 || Number(p.id) !== Number(id) || p.poe || p.carga) continue;
      const cabe = Math.min(max - (p.count ?? 1), falta);
      if (cabe > 0) {
        p.count = (p.count ?? 1) + cabe;
        falta -= cabe;
      }
    }
  }
  for (; falta > 0; falta -= max) porNoBau(estado, { id, count: Math.min(max, falta) }, 'currency');
}

// ---------------------------------------------------------------- a preparação

/**
 * Prepara o estado (muda `estado`). Devolve o que fez: `{ mudou, feito: [linhas] }`. Idempotente: no estado já preparado, nada muda.
 * `agora`: a data da primeira preparação (`testadorPreparado`).
 */
export function preparar(estado, { todas = false, agora = Date.now() } = {}) {
  const antes = JSON.stringify(estado);
  const feito = [];
  if (!ehTestador(estado)) {
    estado.testador = true;
    feito.push('marca de personagem de teste (não morre; fora do ranking)');
  }
  // O nível máximo.
  const max = R.levelMaximo();
  if (Number.isFinite(max) && (estado.level ?? 1) < max) {
    estado.xp = Math.max(estado.xp ?? 0, R.expForLevel(max));
    refazerMaximos(estado, max);
    estado.hp = estado.maxHp;
    estado.mana = estado.maxMana;
    feito.push(`nível ${max}`);
  }
  // A campanha inteira, como se tivesse jogado: as fases, os chefes, as missões de gema (a gema pendente para escolher) e os prêmios de
  // primeira vez marcados como pagos.
  const atos = atosDaCampanha();
  for (const dif of Campanha.dificuldadesDoJogo()) {
    let fases = 0;
    let chefes = 0;
    for (const f of Campanha.FASES) {
      if (f.pular) continue;
      if (!Campanha.faseCompleta(estado, dif, f.huntId)) {
        estado.campanha[dif].completas.push(f.huntId);
        MissoesDeGemas.aoCompletarFase(estado, f.huntId);
        fases++;
      }
      const p = estado.campanha[dif];
      if (!(p.limpezas[f.huntId] > 0)) p.limpezas[f.huntId] = 1;
      Campanha.reivindicarPremio(estado, dif, `fase:${f.huntId}`);
    }
    for (const ato of atos) {
      if (!Campanha.bossVencido(estado, dif, ato)) {
        estado.campanha[dif].bosses.push(Number(ato));
        MissoesDeGemas.aoVencerBoss(estado, ato);
        chefes++;
      }
      Campanha.reivindicarPremio(estado, dif, `boss:${ato}`);
    }
    if (fases || chefes) feito.push(`campanha (${Campanha.CAMPANHA.dificuldades[dif]?.nome ?? dif}): +${fases} fases, +${chefes} chefes de ato`);
  }
  // Os mapas: o que falta para MAPAS_POR_TIER de cada tier, Normais, no baú.
  const temMapas = mapasPorTier(estado);
  let mapas = 0;
  for (const { tier } of Mapas.TIERS) {
    for (let i = temMapas[tier] ?? 0; i < MAPAS_POR_TIER; i++) {
      const peca = ItensPoeJogo.mapaSorteado(tier, { raridade: 'normal', rng: () => 0.5 });
      if (!peca) break;
      porNoBau(estado, peca);
      mapas++;
    }
  }
  if (mapas) feito.push(`+${mapas} mapas no baú`);
  // As moedas: o que falta para MOEDAS_DE_CADA de cada.
  let moedas = 0;
  let tipos = 0;
  for (const m of moedasAlvo({ todas })) {
    const falta = MOEDAS_DE_CADA - quantasDoItem(estado, m.itemId);
    if (falta <= 0) continue;
    porMoedaNoBau(estado, m.itemId, falta);
    moedas += falta;
    tipos++;
  }
  if (moedas) feito.push(`+${moedas} moedas do PoE (${tipos} tipos) no baú`);
  if ((estado.gold ?? 0) < OURO_ALVO) {
    feito.push(`ouro ${(estado.gold ?? 0).toLocaleString('pt-BR')} → ${OURO_ALVO.toLocaleString('pt-BR')}`);
    estado.gold = OURO_ALVO;
  }
  if ((estado.coins ?? 0) < COINS_ALVO) {
    feito.push(`coins ${(estado.coins ?? 0).toLocaleString('pt-BR')} → ${COINS_ALVO.toLocaleString('pt-BR')}`);
    estado.coins = COINS_ALVO;
  }
  const mudou = JSON.stringify(estado) !== antes;
  if (mudou && !estado.testadorPreparado) estado.testadorPreparado = { em: new Date(agora).toISOString() };
  return { mudou: JSON.stringify(estado) !== antes, feito };
}

// ---------------------------------------------------------------- o banco

const linhaPorNome = (nome) => banco.prepare('SELECT id, conta, nome, visto_em, estado FROM personagens WHERE nome = ?').get(nome);
const linhaPorId = (id) => banco.prepare('SELECT id, conta, nome, visto_em, estado FROM personagens WHERE id = ?').get(id);

/** O último login com senha da conta do personagem (`sessoes.criada`), ou 0. */
async function loginDaConta(linha) {
  if (!linha?.conta) return 0;
  const r = await banco.prepare('SELECT MAX(criada) AS criada FROM sessoes WHERE conta = ?').get(linha.conta);
  return Number(r?.criada) || 0;
}

/** O aviso do topo da saída: a detecção de online não é completa. */
export const AVISO_ONLINE = 'ATENÇÃO: DESLOGUE o personagem e espere 2 MINUTOS antes de --gravar. O banco não diz quem está online (só a última gravação do autosave e o último login da conta); com ele online, o autosave do servidor desfaz o que for gravado aqui.';

/** Por que não dá para gravar agora (online ou acabou de sair), ou null. `loginEm`: o último login da conta (`sessoes.criada`). */
export function motivoOnline(linha, agora = Date.now(), { loginEm = 0 } = {}) {
  const visto = Number(linha?.visto_em) || 0;
  const espera = (desde) => Math.ceil((JANELA_ONLINE_MS - (agora - desde)) / 1000);
  if (visto && agora - visto < JANELA_ONLINE_MS) {
    const s = Math.round((agora - visto) / 1000);
    return `${linha.nome} foi gravado pelo servidor há ${s} s: parece ONLINE (ou acabou de sair). Deslogue o personagem e rode de novo daqui a ${espera(visto)} s — senão o autosave da sessão desfaz o que for gravado aqui.`;
  }
  const login = Number(loginEm) || 0;
  if (login && agora - login < JANELA_ONLINE_MS) {
    const s = Math.round((agora - login) / 1000);
    return `a conta de ${linha.nome} fez login há ${s} s: o personagem pode estar ONLINE (entrar no jogo só é gravado no primeiro autosave). Deslogue e rode de novo daqui a ${espera(login)} s.`;
  }
  return null;
}

function salvarBackup(linha, pasta, agora) {
  mkdirSync(pasta, { recursive: true });
  const seguro = String(linha.nome).replace(/[^A-Za-z0-9_-]+/g, '_');
  const arquivo = join(pasta, `personagem-de-teste-${seguro}-${new Date(agora).toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(arquivo, `${JSON.stringify({ id: linha.id, conta: linha.conta, nome: linha.nome, salvoEm: new Date(agora).toISOString(), estado: JSON.parse(linha.estado) }, null, 1)}\n`);
  return arquivo;
}

const LINHAS = [
  ['testador', 'personagem de teste'], ['level', 'nível'], ['xp', 'experiência'], ['maxHp', 'vida máxima'], ['maxMana', 'mana máxima'],
  ['fases', 'fases da campanha'], ['chefes', 'chefes de ato'], ['passivas', 'passivas'], ['ascendencia', 'ascendência'], ['atlas', 'Atlas'],
  ['mapas', 'mapas'], ['moedas', 'moedas do PoE'], ['gold', 'ouro'], ['coins', 'coins'],
];
const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('pt-BR') : typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v));
export const tabela = (a, d) => LINHAS.map(([k, nome]) => `  ${nome.padEnd(20)} ${fmt(a[k]).padEnd(46)} → ${fmt(d[k])}`).join('\n');

/**
 * Prepara (ou mostra) o personagem `nome`. `{ ok, erro?, linhas: [texto], gravou, backup }` — nunca lança por erro de uso.
 */
export async function executar({ nome, gravar = false, todas = false, pastaDeBackup = PASTA_DE_BACKUP, agora = Date.now() } = {}) {
  if (!itensPoeLigado()) return { ok: false, erro: 'o jogo do PoE não está ligado neste processo (ITENS_POE / DRAEVOR_CLASSICO)' };
  if (!nome) return { ok: false, erro: 'falta --nome "Nome Exato"' };
  await iniciarJogoDoPoe();
  const linha = await linhaPorNome(nome);
  if (!linha || linha.nome !== nome) return { ok: false, erro: `personagem "${nome}" não encontrado (o nome tem de ser exato${linha ? `; achei "${linha.nome}"` : ''})` };
  const estado = JSON.parse(linha.estado);
  if (Legado.arquivado(estado)) return { ok: false, erro: `${linha.nome} é do Draevor clássico (arquivado): não entra no jogo do PoE` };
  const a = resumo(estado, { todas });
  const r = preparar(estado, { todas, agora });
  const d = resumo(estado, { todas });
  const linhas = [AVISO_ONLINE, '', `${linha.nome} (id ${linha.id})`, tabela(a, d), '', r.feito.length ? `Muda: ${r.feito.join('; ')}.` : 'Nada a mudar: o personagem já está preparado.'];
  if (!r.mudou) return { ok: true, linhas, gravou: false, mudou: false };
  if (!gravar) return { ok: true, linhas: [...linhas, '(nada foi gravado — rode com --gravar para gravar)'], gravou: false, mudou: true };
  const online = motivoOnline(linha, agora, { loginEm: await loginDaConta(linha) });
  if (online) return { ok: false, erro: online, linhas };
  const backup = salvarBackup(linha, pastaDeBackup, agora);
  const gravou = await regravarSeNaoMudou(linha.id, estado, linha.estado);
  if (!gravou) return { ok: false, erro: `o estado de ${linha.nome} mudou no banco enquanto eu preparava (a caçada offline?): nada foi gravado — rode de novo`, linhas, backup };
  return { ok: true, linhas: [...linhas, `Gravado. Backup do estado antigo: ${backup}`, `Para voltar: node game/admin/personagem-de-teste.mjs --restaurar "${backup}" --gravar`], gravou: true, mudou: true, backup };
}

/** Volta o personagem do backup (`arquivo`). Com `gravar`, guarda o estado de agora num backup novo antes. */
export async function restaurar({ arquivo, gravar = false, pastaDeBackup = PASTA_DE_BACKUP, agora = Date.now() } = {}) {
  let b;
  try {
    b = JSON.parse(readFileSync(arquivo, 'utf8'));
  } catch (e) {
    return { ok: false, erro: `não consegui ler o backup ${arquivo}: ${e.message}` };
  }
  if (!b?.id || !b?.nome || !b?.estado) return { ok: false, erro: `${arquivo} não é um backup desta ferramenta` };
  await iniciarJogoDoPoe();
  const linha = await linhaPorId(b.id);
  if (!linha || linha.nome !== b.nome) return { ok: false, erro: `o personagem do backup (${b.nome}, id ${b.id}) não existe mais com esse nome` };
  const a = resumo(JSON.parse(linha.estado));
  const d = resumo(b.estado);
  const linhas = [AVISO_ONLINE, '', `${linha.nome} (id ${linha.id}) — volta ao backup de ${b.salvoEm}`, tabela(a, d)];
  if (!gravar) return { ok: true, linhas: [...linhas, '(nada foi gravado — rode com --gravar para voltar)'], gravou: false };
  const online = motivoOnline(linha, agora, { loginEm: await loginDaConta(linha) });
  if (online) return { ok: false, erro: online, linhas };
  const backup = salvarBackup(linha, pastaDeBackup, agora);
  const gravou = await regravarSeNaoMudou(linha.id, b.estado, linha.estado);
  if (!gravou) return { ok: false, erro: 'o estado mudou no banco enquanto eu lia: nada foi gravado — rode de novo', linhas, backup };
  return { ok: true, linhas: [...linhas, `Restaurado. O estado de antes da volta ficou em: ${backup}`], gravou: true, backup };
}

// ---------------------------------------------------------------- a linha de comando

const arg = (nome) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const gravar = process.argv.includes('--gravar');
  const pastaDeBackup = arg('backup-dir') ?? PASTA_DE_BACKUP;
  const arquivo = arg('restaurar');
  let r;
  try {
    r = arquivo
      ? await restaurar({ arquivo, gravar, pastaDeBackup })
      : await executar({ nome: arg('nome'), gravar, todas: process.argv.includes('--todas-as-moedas'), pastaDeBackup });
  } catch (e) {
    r = { ok: false, erro: e.stack ?? e.message };
  }
  for (const l of r.linhas ?? []) console.log(l);
  if (!r.ok) console.error(`\nERRO: ${r.erro}`);
  await banco.fechar?.().catch(() => {});
  process.exit(r.ok ? 0 : 1);
}
