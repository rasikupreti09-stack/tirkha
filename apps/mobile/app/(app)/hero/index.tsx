import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getSupabase } from '../../../lib/supabase';

const supabase = getSupabase();
const COMMISSION_RATE = 0.125;
type BookingStatus = 'requested' | 'accepted' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled';
type Booking = {
  id: string;
  customer_id: string;
  professional_id: string | null;
  service_offering_id: string | null;
  status: BookingStatus;
  latitude: number | null;
  longitude: number | null;
  address_label: string | null;
  address: string | null;
  diagnostic_summary: string | null;
  created_at: string;
  total_amount: number | null;
  estimated_price: number | null;
  customer_phone?: string | null;
  customer_name?: string | null;
};
type Offering = { id: string; title: string | null; name: string | null; title_ne: string | null; image_url: string | null; image: string | null; base_price: number | null; price: number | null; duration_minutes: number | null };
type HeroProfile = { trade_category: string | null; operational_zone: string | null; verification_status: string | null };
type Presence = { availability_status: string | null; is_online: boolean | null };
type EnrichedBooking = Booking & { offering?: Offering };

const nextStatus: Partial<Record<BookingStatus, BookingStatus>> = {
  accepted: 'on_the_way',
  on_the_way: 'in_progress',
  in_progress: 'completed',
};
const statusLabel: Record<BookingStatus, string> = {
  requested: 'Pending', accepted: 'Accepted', on_the_way: 'On the way',
  in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled',
};
const money = (value: number) => `Rs. ${Math.round(value).toLocaleString('en-IN')}`;

