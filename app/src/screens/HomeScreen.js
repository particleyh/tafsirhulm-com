import React, { useMemo, useState } from "react";
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
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing, shadows } from "../theme";
import { startInterpretation } from "../lib/api";
import { getCooldownLeftSec, setCooldownSec } from "../lib/storage";

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [dream, setDream] = useState("");
  const [gender, setGender] = useState("male");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => dream.trim().length >= 10, [dream]);

  async function onStart() {
    if (busy) return;
    setError("");
    const text = dream.trim();
    if (text.length < 10) {
      setError("يرجى كتابة تفاصيل أكثر عن حلمك");
      return;
    }
    const left = await getCooldownLeftSec();
    if (left > 0) {
      setError(`انتظر ${left} ثانية قبل محاولة جديدة`);
      return;
    }

    setBusy(true);
    try {
      const { guestId, questions } = await startInterpretation({
        dream: text,
        gender,
      });
      if (!questions.length) throw new Error("لا يوجد سؤال متاح، حاول مرة أخرى.");
      navigation.navigate("Questions", {
        dream: text,
        gender,
        guestId,
        questions,
      });
    } catch (err) {
      let msg =
        err && err.message ? err.message : "حدث خطأ أثناء تجهيز الأسئلة.";
      if (err && err.status === 429 && err.data && err.data.retry_after) {
        await setCooldownSec(err.data.retry_after);
        msg = err.data.error || msg;
      } else if (err && err.name === "AbortError") {
        msg = "انتهت المهلة، تحقق من اتصالك وحاول مجدداً.";
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>مفسّر الأحلام{"\n"}بالذكاء الاصطناعي</Text>
          <Text style={styles.subtitle}>
            اكتب حلمك، أجب عن أسئلة قصيرة، واحصل على تفسير فوري خلال لحظات.
          </Text>
        </View>

        <View style={[styles.card, shadows.card]}>
          <Text style={styles.label}>نص الحلم</Text>
          <TextInput
            style={styles.input}
            multiline
            maxLength={3000}
            placeholder="اكتب حلمك هنا..."
            placeholderTextColor={colors.muted}
            value={dream}
            onChangeText={setDream}
            textAlignVertical="top"
          />

          <View style={styles.genderRow}>
            {[
              { id: "male", icon: "♂", label: "ذكر" },
              { id: "female", icon: "♀", label: "أنثى" },
            ].map((g) => {
              const selected = gender === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  activeOpacity={0.8}
                  style={[styles.genderBtn, selected && styles.genderBtnOn]}
                  onPress={() => setGender(g.id)}
                >
                  <Text style={[styles.genderIcon, selected && styles.genderTextOn]}>
                    {g.icon}
                  </Text>
                  <Text style={[styles.genderLabel, selected && styles.genderTextOn]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.cta, (!canSubmit || busy) && styles.ctaDisabled, shadows.gold]}
            onPress={onStart}
            disabled={busy || !canSubmit}
          >
            {busy ? (
              <ActivityIndicator color="#1A1405" />
            ) : (
              <Text style={styles.ctaText}>ابدأ التفسير</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>مجاني بالكامل · بدون تسجيل · خصوصية تامة</Text>
        </View>

        <TouchableOpacity
          style={styles.historyLink}
          onPress={() => navigation.navigate("History")}
        >
          <Text style={styles.historyLinkText}>سجل الأحلام ←</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.md,
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  hero: { alignItems: "center", marginBottom: spacing.lg },
  logo: {
    width: 88,
    height: 88,
    marginBottom: spacing.sm,
    borderRadius: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    color: colors.gold3,
    lineHeight: 38,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted3,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  label: {
    color: colors.muted2,
    fontWeight: "700",
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 150,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    color: colors.text,
    padding: 14,
    fontSize: 16,
    lineHeight: 26,
  },
  genderRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  genderBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  genderBtnOn: {
    borderColor: colors.gold,
    backgroundColor: "rgba(255,215,0,0.1)",
  },
  genderIcon: { fontSize: 22, color: colors.muted2, marginBottom: 2 },
  genderLabel: { fontSize: 15, fontWeight: "700", color: colors.muted2 },
  genderTextOn: { color: colors.gold3 },
  errorBox: {
    marginTop: spacing.md,
    backgroundColor: "rgba(255,123,123,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,123,123,0.3)",
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: colors.danger, fontSize: 13, textAlign: "center" },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { color: "#1A1405", fontWeight: "800", fontSize: 17 },
  hint: {
    marginTop: spacing.md,
    textAlign: "center",
    color: colors.muted,
    fontSize: 12.5,
  },
  historyLink: {
    marginTop: spacing.lg,
    alignSelf: "center",
    padding: spacing.sm,
  },
  historyLinkText: { color: colors.gold3, fontWeight: "700", fontSize: 15 },
});
