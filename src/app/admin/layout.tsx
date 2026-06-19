import type { ReactNode } from "react";
import { Mulish, PT_Serif } from "next/font/google";
import "../globals.css";

const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin"],
  weight: ["700"],
});

interface Props {
  children: ReactNode;
}

export default async function LocaleLayout({ children }: Props) {
  return (
    <html
      lang="nl"
      className={`${mulish.variable} ${ptSerif.variable} h-full antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
