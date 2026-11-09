import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { colors, radius, spacing, shadows } from "../theme";
import { getInterpretation } from "../lib/api";
import { getCooldownLeftSec, setCooldownSec } from "../lib/storage";
import { toUserMessage } from "../lib/errors";
import { showRewardedAd } from "../lib/ads";

export default function QuestionsScreen({ route, navigation }) {
  const { dream, gender, guestId, questions } = route.params;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => questions.map(() => ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = questions.length;
  const isLast = index === total - 1;
  const progress = ((index + 1) / total) * 100;

  function setAnswerAt(i, value) {
    setAnswers((prev) => {
      if (prev[i] === value) return prev;
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  async function finish() {
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      await showRewardedAd({ timeoutMs: 10000 });
    } catch {}

    const left = await getCooldownLeftSec();
    if (left > 0) {
      await new Promise((r) => setTimeout(r, left * 1000 + 300));
    }

    try {
      const interpretation = await getInterpretation({
        dream,
        gender,
        answers,
        guestId,
      });
      await setCooldownSec(30);
      navigation.replace("Result", {
        dream,
        gender,
        questions,
        answers,
        interpretation,
      });
    } catch (err) {
      setError(await toUserMessage(err, "حدث خطأ أثناء الحصول على التفسير."));
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    if (busy) return;
    setError("");
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    finish();
  }

  if (busy) {
    return (
      <View style={styles.loadingWrap}>
        <View style={styles.moon} />
        <Text style={styles.loadingTitle}>جاري تحليل الحلم…</Text>
        <Text style={styles.loadingSub}>سيتم عرض التفسير خلال لحظات</Text>
        <ActivityIndicator color={colors.gold} style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.progressHead}>
          <Text style={styles.progressMuted}>التقدم</Text>
          <Text style={styles.progressVal}>
            {index + 1} / {total}
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </View>

        <View style={[styles.qCard, shadows.card]}>
          <View style={styles.qBadge}>
            <Text style={styles.qBadgeText}>السؤال {index + 1}</Text>
          </View>
          <Text style={styles.qText}>{questions[index]}</Text>
        </View>

        <TextInput
          style={styles.answer}
          multiline
          maxLength={1000}
          placeholder="اكتب إجابتك هنا..."
          placeholderTextColor={colors.muted}
          value={answers[index]}
          onChangeText={(v) => setAnswerAt(index, v)}
          textAlignVertical="top"
        />

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.ghostBtn}
            onPress={goNext}
            disabled={busy}
          >
            <Text style={styles.ghostText}>تخطي</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.nextBtn, shadows.gold]}
            onPress={goNext}
            disabled={busy}
          >
            <Text style={styles.nextText}>
              {isLast ? "عرض التفسير" : "التالي"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.md,
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  progressHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressMuted: { color: colors.muted3, fontSize: 13 },
  progressVal: { color: colors.gold3, fontWeight: "700", fontSize: 13 },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.gold,
  },
  qCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  qBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.gold3,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 12,
  },
  qBadgeText: { color: colors.bg3, fontWeight: "800", fontSize: 12 },
  qText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 30,
  },
  answer: {
    minHeight: 120,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    color: colors.text,
    padding: 14,
    fontSize: 15.5,
    lineHeight: 24,
  },
  errorBox: {
    marginTop: spacing.md,
    backgroundColor: "rgba(255,123,123,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,123,123,0.3)",
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: colors.danger, fontSize: 13, textAlign: "center" },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  ghostBtn: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingVertical: 15,
    alignItems: "center",
  },
  ghostText: { color: colors.muted2, fontWeight: "700", fontSize: 15 },
  nextBtn: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: "center",
  },
  nextText: { color: "#1A1405", fontWeight: "800", fontSize: 15.5 },
  loadingWrap: {
    flex: 1,
    backgroundColor: colors.bg1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  moon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gold3,
    marginBottom: 20,
    shadowColor: colors.gold,
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  loadingTitle: {
    color: colors.gold3,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  loadingSub: { color: colors.muted3, fontSize: 14, textAlign: "center" },
});
