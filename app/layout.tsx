"use client";
import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlayersProvider } from "./context";

const NAV = [
  { href: "/", label: "대시보드", icon: "🏠" },
  { href: "/players", label: "선수 관리", icon: "👤" },
  { href: "/teams", label: "팀 관리", icon: "🛡️" },
  { href: "/auction", label: "경매 시스템", icon: "🔨" },
  { href: "/stats", label: "통계", icon: "📊" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <title>내전 매니저</title>
        <meta name="description" content="리그 오브 레전드 내전 관리 플랫폼" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <PlayersProvider>
          <div style={{ display: "flex", minHeight: "100vh" }}>
            <Sidebar />
            <main style={{ flex: 1, marginLeft: 220, padding: "24px", maxWidth: "calc(100vw - 220px)" }}>
              {children}
            </main>
          </div>
        </PlayersProvider>
      </body>
    </html>
  );
}

function Sidebar() {
  const path = usePathname();
  return (
    <aside style={{
      width: 220, position: "fixed", top: 0, left: 0, bottom: 0,
      background: "var(--surface)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column", padding: "20px 12px",
    }}>
      <div style={{ padding: "8px 12px 24px", borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--purple-light)", letterSpacing: -0.5 }}>
          ⚔️ 내전 매니저
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>LoL 내전 관리 플랫폼</div>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {NAV.map(({ href, label, icon }) => {
          const active = path === href;
          return (
            <Link key={href} href={href} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 500,
              background: active ? "rgba(124,58,237,0.15)" : "transparent",
              color: active ? "var(--purple-light)" : "var(--text2)",
              border: active ? "1px solid rgba(124,58,237,0.3)" : "1px solid transparent",
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, fontSize: 11, color: "var(--text2)", textAlign: "center" }}>
        v1.0.0 · 실시간 동기화 🟢
      </div>
    </aside>
  );
}
