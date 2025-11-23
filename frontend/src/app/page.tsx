"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Gift,
  Loader2,
  Scan,
  Ticket as TicketIcon,
} from "lucide-react";
import Quagga, {
  type QuaggaJSConfig,
  type QuaggaJSResultObject,
} from "quagga";
import { useLiff } from "@/hooks/useLiff";
import { useTickets } from "@/hooks/useTickets";
import { useRewards } from "@/hooks/useRewards";
import type { Reward, TicketGroup } from "@/types";
import { submitTicket } from "@/lib/apiClient";

type TabKey = "scan" | "tickets" | "rewards";

const tabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "scan", label: "Scan", icon: Scan },
  { key: "tickets", label: "My Lottaries", icon: TicketIcon },
  { key: "rewards", label: "Rewards", icon: Gift },
];

type ScanPayload = {
  raw: string;
  numbers: string;
  serial: string;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>("scan");
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanPayload | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

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
          {isLoggedIn ? (
            <div className="flex flex-col items-end text-right">
              <p className="text-sm text-forest/70">account:</p>
              <p className="text-base font-semibold">
                {profile?.displayName ?? "Demo User"}
              </p>
            </div>
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

      <main className="flex-1 space-y-4 pb-24">
        {activeTab === "scan" && (
          <ScanSection
            isScanning={isScanning}
            onScan={handleScanStart}
            onStop={handleScanStop}
            isApiReady={Boolean(idToken)}
            error={scanError}
            onDetected={handleScannerDetected}
            onScannerError={setScanError}
          />
        )}
        {activeTab === "tickets" && (
          <TicketsSection groups={groups} loading={ticketsLoading} />
        )}
        {activeTab === "rewards" && (
          <RewardsSection
            rewards={rewards}
            loading={rewardsLoading}
            copyingId={copyingId}
            onCopy={handleCopy}
          />
        )}
      </main>

      <TabBar active={activeTab} onChange={setActiveTab} />

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
    </div>
  );
}

function ScanSection({
  isScanning,
  onScan,
  onStop,
  isApiReady,
  error,
  onDetected,
  onScannerError,
}: {
  isScanning: boolean;
  onScan: () => void;
  onStop: () => void;
  isApiReady: boolean;
  error: string | null;
  onDetected: (payload: string) => void;
  onScannerError: (message: string | null) => void;
}) {
  return (
    <section className="glass-card space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-forest/70">Scan Lottery Ticket</p>
          <h2 className="text-xl font-semibold">Align the QR to capture</h2>
          {!isApiReady && (
            <p className="text-xs text-forest/60">
              Login with LINE to sync tickets to the cloud.
            </p>
          )}
        </div>
        <div className="rounded-full bg-mint p-3 text-shamrock">
          <Scan className="h-6 w-6" />
        </div>
      </div>
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-3xl border border-dashed border-shamrock/40 bg-mist">
        {isScanning ? (
          <ScannerViewport
            active={isScanning}
            onDetected={onDetected}
            onError={onScannerError}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-forest/80">
            <Camera className="h-12 w-12" />
            <p className="text-sm font-medium">
              Align QR code in the frame to scan
            </p>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <button
          type="button"
          onClick={isScanning ? onStop : onScan}
          className={clsx(
            "flex w-full items-center justify-center gap-2 rounded-full border border-shamrock px-6 py-3 text-base font-semibold text-forest shadow-card transition",
            isScanning ? "bg-white hover:bg-clay" : "bg-mint hover:bg-mint/80"
          )}
        >
          {isScanning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Stop scanning
            </>
          ) : (
            <>
              <Scan className="h-5 w-5" />
              Scan Now
            </>
          )}
        </button>
        {error && (
          <p className="text-xs text-red-500">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function TicketsSection({
  groups,
  loading,
}: {
  groups: TicketGroup[];
  loading: boolean;
}) {
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

  return (
    <section className="space-y-4">
      {groups.map((group) => (
        <article
          key={group.drawDate}
          className="rounded-4xl bg-white p-5 shadow-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-forest/70">Draw date</p>
              <h3 className="text-lg font-semibold">{group.drawDate}</h3>
            </div>
            <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-shamrock">
              {group.tickets.length} tickets
            </span>
          </div>
          {group.headline && (
            <div className="mt-3 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-shamrock">
              {group.headline} All your tickets this draw were non-winners.
            </div>
          )}
          <div className="mt-4 space-y-3">
            {group.tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between rounded-3xl border border-forest/10 px-4 py-3"
              >
                <div>
                  <p className="text-base font-semibold">{ticket.numbers}</p>
                  <p className="text-xs uppercase tracking-[0.3em] text-forest/60">
                    Serial {ticket.serial}
                  </p>
                </div>
                <StatusBadge status={ticket.status} />
              </div>
            ))}
          </div>
        </article>
      ))}
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
          className="rounded-4xl border border-forest/10 bg-white p-5 shadow-card"
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

function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
}) {
  return (
    <nav className="fixed bottom-5 left-1/2 z-20 flex w-[92vw] max-w-md -translate-x-1/2 items-center justify-between rounded-full border border-white/60 bg-white/90 px-4 py-3 shadow-card backdrop-blur">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={clsx(
            "flex flex-1 flex-col items-center gap-1 text-xs font-semibold transition",
            active === key ? "text-shamrock" : "text-forest/50"
          )}
        >
          <Icon className="h-5 w-5" />
          {label}
        </button>
      ))}
    </nav>
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

function ScannerViewport({
  active,
  onDetected,
  onError,
}: {
  active: boolean;
  onDetected: (payload: string) => void;
  onError?: (message: string | null) => void;
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

  return <div ref={containerRef} className="h-full w-full bg-black" />;
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
