/* eslint-disable @next/next/no-page-custom-font */
import "./styles/globals.scss";
import "./styles/markdown.scss";
import "./styles/highlight.scss";
import { getClientConfig } from "./config/client";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "AI果果科技站",
  description:
    "OpenAI 接口聚合管理，支持多种渠道包括 Azure, PaLM2, Claude, 阿里通义, 文心一言, 讯飞星火, 智谱 ChatGLM, 360 智脑, OpenAI-SB, API2D, OhMyGPT, AI Proxy, CloseAI等众多平台",
  keywords:
    "AI果果, 果果API, ChatGPT, OpenAi接口, 中转, GPT中转分发, API Key中转分发, GPT3.5中转分发, GPT4.0中转分发, 分发平台, 中转平台",
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
    title: "AI果果科技站",
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
            hm.src = "https://hm.baidu.com/hm.js?9d5bce12a50ed51d57f49fad1db66fb5";
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
