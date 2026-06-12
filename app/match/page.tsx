"use client";
import { useState, useEffect } from "react";
import { useStore } from "../context";
import { supabase } from "@/lib/supabase";
import { LANES, Lane, Player } from "@/lib/data";

const AVATAR_COLORS = ["#7C3AED","#0369A1","#DC2626","#D97706","#059669","#DB2777","#0891B2","#65A30D"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

type Lineup = Record<Lane, number | null>;
const EMPTY_LINEUP: Lineup = { TOP: null, JUG: null, MID: null, ADC: null, SUP: null };

interface MatchState {
  team1: Lineup;
  team2: Lineup;
  team1_name: string;
  team2_name: string;
}

export default function MatchPage() {
  const { players, recordMatchByPlayers, loading } = useStore();
  const [team1, setTeam1] = useState<Lineup>({ ...EMPTY_LINEUP });
  const [team2, setTeam2] = useState<Lineup>({ ...EMPTY_LINEUP });
  const [team1Name, setTeam1Name] = useState("1팀");
  const [team2Name, setTeam2Name] = useState("2팀");
  const [recording, setRecording] = useState(false);
  const [history, setHistory] = useState<{ winner: string; loser: string; time: string }[]>([]);

  // 실시간 동기화
  useEffect(() => {
    fetchMatchState();
    const channel = supabase.channel("match-rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "match_state" }, payload => {
        const d = payload.new as any;
        if (d.team1) setTeam1(d.team1);
        if (d.team2) setTeam2(d.team2);
        if (d.team1_name) setTeam1Name(d.team1_name);
        if (d.team2_name) setTeam2Name(d.team2_name);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchMatchState() {
    const { data } = await supabase.from("match_state").select("*").eq("id", 1).single();
    if (data) {
      if (data.team1) setTeam1(data.team1);
      if (data.team2) setTeam2(data.team2);
      if (data.team1_name) setTeam1Name(data.team1_name);
      if (data.team2_name) setTeam2Name(data.team2_name);
    }
  }

  async function updateLineup(team: 1 | 2, lane: Lane, playerId: number | null) {
    const current = team === 1 ? { ...team1 } : { ...team2 };
    current[lane] = playerId;
    if (team === 1) setTeam1(current); else setTeam2(current);
    await supabase.from("match_state").update({ [`team${team}`]: current }).eq("id", 1);
  }

  async function updateTeamName(team: 1 | 2, name: string) {
    if (team === 1) setTeam1Name(name); else setTeam2Name(name);
    await supabase.from("match_state").update({ [`team${team}_name`]: name }).eq("id", 1);
  }

  function getPlayer(id: number | null): Player | undefined {
    return id ? players.find(p => p.id === id) : undefined;
  }

  function usedIds(excludeTeam?: 1 | 2, excludeLane?: Lane): Set<number> {
    const ids = new Set<number>();
    LANES.forEach(l => {
      if (!(excludeTeam === 1 && excludeLane === l) && team1[l]) ids.add(team1[l]!);
      if (!(excludeTeam === 2 && excludeLane === l) && team2[l]) ids.add(team2[l]!);
    });
    return ids;
  }

  const team1Players = LANES.map(l => getPlayer(team1[l])).filter(Boolean) as Player[];
  const team2Players = LANES.map(l => getPlayer(team2[l])).filter(Boolean) as Player[];
  const team1Full = team1Players.length === 5;
  const team2Full = team2Players.length === 5;
  const bothFull = team1Full && team2Full;

  const team1AvgWr = team1Players.length ? Math.round(team1Players.reduce((s,p)=>s+p.wr,0)/team1Players.length) : 0;
  const team2AvgWr = team2Players.length ? Math.round(team2Players.reduce((s,p)=>s+p.wr,0)/team2Players.length) : 0;

  async function handleWin(winner: 1 | 2) {
    if (!bothFull) return;
    if (!confirm(`${winner === 1 ? team1Name : team2Name} 승리로 기록할까요? 모든 선수의 승률이 즉시 갱신됩니다.`)) return;
    setRecording(true);
    const winnerIds = (winner === 1 ? team1Players : team2Players).map(p => p.id);
    const loserIds = (winner === 1 ? team2Players : team1Players).map(p => p.id);
    await recordMatchByPlayers(winnerIds, loserIds);
    setHistory(prev => [{ winner: winner===1?team1Name:team2Name, loser: winner===1?team2Name:team1Name, time: new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}) }, ...prev.slice(0,9)]);
    setRecording(false);
  }

  async function resetMatch() {
    if (!confirm("게임 현황을 초기화할까요?")) return;
    setTeam1({ ...EMPTY_LINEUP });
    setTeam2({ ...EMPTY_LINEUP });
    await supabase.from("match_state").update({ team1: EMPTY_LINEUP, team2: EMPTY_LINEUP }).eq("id", 1);
  }

  if (loading) return <div style={{ color:"var(--text2)", padding:40, textAlign:"center" }}>불러오는 중...</div>;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700 }}>게임 현황</h1>
          <p style={{ fontSize:13, color:"var(--text2)", marginTop:2 }}>5대5 라인업을 구성하고 경기 결과를 등록하세요 · <span style={{ color:"#22C55E" }}>● 실시간 연동</span></p>
        </div>
        <button className="btn btn-danger" onClick={resetMatch}>현황 초기화</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        <TeamPanel
          teamNum={1} name={team1Name} onNameChange={(n)=>updateTeamName(1,n)}
          lineup={team1} onSelect={(lane,id)=>updateLineup(1,lane,id)}
          players={players} usedIdsFor={(lane)=>usedIds(1,lane)}
          color="#7C3AED" avgWr={team1AvgWr} full={team1Full}
        />
        <TeamPanel
          teamNum={2} name={team2Name} onNameChange={(n)=>updateTeamName(2,n)}
          lineup={team2} onSelect={(lane,id)=>updateLineup(2,lane,id)}
          players={players} usedIdsFor={(lane)=>usedIds(2,lane)}
          color="#0369A1" avgWr={team2AvgWr} full={team2Full}
        />
      </div>

      {/* 승리 버튼 */}
      <div className="card" style={{ padding:20, marginBottom:16 }}>
        {bothFull ? (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <button onClick={()=>handleWin(1)} disabled={recording} style={{ padding:"16px 0", borderRadius:10, border:"none", background:"#7C3AED", color:"#fff", fontWeight:700, fontSize:16, cursor:"pointer" }}>
              🏆 {team1Name} 승리
            </button>
            <button onClick={()=>handleWin(2)} disabled={recording} style={{ padding:"16px 0", borderRadius:10, border:"none", background:"#0369A1", color:"#fff", fontWeight:700, fontSize:16, cursor:"pointer" }}>
              🏆 {team2Name} 승리
            </button>
          </div>
        ) : (
          <div style={{ textAlign:"center", padding:"12px 0", color:"var(--text2)", fontSize:14 }}>
            양 팀 모두 5명(TOP/JUG/MID/ADC/SUP)을 선택해야 결과를 등록할 수 있어요
          </div>
        )}
      </div>

      {/* 최근 경기 기록 */}
      {history.length > 0 && (
        <div className="card" style={{ padding:16 }}>
          <h3 style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>최근 경기 기록 (이 세션)</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {history.map((h,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"6px 10px", background:"var(--surface2)", borderRadius:8 }}>
                <span><span style={{ color:"#22C55E", fontWeight:700 }}>{h.winner}</span> 승 vs <span style={{ color:"#EF4444" }}>{h.loser}</span> 패</span>
                <span style={{ color:"var(--text2)" }}>{h.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamPanel({ teamNum, name, onNameChange, lineup, onSelect, players, usedIdsFor, color, avgWr, full }: {
  teamNum: 1 | 2; name: string; onNameChange: (n:string)=>void;
  lineup: Lineup; onSelect: (lane: Lane, id: number|null)=>void;
  players: Player[]; usedIdsFor: (lane: Lane)=>Set<number>;
  color: string; avgWr: number; full: boolean;
}) {
  return (
    <div className="card" style={{ padding:16, border: full ? `1px solid ${color}66` : undefined }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <input value={name} onChange={e=>onNameChange(e.target.value)} style={{ fontSize:18, fontWeight:700, color, border:"none", background:"transparent", padding:0, width:120 }} />
        <div style={{ fontSize:13, color:"var(--text2)" }}>
          평균 승률 <b style={{ color: avgWr>=60?"#22C55E":"var(--text)" }}>{avgWr}%</b>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {LANES.map(lane => {
          const selected = lineup[lane];
          const player = selected ? players.find(p=>p.id===selected) : undefined;
          const used = usedIdsFor(lane);
          const options = players.filter(p => p.active && (!used.has(p.id) || p.id === selected));
          return (
            <div key={lane} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:42, fontSize:12, fontWeight:700, color:"var(--text2)" }}>{lane}</div>
              <select value={selected ?? ""} onChange={e => onSelect(lane, e.target.value ? Number(e.target.value) : null)} style={{ flex:1 }}>
                <option value="">선수 선택...</option>
                {options.map(p => <option key={p.id} value={p.id}>{p.name} ({p.tier}, {p.wr}%)</option>)}
              </select>
              {player && (
                <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:120 }}>
                  <div style={{ width:28, height:28, borderRadius:"50%", background:`${avatarColor(player.id)}22`, color:avatarColor(player.id), display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:11, flexShrink:0 }}>
                    {player.name.slice(0,2)}
                  </div>
                  <div style={{ fontSize:11 }}>
                    <div style={{ fontWeight:600 }}>{player.tier}</div>
                    <div style={{ color: player.wr>=60?"#22C55E":"var(--text2)" }}>{player.wr}%</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
