# Import Price Studio

เว็บภาษาไทยสำหรับคำนวณต้นทุนและราคาขายสินค้านำเข้า รองรับสูตรแบบง่ายและแบบละเอียด บันทึกโปรเจกต์ จัดการหมวดสินค้า Backup/Restore JSON และพิมพ์สรุปเป็น PDF

## สิ่งที่มีในระบบ

- คำนวณ EXW, อัตราแลกเปลี่ยน, จำนวน, ค่าขนส่ง, GP Margin, CIF, อากร และ VAT
- แสดงต้นทุนรวม ต้นทุนต่อชิ้น ราคาขายแนะนำ กำไร และ breakdown ค่าขนส่ง/EA
- บันทึก แก้ไข คัดลอก ค้นหา กรอง และลบโปรเจกต์
- จัดการหมวดสินค้าแบบเพิ่ม แก้ไข ปิดใช้งาน และลบเมื่อไม่ถูกใช้งาน
- เลือก data backend ได้ด้วย `DATA_BACKEND=postgres` หรือ `DATA_BACKEND=firestore`
- Docker local เข้าใช้งานได้ทันทีด้วย `LOCAL_AUTH_BYPASS=true`
- MCP server สำหรับให้ ChatGPT/Codex เรียกเครื่องมือคำนวณและอ่าน/บันทึกโปรเจกต์

## เปิดใช้งานด้วย Docker

1. ตั้งค่า `.env` จาก `.env.example`
2. ตั้ง `DEV_AUTH_EMAIL`, `ALLOWED_EMAILS`, และถ้าใช้ MCP ให้ตั้ง `MCP_OWNER_EMAIL`
3. เปิดระบบ:

```powershell
docker compose up --build -d
```

เว็บหลักอยู่ที่ `http://127.0.0.1:3016` ตามค่า `APP_PORT=3016` ใน `.env.example`

MCP local อยู่ที่ `http://127.0.0.1:3025/mcp`

## ใช้ PostgreSQL เดิม

ค่าเริ่มต้นคือ:

```env
DATA_BACKEND=postgres
DATABASE_URL=postgresql://pricing:pricing_password@127.0.0.1:55432/pricing?schema=public
```

ข้อมูล PostgreSQL อยู่ใน Docker volume `product-price_pricing_postgres_data`

## ใช้ Firebase Firestore

ตั้งค่า:

```env
DATA_BACKEND=firestore
AUTH_MODE=firebase
LOCAL_AUTH_BYPASS=false
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

หรือใช้:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
```

โครงข้อมูล Firestore:

```text
users/{ownerId}
users/{ownerId}/categories/{categoryId}
users/{ownerId}/projects/{projectId}
```

`ownerId` สร้างจาก hash ของอีเมลที่ผ่านการตรวจสอบแล้ว เพื่อให้ Web App และ MCP อ้างถึงข้อมูลเจ้าของชุดเดียวกัน

## Firebase App Hosting

ไฟล์ `apphosting.yaml` ตั้งค่า Firestore, Firebase Authentication, Firebase Web App และ Secret Manager แล้ว ส่วน Firebase Admin ใช้ Application Default Credentials ของ App Hosting จึงไม่มี service-account private key ใน repository

สถานะ production ปัจจุบัน:

- Firebase project: `import-price-studio-nart`
- App Hosting backend: `import-price-studio` ที่ `asia-southeast1`
- Production URL: `https://import-price-studio--import-price-studio-nart.asia-southeast1.hosted.app`
- Firestore `(default)`: Native mode ที่ `asia-southeast1` และเปิด Delete Protection
- Google Login: เปิดใช้แล้ว อนุญาต `sl@brt.co.th`
- Billing: Blaze พร้อม Budget Alert `100 THB`

ก่อน rollout ให้เปิด Authentication > Google และสร้าง secret ของ allowlist:

```powershell
firebase apphosting:secrets:set allowedEmails
```

ใส่อีเมลที่อนุญาต คั่นหลายรายการด้วย comma จากนั้น deploy Firestore rules:

```powershell
firebase deploy --only firestore
```

Security Rules ปฏิเสธการอ่าน/เขียนจาก browser ทั้งหมด เพราะระบบบังคับให้ข้อมูลผ่าน Next.js API ที่ตรวจ session, allowlist และ ownerId ก่อนทุกครั้ง

App Hosting ต้องใช้ Firebase Blaze plan ควรสร้างโปรเจกต์แยก ตั้ง Budget Alert และเลือก region `asia-southeast1` (Singapore) ก่อน deploy

ตรวจ production health:

```powershell
Invoke-WebRequest -UseBasicParsing https://import-price-studio--import-price-studio-nart.asia-southeast1.hosted.app/api/health
```

## MCP สำหรับ ChatGPT/Codex

เครื่องมือ MCP ที่มี:

- `calculate_import_price`: คำนวณราคานำเข้าแบบ read-only
- `search_projects`: ค้นหาโปรเจกต์แบบ read-only
- `get_project`: อ่านโปรเจกต์รายตัวแบบ read-only
- `save_project`: บันทึกโปรเจกต์ใหม่

รันในเครื่อง:

```powershell
npm run mcp:build
npm run mcp:start
```

ตรวจ health:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3025/health
```

ChatGPT ต้องเรียก MCP ผ่าน HTTPS endpoint จึงต้อง deploy หรือใช้ tunnel สำหรับทดสอบ local และควรตั้ง `MCP_SHARED_SECRET` เป็นค่าลับก่อนเปิดให้ภายนอก

## คำสั่งพัฒนา

```powershell
npm install
docker compose up -d db
npm run db:deploy
npm run dev
```

## ตรวจสอบ

```powershell
npm test
npm run build
npm run mcp:build
```

เว็บหลักมี health check ที่ `GET /api/health` และ MCP มี health check ที่ `GET /health`

ผลคำนวณเป็นเครื่องมือประมาณต้นทุนเพื่อช่วยตัดสินใจ ไม่ใช่เอกสารยื่นศุลกากรหรือคำแนะนำทางภาษี
