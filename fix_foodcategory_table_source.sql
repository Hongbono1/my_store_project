-- fix_foodcategory_table_source.sql
-- foodcategory 페이지의 NULL/빈 table_source를 store_info로 통일

-- 현재 상태 확인
SELECT 
  page,
  COALESCE(table_source, '(NULL)') AS table_source,
  COUNT(*) as count
FROM public.admin_ad_slots
WHERE page = 'foodcategory'
GROUP BY page, table_source
ORDER BY table_source;

-- NULL 또는 빈 문자열을 store_info로 업데이트
UPDATE public.admin_ad_slots
SET table_source = 'store_info'
WHERE page = 'foodcategory'
  AND (table_source IS NULL OR table_source = '');

-- 업데이트 후 상태 확인
SELECT 
  page,
  COALESCE(table_source, '(NULL)') AS table_source,
  COUNT(*) as count
FROM public.admin_ad_slots
WHERE page = 'foodcategory'
GROUP BY page, table_source
ORDER BY table_source;

-- 상세 목록 확인
SELECT 
  id,
  position,
  store_id,
  table_source,
  business_name
FROM public.admin_ad_slots
WHERE page = 'foodcategory'
ORDER BY position;
