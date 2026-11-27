-- Additive migration for the empty HumanHub sandbox. No personal data or public API grants.
create table humanhub.programs (
 project_id uuid not null references humanhub.projects(id),
 code text not null check(code ~ '^[A-Z0-9_-]{2,40}$'), label text not null,
 primary key(project_id,code)
);
create table humanhub.activity_types (
 project_id uuid not null, program_code text not null, activity_key text not null check(activity_key ~ '^[A-Z0-9_-]{2,60}$'),
 label text not null, primary key(project_id,activity_key),
 foreign key(project_id,program_code) references humanhub.programs(project_id,code),
 unique(project_id,program_code,activity_key)
);
create table humanhub.activity_phase_links (
 project_id uuid not null, program_code text not null, activity_key text not null,
 phase text not null check(phase in ('original','expansion','shared')),
 logical_code text not null, primary key(project_id,program_code,activity_key,phase,logical_code),
 foreign key(project_id,program_code,activity_key) references humanhub.activity_types(project_id,program_code,activity_key)
);
alter table humanhub.sessions
 add column program_code text not null,
 add column activity_key text not null,
 add column logical_code text not null,
 add constraint sessions_activity_fk foreign key(project_id,program_code,activity_key,phase,logical_code)
 references humanhub.activity_phase_links(project_id,program_code,activity_key,phase,logical_code);
-- Capture demographics at attendance time, not inferred from names or images.
alter table humanhub.batch_rows
 add column age_at_session smallint check(age_at_session between 0 and 120),
 add column sex_recorded text not null default 'unknown' check(sex_recorded in ('female','male','other','unknown')),
 add column disability_recorded text not null default 'unknown' check(disability_recorded in ('yes','no','unknown')),
 add column displacement_recorded text not null default 'unknown' check(displacement_recorded in ('displaced','resident','unknown'));
