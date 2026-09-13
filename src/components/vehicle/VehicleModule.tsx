import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { VehicleDailyState, VehicleFleetItem } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { RequestCorrectionModal } from '../common/RequestCorrectionModal';
import { exportTableToExcel } from '../../services/excelService';
import { logAuditEvent } from '../../services/auditService';
import { syncEntityToCloud, deleteEntityFromCloud } from '../../services/firebaseSyncService';
import { 
  Truck, Plus, Search, Filter, Download, 
  Send, AlertTriangle, CheckCircle2, ShieldCheck, Wrench, Edit3, Lock, Eye, Edit, Trash2, Save 
} from 'lucide-react';

export const VehicleModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber } = useLanguage();

  const [dailyState, setDailyState] = useState<VehicleDailyState | null>(null);
  const [fleetList, setFleetList] = useState<VehicleFleetItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Correction Request Modal State
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState<boolean>(false);
  const [correctionRecordTitle, setCorrectionRecordTitle] = useState<string>('MT / Vehicle State');
  const [correctionField, setCorrectionField] = useState<string>('Vehicle Task Readiness');
  const [correctionExistingVal, setCorrectionExistingVal] = useState<string>('');

  // Vehicle Summary Edit Modal State
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [editTotalAuth, setEditTotalAuth] = useState<number>(35);
  const [editTotalHeld, setEditTotalHeld] = useState<number>(28);
  const [editTotalAvailTask, setEditTotalAvailTask] = useState<number>(25);
  const [editTotalServiceable, setEditTotalServiceable] = useState<number>(26);
  const [editTotalUnderRepair, setEditTotalUnderRepair] = useState<number>(2);
  const [editTotalInspectionDue, setEditTotalInspectionDue] = useState<number>(3);
  const [summarySaveMsg, setSummarySaveMsg] = useState<string | null>(null);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<VehicleFleetItem | null>(null);
  const [vehType, setVehType] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [regNo, setRegNo] = useState<string>('');
  const [authQty, setAuthQty] = useState<number>(1);
  const [heldQty, setHeldQty] = useState<number>(1);
  const [status, setStatus] = useState<any>('AVAILABLE_FOR_TASK');
  const [svc, setSvc] = useState<any>('FULLY_FIT');
  const [driverName, setDriverName] = useState<string>('');
  const [location, setLocation] = useState<string>('Unit MT Line');
  const [lastInsp, setLastInsp] = useState<string>('2026-08-01');
  const [nextInsp, setNextInsp] = useState<string>('2026-08-30');
  const [repairRef, setRepairRef] = useState<string>('');
  const [respAppt, setRespAppt] = useState<string>('MT NCO');
  const [remarks, setRemarks] = useState<string>('');

  const loadData = async () => {
    const st = await db.vehicleDailyStates.orderBy('stateDate').last();
    if (st) setDailyState(st);
    const items = await db.vehicleFleetItems.toArray();
    setFleetList(items);
  };

  useEffect(() => {
    loadData();

    const handleCloudSync = (e: any) => {
      if (e.detail?.collection === 'vehicleFleetItems' || e.detail?.collection === 'vehicleDailyStates') {
        loadData();
      }
    };
    window.addEventListener('unit-ready-cloud-sync', handleCloudSync);
    return () => window.removeEventListener('unit-ready-cloud-sync', handleCloudSync);
  }, []);

  const handleOpenSummaryModal = () => {
    if (dailyState) {
      setEditTotalAuth(dailyState.totalAuthorized);
      setEditTotalHeld(dailyState.totalHeld);
      setEditTotalAvailTask(dailyState.totalAvailableForTask);
      setEditTotalServiceable(dailyState.totalServiceable);
      setEditTotalUnderRepair(dailyState.totalUnderRepair);
      setEditTotalInspectionDue(dailyState.totalInspectionDue);
    } else {
      setEditTotalAuth(35);
      setEditTotalHeld(28);
      setEditTotalAvailTask(25);
      setEditTotalServiceable(26);
      setEditTotalUnderRepair(2);
      setEditTotalInspectionDue(3);
    }
    setIsSummaryModalOpen(true);
  };

  const handleSaveVehicleSummary = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      editTotalAuth < 0 || editTotalHeld < 0 || editTotalAvailTask < 0 ||
      editTotalServiceable < 0 || editTotalUnderRepair < 0 || editTotalInspectionDue < 0
    ) {
      alert('All vehicle summary counts must be non-negative whole numbers.');
      return;
    }

    const stateDate = dailyState?.stateDate || new Date().toISOString().substring(0, 10);
    const id = dailyState?.id || `vs-${stateDate}`;
    const deficiency = Math.max(0, editTotalAuth - editTotalHeld);

    const updated: VehicleDailyState = {
      id,
      stateDate,
      version: dailyState?.version || '1.0',
      totalAuthorized: Number(editTotalAuth),
      totalHeld: Number(editTotalHeld),
      totalAvailableForTask: Number(editTotalAvailTask),
      totalServiceable: Number(editTotalServiceable),
      totalUnserviceable: Math.max(0, Number(editTotalHeld) - Number(editTotalServiceable)),
      totalUnderRepair: Number(editTotalUnderRepair),
      totalInspectionDue: Number(editTotalInspectionDue),
      deficiencyExcess: deficiency,
      status: dailyState?.status || 'SUBMITTED',
      preparedBy: currentUser.appointmentTitle,
      updatedAt: new Date().toISOString()
    };

    await db.vehicleDailyStates.put(updated);
    await syncEntityToCloud('vehicleDailyStates', updated.id, updated);
    setDailyState(updated);
    setIsSummaryModalOpen(false);

    await logAuditEvent(
      currentUser,
      'DRAFT_SAVED',
      'vehicle',
      stateDate,
      `Updated Vehicle Summary: Authorized=${editTotalAuth}, Held=${editTotalHeld}, Available=${editTotalAvailTask}, Serviceable=${editTotalServiceable}, UnderRepair=${editTotalUnderRepair}`
    );

    setSummarySaveMsg(`✅ Vehicle Summary for ${stateDate} saved permanently & synced to all devices!`);
    setTimeout(() => setSummarySaveMsg(null), 4000);
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setVehType('');
    setModel('');
    setRegNo(`95-MT-0${fleetList.length + 1}`);
    setAuthQty(1);
    setHeldQty(1);
    setStatus('AVAILABLE_FOR_TASK');
    setSvc('FULLY_FIT');
    setDriverName('');
    setLocation('Unit MT Line');
    setLastInsp('2026-08-01');
    setNextInsp('2026-08-30');
    setRepairRef('');
    setRespAppt('MT NCO');
    setRemarks('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: VehicleFleetItem) => {
    setEditingItem(item);
    setVehType(item.vehicleType);
    setModel(item.model || '');
    setRegNo(item.registrationFleetRef);
    setAuthQty(item.authorizedQty);
    setHeldQty(item.heldQty);
    setStatus(item.status);
    setSvc(item.serviceability);
    setDriverName(item.driverName || '');
    setLocation(item.location || 'Unit MT Line');
    setLastInsp(item.lastInspectionDate);
    setNextInsp(item.nextInspectionDueDate);
    setRepairRef(item.repairReference || '');
    setRespAppt(item.responsibleAppointment);
    setRemarks(item.remarks || '');
    setIsModalOpen(true);
  };

  const handleDeleteVehicle = async (item: VehicleFleetItem) => {
    const confirm = window.confirm(
      `Are you sure you want to delete / remove vehicle "${item.vehicleType} (${item.registrationFleetRef})"?`
    );
    if (!confirm) return;

    await db.vehicleFleetItems.delete(item.id);
    await deleteEntityFromCloud('vehicleFleetItems', item.id);

    await logAuditEvent(
      currentUser,
      'RECORD_DELETED',
      'vehicle',
      item.registrationFleetRef,
      `Deleted vehicle: ${item.vehicleType} (${item.registrationFleetRef})`
    );

    loadData();
    alert(`Vehicle "${item.registrationFleetRef}" removed from active fleet.`);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehType || !regNo) return;

    if (editingItem) {
      const updated: VehicleFleetItem = {
        ...editingItem,
        vehicleType: vehType,
        model,
        registrationFleetRef: regNo,
        authorizedQty: authQty,
        heldQty: heldQty,
        status,
        serviceability: svc,
        driverName,
        location,
        lastInspectionDate: lastInsp,
        nextInspectionDueDate: nextInsp,
        repairReference: repairRef,
        responsibleAppointment: respAppt,
        remarks
      };
      await db.vehicleFleetItems.put(updated);
      await syncEntityToCloud('vehicleFleetItems', updated.id, updated);
      await logAuditEvent(currentUser, 'DRAFT_SAVED', 'vehicle', regNo, `Updated vehicle: ${vehType} (${regNo})`);
    } else {
      const newItem: VehicleFleetItem = {
        id: 'v-' + Date.now(),
        vehicleType: vehType,
        model,
        registrationFleetRef: regNo,
        authorizedQty: authQty,
        heldQty: heldQty,
        status,
        serviceability: svc,
        driverName,
        location,
        lastInspectionDate: lastInsp,
        nextInspectionDueDate: nextInsp,
        repairReference: repairRef,
        responsibleAppointment: respAppt,
        remarks
      };
      await db.vehicleFleetItems.add(newItem);
      await syncEntityToCloud('vehicleFleetItems', newItem.id, newItem);
      await logAuditEvent(currentUser, 'DRAFT_SAVED', 'vehicle', regNo, `Added new vehicle: ${vehType} (${regNo})`);
    }

    setIsModalOpen(false);
    loadData();
  };

  const handleSubmitTo2Ic = async () => {
    if (!dailyState) return;
    const updated: VehicleDailyState = {
      ...dailyState,
      status: 'SUBMITTED',
      preparedBy: currentUser.appointmentTitle,
      updatedAt: new Date().toISOString()
    };
    await db.vehicleDailyStates.put(updated);
    await syncEntityToCloud('vehicleDailyStates', updated.id, updated);
    setDailyState(updated);
    alert('Vehicle State submitted to 2IC for verification.');
    logAuditEvent(currentUser, 'RECORD_SUBMITTED', 'vehicle', updated.id, 'Submitted Vehicle State to 2IC.');
  };

  const handleExportExcel = () => {
    const data = fleetList.map(v => ({
      'Vehicle Type': v.vehicleType,
      'Fleet Reg No': v.registrationFleetRef,
      'Auth': v.authorizedQty,
      'Held': v.heldQty,
      'Task Status': v.status,
      'Fitness': v.serviceability,
      'Last Inspection': v.lastInspectionDate,
      'Next Inspection': v.nextInspectionDueDate,
      'Repair Ref': v.repairReference || 'N/A',
      'Appointment': v.responsibleAppointment,
      'Remarks': v.remarks || ''
    }));
    exportTableToExcel(data, `95FA_Vehicle_Fleet_State_${new Date().toISOString().substring(0, 10)}`);
  };

  const filteredFleet = fleetList.filter(f => {
    const matchesSearch = 
      f.vehicleType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.registrationFleetRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.responsibleAppointment.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const canEdit = currentUser.role !== 'general_viewer';

  return (
    <div className="space-y-6">
      {/* Read-Only Notice Banner for General Viewers */}
      {!canEdit && (
        <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 shadow-xs">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>Read-Only View Mode:</strong> You are logged in as <strong>{currentUser.appointmentTitle}</strong>. Full editing controls are active for Vehicle Operators and Officers.
            </span>
          </div>
          <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded font-bold">
            VIEW ONLY
          </span>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              {t('nav_vehicle')} & MT Readiness
            </h2>
            <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
              95 FD AMB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Transport Readiness, Serviceability Ratings, EME Repair References & Inspection Alerts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dailyState && <StatusBadge status={dailyState.status} />}
          {canEdit && (
            <>
              <button
                type="button"
                onClick={handleOpenSummaryModal}
                className="px-3.5 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-black text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer"
                title="Edit Total Authorized, Held and Available vehicle fleet metrics"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Vehicle Summary</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-4 py-2 rounded-xl bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#F59E0B]" />
                <span>Add Vehicle</span>
              </button>
              {dailyState?.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={handleSubmitTo2Ic}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{t('action_submit')}</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1 shadow cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('action_exportExcel')}</span>
          </button>
        </div>
      </div>

      {/* Summary Save Alert Banner */}
      {summarySaveMsg && (
        <div className="p-3.5 rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{summarySaveMsg}</span>
          </div>
          <button onClick={() => setSummarySaveMsg(null)} className="text-xs px-2 py-0.5 rounded bg-white/50 hover:bg-white text-slate-700 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      {dailyState && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">{t('mp_authorized')}</span>
            <span className="text-lg font-black text-slate-800 dark:text-white font-mono">{formatNumber(dailyState.totalAuthorized)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">{t('mp_held')}</span>
            <span className="text-lg font-black text-slate-800 dark:text-white font-mono">{formatNumber(dailyState.totalHeld)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">{t('veh_availableTask')}</span>
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">{formatNumber(dailyState.totalAvailableForTask)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Serviceable</span>
            <span className="text-lg font-black text-emerald-600 font-mono">{formatNumber(dailyState.totalServiceable)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Under Repair</span>
            <span className="text-lg font-black text-amber-600 font-mono">{formatNumber(dailyState.totalUnderRepair)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Inspection Due</span>
            <span className="text-lg font-black text-purple-600 font-mono">{formatNumber(dailyState.totalInspectionDue)}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Deficiency</span>
            <span className="text-lg font-black text-slate-700 dark:text-slate-300 font-mono">{formatNumber(dailyState.deficiencyExcess)}</span>
          </div>
        </div>
      )}

      {/* Fleet Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#1E3316] text-white uppercase text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">Vehicle Type</th>
                <th className="py-3 px-4">Reg / Fleet No</th>
                <th className="py-3 px-4">Auth / Held</th>
                <th className="py-3 px-4">Task Status</th>
                <th className="py-3 px-4">Fitness</th>
                <th className="py-3 px-4">Next Inspection</th>
                <th className="py-3 px-4">Repair Ref</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredFleet.map((item) => (
                <tr key={item.id} className="hover:bg-[#F8F9F5] dark:hover:bg-slate-800/50 transition">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {item.vehicleType}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-800 dark:text-emerald-400">
                    {item.registrationFleetRef}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {formatNumber(item.authorizedQty)} / {formatNumber(item.heldQty)}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={item.status} size="sm" />
                  </td>
                  <td className="py-3 px-4 font-semibold text-[11px]">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.serviceability === 'FULLY_FIT' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                        : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                    }`}>
                      {item.serviceability.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                    {formatNumber(item.nextInspectionDueDate)}
                  </td>
                  <td className="py-3 px-4 font-mono text-amber-700 dark:text-amber-400">
                    {item.repairReference || '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {canEdit ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                          title="Edit Vehicle Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(item)}
                          className="p-1.5 rounded bg-red-100 hover:bg-red-200 dark:bg-red-950/60 dark:hover:bg-red-900 text-red-700 dark:text-red-300 text-xs font-semibold cursor-pointer"
                          title="Delete / Archive Vehicle"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 font-mono text-[11px]">View Only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Vehicle Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit MT Fleet Item' : 'Add Vehicle to Fleet'}
        subtitle="Manage transport readiness and maintenance tracking for 95 Fd Amb"
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Vehicle Type Nomenclature *
              </label>
              <input
                type="text"
                value={vehType}
                onChange={(e) => setVehType(e.target.value)}
                placeholder="e.g. Ambulance Toyota 4x4 / Troop Carrier 3-Ton"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Model / Make
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Land Cruiser HZJ78"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Registration / Vehicle Number *
              </label>
              <input
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="e.g. BA-1049 / 95-MT-01"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Assigned Driver / Personnel Name
              </label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="e.g. Snk Md. Rasel Miah (NO-10847)"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Authorized Qty *
              </label>
              <input
                type="number"
                min="1"
                value={authQty}
                onChange={(e) => setAuthQty(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Held / Current Qty *
              </label>
              <input
                type="number"
                min="0"
                value={heldQty}
                onChange={(e) => setHeldQty(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Task Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="AVAILABLE_FOR_TASK">Available for Task</option>
                <option value="UNDER_REPAIR">Under Repair</option>
                <option value="INSPECTION_DUE">Inspection Due</option>
                <option value="UNSERVICEABLE">Unserviceable</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Fitness Rating (SVC/UNSVC)
              </label>
              <select
                value={svc}
                onChange={(e) => setSvc(e.target.value as any)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="FULLY_FIT">SVC — Fully Fit</option>
                <option value="TEMPORARY_RESTRICTION">Temp Restriction</option>
                <option value="OFF_ROAD">UNSVC — Off Road</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Location / Section
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Unit MT Line / Main Camp"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Next Inspection Due *
              </label>
              <input
                type="date"
                value={nextInsp}
                onChange={(e) => setNextInsp(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                EME Workshop Reference
              </label>
              <input
                type="text"
                value={repairRef}
                onChange={(e) => setRepairRef(e.target.value)}
                placeholder="e.g. EME/95FA/JOB-389"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Assigned to A-Coy CASEVAC duty / Routine battery check"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold"
            >
              {t('action_cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow"
            >
              Save Vehicle
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: EDIT VEHICLE SUMMARY (AUTHORIZED & HELD VALUES)   */}
      {/* ========================================================= */}
      <Modal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        title="Edit Vehicle Fleet Summary Metrics"
        subtitle="Full operator control to set Total Authorized and Total Held/Available vehicle metrics independently."
      >
        <form onSubmit={handleSaveVehicleSummary} className="space-y-4 text-xs font-sans">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-slate-700">
              <span className="font-extrabold text-xs uppercase text-slate-800 dark:text-slate-200">
                Core Fleet Strength Metrics
              </span>
              <span className="font-mono text-[11px] text-amber-700 dark:text-amber-400 font-bold">
                Deficiency: {Math.max(0, Number(editTotalAuth) - Number(editTotalHeld))}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Total Authorized Vehicles */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1 uppercase">
                  Total Authorized Vehicles *
                </label>
                <input
                  type="number"
                  min="0"
                  value={editTotalAuth}
                  onChange={(e) => setEditTotalAuth(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-black text-base p-2 border rounded-lg bg-slate-50 dark:bg-slate-800"
                  required
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Officially sanctioned establishment scale
                </span>
              </div>

              {/* Total Held / Available Vehicles */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border-2 border-emerald-500/60 dark:border-emerald-500/40">
                <label className="block text-xs font-black text-emerald-800 dark:text-emerald-300 mb-1 uppercase">
                  Total Held / On Charge *
                </label>
                <input
                  type="number"
                  min="0"
                  value={editTotalHeld}
                  onChange={(e) => setEditTotalHeld(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-black text-base p-2 border rounded-lg bg-emerald-50/50 dark:bg-slate-800 text-emerald-700"
                  required
                />
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-1 font-semibold">
                  Total vehicles physically held by the unit
                </span>
              </div>
            </div>

            {/* Operational Readiness Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-center">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Available for Task</label>
                <input
                  type="number"
                  min="0"
                  value={editTotalAvailTask}
                  onChange={(e) => setEditTotalAvailTask(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Serviceable (SVC)</label>
                <input
                  type="number"
                  min="0"
                  value={editTotalServiceable}
                  onChange={(e) => setEditTotalServiceable(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Under Repair</label>
                <input
                  type="number"
                  min="0"
                  value={editTotalUnderRepair}
                  onChange={(e) => setEditTotalUnderRepair(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-amber-600"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Inspection Due</label>
                <input
                  type="number"
                  min="0"
                  value={editTotalInspectionDue}
                  onChange={(e) => setEditTotalInspectionDue(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-purple-600"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsSummaryModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save & Sync Summary</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Request Correction Modal */}
      <RequestCorrectionModal
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        recordTypeOrDate={correctionRecordTitle}
        initialField={correctionField}
        initialExistingValue={correctionExistingVal}
        availableFields={[
          { name: 'Vehicle Serviceability', label: 'Serviceability Ratings & Task Fleet', currentValue: `Held: ${dailyState?.totalHeld || 0}, Available: ${dailyState?.totalAvailableForTask || 0}` },
          { name: 'Under Repair Count', label: 'EME Workshop / Under Repair Quantity', currentValue: `Under Repair: ${dailyState?.totalUnderRepair || 0}` },
          { name: 'Inspection Due', label: 'Fitness & Inspection Due Dates', currentValue: `Inspection Due: ${dailyState?.totalInspectionDue || 0}` }
        ]}
        onSuccess={() => loadData()}
      />
    </div>
  );
};
