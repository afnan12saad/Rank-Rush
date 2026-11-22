import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ArenaAuthProvider } from './context/ArenaAuthContext';
import { HomePage } from './pages/HomePage';
import { JudgeLoginPage } from './pages/JudgeLoginPage';
import { JudgeDashboardPage } from './pages/JudgeDashboardPage';
import { JudgeEvaluatePage } from './pages/JudgeEvaluatePage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { ProjectorPage } from './pages/ProjectorPage';
import { FinalResultsPage } from './pages/FinalResultsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsPage } from './pages/TermsPage';

export default function App() {
  return (
    <ErrorBoundary>
      <ArenaAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
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
        </BrowserRouter>
      </ArenaAuthProvider>
    </ErrorBoundary>
  );
}
