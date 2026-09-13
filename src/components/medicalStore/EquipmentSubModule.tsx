import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { MedicalEquipmentItem, SectionApprovalRecord } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { RequestCorrectionModal } from '../common/RequestCorrectionModal';
import { logAuditEvent } from '../../services/auditService';
import { syncEntityToCloud, deleteEntityFromCloud } from '../../services/firebaseSyncService';
import { 
  Activity, Plus, Search, Filter, Download, 
  AlertTriangle, CheckCircle2, ShieldCheck, Wrench, Zap, Send, Edit3, Lock, Trash2 
} from 'lucide-react';

export const EquipmentSubModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber } = useLanguage();

  const [equipmentList, setEquipmentList] = useState<MedicalEquipmentItem[]>([]);
  const [approvalRecord, setApprovalRecord] = useState<SectionApprovalRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Correction Request Modal State
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState<boolean>(false);
  const [correctionRecordTitle, setCorrectionRecordTitle] = useState<string>('Medical Store — Equipment Register');
  const [correctionField, setCorrectionField] = useState<string>('Serviceability Status & Calibration');
  const [correctionExistingVal, setCorrectionExistingVal] = useState<string>('');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MedicalEquipmentItem | null>(null);
  const [eqName, setEqName] = useState<string>('');
  const [category, setCategory] = useState<any>('ELECTRO_MEDICAL');
  const [makeModel, setMakeModel] = useState<string>('');
  const [serialNo, setSerialNo] = useState<string>('');
  const [authQty, setAuthQty] = useState<number>(6);
  const [heldQty, setHeldQty] = useState<number>(5);
  const [status, setStatus] = useState<any>('SERVICEABLE');
  const [locDept, setLocDept] = useState<string>('Resuscitation Bay');
  const [lastInsp, setLastInsp] = useState<string>('2026-08-01');
  const [nextMaint, setNextMaint] = useState<string>('2026-11-01');
  const [calibDue, setCalibDue] = useState<string>('2026-12-15');
  const [repairRef, setRepairRef] = useState<string>('');
  const [respAppt, setRespAppt] = useState<string>('SMT Medical Transport Tech');
  const [remarks, setRemarks] = useState<string>('');

  const loadData = async () => {
    const list = await db.medicalEquipment.toArray();
    setEquipmentList(list);
    const appr = await db.sectionApprovals.where('section').equals('med_store_equipment').last();
    if (appr) setApprovalRecord(appr);
  };

  useEffect(() => {
    loadData();

    const handleCloudSync = (e: any) => {
      if (e.detail?.collection === 'medicalEquipment' || e.detail?.collection === 'sectionApprovals') {
        loadData();
      }
    };
    window.addEventListener('unit-ready-cloud-sync', handleCloudSync);
    return () => window.removeEventListener('unit-ready-cloud-sync', handleCloudSync);
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setEqName('');
    setCategory('ELECTRO_MEDICAL');
    setMakeModel('');
    setSerialNo(`SN-95FA-EQ-00${equipmentList.length + 1}`);
    setAuthQty(6);
    setHeldQty(5);
    setStatus('SERVICEABLE');
    setLocDept('Resuscitation Bay');
    setLastInsp('2026-08-01');
    setNextMaint('2026-11-01');
    setCalibDue('2026-12-15');
    setRepairRef('');
    setRespAppt('SMT Medical Transport Tech');
    setRemarks('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: MedicalEquipmentItem) => {
    setEditingItem(item);
    setEqName(item.equipmentName);
    setCategory(item.category);
    setMakeModel(item.makeModel);
    setSerialNo(item.serialNumber);
    setAuthQty(item.authorizedQuantity);
    setHeldQty(item.heldQuantity);
    setStatus(item.currentStatus);
    setLocDept(item.locationDepartment);
    setLastInsp(item.lastInspectionDate);
    setNextMaint(item.nextMaintenanceDueDate);
    setCalibDue(item.calibrationDueDate);
    setRepairRef(item.repairReference || '');
    setRespAppt(item.responsibleAppointment);
    setRemarks(item.remarks || '');
    setIsModalOpen(true);
  };

  const handleDeleteEquipment = async (item: MedicalEquipmentItem) => {
    const confirm = window.confirm(`Are you sure you want to delete "${item.equipmentName}"?`);
    if (!confirm) return;

    await db.medicalEquipment.delete(item.id);
    await deleteEntityFromCloud('medicalEquipment', item.id);

    await logAuditEvent(
      currentUser,
      'RECORD_DELETED',
      'med_store_equipment',
      item.equipmentName,
      `Archived equipment: ${item.equipmentName} (${item.serialNumber})`
    );

    loadData();
    alert(`Equipment "${item.equipmentName}" removed.`);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eqName.trim()) return;

    const shortage = Number(heldQty) - Number(authQty);

    if (editingItem) {
      const updated: MedicalEquipmentItem = {
        ...editingItem,
        equipmentName: eqName.trim(),
        category,
        makeModel,
        serialNumber: serialNo,
        authorizedQuantity: Number(authQty),
        heldQuantity: Number(heldQty),
        shortageOrExcess: shortage,
        currentStatus: status,
        locationDepartment: locDept,
        lastInspectionDate: lastInsp,
        nextMaintenanceDueDate: nextMaint,
        calibrationDueDate: calibDue,
        repairReference: repairRef,
        responsibleAppointment: respAppt,
        remarks,
        updatedAt: new Date().toISOString()
      };
      await db.medicalEquipment.put(updated);
      await syncEntityToCloud('medicalEquipment', updated.id, updated);
      await logAuditEvent(currentUser, 'DRAFT_SAVED', 'med_store_equipment', updated.equipmentName, `Updated equipment: ${updated.equipmentName}`);
    } else {
      const newItem: MedicalEquipmentItem = {
        id: 'eq-' + Date.now(),
        equipmentName: eqName.trim(),
        category,
        makeModel,
        serialNumber: serialNo,
        authorizedQuantity: Number(authQty),
        heldQuantity: Number(heldQty),
        shortageOrExcess: shortage,
        currentStatus: status,
        locationDepartment: locDept,
        lastInspectionDate: lastInsp,
        nextMaintenanceDueDate: nextMaint,
        calibrationDueDate: calibDue,
        repairReference: repairRef,
        responsibleAppointment: respAppt,
        remarks,
        updatedAt: new Date().toISOString()
      };
      await db.medicalEquipment.add(newItem);
      await syncEntityToCloud('medicalEquipment', newItem.id, newItem);
      await logAuditEvent(currentUser, 'DRAFT_SAVED', 'med_store_equipment', newItem.equipmentName, `Added new equipment: ${newItem.equipmentName}`);
    }

    setIsModalOpen(false);
    loadData();
  };

  const handleSubmitToMoic = async () => {
    const nowIso = new Date().toISOString();
    const appr = await db.sectionApprovals.where('section').equals('med_store_equipment').first();
    if (appr) {
      const updatedAppr = {
        ...appr,
        status: 'PENDING_MOIC' as const,
        submittedByAppointment: currentUser.appointmentTitle,
        submittedAt: nowIso
      };
      await db.sectionApprovals.update(appr.id, updatedAppr);
      await syncEntityToCloud('sectionApprovals', appr.id, updatedAppr);
    }

    await logAuditEvent(
      currentUser,
      'RECORD_SUBMITTED',
      'med_store_equipment',
      'EQUIPMENT_STATE',
      'Submitted Medical Equipment state to MOIC for clinical verification.'
    );

    loadData();
    alert('Medical Equipment state submitted to MOIC.');
  };

  const handleMoicReviewApprove = async () => {
    const nowIso = new Date().toISOString();
    const appr = await db.sectionApprovals.where('section').equals('med_store_equipment').first();
    if (appr) {
      const updatedAppr = {
        ...appr,
        status: 'MOIC_APPROVED' as const,
        intermediateAppointment: currentUser.appointmentTitle,
        intermediateDecision: 'APPROVED' as const,
        intermediateRemarks: 'Verified electro-medical calibration and maintenance logs.',
        intermediateDecidedAt: nowIso
      };
      await db.sectionApprovals.update(appr.id, updatedAppr);
      await syncEntityToCloud('sectionApprovals', appr.id, updatedAppr);
    }

    await logAuditEvent(
      currentUser,
      'MOIC_APPROVED',
      'med_store_equipment',
      'EQUIPMENT_STATE',
      'MOIC approved Medical Equipment state. Forwarded to CO.'
    );

    loadData();
    alert('MOIC review complete. Forwarded to Commanding Officer for final approval.');
  };

  // CO Command Approval (WITHOUT Locking)
  const handleCoFinalApprove = async () => {
    const nowIso = new Date().toISOString();
    const appr = await db.sectionApprovals.where('section').equals('med_store_equipment').first();
    if (appr) {
      const updatedAppr = {
        ...appr,
        status: 'CO_APPROVED' as const,
        coAppointment: currentUser.appointmentTitle,
        coDecision: 'FINAL_APPROVED' as const,
        coRemarks: 'Commanding Officer approval granted. Equipment register remains active & editable.',
        coDecidedAt: nowIso
      };
      await db.sectionApprovals.update(appr.id, updatedAppr);
      await syncEntityToCloud('sectionApprovals', appr.id, updatedAppr);
    }

    await logAuditEvent(
      currentUser,
      'CO_APPROVED',
      'med_store_equipment',
      'EQUIPMENT_STATE',
      'Commanding Officer approved Medical Equipment register.'
    );

    loadData();
    alert('COMMAND APPROVAL GRANTED: Medical Equipment register approved by Commanding Officer.');
  };

  const totalHeld = equipmentList.reduce((sum, e) => sum + e.heldQuantity, 0);
  const totalSvc = equipmentList.filter(e => e.currentStatus === 'SERVICEABLE').reduce((sum, e) => sum + e.heldQuantity, 0);
  const serviceabilityRate = totalHeld > 0 ? ((totalSvc / totalHeld) * 100).toFixed(1) : '100.0';

  const filteredEquipment = equipmentList.filter(e =>
    e.equipmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.makeModel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canEdit = currentUser.role === 'inst_equip_operator' || currentUser.role === 'moic' || currentUser.role === 'co' || currentUser.role === '2ic' || currentUser.role === 'other_operator' || currentUser.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Read-Only Notice Banner for non-concerned personnel */}
      {!canEdit && (
        <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>Read-Only View Mode:</strong> You are logged in as <strong>{currentUser.appointmentTitle}</strong>. Electro-medical equipment state modifications are restricted to Instruments & Equipment Operator, MOIC & CO.
            </span>
          </div>
          <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded font-bold">
            VIEW ONLY
          </span>
        </div>
      )}

      {/* Sub-Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white uppercase tracking-wide">
              {t('sub_equipment')} (Electro-Medical & Life Support)
            </h3>
            <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
              95 FD AMB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Serviceability Rate: <strong className="text-emerald-600 font-mono">{serviceabilityRate}%</strong> | MOIC Review → CO Final Approval.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {approvalRecord && <StatusBadge status={approvalRecord.status} />}

          {canEdit && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#F59E0B]" />
              <span>Add Equipment</span>
            </button>
          )}

          {canEdit && approvalRecord?.status === 'DRAFT' && (
            <button
              type="button"
              onClick={handleSubmitToMoic}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit to MOIC</span>
            </button>
          )}

          {approvalRecord?.status === 'PENDING_MOIC' && (currentUser.role === 'moic' || currentUser.role === 'admin') && (
            <button
              type="button"
              onClick={handleMoicReviewApprove}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>MOIC Approve & Forward to CO</span>
            </button>
          )}

          {(currentUser.role === 'co' || currentUser.role === 'admin') && (
            <button
              type="button"
              onClick={handleCoFinalApprove}
              className="px-3.5 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-black font-extrabold text-xs shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>CO Command Approval</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#1E3316] text-white uppercase text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">Equipment Name</th>
                <th className="py-3 px-4">Make / Model</th>
                <th className="py-3 px-4">Serial Number</th>
                <th className="py-3 px-4 text-center">Auth</th>
                <th className="py-3 px-4 text-center">Held / Current</th>
                <th className="py-3 px-4 text-center">Shortage/Excess</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Calibration Due</th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredEquipment.map((item) => {
                const diff = (item.heldQuantity || 0) - (item.authorizedQuantity || 0);
                return (
                  <tr key={item.id} className="hover:bg-[#F8F9F5] dark:hover:bg-slate-800/50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {item.equipmentName}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {item.makeModel}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {item.serialNumber}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {formatNumber(item.authorizedQuantity)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black text-slate-900 dark:text-white">
                      {formatNumber(item.heldQuantity)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black">
                      <span className={diff < 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={item.currentStatus} size="sm" />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {formatNumber(item.calibrationDueDate)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                      {item.remarks || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canEdit ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                            title="Edit Equipment"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEquipment(item)}
                            className="p-1.5 rounded bg-red-100 hover:bg-red-200 dark:bg-red-950/60 dark:hover:bg-red-900 text-red-700 dark:text-red-300 text-xs font-semibold cursor-pointer"
                            title="Delete / Archive Equipment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">View Only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Medical Equipment' : 'Add Medical Equipment'}
        subtitle="Electro-medical and life support equipment for 95 Fd Amb"
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Equipment Name *
              </label>
              <input
                type="text"
                value={eqName}
                onChange={(e) => setEqName(e.target.value)}
                placeholder="e.g. Transport Multiparameter Monitor"
                className="w-full px-3 py-2 border rounded-lg text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Make & Model
              </label>
              <input
                type="text"
                value={makeModel}
                onChange={(e) => setMakeModel(e.target.value)}
                placeholder="e.g. Mindray BeneVision N1"
                className="w-full px-3 py-2 border rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Serial Number *
              </label>
              <input
                type="text"
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Authorized Qty *
              </label>
              <input
                type="number"
                min="1"
                value={authQty}
                onChange={(e) => setAuthQty(Number(e.target.value))}
                className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono font-bold text-emerald-700"
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
                className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono font-bold text-blue-700"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Shortage / Excess
              </label>
              <input
                type="text"
                disabled
                value={heldQty - authQty > 0 ? `+${heldQty - authQty}` : `${heldQty - authQty}`}
                className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Current Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-2 py-1.5 border rounded-lg text-xs font-semibold"
              >
                <option value="SERVICEABLE">Serviceable</option>
                <option value="MAINTENANCE_DUE">Maintenance Due</option>
                <option value="CALIBRATION_DUE">Calibration Due</option>
                <option value="UNDER_REPAIR">Under Repair</option>
                <option value="UNSERVICEABLE">Unserviceable</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Next Maintenance Due *
              </label>
              <input
                type="date"
                value={nextMaint}
                onChange={(e) => setNextMaint(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Calibration Due Date *
              </label>
              <input
                type="date"
                value={calibDue}
                onChange={(e) => setCalibDue(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Battery tested, sensor calibrated..."
              className="w-full px-3 py-1.5 border rounded-lg text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg bg-slate-200 text-xs font-semibold cursor-pointer">
              {t('action_cancel')}
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow cursor-pointer">
              Save Equipment
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
          { name: 'Equipment Serviceability', label: 'Equipment Serviceability & Working Status', currentValue: `Total: ${equipmentList.length}` },
          { name: 'Calibration Schedule', label: 'Biomedical Engineering Calibration Dates', currentValue: 'BME Schedule' },
          { name: 'Under Maintenance', label: 'Unserviceable / Workshop Repair Registry', currentValue: `Unsvc: ${equipmentList.filter(e => e.currentStatus === 'UNSERVICEABLE').length}` }
        ]}
        onSuccess={() => loadData()}
      />
    </div>
  );
};
