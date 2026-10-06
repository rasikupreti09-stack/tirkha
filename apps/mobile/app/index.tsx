import { Text, View } from "react-native";
export default function Home() {
  return <View className="flex-1 bg-background p-6">
    <Text className="text-3xl font-semibold text-primary">Tirkha</Text>
    <Text className="mt-4 text-base text-muted-foreground">Home and daily assistance in Nepal.</Text>
    <View className="mt-8 rounded-lg border border-border bg-card p-6">
      <Text className="text-foreground">The mobile workspace is ready.</Text>
    </View>
  </View>;
}
