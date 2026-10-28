# Gemas do PoE: estado da implementação

Gerado por `ITENS_POE=1 node tools/relatorio-gemas-poe.mjs` a partir do código (status no jogo de `itens-poe/gemas-poe.mjs` e `itens-poe/suportes-poe.mjs`), dos ícones em `gamedata/itens-poe/`, da compatibilidade (`suportes-compat.json`) e dos testes que citam cada gema. Nada é classificado à mão. **"Testada" quer dizer que algum teste cita a gema** — não que todas as linhas dela tenham teste.

## Totais

### Gemas de habilidade (562; ataques: 210)

| Estado | Gemas | 
|---|---|
| implementada e testada | 560 |
| parcial | 1 |
| não se aplica | 1 |

Só os ataques:

| Estado | Gemas |
|---|---|
| implementada e testada | 210 |

### Gemas de suporte (262)

| Estado | Gemas |
|---|---|
| implementada e testada | 261 |
| não se aplica | 1 |

### Variantes

- Vaal (52): implementada e testada 52
- Alternativas (209): implementada e testada 209

### Compatibilidade, efeitos compartilhados, imagens, testes

- Compatibilidade: 562 ativas e 260 suportes com regra; 58049 pares compatíveis; sem regra: 0 ativas, 2 suportes (Inspiration_Support, Pacifism_Support).
- Efeitos compartilhados faltando: 0 linhas distintas (0 em duas ou mais gemas).
- Imagens: 562/562 ativas com ícone da gema, 562/562 com ícone da habilidade, 262/262 suportes; 0 desenhos repetidos entre gemas de bases diferentes.
- Catálogo do poedb (Skill_Gems + Support_Gems, pt): 824 gemas; faltam no jogo: nenhuma; só no jogo: nenhuma.
- Testes que citam a gema: 562/562 ativas, 262/262 suportes.
- Teste geral (`testes/gemas-todas-funcionam-poe.test.mjs`): toda ativa `funciona` é usada de verdade numa caçada e precisa causar dano no alvo (ou ligar o buff); todo suporte `funciona` precisa de efeito sem linha não feita, e cada chave do efeito precisa ser lida pelo código do jogo. "Sem teste próprio" quer dizer que só esse teste geral cobre a gema.

## Linhas que faltam (por quantidade de gemas)

| Gemas | Linha |
|---|---|


## Gemas de habilidade pendentes

- **Pact_of_Ghorr** (Pacto de Ghorr) — parcial
  - o Pacto (o PoB: o uso não causa dano; fortalece as próximas 3 magias degenerativas com 40% mais Dano Degenerativo; a Fome de Ghorr ativa o Destruir Carne a cada 2 s por 6 s) — no jogo o uso só põe o degenerativo no alvo; a área do Destruir Carne e o estágio do Rito de Sangue sem fonte: decisão do dono

## Gemas de suporte pendentes



## Não se aplicam ao jogo

- **Portal** (Portal) — não se aplica (não se aplica: a caçada já tem a saída para a cidade, e os 6 portais do mapa são gastos pela morte (mapa-aberto.mjs) — o portal do PoE não tem o que fazer no jogo)
- **Cast_on_Ward_Break_Support** (Conjurar ao Perder Salvaguarda (Reforço)) — não se aplica (não se aplica: o jogo não tem Salvaguarda (Ward), então a salvaguarda nunca quebra e a magia nunca seria ativada (aval do dono 27/10))
  - não se aplica: o jogo não tem Salvaguarda (Ward), então a salvaguarda nunca quebra e a magia nunca seria ativada (aval do dono 27/10)

## Linhas que não se aplicam ao jogo

- **Spectral_Throw_of_Materialising** (Arremesso Espectral da Materialização) — implementada e testada
  - não se aplica: "Desaceleração do Projétil reduzida" (Arremesso Espectral da Materialização) só muda a trajetória — o PoB não a usa na conta
- **Smoke_Mine** (Mina de Fumaça) — implementada e testada
  - não se aplica: "Minas não podem ser Re-armadas" (Mina de Fumaça) — o jogo não tem Re-armar Minas (aval do dono 27/10)
- **Spectral_Helix** (Hélice Espectral) — implementada e testada
  - não se aplica: "Gira por N rotações" (Hélice Espectral) só muda a trajetória da espiral — o PoB não a usa na conta, e o projétil do jogo acerta no tique
- **Spectral_Helix_of_Trarthus** (Hélice Espectral de Trarthus) — implementada e testada
  - não se aplica: "Gira por N rotações" (Hélice Espectral) só muda a trajetória da espiral — o PoB não a usa na conta, e o projétil do jogo acerta no tique
- **Volatile_Dead** (Morto Volátil) — implementada e testada
  - não se aplica: "Velocidade de Movimento do Orbe aumentada em X%" (Morto Volátil) só muda a trajetória do orbe até o inimigo — o PoB não a usa na conta, e o orbe do jogo acerta no uso
- **Volatile_Dead_of_Seething** (Morto Volátil do Fervor) — implementada e testada
  - não se aplica: "Velocidade de Movimento do Orbe aumentada em X%" (Morto Volátil) só muda a trajetória do orbe até o inimigo — o PoB não a usa na conta, e o orbe do jogo acerta no uso
- **Kinetic_Bolt** (Tiro Cinético) — implementada e testada
  - não se aplica: "Projéteis mudam de direção N vezes" (Raio Cinético) só muda a trajetória — o projétil não acerta de novo a cada mudança
- **Kinetic_Bolt_of_Fragmentation** (Tiro Cinético da Fragmentação) — implementada e testada
  - não se aplica: "Projéteis mudam de direção N vezes" (Raio Cinético) só muda a trajetória — o projétil não acerta de novo a cada mudança
- **Ice_Spear** (Lança Gélida) — implementada e testada
  - não se aplica: "A Segunda forma possui X% mais Velocidade de Projétil" (Lança de Gelo) só muda a trajetória da segunda forma — o PoB não a usa na conta, e o projétil do jogo acerta no tique
- **Ice_Spear_of_Splitting** (Lança de Gelo da Divisão) — implementada e testada
  - não se aplica: "A Segunda forma possui X% mais Velocidade de Projétil" (Lança de Gelo) só muda a trajetória da segunda forma — o PoB não a usa na conta, e o projétil do jogo acerta no tique

## Implementadas sem teste próprio

—
