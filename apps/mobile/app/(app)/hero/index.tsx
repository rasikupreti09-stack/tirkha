import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';

type BookingRow = {
  id: string;
  customer_id?: string | null;
  professional_id?: string | null;
  service_offering_id?: string | null;
  service_region_id?: string | null;
  status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  address_label?: string | null;
  diagnostic_summary?: string | null;
  created_at?: string | null;
  total_amount?: number | null;
  estimated_price?: number | null;
};

type OfferingRow = {
  id: string;
  title?: string | null;
  name?: string | null;
  title_ne?: string | null;
  image_url?: string | null;
  image?: string | null;
  base_price?: number | null;
  price?: number | null;
  duration_minutes?: number | null;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(
  supabaseUrl || 'https://invalid.local',
  supabaseKey || 'missing-public-key',
  { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } },
);

const colors = {
  ink: '#1F2937',
  muted: '#64748B',
  green: '#087F5B',
  greenDark: '#075B45',
  greenSoft: '#EAF6EF',
  canvas: '#F5F8F6',
  white: '#FFFFFF',
  border: '#DCE6DF',
  amber: '#B45309',
  amberSoft: '#FFF7E8',
  red: '#B42318',
};

function asBooking(value: unknown): BookingRow | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string') return null;
  return {
    id: row.id,
    customer_id: typeof row.customer_id === 'string' ? row.customer_id : null,
    professional_id: typeof row.professional_id === 'string' ? row.professional_id : null,
    service_offering_id: typeof row.service_offering_id === 'string' ? row.service_offering_id : null,
    service_region_id: typeof row.service_region_id === 'string' ? row.service_region_id : null,
    status: typeof row.status === 'string' ? row.status : 'pending',
    latitude: typeof row.latitude === 'number' ? row.latitude : null,
    longitude: typeof row.longitude === 'number' ? row.longitude : null,
    address: typeof row.address === 'string' ? row.address : null,
    address_label: typeof row.address_label === 'string' ? row.address_label : null,
    diagnostic_summary: typeof row.diagnostic_summary === 'string' ? row.diagnostic_summary : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    total_amount: typeof row.total_amount === 'number' ? row.total_amount : null,
    estimated_price: typeof row.estimated_price === 'number' ? row.estimated_price : null,
  };
}

function asOffering(value: unknown): OfferingRow | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string') return null;
  return {
    id: row.id,
    title: typeof row.title === 'string' ? row.title : null,
    name: typeof row.name === 'string' ? row.name : null,
    title_ne: typeof row.title_ne === 'string' ? row.title_ne : null,
    image_url: typeof row.image_url === 'string' ? row.image_url : null,
    image: typeof row.image === 'string' ? row.image : null,
    base_price: typeof row.base_price === 'number' ? row.base_price : null,
    price: typeof row.price === 'number' ? row.price : null,
    duration_minutes: typeof row.duration_minutes === 'number' ? row.duration_minutes : null,
  };
}

