import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { carregarCambio } from "../src/cambio.mjs";
import { reaisParaCentavos, centavosParaReais, converterParaBrl } from "../src/money.mjs";
import { carregarPolitica } from "../src/politica.mjs";
import { calcularReembolso } from "../src/reembolso.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const politica = carregarPolitica(readFileSync(path.join(root, "politica-v4.json"), "utf8"));
const cambio = carregarCambio(readFileSync(path.join(root, "cambio.json"), "utf8"));

function relatorio(centro, despesas, periodo = { competencia: "2026-07", inicio: "2026-07-01", fim: "2026-07-31" }) {
  return {
    colaborador: { id: "t", nome: "Teste", centro_custo: centro },
    periodo,
    despesas,
  };
}

function despesa(parcial) {
  return {
    id: "x",
    data: "2026-07-14",
    categoria: "alimentacao",
    descricao: "teste",
    fornecedor: "teste",
    valor: 10,
    tem_nota_fiscal: true,
    ...parcial,
  };
}

function porId(resultado) {
  return Object.fromEntries(resultado.itens.map((item) => [item.id, item]));
}

test("converte com meio para cima em duas casas", () => {
  assert.equal(centavosParaReais(converterParaBrl(reaisParaCentavos(22), 5.93)), "130.46");
  assert.equal(centavosParaReais(converterParaBrl(reaisParaCentavos(14.5), 5.88)), "85.26");
  assert.equal(centavosParaReais(converterParaBrl(reaisParaCentavos(12), 5.48)), "65.76");
});

test("CC-COMERCIAL: representacao, cambio, sabado, nota, gbp e coworking", () => {
  const entrada = JSON.parse(readFileSync(path.join(root, "despesas-envelope.json"), "utf8"));
  const resultado = calcularReembolso({ politica, cambio, relatorio: entrada });
  const itens = porId(resultado);

  assert.equal(resultado.politica_origem, "centro_custo");
  assert.equal(resultado.acrescimo_aplicado, false);
  assert.equal(itens["e-001"].valor_reembolsavel, "300.00");
  assert.equal(itens["e-001"].motivo, "glosa_teto");
  assert.equal(itens["e-001"].estado, "aprovado");

  assert.equal(itens["e-002"].valor_brl, "130.46");
  assert.equal(itens["e-002"].taxa, "5.93");
  assert.equal(itens["e-002"].data_taxa, "2026-07-14");
  assert.equal(itens["e-002"].valor_reembolsavel, "90.00");

  assert.equal(itens["e-003"].valor_brl, "85.26");
  assert.equal(itens["e-003"].valor_reembolsavel, "85.26");
  assert.equal(itens["e-003"].motivo, null);

  assert.equal(itens["e-004"].data_taxa, "2026-07-17");
  assert.equal(itens["e-004"].taxa_origem, "dia_util_anterior");
  assert.equal(itens["e-004"].taxa, "5.96");
  assert.equal(itens["e-004"].valor_brl, "178.80");
  assert.equal(itens["e-004"].valor_reembolsavel, "90.00");

  assert.equal(itens["e-005"].motivo, "nota_fiscal_obrigatoria");
  assert.equal(itens["e-005"].valor_brl, "220.00");
  assert.equal(itens["e-005"].valor_reembolsavel, "0.00");

  assert.equal(itens["e-006"].motivo, "moeda_sem_cotacao");
  assert.equal(itens["e-006"].valor_brl, null);
  assert.equal(itens["e-006"].estado, "reprovado");

  assert.equal(itens["e-007"].limite_brl, "400.00");
  assert.equal(itens["e-007"].valor_reembolsavel, "400.00");
  assert.equal(itens["e-007"].estado, "aprovado");

  assert.equal(itens["e-008"].valor_reembolsavel, "90.00");
  assert.equal(itens["e-009"].motivo, "categoria_nao_coberta");
  assert.equal(itens["e-010"].moeda, "BRL");
  assert.equal(itens["e-010"].valor_reembolsavel, "88.00");

  assert.equal(resultado.totais.aprovado_brl, "1143.26");
  assert.equal(resultado.totais.pendente_brl, "0.00");
  assert.equal(resultado.totais.solicitado_brl, "2457.52");
  assert.equal(resultado.totais.nao_reembolsado_brl, "1314.26");
  assert.equal(resultado.totais.itens_sem_conversao, 1);
});

