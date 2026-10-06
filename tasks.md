# Tasks — Envelope v4

Não havia numeração anterior neste diretório. A sequência começa em T1.

Status: concluídas.

## T1 — Reescrever a spec para a v4

Registrar limites externos, moeda, conversão pela data, fallback de centro de custo e o contrato de saída com estado. Apontar as ambiguidades para `DECISIONS.md`.

## T2 — Registrar decisões

D1 a D12. Incluir o que a v4 invalida e o fato de o repositório da v3 não ter vindo no gist.

## T3 — Carregar a política de fora

Ler `politica-v4.json`. Resolver `centro_custo` ou `padrao`. Tratar limite 0 como não reembolsável. Não manter tabela de limite no código.

## T4 — Câmbio pela data da despesa

Ler `cambio.json`. Converter com a taxa da data ou com a última data anterior que tenha a moeda. Reprovar `GBP` e data sem histórico sem abortar o lote. `moeda` ausente = `BRL`.

## T5 — Motor de reembolso

Aplicar a ordem da spec: período, vigência, conversão, categoria, limite zero, nota fiscal, teto diário ou diária. Glosa parcial no estouro. Rodar os dois relatórios do envelope.

## T6 — Fila de aprovação manual

Item com valor reembolsável acima de R$ 500,00 fica pendente. Totais separam aprovado e pendente.

## T7 — Relatório do caminho

Anotar arquivos escritos à mão, o que a separação política/câmbio/motor absorveu e o que precisou de regra nova.
