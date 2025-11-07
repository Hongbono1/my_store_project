# Mall Hankook - AI Coding Instructions

이 프로젝트는 ES6 modules를 사용하는 Node.js/Express 매장 정보 플랫폼입니다.

## 🏗️ Architecture Overview

- **Backend**: Express.js server (`server.js`) with PostgreSQL (Neon DB)
- **Frontend**: Static HTML/JS files in `public2/` with TailwindCSS + CDN libraries
- **Database**: Single PostgreSQL connection pool (`db.js`) with auto-reconnection
- **File Storage**: Local uploads via Multer to `public2/uploads/`
- **Deployment**: Cloudtype with Docker containerization

## 📁 Key File Structure Patterns

```
server.js          # Main Express app with middleware/routing setup
db.js             # PostgreSQL pool with connection diagnostics
controllers/      # Business logic (async functions returning JSON)  
routes/           # Express routers connecting HTTP routes to controllers
public2/          # Static HTML files (main frontend)
middlewares/      # Multer file upload configuration
```

## 🔌 Database Patterns

**Connection**: Single shared pool from `db.js` - import as `import pool from "../db.js"`

**Table Management**: Auto-initialization scripts (`check_table.js`, `init_open_stores_table.js`) check existence and create tables with standard schema:
- `id SERIAL PRIMARY KEY`  
- `created_at/updated_at TIMESTAMP DEFAULT NOW()`
- Geolocation via `lat/lng DECIMAL(10, 7)` fields

**Query Style**: Direct SQL with parameterized queries (`$1, $2, ...`), no ORM

## 🛣️ Routing Architecture

**Pattern**: Controller-Router separation
- Controllers: Pure async functions `export async function functionName(req, res)`
- Routers: Simple Express route mappings importing controller functions
- Mount in `server.js` with path prefixes: `app.use("/api/path", routerName)`

**API Responses**: Standardized JSON format:
```javascript
// Success: { success: true, data: ... } or direct array for lists
// Error: { success: false, error: "message" }
```

## 📤 File Upload System

**Configuration**: `middlewares/upload.js` - Multer with disk storage to `public2/uploads/`
- Filename sanitization with timestamp prefix
- 5MB file size limit
- Automatic directory creation

**Usage Pattern**: 
```javascript
import { upload } from "../middlewares/upload.js";
router.post("/endpoint", upload.single("fieldName"), controllerFunction);
```

## 🎨 Frontend Architecture

**HTML Structure**: Static files in `public2/` with embedded JavaScript
- TailwindCSS via CDN for styling
- External libraries: TinyMCE, Kakao Maps, Daum Postcode
- Custom CSS classes: `.neo-card` for glassmorphism effects

**JavaScript Patterns**: 
- Direct fetch() calls to backend APIs
- Form data handled via `new FormData()`  
- DOM manipulation with vanilla JavaScript

## 🚀 Development Workflow

**CSS Building**: 
- Source: `src/input.css` → Output: `public/assets/css/tailwind.css`
- Commands: `npm run build` (production) / `npm run dev` (watch mode)

**Database Setup**:
```bash
node check_table.js    # Verify/create tables
node init_open_stores_table.js  # Initialize open_stores table
```

**Local Development**: `node server.js` (Port 3000)

## 🔧 Key Conventions

**Error Handling**: Global error middleware handles Multer upload errors and returns structured JSON with request IDs

**Logging**: Request/response logging with UUIDs via `randomUUID()` middleware

**Environment**: All sensitive config via `process.env` (DATABASE_URL, BIZ_API_KEY)

**Static Serving**: Dual setup - `public/` for assets, `public2/` for HTML pages with extension-less routing

## 📍 External Integrations

**Business Verification**: `/verify-biz` proxy endpoint to Korean business registry API
**Maps**: Kakao Maps SDK with coordinate handling in `lat/lng` decimal format
**Geocoding**: Client-side Daum Postcode integration for address → coordinates

## 🐳 Deployment

**Cloudtype**: Auto-build via `Dockerfile` with volume mounting for uploads
**Docker**: Multi-stage build copying all project files, exposing port 3000
**Config**: `my-store-project.yml` defines deployment parameters

## 💡 Development Tips

- Always use parameterized queries for SQL injection prevention
- Image paths stored as relative URLs (`/uploads/filename.ext`)
- Frontend uses direct API calls - check browser Network tab for debugging
- Database connection pool handles reconnection automatically
- ES6 imports throughout - no CommonJS require() statements