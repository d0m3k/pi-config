/**
 * Pi Go Bars — pi Extension
 *
 * Shows rolling, weekly, and monthly usage for the Opencode Go plan
 * as a widget below the editor (ctx.ui.setWidget with belowEditor placement)
 * so it coexists with custom footers like pi-statusline.
 *
 * Config: OPENCODE_GO_WORKSPACE_ID + OPENCODE_GO_AUTH_COOKIE env vars,
 * or ~/.pi/agent/pi-go-bars.json
 */

import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import {
  Container,
  Text,
  visibleWidth,
  type Component,
  type Focusable,
} from "@earendil-works/pi-tui";
import {
  clampPercent,
  colorForPercent,
  fetchBillingWithCache,
  fetchWithCache,
  formatDuration,
  formatUsd,
  logError,
  renderBar,
  renderPercent,
  type GoUsageData,
  type ZenBillingData,
  loadConfig,
} from "./core";
import { renderSetupGuide } from "./setup";

// ─── ANSI helpers ────────────────────────────────────────────────────────────

function fgToBgAnsi(fgAnsi: string): string {
  const m256 = fgAnsi.match(/\x1b\[38;5;(\d+)m/);
  if (m256) return `\x1b[48;5;${m256[1]}m`;
  const mTrue = fgAnsi.match(/\x1b\[38;2;(\d+);(\d+);(\d+)m/);
  if (mTrue) return `\x1b[48;2;${mTrue[1]};${mTrue[2]};${mTrue[3]}m`;
  return fgAnsi.replace("[38", "[48");
}

const POLL_INTERVAL_MS = 30 * 1000;

function isGoModel(model: { provider: string } | undefined | null): boolean {
  return model?.provider === "opencode-go";
}

interface UsageState {
  data: GoUsageData | null;
  billing: ZenBillingData | null;
  loading: boolean;
}

export default function (pi: ExtensionAPI) {
  const state: UsageState = { data: null, billing: null, loading: true };

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let pollInFlight: Promise<void> | null = null;
  let pollQueued = false;

  // Whether the Zen /billing scrape is opted in. Resolved once per lifecycle
  // hook from config so runPoll doesn't re-load config every tick. Default
  // false keeps the billing fetch (and its extra network request) entirely
  // off for Go-only installs.
  let zenEnabled = false;

  // ─── Polling ───────────────────────────────────────────────────────────────

  async function runPoll() {
    // Fetch Go usage and Zen billing in parallel. They hit different pages
    // (/go vs /billing) with the same credentials; a failure in one must not
    // block the other, so swallowed errors are recorded inside each result.
    // The Zen fetch is skipped entirely when not opted in (zenEnabled false).
    const [goData, billing] = await Promise.all([
      fetchWithCache(),
      zenEnabled ? fetchBillingWithCache() : Promise.resolve(null),
    ]);
    state.data = goData;
    state.billing = billing;
  }

  async function poll() {
    if (pollInFlight) { pollQueued = true; await pollInFlight; return; }
    do {
      pollQueued = false;
      pollInFlight = runPoll()
        .catch((err) => { logError("poll:runPoll", err); })
        .finally(() => { pollInFlight = null; state.loading = false; });
      await pollInFlight;
    } while (pollQueued);
  }

  // ─── Widget state ─────────────────────────────────────────────────────────

  let widgetActive = false;

  // ─── Pure layout helpers (used by footer bars and detail view) ─────────────

  interface Win {
    label: string;
    pct: number;
    resetSec: number;
  }

  interface Layout {
    showLabels: boolean;
    showResets: boolean;
    barSlots: number;
  }

  function calculateLayout(width: number, wins: Win[], staleWidth: number): Layout {
    const MIN_BAR = 3;
    const MAX_BAR = 20;

    let fixed = "Go".length;
    let showLabels = true;
    let showResets = true;
    for (const w of wins) {
      fixed += 1 + w.label.length + 1;
      if (w.resetSec > 0) fixed += 3 + visibleWidth(formatDuration(w.resetSec));
    }
    fixed += staleWidth;

    let barSlots = wins.length > 0
      ? Math.min(MAX_BAR, Math.floor((width - fixed) / wins.length))
      : 0;

    if (barSlots < 5) {
      showResets = false;
      fixed = "Go".length;
      for (const w of wins) fixed += 1 + w.label.length + 1;
      fixed += staleWidth;
      barSlots = wins.length > 0
        ? Math.min(MAX_BAR, Math.floor((width - fixed) / wins.length))
        : 0;
    }

    if (barSlots < MIN_BAR) {
      showLabels = false;
      fixed = "Go".length;
      fixed += staleWidth;
      barSlots = wins.length > 0
        ? Math.min(MAX_BAR, Math.floor((width - fixed) / wins.length))
        : 0;
    }

    barSlots = Math.max(MIN_BAR, barSlots);
    return { showLabels, showResets, barSlots };
  }

  function renderBarSegment(t: any, w: Win, barSlots: number): string {
    const barCol = "dim";
    const barBg = fgToBgAnsi(t.getFgAnsi(barCol));
    const v = clampPercent(w.pct);
    const label = v + "%";
    const lw = label.length;
    const bw = barSlots;

    if (v === 0) {
      return t.fg(barCol, label) + t.fg("dim", "\u2591".repeat(Math.max(0, bw - lw)));
    }

    const filled = Math.max(1, Math.round((v / 100) * bw));
    const before = Math.max(0, Math.min(filled, Math.floor((filled - lw) / 2)));
    const after = Math.max(0, filled - before - lw);
    const empty = Math.max(0, bw - before - lw - after);
    return (
      t.fg(barCol, "\u2588".repeat(before)) +
      barBg + t.bold(label) + "\x1b[39m\x1b[49m" +
      t.fg(barCol, "\u2588".repeat(after)) +
      t.fg("dim", "\u2591".repeat(empty))
    );
  }

  // ─── Status display (rendered by statusline in extension row) ────────────

  const GOBARS_CACHE_FILE = join(getAgentDir(), "gobars-cache.json");

  function writeGobarsCache(text: string | null, variants?: string[], suffix?: string) {
    try {
      const dir = getAgentDir();
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
      writeFileSync(GOBARS_CACHE_FILE, JSON.stringify({ text, variants, suffix, ts: Date.now() }));
    } catch { /* silent */ }
  }

  // Compact countdown ("4h58m", "3d4h", "22d18h"). The widget/detail view keeps
  // the roomier formatDuration from core.ts; the statusline needs the tight form
  // to stay on a single line on phone-width terminals.
  function compactDuration(sec: number): string {
    if (!Number.isFinite(sec) || sec <= 0) return "now";
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0 && h > 0) return `${d}d${h}h`;
    if (d > 0) return `${d}d`;
    if (h > 0 && m > 0) return `${h}h${m}m`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return "<1m";
  }

  // Same fallback chain pi-tui uses for its own layout.
  function statusWidth(): number {
    return process.stdout.columns || Number(process.env.COLUMNS) || 80;
  }

  function updateGobarsStatus() {
    if (state.loading) {
      writeGobarsCache("🏃 Go loading…");
      return;
    }
    if (!state.data || state.data.error) {
      writeGobarsCache(null);
      return;
    }

    const elapsed = state.data.fetchedAt ? Math.floor((Date.now() - state.data.fetchedAt) / 1000) : 0;

    const wins: Array<{ label: string; pct: string; reset: string }> = [];
    const addWin = (label: string, w: { usagePercent: number; resetInSec: number } | null) => {
      if (!w) return;
      const pct = clampPercent(w.usagePercent);
      const reset = Math.max(0, w.resetInSec - elapsed);
      wins.push({
        label,
        pct: pct >= 90 ? `⚠${pct}%` : `${pct}%`,
        reset: reset > 0 ? compactDuration(reset) : "",
      });
    };

    addWin("R", state.data.rolling);
    addWin("W", state.data.weekly);
    addWin("M", state.data.monthly);

    // Trailing extras share the same separator and count against the width budget.
    const extras: string[] = [];
    if (state.billing && !state.billing.error) extras.push(`Zen ${formatUsd(state.billing.balanceUsd)}`);
    // DeepSeek balance (from deepseek-balance extension cache)
    const dsBalance = readDeepseekBalance();
    if (dsBalance) extras.push(`DS ¥${dsBalance}`);
    if (state.data.stale) extras.push("⚠stale");
    const suffix = extras.length > 0 ? " · " + extras.join(" · ") : "";

    const brand = "🏃 Go";
    const budget = statusWidth() - visibleWidth(suffix);

    // Density tiers, widest first; the first that fits the terminal on one line
    // wins. Mirrors the widget's graceful degradation so the row never wraps.
    const tier = (withBrand: boolean, sep: string, resetPrefix: string, withResets: boolean) =>
      [
        ...(withBrand ? [brand] : []),
        ...wins.map((w) =>
          [`${w.label} ${w.pct}`, withResets && w.reset ? resetPrefix + w.reset : ""]
            .filter(Boolean)
            .join(" "),
        ),
      ].join(sep);

    const tiers = [
      tier(true, "  │  ", "⟳ ", true),
      tier(true, " · ", "⟳", true),
      tier(true, " · ", "", true),
      tier(false, " · ", "", true),
      tier(false, " · ", "", false),
    ];
    const line = tiers.find((candidate) => visibleWidth(candidate) <= budget) ?? tiers[tiers.length - 1];

    writeGobarsCache(line + suffix, tiers, suffix);
  }

  function readDeepseekBalance(): string | null {
    try {
      const cachePath = join(getAgentDir(), "deepseek-balance-cache.json");
      if (!existsSync(cachePath)) return null;
      const cache = JSON.parse(readFileSync(cachePath, "utf8")) as {
        balance: string | null;
        timestamp: number;
      };
      if (!cache.balance) return null;
      if (Date.now() - cache.timestamp > 60 * 60 * 1000) return null;
      return cache.balance;
    } catch {
      return null;
    }
  }

  function clearGobarsCache() {
    writeGobarsCache(null);
  }

  // ─── UsageWidget (for /gobars detail view) ─────────────────────────────────

  class UsageWidget implements Component {
    private s: UsageState;
    private t: any;

    constructor(s: UsageState, t: any) { this.s = s; this.t = t; }
    invalidate() {}

    render(width: number): string[] {
      const { data } = this.s;
      const t = this.t;

      if (this.s.loading) return this.ctr(t.fg("dim", "Go  loading..."), width);
      if (!data) return [""];
      if (data.error) return this.ctr(t.fg("warning", "Go  " + data.error), width);

      const staleSuffix = data.stale ? t.fg("warning", " stale") : "";
      const elapsed = data.fetchedAt ? Math.floor((Date.now() - data.fetchedAt) / 1000) : 0;

      const wins: Win[] = [];
      if (data.rolling) wins.push({ label: "R", pct: data.rolling.usagePercent, resetSec: Math.max(0, data.rolling.resetInSec - elapsed) });
      if (data.weekly) wins.push({ label: "W", pct: data.weekly.usagePercent, resetSec: Math.max(0, data.weekly.resetInSec - elapsed) });
      if (data.monthly) wins.push({ label: "M", pct: data.monthly.usagePercent, resetSec: Math.max(0, data.monthly.resetInSec - elapsed) });

      const layout = calculateLayout(width, wins, visibleWidth(staleSuffix));
      const parts: string[] = [t.fg("dim", "Go")];

      for (const w of wins) {
        if (layout.showLabels) parts.push(t.fg("muted", " " + w.label + " "));
        parts.push(renderBarSegment(t, w, layout.barSlots));
        if (layout.showResets && w.resetSec > 0)
          parts.push(t.fg("dim", " \u27F3 " + formatDuration(w.resetSec)));
      }

      return this.ctr(parts.join("") + staleSuffix, width);
    }

    private ctr(text: string, w: number): string[] {
      const tw = visibleWidth(text);
      if (tw >= w) return [text];
      return [" ".repeat(Math.floor((w - tw) / 2)) + text];
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  pi.on("session_start", async (_event, _ctx) => {
    if (!isGoModel(_ctx.model)) return;
    zenEnabled = loadConfig()?.showZen ?? false;
    await poll();
    updateGobarsStatus();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => { void poll().then(() => updateGobarsStatus()); }, POLL_INTERVAL_MS);
  });

  pi.on("turn_start", async (_event, _ctx) => {
    if (!isGoModel(_ctx.model)) return;
  });

  pi.on("model_select", async (_event, _ctx) => {
    if (!isGoModel(_event.model)) {
      clearGobarsCache();
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      return;
    }
    if (!widgetActive) {
      zenEnabled = loadConfig()?.showZen ?? false;
      if (!state.data || state.loading) await poll();
      updateGobarsStatus();
      widgetActive = true;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => { void poll().then(() => updateGobarsStatus()); }, POLL_INTERVAL_MS);
    }
  });

  pi.on("session_shutdown", async (_event, _ctx) => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    clearGobarsCache();
  });

  // ─── Commands ──────────────────────────────────────────────────────────────

  pi.registerCommand("gobars", {
    description: "Show Opencode Go plan usage (rolling / weekly / monthly)",
    handler: async (_args, _ctx) => {
      try {
        if (_ctx.ui) {
          await _ctx.ui.custom<void>((tui, theme, _kb, done) =>
            buildUsageDetail(theme, state.data, state.billing, done),
          );
        }
      } catch (err) { logError("command:gobars", err); }
      await poll();
      updateGobarsStatus();
    },
  });

  pi.registerCommand("gobars-setup", {
    description: "Configure Go usage bars (workspace ID + auth cookie)",
    handler: async (_args, _ctx) => {
      try {
        if (_ctx.ui) {
          await _ctx.ui.custom<void>((tui, theme, _kb, done) =>
            renderSetupGuide(tui, theme, done),
          );
        }
      } catch (err) { logError("command:gobars-setup", err); }
    },
  });
}

