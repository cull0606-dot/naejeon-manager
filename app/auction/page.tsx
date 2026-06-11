"use client";
import { useState, useEffect, useRef } from "react";
import { useStore } from "../context";
import { supabase } from "@/lib/supabase";

const AVATAR_COLORS = ["#7C3AED","#0369A1","#DC2626","#D97706","#059669","#DB2777"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

interface AuctionState {
  active: boolean;
  current_player_id: number | null;
  current_price: number;
  time_left: number;
  bid_team_id: number | null;
  bid_team_name: string | null;
  round: number;
}

interface BidLog { teamName: string; price: number; time: string; }

export default function AuctionPage() {
  const { players, teams, assignPlayerToTeam, resetAuction, updateTeam, loading } = useStore();
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [log, setLog] = useState<BidLog[]>([]);
  const [bidTeamId, setBidTeamId] = useState<number | null>(null);
  const [bidPrice, setBidPrice] = useState(50);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [startPoints, setStartPoints] = useState<Record<number, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunning = auctionState?.active ?? false;

  const available = players.filter(p => p.active && !p.teamId);
  const current = players.find(p => p.id === auctionState?.current_player_id);

  // 초기 포인트 설정값 세팅
  useEffect(() => {
    if (teams.length > 0) {
      const init: Record<number, number> = {};
      teams.forEach(t => { init[t.id] = t.points; });
      setStartPoints(init);
      if (!bidTeamId) setBidTeamId(teams[0].id);
    }
  }, [teams]);

  // Supabase에서 경매 상태 가져오기
  async function fetchAuctionState() {
    const { data } = await supabase.from("auction_state").select("*").eq("id", 1).single();
    if (data) setAuctionState(data);
  }

  // 실시간 구독
  useEffect(() => {
    fetchAuctionState();
    const channel = supabase.channel("auction-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auction_state" }, payload => {
        const d = payload.new as AuctionState;
        setAuctionState(d);
        if (d.bid_team_name && d.current_price > 0) {
          setLog(prev => {
            const entry = { teamName: d.bid_team_name!, price: d.current_price, time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) };
            if (prev[0]?.price === entry.price && prev[0]?.teamName === entry.teamName) return prev;
            return [entry, ...prev.slice(0, 19)];
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // 타이머 — 방장(경매 시작한 사람)만 카운트다운 업데이트
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isRunning) return;
    timerRef.current = setInterval(async () => {
      const { data } = await supabase.from("auction_state").select("time_left,active").eq("id", 1).single();
      if (!data || !data.active) { clearInterval(timerRef.current!); return; }
      if (data.time_left <= 1) {
        clearInterval(timerRef.current!);
        await handleTimeUp();
      } else {
        await supabase.from("auction_state").update({ time_left: data.time_left - 1 }).eq("id", 1);
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  async function handleTimeUp() {
    const { data } = await supabase.from("auction_state").select("*").eq("id", 1).single();
    if (!data) return;
    if (data.bid_team_id && data.current_player_id) {
      await assignPlayerToTeam(data.current_player_id, data.bid_team_id, data.current_price);
      const next = available.filter(p => p.id !== data.current_player_id)[0];
      await supabase.from("auction_state").update({
        active: false, current_player_id: next?.id ?? null,
        current_price: 0, time_left: 30,
        bid_team_id: null, bid_team_name: null,
      }).eq("id", 1);
    } else {
      const next = available.filter(p => p.id !== data.current_player_id)[0];
      await supabase.from("auction_state").update({
        active: false, current_player_id: next?.id ?? null,
        current_price: 0, time_left: 30,
        bid_team_id: null, bid_team_name: null,
      }).eq("id", 1);
    }
  }

  async function startAuction() {
    const firstPlayer = available[0];
    if (!firstPlayer) return;
    await supabase.from("auction_state").update({
      active: true, current_player_id: firstPlayer.id,
      current_price: 0, time_left: 30,
      bid_team_id: null, bid_team_name: null,
    }).eq("id", 1);
  }

  async function pauseAuction() {
    await supabase.from("auction_state").update({ active: false }).eq("id", 1);
  }

  async function placeBid() {
    const team = teams.find(t => t.id === bidTeamId);
    if (!team || !auctionState?.current_player_id) return;
    if (bidPrice <= (auctionState.current_price ?? 0)) { alert("현재 입찰가보다 높아야 합니다!"); return; }
    if (bidPrice > team.points) { alert("포인트가 부족합니다!"); return; }
    await supabase.from("auction_state").update({
      current_price: bidPrice, bid_team_id: team.id,
      bid_team_name: team.name, time_left: 30,
    }).eq("id", 1);
  }

  async function confirmBid() {
    if (!auctionState?.bid_team_id || !auctionState?.current_player_id) return;
    await assignPlayerToTeam(auctionState.current_player_id, auctionState.bid_team_id, auctionState.current_price);
    const next = available.filter(p => p.id !== auctionState.current_player_id)[0];
    await supabase.from("auction_state").update({
      active: false, current_player_id: next?.id ?? null,
      current_price: 0, time_left: 30,
      bid_team_id: null, bid_team_name: null,
    }).eq("id", 1);
  }

  async function skipPlayer() {
    const next = available.filter(p => p.id !== auctionState?.current_player_id)[0];
    await supabase.from("auction_state").update({
      active: false, current_player_id: next?.id ?? null,
      current_price: 0, time_left: 30,
      bid_team_id: null, bid_team_name: null,
    }).eq("id", 1);
  }

  async function handleReset() {
    if (!confirm("경매를 초기화할까요?")) return;
    if (timerRef.current) clearInterval(timerRef.current);
    await resetAuction();
    await supabase.from("auction_state").update({
      active: false, current_player_id: null,
      current_price: 0, time_left: 30,
      bid_team_id: null, bid_team_name: null, round: 1,
    }).eq("id", 1);
    setLog([]);
  }

  async function saveStartPoints() {
    for (const team of teams) {
      await updateTeam(team.id, { points: startPoints[team.id] ?? 1000 });
    }
    setSettingsOpen(false);
  }

  const timeLeft = auctionState?.time_left ?? 30;
  const timerColor = timeLeft <= 5 ? "#EF4444" : timeLeft <= 10 ? "#F59E0B" : "var(--purple-light)";

  if (loading || !auctionState) return <div style={{ color: "var(--text2)", padding: 40, textAlign: "center" }}>불러오는 중...</div>;

  return (
    <div>
      {/* 설정 모달 */}
      {settingsOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div className="card" style={{ padding: 24, width: 340 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>경매 설정</h3>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>팀별 시작 포인트를 설정하세요</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {teams.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: t.color }}>{t.name}</span>
                  <input type="number" min={100} max={9999} step={100}
                    value={startPoints[t.id] ?? 1000}
                    onChange={e => setStartPoints(prev => ({ ...prev, [t.id]: Number(e.target.value) }))}
                    style={{ width: 100 }} />
                  <span style={{ fontSize: 13, color: "var(--text2)" }}>P</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn" onClick={() => setSettingsOpen(false)}>취소</button>
              <button className="btn btn-primary" onClick={saveStartPoints}>저장</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>경매 시스템</h1>
          <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>
            남은 선수 {available.length}명 · 배정 완료 {players.filter(p => p.teamId).length}명 · <span style={{ color: "#22C55E" }}>● 실시간 연동</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => setSettingsOpen(true)}>⚙️ 시작 포인트 설정</button>
          <button className="btn btn-danger" onClick={handleReset}>경매 초기화</button>
        </div>
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
                {/* 타이머 */}
                <div style={{ textAlign: "center", minWidth: 70 }}>
                  <div style={{ fontSize: 52, fontWeight: 900, color: timerColor, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                    {String(timeLeft).padStart(2, "0")}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>초</div>
                </div>
              </div>

              {/* 현재 최고 입찰 */}
              {auctionState.bid_team_name ? (
                <div style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--purple-light)" }}>현재 최고 입찰</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#a78bfa" }}>{auctionState.bid_team_name} — {auctionState.current_price}P</span>
                </div>
              ) : (
                <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, textAlign: "center", fontSize: 13, color: "var(--text2)" }}>
                  아직 입찰 없음
                </div>
              )}

              {/* 입찰 컨트롤 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 4 }}>입찰 팀</label>
                  <select value={bidTeamId ?? ""} onChange={e => setBidTeamId(Number(e.target.value))}>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.points}P)</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 4 }}>입찰가 (P)</label>
                  <input type="number" min={10} max={9999} step={10} value={bidPrice} onChange={e => setBidPrice(Number(e.target.value))} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {[50, 100, 200, 300, 500].map(v => (
                  <button key={v} className="btn" onClick={() => setBidPrice(v)} style={{ fontSize: 12, padding: "4px 10px" }}>{v}P</button>
                ))}
                <button className="btn" onClick={() => { const t = teams.find(x => x.id === bidTeamId); if (t) setBidPrice(t.points); }} style={{ fontSize: 12, padding: "4px 10px", background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)", color: "#EF4444" }}>
                  🔥 ALL IN
                </button>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {!isRunning
                  ? <button className="btn btn-primary" style={{ flex: 1 }} onClick={startAuction}>▶ 경매 시작</button>
                  : <button className="btn" style={{ flex: 1 }} onClick={pauseAuction}>⏸ 일시정지</button>
                }
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={placeBid} disabled={!isRunning}>🏷️ 입찰하기</button>
                <button className="btn" onClick={confirmBid} disabled={!auctionState.bid_team_id}>✅ 낙찰</button>
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

          {/* 남은 선수 */}
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text2)" }}>남은 선수 ({available.length}명)</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {available.map(p => (
                <div key={p.id} style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 13,
                  background: p.id === auctionState.current_player_id ? "rgba(124,58,237,0.15)" : "var(--surface2)",
                  border: `1px solid ${p.id === auctionState.current_player_id ? "rgba(124,58,237,0.4)" : "transparent"}`,
                  color: p.id === auctionState.current_player_id ? "var(--purple-light)" : "var(--text)",
                }}>
                  {p.name} <span style={{ color: "var(--text2)", fontSize: 11 }}>{p.line}</span>
                </div>
              ))}
              {available.length === 0 && <span style={{ fontSize: 13, color: "var(--text2)" }}>없음</span>}
            </div>
          </div>
        </div>

        {/* 오른쪽 패널 */}
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
                  <span style={{ color: teams.find(t => t.name === entry.teamName)?.color ?? "var(--text)" }}>{entry.teamName}</span>
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
