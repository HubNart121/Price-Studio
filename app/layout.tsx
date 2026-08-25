import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Import Price Studio | คำนวณราคาสินค้านำเข้า",
  description:
    "คำนวณต้นทุน ราคาขาย และกำไรของสินค้านำเข้า พร้อมจัดเก็บโปรเจกต์อย่างเป็นระบบ",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
