import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Threadly — эскиз в 3D",
  description: "Подготовьте эскиз одежды и настройки для создания 3D-модели.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
