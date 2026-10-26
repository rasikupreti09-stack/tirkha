import { Suspense } from "react";
import { BookingChat } from "@/components/booking-chat";
export default function ChatPage() { return <Suspense fallback={<p>Loading conversation…</p>}><BookingChat /></Suspense>; }
