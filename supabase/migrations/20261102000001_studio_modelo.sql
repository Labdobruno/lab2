-- =====================================================================
--  LAB V2 · Onda 5 · Studio: modelo de operação em blocos (rascunho editável), publicações imutáveis com validade
--  e perguntas salvas do construtor "e se". O banco só guarda: nenhuma fórmula em SQL.
-- =====================================================================

/* O modelo em blocos e conexões (doc = Modelo do motor do Studio). Editar muda o rascunho e sobe a versão;
   o que vale para comparar com o realizado é a publicação, que nunca muda. */
create table lab.studio_modelo (
  id             uuid primary key default gen_random_uuid(),
  operacao_id    uuid not null references lab.operacao(id) on delete cascade,
  nome           text not null check (length(nome) between 1 and 80),
  doc            jsonb not null default '{}'::jsonb,
  versao         int not null default 1 check (versao >= 1),
  status         text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  por            text not null default '',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (operacao_id, nome)
);
create or replace function lab.studio_modelo_guarda() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('lab.apagando_operacao', true) is distinct from 'sim' then raise exception 'lab.studio_modelo: o modelo não é apagado, é arquivado'; end if;
    return old;
  end if;
  if new.versao < old.versao then raise exception 'lab.studio_modelo: a versão não volta'; end if;
  new.atualizado_em := now();
  return new;
end $$;
create trigger studio_modelo_guarda before update or delete on lab.studio_modelo for each row execute function lab.studio_modelo_guarda();

/* Publicação: a fotografia do modelo (com o cenário escolhido) que vale num período. Só acréscimo. */
create table lab.studio_publicacao (
  id            uuid primary key default gen_random_uuid(),
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  modelo_id     uuid not null references lab.studio_modelo(id) on delete cascade,
  n             int not null check (n >= 1),
  snapshot      jsonb not null,                           -- o doc inteiro no momento da publicação
  cenario       text not null default 'base',
  alvo          text,                                     -- bloco de resultado que recebe a meta
  meta          numeric(14,2),
  validade_de   date not null,
  validade_ate  date not null check (validade_ate >= validade_de),
  motivo        text not null default '',
  por           text not null default '',
  em            timestamptz not null default now(),
  unique (modelo_id, n)
);
create index studio_publicacao_modelo on lab.studio_publicacao (modelo_id, n desc);
create trigger studio_publicacao_acrescimo before update or delete on lab.studio_publicacao
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

/* Perguntas salvas do construtor "e se": a frase guardada para repetir em outro período (é um marcador, não um registro). */
create table lab.studio_pergunta (
  id            uuid primary key default gen_random_uuid(),
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  nome          text not null check (length(nome) between 1 and 120),
  sujeito       text not null default 'equipe',
  periodo       jsonb not null default '{}'::jsonb,       -- { de, ate } ou { ciclos: n } (o período relativo)
  clausulas     jsonb not null default '[]'::jsonb,
  resultado     text not null default 'R',
  por           text not null default '',
  criado_em     timestamptz not null default now()
);
create index studio_pergunta_operacao on lab.studio_pergunta (operacao_id, criado_em desc);

do $$
declare t text;
begin
  foreach t in array array['studio_modelo', 'studio_publicacao', 'studio_pergunta'] loop
    execute format('alter table lab.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on lab.%I from anon', t); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on lab.%I from authenticated', t); end if;
  end loop;
end $$;
