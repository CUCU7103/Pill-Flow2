-- PillFlow 스키마를 데이터 보존 방식으로 설계 V1 형태로 전환 (DROP 없음)

-- 1) medications: 구버전 time 값으로 비어 있는 times 보정 후 제약 강화
update public.medications
   set times = array[time]
 where (times is null or cardinality(times) = 0)
   and time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

alter table public.medications alter column times drop default;
alter table public.medications alter column times set not null;
alter table public.medications drop column time;
alter table public.medications drop column category;
drop type public.category;

alter table public.medications
  add constraint medications_times_check check (
    pg_catalog.cardinality(times) between 1 and 4
    and times::pg_catalog.text operator(pg_catalog.~) '^[{]([01][0-9]|2[0-3]):[0-5][0-9](,([01][0-9]|2[0-3]):[0-5][0-9])*[}]$'
  ),
  add constraint medications_days_check check (
    pg_catalog.cardinality(days) >= 1
    and days operator(pg_catalog.<@) array['mon','tue','wed','thu','fri','sat','sun']::pg_catalog.text[]
  );

create index medications_user_id_idx on public.medications(user_id);

-- updated_at 자동 갱신 트리거 (앱의 PostgREST 직접 쓰기 기간에도 동작)
create function public.set_medication_updated_at() returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;
revoke all on function public.set_medication_updated_at() from public, anon, authenticated, service_role;
create trigger medications_set_updated_at
  before update on public.medications
  for each row execute function public.set_medication_updated_at();

-- 2) medication_logs: date(text) → taken_on(date), user_id NOT NULL, 중복 방지
alter table public.medication_logs alter column "date" type date using "date"::date;
alter table public.medication_logs rename column "date" to taken_on;
alter table public.medication_logs alter column user_id set not null;

alter table public.medication_logs drop constraint medication_logs_user_id_fkey;
alter table public.medication_logs
  add constraint medication_logs_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

drop index public.idx_medication_logs_date;
drop index public.idx_medication_logs_med_date;
alter table public.medication_logs
  add constraint uq_medication_logs_medication_date unique (medication_id, taken_on);
create index medication_logs_user_date_idx on public.medication_logs(user_id, taken_on);

-- 3) RLS 정책 재생성 (보안 수정: UPDATE WITH CHECK, 로그 insert 시 약 소유권 확인, initplan 최적화)
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('medications', 'medication_logs')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.medications enable row level security;
alter table public.medication_logs enable row level security;

create policy medications_select on public.medications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy medications_insert on public.medications for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy medications_update on public.medications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy medications_delete on public.medications for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy logs_select on public.medication_logs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy logs_insert on public.medication_logs for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.medications m
       where m.id = medication_id and m.user_id = (select auth.uid())
    )
  );
create policy logs_delete on public.medication_logs for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 4) 권한: anon 전면 회수, authenticated는 DML만
revoke all on public.medications, public.medication_logs from anon, authenticated;
grant select, insert, update, delete on public.medications, public.medication_logs to authenticated;
