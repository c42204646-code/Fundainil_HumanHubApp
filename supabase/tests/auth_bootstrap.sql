do $test$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); p uuid; other_p uuid:=gen_random_uuid(); n integer; r record;
begin
 begin
  select id into strict p from humanhub.projects where code='EDUCO-SANDBOX';
  insert into auth.users(id) values(u),(other_u);
  insert into humanhub.projects(id,code,name) values(other_p,'TEST_OTHER','Fixture only');
  insert into humanhub.memberships(project_id,user_id,role) values(p,u,'field'),(other_p,other_u,'monitoring');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',u::text,true);
  execute 'set local role authenticated';
  select * into strict r from public.hh_my_access();
  if r.project_id<>p or not r.field_access or r.coord_access or r.mera_access then raise exception 'role isolation failed'; end if;
  select count(*) into n from public.hh_project_catalog(p);
  if n<>38 then raise exception 'catalog read failed'; end if;
  if (select count(*) from public.hh_project_catalog(other_p))<>0 then raise exception 'cross project catalog leak'; end if;
  if (select count(*) from humanhub.projects where id=other_p)<>0 then raise exception 'cross project row leak'; end if;
  if has_table_privilege(current_user,'humanhub.participants','SELECT') or has_table_privilege(current_user,'humanhub.attendance','INSERT') or has_function_privilege(current_user,'humanhub.approve_attendance_batch(uuid,uuid)','EXECUTE') then raise exception 'unexpected sensitive privilege'; end if;
  execute 'reset role';
  update humanhub.memberships set active=false where project_id=p and user_id=u;
  execute 'set local role authenticated';
  if (select count(*) from public.hh_my_access())<>0 or (select count(*) from public.hh_project_catalog(p))<>0 then raise exception 'revocation failed'; end if;
  execute 'reset role';
  raise exception 'rollback fixture' using errcode='P7701';
 exception when sqlstate 'P7701' then null;
 end;
end $test$;
select 'PASS: field role, 38 indicators, project isolation, revoked access, no sensitive grants' as result,
 (select count(*) from auth.users) as auth_users,(select count(*) from humanhub.memberships) as members,
 has_function_privilege('anon','public.hh_my_access()','EXECUTE') as anon_rpc;