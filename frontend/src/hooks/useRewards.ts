"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { ensureFirebase, firebaseReady } from "@/lib/firebaseClient";
import type { Reward } from "@/types";

const FALLBACK_REWARDS: Reward[] = [
  {
    id: "reward-1",
    userId: "demo-user",
    provider: "Grab",
    valueAmount: 100,
    currency: "THB",
    status: "assigned",
    code: "GRAB-1234-5678",
    expiresOn: "2024-12-30",
    ticketId: "demo-1",
  },
  {
    id: "reward-2",
    userId: "demo-user",
    provider: "Shopee",
    valueAmount: 50,
    currency: "THB",
    status: "assigned",
    code: "SHOP-7890",
    expiresOn: "2024-11-20",
    ticketId: "demo-2",
  },
];

const toReward = (doc: QueryDocumentSnapshot): Reward => {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId,
    provider: data.provider,
    valueAmount: data.valueAmount,
    currency: data.currency,
    status: data.status,
    code: data.code,
    expiresOn: (data.expiresOn instanceof Timestamp
      ? data.expiresOn.toDate().toISOString().slice(0, 10)
      : data.expiresOn) as string,
    ticketId: data.ticketId,
  };
};

export function useRewards(userId?: string) {
  const liveMode = Boolean(userId && firebaseReady);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!liveMode) return;
    const { db } = ensureFirebase();
    if (!db) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const q = query(
      collection(db, "rewardAssignments"),
      where("userId", "==", userId),
      orderBy("assignedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setRewards(snapshot.docs.map(toReward));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [liveMode, userId]);

  return {
    rewards: liveMode ? rewards : FALLBACK_REWARDS,
    isLoading: liveMode && loading,
  };
}

