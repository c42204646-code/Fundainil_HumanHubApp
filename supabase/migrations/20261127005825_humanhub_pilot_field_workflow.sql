-- Restricted sandbox workflow. No beneficiary or OCR data is exposed.
-- These are demonstration locations and activity types, not evidence of operation.
insert into humanhub.communities(project_id,code,name)
select id,'PILOT','Comunidad ficticia de prueba' from humanhub.projects where code='EDUCO-SANDBOX';
insert into humanhub.spaces(project_id,community_id,code,name)
select project_id,id,'PILOT-01','Espacio ficticio de prueba' from humanhub.communities where code='PILOT';
insert into humanhub.programs(project_id,code,label)
select p.id,v.code,v.label from humanhub.projects p cross join (values ('EDU','Educación'),('PROT','Protección'),('WASH','WASH')) v(code,label) where p.code='EDUCO-SANDBOX';
insert into humanhub.activity_types(project_id,program_code,activity_key,label)
select p.id,v.program,v.key,v.label from humanhub.projects p cross join (values
('EDU','EDU-REFUERZO','Refuerzo educativo'),('PROT','PS-GRUPAL','Apoyo psicosocial grupal'),('WASH','HIGIENE','Promoción de higiene')) v(program,key,label) where p.code='EDUCO-SANDBOX';
insert into humanhub.activity_phase_links(project_id,program_code,activity_key,phase,logical_code)
select p.id,v.program,v.key,v.phase,v.code from humanhub.projects p cross join (values
('EDU','EDU-REFUERZO','original','A2.3'),('EDU','EDU-REFUERZO','expansion','O2.03'),
('PROT','PS-GRUPAL','original','A1.1'),('PROT','PS-GRUPAL','expansion','O1.01'),
('WASH','HIGIENE','original','A1.5'),('WASH','HIGIENE','expansion','O1.02')) v(program,key,phase,code) where p.code='EDUCO-SANDBOX';
insert into humanhub.activity_indicators(project_id,activity_key,indicator_code,evidence_rule)
select p.id,v.key,v.indicator,'Sesión de prueba validada; no acredita personas, impacto ni metas oficiales'
from humanhub.projects p cross join (values ('EDU-REFUERZO','education_sessions'),('PS-GRUPAL','ps_group'),('HIGIENE','hygiene')) v(key,indicator) where p.code='EDUCO-SANDBOX';

create function humanhub.pilot_role(p_project uuid,p_roles text[]) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from humanhub.memberships m join humanhub.projects p on p.id=m.project_id
 where m.project_id=p_project and m.user_id=(select auth.uid()) and m.active and p.active and p.code='EDUCO-SANDBOX' and m.role=any(p_roles));
$$;
revoke all on function humanhub.pilot_role(uuid,text[]) from public,anon,authenticated,service_role;
grant execute on function humanhub.pilot_role(uuid,text[]) to authenticated;
grant select on humanhub.communities,humanhub.spaces,humanhub.programs,humanhub.activity_types,humanhub.activity_phase_links,humanhub.activity_indicators to authenticated;
create policy pilot_community_read on humanhub.communities for select to authenticated using(humanhub.pilot_role(project_id,array['field','coordinator','manager','director']));
create policy pilot_space_read on humanhub.spaces for select to authenticated using(humanhub.pilot_role(project_id,array['field','coordinator','manager','director']));
create policy pilot_program_read on humanhub.programs for select to authenticated using(humanhub.pilot_role(project_id,array['field','coordinator','manager','director']));
create policy pilot_type_read on humanhub.activity_types for select to authenticated using(humanhub.pilot_role(project_id,array['field','coordinator','manager','director']));
create policy pilot_phase_read on humanhub.activity_phase_links for select to authenticated using(humanhub.pilot_role(project_id,array['field','coordinator','manager','director']));
create policy pilot_link_read on humanhub.activity_indicators for select to authenticated using(humanhub.pilot_role(project_id,array['field','coordinator','manager','director']));
grant select,insert on humanhub.sessions to authenticated;
grant select,insert on humanhub.field_reports to authenticated;
grant update(state,review_note,reviewed_by,reviewed_at) on humanhub.field_reports to authenticated;
create policy pilot_session_read on humanhub.sessions for select to authenticated using(humanhub.pilot_role(project_id,array['field','coordinator','manager','director']));
create policy pilot_session_insert on humanhub.sessions for insert to authenticated with check(humanhub.pilot_role(project_id,array['field','coordinator','manager']) and exists(select 1 from humanhub.spaces sp where sp.id=space_id and sp.project_id=sessions.project_id and sp.code='PILOT-01'));
create policy pilot_report_read on humanhub.field_reports for select to authenticated using(
 (author_id=(select auth.uid()) and humanhub.pilot_role(project_id,array['field','coordinator','manager']))
 or humanhub.pilot_role(project_id,array['coordinator','manager','director']));
