# Análise do LAB V1 (leitura, sem alterar nada da Amicta)

Sete relatórios, um por frente, escritos a partir do código completo do LAB V1 (commit c0c2f22, 24/10/2026) e dos testes que o Bruno enviou. Cada um explica, nesta ordem: para que serve, telas, dados, **regras e fórmulas exatas** (com função e linha), o que os testes garantem, comparação com o V2, o que uma planilha não entrega e riscos ao portar.

O resumo e o plano estão em [`../mapa-v1-v2.md`](../mapa-v1-v2.md). Estes relatórios são a especificação detalhada para quando cada parte for reconstruída.

| Arquivo | Frente |
|---|---|
| [A-planejamento-e-semana.md](A-planejamento-e-semana.md) | Planejamento do mês, build-up, projeção, sinais, relatório e projeção da semana |
| [B-quarter-objetivos-metas.md](B-quarter-objetivos-metas.md) | Quarter em 6 fases, objetivos, cenários, metas oficiais por ciclo |
| [C-fechamento-do-ciclo.md](C-fechamento-do-ciclo.md) | Fechamento do ciclo (relatório de 13 seções) e validação |
| [D-studio-gtm-construtor.md](D-studio-gtm-construtor.md) | GTM & Revenue Studio, campanhas, construtor de hipóteses, biblioteca |
| [E-motor-de-achados-modelo-paineis.md](E-motor-de-achados-modelo-paineis.md) | Casca em trilhas, motor de achados, modelo, inteligência, painéis |
| [F-fechamento-do-dia-contingencia.md](F-fechamento-do-dia-contingencia.md) | Fechamento do dia (17h30), contingência, worker |
| [G-economia-da-venda.md](G-economia-da-venda.md) | Política de preço, margem, receita líquida, comissão, "fonte única", classificação dos testes |

Limites da leitura: o código enviado não inclui alguns módulos que o LAB usa (`gestao.js`, `esforco.js`, o forecast `labForecast`, o motor do Plano do dia `pdm*`, parte da precificação como `precCapital`/`margemVenda`) nem o documento "Briefing Master" citado como "§" nos comentários. Onde um número depende deles, o relatório avisa.
