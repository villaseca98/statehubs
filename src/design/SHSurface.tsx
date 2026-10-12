import type { HTMLAttributes, ReactNode } from 'react';
type Tone='default'|'soft'|'forest';
export interface SHSurfaceProps extends HTMLAttributes<HTMLElement> { children:ReactNode; tone?:Tone; interactive?:boolean; as?:'section'|'article'|'div' }
const tones:Record<Tone,string>={default:'sh-surface text-estate-ink',soft:'rounded-sh-md border border-estate-line bg-estate-cream text-estate-ink',forest:'rounded-sh-md border border-estate-moss bg-estate-forest text-white'};
export function SHSurface({children,tone='default',interactive=false,as:Tag='div',className='',...props}:SHSurfaceProps){return <Tag {...props} className={`${tones[tone]} ${interactive?'sh-elevate':''} ${className}`}>{children}</Tag>;}
