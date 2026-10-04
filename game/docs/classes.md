# Editor de Classes (Engine › Classes)

Cadastro das classes do jogo, atributos iniciais, ganho por level e bônus por ponto de atributo — **por override** (`gamedata/overrides/classes.json`); a fábrica (`classes.json` = nome, `atributos-principais.json` = atributos e bônus, `classes-meta.json` = descrição/ícone/cor) nunca é editada.

## Auditoria (o que já existia)
- Os atributos já eram **derivados** a cada cálculo: `base da classe + ganho por level × (level − 1) + itens` (`personagem/atributos.mjs › principais`), e os bônus por ponto (`efeitos`) já eram uma tabela única lida por `Atributos.efeitos` → `Ficha.combate` (vida e mana via `Afixos.sincronizarMaximos`). Por isso o inicial entra **uma única vez** e a progressão não duplica nada (teste CL4).
- Vocação (`knight`…`monk`) é a mecânica de que o resto depende (magias, gemas, equipamento inicial, especializações, sprites). Uma **classe criada** é sempre uma classe sobre uma **vocação-base**: tem ID, nome, descrição, ícone, cor, atributos iniciais e ganho por level próprios e herda a mecânica da base. O personagem guarda `vocation` (mecânica) e `classe` (ID); personagem antigo não tem `classe` e vale como a vocação (`classe` NULL no banco = compatível).
- Valores de fábrica = os de hoje (Força 20/10/5 do knight, 5 de vida por ponto etc.). Os valores sugeridos no pedido (12/6/2…; 0,5 vida/ponto; +0,2%…) estão no botão **Carregar perfil sugerido (teste)**: só entram no rascunho, nada é salvo/aplicado sem você confirmar.
- Evasão (%) por Destreza e Energy Shield (%) por Inteligência não existiam: entraram como bônus **desligados (0)** em `Atributos.efeitos`/`Ficha` (somam ao `%` de Evasion e Energy Shield). Dano físico por Força vale para o golpe físico em geral (corpo a corpo e à distância), como já era.

## Uso
Lista (busca, ícone/cor, personagens por classe, ativar/desativar, duplicar, apagar), **Criar classe** (ID, nome e vocação-base), ficha (nome, ícone, cor, descrição, ativa, atributos iniciais e ganho por level com original e restaurar, prévia dos efeitos), **bônus por ponto** globais (com limites), **calculadora** (ex.: Força 20 → +10 vida e +4% com a tabela configurada), versões e comparação. Validações: ID único/formato, atributos inteiros ≥ 0, limites dos bônus, classes de fábrica não se apagam, ao menos uma ativa; **apagar classe com personagens exige migração explícita** (botão "Migrar personagens", altera o banco). Desativar impede só NOVOS personagens.

## Criação de personagem
Tela de criação lista as classes **ativas** (`GET /api/classes`: ícone, nome, descrição, atributos iniciais e bônus), envia `classe`; o servidor **valida** (existe e está ativa), define a vocação pela classe e grava `classe` no banco e no estado. Sem classe válida a criação é recusada.

## Fluxo
Salvar → Hot Reload local (muta a tabela da engine; vale no próximo cálculo, inclusive para quem joga) → aprovar versão/Git/merge/deploy manuais. Em produção a tela é somente leitura. Testes: `testes/classes.test.mjs` (CL1–CL12).

Limitações: o ícone é um emoji/símbolo (sem upload de imagem); a migração não atinge quem está online (muda no próximo login); classes novas não trazem sprite/magias próprios (herdam da vocação-base).
