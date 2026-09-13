import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { DutyRoster } from '../../types';
import { DigitalRosterEditor } from './DigitalRosterEditor';
import { DigitalRosterPrintView } from './DigitalRosterPrintView';
import { logAuditEvent } from '../../services/auditService';
import { syncEntityToCloud, deleteEntityFromCloud } from '../../services/firebaseSyncService';
import { 
  FileText, Plus, Search, Calendar, 
  Printer, Edit3, Trash2, Copy, Eye, 
  EyeOff, CheckCircle2, Shield, Clock, MapPin, Users
} from 'lucide-react';

export const DutyRosterModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber } = useLanguage();

  const [rosters, setRosters] = useState<DutyRoster[]>([]);
  const [activeView, setActiveView] = useState<'LIST' | 'EDITOR' | 'PRINT_VIEW'>('LIST');
  const [selectedRoster, setSelectedRoster] = useState<DutyRoster | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');

  const isViewer = currentUser.role === 'general_viewer';
  const canManage = !isViewer;

  const loadRosters = async () => {
    const list = await db.dutyRosters.toArray();
    setRosters(list.sort((a, b) => new Date(b.dutyDate || b.createdAt).getTime() - new Date(a.dutyDate || a.createdAt).getTime()));
  };

  useEffect(() => {
    loadRosters();

    const handleCloudSync = (e: any) => {
      if (e.detail?.collection === 'dutyRosters') {
        loadRosters();
      }
    };
    window.addEventListener('unit-ready-cloud-sync', handleCloudSync);
    return () => window.removeEventListener('unit-ready-cloud-sync', handleCloudSync);
  }, []);

  const handleOpenCreate = () => {
    setSelectedRoster(null);
    setActiveView('EDITOR');
  };

  const handleOpenEdit = (roster: DutyRoster) => {
    setSelectedRoster(roster);
    setActiveView('EDITOR');
  };

  const handleOpenPrintPreview = (roster: DutyRoster) => {
    setSelectedRoster(roster);
    setActiveView('PRINT_VIEW');
  };

  const handleSaveRoster = async (roster: DutyRoster) => {
    await db.dutyRosters.put(roster);
    await syncEntityToCloud('dutyRosters', roster.id, roster);

    await logAuditEvent(
      currentUser,
      'DUTY_ROSTER_SAVED',
      'duty_roster',
      roster.dutyDate,
      `${currentUser.appointmentTitle} saved digital Part-1 Duty Roster for ${roster.dutyDate}. Status: ${roster.status}. Total rows: ${roster.dutyRows?.length || 0}.`
    );

    await loadRosters();
    setActiveView('LIST');
    alert(`Part-1 Duty Roster for ${roster.dutyDate} saved successfully!`);
  };

  const handleDeleteRoster = async (roster: DutyRoster) => {
    const confirm = window.confirm(`Are you sure you want to delete Part-1 Duty Roster for "${roster.dutyDate}"? This action cannot be undone.`);
    if (!confirm) return;

    await db.dutyRosters.delete(roster.id);
    await deleteEntityFromCloud('dutyRosters', roster.id);

    await logAuditEvent(
      currentUser,
      'RECORD_DELETED',
      'duty_roster',
      roster.referenceNo || roster.dutyDate,
      `Deleted duty roster: ${roster.title} (${roster.dutyDate})`
    );

    await loadRosters();
  };

  const handleDuplicateRoster = async (sourceRoster: DutyRoster) => {
    const d = new Date(sourceRoster.dutyDate);
    d.setDate(d.getDate() + 1);
    const nextDay = d.toISOString().substring(0, 10);

    const dupRows = (sourceRoster.dutyRows || []).map(r => ({
      ...r,
      id: 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      date: nextDay
    }));

    const duplicated: DutyRoster = {
      ...sourceRoster,
      id: 'roster-' + Date.now(),
      referenceNo: `95FD/PART1/${nextDay.replace(/[-]/g, '')}`,
      dutyDate: nextDay,
      effectiveFrom: nextDay,
      effectiveUntil: new Date(new Date(nextDay).getTime() + 86400000).toISOString().substring(0, 10),
      title: `Daily Part-1 Duty Roster / Orders (${nextDay})`,
      dutyRows: dupRows,
      status: 'DRAFT',
      isPublished: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.dutyRosters.put(duplicated);
    await syncEntityToCloud('dutyRosters', duplicated.id, duplicated);
    await loadRosters();
    alert(`Duplicated roster for ${nextDay}! Opened in draft.`);
  };

  const handleTogglePublish = async (roster: DutyRoster) => {
    const targetStatus = !roster.isPublished;
    const updated: DutyRoster = {
      ...roster,
      isPublished: targetStatus,
      status: targetStatus ? 'PUBLISHED' : 'DRAFT',
      updatedAt: new Date().toISOString()
    };

    await db.dutyRosters.put(updated);
    await syncEntityToCloud('dutyRosters', updated.id, updated);
    await loadRosters();
  };

  // Filtered List — General viewers can view all saved rosters in read-only mode
  const filteredRosters = rosters.filter(r => {
    if (dateFilter && r.dutyDate !== dateFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchDate = (r.dutyDate || '').toLowerCase().includes(q);
      const matchRef = (r.referenceNo || '').toLowerCase().includes(q);
      const matchOfficer = (r.mainAppointments?.dutyOfficer?.name || '').toLowerCase().includes(q);
      const matchPersonnel = (r.dutyRows || []).some(row => 
        (row.personnelName || '').toLowerCase().includes(q) || 
        (row.serviceNumber || '').toLowerCase().includes(q) ||
        (row.placeOfDuty || '').toLowerCase().includes(q)
      );
      return matchTitle || matchDate || matchRef || matchOfficer || matchPersonnel;
    }
    return true;
  });

  if (activeView === 'EDITOR') {
    return (
      <DigitalRosterEditor
        initialRoster={selectedRoster}
        onSave={handleSaveRoster}
        onCancel={() => setActiveView('LIST')}
        onPreviewPrint={(roster) => {
          setSelectedRoster(roster);
          setActiveView('PRINT_VIEW');
        }}
        currentUserAppointment={currentUser.appointmentTitle}
      />
    );
  }

  if (activeView === 'PRINT_VIEW' && selectedRoster) {
    return (
      <DigitalRosterPrintView
        roster={selectedRoster}
        onClose={() => setActiveView('LIST')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#2D4A22] text-[#F59E0B] flex items-center justify-center shadow-md">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                Part-1 Duty Roster — Digital Orders Station
              </h2>
              <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                Structured Roster
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Structured daily military duties, key appointments, multi-location shift allocations, and automated A4 PDF generation.
            </p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-[#2D4A22] hover:bg-[#3B5E2B] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create Digital Roster</span>
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by personnel name, BA number, duty place, or duty officer..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="p-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 cursor-pointer font-bold"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Roster Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRosters.length === 0 ? (
          <div className="col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No duty rosters found</p>
            <p className="text-xs text-slate-400">
              {searchQuery || dateFilter ? 'No rosters match your filter criteria.' : 'Click "Create Digital Roster" above to publish daily orders.'}
            </p>
          </div>
        ) : (
          filteredRosters.map((roster) => {
            const rowsCount = roster.dutyRows?.length || 0;
            const placeCount = roster.placeGroups?.length || 0;
            const isPub = roster.isPublished !== false;

            return (
              <div
                key={roster.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top Bar: Date, Reference & Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{roster.dutyDate}</span>
                      </span>

                      {roster.isRestricted !== false && (
                        <span className="text-[10px] font-black uppercase text-red-600 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                          Restricted
                        </span>
                      )}
                    </div>

                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      isPub
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {isPub ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  {/* Title & Unit */}
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {roster.title || `Daily Part-1 Duty Roster (${roster.dutyDate})`}
                  </h3>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    Unit: {roster.unitName || '95 FD AMB'} • Ref: {roster.referenceNo || roster.id}
                  </div>

                  {/* Summary Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Duty Officer</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {roster.mainAppointments?.dutyOfficer?.rank} {roster.mainAppointments?.dutyOfficer?.name || 'Assigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Duty JCO / NCO</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {roster.mainAppointments?.dutyJco?.rank} {roster.mainAppointments?.dutyJco?.name || 'Assigned'}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1 font-medium">
                        <MapPin className="w-3 h-3 text-red-500" />
                        <span>{placeCount} Duty Locations</span>
                      </span>
                      <span className="flex items-center gap-1 font-bold text-[#2D4A22] dark:text-amber-400">
                        <Users className="w-3 h-3" />
                        <span>{rowsCount} Personnel Assigned</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPrintPreview(roster)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#F59E0B]" />
                      <span>View Orders</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenPrintPreview(roster)}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print / PDF</span>
                    </button>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1.5">
                      {/* Duplicate for Next Day */}
                      <button
                        type="button"
                        onClick={() => handleDuplicateRoster(roster)}
                        className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Duplicate for Next Day"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Duplicate</span>
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(roster)}
                        className="p-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                        title="Edit Roster"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteRoster(roster)}
                        className="p-1.5 rounded-lg hover:bg-red-100 text-red-600 dark:text-red-400 text-xs font-bold cursor-pointer"
                        title="Delete Roster"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
