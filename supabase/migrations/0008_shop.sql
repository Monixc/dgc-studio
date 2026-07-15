-- 포인트 상점: 상품(선생님 등록/수정/삭제) + 구매 요청(학생 요청 → 선생님 수락 시 확정)

create table public.shop_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text not null default '',
  cost integer not null,
  stock integer not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.shop_items enable row level security;

create policy "shop_items readable by authenticated"
  on public.shop_items for select
  to authenticated using (true);
create policy "shop_items insert own teacher"
  on public.shop_items for insert
  to authenticated with check (created_by = auth.uid() and public.is_teacher());
create policy "shop_items update own"
  on public.shop_items for update
  to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "shop_items delete own"
  on public.shop_items for delete
  to authenticated using (created_by = auth.uid());

create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.shop_items(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.shop_orders enable row level security;

create policy "shop_orders select own or teacher"
  on public.shop_orders for select
  to authenticated using (student_id = auth.uid() or public.is_teacher());
create policy "shop_orders insert own student"
  on public.shop_orders for insert
  to authenticated with check (student_id = auth.uid());
create policy "shop_orders update by teacher"
  on public.shop_orders for update
  to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- 승인 시 재고 차감 + 포인트 차감을 원자적으로 처리(클라이언트 우회 방지, 중복 승인 방지)
create function public.decide_shop_order()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  item public.shop_items%rowtype;
  balance integer;
begin
  if new.status = 'approved' and old.status = 'pending' then
    select * into item from public.shop_items where id = new.item_id for update;
    if item.stock < 1 then
      raise exception '재고가 없습니다';
    end if;

    select coalesce(sum(amount), 0) into balance from public.points_ledger where student_id = new.student_id;
    if balance < item.cost then
      raise exception '포인트가 부족합니다';
    end if;

    update public.shop_items set stock = stock - 1 where id = item.id;
    insert into public.points_ledger (student_id, amount, reason, awarded_by)
    values (new.student_id, -item.cost, '상품 구매: ' || item.name, new.decided_by);
  end if;
  return new;
end;
$$;

create trigger on_shop_order_decided
  before update on public.shop_orders
  for each row execute function public.decide_shop_order();

-- 임시 데이터 10종 (등록한 선생님 계정 아무나 하나를 소유자로 사용)
do $$
declare
  teacher_id uuid;
begin
  select id into teacher_id from public.profiles where role = 'teacher' limit 1;
  if teacher_id is not null then
    insert into public.shop_items (name, image_url, cost, stock, created_by) values
      ('연필 세트', 'https://placehold.co/300x300?text=Pencil', 50, 20, teacher_id),
      ('노트', 'https://placehold.co/300x300?text=Notebook', 30, 30, teacher_id),
      ('지우개', 'https://placehold.co/300x300?text=Eraser', 20, 40, teacher_id),
      ('스티커 팩', 'https://placehold.co/300x300?text=Sticker', 40, 25, teacher_id),
      ('젤펜', 'https://placehold.co/300x300?text=Gel+Pen', 60, 15, teacher_id),
      ('간식 쿠폰', 'https://placehold.co/300x300?text=Snack', 100, 10, teacher_id),
      ('음료 쿠폰', 'https://placehold.co/300x300?text=Drink', 80, 10, teacher_id),
      ('숙제 면제권', 'https://placehold.co/300x300?text=Pass', 200, 5, teacher_id),
      ('자리 선택권', 'https://placehold.co/300x300?text=Seat', 150, 5, teacher_id),
      ('배지', 'https://placehold.co/300x300?text=Badge', 70, 20, teacher_id)
    on conflict do nothing;
  end if;
end $$;

notify pgrst, 'reload schema';
