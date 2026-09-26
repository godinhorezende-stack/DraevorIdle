// Tarefas: as tasks de bicho, as tasks de montaria e a Loja de Task Token — a
// regra que o cliente (panels.mjs `renderTasksDeBicho`, `cardDeTaskDeMontaria`,
// `openLojaDeTaskToken`) diz morar no servidor.
//
// Do original (Zoros, 2026-09-26, `api-mapeada/captura-tarefas-0926/`; as
// definições fixas em `gamedata/tarefas.json`, gerado por tools/gerar-tarefas.mjs):
// - Task de bicho conta SOZINHA e desde sempre: as mortes são as do bestiary
//   (316 das 322 do Zoros batem com ele), menos o que morreu com a task PARADA
//   (o troll dele: 6.108 na task, 6.279 no bestiary).
// - Escada: 2.000 / 10.000 / 25.000 / 50.000 / 100.000 mortes pagam 1 / 4 / 7 /
//   11 / 20 Task Token; boss, 1 a cada 10 até 100. `etapa` = etapas já pagas,
//   `aResgatar` = fechadas e não pagas (Rearguard do Zoros: 34.184 → 3, 12
//   tokens), `progresso` = o caminho entre o degrau fechado e o próximo.
// - Pegar o prêmio PARA a task ("Aceitar" recomeça); com o passe Auto Task, o
//   token cai sozinho na mochila e a task segue contando.
// - Task de montaria: as mortes do bestiary (medusa 1.281 = 1.281); fechando,
//   a montaria é do personagem e paga os Task Token dela.
// - Loja de Task Token: `{token: 55729, saldo, ofertas: []}` — sem ofertas no
//   original (as duas capturas).
import { readFileSync } from 'node:fs';
import { MONTARIAS_REAIS } from './dados.mjs';
import { darItem, contarGuardadas } from './inventario.mjs';

const DADOS = JSON.parse(readFileSync(new URL('../gamedata/tarefas.json', import.meta.url), 'utf8'));
export const TASK_TOKEN = 55729;
const POR_CHAVE = new Map(DADOS.bichos.map((b) => [b.key, b]));

function garantir(estado) {
  estado.tarefas ??= { etapa: {}, pausada: {}, perdidas: {}, montarias: [] };
  return estado.tarefas;
}

/** O passe Auto Task (Ravox Store, `loja.mjs`): `{ativo, ate}`, como a ficha do original. */
export function autoTask(estado, agora = Date.now()) {
  const p = estado.autoTask;
  const ativo = !!(p?.passe && p.passeAte > agora);
  return { ativo, ate: ativo ? p.passeAte : 0 };
}

const mortesDoBestiary = (estado, key) => estado.bestiary?.[key] ?? 0;

/** Uma task de bicho no formato da ficha do original. */
function linha(estado, def) {
  const t = estado.tarefas ?? {};
  const escada = def.boss ? DADOS.escadaDeBoss : DADOS.escada;
  const mortes = Math.max(0, mortesDoBestiary(estado, def.key) - (t.perdidas?.[def.key] ?? 0));
  const etapa = t.etapa?.[def.key] ?? 0;
  let fechadas = 0;
  while (fechadas < escada.length && mortes >= escada[fechadas].mortes) fechadas++;
  const aResgatar = Math.max(0, fechadas - etapa);
  const tokens = escada.slice(etapa, fechadas).reduce((s, d) => s + d.tokens, 0);
  const completa = etapa >= escada.length;
  const proximo = escada[Math.min(fechadas, escada.length - 1)];
  const anterior = fechadas > 0 && fechadas < escada.length ? escada[fechadas - 1].mortes : 0;
  const progresso = fechadas >= escada.length ? 1 : Math.round(((mortes - anterior) / (proximo.mortes - anterior)) * 100) / 100;
  return {
    key: def.key,
    level: def.level,
    ...(def.boss ? { boss: true } : {}),
    ...(def.semSala ? { semSala: true } : {}),
    ...(t.pausada?.[def.key] ? { pausada: true } : {}),
    mortes,
    etapa,
    aResgatar,
    tokens,
    completa,
    progresso,
    alvo: proximo.mortes,
    premio: proximo.tokens,
  };
}

