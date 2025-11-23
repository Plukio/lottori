export type TicketStatus = "pending" | "won" | "lost" | "rewarded" | "invalid";

export interface Ticket {
  id: string;
  userId: string;
  drawDate: string; // ISO date string
  numbers: string;
  serial: string;
  status: TicketStatus;
  rewardId?: string;
}

export type RewardStatus =
  | "unused"
  | "reserved"
  | "assigned"
  | "redeemed"
  | "expired";

export interface Reward {
  id: string;
  userId: string;
  provider: "Grab" | "Shopee" | "TrueMoney" | "InApp";
  valueAmount: number;
  currency: "THB" | "COIN";
  status: RewardStatus;
  code?: string;
  expiresOn: string;
  ticketId?: string;
}

export interface TicketGroup {
  drawDate: string;
  tickets: Ticket[];
  headline?: string;
}

