import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens, translateUi } from "@tirkha/shared";
import { useLanguage } from "../providers/language-provider";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Choose app language" style={styles.container}>
      {(["en", "np"] as const).map((option) => {
        const selected = language === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option === "en" ? "English" : "नेपाली"}
            onPress={() => setLanguage(option)}
            style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{option === "en" ? "English" : "नेपाली"}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", padding: 3, borderRadius: 999, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.card },
  option: { minHeight: 40, minWidth: 76, justifyContent: "center", alignItems: "center", paddingHorizontal: 12, borderRadius: 999 },
  selected: { backgroundColor: tokens.colors.primary },
  pressed: { opacity: 0.78 },
  label: { color: tokens.colors.primary, fontSize: 13, fontWeight: "600" },
  selectedLabel: { color: tokens.colors["primary-foreground"] },
});
