import { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { HERO_OPERATIONAL_ZONES, HERO_TRADES, heroRegistrationSchema, type HeroOperationalZone, type HeroTrade } from "@tirkha/shared";
import { randomUUID } from "expo-crypto";
import type { Account } from "../hooks/use-account";
import { useAuth } from "../providers/auth-provider";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const documentTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
const fileExtensions: Record<(typeof documentTypes)[number], string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
};

export function HeroRegistrationScreen({ account }: { account: Account }) {
  const { client } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(account.profile.full_name ?? "");
  const [trade, setTrade] = useState<HeroTrade>(account.professional?.trade_category ?? "PLUMBING");
  const [zone, setZone] = useState<HeroOperationalZone | "">(account.professional?.operational_zone ?? "");
  const [document, setDocument] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploadedDocument, setUploadedDocument] = useState<{ uri: string; path: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  async function chooseDocument() {
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: [...documentTypes], copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const selected = result.assets[0];
      if (!selected) throw new Error("Choose an ID image or PDF file.");
      if (!documentTypes.includes(selected.mimeType as (typeof documentTypes)[number])) throw new Error("Choose a JPG, PNG, WebP or PDF identity document.");
      if (selected.size !== undefined && selected.size > MAX_DOCUMENT_BYTES) throw new Error("The identity document must be 10 MB or smaller.");
      setDocument(selected);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not open the document picker. Try again.");
    }
  }

  async function submit() {
    if (!client || lock.current || busy) return;
    setError("");
    const parsed = heroRegistrationSchema.safeParse({ full_name: name, phone: account.profile.phone, trade_category: trade, operational_zone: zone });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your registration details."); return; }
    if (!document) { setError("Choose a citizenship card or government ID document."); return; }

    lock.current = true;
    setBusy(true);
    try {
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      if (authData.user.id !== account.profile.id) throw new Error("Your sign-in changed. Sign in again before submitting Hero verification.");

      const mimeType = document.mimeType as (typeof documentTypes)[number];
      const extension = fileExtensions[mimeType];
      // Keep and reuse a successful private upload after transient RPC failures.
      // A timed-out RPC can still have committed on the server, so deleting the
      // file in a catch block could leave a committed KYC record pointing at a
      // missing document.
      const previousUpload = uploadedDocument;
      let path = previousUpload && previousUpload.uri === document.uri ? previousUpload.path : null;
      if (!path) {
        const response = await fetch(document.uri);
        if (!response.ok) throw new Error("Could not read the selected identity document. Choose it again.");
        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength > MAX_DOCUMENT_BYTES) throw new Error("The identity document must be between 1 byte and 10 MB.");

        path = `${account.profile.id}/${randomUUID()}.${extension}`;
        const upload = await client.storage.from("hero-kyc-documents").upload(path, bytes, { contentType: mimeType, upsert: false });
        if (upload.error) throw upload.error;
        setUploadedDocument({ uri: document.uri, path });
      }

      const registration = await client.rpc("submit_hero_registration", {
        p_full_name: parsed.data.full_name,
        p_phone: parsed.data.phone,
        p_trade_code: parsed.data.trade_category,
        p_operational_zone: parsed.data.operational_zone,
        p_document_path: path,
      });
      if (registration.error) throw registration.error;
      if (previousUpload && previousUpload.path !== path) {
        // A prior successful-but-unacknowledged retry may have been replaced.
        // This cleanup is safe only after this registration has returned success.
        await client.storage.from("hero-kyc-documents").remove([previousUpload.path]);
      }
      router.replace("/(app)/dashboard");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not submit Hero registration. Check your connection and try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const buttonClass = "mb-3 min-h-12 justify-center rounded-md border border-border bg-card p-3";
  return <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
      <View className="w-full max-w-xl self-center rounded-lg border border-border bg-card p-6">
        <Text accessibilityRole="header" className="mb-2 text-2xl font-semibold text-primary">Complete Hero verification</Text>
        <Text className="mb-5 text-muted-foreground">Your profile stays pending and hidden from dispatch until an admin reviews your details.</Text>
        {!!error && <Text accessibilityRole="alert" className="mb-4 text-foreground">{error}</Text>}

        <Text className="mb-1 text-foreground">Full name</Text>
        <TextInput accessibilityLabel="Full name" className="mb-4 min-h-12 rounded-md border border-border bg-background p-3 text-foreground" value={name} onChangeText={setName} maxLength={100} editable={!busy} autoComplete="name" />
        <Text className="mb-1 text-foreground">Verified mobile number</Text>
        <Text accessibilityLabel={`Verified mobile number ${account.profile.phone}`} className="mb-4 min-h-12 rounded-md border border-border bg-background p-3 text-foreground">{account.profile.phone}</Text>

        <Text className="mb-2 font-medium text-foreground">Service trade</Text>
        {HERO_TRADES.map(value => <Pressable key={value} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: trade === value }} onPress={() => setTrade(value)} className={trade === value ? "mb-2 min-h-12 justify-center rounded-md border border-primary bg-primary/10 p-3" : buttonClass}>
          <Text className="text-foreground">{trade === value ? "● " : "○ "}{value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())}</Text>
        </Pressable>)}

        <Text className="mb-2 mt-3 font-medium text-foreground">Primary operating zone</Text>
        {HERO_OPERATIONAL_ZONES.map(value => <Pressable key={value} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: zone === value }} onPress={() => setZone(value)} className={zone === value ? "mb-2 min-h-12 justify-center rounded-md border border-primary bg-primary/10 p-3" : buttonClass}>
          <Text className="text-foreground">{zone === value ? "● " : "○ "}{value}</Text>
        </Pressable>)}

        <Text className="mb-2 mt-3 font-medium text-foreground">Private identity document</Text>
        <Text className="mb-3 text-sm text-muted-foreground">JPG, PNG, WebP or PDF · maximum 10 MB. Only you and authorized Tirkha admins can access this private file.</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void chooseDocument()} className={buttonClass}>
          <Text className="text-center font-medium text-primary">{document?.name ?? "Choose citizenship card or government ID"}</Text>
        </Pressable>
        {document?.size !== undefined && <Text className="mb-3 text-xs text-muted-foreground">Selected file · {(document.size / 1024 / 1024).toFixed(2)} MB</Text>}

        <Pressable accessibilityRole="button" disabled={busy || !client} onPress={() => void submit()} className="mt-4 min-h-12 items-center justify-center rounded-md bg-primary p-3">
          {busy ? <ActivityIndicator color="#F8FAFC" accessibilityLabel="Submitting Hero registration" /> : <Text className="font-semibold text-primary-foreground">Submit for admin review</Text>}
        </Pressable>
        <Text className="mt-3 text-xs text-muted-foreground">Your ID is not attached to bookings, chat messages, or earnings history. Do not upload documents for another person.</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
