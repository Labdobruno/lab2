# O plano do dia (Onda 1)

A pergunta mais importante do LAB, respondida pela manhã: **o que cada pessoa do time tem que fazer hoje para o dia ser um sucesso frente ao planejamento e à meta do mês?** O mesmo plano é lido três vezes ao dia, nos três rituais de gestão: alinhamento pela manhã, atualização após o almoço e review no fim do dia.

As regras vêm do LAB V1 (`plano_dia_motor.js`, `plano_dia.js`, `producao.js`, `gestao.js`, `esforco.js`); os testes da V1 são o contrato e estão portados com os mesmos números em `packages/dia/test/`.

## Onde está

| Peça | Onde |
|---|---|
| Contas puras (sem banco, sem relógio) | `packages/dia/src/producao.ts` (metas diárias, recuperação, semana, rituais) e `packages/dia/src/motor.ts` (quadrante, viabilidade, negligência, cenários, padrão, gargalo, capacidade) |
| Ações recomendadas e compromissos | `packages/dia/src/acoes.ts` |
| Montagem com os dados da V2 | `packages/dia/src/consultas.ts` |
| Modelo | `supabase/migrations/20261029000001_dia.sql`: `pessoa.capacidade_dia`, `pessoa_ausencia`, `lancamento`, `dia_foto`, `dia_nota` |
| API | `GET /admin/operacoes/:slug/dia?pessoa=&data=&ritual=`, `…/dia/equipe`, `POST …/dia/foto`, `…/dia/nota`, `…/dia/lancamentos` (+ `/:id/desfazer`), `GET|POST …/ausencias`, `POST …/pessoas/:id/capacidade` |
| Tela | aba **Dia** (`apps/api/src/tela_dia.ts`) |

## As regras, em português

**Meta do dia inteira.** A meta do ciclo é distribuída nos dias úteis *da pessoa* (os dias úteis da operação menos as ausências dela) em parcelas inteiras que somam exatamente a meta: `floor(T·(k+1)/du) − floor(T·k/du)`. 22 em 5 dias é 4, 4, 5, 4, 5. Arredondar para cima todo dia (como a V2 fazia) somava mais que a meta.

**Mínimo diário.** Na etapa de atividade principal (SDR: reunião agendada; closer: reunião realizada), nenhum dia útil fica com 0: o que faltar entra como "extra" e aparece. Nunca em oportunidades ou vendas: uma meta de 4 vendas no mês não vira "1 por dia".

**Alvo de hoje = meta de hoje + recuperação.** O atraso acumulado até ontem é dividido em parcelas iguais nos próximos 5 dias úteis (`⌈atraso ÷ 5⌉` por dia). O que faltar hoje vira atraso amanhã e entra aos poucos; o que foi feito a mais abate a meta dos próximos dias. Num dia em que a pessoa não trabalha não há meta nem recuperação.

**Só a atividade de volume é meta do dia** (por padrão `tentativa`, marcada com `metaDiaria` no pack). Os outros indicadores com meta viram **objetivos da semana** (meta da semana + a parte do atraso que cabe nela), com o ritmo legível ("≈ 1 a cada 2 dias úteis").

**Três rituais, três leituras.** Manhã conta hoje como 0% do dia; tarde, 50%; fim, 100%. O "esperado até agora" usa essa fração, e é isso que diz se a pessoa está no ritmo *neste momento*, não só no fim do dia. Pela tela, o ritual padrão segue a hora local; para um dia passado, a leitura é a de fim do dia.

**Situação (quadrante).** Atividade × resultado até hoje: dentro do plano, atraso operacional (atividade abaixo), insuficiência de resultado (atividade em dia, resultado abaixo → conversão ou tempo de ciclo, não volume) ou os dois.

**Viabilidade.** Se a recuperação cabe na capacidade diária (apontada pelo gestor; senão, a observada: percentil 80 dos toques por dia nos últimos 20 dias trabalhados). "Inviável" vira **decisão do gestor**: redistribuir, ampliar capacidade, melhorar conversão ou rever a meta. Sem capacidade, o LAB diz que não sabe.

