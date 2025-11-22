-- shopping_info 테이블의 SNS 컬럼 변경
-- YouTube, Blog 컬럼을 Facebook, TikTok으로 변경

ALTER TABLE shopping_info 
RENAME COLUMN sns_youtube TO sns_facebook;

ALTER TABLE shopping_info 
RENAME COLUMN sns_blog TO sns_tiktok;
