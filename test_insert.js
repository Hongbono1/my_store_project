import pool from './db.js';

const testHtml = `
<p><strong>안녕하세요!</strong> 이것은 <em>테스트 카페</em>입니다.</p>
<p style="color: rgb(239, 68, 68);">빨간색 텍스트로 강조합니다</p>
<p style="background-color: rgb(254, 243, 199); padding: 8px;">노란 배경의 하이라이트 텍스트입니다</p>
<ul>
  <li>신선한 원두로 내린 커피</li>
  <li>아늑하고 편안한 분위기</li>
  <li>무료 Wi-Fi 제공</li>
</ul>
<p><span style="font-family: 'Noto Sans KR', sans-serif;">한글 폰트</span>도 잘 적용됩니다!</p>
`;

try {
  const result = await pool.query(
    `INSERT INTO open_stores 
     (store_name, open_date, category, phone, description, address, created_at) 
     VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
     RETURNING id`,
    [
      '리치텍스트 테스트 카페', 
      '2024-12-15', 
      '카페/디저트', 
      '02-1234-5678', 
      testHtml, 
      '서울시 강남구 테헤란로 123'
    ]
  );

  console.log('✅ 테스트 데이터 삽입 완료');
  console.log('📝 등록된 ID:', result.rows[0].id);
  console.log('🔗 테스트 URL: http://localhost:3000/opendetail.html?id=' + result.rows[0].id);
} catch (err) {
  console.error('❌ 오류:', err.message);
}

process.exit(0);