import pool from "../db.js";

// 🔽 홍보의 배달 (음식점 최신 3개)
export async function getFoodLatest(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 3;
    
    const result = await pool.query(
      `SELECT 
        id, 
        store_name as name, 
        store_category as category, 
        image_url as image,
        created_at
       FROM foods
       WHERE store_name IS NOT NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    // 데이터가 없으면 마지막 저장된 데이터라도 반환
    if (result.rows.length === 0) {
      const fallbackResult = await pool.query(
        `SELECT 
          id, 
          store_name as name, 
          store_category as category, 
          image_url as image,
          created_at
         FROM foods
         WHERE store_name IS NOT NULL
         ORDER BY id DESC
         LIMIT $1`,
        [limit]
      );
      return res.json(fallbackResult.rows);
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error("❌ 홍보의 배달 조회 오류:", err);
    res.status(500).json({ success: false, error: "서버 오류" });
  }
}

// 🔽 HOT 랭킹 (조회수 기준)
export async function getHotLatest(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 3;
    
    const result = await pool.query(
      `SELECT 
        id, 
        store_name as name, 
        store_category as category,
        view_count,
        image_url as image
       FROM foods
       WHERE store_name IS NOT NULL AND view_count > 0
       ORDER BY view_count DESC, created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    if (result.rows.length === 0) {
      const fallbackResult = await pool.query(
        `SELECT 
          id, 
          store_name as name, 
          store_category as category,
          0 as view_count,
          image_url as image
         FROM foods
         WHERE store_name IS NOT NULL
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      return res.json(fallbackResult.rows);
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error("❌ HOT 랭킹 조회 오류:", err);
    res.status(500).json({ success: false, error: "서버 오류" });
  }
}

// 🔽 전통시장 최신 소식
export async function getTraditionalLatest(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 3;
    
    const result = await pool.query(
      `SELECT 
        id, 
        market_name as name, 
        region, 
        address, 
        image_url as image,
        created_at
       FROM traditional_markets
       WHERE market_name IS NOT NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    if (result.rows.length === 0) {
      const fallbackResult = await pool.query(
        `SELECT 
          id, 
          market_name as name, 
          region, 
          address,
          image_url as image,
          created_at
         FROM traditional_markets
         WHERE market_name IS NOT NULL
         ORDER BY id DESC
         LIMIT $1`,
        [limit]
      );
      return res.json(fallbackResult.rows);
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error("❌ 전통시장 조회 오류:", err);
    res.status(500).json({ success: false, error: "서버 오류" });
  }
}

// 🔽 공연/예술/축제
export async function getFestivalLatest(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 3;
    
    // festivals 테이블이 없으면 빈 배열 반환
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'festivals'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }
    
    const result = await pool.query(
      `SELECT 
        id, 
        title, 
        event_date as date, 
        location,
        image_url as image,
        created_at
       FROM festivals
       WHERE title IS NOT NULL
       ORDER BY event_date DESC, created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error("❌ 공연/축제 조회 오류:", err);
    res.json([]);
  }
}

// 🔽 이벤트
export async function getEventLatest(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 3;
    
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'events'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }
    
    const result = await pool.query(
      `SELECT 
        id, 
        title, 
        store_name, 
        event_type,
        image_url as image,
        start_date, 
        end_date
       FROM events
       WHERE title IS NOT NULL AND end_date >= CURRENT_DATE
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error("❌ 이벤트 조회 오류:", err);
    res.json([]);
  }
}

// 🔽 오픈 예정
export async function getOpenLatest(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 3;
    
    const result = await pool.query(
      `SELECT 
        id, 
        store_name, 
        open_date, 
        address, 
        store_category as category,
        image_url as image
       FROM open_stores
       WHERE store_name IS NOT NULL AND open_date >= CURRENT_DATE
       ORDER BY open_date ASC, created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    if (result.rows.length === 0) {
      const fallbackResult = await pool.query(
        `SELECT 
          id, 
          store_name, 
          open_date, 
          address, 
          store_category as category,
          image_url as image
         FROM open_stores
         WHERE store_name IS NOT NULL
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      return res.json(fallbackResult.rows);
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error("❌ 오픈 예정 조회 오류:", err);
    res.status(500).json({ success: false, error: "서버 오류" });
  }
}

// 🔽 가게 자랑
export async function getPrideLatest(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 3;
    
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'store_pride'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }
    
    const result = await pool.query(
      `SELECT 
        id, 
        title, 
        store_name, 
        store_category as category,
        image_url as image,
        created_at
       FROM store_pride
       WHERE title IS NOT NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error("❌ 가게 자랑 조회 오류:", err);
    res.json([]);
  }
}

// 🔽 우리동네 모든 가게
export async function getAllStoresLatest(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 3;
    
    const result = await pool.query(
      `SELECT 
        id, 
        store_name as name, 
        store_category as category,
        image_url as image,
        created_at
       FROM foods
       WHERE store_name IS NOT NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error("❌ 모든 가게 조회 오류:", err);
    res.status(500).json({ success: false, error: "서버 오류" });
  }
}

// 🔽 홍보의 추천
export async function getSuggestLatest(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 3;
    
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'suggest_stores'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }
    
    const result = await pool.query(
      `SELECT 
        id, 
        store_name, 
        mood, 
        store_category as category,
        image_url as image,
        created_at
       FROM suggest_stores
       WHERE store_name IS NOT NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error("❌ 홍보의 추천 조회 오류:", err);
    res.json([]);
  }
}

// 🔽 계절 테마
export async function getSeasonLatest(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 3;
    
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'season_themes'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }
    
    const result = await pool.query(
      `SELECT 
        id, 
        title, 
        season, 
        store_name,
        image_url as image,
        created_at
       FROM season_themes
       WHERE title IS NOT NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error("❌ 계절 테마 조회 오류:", err);
    res.json([]);
  }
}

// 🔽 지역 게시판
export async function getLocalBoardLatest(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 3;
    
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'local_board'
      )`
    );
    
    if (!tableCheck.rows[0].exists) {
      return res.json([]);
    }
    
    const result = await pool.query(
      `SELECT 
        id, 
        title, 
        author,
        created_at
       FROM local_board
       WHERE title IS NOT NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error("❌ 지역 게시판 조회 오류:", err);
    res.json([]);
  }
}