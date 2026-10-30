"use client";
import { useMemo, useState } from "react";
import { MapPin, ArrowUpRight, ArrowRight, Search, ShoppingBag, Wrench, Sparkles, HeartPulse, BookOpen, ShieldCheck, Clock3, Check, Menu, X } from "lucide-react";
import { REGIONS, catalogMoney, catalogPriceLabel, catalogServiceMatchesQuery, inRegion, serviceTotal, type CatalogService } from "@tirkha/shared";
import { useMarketplace } from "./marketplace-provider";
import { useAuth } from "./auth-provider";
const categories=[["All services",Sparkles],["Home repairs",Wrench],["Cleaning",Sparkles],["Care & wellness",HeartPulse],["Everyday support",BookOpen]] as const;
export function ServiceCard({service,compact=false}:{service:CatalogService;compact?:boolean}){
 const {add,setDetail,ready}=useMarketplace();
 return <article className={compact?"mk-card mk-card-compact":"mk-card"}>
   <button className="mk-image-button" onClick={()=>setDetail(service.id)} aria-label={"View "+service.title}><img src={service.image} alt={`Local professional providing ${service.title.toLowerCase()} in a Kathmandu Valley home`} loading="lazy" width={900} height={600}/><span className="mk-image-tag">{service.category_name}</span></button>
   <div className="mk-card-body"><div className="mk-card-meta"><span><Clock3 size={13}/>{service.duration_minutes} min</span><span>At your doorstep</span></div>
     <button className="mk-title-button" onClick={()=>setDetail(service.id)}><h3>{service.title}</h3></button>
     {!compact&&<p>{service.description}</p>}
     <div className="mk-card-bottom"><div className="mk-card-price"><small>Listed rate · सेवा दर</small><strong>{catalogPriceLabel(service)}</strong>{service.pricing_note&&<small className="mk-card-price-note">{service.pricing_note}</small>}</div><button className="mk-add" disabled={!ready} onClick={()=>add(service.id)} aria-label={"Add "+service.title+" to cart"}>Add <span>+</span></button></div>
   </div>
 </article>;
}
export function Marketplace(){
 const {state,services,setRegion,setModal,logout,ready}=useMarketplace();
 const {session}=useAuth();
 const [query,setQuery]=useState(""),[vertical,setVertical]=useState("All services"),[nav,setNav]=useState(false);
 const filtered=useMemo(()=>services.filter(s=>s.active&&inRegion(s,state.region)&&(vertical==="All services"||s.vertical===vertical)&&catalogServiceMatchesQuery(s,query)),[services,state.region,vertical,query]);
 const count=state.cart.reduce((sum,l)=>sum+l.quantity,0);
 const signedIn=Boolean(session||state.session);
 return <div className="mk">
  <div className="mk-announcement">A little help. A better everyday. <span>Made for life in Nepal <ArrowUpRight size={12}/></span></div>
  <header className="mk-header"><a href="/" className="mk-brand" aria-label="Tirkha | तिर्खा home"><span className="mk-brand-mark">T<span>•</span></span><span className="mk-brand-name">Tirkha <span className="mk-brand-nepali">| तिर्खा</span></span></a>
   <label className="mk-region"><MapPin size={17}/><span className="sr-only">Service region</span><select value={state.region} onChange={e=>setRegion(e.target.value as typeof state.region)}>{REGIONS.map(r=><option key={r}>{r}</option>)}</select></label>
   <nav className={nav?"mk-nav mk-nav-open":"mk-nav"} aria-label="Main navigation"><a href="#catalog" onClick={()=>setNav(false)}>Explore services</a><a href="/map" onClick={()=>setNav(false)}>Our map</a><a href="#how-it-works" onClick={()=>setNav(false)}>How it works</a><button onClick={()=>{setModal("orders");setNav(false);}}>My demo bookings</button></nav>
   <div className="mk-header-actions"><button className="mk-bag" onClick={()=>setModal("cart")} aria-label={"Open cart, "+count+" items"}><ShoppingBag size={20}/>{count>0&&<span>{count}</span>}</button>
   <button className="mk-login" disabled={!ready} onClick={()=>signedIn?logout():setModal("auth")}>{signedIn?"Sign out":"Sign in"}</button><button className="mk-mobile-nav" aria-label={nav?"Close navigation":"Open navigation"} onClick={()=>setNav(!nav)}>{nav?<X/>:<Menu/>}</button></div>
  </header>
  <main>
   <section className="mk-hero">
    <img className="mk-hero-image" src="/images/tirkha-hero-team.webp" alt="Nepali Tirkha home-service professionals in navy uniforms in a Kathmandu home" width={1600} height={900} fetchPriority="high"/>
    <div className="mk-hero-shade"/><div className="mk-hero-content"><div className="mk-eyebrow"><span/> TIRKHA | तिर्खा · YOUR CITY. YOUR HOME.</div>
      <h1>A little help,<br/>for the place<br/>you call <em>home.</em></h1>
      <p>Nepal’s Premier Home Services Marketplace</p><p className="mk-hero-sub">From a leaking tap to a fresh start.<br/>Everyday services, right at your doorstep.</p>
      <form className="mk-hero-search" role="search" onSubmit={event=>{event.preventDefault();document.getElementById("catalog")?.scrollIntoView({behavior:"smooth"});}}>
        <Search size={19} aria-hidden="true"/><label className="sr-only" htmlFor="hero-service-search">Search home services</label><input id="hero-service-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="What do you need help with?" aria-label="Search home services"/><button type="submit">Find your everyday expert <ArrowUpRight size={18}/></button>
      </form>
      <div className="mk-hero-promises"><span><Check size={14}/>Clear pricing</span><span><Check size={14}/>Local service catalog</span><span><Check size={14}/>Carefully defined scopes</span></div>
    </div>
    <div className="mk-hero-location"><MapPin size={15}/><div>Kathmandu Valley<small>Our home. Just like yours.</small></div></div>
    <span className="mk-hero-credit">Local Tirkha Hero team · Kathmandu Valley</span>
   </section>
   <section className="mk-discovery" id="catalog"><div className="mk-section-top"><div><span className="mk-kicker">GOOD HELP STARTS HERE</span><h2>What can we help you with?</h2><p>Small fixes, fresh spaces, and a little more peace of mind.</p></div>
     <label className="mk-search"><Search size={18}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try “plumbing” or “cleaning”" aria-label="Search services"/></label></div>
     <div className="mk-category-tabs" aria-label="Service categories">{categories.map(([label,Icon])=><button key={label} aria-pressed={vertical===label} className={vertical===label?"is-active":""} onClick={()=>setVertical(label)}><Icon size={19}/>{label}</button>)}</div>
     <div className="mk-results-label"><span>{filtered.length} services to make life easier</span><span><MapPin size={13}/>{state.region}</span></div>
     <div className="mk-grid">{filtered.map(service=><ServiceCard key={service.id} service={service}/>)}</div>
     {!filtered.length&&<div className="mk-empty"><Search/><h3>No matching services</h3><p>Try another search or explore all categories.</p><button className="mk-primary" onClick={()=>{setQuery("");setVertical("All services");}}>Show all services</button></div>}
     <p className="mk-price-note">Listed Kathmandu starting rates are shown in NPR. Any parts, materials or work beyond the listed scope need a written quote and your approval. मूल्य स्पष्ट, काम सुरु हुनुअघि पुष्टि.</p>
   </section>
   <section className="mk-care-strip"><div className="mk-care-icon"><HeartPulse size={32}/></div><div><span className="mk-kicker">CARE THAT COMES TO YOU</span><h2>For the people who make it home.</h2><p>Explore scheduled home care, wellness and everyday support.</p></div><a className="mk-outline" href="#catalog" onClick={()=>{setVertical("Care & wellness");setQuery("");}}>Explore home care <ArrowRight size={17}/></a></section>
   <section className="mk-how" id="how-it-works"><div><span className="mk-kicker">LESS COORDINATING. MORE LIVING.</span><h2>Your to-do list,<br/>a little lighter.</h2><p>Try the complete demo journey.<br/>No SMS, payment, or provider dispatch.</p></div>
     {[["01","Find your service","Explore clear scopes, time estimates, and itemized starting prices.",Search],["02","Make it yours","Pick a time and a familiar landmark. Drop a pin for extra clarity.",MapPin],["03","Leave the details to us","Save your demo booking, review the receipt, and manage it from this browser.",ShieldCheck]].map(([n,title,body,Icon])=>{const Symbol=Icon as typeof Search;return <article key={String(n)}><span className="mk-step">{String(n)}</span><Symbol size={24}/><h3>{String(title)}</h3><p>{String(body)}</p></article>;})}
   </section>
  </main>
 </div>;
}

