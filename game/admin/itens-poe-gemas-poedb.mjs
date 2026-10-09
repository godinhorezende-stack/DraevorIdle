// A aba GEMAS × POEDB da engine (dono, 09/10: "mapeie Skill_Gems e Support_Gems e suas abas; ao entrar em cada gema verifique tudo — a
// missão, o level effect e a imagem tanto da gema quanto da skill que vai ficar na barra de slot — e confronte"; "a ideia é colocar todas
// as gemas para funcionar, visualmente e também efetivamente"): cada gema do poedb (ativa, suporte, desperta) × a do jogo — existe, o
// texto, a tabela por nível, a missão, as duas imagens — e o ESTADO no jogo (funciona/parcial, com os motivos do motor).
// O manifesto é do tools/importar-poedb-gemas.mjs (`gamedata/itens-poe/poedb-gemas.json`); só leitura.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as GemasPoe from '../systems/itens-poe/gemas-poe.mjs';
import * as SuportesPoe from '../systems/itens-poe/suportes-poe.mjs';

export const ARQUIVO = fileURLToPath(new URL('../gamedata/itens-poe/poedb-gemas.json', import.meta.url));
let CACHE = null;
/** `{ geradoEm, fonte, gemas: [{ ..., estado, motivos, problemas }], resumo }`, ou null sem o manifesto. */
export function gemasPoedb() {
  if (CACHE) return CACHE;
  if (!existsSync(ARQUIVO)) return null;
  const m = JSON.parse(readFileSync(ARQUIVO, 'utf8'));
  const ativas = GemasPoe.statusNoJogo();
  const suportes = SuportesPoe.statusNoJogo();
  const resumo = { total: m.gemas.length, noJogo: 0, porEstado: {}, problemas: {} };
  const gemas = m.gemas.map((g) => {
    const s = g.tipo === 'ativa' ? ativas[g.slug] : suportes[g.slug];
    const estado = !g.noJogo ? 'naoExiste' : s?.status ?? 'semRegistro';
    const c = g.comparacao;
    const problemas = [];
    if (!g.noJogo) problemas.push('não está no jogo');
    if (c) {
      if (!c.nome) problemas.push('nome');
      if (!c.tags.iguais) problemas.push('tags');
      if (!c.propriedades.iguais) problemas.push('propriedades');
      if (!c.mods.iguais) problemas.push('mods');
      if (!c.qualidade.iguais) problemas.push('qualidade');
      if (c.niveis && (c.niveis.diferentes || c.niveis.niveisPoedb !== c.niveis.niveisJogo)) problemas.push('tabela por nível');
      if (c.missao.faltamNoJogo.length || c.missao.soNoJogo.length) problemas.push('missão');
    }
    if (!g.iconeHabilidade && g.tipo === 'ativa') problemas.push('sem ícone de habilidade');
    resumo.porEstado[estado] = (resumo.porEstado[estado] ?? 0) + 1;
    if (g.noJogo) resumo.noJogo++;
    for (const p of problemas) resumo.problemas[p] = (resumo.problemas[p] ?? 0) + 1;
    return { ...g, estado, motivos: s?.motivos ?? [], problemas };
  });
  CACHE = { geradoEm: m.geradoEm, fonte: m.fonte, naoSincronizadas: m.naoSincronizadas ?? [], gemas, resumo };
  return CACHE;
}
export const esquecer = () => { CACHE = null; };
