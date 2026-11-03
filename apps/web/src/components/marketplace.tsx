"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, ArrowUpRight, ArrowRight, Search, ShoppingBag, Wrench, Sparkles, HeartPulse, BookOpen, ShieldCheck, Clock3, Check, Menu, X } from "lucide-react";
import { REGIONS, catalogPriceLabel, catalogServiceMatchesQuery, fallbackAvailability, translateCatalogLabel, translatePriceLabel, translateRegionName, translateUi, type CatalogService, type UiTranslationKey } from "@tirkha/shared";
import { useMarketplace } from "./marketplace-provider";
import { useAuth } from "./auth-provider";
import { LanguageSwitcher, useLanguage } from "./language-provider";
import { TirkhaMark } from "./tirkha-mark";
const categories: readonly (readonly [UiTranslationKey, typeof Sparkles])[] = [["allServices",Sparkles],["homeRepairs",Wrench],["cleaning",Sparkles],["careWellness",HeartPulse],["everydaySupport",BookOpen]];
const openingSeenKey = "tirkha.opening-story.seen.v1";

function OpeningStory() {
 const [visible,setVisible]=useState(true);
 const exploreRef=useRef<HTMLButtonElement>(null);
 const dismiss=()=>{
  try{sessionStorage.setItem(openingSeenKey,"1");}catch{/* The welcome story still closes when session storage is unavailable. */}
  document.body.style.overflow="";
  setVisible(false);
 };
 useEffect(()=>{
  try{if(sessionStorage.getItem(openingSeenKey)==="1"){setVisible(false);return;}}catch{/* Show the introduction when browser storage is unavailable. */}
  document.body.style.overflow="hidden";
  exploreRef.current?.focus();
  const timeout=window.setTimeout(dismiss,6500);
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")dismiss();};
  window.addEventListener("keydown",onKeyDown);
  return()=>{window.clearTimeout(timeout);window.removeEventListener("keydown",onKeyDown);document.body.style.overflow="";};
 },[]);
 if(!visible)return null;
 return <div className="mk-opening-backdrop" role="dialog" aria-modal="true" aria-labelledby="mk-opening-title" aria-describedby="mk-opening-copy">
  <article className="mk-opening-card">
   <img src="/images/tirkha-hero-team.webp" alt="Tirkha local home-service professionals ready to help" fetchPriority="high"/>
   <div className="mk-opening-shade" aria-hidden="true"/>
   <div className="mk-opening-copy">
    <p className="mk-opening-brand"><TirkhaMark className="mk-opening-mark"/><span>Tirkha <b>| तिर्खा</b></span></p>
    <span className="mk-opening-kicker">A LITTLE STORY FROM HOME · घरको एउटा सानो कथा</span>
    <h1 id="mk-opening-title">Your home,<br/>effortlessly managed.<br/>More time for life.</h1>
    <p id="mk-opening-copy" className="mk-opening-english">Thoughtful home repairs, cleaning, and care—with clear service details and local professionals ready when you need them.</p>
    <div className="mk-opening-divider" aria-hidden="true"><span/><span/><span/></div>
    <h2 lang="ne">घरको झन्झट सधैंलाई बिदा, आफ्नै घरमा आराम र सुविधा।</h2>
    <p className="mk-opening-nepali" lang="ne">मर्मत, सरसफाइ र घरमै हेरचाह—स्पष्ट विवरणसहित, तपाईंको समयअनुसार विश्वासिलो स्थानीय सेवामा पहुँच।</p>
    <div className="mk-opening-actions">
     <button ref={exploreRef} type="button" className="mk-opening-cta" onClick={()=>{dismiss();window.setTimeout(()=>document.getElementById("catalog")?.scrollIntoView({behavior:"smooth"}),80);}}>Explore services <span lang="ne">सेवा हेर्नुहोस्</span><ArrowUpRight size={17}/></button>
     <button type="button" className="mk-opening-skip" onClick={dismiss}>Skip intro <span lang="ne">परिचय छोड्नुहोस्</span></button>
    </div>
    <p className="mk-opening-footnote">Clear choices. Local service. · स्पष्ट छनोट। स्थानीय सेवा।</p>
   </div>
   <span className="mk-opening-gold-mark" aria-hidden="true">✦</span>
  </article>
 </div>;
}