create policy pilot_report_insert on humanhub.field_reports for insert to authenticated with check(
 humanhub.pilot_role(project_id,array['field','coordinator','manager']) and author_id=(select auth.uid()) and state='review' and revision=1 and reviewed_by is null and reviewed_at is null);
create policy pilot_report_review on humanhub.field_reports for update to authenticated using(
 state='review' and author_id<>(select auth.uid()) and humanhub.pilot_role(project_id,array['coordinator','manager']))
 with check(state in ('validated','returned') and reviewed_by=(select auth.uid()) and reviewed_at is not null and author_id<>(select auth.uid()) and humanhub.pilot_role(project_id,array['coordinator','manager']));
-- No updates to report content or finalized reports. Actor and timestamp are set server-side.
create function humanhub.pilot_review_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.state<>'review' or new.state not in ('validated','returned') or old.author_id=(select auth.uid()) or not humanhub.pilot_role(old.project_id,array['coordinator','manager']) then raise exception 'review not authorized'; end if;
 if new.state='returned' and length(trim(coalesce(new.review_note,'')))=0 then raise exception 'return requires a reason'; end if;
 new.reviewed_by:=auth.uid();new.reviewed_at:=clock_timestamp();return new;
end $$;
create trigger pilot_review_guard before update on humanhub.field_reports for each row execute function humanhub.pilot_review_guard();
revoke all on function humanhub.pilot_review_guard() from public,anon,authenticated,service_role;

create function public.hh_pilot_options(p_project uuid)
returns table(space_id uuid,space_label text,program_code text,program_label text,activity_key text,activity_label text,phase text,logical_code text)
language sql stable security invoker set search_path='' as $$
 select sp.id,sp.name,l.program_code,g.label,l.activity_key,a.label,l.phase,l.logical_code
 from humanhub.spaces sp join humanhub.activity_phase_links l on l.project_id=sp.project_id
 join humanhub.activity_types a on a.project_id=l.project_id and a.activity_key=l.activity_key
 join humanhub.programs g on g.project_id=l.project_id and g.code=l.program_code
 where sp.project_id=p_project and sp.code='PILOT-01' and humanhub.pilot_role(p_project,array['field','coordinator','manager']) order by g.label,l.phase;
