"use client";
import { useEffect, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Check, ChevronRight, Clock3, Copy, LocateFixed, MapPin, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { buildDemoPaymentQrUrl, catalogMoney, catalogPriceLabel, codCommissionPaisa, serviceTotal, type Coordinates, type DemoOrder } from "@tirkha/shared";
import { MarketplaceDialog } from "./marketplace-dialog";
import { useMarketplace } from "./marketplace-provider";
const LocationMap = dynamic(() => import("./location-map"), { ssr: false, loading: () => <div className="mk-map-loading">Loading Kathmandu map…</div> });
const landmarks = [
 {name:"New Baneshwor",region:"Kathmandu" as const,latitude:27.6915,longitude:85.342},
 {name:"Jhamsikhel",region:"Lalitpur" as const,latitude:27.676,longitude:85.307},
 {name:"Thamel",region:"Kathmandu" as const,latitude:27.7154,longitude:85.3123},
 {name:"Durbar Marg",region:"Kathmandu" as const,latitude:27.712,longitude:85.318},
 {name:"Kupondole",region:"Lalitpur" as const,latitude:27.688,longitude:85.313},
 {name:"Bhaktapur Durbar Square",region:"Bhaktapur" as const,latitude:27.672,longitude:85.429},
 {name:"Lakeside, Pokhara",region:"Pokhara" as const,latitude:28.2096,longitude:83.959},
];
function formatSchedule(value:string){
 const date=new Date(value);
 return Number.isNaN(date.valueOf())?value:new Intl.DateTimeFormat("en-NP",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kathmandu"}).format(date)+" NPT";
}
function nepalInputFromDate(date:Date){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kathmandu",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
 const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 return value.year+"-"+value.month+"-"+value.day+"T"+value.hour+":"+value.minute;
}
export function MarketplaceOverlays(){
 const {state,services,modal,detail,setModal,setDetail,add,quantity,login,place,cancel,ready,setRegion,requireCheckoutAuth}=useMarketplace();
 const [phone,setPhone]=useState(""),[code,setCode]=useState(""),[authError,setAuthError]=useState("");
 const [stage,setStage]=useState<"cart"|"address"|"payment">("cart"),[address,setAddress]=useState(""),[pin,setPin]=useState<Coordinates|null>(null),[scheduled,setScheduled]=useState("");
 const [paymentMethod,setPaymentMethod]=useState<NonNullable<DemoOrder["payment_method"]>>("COD"),[paymentReference,setPaymentReference]=useState(""),[copyNotice,setCopyNotice]=useState("");
 const [busy,setBusy]=useState(false),[formError,setFormError]=useState(""),[geoBusy,setGeoBusy]=useState(false);
 const current=services.find(s=>s.id===detail);
 const rows=state.cart.map(line=>({line,service:services.find(s=>s.id===line.id)})).filter((r):r is {line:typeof state.cart[number];service:NonNullable<typeof r.service>}=>Boolean(r.service));
 const total=rows.reduce((sum,{line,service})=>sum+line.quantity*serviceTotal(service),0);
 const subtotal=rows.reduce((sum,{line,service})=>sum+line.quantity*service.base_paisa,0);
 const visitFees=rows.reduce((sum,{line,service})=>sum+line.quantity*service.visit_paisa,0);
 function submitAuth(event:FormEvent){event.preventDefault();setAuthError("");if(!phone.trim()){setAuthError("Enter any phone number to continue.");return;}if(code!=="123456"){setAuthError("For this demo, enter 123456 or choose One-Click Demo Login.");return;}login(phone);}
 function oneClick(){login(phone||"+9779800000000");}
 function selectLandmark(item:typeof landmarks[number]){setAddress(item.name+", "+item.region);setPin({latitude:item.latitude,longitude:item.longitude});setRegion(item.region);}
 function locate(){
   if(!navigator.geolocation){setFormError("This browser does not support location detection. Choose a landmark or place the pin.");return;}
   setGeoBusy(true);setFormError("");
   navigator.geolocation.getCurrentPosition(position=>{const point={latitude:position.coords.latitude,longitude:position.coords.longitude};
     if(point.latitude<26||point.latitude>31||point.longitude<80||point.longitude>89){setFormError("That pin is outside Nepal. Select a Nepal landmark or move the pin.");setGeoBusy(false);return;}
     setPin(point);setFormError("Pin saved. Add your street, tole and house details below.");setGeoBusy(false);
   },error=>{setFormError(error.code===1?"Location access was declined. Select a landmark or place the pin.":"Could not detect your location. Select a landmark or place the pin.");setGeoBusy(false);},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
 }
 function submitOrder(event:FormEvent){
   event.preventDefault();if(busy)return;setBusy(true);setFormError("");
   try{place({address,pin,scheduled:new Date(scheduled+":00+05:45").toISOString(),payment_method:paymentMethod,payment_status:paymentMethod==="COD"?"cash_due":"simulated_pending",payment_reference:paymentReference});setStage("cart");setPaymentReference("");}
   catch(error){setFormError(error instanceof Error?error.message:"Could not save your demo booking.");}
   finally{setBusy(false);}
 }
 async function copyReference(){
   try{await navigator.clipboard.writeText(paymentReference);setCopyNotice("Reference copied.");}
   catch{setCopyNotice("Copy is unavailable here. Select and copy the reference manually.");}
 }
 const cartContent=stage==="cart"?<section className="mk-overlay-content">
   <div className="mk-overlay-heading"><div><span className="mk-kicker">YOUR SELECTION</span><h2>Your cart</h2><p>Review the scope and starting estimate before you book.</p></div><span className="mk-cart-count">{rows.reduce((n,r)=>n+r.line.quantity,0)} items</span></div>
   {state.diagnostic_draft&&<aside className="mk-diagnostic-checkout"><span className="mk-kicker">AI-ASSISTED SERVICE TRIAGE · NOT A DIAGNOSIS</span><h3>{state.diagnostic_draft.issue_title}</h3><p>{state.diagnostic_draft.explanation}</p><div className="mk-diagnostic-price"><span>Listed service/labour</span><b>{catalogMoney(rows.reduce((sum,{line,service})=>sum+line.quantity*service.base_paisa,0))}</b><span>Visit fee</span><b>{catalogMoney(rows.reduce((sum,{line,service})=>sum+line.quantity*service.visit_paisa,0))}</b><span>Spare parts</span><b>Not included</b></div><small>Parts need an in-person inspection and a separate quote. The Hero must get your approval before buying parts or doing extra work. Photo assessment: {state.diagnostic_draft.photo_assessed?"visual hint, not verified":"not used"}. No diagnostic confidence score is used.</small>{state.diagnostic_draft.safety_note&&<strong role="alert">Safety: {state.diagnostic_draft.safety_note}</strong>}</aside>}
   {!rows.length?<div className="mk-empty-cart"><ShoppingBag size={32}/><h3>Your cart is taking a breather</h3><p>Add a service to see the transparent pricing here.</p><button className="mk-primary" onClick={()=>setModal(null)}>Explore services</button></div>:
   <><div className="mk-cart-lines">{rows.map(({line,service})=><article className="mk-cart-line" key={line.id}><img src={service.image} alt="" width={92} height={72}/><div className="mk-cart-line-main"><b>{service.title}</b><small>{catalogPriceLabel(service)} · listed labour</small>{service.pricing_note&&<small className="mk-cart-price-note">{service.pricing_note}</small>}<div className="mk-quantity"><button onClick={()=>quantity(line.id,line.quantity-1)} aria-label="Remove one"><Minus size={14}/></button><span>{line.quantity}</span><button onClick={()=>quantity(line.id,line.quantity+1)} disabled={line.quantity>=10} aria-label="Add one"><Plus size={14}/></button><button className="mk-remove" onClick={()=>quantity(line.id,0)} aria-label={"Remove "+service.title}><Trash2 size={14}/></button></div></div><strong>{catalogMoney(serviceTotal(service)*line.quantity)}</strong></article>)}</div>
   <div className="mk-cart-summary"><div><span>Listed minimum estimate</span><b>{catalogMoney(total)}</b></div><small>For range or starting-at services, this total uses the lowest listed amount. Parts, materials, and work outside scope require a written quote and your approval. This demo does not charge you or send a provider.</small></div>
    <button className="mk-primary mk-primary-wide" onClick={()=>{if(!state.session){requireCheckoutAuth();return;}setStage("address");setFormError("");}} disabled={!ready}>Continue to address <ChevronRight size={18}/></button></>}
 </section>:<form className="mk-overlay-content" onSubmit={submitOrder}>
   <button type="button" className="mk-back-button" onClick={()=>{setStage(stage==="payment"?"address":"cart");setFormError("");}}><ArrowLeft size={16}/> {stage==="payment"?"Back to address":"Back to cart"}</button>
   {stage==="payment"?<>
   <div className="mk-overlay-heading"><div><span className="mk-kicker">SECURE CHECKOUT PREVIEW</span><h2>Choose how to pay</h2><p>This interactive checkout is a test simulation. It does not contact or charge a payment provider.</p></div></div>
   <div className="mk-price-breakdown"><div><span>Service subtotal</span><b>{catalogMoney(subtotal)}</b></div>{visitFees>0&&<div><span>Visit fees</span><b>{catalogMoney(visitFees)}</b></div>}<div className="mk-price-grand"><span>Minimum listed estimate · न्यूनतम अनुमान</span><b>{catalogMoney(total)}</b></div><small>Range prices are shown at their lowest amount here. Confirm any final change from the Hero’s written quote before work begins.</small></div>
   <fieldset className="mk-payment-options"><legend>Payment method</legend>{([["COD","Cash on Delivery"],["ESEWA","eSewa test QR"],["KHALTI","Khalti test checkout"],["FONEPAY","FonePay Instant QR"]] as const).map(([id,label])=><label key={id} className={paymentMethod===id?"is-selected":""}><input type="radio" name="payment-method" value={id} checked={paymentMethod===id} onChange={()=>setPaymentMethod(id)}/><span><b>{label}</b><small>{id==="COD"?"Pay your Hero in cash after service.":"Scan or inspect a test reference only. No real payment is accepted."}</small></span></label>)}</fieldset>
   {paymentMethod==="COD"?<div className="mk-cod-fee"><span>Illustrative Hero settlement fee · 12.5%</span><b>{catalogMoney(codCommissionPaisa(total))}</b><small>On a real COD job, the platform commission is recorded once when the job is completed.</small></div>:<div className="mk-qr-card"><div><b>{paymentMethod==="FONEPAY"?"FonePay Instant QR · test":paymentMethod+" · test QR"}</b><p>This scannable QR contains a demo reference and amount only. It is not a merchant payment QR.</p><img src={buildDemoPaymentQrUrl(paymentMethod,paymentReference,total)} width={192} height={192} alt="Scannable demo QR containing the test reference and NPR amount" loading="lazy" referrerPolicy="no-referrer"/></div><div className="mk-reference"><small>Copyable test reference</small><strong>{paymentReference}</strong><button type="button" onClick={copyReference}><Copy size={14}/> Copy</button>{copyNotice&&<small role="status">{copyNotice}</small>}</div></div>}
   {formError&&<p className="mk-form-error" role="alert">{formError}</p>}
   <button className="mk-primary mk-primary-wide" disabled={busy||!ready}>{busy?"Saving…":"Save demo booking"} <Check size={16}/></button><p className="mk-demo-caption">{paymentMethod==="COD"?"No payment now. COD is due after service.":"Payment stays unverified in this test flow; the receipt will clearly show that no money was collected."}</p>
   </>:<>
   <div className="mk-overlay-heading"><div><span className="mk-kicker">THE FINAL DETAILS</span><h2>Where should we meet you?</h2><p>Choose a Kathmandu Valley or Pokhara landmark, then add your street and house details.</p></div></div>
   <label className="mk-field-label" htmlFor="mk-landmark">Popular landmarks</label><div className="mk-landmarks">{landmarks.map(item=><button type="button" key={item.name} className={address.startsWith(item.name)?"is-selected":""} onClick={()=>selectLandmark(item)}><MapPin size={14}/>{item.name}</button>)}</div>
   <div className="mk-map-tools"><span><MapPin size={15}/>{pin?pin.latitude.toFixed(5)+", "+pin.longitude.toFixed(5):"Tap the map to place your pin"}</span><button type="button" onClick={locate} disabled={geoBusy}><LocateFixed size={15}/>{geoBusy?"Finding you…":"Use my location"}</button></div>
   <div className="mk-map-frame"><LocationMap value={pin?{...pin,resolved_address:address||null}:null} onPick={point=>{setPin(point);setFormError("Pin saved. Add the street, tole and house details below.");}} disabled={false}/></div>
   <label className="mk-label">Full address<textarea required minLength={5} maxLength={500} value={address} onChange={e=>setAddress(e.target.value)} placeholder="House number, street/tole, landmark, ward and city" rows={3}/></label>
   <label className="mk-label">Appointment time (Nepal Time)<input required type="datetime-local" value={scheduled} onChange={e=>setScheduled(e.target.value)} min={nepalInputFromDate(new Date(Date.now()+3600000))}/></label>
   {formError&&<p className="mk-form-error" role="alert">{formError}</p>}
   <div className="mk-checkout-footer"><div><small>Demo booking estimate</small><b>{catalogMoney(total)}</b></div><button className="mk-primary" type="button" disabled={busy||!ready} onClick={()=>{setPaymentReference("TIR-"+crypto.randomUUID().slice(0,12).toUpperCase());setCopyNotice("");setStage("payment");}}>Review payment <ChevronRight size={16}/></button></div>
   <p className="mk-demo-caption">No payment is taken. This demo receipt stays in this browser; no worker is dispatched.</p></>}
 </form>;
 const orderContent=<section className="mk-overlay-content"><div className="mk-overlay-heading"><div><span className="mk-kicker">SAVED ON THIS DEVICE</span><h2>My demo bookings</h2><p>Receipts and cancellation controls for this browser only.</p></div></div>
   {!state.orders.length?<div className="mk-empty-cart"><CalendarDays size={32}/><h3>No bookings yet</h3><p>Choose any service to create a demo booking.</p><button className="mk-primary" onClick={()=>setModal(null)}>Explore services</button></div>:
   <div className="mk-orders">{state.orders.map(order=><OrderReceipt key={order.id} order={order} onCancel={()=>cancel(order.id)}/>)}</div>}</section>;
 const authContent=<section className="mk-overlay-content mk-auth-content"><div className="mk-overlay-heading"><div><span className="mk-kicker">SIGN IN TO YOUR SPACE</span><h2>Choose your Tirkha portal</h2><p>Continue to the tools that match the way you use Tirkha.</p></div></div>
   <div className="mk-portal-grid">
    <article className="mk-portal-card"><span className="mk-portal-label">For customers</span><h3>Customer account</h3><p>Book help, track requests and manage your service details.</p><div><Link href="/login">Sign in</Link><Link href="/signup">Create account</Link></div></article>
    <article className="mk-portal-card"><span className="mk-portal-label">For service professionals</span><h3>Service Hero portal</h3><p>Apply to become a verified Hero or open your job dashboard.</p><div><Link href="/hero/register">Register as a Hero</Link><Link href="/hero/dashboard">Hero dashboard</Link></div></article>
   </div>
   <div className="mk-auth-divider"><span>or preview the customer demo</span></div>
   <form onSubmit={submitAuth}><label className="mk-label">Phone number<input autoComplete="tel" inputMode="tel" value={phone} onChange={e=>{setPhone(e.target.value);if(code==="123456"&&e.target.value.trim())login(e.target.value);}} placeholder="+977 9800 000 000" maxLength={64}/></label><label className="mk-label">Demo verification code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>{const value=e.target.value;setCode(value);if(value==="123456"&&phone.trim())login(phone);}} placeholder="Enter 123456" maxLength={6}/></label>
   {authError&&<p className="mk-form-error" role="alert">{authError}</p>}<button className="mk-primary mk-primary-wide" type="submit">Continue with demo code <ChevronRight size={18}/></button></form>
   <button className="mk-one-click" onClick={oneClick}>One-Click Demo Login <span aria-hidden="true">→</span></button>
   <p className="mk-demo-caption">Demo identity is stored locally for seven days and never creates a Supabase user. No SMS is sent.</p></section>;
 return <>
   {current&&<MarketplaceDialog key={current.id} title={current.title} onClose={()=>setDetail(null)} wide><div className="mk-detail"><img className="mk-detail-image" src={current.image} alt={current.category_name+" service in a Kathmandu home"}/><div className="mk-detail-body"><span className="mk-kicker">{current.category_name} · {current.vertical}</span><h2>{current.title}</h2><p>{current.description}</p><div className="mk-rate-card"><div><small>Listed rate · सेवा दर</small><b>{catalogPriceLabel(current)}</b></div>{current.visit_paisa>0?<><span>+</span><div><small>Visit fee</small><b>{catalogMoney(current.visit_paisa)}</b></div><i></i><div><small>Starting total</small><b>{catalogMoney(serviceTotal(current))}</b></div></>:<><i></i><div><small>Scope</small><b>As listed</b></div></>}</div>{current.pricing_note&&<p className="mk-pricing-note">{current.pricing_note}</p>}
     <div className="mk-duration"><Clock3 size={16}/> Estimated time: {current.duration_minutes>=60?Math.floor(current.duration_minutes/60)+" hr"+(current.duration_minutes%60?" "+current.duration_minutes%60+" min":""):current.duration_minutes+" min"}</div>
     <div className="mk-scope-grid"><div><h3><Check size={16}/> What’s included</h3><ul>{current.included.map(x=><li key={x}>{x}</li>)}</ul></div><div><h3><X size={16}/> What’s excluded</h3><ul>{current.excluded.map(x=><li key={x}>{x}</li>)}</ul></div></div>
     <p className="mk-detail-disclaimer">Parts and extra work require a separate quote and your approval. Photos illustrate the activity; no provider availability is implied.</p><div className="mk-detail-actions"><button className="mk-outline" onClick={()=>add(current.id)}>Add to cart</button><button className="mk-primary" onClick={()=>add(current.id,true)}>Book now <ChevronRight size={17}/></button></div></div></div></MarketplaceDialog>}
   {modal&&<MarketplaceDialog key={modal} title={modal==="cart"?"Your Tirkha cart":modal==="auth"?"Tirkha portals":"My demo bookings"} onClose={()=>setModal(null)}>{modal==="cart"?cartContent:modal==="auth"?authContent:orderContent}</MarketplaceDialog>}
 </>;
}
function OrderReceipt({order,onCancel}:{order:DemoOrder;onCancel:()=>void}){
 const [elapsed,setElapsed]=useState(0);
 useEffect(()=>{if(order.status!=="requested")return;const start=Date.now();const timer=setInterval(()=>setElapsed((Date.now()-start)%60000),1000);return()=>clearInterval(timer);},[order.status]);
 const progress=Math.min(1,elapsed/60000);
 return <article className="mk-receipt"><div className="mk-receipt-head"><div><small>DEMO BOOKING · {order.id.slice(0,8).toUpperCase()}</small><h3>{order.status==="cancelled"?"Cancelled":"Request saved"}</h3></div><span className={"mk-status "+(order.status==="cancelled"?"is-cancelled":"")}>{order.status}</span></div>
   <p><MapPin size={15}/>{order.address} · {order.region}</p><p><CalendarDays size={15}/>{formatSchedule(order.scheduled)}</p>{order.diagnostic&&<aside className="mk-diagnostic-checkout"><span className="mk-kicker">SERVICE REQUEST SUMMARY</span><h3>{order.diagnostic.issue_title}</h3><p>{order.diagnostic.symptom}</p><small>{order.diagnostic.area?`Area noted in chat: ${order.diagnostic.area} · `:""}{order.diagnostic.preferred_time?`Preferred time: ${order.diagnostic.preferred_time} · `:""}{order.diagnostic.photo_assessed?"Photo was assessed transiently; the image itself is not saved. ":""}Root cause and parts remain subject to inspection.</small></aside>}<div className="mk-receipt-items">{order.items.map((item,i)=><div key={item.id+i}><span>{item.title} × {item.quantity}</span><b>{catalogMoney(item.unit_paisa*item.quantity)}</b></div>)}</div><div className="mk-receipt-total"><span>Total estimate</span><b>{catalogMoney(order.total_paisa)}</b></div><div className="mk-receipt-payment"><span>Payment</span><b>{order.payment_method} · {order.payment_status==="cash_due"?"Cash due after service":"Test only · not paid"}</b></div>{order.payment_reference&&<div className="mk-receipt-payment"><span>Reference</span><b>{order.payment_reference}</b></div>}
   {order.status==="requested"&&order.pin&&<div className="mk-demo-tracking"><div className="mk-track-heading"><span className="mk-track-dot"/><div><b>Map preview</b><small>Demo simulation · No worker has been assigned</small></div><span className="mk-hero-marker">Hero · demo</span></div><div className="mk-track-map"><div className="mk-track-line"/><span className="mk-track-home" style={{left:"78%"}} title="Your saved home pin"><MapPin size={19}/></span><span className="mk-track-worker" style={{left:(8+progress*55)+"%"}} title="Simulated preview only">H</span></div><div className="mk-track-legend"><span>Illustrative worker route</span><span>Your saved pin</span></div></div>}
   {order.status==="requested"&&<button className="mk-cancel-order" onClick={onCancel}>Cancel demo booking</button>}<p className="mk-demo-caption">This receipt is stored only in this browser. No payment, live provider tracking, or dispatch is connected.</p>
 </article>;
}

