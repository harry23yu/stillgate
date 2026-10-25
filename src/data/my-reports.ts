import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * This device's own "Still accurate" / "This was off" answers, so the map can
 * show "Thanks, you confirmed this" instead of letting the same person tap
 * again. Mirrors the backend's one-per-device-per-day rule (convex/reports.ts).
 */

export type ReportVerdict = 'accurate' | 'wrong';

interface StoredReport {
  verdict: ReportVerdict;
  /** ms since epoch */
  at: number;
}

const STORAGE_KEY = 'stillgate.myReports';
const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

const keyFor = (airportCode: string, spotId: string) => `${airportCode}:${spotId}`;

async function readAll(): Promise<Record<string, StoredReport>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StoredReport>) : {};
  } catch {
    return {};
  }
}

/** The answer this device gave for a spot within the last day, if any. */
export async function getMyReport(airportCode: string, spotId: string): Promise<ReportVerdict | null> {
  const report = (await readAll())[keyFor(airportCode, spotId)];
  return report && Date.now() - report.at < REPEAT_WINDOW_MS ? report.verdict : null;
}

export async function rememberMyReport(airportCode: string, spotId: string, verdict: ReportVerdict): Promise<void> {
  const all = await readAll();
  const now = Date.now();
  // Keep the stored map small: drop answers older than the window.
  for (const [key, report] of Object.entries(all)) {
    if (now - report.at >= REPEAT_WINDOW_MS) delete all[key];
  }
  const existing = all[keyFor(airportCode, spotId)];
  // Changing an answer keeps the original time, matching the backend's single report.
  all[keyFor(airportCode, spotId)] = { verdict, at: existing && now - existing.at < REPEAT_WINDOW_MS ? existing.at : now };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Not fatal: the backend still counts this device once.
  }
}
