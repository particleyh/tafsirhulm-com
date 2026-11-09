import { Platform } from "react-native";
import mobileAds, {
  BannerAd,
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

export const ADS = {
  FORCE_TEST_ADS: false,
  BANNER: "ca-app-pub-5275292033164657/7222353589",
  REWARDED: "ca-app-pub-5275292033164657/8202077543",
};

export { BannerAd };

const isAndroid = Platform.OS === "android";
let adsReady = false;
let initPromise = null;

export function initAds() {
  if (adsReady) return Promise.resolve(true);
  if (!isAndroid) return Promise.resolve(false);
  if (!initPromise) {
    initPromise = mobileAds
      .initialize()
      .then(() => {
        adsReady = true;
        return true;
      })
      .catch(() => false);
  }
  return initPromise;
}

export const bannerUnitId = () =>
  ADS.FORCE_TEST_ADS ? TestIds.ADAPTIVE_BANNER : ADS.BANNER;

export const rewardedUnitId = () =>
  ADS.FORCE_TEST_ADS ? TestIds.REWARDED : ADS.REWARDED;

/** Show rewarded ad; always resolves, never blocks the user. */
export async function showRewardedAd({ timeoutMs = 12000 } = {}) {
  if (!isAndroid) return true;
  try {
    await initAds();
    const ad = RewardedAd.createForAdRequest(rewardedUnitId(), {
      requestNonPersonalizedAdsOnly: true,
    });
    return await new Promise((resolve) => {
      let settled = false;
      const subs = [];
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        subs.forEach((u) => {
          try {
            u && u();
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
        ad.load();
      } catch {
        done();
      }
    });
  } catch {
    return true;
  }
}
