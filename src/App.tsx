import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Toaster } from '@/lib/toast';
import Landing from '@/pages/Landing';

const AppPage = lazy(() => import('@/pages/AppPage'));
const Demo = lazy(() => import('@/pages/Demo'));
const Login = lazy(() => import('@/pages/Login'));
const Reels = lazy(() => import('@/pages/reels/Reels'));

export default function App() {
  return (
    <Toaster>
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app/:appId" element={<AppPage />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/entrar" element={<Login />} />
            <Route path="/reels" element={<Reels />} />
            <Route path="/reels/:reelKey" element={<Reels />} />
            <Route path="*" element={<main className="flex min-h-screen flex-col items-center justify-center bg-estate-cream px-6 text-center text-estate-ink"><p className="text-sm font-semibold tracking-[0.2em] text-estate-forest">ERROR 404</p><h1 className="mt-4 font-serif text-5xl">Página no encontrada</h1><p className="mt-4 max-w-md text-estate-muted">Esta dirección no existe. Puedes volver al inicio o explorar la demostración de StateHubs.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Link to="/" className="rounded-full bg-estate-forest px-6 py-3 font-semibold text-white hover:bg-estate-deep">Volver al inicio</Link><Link to="/demo" className="rounded-full border border-estate-line bg-white px-6 py-3 font-semibold hover:bg-estate-sand">Ver la demo</Link></div></main>} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </Toaster>
  );
}
