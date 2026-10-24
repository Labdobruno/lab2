# Registro de decisões

Cada decisão tem o porquê, para não ser refeita sem motivo.

| # | Data | Decisão | Por quê |
|---|---|---|---|
| D1 | 24/10/2026 | O LAB V2 é um projeto novo, em contas pessoais. O CRM e o LAB da Amicta não são tocados | A Amicta é a operação piloto; o V2 é a ferramenta de carreira do Bruno, independente de qualquer empresa |
| D2 | 24/10/2026 | Escopo: receita (demanda, conversão, retenção, expansão) e a eficiência financeira dela | O Bruno é profissional de receita; engenharia, obras, compras e operação de entrega ficam fora |
| D3 | 24/10/2026 | Sem contas a pagar e sem caixa da empresa. Com precificação completa e recebimento por venda e por cliente | Recebimento basta para medir venda boa e ruim, retenção e LTV sem virar ERP |
| D4 | 24/10/2026 | Sem IA: sistema determinístico que alerta | A IA tiraria o aprendizado; o Bruno quer entender o porquê de cada número |
| D5 | 24/10/2026 | Usuário único (o Bruno). O time é registrado como pessoas, sem login | É o "Jarvis" do Bruno; simplifica segurança e telas |
| D6 | 24/10/2026 | Funil borboleta com papéis canônicos de etapa; o que é setorial fica em packs JSON com herança | O mesmo motor precisa servir à solar B2C e à licitação B2B; criar operação nova tem de ser fácil |
| D7 | 24/10/2026 | Pessoas e entidades por id, com vínculo para o id da fonte | Na V1, identidade por nome quebrava o histórico ao renomear alguém |
| D8 | 24/10/2026 | Tudo o que entra é guardado bruto antes de ser traduzido | Reprocessar depois de corrigir um mapeamento; auditar; não depender dos 30 dias de eventos do CRM |
| D9 | 24/10/2026 | Histórico de etapas e política de preço só aceitam acréscimo | Coortes e "venda avaliada pela regra do dia do fechamento" exigem passado imutável |
| D10 | 24/10/2026 | Conectores não gravam telefone, e-mail, endereço nem o texto das notas | Minimizar dado pessoal de clientes de terceiros (LGPD) |
| D11 | 24/10/2026 | Stack: TypeScript, Cloudflare Workers e Supabase Postgres; testes contra um Postgres real com as opções de conexão de produção | É a stack que o Bruno já usa; o teste com as opções reais pegou um bug que só apareceria em produção |
| D12 | 24/10/2026 | Construir base e conectores antes de plugar qualquer operação; aprovado até a segunda operação (licitação) | Decisão do Bruno |

## Login do administrador pelo Supabase Auth

- **Decisão:** a tela entra com e-mail e senha de um usuário do Supabase Auth; só o `ADMIN_EMAIL` é aceito. O `ADMIN_TOKEN` continua valendo para scripts (curl) e como reserva, e pode ser removido quando não for mais necessário.
- **Como:** o Worker repassa e-mail e senha ao Supabase (`/auth/entrar`), e a cada chamada de `/admin` pergunta ao Supabase de quem é o token. A página nunca fala com o Supabase, então a política de segurança da tela continua fechada.
- **Por quê:** senha própria, troca por e-mail, possibilidade de mais usuários e nenhum segredo único repartido.
- **Fora desta etapa:** verificação em duas etapas (MFA) no login.

## Fase 5: quarter, fechamento e migrations automáticas

- **Quarter em 6 passos:** diagnóstico, meta, cenários, esforço necessário, programa de ciclos e compromisso. O passo só avança na ordem; refazer um passo derruba os seguintes; depois de travado, nada muda (gatilho no banco).
- **Cenários:** o conservador converte 15% menos e o otimista 15% mais (teto de 100%); o ticket não muda. Os 15% são uma escolha inicial, ajustável em `packages/ciclos/src/plano.ts`.
- **Travar** grava, para cada ciclo, a meta de receita e a de cada degrau do funil (por operação e por pessoa). São as mesmas metas que o ritmo e o Fechamento do dia leem.
- **Fechar o ciclo** só depois do último dia útil, uma vez por ciclo. O retrato guarda metas, ritmo final e métricas, com assinatura SHA-256; a tela mostra "Íntegro" ou "ALTERADO".
- **Migrations automáticas:** o Worker traz embutidas as migrations (`npm run migracoes:gerar`) e aplica as pendentes, em transação e com trava, na primeira chamada autenticada e a cada rodada do agendamento. Bancos que receberam as duas primeiras à mão são reconhecidos. O `/saude` informa se há migration pendente. Motivo: quem publica o Worker não precisa abrir o SQL Editor do Supabase.

