"use client";
import { useState } from "react";
import { useStore } from "../context";
import { LANES } from "@/lib/data";

export default function TeamsPage() {
  const { players, teams, removePlayerFromTeam, loading } = useStore();
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const teamId = selectedTeam ?? teams[0]?.id;
  const team = teams.find(t => t.id === teamId);
  const teamPlayers = players.filter(p => p.teamId === teamId);
  const avgWr = teamPlayers.length ? Math.round(teamPlayers.reduce((s, p) => s + p.wr, 0) / teamPlayers.length) : 0;
  const coveredLanes = new Set(teamPlayers.map(p => p.line));

  if (loading) return <div style={{ color: "var(--text2)", padding: 40, textAlign: "center" }}>불러오는 중...</div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>팀 관리</h1>
        <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>팀별 선수 구성 및 밸런스 확인 · <span style={{ color: "#22C55E" }}>● 실시간 연동</span></p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10, marginBottom: 20 }}>
        {teams.map(t => {
          const tp = players.filter(p => p.teamId === t.id);
          const active = teamId === t.id;
          return (
            <div key={t.id} className="card" onClick={() => setSelectedTeam(t.id)} style={{ padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s", borderColor: active ? t.color : "var(--border)", background: active ? `${t.color}12` : "var(--surface)" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.color, marginBottom: 6 }}>{t.name}</div>
              <div style={{ fontSize: 13, color: "var(--text2)" }}>선수 {tp.length}명</div>
              <div style={{ fontSize: 13, color: "var(--text)" }}>{t.points}P 잔여</div>
            </div>
          );
        })}
      </div>

      {team && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 16 }}>
          <div>
            <div className="card" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[["팀 선수", teamPlayers.length+"명"],["평균 승률", avgWr+"%"],["잔여 포인트", team.points+"P"],["총 투자", (1000-team.points)+"P"]].map(([label,value]) => (
                  <div key={label} style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 16px", minWidth: 100 }}>
                    <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: team.color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 16, marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 12 }}>라인 커버리지</h3>
              <div style={{ display: "flex", gap: 8 }}>
                {LANES.map(l => {
                  const covered = coveredLanes.has(l);
                  return (
                    <div key={l} style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 8, background: covered ? `${team.color}22` : "var(--surface2)", border: `1px solid ${covered ? team.color : "transparent"}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: covered ? team.color : "var(--text2)" }}>{l}</div>
                      <div style={{ fontSize: 16, marginTop: 2 }}>{covered ? "✓" : "—"}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 12 }}>팀원 목록</h3>
              {teamPlayers.length === 0
                ? <div style={{ fontSize: 14, color: "var(--text2)", textAlign: "center", padding: "20px 0" }}>배정된 선수가 없습니다</div>
                : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {teamPlayers.map(p => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--surface2)", borderRadius: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text2)" }}>{p.line} · {p.tier} · {p.wr}%</div>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--purple-light)", fontWeight: 600, marginRight: 8 }}>{p.auctionPrice ?? 0}P</div>
                        <button className="btn btn-danger" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => { if (confirm(`${p.name}을 제거할까요?`)) removePlayerFromTeam(p.id); }}>제거</button>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>

          <div className="card" style={{ padding: 16, alignSelf: "start" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 12 }}>전체 팀 비교</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {teams.map(t => {
                const tp = players.filter(p => p.teamId === t.id);
                const wr = tp.length ? Math.round(tp.reduce((s, p) => s + p.wr, 0) / tp.length) : 0;
                const aces = tp.filter(p => p.grade === "ACE").length;
                return (
                  <div key={t.id} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--surface2)", border: `1px solid ${teamId === t.id ? t.color : "transparent"}`, cursor: "pointer" }} onClick={() => setSelectedTeam(t.id)}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: t.color }}>{t.name}</span>
                      <span style={{ fontSize: 12, color: "var(--text2)" }}>{tp.length}명</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text2)", marginBottom: 6 }}>
                      <span>평균 {wr}%</span><span>ACE {aces}</span><span style={{ color: t.points < 100 ? "#EF4444" : "var(--text2)" }}>{t.points}P</span>
                    </div>
                    <div style={{ height: 3, background: "var(--border)", borderRadius: 99 }}>
                      <div style={{ width: `${wr}%`, height: "100%", background: t.color, borderRadius: 99 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
