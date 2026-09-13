import React, { useState, useEffect } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { initializeDatabase } from './db/database';
import { initFirebaseSync } from './services/firebaseSyncService';

import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { LoginScreen } from './components/auth/LoginScreen';

import { MainDashboard } from './components/dashboard/MainDashboard';
import { ParadeStateModule } from './components/paradeState/ParadeStateModule';
import { DutyRosterModule } from './components/dutyRoster/DutyRosterModule';
import { NoticeBoardModule } from './components/noticeBoard/NoticeBoardModule';
import { MiscellaneousNoticeModule } from './components/miscellaneous/MiscellaneousNoticeModule';
import { TrainingHubModule } from './components/trainingHub/TrainingHubModule';
import { ManpowerModule } from './components/manpower/ManpowerModule';
import { VehicleModule } from './components/vehicle/VehicleModule';
import { MedicalStoreModule } from './components/medicalStore/MedicalStoreModule';
import { ApprovalCentreModule } from './components/approvalCentre/ApprovalCentreModule';
import { CorrectionCentreModule } from './components/correctionCentre/CorrectionCentreModule';
import { ReportsModule } from './components/reports/ReportsModule';
import { NotificationsModule } from './components/notifications/NotificationsModule';
import { AuditLogModule } from './components/auditLog/AuditLogModule';
import { BackupRestoreModule } from './components/backupRestore/BackupRestoreModule';
import { MasterConfigModule } from './components/masterConfig/MasterConfigModule';
import { AdminModule } from './components/admin/AdminModule';
import { SettingsModule } from './components/settings/SettingsModule';
import { AboutModule } from './components/about/AboutModule';
import { SmsNotificationToast } from './components/common/SmsNotificationToast';
import { PwaInstallBanner } from './components/common/PwaInstallBanner';

import { Menu } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentUser, isLoggedIn, isDeviceAuthorized } = useAuth();
  const [activePath, setActivePath] = useState<string>('/dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isDbReady, setIsDbReady] = useState<boolean>(false);

  useEffect(() => {
    initializeDatabase().then(() => {
      setIsDbReady(true);
      initFirebaseSync();
    });
  }, []);

  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-[#1E3316] text-white flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-[#F59E0B] border-t-transparent rounded-full animate-spin mb-4" />
        <h1 className="text-xl font-bold tracking-widest uppercase">95 FD AMB — UNIT-READY</h1>
        <p className="text-xs text-emerald-200 mt-1">Initializing secure local offline database...</p>
      </div>
    );
  }

  // If user is not authenticated or device needs authorization, show Login & Access Gate
  if (!isLoggedIn || !isDeviceAuthorized) {
    return (
      <>
        <PwaInstallBanner />
        <LoginScreen />
        <SmsNotificationToast />
      </>
    );
  }

  const isViewerOrRestricted = 
    currentUser.role === 'general_viewer' ||
    currentUser.role === 'general_duty' || 
    currentUser.role === 'general_personnel' || 
    currentUser.role === 'smt_member' || 
    currentUser.role === 'authorised_personnel';

  const renderActiveModule = () => {
    // Route-level security interlock: block unauthorized direct navigation
    if (isViewerOrRestricted && ['/approval-centre', '/corrections', '/reports', '/admin', '/backup-restore', '/master-config', '/settings', '/audit-log'].includes(activePath)) {
      return (
        <div className="bg-red-50 dark:bg-red-950/40 border-2 border-red-500 rounded-xl p-8 text-center space-y-4 max-w-xl mx-auto my-12 shadow-lg">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/60 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400 font-black text-xl">
            !
          </div>
          <div>
            <h2 className="text-base font-extrabold text-red-900 dark:text-red-200 uppercase tracking-wide">
              Restricted Module — Access Denied
            </h2>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1 font-sans">
              Logged in as <strong>{currentUser.appointmentTitle}</strong>. This module is restricted to designated Section OICs and Command Authority.
            </p>
          </div>
          <button
            onClick={() => setActivePath('/dashboard')}
            className="px-4 py-2 bg-[#2D4A22] text-white rounded-lg text-xs font-bold shadow hover:bg-[#3B5E2B] transition cursor-pointer"
          >
            Return to Authorized Dashboard
          </button>
        </div>
      );
    }

    switch (activePath) {
      case '/dashboard':
        return <MainDashboard onNavigate={setActivePath} />;
      case '/parade-state':
        return <ParadeStateModule />;
      case '/manpower':
        return <ManpowerModule onNavigate={setActivePath} defaultTab="NOMINAL_ROLL" />;
      case '/duty-roster':
        return <DutyRosterModule />;
      case '/notice-board':
        return <NoticeBoardModule />;
      case '/others-notices':
        return <MiscellaneousNoticeModule />;
      case '/training-hub':
        return <TrainingHubModule />;
      case '/vehicle':
        return <VehicleModule />;
      case '/medical-store':
        return <MedicalStoreModule />;
      case '/reports':
        return <ReportsModule />;
      case '/notifications':
        return <NotificationsModule />;
      case '/audit-log':
        return <AuditLogModule />;
      case '/backup-restore':
        return <BackupRestoreModule />;
      case '/master-config':
        return <MasterConfigModule />;
      case '/access-codes':
        return <AdminModule defaultTab="ACCESS_CODES" />;
      case '/admin':
        return <AdminModule />;
      case '/settings':
        return <SettingsModule onNavigate={setActivePath} />;
      case '/about':
        return <AboutModule />;
      default:
        return <MainDashboard onNavigate={setActivePath} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9F5] text-slate-800 dark:bg-slate-950 dark:text-slate-100 font-sans transition-colors duration-150 relative">
      {/* Real-time SMS Notification Toast */}
      <SmsNotificationToast />

      {/* PWA Install Banner */}
      <PwaInstallBanner />

      {/* Top Header with Locked Appointment & Sign Out */}
      <Header 
        activePath={activePath} 
        onNavigate={setActivePath} 
      />

      {/* Main Body with Restricted Sidebar + Active Module */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar strictly filtered to appointment view permissions */}
        <Sidebar 
          activePath={activePath} 
          onNavigate={setActivePath} 
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 flex flex-col justify-between">
          {/* Mobile Drawer Trigger */}
          <div className="lg:hidden mb-3 flex items-center justify-between bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-md bg-[#2D4A22] text-white flex items-center gap-1.5 text-xs font-semibold"
            >
              <Menu className="w-4 h-4" />
              <span>Navigation Menu</span>
            </button>
            <span className="font-bold text-xs uppercase text-[#2D4A22] dark:text-emerald-400">
              95 Fd Amb
            </span>
          </div>

          <div className="flex-1 max-w-7xl mx-auto w-full">
            {renderActiveModule()}
          </div>
        </main>
      </div>

      {/* Sticky Bottom Footer */}
      <Footer />
    </div>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
