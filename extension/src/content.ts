// Tribute content script for Show HN.
//
// Finds Show HN rows, asks the background for a verdict, and applies it in
// place: verified apps wear a laurel; flagged listings are labeled, dimmed,
// or hidden — the user's call. Every verdict is one click from being
// overridden.
import type { AppraiseResponse, Settings } from "./types.js";
import { DEFAULT_SETTINGS } from "./types.js";

interface HnRow {
  thing: HTMLTableRowElement;
  subtext: HTMLTableRowElement | null;
  link: HTMLAnchorElement;
  title: string;
  placeholder?: HTMLTableRowElement;
}

function collectShowHnRows(): HnRow[] {
  const rows: HnRow[] = [];
  for (const thing of document.querySelectorAll<HTMLTableRowElement>("tr.athing")) {
    const link = thing.querySelector<HTMLAnchorElement>(".titleline > a");
    if (!link) continue;
    const title = link.textContent ?? "";
    if (!/^show hn/i.test(title.trim())) continue;
    if (link.hostname === location.hostname) continue; // text posts
    const next = thing.nextElementSibling;
    rows.push({
      thing,
      subtext: next instanceof HTMLTableRowElement ? next : null,
      link,
      title,
    });
  }
  return rows;
}

function badge(text: string, color: string, background: string): HTMLSpanElement {
  const el = document.createElement("span");
  el.textContent = text;
  el.style.cssText =
    `margin-left:6px;padding:1px 6px;border-radius:9px;font-size:9pt;` +
    `color:${color};background:${background};white-space:nowrap;`;
  return el;
}

function actionLink(label: string, onClick: () => void | Promise<void>): HTMLAnchorElement {
  const a = document.createElement("a");
  a.textContent = label;
  a.href = "#";
  a.style.cssText = "margin-left:6px;font-size:8pt;color:#828282;text-decoration:underline;cursor:pointer;";
  a.addEventListener("click", (e) => {
    e.preventDefault();
    void onClick();
  });
  return a;
}

async function addToList(key: "trust" | "block", domain: string): Promise<void> {
  const stored = await chrome.storage.sync.get(key);
  const list = new Set((stored[key] as string[] | undefined) ?? []);
  list.add(domain);
  await chrome.storage.sync.set({ [key]: [...list] });
}

async function removeFromList(key: "trust" | "block", domain: string): Promise<void> {
  const stored = await chrome.storage.sync.get(key);
  const list = new Set((stored[key] as string[] | undefined) ?? []);
  list.delete(domain);
  await chrome.storage.sync.set({ [key]: [...list] });
}

function setRowHidden(row: HnRow, hidden: boolean): void {
  const display = hidden ? "none" : "";
  row.thing.style.display = display;
  if (row.subtext) {
    row.subtext.style.display = display;
    const spacer = row.subtext.nextElementSibling;
    if (spacer instanceof HTMLElement && spacer.classList.contains("spacer")) {
      spacer.style.display = display;
    }
  }
}

function restoreRow(row: HnRow): void {
  row.placeholder?.remove();
  row.placeholder = undefined;
  setRowHidden(row, false);
  row.thing.style.opacity = "";
  if (row.subtext) row.subtext.style.opacity = "";
}

function hideWithPlaceholder(
  row: HnRow,
  text: string,
  actions: Array<{ label: string; onClick: () => void | Promise<void> }>,
): void {
  row.placeholder?.remove();
  const placeholder = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 3;
  td.style.cssText = "font-size:8pt;color:#828282;padding:2px 0 6px 38px;";
  td.textContent = text;
  for (const action of actions) {
    td.appendChild(actionLink(action.label, action.onClick));
  }
  placeholder.appendChild(td);
  row.thing.parentElement?.insertBefore(placeholder, row.thing);
  row.placeholder = placeholder;
  setRowHidden(row, true);
}

function unblockActions(row: HnRow, domain: string): Array<{ label: string; onClick: () => void | Promise<void> }> {
  return [
    { label: "show once", onClick: () => restoreRow(row) },
    {
      label: "unblock",
      onClick: async () => {
        await removeFromList("block", domain);
        restoreRow(row);
      },
    },
  ];
}

async function blockRow(row: HnRow, domain: string): Promise<void> {
  await addToList("block", domain);
  hideWithPlaceholder(row, `Tribute blocked ${domain}.`, unblockActions(row, domain));
}

function applyVerdict(row: HnRow, verdict: AppraiseResponse, settings: Settings): void {
  const titleline = row.link.parentElement;
  if (!titleline) return;

  switch (verdict.kind) {
    case "verified": {
      titleline.appendChild(badge("🌿 Tribute verified", "#1a5c2e", "#e4f3e8"));
      titleline.appendChild(
        actionLink("block", async () => {
          await blockRow(row, verdict.domain);
        }),
      );
      return;
    }

    case "trusted":
    case "clear":
    case "unknown":
      return; // pass untouched

    case "pending":
      titleline.appendChild(badge("Tune Up pending", "#5c4a00", "#f6edc9"));
      titleline.appendChild(actionLink("block", async () => blockRow(row, verdict.domain)));
      return;

    case "resubmitted":
      titleline.appendChild(badge("re-Tune Up pending", "#5c4a00", "#f6edc9"));
      titleline.appendChild(actionLink("block", async () => blockRow(row, verdict.domain)));
      return;

    case "blocked":
      hideWithPlaceholder(row, `Tribute blocked ${verdict.domain}.`, unblockActions(row, verdict.domain));
      return;

    case "failed":
    case "flag":
    case "caution": {
      const isCaution = verdict.kind === "caution";
      if (settings.strictness === "hide" && !isCaution) {
        hideWithPlaceholder(row, `Tribute hid ${verdict.domain}.`, [
          { label: "show once", onClick: () => restoreRow(row) },
          {
            label: "trust",
            onClick: async () => {
              await addToList("trust", verdict.domain);
              restoreRow(row);
            },
          },
        ]);
        return;
      }
      if (settings.strictness !== "label" && !isCaution) {
        row.thing.style.opacity = "0.45";
        if (row.subtext) row.subtext.style.opacity = "0.45";
      }
      const label =
        verdict.kind === "failed"
          ? "✗ failed Tune Up"
          : `⚠ untested${verdict.score !== undefined ? ` ${verdict.score}%` : ""}`;
      const b = badge(label, isCaution ? "#7a5c00" : "#8a1f1f", isCaution ? "#fdf3d5" : "#fbe6e6");
      if (verdict.hits && verdict.hits.length > 0) {
        b.title = verdict.hits.map((h) => `• ${h.description}`).join("\n");
      }
      titleline.appendChild(b);
      const trust = actionLink("trust", async () => {
        await addToList("trust", verdict.domain);
        b.remove();
        trust.remove();
        block.remove();
        restoreRow(row);
      });
      const block = actionLink("block", async () => {
        await blockRow(row, verdict.domain);
      });
      titleline.appendChild(trust);
      titleline.appendChild(block);
      return;
    }
  }
}

async function main(): Promise<void> {
  const rows = collectShowHnRows();
  if (rows.length === 0) return;

  const stored = await chrome.storage.sync.get("settings");
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(stored["settings"] as Partial<Settings> | undefined) };

  for (const row of rows) {
    chrome.runtime.sendMessage(
      { type: "appraise", url: row.link.href, title: row.title },
      (verdict: AppraiseResponse | undefined) => {
        if (chrome.runtime.lastError !== undefined || verdict === undefined) return;
        applyVerdict(row, verdict, settings);
      },
    );
  }
}

void main();
