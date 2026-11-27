-- MERA demographic breakdown; period filters do not reset longitudinal history.
-- Latest eligible observation in the selected period determines demographic class for a unique person.
create function humanhub.recurrence_demographics(
 p_project uuid, p_from date, p_to date, p_level text,
 p_community uuid default null, p_phase text default null)
returns table(scope_key text,age_group text,sex_recorded text,disability_recorded text,
 unique_people bigint,new_people bigint,returning_people bigint,nonrecurrent_people bigint,recurrent_people bigint,
 attendances bigint,first_attendances bigint,repeat_attendances bigint)
language plpgsql stable security invoker set search_path='' as $$
begin
 if p_project is null or p_from is null or p_to is null or p_from>p_to or p_level is null or p_level not in ('project','program','activity') then
  raise exception 'invalid scope or period';
 end if;
 if p_phase is not null and p_phase not in ('original','expansion','shared') then raise exception 'invalid phase'; end if;
 return query
 with historic as (
  select h.*,
   case p_level when 'program' then h.program_code when 'activity' then h.activity_key else 'PROJECT' end as grp,
   case p_level when 'program' then h.program_sequence when 'activity' then h.activity_sequence else h.project_sequence end as seq
  from humanhub.attendance_history h where h.project_id=p_project and h.day<=p_to
 ), historic_totals as (
  select h.grp,h.participant_id,count(*) as through_cutoff,min(h.day) as first_day
  from historic h group by h.grp,h.participant_id
 ), eligible as (
  select h.*,row_number() over(partition by h.grp,h.participant_id order by h.day desc,case h.shift when 'AM' then 0 else 1 end desc,h.slot desc,h.session_id desc) as latest,
  count(*) over(partition by h.grp,h.participant_id) as period_visits,
  count(*) filter(where h.seq=1) over(partition by h.grp,h.participant_id) as period_first
  from historic h where h.day>=p_from and (p_community is null or h.community_id=p_community)
   and (p_phase is null or h.phase=p_phase)
 ), persons as (
  select e.grp,e.participant_id,e.sex_recorded,e.disability_recorded,e.period_visits,e.period_first,t.through_cutoff,t.first_day,
   case when e.age_at_session is null then 'Sin información' when e.age_at_session<=2 then '0-2'
   when e.age_at_session<=5 then '3-5' when e.age_at_session<=9 then '6-9' when e.age_at_session<=13 then '10-13'
   when e.age_at_session<=17 then '14-17' when e.age_at_session=18 then '18' when e.age_at_session<=59 then '19-59' else '60+' end as age_group
  from eligible e join historic_totals t on t.grp=e.grp and t.participant_id=e.participant_id
  where e.latest=1
 )
 select x.grp,x.age_group,x.sex_recorded,x.disability_recorded,
 count(*),count(*) filter(where x.first_day>=p_from),count(*) filter(where x.first_day<p_from),
 count(*) filter(where x.through_cutoff=1),count(*) filter(where x.through_cutoff>=2),
 sum(x.period_visits)::bigint,sum(x.period_first)::bigint,sum(x.period_visits-x.period_first)::bigint
 from persons x group by x.grp,x.age_group,x.sex_recorded,x.disability_recorded;
end $$;
revoke all on function humanhub.recurrence_demographics(uuid,date,date,text,uuid,text) from public,anon,authenticated,service_role;