-- No plaintext names, documents or birthdays. Only a keyed fingerprint of a verified stable identifier.
-- The key must be managed exclusively by the authorized backend; never stored in this schema.
create table humanhub.identity_keys (
 id uuid primary key default gen_random_uuid(), participant_id uuid not null references humanhub.participants(id),
 namespace text not null check(namespace ~ '^[A-Z0-9_-]{2,50}$'),
 key_version smallint not null check(key_version>0),
 fingerprint bytea not null check(octet_length(fingerprint)=32),
 verified_by uuid not null references auth.users(id), verified_at timestamptz not null default now(),
 unique(namespace,key_version,fingerprint), unique(participant_id,namespace,key_version)
);
create table humanhub.session_staff (
 project_id uuid not null, session_id uuid not null, user_id uuid not null,
 responsibility text not null check(responsibility in ('lead','support')),
 primary key(session_id,user_id),
 foreign key(project_id,session_id) references humanhub.sessions(project_id,id),
 foreign key(project_id,user_id) references humanhub.memberships(project_id,user_id)
);
create unique index session_one_lead on humanhub.session_staff(session_id) where responsibility='lead';
create table humanhub.field_reports (
 id uuid primary key default gen_random_uuid(), project_id uuid not null, session_id uuid not null,
 revision integer not null default 1 check(revision>0),
 author_id uuid not null, state text not null default 'draft' check(state in ('draft','review','validated','returned','superseded')),
 strategy text not null check(length(strategy) between 1 and 8000),
 contribution text not null default '', achievements text not null default '', challenges text not null default '', recommendations text not null default '',
 reception text not null default 'unknown' check(reception in ('high','medium','low','unknown')),
 transversal text[] not null default '{}', narrative text, review_note text,
 reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz not null default now(),
 foreign key(project_id,session_id) references humanhub.sessions(project_id,id),
 foreign key(project_id,author_id) references humanhub.memberships(project_id,user_id),
 foreign key(project_id,reviewed_by) references humanhub.memberships(project_id,user_id),
 check((state in ('draft','review') and reviewed_by is null and reviewed_at is null) or
 (state in ('validated','returned','superseded') and reviewed_by is not null and reviewed_at is not null and reviewed_by<>author_id)),
 unique(session_id,revision)
);
create unique index field_reports_one_validated on humanhub.field_reports(session_id) where state='validated';
create table humanhub.ocr_intakes (
 id uuid primary key default gen_random_uuid(), project_id uuid not null, session_id uuid not null, submitted_by uuid not null,
 evidence_ref text not null check(evidence_ref ~ '^[A-Za-z0-9_-]{1,100}$'),
 state text not null default 'pending' check(state in ('pending','resolved','discarded')),
 row_count integer check(row_count between 0 and 1000), created_at timestamptz not null default now(),
 foreign key(project_id,session_id) references humanhub.sessions(project_id,id),
 foreign key(project_id,submitted_by) references humanhub.memberships(project_id,user_id),
 unique(project_id,id,session_id)
);
create table humanhub.ocr_resolution_rows (
 project_id uuid not null, intake_id uuid not null, session_id uuid not null, row_number integer not null check(row_number between 1 and 1000),
 status text not null default 'unresolved' check(status in ('unresolved','matched','new','excluded')),
 participant_id uuid, resolved_by uuid, resolved_at timestamptz,
 primary key(intake_id,row_number),
 foreign key(project_id,intake_id,session_id) references humanhub.ocr_intakes(project_id,id,session_id),
 foreign key(project_id,participant_id) references humanhub.project_participants(project_id,participant_id),
 foreign key(project_id,resolved_by) references humanhub.memberships(project_id,user_id),
 check((status='unresolved' and participant_id is null and resolved_by is null and resolved_at is null) or
 (status in ('matched','new') and participant_id is not null and resolved_by is not null and resolved_at is not null) or
 (status='excluded' and participant_id is null and resolved_by is not null and resolved_at is not null))
);
create table humanhub.activity_indicators (
 project_id uuid not null, activity_key text not null, indicator_code text not null,
 evidence_rule text not null,
 primary key(project_id,activity_key,indicator_code),
 foreign key(project_id,activity_key) references humanhub.activity_types(project_id,activity_key),
 foreign key(project_id,indicator_code) references humanhub.indicators(project_id,code)
);
create table humanhub.indicator_targets (
 id uuid primary key default gen_random_uuid(), project_id uuid not null, indicator_code text not null,
 phase text not null check(phase in ('original','expansion','operational','integrated')),
 period_start date not null, period_end date not null check(period_end>=period_start),
 version integer not null default 1 check(version>0), target numeric not null check(target>=0),
 state text not null default 'proposed' check(state in ('proposed','approved','superseded')),
 source_ref text not null, foreign key(project_id,indicator_code) references humanhub.indicators(project_id,code),
 unique(project_id,indicator_code,phase,period_start,period_end,version)
);
create unique index indicator_one_approved_target on humanhub.indicator_targets(project_id,indicator_code,phase,period_start,period_end) where state='approved';
create table humanhub.indicator_observations (
 id uuid primary key default gen_random_uuid(), project_id uuid not null, indicator_code text not null,
 session_id uuid not null, evidence_ref text not null check(evidence_ref ~ '^[A-Za-z0-9_-]{1,100}$'),
 value numeric check(value>=0), numerator integer check(numerator>=0), denominator integer check(denominator>0),
 state text not null default 'review' check(state in ('review','validated','discarded')),
 submitted_by uuid not null, reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz not null default now(),
 foreign key(project_id,indicator_code) references humanhub.indicators(project_id,code),
 foreign key(project_id,session_id) references humanhub.sessions(project_id,id),
 foreign key(project_id,submitted_by) references humanhub.memberships(project_id,user_id),
 foreign key(project_id,reviewed_by) references humanhub.memberships(project_id,user_id),
 check((value is not null and numerator is null and denominator is null) or
 (value is null and numerator is not null and denominator is not null and numerator<=denominator)),
 check((state='review' and reviewed_by is null and reviewed_at is null) or
 (state<>'review' and reviewed_by is not null and reviewed_at is not null and reviewed_by<>submitted_by)),
 unique(project_id,indicator_code,session_id,evidence_ref)
);
-- Reject changes to accepted batches and rows. Corrections must use a future audited procedure.
create function humanhub.guard_batch() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.state<>'review' then raise exception 'batch must start in review'; end if;
  return new;
 end if;
 if old.state<>'review' then raise exception 'reviewed batch is immutable'; end if;
 if tg_op='DELETE' then raise exception 'discard instead of deleting'; end if;
 if (new.id,new.project_id,new.session_id,new.submitted_by,new.evidence_ref,new.created_at) is distinct from
 (old.id,old.project_id,old.session_id,old.submitted_by,old.evidence_ref,old.created_at) then raise exception 'batch provenance is immutable'; end if;
 return new;
