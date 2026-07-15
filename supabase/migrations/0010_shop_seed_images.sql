-- 임시 상품 이미지: 외부 placehold.co URL → shop-items 버킷 공개 URL로 교체
update public.shop_items set image_url =
  'https://bhvtfbtlsuvaeojexbjk.supabase.co/storage/v1/object/public/shop-items/' || file
from (values
  ('연필 세트', 'pencil.png'),
  ('노트', 'notebook.png'),
  ('지우개', 'eraser.png'),
  ('스티커 팩', 'sticker.png'),
  ('젤펜', 'gelpen.png'),
  ('간식 쿠폰', 'snack.png'),
  ('음료 쿠폰', 'drink.png'),
  ('숙제 면제권', 'pass.png'),
  ('자리 선택권', 'seat.png'),
  ('배지', 'badge.png')
) as seed(name, file)
where shop_items.name = seed.name;
