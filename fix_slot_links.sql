-- foodcategory 페이지의 store_info 슬롯에서 type=store를 type=store_info로 수정
UPDATE public.admin_ad_slots
SET link_url = regexp_replace(COALESCE(link_url,''), 'type=store\b', 'type=store_info')
WHERE page='foodcategory'
  AND table_source='store_info'
  AND COALESCE(link_url,'') LIKE '%/ndetail.html%'
  AND COALESCE(link_url,'') LIKE '%type=store%';

-- 모든 페이지에 적용하려면:
UPDATE public.admin_ad_slots
SET link_url = regexp_replace(COALESCE(link_url,''), 'type=store\b', 'type=store_info')
WHERE table_source='store_info'
  AND COALESCE(link_url,'') LIKE '%/ndetail.html%'
  AND COALESO(link_url,'') LIKE '%type=store%';
