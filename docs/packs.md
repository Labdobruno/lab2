# Packs: como moldar o LAB a um modelo de negócio

Um pack é um arquivo JSON em `packs/` que descreve o que é específico de um modelo de negócio. Ele não tem código, e um pack novo normalmente só declara o que muda em relação a outro.

## Criar um pack em 3 passos

```bash
npm run pack:novo licitacao-b2b                     # cria packs/licitacao-b2b.json herdando de "base"
# edite o arquivo (o editor sugere os campos, por causa do pack.schema.json)
npm run pack:validar licitacao-b2b                  # confere e mostra o pack resolvido
```

Para herdar de outro pack que não seja a base: `npm run pack:novo solar-b2b -- --de solar-b2c`.

Depois de validado, acrescente uma linha em `apps/api/src/catalogo.ts`. O teste avisa se você esquecer.

## Regras de herança

| O que o filho declara | Resultado |
|---|---|
| Um campo simples (`nome`, `calendario.inicioCicloDia`) | Substitui o do pai |
| Um item de lista com `chave` que o pai já tem | Mescla o item. Basta a chave e o que muda: `{ "chave": "tentativa", "nome": "Ligação" }` |
| Um item com `chave` nova | Entra no fim da lista. Aqui o item precisa estar completo |
| `{ "chave": "x", "remover": true }` | Tira o item herdado |
| `etapas` de um funil | Substitui a lista inteira, porque a ordem das etapas importa |

## Partes do pack

| Campo | Para que serve |
|---|---|
| `funis[].etapas[]` | Etapas com `papel` canônico (ver `arquitetura.md`). Use `intermediaria` para etapas sem equivalente. `prazoDias` define quando o negócio "envelhece" |
| `atividades[]` | O esforço: tentativa, contato, agendamento, reunião, visita… `metaDiaria: true` coloca a atividade no plano do dia |
| `canais[]` | Origens, com `tipo` (pago, orgânico, indicação, outbound, parceiro, evento, base). `origemDeLead: false` para follow-up e base. `pai` para agrupar (Meta Ads dentro de Mídia paga) |
| `motivosPerda[]` | Com `grupo` (preço, crédito, timing, concorrência, fit…), para comparar operações |
| `tiposNegocio` | Quais vendas existem: `novo`, `expansao`, `renovacao`, `revenda`, `cross_sell` |
| `precificacao` | Margem-alvo e mínima, desconto máximo, linhas da composição do preço (impostos, custos, comissão) e condições de pagamento com a taxa de cada uma |
| `cs` | Receita recorrente? Periodicidade, janela de renovação e de indicação |
| `calendario` | Feriados (`"BR"`, `"nenhum"` ou lista `MM-DD`), dias úteis, dia de início do ciclo comercial, mês de início do ano |
| `parametros` | Maturação de coorte (dias), amostra mínima, janela histórica. Uma licitação B2B tem ciclo bem mais longo que a solar B2C |
| `textos` | Como chamar as coisas na tela ("Consultor" em vez de "Vendedor") |

## O que o validador confere

- **Erros** (o pack não pode ser usado): chave inválida ou repetida, funil de aquisição sem `ganho` ou `perdido`, papel terminal repetido, canal-pai inexistente, margem mínima maior que a alvo, percentual acima de 1, herança circular.
- **Avisos** (funciona, mas confira): etapas fora da ordem natural do funil, nenhuma atividade com meta diária, primeira etapa que não é `lead`, receita recorrente sem periodicidade.

As mensagens apontam o item pela chave, por exemplo `funis[aquisicao].etapas[visita_ok].papel`, e não pela posição na lista.

## Ajustes por operação

Uma operação pode mudar o pack só para ela, com a mesma linguagem (é como um pack filho anônimo):

```json
POST /admin/operacoes
{ "slug": "amicta", "nome": "Amicta", "packId": "solar-b2c",
  "ajustes": { "precificacao": { "margemAlvo": 0.25, "margemMinima": 0.15 } } }
```

Mudar a precificação gera uma nova versão da política de preço. A anterior continua guardada, para cada venda ser avaliada pela regra do dia em que foi fechada.

## Hipóteses (fase 6)

O pack pode ter uma lista `hipoteses`: o que olhar nos números e quanto custa. Cada uma é só texto, sem código:

```json
{ "chave": "desconto_alto", "titulo": "Descontos acima de 10% estão comendo receita",
  "quando": "desconto_medio > 0.10 && vendas >= amostra_minima",
  "impacto": "receita * desconto_medio / (1 - desconto_medio)",
  "acao": "Rever a alçada de desconto…", "severidade": "media" }
```

- **`quando`** é a condição para a hipótese aparecer; **`impacto`** é o valor em R$ em jogo (opcional). Os dois são fórmulas: números, variáveis, `+ - * /`, `< <= > >= == !=`, `&& || !`, parênteses e `min`, `max`, `abs`, `se(condição, a, b)`.
- As variáveis disponíveis estão em `GET /admin/hipoteses/variaveis` (leads, vendas, taxa_ganho, desconto_medio, cac_medio, churn_receita, valor_parado…). Variável inexistente ou fórmula quebrada é erro ao validar o pack (`npm run pack:validar`).
- Dado ausente é `null` e contamina a conta: a hipótese vai para "sem dados" em vez de disparar ou de contar como zero.
- A herança funciona como nas outras listas: mesma `chave` sobrescreve, chave nova entra, `"remover": true` tira a herdada. Em `parametros`, `orcamentoAtencao` (padrão 3) limita quantos achados aparecem de cada vez, os de maior impacto primeiro.
