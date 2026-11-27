do $test$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); p uuid; r record;
begin
 begin
 select id into strict p from humanhub.projects where code='EDUCO-SANDBOX';
 insert into auth.users(id,email,email_confirmed_at) values(a,'fixture-manager@example.invalid',now()),(b,'fixture-worker@example.invalid',now()),(c,'fixture-unverified@example.invalid',null);
 insert into humanhub.memberships(project_id,user_id,role) values(p,a,'manager');
 perform set_config('request.jwt.claim.sub',c::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 begin perform public.hh_request_staff_access('Fixture worker','Testing','Worker');raise exception 'unverified accepted' using errcode='P7702';exception when raise_exception then null;end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',b::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if not public.hh_request_staff_access('Fixture worker','Testing','Worker') then raise exception 'request failed';end if;
 if (select count(*) from public.hh_my_access())<>0 then raise exception 'pending user got access';end if;
 begin perform public.hh_review_staff_request(p,b,'field',true);raise exception 'self approval accepted' using errcode='P7702';exception when raise_exception then null;end;
 begin perform public.hh_staff_requests(p);raise exception 'applicant got staff list' using errcode='P7702';exception when raise_exception then null;end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if (select count(*) from public.hh_staff_requests(p) where user_id=b)<>1 then raise exception 'manager cannot see pending';end if;
 begin perform public.hh_review_staff_request(p,b,'manager',true);raise exception 'manager privilege escalation accepted' using errcode='P7702';exception when raise_exception then null;end;
 if not public.hh_review_staff_request(p,b,'field',true) then raise exception 'approval failed';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',b::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select * into strict r from public.hh_my_access();
 if r.member_role<>'field' or not r.field_access or r.coord_access or r.mera_access then raise exception 'incorrect permissions';end if;
 if (select state from public.hh_my_staff_profile())<>'approved' then raise exception 'incorrect enrollment state';end if;
 execute 'reset role';
 raise exception 'rollback fixture' using errcode='P7701';
 exception when sqlstate 'P7701' then null;
 end;
end $test$;
select 'PASS: verified email, pending denied, self approval denied, manager review, role isolation' as result,(select count(*) from humanhub.staff_profiles) profiles,(select count(*) from auth.users) users,has_function_privilege('anon','public.hh_staff_requests(uuid)','EXECUTE') anonymous_requests;