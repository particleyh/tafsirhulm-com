import { setCooldownSec } from "./storage";

export const TIMEOUT_MSG = "انتهت المهلة، تحقق من اتصالك وحاول مجدداً.";

export async function toUserMessage(err, fallback) {
  if (err && err.status === 429 && err.data && err.data.retry_after) {
    await setCooldownSec(err.data.retry_after);
    return err.data.error || fallback;
  }
  if (err && err.name === "AbortError") return TIMEOUT_MSG;
  return (err && err.message) || fallback;
}
