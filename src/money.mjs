export function reaisParaCentavos(valor) {
  const texto = typeof valor === "number" ? valor.toFixed(2) : String(valor).trim();
  if (!/^-?\d+(\.\d+)?$/.test(texto)) {
    throw new Error(`valor monetario invalido: ${valor}`);
  }
  const negativo = texto.startsWith("-");
  const [inteiro, frac = ""] = texto.replace("-", "").split(".");
  const fracao = `${frac}00`.slice(0, 2);
  const terceiro = frac[2] ?? "0";
  let centavos = BigInt(inteiro) * 100n + BigInt(fracao);
  if (terceiro >= "5") centavos += 1n;
  return negativo ? -centavos : centavos;
}

export function centavosParaReais(centavos) {
  const negativo = centavos < 0n;
  const absoluto = negativo ? -centavos : centavos;
  const inteiro = absoluto / 100n;
  const fracao = (absoluto % 100n).toString().padStart(2, "0");
  return `${negativo ? "-" : ""}${inteiro}.${fracao}`;
}

export function converterParaBrl(valorCentavos, taxa) {
  const taxaCentavos = reaisParaCentavos(taxa);
  const produto = valorCentavos * taxaCentavos;
  return (produto + 50n) / 100n;
}
