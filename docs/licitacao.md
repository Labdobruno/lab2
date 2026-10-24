# Operação de licitação (pack `licitacao-b2b`)

Assessoria que ajuda empresas a participar de licitações: venda consultiva, ciclo longo, diagnóstico antes da proposta e honorário recorrente (mensal, com parte no êxito).

## O funil

`Lead → Em contato → Qualificado (tem licitação no radar) → Diagnóstico agendado → Diagnóstico realizado → Análise de editais e habilitação → Escopo definido → Proposta enviada → Negociação → Contrato fechado | Perdido`

"Análise de editais e habilitação" não tem equivalente canônico (papel `intermediaria`): aparece no funil, mas não entra nas taxas de conversão. Todas as outras etapas têm papel, então as métricas são calculadas do mesmo jeito que na solar.

Pós-venda: onboarding, ativo, renovação, expansão e cancelamento. A receita é tratada como **recorrente mensal** (`cs.recorrente`), então churn, retenção líquida e LTV valem.

## O que o pack ajusta em relação ao `base`

- **Ciclo longo:** janela histórica de 365 dias e coorte "madura" em 90 dias (na solar, 180 e 30).
- **Canais:** parceiros (contadores e advogados), eventos e palestras, LinkedIn.
- **Motivos de perda:** sem licitações no momento, faz internamente, empresa sem condição de habilitação, honorário ou êxito acima do esperado.
- **Condições de pagamento:** honorário mensal e parte no êxito. Linha de custo: horas da equipe.
- **Hipóteses próprias:** receita recorrente encolhendo e propostas que não viram negociação (somam-se às 8 do `base`).
- **Margens e impostos:** o pack **não** define margem-alvo, margem mínima, desconto máximo nem alíquotas. Informe os custos de cada venda (coluna `custo_equipe` etc.); se quiser metas de margem, ajuste em `precificacao` da operação.

## Como alimentar com dados

Não há uma fonte única definida para a licitação, então não foi criado um conector específico. As duas portas genéricas já cobrem qualquer sistema:

1. **Planilhas (CSV):** aba **Operações** da tela → *Importar*. Exemplos prontos, com dados fictícios, em [`docs/exemplos/licitacao/`](exemplos/licitacao/): `pessoas`, `negocios`, `atividades`, `investimentos`, `contratos`. As colunas estão em [`conectores.md`](conectores.md). Canais, etapas e motivos podem vir pelo **nome** ("Indicação", "Diagnóstico realizado", "Faz internamente"); o que não casar com o pack é criado como "a revisar" e aparece na saúde do conector.
2. **Webhook canônico** (n8n, Make, Zapier, script): conector `canonico`, que recebe os comandos já no formato do LAB (veja `conectores.md`). Serve para ligar o CRM que a assessoria usar sem escrever código novo.

Se um dia a fonte for um sistema com API própria, o caminho é o de sempre: um conector novo em `packages/conectores/src/fontes/`, que só traduz para comandos canônicos.

## Datas e fuso

Datas sem horário (`01/07/2026`) valem **à meia-noite do fuso da operação** (São Paulo, por padrão). Antes dessa correção elas eram gravadas em UTC e o negócio do primeiro dia do mês podia cair no mês anterior nas métricas.

## Passo a passo

1. Tela → **Operações** → *Nova operação* → pack "Assessoria de licitação B2B".
2. **Equipe e metas:** cadastre as pessoas e as metas do ciclo (ou planeje o quarter na aba **Quarter** e trave o plano).
3. **Operações** → *Importar* os CSV, na ordem: pessoas, negócios, atividades, investimentos, contratos (a tela já ordena).
4. Confira a aba **Dados** (qualidade) e depois **Achados**.
