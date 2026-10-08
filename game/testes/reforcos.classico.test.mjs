// O MESMO arquivo (reforcos.test.mjs) no DRAEVOR CLÁSSICO (DRAEVOR_CLASSICO=1, a transição): as marcas B (doClassico) e C (aAdaptar) de lá só
// pulam no jogo oficial; aqui rodam, para o clássico seguir protegido enquanto existir (docs/migracao-poe-matriz.md). Sai junto com o modo clássico.
import './apoio-classico.mjs';
await import('./reforcos.test.mjs');
