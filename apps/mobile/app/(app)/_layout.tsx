import { Redirect, Tabs, useSegments } from "expo-router";
import { ActivityIndicator, Image, Text, View, type ColorValue } from "react-native";
import { tokens } from "@tirkha/shared";
import { useAuth } from "../../providers/auth-provider";
import { useAccount } from "../../hooks/use-account";
import { HeroLocationService } from "../../providers/hero-location-service";

function TabSymbol({ symbol, color }: { symbol: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 19, lineHeight: 22, fontWeight: "700" }}>{symbol}</Text>;
}
export default function AppLayout() {
  const { session, loading, isDemo } = useAuth();
  const { account } = useAccount();
  const isHero = account?.profile.role === "professional";
  const segments = useSegments();
  const activeRoute = segments[segments.length - 1];
  if (loading) return <View className="flex-1 items-center justify-center bg-background px-8">
    <ActivityIndicator size="large" color={tokens.colors.primary} accessibilityLabel="Loading account" />
    <Text accessibilityLiveRegion="polite" className="mt-5 text-xl font-semibold text-primary">Tirkha | तिर्खा</Text>
    <Text className="mt-2 text-center text-muted-foreground">Preparing your account…</Text>
  </View>;
  if (!session && !isDemo) return <Redirect href="/(auth)/login" />;
  const customerOnlyRoutes = ["index", "bookings", "assistant", "book", "categories"];
  const isHeroRoute = segments.includes("hero") || activeRoute === "jobs";
  if (isHero && customerOnlyRoutes.includes(activeRoute ?? "")) {
    return <Redirect href="/(app)/hero/index" />;
  }
  if (!isHero && isHeroRoute) return <Redirect href="/(app)" />;

  return <HeroLocationService account={account}>
    <View className="flex-1 bg-background">
      <View className="flex-row items-center border-b border-border bg-white px-5 py-3">
        <Image
          source={require("../../assets/icon.png")}
          accessibilityLabel="Tirkha logo"
          resizeMode="contain"
          style={{ width: 38, height: 38, borderRadius: 10 }}
        />
        <View className="ml-3">
          <Text className="text-base font-bold text-foreground">Tirkha | तिर्खा</Text>
          <Text className="text-[10px] font-semibold uppercase tracking-[2px] text-primary">
            {isHero ? "Hero Portal" : "Home Services"}
          </Text>
        </View>
      </View>
    <Tabs
      key={isHero ? "hero-tabs" : "customer-tabs"}
      initialRouteName={isHero ? "hero/index" : "index"}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: "#68736f",
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e2e9e5",
          height: 64,
          paddingTop: 7,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{
        title: "Services",
        tabBarLabel: "Services",
        href: isHero ? null : undefined,
        tabBarIcon: ({ color }) => <TabSymbol symbol="🛠️" color={color} />,
      }} />
      <Tabs.Screen name="bookings" options={{
        title: "Bookings",
        tabBarLabel: "Bookings",
        href: isHero ? null : undefined,
        tabBarIcon: ({ color }) => <TabSymbol symbol="📋" color={color} />,
      }} />
      <Tabs.Screen name="hero/index" options={{
        title: "Dashboard",
        tabBarLabel: "Dashboard",
        href: isHero ? undefined : null,
        tabBarIcon: ({ color }) => <TabSymbol symbol="📊" color={color} />,
      }} />
      <Tabs.Screen name="jobs" options={{
        title: "Jobs",
        tabBarLabel: "Jobs",
        href: isHero ? undefined : null,
        tabBarIcon: ({ color }) => <TabSymbol symbol="🧰" color={color} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: "Profile",
        tabBarLabel: "Profile",
        tabBarIcon: ({ color }) => <TabSymbol symbol="👤" color={color} />,
      }} />
      <Tabs.Screen name="assistant" options={{ href: null }} />
      <Tabs.Screen name="book" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
      <Tabs.Screen name="hero-register" options={{ href: null }} />
      <Tabs.Screen name="categories" options={{ href: null }} />
    </Tabs>
    </View>
  </HeroLocationService>;
}
