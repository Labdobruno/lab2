# Onda 5: Studio (o modelo da operação) e o construtor "E se…?"

Fonte da V1: `lab_studio_motor.js` (motor `gs*`, com o `studio.test.js` como contrato: ~110 checagens, todas reproduzidas em `packages/studio/test/motor.test.ts`) e `lab_construtor.js` (`lbc*`, sem teste na V1; os números de referência estão em `packages/studio/test/construtor.test.ts`). A V2 tira o vocabulário solar (kWp, kit) e generaliza: o custo da venda é "custo variável (% do ticket)", e a margem vem de `@lab/economia`.

## Onde está

| Tela (menu **Mais**) | Pergunta | API |
|---|---|---|
| **E se…?** | "Se X fosse Y, mantendo Z, qual seria o impacto em W?" · "Quanto X precisa ser para W chegar a K?" · sensibilidade · a mesma pergunta em cada par · guardar a pergunta · virar experimento | `POST …/construtor`, `GET …/construtor/sujeitos`, `GET|POST …/construtor/perguntas`, `POST …/construtor/experimento` |
| **Studio** | Blocos · Conexões · Simular (direto, reverso com inteiros, sensibilidade, cenários lado a lado) · Cenários · Publicar · Monitor (planejado × realizado por coorte) · Prontidão da campanha | `GET|POST …/studio/modelos`, `…/modelos/:nome` (`/publicar`, `/monitor`, `/premissas`, `/arquivar`), `GET …/studio/modelo-observado`, `POST …/studio/preencher`, `POST …/studio/simular-modelo`, `POST …/studio/prontidao` |
| **Funis e campanhas** | o Studio da fase 7 (grafo com fórmulas e campanhas) continua | `…/studio/observado · funis · simular · campanhas` |
| **Quarter › Objetivo** | as taxas do modelo publicado podem virar as premissas do objetivo ("Levar as premissas ao plano") | `POST …/studio/modelos/:nome/premissas` → `quarter_estrategia.doc.premissas` |

Motores puros: `packages/studio/src/motor.ts` (Studio) e `packages/studio/src/construtor.ts` (E se…?). Consultas: `modelo_consultas.ts` e `construtor_consultas.ts`. Tabelas: `lab.studio_modelo` (rascunho que sobe versão; arquiva, não apaga), `lab.studio_publicacao` (só acréscimo), `lab.studio_pergunta`.

## O Studio, em português

**O modelo.** Blocos de 8 tipos (entrada, etapa, decisão, ação, compromisso, resultado, perda, pós-venda) e conexões com taxa de passagem. Cada taxa e volume tem uma **natureza**: histórico, premissa, benchmark, estimativa ou hipótese. Entradas têm volume no período e, opcionalmente, o limite do que a fonte entrega; qualquer bloco pode ter capacidade (o que passa disso vira **fila**); conexões podem ter defasagem em dias; uma conexão de **retorno** é um ciclo controlado (limite de voltas de 1 a 10). Resultados têm ticket e margem.

**Cálculo direto.** Da entrada ao resultado, em passadas: a primeira leva os novos, as seguintes só os retornos. 1.000 leads → 30% → 70% → 50% → 25% = 26,25 vendas e R$ 787.500. O que não sai por nenhuma conexão é perda implícita. Com defasagem e período, o LAB diz quanto do resultado cai dentro do período.

**Cálculo reverso.** Da meta à entrada, com inteiros: 20 vendas pedem 762 leads (761,9 arredondado para cima, nunca 105,0000001 virando 106), 229 agendamentos, 160 reuniões, 80 oportunidades; a meta em R$ vira unidades pelo ticket (610 mil ÷ 30 mil = 21, nunca fração de venda). O pipeline aberto contribui (estoque × rendimento). Capacidade declarada e limite da fonte dizem se a meta **cabe**; sem nada declarado a viabilidade fica "não avaliada", nunca "sim".

