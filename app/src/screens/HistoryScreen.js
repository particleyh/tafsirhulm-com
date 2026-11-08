import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors, radius, spacing } from "../theme";
import { loadHistory, removeDream, clearHistory } from "../lib/storage";

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function HistoryScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [openTs, setOpenTs] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadHistory().then((list) => {
        if (alive) setItems(list);
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  function onDelete(ts) {
    Alert.alert("حذف", "هل أنت متأكد من حذف هذا الحلم؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          const next = await removeDream(ts);
          setItems(next);
        },
      },
    ]);
  }

  function onClear() {
    Alert.alert("مسح السجل", "هل تريد حذف جميع الأحلام المحفوظة؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "مسح الكل",
        style: "destructive",
        onPress: async () => {
          await clearHistory();
          setItems([]);
        },
      },
    ]);
  }

  if (!items.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>لا توجد أحلام محفوظة</Text>
        <Text style={styles.emptySub}>
          ابدأ تفسير حلمك وسيتم حفظه هنا تلقائياً عند الضغط على «حفظ في السجل».
        </Text>
        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Home")}
        >
          <Text style={styles.ctaText}>تفسير حلم جديد</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg1 }}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.ts)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.count}>{items.length} حلم</Text>
            <TouchableOpacity onPress={onClear}>
              <Text style={styles.clear}>مسح الكل</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const open = openTs === item.ts;
          const body = open
            ? item.interpretation
            : item.interpretation.slice(0, 140) +
              (item.interpretation.length > 140 ? "…" : "");
          return (
            <View style={styles.card}>
              <Text style={styles.date}>{formatDate(item.ts)}</Text>
              <Text style={styles.dream} numberOfLines={open ? undefined : 2}>
                {item.dream}
              </Text>
              <Text style={styles.interp}>{body}</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  onPress={() => setOpenTs(open ? null : item.ts)}
                >
                  <Text style={styles.link}>
                    {open ? "عرض أقل" : "عرض المزيد"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete(item.ts)}>
                  <Text style={styles.del}>حذف</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  count: { color: colors.muted2, fontWeight: "700" },
  clear: { color: colors.danger, fontWeight: "700", fontSize: 13.5 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  date: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  dream: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 6,
  },
  interp: { color: colors.muted3, fontSize: 14, lineHeight: 24 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  link: { color: colors.gold3, fontWeight: "700", fontSize: 13.5 },
  del: { color: colors.danger, fontWeight: "700", fontSize: 13.5 },
  empty: {
    flex: 1,
    backgroundColor: colors.bg1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.gold3,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptySub: {
    color: colors.muted3,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  cta: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  ctaText: { color: "#1A1405", fontWeight: "800", fontSize: 15 },
});
