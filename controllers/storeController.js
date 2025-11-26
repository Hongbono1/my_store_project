import pool from "../db.js";

// 🔽 이벤트 최신 데이터
export async function getEventLatest(req, res) {
  try {
    console.log("🎉 getEventLatest 호출됨");
    const limit = parseInt(req.query.limit) || 4;
    
    // events 테이블 존재 확인
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'events'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log("⚠️ events 테이블이 존재하지 않음");
      return res.json([]); // 빈 배열 반환
    }
    
    // 컬럼 구조 확인
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'events'
    `);
    
    console.log("📋 events 테이블 컬럼:", columnCheck.rows.map(row => row.column_name));
    
    const result = await pool.query(`
      SELECT 
        id, 
        title, 
        COALESCE(store_name, '') as store_name,
        COALESCE(event_type, '') as event_type,
        COALESCE(image_url, '') as image,
        start_date, 
        end_date,
        created_at
      FROM events
      WHERE title IS NOT NULL AND title != ''
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    
    console.log(`✅ events 조회 결과: ${result.rows.length}개`);
    res.json(result.rows); // 항상 배열 반환
    
  } catch (err) {
    console.error("❌ getEventLatest 오류:", err.message);
    console.error("❌ 스택:", err.stack);
    
    // 에러 발생 시에도 빈 배열 반환 (500 에러 방지)
    res.json([]);
  }
}

// 🔽 오픈 예정 최신 데이터
export async function getOpenLatest(req, res) {
  try {
    console.log("🎊 getOpenLatest 호출됨");
    const limit = parseInt(req.query.limit) || 4;
    
    // open_stores 테이블 존재 확인
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'open_stores'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log("⚠️ open_stores 테이블이 존재하지 않음 - 테이블 생성 시도");
      
      // 테이블 자동 생성
      await pool.query(`
        CREATE TABLE IF NOT EXISTS open_stores (
          id SERIAL PRIMARY KEY,
          store_name VARCHAR(255) NOT NULL,
          store_category VARCHAR(100),
          address TEXT,
          open_date DATE,
          description TEXT,
          image_url TEXT,
          lat DECIMAL(10, 7),
          lng DECIMAL(10, 7),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      console.log("✅ open_stores 테이블 생성 완료");
      return res.json([]); // 새로 생성된 테이블은 비어있음
    }
    
    const result = await pool.query(`
      SELECT 
        id, 
        store_name, 
        COALESCE(store_category, '') as category,
        COALESCE(address, '') as address,
        open_date, 
        COALESCE(image_url, '') as image,
        created_at
      FROM open_stores
      WHERE store_name IS NOT NULL AND store_name != ''
      ORDER BY 
        CASE 
          WHEN open_date >= CURRENT_DATE THEN open_date 
          ELSE '9999-12-31'::date 
        END ASC,
        created_at DESC
      LIMIT $1
    `, [limit]);
    
    console.log(`✅ open_stores 조회 결과: ${result.rows.length}개`);
    res.json(result.rows);
    
  } catch (err) {
    console.error("❌ getOpenLatest 오류:", err.message);
    console.error("❌ 스택:", err.stack);
    
    // 에러 발생 시에도 빈 배열 반환
    res.json([]);
  }
}

// 🔽 홍보의 배달 (기존 함수 개선)
export async function getFoodLatest(req, res) {
  try {
    console.log("📱 getFoodLatest 호출됨");
    const limit = parseInt(req.query.limit) || 6;
    
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'foods'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log("⚠️ foods 테이블이 존재하지 않음");
      return res.json([]);
    }
    
    const result = await pool.query(`
      SELECT 
        id, 
        store_name as name, 
        COALESCE(store_category, '일반') as category, 
        COALESCE(image_url, '') as image,
        created_at
      FROM foods
      WHERE store_name IS NOT NULL AND store_name != ''
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    
    console.log(`✅ foods 조회 결과: ${result.rows.length}개`);
    res.json(result.rows);
    
  } catch (err) {
    console.error("❌ getFoodLatest 오류:", err.message);
    res.json([]);
  }
}

// 🔽 HOT 랭킹 (기존 함수 개선)
export async function getHotLatest(req, res) {
  try {
    console.log("🔥 getHotLatest 호출됨");
    const limit = parseInt(req.query.limit) || 4;
    
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'foods'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }
    
    // view_count 컬럼 존재 여부 확인
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'foods' AND column_name = 'view_count'
      )
    `);
    
    let query;
    if (columnCheck.rows[0].exists) {
      query = `
        SELECT 
          id, 
          store_name as name, 
          COALESCE(store_category, '일반') as category,
          COALESCE(view_count, 0) as view_count,
          COALESCE(image_url, '') as image
        FROM foods
        WHERE store_name IS NOT NULL AND store_name != ''
        ORDER BY COALESCE(view_count, 0) DESC, created_at DESC
        LIMIT $1
      `;
    } else {
      query = `
        SELECT 
          id, 
          store_name as name, 
          COALESCE(store_category, '일반') as category,
          0 as view_count,
          COALESCE(image_url, '') as image
        FROM foods
        WHERE store_name IS NOT NULL AND store_name != ''
        ORDER BY created_at DESC
        LIMIT $1
      `;
    }
    
    const result = await pool.query(query, [limit]);
    console.log(`✅ hot 조회 결과: ${result.rows.length}개`);
    res.json(result.rows);
    
  } catch (err) {
    console.error("❌ getHotLatest 오류:", err.message);
    res.json([]);
  }
}

// 🔽 전통시장 (기존 함수 개선)
export async function getTraditionalLatest(req, res) {
  try {
    console.log("🏪 getTraditionalLatest 호출됨");
    const limit = parseInt(req.query.limit) || 4;
    
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'traditional_markets'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log("⚠️ traditional_markets 테이블이 존재하지 않음");
      return res.json([]);
    }
    
    const result = await pool.query(`
      SELECT 
        id, 
        market_name as name, 
        COALESCE(region, '') as region,
        COALESCE(address, '') as address, 
        COALESCE(image_url, '') as image,
        created_at
      FROM traditional_markets
      WHERE market_name IS NOT NULL AND market_name != ''
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    
    console.log(`✅ traditional_markets 조회 결과: ${result.rows.length}개`);
    res.json(result.rows);
    
  } catch (err) {
    console.error("❌ getTraditionalLatest 오류:", err.message);
    res.json([]);
  }
}

