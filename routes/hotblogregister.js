import { Router } from "express";
import {
  registerHotBlog,
  getHotBlog,
  registerBlog,
  updateBlog,
  deleteBlog,
} from "../controllers/hotblogregisterController.js";
import { upload } from "../middlewares/upload.js";

const router = Router();

/**
 * ✅ 신규 홍보 블로그(테마/랜덤/셀프 Q&A)
 * - coverImage + 각 질문 이미지 등 다중 필드 업로드 대응
 */
router.post("/register", upload.any(), registerHotBlog);

/**
 * ✅ 신규 홍보 블로그 단일 조회
 */
router.get("/:id", getHotBlog);

/**
 * ✅ (구버전) hot_blogs 기반 CRUD
 * - 기존 흐름을 유지하는 기본 매핑
 * - 파일 업로드가 필요한 구버전 썸네일 흐름이 있다면
 *   별도 multer 구성이 붙어있던 방식으로 확장하면 됨
 */
router.post("/legacy", registerBlog);
router.put("/legacy/:id", updateBlog);
router.delete("/legacy/:id", deleteBlog);

export default router;
