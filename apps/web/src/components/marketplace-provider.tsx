"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import seed from "@tirkha/shared/service-catalog";
import { applyCatalogPriceOverride, catalogServiceSchema, diagnosticDraftSchema, marketplaceStateSchema, serviceTotal, type CatalogService, type DemoOrder, type DiagnosticDraft, type MarketplaceState } from "@tirkha/shared";
import { useAuth } from "./auth-provider";
import { MarketplaceOverlays } from "./marketplace-overlays";
import { ServiceAssistant } from "./service-assistant";
import { SiteFooter } from "./footer";
import { LegalModals } from "./legal-modals";

const storageKey="tirkha.marketplace.v1";
const initial:MarketplaceState={version:1,region:"Kathmandu Valley",cart:[],session:null,orders:[],diagnostic_draft:null};
type Modal="auth"|"cart"|"orders"|null;
export type LegalTopic="about"|"terms"|"privacy"|"cancellation"|"grievance";
type Store={
 state:MarketplaceState; services:CatalogService[]; ready:boolean; notice:string; modal:Modal; detail:string|null;
 setRegion:(region:MarketplaceState["region"])=>void; add:(id:string,checkout?:boolean)=>void; addDiagnostic:(id:string,diagnostic:DiagnosticDraft)=>void; quantity:(id:string,n:number)=>void;
 setModal:(modal:Modal)=>void; setDetail:(id:string|null)=>void; setLegalModal:(topic:LegalTopic|null)=>void; login:(phone:string)=>void; logout:()=>void;
 requireCheckoutAuth:()=>void;
 place:(input:Pick<DemoOrder,"address"|"pin"|"scheduled"|"payment_method"|"payment_status"|"payment_reference">)=>void; cancel:(id:string)=>void; inform:(message:string)=>void;
};
const Context=createContext<Store|null>(null);
export function useMarketplace(){const value=useContext(Context);if(!value)throw new Error("Marketplace provider missing");return value;}
export function MarketplaceProvider({children}:{children:ReactNode}){
 const {client,signOut:clearAuthSession}=useAuth();
 const [state,setState]=useState(initial);
 const [services,setServices]=useState(()=>catalogServiceSchema.array().parse(seed).map(applyCatalogPriceOverride));
 const [ready,setReady]=useState(false),[notice,setNotice]=useState(""),[modal,setModal]=useState<Modal>(null),[detail,setDetail]=useState<string|null>(null),[legalModal,setLegalModal]=useState<LegalTopic|null>(null);
 const checkoutAfterLogin=useRef(false);
 useEffect(()=>{
   const restore=(text:string|null)=>{
     if(!text)return initial;
     const parsed=marketplaceStateSchema.safeParse(JSON.parse(text));
     if(!parsed.success)throw new Error("Saved demo data was incompatible.");
     return {...parsed.data,session:parsed.data.session && parsed.data.session.expires>Date.now()?parsed.data.session:null,diagnostic_draft:parsed.data.diagnostic_draft??null};
   };
   try{setState(restore(localStorage.getItem(storageKey)));}catch{setNotice("Saved demo data could not be restored. You can start a new cart.");}
   setReady(true);
   const update=(event:StorageEvent)=>{if(event.key===storageKey){try{setState(restore(event.newValue));}catch{setNotice("Could not read the other tab's changes.");}}};
   window.addEventListener("storage",update);return()=>window.removeEventListener("storage",update);
 },[]);
 useEffect(()=>{if(ready)try{const data=JSON.stringify(state);if(localStorage.getItem(storageKey)!==data)localStorage.setItem(storageKey,data);}catch{setNotice("Browser storage is unavailable. Keep this tab open to retain your demo cart.");}},[state,ready]);
 useEffect(()=>{if(!client)return;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
   void (async()=>{try{const {data,error}=await client.from("service_offerings").select("*").eq("active",true).order("sort_order").abortSignal(controller.signal);
     if(error)throw error;
     const parsed=catalogServiceSchema.array().parse(data).map(applyCatalogPriceOverride);
     if(!controller.signal.aborted&&parsed.length>0)setServices(parsed);
   }catch{ /* Bundled catalog is the validated offline fallback. */ }finally{clearTimeout(timer);}})();
   return()=>{controller.abort();clearTimeout(timer);};
 },[client]);
 useEffect(()=>{const timer=setInterval(()=>setState(s=>s.session && s.session.expires<=Date.now()?{...s,session:null}:s),60000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(""),5000);return()=>clearTimeout(timer);},[notice]);
 function add(id:string,checkout=false){
   if(!ready)return;
   const service=services.find(s=>s.id===id&&s.active);if(!service)return;
   setState(s=>{const line=s.cart.find(l=>l.id===id);return {...s,cart:line?s.cart.map(l=>l.id===id?{...l,quantity:Math.min(10,l.quantity+1)}:l):[...s.cart,{id,quantity:1}]};});
   setNotice(service.title+" added to your cart");
   if(checkout){setDetail(null);checkoutAfterLogin.current=true;setModal(state.session?"cart":"auth");}
 }
 function open(next:Modal){checkoutAfterLogin.current=false;setModal(next);}
 function requireCheckoutAuth(){checkoutAfterLogin.current=true;setModal("auth");}
 function login(phone:string){setState(s=>({...s,session:{phone:phone.trim().slice(0,64)||"Demo guest",expires:Date.now()+7*86400000}}));setModal(checkoutAfterLogin.current?"cart":null);checkoutAfterLogin.current=false;setNotice("Demo session ready. No SMS sent.");}
 function place(input:Pick<DemoOrder,"address"|"pin"|"scheduled"|"payment_method"|"payment_status"|"payment_reference">){
   if(!state.session)throw new Error("Start a demo session first.");
   if(!state.cart.length)throw new Error("Add a service to your cart.");
   if(input.address.trim().length<5)throw new Error("Enter a complete landmark or address.");
   if(!Number.isFinite(Date.parse(input.scheduled)) || Date.parse(input.scheduled)<=Date.now())throw new Error("Choose a future appointment.");
   const items=state.cart.map(l=>{const s=services.find(s=>s.id===l.id&&s.active);if(!s)throw new Error("A service is no longer available. Remove it from the cart.");return {id:s.id,title:s.title,quantity:l.quantity,unit_paisa:serviceTotal(s)};});
   const order:DemoOrder={...input,address:input.address.trim(),diagnostic:state.diagnostic_draft??undefined,id:crypto.randomUUID(),created:new Date().toISOString(),region:state.region,items,total_paisa:items.reduce((t,i)=>t+i.quantity*i.unit_paisa,0),status:"requested",demo:true};
   setState(s=>({...s,cart:[],orders:[order,...s.orders].slice(0,20),diagnostic_draft:null}));setModal("orders");setNotice("Demo booking saved on this browser. No provider has been dispatched.");
 }
 function addDiagnostic(id:string,diagnostic:DiagnosticDraft){setState(s=>({...s,diagnostic_draft:diagnosticDraftSchema.parse(diagnostic)}));add(id,true);}
 const value:Store={state,services,ready,notice,modal,detail,setRegion:region=>setState(s=>({...s,region})),add,addDiagnostic,
   quantity:(id,n)=>setState(s=>({...s,cart:n<=0?s.cart.filter(l=>l.id!==id):s.cart.map(l=>l.id===id?{...l,quantity:Math.min(10,n)}:l)})),
   setModal:open,setDetail,setLegalModal,login,logout:()=>{setState(s=>({...s,session:null}));void clearAuthSession().then(()=>setNotice("Signed out of Tirkha." )).catch(()=>setNotice("The Tirkha account could not be signed out. Please retry."));},requireCheckoutAuth,
   place,cancel:id=>setState(s=>({...s,orders:s.orders.map(o=>o.id===id?{...o,status:"cancelled"}:o)})),inform:setNotice};
 return <Context.Provider value={value}>{children}<SiteFooter/><MarketplaceOverlays/><LegalModals topic={legalModal} onClose={()=>setLegalModal(null)}/><ServiceAssistant/>{notice&&<div className="mk-toast" role="status">{notice}</div>}</Context.Provider>;
}


