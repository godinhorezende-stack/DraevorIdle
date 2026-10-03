// O REGISTRO DE ALTERAÇÕES ADMINISTRATIVAS da Engine: cada gravação, operação, login e recusa vira UMA linha JSON (append-only) em
// `engine-auditoria.jsonl`: quando, quem (e-mail do administrador), de onde (IP), o quê (método, rota, ação, chave) e o resultado. Não guarda o
// conteúdo editado (o conteúdo está nos arquivos e nas versões deles), só o resumo — e NUNCA senhas. Persistente: fica no volume de dados do banco
// (`game/database/dados/`, gravável no container), então sobrevive ao deploy e ao reinício; `ENGINE_AUDITORIA` aponta para outro arquivo. Passando de
// 5 MB o arquivo atual vira `.1.jsonl` (o anterior é descartado) e recomeça.
import { appendFileSync, readFileSync, existsSync, statSync, renameSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const CAMINHO = { arquivo: process.env.ENGINE_AUDITORIA || join(dirname(fileURLToPath(import.meta.url)), '..', 'database', 'dados', 'engine-auditoria.jsonl') };
const MAX_BYTES = 5 * 1024 * 1024;
const CAMPOS_DE_RESUMO = ['acao', 'key', 'id', 'novaKey', 'ativo', 'versao', 'huntId', 'categoria'];

/** Um resumo seguro do corpo do pedido: só campos de identificação (nunca o conteúdo editado nem senha). Pura. */
export function resumirCorpo(corpo) {
  if (!corpo || typeof corpo !== 'object') return null;
  const r = {};
  for (const c of CAMPOS_DE_RESUMO) if (corpo[c] !== undefined && typeof corpo[c] !== 'object') r[c] = corpo[c];
  // O que mudou, em nomes de campo (não em valores): `override`, `fases`, `bosses`...
  const campos = Object.keys(corpo).filter((c) => !CAMPOS_DE_RESUMO.includes(c) && c !== 'senha' && c !== 'password' && c !== 'revisao');
  if (campos.length) r.campos = campos.slice(0, 12);
  if (corpo.override && typeof corpo.override === 'object') r.camposDoOverride = Object.keys(corpo.override).slice(0, 12);
  if (Array.isArray(corpo.fases)) r.fasesAlteradas = corpo.fases.length;
  if (Array.isArray(corpo.bosses)) r.bossesAlterados = corpo.bosses.length;
  return Object.keys(r).length ? r : null;
}

/** Acrescenta um evento. Nunca lança (um problema de disco não pode derrubar a Engine); devolve `false` se não gravou. */
export function registrar(evento, { agora = Date.now() } = {}) {
  try {
    mkdirSync(dirname(CAMINHO.arquivo), { recursive: true });
    if (existsSync(CAMINHO.arquivo) && statSync(CAMINHO.arquivo).size > MAX_BYTES) renameSync(CAMINHO.arquivo, CAMINHO.arquivo.replace(/\.jsonl$/, '.1.jsonl'));
    appendFileSync(CAMINHO.arquivo, `${JSON.stringify({ quando: agora, ...evento })}\n`);
    return true;
  } catch (e) {
    console.warn(`[auditoria] não gravou: ${e.message}`);
    return false;
  }
}

/** As últimas `limite` linhas (mais nova primeiro), com filtro opcional por tipo. */
export function ler({ limite = 100, tipo = null } = {}) {
  if (!existsSync(CAMINHO.arquivo)) return [];
  const linhas = readFileSync(CAMINHO.arquivo, 'utf8').split('\n').filter(Boolean);
  const eventos = [];
  for (let i = linhas.length - 1; i >= 0 && eventos.length < Math.min(500, Math.max(1, Number(limite) || 100)); i--) {
    try {
      const e = JSON.parse(linhas[i]);
      if (!tipo || e.tipo === tipo) eventos.push(e);
    } catch { /* linha corrompida: ignorada */ }
  }
  return eventos;
}