/** `{t:'tasksDeBicho'}` — a ficha inteira. */
export function ficha(estado) {
  return {
    escada: DADOS.escada,
    escadaDeBoss: DADOS.escadaDeBoss,
    autoTask: autoTask(estado),
    teto: DADOS.teto,
    faixas: DADOS.faixas,
    bichos: DADOS.bichos.map((def) => linha(estado, def)),
  };
}

/** Paga as etapas fechadas de uma task (Task Token na mochila). Devolve quantos. */
function pagar(estado, def) {
  const l = linha(estado, def);
  if (!l.aResgatar) return 0;
  const t = garantir(estado);
  t.etapa[def.key] = l.etapa + l.aResgatar;
  darItem(estado, TASK_TOKEN, l.tokens);
  return l.tokens;
}

/** `{t:'tasksDeBicho', action:'resgatar'|'aceitar', key}`. */
export function comando(estado, m) {
  if (!m.action) return { ok: true };
  const def = POR_CHAVE.get(m.key);
  if (!def) return { ok: false, erro: 'Task desconhecida.' };
  const t = garantir(estado);
  if (m.action === 'resgatar') {
    const pagos = pagar(estado, def);
    if (!pagos) return { ok: false, erro: 'Nada para pegar nesta task ainda.' };
    // Sem o passe, a task PARA até ser aceita de novo.
    if (!autoTask(estado).ativo && !linha(estado, def).completa) t.pausada[def.key] = true;
    return { ok: true, notice: `+${pagos} Task Token.` };
  }
  if (m.action === 'aceitar') {
    if (!t.pausada[def.key]) return { ok: false, erro: 'Esta task já está contando.' };
    delete t.pausada[def.key];
    return { ok: true };
  }
  return { ok: false, erro: 'Ação de task desconhecida.' };
}

/**
 * Uma morte (chamado DEPOIS de o bestiary contar): task parada não conta — a
 * morte vai para `perdidas`. Com o Auto Task, a etapa que fecha é paga na hora.
 * E as tasks de montaria que a criatura fecha.
 */
export function contarMorte(estado, key) {
  const def = POR_CHAVE.get(key);
  if (def) {
    const t = garantir(estado);
    if (t.pausada[key]) {
      if (autoTask(estado).ativo) delete t.pausada[key];
      else t.perdidas[key] = (t.perdidas[key] ?? 0) + 1;
    }
    if (autoTask(estado).ativo) pagar(estado, def);
  }
  conferirMontarias(estado, key);
}

// ---------------------------------------------------------------------------
// Tasks de montaria.

const ID_DA_MONTARIA = new Map(MONTARIAS_REAIS.mounts.map((m) => [m.look, m.id]));

export function montariaGanha(estado, id) {
  return (estado.tarefas?.montarias ?? []).includes(id);
}

function conferirMontarias(estado, key) {
  for (const task of DADOS.mountTasks) {
    if (!task.alvos.some((a) => a.key === key)) continue;
    const id = ID_DA_MONTARIA.get(task.mountLook);
    if (montariaGanha(estado, id) || !task.alvos.every((a) => mortesDoBestiary(estado, a.key) >= a.alvo)) continue;
    garantir(estado).montarias.push(id);
    darItem(estado, TASK_TOKEN, task.tokens);
    estado.avisoDaHunt = `Task de montaria completa: ${task.name} é sua (+${task.tokens} Task Token).`;
  }
}

/** `character.mountTasks`, no formato do original. */
export function mountTasks(estado) {
  return DADOS.mountTasks.map((task) => ({
    ...task,
    feito: montariaGanha(estado, ID_DA_MONTARIA.get(task.mountLook)),
    alvos: task.alvos.map((a) => ({ ...a, kills: Math.min(a.alvo, mortesDoBestiary(estado, a.key)) })),
  }));
}

// ---------------------------------------------------------------------------
// Loja de Task Token.

export function loja(estado) {
  const { limpas, comExtras } = contarGuardadas(estado, TASK_TOKEN);
  return { token: TASK_TOKEN, saldo: limpas + comExtras, ofertas: [] };
}
