import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  Settings, Globe, Moon, Sun, Key, 
  Database, ShieldCheck, CheckCircle2, ArrowRight, Shield 
} from 'lucide-react';

interface SettingsModuleProps {
  onNavigate?: (path: string) => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { isDarkMode, toggleDarkMode } = useTheme();

  const [currentPin, setCurrentPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [pinSuccess, setPinSuccess] = useState<boolean>(false);

  const isCO = currentUser.role === 'co' || currentUser.role === 'admin';

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      alert('New Access Code / PIN does not match confirmation.');
      return;
    }
    setPinSuccess(true);
    setTimeout(() => setPinSuccess(false), 3000);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
            {t('nav_settings')} & System Preferences
          </h2>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure interface language, appearance theme, personal credentials, and access management tools.
        </p>
      </div>

      {/* CO Authority Banner / Action Card */}
      {isCO && onNavigate && (
        <div className="bg-gradient-to-r from-[#1C2E15] to-[#2D4A22] text-white p-5 rounded-2xl border-2 border-[#3B5E2B] shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-black/30 border border-[#4C7536] flex items-center justify-center text-[#F59E0B]">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm uppercase text-white">
                  Individual Access-Code Management
                </h3>
                <span className="text-[10px] bg-amber-500 text-black font-bold px-2 py-0.5 rounded-full uppercase">
                  CO Exclusive
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 mt-0.5">
                Issue unique 6-digit access codes to unit personnel, reset credentials, print authorization passes, or deactivate accounts.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/access-codes')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow transition cursor-pointer whitespace-nowrap"
          >
            <span>Manage Access Codes</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel 1: Preferences */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-600" />
            <span>Language & Display Interface</span>
          </h3>

          {/* Language Switch */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-bold text-xs text-slate-800 dark:text-slate-200">System Language</p>
              <p className="text-[11px] text-slate-500">Bilingual English & বাংলা Unicode (Noto Sans Bengali)</p>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                  language === 'en' ? 'bg-[#2D4A22] text-white shadow' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('bn')}
                className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                  language === 'bn' ? 'bg-[#2D4A22] text-white shadow' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                বাংলা
              </button>
            </div>
          </div>

          {/* Dark Mode Switch */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div>
              <p className="font-bold text-xs text-slate-800 dark:text-slate-200">Color Theme</p>
              <p className="text-[11px] text-slate-500">Military Olive Light or Command Dark Theme</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className="px-3.5 py-1.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
              <span>{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
            </button>
          </div>
        </div>

        {/* Panel 2: Personal Credentials Change */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-2">
            <Key className="w-4 h-4 text-[#F59E0B]" />
            <span>Personal Access Code & Security</span>
          </h3>

          <form onSubmit={handleUpdatePin} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Current 6-Digit Access Code</label>
              <input
                type="password"
                maxLength={6}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="Enter current 6-digit code"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">New 6-Digit Code</label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="6 digits"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Confirm New Code</label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="Repeat 6 digits"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  required
                />
              </div>
            </div>

            {pinSuccess && (
              <div className="p-2 rounded bg-emerald-100 text-emerald-900 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Personal access code updated successfully.</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white font-bold transition shadow cursor-pointer"
            >
              Update My Access Code
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
