import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { OrgProvider } from './context/OrgContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LandingPage } from './pages/landing/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage';
import { MyWorkPage } from './pages/dashboard/MyWorkPage';
import { ProjectBoardPage } from './pages/board/ProjectBoardPage';
import { WorkspacesPage } from './pages/workspaces/WorkspacesPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { OrgSettingsPage } from './pages/organizations/OrgSettingsPage';
import { ProjectOverviewPage } from './pages/projects/ProjectOverviewPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { CompaniesHubPage } from './pages/companies/CompaniesHubPage';
import { NotFoundPage } from './pages/error/NotFoundPage';
import { UnauthorizedPage } from './pages/error/UnauthorizedPage';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <OrgProvider>
            <Routes>
              {/* Public Landing & Marketing */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/landing" element={<LandingPage />} />

              {/* Public Authentication Pages */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />

              {/* Security & Access Boundary Pages (Module 10) */}
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="/403" element={<UnauthorizedPage />} />
              <Route path="/404" element={<NotFoundPage />} />

              {/* Authenticated Workspace Application Protected by Supabase Auth */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<CompaniesHubPage />} />
                  <Route path="/companies" element={<CompaniesHubPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/my-work" element={<MyWorkPage />} />
                  <Route path="/board" element={<ProjectBoardPage />} />
                  <Route path="/workspaces" element={<WorkspacesPage />} />
                  <Route path="/projects/:id" element={<ProjectOverviewPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/org-settings" element={<OrgSettingsPage />} />
                </Route>
              </Route>

              {/* Strict 404 Not Found Wildcard Handler */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </OrgProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
