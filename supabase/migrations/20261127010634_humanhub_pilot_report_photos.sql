-- Small, bounded JPEG evidence for the synthetic pilot only.
-- Production photographs require a private object store, retention and safeguarding approval.
create table humanhub.report_photos(
 report_id uuid not null references humanhub.field_reports(id),
 slot smallint not null check(slot between 1 and 2),
 caption text not null check(length(trim(caption)) between 1 and 240),
 jpeg bytea not null check(octet_length(jpeg) between 32 and 262144 and substring(jpeg from 1 for 3)=decode('ffd8ff','hex') and substring(jpeg from octet_length(jpeg)-1 for 2)=decode('ffd9','hex')),
 created_at timestamptz not null default now(),
 primary key(report_id,slot)
);
alter table humanhub.report_photos enable row level security;
revoke all on humanhub.report_photos from public,anon,authenticated,service_role;
grant select,insert on humanhub.report_photos to authenticated;
create policy pilot_photo_read on humanhub.report_photos for select to authenticated using(
 exists(select 1 from humanhub.field_reports r where r.id=report_photos.report_id
 and ((r.author_id=(select auth.uid()) and humanhub.pilot_role(r.project_id,array['field','coordinator','manager']))
 or humanhub.pilot_role(r.project_id,array['coordinator','manager','director']))));
create policy pilot_photo_insert on humanhub.report_photos for insert to authenticated with check(
 exists(select 1 from humanhub.field_reports r where r.id=report_photos.report_id and r.state='review'
 and r.author_id=(select auth.uid()) and humanhub.pilot_role(r.project_id,array['field','coordinator','manager'])));
-- One transaction: invalid evidence rolls back the report and session as well.
create function public.hh_pilot_submit_photos(p_project uuid,p_space uuid,p_day date,p_shift text,p_slot integer,p_phase text,p_program text,p_activity text,p_logical text,p_strategy text,p_outcome text,p_challenges text,p_photos jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare report uuid; item jsonb; i integer:=0; raw text;
begin
 if p_photos is null or jsonb_typeof(p_photos)<>'array' or jsonb_array_length(p_photos)>2 then raise exception 'at most two photos'; end if;
 report:=public.hh_pilot_submit(p_project,p_space,p_day,p_shift,p_slot,p_phase,p_program,p_activity,p_logical,p_strategy,p_outcome,p_challenges);
 for item in select value from jsonb_array_elements(p_photos) loop
  i:=i+1; raw:=item->>'jpeg';
  if raw is null or length(raw)>349528 or length(trim(coalesce(item->>'caption',''))) not between 1 and 240 then raise exception 'invalid photo'; end if;
  insert into humanhub.report_photos(report_id,slot,caption,jpeg) values(report,i,trim(item->>'caption'),decode(raw,'base64'));
 end loop;
 return report;
end $$;
create function public.hh_pilot_report_photos(p_project uuid,p_report uuid)
returns table(slot smallint,caption text,jpeg_base64 text)
language sql stable security invoker set search_path='' as $$
 select f.slot,f.caption,replace(encode(f.jpeg,'base64'),chr(10),'') from humanhub.report_photos f
 join humanhub.field_reports r on r.id=f.report_id
 where r.id=p_report and r.project_id=p_project and humanhub.pilot_role(p_project,array['field','coordinator','manager','director']) order by f.slot;
$$;
revoke all on function public.hh_pilot_submit_photos(uuid,uuid,date,text,integer,text,text,text,text,text,text,text,jsonb),public.hh_pilot_report_photos(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.hh_pilot_submit_photos(uuid,uuid,date,text,integer,text,text,text,text,text,text,text,jsonb),public.hh_pilot_report_photos(uuid,uuid) to authenticated;
