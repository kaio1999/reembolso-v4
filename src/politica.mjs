export function carregarPolitica(conteudo) {
  const politica = typeof conteudo === "string" ? JSON.parse(conteudo) : conteudo;
  if (!politica?.padrao || typeof politica.padrao !== "object") {
    throw new Error("politica sem tabela padrao");
  }
  if (!politica.centros_custo || typeof politica.centros_custo !== "object") {
    throw new Error("politica sem centros de custo");
  }
  if (typeof politica.nota_fiscal_obrigatoria_acima_de !== "number") {
    throw new Error("politica sem limiar de nota fiscal");
  }
  return politica;
}

export function resolverTabela(politica, centroCusto) {
  const propria = politica.centros_custo[centroCusto];
  if (propria) return { origem: "centro_custo", tabela: propria };
  return { origem: "padrao", tabela: politica.padrao };
}

export function categoriaNaoReembolsavel(regra) {
  if (!regra) return false;
  if (Number(regra.limite) === 0) return true;
  return typeof regra.observacao === "string" && /nao reembolsavel/i.test(regra.observacao);
}
