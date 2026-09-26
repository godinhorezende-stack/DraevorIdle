# Auditoria de responsividade — mobile e tablet

Data: 2026-09-26. Escopo combinado com o dono do projeto depois de uma
primeira leitura do pedido original (ver a pergunta e a resposta na
conversa): **não** criar uma arquitetura nova de detecção de tela em JS
(`ResponsiveLayoutManager`) — o jogo já resolve isso com uma variável CSS
única (`--e-celular`), e duplicar essa decisão em JS foi exatamente o bug que
o próprio projeto já corrigiu uma vez (ver o comentário em
`assets_raw/client/style.css`, "E o JS pergunta ao CSS, em vez de repetir o
número"). O que ficou combinado: estender esse mesmo padrão, corrigir os
alvos de toque que sobraram, cobrir a safe-area que faltava, e medir de
verdade nas 10 resoluções pedidas.

## O que já existia (não foi tocado)

- Layout mobile por gaveta (janelas viram um retângulo único no rodapé),
  analógico para andar, botões maiores, `viewport-fit=cover` já ligado.
- Uma variável CSS só (`--e-celular`) decide "é celular?"; o JS só lê.
- 121 `@media` no CSS, a maioria já resolvendo casos reais medidos antes
  (91 alvos de toque abaixo de 44px, texto de 9px, cartaz cobrindo a tela).

## O que foi adicionado

1. **`--e-tablet`** — a mesma variável, mesmo padrão, para
   `(min-width: 600px) and (max-width: 1180px) and (pointer: coarse)`. Um
   tablet **deitado** (1024px) não batia nem a régua de 820px de largura nem
   a de 540px de altura do celular: caía inteiro no layout de mesa, com o
   mouse que não tem. Retrato (768px) já caía em `--e-celular` sozinho.
2. **Alvos de toque corrigidos** (medido antes/depois, ver tabela): `#topbar-min`,
   `.window-close`/`.window-min`, `#store-button`, `.tools #market-button`,
   `.carteira-mais` (via área de toque invisível maior, sem mudar o desenho
   de 14px que existe de propósito).
3. **Safe-area** (`env(safe-area-inset-*)`) na barra de ações, na gaveta, no
   analógico e nas laterais da topbar — antes só um modal usava isso.

## Tabela: antes → depois (medido, `tools/perf/auditoria-mobile.mjs`)

| Elemento | Antes | Depois | Onde |
|---|---|---|---|
| `#topbar-min` | 26×20 | 44×44 | celular + tablet |
| `.window-close` / `.window-min` | 34×34 | 40×40 | celular + tablet |
| `#store-button` | 91×22 | 91×44 (padding, imagem igual) | celular + tablet |
| `.tools #market-button` | 28×25 | 28×39 | celular retrato + tablet; **não** no celular deitado (ver abaixo) |
| `.carteira-mais` | 14×14 (visível e toque) | 14×14 visível, ~34×34 de toque | celular + tablet |

**Uma correção no meio do caminho:** a primeira versão do ajuste do
`#market-button` também valia no celular **deitado**, e isso quebrou a
fileira de ícones da topbar em 852×393 e 915×412 — a topbar ali já é uma
versão espremida a 54px (`@media (max-height: 520px)`, "a altura é o recurso
escasso"), e os 19px a mais estouravam a fileira inteira pra fora da tela.
Testado ao vivo (print antes/depois), corrigido excluindo essa faixa
(`min-height: 521px` na condição) — o celular deitado mantém o botão do
tamanho de sempre.

## O que ficou de fora, e por quê

- **Topo da safe-area (entalhe em retrato):** `--altura-da-topbar` é um
  número fixo do qual mais de uma dúzia de outras regras dependem (HUD,
  avisos, cartazes). Crescer a altura de verdade sem atualizar esse número
  em todo lugar que o lê quebraria essas posições — o mesmo tipo de
  divergência que o `--e-celular` já corrigiu uma vez. Em retrato, dentro do
  Safari normal (não instalado como app), a barra de endereço do navegador
  já cobre essa faixa de qualquer forma. Fica para quem tiver um aparelho
  de verdade confirmar se faz falta.
- **Teclado cobrindo a barra de ações (`visualViewport`):** não implementado.
  Não há como testar um teclado de verdade neste ambiente (Chromium
  headless não tem IME), e um ajuste não verificado que mexe em posição de
  elemento fixo é mais risco do que vale sem poder confirmar.
- **Layout de painel específico para tablet** (grades lado a lado em vez de
  janela flutuante): fora do combinado — isso reescreveria `panels.mjs`
  (25 mil linhas) painel por painel. O tablet ganhou os mesmos alvos de
  toque maiores; o layout continua o de mesa (janelas flutuantes), que faz
  sentido numa tela grande.
- **`env()` sem `@supports`:** o resto do arquivo já usa `env()` sem
  proteção (a regra do modal, que já existia). Não há tentativa de suportar
  navegador que não entenda a função.

## Achado novo, não corrigido: tooltip de comparação de item corta na lateral

Ao reabrir a auditoria com a modal de boas-vindas fechada (pra medir o jogo
de verdade, não só a modal por cima dele), apareceu um problema **anterior
a esta auditoria**, sem relação com os itens acima: em 360px de largura, o
cartão de comparação de item (o que aparece ao passar o mouse/tocar um item
do inventário, comparando com o equipado) **não** se ajusta à tela — o texto
da direita (peso, chance de drop, o "compared with") sai cortado fora do
viewport. Print em `auditoria-mobile/android-pequeno-portrait.png`
(regenerar com o comando abaixo). Não foi tocado nesta rodada — é outro
componente (`tooltip.mjs`/`inventory.mjs`, que já tem sua própria lógica de
posicionamento por `requestAnimationFrame`), e mexer nele sem estudá-lo
seria o mesmo risco que o "consertei" do `market-button` demonstrou. Fica
como candidato a uma próxima rodada, se quiser.

## Como repetir

```bash
cd server && node index.mjs &
node tools/perf/preparar-personagem.mjs        # cria o personagem de teste, imprime o token
node tools/perf/auditoria-mobile.mjs <token>   # 10 prints + relatorio.json em ./auditoria-mobile
```