// 🔽 모든 가게 (기존 함수 개선)
export async function getAllStoresLatest(req, res) {
  try {
    console.log("🗺️ getAllStoresLatest 호출됨");
    const limit = parseInt(req.query.limit) || 4;
    
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'foods'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }
    
    const result = await pool.query(`
      SELECT 
        id, 
        store_name as name, 
        COALESCE(store_category, '일반') as category,
        COALESCE(image_url, '') as image,
        created_at
      FROM foods
      WHERE store_name IS NOT NULL AND store_name != ''
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    
    console.log(`✅ 모든 가게 조회 결과: ${result.rows.length}개`);
    res.json(result.rows);
    
  } catch (err) {
    console.error("❌ getAllStoresLatest 오류:", err.message);
    res.json([]);
  }
}

// 🔽 나머지 빈 함수들
export async function getFestivalLatest(req, res) {
  console.log("🎭 getFestivalLatest 호출됨 (빈 데이터 반환)");
  res.json([]);
}

export async function getPrideLatest(req, res) {
  console.log("💬 getPrideLatest 호출됨 (빈 데이터 반환)");
  res.json([]);
}

export async function getSuggestLatest(req, res) {
  console.log("🎯 getSuggestLatest 호출됨 (빈 데이터 반환)");
  res.json([]);
}

export async function getSeasonLatest(req, res) {
  console.log("🌸 getSeasonLatest 호출됨 (빈 데이터 반환)");
  res.json([]);
}

export async function getLocalBoardLatest(req, res) {
  console.log("📝 getLocalBoardLatest 호출됨 (빈 데이터 반환)");
  res.json([]);
}