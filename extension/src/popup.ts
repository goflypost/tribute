import type { Settings, Strictness } from "./types.js";
import { DEFAULT_SETTINGS } from "./types.js";

const DEEP_SCAN_ORIGINS = ["http://*/*", "https://*/*"];

async function init(): Promise<void> {
  const stored = await chrome.storage.sync.get(["settings", "trust", "block"]);
  let settings: Settings = { ...DEFAULT_SETTINGS, ...(stored["settings"] as Partial<Settings> | undefined) };

  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="strictness"]')) {
    input.checked = input.value === settings.strictness;
    input.addEventListener("change", () => {
      settings = { ...settings, strictness: input.value as Strictness };
      void chrome.storage.sync.set({
        settings,
      });
    });
  }

  const deepScan = document.getElementById("deepScan");
  if (deepScan instanceof HTMLInputElement) {
    deepScan.checked = settings.deepScan;
    deepScan.addEventListener("change", () => {
      void updateDeepScan(deepScan, settings).then((next) => {
        settings = next;
      });
    });
  }

  const local = await chrome.storage.local.get(["register", "syncedAt", "syncSource"]);
  const register = local["register"] as { entries: unknown[]; updatedAt: string } | undefined;
  const syncedAt = local["syncedAt"] as number | undefined;
  const status = document.getElementById("status");
  if (status) {
    status.textContent = register
      ? `Register: ${register.entries.length} apps (data ${register.updatedAt}, ` +
        `synced ${syncedAt ? new Date(syncedAt).toLocaleString() : "never"} via ${String(local["syncSource"] ?? "?")})`
      : "Register not synced yet — visit Show HN once.";
  }

  const trust = (stored["trust"] as string[] | undefined) ?? [];
  const block = (stored["block"] as string[] | undefined) ?? [];
  const lists = document.getElementById("lists");
  if (lists) {
    lists.textContent = `Personal lists: ${trust.length} trusted, ${block.length} blocked. Your lists beat every other signal, always.`;
  }
}

async function updateDeepScan(input: HTMLInputElement, settings: Settings): Promise<Settings> {
  if (input.checked) {
    const granted = await chrome.permissions.request({ origins: DEEP_SCAN_ORIGINS });
    if (!granted) {
      input.checked = false;
      const next = { ...settings, deepScan: false };
      await chrome.storage.sync.set({ settings: next });
      return next;
    }
  } else {
    await chrome.permissions.remove({ origins: DEEP_SCAN_ORIGINS });
  }

  const next = { ...settings, deepScan: input.checked };
  await chrome.storage.sync.set({ settings: next });
  return next;
}

void init();
