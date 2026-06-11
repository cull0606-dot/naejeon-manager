"use client";
import { useState } from "react";
import { useStore } from "../context";
import { Player, Lane, Grade, LANES } from "@/lib/data";

const GRADES: Grade[] = ["ACE", "VALUE", "NORMAL"];
const TIERS = ["C1","C2","C3","D1","D2","D3","D4","E1","E2","E3","E4","P1","P2","P3","P4","G1","G2","G3","G4"];
const AVATAR_COLORS = ["#7C3AED","#0369A1","#DC2626","#D97706","#059669","#DB2777"];
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
  const [form, setForm] = useState({
    name: player?.name ?? "",
    riot: player?.riot ?? "",
    line: player?.line ?? "MID" as Lane,
    sub: player?.sub ?? "TOP" as Lane,
    tier: player?.tier ?? "D4",
    wr: player?.wr ?? 55,
    grade: player?.grade ?? "NORMAL" as Grade,
    active: player?.active ?? true,
  });

  async function save() {
    if (!form.name.trim()) { alert("닉네임을 입력하세요"); return; }
    setSaving(true);
    const lanes = player?.lanes ?? {} as Player["lanes"];
    if (!player) {
      LANES.forEach(l => { if (!lanes[l]) lanes[l] = { tier: "E4", wr: 50 }; });
      lanes[form.line] = { tier: form.tier, wr: form.wr };
      await addPlayer({ ...form, lanes });
    } else {
      const updated = { ...player.lanes, [form.line]: { tier: form.tier, wr: form.wr } };
      await updatePlayer(player.id, { ...form, lanes: updated });
    }
    setSaving(false);
    onClose();
  }

  const F = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: key === "wr" ? Number(e.target.value) : e.target.value }));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
      <div className="card" style={{ padding: 24, width: 360, maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>{player ? "선수 수정" : "선수 추가"}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[["닉네임","name","text","원형"],["라이엇 아이디","riot","text","원형#KR1"]].map(([label,key,type,ph]) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 4 }}>{label}</label>
              <input type={type} placeholder={ph} value={form[key as keyof typeof form] as string} onChange={F(key as keyof typeof form)} />
            </div>
          ))}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 4 }}>티어</label>
              <select value={form.tier} onChange={F("tier")}>{TIERS.map(t => <option key={t}>{t}</option>)}</select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 4 }}>승률 (%)</label>
              <input type="number" min={0} max={100} value={form.wr} onChange={F("wr")} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 4 }}>등급</label>
            <select value={form.grade} onChange={F("grade")}>{GRADES.map(g => <option key={g}>{g}</option>)}</select>
          </div>
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
  const [selected, setSelected] = useState<Player | null>(null);

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
          <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>총 {players.length}명 등록</p>
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

      {selected && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${avatarColor(selected.id)}22`, color: avatarColor(selected.id), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>
                {selected.name.slice(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: "var(--text2)" }}>{selected.riot}</div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>주라인 {selected.line} / 부라인 {selected.sub}</div>
              </div>
            </div>
            <button className="btn" onClick={() => setSelected(null)}>✕</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
            {LANES.map(l => {
              const ld = selected.lanes?.[l] ?? { tier: "E4", wr: 50 };
              const best = l === selected.line;
              return (
                <div key={l} style={{ textAlign: "center", padding: "10px 6px", borderRadius: 8, background: best ? "rgba(124,58,237,0.2)" : "var(--surface2)", border: `1px solid ${best ? "rgba(124,58,237,0.4)" : "transparent"}` }}>
                  <div style={{ fontSize: 11, color: best ? "var(--purple-light)" : "var(--text2)", marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: best ? "#fff" : "var(--text)" }}>{ld.tier}</div>
                  <div style={{ fontSize: 11, color: best ? "var(--purple-light)" : "var(--text2)", marginTop: 2 }}>{ld.wr}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
        {filtered.map(p => (
          <div key={p.id} className="card" onClick={() => setSelected(p.id === selected?.id ? null : p)} style={{ padding: 16, cursor: "pointer", transition: "border-color 0.15s", borderColor: selected?.id === p.id ? "var(--purple)" : "var(--border)" }}>
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
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button className="btn" style={{ flex: 1, fontSize: 12, padding: "5px 0" }} onClick={e => { e.stopPropagation(); setModal(p); }}>수정</button>
              <button className="btn btn-danger" style={{ flex: 1, fontSize: 12, padding: "5px 0" }} onClick={e => { e.stopPropagation(); if (confirm(`${p.name} 선수를 삭제할까요?`)) deletePlayer(p.id); }}>삭제</button>
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
