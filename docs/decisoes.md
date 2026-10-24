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
