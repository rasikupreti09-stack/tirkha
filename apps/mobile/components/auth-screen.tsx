import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { createPhoneAuth, phoneAuthError } from "@tirkha/shared";
import { useAuth } from "../providers/auth-provider";

export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const { client, error: sessionError } = useAuth();
  const [phone, setPhone] = useState("+977");
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"customer" | "professional">("customer");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const lock = useRef(false);
  useEffect(() => { const timer = setInterval(() => setCooldown(n => Math.max(0, n - 1)), 1000); return () => clearInterval(timer); }, []);
  async function submit(verify = sent) {
    if (!client || lock.current || (!verify && cooldown > 0)) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const auth = createPhoneAuth(client);
      const result = verify ? await auth.verifyPhoneOtp(phone, token)
        : await auth.signInWithPhone(phone, signup ? { full_name: name, role } : undefined);
      if (result.error) throw result.error;
      if (!verify) { setSent(true); setToken(""); setCooldown(60); }
    } catch (failure) { setError(phoneAuthError(failure)); }
    finally { lock.current = false; setBusy(false); }
  }

  const inputClass = "mb-4 min-h-12 rounded-md border border-border bg-background p-3 text-foreground";
  return <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
      <View className="w-full max-w-md self-center rounded-lg border border-border bg-card p-6">
        <Text accessibilityRole="header" className="mb-4 text-2xl font-semibold text-primary">Tirkha · {signup ? "Create account" : "Sign in"}</Text>
        <Text className="mb-4 text-muted-foreground">Use your Nepal mobile number. Email is optional.</Text>
        {(error || sessionError) && <Text accessibilityRole="alert" className="mb-4 text-foreground">{error || sessionError}</Text>}
        {process.env.EXPO_PUBLIC_TIRKHA_LOCAL_MOCK === "1" && <Text className="mb-4 text-foreground">Local demo only: code 123456. No SMS is sent.</Text>}
        {signup && !sent && <><Text className="text-foreground">Full name</Text><TextInput accessibilityLabel="Full name" className={inputClass} value={name} onChangeText={setName} maxLength={100} autoComplete="name" editable={!busy} />
          {(["customer", "professional"] as const).map(value => <Pressable key={value} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: role === value }} onPress={() => setRole(value)} className="mb-3 min-h-12 rounded-md border border-border p-3"><Text className="text-primary">{role === value ? "● " : "○ "}{value === "customer" ? "Customer" : "Professional (verification required)"}</Text></Pressable>)}</>}
        <Text className="text-foreground">Mobile number (+977)</Text><TextInput accessibilityLabel="Mobile number +977" className={inputClass} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" maxLength={14} editable={!busy && !sent} />
        {sent && <><Text accessibilityLiveRegion="polite" className="mb-2 text-foreground">Enter the SMS code for {phone}.</Text><TextInput accessibilityLabel="Six-digit SMS code" className={inputClass} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" value={token} onChangeText={v => setToken(v.replace(/\D/g, ""))} maxLength={6} editable={!busy} /></>}
        <Pressable accessibilityRole="button" disabled={busy || !client || (!sent && cooldown > 0)} onPress={() => void submit()} className="min-h-12 items-center justify-center rounded-md bg-primary p-3"><Text className="font-semibold text-primary-foreground">{busy ? "Please wait…" : sent ? "Verify and continue" : cooldown ? `Wait ${cooldown}s` : "Send SMS code"}</Text></Pressable>
        {sent && <><Pressable accessibilityRole="button" disabled={busy || cooldown > 0} onPress={() => void submit(false)} className="min-h-12 justify-center"><Text className="text-primary">{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => { setSent(false); setToken(""); setError(""); }} className="min-h-12 justify-center"><Text className="text-primary">Change number</Text></Pressable></>}
        <Link href={signup ? "/(auth)/login" : "/(auth)/signup"} className="mt-4 py-3 text-primary underline">{signup ? "Already registered? Sign in" : "New here? Create account"}</Link>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

