import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { createPhoneAuth, DEMO_PHONE_AUTH_CODE, HERO_TRADES, normalizeNepalPhoneNumber, phoneAuthError, phoneSchema, phoneSignupSchema, type HeroTrade } from "@tirkha/shared";
import { useAuth } from "../providers/auth-provider";

const demoAuthEnabled = process.env.EXPO_PUBLIC_TIRKHA_DEMO_AUTH === "1";

const isValidNepalMobile = (value: string) => /^(97|98)\d{8}$/.test(value.replace(/\D/g, "").replace(/^977/, ""));
export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const { client, error: sessionError, demoSignIn } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("+977");
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"customer" | "professional">("customer");
  const [trade, setTrade] = useState<HeroTrade>("PLUMBING");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const lock = useRef(false);
  const nationalNumber = phone.replace(/\D/g, "").replace(/^977/, "");
  const normalizedPhone = `+977${nationalNumber}`;
  const localDigits = normalizedPhone.replace(/\D/g, "").replace(/^977/, "");
  const isDemoPhone = demoAuthEnabled && phoneSchema.safeParse(normalizedPhone).success && /^(97|98)/.test(localDigits);
  useEffect(() => { const timer = setInterval(() => setCooldown(n => Math.max(0, n - 1)), 1000); return () => clearInterval(timer); }, []);
  async function submit(verify = sent) {
    if (lock.current || (!verify && cooldown > 0)) return;
    if (!isValidNepalMobile(nationalNumber)) {
      setError("Enter a valid 10-digit Nepal mobile number beginning with 97 or 98.");
      return;
    }
    if (!verify && isDemoPhone) {
      if (signup) {
        try {
          phoneSignupSchema.parse({ full_name: name, role, ...(role === "professional" ? { trade_category: trade } : {}) });
        } catch (failure) { setError(phoneAuthError(failure)); return; }
      }
      setSent(true); setToken(""); setError(""); setCooldown(0);
      return;
    }
    if (verify && isDemoPhone) {
      if (token.trim() !== DEMO_PHONE_AUTH_CODE) {
        setError(`For demo sign-in, enter ${DEMO_PHONE_AUTH_CODE}.`);
        return;
      }
      lock.current = true; setBusy(true); setError("");
      try {
        await demoSignIn(normalizedPhone, role, name || "Tirkha Demo User", role === "professional" ? trade : undefined);
        router.replace("/(app)/assistant");
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Demo sign-in could not be saved. Please try again."); }
      finally { lock.current = false; setBusy(false); }
      return;
    }
    if (!client) { setError(sessionError || "Phone sign-in is unavailable. Check your connection or use demo sign-in with a Nepal 97/98 number."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const auth = createPhoneAuth(client);
      const result = verify ? await auth.verifyPhoneOtp(normalizedPhone, token)
        : await auth.signInWithPhone(normalizedPhone, signup ? { full_name: name, role, ...(role === "professional" ? { trade_category: trade } : {}) } : undefined);
      if (result.error) throw result.error;
      if (!verify) { setSent(true); setToken(""); setCooldown(60); }
      else router.replace("/(app)/assistant");
    } catch (failure) { setError(phoneAuthError(failure)); }
    finally { lock.current = false; setBusy(false); }
  }

  const inputClass = "mb-4 min-h-12 rounded-md border border-border bg-background p-3 text-foreground";
  return <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
      <View className="w-full max-w-md self-center rounded-lg border border-border bg-card p-6">
        <Text accessibilityRole="header" className="mb-4 text-2xl font-semibold text-primary">Tirkha · {signup ? "Create account" : "Sign in"}</Text>
        <Text className="mb-4 text-muted-foreground">Choose your account type, then use your Nepal mobile number.</Text>
        {(error || (!isDemoPhone && sessionError)) && <Text accessibilityRole="alert" className="mb-4 text-foreground">{error || sessionError}</Text>}
        <View accessibilityRole="radiogroup" className="mb-4 flex-row gap-3">
          {(["customer", "professional"] as const).map(value => <Pressable key={value} disabled={busy || sent} accessibilityRole="radio" accessibilityState={{ checked: role === value }} onPress={() => setRole(value)} className={role === value ? "min-h-12 flex-1 justify-center rounded-md border border-primary bg-primary/10 p-3" : "min-h-12 flex-1 justify-center rounded-md border border-border p-3"}><Text className="text-center text-primary">{role === value ? "● " : "○ "}{value === "customer" ? "Customer" : "Hero"}</Text></Pressable>)}
        </View>
        {demoAuthEnabled && <Text accessibilityRole="text" className="mb-4 rounded-md border border-border bg-muted p-3 text-foreground">Demo sign-in is on for Nepal 97/98 numbers. Enter any valid number, then use code {DEMO_PHONE_AUTH_CODE}. This demo account is stored on this device and cannot access live bookings or Hero dispatch.</Text>}
        {signup && !sent && <><Text className="text-foreground">Full name</Text><TextInput accessibilityLabel="Full name" className={inputClass} value={name} onChangeText={setName} maxLength={100} autoComplete="name" editable={!busy} />
          </>}
        {signup && role === "professional" && <View className="mb-3">
          <Text className="mb-2 font-medium text-foreground">Your main service trade</Text>
          {HERO_TRADES.map(value => <Pressable key={value} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: trade === value }} onPress={() => setTrade(value)} className={trade === value ? "mb-2 min-h-12 justify-center rounded-md border border-primary bg-primary/10 p-3" : "mb-2 min-h-12 justify-center rounded-md border border-border bg-card p-3"}>
            <Text className="text-foreground">{trade === value ? "● " : "○ "}{value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())}</Text>
          </Pressable>)}
          <Text className="text-xs text-muted-foreground">Your Hero profile remains pending until the required verification is completed.</Text>
        </View>}
        <Text className="text-foreground">Mobile number (+977)</Text><View className="flex-row items-center"><Text className="mr-3 font-semibold text-slate-900">+977</Text><TextInput accessibilityLabel="Mobile number +977" className={inputClass} value={phone.replace(/^\+?977/, "")} onChangeText={value => {
          const digits = value.replace(/\D/g, "");
          const national = digits.startsWith("977") ? digits.slice(3) : digits;
          setPhone(`+977${national.slice(0, 10)}`);
        }} keyboardType="phone-pad" autoComplete="tel-national" maxLength={10} editable={!busy && !sent} /></View>
        {sent && <><Text accessibilityLiveRegion="polite" className="mb-2 text-foreground">Enter the SMS code for {phone}.</Text><TextInput accessibilityLabel="Six-digit SMS code" className={inputClass} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" value={token} onChangeText={v => setToken(v.replace(/\D/g, ""))} maxLength={6} editable={!busy} /></>}
        {sent && isDemoPhone && <Text accessibilityLiveRegion="polite" className="mb-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 font-semibold text-emerald-900">Demo Mode: Enter OTP {DEMO_PHONE_AUTH_CODE}</Text>}
        <Pressable accessibilityRole="button" disabled={busy || (!client && !isDemoPhone) || (!sent && cooldown > 0)} onPress={() => void submit()} className="min-h-12 items-center justify-center rounded-md bg-primary p-3"><Text className="font-semibold text-primary-foreground">{busy ? "Please wait…" : sent ? "Verify and continue" : cooldown ? `Wait ${cooldown}s` : isDemoPhone ? "Continue with demo code" : "Send SMS code"}</Text></Pressable>
        {sent && <><Pressable accessibilityRole="button" disabled={busy || cooldown > 0} onPress={() => void submit(false)} className="min-h-12 justify-center"><Text className="text-primary">{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => { setSent(false); setToken(""); setError(""); }} className="min-h-12 justify-center"><Text className="text-primary">Change number</Text></Pressable></>}
        <Link href={signup ? "/(auth)/login" : "/(auth)/signup"} className="mt-4 py-3 text-primary underline">{signup ? "Already registered? Sign in" : "New here? Create account"}</Link>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