export function ServiceCard({service,compact=false}:{service:CatalogService;compact?:boolean}){
 const {add,setDetail,ready,state,canBookService,catalogStatus}=useMarketplace();
 const {language}=useLanguage();
 const title=translateCatalogLabel(service.title,language);
 const available=canBookService(service);
 const status=service.availability_status??fallbackAvailability(service,state.region);
 const availabilityLabel=catalogStatus==="loading"?translateUi("checkingAvailability",language):catalogStatus==="error"?translateUi("availabilityUnverified",language):status==="available"?translateUi("serviceAvailable",language):`${translateUi(status==="paused"?"pausedIn":"comingSoonIn",language)} ${translateRegionName(state.region,language)}`;
 const addLabel=available?translateUi("add",language):catalogStatus==="loading"?translateUi("checkingAvailability",language):catalogStatus==="error"?translateUi("availabilityUnverified",language):`${translateUi(status==="paused"?"pausedIn":"comingSoonIn",language)} ${translateRegionName(state.region,language)}`;
 return (
  <article className={compact?"mk-card mk-card-compact":"mk-card"}>
   <button className="mk-image-button" type="button" onClick={()=>setDetail(service.id)} aria-label={`${translateUi("viewService",language)} ${title}`}>
    <img src={service.image} alt={`Local professional providing ${title.toLowerCase()} in a Kathmandu Valley home`} loading="lazy" width={900} height={600}/>
    <span className="mk-image-tag">{translateCatalogLabel(service.category_name,language)}</span>
   </button>
   <div className="mk-card-body">
    <div className="mk-card-meta"><span><Clock3 size={13}/>{service.duration_minutes} {translateUi("minutesShort",language)}</span><span>{translateUi("atDoorstep",language)}</span></div>
    <button className="mk-title-button" type="button" onClick={()=>setDetail(service.id)}><h3>{title}</h3></button>
    {!compact&&<p>{translateCatalogLabel(service.description,language)}</p>}
    <div className="mk-card-bottom">
     <div className="mk-card-price">
      <small>{translateUi("listedRate",language)}{service.pricing_unit?` · ${translateCatalogLabel(service.pricing_unit,language)}`:""}</small>
      <strong>{translatePriceLabel(catalogPriceLabel(service),language)}</strong>
      <small className={`mk-availability ${available?"is-available":"is-coming-soon"}`} aria-label={availabilityLabel}>{availabilityLabel}</small>
      {service.pricing_note&&<small className="mk-card-price-note">{translateCatalogLabel(service.pricing_note,language)}</small>}
     </div>
     <button className="mk-add" type="button" disabled={!ready||!available} onClick={()=>add(service.id)} aria-label={`${translateUi("add",language)} ${title} ${language==="np"?"कार्टमा":"to cart"}`}>
      {addLabel}{available&&<span>+</span>}
     </button>
    </div>
   </div>
  </article>
 );
}
export function Marketplace(){
 const {state,services,setRegion,setModal,logout,ready,catalogStatus,refreshRegionalCatalog}=useMarketplace();
 const {session}=useAuth();
 const {language}=useLanguage();
 const tr=(key:UiTranslationKey)=>translateUi(key,language);
 const [query,setQuery]=useState(""),[vertical,setVertical]=useState("All services"),[nav,setNav]=useState(false);
 useEffect(()=>{
  if(!nav)return;
  const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape")setNav(false);};
  window.addEventListener("keydown",closeOnEscape);
  return()=>window.removeEventListener("keydown",closeOnEscape);
 },[nav]);
 const filtered=useMemo(()=>services.filter(s=>s.active&&(vertical==="All services"||s.vertical===vertical)&&catalogServiceMatchesQuery(s,query)),[services,state.region,vertical,query]);
 const count=state.cart.reduce((sum,l)=>sum+l.quantity,0);
 const signedIn=Boolean(session||state.session);
 const accountAction=()=>{setNav(false);signedIn?logout():setModal("auth");};
 return <><OpeningStory/><div className="mk">
  <div className="mk-announcement">{tr("tagline")} <span>{tr("madeForNepal")} <ArrowUpRight size={12}/></span></div>
  <div className="mk-utility-bar"><label className="mk-region"><MapPin size={16}/><span className="sr-only">{language === "np" ? "सेवा क्षेत्र" : "Service region"}</span><select value={state.region} onChange={e=>setRegion(e.target.value as typeof state.region)}>{REGIONS.map(r=><option key={r} value={r}>{translateRegionName(r,language)}</option>)}</select></label><LanguageSwitcher/></div>
  <header className="mk-header"><a href="/" className="mk-brand" aria-label="Tirkha | तिर्खा home"><TirkhaMark className="mk-brand-mark"/><span className="mk-brand-name">Tirkha <span className="mk-brand-nepali">| तिर्खा</span></span></a>
   <nav id="mk-main-nav" className={nav?"mk-nav mk-nav-open":"mk-nav"} aria-label={language === "np" ? "मुख्य नेभिगेसन" : "Main navigation"}><a href="#catalog" onClick={()=>setNav(false)}>{tr("exploreServices")}</a><a href="/map" onClick={()=>setNav(false)}>{tr("ourMap")}</a><a href="#how-it-works" onClick={()=>setNav(false)}>{tr("howItWorks")}</a><button type="button" className="mk-nav-account" disabled={!ready} onClick={accountAction}>{signedIn?tr("signOut"):tr("signIn")}</button></nav>
   <div className="mk-header-actions"><button className="mk-bag" onClick={()=>setModal("cart")} aria-label={language === "np" ? `कार्ट खोल्नुहोस्, ${count} वस्तु` : `Open cart, ${count} items`}><ShoppingBag size={20}/>{count>0&&<span>{count}</span>}</button>
   <button className="mk-login" disabled={!ready} onClick={accountAction}>{signedIn?tr("signOut"):tr("signIn")}</button><button type="button" className="mk-mobile-nav" aria-label={nav?"Close navigation":"Open navigation"} aria-expanded={nav} aria-controls="mk-main-nav" onClick={()=>setNav(!nav)}>{nav?<X/>:<Menu/>}</button></div>
  </header>
  {catalogStatus==="error"&&<div className="mk-catalog-error" role="alert"><span>{tr("availabilityError")}</span><button type="button" onClick={refreshRegionalCatalog}>{tr("retry")}</button></div>}
  <main>
   <section className="mk-hero">
    <img className="mk-hero-image" src="/images/tirkha-hero-team.webp" alt="Nepali Tirkha home-service professionals in navy uniforms in a Kathmandu home" width={1600} height={900} fetchPriority="high"/>
    <div className="mk-hero-shade"/><div className="mk-hero-content"><div className="mk-eyebrow"><span/> TIRKHA | तिर्खा · {tr("heroEyebrow")}</div>
      <h1>{tr("heroTitleLine1")}<br/>{tr("heroTitleLine2")}<br/><em>{tr("heroTitleLine3")}</em></h1>
      <p>{tr("heroMarketplace")}</p><p className="mk-hero-sub">{tr("heroSubline1")}<br/>{tr("heroSubline2")}</p>
      <form className="mk-hero-search" role="search" onSubmit={event=>{event.preventDefault();document.getElementById("catalog")?.scrollIntoView({behavior:"smooth"});}}>
        <Search size={19} aria-hidden="true"/><label className="sr-only" htmlFor="hero-service-search">{language === "np" ? "घरायसी सेवा खोज्नुहोस्" : "Search home services"}</label><input id="hero-service-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={tr("searchPlaceholder")} aria-label={language === "np" ? "घरायसी सेवा खोज्नुहोस्" : "Search home services"}/><button type="submit">{tr("searchCta")} <ArrowUpRight size={18}/></button>
      </form>
      <div className="mk-hero-promises"><span><Check size={14}/>{tr("clearPricing")}</span><span><Check size={14}/>{tr("localCatalog")}</span><span><Check size={14}/>{tr("definedScopes")}</span></div>
    </div>
    <div className="mk-hero-location"><MapPin size={15}/><div>{tr("valley")}<small>{tr("valleyHome")}</small></div></div>
    <span className="mk-hero-credit">{tr("localHeroTeam")} · {tr("valley")}</span>
   </section>
   <section className="mk-discovery" id="catalog"><div className="mk-section-top"><div><span className="mk-kicker">{tr("discoveryEyebrow")}</span><h2>{tr("discoveryTitle")}</h2><p>{tr("discoverySub")}</p></div>
     <label className="mk-search"><Search size={18}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={tr("searchServices")} aria-label={language === "np" ? "सेवा खोज्नुहोस्" : "Search services"}/></label></div>
     <div className="mk-category-tabs" aria-label={language === "np" ? "सेवा वर्गहरू" : "Service categories"}>{categories.map(([key,Icon])=>{const label=translateUi(key,language);const verticalKey=key === "allServices" ? "All services" : key === "homeRepairs" ? "Home repairs" : key === "careWellness" ? "Care & wellness" : key === "everydaySupport" ? "Everyday support" : "Cleaning";return <button key={key} aria-pressed={vertical===verticalKey} className={vertical===verticalKey?"is-active":""} onClick={()=>setVertical(verticalKey)}><Icon size={19}/>{label}</button>;})}</div>
     <div className="mk-results-label"><span>{filtered.length} {tr("servicesCount")}</span><span><MapPin size={13}/>{translateRegionName(state.region,language)}</span></div>
     <div className="mk-grid">{filtered.map(service=><ServiceCard key={service.id} service={service}/>)}</div>
     {!filtered.length&&<div className="mk-empty"><Search/><h3>{tr("noMatches")}</h3><p>{tr("noMatchesHint")}</p><button className="mk-primary" onClick={()=>{setQuery("");setVertical("All services");}}>{tr("showAll")}</button></div>}
     <p className="mk-price-note">{tr("priceNote")}</p>
   </section>
   <section className="mk-care-strip"><div className="mk-care-icon"><HeartPulse size={32}/></div><div><span className="mk-kicker">{tr("careKicker")}</span><h2>{tr("careTitle")}</h2><p>{tr("careDescription")}</p></div><a className="mk-outline" href="#catalog" onClick={()=>{setVertical("Care & wellness");setQuery("");}}>{tr("exploreHomeCare")} <ArrowRight size={17}/></a></section>
    <HowItWorks />
  </main>
  </div></>;
}

