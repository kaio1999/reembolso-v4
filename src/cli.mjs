import { readFileSync } from "node:fs";
import { carregarCambio } from "./cambio.mjs";
import { carregarPolitica } from "./politica.mjs";
import { calcularReembolso } from "./reembolso.mjs";

const [politicaPath, cambioPath, despesasPath] = process.argv.slice(2);

if (!politicaPath || !cambioPath || !despesasPath) {
  console.error("uso: node src/cli.mjs <politica.json> <cambio.json> <despesas.json>");
  process.exit(1);
}

const resultado = calcularReembolso({
  politica: carregarPolitica(readFileSync(politicaPath, "utf8")),
  cambio: carregarCambio(readFileSync(cambioPath, "utf8")),
  relatorio: JSON.parse(readFileSync(despesasPath, "utf8")),
});

console.log(JSON.stringify(resultado, null, 2));