// ─── Detail UI Component ─────────────────────────────────────────────────────

function buildUsageDetail(theme: any, data: GoUsageData | null, billing: ZenBillingData | null, done: () => void): Container & Focusable {
  const t = theme;
  const comp = new Container() as Container & Focusable;
  (comp as any)._focused = true;
  comp.handleInput = () => { done(); };

  const lines: string[] = [];
  lines.push(t.bold("OpenCode Go \u2014 Usage"));
  lines.push("");

  if (!data) {
    lines.push(t.fg("dim", "Loading\u2026"));
  } else if (data.error) {
    lines.push(t.fg("error", data.error));
  } else {
    if (data.stale && data.warning) {
      lines.push(t.fg("warning", "\u26A0 " + data.warning));
      lines.push("");
    }

    const renderWin = (label: string, w: { usagePercent: number; resetInSec: number } | null) => {
      if (!w) return;
      const pct = clampPercent(w.usagePercent);
      const reset = w.resetInSec > 0 ? t.fg("dim", "  resets in " + formatDuration(w.resetInSec)) : "";
      lines.push(
        t.fg("muted", label.padEnd(8)) +
        renderBar(t, pct, 16) +
        " " +
        renderPercent(t, pct) +
        reset,
      );
      lines.push("");
    };

    renderWin("Rolling", data.rolling);
    renderWin("Weekly", data.weekly);
    renderWin("Monthly", data.monthly);
  }

  // Zen pay-as-you-go billing section.
  if (billing && !billing.error) {
    lines.push("");
    // Visual rule separating the Go usage bars from the Zen billing block.
    lines.push(t.fg("dim", "\u2500".repeat(40)));
    lines.push("");
    lines.push(t.bold("Zen Pay-As-You-Go"));
    if (billing.stale && billing.warning) {
      lines.push(t.fg("warning", "\u26A0 " + billing.warning));
      lines.push("");
    }
    const balStr = formatUsd(billing.balanceUsd);
    const useStr = formatUsd(billing.monthlyUsageUsd);
    const limStr = formatUsd(billing.monthlyLimitUsd);
    lines.push(t.fg("muted", "Balance".padEnd(8)) + "  " + t.fg("dim", balStr));
    const usePct =
      billing.monthlyLimitUsd > 0
        ? clampPercent((billing.monthlyUsageUsd / billing.monthlyLimitUsd) * 100)
        : 0;
    lines.push(
      t.fg("muted", "This mo.".padEnd(8)) +
      "  " + renderPercent(t, usePct) +
      t.fg("dim", `  ${useStr} / ${limStr}`),
    );
    lines.push("");
    if (billing.autoReload) {
      lines.push(
        t.fg("muted", "Reload".padEnd(8)) + "  " +
        t.fg("dim", `+$${billing.reloadAmountUsd.toFixed(2)} when < $${billing.reloadTriggerUsd.toFixed(2)}`),
      );
    }
    if (billing.monthlyLimitUsd > 0) {
      lines.push(
        t.fg("muted", "Limit".padEnd(8)) + "  " +
        t.fg("dim", `$${billing.monthlyLimitUsd.toFixed(2)} / month`),
      );
    }
  } else if (billing && billing.error) {
    lines.push("");
    lines.push(t.fg("warning", "Zen billing: " + billing.error));
  }

  lines.push(t.fg("dim", "Press any key to close"));

  for (const line of lines) {
    comp.addChild(new Text(line, 0, 0));
  }

  return comp;
}
