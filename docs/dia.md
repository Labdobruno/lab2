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