$$;
create function public.hh_pilot_submit(p_project uuid,p_space uuid,p_day date,p_shift text,p_slot integer,p_phase text,p_program text,p_activity text,p_logical text,p_strategy text,p_outcome text,p_challenges text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare s uuid; report uuid;
begin
 if not humanhub.pilot_role(p_project,array['field','coordinator','manager']) then raise exception 'not authorized'; end if;
 if p_day is null or p_day<date '2026-01-01' or p_day>current_date or p_strategy is null or length(trim(p_strategy)) not between 1 and 1000 or length(coalesce(p_outcome,''))>1000 or length(coalesce(p_challenges,''))>1000 then raise exception 'invalid report'; end if;
 insert into humanhub.sessions(project_id,space_id,day,shift,slot,phase,service,program_code,activity_key,logical_code)
 values(p_project,p_space,p_day,p_shift,p_slot,p_phase,p_activity,p_program,p_activity,p_logical) returning id into s;
 insert into humanhub.field_reports(project_id,session_id,author_id,state,strategy,achievements,challenges)
 values(p_project,s,auth.uid(),'review',trim(p_strategy),coalesce(p_outcome,''),coalesce(p_challenges,'')) returning id into report;
 return report;
end $$;
create function public.hh_pilot_reports(p_project uuid)
returns table(report_id uuid,day date,program_code text,activity_key text,logical_code text,phase text,state text,strategy text,achievements text,challenges text,review_note text,own_report boolean,can_review boolean)
language sql stable security invoker set search_path='' as $$
 select r.id,s.day,s.program_code,s.activity_key,s.logical_code,s.phase,r.state,r.strategy,r.achievements,r.challenges,r.review_note,r.author_id=(select auth.uid()),
 r.state='review' and r.author_id<>(select auth.uid()) and humanhub.pilot_role(p_project,array['coordinator','manager'])
 from humanhub.field_reports r join humanhub.sessions s on s.id=r.session_id
 where r.project_id=p_project and humanhub.pilot_role(p_project,array['field','coordinator','manager','director']) order by s.day desc,r.created_at desc limit 200;
$$;
create function public.hh_pilot_review(p_project uuid,p_report uuid,p_decision text,p_note text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 if not humanhub.pilot_role(p_project,array['coordinator','manager']) or p_decision not in ('validated','returned') or length(coalesce(p_note,''))>1000 then raise exception 'invalid review'; end if;
 update humanhub.field_reports r set state=p_decision,review_note=coalesce(p_note,''),reviewed_by=auth.uid(),reviewed_at=now() where r.project_id=p_project and r.id=p_report and r.state='review' and r.author_id<>auth.uid();
 get diagnostics changed=row_count; if changed<>1 then raise exception 'report not available for review'; end if; return true;
end $$;
-- Aggregate-only reader in the non-exposed schema: intentional privilege boundary.
-- It cannot return narrative, user identities, participant IDs or records from other projects.
create function humanhub.pilot_aggregate(p_project uuid,p_from date,p_to date)
returns table(program_code text,activity_key text,logical_code text,phase text,validated_period bigint,validated_accumulated bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or p_from is null or p_to is null or p_from>p_to or not exists(select 1 from humanhub.memberships m join humanhub.projects p on p.id=m.project_id where m.user_id=auth.uid() and m.project_id=p_project and m.active and p.active and p.code='EDUCO-SANDBOX' and m.role in ('monitoring','coordinator','manager','director','auditor')) then raise exception 'not authorized'; end if;
 return query select s.program_code,s.activity_key,s.logical_code,s.phase,count(*) filter(where s.day>=p_from),count(*)
 from humanhub.field_reports r join humanhub.sessions s on s.id=r.session_id
 where r.project_id=p_project and r.state='validated' and s.day<=p_to
 group by s.program_code,s.activity_key,s.logical_code,s.phase;
end $$;
revoke all on function humanhub.pilot_aggregate(uuid,date,date) from public,anon,authenticated,service_role;
grant execute on function humanhub.pilot_aggregate(uuid,date,date) to authenticated;
create function public.hh_pilot_mera(p_project uuid,p_from date,p_to date)
returns table(program_code text,activity_key text,logical_code text,phase text,validated_period bigint,validated_accumulated bigint)
language sql stable security invoker set search_path='' as $$
 select * from humanhub.pilot_aggregate(p_project,p_from,p_to);
$$;
revoke all on function public.hh_pilot_options(uuid),public.hh_pilot_submit(uuid,uuid,date,text,integer,text,text,text,text,text,text,text),public.hh_pilot_reports(uuid),public.hh_pilot_review(uuid,uuid,text,text),public.hh_pilot_mera(uuid,date,date) from public,anon,authenticated,service_role;
grant execute on function public.hh_pilot_options(uuid),public.hh_pilot_submit(uuid,uuid,date,text,integer,text,text,text,text,text,text,text),public.hh_pilot_reports(uuid),public.hh_pilot_review(uuid,uuid,text,text),public.hh_pilot_mera(uuid,date,date) to authenticated;
