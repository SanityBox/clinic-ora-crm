import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "אורה CRM", template: "%s · אורה CRM" },
  description: "מערכת ניהול לקוחות, תורים וקריאות שירות לקליניקת אורה",
};

export const viewport: Viewport = {
  themeColor: "#8e4a5e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
