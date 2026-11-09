import { Platform } from "react-native";
import mobileAdsDefault, {
  BannerAd,
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

const mobileAds = mobileAdsDefault;

export const ADS = {
  FORCE_TEST_ADS: false,
  PRODUCTION_BANNER_ID: "ca-app-pub-5275292033164657/7222353589",
  PRODUCTION_REWARDED_ID: "ca-app-pub-5275292033164657/8202077543",
};

let adsReady = false;
let initPromise = null;

export function initAds() {
  if (adsReady) return Promise.resolve(true);
  if (Platform.OS !== "android") return Promise.resolve(false);
  if (!initPromise) {
    initPromise = (async () => {
      try {
        if (mobileAds && typeof mobileAds.initialize === "function") {
          await mobileAds.initialize();
        }
        adsReady = true;
        return true;
      } catch {
        adsReady = false;
        return false;
      }
    })();
  }
  return initPromise;
}

export function bannerUnitId() {
  if (ADS.FORCE_TEST_ADS) return TestIds.ADAPTIVE_BANNER;
  return ADS.PRODUCTION_BANNER_ID;
}

export function rewardedUnitId() {
  if (ADS.FORCE_TEST_ADS) return TestIds.REWARDED;
  return ADS.PRODUCTION_REWARDED_ID;
}

export function getBannerAd() {
  return BannerAd;
}

/**
 * Show a rewarded ad if available. Resolves when closed/failed/timeout.
 * Never blocks the user permanently.
 */
export async function showRewardedAd({ timeoutMs = 12000 } = {}) {
  if (Platform.OS !== "android") return true;
  try {
    await initAds();
    const unitId = rewardedUnitId();
    if (!unitId || !RewardedAd) return true;

    const ad = RewardedAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    return await new Promise((resolve) => {
      let settled = false;
      const subs = [];
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        subs.forEach((unsub) => {
          try {
            unsub && unsub();
          } catch {}
        });
        resolve(true);
      };

      const timer = setTimeout(done, timeoutMs);

      try {
        subs.push(
          ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
            ad.show().catch(done);
          })
        );
        subs.push(ad.addAdEventListener(AdEventType.ERROR, done));
        subs.push(ad.addAdEventListener(AdEventType.CLOSED, done));
        subs.push(ad.addAdEventListener(AdEventType.OPENED, () => {}));
        ad.load();
      } catch {
        done();
      }
    });
  } catch {
    return true;
  }
}
