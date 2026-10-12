import { useI18n } from '@/i18n';
export function LanguageSelector() {
 const {language,setLanguage,t}=useI18n();
 return <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-estate-ink">
  <span className="sr-only">{t('language')}</span>
  <select aria-label={t('language')} value={language} onChange={e=>setLanguage(e.target.value as 'en'|'es')}
   className="rounded-full border border-estate-line bg-white px-2 py-1.5 text-estate-ink outline-offset-2">
   <option value="en">EN</option><option value="es">ES</option>
  </select>
 </label>;
}
