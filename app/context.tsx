"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { Player, Team, LANES } from "@/lib/data";

interface Ctx {
  players: Player[];
  teams: Team[];
  loading: boolean;
  addPlayer: (p: Omit<Player, "id">) => Promise<void>;
  updatePlayer: (id: number, p: Partial<Player>) => Promise<void>;
  deletePlayer: (id: number) => Promise<void>;
  updateTeam: (id: number, t: Partial<Team>) => Promise<void>;
  assignPlayerToTeam: (playerId: number, teamId: number, price: number) => Promise<void>;
  removePlayerFromTeam: (playerId: number) => Promise<void>;
  resetAuction: () => Promise<void>;
  recordMatch: (winnerTeamId: number, loserTeamId: number) => Promise<void>;
}

const Context = createContext<Ctx | null>(null);

export function PlayersProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    const [{ data: ps }, { data: ts }] = await Promise.all([
      supabase.from("players").select("*").order("id"),
      supabase.from("teams").select("*").order("id"),
    ]);
    if (ps) setPlayers(ps.map(dbToPlayer));
    if (ts) setTeams(ts.map(dbToTeam));
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("global-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const addPlayer = useCallback(async (p: Omit<Player, "id">) => {
    await supabase.from("players").insert([playerToDb(p as Player)]);
  }, []);

  const updatePlayer = useCallback(async (id: number, p: Partial<Player>) => {
    await supabase.from("players").update(playerToDb(p as Player, true)).eq("id", id);
  }, []);

  const deletePlayer = useCallback(async (id: number) => {
    await supabase.from("players").delete().eq("id", id);
  }, []);

  const updateTeam = useCallback(async (id: number, t: Partial<Team>) => {
    const db: Record<string, unknown> = {};
    if (t.name !== undefined) db.name = t.name;
    if (t.color !== undefined) db.color = t.color;
    if (t.points !== undefined) db.points = t.points;
    await supabase.from("teams").update(db).eq("id", id);
  }, []);

  const assignPlayerToTeam = useCallback(async (playerId: number, teamId: number, price: number) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    await supabase.from("players").update({ team_id: teamId, auction_price: price }).eq("id", playerId);
    await supabase.from("teams").update({ points: team.points - price }).eq("id", teamId);
  }, [teams]);

  const removePlayerFromTeam = useCallback(async (playerId: number) => {
    const player = players.find(p => p.id === playerId);
    if (!player?.teamId) return;
    const team = teams.find(t => t.id === player.teamId);
    if (!team) return;
    await supabase.from("players").update({ team_id: null, auction_price: null }).eq("id", playerId);
    await supabase.from("teams").update({ points: team.points + (player.auctionPrice ?? 0) }).eq("id", player.teamId);
  }, [players, teams]);

  const resetAuction = useCallback(async () => {
    await supabase.from("players").update({ team_id: null, auction_price: null }).neq("id", 0);
    for (const team of teams) {
      await supabase.from("teams").update({ points: 1000 }).eq("id", team.id);
    }
  }, [teams]);

  const recordMatch = useCallback(async (winnerTeamId: number, loserTeamId: number) => {
    const winnerPlayers = players.filter(p => p.teamId === winnerTeamId);
    const loserPlayers = players.filter(p => p.teamId === loserTeamId);
    for (const p of winnerPlayers) {
      const newWins = (p.wins ?? 0) + 1;
      const newResults = ["W", ...(p.recent_results ?? [])].slice(0, 10);
      const total = newWins + (p.losses ?? 0);
      const newWr = total > 0 ? Math.round((newWins / total) * 100) : p.wr;
      await supabase.from("players").update({ wins: newWins, recent_results: newResults, wr: newWr }).eq("id", p.id);
    }
    for (const p of loserPlayers) {
      const newLosses = (p.losses ?? 0) + 1;
      const newResults = ["L", ...(p.recent_results ?? [])].slice(0, 10);
      const total = (p.wins ?? 0) + newLosses;
      const newWr = total > 0 ? Math.round(((p.wins ?? 0) / total) * 100) : p.wr;
      await supabase.from("players").update({ losses: newLosses, recent_results: newResults, wr: newWr }).eq("id", p.id);
    }
  }, [players]);

  return (
    <Context.Provider value={{ players, teams, loading, addPlayer, updatePlayer, deletePlayer, updateTeam, assignPlayerToTeam, removePlayerFromTeam, resetAuction, recordMatch }}>
      {children}
    </Context.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useStore must be inside PlayersProvider");
  return ctx;
}

