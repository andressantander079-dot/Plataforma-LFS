import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plataforma LFS - Liga de Fútsal de Ushuaia",
  description: "Portal oficial de la Liga de Fútsal de Ushuaia. Gestión de competencias, planteles, resultados, planillas de partido y trámites de pases.",
  keywords: ["futsal", "ushuaia", "liga lfs", "futbol", "tierradelfuego", "deportes"],
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${playfairDisplay.variable}`}>
      <body className="antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
