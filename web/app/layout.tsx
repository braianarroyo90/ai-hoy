import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = "https://ai-hoy.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "AI Hoy — Noticias de Inteligencia Artificial en Español",
    template: "%s | AI Hoy",
  },
  description: "Las mejores noticias de inteligencia artificial, curadas y resumidas en español. Actualizado cada 6 horas.",
  keywords: ["inteligencia artificial", "noticias IA", "machine learning", "LLM", "AI en español", "tecnología"],
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: BASE_URL,
    siteName: "AI Hoy",
    title: "AI Hoy — Noticias de IA en Español",
    description: "Las mejores noticias de inteligencia artificial, curadas y resumidas en español.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Hoy — Noticias de IA en Español",
    description: "Las mejores noticias de inteligencia artificial, curadas y resumidas en español.",
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${spaceGrotesk.variable} ${dmSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
