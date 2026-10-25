-- =====================================================================
--  LAB V2 · Onda 6 · Inteligência: estado das regras (calibração, sombra, aposentadoria), histerese persistida,
--  observações do motor (só acréscimo), marcas do gestor nos achados (só acréscimo, com referência de impacto
--  para expirar) e diário de contexto. O banco só guarda: nenhuma fórmula em SQL.
-- =====================================================================

/* calibração e estado de cada regra (hipótese do pack) nesta operação */
create table lab.inteligencia_regra (
  operacao_id    uuid not null references lab.operacao(id) on delete cascade,
  codigo         text not null check (length(codigo) between 1 and 80),
  estado         text not null default 'ativa' check (estado in ('rascunho', 'sombra', 'ativa', 'aposentada')),
  params         jsonb not null default '{}'::jsonb,        -- { met: { limiar, banda, amostraMin, janela, ref } } por métrica
  por            text not null default '',
  atualizado_em  timestamptz not null default now(),
  primary key (operacao_id, codigo)
);

/* histerese: o estado "ligada/desde/abaixoDesde/desligouEm" de cada regra, reescrito pelo Worker a cada avaliação */
create table lab.inteligencia_estado (
  operacao_id    uuid not null references lab.operacao(id) on delete cascade,
  codigo         text not null,
  hist           jsonb not null default '{}'::jsonb,
  ultimo_estado  text,                                      -- ativo | parcial | inativo | nao_avaliavel | sem_regra
  ultimo_impacto numeric(14,2),
  atualizado_em  timestamptz not null default now(),
  primary key (operacao_id, codigo)
);

/* observações: cada mudança de estado de uma regra, para a saúde da inteligência e o histórico. Só acréscimo. */
create table lab.inteligencia_obs (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  codigo        text not null,
  estado        text not null,
  impacto       numeric(14,2),
  confianca     text,
  aderencia     numeric(6,4),
  em            timestamptz not null default now()
);
create index inteligencia_obs_codigo on lab.inteligencia_obs (operacao_id, codigo, em desc);
create trigger inteligencia_obs_acrescimo before update or delete on lab.inteligencia_obs
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

/* marcas do gestor num achado: em tratamento, aceito como está, não procede. A última vale; "ref" é o impacto no dia da marca:
   se o impacto crescer acima de 1,5× a referência, a marca expira e o achado volta. Só acréscimo. */
create table lab.achado_marca (
  id            bigint generated always as identity primary key,
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  codigo        text not null,
  estado        text not null check (estado in ('tratamento', 'aceito', 'naoprocede', 'limpa')),
  motivo        text check (length(motivo) <= 1000),
  ref           numeric(14,2),
  por           text not null default '',
  em            timestamptz not null default now()
);
create index achado_marca_codigo on lab.achado_marca (operacao_id, codigo, em desc);
create trigger achado_marca_acrescimo before update or delete on lab.achado_marca
  for each row when (pg_trigger_depth() = 0 and current_setting('lab.apagando_operacao', true) is distinct from 'sim')
  execute function lab.somente_acrescimo();

/* diário de contexto: o que aconteceu fora dos números (campanha, feriado, troca de time, reajuste), por área */
create table lab.contexto_evento (
  id            uuid primary key default gen_random_uuid(),
  operacao_id   uuid not null references lab.operacao(id) on delete cascade,
  data          date not null,
  areas         text[] not null default '{}',
  descricao     text not null check (length(descricao) between 1 and 500),
  por           text not null default '',
  criado_em     timestamptz not null default now(),
  apagado_em    timestamptz
);
create index contexto_evento_data on lab.contexto_evento (operacao_id, data desc);

do $$
declare t text;
begin
  foreach t in array array['inteligencia_regra', 'inteligencia_estado', 'inteligencia_obs', 'achado_marca', 'contexto_evento'] loop
    execute format('alter table lab.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on lab.%I from anon', t); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on lab.%I from authenticated', t); end if;
  end loop;
end $$;
