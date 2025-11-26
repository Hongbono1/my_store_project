import pool from "../db.js";

// 🔽 홍보의 배달 (음식점 최신)
export async function getFoodLatest(req, res) {
  try {
    console.log("📱 getFoodLatest 호출됨");
    const limit = parseInt(req.query.limit) || 3;
    
    // foods 테이블 존재 확인
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'foods'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log("⚠️ foods 테이블 없음");
      return res.json([]);
    }
    
    const result = await pool.query(`
      SELECT 
        id, 
        store_name as name, 
        store_category as category, 
        image_url as image,
        created_at
      FROM foods
      WHERE store_name IS NOT NULL AND store_name != ''
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    
    console.log(`✅ foods 조회 결과: ${result.rows.length}개`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ getFoodLatest 오류:", err);
    res.status(500).json({ 
      success: false, 
      error: "홍보의 배달 데이터 조회 실패"
    });
  }
}

// 🔽 HOT 랭킹 (조회수 기준)
export async function getHotLatest(req, res) {
  try {
    console.log("🔥 getHotLatest 호출됨");
    const limit = parseInt(req.query.limit) || 3;
    
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'foods'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }
    
    // view_count 컬럼 존재 확인
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
          store_category as category,
          COALESCE(view_count, 0) as view_count,
          image_url as image
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
          store_category as category,
          0 as view_count,
          image_url as image
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
    console.error("❌ getHotLatest 오류:", err);
    res.status(500).json({ 
      success: false, 
      error: "HOT 랭킹 데이터 조회 실패"
    });
  }
}

// 🔽 전통시장 최신 소식
export async function getTraditionalLatest(req, res) {
  try {
    console.log("🏪 getTraditionalLatest 호출됨");
    const limit = parseInt(req.query.limit) || 3;
    
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'traditional_markets'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }
    
    const result = await pool.query(`
      SELECT 
        id, 
        market_name as name, 
        region, 
        address, 
        image_url as image,
        created_at
      FROM traditional_markets
      WHERE market_name IS NOT NULL AND market_name != ''
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    
    console.log(`✅ traditional_markets 조회 결과: ${result.rows.length}개`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ getTraditionalLatest 오류:", err);
    res.status(500).json({ 
      success: false, 
      error: "전통시장 데이터 조회 실패"
    });
  }
}

// 🔽 이벤트
export async function getEventLatest(req, res) {
  try {
    console.log("🎉 getEventLatest 호출됨");
    const limit = parseInt(req.query.limit) || 3;
    
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'events'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }
    
    const result = await pool.query(`
      SELECT 
        id, 
        title, 
        store_name, 
        event_type,
        image_url as image,
        start_date, 
        end_date,
        created_at
      FROM events
      WHERE title IS NOT NULL AND title != ''
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    
    console.log(`✅ events 조회 결과: ${result.rows.length}개`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ getEventLatest 오류:", err);
    res.status(500).json({ 
      success: false, 
      error: "이벤트 데이터 조회 실패"
    });
  }
}

// 🔽 오픈 예정
export async function getOpenLatest(req, res) {
  try {
    console.log("🎊 getOpenLatest 호출됨");
    const limit = parseInt(req.query.limit) || 3;
    
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'open_stores'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }
    
    const result = await pool.query(`
      SELECT 
        id, 
        store_name, 
        open_date, 
        address, 
        store_category as category,
        image_url as image,
        created_at
      FROM open_stores
      WHERE store_name IS NOT NULL AND store_name != ''
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    
    console.log(`✅ open_stores 조회 결과: ${result.rows.length}개`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ getOpenLatest 오류:", err);
    res.status(500).json({ 
      success: false, 
      error: "오픈 예정 데이터 조회 실패"
    });
  }
}

// 🔽 모든 가게 (foods 테이블 재사용)
export async function getAllStoresLatest(req, res) {
  try {
    console.log("🗺️ getAllStoresLatest 호출됨");
    const limit = parseInt(req.query.limit) || 3;
    
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
        store_category as category,
        image_url as image,
        created_at
      FROM foods
      WHERE store_name IS NOT NULL AND store_name != ''
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);
    
    console.log(`✅ 모든 가게 조회 결과: ${result.rows.length}개`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ getAllStoresLatest 오류:", err);
    res.status(500).json({ 
      success: false, 
      error: "모든 가게 데이터 조회 실패"
    });
  }
}

// 🔽 빈 데이터 반환 함수들 (해당 테이블이 없거나 미구현)
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