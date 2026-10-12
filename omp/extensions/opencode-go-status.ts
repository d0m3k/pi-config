/**
 * opencode-go-status — put the OpenCode Go plan windows on their own row under
 * omp's status line.
 *
 * Why a separate row: omp's status line is a single row, and when the terminal
 * is narrower than the segment list it drops the *last* segment (skipping
 * `path`) until the line fits. The built-in `usage` segment is ~52 columns —
 * the widest thing on the bar — so on a phone-width terminal it is the first to
 * disappear. Hook status text set with `ctx.ui.setStatus(key, text)` is rendered
 * as its own row below the bar (@oh-my-pi/pi-tui status-line `render()`), where
 * width only truncates, never drops.
 *
 * Data source: the in-process usage API the built-in segment uses
 * (`authStorage.usage.reports()`, cached by AuthStorage with omp's own TTL and
 * refreshed in the background), so there is no second fetch implementation, no
 * `omp usage` subprocess, and no cookie scraping.
 *
 * Layout: `⏱ Go · 5h 0% (4h 40m) · 7d 0% (6d 4h) · mo 2% (21d 18h)` — window
 * label, used percent, reset countdown, formatted exactly like the built-in
 * segment (round for the 5h/1d/7d windows, floor for monthly).
 *
 * Remove this file (or delete the status with `ctx.ui.setStatus(KEY, undefined)`
 * from another extension) to drop the row; nothing else depends on it.
 */

const PROVIDER = "opencode-go";
const STATUS_KEY = "opencode-go-usage";
const REFRESH_MS = 60_000;
const TIER_LABEL = "Go";

/* eslint-disable @typescript-eslint/no-explicit-any -- host usage shapes are structural here */
type AnyUsage = Record<string, any>;

/** Resolve used percent the way omp resolves a limit's used fraction. */
function usedPercent(limit: AnyUsage): number | undefined {
	const amount = limit?.amount;
	if (!amount || typeof amount !== "object") return undefined;
	let fraction: number | undefined;
	if (typeof amount.usedFraction === "number") fraction = amount.usedFraction;
	else if (typeof amount.used === "number" && typeof amount.limit === "number" && amount.limit > 0)
		fraction = amount.used / amount.limit;
	else if (amount.unit === "percent" && typeof amount.used === "number") fraction = amount.used / 100;
	else if (typeof amount.remainingFraction === "number") fraction = 1 - amount.remainingFraction;
	if (fraction === undefined || !Number.isFinite(fraction)) return undefined;
	return Math.max(0, fraction * 100);
}

/** Compact countdown: `55m`, `4h 40m`, `6d 4h` (matches the built-in segment). */
function countdown(value: number, unit: "m" | "h"): string {
	if (unit === "m") {
		if (value < 60) return `${value}m`;
		const hours = Math.floor(value / 60);
		const minutes = value % 60;
		return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
	}
	if (value < 24) return `${value}h`;
	const days = Math.floor(value / 24);
	const hours = value % 24;
	return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

function windowId(limit: AnyUsage): string | undefined {
	const id = limit?.scope?.windowId ?? limit?.window?.id;
	return typeof id === "string" ? id : undefined;
}

const WINDOWS: ReadonlyArray<{ label: string; matches: (id: string) => boolean; unit: "m" | "h"; floor?: boolean }> = [
	{ label: "5h", matches: id => id === "5h", unit: "m" },
	{ label: "1d", matches: id => id === "1d" || id === "daily" || id === "24h", unit: "m" },
	{ label: "7d", matches: id => id === "7d", unit: "h" },
	{ label: "mo", matches: id => id === "monthly" || id === "30d", unit: "h", floor: true },
];

/** `⏱ Go · 5h 0% (4h 40m) · …`, or null when the report carries no windows. */
export function formatUsageRow(report: AnyUsage, now: number = Date.now()): string | null {
	const limits: AnyUsage[] = Array.isArray(report?.limits) ? report.limits : [];
	const parts: string[] = [];
	for (const window of WINDOWS) {
		const limit = limits.find(candidate => {
			const id = windowId(candidate);
			return id !== undefined && window.matches(id);
		});
		if (!limit) continue;
		const percent = usedPercent(limit);
		if (percent === undefined) continue;
		const shown = window.floor ? Math.floor(percent) : Math.round(percent);
		const resetsAt = limit?.window?.resetsAt;
		let part = `${window.label} ${shown}%`;
		if (typeof resetsAt === "number" && Number.isFinite(resetsAt)) {
			const remainingMs = Math.max(0, resetsAt - now);
			part += ` (${countdown(Math.round(remainingMs / (window.unit === "m" ? 60_000 : 3_600_000)), window.unit)})`;
		}
		parts.push(part);
	}
	if (parts.length === 0) return null;
	return `⏱ ${TIER_LABEL} · ${parts.join(" · ")}`;
}

async function refresh(ctx: AnyUsage): Promise<void> {
	try {
		const usage = ctx?.modelRegistry?.authStorage?.usage;
		const reports = typeof usage?.reports === "function" ? await usage.reports() : null;
		const report = Array.isArray(reports)
			? reports.find((candidate: AnyUsage) => candidate?.provider === PROVIDER)
			: undefined;
		const row = report ? formatUsageRow(report) : null;
		ctx.ui.setStatus(STATUS_KEY, row ?? undefined);
	} catch {
		// Unauthenticated, offline, or a host without the usage API: show nothing
		// rather than a stale row.
		ctx.ui.setStatus(STATUS_KEY, undefined);
	}
}

export default function opencodeGoStatus(pi: AnyUsage): void {
	pi.on("session_start", (_event: unknown, ctx: AnyUsage) => {
		// Runners without a UI (print, headless RPC) have a no-op setStatus, so
		// skip the timer there. Several sessions may write the same key; the
		// status line keeps one entry per key, so the writes are idempotent.
		if (!ctx?.hasUI) return;
		const tick = () => {
			void refresh(ctx);
		};
		// The underlying report is cached by AuthStorage (omp's own TTL), so a
		// minute tick is a cache read with an occasional live refresh, and it also
		// keeps the reset countdowns moving.
		ctx.setInterval(tick, REFRESH_MS);
		tick();
	});
}
