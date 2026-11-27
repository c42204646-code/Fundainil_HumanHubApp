do $test$
declare u uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); p uuid; sp uuid; r uuid; n integer; photos jsonb;
 jpg text:='/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AD//Z';
begin
 begin
  select id into strict p from humanhub.projects where code='EDUCO-SANDBOX';
  select id into strict sp from humanhub.spaces where project_id=p and code='PILOT-01';
  insert into auth.users(id) values(u),(c),(m),(other_u);
  insert into humanhub.memberships(project_id,user_id,role) values(p,u,'field'),(p,c,'coordinator'),(p,m,'monitoring'),(p,other_u,'field');
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  photos:=jsonb_build_array(jsonb_build_object('jpeg',jpg,'caption','Synthetic material 1'),jsonb_build_object('jpeg',jpg,'caption','Synthetic material 2'));
  begin
   perform public.hh_pilot_submit_photos(p,sp,date '2026-11-25','AM',19,'expansion','EDU','EDU-REFUERZO','O2.03','Synthetic strategy','','',photos||jsonb_build_array(photos->0));
   raise exception 'third photo accepted' using errcode='P7702';
  exception when raise_exception then null;end;
  begin
   perform public.hh_pilot_submit_photos(p,sp,date '2026-11-25','AM',19,'expansion','EDU','EDU-REFUERZO','O2.03','Synthetic strategy','','',jsonb_build_array(jsonb_build_object('jpeg','AA==','caption','Invalid')));
   raise exception 'invalid jpeg accepted' using errcode='P7702';
  exception when check_violation then null;end;
  -- Reusing the slot proves the failed submission did not leave an orphan session.
  r:=public.hh_pilot_submit_photos(p,sp,date '2026-11-25','AM',19,'expansion','EDU','EDU-REFUERZO','O2.03','Synthetic strategy','','',photos);
  if (select count(*) from public.hh_pilot_report_photos(p,r))<>2 then raise exception 'owner could not retrieve two photos';end if;
  if (select count(*) from public.hh_pilot_report_photos(p,r) f where f.jpeg_base64=jpg)<>2 then raise exception 'image bytes altered';end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',other_u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_u,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if (select count(*) from public.hh_pilot_report_photos(p,r))<>0 then raise exception 'another field worker saw evidence';end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',m::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',m,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if (select count(*) from public.hh_pilot_report_photos(p,r))<>0 then raise exception 'MERA saw evidence';end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',c::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  if (select count(*) from public.hh_pilot_report_photos(p,r))<>2 then raise exception 'reviewer could not retrieve evidence';end if;
  if not public.hh_pilot_review(p,r,'validated','Reviewed synthetic evidence') then raise exception 'review failed';end if;
  execute 'reset role';
  raise exception 'rollback fixture' using errcode='P7701';
 exception when sqlstate 'P7701' then null;
 end;
end $test$;
select 'PASS: two JPEG attachments, atomic rollback, owner/reviewer access, unrelated field worker and MERA denied' as result,
(select count(*) from humanhub.report_photos) remaining_photos,(select count(*) from humanhub.field_reports) remaining_reports,
has_function_privilege('anon','public.hh_pilot_report_photos(uuid,uuid)','EXECUTE') anon_rpc;