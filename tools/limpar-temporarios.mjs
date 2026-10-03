// A limpeza de temporários do Server Save, rodada à mão no HOST (onde estão os backups e os logs do cron, que o
// container não enxerga). Padrão: SIMULAÇÃO. `--apagar` remove de verdade. Só mexe no que a rotina autoriza
// (backup `.parcial` com 6 h+, log rotacionado com a retenção dada) — nunca em backup válido nem em cópia `ANTES-*`.
//   node tools/limpar-temporarios.mjs --backups /srv/draevor/backups --logs /srv/draevor/logs [--retencao-logs 14] [--apagar]
import { executar, configPadrao } from '../game/systems/limpeza-de-temporarios.mjs';

const arg = (nome) => { const i = process.argv.indexOf(nome); return i >= 0 ? process.argv[i + 1] : undefined; };
const env = { ...process.env, TEMP_CLEANUP_DRY_RUN: process.argv.includes('--apagar') ? 'false' : 'true' };
if (arg('--backups')) env.SERVER_SAVE_BACKUPS_DIR = arg('--backups');
if (arg('--logs')) env.SERVER_SAVE_LOGS_DIR = arg('--logs');
if (arg('--retencao-logs')) env.SERVER_SAVE_LOGS_RETENCAO_DIAS = arg('--retencao-logs');
const config = configPadrao(env);
config.areas = config.areas.filter((a) => a.nome !== 'temporarios-do-jogo'); // o /tmp do host não é desta rotina
const r = await executar({ config, log: (l) => console.log(l) });
console.log(`${r.dryRun ? 'SIMULAÇÃO: ' : ''}${r.removidos.length} arquivo(s), ${r.bytes} bytes, ${r.erros.length} erro(s), ${r.puladosEmUso} em uso, ${r.puladosRecentes} recentes demais`);
