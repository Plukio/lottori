"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { ensureFirebase, firebaseReady } from "@/lib/firebaseClient";
import type { Ticket, TicketGroup } from "@/types";

const FALLBACK_TICKETS: Ticket[] = [
  {
    id: "demo-1",
    userId: "demo-user",
    drawDate: "2024-01-16",
    numbers: "123 456",
    serial: "A1-000345",
    status: "lost",
  },
  {
    id: "demo-2",
    userId: "demo-user",
    drawDate: "2024-01-16",
    numbers: "789 012",
    serial: "A1-000346",
    status: "lost",
    rewardId: "reward-1",
  },
  {
    id: "demo-3",
    userId: "demo-user",
    drawDate: "2024-01-01",
    numbers: "555 888",
    serial: "A1-000127",
    status: "pending",
  },
];

function toTicket(doc: QueryDocumentSnapshot): Ticket {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId,
    drawDate: (data.drawDate instanceof Timestamp
      ? data.drawDate.toDate().toISOString().slice(0, 10)
      : data.drawDate) as string,
    numbers: data.numbers,
    serial: data.serial,
    status: data.status,
    rewardId: data.rewardId,
  };
}

const groupTickets = (tickets: Ticket[]): TicketGroup[] => {
  const map = tickets.reduce<Record<string, Ticket[]>>((acc, ticket) => {
    acc[ticket.drawDate] = acc[ticket.drawDate] || [];
    acc[ticket.drawDate].push(ticket);
    return acc;
  }, {});

  return Object.entries(map)
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([drawDate, dayTickets]) => ({
      drawDate,
      tickets: dayTickets,
      headline:
        dayTickets.every((ticket) => ticket.status === "lost")
          ? "Congratulations! You've earned a reward."
          : undefined,
    }));
};

export function useTickets(userId?: string) {
  const liveMode = Boolean(userId && firebaseReady);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!liveMode) return;
    const { db } = ensureFirebase();
    if (!db) return;

    // Firestore subscription is async; force skeleton until first snapshot resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const q = query(
      collection(db, "tickets"),
      where("userId", "==", userId),
      orderBy("drawDate", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(toTicket);
        setTickets(docs);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [liveMode, userId]);

  const data = liveMode ? tickets : FALLBACK_TICKETS;
  const grouped = useMemo(() => groupTickets(data), [data]);

  return {
    tickets: data,
    groups: grouped,
    isLoading: liveMode && loading,
  };
}

