# Party do Draevor — auditoria, regras de recompensa e plano

## 1. Auditoria (estado antes da Fase 1)

| Pedido | Já existia? | Onde |
|---|---|---|
| Mesma instância para a party | **Sim**: quem entra na caçada divide o array de monstros da sala do dono (`Cacadas.entrarNaSala`, `hunt/sala.mjs`); o dono move bichos e faz renascer | `party.mjs`, `cacadas.mjs` |
| Modo seguir / independente, coleira, reagrupar | **Sim** (`modo`, `coleiras`, `reagrupar`) | `party.mjs` |
| Exp dividida | Sim, em partes **iguais** + bônus de vocações, só com 2+ na sala, **dentro de 10 níveis e a 30 sqm** | `partilha()`, `matarMonstro` |
| Ouro | Sim, partes iguais; o resto ia sempre para quem matou | `soltarDrops` |
| Itens | Rodízio em fila (previsível); gemas/lapidadoras/fundidoras/orbes só para quem matou | `soltarDrops`, `matarMonstro` |
| Limite de diferença de nível | **Sim (10)** — contra o pedido | `party.mjs` |
| Persistência da party | **Não**: memória do processo; reiniciar desfaz | `party.mjs` |
| Setores, objetivos por setor, reagrupamento obrigatório | **Não**: a instância é um mapa contínuo com % de limpeza (`hunt/instancia.mjs`) | — |
| Escalonamento por nº de jogadores | **Não** | — |
| Fila de recompensas pendentes | Não para party (todos os integrantes estão online por construção); "Ficou no chão" é só relatório | — |

## 2. Fase 1 (esta entrega): regras de recompensa

- **Sem limite de nível e sem proximidade** para formar a party, entrar na caçada e dividir (`partilha()` nunca mais desliga por nível ou distância; a faixa de level some da tela). Continua valendo: mesma sala/instância, o anti-AFK do independente parado (60 s) e a liberação da fase (exceto campanha).
- **XP**: `peso = nível ^ k` com **k = 1,5** (`PARTY_XP_EXPOENTE`, 0,5–3). A exp do bicho (com o bônus de vocações, **mantido**) é dividida pelas fatias; cada um aplica os seus próprios bônus, como antes. Quem mata não leva a mais.
- **Item**: sorteio uniforme no servidor entre quem pode levar (filtro "não coletar" e capacidade); se o sorteado não consegue guardar, sai e sorteia-se de novo; um dono só. Vale também para gemas, lapidadoras, fundidoras e orbes. Cada sorteio tem **id de drop** e entra na auditoria (`auditoria()`).
- **Ouro**: partes iguais; o resto roda entre os integrantes (começa em quem não o recebeu na vez anterior). A soma é sempre o ouro do evento.
- **Idempotência**: `matarMonstro` processa a morte de um bicho uma vez só (`alvo.recompensado`).
- Quem joga **solo** não muda em nada.

### Simulações (`node tools/simular-party.mjs`)
XP, party 10/30/60/100 (igual seria 25% cada):

| Fórmula | L10 | L30 | L60 | L100 |
|---|---|---|---|---|
| linear | 5,0% | 15,0% | 30,0% | 50,0% |
| nível^1,25 | 3,1% | 12,3% | 29,2% | 55,4% |
| **nível^1,5** | 1,9% | 9,9% | 28,0% | 60,2% |
| nível^2 | 0,7% | 6,2% | 24,7% | 68,5% |

Extremos com 1,5: 5 e 300 → 0,2% / 99,8%; 200 + três nível 10 → 96,8% / 1,1% cada. Níveis iguais dividem igual em qualquer fórmula. **Recomendação técnica**: 1,25 é mais gentil com iniciantes sem perder o incentivo ao nível alto; foi adotado 1,5 por decisão do dono. É um número de ambiente: dá para trocar sem deploy de código (`PARTY_XP_EXPOENTE`).
Item: 1.000.000 de drops → desvio máximo de 0,05 ponto percentual do ideal em parties de 2 a 5. Ouro: 1.001 × 1.000 eventos entre 4 → 250.250 para cada, soma exata.

## 3. Fases seguintes (decididas, ainda não feitas)
1. **Persistência da party** (tabela de parties/membros, instância vinculada, reconexão sem desfazer; entrada no meio da fase só participa dos eventos futuros).
2. **Setores derivados do mapa** (regiões a partir de spawns e rotas): progresso por setor, "restantes", reagrupamento obrigatório quando a fase pedir.
3. **Escalonamento de dificuldade** por jogadores ativos (parâmetros por tipo de monstro, simulado antes).
4. **Interface** de party (setor atual, progresso coletivo, notificações) — desktop e mobile.

## 4. Limitações conhecidas
- A party continua só em memória; reiniciar o servidor desfaz as parties (as caçadas offline não são afetadas).
- O exp dos bichos de um membro offline não existe: a partilha só inclui sessões online na mesma sala.
- Drops de **encontros** (baús/guardiões) já passam pelo mesmo sorteio; recompensas "únicas" de boss (`pagarPremio`) seguem individuais.
