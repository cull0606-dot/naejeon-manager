"use client";
import { useStore } from "../context";
import { LANES, TIER_ORDER } from "@/lib/data";

export default function StatsPage() {
  const { players, teams, loading } = useStore();
  if (loading) return <div style={{ color: "var(--text2)", padding: 40, textAlign: "center" }}>불러오는 중...</div>;

  const gradeCount = { ACE: 0, VALUE: 0, NORMAL: 0 };
  players.forEach(p => { gradeCount[p.grade]++; });

  const laneStats = LANES.map(l => {
    const lp = players.filter(p => p.line === l);
    const avgWr = lp.length ? Math.round(lp.reduce((s, p) => s + p.wr, 0) / lp.length) : 0;
    return { lane: l, count: lp.length, avgWr };
  });

  const topWr = [...players].sort((a, b) => b.wr - a.wr).slice(0, 5);
  const topTier = [...players].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)).slice(0, 5);
  const teamStrength = teams.map(t => {
    const tp = players.filter(p => p.teamId === t.id);
    const avgWr = tp.length ? Math.round(tp.reduce((s, p) => s + p.wr, 0) / tp.length) : 0;
    const aces = tp.filter(p => p.grade === "ACE").length;
    return { ...t, tp, avgWr, aces, score: avgWr + aces * 5 };
  }).sort((a, b) => b.score - a.score);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>통계</h1>
        <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>선수 및 팀 분석 데이터 · <span style={{ color: "#22C55E" }}>● 실시간 연동</span></p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { label: "전체 선수", value: players.length, color: "#a78bfa" },
          { label: "ACE", value: gradeCount.ACE, color: "#F59E0B" },
          { label: "VALUE", value: gradeCount.VALUE, color: "#38bdf8" },
          { label: "NORMAL", value: gradeCount.NORMAL, color: "var(--text2)" },
          { label: "배정 완료", value: players.filter(p => p.teamId).length, color: "#22C55E" },
          { label: "미배정", value: players.filter(p => !p.teamId && p.active).length, color: "#EF4444" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "var(--text2)" }}>라인별 분포</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {laneStats.map(s => (
              <div key={s.lane}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{s.lane}</span>
                  <span style={{ color: "var(--text2)" }}>{s.count}명 · 평균 {s.avgWr}%</span>
                </div>
                <div style={{ height: 6, background: "var(--surface2)", borderRadius: 99 }}>
                  <div style={{ width: `${Math.min(s.avgWr,100)}%`, height: "100%", background: s.avgWr >= 60 ? "#22C55E" : s.avgWr >= 50 ? "#7C3AED" : "#EF4444", borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "var(--text2)" }}>등급 분포</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 120 }}>
            {[{ label: "ACE", count: gradeCount.ACE, color: "#F59E0B" },{ label: "VALUE", count: gradeCount.VALUE, color: "#38bdf8" },{ label: "NORMAL", count: gradeCount.NORMAL, color: "#6060a0" }].map(g => {
              const max = Math.max(gradeCount.ACE, gradeCount.VALUE, gradeCount.NORMAL, 1);
              return (
                <div key={g.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: g.color }}>{g.count}</div>
                  <div style={{ width: "100%", height: Math.round((g.count/max)*80)+"%", minHeight: 4, background: g.color, borderRadius: "4px 4px 0 0", opacity: 0.8 }} />
                  <div style={{ fontSize: 11, color: "var(--text2)" }}>{g.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text2)" }}>승률 TOP 5</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topWr.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: i===0?"#F59E0B22":"var(--surface2)", color: i===0?"#F59E0B":"var(--text2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{i+1}</div>
                <div style={{ flex: 1, fontSize: 13 }}>{p.name}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: p.wr >= 60 ? "#22C55E" : "var(--text)" }}>{p.wr}%</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text2)" }}>고티어 TOP 5</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topTier.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: i===0?"#F59E0B22":"var(--surface2)", color: i===0?"#F59E0B":"var(--text2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{i+1}</div>
                <div style={{ flex: 1, fontSize: 13 }}>{p.name}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa" }}>{p.tier}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text2)" }}>팀 강도 순위</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {teamStrength.map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: i===0?`${t.color}33`:"var(--surface2)", color: i===0?t.color:"var(--text2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{i+1}</div>
                <div style={{ flex: 1, fontSize: 13, color: t.color }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>{t.avgWr}% · ACE {t.aces}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
