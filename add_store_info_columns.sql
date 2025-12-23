-- admin_ad_slots 테이블에 가게 정보 컬럼 추가 (재발 방지)

ALTER TABLE public.admin_ad_slots 
ADD COLUMN IF NOT EXISTS store_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS store_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);

-- 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_admin_ad_slots_store 
ON public.admin_ad_slots(store_type, store_id);

-- 코멘트 추가
COMMENT ON COLUMN public.admin_ad_slots.store_type IS '가게 타입 (combined_store_info, store_info 등)';
COMMENT ON COLUMN public.admin_ad_slots.store_id IS '가게 ID';
COMMENT ON COLUMN public.admin_ad_slots.business_name IS '사업자명 (표시용)';
