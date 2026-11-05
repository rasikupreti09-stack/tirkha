import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { tokens, type ServiceCategory } from "@tirkha/shared";
import { loadCategories } from "../../../lib/discovery";

const initials: Record<string, string> = { plumbing: "PL", electrical: "EL", "home-cleaning": "HC", "appliance-repair": "AR", painting: "PA" };
export default function Categories() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const columns = useWindowDimensions().width >= 600 ? 2 : 1;
  const router = useRouter();
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    void loadCategories().then((data) => { if (active) setCategories(data); })
      .catch(() => { if (active) setError("Services could not be loaded. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  return (
    <FlatList
      key={columns}
      numColumns={columns}
      data={loading || error ? [] : categories}
      keyExtractor={(item) => item.id}
      style={styles.list}
      contentContainerStyle={styles.content}
      columnWrapperStyle={columns > 1 ? styles.columns : undefined}
      ListHeaderComponent={
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(app)/dashboard")}
            style={styles.backButton}
            hitSlop={8}
          >
            <Text style={styles.backText}>← Dashboard</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>Explore services</Text>
          <Text style={styles.subtitle}>Find verified professionals for everyday help at home.</Text>
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={tokens.colors.primary} accessibilityLabel="Loading services" />
            <Text style={styles.stateText}>Loading services…</Text>
          </View>
        ) : error ? (
          <View style={styles.state}>
            <Text accessibilityRole="alert" style={styles.stateText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAttempt((value) => value + 1)}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.stateText}>Service categories are being prepared. Please check back soon.</Text>
        )
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, view professionals`}
          onPress={() => router.push({ pathname: "/(app)/categories/[slug]", params: { slug: item.slug } })}
          style={({ pressed }) => [
            styles.card,
            columns > 1 ? styles.gridCard : styles.singleCard,
            pressed && styles.cardPressed,
          ]}
        >
          <Text accessible={false} style={styles.initials}>{initials[item.slug] || "SV"}</Text>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.description}>{item.description || "Explore professionals for this service."}</Text>
          <Text style={styles.action}>View professionals</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: tokens.colors.background },
  content: { padding: 20, paddingBottom: 32, flexGrow: 1 },
  columns: { gap: 16, alignItems: "stretch" },
  header: { marginBottom: 24 },
  backButton: { alignSelf: "flex-start", paddingVertical: 12, marginBottom: 16 },
  backText: { color: tokens.colors.primary, fontSize: 16, fontWeight: "600", textDecorationLine: "underline" },
  title: { color: tokens.colors.primary, fontSize: 30, lineHeight: 38, fontWeight: "700" },
  subtitle: { color: tokens.colors["muted-foreground"], fontSize: 16, lineHeight: 24, marginTop: 10 },
  state: { paddingVertical: 28, alignItems: "center", gap: 12 },
  stateText: { color: tokens.colors["muted-foreground"], fontSize: 16, lineHeight: 24 },
  retryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: tokens.colors.primary, paddingHorizontal: 20 },
  retryText: { color: tokens.colors["primary-foreground"], fontSize: 16, fontWeight: "600" },
  card: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 18,
    backgroundColor: tokens.colors.card,
  },
  singleCard: { width: "100%" },
  gridCard: { flex: 1, minWidth: 0 },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  initials: { color: tokens.colors["muted-foreground"], fontSize: 18, lineHeight: 24, fontWeight: "700", marginBottom: 20 },
  cardTitle: { color: tokens.colors.primary, fontSize: 21, lineHeight: 28, fontWeight: "700" },
  description: { color: tokens.colors["muted-foreground"], fontSize: 16, lineHeight: 24, marginTop: 8 },
  action: { color: tokens.colors.primary, fontSize: 16, lineHeight: 22, fontWeight: "600", textDecorationLine: "underline", marginTop: 20 },
});