**Validações.** ~20 regras: sem entrada, taxa fora de 0–100%, distribuição que não fecha (saídas > 100%), decisão aberta, laço, ciclo sem regra de retorno, retorno explosivo, unidade R$ ligada a contagem, bloco órfão, duplicada, capacidade inválida, **convergência** (uma origem que também alcança a outra pode contar a mesma entidade duas vezes; marcar a conexão como exclusiva silencia). Erro impede o número; aviso diz o que pode distorcer.

**Cenários.** Regras por cima do base (`a:<id>.taxa`, `n:<id>.vol`, `n:<id>.cap`, `n:<id>.ticket`…), cada uma com natureza e nota. O base nunca muda. Comparar lado a lado: resultado, o que precisa entrar, viabilidade e lacunas (taxas faltando, hipóteses não validadas).

**Sensibilidade.** Cada taxa ±5 p.p. (ou a banda histórica informada) e cada entrada ±10%; o esforço para +1 no resultado (0,95 p.p. em oportunidade → venda; 38,1 leads). Premissa sem evidência com efeito acima de 20% do resultado vira alerta.

**Observado por coorte, nunca por fluxo.** O modelo observado monta o funil principal em blocos com as taxas da **coorte** (negócios criados na janela que alcançaram a etapa seguinte ÷ os que alcançaram a etapa), com n; cada negócio conta uma vez. "Preencher pelo histórico" faz o mesmo num modelo desenhado à mão, só onde há vínculo com a etapa, e respeita o resto.

**Publicar.** A fotografia do modelo guardado (com o cenário) que vale de uma data a outra, com alvo e meta. Só acréscimo; republicar cria outra com motivo. A publicação vigente numa data é a mais recente cuja validade contém a data.

**Monitor.** Planejado × realizado por bloco (plano, esperado até hoje pela fração do período e pela defasagem, real) e por conexão (taxa planejada × k de n observado, intervalo de Wilson 95%). Estados: dentro (≥ 90% do esperado), atenção (≥ 75%), fora, bloqueado (entradas acima da capacidade), insuficiente (amostra < 5, volume esperado pequeno, sem vínculo, coorte imatura vira atenção e não fora). Diagnósticos com evidência, consequência em unidades e R$ e o que investigar: entrada baixa, conversão abaixo ("a causa precisa de evidência adicional", nunca atribuída a pessoa), acúmulo pela lei de Little, tempo acima do prazo, perdas concentradas num motivo, dependência de uma origem, canal com volume e pouca passagem, passagem do período > 100% (qualidade de dados), capacidade de entrega, volume insuficiente para a meta (realizado + pipeline × rendimento + entradas que ainda vêm). O principal gargalo é o desvio de maior impacto.

**Prontidão da campanha.** Onze critérios explícitos (público, oferta, demanda, processo, evidência, volume, capacidade, entrega, financeiro, medição, decisão), cada um completo, frágil, pendente ou bloqueador, com o porquê. Sem nota de probabilidade de sucesso.

**Antes × depois.** Duas coortes da mesma conexão: melhora observável só quando os intervalos de 95% não se sobrepõem.

## O construtor "E se…?", em português

**O modelo linear.** leads × passagens do funil = vendas; × ticket = receita; × margem % = margem de contribuição; − marketing − custos fixos = resultado; × calendário de pagamento = caixa. Indicadores por área: Marketing (investimento, impressões, CTR, CPC, conversão clique → lead, CPL), Comercial (leads, conversão entre quaisquer duas etapas `r:i:j` e atalhos agendamento, comparecimento, proposta, fechamento, funil inteiro), Operação (vendedores, leads por vendedor), Receita (ticket, desconto), Financeiro (taxas da condição, margem % do preço, custo variável % do ticket, recebimento no mês, comissão, impostos, custos fixos); resultados (vendas, receita, margem, margem após marketing, resultado operacional, caixa, CAC, ROAS, ticket que preserva a margem, vendas necessárias, ponto de equilíbrio).

