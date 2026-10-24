-- =====================================================================
--  LAB V2 · Onda 1 · Plano do dia: capacidade, ausências, lançamentos, fotos dos rituais e notas do dia
-- =====================================================================

/* capacidade apontada pelo gestor (toques por dia); sem ela, vale a observada (percentil 80 dos dias com atividade) */
alter table lab.pessoa add column if not exists capacidade_dia int check (capacidade_dia is null or capacidade_dia > 0);

/* ausência (férias, folga, atestado): o dia sai dos dias úteis da pessoa, as metas diárias se redistribuem e o esperado não cobra */
create table lab.pessoa_ausencia (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  pessoa_id     uuid not null references lab.pessoa(id) on delete cascade,
  data          date not null,
  motivo        text,
  criado_em     timestamptz not null default now(),
  unique (pessoa_id, data)
);
create index ausencia_pessoa on lab.pessoa_ausencia (pessoa_id, data);

/* lançamento do administrador no realizado (ex.: ligações feitas fora do sistema): soma ao que veio das fontes, nunca apaga.
   Só acréscimo; desfazer = um lançamento oposto que aponta para o original. */
create table lab.lancamento (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  pessoa_id     uuid not null references lab.pessoa(id) on delete cascade,
  data          date not null,
  indicador     text not null,
  delta         numeric(12,2) not null check (delta <> 0),
  motivo        text not null check (length(motivo) between 5 and 500),
  desfaz_id     bigint references lab.lancamento(id),
  por           text,
  criado_em     timestamptz not null default now()
);
create index lancamento_pessoa on lab.lancamento (pessoa_id, data);
create trigger lancamento_acrescimo before update or delete on lab.lancamento
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

/* foto de cada ritual do dia (manhã, tarde, fim): o que o LAB disse naquele momento, imutável e assinado */
create table lab.dia_foto (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  pessoa_id     uuid references lab.pessoa(id) on delete cascade,    -- nulo = a equipe (visão do gestor)
  data          date not null,
  ritual        text not null check (ritual in ('manha', 'tarde', 'fim')),
  dados         jsonb not null,
  assinatura    text not null,
  versao_regras text not null,
  criado_em     timestamptz not null default now()
);
create unique index dia_foto_unica on lab.dia_foto (operacao_id, coalesce(pessoa_id, '00000000-0000-0000-0000-000000000000'::uuid), data, ritual);
create trigger dia_foto_acrescimo before update or delete on lab.dia_foto
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

/* notas do dia: "não vou fazer hoje" com justificativa, compromisso marcado como feito (ou desmarcado). Só acréscimo: vale a última de cada chave. */
create table lab.dia_nota (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  pessoa_id     uuid not null references lab.pessoa(id) on delete cascade,
  data          date not null,
  tipo          text not null check (tipo in ('justificativa', 'feito', 'desfeito')),
  chave         text not null,
  texto         text check (texto is null or length(texto) <= 1000),
  terceiro      boolean not null default false,
  por           text,
  criado_em     timestamptz not null default now()
);
create index dia_nota_pessoa on lab.dia_nota (pessoa_id, data, chave, id desc);
create trigger dia_nota_acrescimo before update or delete on lab.dia_nota
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

do $$
declare t text;
begin
  foreach t in array array['pessoa_ausencia', 'lancamento', 'dia_foto', 'dia_nota'] loop
    execute format('alter table lab.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on lab.%I from anon', t); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on lab.%I from authenticated', t); end if;
  end loop;
end $$;
