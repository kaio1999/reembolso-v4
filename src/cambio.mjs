export function carregarCambio(conteudo) {
  const cambio = typeof conteudo === "string" ? JSON.parse(conteudo) : conteudo;
  if (!cambio?.taxas || typeof cambio.taxas !== "object") {
    throw new Error("cambio sem taxas");
  }
  if (!cambio.moeda_base) throw new Error("cambio sem moeda base");
  return cambio;
}

export function normalizarMoeda(moeda, moedaBase) {
  if (moeda == null || String(moeda).trim() === "") return moedaBase;
  return String(moeda).trim().toUpperCase();
}

export function resolverTaxa(cambio, data, moeda) {
  if (moeda === cambio.moeda_base) {
    return { taxa: null, dataTaxa: null, origem: null };
  }

  const datas = Object.keys(cambio.taxas).sort();
  const moedaExiste = datas.some((dia) => cambio.taxas[dia]?.[moeda] != null);
  if (!moedaExiste) return { erro: "moeda_sem_cotacao" };

  if (cambio.taxas[data]?.[moeda] != null) {
    return { taxa: cambio.taxas[data][moeda], dataTaxa: data, origem: "data_despesa" };
  }

  let anterior = null;
  for (const dia of datas) {
    if (dia < data && cambio.taxas[dia]?.[moeda] != null) anterior = dia;
  }
  if (!anterior) return { erro: "taxa_indisponivel" };

  return {
    taxa: cambio.taxas[anterior][moeda],
    dataTaxa: anterior,
    origem: "dia_util_anterior",
  };
}