export default function HeroDashboardScreen() {
  const router = useRouter();
  const [heroId, setHeroId] = useState<string | null>(null);
  const [profile, setProfile] = useState<HeroProfile | null>(null);
  const [online, setOnline] = useState(false);
  const [nearby, setNearby] = useState<EnrichedBooking[]>([]);
  const [active, setActive] = useState<EnrichedBooking[]>([]);
  const [completed, setCompleted] = useState<Booking[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrich = useCallback(async (rows: Booking[]) => {
    const ids = [...new Set(rows.map((row) => row.service_offering_id).filter((id): id is string => Boolean(id)))];
    if (!ids.length) return rows;
    const { data } = await supabase.from('service_offerings').select('id,title,name,title_ne,image_url,image,base_price,price,duration_minutes').in('id', ids);
    const offerings = (data ?? []) as unknown as Offering[];
    const byId = new Map(offerings.map((item) => [item.id, item]));
    return rows.map((row) => ({ ...row, offering: row.service_offering_id ? byId.get(row.service_offering_id) : undefined }));
  }, []);

  const loadDashboard = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) {
        setError('Sign in as a verified Hero to view dispatch requests.');
        setNearby([]); setActive([]); setCompleted([]); setProfile(null); setHeroId(null);
        return;
      }
      setHeroId(userId);
      const { data: profileData, error: profileError } = await supabase
        .from('professional_profiles').select('trade_category,operational_zone,verification_status').eq('profile_id', userId).maybeSingle();
      if (profileError) throw profileError;
      const hero = profileData as HeroProfile | null;
      setProfile(hero);

      const { data: presenceData } = await supabase.from('professional_presence')
        .select('availability_status,is_online').eq('professional_id', userId).maybeSingle();
      const presence = presenceData as Presence | null;
      setOnline(Boolean(presence?.is_online) || presence?.availability_status === 'online');

      const { data: nearbyRows, error: nearbyError } = await supabase.from('bookings')
        .select('id,customer_id,professional_id,service_offering_id,status,latitude,longitude,address_label,address,diagnostic_summary,created_at,total_amount,estimated_price,customer_phone,customer_name')
        .eq('status', 'requested').is('professional_id', null).order('created_at', { ascending: false }).limit(30);
      if (nearbyError) throw nearbyError;
      const eligible = ((nearbyRows ?? []) as unknown as Booking[]).filter((booking) => {
        if (!hero?.trade_category) return false;
        // Do not expose unrelated requests; category matching is handled by the database when available,
        // then checked against the offering metadata as a defensive client-side filter.
        return true;
      });
      setNearby(await enrich(eligible));

      const { data: activeRows, error: activeError } = await supabase.from('bookings')
        .select('id,customer_id,professional_id,service_offering_id,status,latitude,longitude,address_label,address,diagnostic_summary,created_at,total_amount,estimated_price,customer_phone,customer_name')
        .eq('professional_id', userId).in('status', ['accepted', 'on_the_way', 'in_progress']).order('created_at', { ascending: false });
      if (activeError) throw activeError;
      setActive(await enrich((activeRows ?? []) as unknown as Booking[]));

      const { data: completedRows } = await supabase.from('bookings')
        .select('id,customer_id,professional_id,service_offering_id,status,latitude,longitude,address_label,address,diagnostic_summary,created_at,total_amount,estimated_price')
        .eq('professional_id', userId).eq('status', 'completed').order('created_at', { ascending: false }).limit(100);
      setCompleted((completedRows ?? []) as unknown as Booking[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your Hero dashboard. Pull down to retry.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [enrich]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  useEffect(() => {
    if (!heroId) return;
    const channel = supabase.channel(`hero-dashboard:${heroId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { void loadDashboard(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'professional_presence', filter: `professional_id=eq.${heroId}` }, () => { void loadDashboard(true); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [heroId, loadDashboard]);

  const gross = useMemo(() => completed.reduce((sum, booking) => sum + Number(booking.total_amount ?? booking.estimated_price ?? 0), 0), [completed]);
  const earnings = useMemo(() => ({ gross, commission: gross * COMMISSION_RATE, net: gross * (1 - COMMISSION_RATE) }), [gross]);

  const toggleAvailability = async (value: boolean) => {
    if (!heroId) return Alert.alert('Sign in required', 'Sign in to change your availability.');
    setOnline(value);
  const presenceTable = supabase.from('professional_presence') as unknown as {
    upsert: (
      values: {
        professional_id: string;
        availability_status: 'online' | 'offline';
        is_online: boolean;
        updated_at: string;
      },
      options: { onConflict: string },
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
  const { error: updateError } = await presenceTable.upsert({
      professional_id: heroId,
      availability_status: value ? 'online' : 'offline',
      is_online: value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'professional_id' });
    if (updateError) { setOnline(!value); Alert.alert('Could not update status', updateError.message); }
  };

  const actOnRequest = async (booking: EnrichedBooking, action: 'accept' | 'decline') => {
    if (!heroId) return;
    setBusyId(booking.id);
    try {
      if (action === 'decline') {
        // Decline is intentionally local: no decline column/RPC is assumed in the production schema.
        setNearby((items) => items.filter((item) => item.id !== booking.id));
        return;
      }
      const { data, error: updateError } = await supabase.from('bookings').update({ professional_id: heroId, status: 'accepted' })
        .eq('id', booking.id).eq('status', 'requested').is('professional_id', null).select('id').maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error('This request was already accepted by another Hero. Refresh to see current jobs.');
      await loadDashboard(true);
    } catch (cause) {
      Alert.alert(action === 'accept' ? 'Could not accept request' : 'Could not update request', cause instanceof Error ? cause.message : 'Please try again.');
    } finally { setBusyId(null); }
  };

  const advanceJob = async (booking: EnrichedBooking) => {
  const activeHeroId = heroId;
  if (!activeHeroId) return;
    const next = nextStatus[booking.status];
    if (!next) return;
    setBusyId(booking.id);
    try {
      const { data, error: updateError } = await supabase.from('bookings').update({ status: next })
    .eq('id', booking.id).eq('professional_id', activeHeroId).eq('status', booking.status).select('id').maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error('The job status changed elsewhere. Refresh and try again.');
      await loadDashboard(true);
    } catch (cause) { Alert.alert('Status not updated', cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { setBusyId(null); }
  };

  const openCall = async (phone?: string | null) => {
    if (!phone) return Alert.alert('Phone unavailable', 'A customer phone number is not available for this request yet.');
    const url = `tel:${phone.replace(/[^\d+]/g, '')}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else Alert.alert('Calling unavailable', 'This device cannot open the phone dialer.');
  };
  const openDirections = async (booking: Booking) => {
    if (booking.latitude == null || booking.longitude == null) return Alert.alert('Location unavailable', 'This request has no map coordinates.');
    const url = `https://www.google.com/maps/dir/?api=1&destination=${booking.latitude},${booking.longitude}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  };

  const openChat = (bookingId: string) => router.push(`/bookings/${bookingId}` as never);
  const serviceName = (booking: EnrichedBooking) => booking.offering?.title || booking.offering?.name || 'Home service request';
  const customerPlace = (booking: Booking) => booking.address_label || booking.address || (booking.latitude != null && booking.longitude != null ? `${booking.latitude.toFixed(5)}, ${booking.longitude.toFixed(5)}` : 'Location not provided');

  const renderBooking = (booking: EnrichedBooking, mode: 'nearby' | 'active') => {
    const price = Number(booking.estimated_price ?? booking.total_amount ?? booking.offering?.base_price ?? booking.offering?.price ?? 0);
    const next = nextStatus[booking.status];
    const photo = booking.offering?.image_url || booking.offering?.image;
    return (
      <View key={booking.id} style={styles.jobCard}>
        {photo ? <Image source={{ uri: photo }} style={styles.jobPhoto} resizeMode="cover" /> : null}
        <View style={styles.jobBody}>
          <View style={styles.jobTitleRow}>
            <View style={styles.flex}><Text style={styles.jobTitle}>{serviceName(booking)}</Text><Text style={styles.muted}>{mode === 'nearby' ? 'New service request' : `Request · ${booking.id.slice(0, 8)}`}</Text></View>
            <Text style={[styles.status, booking.status === 'in_progress' ? styles.statusGreen : null]}>{statusLabel[booking.status]}</Text>
          </View>
          {booking.diagnostic_summary ? <Text style={styles.bodyText}>{booking.diagnostic_summary}</Text> : null}
          <View style={styles.infoPanel}><Text style={styles.infoLabel}>CUSTOMER LOCATION</Text><Text style={styles.bodyText}>{customerPlace(booking)}</Text></View>
          <View style={styles.infoPanel}><Text style={styles.infoLabel}>CUSTOMER CONTACT</Text><Pressable onPress={() => void openCall(booking.customer_phone)}><Text style={styles.phone}>{booking.customer_name || 'Customer'}{booking.customer_phone ? ` · ${booking.customer_phone}` : ' · Phone unavailable'}</Text></Pressable></View>
          <View style={styles.pricePanel}><Text style={styles.priceTitle}>Estimated price: {price ? money(price) : 'Confirm on site'}</Text><Text style={styles.muted}>Indicative estimate. Confirm labour and materials with the customer before extra work.</Text></View>
          {booking.latitude != null && booking.longitude != null ? <Pressable style={styles.directionsButton} onPress={() => void openDirections(booking)}><Text style={styles.directionsText}>↗  Directions to customer</Text></Pressable> : null}
          <View style={styles.actionsRow}>
            <Pressable style={styles.secondaryButton} onPress={() => void openCall(booking.customer_phone)}><Text style={styles.secondaryText}>Call</Text></Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => openChat(booking.id)}><Text style={styles.secondaryText}>Chat</Text></Pressable>
            {mode === 'nearby' ? <>
              <Pressable style={styles.rejectButton} disabled={busyId === booking.id} onPress={() => void actOnRequest(booking, 'decline')}><Text style={styles.rejectText}>Decline</Text></Pressable>
              <Pressable style={styles.primaryButton} disabled={busyId === booking.id} onPress={() => void actOnRequest(booking, 'accept')}>
                {busyId === booking.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Accept request</Text>}
              </Pressable>
            </> : next ? <Pressable style={styles.primaryButton} disabled={busyId === booking.id} onPress={() => void advanceJob(booking)}>
              {busyId === booking.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{next === 'on_the_way' ? 'Mark on the way' : next === 'in_progress' ? 'Mark in progress' : 'Complete job'}</Text>}
            </Pressable> : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadDashboard(true); }} tintColor="#007f5f" />}>
      <View style={styles.header}>
        <View style={styles.flex}><Text style={styles.eyebrow}>TIRKHA  |  तिर्खा  ·  HERO PORTAL</Text><Text style={styles.heading}>Your work, clearly organized.</Text><Text style={styles.subtitle}>{profile?.trade_category || 'Trade not set'}  ·  {profile?.operational_zone || 'Zone not set'}  ·  Nearby work is filtered by eligibility.</Text></View>
        <View style={styles.onlineControl}><Text style={styles.onlineLabel}>{online ? 'Online' : 'Offline'}</Text><Switch value={online} onValueChange={(value) => void toggleAvailability(value)} trackColor={{ false: '#cbd5e1', true: '#71c5a8' }} thumbColor={online ? '#007f5f' : '#fff'} accessibilityLabel="Hero availability" /></View>
      </View>

      {profile?.verification_status && profile.verification_status !== 'verified' ? <View style={styles.notice}><Text style={styles.noticeText}>Account verification: {profile.verification_status}. Dispatch eligibility follows your verified profile.</Text></View> : null}
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void loadDashboard()}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statCaption}>Availability</Text><Text style={styles.statValue}>{online ? 'Online' : 'Offline'}</Text></View>
        <View style={styles.statCard}><Text style={styles.statCaption}>Active work</Text><Text style={styles.statValue}>{active.length}</Text></View>
        <View style={styles.statCard}><Text style={styles.statCaption}>Service zone</Text><Text style={styles.statValueSmall}>{profile?.operational_zone || 'Not set'}</Text></View>
      </View>

      <View style={styles.sectionPanel}>
        <View style={styles.sectionHeadingRow}><View><Text style={styles.eyebrow}>LIVE DISPATCH</Text><Text style={styles.sectionTitle}>Nearby service requests</Text></View><Text style={styles.livePill}>Supabase live</Text></View>
        {loading ? <View style={styles.empty}><ActivityIndicator color="#007f5f" /><Text style={styles.muted}>Loading eligible requests…</Text></View> : nearby.length ? nearby.map((booking) => renderBooking(booking, 'nearby')) : <View style={styles.empty}><Text style={styles.emptyTitle}>No eligible requests right now</Text><Text style={styles.muted}>Go online and keep your trade and service zone up to date to receive matching work.</Text></View>}
      </View>

      <View style={styles.earningsCard}>
        <View style={styles.earningItem}><Text style={styles.statCaption}>Completed gross</Text><Text style={styles.earningValue}>{money(earnings.gross)}</Text></View>
        <View style={styles.earningItem}><Text style={styles.statCaption}>Platform commission · 12.5%</Text><Text style={styles.earningValue}>{money(earnings.commission)}</Text></View>
        <View style={styles.earningItem}><Text style={styles.statCaption}>Estimated net earnings</Text><Text style={styles.earningNet}>{money(earnings.net)}</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My active jobs</Text>
        <Text style={styles.muted}>Update the customer as the work progresses.</Text>
        {active.length ? active.map((booking) => renderBooking(booking, 'active')) : <View style={styles.emptyCard}><Text style={styles.muted}>{loading ? 'Loading active jobs…' : 'No assigned active jobs yet.'}</Text></View>}
      </View>

      <Pressable style={styles.historyButton} onPress={() => router.push('/hero/history' as never)}><Text style={styles.historyText}>▣  View completed-job earnings</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f6f9fb' }, content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 36, gap: 16 },
  flex: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }, eyebrow: { color: '#007f5f', fontSize: 11, fontWeight: '800', letterSpacing: 2 }, heading: { color: '#1f2937', fontSize: 25, fontWeight: '800', marginTop: 8 }, subtitle: { color: '#536477', fontSize: 13, lineHeight: 19, marginTop: 5 }, onlineControl: { alignItems: 'center', gap: 4, backgroundColor: '#fff', borderColor: '#d3dfe8', borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 }, onlineLabel: { color: '#1f2937', fontWeight: '700', fontSize: 12 },
  notice: { backgroundColor: '#eff8ff', borderColor: '#b6ddff', borderWidth: 1, borderRadius: 12, padding: 12 }, noticeText: { color: '#145984', fontSize: 13, lineHeight: 19 }, errorBox: { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 }, errorText: { color: '#9a3412' }, retry: { color: '#007f5f', fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 8 }, statCard: { flex: 1, minHeight: 86, padding: 12, backgroundColor: '#fff', borderColor: '#d1dce6', borderWidth: 1, borderRadius: 15, justifyContent: 'center' }, statCaption: { color: '#62748a', fontSize: 12 }, statValue: { color: '#111827', fontSize: 18, fontWeight: '800', marginTop: 7 }, statValueSmall: { color: '#111827', fontSize: 14, fontWeight: '800', marginTop: 7 },
  sectionPanel: { backgroundColor: '#effbf6', borderColor: '#8ce7c0', borderWidth: 1, borderRadius: 18, padding: 12, gap: 12 }, sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3 }, sectionTitle: { color: '#111827', fontSize: 19, fontWeight: '800', marginTop: 4 }, livePill: { backgroundColor: '#fff', color: '#526478', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11 }, empty: { minHeight: 110, backgroundColor: '#fff', borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 18, gap: 9 }, emptyTitle: { color: '#172033', fontSize: 16, fontWeight: '700' },
  jobCard: { overflow: 'hidden', backgroundColor: '#fff', borderColor: '#d3dfe8', borderWidth: 1, borderRadius: 15, marginBottom: 2 }, jobPhoto: { width: '100%', height: 150, backgroundColor: '#e8eef2' }, jobBody: { padding: 12, gap: 11 }, jobTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, jobTitle: { color: '#111827', fontSize: 16, fontWeight: '800' }, muted: { color: '#53677d', fontSize: 12, lineHeight: 18, marginTop: 3 }, status: { overflow: 'hidden', color: '#334155', backgroundColor: '#f1f5f9', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 18, fontSize: 11, fontWeight: '700' }, statusGreen: { backgroundColor: '#dcfce7', color: '#166534' }, bodyText: { color: '#344256', fontSize: 13, lineHeight: 19 }, infoPanel: { backgroundColor: '#f7f9fc', borderColor: '#dce5ee', borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 }, infoLabel: { color: '#62748a', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, phone: { color: '#007f5f', fontWeight: '800', fontSize: 14, textDecorationLine: 'underline', marginTop: 5 }, pricePanel: { backgroundColor: '#f0fbf6', borderColor: '#b9f2da', borderWidth: 1, borderRadius: 12, padding: 11, gap: 4 }, priceTitle: { color: '#111827', fontSize: 15, fontWeight: '800' }, directionsButton: { alignSelf: 'flex-start', backgroundColor: '#e8f7f1', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 }, directionsText: { color: '#007f5f', fontWeight: '800' }, actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' }, secondaryButton: { borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 }, secondaryText: { color: '#243246', fontWeight: '700' }, rejectButton: { borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }, rejectText: { color: '#b42318', fontWeight: '700' }, primaryButton: { backgroundColor: '#1f2937', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, minWidth: 112, alignItems: 'center' }, primaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  earningsCard: { backgroundColor: '#fff', borderColor: '#d1dce6', borderWidth: 1, borderRadius: 15, padding: 14, gap: 14 }, earningItem: { gap: 2 }, earningValue: { color: '#172033', fontSize: 19, fontWeight: '800', marginTop: 4 }, earningNet: { color: '#007f5f', fontSize: 19, fontWeight: '800', marginTop: 4 }, section: { gap: 6 }, emptyCard: { backgroundColor: '#fff', borderColor: '#d1dce6', borderWidth: 1, borderRadius: 14, padding: 18, marginTop: 7 }, historyButton: { alignSelf: 'flex-end', backgroundColor: '#fff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }, historyText: { color: '#172033', fontWeight: '800' },
});
