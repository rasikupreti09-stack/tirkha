import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Link } from "expo-router";
import { tokens, type ServiceCategory } from "@tirkha/shared";
import { loadCategories } from "../../../lib/discovery";

const initials: Record<string, string> = { plumbing: "PL", electrical: "EL", "home-cleaning": "HC", "appliance-repair": "AR", painting: "PA" };
export default function Categories() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const columns = useWindowDimensions().width >= 600 ? 2 : 1;
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    void loadCategories().then((data) => { if (active) setCategories(data); })
      .catch(() => { if (active) setError("Services could not be loaded. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  return <FlatList key={columns} numColumns={columns} data={loading || error ? [] : categories}
    keyExtractor={(item) => item.id} className="flex-1 bg-background"
    contentContainerStyle={{ padding: 20, flexGrow: 1 }} columnWrapperStyle={columns > 1 ? { gap: 16 } : undefined}
    ListHeaderComponent={<View className="mb-6">
      <Link href="/(app)/dashboard" className="mb-6 py-3 font-medium text-primary underline">← Dashboard</Link>
      <Text accessibilityRole="header" className="text-3xl font-semibold text-primary">Explore services</Text>
      <Text className="mt-3 text-base leading-6 text-muted-foreground">Find verified professionals for everyday help at home.</Text>
    </View>}
    ListEmptyComponent={loading ? <ActivityIndicator color={tokens.colors.primary} accessibilityLabel="Loading services" /> : error ? <View>
      <Text accessibilityRole="alert" className="text-foreground">{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)} className="mt-4 min-h-12 items-center justify-center rounded-md bg-primary px-4"><Text className="font-medium text-primary-foreground">Try again</Text></Pressable>
    </View> : <Text className="text-muted-foreground">Service categories are being prepared. Please check back soon.</Text>}
    renderItem={({ item }) => <Link href={{ pathname: "/(app)/categories/[slug]", params: { slug: item.slug } }} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={`${item.name}, view professionals`} className="mb-4 flex-1 rounded-lg border border-border bg-card p-6">
        <Text accessible={false} className="mb-5 text-lg font-semibold text-muted-foreground">{initials[item.slug] || "SV"}</Text>
        <Text className="text-xl font-semibold text-primary">{item.name}</Text>
        <Text className="mt-2 text-sm leading-6 text-muted-foreground">{item.description || "Explore professionals for this service."}</Text>
        <Text className="mt-5 font-medium text-primary underline">View professionals</Text>
      </Pressable>
    </Link>}
  />;
}
