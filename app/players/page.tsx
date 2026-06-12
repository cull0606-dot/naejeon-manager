"use client";
import { useState } from "react";
import Link from "next/link";
import { useStore } from "../context";
import { Player, Lane, Grade, LANES, TIERS } from "@/lib/data";

const GRADES: Grade[] = ["ACE", "VALUE", "NORMAL"];
const AVATAR_COLORS = ["#7C3AED","#0369A1","#DC2626","#D97706","#059669","#DB2777","#0891B2","#65A30D"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

function WrBar({ wr }: { wr: number }) {
  const color = wr >= 60 ? "#22C55E" : wr >= 50 ? "#7C3AED" : "#EF4444";
  return (
    <div style={{ height: 4, background: "var(--surface2)", borderRadius: 99, overflow: "hidden", marginTop: 6 }}>
      <div style={{ width: `${wr}%`, height: "100%", background: color, borderRadius: 99 }} />
    </div>
  );
}

function PlayerModal({ player, onClose }: { player?: Player; onClose: () => void }) {
  const { addPlayer, updatePlayer } = useStore();
  const [saving, setSaving] = useState(false);

  // 라인별 티어/승률 초기값
  const initLanes = () => {
    const result: Record<Lane, { tier: string; wr: number }> = {
      TOP: { tier: "E4", wr: 50 },
      JUG: { tier: "E4", wr: 50 },
      MID: { tier: "E4", wr: 50 },
      ADC: { tier: "E4", wr: 50 },
      SUP: { tier: "E4", wr: 50 },
    };
    if (player?.lanes) {
      LANES.forEach(l => {
        result[l] = { tier: player.lanes[l]?.tier ?? "E4", wr: player.lanes[l]?.wr ?? 50 };
      });
    }
    return result;
  };

  const [form, setForm] = useState({
    name: player?.name ?? "",
    riot: player?.riot ?? "",
    line: player?.line ?? "MID" as Lane,
    sub: player?.sub ?? "TOP" as Lane,
    tier: player?.tier ?? "D4",
    wr: player?.wr ?? 55,
    grade: player?.grade ?? "NORMAL" as Grade,
    active: player?.active ?? true,
    intro: player?.intro ?? "",
    tags: player?.tags ?? "",
    position_status: player?.position_status ?? "캐리형",
  });

  const [laneForms, setLaneForms] = useState<Record<Lane, { tier: string; wr: number }>>(initLanes());

  function setLane(lane: Lane, key: "tier" | "wr", value: string | number) {
    setLaneForms(prev => ({ ...prev, [lane]: { ...prev[lane], [key]: key === "wr" ? Number(value) : value } }));
  }

  async function save() {
    if (!form.name.trim()) { alert("닉네임을 입력하세요"); return; }
    setSaving(true);

    const lanes: Player["lanes"] = {} as Player["lanes"];
    LANES.forEach(l => {
      lanes[l] = { tier: laneForms[l].tier, wr: laneForms[l].wr, lp: player?.lanes?.[l]?.lp ?? 0 };
    });

    // 주 라인 티어/승률을 대표값으로 사용
    const mainTier = laneForms[form.line].tier;
    const mainWr = laneForms[form.line].wr;

    if (!player) {
      await addPlayer({ ...form, tier: mainTier, wr: mainWr, lanes, lp: { TOP:0,JUG:0,MID:0,ADC:0,SUP:0 }, champions: [], recent_results: [], wins:0, losses:0, team_wins:0, team_losses:0 });
    } else {
      await updatePlayer(player.id, { ...form, tier: mainTier, wr: mainWr, lanes });
    }
    setSaving(false);
    onClose();
  }

  const F = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: key === "wr" ? Number(e.target.value) : e.target.value }));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
      <div className="card" style={{ padding: 24, width: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>{player ? "선수 수정" : "선수 추가"}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* 닉네임 / 라이엇 ID */}
          {[["닉네임","name","text","원형"],["라이엇 아이디","riot","text","원형#KR1"]].map(([label,key,type,ph]) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 4 }}>{label}</label>
              <input type={type} placeholder={ph} value={form[key as keyof typeof form] as string} onChange={F(key as keyof typeof form)} />
            </div>
          ))}

          {/* 주/부 라인 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["주 라인","line"],["부 라인","sub"]].map(([label,key]) => (
              <div key={key}>
                <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 4 }}>{label}</label>
                <select value={form[key as keyof typeof form] as string} onChange={F(key as keyof typeof form)}>
                  {LANES.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* 라인별 티어/승률 */}
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 8 }}>
              라인별 티어 / 승률 <span style={{ fontSize: 11, color: "var(--purple-light)" }}>(주 라인 기준으로 대표값 자동 설정)</span>
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {LANES.map(lane => {
                const isMain = lane === form.line;
                const isSub = lane === form.sub;
                return (
                  <div key={lane} style={{
                    display: "grid", gridTemplateColumns: "52px 1fr 80px", gap: 8, alignItems: "center",
                    padding: "8px 10px", borderRadius: 8,
                    background: isMain ? "rgba(124,58,237,0.15)" : isSub ? "rgba(3,105,161,0.1)" : "var(--surface2)",
                    border: `1px solid ${isMain ? "rgba(124,58,237,0.4)" : isSub ? "rgba(3,105,161,0.3)" : "transparent"}`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isMain ? "var(--purple-light)" : isSub ? "#38bdf8" : "var(--text2)" }}>
                      {lane}{isMain ? " 주" : isSub ? " 부" : ""}
                    </div>
                    <select value={laneForms[lane].tier} onChange={e => setLane(lane, "tier", e.target.value)} style={{ fontSize: 12 }}>
                      {TIERS.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number" min={0} max={100} value={laneForms[lane].wr}
                        onChange={e => setLane(lane, "wr", e.target.value)}
                        style={{ width: "100%", fontSize: 12 }}
                      />
                      <span style={{ fontSize: 11, color: "var(--text2)" }}>%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 등급 / 포지션 성향 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 4 }}>등급</label>
              <select value={form.grade} onChange={F("grade")}>{GRADES.map(g => <option key={g}>{g}</option>)}</select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 4 }}>포지션 성향</label>
              <select value={form.position_status} onChange={F("position_status")}>
                <option>캐리형</option><option>지원형</option><option>안정형</option><option>로밍형</option><option>한타형</option>
              </select>
            </div>
          </div>

          {/* 태그 */}
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 4 }}>태그 (쉼표로 구분)</label>
            <input value={form.tags} onChange={F("tags")} placeholder="피지컬, 라인전" />
          </div>

          {/* 소개 */}
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 4 }}>소개 및 특이사항</label>
            <textarea value={form.intro} onChange={F("intro")} placeholder="피지컬이 좋고 라인전 단계에서의 압박이 강합니다." style={{ width:"100%", minHeight:60, resize:"vertical" }} />
          </div>

          {/* 활성 상태 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))} style={{ width: "auto" }} />
            <label htmlFor="active" style={{ fontSize: 13, color: "var(--text)" }}>활성 상태</label>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button className="btn" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "저장 중..." : player ? "저장" : "추가"}</button>
        </div>
      </div>
    </div>
  );
}

export default function PlayersPage() {
  const { players, deletePlayer, loading } = useStore();
  const [search, setSearch] = useState("");
  const [filterLine, setFilterLine] = useState("all");
  const [filterGrade, setFilterGrade] = useState("all");
  const [modal, setModal] = useState<"add" | Player | null>(null);

  const filtered = players.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterLine !== "all" && p.line !== filterLine && p.sub !== filterLine) return false;
    if (filterGrade !== "all" && p.grade !== filterGrade) return false;
    return true;
  });

  if (loading) return <div style={{ color: "var(--text2)", padding: 40, textAlign: "center" }}>불러오는 중...</div>;

  return (
    <div>
      {modal && <PlayerModal player={modal === "add" ? undefined : modal as Player} onClose={() => setModal(null)} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>선수 관리</h1>
          <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>총 {players.length}명 등록 · 카드를 클릭하면 상세 페이지로 이동합니다</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal("add")}>+ 선수 추가</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input style={{ width: 200 }} placeholder="닉네임 검색..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["all","TOP","JUG","MID","ADC","SUP"].map(f => (
            <button key={f} onClick={() => setFilterLine(f)} style={{
              padding: "6px 12px", borderRadius: 99, fontSize: 12, fontWeight: 500, border: "1px solid", cursor: "pointer",
              borderColor: filterLine === f ? "var(--purple)" : "var(--border2)",
              background: filterLine === f ? "rgba(124,58,237,0.15)" : "transparent",
              color: filterLine === f ? "var(--purple-light)" : "var(--text2)",
            }}>{f === "all" ? "전체" : f}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["all","ACE","VALUE","NORMAL"].map(f => (
            <button key={f} onClick={() => setFilterGrade(f)} style={{
              padding: "6px 12px", borderRadius: 99, fontSize: 12, fontWeight: 500, border: "1px solid", cursor: "pointer",
              borderColor: filterGrade === f ? "#F59E0B" : "var(--border2)",
              background: filterGrade === f ? "rgba(245,158,11,0.15)" : "transparent",
              color: filterGrade === f ? "#F59E0B" : "var(--text2)",
            }}>{f === "all" ? "전체 등급" : f}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
        {filtered.map(p => (
          <div key={p.id} className="card" style={{ padding: 16, transition: "border-color 0.15s", borderColor: "var(--border)" }}>
            <Link href={`/players/${p.id}`} style={{ textDecoration: "none", color: "inherit", display: "block", cursor: "pointer" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${avatarColor(p.id)}22`, color: avatarColor(p.id), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {p.name.slice(0, 2)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.riot}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
                <span className={`badge badge-${p.grade.toLowerCase()}`}>{p.grade === "ACE" ? "🏆" : p.grade === "VALUE" ? "💎" : ""} {p.grade}</span>
                <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "var(--surface2)", color: "var(--text2)" }}>{p.line}/{p.sub}</span>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.active ? "#22C55E" : "#EF4444", display: "inline-block" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text2)" }}>티어 <b style={{ color: "var(--text)" }}>{p.tier}</b></span>
                <span className={p.wr >= 60 ? "wr-high" : p.wr >= 50 ? "wr-mid" : "wr-low"}>{p.wr}%</span>
              </div>
              <WrBar wr={p.wr} />
            </Link>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button className="btn" style={{ flex: 1, fontSize: 12, padding: "5px 0" }} onClick={() => setModal(p)}>수정</button>
              <button className="btn btn-danger" style={{ flex: 1, fontSize: 12, padding: "5px 0" }} onClick={() => { if (confirm(`${p.name} 선수를 삭제할까요?`)) deletePlayer(p.id); }}>삭제</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px 0", color: "var(--text2)" }}>
            선수가 없습니다. 선수를 추가해보세요!
          </div>
        )}
      </div>
    </div>
  );
}