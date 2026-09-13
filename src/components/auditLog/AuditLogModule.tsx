import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { AuditLogEntry } from '../../types';
import { exportTableToExcel } from '../../services/excelService';
import { 
  Lock, Search, Filter, Download, 
  ShieldCheck, AlertTriangle, Clock, RefreshCw, Key 
} from 'lucide-react';

export const AuditLogModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber } = useLanguage();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');

  const loadLogs = async () => {
    const list = await db.auditLogs.toArray();
    setLogs(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleExportExcel = () => {
    const data = logs.map(l => ({
      'Log ID': l.id,
      'Timestamp (Asia/Dhaka)': l.timestamp,
      'User Appointment': l.userAppointment,
      'Role': l.userRole,
      'Section': l.section,
      'Device Name': l.deviceName,
      'Action Type': l.actionType,
      'Target Record': l.targetRecordRef,
      'Remarks': l.remarks || '',
      'HMAC Signature': l.integrityHmac
    }));
    exportTableToExcel(data, `95FA_Audit_Log_${new Date().toISOString().substring(0, 10)}`);
  };

  const filteredLogs = logs.filter(l => {
    const matchesSearch = 
      l.userAppointment.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.actionType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.targetRecordRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.remarks && l.remarks.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSection = sectionFilter === 'ALL' || l.section === sectionFilter;
    return matchesSearch && matchesSection;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              {t('nav_auditLog')} (Append-Only HMAC Register)
            </h2>
            <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
              95 FD AMB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tamper-evident append-only ledger with cryptographic HMAC SHA-256 signatures for every action and export.
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t('action_exportExcel')}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action, appointment, target record, remarks..."
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
          >
            <option value="ALL">All Sections</option>
            <option value="auth">Authentication</option>
            <option value="parade_state">Parade State</option>
            <option value="manpower">Manpower State</option>
            <option value="vehicle">Vehicle / MT</option>
            <option value="med_store_medicine">Medical Store (Medicine)</option>
            <option value="med_store_instruments">Medical Instruments</option>
            <option value="med_store_equipment">Medical Equipment</option>
            <option value="admin_duty">Duty Roster</option>
            <option value="admin_device">Device Management</option>
          </select>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#1E3316] text-white uppercase text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp (Asia/Dhaka)</th>
                <th className="py-3 px-4">User Appointment</th>
                <th className="py-3 px-4">Section</th>
                <th className="py-3 px-4">Action Type</th>
                <th className="py-3 px-4">Target Record</th>
                <th className="py-3 px-4">Remarks & Description</th>
                <th className="py-3 px-4 font-mono text-[10px]">HMAC Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
              {filteredLogs.map((entry) => (
                <tr key={entry.id} className="hover:bg-[#F8F9F5] dark:hover:bg-slate-800/50 transition">
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {formatNumber(entry.timestamp.substring(0, 19).replace('T', ' '))}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {entry.userAppointment}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                    {entry.section}
                  </td>
                  <td className="py-3 px-4">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold text-[10px] px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                      {entry.actionType}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-emerald-800 dark:text-emerald-400">
                    {entry.targetRecordRef}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={entry.remarks}>
                    {entry.remarks || '—'}
                  </td>
                  <td className="py-3 px-4 font-mono text-[9px] text-slate-400 max-w-[120px] truncate" title={entry.integrityHmac}>
                    {entry.integrityHmac.substring(0, 18)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
