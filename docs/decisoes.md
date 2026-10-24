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