function HowItWorks(){
 const {language}=useLanguage();
 const [copyLanguage,setCopyLanguage]=useState<"en"|"np">(language);
 const isNepali=copyLanguage==="np";
 const steps=[
  {number:"01",title:isNepali?"आफ्नो सेवा छान्नुहोस्":"Find your service",body:isNepali?"सेवा वर्ग र कामको विवरण हेर्नुहोस्। बुक गर्न मिल्ने सेवा र देखाइएको मूल्य पहिले नै जाँच्नुहोस्।":"Choose a category and exact service. Review its scope, transparent listed price and regional availability before booking.",Icon:Search},
  {number:"02",title:isNepali?"ठेगाना र समय तय गर्नुहोस्":"Set your address & time",body:isNepali?"आफूलाई मिल्ने समय छान्नुहोस् र नक्सामा घर वा प्रवेशद्वारको सही पिन राख्नुहोस्।":"Choose a suitable time and place a precise pin at your home or entrance on the map.",Icon:MapPin},
  {number:"03",title:isNepali?"प्रगति हेर्दै ढुक्क हुनुहोस्":"Relax & track progress",body:isNepali?"भेरिफाइड Hero ले अनुरोध स्वीकार गरेपछि बुकिङको स्थिति हेर्नुहोस्। उपलब्ध विकल्पअनुसार eSewa, Khalti वा नगदबाट भुक्तानी गर्नुहोस्।":"When a verified Hero accepts, follow the booking status and updates. Pay by eSewa, Khalti or cash where offered for your booking.",Icon:ShieldCheck},
 ];
 return <section className="mk-how" id="how-it-works" lang={isNepali?"ne":"en"} aria-labelledby="mk-how-title"><div className="mk-how-intro"><span className="mk-kicker">{isNepali?"कम समन्वय। आफ्ना लागि बढी समय।":"LESS COORDINATING. MORE LIVING."}</span><h2 id="mk-how-title">{isNepali?<>Tirkha कसरी<br/>काम गर्छ?</>:<>How Tirkha<br/>works</>}</h2><p>{isNepali?"सेवा छान्नेदेखि कामको अपडेट हेर्नेसम्म—सजिलो र स्पष्ट।":"A clear path from choosing a service to knowing what happens next."}</p><div className="mk-how-language" role="group" aria-label={isNepali?"भाषा छान्नुहोस्":"Choose section language"}><button type="button" lang="en" aria-pressed={!isNepali} onClick={()=>setCopyLanguage("en")}>English</button><button type="button" lang="ne" aria-pressed={isNepali} onClick={()=>setCopyLanguage("np")}>नेपाली</button></div></div>
  {steps.map(({number,title,body,Icon})=><article key={number}><span className="mk-step">{number}</span><Icon size={24}/><h3>{title}</h3><p>{body}</p></article>)}
 </section>;
}

