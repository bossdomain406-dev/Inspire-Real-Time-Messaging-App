import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/Toast';
import { InstallPrompt } from './components/InstallPrompt';

import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ChooseUsernamePage } from './pages/ChooseUsernamePage';
import { ChatListPage } from './pages/ChatListPage';
import { ChatPage } from './pages/ChatPage';
import { ProfilePage } from './pages/ProfilePage';

import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminChatViewerPage } from './pages/admin/AdminChatViewerPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminBroadcastPage } from './pages/admin/AdminBroadcastPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

// Central Maintenance Screen
function MaintenanceScreen({ onBypass }: { onBypass?: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-[#0B0F1A] text-center">
      <div className="max-w-md p-8 rounded-3xl bg-white dark:bg-[#161B2B] border border-[#E5E7EB] dark:border-[#2A3348] shadow-2xl space-y-4">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-[#FFD700] text-[#1A1A2E] flex items-center justify-center text-3xl font-black shadow-md">
          🛠️
        </div>
        <h2 className="text-2xl font-black text-black dark:text-white">
          Under Scheduled Maintenance
        </h2>
        <p className="text-xs text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
          Inspire is currently undergoing scheduled platform upgrades to improve real-time delivery and system security. Please check back shortly.
        </p>
        {onBypass && (
          <button
            onClick={onBypass}
            className="text-xs text-[#0E2A6E] dark:text-[#3D6FE0] font-bold underline pt-2"
          >
            Admin Sign In / Bypass
          </button>
        )}
      </div>
    </div>
  );
}

// Protected Route Gating
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B0F1A]">
        <div className="w-10 h-10 border-4 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user hasn't set their unique @username yet, gate them to choose-username
  if (!user?.username && location.pathname !== '/choose-username') {
    return <Navigate to="/choose-username" replace />;
  }

  return <>{children}</>;
}

// Admin Route Gating
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B0F1A]">
        <div className="w-10 h-10 border-4 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/chats" replace />;
  }

  return <>{children}</>;
}

// Guest Only Route Gating (login / signup)
function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0B0F1A]">
        <div className="w-10 h-10 border-4 border-[#0E2A6E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    if (!user?.username) {
      return <Navigate to="/choose-username" replace />;
    }
    return <Navigate to="/chats" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAdmin } = useAuth();
  const [maintenanceActive, setMaintenanceActive] = useState(false);

  useEffect(() => {
    // Check maintenance setting
    const saved = localStorage.getItem('inspire_app_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.maintenance_mode) {
          setMaintenanceActive(true);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  if (maintenanceActive && !isAdmin) {
    return <MaintenanceScreen onBypass={() => setMaintenanceActive(false)} />;
  }

  return (
    <Routes>
      {/* Guest Authentication Routes */}
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestRoute>
            <SignupPage />
          </GuestRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <GuestRoute>
            <ForgotPasswordPage />
          </GuestRoute>
        }
      />

      {/* Onboarding Username Chooser */}
      <Route
        path="/choose-username"
        element={
          <ProtectedRoute>
            <ChooseUsernamePage />
          </ProtectedRoute>
        }
      />

      {/* Main Messaging Routes */}
      <Route
        path="/chats"
        element={
          <ProtectedRoute>
            <ChatListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:userId"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      {/* Admin Panel Routes */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboardPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AdminUsersPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <AdminRoute>
            <AdminReportsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/chats/:userId"
        element={
          <AdminRoute>
            <AdminChatViewerPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <AdminRoute>
            <AdminAnalyticsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/broadcast"
        element={
          <AdminRoute>
            <AdminBroadcastPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <AdminRoute>
            <AdminSettingsPage />
          </AdminRoute>
        }
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/chats" replace />} />
    </Routes>
  );
}

export default function App() {
  // Sync Dark/Light Mode on startup
  useEffect(() => {
    const savedTheme = localStorage.getItem('inspire_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Register service worker if supported
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration skipped:', err);
      });
    }
  }, []);

  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
          <InstallPrompt />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
