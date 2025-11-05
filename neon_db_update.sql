-- neon_db_update.sql
-- 오픈 매장 테이블을 수정된 코드에 맞게 업데이트

-- 1. 기존 테이블에서 위도/경도 컬럼 제거
ALTER TABLE open_stores DROP COLUMN IF EXISTS lat;
ALTER TABLE open_stores DROP COLUMN IF EXISTS lng;

-- 2. detail_address 컬럼도 제거 (address로 통합됨)
ALTER TABLE open_stores DROP COLUMN IF EXISTS detail_address;

-- 3. 테이블이 없다면 새로 생성
CREATE TABLE IF NOT EXISTS open_stores (
    id SERIAL PRIMARY KEY,
    store_name VARCHAR(255) NOT NULL,
    open_date DATE NOT NULL,
    category VARCHAR(100),
    phone VARCHAR(50) NOT NULL,
    description TEXT,
    address TEXT,
    image_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. 현재 테이블 구조 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'open_stores' 
ORDER BY ordinal_position;

-- 5. 현재 데이터 개수 확인
SELECT COUNT(*) as total_stores FROM open_stores;