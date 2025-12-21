-- fix_combined_menu_unique.sql
-- combined_menu_items 테이블에 UNIQUE 제약조건 추가
-- UNIQUE (store_id, name) - 같은 매장에 같은 메뉴명 중복 방지

-- 1. 기존 테이블 구조 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'combined_menu_items' 
ORDER BY ordinal_position;

-- 2. 기존 제약조건 확인
SELECT 
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'combined_menu_items';

-- 3. 중복 데이터 확인 (제약조건 추가 전 확인)
SELECT 
    store_id, 
    name, 
    COUNT(*) as duplicate_count
FROM combined_menu_items
GROUP BY store_id, name
HAVING COUNT(*) > 1;

-- 4. 중복 데이터가 있다면 최신 것만 남기고 삭제 (옵션)
-- DELETE FROM combined_menu_items
-- WHERE id NOT IN (
--     SELECT MAX(id)
--     FROM combined_menu_items
--     GROUP BY store_id, name
-- );

-- 5. UNIQUE 제약조건 추가
ALTER TABLE combined_menu_items 
ADD CONSTRAINT unique_store_menu 
UNIQUE (store_id, name);

-- 6. 제약조건 추가 확인
SELECT 
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'combined_menu_items'
  AND con.conname = 'unique_store_menu';