end $$;
create trigger batch_guard before insert or update or delete on humanhub.attendance_batches for each row execute function humanhub.guard_batch();
create function humanhub.guard_batch_row() returns trigger language plpgsql security invoker set search_path='' as $$
declare b uuid; st text;
begin
 b:=case when tg_op='INSERT' then new.batch_id else old.batch_id end;
 select state into st from humanhub.attendance_batches where id=b for update;
 if st is distinct from 'review' then raise exception 'rows may change only in draft batch'; end if;
 if tg_op='UPDATE' then
  if (new.project_id,new.batch_id,new.session_id,new.participant_id) is distinct from (old.project_id,old.batch_id,old.session_id,old.participant_id) then raise exception 'replace draft row instead of changing its identity'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger batch_row_guard before insert or update or delete on humanhub.batch_rows for each row execute function humanhub.guard_batch_row();
create function humanhub.guard_attendance() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'attendance immutable; audited correction required'; end if;
 if not exists(select 1 from humanhub.attendance_batches b where b.id=new.batch_id and b.state='validated') then raise exception 'validated batch required'; end if;
 return new;
end $$;
create trigger attendance_guard before insert or update or delete on humanhub.attendance for each row execute function humanhub.guard_attendance();
-- A change to a session after approval would alter history: prohibit it.
create function humanhub.guard_session() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from humanhub.attendance_batches b where b.session_id=old.id and b.state='validated') then raise exception 'session with validated attendance is immutable'; end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger session_guard before update or delete on humanhub.sessions for each row execute function humanhub.guard_session();
-- Atomic approval: authenticated actor must be a distinct, active reviewer. No client role has EXECUTE.
create function humanhub.approve_attendance_batch(p_batch uuid,p_actor uuid)
returns table(inserted integer,repeated integer)
language plpgsql security invoker set search_path='' as $$
declare b humanhub.attendance_batches%rowtype; n integer; added integer;
begin
 select * into b from humanhub.attendance_batches where id=p_batch for update;
 if not found or b.state<>'review' then raise exception 'batch not pending'; end if;
 if p_actor is null or p_actor=b.submitted_by or not exists(
 select 1 from humanhub.memberships m where m.project_id=b.project_id and m.user_id=p_actor and m.active and m.role in ('coordinator','monitoring','manager')) then raise exception 'reviewer not authorized'; end if;
 if not exists(select 1 from humanhub.memberships m where m.project_id=b.project_id and m.user_id=b.submitted_by and m.active and m.role in ('field','coordinator')) then raise exception 'submitter not authorized'; end if;
 perform 1 from humanhub.sessions s where s.id=b.session_id for update;
 select count(*)::integer into n from humanhub.batch_rows r where r.batch_id=b.id;
 if n=0 or n>1000 then raise exception 'invalid batch row count'; end if;
 update humanhub.attendance_batches set state='validated', reviewed_by=p_actor, reviewed_at=now() where id=b.id;
 insert into humanhub.attendance(project_id,session_id,participant_id,batch_id)
 select r.project_id,r.session_id,r.participant_id,r.batch_id from humanhub.batch_rows r where r.batch_id=b.id
 on conflict(session_id,participant_id) do nothing;
 get diagnostics added=row_count;
 insert into humanhub.audit(project_id,actor_id,event,object_id) values(b.project_id,p_actor,'attendance_batch_validated',b.id);
 return query select added,n-added;
end $$;
-- Derive sequence from validated participation across all historical dates, not the selected dashboard period.
create view humanhub.attendance_history with (security_invoker=true) as
select a.project_id,a.participant_id,a.session_id,a.batch_id,s.day,s.shift,s.slot,s.phase,s.program_code,s.activity_key,s.logical_code,s.space_id,sp.community_id,
 r.age_at_session,r.sex_recorded,r.disability_recorded,r.displacement_recorded,
 row_number() over(partition by a.participant_id order by s.day,case s.shift when 'AM' then 0 else 1 end,s.slot,a.session_id) as institutional_sequence,
 row_number() over(partition by a.project_id,a.participant_id order by s.day,case s.shift when 'AM' then 0 else 1 end,s.slot,a.session_id) as project_sequence,
 row_number() over(partition by a.project_id,a.participant_id,s.program_code order by s.day,case s.shift when 'AM' then 0 else 1 end,s.slot,a.session_id) as program_sequence,
 row_number() over(partition by a.project_id,a.participant_id,s.activity_key order by s.day,case s.shift when 'AM' then 0 else 1 end,s.slot,a.session_id) as activity_sequence
