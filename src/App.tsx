import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Toaster } from '@/lib/toast';
import Landing from '@/pages/Landing';
import { I18nProvider, useI18n } from '@/i18n';
import { LanguageSelector } from '@/components/brand/LanguageSelector';

const AppPage = lazy(() => import('@/pages/AppPage'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));
const Demo = lazy(() => import('@/pages/Demo'));
const Login = lazy(() => import('@/pages/Login'));
const Account = lazy(() => import('@/pages/Account'));
const Reels = lazy(() => import('@/pages/reels/Reels'));

function AppRoutes() {
 const {t}=useI18n();
  return (
    <Toaster>
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app/:appId" element={<AppPage />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/entrar" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Login />} />
            <Route path="/workspace" element={<Account />} />
            <Route path="/reels" element={<Reels />} />
            <Route path="/reels/:reelKey" element={<Reels />} />
            <Route path="*" element={<main className="flex min-h-screen flex-col items-center justify-center bg-estate-cream px-6 text-center text-estate-ink"><p className="text-sm font-semibold tracking-[0.2em] text-estate-forest">ERROR 404</p><h1 className="mt-4 font-serif text-5xl">{t('notFound')}</h1><p className="mt-4 max-w-md text-estate-muted">{t('notFoundDetail')}</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Link to="/" className="rounded-full bg-estate-forest px-6 py-3 font-semibold text-white hover:bg-estate-deep">{t('home')}</Link><Link to="/demo" className="rounded-full border border-estate-line bg-white px-6 py-3 font-semibold hover:bg-estate-sand">{t('viewDemo')}</Link></div><div className="mt-5"><LanguageSelector /></div></main>} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </Toaster>
  );
}

export default function App(){return <I18nProvider><AppRoutes /></I18nProvider>;}
