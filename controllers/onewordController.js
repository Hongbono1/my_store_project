import pool from "../db.js";

// 우리동네 한마디 메시지 생성
export async function getLocalOneword(req, res) {
  try {
    const region = req.query.region || "unknown";

    // 1. 최근 1시간 인기 검색어
    const search = await pool.query(`
      SELECT keyword, COUNT(*) AS cnt
      FROM search_logs
      WHERE region = $1 AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY keyword
      ORDER BY cnt DESC
      LIMIT 1
    `, [region]);

    if (search.rows.length > 0) {
      return res.json({
        success: true,
        message: `지금 이 시간엔 '${search.rows[0].keyword}' 검색이 가장 많아요 🔥`,
        keyword: search.rows[0].keyword
      });
    }

    // 2. 인기 메뉴 클릭
    const menu = await pool.query(`
      SELECT menu_name, COUNT(*) AS cnt
      FROM menu_click_logs
      WHERE region = $1 AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY menu_name
      ORDER BY cnt DESC
      LIMIT 1
    `, [region]);

    if (menu.rows.length > 0) {
      return res.json({
        success: true,
        message: `지금 '${menu.rows[0].menu_name}' 메뉴를 찾는 분들이 많아요 😋`,
        keyword: menu.rows[0].menu_name
      });
    }

    // 3. 가게 조회수 인기
    const view = await pool.query(`
      SELECT store_id, COUNT(*) AS cnt
      FROM view_logs
      WHERE region = $1 AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY store_id
      ORDER BY cnt DESC
      LIMIT 1
    `, [region]);

    if (view.rows.length > 0) {
      return res.json({
        success: true,
        message: `이 시간엔 특정 가게가 관심을 받고 있어요 👀`
      });
    }

    // 데이터 없으면 기본 문구
    return res.json({
      success: true,
      message: "우리동네가 오늘은 차분한 하루네요 🙂"
    });
  } catch (error) {
    console.error("❌ 우리동네 한마디 조회 실패:", error);
    res.status(500).json({
      success: false,
      error: "서버 오류가 발생했습니다."
    });
  }
}

// 검색 로그 기록
export async function logSearch(req, res) {
  try {
    const { region, keyword } = req.body;

    if (!region || !keyword) {
      return res.status(400).json({
        success: false,
        error: "region과 keyword는 필수입니다."
      });
    }

    await pool.query(`
      INSERT INTO search_logs (region, keyword)
      VALUES ($1, $2)
    `, [region, keyword]);

    res.json({
      success: true,
      message: "검색 로그 기록 완료"
    });
  } catch (error) {
    console.error("❌ 검색 로그 기록 실패:", error);
    res.status(500).json({
      success: false,
      error: "서버 오류가 발생했습니다."
    });
  }
}

// 메뉴 클릭 로그 기록
export async function logMenuClick(req, res) {
  try {
    const { region, menu_name } = req.body;

    if (!region || !menu_name) {
      return res.status(400).json({
        success: false,
        error: "region과 menu_name은 필수입니다."
      });
    }

    await pool.query(`
      INSERT INTO menu_click_logs (region, menu_name)
      VALUES ($1, $2)
    `, [region, menu_name]);

    res.json({
      success: true,
      message: "메뉴 클릭 로그 기록 완료"
    });
  } catch (error) {
    console.error("❌ 메뉴 클릭 로그 기록 실패:", error);
    res.status(500).json({
      success: false,
      error: "서버 오류가 발생했습니다."
    });
  }
}

// 조회수 로그 기록
export async function logView(req, res) {
  try {
    const { region, store_id } = req.body;

    if (!region || !store_id) {
      return res.status(400).json({
        success: false,
        error: "region과 store_id는 필수입니다."
      });
    }

    await pool.query(`
      INSERT INTO view_logs (region, store_id)
      VALUES ($1, $2)
    `, [region, parseInt(store_id)]);

    res.json({
      success: true,
      message: "조회 로그 기록 완료"
    });
  } catch (error) {
    console.error("❌ 조회 로그 기록 실패:", error);
    res.status(500).json({
      success: false,
      error: "서버 오류가 발생했습니다."
    });
  }
}
