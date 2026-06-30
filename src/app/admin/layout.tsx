import { Suspense, type ReactNode } from "react";
import { Mulish, PT_Serif } from "next/font/google";
import "../globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
    <>
      <html
        lang="nl"
        className={`${mulish.variable} ${ptSerif.variable} h-full antialiased`}
      >
        <body>
          {/* Admin is fully dynamic (auth-gated via verifySession → headers()).
            A Suspense boundary at the root opts the whole admin tree out of the
            PPR static shell, so runtime data access streams at request time. */}
          <Suspense fallback={null}>{children}</Suspense>
        </body>
      </html>
      <SpeedInsights />
    </>
  );
}
