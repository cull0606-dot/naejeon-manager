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
    const db: Record<string, unknown> = {};
    if (p.name !== undefined) db.name = p.name;
    if (p.riot !== undefined) db.riot = p.riot;
    if (p.line !== undefined) db.line = p.line;
    if (p.sub !== undefined) db.sub = p.sub;
    if (p.tier !== undefined) db.tier = p.tier;
    if (p.wr !== undefined) db.wr = p.wr;
    if (p.grade !== undefined) db.grade = p.grade;
    if (p.active !== undefined) db.active = p.active;
    if (p.lanes !== undefined) db.lanes = p.lanes;
    if (p.teamId !== undefined) db.team_id = p.teamId;
    if (p.auctionPrice !== undefined) db.auction_price = p.auctionPrice;
    await supabase.from("players").update(db).eq("id", id);
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

  return (
    <Context.Provider value={{ players, teams, loading, addPlayer, updatePlayer, deletePlayer, updateTeam, assignPlayerToTeam, removePlayerFromTeam, resetAuction }}>
      {children}
    </Context.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useStore must be inside PlayersProvider");
  return ctx;
}

function dbToPlayer(d: Record<string, unknown>): Player {
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
    lanes: (d.lanes as Player["lanes"]) ?? Object.fromEntries(LANES.map(l => [l, { tier: "E4", wr: 50 }])),
    teamId: (d.team_id as number) ?? undefined,
    auctionPrice: (d.auction_price as number) ?? undefined,
  };
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

function playerToDb(p: Player): Record<string, unknown> {
  return {
    name: p.name, riot: p.riot, line: p.line, sub: p.sub,
    tier: p.tier, wr: p.wr, grade: p.grade, active: p.active,
    lanes: p.lanes, team_id: p.teamId ?? null, auction_price: p.auctionPrice ?? null,
  };
}
