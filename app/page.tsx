import { getCurrentUser } from "@/lib/auth/current-user";
import { getAuthMode, isGoogleAuthConfigured } from "@/lib/auth/config";
import { getFirebaseWebConfig } from "@/lib/firebase/web-config";
import { loginWithGoogle } from "./actions";
import Dashboard from "@/components/dashboard";
import FirebaseLoginButton from "@/components/firebase-login-button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const authMode = getAuthMode();
  const firebaseConfig =
    authMode === "firebase" ? getFirebaseWebConfig() : null;
  const googleAuthConfigured =
    authMode === "firebase" ? Boolean(firebaseConfig) : isGoogleAuthConfigured();

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand-mark" aria-hidden="true">
            ฿
          </div>
          <p className="eyebrow">IMPORT PRICE STUDIO</p>
          <h1>รู้ต้นทุนจริง<br />ก่อนตั้งราคาขาย</h1>
          <p className="login-copy">
            คำนวณราคาสินค้านำเข้าแบบง่ายและละเอียด
            พร้อมบันทึกโปรเจกต์ไว้ใช้งานต่อได้อย่างปลอดภัย
          </p>
          {authMode === "firebase" && firebaseConfig ? (
            <FirebaseLoginButton config={firebaseConfig} />
          ) : googleAuthConfigured ? (
            <form action={loginWithGoogle}>
              <button className="button primary login-button" type="submit">
                <span aria-hidden="true">G</span>
                เข้าสู่ระบบด้วย Google
              </button>
            </form>
          ) : (
            <div className="notice error" role="status">
              {authMode === "firebase"
                ? "ยังไม่ได้ตั้งค่า Firebase Web App กรุณาตรวจสอบ Firebase App Hosting หรือ NEXT_PUBLIC_FIREBASE_*"
                : "ยังไม่ได้ตั้งค่า Google OAuth กรุณาตั้งค่า Client ID และ Client Secret หรือเปิดโหมด Local สำหรับใช้งานในเครื่องนี้"}
            </div>
          )}
          <p className="muted small">
            เข้าได้เฉพาะอีเมลที่เจ้าของระบบอนุญาต
          </p>
        </section>
      </main>
    );
  }

  return <Dashboard user={user} />;
}
