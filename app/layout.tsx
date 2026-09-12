import type { Metadata } from "next";
import { getPhoneAuthReadiness } from "@/lib/auth/phone/config";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChronoKalamos · 742 CE Chang’an",
  description: "有史料边界的 AI 历史人生模拟。公元 742 年长安，三种出身。SMALL PUBLIC BETA。16+。史料记载 / 合理重建 / 叙事虚构。",
  applicationName: "ChronoKalamos",
  keywords: ["ChronoKalamos", "长安", "742", "天宝", "历史模拟", "史料边界"],
  authors: [{ name: "ChronoKalamos" }],
  robots: { index: true, follow: true },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "ChronoKalamos · 742 CE Chang’an",
    description: "有史料边界的 AI 历史人生模拟。公元 742 年长安，三种出身。SMALL PUBLIC BETA。16+。史料记载 / 合理重建 / 叙事虚构。",
    locale: "zh_CN",
    type: "website",
    siteName: "ChronoKalamos",
  },
  twitter: {
    card: "summary",
    title: "ChronoKalamos · 742 CE Chang’an",
    description: "有史料边界的 AI 历史人生模拟。公元 742 年长安，三种出身。SMALL PUBLIC BETA。16+。史料记载 / 合理重建 / 叙事虚构。",
  },
};

export const viewport = {
  themeColor: "#DDC69B",
  width: "device-width",
  initialScale: 1,
};

function publicSupabaseConfigScript(): string {
  const phoneReadiness = getPhoneAuthReadiness();
  const config = JSON.stringify({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ?? process.env.SUPABASE_PUBLISHABLE_KEY
      ?? "",
    turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      ?? process.env.TURNSTILE_SITE_KEY
      ?? "",
    phoneAuthEnabled: phoneReadiness.enabled,
    phoneAuthProvider: phoneReadiness.providerMode,
  });
  return config.replace(/</g, "\\u003c");
}

function preferenceBootScript(): string {
  return [
    "(function(){try{",
    "var d=document.documentElement;",
    "var g=function(k){return window.localStorage.getItem(k)};",
    "d.lang='zh-CN';",
    "var loc=g('chronokalamos-locale');",
    "if(loc==='en'||loc==='fr'||loc==='el'||loc==='ru'){d.setAttribute('data-locale',loc);}",
    "var motion=g('chronokalamos-low-motion');",
    "if(motion==='true'||(motion===null&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)){d.setAttribute('data-motion','reduced');}",
    "var scale=g('chronokalamos-text-scale');",
    "if(scale==='large'){d.setAttribute('data-text-scale','large');}",
    "var dens=g('chronokalamos-density');",
    "if(dens==='compact'||dens==='comfortable'){d.setAttribute('data-density',dens);}",
    "if(g('chronokalamos-high-contrast')==='true'){d.setAttribute('data-contrast','high');}",
    "}catch(e){}})();",
  ].join("");
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        {/*
          THESIS: The working archive desk is the product; refuse a museum gift-shop landing.
          OWN-WORLD: Sandpaper field, cinnabar seals, indigo ink, brass focus, paper offsets.
          STORY: Visitor sees 742 Chang'an, three bounded origins, and an honest identity gate.
          FIRST VIEWPORT: Boot as ink well, then map as work surface with origin dossiers below.
          FORM: Established Sand & Cinnabar; craft raise, not a replacement world.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
        */}
        <script
          id="chronokalamos-preference-boot"
          dangerouslySetInnerHTML={{ __html: preferenceBootScript() }}
        />
        <script
          id="chronokalamos-public-config"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: publicSupabaseConfigScript() }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