**Negócios que exigem atenção.** Lead na primeira etapa sem contato registrado (crítico se entrou há menos de 24 h); proposta ou negociação parada há 3 dias; negócio parado há 5 dias ou além do prazo da etapa. Cada um com a ação, o prazo e o valor esperado (valor × chance histórica da etapa, só quando há amostra).

**Ações do dia** em ordem crítica → alta → normal → estratégica. Cada uma diz **por quê**, **o que ganha** (rotulado: projeção do plano, evidência histórica ou hipótese), **o que acontece se não fizer** (o alvo de amanhã sobe para X em vez de Y) e **como medir**. A pessoa pode registrar "não vou fazer hoje" com o motivo (e se é de terceiros); o gestor vê.

**"É um dia de sucesso se…"**: os compromissos do dia (produção, leads sem contato, críticos, objetivos da semana), com marcação de feito. No fim do dia a resposta é direta: "Sim: dia de sucesso" ou "Faltou 2 de 3".

**Padrão recorrente**: abaixo da meta em 7 dos últimos 10 dias úteis não é um dia ruim isolado. **Gargalo**: a taxa mais abaixo da referência (plano, histórico ou equipe), com intervalo de Wilson e confiança. Gargalo em metade da equipe é **sistêmico**, não de uma pessoa.

**Sem dado ≠ zero.** O que a V2 ainda não tem (tarefas, agenda, cadência, próximo passo) aparece como "sem fonte" e não entra no plano.

## Rituais e memória

Cada ritual pode ser **registrado**: uma foto do plano (alvos, feito, compromissos, ações, justificativas) gravada uma vez por pessoa, dia e ritual, assinada (SHA-256) e que o banco impede de alterar. A foto da manhã é o **plano**; a do fim do dia, o **executado**. A tabela "plano × executado" dos últimos dias nasce daí, e o quadro da equipe mostra o cumprimento médio de cada pessoa.

## Ajustes do administrador (tudo só acrescenta)

- **Lançamento**: acréscimo (ou desconto) ao realizado de um dia, com motivo obrigatório; desfaz-se com um lançamento contrário, nunca apagando.
- **Ausência**: dia em que a pessoa não trabalha; a meta do ciclo é redistribuída nos dias que ficam.
- **Capacidade**: toques por dia que a pessoa consegue fazer; vazio usa a observada.
- **Justificativa** e **feito**: notas do dia, por ação ou compromisso, com quem e quando.

## O que ainda não entrou (próximas ondas)

Tarefas e agenda (compromissos com hora), cadência por canal, próximo passo por negócio, pipeline de vendas por pessoa, metas por canal. Quando houver fonte, entram pelos mesmos campos (`fontes`), sem mudar as regras.

---

# Onda 2: "Vamos bater a meta?", a semana e o Fechamento do dia

## Vamos bater a meta? (aba **Meta**)

A resposta vem da **projeção ajustada** do ciclo, lida no ritual escolhido (hoje conta 0, ½ ou 1 dia útil):

| Projeção | Como é calculada |
|---|---|
| Planejada | a meta do ciclo |
| Ritmo atual | realizado + realizado ÷ dias úteis decorridos × dias úteis restantes |
| Histórica | realizado + pipeline aberto × chance da etapa virar venda × chance de fechar a tempo |
| Ajustada | histórica + leads que ainda vão entrar × conversão lead → venda × fração dos ciclos de venda que cabe no que resta |

