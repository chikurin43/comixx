import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/app/providers";
import { ConditionalFooter } from "@/components/ConditionalFooter";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "ComixX",
  description: "みんなで漫画を共創するチャット＆投票サービス",
};

const captureEnabled = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_FIGMA_CAPTURE === "true";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {captureEnabled ? <Script src="https://mcp.figma.com/mcp/html-to-design/capture.js" strategy="afterInteractive" /> : null}
        <Providers>
          <NavBar />
          {children}
          <ConditionalFooter />
        </Providers>
      </body>
    </html>
  );
}
