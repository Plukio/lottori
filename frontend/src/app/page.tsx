"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Loader2, Ticket as TicketIcon, Gift } from "lucide-react";
import Quagga, {
  type QuaggaJSConfig,
  type QuaggaJSResultObject,
} from "quagga";
import { useLiff } from "@/hooks/useLiff";
import { useTickets } from "@/hooks/useTickets";
import { useRewards } from "@/hooks/useRewards";
import type { Reward, TicketGroup } from "@/types";
import { submitTicket } from "@/lib/apiClient";

type ScanPayload = {
  raw: string;
  numbers: string;
  serial: string;
};

export default function Home() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanPayload | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"tickets" | "rewards">(
    "tickets"
  );

  const { isReady, isLoggedIn, profile, idToken, login, error } = useLiff();
  const userId = profile?.userId ?? "demo-user";

  const { groups, isLoading: ticketsLoading } = useTickets(userId);
  const { rewards, isLoading: rewardsLoading } = useRewards(userId);

  const nextDrawLabel = useMemo(() => {
    const next = groups.at(0)?.drawDate ?? "16 January 2024";
    return next;
  }, [groups]);

  const handleScanStart = async () => {
    if (!idToken) {
      setApiError("Please login with LINE first.");
      return;
    }
    setScanError(null);

    const w = window as typeof window & {
      liff?: { scanCodeV2?: () => Promise<{ value?: string }> };
    };
    if (typeof window !== "undefined" && typeof w.liff?.scanCodeV2 === "function") {
      try {
        const result = await w.liff.scanCodeV2!();
        if (result?.value) {
          handleScannerDetected(result.value);
        } else {
          setScanError("No data detected. Please try again.");
        }
      } catch (err) {
        console.error(err);
        setScanError("Unable to access scanner.");
      }
      return;
    }

    setIsScanning(true);
  };

  const handleScanStop = () => {
    setIsScanning(false);
  };

  const handleScannerDetected = (rawText: string) => {
    setIsScanning(false);
    const parsed = parseTicketData(rawText);
    setScanResult(parsed);
  };

  const handleConfirmTicket = () => {
    if (!scanResult || !idToken) return;
    submitTicket(
      {
        drawDate: new Date().toISOString().slice(0, 10),
        numbers: scanResult.numbers,
        serial: scanResult.serial,
        meta: { raw: scanResult.raw },
      },
      idToken
    )
      .then(() => {
        setToast("Ticket synced to cloud");
        setScanResult(null);
        setTimeout(() => setToast(null), 2000);
      })
      .catch((submitError) => {
        console.error(submitError);
        setApiError("Could not sync ticket. Please try again.");
      });
  };

  const handleCopy = async (reward: Reward) => {
    if (!reward.code) return;
    try {
      setCopyingId(reward.id);
      await navigator.clipboard.writeText(reward.code);
      setToast("Copied to clipboard");
      setTimeout(() => setToast(null), 2000);
    } catch (copyError) {
      console.error(copyError);
      setToast("Unable to copy in this browser");
      setTimeout(() => setToast(null), 2200);
    } finally {
      setCopyingId(null);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-6 sm:py-10">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-forest/70 font-thai">
              รางวัลปรอบใจ คนไม่ถูกหวย
            </p>
            <h1 className="text-2xl font-semibold">Lottori</h1>
          </div>
          <div className="flex flex-col items-end">
            {isLoggedIn ? (
              <>
                <p className="text-sm text-forest/70">account:</p>
                <p className="text-base font-semibold">
                  {profile?.displayName ?? "Demo User"}
                </p>
              </>
            ) : (
              <button
                type="button"
                onClick={login}
                className="rounded-full bg-mint px-4 py-2 text-sm font-semibold text-forest shadow-card transition hover:bg-mint/80"
              >
                Login with LINE
              </button>
            )}
          </div>
        </div>
        <div className="rounded-4xl border border-forest/10 bg-white px-6 py-4 text-forest shadow-card">
          <p className="text-sm uppercase tracking-[0.3em] text-forest/70">
            Next draw
          </p>
          <p className="text-2xl font-semibold">{nextDrawLabel}</p>
          <p className="text-sm text-forest/70">
            Scan before midnight to lock rewards.
          </p>
        </div>
      </header>

      {scanError && activeView === "tickets" && (
        <div className="rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm text-red-600 shadow-card">
          {scanError}
        </div>
      )}

      <main className="space-y-4 pb-16">
        {activeView === "tickets" ? (
          <TicketsSection
            groups={groups}
            loading={ticketsLoading}
            onScan={handleScanStart}
          />
        ) : (
          <RewardsSection
            rewards={rewards}
            loading={rewardsLoading}
            copyingId={copyingId}
            onCopy={handleCopy}
          />
        )}
      </main>

      {!isReady && <FullScreenLoader message="Logging you in..." />}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-30 w-[90vw] max-w-xs -translate-x-1/2 rounded-full bg-white px-4 py-2 text-center text-sm font-medium text-forest shadow-card">
          {toast}
        </div>
      )}
      {(error || apiError) && (
        <div className="fixed top-4 left-1/2 z-30 w-[90vw] max-w-md -translate-x-1/2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm text-red-600 shadow-card">
          {error ?? apiError}
        </div>
      )}
      {scanResult && (
        <ScanResultModal
          data={scanResult}
          onConfirm={handleConfirmTicket}
          onDismiss={() => setScanResult(null)}
        />
      )}
      {isScanning && (
        <ScannerViewport
          active={isScanning}
          onDetected={handleScannerDetected}
          onError={setScanError}
          onStop={handleScanStop}
        />
      )}
      <FloatingNav active={activeView} onChange={setActiveView} />
    </div>
  );
}

