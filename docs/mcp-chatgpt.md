# MCP ChatGPT integration

ระบบมี MCP server แยกจากเว็บหลัก เพื่อให้ ChatGPT/Codex เรียกเครื่องมือของ Import Price Studio ได้โดยไม่ต้องเปิด UI

## Endpoint

```text
POST /mcp
GET /health
```

ค่า local:

```text
http://127.0.0.1:3025/mcp
```

ChatGPT ต้องใช้ HTTPS endpoint สำหรับ remote MCP server ดังนั้น local endpoint ต้องผ่าน tunnel หรือ deploy ขึ้น host ก่อนนำไปต่อกับ ChatGPT

## Environment

```env
MCP_PORT=3025
MCP_OWNER_EMAIL=sl@brt.co.th
MCP_OWNER_NAME=Nart
MCP_SHARED_SECRET=replace-with-a-random-secret
PRODUCT_PRICE_PUBLIC_URL=https://your-app.example.com
DATA_BACKEND=postgres
```

ถ้าใช้ Firestore ให้ตั้ง Firebase env ชุดเดียวกับเว็บหลัก

## Tools

| Tool | Type | Purpose |
| --- | --- | --- |
| `calculate_import_price` | read-only | คำนวณราคานำเข้าและ breakdown ค่าขนส่ง |
| `search_projects` | read-only | ค้นหาโปรเจกต์ที่บันทึกไว้ |
| `get_project` | read-only | อ่านโปรเจกต์รายตัว |
| `save_project` | write | บันทึกโปรเจกต์ใหม่ เมื่อผู้ใช้สั่งให้บันทึก |

ยังไม่เปิด update/delete ผ่าน MCP เพื่อลดความเสี่ยงจากคำสั่งผิดพลาด

## Local run

```powershell
npm run mcp:build
npm run mcp:start
```

Docker:

```powershell
docker compose up --build -d mcp
```

Health check:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3025/health
```

## Connect to ChatGPT

1. Deploy หรือเปิด HTTPS tunnel ไปยัง `http://127.0.0.1:3025`
2. ตั้ง connector/app ใน ChatGPT Developer Mode ด้วย endpoint `https://your-domain/mcp`
3. ถ้าใช้ `MCP_SHARED_SECRET` ให้ตั้ง authentication header เป็น Bearer token ตามค่าที่กำหนด
4. Scan tools และทดสอบเรียก `calculate_import_price`
5. ทดสอบ `search_projects` และ `save_project` ด้วยข้อมูลจำลองก่อนใช้งานจริง

## Safety

- `MCP_SHARED_SECRET` เป็นขั้นต่ำสำหรับ dev เท่านั้น production ควรใช้ auth ที่เหมาะสมกว่า เช่น OAuth หรือ gateway ที่ตรวจสิทธิ์
- ตั้ง `MCP_OWNER_EMAIL` ให้เป็นอีเมลใน `ALLOWED_EMAILS`
- เปิด write tool เฉพาะที่จำเป็น
- ทุก tool ฝั่ง server ยัง validate input และคำนวณสูตรเอง ไม่เชื่อผลลัพธ์จาก ChatGPT

## Official references

- OpenAI MCP server docs: https://developers.openai.com/apps-sdk/build/mcp-server/
- OpenAI MCP local/HTTPS guidance: https://developers.openai.com/apps-sdk/build/mcp-server/#deploy-the-endpoint
- Model Context Protocol TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
