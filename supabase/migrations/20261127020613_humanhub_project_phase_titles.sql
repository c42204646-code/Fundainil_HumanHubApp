-- Titles from the project kickoff and the latest expansion proposal. Not approval of funding or targets.
create table humanhub.project_phases(
 project_id uuid not null references humanhub.projects(id),phase text not null check(phase in ('original','expansion','shared')),
 reference_code text, title text not null check(length(trim(title)) between 3 and 400),
 document_status text not null check(document_status in ('reference','proposed','approved')),
 primary key(project_id,phase)
);
alter table humanhub.project_phases enable row level security;
revoke all on humanhub.project_phases from public,anon,authenticated,service_role;
grant select on humanhub.project_phases to authenticated;
create policy assigned_phase_read on humanhub.project_phases for select to authenticated using(exists(select 1 from humanhub.projects p where p.id=project_phases.project_id and p.active));
insert into humanhub.project_phases(project_id,phase,reference_code,title,document_status)
select p.id,v.phase,v.code,v.title,v.state from humanhub.projects p cross join (values
 ('original','VE3501','Entornos protectores para la niñez afectada por el terremoto en Venezuela: protección, educación y bienestar psicosocial','reference'),
 ('expansion',null,'Fortalecimiento y ampliación de espacios protectores para la continuidad educativa y el bienestar psicosocial de NNA afectados por la emergencia en Venezuela','proposed')
) v(phase,code,title,state) where p.code='EDUCO-SANDBOX';
create function public.hh_project_phases(p_project uuid)
returns table(phase text,reference_code text,title text,document_status text)
language sql stable security invoker set search_path='' as $$
 select f.phase,f.reference_code,f.title,f.document_status from humanhub.project_phases f where f.project_id=p_project order by f.phase;
$$;
revoke all on function public.hh_project_phases(uuid) from public,anon,authenticated,service_role;
grant execute on function public.hh_project_phases(uuid) to authenticated;
