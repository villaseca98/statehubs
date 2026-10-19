import { BRAND, LOOK } from '../../supabase/functions/_shared/blueprint/look';
export const tokens = {
 color: { forest:LOOK.colors.primary, deep:'#143f2e', moss:'#2f7d4f', sage:'#a9c5b0', ivory:LOOK.colors.bg, sand:'#f1f1f4', ink:BRAND.ink, muted:LOOK.colors.muted, lime:BRAND.light, white:'#ffffff' },
 font: { body:'Inter Variable', display:'Space Grotesk', editorial:'Iowan Old Style' },
 spacing: { xs:4, sm:8, md:12, lg:16, xl:24, xxl:32, xxxl:48 },
 radius: { sm:12, md:18, lg:28, pill:9999 },
 elevation: { sm:'sh-sm', md:'sh-md', lg:'sh-lg' },
 motion: { quick:150, standard:300, slow:500 },
 icon: { sm:16, md:20, lg:24 }
} as const;
