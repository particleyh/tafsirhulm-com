import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "dreams_history_v1";
const COOLDOWN_KEY = "tafsir_next_ok";

export async function loadHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveDream(entry) {
  const list = await loadHistory();
  list.unshift(entry);
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  return list;
}

export async function removeDream(ts) {
  const list = await loadHistory();
  const next = list.filter((x) => x.ts !== ts);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function clearHistory() {
  await AsyncStorage.setItem(KEY, "[]");
}

export async function getCooldownLeftSec() {
  try {
    const raw = await AsyncStorage.getItem(COOLDOWN_KEY);
    const next = raw ? parseInt(raw, 10) : 0;
    const left = Math.ceil((next - Date.now()) / 1000);
    return left > 0 ? left : 0;
  } catch {
    return 0;
  }
}

export async function setCooldownSec(sec) {
  try {
    await AsyncStorage.setItem(COOLDOWN_KEY, String(Date.now() + sec * 1000));
  } catch {}
}
