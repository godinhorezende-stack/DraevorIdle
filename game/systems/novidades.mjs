// A faixa "O que mudou nesta versão" do cliente (`pintarNovidades` em main.mjs):
// vai em todo `welcome`, como no original (`{versao, novidades}`). O conteúdo é
// gerado por `tools/gerar-novidades.mjs` (a versão deste servidor + o histórico
// do original). A `versao` do jogo é a das novidades: o cliente só pede para
// recarregar quando ela muda — reiniciar o servidor sem mudança não incomoda ninguém.
import { readFileSync } from 'node:fs';

const { _fonte, ...NOVIDADES } = JSON.parse(readFileSync(new URL('../../assets_raw/gamedata/novidades.json', import.meta.url), 'utf8'));

export const VERSAO = NOVIDADES.versao ?? null;
export const novidades = () => NOVIDADES;
