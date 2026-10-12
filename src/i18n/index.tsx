import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Language = 'en' | 'es';
export const languages: readonly Language[] = ['en', 'es'];
const messages = {
 en: {
  start:'Get started',free:'for free',features:'Features',leads:'Instagram leads',rentals:'Vacation rentals',audience:'Who it is for',demo:'Demo',
  signIn:'Sign in',signOut:'Sign out',yourApps:'Your workspaces',intro:'Global Real Estate CRM & ERP',
  description:'Manage properties, leads, clients, agents and operations in one intelligent real estate platform.',
  language:'Language',notFound:'Page not found',notFoundDetail:'This address does not exist. Return home or explore the StateHubs demo.',
  home:'Back home',viewDemo:'Explore demo',agencyQuestion:'What does your real estate business do?',
  startMinute:'Get started in one minute',browserOnly:'Demo data is stored in this browser until you sign in and save it to your account.',
  previewFirst:'Want to look around first?',openDemo:'Open the demo',confirmDelete:'Delete this workspace and all its data? This cannot be undone.',
  email:'Email',continueGoogle:'Continue with Google',continueEmail:'Send sign-in link',loginTitle:'Sign in to StateHubs',
  linkSent:'We sent a sign-in link to',testMode:'This installation runs in demo mode; your workspaces are saved in this browser.',
  invalidEmail:'Enter a valid email address.',back:'Back', loading:'Loading…',
 },
 es: {
  start:'Empezar',free:'gratis',features:'Funciones',leads:'Leads de Instagram',rentals:'Alquiler vacacional',audience:'Para quién',demo:'Demo',
  signIn:'Entrar',signOut:'Salir',yourApps:'Tus espacios de trabajo',intro:'CRM y ERP inmobiliario global',
  description:'Gestiona inmuebles, leads, clientes, agentes y operaciones en una plataforma inmobiliaria inteligente.',
  language:'Idioma',notFound:'Página no encontrada',notFoundDetail:'Esta dirección no existe. Vuelve al inicio o explora la demo de StateHubs.',
  home:'Volver al inicio',viewDemo:'Ver la demo',agencyQuestion:'¿A qué se dedica tu agencia?',
  startMinute:'Empieza en un minuto',browserOnly:'Los datos de demostración se guardan en este navegador hasta que inicies sesión y los guardes en tu cuenta.',
  previewFirst:'¿Prefieres mirar antes?',openDemo:'Abre la demo',confirmDelete:'¿Eliminar este espacio y todos sus datos? No se puede deshacer.',
  email:'Correo electrónico',continueGoogle:'Continuar con Google',continueEmail:'Enviar enlace de acceso',loginTitle:'Accede a StateHubs',
  linkSent:'Te hemos enviado un enlace de acceso a',testMode:'Esta instalación funciona en modo prueba; tus espacios se guardan en este navegador.',
  invalidEmail:'Introduce un correo válido.',back:'Volver', loading:'Cargando…',
 }
} as const;
export type MessageKey = keyof typeof messages.en;
const STORAGE_KEY = 'statehubs.language.v1';
function storedLanguage(): Language {
 try { return localStorage.getItem(STORAGE_KEY) === 'es' ? 'es' : 'en'; } catch { return 'en'; }
}
type I18nContextValue = { language:Language; setLanguage:(language:Language)=>void; t:(key:MessageKey)=>string };
const I18nContext = createContext<I18nContextValue | null>(null);
export function I18nProvider({ children }: {children:ReactNode}) {
 const [language,setLanguage] = useState<Language>(storedLanguage);
 useEffect(() => {
  document.documentElement.lang = language;
  document.documentElement.dir = 'ltr';
  try { localStorage.setItem(STORAGE_KEY,language); } catch { /* private browsing */ }
 },[language]);
 const value = useMemo<I18nContextValue>(()=>({language,setLanguage,t:(key)=>messages[language][key] ?? messages.en[key]}),[language]);
 return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
const fallbackI18n: I18nContextValue = {language:'en',setLanguage:()=>{},t:(key)=>messages.en[key]};
export function useI18n() { return useContext(I18nContext) ?? fallbackI18n; }
export function formatCurrency(value:number,currency:string,locale='en') {
 return new Intl.NumberFormat(locale,{style:'currency',currency}).format(value);
}
export function formatLocalDate(value:Date|string,locale:string,timeZone:string) {
 return new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone}).format(new Date(value));
}
