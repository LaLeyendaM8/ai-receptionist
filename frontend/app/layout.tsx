import type { Metadata } from "next";
import { Inter, Roboto } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
});


export const metadata: Metadata = {
  title: {
    default: "ReceptaAI – dein AI-Sekretär",
    template: "%s | ReceptaAI",
  },
  description:
    "ReceptaAI ist dein telefonischer KI-Rezeptionist – nimmt Anrufe entgegen, beantwortet Fragen und bucht automatisch Termine.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${inter.variable} ${roboto.variable}`}>
      <body className="min-h-screen bg-brand-background text-brand-text antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}

