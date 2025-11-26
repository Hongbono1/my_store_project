import pool from "../db.js";

// 🔽 이벤트 최신 데이터 - 실제 테이블 스키마 확인 후 쿼리
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
      return res.json([]);
    }
    
    // 실제 컬럼 구조 확인
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'events'
      ORDER BY ordinal_position
    `);
    
    const columns = columnCheck.rows.map(row => row.column_name);
    console.log("📋 events 테이블 실제 컬럼:", columns);
    
    // 안전한 컬럼명으로 쿼리 구성
    const hasStoreName = columns.includes('store_name');
    const hasEventType = columns.includes('event_type');
    const hasImageUrl = columns.includes('image_url');
    
    let query = `
      SELECT 
        id, 
        title,
        ${hasStoreName ? 'store_name' : "'' as store_name"},
        ${hasEventType ? 'event_type' : "'' as event_type"},
        ${hasImageUrl ? 'image_url' : "'' as image"},
        created_at
      FROM events
      WHERE title IS NOT NULL AND title != ''
      ORDER BY created_at DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    
    console.log(`✅ events 조회 결과: ${result.rows.length}개`);
    res.json(result.rows);
    
  } catch (err) {
    console.error("❌ getEventLatest 오류:", err.message);
    res.json([]);
  }
}

// 🔽 오픈 예정 최신 데이터 - 실제 테이블 스키마 확인 후 쿼리
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
      console.log("⚠️ open_stores 테이블이 존재하지 않음 - 테이블 생성");
      
      // 테이블 자동 생성
      await pool.query(`
        CREATE TABLE IF NOT EXISTS open_stores (
          id SERIAL PRIMARY KEY,
          store_name VARCHAR(255) NOT NULL,
          category VARCHAR(100),
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
    
    // 실제 컬럼 구조 확인
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'open_stores'
      ORDER BY ordinal_position
    `);
    
    const columns = columnCheck.rows.map(row => row.column_name);
    console.log("📋 open_stores 테이블 실제 컬럼:", columns);
    
    // 안전한 컬럼명으로 쿼리 구성
    const hasStoreCategory = columns.includes('store_category');
    const hasCategory = columns.includes('category');
    const hasImageUrl = columns.includes('image_url');
    const hasOpenDate = columns.includes('open_date');
    
    // category vs store_category 처리
    let categoryColumn = '';
    if (hasStoreCategory) {
      categoryColumn = 'store_category as category';
    } else if (hasCategory) {
      categoryColumn = 'category';
    } else {
      categoryColumn = "'' as category";
    }
    
    let query = `
      SELECT 
        id, 
        store_name, 
        ${categoryColumn},
        COALESCE(address, '') as address,
        ${hasOpenDate ? 'open_date' : 'NULL as open_date'}, 
        ${hasImageUrl ? 'image_url' : "'' as image_url"} as image,
        created_at
      FROM open_stores
      WHERE store_name IS NOT NULL AND store_name != ''
      ORDER BY created_at DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    
    console.log(`✅ open_stores 조회 결과: ${result.rows.length}개`);
    res.json(result.rows);
    
  } catch (err) {
    console.error("❌ getOpenLatest 오류:", err.message);
    res.json([]);
  }
}

// 🔽 홍보의 배달 - foods 테이블 안전 쿼리
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
    
    // foods 테이블 컬럼 확인
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'foods'
    `);
    
    const columns = columnCheck.rows.map(row => row.column_name);
    const hasStoreCategory = columns.includes('store_category');
    const hasCategory = columns.includes('category');
    const hasImageUrl = columns.includes('image_url');
    
    let categoryColumn = '';
    if (hasStoreCategory) {
      categoryColumn = 'store_category as category';
    } else if (hasCategory) {
      categoryColumn = 'category';
    } else {
      categoryColumn = "'일반' as category";
    }
    
    const query = `
      SELECT 
        id, 
        store_name as name, 
        ${categoryColumn}, 
        ${hasImageUrl ? 'image_url' : "'' as image_url"} as image,
        created_at
      FROM foods
      WHERE store_name IS NOT NULL AND store_name != ''
      ORDER BY created_at DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    
    console.log(`✅ foods 조회 결과: ${result.rows.length}개`);
    res.json(result.rows);
    
  } catch (err) {
    console.error("❌ getFoodLatest 오류:", err.message);
    res.json([]);
  }
}

// 🔽 HOT 랭킹 - 안전한 컬럼 참조
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
    
    // 컬럼 존재 확인
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'foods'
    `);
    
    const columns = columnCheck.rows.map(row => row.column_name);
    const hasViewCount = columns.includes('view_count');
    const hasStoreCategory = columns.includes('store_category');
    const hasCategory = columns.includes('category');
    const hasImageUrl = columns.includes('image_url');
    
    let categoryColumn = '';
    if (hasStoreCategory) {
      categoryColumn = 'store_category as category';
    } else if (hasCategory) {
      categoryColumn = 'category';
    } else {
      categoryColumn = "'일반' as category";
    }
    
    let query;
    if (hasViewCount) {
      query = `
        SELECT 
          id, 
          store_name as name, 
          ${categoryColumn},
          COALESCE(view_count, 0) as view_count,
          ${hasImageUrl ? 'image_url' : "'' as image_url"} as image
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
          ${categoryColumn},
          0 as view_count,
          ${hasImageUrl ? 'image_url' : "'' as image_url"} as image
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

// 🔽 전통시장 - 안전한 컬럼 참조
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
    
    // 컬럼 확인
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'traditional_markets'
    `);
    
    const columns = columnCheck.rows.map(row => row.column_name);
    const hasImageUrl = columns.includes('image_url');
    const hasRegion = columns.includes('region');
    const hasAddress = columns.includes('address');
    
    const query = `
      SELECT 
        id, 
        market_name as name, 
        ${hasRegion ? 'region' : "'' as region"},
        ${hasAddress ? 'address' : "'' as address"}, 
        ${hasImageUrl ? 'image_url' : "'' as image_url"} as image,
        created_at
      FROM traditional_markets
      WHERE market_name IS NOT NULL AND market_name != ''
      ORDER BY created_at DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    
    console.log(`✅ traditional_markets 조회 결과: ${result.rows.length}개`);
    res.json(result.rows);
    
  } catch (err) {
    console.error("❌ getTraditionalLatest 오류:", err.message);
    res.json([]);
  }
}

// 🔽 모든 가게 - foods 테이블 안전 쿼리 재사용
export async function getAllStoresLatest(req, res) {
  try {
    console.log("🗺️ getAllStoresLatest 호출됨");
    // getFoodLatest와 동일한 로직 사용
    req.query.limit = req.query.limit || 4;
    return await getFoodLatest(req, res);
  } catch (err) {
    console.error("❌ getAllStoresLatest 오류:", err.message);
    res.json([]);
  }
}

// 🔽 나머지 빈 함수들 (테이블 없음)
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