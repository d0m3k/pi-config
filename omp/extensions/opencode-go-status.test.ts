/**
 * Unit tests for the OpenCode Go usage row formatter.
 *
 * Run:  node --test --experimental-strip-types omp/extensions/opencode-go-status.test.ts
 *
 * Pure formatting only: no omp host, no network, no config. The fixture
 * mirrors the shape `omp usage --json -p opencode-go` prints.
 */
import { test } from "node:test";
import * as assert from "node:assert/strict";

import { formatUsageRow } from "./opencode-go-status.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW = 1_800_000_000_000;

const limit = (
	windowId: string,
	usedFraction: number,
	resetsAt: number | undefined,
	amount: Record<string, unknown> = {},
) => ({
	id: windowId,
	scope: { provider: "opencode-go", windowId },
	window: resetsAt === undefined ? { id: windowId } : { id: windowId, resetsAt },
	amount: { unit: "percent", usedFraction, ...amount },
});

const report = (limits: unknown[]) => ({ provider: "opencode-go", fetchedAt: NOW, limits });

test("renders every window with used percent and reset countdown", () => {
	const row = formatUsageRow(
		report([
			limit("5h", 0.0123, NOW + 4 * HOUR + 31 * MINUTE),
			limit("7d", 0.004, NOW + 6 * 24 * HOUR + 4 * HOUR),
			limit("monthly", 0.02, NOW + 21 * 24 * HOUR + 18 * HOUR),
		]),
		NOW,
	);
	assert.equal(row, "⏱ Go · 5h 1% (4h 31m) · 7d 0% (6d 4h) · mo 2% (21d 18h)");
});

test("rounds the rolling windows and floors the monthly window", () => {
	const row = formatUsageRow(
		report([limit("5h", 0.026, undefined), limit("7d", 0.026, undefined), limit("monthly", 0.026, undefined)]),
		NOW,
	);
	assert.equal(row, "⏱ Go · 5h 3% · 7d 3% · mo 2%");
});

test("maps daily-window ids onto the 1d slot", () => {
	for (const windowId of ["1d", "daily", "24h"]) {
		const row = formatUsageRow(report([limit(windowId, 0.5, NOW + 55 * MINUTE)]), NOW);
		assert.equal(row, "⏱ Go · 1d 50% (55m)", `windowId ${windowId}`);
	}
});

test("formats countdowns like the built-in segment", () => {
	// Rolling windows report minutes; the weekly/monthly windows report hours.
	const minuteCases: Array<[string, number, string]> = [
		["55 minutes", 55 * MINUTE, "55m"],
		["exactly an hour", 60 * MINUTE, "1h"],
		["four and a half hours", 271 * MINUTE, "4h 31m"],
		["elapsed reset clamps to zero", -5 * MINUTE, "0m"],
	];
	for (const [name, remainingMs, expected] of minuteCases) {
		const row = formatUsageRow(report([limit("5h", 0.1, NOW + remainingMs)]), NOW);
		assert.equal(row, `⏱ Go · 5h 10% (${expected})`, name);
	}
	const hourCases: Array<[string, number, string]> = [
		["six hours", 6 * HOUR, "6h"],
		["exactly a day", 24 * HOUR, "1d"],
		["six days four hours", 6 * 24 * HOUR + 4 * HOUR, "6d 4h"],
	];
	for (const [name, remainingMs, expected] of hourCases) {
		const row = formatUsageRow(report([limit("7d", 0.1, NOW + remainingMs)]), NOW);
		assert.equal(row, `⏱ Go · 7d 10% (${expected})`, name);
	}
});

test("omits windows the report does not carry, and countdowns without resetsAt", () => {
	assert.equal(formatUsageRow(report([limit("5h", 0.1, undefined), limit("monthly", 0.4, NOW + HOUR)]), NOW),
		"⏱ Go · 5h 10% · mo 40% (1h)");
});

test("resolves the used fraction from each amount shape the host accepts", () => {
	const shapes: Array<[string, Record<string, unknown>, string]> = [
		["usedFraction", { usedFraction: 0.25 }, "25%"],
		["used / limit", { used: 3, limit: 12 }, "25%"],
		["percent unit", { unit: "percent", used: 25 }, "25%"],
		["remainingFraction", { remainingFraction: 0.75 }, "25%"],
	];
	for (const [name, amount, expected] of shapes) {
		const row = formatUsageRow(
			report([{ id: "5h", scope: { windowId: "5h" }, window: { id: "5h" }, amount }]),
			NOW,
		);
		assert.equal(row, `⏱ Go · 5h ${expected}`, name);
	}
});

test("returns null when nothing usable is reported", () => {
	assert.equal(formatUsageRow(report([]), NOW), null);
	assert.equal(formatUsageRow(report([limit("5m", 0.5, NOW)]), NOW), null);
	assert.equal(
		formatUsageRow(report([{ id: "5h", scope: { windowId: "5h" }, window: { id: "5h" }, amount: {} }]), NOW),
		null,
	);
});
