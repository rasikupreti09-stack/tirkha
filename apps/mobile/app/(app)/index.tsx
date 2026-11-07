import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

type CatalogRecord = Record<string, unknown>;

const SERVICE_CATEGORIES: CatalogRecord[] = [
  {
    id: "plumbing",
    name: "Plumbing · प्लम्बिङ",
    description: "Leaks, taps, pipes, drains, and water systems.",
    imageUrl: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1200&q=85",
    services: [
      { id: "plumbing-inspection", name: "Plumbing inspection", description: "A technician checks the fault and explains the repair scope.", listedRate: 650, duration: "On-site assessment" },
      { id: "tap-repair", name: "Tap and faucet repair", description: "Repair common tap leaks and worn fittings.", listedRate: 350, duration: "Per unit" },
      { id: "drain-clearing", name: "Drain clearing", description: "Clear a blocked household waste pipe or drain.", listedRate: "500+", duration: "Depends on blockage" },
    ],
  },
  {
    id: "electrical",
    name: "Electrical · इलेक्ट्रिकल",
    description: "Safer help with switches, sockets, lights, and breakers.",
    imageUrl: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1200&q=85",
    services: [
      { id: "electrical-inspection", name: "Electrical safety inspection", description: "On-site diagnosis for electrical faults and breaker issues.", listedRate: 650, duration: "On-site assessment" },
      { id: "switch-socket", name: "Switch or socket replacement", description: "Replacement rate depends on the fitting and parts required.", listedRate: "350–500", duration: "Per unit" },
    ],
  },
  {
    id: "appliance-repair",
    name: "Appliance repair · उपकरण मर्मत",
    description: "Diagnosis and repair support for everyday home appliances.",
    imageUrl: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1200&q=85",
    services: [{ id: "appliance-diagnosis", name: "Appliance diagnosis", description: "Tell us which appliance needs attention to start a service request." }],
  },
  {
    id: "ac-service",
    name: "Heating & AC · एसी सेवा",
    description: "Home cooling and heating maintenance and repair.",
    imageUrl: "https://images.unsplash.com/photo-1631545806609-4b1d5d6cc6a5?auto=format&fit=crop&w=1200&q=85",
    services: [{ id: "ac-repair", name: "AC service and repair", description: "A Hero assesses the unit and confirms the scope before work." }],
  },
  {
    id: "home-cleaning",
    name: "Home cleaning · घर सरसफाइ",
    description: "Cleaning support for a more comfortable home.",
    imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=85",
    services: [{ id: "home-cleaning", name: "Home cleaning", description: "Choose the cleaning help you need; the final scope is confirmed before booking." }],
  },
  {
    id: "painting",
    name: "Painting · रङरोगन",
    description: "Interior and exterior painting, wall preparation, and touch-ups.",
    imageUrl: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1200&q=85",
    services: [{ id: "painting", name: "Painting service", description: "Share the room or surface details for an accurate on-site scope." }],
  },
  {
    id: "carpentry",
    name: "Carpentry · सिकर्मी काम",
    description: "Furniture, doors, fittings, and everyday woodwork repairs.",
    imageUrl: "https://images.unsplash.com/photo-1601058268499-e52658b8bb88?auto=format&fit=crop&w=1200&q=85",
    services: [{ id: "carpentry", name: "Carpentry and furniture repair", description: "Describe the repair to get connected with the right service." }],
  },
  {
    id: "home-repair",
    name: "Home repair · घरेलु मर्मत",
    description: "Practical help for small household repairs and installations.",
    imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=85",
    services: [{ id: "home-repair", name: "General home repair", description: "A Hero can review the task and confirm the price and scope." }],
  },
];

function asRecord(value: unknown): CatalogRecord | null {
  return value !== null && typeof value === "object" ? value as CatalogRecord : null;
}

