// O DIÁRIO das edições de atributos-base e nível dos equipamentos (editor de Itens e Item Power gravam aqui): uma linha por gravação — quem/onde (`tipo`: individual, tabela, lote, itens-editor,
// restauracao…), itens e campos alterados. Fica em `database/dados/` (local, fora do Git); o histórico de VERSÕES do arquivo é o do `arquivo-versionado` (`overrides/_versoes/itens`).
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const HISTORICO = { arquivo: process.env.ENGINE_ITEM_POWER_HISTORICO || join(dirname(fileURLToPath(import.meta.url)), '..', 'database', 'dados', 'item-power-edicoes.jsonl') };

/** Acrescenta um evento. Nunca lança (um problema de disco não pode derrubar a Engine). */
export function registrar(evento) {
  try { mkdirSync(dirname(HISTORICO.arquivo), { recursive: true }); appendFileSync(HISTORICO.arquivo, `${JSON.stringify({ quando: Date.now(), ...evento })}\n`); return true; } catch (e) { console.warn(`[item-power] histórico não gravado: ${e.message}`); return false; }
}

/** Os eventos mais novos primeiro; `id` filtra os que tocam aquele item. */
export function ler({ limite = 100, id = null } = {}) {
  if (!existsSync(HISTORICO.arquivo)) return [];
  let l = readFileSync(HISTORICO.arquivo, 'utf8').split('\n').filter(Boolean).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean).reverse();
  if (id != null && id !== '') l = l.filter((e) => (e.ids ?? []).map(String).includes(String(id)));
  return l.slice(0, Math.min(500, Math.max(1, Number(limite) || 100)));
}
