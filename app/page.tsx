"use client";
import Link from "next/link";
import { useStore } from "./context";

export default function Home() {
  const { players, teams, loading } = useStore();

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 32 }}>⚔️</div>
      <div style={{ fontSize: 16, color: "var(--text2)" }}>불러오는 중...</div>
    </div>
  );

  const active = players.filter(p => p.active);
  const assigned = players.filter(p => p.teamId !== undefined);
  const avgWr = players.length ? Math.round(players.reduce((s, p) => s + p.wr, 0) / players.length) : 0;
  const aces = players.filter(p => p.grade === "ACE");

  const statCards = [
    { label: "전체 선수", value: players.length, sub: `활성 ${active.length}명`, color: "#a78bfa" },
    { label: "평균 승률", value: avgWr + "%", sub: "전체 선수 기준", color: "#22C55E" },
    { label: "ACE 등급", value: aces.length, sub: "최상위 선수", color: "#F59E0B" },
    { label: "경매 완료", value: assigned.length, sub: `미배정 ${players.length - assigned.length}명`, color: "#38bdf8" },
  ];

  const quickLinks = [
    { href: "/players", label: "선수 관리", desc: "선수 등록, 티어, 승률 관리", icon: "👤", color: "#7C3AED" },
    { href: "/auction", label: "경매 시스템", desc: "실시간 포인트 경매 진행", icon: "🔨", color: "#DC2626" },
    { href: "/teams", label: "팀 관리", desc: "팀 구성 및 밸런스 확인", icon: "🛡️", color: "#0369A1" },
    { href: "/stats", label: "통계", desc: "선수 및 팀 분석 데이터", icon: "📊", color: "#059669" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>대시보드</h1>
        <p style={{ color: "var(--text2)", marginTop: 4, fontSize: 14 }}>내전 현황을 한눈에 확인하세요 · <span style={{ color: "#22C55E" }}>● 실시간 연결됨</span></p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12, marginBottom: 28 }}>
        {statCards.map(s => (
          <div key={s.label} className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 28 }}>
        {quickLinks.map(q => (
          <Link key={q.href} href={q.href} style={{ textDecoration: "none" }}>
            <div className="card" style={{ padding: "20px", cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = q.color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{q.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{q.label}</div>
              <div style={{ fontSize: 13, color: "var(--text2)" }}>{q.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "var(--text2)" }}>팀별 현황</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {teams.map(t => {
              const tp = players.filter(p => p.teamId === t.id);
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.color }} />
                    <span style={{ fontSize: 14 }}>{t.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--text2)" }}>
                    <span>선수 {tp.length}명</span>
                    <span style={{ color: "#a78bfa" }}>{t.points}P 잔여</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "var(--text2)" }}>ACE 선수 목록</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {aces.length === 0 && <div style={{ fontSize: 13, color: "var(--text2)" }}>ACE 선수 없음</div>}
            {aces.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 14 }}>{p.name}</div>
                <div style={{ display: "flex", gap: 8, fontSize: 13 }}>
                  <span style={{ color: "var(--text2)" }}>{p.line} · {p.tier}</span>
                  <span className={p.wr >= 60 ? "wr-high" : "wr-mid"}>{p.wr}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