function TicketsSection({
  groups,
  loading,
  onScan,
}: {
  groups: TicketGroup[];
  loading: boolean;
  onScan: () => void;
}) {
  const [activeDraw, setActiveDraw] = useState<string | null>(null);
  const safeActiveDraw = useMemo(() => {
    if (!groups.length) return null;
    if (activeDraw && groups.some((group) => group.drawDate === activeDraw)) {
      return activeDraw;
    }
    return groups[0].drawDate;
  }, [groups, activeDraw]);

  if (loading) {
    return (
      <section className="space-y-3">
        {[1, 2].map((idx) => (
          <div key={idx} className="rounded-3xl bg-white p-5 shadow-card">
            <div className="h-4 w-32 rounded-full bg-clay" />
            <div className="mt-4 space-y-3">
              <div className="h-12 rounded-2xl bg-clay" />
              <div className="h-12 rounded-2xl bg-clay" />
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (!groups.length) {
    return (
      <section className="rounded-4xl bg-white p-6 text-center shadow-card">
        <p className="text-lg font-semibold">ยังไม่มีลอตเตอรี่ในระบบ</p>
        <p className="text-sm text-forest/60">
          สแกนตั๋วใบแรกของคุณเพื่อดูผลและรับรางวัลปลอบใจ
        </p>
        <button
          type="button"
          onClick={onScan}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-shamrock px-5 py-2 text-sm font-semibold text-white hover:bg-shamrockDark"
        >
          สแกนลอตเตอรี่
        </button>
      </section>
    );
  }

  const activeGroup =
    groups.find((group) => group.drawDate === safeActiveDraw) ?? groups[0];

  return (
    <section className="space-y-4 rounded-4xl bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My Tickets</h2>
        <button
          type="button"
          onClick={onScan}
          className="rounded-full border border-forest/15 px-4 py-2 text-sm font-semibold text-forest hover:border-forest/30"
        >
          สแกนเพิ่ม
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto rounded-full bg-white/60 px-2 py-1 no-scrollbar">
        {groups.map((group) => (
          <button
            key={group.drawDate}
            type="button"
            onClick={() => setActiveDraw(group.drawDate)}
            className={clsx(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition shadow-sm",
              group.drawDate === safeActiveDraw
                ? "bg-white text-forest shadow-card"
                : "text-forest/70"
            )}
          >
            {formatDrawTabLabel(group.drawDate)}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-forest/70">Draw date</p>
            <h3 className="text-lg font-semibold">
              {formatDrawDate(activeGroup.drawDate)}
            </h3>
          </div>
          <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-shamrock">
            {activeGroup.tickets.length} tickets
          </span>
        </div>
        {activeGroup.headline && (
          <div className="rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-shamrock">
            {activeGroup.headline} All your tickets this draw were non-winners.
          </div>
        )}
        {activeGroup.tickets.map((ticket) => (
          <div
            key={ticket.id}
            className="flex items-center justify-between rounded-3xl border border-forest/10 px-4 py-3"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-forest/60">
                Ticket number
              </p>
              <p className="text-base font-semibold">{ticket.numbers}</p>
              <p className="text-xs uppercase tracking-[0.3em] text-forest/60">
                Serial {ticket.serial}
              </p>
            </div>
            <StatusBadge status={ticket.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

function RewardsSection({
  rewards,
  loading,
  copyingId,
  onCopy,
}: {
  rewards: Reward[];
  loading: boolean;
  copyingId: string | null;
  onCopy: (reward: Reward) => void;
}) {
  if (loading) {
    return (
      <section className="space-y-3">
        {[1, 2].map((idx) => (
          <div key={idx} className="rounded-4xl bg-white p-5 shadow-card">
            <div className="h-4 w-48 rounded-full bg-clay" />
            <div className="mt-3 h-8 w-32 rounded-full bg-clay" />
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {rewards.map((reward) => (
        <article
          key={reward.id}
          className="rounded-3xl border border-forest/10 bg-white px-4 py-4 shadow-card/50"
        >
          <p className="text-sm text-forest/60">{reward.provider}</p>
          <h3 className="text-2xl font-semibold">
            {reward.provider === "InApp"
              ? `${reward.valueAmount} Coins`
              : `${reward.valueAmount} ${reward.currency === "THB" ? "Baht" : reward.currency}`}
          </h3>
          <p className="text-xs text-forest/60">
            Expires on {reward.expiresOn}
          </p>
          <button
            type="button"
            onClick={() => onCopy(reward)}
            disabled={!reward.code || copyingId === reward.id}
            className={clsx(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold",
              reward.code
                ? "border-shamrock text-shamrock hover:bg-mint"
                : "border-clay text-clay cursor-not-allowed"
            )}
          >
            {copyingId === reward.id ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Copying…
              </>
            ) : (
              <>
                Copy Code
                {reward.code && (
                  <span className="rounded-full bg-mint px-2 py-0.5 text-xs text-shamrock">
                    {reward.code}
                  </span>
                )}
              </>
            )}
          </button>
        </article>
      ))}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labelMap: Record<string, string> = {
    pending: "Pending",
    won: "Winner",
    lost: "Lost",
    rewarded: "Rewarded",
    invalid: "Invalid",
  };
  const colorMap: Record<string, string> = {
    pending: "bg-clay text-forest",
    won: "bg-mint text-forest",
    lost: "bg-clay text-forest",
    rewarded: "bg-mint text-forest",
    invalid: "bg-rose-100 text-rose-600",
  };
  return (
    <span
      className={clsx(
        "rounded-full px-3 py-1 text-xs font-semibold",
        colorMap[status] ?? "bg-clay text-forest"
      )}
    >
      {labelMap[status] ?? status}
    </span>
  );
}

function FullScreenLoader({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-white/90 backdrop-blur">
      <div className="rounded-full bg-mint p-5 text-shamrock shadow-card">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
      <p className="text-base font-semibold">{message}</p>
      <div className="w-40 loading-bar" />
    </div>
  );
}

function FloatingNav({
  active,
  onChange,
}: {
  active: "tickets" | "rewards";
  onChange: (view: "tickets" | "rewards") => void;
}) {
  return (
    <nav className="fixed bottom-5 left-1/2 z-30 flex w-[90vw] max-w-md -translate-x-1/2 items-center gap-2 rounded-full border border-white/50 bg-white/80 px-4 py-2 text-forest shadow-card backdrop-blur">
      <button
        type="button"
        onClick={() => onChange("tickets")}
        className={clsx(
          "flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition",
          active === "tickets"
            ? "bg-shamrock text-white shadow-md"
            : "text-forest/70 hover:bg-white/60"
        )}
      >
        <TicketIcon
          className={clsx(
            "h-5 w-5",
            active === "tickets" ? "text-white" : "text-forest/60"
          )}
        />
        <span className={clsx(active === "tickets" ? "font-semibold" : "")}>
          My Tickets
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange("rewards")}
        className={clsx(
          "flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition",
          active === "rewards"
            ? "bg-shamrock text-white shadow-md"
            : "text-forest/70 hover:bg-white/60"
        )}
      >
        <Gift
          className={clsx(
            "h-5 w-5",
            active === "rewards" ? "text-white" : "text-forest/60"
          )}
        />
        <span className={clsx(active === "rewards" ? "font-semibold" : "")}>
          Rewards
        </span>
      </button>
    </nav>
  );
}

function ScannerViewport({
  active,
  onDetected,
  onError,
  onStop,
}: {
  active: boolean;
  onDetected: (payload: string) => void;
  onError?: (message: string | null) => void;
  onStop: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !containerRef.current) {
      Quagga.stop();
      return;
    }

    const config: QuaggaJSConfig = {
      inputStream: {
        type: "LiveStream",
        target: containerRef.current,
        constraints: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      decoder: {
        readers: [
          "code_128_reader",
          "code_39_reader",
          "ean_reader",
          "ean_8_reader",
          "qr_reader",
        ],
      },
      locate: true,
    };

    let cancelled = false;

    Quagga.init(config, (err) => {
      if (err) {
        console.error(err);
        onError?.("Camera unavailable. Please allow camera access.");
        return;
      }
      if (!cancelled) {
        Quagga.start();
      }
    });

    const handleDetect = (result: QuaggaJSResultObject) => {
      const code = result.codeResult?.code;
      if (code) {
        onDetected(code);
        Quagga.stop();
      }
    };

    Quagga.onDetected(handleDetect);

    return () => {
      cancelled = true;
      Quagga.offDetected(handleDetect);
      Quagga.stop();
    };
  }, [active, onDetected, onError]);

  if (!active) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/80 px-4 py-6">
      <div
        ref={containerRef}
        className="aspect-[3/4] w-full max-w-md overflow-hidden rounded-3xl bg-black"
      />
      <button
        type="button"
        onClick={onStop}
        className="w-full max-w-md rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
      >
        Cancel
      </button>
    </div>
  );
}

function ScanResultModal({
  data,
  onConfirm,
  onDismiss,
}: {
  data: ScanPayload;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-card">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.3em] text-forest/60">
            Scan preview
          </p>
          <h3 className="text-2xl font-semibold font-thai">ตรวจผลสแกน</h3>
        </div>
        <div className="rounded-2xl border border-forest/10 bg-mint/30 px-4 py-3">
          <p className="text-xs text-forest/60">Raw payload</p>
          <p className="break-all text-sm font-mono">{data.raw}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="rounded-2xl border border-forest/10 bg-white px-3 py-2">
            <p className="text-xs text-forest/60">Ticket numbers</p>
            <p className="text-lg font-semibold">{data.numbers}</p>
          </div>
          <div className="rounded-2xl border border-forest/10 bg-white px-3 py-2">
            <p className="text-xs text-forest/60">Serial</p>
            <p className="text-lg font-semibold">{data.serial}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 rounded-full border border-forest/20 px-4 py-2 text-sm font-semibold text-forest hover:bg-clay"
          >
            Scan again
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-full bg-shamrock px-4 py-2 text-sm font-semibold text-white hover:bg-shamrockDark"
          >
            Save ticket
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDrawDate(drawDate: string) {
  const date = new Date(drawDate);
  if (!Number.isNaN(date.valueOf())) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
    }).format(date);
  }
  return drawDate;
}

function formatDrawTabLabel(drawDate: string) {
  const date = new Date(drawDate);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
    }).format(date);
  }
  return drawDate;
}

function parseTicketData(rawText: string): ScanPayload {
  const digitsOnly = rawText.replace(/\D+/g, "");
  const numbers =
    digitsOnly.length >= 6
      ? digitsOnly.slice(-6)
      : rawText.replace(/\s+/g, "").slice(0, 6) || "------";
  const serial =
    digitsOnly.length >= 10 ? digitsOnly : `SCAN-${digitsOnly || Date.now()}`;

  return {
    raw: rawText,
    numbers,
    serial,
  };
}
