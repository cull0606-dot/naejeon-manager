"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useStore } from "../../context";
import { LANES, Lane, Champion, TIERS } from "@/lib/data";

const AVATAR_COLORS = ["#7C3AED","#0369A1","#DC2626","#D97706","#059669","#DB2777","#0891B2","#65A30D"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

function CircleProgress({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} stroke="var(--surface2)" strokeWidth={5} fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={5} fill="none"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.4s" }} />
      <text x={size/2} y={size/2} fill={color} fontSize={13} fontWeight={700} textAnchor="middle" dominantBaseline="middle" transform={`rotate(90 ${size/2} ${size/2})`}>
        {pct}%
      </text>
    </svg>
  );
}

export default function PlayerDetailPage() {
  const { players, teams, updatePlayer, deletePlayer, loading } = useStore();
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const player = players.find(p => p.id === id);

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [memo, setMemo] = useState("");
  const [champModal, setChampModal] = useState(false);
  const [newChamp, setNewChamp] = useState({ name: "", games: 0, wr: 50 });

  useEffect(() => { if (player) setMemo(player.memo ?? ""); }, [player?.id]);

  const filteredPlayers = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div style={{ color:"var(--text2)", padding:40, textAlign:"center" }}>불러오는 중...</div>;
  if (!player) return <div style={{ color:"var(--text2)", padding:40, textAlign:"center" }}>선수를 찾을 수 없습니다. <Link href="/players" style={{ color:"var(--purple-light)" }}>목록으로</Link></div>;

  const team = teams.find(t => t.id === player.teamId);
  const recent = player.recent_results ?? [];
  const champs = player.champions ?? [];
  const lp = player.lp ?? { TOP:0, JUG:0, MID:0, ADC:0, SUP:0 };

  async function saveMemo() {
    await updatePlayer(player!.id, { memo });
  }

  async function toggleActive() {
    await updatePlayer(player!.id, { active: !player!.active });
  }

  async function addChampion() {
    if (!newChamp.name.trim()) return;
    const updated = [...champs, { ...newChamp }].sort((a,b) => b.games - a.games);
    await updatePlayer(player!.id, { champions: updated });
    setNewChamp({ name: "", games: 0, wr: 50 });
    setChampModal(false);
  }

  async function removeChampion(name: string) {
    const updated = champs.filter(c => c.name !== name);
    await updatePlayer(player!.id, { champions: updated });
  }

  const broadcastChamps = champs.slice(0, 3);
  const detailChamps = champs.slice(0, 5);

  return (
    <div>
      {/* 챔피언 추가 모달 */}
      {champModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}>
          <div className="card" style={{ padding:24, width:320 }}>
            <h3 style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>주챔프 추가</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={{ fontSize:12, color:"var(--text2)", display:"block", marginBottom:4 }}>챔피언 이름</label>
                <input value={newChamp.name} onChange={e => setNewChamp(prev => ({ ...prev, name: e.target.value }))} placeholder="아리" />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <label style={{ fontSize:12, color:"var(--text2)", display:"block", marginBottom:4 }}>게임 수</label>
                  <input type="number" value={newChamp.games} onChange={e => setNewChamp(prev => ({ ...prev, games: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={{ fontSize:12, color:"var(--text2)", display:"block", marginBottom:4 }}>승률 (%)</label>
                  <input type="number" min={0} max={100} value={newChamp.wr} onChange={e => setNewChamp(prev => ({ ...prev, wr: Number(e.target.value) }))} />
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:20 }}>
              <button className="btn" onClick={() => setChampModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={addChampion}>추가</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize:22, fontWeight:700 }}>선수 상세 보기</h1>
        <p style={{ fontSize:13, color:"var(--text2)", marginTop:2 }}>선수 카드를 클릭하면 상세 페이지로 이동합니다</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"220px 1fr", gap:16 }}>
        {/* 왼쪽: 선수 목록 */}
        <div className="card" style={{ padding:14, alignSelf:"start" }}>
          <h3 style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>선수 목록</h3>
          <input placeholder="닉네임 검색..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom:10, fontSize:13 }} />
          <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:600, overflowY:"auto" }}>
            {filteredPlayers.map(p => (
              <div key={p.id} onClick={() => router.push(`/players/${p.id}`)} style={{
                padding:"8px 10px", borderRadius:8, cursor:"pointer",
                background: p.id === player.id ? "rgba(124,58,237,0.15)" : "transparent",
                border: `1px solid ${p.id === player.id ? "rgba(124,58,237,0.4)" : "transparent"}`,
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                  <span style={{ fontSize:13, fontWeight:600, color: p.id===player.id ? "var(--purple-light)" : "var(--text)" }}>{p.name}</span>
                  {p.grade === "ACE" && <span style={{ fontSize:11 }}>🏆</span>}
                  {p.grade === "VALUE" && <span style={{ fontSize:11 }}>💎</span>}
                </div>
                <div style={{ fontSize:11, color:"var(--text2)" }}>{p.line} {p.tier} · 승률 {p.wr}%</div>
                <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:10, color: p.active?"#22C55E":"#EF4444", marginTop:2 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background: p.active?"#22C55E":"#EF4444" }} />
                  {p.active ? "활성" : "휴면"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 오른쪽: 상세 정보 */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* 프로필 헤더 */}
          <div className="card" style={{ padding:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
              <div style={{ display:"flex", gap:16, alignItems:"center" }}>
                <div style={{ width:64, height:64, borderRadius:"50%", background:`${avatarColor(player.id)}22`, color:avatarColor(player.id), display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:22, flexShrink:0 }}>
                  {player.name.slice(0,2)}
                </div>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:22, fontWeight:700 }}>{player.name}</span>
                    <span className={`badge badge-${player.grade.toLowerCase()}`}>{player.grade === "ACE" ? "🏆" : player.grade === "VALUE" ? "💎" : ""} {player.grade}</span>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, color: player.active?"#22C55E":"#EF4444" }}>
                      <span style={{ width:7, height:7, borderRadius:"50%", background: player.active?"#22C55E":"#EF4444" }} />
                      {player.active ? "활성" : "비활성"}
                    </span>
                  </div>
                  <div style={{ fontSize:13, color:"var(--text2)", marginTop:4 }}>{player.riot}</div>
                  <div style={{ fontSize:13, color:"var(--text2)", marginTop:2 }}>주라인 <b style={{ color:"var(--text)" }}>{player.line}</b> / 부라인 <b style={{ color:"var(--text)" }}>{player.sub}</b></div>
                  {player.intro && <div style={{ fontSize:12, color:"var(--text2)", marginTop:6, maxWidth:400 }}>{player.intro}</div>}
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Link href="/players" className="btn" style={{ fontSize:12, padding:"6px 12px", textDecoration:"none" }}>수정하기</Link>
                <button className="btn" onClick={toggleActive} style={{ fontSize:12, padding:"6px 12px", background: player.active?"rgba(239,68,68,0.15)":"rgba(34,197,94,0.15)", borderColor: player.active?"rgba(239,68,68,0.3)":"rgba(34,197,94,0.3)", color: player.active?"#EF4444":"#22C55E" }}>
                  {player.active ? "비활성화" : "활성화"}
                </button>
              </div>
            </div>

            {/* 기본 정보 카드 */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
              <div style={{ background:"var(--surface2)", borderRadius:8, padding:"12px", textAlign:"center" }}>
                <div style={{ fontSize:11, color:"var(--text2)", marginBottom:4 }}>티어 (전체)</div>
                <div style={{ fontSize:22, fontWeight:700, color:"#a78bfa" }}>{player.tier}</div>
              </div>
              <div style={{ background:"var(--surface2)", borderRadius:8, padding:"12px", textAlign:"center" }}>
                <div style={{ fontSize:11, color:"var(--text2)", marginBottom:4 }}>전체 승률</div>
                <div style={{ fontSize:22, fontWeight:700, color: player.wr>=60?"#22C55E":player.wr>=50?"var(--text)":"#EF4444" }}>{player.wr}%</div>
                <div style={{ fontSize:10, color:"var(--text2)", marginTop:2 }}>{player.wins ?? 0}승 {player.losses ?? 0}패</div>
              </div>
              <div style={{ background:"var(--surface2)", borderRadius:8, padding:"12px", textAlign:"center" }}>
                <div style={{ fontSize:11, color:"var(--text2)", marginBottom:4 }}>팀장 전적</div>
                <div style={{ fontSize:22, fontWeight:700 }}>{(player.team_wins ?? 0)+(player.team_losses ?? 0)}전 {player.team_wins ?? 0}승</div>
                <div style={{ fontSize:10, color:"var(--text2)", marginTop:2 }}>
                  {(player.team_wins ?? 0)+(player.team_losses ?? 0) > 0 ? Math.round((player.team_wins ?? 0)/((player.team_wins ?? 0)+(player.team_losses ?? 0))*100) : 0}%
                </div>
              </div>
              <div style={{ background:"var(--surface2)", borderRadius:8, padding:"12px" }}>
                <div style={{ fontSize:11, color:"var(--text2)", marginBottom:6, textAlign:"center" }}>최근 전적</div>
                <div style={{ display:"flex", gap:3, justifyContent:"center" }}>
                  {recent.length === 0 && <span style={{ fontSize:11, color:"var(--text2)" }}>기록 없음</span>}
                  {recent.slice(0,5).map((r,i) => (
                    <span key={i} style={{ width:20, height:20, borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", background: r==="W"?"#22C55E":"#EF4444" }}>{r}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 라인별 티어 / 승률 / 팀 정보 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div className="card" style={{ padding:16 }}>
              <h3 style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>라인별 티어</h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6 }}>
                {LANES.map(l => {
                  const ld = player.lanes?.[l] ?? { tier:"E4", wr:50 };
                  const best = l === player.line;
                  return (
                    <div key={l} style={{ textAlign:"center", padding:"8px 4px", borderRadius:8, background: best?"rgba(124,58,237,0.2)":"var(--surface2)", border:`1px solid ${best?"rgba(124,58,237,0.4)":"transparent"}` }}>
                      <div style={{ fontSize:11, color: best?"var(--purple-light)":"var(--text2)" }}>{l}</div>
                      <div style={{ fontSize:16, fontWeight:700, color: best?"#fff":"var(--text)", marginTop:2 }}>{ld.tier}</div>
                      <div style={{ fontSize:10, color:"var(--text2)", marginTop:2 }}>{lp[l] ?? 0} LP</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card" style={{ padding:16 }}>
              <h3 style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>라인별 승률</h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6 }}>
                {LANES.map(l => {
                  const ld = player.lanes?.[l] ?? { tier:"E4", wr:50 };
                  const color = ld.wr>=60?"#22C55E":ld.wr>=50?"#7C3AED":"#EF4444";
                  return (
                    <div key={l} style={{ textAlign:"center" }}>
                      <CircleProgress pct={ld.wr} color={color} size={56} />
                      <div style={{ fontSize:11, color:"var(--text2)", marginTop:4 }}>{l}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 주챔프 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div className="card" style={{ padding:16 }}>
              <h3 style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>주챔프 (방송용)</h3>
              <div style={{ display:"flex", gap:10 }}>
                {broadcastChamps.length === 0 && <div style={{ fontSize:13, color:"var(--text2)" }}>등록된 챔피언 없음</div>}
                {broadcastChamps.map(c => (
                  <div key={c.name} style={{ flex:1, textAlign:"center" }}>
                    <div style={{ width:"100%", aspectRatio:"3/4", borderRadius:8, background:`linear-gradient(135deg, ${avatarColor(c.name.length)}33, var(--surface2))`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:700, color:avatarColor(c.name.length), marginBottom:6 }}>
                      {c.name.slice(0,1)}
                    </div>
                    <div style={{ fontSize:12, fontWeight:600 }}>{c.name}</div>
                    <div style={{ fontSize:11, color:"var(--text2)" }}>{c.games}전 {c.wr}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <h3 style={{ fontSize:13, fontWeight:700 }}>주챔프 (상세)</h3>
                <button className="btn" onClick={() => setChampModal(true)} style={{ fontSize:11, padding:"3px 8px" }}>+ 추가</button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {detailChamps.length === 0 && <div style={{ fontSize:13, color:"var(--text2)" }}>등록된 챔피언 없음</div>}
                {detailChamps.map(c => (
                  <div key={c.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 8px", background:"var(--surface2)", borderRadius:8 }}>
                    <div style={{ width:28, height:28, borderRadius:6, background:`${avatarColor(c.name.length)}33`, color:avatarColor(c.name.length), display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, flexShrink:0 }}>
                      {c.name.slice(0,1)}
                    </div>
                    <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{c.name}</span>
                    <span style={{ fontSize:12, color:"var(--text2)" }}>{c.games}전</span>
                    <span style={{ fontSize:12, fontWeight:600, color: c.wr>=60?"#22C55E":c.wr>=50?"var(--text)":"#EF4444" }}>{c.wr}%</span>
                    <button onClick={() => removeChampion(c.name)} style={{ background:"none", border:"none", color:"var(--text2)", cursor:"pointer", fontSize:14, padding:"0 4px" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 기본정보 / 소개 / 메모 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <div className="card" style={{ padding:16 }}>
              <h3 style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>기본 정보</h3>
              <div style={{ display:"flex", flexDirection:"column", gap:8, fontSize:13 }}>
                {[
                  ["닉네임", player.name],
                  ["라이엇 닉네임", player.riot],
                  ["주라인", player.line],
                  ["부라인", player.sub],
                  ["태그", player.tags || "-"],
                  ["포지션 성향", player.position_status || "-"],
                  ["선수 등급", player.grade],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ color:"var(--text2)" }}>{k}</span>
                    <span style={{ fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding:16 }}>
              <h3 style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>소개 및 특이사항</h3>
              <div style={{ fontSize:13, color:"var(--text2)", lineHeight:1.6 }}>
                {player.intro || "등록된 소개가 없습니다."}
              </div>
            </div>

            <div className="card" style={{ padding:16 }}>
              <h3 style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>메모</h3>
              <textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="메모를 입력하세요..." style={{ width:"100%", minHeight:80, resize:"vertical", fontSize:13 }} />
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
                <span style={{ fontSize:11, color:"var(--text2)" }}>{memo.length}/500</span>
                <button className="btn btn-primary" style={{ fontSize:12, padding:"4px 12px" }} onClick={saveMemo}>저장하기</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