test("centro ausente da tabela usa o padrao e nao ganha representacao", () => {
  const entrada = JSON.parse(readFileSync(path.join(root, "despesas-envelope-cc-desconhecido.json"), "utf8"));
  const resultado = calcularReembolso({ politica, cambio, relatorio: entrada });
  const itens = porId(resultado);

  assert.equal(resultado.politica_origem, "padrao");
  assert.equal(itens["f-001"].limite_brl, "60.00");
  assert.equal(itens["f-001"].valor_reembolsavel, "58.00");
  assert.equal(itens["f-002"].limite_brl, "250.00");
  assert.equal(itens["f-002"].valor_reembolsavel, "250.00");
  assert.equal(itens["f-003"].motivo, "categoria_nao_coberta");
  assert.equal(itens["f-004"].valor_brl, "65.76");
  assert.equal(itens["f-004"].valor_reembolsavel, "65.76");
  assert.equal(resultado.totais.aprovado_brl, "373.76");
  assert.equal(resultado.totais.solicitado_brl, "623.76");
});

test("hospedagem da engenharia com limite zero nao volta para o padrao", () => {
  const resultado = calcularReembolso({
    politica,
    cambio,
    relatorio: relatorio("CC-ENG-PLATAFORMA", [
      despesa({ id: "h", data: "2026-07-16", categoria: "hospedagem", valor: 200, moeda: "BRL" }),
    ]),
  });
  assert.equal(resultado.itens[0].motivo, "nao_reembolsavel");
  assert.equal(resultado.itens[0].limite_brl, "0.00");
  assert.equal(resultado.itens[0].valor_reembolsavel, "0.00");
});

test("categoria omitida no centro de custo nao herda o padrao", () => {
  const resultado = calcularReembolso({
    politica,
    cambio,
    relatorio: relatorio("CC-ADM", [
      despesa({ id: "a", data: "2026-07-16", categoria: "hospedagem", valor: 200, moeda: "BRL" }),
    ]),
  });
  assert.equal(resultado.itens[0].motivo, "categoria_nao_coberta");
  assert.equal(resultado.politica_origem, "centro_custo");
});

test("teto diario e compartilhado na ordem do arquivo", () => {
  const resultado = calcularReembolso({
    politica,
    cambio,
    relatorio: relatorio("CC-SUPORTE-N2", [
      despesa({ id: "d1", data: "2026-07-16", valor: 50, moeda: "BRL" }),
      despesa({ id: "d2", data: "2026-07-16", valor: 50, moeda: "BRL" }),
    ]),
  });
  assert.equal(resultado.itens[0].valor_reembolsavel, "50.00");
  assert.equal(resultado.itens[1].valor_reembolsavel, "10.00");
  assert.equal(resultado.itens[1].motivo, "glosa_teto");
});

test("nota fiscal so e exigida acima de 100", () => {
  const abaixo = calcularReembolso({
    politica,
    cambio,
    relatorio: relatorio("CC-SUPORTE-N2", [
      despesa({ id: "n", data: "2026-07-16", categoria: "hospedagem", valor: 100, tem_nota_fiscal: false, moeda: "BRL" }),
    ]),
  });
  const acima = calcularReembolso({
    politica,
    cambio,
    relatorio: relatorio("CC-SUPORTE-N2", [
      despesa({ id: "n", data: "2026-07-16", categoria: "hospedagem", valor: 100.01, tem_nota_fiscal: false, moeda: "BRL" }),
    ]),
  });
  assert.equal(abaixo.itens[0].estado, "aprovado");
  assert.equal(acima.itens[0].motivo, "nota_fiscal_obrigatoria");
});

test("valor reembolsavel acima de 500 fica pendente e 500 segue aprovado", () => {
  const politicaAlta = structuredClone(politica);
  politicaAlta.padrao.hospedagem.limite = 800;
  const base = (valor) => calcularReembolso({
    politica: politicaAlta,
    cambio,
    relatorio: relatorio("CC-SUPORTE-N2", [
      despesa({ id: "p", data: "2026-07-16", categoria: "hospedagem", valor, moeda: "BRL" }),
    ]),
  });

  const noLimite = base(500);
  assert.equal(noLimite.itens[0].estado, "aprovado");
  assert.equal(noLimite.totais.aprovado_brl, "500.00");

  const acima = base(500.01);
  assert.equal(acima.itens[0].estado, "pendente_aprovacao");
  assert.equal(acima.totais.aprovado_brl, "0.00");
  assert.equal(acima.totais.pendente_brl, "500.01");
});

test("moeda que so existe depois da data nao usa taxa futura", () => {
  const resultado = calcularReembolso({
    politica,
    cambio,
    relatorio: relatorio("CC-SUPORTE-N2", [
      despesa({ id: "c", data: "2026-07-01", valor: 10, moeda: "USD" }),
    ]),
  });
  assert.equal(resultado.itens[0].motivo, "taxa_indisponivel");
});

test("centro de custo faltando no relatorio aborta o lote", () => {
  assert.throws(() => calcularReembolso({
    politica,
    cambio,
    relatorio: { colaborador: { id: "t", nome: "Teste" }, periodo: { inicio: "2026-07-01", fim: "2026-07-31" }, despesas: [] },
  }), /centro de custo/);
});
