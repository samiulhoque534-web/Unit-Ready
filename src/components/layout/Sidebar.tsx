import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { 
  LayoutDashboard, FileText, Bell, Users, 
  Truck, ShieldCheck, Edit3, BarChart3, 
  Settings, Lock, Database, Info, 
  CalendarCheck, Sliders, X, FolderOpen, Laptop, BookOpen, Key,
  UserCog
} from 'lucide-react';

interface SidebarProps {
  activePath: string;
  onNavigate: (path: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePath,
  onNavigate,
  isMobileOpen,
  onCloseMobile
}) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();

  const isViewer = 
    currentUser.role === 'general_viewer' ||
    currentUser.role === 'general_duty' || 
    currentUser.role === 'general_personnel' || 
    currentUser.role === 'smt_member' || 
    currentUser.role === 'authorised_personnel';

  // Core Operational Navigation Items (Filtered strictly according to role)
  const allCoreNavItems = [
    { path: '/dashboard', label: t('nav_dashboard') || 'Dashboard', icon: LayoutDashboard, allowViewer: true },
    { path: '/parade-state', label: 'Daily Parade State', icon: CalendarCheck, allowViewer: true },
    { path: '/manpower', label: t('nav_manpower') || 'Manpower', icon: Users, allowViewer: true },
    { path: '/vehicle', label: t('nav_vehicle') || 'MT / Vehicle State', icon: Truck, allowViewer: true },
    { path: '/medical-store', label: t('nav_medicalStore') || 'Medical Store', icon: ShieldCheck, allowViewer: true },
    { path: '/duty-roster', label: t('nav_dutyRoster') || 'Part-I Duty Roster', icon: FileText, allowViewer: true },
    { path: '/others-notices', label: 'Others / Miscellaneous', icon: FolderOpen, allowViewer: true },
    { path: '/training-hub', label: t('nav_trainingHub') || 'Training & Knowledge Hub', icon: BookOpen, allowViewer: true },
    { path: '/reports', label: t('nav_reports') || 'Reports', icon: BarChart3, allowViewer: false },
    { path: '/about', label: t('nav_about') || 'About & Governance', icon: Info, allowViewer: true }
  ];

  const coreNavItems = allCoreNavItems.filter(item => !isViewer || item.allowViewer);

  // Administrative / Officer Tools
  const adminNavItems = [
    { path: '/user-monitoring', label: 'User Monitoring & Audit', icon: UserCog, roles: ['co', 'admin'] },
    { path: '/access-codes', label: 'Access Code Management', icon: Key, roles: ['co', 'admin'] },
    { path: '/admin', label: 'Device Whitelisting', icon: Laptop, roles: ['qm', 'co', 'admin'] },
    { path: '/audit-log', label: t('nav_auditLog') || 'Audit Logs', icon: Lock, roles: ['co', '2ic', 'qm', 'admin', 'auditor'] },
    { path: '/backup-restore', label: t('nav_backupRestore') || 'Backup & Restore', icon: Database, roles: ['co', 'admin'] }
  ];

  const visibleAdminItems = adminNavItems.filter(item => 
    item.roles.includes(currentUser.role) || currentUser.role === 'admin' || currentUser.role === 'co'
  );

  const handleItemClick = (path: string) => {
    onNavigate(path);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs animate-in fade-in"
        />
      )}

      {/* Main Navigation Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-[#1E3316] text-white flex flex-col justify-between
          border-r border-[#3B5E2B] transition-transform duration-200 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Navigation List */}
        <div className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
          {/* Mobile Header with Close Button */}
          <div className="lg:hidden flex items-center justify-between pb-3 px-2 mb-2 border-b border-[#3B5E2B]">
            <span className="font-extrabold text-xs tracking-wider uppercase text-emerald-400">
              Navigation Menu
            </span>
            <button onClick={onCloseMobile} className="p-1 rounded-md text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Core Navigation Items */}
          <div className="space-y-0.5">
            {coreNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePath === item.path;

              return (
                <button
                  key={item.path}
                  onClick={() => handleItemClick(item.path)}
                  className={`
                    w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-semibold
                    transition-all duration-150 text-left cursor-pointer
                    ${isActive 
                      ? 'bg-[#2D4A22] text-[#F59E0B] border-l-4 border-[#F59E0B] shadow-inner font-bold' 
                      : 'text-slate-300 hover:bg-[#2D4A22]/60 hover:text-white'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#F59E0B]' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Optional Administrative Section for Authorized Officers */}
          {visibleAdminItems.length > 0 && (
            <div className="pt-3 mt-3 border-t border-[#3B5E2B]/60 space-y-0.5">
              <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block mb-1">
                System Administration
              </span>
              {visibleAdminItems.map((item) => {
                const Icon = item.icon;
                const isActive = activePath === item.path;

                return (
                  <button
                    key={item.path}
                    onClick={() => handleItemClick(item.path)}
                    className={`
                      w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-semibold
                      transition-all duration-150 text-left cursor-pointer
                      ${isActive 
                        ? 'bg-[#2D4A22] text-[#F59E0B] border-l-4 border-[#F59E0B] shadow-inner font-bold' 
                        : 'text-slate-300 hover:bg-[#2D4A22]/60 hover:text-white'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#F59E0B]' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* User Identity Footer in Sidebar */}
        <div className="p-3 border-t border-[#3B5E2B] bg-[#14230E]/60">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#2D4A22] border border-[#4C7536] flex items-center justify-center text-[#F59E0B] font-bold text-xs">
              {currentUser.rank ? currentUser.rank.slice(0, 3).toUpperCase() : '95'}
            </div>
            <div className="text-left overflow-hidden flex-1">
              <p className="text-xs font-bold text-white truncate">
                {currentUser.rank ? `${currentUser.rank} ` : ''}{currentUser.fullName || currentUser.appointmentTitle}
              </p>
              <p className="text-[10px] text-emerald-400 truncate capitalize font-mono">
                {currentUser.subUnitCompany || currentUser.appointmentTitle}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
