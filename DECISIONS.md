# Decisões — Envelope v4

O gist contém o comunicado, `politica-v4.json`, `cambio.json` e dois relatórios. Não há `spec.md`, `tasks.md` nem código da v3. As tasks desta entrega começam em T1. Requisitos da v3 que não aparecem aqui não foram reconstituídos de memória.

## O que a v4 invalida

| Requisito anterior (inferido pelo comunicado) | Efeito |
| --- | --- |
| Limite único, constante no código | Invalido. A tabela vem de `politica-v4.json` e pode mudar sem deploy |
| Uma política para a empresa inteira | Invalido. A tabela é por centro de custo, com `padrao` para quem não tem chave |
| Despesa sempre em BRL | Invalido. `moeda` opcional, conversão pela taxa da data |
| Resultado = um valor, se o item C for adotado | Invalido. Cada item tem estado |

Tasks refeitas: carregamento da política, avaliação de limite, contrato de saída. Tasks que não existiam: câmbio e fila de aprovação.

## D1 — O que é "política padrão"

**Decisão.** `padrao` no JSON é a política padrão, lida de fora. Centro de custo sem chave usa essa tabela por completo. Centro com chave usa só as categorias listadas nele. Categoria faltante não herda o padrão.

**Por quê.** O comunicado fala em "entrada na tabela" no nível do centro de custo ("cada um tem a sua tabela"). `CC-ADM` lista alimentação e transporte e omite hospedagem: essa omissão é a tabela dele. O limite 0 de `CC-ENG-PLATAFORMA` continua obrigatório, porque zero presente na chave não pode ser lido como "ausente, use o padrão".

**Alternativa rejeitada.** Herdar do padrão as categorias omitidas. Só seria segura se limite 0 fosse tratado como bloqueio explícito — e o comunicado não diz que omissão herda.

## D2 — Taxa da data quando o dia não tem cotação

**Decisão.** Usar a cotação da data exata. Se não existir, usar a data anterior mais recente em `cambio.json` que tenha aquela moeda. Nunca uma data futura. O código não calcula feriado nem fim de semana; o arquivo já omite esses dias.

**Por quê.** A observação do câmbio diz que a PTAX sai só em dia útil bancário. A despesa de sábado `e-004` (`2026-07-18`, EUR 30) é um lançamento válido. A taxa em vigor nessa data é a última publicada, `2026-07-17`, EUR 5,96. Um feriado que o financeiro deixe de fora do JSON segue a mesma regra, sem calendário hardcoded.

**Alternativa rejeitada.** Reprovar a despesa sem taxa no dia exato. Zera um lançamento legítimo de fim de semana. Também foi rejeitado usar a taxa do dia seguinte: ela ainda não era a taxa daquela data.

## D3 — Moeda sem linha no câmbio

**Decisão.** `GBP` (item `e-006`) não está no arquivo. O item fica `reprovado`, motivo `moeda_sem_cotacao`, reembolso zero, e o lote segue. Se a moeda existe no arquivo só depois da data da despesa, o motivo é `taxa_indisponivel`.

**Por quê.** Inventar taxa, ou derrubar o relatório inteiro por um item, esconde as outras despesas do gestor.

## D4 — Sentido da taxa e arredondamento

**Decisão.** A PTAX de fechamento é quantos BRL compram 1 unidade da moeda. `valor_brl = valor × taxa`, meio para cima, 2 casas. A comparação com limite e com a nota fiscal usa esse valor já arredondado.

## D5 — "Diária" sem quantidade de noites

**Decisão.** Periodicidade `diaria` limita cada lançamento ao teto de uma diária. A descrição "Hotel Londres - 3 noites" não é quantidade. Periodicidade `dia` soma os lançamentos da mesma categoria na mesma data, na ordem do arquivo.

**Por quê.** Não há campo numérico de noites. Ler "3" da frase também leria "Hotel 3 estrelas". No `e-007` o reembolsável fica R$ 400,00 (teto do comercial), com glosa de R$ 800,00.

## D6 — Estouro de teto

**Decisão.** O estouro glosa a diferença e reembolsa até o limite restante. Não reprova o lançamento inteiro. Limite 0 é outra regra (`nao_reembolsavel`), não é glosa.

## D7 — Nota fiscal

**Decisão.** O campo `nota_fiscal_obrigatoria_acima_de` (R$ 100,00) continua valendo porque está na política externa. Exigência quando `valor_brl > 100` e `tem_nota_fiscal !== true`. Sem nota, o item inteiro é reprovado — a regra é obrigatoriedade, não um segundo teto de R$ 100. Ausência do campo conta como sem nota.

**Efeito no envelope.** `e-003` converte para R$ 85,26 e passa sem nota. `e-005` converte para R$ 220,00, sem nota, e é reprovado. O teto de transporte (R$ 150) nem chega a ser aplicado.

## D8 — Acréscimo de viagem de 50%

**Decisão.** O percentual é lido e preservado. Não muda nenhum limite.

**Por quê.** O comunicado não define o gatilho. O lançamento não tem flag de viagem. Tratar "moeda ≠ BRL" como viagem mudaria o `e-002` de R$ 90,00 para R$ 130,46 (22 × 5,93 = 130,46, e 90 × 1,5 = 135). Isso seria uma política nova, não uma leitura do arquivo.

## D9 — Vigência e período

**Decisão.** Data anterior a `vigencia` é `fora_de_vigencia`. Data fora de `periodo.inicio/fim` é `fora_do_periodo`. Não há arquivo da v3 para aplicar na data antiga.

## D10 — Fila de aprovação (item C, feito)

**Decisão.** Valor reembolsável maior que R$ 500,00 fica `pendente_aprovacao` e entra em `pendente_brl`, fora de `aprovado_brl`. R$ 500,00 exatos seguem aprovados. O limiar mora num único lugar (`LIMIAR_APROVACAO_MANUAL_CENTAVOS`), porque o RH o escreveu no comunicado e não no JSON.

**Efeito no envelope.** Depois do teto, nenhum item dos dois relatórios passa de R$ 500,00. O hotel de R$ 1.200,00 reembolsa R$ 400,00 e continua automático. A fila existe e está coberta por teste sintético.

## D11 — Centro de custo ausente no relatório

**Decisão.** Chave desconhecida na política (`CC-SUPORTE-N2`) usa o padrão. Campo `centro_custo` faltando no colaborador aborta o lote. São situações diferentes: uma é política de fallback, a outra é entrada inválida.

## D12 — Categoria fora da tabela

**Decisão.** `coworking` e qualquer categoria sem linha na tabela resolvida são `categoria_nao_coberta`, reembolso zero. O motor não tem lista branca de categorias no código: a chave no JSON é a cobertura.
