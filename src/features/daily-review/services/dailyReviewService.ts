import { loadDailyReview, type DailyReview } from "../../../platform/persistence/dailyReviewGateway.ts";
import { readBrowserStorage, writeBrowserStorage } from "../../../platform/browser/browserStorageGateway.ts";

const SOURCE_KEY = "focusledger:review-source";

export const readDemoMode = () => readBrowserStorage(SOURCE_KEY) !== "real";

export const rememberDemoMode = (demo: boolean) => writeBrowserStorage(SOURCE_KEY, demo ? "demo" : "real");

export type { DailyReview };

export { loadDailyReview };