function textField(record: CatalogRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function photoField(record: CatalogRecord): string | undefined {
  const direct = textField(record, "imageUrl", "image_url", "photo", "image", "thumbnail", "coverImage");
  if (direct) return direct;
  const images = record.images;
  return Array.isArray(images) && typeof images[0] === "string" ? images[0] : undefined;
}

function priceField(record: CatalogRecord): string | undefined {
  const value = record.listedRate ?? record.listed_rate ?? record.price ?? record.basePrice ?? record.base_price;
  if (typeof value === "number" && Number.isFinite(value)) return `रू ${value.toLocaleString("en-IN")}`;
  if (typeof value === "string" && value.trim()) return value.includes("रू") || value.toLowerCase().includes("rs") ? value : `रू ${value}`;
  const minimum = record.minPrice ?? record.min_price;
  const maximum = record.maxPrice ?? record.max_price;
  if (typeof minimum === "number" && typeof maximum === "number") return `रू ${minimum.toLocaleString("en-IN")}–${maximum.toLocaleString("en-IN")}`;
  if (typeof minimum === "number") return `रू ${minimum.toLocaleString("en-IN")}+`;
  return undefined;
}

function catalogEntries(): CatalogRecord[] {
  return SERVICE_CATEGORIES;
}

export default function AppHome() {
  const router = useRouter();
  const categories = useMemo(catalogEntries, []);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const visibleCategories = selectedCategory
    ? categories.filter((category) => textField(category, "id", "slug", "name", "title") === selectedCategory)
    : categories;

  const openAssistant = (category?: CatalogRecord) => {
    const id = category ? textField(category, "id", "slug", "name", "title") : undefined;
    router.push(id ? { pathname: "/(app)/assistant", params: { category: id } } : "/(app)/assistant");
  };

  return (
    <View className="flex-1 bg-[#f7faf8]">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 112 }}>
        <View className="px-5 pb-5 pt-6">
          <Text className="text-[13px] font-semibold uppercase tracking-[2px] text-[#087e65]">TIRKHA · तिर्खा</Text>
          <Text className="mt-2 text-[30px] font-bold leading-[36px] text-[#202b39]">Home services, made easier.</Text>
          <Text className="mt-2 text-base leading-6 text-[#65716f]">Browse trusted help for your home, with clear service details and listed rates.</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 18, gap: 9 }}>
          <Pressable onPress={() => setSelectedCategory(null)} className={`rounded-full border px-4 py-2.5 ${selectedCategory === null ? "border-[#087e65] bg-[#087e65]" : "border-[#dce6e0] bg-white"}`}>
            <Text className={`font-semibold ${selectedCategory === null ? "text-white" : "text-[#34423e]"}`}>All services · सबै सेवा</Text>
          </Pressable>
          {categories.map((category, index) => {
            const id = textField(category, "id", "slug", "name", "title") ?? `category-${index}`;
            const title = textField(category, "name", "title", "label") ?? "Home service";
            const active = selectedCategory === id;
            return (
              <Pressable key={id} onPress={() => setSelectedCategory(active ? null : id)} className={`rounded-full border px-4 py-2.5 ${active ? "border-[#087e65] bg-[#087e65]" : "border-[#dce6e0] bg-white"}`}>
                <Text className={`font-semibold ${active ? "text-white" : "text-[#34423e]"}`}>{title}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="px-5">
          {visibleCategories.map((category, categoryIndex) => {
            const categoryId = textField(category, "id", "slug", "name", "title") ?? `category-${categoryIndex}`;
            const categoryName = textField(category, "name", "title", "label") ?? "Home service";
            const categoryDescription = textField(category, "description", "summary", "shortDescription", "short_description");
            const categoryPhoto = photoField(category);
            const rawServices = category.services ?? category.offerings ?? category.items;
            const serviceRecords = Array.isArray(rawServices)
              ? rawServices.map(asRecord).filter((item): item is CatalogRecord => item !== null)
              : [];
            const cards = serviceRecords.length ? serviceRecords : [category];

            return (
              <View key={categoryId} className="mb-6">
                <Text className="mb-3 text-xl font-bold text-[#202b39]">{categoryName}</Text>
                {categoryDescription ? <Text className="mb-3 text-sm leading-5 text-[#65716f]">{categoryDescription}</Text> : null}
                {cards.map((service, serviceIndex) => {
                  const serviceId = textField(service, "id", "slug", "serviceId", "service_id") ?? categoryId;
                  const title = textField(service, "name", "title", "label") ?? categoryName;
                  const description = textField(service, "description", "summary", "shortDescription", "short_description") ?? categoryDescription;
                  const image = photoField(service) ?? categoryPhoto;
                  const rate = priceField(service) ?? priceField(category);
                  const duration = textField(service, "duration", "estimatedDuration", "estimated_duration");

                  return (
                    <Pressable key={`${serviceId}-${serviceIndex}`} onPress={() => openAssistant({ ...service, id: serviceId, categoryId })} className="mb-3 overflow-hidden rounded-[22px] border border-[#dce6e0] bg-white shadow-sm">
                      {image ? (
                        <Image source={{ uri: image }} resizeMode="cover" className="h-40 w-full bg-[#edf3ef]" />
                      ) : (
                        <View className="h-32 items-center justify-center bg-[#e9f3ee]"><Text className="text-4xl">🏠</Text></View>
                      )}
                      <View className="p-4">
                        <View className="flex-row items-start justify-between gap-3">
                          <Text className="flex-1 text-lg font-bold text-[#202b39]">{title}</Text>
                          {rate ? <Text className="rounded-full bg-[#e8f5ee] px-3 py-1.5 text-sm font-bold text-[#087e65]">{rate}</Text> : null}
                        </View>
                        {description ? <Text className="mt-2 text-sm leading-5 text-[#65716f]">{description}</Text> : null}
                        {duration ? <Text className="mt-2 text-xs font-medium text-[#74817d]">{duration}</Text> : null}
                        <Text className="mt-4 font-semibold text-[#087e65]">View service · सेवा हेर्नुहोस् →</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Pressable accessibilityRole="button" accessibilityLabel="Ask about a home issue" onPress={() => openAssistant()} className="absolute bottom-6 right-5 flex-row items-center rounded-full bg-[#087e65] px-5 py-4 shadow-lg">
        <Text className="mr-2 text-lg text-white">✦</Text>
        <Text className="font-bold text-white">Ask about a home issue</Text>
      </Pressable>
    </View>
  );
}
