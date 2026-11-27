-- Baseline of the original private HumanHub schema; already applied to the sandbox.
create schema humanhub;
revoke all on schema humanhub from public, anon, authenticated, service_role;
create table humanhub.projects (
 id uuid primary key default gen_random_uuid(), code text not null unique check (code ~ '^[A-Z0-9_-]{2,40}$'),
 name text not null, active boolean not null default true, created_at timestamptz not null default now()
);
create table humanhub.memberships (
 project_id uuid not null references humanhub.projects(id), user_id uuid not null references auth.users(id),
 role text not null check (role in ('field','coordinator','monitoring','manager','director','auditor')),
 active boolean not null default true, primary key(project_id,user_id)
);
create table humanhub.communities (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references humanhub.projects(id),
 code text not null, name text not null, active boolean not null default true,
 unique(project_id,code), unique(project_id,id)
);
create table humanhub.spaces (
 id uuid primary key default gen_random_uuid(), project_id uuid not null,
 community_id uuid not null, code text not null, name text not null,
 foreign key(project_id,community_id) references humanhub.communities(project_id,id),
 unique(project_id,code), unique(project_id,id)
);
create table humanhub.participants (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^HH-[A-F0-9]{12}$'),
 category text not null check(category in ('NNA','Adulto')), created_at timestamptz not null default now()
);
create table humanhub.project_participants (
 project_id uuid not null references humanhub.projects(id), participant_id uuid not null references humanhub.participants(id),
 enrolled_at timestamptz not null default now(), primary key(project_id,participant_id)
);
create table humanhub.sessions (
 id uuid primary key default gen_random_uuid(), project_id uuid not null,
 space_id uuid not null, day date not null, shift text not null check(shift in ('AM','PM')),
 slot integer not null check(slot between 1 and 20), phase text not null check(phase in ('original','expansion','shared')),
 service text not null, foreign key(project_id,space_id) references humanhub.spaces(project_id,id),
 unique(project_id,space_id,day,shift,slot), unique(project_id,id)
);
create table humanhub.attendance_batches (
 id uuid primary key default gen_random_uuid(), project_id uuid not null,
 session_id uuid not null, evidence_ref text not null check(evidence_ref ~ '^[A-Za-z0-9_-]{1,100}$'),
 state text not null default 'review' check(state in ('review','validated','discarded')),
 submitted_by uuid not null, reviewed_by uuid, created_at timestamptz not null default now(), reviewed_at timestamptz,
 foreign key(project_id,session_id) references humanhub.sessions(project_id,id),
 foreign key(project_id,submitted_by) references humanhub.memberships(project_id,user_id),
 foreign key(project_id,reviewed_by) references humanhub.memberships(project_id,user_id),
 check ((state='review' and reviewed_by is null and reviewed_at is null) or
 (state in ('validated','discarded') and reviewed_by is not null and reviewed_at is not null and reviewed_by<>submitted_by)),
 unique(project_id,id,session_id)
);
create table humanhub.batch_rows (
 project_id uuid not null, batch_id uuid not null, session_id uuid not null, participant_id uuid not null,
 primary key(batch_id,participant_id),
 foreign key(project_id,batch_id,session_id) references humanhub.attendance_batches(project_id,id,session_id),
 foreign key(project_id,participant_id) references humanhub.project_participants(project_id,participant_id),
 unique(project_id,batch_id,session_id,participant_id)
);
create table humanhub.attendance (
 project_id uuid not null, session_id uuid not null, participant_id uuid not null, batch_id uuid not null,
 created_at timestamptz not null default now(), primary key(session_id,participant_id),
 foreign key(project_id,batch_id,session_id,participant_id) references humanhub.batch_rows(project_id,batch_id,session_id,participant_id)
);
create table humanhub.indicators (
 project_id uuid not null references humanhub.projects(id), code text not null, label text not null,
 kind text not null check(kind in ('unique','event','stock','rate')), primary key(project_id,code)
);
create table humanhub.mera_forms (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references humanhub.projects(id),
 phase text not null check(phase in ('original','expansion','integrated')),
 period_start date not null, period_end date not null check(period_end>=period_start),
 state text not null default 'review' check(state in ('review','validated','discarded','superseded')),
 payload jsonb not null check(jsonb_typeof(payload)='object'), created_at timestamptz not null default now(),
 submitted_by uuid not null, reviewed_by uuid, reviewed_at timestamptz,
 foreign key(project_id,submitted_by) references humanhub.memberships(project_id,user_id),
 foreign key(project_id,reviewed_by) references humanhub.memberships(project_id,user_id),
 check ((state='review' and reviewed_by is null and reviewed_at is null) or
 (state<>'review' and reviewed_by is not null and reviewed_at is not null and reviewed_by<>submitted_by))
);
create table humanhub.audit (
 id bigint generated always as identity primary key, project_id uuid references humanhub.projects(id),
 actor_id uuid references auth.users(id), event text not null, object_id uuid, occurred_at timestamptz not null default now()
);
create index on humanhub.memberships(user_id);
create index on humanhub.spaces(project_id,community_id);
create index on humanhub.project_participants(participant_id);
create index on humanhub.sessions(project_id,day);
create index on humanhub.attendance_batches(project_id,session_id);
create index on humanhub.attendance_batches(project_id,submitted_by);
create index on humanhub.attendance_batches(project_id,reviewed_by);
create index on humanhub.batch_rows(project_id,participant_id);
create index on humanhub.attendance(project_id,participant_id);
create index on humanhub.attendance(project_id,batch_id,session_id,participant_id);
create index on humanhub.mera_forms(project_id,period_end);
create index on humanhub.mera_forms(project_id,submitted_by);
create index on humanhub.mera_forms(project_id,reviewed_by);
create index on humanhub.audit(project_id,occurred_at);
create index on humanhub.audit(actor_id);
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='humanhub' loop
  execute format('alter table humanhub.%I enable row level security', t.tablename);
 end loop;
end $$;
revoke all on all tables in schema humanhub from public,anon,authenticated,service_role;
revoke all on all sequences in schema humanhub from public,anon,authenticated,service_role;
alter default privileges in schema humanhub revoke all on tables from public,anon,authenticated,service_role;
alter default privileges in schema humanhub revoke all on sequences from public,anon,authenticated,service_role;
alter default privileges in schema humanhub revoke execute on functions from public,anon,authenticated,service_role;
