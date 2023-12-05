/* eslint-disable @next/next/no-page-custom-font */
import "./styles/globals.scss";
import "./styles/markdown.scss";
import "./styles/highlight.scss";
import { getClientConfig } from "./config/client";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Guo Guo | Next Web",
  description:
    "ChatGPT Next Web second version of online chat, intelligent drawing and image recognition, based on React, newly added latest models gpt-3.5-turbo-1106, gpt-4-1106-preview, dall-e-3, tts, gpt-4-vision -preview etc.",
  keywords:
    "ChatGPT Next Web, React, ChatGPT, 120$, credits, RPM, TPM, gpt-3.5, gpt-4.0, dall-e-2, dall-e-3, dalle3, 1106-preview, vision-preview ,online chat, drawing, image recognition, Vision, One API, Transfer, Proxy, онлайн-чат, интеллектуальное рисование и распознавание изображений",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#151515" },
  ],
  appleWebApp: {
    title: "AI Guo Guo | Next Web",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="config" content={JSON.stringify(getClientConfig())} />
        <link rel="manifest" href="/site.webmanifest"></link>
        <script src="/serviceWorkerRegister.js" defer></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
          var _hmt = _hmt || [];
          (function() {
            var hm = document.createElement("script");
            hm.src = "https://hm.baidu.com/hm.js?b072ae92f999091645cd6407ba53d398";
            var s = document.getElementsByTagName("script")[0]; 
            s.parentNode.insertBefore(hm, s);
          })();
        `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
