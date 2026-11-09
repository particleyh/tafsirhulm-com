import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";
import HomeScreen from "./src/screens/HomeScreen";
import QuestionsScreen from "./src/screens/QuestionsScreen";
import ResultScreen from "./src/screens/ResultScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import BannerFooter from "./src/components/BannerFooter";
import { colors } from "./src/theme";
import { initAds } from "./src/lib/ads";

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg1,
    card: colors.bg1,
    text: colors.text,
    primary: colors.gold,
    border: colors.line,
  },
};

function RootLayout() {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    initAds().catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg1 }}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg1 },
          headerTintColor: colors.gold3,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.bg1 },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Questions"
          component={QuestionsScreen}
          options={{ title: "أسئلة الحلم", headerBackTitle: "رجوع" }}
        />
        <Stack.Screen
          name="Result"
          component={ResultScreen}
          options={{ title: "التفسير", headerBackVisible: false }}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: "سجل الأحلام", headerBackTitle: "رجوع" }}
        />
      </Stack.Navigator>
      <BannerFooter safeBottom={insets.bottom} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        <RootLayout />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
