import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Bell, CheckCircle2, AlertTriangle, AlertOctagon, 
  Info, CheckSquare, Clock 
} from 'lucide-react';

export const NotificationsModule: React.FC = () => {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const { t, formatNumber } = useLanguage();

  const getIcon = (type: string) => {
    switch (type) {
      case 'CRITICAL':
        return <AlertOctagon className="w-5 h-5 text-red-600" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'SUCCESS':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              {t('nav_notifications')} & Command Alerts
            </h2>
            {unreadCount > 0 && (
              <span className="bg-red-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full">
                {formatNumber(unreadCount)} Unread
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Internal offline notification hub. Zero dependence on external cloud push gateways.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
          >
            Mark All as Read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 text-center border border-dashed border-slate-300 dark:border-slate-700">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">
              No Pending Alerts
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              All system records, approvals, and medical thresholds are in optimal state.
            </p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => markAsRead(notif.id)}
              className={`p-4 rounded-xl border transition cursor-pointer flex items-start gap-3.5 ${
                notif.isRead 
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-80' 
                  : 'bg-emerald-50/50 dark:bg-slate-800/90 border-emerald-300 dark:border-emerald-700/60 shadow-xs'
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {getIcon(notif.type)}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    {notif.title}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatNumber(notif.timestamp.substring(0, 16).replace('T', ' '))}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {notif.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
