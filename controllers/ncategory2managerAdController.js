// controllers/ncategory2managerAdController.js
import pool from "../db.js";

function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function toBool(v) {
  const s = String(v ?? "").toLowerCase().trim();
  return s === "true" || s === "1" || s === "yes" || s === "y" || s === "on";
}

function digitsOnly(v) {
  return clean(v).replace(/[^\d]/g, "");
}

function toDateOrNull(v) {
  const s = clean(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return s.slice(0, 10);
}

const TABLE = "public.admin_ad_slots";

/* ------------------------------------------------------------------
 * slot_type 체크제약 자동 적응 (DB 허용값을 런타임에 읽어서 캐싱)
 *  - 네 로그처럼 "image"가 막힐 수 있으니, 허용값 중 가장 적합한 값을 선택
 * ------------------------------------------------------------------ */
let _slotTypeAllowedCache = null;

async function getAllowedSlotTypes() {
  if (_slotTypeAllowedCache) return _slotTypeAllowedCache;

  try {
    const { rows } = await pool.query(
      `
      SELECT pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname='public'
        AND t.relname='admin_ad_slots'
        AND c.conname='admin_ad_slots_slot_type_check'
      LIMIT 1
      `
    );

    const def = rows[0]?.def || "";
    // 예: CHECK ((slot_type = ANY (ARRAY['text'::text, 'img'::text])))
    // 또는: CHECK ((slot_type IN ('text','img')))
    const found = [];
    const re = /'([^']+)'/g;
    let m;
    while ((m = re.exec(def))) {
      if (m[1]) found.push(m[1]);
    }

    _slotTypeAllowedCache = found.length ? Array.from(new Set(found)) : null;
    return _slotTypeAllowedCache;
  } catch (e) {
    // 체크제약을 못 읽어도 서버는 살아야 함
    _slotTypeAllowedCache = null;
    return null;
  }
}

function pickBestSlotType(allowed, wantImage) {
  // allowed가 있으면 그 안에서 선택
  if (Array.isArray(allowed) && allowed.length) {
    const lower = allowed.map((x) => String(x).toLowerCase());
    const mapBack = (valLower) => allowed[lower.indexOf(valLower)];

    if (wantImage) {
      // 흔한 후보 순서: img > image > photo > banner ...
      for (const cand of ["img", "image", "photo", "banner", "picture"]) {
        const idx = lower.indexOf(cand);
        if (idx >= 0) return mapBack(cand);
      }
      // 이미지용이 딱히 없으면 첫 번째 허용값
      return allowed[0];
    }

    // 텍스트 후보: text > title > content ...
    for (const cand of ["text", "title", "content", "label"]) {
      const idx = lower.indexOf(cand);
      if (idx >= 0) return mapBack(cand);
    }
    return allowed[0];
  }

  // allowed를 못 읽으면 (fallback) 일단 text/img 우선
  return wantImage ? "img" : "text";
}

// multer가 single/any 어떤 방식이든 파일명 뽑기
function getUploadedFileName(req) {
  if (req.file?.filename) return req.file.filename;
  if (Array.isArray(req.files) && req.files.length) {
    // slotImage 필드 우선
    const picked =
      req.files.find((f) => f.fieldname === "slotImage") ||
      req.files[0];
    return picked?.filename || "";
  }
  return "";
}

