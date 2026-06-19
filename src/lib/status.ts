export const STATUSES = [
  "WISHLIST",
  "APPLIED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
] as const;

export type Status = (typeof STATUSES)[number];

export const STATUS_META: Record<
  Status,
  { label: string; accent: string; dot: string }
> = {
  WISHLIST: { label: "Wishlist", accent: "border-slate-300", dot: "bg-slate-400" },
  APPLIED: { label: "Applied", accent: "border-blue-300", dot: "bg-blue-500" },
  INTERVIEW: { label: "Interview", accent: "border-amber-300", dot: "bg-amber-500" },
  OFFER: { label: "Offer", accent: "border-emerald-300", dot: "bg-emerald-500" },
  REJECTED: { label: "Rejected", accent: "border-rose-300", dot: "bg-rose-500" },
};

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

/** Human label for a status string, falling back to the raw value if unknown. */
export function statusLabel(value: string): string {
  return isStatus(value) ? STATUS_META[value].label : value;
}
