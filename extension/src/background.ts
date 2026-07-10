// Tribute background worker.
//
// Owns the data: a daily fetch of the register + heuristic rules from
// jsDelivr's CDN over the repo's `dist` branch (one anonymous GET per day —
// the only network requests Tribute makes on its own), with the bundled
// snapshot as offline/first-run fallback. Appraises URLs on request from the
// content script.
import { appraise, type SignalsFile as EngineSignalsFile } from "@tribute/heuristics";
import { RegisterFileSchema, SignalsFileSchema, type RegisterFile } from "@tribute/register";
import { DEFAULT_SETTINGS, type AppraiseRequest, type AppraiseResponse, type Settings } from "./types.js";

const CDN_BASE = "https://cdn.jsdelivr.net/gh/goflypost/tribute@dist";
const SYNC_ALARM = "tribute-sync";
const SYNC_PERIOD_MINUTES = 24 * 60;
const DEEP_SCAN_ORIGINS = ["http://*/*", "https://*/*"];

interface SyncedData {
  register: RegisterFile;
  signals: EngineSignalsFile;
}

const cache = new Map<string, AppraiseResponse>();

// ---------------------------------------------------------------------------
// Data sync
// ---------------------------------------------------------------------------

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return await res.json();
}

async function loadSnapshot(file: string): Promise<unknown> {
  const res = await fetch(chrome.runtime.getURL(`snapshot/${file}`));
  return await res.json();
}

function parseSignals(data: unknown): EngineSignalsFile {
  return SignalsFileSchema.parse(data) as EngineSignalsFile;
}

async function fetchRemoteData(): Promise<SyncedData> {
  const [register, signals] = await Promise.all([
    fetchJson(`${CDN_BASE}/register.json`),
    fetchJson(`${CDN_BASE}/signals.json`),
  ]);
  return {
    register: RegisterFileSchema.parse(register),
    signals: parseSignals(signals),
  };
}

async function loadSnapshotData(): Promise<SyncedData> {
  const [register, signals] = await Promise.all([
    loadSnapshot("register.json"),
    loadSnapshot("signals.json"),
  ]);
  return {
    register: RegisterFileSchema.parse(register),
    signals: parseSignals(signals),
  };
}

async function syncData(): Promise<void> {
  try {
    const { register, signals } = await fetchRemoteData();
    await chrome.storage.local.set({ register, signals, syncedAt: Date.now(), syncSource: "cdn" });
    cache.clear();
  } catch {
    // CDN unavailable (or dist branch not yet published): fall back to the
    // snapshot bundled with the extension, but only for missing/invalid data.
    const stored = await chrome.storage.local.get(["register", "signals"]);
    const register = RegisterFileSchema.safeParse(stored["register"]);
    const signals = SignalsFileSchema.safeParse(stored["signals"]);
    if (!register.success || !signals.success) {
      const snapshot = await loadSnapshotData();
      await chrome.storage.local.set({
        register: register.success ? register.data : snapshot.register,
        signals: signals.success ? (signals.data as EngineSignalsFile) : snapshot.signals,
        syncedAt: Date.now(),
        syncSource: "snapshot",
      });
      cache.clear();
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void syncData();
  void chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_PERIOD_MINUTES });
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) void syncData();
});

// ---------------------------------------------------------------------------
// Appraisal
// ---------------------------------------------------------------------------

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

async function fetchHtml(url: string): Promise<string | undefined> {
  const hasPermission = await chrome.permissions.contains({ origins: DEEP_SCAN_ORIGINS });
  if (!hasPermission) return undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) return undefined;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return undefined;
    return (await res.text()).slice(0, 500_000);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

async function handleAppraise(req: AppraiseRequest): Promise<AppraiseResponse> {
  const domain = hostOf(req.url);
  if (domain === "") return { kind: "unknown", domain };

  const sync = await chrome.storage.sync.get(["trust", "block", "settings"]);
  const trust = (sync["trust"] as string[] | undefined) ?? [];
  const block = (sync["block"] as string[] | undefined) ?? [];
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(sync["settings"] as Partial<Settings> | undefined) };

  let result: AppraiseResponse;

  // Personal trust and block lists beat every other signal, always.
  if (trust.includes(domain)) {
    return { kind: "trusted", domain };
  } else if (block.includes(domain)) {
    return { kind: "blocked", domain };
  }

  const cacheKey = `${settings.deepScan ? "deep" : "shallow"}:${req.url}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const stored = await chrome.storage.local.get(["register", "signals"]);

  // 1. Checked against the register.
  const register = RegisterFileSchema.safeParse(stored["register"]);
  const entry = register.success ? register.data.entries.find((e) => e.domain === domain) : undefined;
  if (entry !== undefined) {
    result = { kind: entry.status, domain };
  } else {
    // 2. Unknowns get scored — cheaply, without deep testing.
    const signals = SignalsFileSchema.safeParse(stored["signals"]);
    if (!signals.success) {
      result = { kind: "unknown", domain };
    } else {
      const html = settings.deepScan ? await fetchHtml(req.url) : undefined;
      const appraisal = appraise({ url: req.url, title: req.title, html }, signals.data as EngineSignalsFile);
      result = {
        kind: appraisal.verdict,
        domain,
        score: Math.round(appraisal.score * 100),
        hits: appraisal.hits.map((h) => ({ id: h.id, description: h.description })),
      };
    }
  }

  cache.set(cacheKey, result);
  return result;
}

chrome.runtime.onMessage.addListener((msg: AppraiseRequest, _sender, sendResponse) => {
  if (msg?.type === "appraise") {
    void syncIfEmpty()
      .then(() => handleAppraise(msg))
      .then(sendResponse)
      .catch(() => sendResponse({ kind: "unknown", domain: hostOf(msg.url) }));
    return true; // async response
  }
  return undefined;
});

async function syncIfEmpty(): Promise<void> {
  const stored = await chrome.storage.local.get(["register", "signals"]);
  const hasRegister = RegisterFileSchema.safeParse(stored["register"]).success;
  const hasSignals = SignalsFileSchema.safeParse(stored["signals"]).success;
  if (!hasRegister || !hasSignals) {
    await syncData();
  }
}
