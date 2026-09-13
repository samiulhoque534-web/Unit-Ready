import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { db } from '../../db/database';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import { 
  Shield, Moon, Sun, Globe, UserCheck, 
  Clock, Laptop, LogOut, Lock, Search, Bell 
} from 'lucide-react';

interface HeaderProps {
  activePath: string;
  onNavigate: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activePath, onNavigate }) => {
  const { currentUser, activeDevice, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { isDarkMode, toggleDarkMode } = useTheme();

  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);

  // 24-hour Asia/Dhaka live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Dhaka',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      };
      setCurrentTimeStr(new Intl.DateTimeFormat('en-GB', options).format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check unread notifications count
  useEffect(() => {
    const checkNotifs = async () => {
      const notifs = await db.notifications.toArray();
      setUnreadNotifCount(notifs.filter(n => !n.isRead).length);
    };
    checkNotifs();
    const interval = setInterval(checkNotifs, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <header className="bg-[#1E3316] text-white border-b border-[#3B5E2B] shadow-md z-30 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Left: Unit Branding */}
          <div 
            onClick={() => onNavigate('/dashboard')}
            className="flex items-center space-x-3 cursor-pointer group select-none flex-shrink-0"
          >
            <div className="w-10 h-10 rounded-lg bg-[#2D4A22] border border-[#F59E0B] flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
              <Shield className="w-6 h-6 text-[#F59E0B]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-extrabold text-base sm:text-lg tracking-wider text-white">
                  95 Fd Amb
                </span>
                <span className="bg-[#F59E0B] text-black font-extrabold font-mono text-[10px] px-1.5 py-0.5 rounded shadow-xs">
                  UNIT-READY
                </span>
              </div>
              <p className="text-[10px] text-emerald-200 tracking-tight hidden sm:block">
                {t('unitSubtitle')}
              </p>
            </div>
          </div>

          {/* Center: Global Search & Live Asia/Dhaka Clock */}
          <div className="flex items-center space-x-3 flex-1 max-w-md mx-2 sm:mx-4">
            {/* Global Search Button */}
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-slate-300 text-xs border border-[#3B5E2B] transition cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <Search className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span className="hidden sm:inline">Search unit records...</span>
                <span className="sm:hidden">Search</span>
              </div>
              <kbd className="hidden sm:inline-block font-mono text-[9px] bg-black/40 px-1.5 py-0.5 rounded text-emerald-300">
                Ctrl+K
              </kbd>
            </button>
          </div>

          {/* Right: Live Clock, Device, Appointment, Language & Theme Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
            {/* Live Clock */}
            <div className="hidden lg:flex items-center space-x-1.5 bg-[#2D4A22] px-2.5 py-1 rounded-md text-xs font-mono text-emerald-300 border border-[#3B5E2B]">
              <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>{currentTimeStr || '00:00:00'}</span>
            </div>

            {/* Notifications Button */}
            <button
              onClick={() => onNavigate('/notifications')}
              className="relative p-1.5 sm:px-2 sm:py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-slate-200 border border-[#3B5E2B] transition"
              title="In-App Notifications"
            >
              <Bell className="w-4 h-4 text-emerald-300" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white font-mono font-bold text-[9px] px-1.5 py-0.2 rounded-full border border-[#1E3316] animate-pulse">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {/* Active User Identity Profile Display */}
            <div className="flex items-center space-x-2 bg-[#2D4A22] px-2.5 py-1 rounded-lg text-xs font-bold border border-[#F59E0B]/50 shadow-xs">
              <UserCheck className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0" />
              <div className="text-left hidden sm:block">
                <p className="text-[11px] leading-tight text-white font-extrabold truncate max-w-[180px]">
                  {currentUser.rank ? `${currentUser.rank} ` : ''}{currentUser.fullName || currentUser.appointmentTitle}
                </p>
                {currentUser.serviceNumber && currentUser.serviceNumber !== 'GEN-VIEW' && (
                  <p className="text-[9px] text-emerald-300 font-mono font-bold leading-none mt-0.5">
                    No: {currentUser.serviceNumber}
                  </p>
                )}
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={logout}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 text-xs font-bold transition flex items-center gap-1 shadow-xs"
              title="Sign Out / Switch Identity"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            {/* Bilingual Switcher */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
              className="px-2 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-xs font-bold font-mono border border-[#3B5E2B] transition flex items-center space-x-1"
              title="Toggle Language (English / বাংলা)"
            >
              <Globe className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span className="hidden sm:inline">{language === 'en' ? 'বাংলা' : 'EN'}</span>
            </button>

            {/* Theme Switcher */}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-slate-200 border border-[#3B5E2B] transition"
              title={isDarkMode ? 'Day Mode' : 'Tactical Night Mode'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-200" />}
            </button>
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onNavigate={onNavigate}
      />
    </>
  );
};

export default Header;