// ✅ 슬롯 조회
export async function getSlot(req, res) {
  try {
    const page = clean(req.query.page);
    const position = clean(req.query.position);
    const priority = Number(req.query.priority ?? 1) || 1;

    if (!page || !position) {
      return res.status(400).json({ ok: false, message: "page/position required" });
    }

    const { rows } = await pool.query(
      `
      SELECT
        page,
        position,
        priority,
        COALESCE(slot_type,'') AS slot_type,
        COALESCE(text_content,'') AS text_content,
        COALESCE(image_url,'') AS image_url,
        COALESCE(link_url,'') AS link_url,
        COALESCE(store_type,'') AS store_type,
        COALESCE(store_id,'') AS store_id,
        COALESCE(business_name,'') AS business_name,
        start_at,
        end_at,
        COALESCE(no_end,false) AS no_end,
        created_at,
        updated_at
      FROM ${TABLE}
      WHERE page=$1 AND position=$2 AND priority=$3
      LIMIT 1
      `,
      [page, position, priority]
    );

    return res.json({ ok: true, slot: rows[0] || null });
  } catch (err) {
    console.error("[ncategory2manager] getSlot error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}

// ✅ 슬롯 저장(업서트) - slot_type NOT NULL + 체크제약 대응 포함
export async function saveSlot(req, res) {
  try {
    const page = clean(req.body.page);
    const position = clean(req.body.position);
    const priority = Number(req.body.priority ?? 1) || 1;

    if (!page || !position) {
      return res.status(400).json({ ok: false, message: "page/position required" });
    }

    const text_content = clean(req.body.text_content);
    const link_url = clean(req.body.link_url);
    const start_at = toDateOrNull(req.body.start_at);
    const end_at = toDateOrNull(req.body.end_at);
    const no_end = toBool(req.body.no_end);

    // ✅ 가게 선택 정보 (재발 방지)
    const store_type = clean(req.body.store_type);
    const store_id = clean(req.body.store_id);
    const business_name = clean(req.body.business_name);

    // ✅ 기존값 조회(이미지/slot_type 유지용)
    const prev = await pool.query(
      `
      SELECT
        COALESCE(image_url,'') AS image_url,
        COALESCE(slot_type,'') AS slot_type
      FROM ${TABLE}
      WHERE page=$1 AND position=$2 AND priority=$3
      LIMIT 1
      `,
      [page, position, priority]
    );

    const prevImage = prev.rows[0]?.image_url || "";
    const prevSlotType = prev.rows[0]?.slot_type || "";

    // ✅ 업로드된 이미지가 있으면 /uploads/파일명으로 저장
    let image_url = "";
    const uploaded = getUploadedFileName(req);
    if (uploaded) {
      image_url = `/uploads/${uploaded}`;
    } else {
      image_url = prevImage || "";
    }

    // ✅ no_end=true면 end_at은 null
    const finalEndAt = no_end ? null : end_at;

    // ✅ slot_type 보정:
    //   - 프론트가 slot_type을 보내면 우선 (단, DB 허용값에 맞춰 재보정)
    //   - 없으면 기존값
    //   - 없으면 이미지 여부로 자동
    const reqSlotTypeRaw = clean(req.body.slot_type);
    const wantImage = !!image_url;

    const allowed = await getAllowedSlotTypes();

    // 요청값이 있으면 그것도 "허용값에 맞춰" 교정
    let slot_type = "";
    if (reqSlotTypeRaw) {
      // image -> img 같은 흔한 변환도 여기서 같이 처리
      const low = reqSlotTypeRaw.toLowerCase();
      const normalized =
        low === "image" ? "img" :
        low === "사진" ? "img" :
        low;
      // allowed가 있으면 allowed 내에서 가장 근접한 걸 택하고, 없으면 normalized 사용
      if (Array.isArray(allowed) && allowed.length) {
        const lowerAllowed = allowed.map((x) => String(x).toLowerCase());
        const idx = lowerAllowed.indexOf(normalized);
        slot_type = idx >= 0 ? allowed[idx] : pickBestSlotType(allowed, wantImage);
      } else {
        slot_type = normalized;
      }
    } else if (prevSlotType) {
      // 기존값이 있는데도 allowed가 있으면 안전하게 검증/교정
      if (Array.isArray(allowed) && allowed.length) {
        const lowerAllowed = allowed.map((x) => String(x).toLowerCase());
        const idx = lowerAllowed.indexOf(String(prevSlotType).toLowerCase());
        slot_type = idx >= 0 ? allowed[idx] : pickBestSlotType(allowed, wantImage);
      } else {
        slot_type = prevSlotType;
      }
    } else {
      slot_type = pickBestSlotType(allowed, wantImage);
    }

    // ✅ 최종적으로 빈값이면 무조건 fallback
    if (!slot_type) slot_type = wantImage ? "img" : "text";

    // ✅ upsert
    try {
      await pool.query(
        `
        INSERT INTO ${TABLE}
          (page, position, priority, slot_type, text_content, image_url, link_url, start_at, end_at, no_end, store_type, store_id, business_name, updated_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
        ON CONFLICT (page, position, priority)
        DO UPDATE SET
          slot_type=EXCLUDED.slot_type,
          text_content=EXCLUDED.text_content,
          image_url=EXCLUDED.image_url,
          link_url=EXCLUDED.link_url,
          start_at=EXCLUDED.start_at,
          end_at=EXCLUDED.end_at,
          no_end=EXCLUDED.no_end,
          store_type=EXCLUDED.store_type,
          store_id=EXCLUDED.store_id,
          business_name=EXCLUDED.business_name,
          updated_at=NOW()
        `,
        [page, position, priority, slot_type, text_content, image_url, link_url, start_at, finalEndAt, no_end, store_type, store_id, business_name]
      );
    } catch (e) {
      // fallback: update 먼저, 안되면 insert
      const upd = await pool.query(
        `
        UPDATE ${TABLE}
        SET
          slot_type=$4,
          text_content=$5,
          image_url=$6,
          link_url=$7,
          start_at=$8,
          end_at=$9,
          no_end=$10,
          store_type=$11,
          store_id=$12,
          business_name=$13,
          updated_at=NOW()
        WHERE page=$1 AND position=$2 AND priority=$3
        `,
        [page, position, priority, slot_type, text_content, image_url, link_url, start_at, finalEndAt, no_end, store_type, store_id, business_name]
      );

      if (upd.rowCount === 0) {
        await pool.query(
          `
          INSERT INTO ${TABLE}
            (page, position, priority, slot_type, text_content, image_url, link_url, start_at, end_at, no_end, store_type, store_id, business_name, created_at, updated_at)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
          `,
          [page, position, priority, slot_type, text_content, image_url, link_url, start_at, finalEndAt, no_end, store_type, store_id, business_name]
        );
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("[ncategory2manager] saveSlot error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}

// ✅ 슬롯 삭제(레코드 삭제, 파일은 삭제 안 함)
export async function deleteSlot(req, res) {
  try {
    const page = clean(req.query.page);
    const position = clean(req.query.position);
    const priority = Number(req.query.priority ?? 1) || 1;

    if (!page || !position) {
      return res.status(400).json({ ok: false, message: "page/position required" });
    }

    await pool.query(
      `DELETE FROM ${TABLE} WHERE page=$1 AND position=$2 AND priority=$3`,
      [page, position, priority]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("[ncategory2manager] deleteSlot error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}

// ✅ 가게 검색(이름/사업자번호) - combined_store_info만
export async function searchStore(req, res) {
  try {
    const bizNo = digitsOnly(req.query.bizNo);
    const q = clean(req.query.q);

    const params = [];
    let where = "WHERE 1=1";

    if (bizNo) {
      params.push(`%${bizNo}%`);
      where += ` AND regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') ILIKE $${params.length}`;
    }

    if (q) {
      params.push(`%${q}%`);
      where += ` AND (business_name ILIKE $${params.length} OR COALESCE(business_category,'') ILIKE $${params.length})`;
    }

    const sql = `
      SELECT
        'combined_store_info' AS store_type,
        id::text AS id,
        regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') AS business_no,
        business_name,
        COALESCE(business_category,'') AS category
      FROM public.combined_store_info
      ${where}
      ORDER BY business_name
      LIMIT 50
    `;

    const { rows } = await pool.query(sql, params);

    return res.json({ ok: true, stores: rows });
  } catch (err) {
    console.error("[ncategory2manager] searchStore error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}
