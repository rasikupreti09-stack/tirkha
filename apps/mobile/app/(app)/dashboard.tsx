import { Link } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { tokens, translateUi } from "@tirkha/shared";
import { useAccount } from "../../hooks/use-account";
import { NotificationSettings } from "../../components/notification-settings";
import { LanguageSwitcher } from "../../components/language-switcher";
import { disablePushNotifications } from "../../lib/notifications";
import { useLanguage } from "../../providers/language-provider";

export default function Dashboard() {
  const state = useAccount();
  const { language } = useLanguage();
  const t = (key: Parameters<typeof translateUi>[0]) => translateUi(key, language);

  async function signOut() {
    if (state.signOutBusy) return;
    try {
      if (!state.isDemo && state.session) await disablePushNotifications();
      await state.signOut();
    } catch (failure) {
      state.setNotice(failure instanceof Error ? failure.message : t("signOutFailed"));
    }
  }

  if (state.accountLoading) return <View className="flex-1 items-center justify-center bg-background p-8">
    <ActivityIndicator color={tokens.colors.primary} accessibilityLabel={t("loadingAccount")} />
    <Text className="mt-4 text-center text-muted-foreground">{t("loadingAccount")}</Text>
  </View>;

  if (!state.account) return <View className="flex-1 justify-center bg-background p-6">
    <Text accessibilityRole="header" className="mb-2 text-2xl font-semibold text-primary">{t("dashboardUnavailable")}</Text>
    <Text accessibilityRole="alert" className="mb-5 text-foreground">{state.accountError || t("accountUnavailable")}</Text>
    <Pressable accessibilityRole="button" onPress={state.retry} className="min-h-12 items-center justify-center rounded-md bg-primary p-3">
      <Text className="font-semibold text-primary-foreground">{t("tryAgain")}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => void signOut()} className="mt-2 min-h-12 items-center justify-center p-3">
      <Text className="text-primary underline">{t("signOutAndReturn")}</Text>
    </Pressable>
  </View>;

  const { profile, professional } = state.account;
  return <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
    <View className="mb-5 flex-row items-center justify-between">
      <View>
        <Text className="text-2xl font-semibold text-primary">Tirkha | तिर्खा</Text>
        <Text className="text-sm text-muted-foreground">{t("tagline")}</Text>
      </View>
      <Pressable accessibilityRole="button" disabled={state.signOutBusy} onPress={() => void signOut()} className="min-h-11 justify-center rounded-md border border-border px-4 py-3">
        <Text className="font-medium text-primary">{state.signOutBusy ? t("signingOut") : t("signOut")}</Text>
      </Pressable>
    </View>
    <View className="mb-6 flex-row items-center justify-between">
      <Text className="font-medium text-muted-foreground">{t("dashboard")}</Text>
      <LanguageSwitcher />
    </View>

    {state.notice ? <Text accessibilityRole="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-foreground">{state.notice}</Text> : null}
    {state.isDemo ? <View className="mb-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
      <Text className="mb-1 font-semibold text-emerald-950">{t("demoSession")}</Text>
      <Text className="text-emerald-900">{language === "np"
        ? `तपाईं ${profile.role === "professional" ? "Hero" : "ग्राहक"} पूर्वावलोकनका रूपमा साइन इन हुनुहुन्छ। सुरक्षित रूपमा एप हेर्नुहोस्; डेमो अनुरोधले प्रत्यक्ष बुकिङ बनाउँदैन, Hero लाई सम्पर्क गर्दैन वा भुक्तानी पठाउँदैन।`
        : `You are signed in as a ${profile.role === "professional" ? "Hero" : "customer"} preview. Browse the app safely; demo requests do not create live bookings, contact Heroes, or send payments.`}</Text>
    </View> : null}

    <View className="mb-5 rounded-lg border border-border bg-card p-5">
      <Text accessibilityRole="header" className="mb-1 text-2xl font-semibold text-foreground">Namaste, {profile.full_name || "there"}</Text>
      <Text className="mb-5 capitalize text-muted-foreground">{profile.role === "professional" ? `${professional?.trade_category?.replaceAll("_", " ").toLowerCase() || "service"} Hero` : t("customerAccount")}</Text>
      <Link href="/(app)/categories" asChild>
        <Pressable accessibilityRole="button" className="mb-3 min-h-12 items-center justify-center rounded-md bg-primary px-4 py-3">
          <Text className="font-semibold text-primary-foreground">{t("exploreServices")}</Text>
        </Pressable>
      </Link>
      {profile.role === "customer" && !state.isDemo ? <>
        <Link href="/(app)/book" asChild>
          <Pressable accessibilityRole="button" className="mb-3 min-h-12 items-center justify-center rounded-md border border-border px-4 py-3">
            <Text className="font-semibold text-primary">{t("requestService")}</Text>
          </Pressable>
        </Link>
        <Link href="/(app)/bookings" asChild>
          <Pressable accessibilityRole="button" className="min-h-12 items-center justify-center px-3 py-2">
            <Text className="text-primary underline">{language === "np" ? "मेरा बुकिङहरू" : "My bookings"}</Text>
          </Pressable>
        </Link>
      </> : null}
      {profile.role === "professional" ? <View className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-4">
        <Text className="mb-1 font-semibold text-foreground">{state.isDemo ? t("heroPreview") : `${t("verification")}: ${professional?.verification_status ?? (language === "np" ? "प्रतीक्षामा" : "pending")}`}</Text>
        <Text className="mb-3 text-foreground">{state.isDemo
          ? language === "np" ? "प्रत्यक्ष काम र GPS साझेदारीका लागि प्रमाणित, डेटाबेसमा जोडिएको Hero खाता आवश्यक हुन्छ।" : "Live job dispatch and GPS sharing need a verified, database-backed Hero account."
          : professional?.verification_status === "verified" ? t("verifiedProfile") : t("pendingReview")}</Text>
        {!state.isDemo && (!professional?.operational_zone || !professional?.citizenship_document_path) ? <Link href="/(app)/hero-register" asChild><Pressable accessibilityRole="button" className="min-h-11 items-center justify-center rounded-md bg-primary p-3"><Text className="font-semibold text-primary-foreground">{t("continueRegistration")}</Text></Pressable></Link> : null}
        {!state.isDemo && professional?.verification_status === "verified" ? <Link href="/(app)/jobs" asChild><Pressable accessibilityRole="button" className="min-h-11 items-center justify-center rounded-md bg-primary p-3"><Text className="font-semibold text-primary-foreground">{t("openJobBoard")}</Text></Pressable></Link> : null}
      </View> : null}
      {profile.role === "customer" && state.isDemo ? <Text className="mt-3 text-sm text-muted-foreground">{t("liveBookingsRequireAccount")}</Text> : null}
    </View>
    {!state.isDemo && state.session ? <NotificationSettings /> : null}
  </ScrollView>;
}