export default function HeroDashboardScreen() {
  const router = useRouter();
  const [heroId, setHeroId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [offerings, setOfferings] = useState<Record<string, OfferingRow>>({});
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!supabaseUrl || !supabaseKey) {
      setError('App service configuration is missing. Contact support.');
      setLoading(false);
      return;
    }
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setError('Sign in to open the Hero dashboard. / हिरो ड्यासबोर्ड खोल्न साइन इन गर्नुहोस्।');
      setLoading(false);
      return;
    }
    const id = userData.user.id;
    setHeroId(id);
    const [jobResult, presenceResult] = await Promise.all([
      supabase.from('bookings').select('*').eq('status', 'pending').is('professional_id', null).order('created_at', { ascending: true }).limit(30),
      supabase.from('professional_presence').select('professional_id').eq('professional_id', id).maybeSingle(),
    ]);
    if (jobResult.error) {
      setError(`${jobResult.error.message} / अनुरोधहरू लोड गर्न सकिएन।`);
      setLoading(false);
      return;
    }
    const rows = (jobResult.data ?? []).map(asBooking).filter((row): row is BookingRow => row !== null);
    setBookings(rows);
    const ids = rows.map((row) => row.service_offering_id).filter((id): id is string => Boolean(id));
    if (ids.length) {
      const catalogResult = await supabase.from('service_offerings').select('*').in('id', ids);
      if (!catalogResult.error) {
        const next: Record<string, OfferingRow> = {};
        for (const value of catalogResult.data ?? []) {
          const offering = asOffering(value);
          if (offering) next[offering.id] = offering;
        }
        setOfferings(next);
      }
    }
    setIsOnline(Boolean(presenceResult.data));
    setError(null);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    void loadDashboard();
    return undefined;
  }, [loadDashboard]));

  useEffect(() => {
    if (!heroId) return;
    const channel = supabase
      .channel(`hero-pending-bookings-${heroId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { void loadDashboard(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [heroId, loadDashboard]);

  const activeJobs = useMemo(() => bookings.filter((booking) => booking.professional_id === heroId && booking.status !== 'completed' && booking.status !== 'cancelled'), [bookings, heroId]);
  const pendingJobs = useMemo(() => bookings.filter((booking) => booking.status === 'pending' && !dismissedIds.includes(booking.id)), [bookings, dismissedIds]);

  const refresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const toggleAvailability = async (next: boolean) => {
    if (!heroId) {
      Alert.alert('Sign in required / साइन इन आवश्यक', 'Please sign in again to change availability.');
      return;
    }
    setSavingAvailability(true);
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;
      if (next) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.granted) {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        }
      }
      const { error: rpcError } = await supabase.rpc('set_hero_availability', {
        p_available: next,
        p_latitude: latitude,
        p_longitude: longitude,
      });
      if (rpcError) throw rpcError;
      setIsOnline(next);
    } catch (cause) {
      Alert.alert('Could not update / अपडेट हुन सकेन', cause instanceof Error ? cause.message : 'Try again. / फेरि प्रयास गर्नुहोस्।');
    } finally {
      setSavingAvailability(false);
    }
  };

  const respondToBooking = async (booking: BookingRow, accept: boolean) => {
    if (!accept) {
      setDismissedIds((current) => [...current, booking.id]);
      return;
    }
    if (!heroId) return;
    setBusyBookingId(booking.id);
    const { data, error: acceptError } = await supabase
      .from('bookings')
      .update({ professional_id: heroId, status: 'accepted' })
      .eq('id', booking.id)
      .eq('status', 'pending')
      .is('professional_id', null)
      .select('id')
      .maybeSingle();
    setBusyBookingId(null);
    if (acceptError || !data) {
      Alert.alert('Request unavailable / अनुरोध उपलब्ध छैन', acceptError?.message ?? 'Another Hero may have accepted this request.');
      await loadDashboard();
      return;
    }
    await loadDashboard();
  };

  const openLocation = (booking: BookingRow) => {
    if (booking.latitude == null || booking.longitude == null) {
      Alert.alert('Location not shared / स्थान साझा गरिएको छैन', 'The customer has not shared a map pin yet.');
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${booking.latitude},${booking.longitude}`;
    void Linking.openURL(url);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 112, gap: 18 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.green} />}
      >
        <View style={{ backgroundColor: colors.white, borderRadius: 22, borderColor: colors.border, borderWidth: 1, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: colors.green, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>TIRKHA HERO / टिर्खा हिरो</Text>
            <Text style={{ color: colors.ink, fontSize: 25, fontWeight: '800', marginTop: 6 }}>Your work, at a glance</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>तपाईंको कामको अवस्था</Text>
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Switch
              value={isOnline}
              onValueChange={(value) => void toggleAvailability(value)}
              disabled={savingAvailability || loading}
              trackColor={{ false: '#CBD5D1', true: '#9AD8BD' }}
              thumbColor={isOnline ? colors.green : '#F8FAF9'}
              accessibilityLabel="Hero availability / हिरो उपलब्धता"
            />
            <Text style={{ color: isOnline ? colors.green : colors.muted, fontSize: 12, fontWeight: '800' }}>
              {savingAvailability ? 'Saving…' : isOnline ? 'ONLINE / अनलाइन' : 'OFFLINE / अफलाइन'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <SummaryCard label="Active Jobs" local="सक्रिय काम" value={String(activeJobs.length)} />
          <SummaryCard label="Pending Requests" local="नयाँ अनुरोध" value={String(pendingJobs.length)} />
          <SummaryCard label="Earnings" local="आम्दानी" value="रू —" />
          <SummaryCard label="Rating" local="रेटिङ" value="— / 5" />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 2 }}>
          <View>
            <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '800' }}>Incoming requests</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 3 }}>नजिकका सेवा अनुरोधहरू</Text>
          </View>
          <Pressable onPress={() => void refresh()} accessibilityRole="button" style={{ padding: 8 }}>
            <Text style={{ color: colors.green, fontWeight: '800' }}>Refresh / ताजा</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={{ padding: 16, borderRadius: 16, backgroundColor: colors.amberSoft, borderWidth: 1, borderColor: '#F2D39A' }}>
            <Text style={{ color: colors.amber, fontWeight: '700' }}>{error}</Text>
            <Pressable onPress={() => void refresh()} style={{ marginTop: 10 }}><Text style={{ color: colors.greenDark, fontWeight: '800' }}>Try again / फेरि प्रयास गर्नुहोस्</Text></Pressable>
          </View>
        ) : loading ? (
          <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator color={colors.green} /><Text style={{ color: colors.muted, marginTop: 10 }}>Loading requests… / अनुरोध लोड हुँदैछ…</Text></View>
        ) : pendingJobs.length === 0 ? (
          <View style={{ padding: 24, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
            <Text style={{ fontSize: 30 }}>✓</Text>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 8 }}>No new requests</Text>
            <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 5 }}>नयाँ अनुरोध आएपछि यहाँ देखिनेछन्।</Text>
          </View>
        ) : pendingJobs.map((booking) => {
          const offering = booking.service_offering_id ? offerings[booking.service_offering_id] : undefined;
          const title = offering?.title ?? offering?.name ?? 'Home service request';
          const imageUri = offering?.image_url ?? offering?.image;
          const price = booking.estimated_price ?? booking.total_amount ?? offering?.base_price ?? offering?.price;
          const coordinate = booking.latitude != null && booking.longitude != null ? `${booking.latitude.toFixed(5)}, ${booking.longitude.toFixed(5)}` : 'Location pin not shared';
          return (
            <View key={booking.id} style={{ backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {imageUri ? <Image source={{ uri: imageUri }} resizeMode="cover" style={{ height: 156, width: '100%', backgroundColor: colors.greenSoft }} /> : null}
              <View style={{ padding: 16, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800', flex: 1 }}>{title}</Text>
                  <View style={{ backgroundColor: colors.amberSoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ color: colors.amber, fontSize: 11, fontWeight: '800' }}>PENDING / प्रतीक्षामा</Text></View>
                </View>
                <Text style={{ color: colors.muted, fontSize: 14 }}>Customer request / ग्राहक अनुरोध · {booking.id.slice(0, 8)}</Text>
                {booking.diagnostic_summary ? <Text style={{ color: colors.ink, lineHeight: 20 }}>{booking.diagnostic_summary}</Text> : null}
                <Pressable onPress={() => openLocation(booking)} style={{ backgroundColor: colors.canvas, borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: colors.ink, fontWeight: '700' }}>⌖ {booking.address_label ?? booking.address ?? coordinate}</Text>
                  {booking.service_region_id ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{booking.service_region_id}</Text> : null}
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.muted }}>Estimated service price / अनुमानित सेवा मूल्य</Text>
                  <Text style={{ color: colors.greenDark, fontSize: 17, fontWeight: '900' }}>{price != null ? `रू ${price.toLocaleString('en-NP')}` : 'On-site quote / स्थलमै मूल्य'}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <Pressable
                    disabled={busyBookingId === booking.id}
                    onPress={() => void respondToBooking(booking, false)}
                    style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 13, alignItems: 'center' }}
                  ><Text style={{ color: colors.ink, fontWeight: '800' }}>Decline / अस्वीकार</Text></Pressable>
                  <Pressable
                    disabled={busyBookingId === booking.id}
                    onPress={() => void respondToBooking(booking, true)}
                    style={{ flex: 1, borderRadius: 12, backgroundColor: colors.green, paddingVertical: 13, alignItems: 'center' }}
                  >{busyBookingId === booking.id ? <ActivityIndicator color={colors.white} /> : <Text style={{ color: colors.white, fontWeight: '800' }}>Accept / स्वीकार</Text>}</Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <Pressable
        onPress={() => router.push('/(app)/bookings' as never)}
        accessibilityRole="button"
        style={{ position: 'absolute', right: 18, bottom: 20, borderRadius: 16, backgroundColor: colors.ink, paddingHorizontal: 17, paddingVertical: 14, elevation: 6 }}
      >
        <Text style={{ color: colors.white, fontWeight: '800' }}>My jobs / मेरा काम</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function SummaryCard({ label, local, value }: { label: string; local: string; value: string }) {
  return (
    <View style={{ width: '48%', minHeight: 104, backgroundColor: colors.white, borderRadius: 17, borderWidth: 1, borderColor: colors.border, padding: 14, justifyContent: 'space-between' }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 11 }}>{local}</Text>
      <Text style={{ color: colors.greenDark, fontSize: 22, fontWeight: '900' }}>{value}</Text>
    </View>
  );
}
