import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { colors, radius, spacing, shadows } from "../theme";
import { createShare, prettyInterpretation } from "../lib/api";
import { saveDream } from "../lib/storage";

function Block({ title, body, expandable = true }) {
  const [open, setOpen] = useState(false);
  const long = body.length > 320;
  const shown = expandable && long && !open ? body.slice(0, 320) + "…" : body;
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <Text style={styles.blockBody}>{shown}</Text>
      {expandable && long && (
        <TouchableOpacity onPress={() => setOpen(!open)}>
          <Text style={styles.expand}>{open ? "عرض أقل" : "عرض المزيد"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ResultScreen({ route, navigation }) {
  const { dream, gender, questions = [], answers = [], interpretation } =
    route.params;
  const pretty = prettyInterpretation(interpretation);
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const fullText = `الحلم:\n${dream}\n\nالتفسير:\n${pretty}`;

  async function onCopy() {
    await Clipboard.setStringAsync(fullText);
    Alert.alert("تم", "تم نسخ النص");
  }

  async function onSave() {
    if (saved) return;
    await saveDream({
      dream,
      interpretation: pretty,
      gender,
      ts: Date.now(),
    });
    setSaved(true);
    Alert.alert("تم الحفظ", "تم حفظ الحلم في سجل الأحلام.");
  }

  async function onShareLink() {
    if (sharing) return;
    setSharing(true);
    setError("");
    try {
      const url = await createShare({
        dream,
        gender,
        questions,
        answers,
        interpretation,
      });
      setShareUrl(url);
      await Share.share({
        message: `تفسير حلمي — الجد حلمي\n${pretty.slice(0, 160)}…\n${url}`,
        url,
        title: "تفسير حلمي",
      });
    } catch (err) {
      setError(err && err.message ? err.message : "تعذر إنشاء الرابط.");
    } finally {
      setSharing(false);
    }
  }

  async function onShareNative() {
    try {
      await Share.share({ message: fullText, title: "تفسير حلمي" });
    } catch {}
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg1 }}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.head}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>نتيجة تفسير الحلم</Text>
        </View>
        <Text style={styles.title}>تفسير حلمك</Text>
      </View>

      <Block title="الحلم" body={dream} />
      <Block title="التفسير" body={pretty} />

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {shareUrl ? (
        <View style={styles.shareBox}>
          <Text style={styles.shareHint}>
            رابط خاص بك فقط — لا يظهر في أي مكان آخر. من يملك الرابط يرى الحلم.
          </Text>
          <Text style={styles.shareUrl} selectable>
            {shareUrl}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.primary, shadows.gold]}
          onPress={onShareLink}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator color="#1A1405" />
          ) : (
            <Text style={styles.primaryText}>مشاركة الحلم (رابط خاص)</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.8} style={styles.ghost} onPress={onShareNative}>
          <Text style={styles.ghostText}>مشاركة النص</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} style={styles.ghost} onPress={onCopy}>
          <Text style={styles.ghostText}>نسخ النص</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.8} style={styles.ghost} onPress={onSave}>
          <Text style={styles.ghostText}>
            {saved ? "تم الحفظ ✓" : "حفظ في السجل"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.primaryAlt}
          onPress={() => navigation.popToTop()}
        >
          <Text style={styles.primaryAltText}>حلم جديد</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  head: { alignItems: "center", marginBottom: spacing.lg },
  badge: {
    backgroundColor: colors.gold3,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 10,
  },
  badgeText: { color: colors.bg3, fontWeight: "800", fontSize: 12.5 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.gold3,
  },
  block: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  blockTitle: {
    color: colors.gold2,
    fontWeight: "800",
    fontSize: 13.5,
    marginBottom: 8,
  },
  blockBody: {
    color: "#E8EEF5",
    fontSize: 15.5,
    lineHeight: 28,
  },
  expand: {
    color: colors.gold3,
    fontWeight: "700",
    marginTop: 8,
    fontSize: 13.5,
  },
  errorBox: {
    marginTop: spacing.sm,
    backgroundColor: "rgba(255,123,123,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,123,123,0.3)",
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: colors.danger, fontSize: 13, textAlign: "center" },
  shareBox: {
    marginTop: spacing.sm,
    backgroundColor: "rgba(255,215,0,0.06)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,215,0,0.4)",
    borderRadius: 14,
    padding: spacing.md,
  },
  shareHint: {
    color: colors.muted3,
    fontSize: 12.5,
    marginBottom: 8,
    lineHeight: 20,
  },
  shareUrl: {
    color: colors.gold3,
    fontSize: 13,
    textAlign: "left",
    writingDirection: "ltr",
  },
  actions: { marginTop: spacing.md, gap: 10 },
  primary: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },
  primaryText: { color: "#1A1405", fontWeight: "800", fontSize: 15.5 },
  primaryAlt: {
    backgroundColor: "transparent",
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.gold,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryAltText: { color: colors.gold3, fontWeight: "800", fontSize: 15 },
  ghost: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  ghostText: { color: colors.muted2, fontWeight: "700", fontSize: 14.5 },
});
