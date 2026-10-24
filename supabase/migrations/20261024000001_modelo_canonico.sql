-- =====================================================================
--  LAB V2 · Modelo canônico
--  Tudo mora no schema "lab", separado por operação (operacao_id).
--  Ninguém acessa estas tabelas pelo navegador: a API (Worker) é a única porta.
--  Por isso a RLS fica ligada SEM políticas (anon e authenticated não leem nada)
--  e o Worker conecta com o papel dono das tabelas.
-- =====================================================================
create schema if not exists lab;

create or replace function lab.tocar_atualizado_em() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;

/* tabelas só de acréscimo: o passado não se reescreve */
create or replace function lab.somente_acrescimo() returns trigger language plpgsql as $$
begin raise exception '% é só de acréscimo: % não é permitido', tg_table_name, lower(tg_op); end $$;

-- ---------------------------------------------------------------------
--  Operação: uma empresa / um projeto de receita, com o seu pack
-- ---------------------------------------------------------------------
create table lab.operacao (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9][a-z0-9_-]*$'),
  nome           text not null,
  pack_id        text not null,
  pack_versao    text not null,
  pack           jsonb not null,               -- o pack resolvido (com herança) em vigor
  ajustes        jsonb not null default '{}',  -- o que a operação muda em relação ao pack
  fuso           text not null default 'America/Sao_Paulo',
  moeda          text not null default 'BRL',
  ativa          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create trigger operacao_atualizado before update on lab.operacao for each row execute function lab.tocar_atualizado_em();

-- ---------------------------------------------------------------------
--  Catálogos da operação (instalados a partir do pack; nunca apagados, só inativados)
-- ---------------------------------------------------------------------
create table lab.funil (
  id           uuid primary key default gen_random_uuid(),
  operacao_id  uuid not null references lab.operacao(id) on delete cascade,
  chave        text not null,
  nome         text not null,
  lado         text not null check (lado in ('aquisicao', 'pos_venda')),
  principal    boolean not null default false,
  ativo        boolean not null default true,
  unique (operacao_id, chave)
);

create table lab.etapa (
  id           uuid primary key default gen_random_uuid(),
  operacao_id  uuid not null references lab.operacao(id) on delete cascade,
  funil_id     uuid not null references lab.funil(id) on delete cascade,
  chave        text not null,
  nome         text not null,
  papel        text not null check (papel in ('lead','contato','qualificado','agendada','realizada','oportunidade','proposta','negociacao','ganho','perdido','onboarding','ativo','renovacao','expansao','churn','intermediaria')),
  ordem        int not null,
  prazo_dias   int,
  ativa        boolean not null default true,
  unique (operacao_id, chave)
);
create index etapa_funil on lab.etapa (funil_id, ordem);

create table lab.tipo_atividade (
  id           uuid primary key default gen_random_uuid(),
  operacao_id  uuid not null references lab.operacao(id) on delete cascade,
  chave        text not null,
  nome         text not null,
  papel        text not null check (papel in ('tentativa','contato','agendamento','reuniao_realizada','no_show','proposta_enviada','follow_up','visita','reuniao_cs','indicacao_pedida','nota','outro')),
  unidade      text,
  meta_diaria  boolean not null default false,
  ativo        boolean not null default true,
  unique (operacao_id, chave)
);

create table lab.canal (
  id              uuid primary key default gen_random_uuid(),
  operacao_id     uuid not null references lab.operacao(id) on delete cascade,
  chave           text not null,
  nome            text not null,
  tipo            text not null check (tipo in ('pago','organico','indicacao','outbound','parceiro','evento','base','outro')),
  origem_de_lead  boolean not null default true,
  pai_id          uuid references lab.canal(id),
  a_revisar       boolean not null default false,   -- criado automaticamente por um conector: confirme o tipo
  ativo           boolean not null default true,
  unique (operacao_id, chave)
);

create table lab.motivo_perda (
  id           uuid primary key default gen_random_uuid(),
  operacao_id  uuid not null references lab.operacao(id) on delete cascade,
  chave        text not null,
  nome         text not null,
  grupo        text not null check (grupo in ('preco','credito','timing','concorrencia','fit','sem_resposta','interno','outro')),
  a_revisar    boolean not null default false,
  ativo        boolean not null default true,
  unique (operacao_id, chave)
);

