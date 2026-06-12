"use client";
import { useState, useEffect, useRef } from "react";
import { useStore } from "../context";
import { supabase } from "@/lib/supabase";
import { Player } from "@/lib/data";

const LANES = ["TOP", "JUG", "MID", "ADC", "SUP"] as const;
type Lane = typeof LANES[number];
type Lineup = Record<Lane, number | null>;
const EMPTY_LINEUP: Lineup = { TOP: null, JUG: null, MID: null, ADC: null, SUP: null };

const AVATAR_COLORS = ["#7C3AED","#0369A1","#DC2626","#D97706","#059669","#DB2777","#0891B2","#65A30D"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

interface MatchStateDB {
  id: number;
  mode: "2team" | "4team";
  match1_team1: Lineup;
  match1_team2: Lineup;
  match1_team1_name: string;
  match1_team2_name: string;
  match1_winner: string | null;
  match2_team1: Lineup;
  match2_team2: Lineup;
  match2_team1_name: string;
  match2_team2_name: string;
  match2_winner: string | null;
  final_team1: Lineup;
  final_team2: Lineup;
  final_team1_name: string | null;
  final_team2_name: string | null;
  final_winner: string | null;
  stage: "semi" | "final";
}

export default function MatchPage() {
  const { players, recordMatchByPlayers, loading } = useStore();
  const [state, setState] = useState<MatchStateDB | null>(null);
  const [recording, setRecording] = useState(false);
  const [history, setHistory] = useState<{ winner: string; loser: string; time: string }[]>([]);

  useEffect(() => {
    fetchState();
    const channel = supabase.channel("match-rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "match_state" }, payload => {
        setState(payload.new as MatchStateDB);
      })
      .subscribe();
    const interval = setInterval(fetchState, 2000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  async function fetchState() {
    const { data } = await supabase.from("match_state").select("*").eq("id", 1).single();
    if (data) setState(data as MatchStateDB);
  }

  async function setMode(mode: "2team" | "4team") {
    await supabase.from("match_state").update({ mode, stage: "semi" }).eq("id", 1);
  }

  async function updateLineup(match: "match1" | "match2" | "final", team: 1 | 2, lane: Lane, playerId: number | null) {
    if (!state) return;
    const key = `${match}_team${team}` as keyof MatchStateDB;
    const current = { ...(state[key] as Lineup) };
    current[lane] = playerId;
    await supabase.from("match_state").update({ [key]: current }).eq("id", 1);
  }

  async function updateTeamName(match: "match1" | "match2" | "final", team: 1 | 2, name: string) {
    const key = `${match}_team${team}_name`;
    await supabase.from("match_state").update({ [key]: name }).eq("id", 1);
  }

  function getLineupPlayers(lineup: Lineup): Player[] {
    return LANES.map(l => players.find(p => p.id === lineup[l])).filter(Boolean) as Player[];
  }

  function usedIds(match: "match1" | "match2" | "final", excludeTeam: 1 | 2, excludeLane: Lane): Set<number> {
    if (!state) return new Set();
    const ids = new Set<number>();
    const t1 = state[`${match}_team1` as keyof MatchStateDB] as Lineup;
    const t2 = state[`${match}_team2` as keyof MatchStateDB] as Lineup;
    LANES.forEach(l => {
      if (!(excludeTeam === 1 && excludeLane === l) && t1[l]) ids.add(t1[l]!);
      if (!(excludeTeam === 2 && excludeLane === l) && t2[l]) ids.add(t2[l]!);
    });
    return ids;
  }

  async function handleWin(match: "match1" | "match2" | "final", winnerTeam: 1 | 2) {
    if (!state) return;
    const t1lineup = state[`${match}_team1` as keyof MatchStateDB] as Lineup;
    const t2lineup = state[`${match}_team2` as keyof MatchStateDB] as Lineup;
    const t1name = state[`${match}_team1_name` as keyof MatchStateDB] as string;
    const t2name = state[`${match}_team2_name` as keyof MatchStateDB] as string;
    const winnerName = winnerTeam === 1 ? t1name : t2name;
    const loserName = winnerTeam === 1 ? t2name : t1name;
    if (!confirm(`${winnerName} 승리로 기록할까요?`)) return;
    setRecording(true);

    const winnerIds = getLineupPlayers(winnerTeam === 1 ? t1lineup : t2lineup).map(p => p.id);
    const loserIds = getLineupPlayers(winnerTeam === 1 ? t2lineup : t1lineup).map(p => p.id);
    await recordMatchByPlayers(winnerIds, loserIds);

    setHistory(prev => [{ winner: winnerName, loser: loserName, time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }, ...prev.slice(0, 9)]);

    // 4팀 모드에서 4강 결과 처리 → 결승 자동 생성
    if (state.mode === "4team" && match !== "final") {
      const winnerKey = `${match}_winner`;
      await supabase.from("match_state").update({ [winnerKey]: winnerName }).eq("id", 1);

      const otherMatch = match === "match1" ? "match2" : "match1";
      const otherWinner = state[`${otherMatch}_winner` as keyof MatchStateDB] as string | null;

      if (otherWinner) {
        // 둘 다 결과 나옴 → 결승 자동 생성
        const finalT1Lineup = winnerTeam === 1 ? t1lineup : t2lineup;
        const finalT2Lineup = match === "match1"
          ? (state.match2_winner ? (state.match2_winner === state.match2_team1_name ? state.match2_team1 : state.match2_team2) : EMPTY_LINEUP)
          : (state.match1_winner ? (state.match1_winner === state.match1_team1_name ? state.match1_team1 : state.match1_team2) : EMPTY_LINEUP);

        await supabase.from("match_state").update({
          [winnerKey]: winnerName,
          stage: "final",
          final_team1: finalT1Lineup,
          final_team2: finalT2Lineup,
          final_team1_name: winnerName,
          final_team2_name: otherWinner,
          final_winner: null,
        }).eq("id", 1);
      }
    } else if (match === "final") {
      await supabase.from("match_state").update({ final_winner: winnerName }).eq("id", 1);
    }

    setRecording(false);
  }

  async function resetMatch() {
    if (!confirm("게임 현황을 초기화할까요?")) return;
    await supabase.from("match_state").update({
      stage: "semi",
      match1_team1: EMPTY_LINEUP, match1_team2: EMPTY_LINEUP,
      match1_team1_name: "1팀", match1_team2_name: "2팀", match1_winner: null,
      match2_team1: EMPTY_LINEUP, match2_team2: EMPTY_LINEUP,
      match2_team1_name: "3팀", match2_team2_name: "4팀", match2_winner: null,
      final_team1: EMPTY_LINEUP, final_team2: EMPTY_LINEUP,
      final_team1_name: null, final_team2_name: null, final_winner: null,
    }).eq("id", 1);
    setHistory([]);
  }

  if (loading || !state) return (
    <div style={{ color: "var(--text2)", padding: 40, textAlign: "center" }}>불러오는 중...</div>
  );

  const is4team = state.mode === "4team";

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>게임 현황</h1>
          <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>
            라인업을 구성하고 경기 결과를 등록하세요 · <span style={{ color: "#22C55E" }}>● 실시간 연동</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={resetMatch} className="btn btn-danger">현황 초기화</button>
        </div>
      </div>

      {/* 모드 선택 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setMode("2team")}
          style={{
            padding: "8px 20px", borderRadius: 8, border: "1px solid", cursor: "pointer", fontWeight: 600, fontSize: 14,
            borderColor: !is4team ? "var(--purple)" : "var(--border2)",
            background: !is4team ? "rgba(124,58,237,0.15)" : "transparent",
            color: !is4team ? "var(--purple-light)" : "var(--text2)",
          }}>
          2팀 모드
        </button>
        <button
          onClick={() => setMode("4team")}
          style={{
            padding: "8px 20px", borderRadius: 8, border: "1px solid", cursor: "pointer", fontWeight: 600, fontSize: 14,
            borderColor: is4team ? "var(--purple)" : "var(--border2)",
            background: is4team ? "rgba(124,58,237,0.15)" : "transparent",
            color: is4team ? "var(--purple-light)" : "var(--text2)",
          }}>
          4팀 토너먼트
        </button>
      </div>

      {!is4team ? (
        // 2팀 모드
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <TeamPanel
              match="match1" teamNum={1}
              name={state.match1_team1_name}
              onNameChange={n => updateTeamName("match1", 1, n)}
              lineup={state.match1_team1}
              onSelect={(lane, id) => updateLineup("match1", 1, lane, id)}
              players={players}
              usedIdsFor={lane => usedIds("match1", 1, lane)}
              color="#7C3AED"
            />
            <TeamPanel
              match="match1" teamNum={2}
              name={state.match1_team2_name}
              onNameChange={n => updateTeamName("match1", 2, n)}
              lineup={state.match1_team2}
              onSelect={(lane, id) => updateLineup("match1", 2, lane, id)}
              players={players}
              usedIdsFor={lane => usedIds("match1", 2, lane)}
              color="#0369A1"
            />
          </div>
          <WinButtons
            t1name={state.match1_team1_name} t2name={state.match1_team2_name}
            t1full={getLineupPlayers(state.match1_team1).length === 5}
            t2full={getLineupPlayers(state.match1_team2).length === 5}
            recording={recording}
            onWin={w => handleWin("match1", w)}
            winner={state.match1_winner}
          />
        </div>
      ) : (
        // 4팀 토너먼트 모드
        <div>
          {state.stage === "semi" && (
            <>
              <div style={{ fontSize: 13, color: "var(--purple-light)", fontWeight: 700, marginBottom: 12 }}>🏆 4강</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                {/* 4강 1경기 */}
                <div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8, fontWeight: 600 }}>4강 1경기</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <TeamPanel
                      match="match1" teamNum={1}
                      name={state.match1_team1_name}
                      onNameChange={n => updateTeamName("match1", 1, n)}
                      lineup={state.match1_team1}
                      onSelect={(lane, id) => updateLineup("match1", 1, lane, id)}
                      players={players}
                      usedIdsFor={lane => usedIds("match1", 1, lane)}
                      color="#7C3AED"
                    />
                    <TeamPanel
                      match="match1" teamNum={2}
                      name={state.match1_team2_name}
                      onNameChange={n => updateTeamName("match1", 2, n)}
                      lineup={state.match1_team2}
                      onSelect={(lane, id) => updateLineup("match1", 2, lane, id)}
                      players={players}
                      usedIdsFor={lane => usedIds("match1", 2, lane)}
                      color="#0369A1"
                    />
                  </div>
                  <WinButtons
                    t1name={state.match1_team1_name} t2name={state.match1_team2_name}
                    t1full={getLineupPlayers(state.match1_team1).length === 5}
                    t2full={getLineupPlayers(state.match1_team2).length === 5}
                    recording={recording}
                    onWin={w => handleWin("match1", w)}
                    winner={state.match1_winner}
                  />
                </div>

                {/* 4강 2경기 */}
                <div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8, fontWeight: 600 }}>4강 2경기</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <TeamPanel
                      match="match2" teamNum={1}
                      name={state.match2_team1_name}
                      onNameChange={n => updateTeamName("match2", 1, n)}
                      lineup={state.match2_team1}
                      onSelect={(lane, id) => updateLineup("match2", 1, lane, id)}
                      players={players}
                      usedIdsFor={lane => usedIds("match2", 1, lane)}
                      color="#DC2626"
                    />
                    <TeamPanel
                      match="match2" teamNum={2}
                      name={state.match2_team2_name}
                      onNameChange={n => updateTeamName("match2", 2, n)}
                      lineup={state.match2_team2}
                      onSelect={(lane, id) => updateLineup("match2", 2, lane, id)}
                      players={players}
                      usedIdsFor={lane => usedIds("match2", 2, lane)}
                      color="#D97706"
                    />
                  </div>
                  <WinButtons
                    t1name={state.match2_team1_name} t2name={state.match2_team2_name}
                    t1full={getLineupPlayers(state.match2_team1).length === 5}
                    t2full={getLineupPlayers(state.match2_team2).length === 5}
                    recording={recording}
                    onWin={w => handleWin("match2", w)}
                    winner={state.match2_winner}
                  />
                </div>
              </div>

              {/* 양쪽 4강 결과 나오면 결승 안내 */}
              {state.match1_winner && state.match2_winner && (
                <div className="card" style={{ padding: 16, textAlign: "center", borderColor: "#F59E0B" }}>
                  <div style={{ fontSize: 14, color: "#F59E0B", fontWeight: 700, marginBottom: 8 }}>🏆 결승 진출 확정!</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    <span style={{ color: "#7C3AED" }}>{state.match1_winner}</span>
                    {" vs "}
                    <span style={{ color: "#DC2626" }}>{state.match2_winner}</span>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 12 }}
                    onClick={() => supabase.from("match_state").update({ stage: "final" }).eq("id", 1)}
                  >
                    결승 시작하기 →
                  </button>
                </div>
              )}
            </>
          )}

          {state.stage === "final" && (
            <>
              <div style={{ fontSize: 13, color: "#F59E0B", fontWeight: 700, marginBottom: 12 }}>🏆 결승</div>
              {state.final_winner ? (
                <div className="card" style={{ padding: 40, textAlign: "center", borderColor: "#F59E0B" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#F59E0B" }}>{state.final_winner}</div>
                  <div style={{ fontSize: 14, color: "var(--text2)", marginTop: 8 }}>우승!</div>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <TeamPanel
                      match="final" teamNum={1}
                      name={state.final_team1_name ?? "결승 1팀"}
                      onNameChange={n => updateTeamName("final", 1, n)}
                      lineup={state.final_team1}
                      onSelect={(lane, id) => updateLineup("final", 1, lane, id)}
                      players={players}
                      usedIdsFor={lane => usedIds("final", 1, lane)}
                      color="#7C3AED"
                    />
                    <TeamPanel
                      match="final" teamNum={2}
                      name={state.final_team2_name ?? "결승 2팀"}
                      onNameChange={n => updateTeamName("final", 2, n)}
                      lineup={state.final_team2}
                      onSelect={(lane, id) => updateLineup("final", 2, lane, id)}
                      players={players}
                      usedIdsFor={lane => usedIds("final", 2, lane)}
                      color="#DC2626"
                    />
                  </div>
                  <WinButtons
                    t1name={state.final_team1_name ?? "결승 1팀"}
                    t2name={state.final_team2_name ?? "결승 2팀"}
                    t1full={getLineupPlayers(state.final_team1).length === 5}
                    t2full={getLineupPlayers(state.final_team2).length === 5}
                    recording={recording}
                    onWin={w => handleWin("final", w)}
                    winner={state.final_winner}
                  />
                </>
              )}
              <button
                className="btn"
                style={{ marginTop: 12 }}
                onClick={() => supabase.from("match_state").update({ stage: "semi" }).eq("id", 1)}
              >
                ← 4강으로 돌아가기
              </button>
            </>
          )}
        </div>
      )}

      {/* 최근 경기 기록 */}
      {history.length > 0 && (
        <div className="card" style={{ padding: 16, marginTop: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>최근 경기 기록 (이 세션)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.map((h, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 10px", background: "var(--surface2)", borderRadius: 8 }}>
                <span><span style={{ color: "#22C55E", fontWeight: 700 }}>{h.winner}</span> 승 vs <span style={{ color: "#EF4444" }}>{h.loser}</span> 패</span>
                <span style={{ color: "var(--text2)" }}>{h.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamPanel({ match, teamNum, name, onNameChange, lineup, onSelect, players, usedIdsFor, color }: {
  match: string; teamNum: 1 | 2; name: string; onNameChange: (n: string) => void;
  lineup: Lineup; onSelect: (lane: Lane, id: number | null) => void;
  players: Player[]; usedIdsFor: (lane: Lane) => Set<number>; color: string;
}) {
  const avgWr = LANES.map(l => players.find(p => p.id === lineup[l])).filter(Boolean).reduce((s, p, _, a) => s + (p?.wr ?? 0) / a.length, 0);
  const full = LANES.every(l => lineup[l] !== null);

  return (
    <div className="card" style={{ padding: 14, border: full ? `1px solid ${color}66` : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <input value={name} onChange={e => onNameChange(e.target.value)}
          style={{ fontSize: 16, fontWeight: 700, color, border: "none", background: "transparent", padding: 0, width: 100 }} />
        <div style={{ fontSize: 12, color: "var(--text2)" }}>
          평균 <b style={{ color: avgWr >= 60 ? "#22C55E" : "var(--text)" }}>{Math.round(avgWr)}%</b>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {LANES.map(lane => {
          const selected = lineup[lane];
          const player = selected ? players.find(p => p.id === selected) : undefined;
          const used = usedIdsFor(lane);
          const options = players.filter(p => p.active && (!used.has(p.id) || p.id === selected));
          return (
            <div key={lane} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 36, fontSize: 11, fontWeight: 700, color: "var(--text2)" }}>{lane}</div>
              <select value={selected ?? ""} onChange={e => onSelect(lane, e.target.value ? Number(e.target.value) : null)} style={{ flex: 1, fontSize: 12 }}>
                <option value="">선수 선택...</option>
                {options.map(p => <option key={p.id} value={p.id}>{p.name} ({p.tier}, {p.wr}%)</option>)}
              </select>
              {player && (
                <div style={{ fontSize: 11, color: player.wr >= 60 ? "#22C55E" : "var(--text2)", minWidth: 30 }}>{player.wr}%</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WinButtons({ t1name, t2name, t1full, t2full, recording, onWin, winner }: {
  t1name: string; t2name: string; t1full: boolean; t2full: boolean;
  recording: boolean; onWin: (w: 1 | 2) => void; winner: string | null;
}) {
  if (winner) {
    return (
      <div className="card" style={{ padding: 14, textAlign: "center", borderColor: "#22C55E" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#22C55E" }}>🏆 {winner} 승리!</span>
      </div>
    );
  }
  if (!t1full || !t2full) {
    return (
      <div className="card" style={{ padding: 12, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>
        양 팀 5명을 모두 선택해야 결과 등록 가능
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <button onClick={() => onWin(1)} disabled={recording}
        style={{ padding: "12px 0", borderRadius: 8, border: "none", background: "#7C3AED", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
        🏆 {t1name} 승리
      </button>
      <button onClick={() => onWin(2)} disabled={recording}
        style={{ padding: "12px 0", borderRadius: 8, border: "none", background: "#0369A1", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
        🏆 {t2name} 승리
      </button>
    </div>
  );
}
