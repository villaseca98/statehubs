import type { HTMLAttributes, ReactNode } from 'react';
type Tone='neutral'|'success'|'warning'|'danger';
const tones:Record<Tone,string>={neutral:'bg-estate-sand text-estate-ink',success:'bg-green-100 text-green-800',warning:'bg-amber-100 text-amber-900',danger:'bg-red-100 text-red-800'};
export function SHStatus({children,tone='neutral',className='',...props}:HTMLAttributes<HTMLSpanElement>&{children:ReactNode;tone?:Tone}){return <span {...props} className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`}>{children}</span>;}
