do $$ declare u uuid:=gen_random_uuid(); p uuid; begin begin
select id into strict p from humanhub.projects where code='EDUCO-SANDBOX';
insert into auth.users(id,email,email_confirmed_at) values(u,'fixture-phase@example.invalid',now());
perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
execute 'set local role authenticated';
if (select count(*) from public.hh_project_phases(p))<>0 then raise exception 'unassigned user saw project titles';end if;
execute 'reset role';
insert into humanhub.memberships(project_id,user_id,role) values(p,u,'field');
execute 'set local role authenticated';
if (select count(*) from public.hh_project_phases(p))<>2 then raise exception 'assigned user lacks phase titles';end if;
if (select reference_code from public.hh_project_phases(p) where phase='original')<>'VE3501' then raise exception 'wrong project reference';end if;
if (select document_status from public.hh_project_phases(p) where phase='expansion')<>'proposed' then raise exception 'proposal status lost';end if;
execute 'reset role';
raise exception 'rollback fixture' using errcode='P7701';
exception when sqlstate 'P7701' then null;end;end $$;
select 'PASS: phase title, proposal status and project scope' result,(select count(*) from auth.users) users,(select count(*) from humanhub.staff_profiles) staff;