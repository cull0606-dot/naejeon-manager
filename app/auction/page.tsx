"use client";
import { useState, useEffect, useRef } from "react";
import { useStore } from "../context";
import { Player } from "@/lib/data";

const AVATAR_COLORS = ["#7C3AED","#0369A1","#DC2626","#D97706","#059669","#DB2777"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

interface BidLog { teamId: number; teamName: string; price: number; time: string; }

export default function AuctionPage() {
  const { players, teams, assignPlayerToTeam, resetAuction, loading } = useStore();
  const available = players.filter(p => p.active && !p.teamId);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [price, setPrice] = useState(50);
  const [bidTeamId, setBidTeamId] = useState<number>(teams[0]?.id ?? 1);
  const [timeLeft, setTimeLeft] = useState(30);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<BidLog[]>([]);
  const [lastBid, setLastBid] = useState<BidLog | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const current: Player | undefined = available[currentIdx];

  useEffect(() => {
    if (teams.length > 0 && !bidTeamId) setBidTeamId(teams[0].id);
  }, [teams]);

  useEffect(() => {
    if (running && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0 && running) {
      handleConfirmBid();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, timeLeft]);

  function startAuction() { setTimeLeft(30); setRunning(true); setLastBid(null); }
  function pauseAuction() { setRunning(false); if (timerRef.current) clearInterval(timerRef.current); }

  function placeBid() {
    const team = teams.find(t => t.id === bidTeamId);
    if (!team || !current) return;
    if (price > team.points) { alert("포인트가 부족합니다!"); return; }
    const entry: BidLog = { teamId: team.id, teamName: team.name, price, time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) };
    setLastBid(entry);
    setLog(prev => [entry, ...prev.slice(0, 19)]);
    setTimeLeft(30);
  }

  async function handleConfirmBid() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
    if (!lastBid || !current) { skipPlayer(); return; }
    await assignPlayerToTeam(current.id, lastBid.teamId, lastBid.price);
    setLastBid(null);
    setTimeLeft(30);
    setPrice(50);
  }

  function skipPlayer() {
    setRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrentIdx(prev => prev + 1);
    setLastBid(null);
    setTimeLeft(30);
    setPrice(50);
  }

  async function handleReset() {
    if (!confirm("경매를 초기화할까요? 모든 배정이 취소됩니다.")) return;
    pauseAuction();
    await resetAuction();
    setCurrentIdx(0);
    setLog([]);
    setLastBid(null);
    setTimeLeft(30);
    setPrice(50);
  }

  const timerColor = timeLeft <= 5 ? "#EF4444" : timeLeft <= 10 ? "#F59E0B" : "var(--purple-light)";

  if (loading) return <div style={{ color: "var(--text2)", padding: 40, textAlign: "center" }}>불러오는 중...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>경매 시스템</h1>
          <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>남은 선수 {available.length}명 · 배정 완료 {players.filter(p => p.teamId).length}명 · <span style={{ color: "#22C55E" }}>● 실시간 연동</span></p>
        </div>
        <button className="btn btn-danger" onClick={handleReset}>경매 초기화</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {current ? (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 20 }}>
                <div style={{ width: 80, height: 80, borderRadius: 12, background: `${avatarColor(current.id)}22`, color: avatarColor(current.id), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 28, flexShrink: 0 }}>
                  {current.name.slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{current.name}</div>
                  <div style={{ fontSize: 14, color: "var(--text2)", marginBottom: 8 }}>{current.riot} · {current.line}/{current.sub}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span className={`badge badge-${current.grade.toLowerCase()}`}>{current.grade}</span>
                    <span style={{ fontSize: 13, color: "var(--text2)" }}>티어 <b style={{ color: "var(--text)" }}>{current.tier}</b></span>
                    <span style={{ fontSize: 13, color: current.wr >= 60 ? "#22C55E" : "var(--text)" }}>{current.wr}%</span>
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 52, fontWeight: 900, color: timerColor, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{String(timeLeft).padStart(2,"0")}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>초</div>
                </div>
              </div>

              {lastBid && (
                <div style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--purple-light)" }}>현재 최고 입찰</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#a78bfa" }}>{lastBid.teamName} — {lastBid.price}P</span>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 4 }}>입찰 팀</label>
                  <select value={bidTeamId} onChange={e => setBidTeamId(Number(e.target.value))}>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.points}P)</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 4 }}>입찰가 (P)</label>
                  <input type="number" min={10} max={1000} step={10} value={price} onChange={e => setPrice(Number(e.target.value))} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {[50,100,200,300,500].map(v => (
                  <button key={v} className="btn" onClick={() => setPrice(v)} style={{ fontSize: 12, padding: "4px 10px" }}>{v}P</button>
                ))}
                <button className="btn" onClick={() => { const t = teams.find(x => x.id === bidTeamId); if (t) setPrice(t.points); }} style={{ fontSize: 12, padding: "4px 10px", background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)", color: "#EF4444" }}>
                  🔥 ALL IN
                </button>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {!running
                  ? <button className="btn btn-primary" style={{ flex: 1 }} onClick={startAuction}>▶ 경매 시작</button>
                  : <button className="btn" style={{ flex: 1 }} onClick={pauseAuction}>⏸ 일시정지</button>}
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={placeBid} disabled={!running}>🏷️ 입찰하기</button>
                <button className="btn" onClick={handleConfirmBid} disabled={!lastBid}>✅ 낙찰</button>
                <button className="btn btn-danger" onClick={skipPlayer}>⏭ 건너뛰기</button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>모든 경매 완료!</div>
              <div style={{ fontSize: 14, color: "var(--text2)", marginBottom: 16 }}>모든 선수가 배정되었습니다</div>
              <button className="btn btn-primary" onClick={handleReset}>새 경매 시작</button>
            </div>
          )}

          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text2)" }}>남은 선수 ({available.length}명)</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {available.map((p, i) => (
                <div key={p.id} onClick={() => setCurrentIdx(i)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer", background: i === currentIdx ? "rgba(124,58,237,0.15)" : "var(--surface2)", border: `1px solid ${i === currentIdx ? "rgba(124,58,237,0.4)" : "transparent"}`, color: i === currentIdx ? "var(--purple-light)" : "var(--text)" }}>
                  {p.name} <span style={{ color: "var(--text2)", fontSize: 11 }}>{p.line}</span>
                </div>
              ))}
              {available.length === 0 && <span style={{ fontSize: 13, color: "var(--text2)" }}>없음</span>}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text2)" }}>팀별 포인트</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {teams.map(t => {
                const tp = players.filter(p => p.teamId === t.id);
                return (
                  <div key={t.id} className="card" style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: t.color }}>{t.name}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: t.points < 100 ? "#EF4444" : "var(--text)" }}>{t.points}P</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {tp.map(p => <span key={p.id} style={{ fontSize: 11, padding: "1px 6px", background: `${t.color}22`, color: t.color, borderRadius: 4 }}>{p.name}</span>)}
                      {tp.length === 0 && <span style={{ fontSize: 11, color: "var(--text2)" }}>선수 없음</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text2)" }}>입찰 로그</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
              {log.length === 0 && <div style={{ fontSize: 13, color: "var(--text2)" }}>아직 입찰 없음</div>}
              {log.map((entry, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: teams.find(t => t.id === entry.teamId)?.color ?? "var(--text)" }}>{entry.teamName}</span>
                  <span style={{ color: "var(--purple-light)", fontWeight: 600 }}>{entry.price}P</span>
                  <span style={{ color: "var(--text2)" }}>{entry.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
