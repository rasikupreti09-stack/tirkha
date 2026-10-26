"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function MarketplaceDialog({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;const focused=document.activeElement as HTMLElement|null;dialog?.showModal();const old=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{dialog?.close();document.body.style.overflow=old;focused?.focus();};},[]);
 return <dialog ref={ref} className={wide?"mk-dialog mk-dialog-wide":"mk-dialog"} aria-label={title} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}>
   <div className="mk-dialog-inner"><div className="mk-dialog-heading"><h2>{title}</h2><button onClick={onClose} className="mk-icon-button" aria-label="Close dialog"><X size={21}/></button></div>{children}</div>
 </dialog>;
}