## Fase 6: hipóteses, decisões e qualidade de dados

- **Fórmulas em texto, sem `eval`:** analisador próprio (`packages/nucleo/src/hipoteses/expr.ts`) com lógica de três valores; só aceita a gramática da linguagem, então um pack não executa código.
- **Achado = hipótese verdadeira + impacto em R$ + os números que a provam.** Ordem por impacto; o orçamento de atenção (3 por padrão) esconde o resto em "em espera".
- **Canvas de decisão** só acrescenta. **Experimento** guarda o ponto de partida no dia em que começa; ao concluir mede o valor de hoje contra o alvo e escreve o resultado em `lab.aprendizado` (memória comercial). Encerrado, não muda mais.
- **Operações antigas:** se o pack guardado na operação não tem a biblioteca, o Worker a resolve de novo pelo pack e pelos ajustes da operação.
- **Correção importante:** o driver do Postgres não converte listas (`text[]`) quando `fetch_types` está desligado, como no pooler do Supabase. Consultas passam a devolver `jsonb`. Isso corrigiu as etapas já alcançadas nas coortes da fase 2.

## Fase 8: segunda operação (licitação)

- **Pack, sem conector novo:** a fonte de dados da licitação não está definida. Em vez de inventar um conector, o pack usa as portas genéricas (planilha e webhook canônico), com planilhas de exemplo e um teste que importa todas e confere as métricas.
- **Sem números de negócio inventados:** o pack não fixa margem, desconto máximo nem impostos.
- **Tela de Operações:** criar operação (escolhendo o pack) e importar CSV pelo navegador, com os arquivos aplicados na ordem certa.
- **Correção de fuso:** datas sem horário e horários sem fuso vindos de planilha passam a valer no fuso da operação (`packages/conectores/src/fuso.ts`). O teste da licitação revelou que o negócio do dia 1º caía no mês anterior.

## Fase 7: Studio (funis em grafo e campanhas)

- **Funil em grafo:** nós (etapas, vendas, perdas) e arestas com taxa de passagem; sem ciclos. O **observado** sai das passagens reais do histórico (taxa = passagens ÷ saídas da etapa); voltas a etapas anteriores são ignoradas e contadas. Com todas as saídas resolvidas, o modelo reproduz as vendas reais (há teste).
- **Um só motor:** a taxa de uma aresta, o CPL, o ticket e a margem de uma campanha podem ser número ou **fórmula**, na mesma linguagem e com as mesmas variáveis das hipóteses (`packages/nucleo/src/hipoteses`). Dado ausente é `null` e a simulação recusa em vez de assumir zero.
- **Alavancas:** para cada passagem, +5 pontos de conversão, tirados primeiro do que está parado na etapa e depois das saídas para "perdido", de modo que as saídas continuam somando 100%. As que mais rendem em vendas aparecem primeiro.
- **Funis desenhados** são versionados (cada gravação é uma versão nova; só acréscimo).
- **Campanha:** orçamento ÷ CPL = leads → funil → vendas, receita, CAC, ROI e margem. O plano é uma fotografia (o banco impede mudar). O andamento só avança (planejada → rodando → encerrada). Ao encerrar, mede o realizado (leads do canal criados no período, vendas e receita deles) e escreve plano × realizado na memória comercial. O investimento realizado vem do que você informar ao encerrar; sem isso, dos lançamentos mensais do canal nos meses da campanha, o que pode incluir outras campanhas do mesmo canal.
- **Tela:** o grafo é desenhado em SVG, sem biblioteca. Quando a tela é redesenhada, as buscas da versão anterior são descartadas, para duas atualizações seguidas não duplicarem conteúdo.
