// routes/art.js
import express from "express";
import multer from "multer";
import path from "path";
import {
  registerArt,
  getArtById,
  getArtListByCategory
} from "../controllers/artController.js";

const router = express.Router();

/* ───────── 파일 업로드 설정 ───────── */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) =>
    cb(null, path.join(process.cwd(), "public/uploads/")),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, base + ext);
  }
});
const upload = multer({ storage });

/* ───────── 등록 (POST /api/art) ───────── */
router.post(
  "/",
  upload.fields([
    { name: "images",    maxCount: 3 },
    { name: "pamphlet",  maxCount: 6 }
  ]),
  registerArt
);

/* ───────── 카테고리별 리스트 ───────── */
/*  ↳ performingarts.html 에서 호출하는 3개 엔드포인트 */
router.get("/events",  (req, res) => getArtListByCategory(req, res, "공연"));
router.get("/arts",    (req, res) => getArtListByCategory(req, res, "예술"));
router.get("/buskers", (req, res) => getArtListByCategory(req, res, "버스커"));

/* (선택) 전체 리스트가 필요하면 아래 주석 해제
// import { getArtList } from "../controllers/artController.js";
// router.get("/", getArtList);
*/

/* ───────── 상세 조회 (숫자 id) ───────── */
/*  ↳ 숫자로만 제한해 ‘events·arts·buskers’ 같은 문자열과 충돌 방지 */
router.get("/:id(\\d+)", getArtById);

export default router;
