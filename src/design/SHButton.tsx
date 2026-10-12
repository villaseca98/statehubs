import type { ButtonHTMLAttributes, ReactNode } from 'react';
type Variant = 'primary'|'secondary'|'ghost'|'danger';
type Size = 'sm'|'md'|'lg';
export interface SHButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?:Variant; size?:Size; loading?:boolean; children:ReactNode }
const variants:Record<Variant,string> = { primary:'bg-estate-forest text-white hover:bg-estate-deep', secondary:'border border-estate-line bg-white text-estate-ink hover:bg-estate-cream', ghost:'text-estate-forest hover:bg-estate-forest/10', danger:'bg-red-700 text-white hover:bg-red-800' };
const sizes:Record<Size,string> = { sm:'min-h-9 px-3 text-sm', md:'min-h-11 px-4 text-sm', lg:'min-h-12 px-6 text-base' };
export function SHButton({variant='primary',size='md',loading=false,disabled,className='',children,type='button',...props}:SHButtonProps){
 return <button {...props} type={type} disabled={disabled||loading} aria-busy={loading||undefined} className={`sh-focus sh-elevate sh-press inline-flex items-center justify-center gap-2 rounded-full font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}>
 {loading && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"/>}{children}</button>;
}
