# Firebase design

สถานะปัจจุบัน: ระบบรองรับ Firestore repository และ Firebase Authentication แล้ว โดยเปิดใช้ด้วย `DATA_BACKEND=firestore` และ `AUTH_MODE=firebase` หน้าจอและ API เดิมยังใช้ `CategoryRepository` และ `ProjectRepository` เหมือนเดิม

## Data model

```text
users/{ownerId}
  email
  name
  image
  createdAt
  updatedAt

users/{ownerId}/categories/{categoryId}
  name
  isActive
  createdAt
  updatedAt

users/{ownerId}/projects/{projectId}
  ProjectInput fields
  PricingResult fields
  formulaVersion
  createdAt
  updatedAt
```

เหตุผลที่ใช้ subcollection ใต้ `users/{ownerId}`:

- แยกข้อมูลเจ้าของแต่ละคนชัดเจน
- backup/restore และลบข้อมูลเจ้าของทำได้ง่าย
- ย้ายจาก PostgreSQL ได้โดยไม่กระทบหน้าจอ

## เปิดใช้งาน Firestore

1. สร้าง Firebase project และเปิด Cloud Firestore
2. สร้าง service account สำหรับ server
3. ตั้งค่า env:

```env
DATA_BACKEND=firestore
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

หรือใช้ Application Default Credentials:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
```

บน Firebase App Hosting สามารถใช้ค่าที่ platform เติมให้ เช่น `FIREBASE_CONFIG` และตั้ง secret ผ่าน Firebase console/Secret Manager

## Auth

ระบบแยกโหมด Authentication ดังนี้:

- Docker local: `AUTH_MODE=nextauth` และ `LOCAL_AUTH_BYPASS=true` เข้าใช้งานได้ทันที
- Firebase App Hosting: `AUTH_MODE=firebase` และ `LOCAL_AUTH_BYPASS=false` ใช้ Google Login ของ Firebase

ขั้นตอน Login บน Firebase:

1. Browser ล็อกอินด้วย Google ผ่าน Firebase Web SDK แบบ in-memory
2. ส่ง ID token ไป `POST /api/auth/firebase/session`
3. Server ตรวจลายเซ็น token, verified email, อายุการ sign-in และ `ALLOWED_EMAILS`
4. Server สร้าง Firebase session cookie แบบ HttpOnly อายุ 5 วัน
5. API ทุกเส้นตรวจ session cookie และ owner ก่อนเข้าถึง Firestore

## Security notes

- Firebase Admin SDK เป็น privileged server environment จึงไม่ถูกจำกัดด้วย Firestore Security Rules
- `firestore.rules` ปฏิเสธ direct browser access ทั้งหมด ข้อมูลจึงต้องผ่าน server API
- ห้ามเปิด service account key หรือ `MCP_SHARED_SECRET` ใน repo
- ก่อน production ให้ปิด `LOCAL_AUTH_BYPASS`

## Deploy configuration

ไฟล์ที่เตรียมไว้:

- `apphosting.yaml`: เลือก Firestore/Firebase Auth และอ้าง Secret Manager
- `firebase.json`: กำหนด Firestore rules/indexes และ emulator ports
- `firestore.rules`: ปิด direct client access
- `firestore.indexes.json`: indexes ปัจจุบัน (ยังไม่ต้องใช้ composite index)

เปิด Google provider ใน Firebase Console > Authentication > Sign-in method และสร้าง secret:

```powershell
firebase apphosting:secrets:set allowedEmails
firebase deploy --only firestore
```

App Hosting เติม Application Default Credentials ให้ Firebase Admin อัตโนมัติ จึงไม่ต้องนำ service-account private key ไปวางใน production ส่วน Firebase Web SDK config กำหนดเป็น `NEXT_PUBLIC_FIREBASE_*` ใน `apphosting.yaml`

## Production deployment

- Project ID: `import-price-studio-nart`
- Project number: `154471825748`
- Web App ID: `1:154471825748:web:a34637101e8cfe4e2048c1`
- App Hosting backend: `import-price-studio`
- URL: `https://import-price-studio--import-price-studio-nart.asia-southeast1.hosted.app`
- Firestore/App Hosting region: `asia-southeast1` (Singapore)
- Firestore: Native mode, Standard edition, Delete Protection enabled
- Google provider: enabled; authorized App Hosting domain added
- Allowlist secret: `allowedEmails` (ไม่เก็บค่า secret ลง repository)
- Billing: Blaze; Budget Alert `100 THB`

ตรวแล้วว่า Google Login ด้วย `sl@brt.co.th` สำเร็จ, หมวดเริ่มต้นโหลดจาก Firestore และ `GET /api/health` ตอบ `200` พร้อม `{"status":"ok","backend":"firestore"}`

ข้อควรทราบ: Firebase App Hosting ต้องใช้แผน Blaze แบบ pay-as-you-go แม้บริการจะมีโควตาใช้งานฟรีบางส่วน ควรสร้างโปรเจกต์แยก เปิด Budget Alert และใช้ `asia-southeast1` (Singapore) สำหรับทั้ง App Hosting และ Firestore เพื่อลด latency สำหรับผู้ใช้ในไทย

Firebase CLI ในโปรเจกต์รองรับการ deploy จาก source ในเครื่องได้ เมื่อสร้าง project/backend และเปิด Billing แล้วจึงรัน `firebase init apphosting` เพื่อเติม `backendId` ลง `firebase.json`

## Migration path

1. Export backup JSON จาก PostgreSQL
2. ตั้ง `DATA_BACKEND=firestore`
3. เปิดเว็บแล้ว Restore JSON แบบ replace
4. ตรวจหมวด, โปรเจกต์, clone, delete, search/filter และ print/PDF
5. ทดสอบ restart/deploy แล้วข้อมูลยังอยู่ใน Firestore

## Official references

- Firebase Firestore server client libraries: https://firebase.google.com/docs/firestore/quickstart-server
- Firebase Admin ID token verification: https://firebase.google.com/docs/auth/admin/verify-id-tokens
- Firebase session cookies: https://firebase.google.com/docs/auth/admin/manage-cookies
- Firebase App Hosting configuration: https://firebase.google.com/docs/app-hosting/configure
- Firebase App Hosting local source deployment: https://firebase.google.com/docs/app-hosting/alt-deploy
- Firebase App Hosting costs: https://firebase.google.com/docs/app-hosting/costs