export function dbToPlayer(d: Record<string, unknown>): Player {
  return {
    id: d.id as number,
    name: d.name as string,
    riot: (d.riot as string) ?? "",
    line: (d.line as Player["line"]) ?? "MID",
    sub: (d.sub as Player["line"]) ?? "TOP",
    tier: (d.tier as string) ?? "E4",
    wr: (d.wr as number) ?? 50,
    grade: (d.grade as Player["grade"]) ?? "NORMAL",
    active: (d.active as boolean) ?? true,
    lanes: (d.lanes as Player["lanes"]) ?? Object.fromEntries(LANES.map(l => [l, { tier: "E4", wr: 50, lp: 0 }])),
    teamId: (d.team_id as number) ?? undefined,
    auctionPrice: (d.auction_price as number) ?? undefined,
    intro: (d.intro as string) ?? "",
    tags: (d.tags as string) ?? "",
    position_status: (d.position_status as string) ?? "캐리형",
    memo: (d.memo as string) ?? "",
    champions: (d.champions as Player["champions"]) ?? [],
    recent_results: (d.recent_results as string[]) ?? [],
    wins: (d.wins as number) ?? 0,
    losses: (d.losses as number) ?? 0,
    team_wins: (d.team_wins as number) ?? 0,
    team_losses: (d.team_losses as number) ?? 0,
    lp: (d.lp as Record<Player["line"], number>) ?? { TOP:0, JUG:0, MID:0, ADC:0, SUP:0 },
  };
}

function playerToDb(p: Partial<Player>, partial = false): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (!partial || p.name !== undefined) db.name = p.name;
  if (!partial || p.riot !== undefined) db.riot = p.riot;
  if (!partial || p.line !== undefined) db.line = p.line;
  if (!partial || p.sub !== undefined) db.sub = p.sub;
  if (!partial || p.tier !== undefined) db.tier = p.tier;
  if (!partial || p.wr !== undefined) db.wr = p.wr;
  if (!partial || p.grade !== undefined) db.grade = p.grade;
  if (!partial || p.active !== undefined) db.active = p.active;
  if (!partial || p.lanes !== undefined) db.lanes = p.lanes;
  if (p.teamId !== undefined) db.team_id = p.teamId ?? null;
  if (p.auctionPrice !== undefined) db.auction_price = p.auctionPrice ?? null;
  if (p.intro !== undefined) db.intro = p.intro;
  if (p.tags !== undefined) db.tags = p.tags;
  if (p.position_status !== undefined) db.position_status = p.position_status;
  if (p.memo !== undefined) db.memo = p.memo;
  if (p.champions !== undefined) db.champions = p.champions;
  if (p.recent_results !== undefined) db.recent_results = p.recent_results;
  if (p.wins !== undefined) db.wins = p.wins;
  if (p.losses !== undefined) db.losses = p.losses;
  if (p.team_wins !== undefined) db.team_wins = p.team_wins;
  if (p.team_losses !== undefined) db.team_losses = p.team_losses;
  if (p.lp !== undefined) db.lp = p.lp;
  return db;
}

function dbToTeam(d: Record<string, unknown>): Team {
  return {
    id: d.id as number,
    name: d.name as string,
    color: (d.color as string) ?? "#7C3AED",
    captainId: (d.captain_id as number) ?? 0,
    points: (d.points as number) ?? 1000,
    players: [],
  };
}
