-- =====================================================================
--  LAB V2 · Onda 7 · Tarefas: a ação concreta com responsável e prazo, criada a partir de um achado, de um sinal do
--  Fechamento do dia, de uma pendência ou à mão. Adiar não apaga o desvio: conta adiamentos e guarda o prazo original.
--  Nada vira tarefa sozinho: toda tarefa nasce de um clique do gestor.
-- =====================================================================
create table lab.tarefa (
  id              uuid primary key default gen_random_uuid(),
  operacao_id     uuid not null references lab.operacao(id) on delete cascade,
  titulo          text not null check (length(titulo) between 3 and 200),
  descricao       text check (length(descricao) <= 2000),
  responsavel_id  uuid references lab.pessoa(id),          -- nulo = o gestor
  negocio_id      uuid references lab.negocio(id) on delete set null,
  prazo           date not null,
  prazo_original  date not null,
  prioridade      text not null default 'normal' check (prioridade in ('alta', 'normal', 'baixa')),
  origem          jsonb not null default '{}'::jsonb,       -- { tipo: achado|sinal|fechamento|pendencia|manual, chave?, data? }
  status          text not null default 'aberta' check (status in ('aberta', 'feita', 'cancelada')),
  adiamentos      int not null default 0,
  terceiro        boolean not null default false,          -- o último adiamento dependeu de terceiro
  ultimo_motivo   text,
  feita_em        timestamptz,
  por             text not null default '',
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index tarefa_operacao_prazo on lab.tarefa (operacao_id, status, prazo);
create index tarefa_responsavel on lab.tarefa (responsavel_id, status);
create trigger tarefa_atualizado before update on lab.tarefa for each row execute function lab.tocar_atualizado_em();

/* tudo o que aconteceu com a tarefa: só acréscimo */
create table lab.tarefa_evento (
  id          bigint generated always as identity primary key,
  operacao_id uuid not null references lab.operacao(id) on delete cascade,
  tarefa_id   uuid not null references lab.tarefa(id) on delete cascade,
  tipo        text not null check (tipo in ('criada', 'adiada', 'feita', 'cancelada', 'reaberta')),
  de          date,
  para        date,
  motivo      text,
  terceiro    boolean,
  por         text not null default '',
  em          timestamptz not null default now()
);
create index tarefa_evento_tarefa on lab.tarefa_evento (tarefa_id, em);
create trigger tarefa_evento_acrescimo before update or delete on lab.tarefa_evento
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

do $$
declare t text;
begin
  foreach t in array array['tarefa', 'tarefa_evento'] loop
    execute format('alter table lab.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on lab.%I from anon', t); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on lab.%I from authenticated', t); end if;
  end loop;
end $$;
