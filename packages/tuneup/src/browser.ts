import { chromium, type Browser } from "playwright-core";

// playwright-core ships no browsers. Prefer an installed Chrome/Edge channel;
// fall back to a `npx playwright install chromium` download if present.
export async function launchBrowser(): Promise<Browser> {
  for (const channel of ["chrome", "msedge"]) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      // try the next option
    }
  }
  try {
    return await chromium.launch({ headless: true });
  } catch {
    throw new Error(
      "No browser found. Install Google Chrome, or run `npx playwright install chromium` once.",
    );
  }
}
