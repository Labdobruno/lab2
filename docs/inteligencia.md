# Inteligência (Onda 6)

A pergunta é "o que merece minha atenção, por quê, e quanto vale corrigir?". O motor de achados v3 porta o `lab_motor.js`/`lab_modelo.js`/`lab_inteligencia.js` da V1 com os testes da V1 como contrato; o V2 acrescenta persistência, marcas com validade e as fontes do modelo canônico.

## O motor (puro, `packages/hipoteses/src/v3/`)

- **Condição de seis parâmetros** (`condicao.ts`): `met, op (AUMENTOU | DIMINUIU | ESTAVEL | ACIMA | ABAIXO), janela, base (anterior | media90 | ano), limiar, banda, amostraMin, histerese{folga, dias, intervalo}, ref`. Métricas aditivas têm a linha de base reduzida à janela; métricas de coorte terminam 30 dias antes de hoje (coorte imatura não entra); `%` varia em p.p., o resto em % relativo; `ESTAVEL` testa a banda antes de tudo. Estados: verdadeiro, falso, insuficiente, ausente.
- **Histerese**: liga quando a condição fecha; só desliga com folga sustentada por 14 dias; sem dado o estado é mantido; não religa antes do intervalo.
- **Confiança** em quatro níveis (alta, média, baixa, não avaliável) por completude, amostra, aderência, rivais ativas, contexto e histórico; a linguagem trava o verbo ("ocorreu junto com", nunca "provocou").
- **Hipóteses** no pack podem ser simples (`quando` em fórmula) ou estruturadas (`condicoes[]`, `essenciais`, `rivais`, `distingue`, `mecanismo`, `tipo`, `dimensao`, `intervencoes`, `requer`). O pack também traz `intervencoes[]` (matriz de efeitos e esforço) e `compostos[]` (achados que emergem de duas hipóteses ativas).
- **Impacto na mesma moeda**: fórmula de texto com `id`, `id_base`, `id_n`; receita vira contribuição pela margem observada (90 dias) ou pela política de preço. Prioridade = impacto × peso da confiança × aderência ÷ esforço (+1 para risco e gargalo).
- **Orçamento de atenção** com marcas do gestor (em tratamento, aceito, não procede): a marca expira quando o impacto cresce 1,5× sobre a referência do dia da marca.
- **Pessoas** (`pessoas.ts`): funil por vendedor e equipe, benchmark por etapa (mediana e quartil superior com n ≥ mínimo), receita potencial isolada por etapa, gargalos, sensibilidade, alertas (gargalo 10 p.p.; oportunidade 1,15× com 0,7× do volume; anomalia 0,75×; tendência do ticket 10%), matriz volume × eficiência, transferência de performance, drill-down com Wilson, leads por etapa, meta reversa.
- **Inteligência aplicada** (`inteligencia.ts`): waterfall de receita e margem, categoria do desvio, acurácia do forecast, build-up faseado, proteção, saúde, contribuição necessária.

## No banco

Migration `20261103000001_inteligencia`: `inteligencia_regra` (calibração, sombra, aposentadoria), `inteligencia_estado` (histerese), `inteligencia_obs` (uma linha por mudança de estado; só acréscimo), `achado_marca` (só acréscimo; a última vale), `contexto_evento` (diário). O medidor (`inteligencia_consultas.ts`) mede cada métrica numa janela sobre negócios, transições, atividades, preços (economia da venda), investimento prorrateado e contratos. Fontes que a operação não tem (recebíveis, caixa, backlog, cancelamentos) respondem "ausente" com explicação e a hipótese diz o que falta. O cron avalia cada operação uma vez por dia; abrir a tela no dia de hoje também persiste.

## API e tela

Rotas em `/admin/operacoes/:slug/inteligencia` (achados, marcas, regras, contexto, acurácia, waterfall, pessoas). Tela **Mais › Inteligência**, quatro perguntas: "O que merece sua atenção?" (cartões dentro do orçamento; cada um abre o canvas de decisão em 10 blocos: problema, evidência, hipótese e confiança, rivais, consequências, restrições, intervenções, simulação, decisão, resultado), "Quem precisa de quê?" (gargalo principal, alertas, funil com benchmark e potencial, pessoas, matriz, sensibilidade; página da pessoa com comparação, transferência e meta reversa; drill-down e leads), "Dá para confiar?" (saúde, acurácia por ciclo encerrado, waterfall do ciclo) e o diário de contexto.

## Decisões

- O motor é agnóstico ao catálogo de métricas: `medir` é injetado, por isso os testes rodam com a biblioteca da V1 inteira.
- Sem margem conhecida, impacto em receita fica em receita e a tela avisa; nenhuma margem padrão escondida.
- Observação só quando o estado muda (não a cada avaliação), para a saúde contar disparos e não execuções.
- A acurácia usa a projeção ajustada gravada no `ref` de cada Fechamento do dia; fechamentos anteriores à Onda 6 não têm o campo e ficam de fora.
