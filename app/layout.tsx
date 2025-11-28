import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hiking Pathfinder - Оптимальные туристические маршруты",
  description: "Система поиска оптимальных пеших туристических маршрутов с учётом рельефа местности и проходимости",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
