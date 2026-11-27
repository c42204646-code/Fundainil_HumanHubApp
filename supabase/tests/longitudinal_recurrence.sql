-- Transactional integration fixture. All rows, including synthetic auth identities, are rolled back.
do $test$
declare
 p uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); sp uuid:=gen_random_uuid();
 person uuid:=gen_random_uuid(); field_user uuid:=gen_random_uuid(); reviewer uuid:=gen_random_uuid();
 ses uuid; batch uuid; first_session uuid; rec record; inserted_n integer; repeat_n integer;
 d date; pr text; act text; logical text; ph text; i integer;
begin
 begin
  insert into auth.users(id) values(field_user),(reviewer);
  insert into humanhub.projects(id,code,name) values(p,'TEST_RECURRENCE','Synthetic test only');
  insert into humanhub.memberships(project_id,user_id,role) values(p,field_user,'field'),(p,reviewer,'coordinator');
  insert into humanhub.communities(id,project_id,code,name) values(c,p,'TEST','Test');
  insert into humanhub.spaces(id,project_id,community_id,code,name) values(sp,p,c,'TEST','Test');
  insert into humanhub.programs(project_id,code,label) values(p,'EDU','Education'),(p,'WASH','WASH');
  insert into humanhub.activity_types(project_id,program_code,activity_key,label) values(p,'EDU','READ','Reading'),(p,'EDU','MATH','Mathematics'),(p,'WASH','HYGIENE','Hygiene');
  insert into humanhub.activity_phase_links(project_id,program_code,activity_key,phase,logical_code) values
   (p,'EDU','READ','original','A2.3'),(p,'EDU','READ','expansion','O2.03'),(p,'EDU','MATH','expansion','O2.03'),(p,'WASH','HYGIENE','expansion','O1.02');
  insert into humanhub.participants(id,code,category) values(person,'HH-'||upper(substr(replace(person::text,'-',''),1,12)),'NNA');
  insert into humanhub.project_participants(project_id,participant_id) values(p,person);
  -- Enter a later session first, then backfill an earlier session. Sequence is chronological, not import order.
  for i in 1..4 loop
   d:=(array[date '2026-11-28',date '2026-11-25',date '2026-11-27',date '2026-12-02'])[i];
   pr:=(array['EDU','EDU','WASH','EDU'])[i]; act:=(array['READ','READ','HYGIENE','MATH'])[i];
   ph:=(array['expansion','original','expansion','expansion'])[i]; logical:=(array['O2.03','A2.3','O1.02','O2.03'])[i];
   ses:=gen_random_uuid();batch:=gen_random_uuid();
   if i=2 then first_session:=ses; end if;
   insert into humanhub.sessions(id,project_id,space_id,day,shift,slot,phase,service,program_code,activity_key,logical_code) values(ses,p,sp,d,'AM',1,ph,act,pr,act,logical);
   insert into humanhub.attendance_batches(id,project_id,session_id,evidence_ref,submitted_by) values(batch,p,ses,'TEST_LIST',field_user);
   insert into humanhub.batch_rows(project_id,batch_id,session_id,participant_id,age_at_session,sex_recorded,disability_recorded) values(p,batch,ses,person,10,'female','unknown');
   -- Self-review must fail, even if the submitter tries to approve.
   begin
    perform humanhub.approve_attendance_batch(batch,field_user);
    raise exception 'self review incorrectly succeeded' using errcode='P7702';
   exception when raise_exception then null; end;
   -- Direct insertion before validation must fail.
   begin
    insert into humanhub.attendance(project_id,session_id,participant_id,batch_id) values(p,ses,person,batch);
    raise exception 'unvalidated attendance incorrectly accepted' using errcode='P7702';
   exception when raise_exception then null; end;
   select inserted,repeated into inserted_n,repeat_n from humanhub.approve_attendance_batch(batch,reviewer);
   if inserted_n<>1 or repeat_n<>0 then raise exception 'incorrect approval counts'; end if;
  end loop;
  -- A second scan of the same physical session must not increase attendance.
  batch:=gen_random_uuid();
  insert into humanhub.attendance_batches(id,project_id,session_id,evidence_ref,submitted_by) values(batch,p,first_session,'TEST_REPEAT',field_user);
  insert into humanhub.batch_rows(project_id,batch_id,session_id,participant_id) values(p,batch,first_session,person);
  select inserted,repeated into inserted_n,repeat_n from humanhub.approve_attendance_batch(batch,reviewer);
  if inserted_n<>0 or repeat_n<>1 then raise exception 'duplicate attendance accepted'; end if;
  -- Education: one person, three attendances, one first and two repeat. WASH first visit stays new.
  select * into strict rec from humanhub.program_recurrence(p,date '2026-11-25',date '2026-12-02') where program_code='EDU';
  if (rec.unique_people,rec.new_people,rec.returning_people,rec.nonrecurrent_people,rec.recurrent_people,rec.attendances,rec.first_attendances,rec.repeat_attendances) is distinct from (1::bigint,1::bigint,0::bigint,0::bigint,1::bigint,3::bigint,1::bigint,2::bigint) then raise exception 'education recurrence incorrect'; end if;
  select * into strict rec from humanhub.program_recurrence(p,date '2026-11-25',date '2026-12-02') where program_code='WASH';
  if (rec.new_people,rec.nonrecurrent_people,rec.repeat_attendances) is distinct from (1::bigint,1::bigint,0::bigint) then raise exception 'WASH first visit incorrect'; end if;
  -- Period start excludes earlier history from attendance totals, not from recurrence classification.
  select * into strict rec from humanhub.program_recurrence(p,date '2026-12-01',date '2026-12-31') where program_code='EDU';
  if (rec.new_people,rec.returning_people,rec.recurrent_people,rec.attendances,rec.first_attendances,rec.repeat_attendances) is distinct from (0::bigint,1::bigint,1::bigint,1::bigint,0::bigint,1::bigint) then raise exception 'period history incorrect'; end if;
  select * into strict rec from humanhub.activity_recurrence(p,date '2026-12-01',date '2026-12-31') where activity_key='MATH';
  if (rec.new_people,rec.nonrecurrent_people,rec.first_attendances) is distinct from (1::bigint,1::bigint,1::bigint) then raise exception 'activity recurrence incorrect'; end if;
  if (select count(*) from humanhub.attendance_history where project_id=p)<>4 then raise exception 'incorrect history total'; end if;
  if (select count(distinct participant_id) from humanhub.attendance_history where project_id=p)<>1 then raise exception 'incorrect unique count'; end if;
  if (select program_sequence from humanhub.attendance_history where session_id=first_session and participant_id=person)<>1 then raise exception 'backfill ordering incorrect'; end if;
  if (select count(*) from humanhub.attendance_history where project_id=p and disability_recorded='unknown')<>4 then raise exception 'unknown disability not preserved'; end if;
  -- A reviewed row cannot be silently edited.
  begin
   update humanhub.batch_rows set disability_recorded='no' where batch_id=batch;
   raise exception 'reviewed row incorrectly changed' using errcode='P7702';
  exception when raise_exception then null; end;
  raise exception 'fixture passed; rollback' using errcode='P7701';
 exception when sqlstate 'P7701' then
  raise notice 'All recurrence assertions passed and synthetic fixture rolled back';
 end;
end $test$;
select 'PASS: recurrence, chronology, activity separation, duplicate scan, approval and immutable demographics; fixture rolled back' as result,
 (select count(*) from humanhub.projects where code='TEST_RECURRENCE') as fixture_projects_remaining,
 (select count(*) from humanhub.attendance) as attendance_remaining;