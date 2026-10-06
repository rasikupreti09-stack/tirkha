import { Button } from "@/components/ui/button";
export default function Home() {
  return <main className="mx-auto min-h-screen max-w-3xl p-8">
    <h1 className="text-4xl font-semibold">Tirkha</h1>
    <p className="mt-4 text-muted-foreground">Home and daily assistance in Nepal.</p>
    <div className="mt-8 rounded-lg border bg-card p-6">
      <p className="mb-4">The web workspace is ready.</p>
      <Button disabled>Booking features coming next</Button>
    </div>
  </main>;
}
