import React, { useEffect, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { colors } from "../theme";
import { initAds, bannerUnitId, BannerAd } from "../lib/ads";

export default function BannerFooter({ safeBottom = 0 }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    initAds().then((ok) => alive && setReady(!!ok));
    return () => {
      alive = false;
    };
  }, []);

  if (Platform.OS !== "android" || failed || !ready) {
    return <View style={{ height: safeBottom ? Math.min(safeBottom, 16) : 0 }} />;
  }

  return (
    <View style={[styles.wrap, { paddingBottom: safeBottom }]}>
      <BannerAd
        unitId={bannerUnitId()}
        size="ANCHORED_ADAPTIVE_BANNER"
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    alignItems: "center",
    width: "100%",
  },
});
