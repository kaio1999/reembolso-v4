import { centavosParaReais, converterParaBrl, reaisParaCentavos } from "./money.mjs";
import { categoriaNaoReembolsavel, resolverTabela } from "./politica.mjs";
import { normalizarMoeda, resolverTaxa } from "./cambio.mjs";

export const LIMIAR_APROVACAO_MANUAL_CENTAVOS = 50000n;

function dentro(data, inicio, fim) {
  return data >= inicio && data <= fim;
}

function itemBase(despesa, extra) {
  return {
    id: despesa.id,
    data: despesa.data,
    categoria: despesa.categoria,
    moeda: extra.moeda ?? null,
    valor_original: extra.valorOriginal ?? null,
    valor_brl: extra.valorBrl ?? null,
    taxa: extra.taxa ?? null,
    data_taxa: extra.dataTaxa ?? null,
    taxa_origem: extra.taxaOrigem ?? null,
    politica_origem: extra.politicaOrigem ?? null,
    limite_brl: extra.limiteBrl ?? null,
    valor_reembolsavel: extra.valorReembolsavel ?? "0.00",
    valor_glosado: extra.valorGlosado ?? null,
    estado: extra.estado,
    motivo: extra.motivo ?? null,
  };
}

function reprovado(despesa, motivo, extra = {}) {
  const valorBrl = extra.valorBrl ?? null;
  return itemBase(despesa, {
    ...extra,
    valorBrl,
    valorReembolsavel: "0.00",
    valorGlosado: valorBrl,
    estado: "reprovado",
    motivo,
  });
}

export function calcularReembolso({
  politica,
  cambio,
  relatorio,
  limiarAprovacaoCentavos = LIMIAR_APROVACAO_MANUAL_CENTAVOS,
}) {
  const centro = relatorio?.colaborador?.centro_custo;
  if (!centro) throw new Error("relatorio sem centro de custo");
  const periodo = relatorio?.periodo;
  if (!periodo?.inicio || !periodo?.fim) throw new Error("relatorio sem periodo");

  const { origem, tabela } = resolverTabela(politica, centro);
  const limiarNota = reaisParaCentavos(politica.nota_fiscal_obrigatoria_acima_de);
  const consumido = new Map();
  const itens = [];

  for (const despesa of relatorio.despesas ?? []) {
    const moeda = normalizarMoeda(despesa.moeda, cambio.moeda_base);
    const valorOriginal = centavosParaReais(reaisParaCentavos(despesa.valor));
    const comum = { moeda, valorOriginal, politicaOrigem: origem };

    if (!dentro(despesa.data, periodo.inicio, periodo.fim)) {
      itens.push(reprovado(despesa, "fora_do_periodo", comum));
      continue;
    }
    if (politica.vigencia && despesa.data < politica.vigencia) {
      itens.push(reprovado(despesa, "fora_de_vigencia", comum));
      continue;
    }
    if (reaisParaCentavos(despesa.valor) <= 0n) {
      itens.push(reprovado(despesa, "valor_invalido", comum));
      continue;
    }

    const taxa = resolverTaxa(cambio, despesa.data, moeda);
    if (taxa.erro) {
      itens.push(reprovado(despesa, taxa.erro, comum));
      continue;
    }

    const valorBrlCent = taxa.taxa == null
      ? reaisParaCentavos(despesa.valor)
      : converterParaBrl(reaisParaCentavos(despesa.valor), taxa.taxa);
    const valorBrl = centavosParaReais(valorBrlCent);
    const convertido = {
      ...comum,
      valorBrl,
      taxa: taxa.taxa == null ? null : centavosParaReais(reaisParaCentavos(taxa.taxa)),
      dataTaxa: taxa.dataTaxa,
      taxaOrigem: taxa.origem,
    };

    const regra = tabela[despesa.categoria];
    if (!regra) {
      itens.push(reprovado(despesa, "categoria_nao_coberta", convertido));
      continue;
    }
    if (!regra.periodicidade) throw new Error(`categoria ${despesa.categoria} sem periodicidade`);

    const limiteCent = reaisParaCentavos(regra.limite);
    const comLimite = { ...convertido, limiteBrl: centavosParaReais(limiteCent) };

    if (categoriaNaoReembolsavel(regra)) {
      itens.push(reprovado(despesa, "nao_reembolsavel", comLimite));
      continue;
    }
    if (valorBrlCent > limiarNota && despesa.tem_nota_fiscal !== true) {
      itens.push(reprovado(despesa, "nota_fiscal_obrigatoria", comLimite));
      continue;
    }

    const chaveTeto = regra.periodicidade === "dia"
      ? `${despesa.data}|${despesa.categoria}`
      : regra.periodicidade === "diaria"
        ? `lancamento|${despesa.id}`
        : null;
    if (!chaveTeto) throw new Error(`periodicidade desconhecida: ${regra.periodicidade}`);

    const usado = consumido.get(chaveTeto) ?? 0n;
    const restante = limiteCent - usado;
    if (restante <= 0n) {
      itens.push(reprovado(despesa, "teto_esgotado", comLimite));
      continue;
    }

    const reembolsavel = valorBrlCent < restante ? valorBrlCent : restante;
    consumido.set(chaveTeto, usado + reembolsavel);
    const glosa = valorBrlCent - reembolsavel;
    const estado = reembolsavel > limiarAprovacaoCentavos ? "pendente_aprovacao" : "aprovado";

    itens.push(itemBase(despesa, {
      ...comLimite,
      valorReembolsavel: centavosParaReais(reembolsavel),
      valorGlosado: centavosParaReais(glosa),
      estado,
      motivo: glosa > 0n ? "glosa_teto" : null,
    }));
  }

  const somar = (estado) => itens
    .filter((item) => item.estado === estado)
    .reduce((total, item) => total + reaisParaCentavos(item.valor_reembolsavel), 0n);

  const solicitado = itens.reduce((total, item) => {
    if (item.valor_brl == null) return total;
    return total + reaisParaCentavos(item.valor_brl);
  }, 0n);
  const aprovado = somar("aprovado");
  const pendente = somar("pendente_aprovacao");

  return {
    politica_versao: politica.versao ?? null,
    acrescimo_em_viagem_percentual: politica.acrescimo_em_viagem_percentual ?? null,
    acrescimo_aplicado: false,
    colaborador: relatorio.colaborador,
    periodo: relatorio.periodo,
    politica_origem: origem,
    itens,
    totais: {
      solicitado_brl: centavosParaReais(solicitado),
      aprovado_brl: centavosParaReais(aprovado),
      pendente_brl: centavosParaReais(pendente),
      nao_reembolsado_brl: centavosParaReais(solicitado - aprovado - pendente),
      itens_sem_conversao: itens.filter((item) => item.valor_brl == null).length,
    },
  };
}
