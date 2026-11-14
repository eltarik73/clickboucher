import { PARIS_TIME_ZONE } from "@/lib/paris-time";

/** Hour and minute of an ISO date in the shop's time zone: the same text on the server and in the browser. */
export function formatParisTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PARIS_TIME_ZONE,
  });
}

const STEPS = [
  { key: "PENDING", label: "Commande reçue" },
  { key: "ACCEPTED", label: "Acceptée" },
  { key: "PREPARING", label: "En préparation" },
  { key: "READY", label: "Prête" },
  { key: "PICKED_UP", label: "Retirée" },
];

function getStepIndex(status: string) {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

/** Status and ISO dates of the order. */
interface TimelineOrder {
  status: string;
  createdAt: string;
  updatedAt: string;
  actualReady: string | null;
  pickedUpAt: string | null;
}

export default function TrackingTimeline({ order }: { order: TimelineOrder }) {
  const stepIdx = getStepIndex(order.status);

  return (
    <div className="rounded-2xl border border-[#ece8e3] bg-white p-5 dark:border-white/10 dark:bg-[#141414]">
      <div className="space-y-0">
        {STEPS.map((step, i) => {
          const isDone = i < stepIdx;
          const isCurrent = i === stepIdx;
          const isFuture = i > stepIdx;
          const time =
            step.key === "PENDING"
              ? formatParisTime(order.createdAt)
              : step.key === "ACCEPTED" && isDone
                ? formatParisTime(order.updatedAt)
                : step.key === "READY" && order.actualReady
                  ? formatParisTime(order.actualReady)
                  : step.key === "PICKED_UP" && order.pickedUpAt
                    ? formatParisTime(order.pickedUpAt)
                    : null;

          return (
            <div key={step.key} className="flex items-start gap-3">
              {/* Dot + line */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${
                    isDone
                      ? "bg-emerald-100 dark:bg-emerald-900/30"
                      : isCurrent
                        ? "animate-pulse bg-blue-100 dark:bg-blue-900/30"
                        : "bg-gray-100 dark:bg-white/5"
                  }`}
                >
                  {isDone ? "✅" : isCurrent ? "🔵" : "○"}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-8 w-0.5 ${
                      isDone ? "bg-emerald-300 dark:bg-emerald-700" : "bg-gray-200 dark:bg-white/10"
                    }`}
                  />
                )}
              </div>

              {/* Label */}
              <div className="pt-1">
                <span
                  className={`text-sm font-semibold ${
                    isFuture
                      ? "text-gray-500 dark:text-gray-400 dark:text-gray-600"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  {step.label}
                </span>
                {time && (
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{time}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
