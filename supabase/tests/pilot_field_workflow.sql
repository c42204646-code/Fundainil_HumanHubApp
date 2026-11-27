do $test$
declare u uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); p uuid; sp uuid; r uuid; z record; n integer;
begin
 begin
  select id into strict p from humanhub.projects where code='EDUCO-SANDBOX';
  select id into strict sp from humanhub.spaces where project_id=p and code='PILOT-01';
  insert into auth.users(id) values(u),(c),(m);
  insert into humanhub.memberships(project_id,user_id,role) values(p,u,'field'),(p,c,'coordinator'),(p,m,'monitoring');
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if (select count(*) from public.hh_pilot_options(p))<>6 then raise exception 'catalog options failed'; end if;
  r:=public.hh_pilot_submit(p,sp,date '2026-11-25','AM',20,'expansion','EDU','EDU-REFUERZO','O2.03','Synthetic test strategy','Synthetic outcome','');
  select * into strict z from public.hh_pilot_reports(p) where report_id=r;
  if z.state<>'review' or not z.own_report or z.can_review then raise exception 'field state failed'; end if;
  begin perform public.hh_pilot_review(p,r,'validated','');raise exception 'field approved own report' using errcode='P7702';exception when raise_exception then null;end;
  begin perform public.hh_pilot_mera(p,date '2026-11-01',date '2026-11-30');raise exception 'field got aggregate' using errcode='P7702';exception when raise_exception then null;end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',c::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if (select count(*) from public.hh_pilot_mera(p,date '2026-11-01',date '2026-11-30'))<>0 then raise exception 'pending report leaked into aggregate'; end if;
  select * into strict z from public.hh_pilot_reports(p) where report_id=r;
  if not z.can_review or z.own_report then raise exception 'reviewer access failed'; end if;
  if not public.hh_pilot_review(p,r,'validated','Synthetic review') then raise exception 'approval failed'; end if;
  begin perform public.hh_pilot_review(p,r,'returned','Again');raise exception 'approved report changed' using errcode='P7702';exception when raise_exception then null;end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',m::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',m,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if (select count(*) from public.hh_pilot_reports(p))<>0 then raise exception 'monitoring read raw reports'; end if;
  select * into strict z from public.hh_pilot_mera(p,date '2026-11-01',date '2026-11-30') where activity_key='EDU-REFUERZO';
  if z.validated_period<>1 or z.validated_accumulated<>1 then raise exception 'aggregate count failed'; end if;
  select * into strict z from public.hh_pilot_mera(p,date '2026-11-26',date '2026-11-30') where activity_key='EDU-REFUERZO';
  if z.validated_period<>0 or z.validated_accumulated<>1 then raise exception 'period filter failed'; end if;
  begin perform public.hh_pilot_mera(gen_random_uuid(),date '2026-11-01',date '2026-11-30');raise exception 'cross project access' using errcode='P7702';exception when raise_exception then null;end;
  execute 'reset role';
  raise exception 'rollback fixture' using errcode='P7701';
 exception when sqlstate 'P7701' then null;
 end;
end $test$;
select 'PASS: authenticated field submission, independent review, approved-only aggregate, date filtering, monitoring isolation' as result,
(select count(*) from humanhub.field_reports) reports_remaining,(select count(*) from auth.users) users_remaining;