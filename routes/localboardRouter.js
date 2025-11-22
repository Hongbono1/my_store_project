import express from "express";
import upload from "../middlewares/localboardUpload.js";
import {
    createPost,
    getPosts,
    getPopularPosts,
    getPostDetail,
    addComment,
    getComments,
    reportPost,
    toggleNotice,
    blockPost,
    checkNickname
} from "../controllers/localboardController.js";

const router = express.Router();

// 닉네임 중복 체크
router.get("/check-nickname", checkNickname);

router.get("/", getPosts);
router.get("/popular", getPopularPosts);

router.get("/:id", getPostDetail);

router.post("/", upload.array("images", 10), createPost);

router.post("/:id/comment", addComment);
router.get("/:id/comments", getComments);

router.post("/:id/report", reportPost);

router.post("/:id/notice", toggleNotice);
router.post("/:id/block", blockPost);

export default router;
