-- ✅ 푸드카테고리 슬롯의 잘못된 link_url 수정
-- 문제: store_info 테이블의 가게가 combined_store_info로 링크되는 버그 수정

-- 1. store_info 테이블 가게들의 링크를 올바르게 수정
UPDATE public.admin_ad_slots
SET link_url = '/ndetail.html?id=' || store_id || '&type=store_info'
WHERE page = 'foodcategory'
  AND table_source = 'store_info'
  AND store_id IS NOT NULL
  AND (
    link_url IS NULL 
    OR link_url = ''
    OR link_url LIKE '%type=combined%'
    OR link_url LIKE '%type=open%'
    OR link_url NOT LIKE '%type=%'
  );

-- 2. combined_store_info 테이블 가게들의 링크 확인/수정
UPDATE public.admin_ad_slots
SET link_url = '/ndetail.html?id=' || store_id || '&type=combined'
WHERE page = 'foodcategory'
  AND table_source = 'combined_store_info'
  AND store_id IS NOT NULL
  AND (
    link_url IS NULL 
    OR link_url = ''
    OR link_url LIKE '%type=store_info%'
    OR link_url LIKE '%type=open%'
    OR link_url NOT LIKE '%type=%'
  );

-- 3. food_stores 테이블 가게들의 링크 확인/수정
UPDATE public.admin_ad_slots
SET link_url = '/ndetail.html?id=' || store_id || '&type=food'
WHERE page = 'foodcategory'
  AND table_source = 'food_stores'
  AND store_id IS NOT NULL
  AND (
    link_url IS NULL 
    OR link_url = ''
    OR link_url NOT LIKE '%type=food%'
  );

-- 4. 결과 확인
SELECT 
  id,
  page,
  position,
  priority,
  table_source,
  store_id,
  business_name,
  link_url,
  CASE 
    WHEN link_url LIKE '%type=store_info%' THEN '✅ store_info'
    WHEN link_url LIKE '%type=combined%' THEN '✅ combined'
    WHEN link_url LIKE '%type=food%' THEN '✅ food'
    ELSE '❌ 잘못된 링크'
  END as link_check
FROM public.admin_ad_slots
WHERE page = 'foodcategory'
  AND store_id IS NOT NULL
ORDER BY position, priority;
