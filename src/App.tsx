import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ArenaAuthProvider } from './context/ArenaAuthContext';
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const JudgeLoginPage = lazy(() => import('./pages/JudgeLoginPage').then((m) => ({ default: m.JudgeLoginPage })));
const JudgeDashboardPage = lazy(() => import('./pages/JudgeDashboardPage').then((m) => ({ default: m.JudgeDashboardPage })));
const JudgeEvaluatePage = lazy(() => import('./pages/JudgeEvaluatePage').then((m) => ({ default: m.JudgeEvaluatePage })));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const ProjectorPage = lazy(() => import('./pages/ProjectorPage').then((m) => ({ default: m.ProjectorPage })));
const FinalResultsPage = lazy(() => import('./pages/FinalResultsPage').then((m) => ({ default: m.FinalResultsPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsPage })));

export default function App() {
  return (
    <ErrorBoundary>
      <ArenaAuthProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen bg-[#071422]" />}>
          <Routes>
            <Route path="/" element={<Navigate to="/judge/login" replace />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/judge/login" element={<JudgeLoginPage />} />
            <Route path="/judge/dashboard" element={<JudgeDashboardPage />} />
            <Route path="/judge/evaluate/:teamId" element={<JudgeEvaluatePage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/projector" element={<ProjectorPage />} />
            <Route path="/results" element={<FinalResultsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </ArenaAuthProvider>
    </ErrorBoundary>
  );
}
