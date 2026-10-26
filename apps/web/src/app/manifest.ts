import type { MetadataRoute } from "next";
export default function manifest():MetadataRoute.Manifest{
 return {name:"Tirkha | तिर्खा — Good help, closer to home",short_name:"Tirkha | तिर्खा",description:"Home and everyday services across Kathmandu Valley and Pokhara.",start_url:"/",scope:"/",display:"standalone",orientation:"portrait-primary",background_color:"#F8FAFC",theme_color:"#1F2937",categories:["lifestyle","shopping"],icons:[{src:"/pwa-192.png",sizes:"192x192",type:"image/png",purpose:"maskable"},{src:"/pwa-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"}]};
}

