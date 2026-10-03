// Lê do disco os atos do editor que o jogo EXECUTA: `gamedata/atos/*.json` com `estado` `beta` ou `publicado`. Rascunhos e desativados nunca
// entram. Só lê: quem registra (e valida de novo) é `Campanha.registrarAto`. O arquivo viaja com o código (o editor grava, o dono confere e
// faz o deploy): publicar = o arquivo estar na pasta no boot do servidor (reinício controlado).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { normalizar } from './atos-modelo.mjs';

export const PASTA = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata', 'atos');

/** Atos executáveis da pasta, na ordem do `ordem`. Arquivo corrompido é ignorado (e avisado), nunca derruba o boot. */
export function lerExecutaveis(pasta = PASTA) {
  if (!existsSync(pasta)) return [];
  const atos = [];
  for (const nome of readdirSync(pasta).filter((n) => n.endsWith('.json'))) {
    try {
      const ato = normalizar(JSON.parse(readFileSync(join(pasta, nome), 'utf8')));
      if (ato.estado === 'beta' || ato.estado === 'publicado') atos.push(ato);
    } catch (e) {
      console.warn(`[atos] ${nome} ignorado: ${e.message}`);
    }
  }
  return atos.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}