- **Chance de bater a meta de vendas**: Poisson com média = vendas que ainda devem entrar pela projeção ajustada. Só com amostra de ticket (≥ 10 vendas na janela histórica); senão diz por que não calculou.
- **Fora da curva**: negócio acima de 5× o ticket não sustenta a projeção; aparece à parte com valor e chance.
- **Histórico por coorte**: lead → venda e lead → agendada vêm dos negócios criados numa janela que termina 30 dias atrás (maturação). Ritmo de leads: até o 5º dia útil mistura o ciclo com os últimos 90 dias.
- **Resposta**: ≥ 100% da meta "sim"; ≥ 95% "provável"; ≥ 75% "em risco"; abaixo "não". Com menos de 3 dias úteis, "cedo para dizer".
- **Sinais com veredito**: meta em risco, trajetória (< 85% do esperado; grave < 60%), demanda insuficiente, capacidade por pessoa, conversão × histórico (amostra pequena sai com confiança baixa, nunca some), "atividade em dia, resultado abaixo", dados ausentes. Cada sinal tem a **classe do desvio** (volume feito com taxa baixa nunca vira "falta de esforço") e o **veredito conjunto** evita alertas contraditórios. Incidentes por zona do funil: impacto = o maior, não a soma.
- **Contingência**: régua 100 / 90 / 75 (no ritmo, atenção, contingência, crítico) com três critérios: ritmo (realizado ÷ esperado), projeção (ajustada ÷ meta) e esforço (ritmo necessário ÷ ritmo médio: 1,2× · 1,5× · 2×). Trajetória dia a dia da receita com alvo do dia que fecha exatamente a meta; por vendedor, o alvo de cada etapa até o fim do ciclo; dois dias seguidos abaixo de 90% do alvo = contingência da atividade. Ações são hipóteses; crítico exige decisão com data; a meta nunca é reduzida sozinha.

## Semana (aba **Semana**)

- **Esta semana**: "Onde a semana vai fechar?" Projeção = feito + ritmo × dias úteis que faltam; o ritmo desta semana é puxado para o das 4 semanas anteriores (o histórico pesa como 5 dias úteis). Faixa entre a pior e a melhor das 4 semanas. Situação: batida / vai bater / em risco (≥ 85%) / não bate. "O que precisa acontecer até domingo" com o múltiplo do ritmo normal e a ação do roteiro. "Na mesa": propostas e negociações abertas com a chance histórica (coorte de 150 a 15 dias atrás). Semanas do ciclo: feito / meta.
- **Semana passada**: "O que deu certo e o que deu errado?" Cada indicador contra a meta da semana (≥ 100% bom; < 85% ruim) e contra a média das 4 semanas anteriores (±15% volumes, ±5 p.p. taxas). Taxas da semana são de fluxo, não de coorte. Volume pequeno e amostra pequena são neutros. Causas: volume × ticket, elo anterior do funil, por pessoa e por origem ("mostra onde olhar; não prova a causa"). Roteiro de hipóteses de solução por indicador. "Copiar resumo" para o WhatsApp.

## Fechamento do dia (aba **Fechamento do dia**)

Relatório gerencial gerado **no servidor** pelo cron de 15 min: no primeiro tique depois das **17h30** (fuso da operação; `parametros.fechamento.hora` no pack) gera uma vez; às **23h30** roda mais uma vez para captar registros atrasados; falhou → tenta de novo (até 4). Sem expediente (dia não útil ou todo mundo ausente) não gera. Trava contra duas execuções ao mesmo tempo; cada execução fica em `lab.dia_execucao`.

- **Imutável**: o `original` nunca muda (gatilho no banco); um recálculo com a mesma essência é "sem mudança"; com essência diferente entra como **complemento** com "o que mudou" (ex.: "Tentativas da equipe hoje: 3/11 → 11/11"). A essência (comparações, alertas, situação das pessoas, pendências) é assinada com SHA-256.
- **Nada de fórmula nova**: o relatório só junta o que o plano do dia e o ciclo já calculam. "Sem dado" nunca vira zero; um dia é sinal a investigar.
- Seções: resumo (selo, objetivos atingidos, pessoas com atenção, desvio/avanço/risco/decisão/meta), alertas (nível 2 e 3, com esperado × aconteceu × evidência × confiança × causa), previsto × realizado, deu certo, deu errado, quem precisa de atenção (6 situações: **sem registro ≠ não executou**, bloqueio, falta de execução, resultado, fora do expediente, sem meta), avanços, intervenções (problema, evidência, consequência, ação, responsável, prazo, indicador), metas do ciclo e do quarter, limites da leitura.
- **Recorrência**: o mesmo alerta no 3º relatório seguido sobe de nível e vira "conversa de causa"; a **decisão do gestor** registrada é citada nos dias seguintes se o desvio continuar; desvio que some depois de uma decisão aparece em "deu certo" com "um dia não prova".
- Antes de gravado, a tela mostra a **prévia ao vivo** (não aceita decisões). "Gerar agora" não duplica.
- Ainda sem fonte na V2: tarefas, agenda (no-show), cadência. Entram no relatório como limitação.
