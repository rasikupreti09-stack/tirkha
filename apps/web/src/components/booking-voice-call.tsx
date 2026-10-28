"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "./auth-provider";

type Signal = { from: string; kind: "offer" | "answer" | "ice" | "hangup"; data?: RTCSessionDescriptionInit | RTCIceCandidateInit };
export function InAppCallModal({ bookingId, active, phoneNumber }: { bookingId: string; active: boolean; phoneNumber?: string }) {
  const { client, session } = useAuth();
  const [ready, setReady] = useState(false), [callState, setCallState] = useState<"idle" | "calling" | "incoming" | "connected">("idle"), [error, setError] = useState(""), [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit | null>(null), [relayConfigured, setRelayConfigured] = useState<boolean | null>(null), [modalOpen, setModalOpen] = useState(false), [muted, setMuted] = useState(false), [speakerMuted, setSpeakerMuted] = useState(false);
  const remoteAudio = useRef<HTMLAudioElement>(null), peer = useRef<RTCPeerConnection | null>(null), local = useRef<MediaStream | null>(null), channelRef = useRef<ReturnType<NonNullable<typeof client>["channel"]> | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  useEffect(() => {
    if (!client || !session || !active || !bookingId) return;
    const channel = client.channel(`booking-call:${bookingId}`, { config: { private: true } });
    channelRef.current = channel;
    channel.on("broadcast", { event: "signal" }, ({ payload }) => {
      const signal = payload as Signal;
      if (signal.from === session.user.id) return;
      if (signal.kind === "offer" && signal.data) { setIncomingOffer(signal.data as RTCSessionDescriptionInit); setCallState("incoming"); setModalOpen(true); }
      if (signal.kind === "hangup") closePeer(false);
      if (signal.kind === "answer" && peer.current && signal.data) void peer.current.setRemoteDescription(signal.data as RTCSessionDescriptionInit).then(async () => { for (const candidate of pendingIce.current.splice(0)) await peer.current?.addIceCandidate(candidate).catch(() => undefined); setCallState("connected"); }).catch(() => setError("Could not connect the audio call."));
      if (signal.kind === "ice" && signal.data) {
        const candidate = signal.data as RTCIceCandidateInit;
        if (peer.current?.remoteDescription) void peer.current.addIceCandidate(candidate).catch(() => undefined);
        else pendingIce.current.push(candidate);
      }
    }).subscribe(status => setReady(status === "SUBSCRIBED"));
    return () => { setReady(false); closePeer(false); channelRef.current = null; void client.removeChannel(channel); };
    // One channel is bound to one authenticated booking participant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, session?.user.id, active, bookingId]);

  function send(kind: Signal["kind"], data?: Signal["data"]) {
    if (!session) return;
    void channelRef.current?.send({ type: "broadcast", event: "signal", payload: { from: session.user.id, kind, data } satisfies Signal });
  }
  async function createPeer() {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error("This browser does not support WebRTC audio calls.");
    if (!session?.access_token) throw new Error("Sign in again before starting a voice call.");
    const response = await fetch(`/api/calls/ice-servers?booking_id=${encodeURIComponent(bookingId)}`, { headers: { authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(result.error || "Secure call network settings could not be loaded.");
    }
    const config = await response.json() as { iceServers: RTCIceServer[]; relayConfigured: boolean };
    if (!Array.isArray(config.iceServers) || config.iceServers.length === 0) throw new Error("Call network settings are unavailable.");
    setRelayConfigured(config.relayConfigured === true);
    local.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const connection = new RTCPeerConnection({ iceServers: config.iceServers });
    peer.current = connection;
    local.current.getTracks().forEach(track => connection.addTrack(track, local.current!));
    connection.ontrack = event => { if (remoteAudio.current) { remoteAudio.current.srcObject = event.streams[0]; remoteAudio.current.muted = speakerMuted; void remoteAudio.current.play().catch(() => setError("Tap the speaker control to enable call audio.")); } };
    connection.onicecandidate = event => { if (event.candidate) send("ice", event.candidate.toJSON()); };
    connection.onconnectionstatechange = () => { if (connection.connectionState === "connected") setCallState("connected"); if (["failed", "disconnected", "closed"].includes(connection.connectionState)) setCallState("idle"); };
    return connection;
  }
  async function startCall() {
    setError(""); setModalOpen(true);
    try { pendingIce.current = []; const connection = await createPeer(); const offer = await connection.createOffer(); await connection.setLocalDescription(offer); send("offer", offer); setCallState("calling"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start the call. Check microphone permission."); closePeer(false); }
  }
  async function acceptOffer(offer: RTCSessionDescriptionInit) {
    if (peer.current) return;
    try { const connection = await createPeer(); await connection.setRemoteDescription(offer); for (const candidate of pendingIce.current.splice(0)) await connection.addIceCandidate(candidate).catch(() => undefined); const answer = await connection.createAnswer(); await connection.setLocalDescription(answer); send("answer", answer); setCallState("connected"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not accept the call."); closePeer(false); }
  }
  function closePeer(notify: boolean) {
    if (notify) send("hangup");
    peer.current?.close(); peer.current = null; pendingIce.current = []; local.current?.getTracks().forEach(track => track.stop()); local.current = null;
    if (remoteAudio.current) remoteAudio.current.srcObject = null;
    setCallState("idle"); setIncomingOffer(null); setMuted(false); setSpeakerMuted(false); setModalOpen(false);
  }
  if (!active) return null;
  return <section className="mt-3" aria-label="In-app audio call">
    <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-md border px-4 font-medium" onClick={() => { setModalOpen(true); setError(""); }}><Phone size={16}/>In-app audio call</button>
    {phoneNumber && <a className="ml-2 inline-flex min-h-11 items-center rounded-md px-3 text-sm underline" href={`tel:${phoneNumber}`}>Use phone network instead</a>}
    {modalOpen && <div className="fixed inset-0 z-[1100] grid place-items-center bg-slate-950/55 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && callState === "idle") setModalOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={`call-title-${bookingId}`} className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl">
        <h2 id={`call-title-${bookingId}`} className="text-xl font-semibold">Booking voice call</h2>
        <p className="mt-2 text-sm text-muted-foreground">Private WebRTC audio over booking-scoped realtime signaling. TURN relay {relayConfigured ? "is configured." : "is unavailable; some mobile networks may block direct calls."}</p>
        {callState === "idle" ? <div className="mt-5 flex flex-wrap gap-3"><button className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-primary-foreground disabled:opacity-50" disabled={!ready} onClick={() => void startCall()}><Phone size={16}/>Start call</button><button className="min-h-11 rounded-md border px-4" onClick={() => setModalOpen(false)}>Close</button></div> : callState === "incoming" ? <div className="mt-5 flex flex-wrap gap-3"><button className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-primary-foreground" onClick={() => incomingOffer && void acceptOffer(incomingOffer)}><Phone size={16}/>Answer</button><button className="inline-flex min-h-11 items-center gap-2 rounded-md border px-4" onClick={() => { send("hangup"); closePeer(false); }}>Decline</button></div> : <div className="mt-5 flex flex-wrap gap-3">
          {callState === "connected" && <><button type="button" aria-pressed={muted} className="inline-flex min-h-11 items-center gap-2 rounded-md border px-4" onClick={() => { const next = !muted; local.current?.getAudioTracks().forEach(track => { track.enabled = !next; }); setMuted(next); }}>{muted ? <MicOff size={16}/> : <Mic size={16}/>} {muted ? "Unmute" : "Mute"}</button><button type="button" aria-pressed={speakerMuted} className="inline-flex min-h-11 items-center gap-2 rounded-md border px-4" onClick={() => { const next = !speakerMuted; setSpeakerMuted(next); if (remoteAudio.current) { remoteAudio.current.muted = next; if (!next) void remoteAudio.current.play().catch(() => setError("Tap Start call to allow audio playback.")); } }}>{speakerMuted ? <VolumeX size={16}/> : <Volume2 size={16}/>} {speakerMuted ? "Enable speaker" : "Mute speaker"}</button></>}
          <button className="inline-flex min-h-11 items-center gap-2 rounded-md bg-destructive px-4 text-white" onClick={() => closePeer(true)}><PhoneOff size={16}/>{callState === "calling" ? "Cancel call" : "End call"}</button>
        </div>}
        {callState === "incoming" && <p role="status" className="mt-3 text-sm">Incoming call. Answer to grant microphone access and connect.</p>}
        {!ready && <p className="mt-3 text-sm text-amber-700">Voice signaling is not connected. Apply migration 14 and confirm Realtime authorization is enabled.</p>}
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
        <audio ref={remoteAudio} autoPlay playsInline className="hidden"/>
      </section>
    </div>}
  </section>;
}

export const BookingVoiceCall = InAppCallModal;
