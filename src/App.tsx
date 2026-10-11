import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </Toaster>
  );
}
