"use client";
import { useState, useEffect, useRef } from "react";
import { useStore } from "../context";
import { supabase } from "@/lib/supabase";
import { Player } from "@/lib/data";

const AVATAR_COLORS = ["#7C3AED","#0369A1","#DC2626","#D97706","#059669","#DB2777","#0891B2","#65A30D"];
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
interface BidLog { teamName: string; teamColor: string; price: number; time: string; }

export default function AuctionPage() {
  const { players, teams, assignPlayerToTeam, resetAuction, updateTeam, loading } = useStore();
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [log, setLog] = useState<BidLog[]>([]);
  const [bidTeamId, setBidTeamId] = useState<number | null>(null);
  const [bidPrice, setBidPrice] = useState(50);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [startPoints, setStartPoints] = useState<Record<number, number>>({});
  const [isHost, setIsHost] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const available = players.filter(p => p.active && !p.teamId);
  const current = players.find(p => p.id === auctionState?.current_player_id);
  const timeLeft = auctionState?.time_left ?? 30;
  const timerColor = timeLeft <= 5 ? "#EF4444" : timeLeft <= 10 ? "#F59E0B" : "#a78bfa";
  const timerPct = (timeLeft / 30) * 100;

  useEffect(() => {
    if (teams.length > 0 && !bidTeamId) {
      setBidTeamId(teams[0].id);
      const init: Record<number, number> = {};
      teams.forEach(t => { init[t.id] = t.points; });
      setStartPoints(init);
    }
  }, [teams]);

  async function fetchAuctionState() {
    const { data } = await supabase.from("auction_state").select("*").eq("id", 1).single();
    if (data) setAuctionState(data as AuctionState);
  }

  useEffect(() => {
    fetchAuctionState();
    const channel = supabase.channel("auction-rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auction_state" }, payload => {
        const d = payload.new as AuctionState;
        setAuctionState(d);
        if (d.bid_team_name && d.current_price > 0) {
          const teamColor = teams.find(t => t.name === d.bid_team_name)?.color ?? "#7C3AED";
          setLog(prev => {
            const entry: BidLog = { teamName: d.bid_team_name!, teamColor, price: d.current_price, time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) };
            if (prev[0]?.price === entry.price && prev[0]?.teamName === entry.teamName) return prev;
            return [entry, ...prev.slice(0, 29)];
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [teams]);

  // 호스트만 타이머 카운트다운 실행
  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (!isHost || !auctionState?.active) return;
    timerIntervalRef.current = setInterval(async () => {
      const { data } = await supabase.from("auction_state").select("time_left,active,bid_team_id,current_player_id,current_price").eq("id",1).single();
      if (!data || !data.active) { clearInterval(timerIntervalRef.current!); return; }
      if (data.time_left <= 1) {
        clearInterval(timerIntervalRef.current!);
        // 시간 종료 → 자동 낙찰
        if (data.bid_team_id && data.current_player_id) {
          await assignPlayerToTeam(data.current_player_id, data.bid_team_id, data.current_price);
        }
        const next = players.filter(p => p.active && !p.teamId && p.id !== data.current_player_id)[0];
        await supabase.from("auction_state").update({ active: false, current_player_id: next?.id ?? null, current_price: 0, time_left: 30, bid_team_id: null, bid_team_name: null }).eq("id",1);
      } else {
        await supabase.from("auction_state").update({ time_left: data.time_left - 1 }).eq("id",1);
      }
    }, 1000);
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [isHost, auctionState?.active]);

  async function selectPlayer(p: Player) {
    await supabase.from("auction_state").update({ active: false, current_player_id: p.id, current_price: 0, time_left: 30, bid_team_id: null, bid_team_name: null }).eq("id",1);
  }

  async function startAuction() {
    if (!auctionState?.current_player_id) {
      const first = available[0];
      if (!first) return;
      await supabase.from("auction_state").update({ active: true, current_player_id: first.id, current_price: 0, time_left: 30, bid_team_id: null, bid_team_name: null }).eq("id",1);
    } else {
      await supabase.from("auction_state").update({ active: true, time_left: 30 }).eq("id",1);
    }
    setIsHost(true);
  }

  async function pauseAuction() {
    await supabase.from("auction_state").update({ active: false }).eq("id",1);
    setIsHost(false);
  }

  async function placeBid() {
    const team = teams.find(t => t.id === bidTeamId);
    if (!team || !auctionState?.current_player_id) return;
    if (bidPrice <= (auctionState.current_price ?? 0)) { alert("현재 입찰가보다 높아야 합니다!"); return; }
    if (bidPrice > team.points) { alert(`${team.name} 포인트가 부족합니다! (보유: ${team.points}P)`); return; }
    await supabase.from("auction_state").update({ current_price: bidPrice, bid_team_id: team.id, bid_team_name: team.name, time_left: 30 }).eq("id",1);
  }

  async function confirmBid() {
    if (!auctionState?.bid_team_id || !auctionState?.current_player_id) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    await assignPlayerToTeam(auctionState.current_player_id, auctionState.bid_team_id, auctionState.current_price);
    const next = available.filter(p => p.id !== auctionState.current_player_id)[0];
    await supabase.from("auction_state").update({ active: false, current_player_id: next?.id ?? null, current_price: 0, time_left: 30, bid_team_id: null, bid_team_name: null }).eq("id",1);
  }

  async function skipPlayer() {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const next = available.filter(p => p.id !== auctionState?.current_player_id)[0];
    await supabase.from("auction_state").update({ active: false, current_player_id: next?.id ?? null, current_price: 0, time_left: 30, bid_team_id: null, bid_team_name: null }).eq("id",1);
  }

  async function monopolyBid() {
    const team = teams.find(t => t.id === bidTeamId);
    if (!team) return;
    if (team.points < 100) { alert("포인트가 너무 부족합니다!"); return; }
    await supabase.from("auction_state").update({ current_price: team.points, bid_team_id: team.id, bid_team_name: team.name, time_left: 30 }).eq("id",1);
  }

  async function allIn() {
    const team = teams.find(t => t.id === bidTeamId);
    if (!team) return;
    setBidPrice(team.points);
    await supabase.from("auction_state").update({ current_price: team.points, bid_team_id: team.id, bid_team_name: team.name, time_left: 30 }).eq("id",1);
  }

  async function handleReset() {
    if (!confirm("경매를 초기화할까요? 모든 배정이 취소됩니다.")) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsHost(false);
    await resetAuction();
    await supabase.from("auction_state").update({ active: false, current_player_id: null, current_price: 0, time_left: 30, bid_team_id: null, bid_team_name: null, round: 1 }).eq("id",1);
    setLog([]);
  }

  async function saveStartPoints() {
    for (const team of teams) {
      await updateTeam(team.id, { points: startPoints[team.id] ?? 1000 });
    }
    setSettingsOpen(false);
  }

  if (loading || !auctionState) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", color:"var(--text2)", fontSize:16 }}>
      불러오는 중...
    </div>
  );

  const bidTeam = teams.find(t => t.id === bidTeamId);

  return (
    <div style={{ minHeight:"100vh" }}>
      {/* 설정 모달 */}
      {settingsOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}>
          <div className="card" style={{ padding:24, width:360 }}>
            <h3 style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>⚙️ 경매 설정</h3>
            <p style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>팀별 시작 포인트를 설정하세요</p>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {teams.map(t => (
                <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:12, height:12, borderRadius:"50%", background:t.color, flexShrink:0 }} />
                  <span style={{ flex:1, fontSize:14, fontWeight:600, color:t.color }}>{t.name}</span>
                  <input type="number" min={100} max={9999} step={100} value={startPoints[t.id] ?? 1000}
                    onChange={e => setStartPoints(prev => ({ ...prev, [t.id]: Number(e.target.value) }))} style={{ width:100 }} />
                  <span style={{ fontSize:13, color:"var(--text2)" }}>P</span>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:20 }}>
              <button className="btn" onClick={() => setSettingsOpen(false)}>취소</button>
              <button className="btn btn-primary" onClick={saveStartPoints}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 상단 헤더 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700 }}>경매 시스템</h1>
          <p style={{ fontSize:13, color:"var(--text2)", marginTop:2 }}>
            남은 선수 {available.length}명 · 배정 완료 {players.filter(p=>p.teamId).length}명 ·{" "}
            <span style={{ color:"#22C55E" }}>● 실시간 연동</span>
            {isHost && <span style={{ color:"#F59E0B", marginLeft:8 }}>👑 호스트</span>}
          </p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn" onClick={() => setSettingsOpen(true)}>⚙️ 시작 포인트</button>
          <button className="btn btn-danger" onClick={handleReset}>초기화</button>
        </div>
      </div>

      {/* 메인 경매 영역 */}
      <div style={{ display:"grid", gridTemplateColumns:"280px 1fr 280px", gap:16, marginBottom:16 }}>

        {/* 왼쪽: 현재 경매 선수 카드 */}
        <div className="card" style={{ padding:0, overflow:"hidden", position:"relative" }}>
          {current ? (
            <>
              {/* 배경 그라데이션 */}
              <div style={{ background:`linear-gradient(135deg, ${avatarColor(current.id)}33, #0f0f17)`, padding:"24px 20px 16px", textAlign:"center" }}>
                <div style={{ width:80, height:80, borderRadius:16, background:`${avatarColor(current.id)}33`, border:`2px solid ${avatarColor(current.id)}66`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, fontWeight:700, color:avatarColor(current.id), margin:"0 auto 12px" }}>
                  {current.name.slice(0,2)}
                </div>
                <div style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>{current.name}</div>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}>
                  <span className={`badge badge-${current.grade.toLowerCase()}`} style={{ fontSize:12 }}>
                    {current.grade==="ACE"?"🏆":current.grade==="VALUE"?"💎":"⚡"} {current.grade}
                  </span>
                </div>
                <div style={{ fontSize:13, color:"var(--text2)" }}>주라인 <b style={{ color:"var(--text)" }}>{current.line}</b> / 부라인 <b style={{ color:"var(--text)" }}>{current.sub}</b></div>
              </div>
              <div style={{ padding:"12px 20px 20px" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                  <div style={{ background:"var(--surface2)", borderRadius:8, padding:"8px 12px", textAlign:"center" }}>
                    <div style={{ fontSize:11, color:"var(--text2)", marginBottom:2 }}>티어</div>
                    <div style={{ fontSize:18, fontWeight:700, color:"#a78bfa" }}>{current.tier}</div>
                  </div>
                  <div style={{ background:"var(--surface2)", borderRadius:8, padding:"8px 12px", textAlign:"center" }}>
                    <div style={{ fontSize:11, color:"var(--text2)", marginBottom:2 }}>승률</div>
                    <div style={{ fontSize:18, fontWeight:700, color: current.wr>=60?"#22C55E":current.wr>=50?"var(--text)":"#EF4444" }}>{current.wr}%</div>
                  </div>
                </div>
                <div style={{ fontSize:12, color:"var(--text2)", marginBottom:6 }}>라인별 티어</div>
                <div style={{ display:"flex", gap:4 }}>
                  {["TOP","JUG","MID","ADC","SUP"].map(l => {
                    const ld = current.lanes?.[l as keyof typeof current.lanes] ?? { tier:"E4", wr:50 };
                    const best = l === current.line;
                    return (
                      <div key={l} style={{ flex:1, textAlign:"center", padding:"4px 2px", borderRadius:6, background:best?"rgba(124,58,237,0.2)":"var(--surface2)", border:`1px solid ${best?"rgba(124,58,237,0.4)":"transparent"}` }}>
                        <div style={{ fontSize:9, color:best?"var(--purple-light)":"var(--text2)" }}>{l}</div>
                        <div style={{ fontSize:11, fontWeight:700, color:best?"#fff":"var(--text)" }}>{ld.tier}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:300, color:"var(--text2)", gap:12 }}>
              <div style={{ fontSize:40 }}>👇</div>
              <div style={{ fontSize:14 }}>아래에서 선수를 선택하세요</div>
            </div>
          )}
        </div>

        {/* 가운데: 경매 컨트롤 */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* 현재가 & 타이머 */}
          <div className="card" style={{ padding:24 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:12, color:"var(--text2)", marginBottom:6 }}>현재 입찰 팀</div>
                <div style={{ fontSize:20, fontWeight:700, color: auctionState.bid_team_name ? (teams.find(t=>t.name===auctionState.bid_team_name)?.color ?? "var(--text)") : "var(--text2)" }}>
                  {auctionState.bid_team_name ?? "—"}
                </div>
                {auctionState.bid_team_name && <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>입찰 중...</div>}
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:12, color:"var(--text2)", marginBottom:4 }}>현재가</div>
                <div style={{ fontSize:32, fontWeight:900, color:"#F59E0B" }}>{auctionState.current_price > 0 ? `${auctionState.current_price}P` : "—"}</div>
              </div>
            </div>

            {/* 타이머 바 */}
            <div style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontSize:13, color:"var(--text2)" }}>남은 시간</span>
                <span style={{ fontSize:36, fontWeight:900, color:timerColor, fontVariantNumeric:"tabular-nums" }}>{String(timeLeft).padStart(2,"0")}초</span>
              </div>
              <div style={{ height:8, background:"var(--surface2)", borderRadius:99, overflow:"hidden" }}>
                <div style={{ width:`${timerPct}%`, height:"100%", background:timerColor, borderRadius:99, transition:"width 0.9s linear" }} />
              </div>
            </div>

            {/* 팀 선택 & 입찰가 */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <div>
                <label style={{ fontSize:12, color:"var(--text2)", display:"block", marginBottom:4 }}>내 팀 선택</label>
                <select value={bidTeamId ?? ""} onChange={e => setBidTeamId(Number(e.target.value))}>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.points}P)</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, color:"var(--text2)", display:"block", marginBottom:4 }}>입찰가 (P)</label>
                <input type="number" min={10} max={9999} step={10} value={bidPrice} onChange={e => setBidPrice(Number(e.target.value))} />
              </div>
            </div>

            {/* 빠른 입찰가 */}
            <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
              {[50,100,200,300,500].map(v => (
                <button key={v} className="btn" onClick={() => setBidPrice(v)} style={{ fontSize:12, padding:"4px 10px", flex:1 }}>{v}P</button>
              ))}
            </div>

            {/* 메인 버튼들 */}
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              {!auctionState.active
                ? <button className="btn btn-primary" style={{ flex:2, padding:"10px 0", fontSize:14, fontWeight:700 }} onClick={startAuction} disabled={!current}>▶ 경매 시작</button>
                : <button className="btn" style={{ flex:2, padding:"10px 0" }} onClick={pauseAuction}>⏸ 일시정지</button>
              }
              <button className="btn btn-primary" style={{ flex:2, padding:"10px 0", fontSize:14, fontWeight:700 }} onClick={placeBid} disabled={!auctionState.active || !current}>
                🏷️ 입찰하기
              </button>
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <button onClick={allIn} style={{ flex:1, padding:"10px 0", borderRadius:8, border:"none", background:"#92400E", color:"#FCD34D", fontWeight:700, fontSize:14, cursor:"pointer" }}>
                🔥 ALL IN<div style={{ fontSize:11, fontWeight:400, opacity:0.8 }}>{bidTeam?.points ?? 0}P 모두 사용</div>
              </button>
              <button onClick={monopolyBid} style={{ flex:1, padding:"10px 0", borderRadius:8, border:"none", background:"#1e1b4b", color:"#818CF8", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                ⚡ 독점 낙찰<div style={{ fontSize:10, fontWeight:400, opacity:0.8, marginTop:2 }}>다음 라운드 입찰 불가</div>
              </button>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn" style={{ flex:1 }} onClick={confirmBid} disabled={!auctionState.bid_team_id}>✅ 낙찰 확정</button>
              <button className="btn btn-danger" style={{ flex:1 }} onClick={skipPlayer}>⏭ 건너뛰기</button>
            </div>
          </div>
        </div>

        {/* 오른쪽: 실시간 입찰 현황 */}
        <div className="card" style={{ padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:700 }}>실시간 입찰 현황</h3>
            <span style={{ fontSize:11, color:"#22C55E" }}>● 실시간</span>
          </div>

          {/* 팀별 포인트 */}
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
            {teams.map(t => (
              <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:8, background: auctionState.bid_team_name===t.name ? `${t.color}22` : "var(--surface2)", border:`1px solid ${auctionState.bid_team_name===t.name ? t.color+"66" : "transparent"}` }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:t.color, flexShrink:0 }} />
                <span style={{ flex:1, fontSize:13, fontWeight:600, color:t.color }}>{t.name}</span>
                <span style={{ fontSize:13, fontWeight:700, color: t.points < 100 ? "#EF4444" : "var(--text)" }}>{t.points}P</span>
                {auctionState.bid_team_name===t.name && <span style={{ fontSize:10, color:t.color, fontWeight:700 }}>입찰중!</span>}
              </div>
            ))}
          </div>

          <div style={{ borderTop:"1px solid var(--border)", paddingTop:12, marginBottom:8 }}>
            <div style={{ fontSize:12, color:"var(--text2)", marginBottom:8 }}>최근 입찰 로그</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:240, overflowY:"auto" }}>
              {log.length === 0 && <div style={{ fontSize:12, color:"var(--text2)", textAlign:"center", padding:"12px 0" }}>아직 입찰 없음</div>}
              {log.map((entry, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12, padding:"5px 8px", borderRadius:6, background: i===0?"rgba(124,58,237,0.1)":"transparent", border:`1px solid ${i===0?"rgba(124,58,237,0.2)":"transparent"}` }}>
                  <span style={{ color:entry.teamColor, fontWeight:600 }}>{entry.teamName}</span>
                  <span style={{ color:"#F59E0B", fontWeight:700 }}>{entry.price}P</span>
                  <span style={{ color:"var(--text2)", fontSize:10 }}>{entry.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 하단: 선수 리스트 */}
      <div className="card" style={{ padding:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ fontSize:14, fontWeight:700 }}>선수 리스트 <span style={{ color:"var(--text2)", fontWeight:400 }}>({available.length}명 남음)</span></h3>
          <div style={{ fontSize:12, color:"var(--text2)" }}>선수를 클릭하면 경매 대상으로 선택됩니다</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px,1fr))", gap:10 }}>
          {available.map(p => {
            const isSelected = p.id === auctionState.current_player_id;
            const color = avatarColor(p.id);
            return (
              <div key={p.id} onClick={() => selectPlayer(p)} style={{ borderRadius:10, border:`2px solid ${isSelected ? color : "var(--border)"}`, background: isSelected ? `${color}15` : "var(--surface2)", padding:"12px 10px", cursor:"pointer", transition:"all 0.15s", textAlign:"center" }}>
                <div style={{ width:40, height:40, borderRadius:10, background:`${color}22`, color, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:15, margin:"0 auto 8px" }}>
                  {p.name.slice(0,2)}
                </div>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
                <div style={{ display:"flex", justifyContent:"center", gap:4, marginBottom:4 }}>
                  <span className={`badge badge-${p.grade.toLowerCase()}`} style={{ fontSize:10 }}>{p.grade}</span>
                </div>
                <div style={{ fontSize:11, color:"var(--text2)" }}>{p.line} · {p.tier} · {p.wr}%</div>
                {isSelected && <div style={{ marginTop:6, fontSize:10, color, fontWeight:700 }}>▶ 경매 중</div>}
              </div>
            );
          })}
          {available.length === 0 && (
            <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"24px 0", color:"var(--text2)" }}>
              🎉 모든 선수 배정 완료!
            </div>
          )}
        </div>

        {/* 배정 완료된 선수 */}
        {players.filter(p=>p.teamId).length > 0 && (
          <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid var(--border)" }}>
            <div style={{ fontSize:12, color:"var(--text2)", marginBottom:8 }}>배정 완료</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {players.filter(p=>p.teamId).map(p => {
                const team = teams.find(t=>t.id===p.teamId);
                return (
                  <div key={p.id} style={{ padding:"4px 10px", borderRadius:99, fontSize:12, background:`${team?.color ?? "#666"}22`, color:team?.color ?? "#fff", border:`1px solid ${team?.color ?? "#666"}44` }}>
                    {p.name} <span style={{ opacity:0.7 }}>{team?.name} · {p.auctionPrice}P</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
