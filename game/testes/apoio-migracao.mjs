// As marcas da MIGRAÇÃO para o PoE oficial nos testes (docs/migracao-poe-oficial.md, matriz teste a teste em docs/migracao-poe-matriz.md).
// Um teste marcado NÃO roda no jogo oficial (pula com o motivo, que aparece no relatório da suíte) e RODA no clássico — pelo arquivo
// irmão `<nome>.classico.test.mjs`, que roda o mesmo arquivo com DRAEVOR_CLASSICO=1. Nada é apagado: quando o clássico for aposentado,
// o B sai junto com o código que ele testa, e o C já terá a versão do PoE.
import { ligado } from '../systems/itens-poe/catalogo.mjs';

/** B — a regra é do Draevor clássico (o jogo oficial não tem): roda só no clássico. */
export const doClassico = (motivo) => (ligado() ? `B — regra do Draevor clássico: ${motivo}` : false);

/** C — a regra VALE no PoE, mas o teste ainda usa conteúdo do Draevor (hunt, magia, item): roda no clássico até ganhar a versão do PoE. */
export const aAdaptar = (motivo) => (ligado() ? `C — a adaptar ao PoE: ${motivo}` : false);

/** O contrário: o teste é do jogo OFICIAL (PoE) e mora num arquivo que também roda no clássico (pelo irmão) — lá ele pula, com o motivo. */
export const soNoOficial = (motivo) => (ligado() ? false : `só no jogo oficial (o PoE está desligado no clássico): ${motivo}`);

/**
 * Falha que JÁ EXISTIA no clássico antes da migração (não é dela; X1 em docs/migracao-poe-oficial.md): vai como `todo` — roda, aparece
 * no relatório como TODO com o motivo e não derruba a suíte. É pendência do dono, não regra nova: corrigir o teste ou o código e tirar.
 */
export const jaFalhava = (motivo) => `falha anterior à migração: ${motivo}`;
