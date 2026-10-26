import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { subscribeToBookings } from "../src/booking-realtime.ts";

function transport() {
  const channels=[], removed=[];
  return { channels, removed, client: {
    channel(name) {
      const handlers=[];
      const channel={ name, handlers, on(_type,filter,callback) { handlers.push({filter,callback});return channel; },
        subscribe(callback) { channel.status=callback;return channel; } };
      channels.push(channel);return channel;
    },
    async removeChannel(channel) { removed.push(channel); }
  } };
}
test("booking subscriptions scope filters to booking or user, refresh on reconnect, and clean up independently", () => {
  const t=transport(), id=randomUUID();
  let changed=0;const states=[];
  const stop=subscribeToBookings(t.client,{booking_id:id},{onChange:()=>changed++,onStatus:live=>states.push(live)});
  const channel=t.channels[0];
  assert.deepEqual(channel.handlers.map(h=>h.filter),["INSERT","UPDATE"].map(event=>({event,schema:"public",table:"bookings",filter:"id=eq."+id})));
  channel.status("SUBSCRIBED");channel.handlers[1].callback();
  channel.status("CHANNEL_ERROR");channel.status("TIMED_OUT");channel.status("SUBSCRIBED");
  assert.equal(changed,3);assert.deepEqual(states,[true,false,false,true]);
  const other=subscribeToBookings(t.client,{booking_id:id},{onChange:()=>{}});
  assert.notEqual(t.channels[0].name,t.channels[1].name);
  stop();stop();channel.handlers[0].callback();channel.status("SUBSCRIBED");
  assert.equal(changed,3);assert.deepEqual(t.removed,[channel]);other();
  for(const [target,filter] of [
    [{user_id:id,role:"customer"},"customer_id=eq."+id],
    [{user_id:id,role:"professional"},"professional_id=eq."+id],
    [{available:true},"status=eq.requested"]
  ]) {
    const clean=subscribeToBookings(t.client,target,{onChange:()=>{}});
    assert.equal(t.channels.at(-1).handlers[0].filter.filter,filter);clean();
  }
});
test("local mock opens no sockets and invalid identifiers cannot alter filters", () => {
  const t=transport();
  subscribeToBookings(t.client,{booking_id:randomUUID()},{enabled:false,onChange:()=>assert.fail()})();
  assert.equal(t.channels.length,0);
  assert.throws(()=>subscribeToBookings(t.client,{booking_id:"invalid,customer_id=neq.x"},{onChange:()=>{}}));
  assert.throws(()=>subscribeToBookings(t.client,{user_id:randomUUID(),role:"admin"},{onChange:()=>{}}));
  assert.equal(t.channels.length,0);
});
