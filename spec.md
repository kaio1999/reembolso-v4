# Spec — Reembolso v4

Vigência da política: `2026-07-01`, retroativa à competência corrente. Fonte dos limites: `politica-v4.json`. Fonte das taxas: `cambio.json`. O motor não embute tabela de limite nem cotação.

Esta spec substitui a política única da v3. O envelope chegou sem o repositório anterior; o que vale é o que está escrito aqui e em `DECISIONS.md`.

## Entrada

Relatório de despesas:

- `colaborador.id`, `colaborador.nome`, `colaborador.centro_custo`
- `periodo.competencia`, `periodo.inicio`, `periodo.fim` (`YYYY-MM-DD`)
- `despesas[]`: `id`, `data`, `categoria`, `descricao`, `fornecedor`, `valor`, `tem_nota_fiscal`, `moeda` opcional

`descricao` e `fornecedor` não entram no cálculo.

## Saída

O resultado deixa de ser um único valor. Cada item traz:

| Campo | Significado |
| --- | --- |
| `moeda` | ISO 4217. Ausente vira `BRL` |
| `valor_brl` | Valor convertido, com 2 casas, ou `null` se não houver taxa |
| `taxa` / `data_taxa` / `taxa_origem` | Cotação usada. `BRL` não tem taxa |
| `politica_origem` | `centro_custo` ou `padrao` |
| `limite_brl` | Teto da categoria na tabela resolvida, ou `null` se a categoria não existe |
| `valor_reembolsavel` | Valor em BRL após as regras |
| `valor_glosado` | `valor_brl - valor_reembolsavel` quando a conversão existe |
| `estado` | `aprovado`, `pendente_aprovacao` ou `reprovado` |
| `motivo` | Código da regra que alterou o valor, ou `null` |

Totais do relatório: `solicitado_brl` (só o que converteu), `aprovado_brl`, `pendente_brl`, `nao_reembolsado_brl`, `itens_sem_conversao`.

`aprovado_brl` soma apenas itens `aprovado`. Item pendente fica de fora até o gestor decidir.

## Regras, nesta ordem

1. **Período.** `data` fora de `[periodo.inicio, periodo.fim]` → `reprovado`, motivo `fora_do_periodo`.
2. **Vigência.** `data` anterior a `politica.vigencia` → `reprovado`, motivo `fora_de_vigencia`.
3. **Valor.** `valor <= 0` → `reprovado`, motivo `valor_invalido`.
4. **Moeda.** Sem `moeda`, ou só espaços → `BRL`. Qualquer outra é normalizada para maiúsculas.
5. **Conversão.** Limites são sempre em BRL. `BRL` passa direto. Nas demais, `valor_brl = arredondar(valor × taxa, 2 casas, meio para cima)`. A taxa é a da **data da despesa**. Se essa data não tiver a moeda, usa-se a data anterior mais recente que a tenha em `cambio.json`. Sem data anterior → `reprovado`:
   - `moeda_sem_cotacao` se a moeda não aparece no arquivo;
   - `taxa_indisponivel` se aparece só em datas posteriores.
6. **Tabela do centro de custo.** Se `centros_custo` tem a chave do colaborador, essa tabela é a política inteira dele. Se não tem, usa-se `padrao`. Categoria ausente na tabela escolhida → `reprovado`, motivo `categoria_nao_coberta`. Não há herança categoria a categoria.
7. **Não reembolsável.** `limite` igual a 0, ou `observacao` contendo "nao reembolsavel", → `reprovado`, motivo `nao_reembolsavel`. Zero não cai no padrão.
8. **Nota fiscal.** Se `valor_brl` é maior que `nota_fiscal_obrigatoria_acima_de` e `tem_nota_fiscal` não é `true` → `reprovado`, motivo `nota_fiscal_obrigatoria`. O limiar é estrito (`acima de`). A comparação é o valor convertido, antes do teto.
9. **Teto.**
   - `periodicidade: "dia"`: soma da categoria na mesma data, na ordem do arquivo. O que excede o limite restante é glosado (`motivo: glosa_teto`). Esgotado o teto, o item fica `reprovado` com `teto_esgotado`.
   - `periodicidade: "diaria"`: cada lançamento é uma diária. O texto da descrição não informa quantidade de noites.
   - Periodicidade desconhecida interrompe o cálculo com erro. Política inválida não vira reembolso silencioso.
10. **Aprovação manual.** Valor reembolsável **maior que R$ 500,00** → `pendente_aprovacao`. Igual a 500 permanece `aprovado`. O limiar vem do comunicado (item C), não do JSON.

`acrescimo_em_viagem_percentual` é carregado com a política e **não altera** limite. O gatilho não está no comunicado nem no lançamento. Ver D8.

## Erros de lote

Relatório sem `colaborador.centro_custo`, política sem `padrao` ou câmbio sem `taxas` falham o lote. Centro de custo desconhecido não é erro: cai no padrão.

## Casos que os arquivos do envelope travam

- `CC-COMERCIAL` / `representacao`: categoria nova, teto R$ 300 por dia.
- `CC-ENG-PLATAFORMA` / `hospedagem`: limite 0, não reembolsável, sem volta ao padrão de R$ 250.
- `CC-SUPORTE-N2`: ausente da tabela, usa `padrao`. `representacao` não está no padrão.
- Despesa sem `moeda`: `BRL`.
- `EUR` e `USD`: taxa da data. Sábado `2026-07-18`: taxa de `2026-07-17`.
- `GBP`: sem cotação.
- `coworking`: categoria fora da tabela.
- Nota fiscal ausente com valor convertido acima de R$ 100.
