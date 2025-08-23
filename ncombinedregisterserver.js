// ncombinedregisterserver.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import ncombinedregisterRoutes from "./routes/ncombinedregister.js";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 (HTML + 업로드)
app.use(express.static(path.join(__dirname, "public2")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ★ 루트에 마운트 → 실제 엔드포인트: /store, /foodregister/:id/full
app.use("/", ncombinedregisterRoutes);

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
