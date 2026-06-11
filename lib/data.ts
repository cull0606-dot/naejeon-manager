export type Grade = "ACE" | "VALUE" | "NORMAL";
export type Lane = "TOP" | "JUG" | "MID" | "ADC" | "SUP";
export type Status = "active" | "inactive";

export interface LaneStat { tier: string; wr: number; }
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
}

export interface Team {
  id: number;
  name: string;
  color: string;
  captainId: number;
  points: number;
  players: number[];
}

export interface AuctionState {
  active: boolean;
  currentPlayerId: number | null;
  currentPrice: number;
  timeLeft: number;
  biddingTeamId: number | null;
  round: number;
  log: { teamId: number; price: number; time: string }[];
}

export const TIER_ORDER = ["C1","C2","C3","D1","D2","D3","D4","E1","E2","E3","E4","P1","P2","P3","P4","G1","G2","G3","G4","S1","S2","S3","S4"];
export const LANES: Lane[] = ["TOP","JUG","MID","ADC","SUP"];

export const INITIAL_PLAYERS: Player[] = [
  { id:1, name:"원형", riot:"원형#KR1", line:"MID", sub:"TOP", tier:"D4", wr:58, grade:"ACE", active:true,
    lanes:{TOP:{tier:"E4",wr:52},JUG:{tier:"E4",wr:48},MID:{tier:"D4",wr:63},ADC:{tier:"E4",wr:45},SUP:{tier:"E4",wr:51}} },
  { id:2, name:"전국", riot:"전국#0001", line:"SUP", sub:"MID", tier:"D3", wr:63, grade:"VALUE", active:true,
    lanes:{TOP:{tier:"E3",wr:44},JUG:{tier:"E4",wr:40},MID:{tier:"D4",wr:55},ADC:{tier:"E2",wr:48},SUP:{tier:"D3",wr:63}} },
  { id:3, name:"물새", riot:"물새#KR1", line:"ADC", sub:"MID", tier:"E2", wr:54, grade:"NORMAL", active:true,
    lanes:{TOP:{tier:"E4",wr:42},JUG:{tier:"E4",wr:44},MID:{tier:"E3",wr:50},ADC:{tier:"E2",wr:54},SUP:{tier:"E4",wr:46}} },
  { id:4, name:"경승제로", riot:"경승제로#KR1", line:"JUG", sub:"TOP", tier:"E1", wr:49, grade:"NORMAL", active:false,
    lanes:{TOP:{tier:"E2",wr:47},JUG:{tier:"E1",wr:49},MID:{tier:"E3",wr:43},ADC:{tier:"E4",wr:38},SUP:{tier:"E4",wr:41}} },
  { id:5, name:"롤도사", riot:"롤도사#KR1", line:"TOP", sub:"MID", tier:"D4", wr:56, grade:"VALUE", active:true,
    lanes:{TOP:{tier:"D4",wr:56},JUG:{tier:"E2",wr:44},MID:{tier:"E1",wr:50},ADC:{tier:"E4",wr:39},SUP:{tier:"E4",wr:45}} },
  { id:6, name:"강찬밥", riot:"강찬밥#KR1", line:"TOP", sub:"JUG", tier:"D2", wr:61, grade:"NORMAL", active:true,
    lanes:{TOP:{tier:"D2",wr:61},JUG:{tier:"D4",wr:54},MID:{tier:"E1",wr:47},ADC:{tier:"E3",wr:42},SUP:{tier:"E4",wr:40}} },
  { id:7, name:"기령이", riot:"기령이#0000", line:"MID", sub:"TOP", tier:"P4", wr:58, grade:"NORMAL", active:true,
    lanes:{TOP:{tier:"E1",wr:49},JUG:{tier:"E2",wr:46},MID:{tier:"P4",wr:58},ADC:{tier:"E3",wr:44},SUP:{tier:"E4",wr:41}} },
  { id:8, name:"트할", riot:"트할#KR1", line:"TOP", sub:"MID", tier:"D2", wr:61, grade:"ACE", active:true,
    lanes:{TOP:{tier:"D2",wr:61},JUG:{tier:"E1",wr:48},MID:{tier:"D4",wr:55},ADC:{tier:"E3",wr:43},SUP:{tier:"E4",wr:40}} },
  { id:9, name:"기뉴다", riot:"기뉴다#KR1", line:"ADC", sub:"SUP", tier:"D4", wr:59, grade:"VALUE", active:true,
    lanes:{TOP:{tier:"E3",wr:45},JUG:{tier:"E4",wr:42},MID:{tier:"E2",wr:50},ADC:{tier:"D4",wr:59},SUP:{tier:"E1",wr:48}} },
  { id:10, name:"포팸다말로하자", riot:"포팸#KR1", line:"SUP", sub:"TOP", tier:"E3", wr:53, grade:"NORMAL", active:true,
    lanes:{TOP:{tier:"E4",wr:44},JUG:{tier:"E4",wr:40},MID:{tier:"E4",wr:43},ADC:{tier:"E4",wr:41},SUP:{tier:"E3",wr:53}} },
  { id:11, name:"나는상운", riot:"나는상운#KR1", line:"MID", sub:"ADC", tier:"P3", wr:57, grade:"NORMAL", active:true,
    lanes:{TOP:{tier:"E2",wr:48},JUG:{tier:"E3",wr:45},MID:{tier:"P3",wr:57},ADC:{tier:"E1",wr:50},SUP:{tier:"E4",wr:43}} },
];

export const INITIAL_TEAMS: Team[] = [
  { id:1, name:"A팀", color:"#7C3AED", captainId:1, points:1000, players:[] },
  { id:2, name:"B팀", color:"#0369A1", captainId:2, points:1000, players:[] },
  { id:3, name:"C팀", color:"#DC2626", captainId:3, points:1000, players:[] },
  { id:4, name:"D팀", color:"#D97706", captainId:4, points:1000, players:[] },
];
