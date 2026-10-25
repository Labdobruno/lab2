# Onda 4: economia da venda

Fonte da V1: o motor de Precificação do CRM que o LAB consumia (`precEcon`, `margemVenda`, `comissaoDaMargem`, fórmula de preço) e os testes `receita_liquida`, `comissao`, `fonte_verdade` (§1–2) e `correcoes_negocio` (6.1). A V2 generaliza: **deduções, condições de pagamento e comissão são configuração da política (pack ou publicação da operação); o motor só soma.** Regras da solar (kit fora da base do imposto, cartão 60/40) viram linhas e condições do pack solar, não código. Sem contas a pagar: o custo real é lançado à mão, rotulado.

## Onde está

| Tela (menu **Mais › Economia**) | Pergunta | API |
|---|---|---|
| Painel do período | "Quanto sobra de cada venda?" | `GET …/economia?de=&ate=` |
| Venda a venda | a conta inteira; registrar preço; lançar custo real | `GET …/economia/negocios/:id`, `POST …/preco`, `POST …/custo` |
| Precificador | "qual preço entrega a margem alvo?" | `POST …/economia/precificar` |
| Política de preço | versões; publicar nova versão com motivo | `GET|POST …/economia/politica` |

Motor puro: `packages/economia/src/motor.ts` (dono único de preço, margem, comissão e deduções; o dicionário de métricas aponta para ele). Consultas: `packages/economia/src/consultas.ts`. As métricas (`relatorio`, CAC, ROI, retorno) leem a mesma conta.

## As regras, em português

**A conta de uma venda.** Receita bruta (preço) → menos deduções da política (percentual sobre o preço, com exclusões; valor fixo; ou informado na venda, que vale por cima) → menos taxa e antecipação da condição de pagamento → **líquido antes da comissão** → menos comissão → **receita líquida (RL)**. MC bruta = RL − custos. MC = MC bruta − custo financeiro do prazo (custos × custo do dinheiro ao mês × dias médios de recebimento ÷ 30,4375; as partes da condição dizem quando o dinheiro entra). **MC % é sempre sobre a RL**; a % sobre o preço aparece ao lado, nomeada. RL ≤ 0 → MC % nula, nunca inventada. Exemplo da V1: 100.000 − 10.000 de imposto − 2.000 de taxa − 1.760 de comissão = **86.240** de RL; com 41.000 de custos, 45.240.

**Comissão.** Nenhuma; fixa (sempre a alvo); ou **por margem**: linear entre (margem mínima → comissão mínima) e (margem alvo → comissão alvo), piso na mínima, **sem teto** (24% → 2%; 20% → 1%; 22% → 1,5%; 10% → 1%; 28% → 3%; 32% → 4%). A comissão depende da margem e a margem da comissão: o motor itera (até 60 voltas, amortecimento 0,7, parada em 1e-10). Comissão informada na venda é fixa.

**Preço recomendado e piso.** O motor é invertido por bissecção: o preço que entrega a margem alvo (recomendado) e a mínima (piso), por condição. Ida e volta garantida: a venda fechada exatamente no recomendado tem MC bruta % = margem alvo, e no caso da V1 (kit fora da base do imposto) bate com a fórmula fechada `[Custo ÷ ((1 − m)(1 − c)) − kit] ÷ (1 − t) + kit`.

**Alçada.** Aprovar ou fechar abaixo do piso, ou com desconto acima do máximo sobre o aprovado, **exige motivo**; o LAB diz antes o impacto na MC e grava a exceção (quem, motivo, piso, desconto, impacto) na linha do preço. Nenhuma venda é barrada: a exceção fica visível no painel.

**Política congelada.** Cada preço registrado guarda a versão da política do dia (`preco_negocio.politica_versao`). Mudar a política depois não reescreve vendas feitas; a política é só de acréscimo (cada publicação é uma versão com motivo e autor).

**Previsto × real × efetiva.** Previsto = custos informados na venda. Real = custos lançados à mão (`lab.custo_real`, só acréscimo). Efetiva = real **só quando** um lançamento marca "completo"; antes disso vale a prevista (real parcial não vira efetiva). O erro de orçamento (real − previsto) aparece por venda e agregado.

**Painel.** Margem agregada = Σ MC ÷ Σ RL (não é média). Por vendedor (desconto médio, abaixo do piso, MC perdida no desconto, exceções: "volume sem margem não é resultado"); por canal com investimento, CAC, retorno = MC − investimento e ROI sobre margem ("receita não é lucro"); por condição (MC %, capital exposto, custo do prazo); por faixa de ticket. Contribuição necessária no mês: quanto falta de MC para pagar os custos fixos e para o lucro desejado, em R$ e em vendas pela MC média. Break-even do desconto na venda típica: volEq = MC atual ÷ MC com desconto.

**D21.** CPL, CAC, ROI e retorno de um canal ficam nulos quando falta investimento lançado em algum mês terminado do período, a partir do primeiro mês em que o canal lançou. Mês em curso não cobra lançamento.

## O que o pack configura (`precificacao`)

`margemAlvo`, `margemMinima`, `descontoMaximo`, `custoCapitalMes`, `custosFixosMes`, `lucroDesejadoMes`, `comissao { tipo, alvo, minima }`, `linhas [{ chave, nome, grupo: deducao|custo_variavel|comissao, base: percentual_preco|percentual_liquido|fixo|informado, valor, excluir[], categoria }]`, `condicoes [{ chave, nome, taxa, antecipacao, partes [{ fracao, dias }] }]`. A operação pode publicar versões por cima pela tela.

## Testes

`packages/economia/test/motor.test.ts` (comissão, receita líquida, fórmula e ida e volta, condição 60/40 e custo do dinheiro, alçada, MC perdida, margem agregada, contribuição, break-even, previsto × real, política congelada) e `banco.test.ts` (política publicada, precificador, exceção de alçada, custo real, congelamento, painel e o relatório das métricas lendo a mesma conta).
