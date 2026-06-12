export type Grade = "ACE" | "VALUE" | "NORMAL";
export type Lane = "TOP" | "JUG" | "MID" | "ADC" | "SUP";

export interface LaneStat { tier: string; wr: number; lp?: number; }
export interface Champion { name: string; games: number; wr: number; }
export interface Player {
  id: number;
  name: string;
  riot: string;
  line: Lane;
  sub: Lane;
  tier: string;
  wr: number;
  grade: Grade;
  active: boolean;
  lanes: Record<Lane, LaneStat>;
  teamId?: number;
  auctionPrice?: number;
  // 상세 정보
  intro?: string;
  tags?: string;
  position_status?: string;
  memo?: string;
  champions?: Champion[];
  recent_results?: string[]; // "W" | "L"
  wins?: number;
  losses?: number;
  team_wins?: number;
  team_losses?: number;
  lp?: Record<Lane, number>;
}

export interface Team {
  id: number;
  name: string;
  color: string;
  captainId: number;
  points: number;
  players: number[];
}

export const LANES: Lane[] = ["TOP", "JUG", "MID", "ADC", "SUP"];
export const TIERS = ["C1","C2","C3","D1","D2","D3","D4","E1","E2","E3","E4","P1","P2","P3","P4","G1","G2","G3","G4","S1","S2","S3","S4"];

export const INITIAL_TEAMS: Team[] = [
  { id:1, name:"A팀", color:"#7C3AED", captainId:1, points:1000, players:[] },
  { id:2, name:"B팀", color:"#0369A1", captainId:2, points:1000, players:[] },
  { id:3, name:"C팀", color:"#DC2626", captainId:3, points:1000, players:[] },
  { id:4, name:"D팀", color:"#D97706", captainId:4, points:1000, players:[] },
];