create table lab.condicao_pagamento (
  id           uuid primary key default gen_random_uuid(),
  operacao_id  uuid not null references lab.operacao(id) on delete cascade,
  chave        text not null,
  nome         text not null,
  taxa         numeric(8,6) not null default 0 check (taxa between 0 and 1),
  a_revisar    boolean not null default false,
  ativo        boolean not null default true,
  unique (operacao_id, chave)
);

-- ---------------------------------------------------------------------
--  Pessoas do time (identificadas por id, nunca pelo nome)
-- ---------------------------------------------------------------------
create table lab.pessoa (
  id             uuid primary key default gen_random_uuid(),
  operacao_id    uuid not null references lab.operacao(id) on delete cascade,
  nome           text not null,
  email          text,
  funcao         text check (funcao in ('sdr','closer','ambos','cs','gestor','outro')),
  ativa          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create trigger pessoa_atualizado before update on lab.pessoa for each row execute function lab.tocar_atualizado_em();
create index pessoa_operacao on lab.pessoa (operacao_id);

-- ---------------------------------------------------------------------
--  Contas (clientes) e negócios
-- ---------------------------------------------------------------------
create table lab.conta (
  id             uuid primary key default gen_random_uuid(),
  operacao_id    uuid not null references lab.operacao(id) on delete cascade,
  nome           text not null,
  tipo_pessoa    text check (tipo_pessoa in ('pf','pj')),
  segmento       text,
  cidade         text,
  uf             text,
  dono_cs_id     uuid references lab.pessoa(id),
  criado_em      timestamptz not null default now(),
  atributos      jsonb not null default '{}',
  atualizado_em  timestamptz not null default now()
);
create trigger conta_atualizado before update on lab.conta for each row execute function lab.tocar_atualizado_em();
create index conta_operacao on lab.conta (operacao_id);

create table lab.negocio (
  id                    uuid primary key default gen_random_uuid(),
  operacao_id           uuid not null references lab.operacao(id) on delete cascade,
  conta_id              uuid references lab.conta(id),
  funil_id              uuid not null references lab.funil(id),
  tipo                  text not null default 'novo' check (tipo in ('novo','expansao','renovacao','revenda','cross_sell')),
  canal_id              uuid references lab.canal(id),
  dono_id               uuid references lab.pessoa(id),
  etapa_id              uuid not null references lab.etapa(id),
  etapa_desde           timestamptz,
  status                text not null default 'aberto' check (status in ('aberto','ganho','perdido')),
  valor_estimado        numeric(14,2),
  valor_fechado         numeric(14,2),
  criado_em             timestamptz not null,
  fechado_em            timestamptz,
  motivo_perda_id       uuid references lab.motivo_perda(id),
  fonte_atualizado_em   timestamptz,          -- versão da fonte: um dado mais velho nunca sobrescreve um mais novo
  atributos             jsonb not null default '{}',
  atualizado_em         timestamptz not null default now()
);
create trigger negocio_atualizado before update on lab.negocio for each row execute function lab.tocar_atualizado_em();
create index negocio_operacao_criado on lab.negocio (operacao_id, criado_em);
create index negocio_operacao_fechado on lab.negocio (operacao_id, fechado_em) where status <> 'aberto';
create index negocio_conta on lab.negocio (conta_id);

/* histórico de etapas: a base das coortes e das conversões. Só acréscimo. */
create table lab.negocio_transicao (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  negocio_id    uuid not null references lab.negocio(id) on delete cascade,
  de_etapa_id   uuid references lab.etapa(id),
  para_etapa_id uuid not null references lab.etapa(id),
  em            timestamptz not null,
  dono_id       uuid references lab.pessoa(id),
  origem        text not null check (origem in ('evento','inferida','importada')),
  registrado_em timestamptz not null default now(),
  unique (negocio_id, para_etapa_id, em)
);
create index transicao_operacao_em on lab.negocio_transicao (operacao_id, em);
create trigger transicao_acrescimo before update or delete on lab.negocio_transicao
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

-- ---------------------------------------------------------------------
--  Esforço: atividades por pessoa
-- ---------------------------------------------------------------------
create table lab.atividade (
  id             uuid primary key default gen_random_uuid(),
  operacao_id    uuid not null references lab.operacao(id) on delete cascade,
  tipo_id        uuid not null references lab.tipo_atividade(id),
  pessoa_id      uuid references lab.pessoa(id),
  negocio_id     uuid references lab.negocio(id) on delete set null,
  conta_id       uuid references lab.conta(id) on delete set null,
  em             timestamptz not null,
  quantidade     int not null default 1 check (quantidade > 0),
  resultado      text,
  atributos      jsonb not null default '{}',
  registrado_em  timestamptz not null default now()
);
create index atividade_operacao_em on lab.atividade (operacao_id, em);
create index atividade_pessoa_em on lab.atividade (pessoa_id, em);

-- ---------------------------------------------------------------------
--  Marketing: investimento por canal e mês
-- ---------------------------------------------------------------------
create table lab.investimento_canal (
  operacao_id       uuid not null references lab.operacao(id) on delete cascade,
  canal_id          uuid not null references lab.canal(id),
  mes               date not null check (extract(day from mes) = 1),
  valor             numeric(14,2) not null check (valor >= 0),
  impressoes        bigint,
  cliques           bigint,
  leads_plataforma  int,
  atualizado_em     timestamptz not null default now(),
  primary key (canal_id, mes)
);
create trigger investimento_atualizado before update on lab.investimento_canal for each row execute function lab.tocar_atualizado_em();

-- ---------------------------------------------------------------------
--  Precificação: política versionada e o histórico de preço de cada negócio
-- ---------------------------------------------------------------------
create table lab.politica_preco (
  id               uuid primary key default gen_random_uuid(),
  operacao_id      uuid not null references lab.operacao(id) on delete cascade,
  versao           int not null,
  vigente_desde    timestamptz not null default now(),
  margem_alvo      numeric(8,6),
  margem_minima    numeric(8,6),
  desconto_maximo  numeric(8,6),
  linhas           jsonb not null default '[]',
  condicoes        jsonb not null default '[]',
  observacao       text,
  criado_em        timestamptz not null default now(),
  unique (operacao_id, versao)
);
create trigger politica_acrescimo before update or delete on lab.politica_preco
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

create table lab.preco_negocio (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  negocio_id    uuid not null references lab.negocio(id) on delete cascade,
  momento       text not null check (momento in ('referencia','aprovado','fechado')),
  valor         numeric(14,2) not null check (valor >= 0),
  limite        numeric(14,2),
  condicao_id   uuid references lab.condicao_pagamento(id),
  linhas        jsonb not null default '[]',   -- custos e deduções informados [{chave, valor}]
  em            timestamptz not null,
  registrado_em timestamptz not null default now(),
  unique (negocio_id, momento, em)
);

-- ---------------------------------------------------------------------
--  Lado direito da borboleta: recebimentos, contratos e eventos de CS
-- ---------------------------------------------------------------------
create table lab.recebimento (
  id              uuid primary key default gen_random_uuid(),
  operacao_id     uuid not null references lab.operacao(id) on delete cascade,
  negocio_id      uuid references lab.negocio(id) on delete set null,
  conta_id        uuid references lab.conta(id) on delete set null,
  descricao       text,
  valor_previsto  numeric(14,2),
  previsto_em     date,
  valor_recebido  numeric(14,2),
  recebido_em     date,
  status          text not null check (status in ('previsto','pago','parcial','atrasado','cancelado','estornado')),
  atualizado_em   timestamptz not null default now()
);
create trigger recebimento_atualizado before update on lab.recebimento for each row execute function lab.tocar_atualizado_em();
create index recebimento_operacao on lab.recebimento (operacao_id, previsto_em);

create table lab.contrato (
  id                    uuid primary key default gen_random_uuid(),
  operacao_id           uuid not null references lab.operacao(id) on delete cascade,
  conta_id              uuid not null references lab.conta(id),
  negocio_origem_id     uuid references lab.negocio(id) on delete set null,
  recorrente            boolean not null,
  valor_periodo         numeric(14,2) not null check (valor_periodo >= 0),
  periodicidade_meses   int check (periodicidade_meses > 0),
  inicio                date not null,
  fim                   date,
  renovacao_em          date,
  status                text not null check (status in ('ativo','cancelado','encerrado','renovado','suspenso')),
  motivo_cancelamento   text,
  atualizado_em         timestamptz not null default now()
);
create trigger contrato_atualizado before update on lab.contrato for each row execute function lab.tocar_atualizado_em();
create index contrato_conta on lab.contrato (conta_id);

create table lab.evento_cs (
  id            uuid primary key default gen_random_uuid(),
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  conta_id      uuid not null references lab.conta(id),
  tipo          text not null check (tipo in ('onboarding_iniciado','onboarding_concluido','saude','nps','risco','renovado','expandido','reduzido','cancelado','indicacao','outro')),
  em            timestamptz not null,
  valor         numeric(14,4),
  pessoa_id     uuid references lab.pessoa(id),
  atributos     jsonb not null default '{}',
  registrado_em timestamptz not null default now()
);
create index evento_cs_conta on lab.evento_cs (conta_id, em);

-- ---------------------------------------------------------------------
--  Integração: conectores, vínculos de id, entradas brutas e execuções
-- ---------------------------------------------------------------------
create table lab.conector (
  id               uuid primary key default gen_random_uuid(),
  operacao_id      uuid not null references lab.operacao(id) on delete cascade,
  tipo             text not null,                -- 'canonico' | 'planilha' | 'amicta-crm-v1' | …
  nome             text not null,
  config           jsonb not null default '{}',  -- nunca guarda segredo
  segredo_ref      text,                         -- nome da variável de ambiente do Worker com a chave/segredo
  ativo            boolean not null default true,
  cursor           jsonb not null default '{}',  -- até onde a sincronização já leu
  ultimo_sync_em   timestamptz,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  unique (operacao_id, nome)
);
create trigger conector_atualizado before update on lab.conector for each row execute function lab.tocar_atualizado_em();

/* id da fonte → id do LAB, por conector e tipo de coisa */
create table lab.vinculo (
  conector_id  uuid not null references lab.conector(id) on delete cascade,
  entidade     text not null,
  ref          text not null,
  interno_id   uuid not null,
  criado_em    timestamptz not null default now(),
  primary key (conector_id, entidade, ref)
);
create index vinculo_interno on lab.vinculo (interno_id);

/* tudo o que chega, exatamente como chegou: reprocessável e auditável para sempre */
create table lab.entrada_bruta (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  conector_id   uuid not null references lab.conector(id) on delete cascade,
  chave_idem    text not null,                   -- a mesma coisa chegando duas vezes não entra duas vezes
  tipo          text not null,
  payload       jsonb not null,
  recebido_em   timestamptz not null default now(),
  status        text not null default 'pendente' check (status in ('pendente','aplicado','ignorado','erro')),
  tentativas    int not null default 0,
  erro          text,
  aplicado_em   timestamptz,
  unique (conector_id, chave_idem)
);
create index entrada_pendente on lab.entrada_bruta (conector_id, id) where status in ('pendente','erro');

create table lab.execucao (
  id           bigint generated always as identity primary key,
  conector_id  uuid not null references lab.conector(id) on delete cascade,
  tipo         text not null check (tipo in ('webhook','sincronizacao','importacao','processamento')),
  inicio       timestamptz not null default now(),
  fim          timestamptz,
  status       text not null default 'rodando' check (status in ('rodando','ok','parcial','falhou')),
  recebidos    int not null default 0,
  novos        int not null default 0,
  aplicados    int not null default 0,
  erros        int not null default 0,
  detalhe      jsonb not null default '{}'
);
create index execucao_conector on lab.execucao (conector_id, inicio desc);

-- ---------------------------------------------------------------------
--  Acesso: fechado para o navegador
-- ---------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'lab' loop
    execute format('alter table lab.%I enable row level security', t.tablename);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema lab from anon;
    revoke all on all tables in schema lab from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on schema lab from authenticated;
    revoke all on all tables in schema lab from authenticated;
  end if;
end $$;
