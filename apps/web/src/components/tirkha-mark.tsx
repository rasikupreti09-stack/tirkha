import type { SVGProps } from "react";

/** Compact roof-and-door monogram used for Tirkha's web and app identity. */
export function TirkhaMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="48" height="48" rx="15" fill="#1F2937" />
      <path d="M9 22.5 24 10l15 12.5" stroke="#A7F3D0" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      <path d="M14 21v17h20V21" stroke="#F8FAFC" strokeLinejoin="round" strokeWidth="2.5" />
      <path d="M21 38V26h6v12" fill="#10B981" />
      <circle cx="30.5" cy="17.5" r="2" fill="#F6C76B" />
    </svg>
  );
}
