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

## 3. Fase 2 — persistência e reconexão
- **Desconectar não tira da party**: o membro fica `offline` por 5 min (`GRACE_MS`) com o cartão (nível, classe, aparência) e "volta em N min" na tela. Voltando no prazo, retoma lugar, modo, coleira e — se era o líder — a liderança. Enquanto isso o próximo online conduz. Passado o prazo, sai (se sobrar menos de 2, a party acaba). Sair pelo comando continua sendo na hora.
- **Reinício do servidor**: a party é gravada (`parties_salvas`: membros, líder, frente, coleiras, seguir, modo, cartões) a cada mudança (e a cada 30 s no varrer) e recarregada no boot com todos offline por 10 min (`GRACE_APOS_REINICIO_MS`). Convites e reagrupamentos (60 s) não são gravados. IDs novos não colidem com os recarregados; linhas ruins são apagadas.
- A **caçada em grupo** não sobrevive à queda (cada um segue offline com a cópia dos bichos, como sempre): ao reconectar vale o convite/pedido de caçada de sempre. O char sem aba só fica enquanto houver alguém online na party.

## 4. Fase 3 — setores e reagrupamento
- **Setores derivados do mapa** (`hunt/setores.mjs`, sem mexer em mapas nem no editor): por andar, grade de até 3×3 sobre as casas alcançáveis, regiões minúsculas (< 30 casas) fundidas à vizinha; nomes de bússola (Norte, Sudeste, Centro; "Área única" em mapa pequeno; "Andar z ·" com vários andares). Cada bicho nasce com `setor`; a instância guarda o total por setor.
- **Progresso**: `hunt.setores` = `[{id, nome, total, vivos, concluido, jogadores}]` — o mesmo para todos da sala (o convidado lê da sala do dono). Quando o último bicho de um setor morre, a party toda recebe "Setor concluído: X".
- **Reagrupamento obrigatório** só onde configurado: `gamedata/instancias.json` → `reagrupamentoObrigatorio { fases, tipos, raio }` (vazio por padrão = opcional em toda fase). Ativar um encontro de chefe (`miniboss`, `boss-secreto`) em fase listada exige os membros ativos da sala a `raio` casas; o erro diz quem falta. O convite de reagrupamento (60 s) que já existia continua.
- Não há objetivos especiais por setor (baú, mecanismo): os encontros da instância seguem como antes; o setor conta bichos.

## 5. Fase 4 — escalonamento da dificuldade (`hunt/escalonamento.mjs`, `ESCALONAMENTO`)
Só a VIDA escala (decisão do dono: o dano dos bichos não muda), por jogador extra e por tipo (normal/modificado +30%; raro +35%; elite +40%; único e boss +50%; teto ×3). O campo de dano continua em `ESCALONAMENTO` com valor 0, para religar se um dia quiser. Modelo padrão **por setor**: o bicho sente inteiros os ativos do setor dele e 35% dos de outros setores; chefe sente a party ativa inteira. Alternativas: `ativos` e `total`. Muda o pool de vida preservando a fração (entrar/sair gente nunca cura nem mata) e guarda o base (sair gente desfaz). Sozinho nada é tocado. `node tools/simular-escalonamento.mjs`: com 4 jogadores, limpar 4 setores leva 0,47 do tempo solo se reunidos e 0,33 se um por setor (modelo por setor); nos modelos `ativos`/`total` fica 0,47 nos dois — o modelo por setor premia dividir sem punir o setor vazio. Chefe com 4: vida ×2,5, dano igual ao solo (morre em 0,63 do tempo solo).

## 6. Fase 5 — interface
Cada card mostra o **setor** do membro (ou "desconectado · volta em N min"); abaixo dos cards, **Setores: X de Y concluídos** com uma linha por setor (barra, "restam N", quem está lá), nas duas telas da party (painel de Amigos e janela encaixada), redesenhando só quando algo muda. A faixa de level saiu. Avisos de entrada/saída/liderança/desconexão/volta já vêm do servidor como notices; "Setor concluído" é novo.

## 7. Limitações conhecidas
- Não testei a tela num navegador (sem navegador no servidor); a lógica e o CSS têm testes estáticos.
- A party continua num único processo (a gravação é do processo que serve o jogo).
- O escalonamento reescala a cada 1 s na tique do dono da sala; o dano da party contra chefes/bichos não foi rebalanceado além disso (ver a simulação).
- Reagrupamento obrigatório vem desligado; ligar é editar `instancias.json` (fases) e reiniciar.