**A frase.** "Se [indicador] fosse maior em | menor em | chegasse a | igual a [número + unidade | referência], mantendo [o que fica constante], qual seria o impacto em [resultado]?" Até 6 condições com "E". Referências: o período anterior, a mediana, o quartil superior, a média, o melhor ou o pior dos pares (vendedores ou canais, só os com n ≥ 10), ou um par nomeado. Referência sem venda não vira zero ("ticket não existe lá").

**"Mantendo".** Ticket mantendo a margem % (o custo acompanha) ou o custo por venda (o ganho vai inteiro para a margem); custo variável mantendo o preço ou a margem %; conversão de um trecho com a mudança espalhada por igual, toda na primeira ou toda na última passagem (com o teto de 100% explicado); leads mantendo o investimento (o CPL sobe) ou o CPL (o investimento acompanha). Deduções e desconto saem inteiros da margem. Cada passo é escrito.

**Validações.** Combinações que aplicariam o mesmo efeito duas vezes (mesmo indicador repetido, trechos do funil que se sobrepõem, ticket × desconto, margem × custo variável, leads × vendedores × marketing) são recusadas com a explicação; valores fora de 0–100% ou negativos também.

**Alertas.** Taxas com base pequena (não substituídas por premissa), amostra pequena, margem estimada pela política (nenhuma venda com custo lançado), capacidade (o cenário pede mais leads por mês do que o maior mês dos últimos 12 absorveu) e "o LAB não modela vendedores, entrega e capital de giro para mais vendas".

**Quanto precisa.** Bissecção sobre o indicador até o resultado chegar ao alvo, partindo do cenário simulado; inalcançável diz o limite ("mesmo em 100% o resultado fica em…").

**Fontes do estado medido.** Conversões pela **coorte elegível** (avançou ÷ avançou + perdeu + parou além do prazo; quem está dentro do prazo fica de fora, lead: 5 dias, demais: 2× o prazo da etapa, mínimo 7); ticket pelas vendas do sujeito; margem, comissão, impostos, taxas e custo variável pelas **vendas com custo lançado** (`@lab/economia`), senão pela **política de preço no ticket médio** (margem-alvo), marcada como estimativa; recebimento no mês pelas partes da condição; custos fixos pela política × meses; marketing pelo investimento lançado por canal e mês (leads pagos = dos canais com investimento). Nada é inventado: sem dado, o indicador fica fora da pergunta e o LAB diz o que falta lançar.

**Virar experimento.** A primeira condição vira a métrica do dicionário de hipóteses (conversão → `conv_*`/`passo_*`/`taxa_ganho`, leads, ticket, margem, CPL, CAC) e o alvo; `@lab/hipoteses` mede o baseline hoje e, ao concluir, registra na memória.

## Decisões da V2

- **Coorte, não fluxo**, para toda taxa observada (o `observado` da fase 7 contava fluxo; o modelo observado da Onda 5 conta coorte).
- **Dois motores, uma tela cada:** o construtor linear (perguntas em português para o gestor) e o Studio em blocos (o desenho da operação). O construtor não tenta ser o grafo.
- **Margem pela economia da venda:** o construtor não tem "margem padrão" própria; sem venda com custo lançado usa a política de preço e avisa.
- **`p:fech` é proposta → venda (pode ter duas passagens); `p:neg` é negociação → venda** quando a etapa existe.
- **Publicação imutável com validade; o rascunho é editável** (sobe versão). Arquivar em vez de apagar.

## Testes

`packages/studio/test/motor.test.ts` (o contrato da V1: direto, reverso com inteiros, decisão, convergência, ciclos e retornos, capacidade, validações, cenários, sensibilidade, defasagem, prontidão, monitor, antes × depois, Wilson, layout), `construtor.test.ts` (derivação, aplicar com os modos "mantendo", alvos e referências, combinações e valores, simulação completa, quanto precisa, sensibilidade, premissas pela política) e `modelo_banco.test.ts` (modelo observado, versões e publicações, coorte real e monitor, premissas ao plano, construtor por sujeito, perguntas e experimento). API: `apps/api/test/api.test.ts`.
