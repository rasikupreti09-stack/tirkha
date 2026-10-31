import type { MetadataRoute } from "next";
export default function manifest():MetadataRoute.Manifest{
 return {name:"Tirkha | तिर्खा — Good help, closer to home",short_name:"Tirkha | तिर्खा",description:"Home and everyday services across Kathmandu Valley, Pokhara, Hetauda and Simara.",start_url:"/",scope:"/",display:"standalone",orientation:"portrait-primary",background_color:"#111827",theme_color:"#17382f",categories:["lifestyle","shopping"],icons:[{src:"/pwa-192.png?v=2",sizes:"192x192",type:"image/png",purpose:"maskable"},{src:"/pwa-512.png?v=2",sizes:"512x512",type:"image/png",purpose:"maskable"},{src:"/tirkha-mark.svg?v=2",sizes:"any",type:"image/svg+xml",purpose:"any"}]};
}