from humanhub.attendance a
join humanhub.attendance_batches b on b.id=a.batch_id and b.state='validated'
join humanhub.sessions s on s.id=a.session_id
join humanhub.spaces sp on sp.id=s.space_id
join humanhub.batch_rows r on r.batch_id=a.batch_id and r.participant_id=a.participant_id;
-- Mutually exclusive participant classes in each program as of the end date, restricted to people active in the queried period.
create function humanhub.program_recurrence(p_project uuid,p_from date,p_to date)
returns table(program_code text,unique_people bigint,new_people bigint,returning_people bigint,nonrecurrent_people bigint,recurrent_people bigint,attendances bigint,first_attendances bigint,repeat_attendances bigint)
language sql stable security invoker set search_path='' as $$
with person_scope as (
 select h.program_code,h.participant_id,min(h.day) as first_day,count(*) as through_cutoff,
 count(*) filter(where h.day>=p_from) as visits_period,
 count(*) filter(where h.day>=p_from and h.program_sequence=1) as first_period
 from humanhub.attendance_history h where h.project_id=p_project and h.day<=p_to and p_from<=p_to
 group by h.program_code,h.participant_id
 having count(*) filter(where h.day>=p_from)>0
)
select x.program_code,count(*),count(*) filter(where x.first_day>=p_from),count(*) filter(where x.first_day<p_from),
 count(*) filter(where x.through_cutoff=1),count(*) filter(where x.through_cutoff>=2),
 sum(x.visits_period)::bigint,sum(x.first_period)::bigint,sum(x.visits_period-x.first_period)::bigint
from person_scope x group by x.program_code;
$$;
create function humanhub.activity_recurrence(p_project uuid,p_from date,p_to date)
returns table(activity_key text,unique_people bigint,new_people bigint,returning_people bigint,nonrecurrent_people bigint,recurrent_people bigint,attendances bigint,first_attendances bigint,repeat_attendances bigint)
language sql stable security invoker set search_path='' as $$
with person_scope as (
 select h.activity_key,h.participant_id,min(h.day) as first_day,count(*) as through_cutoff,
 count(*) filter(where h.day>=p_from) as visits_period,
 count(*) filter(where h.day>=p_from and h.activity_sequence=1) as first_period
 from humanhub.attendance_history h where h.project_id=p_project and h.day<=p_to and p_from<=p_to
 group by h.activity_key,h.participant_id
 having count(*) filter(where h.day>=p_from)>0
)
select x.activity_key,count(*),count(*) filter(where x.first_day>=p_from),count(*) filter(where x.first_day<p_from),
 count(*) filter(where x.through_cutoff=1),count(*) filter(where x.through_cutoff>=2),
 sum(x.visits_period)::bigint,sum(x.first_period)::bigint,sum(x.visits_period-x.first_period)::bigint
from person_scope x group by x.activity_key;
$$;
create index on humanhub.sessions(project_id,program_code,day);
create index on humanhub.sessions(project_id,activity_key,day);
create index on humanhub.attendance(participant_id);
create index on humanhub.identity_keys(participant_id);
create index on humanhub.session_staff(project_id,user_id);
create index on humanhub.field_reports(project_id,author_id);
create index on humanhub.ocr_intakes(project_id,session_id);
create index on humanhub.ocr_resolution_rows(project_id,participant_id);
create index on humanhub.indicator_observations(project_id,indicator_code);
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='humanhub' loop
  execute format('alter table humanhub.%I enable row level security',t.tablename);
 end loop;
end $$;
revoke all on schema humanhub from public,anon,authenticated,service_role;
revoke all on all tables in schema humanhub from public,anon,authenticated,service_role;
revoke all on all sequences in schema humanhub from public,anon,authenticated,service_role;
revoke all on all functions in schema humanhub from public,anon,authenticated,service_role;
