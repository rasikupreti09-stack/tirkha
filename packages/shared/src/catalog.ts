import { z } from "zod";
import { diagnosticDraftSchema } from "./home-diagnostics.ts";
import { applyCatalogPriceOverride } from "./pricing.ts";
export const catalogServiceSchema = z.object({
 id:z.string().min(1), title:z.string(), category_slug:z.string(), category_name:z.string(), icon:z.string(), vertical:z.string(),
 base_paisa:z.number().int().nonnegative().max(100000000), visit_paisa:z.number().int().nonnegative().max(100000000),
 price_max_paisa:z.number().int().nonnegative().max(100000000).optional(), pricing_mode:z.enum(["fixed","starting_at","range"]).optional(), pricing_unit:z.string().optional(), pricing_note:z.string().optional(),
 duration_minutes:z.number().int().positive(), description:z.string(), included:z.array(z.string()), excluded:z.array(z.string()),
 keywords:z.array(z.string()), image:z.string().startsWith("/images/"), regions:z.array(z.string()),active:z.boolean(),sort_order:z.number().int(),
});
export type CatalogService=z.infer<typeof catalogServiceSchema>;
export const REGIONS=["Kathmandu Valley","Kathmandu","Lalitpur","Bhaktapur","Pokhara"] as const;
export function inRegion(service:CatalogService, region:string) {
 return region==="Kathmandu Valley" ? service.regions.some(r=>["Kathmandu","Lalitpur","Bhaktapur"].includes(r)) : service.regions.includes(region);
}
export function serviceTotal(service:CatalogService){const priced=applyCatalogPriceOverride(service);return priced.base_paisa+priced.visit_paisa;}
export function catalogMoney(paisa:number){return "Rs. "+new Intl.NumberFormat("en-NP",{maximumFractionDigits:2}).format(paisa/100);}
export function catalogPriceLabel(service:CatalogService){
 const priced=applyCatalogPriceOverride(service),lower=priced.base_paisa+priced.visit_paisa;
 if(priced.pricing_mode==="range"&&priced.price_max_paisa!==undefined)return `${catalogMoney(lower)}–${catalogMoney(priced.price_max_paisa+priced.visit_paisa)}${priced.pricing_unit?` / ${priced.pricing_unit}`:""}`;
 return `${priced.pricing_mode==="starting_at"?"From ":""}${catalogMoney(lower)}${priced.pricing_unit?` / ${priced.pricing_unit}`:""}`;
}
export const COD_COMMISSION_BASIS_POINTS=1250;
export function codCommissionPaisa(grossPaisa:number,basisPoints=COD_COMMISSION_BASIS_POINTS){
 if(!Number.isSafeInteger(grossPaisa)||grossPaisa<0)throw new RangeError("COD gross amount must be non-negative integer paisa.");
 if(!Number.isInteger(basisPoints)||basisPoints<1000||basisPoints>1500)throw new RangeError("COD commission must be between 10% and 15%.");
 return Math.floor((grossPaisa*basisPoints+5000)/10000);
}
const romanNepaliIntents:[RegExp,string][]=[
 [/\b(dhara|tap)\b.*\b(leak|leek|leaking|chuh|chuhi|bhairako|bhairacha|bhayeko)\b|\b(leak|leek)\b.*\b(dhara|tap)\b/,"sink-leak"],
 [/\b(fohor|dirty|gandha)\b.*\b(tank|inar|reservoir|cleaning)\b|\b(tank|inar)\b.*\b(clean|cleaning|safa)\b/,"tank-clean"],
 [/\b(jyotish|jyotisi|jotish|kundali)\b/,"astrology-session"],
 [/\b(doctor|daktar)\b.*\b(home|ghar|visit|consultation)\b|\b(home|ghar)\b.*\b(doctor|daktar)\b/,"doctor-home"],
 [/\b(batti|bijuli|light)\b.*\b(na|chaina|chhaina|gako|aako|aaena|balyena)\b|\b(na-aako|naako)\b/,"electrical-wiring"],
 [/\b(fohor|dirty)\b.*\b(ghar|home|clean|cleaning)\b/,"deep-clean"],
];
function romanizedNepaliIntent(query:string,services:CatalogService[]){
 const normalized=query.toLowerCase().replace(/[^a-z0-9\s-]/g," ").replace(/\s+/g," ").trim();
 for(const [pattern,id] of romanNepaliIntents){if(pattern.test(normalized)){const service=services.find(item=>item.id===id);if(service)return [service];}}
 return [];
}
export function matchServices(query:string, services:CatalogService[]):CatalogService[]{
 const nepali=romanizedNepaliIntent(query,services);if(nepali.length)return nepali;
 const words=query.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w=>w.length>2);
 const ranked=services.map(service=>({service,score:words.reduce((n,w)=>n+service.keywords.filter(k=>w===k || (k.length>3 && w.startsWith(k))).length,0)}))
 .filter(r=>r.score>0).sort((a,b)=>b.score-a.score || a.service.sort_order-b.service.sort_order);
 if(ranked.length>1&&ranked[0].score>=ranked[1].score+2)return [ranked[0].service];
 return ranked.slice(0,3).map(r=>r.service);
}
export function isRomanizedNepali(query:string){
 const q=query.toLowerCase();
 return /\b(dhara|bhairako|bhairacha|chha|cha|fohor|safa|ghar|jyotish|jyotisi|jotish|batti|bijuli|na-aako|aaena|aako|garna|garnu|chahiyo|milcha|huncha|kripaya|tapai|mero|ma|ko|lai)\b/.test(q);
}
export function assistantReply(query:string,services:CatalogService[]){
 const q=query.toLowerCase(),roman=isRomanizedNepali(query);
 if(/cancel|refund|radd|firta/.test(q))return {text:roman?"Ma cancellation process bujhauna sakchhu. Demo booking lai ‘My demo bookings’ bata cancel garna milcha. Live booking ko cancellation option ra kunai lagu hune charge confirm garnu agadi screen ma dekhaincha; payment bhayeko cha bhane refund gateway processing pachi matra settle huncha. Tapai ko booking demo ho ki live?":"I can help clarify the next step. Demo bookings can be cancelled from “My demo bookings.” For a live booking, review the cancellation option and any applicable charge shown before confirming. If payment has already been made, the refund is settled after the payment gateway processes it. Is this a demo booking or a live one?",services:[]};
 if(/\b(area|location|where|pokhara|valley|operate|coverage|kata|kun thau|neighborhood|neighbourhood|landmark)\b/.test(q))return {text:roman?"Tirkha ko catalog Kathmandu, Lalitpur, Bhaktapur ra Pokhara ko lagi dekhaiyeko chha. Tapai le map ma area ra najikko landmark chhanna saknuhuncha. Yo coverage le turuntai Hero available cha bhanne guarantee gardaina; booking availability confirmation aayepachi matra pakka huncha. Kun tole wa landmark bata khojnu bhayeko?":"The catalog currently lists Kathmandu, Lalitpur, Bhaktapur and Pokhara. You can choose a neighborhood or nearby landmark on the map. That does not guarantee immediate provider availability; the appointment is confirmed only after availability is checked. Which area or landmark should I use?",services:[]};
 if(/safe|verified|verification|trust|surakshit|bharosa|otp|background/.test(q))return {text:roman?"Live job request verified professionals lai matra dekhaincha. Tapai ko account OTP kasailai share nagarnuhola. Ghar aayepachi app ma dekhaeko provider details sanga pahichan milayera matra kaam suru garnuhola. Doctor/nurse service ko lagi yogya licensed practitioner confirm garnu hola. Yo demo le kasaiko dispatch gardaina.":"For live requests, Tirkha limits access to verified professionals. Keep your OTP private, and check that the person who arrives matches the provider details shown in your booking before work begins. For medical care, confirm the practitioner’s relevant licence and qualifications. A demo booking does not dispatch anyone.",services:[]};
 if(/price|cost|fee|transparent|payment|mulya|kati|pais[a]?/.test(q))return {text:roman?"Service card ma listed labour rate, samaya, included ra excluded kaam chhuttai herna milcha. Parts, material, jatil scope wa range bhanda bahira ko kaam ko price Hero le agadi quote garnu parcha; tapai ko sahmati bina extra kaam hudaina. Yo demo checkout le paisa lidaina. Kun service ko mulya herna chahanu huncha?":"Each service card shows its listed labour rate, estimated time, inclusions and exclusions. Parts, materials, complex scope, or work outside a stated range require a written quote before proceeding; no extra work should be done without your approval. Demo checkout does not collect money. Which service would you like me to price?",services:[]};
 if(/\b(emergency|chest pain|cannot breathe|can't breathe|unconscious|gas leak|smell gas|electric shock|sparking|fire|saas|chhati dukh|gas gandha|current lagyo)\b/.test(q))return {text:roman?"Yo urgent safety risk huna sakcha. Kripaya pahila sabai jana lai jokhim bata tada, surakshit khulla thau ma lanu; gas ko gandha cha bhane flame ra electrical switch nachalaunu. Turuntai local emergency service wa sambandhit utility samparka garnuhola. Tirkha emergency service wa emergency response hoina ra diagnosis gardaina.":"This may be an immediate safety risk. Please move people away from danger first. If you smell gas, avoid flames and electrical switches, leave the area, and contact local emergency services or the relevant utility. Tirkha is not an emergency service or response provider, and I cannot diagnose the cause.",services:[]};
 const matches=matchServices(query,services);
 if(matches.length)return {text:roman?"Tapai le share garnu bhayeko bibaran anusar yo service sabai bhanda najik ko match ho. Yo initial match matra ho, technical wa medical diagnosis hoina. Card kholera exact scope, excluded kaam, samaya ra total hernuhola. Samasya urgent cha bhane pahila emergency sahayata linu hola.":"These services match your description based on the catalog. This is an initial service match, not a technical or medical diagnosis. Please review the exact scope, exclusions, estimated time and total on the card. If there is an immediate safety concern, seek urgent help first.",services:matches};
 return {text:roman?"Sahayog garna malai ali detail chahinchha. Ke bigreko wa ke kaam garnu parne ho, kati urgent cha, ra kun area/tole ma ho? Udaharan: “kitchen ko dhara bata pani chuhirako chha, Kupondole, aja beluka.” Ma service match ra listed price dekhauna sakchhu; booking chai availability confirm bhayepachi matra pakka huncha.":"I can help narrow this down with a little more detail: what needs attention, how urgent is it, and which neighborhood or landmark is the property near? For example, “the kitchen tap is leaking, Kupondole, this evening.” I can suggest a catalog service and its listed price; the appointment is confirmed only after provider availability is checked.",services:[]};
}
export const demoSessionSchema=z.object({phone:z.string().min(1).max(64),expires:z.number()});
export const cartLineSchema=z.object({id:z.string(),quantity:z.number().int().min(1).max(10)});
export const demoOrderSchema=z.object({
 id:z.string(),created:z.string(),scheduled:z.string(),region:z.enum(REGIONS),address:z.string().min(5).max(500),
 pin:z.object({latitude:z.number(),longitude:z.number()}).nullable(),
 items:z.array(z.object({id:z.string(),title:z.string(),quantity:z.number().int().min(1),unit_paisa:z.number().int().nonnegative()})),
 total_paisa:z.number().int().nonnegative(),status:z.enum(["requested","cancelled"]),demo:z.literal(true),
 payment_method:z.enum(["COD","ESEWA","KHALTI","FONEPAY"]).optional().default("COD"),
 payment_status:z.enum(["cash_due","simulated_pending"]).optional().default("cash_due"),
 payment_reference:z.string().min(1).optional(),
 diagnostic:diagnosticDraftSchema.optional(),
});
export type DemoOrder=z.infer<typeof demoOrderSchema>;
export const marketplaceStateSchema=z.object({
 version:z.literal(1),region:z.enum(REGIONS),cart:z.array(cartLineSchema).max(25),session:demoSessionSchema.nullable(),
 orders:z.array(demoOrderSchema).max(20),
 diagnostic_draft:diagnosticDraftSchema.nullable().optional(),
});
export type MarketplaceState=z.infer<typeof marketplaceStateSchema>;




