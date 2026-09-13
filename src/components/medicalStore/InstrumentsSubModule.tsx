import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { MedicalInstrumentItem, SectionApprovalRecord } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { RequestCorrectionModal } from '../common/RequestCorrectionModal';
import { logAuditEvent } from '../../services/auditService';
import { syncEntityToCloud, deleteEntityFromCloud } from '../../services/firebaseSyncService';
import { 
  Scissors, Plus, Search, Filter, Download, 
  AlertTriangle, CheckCircle2, ShieldCheck, Wrench, Send, Edit3, Lock, Trash2 
} from 'lucide-react';

export const InstrumentsSubModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber } = useLanguage();

  const [instruments, setInstruments] = useState<MedicalInstrumentItem[]>([]);
  const [approvalRecord, setApprovalRecord] = useState<SectionApprovalRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Correction Request Modal State
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState<boolean>(false);
  const [correctionRecordTitle, setCorrectionRecordTitle] = useState<string>('Medical Store — Instruments Register');
  const [correctionField, setCorrectionField] = useState<string>('Holding vs Serviceability');
  const [correctionExistingVal, setCorrectionExistingVal] = useState<string>('');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MedicalInstrumentItem | null>(null);
  const [setName, setSetName] = useState<string>('');
  const [category, setCategory] = useState<string>('SURGICAL_SET');
  const [authQty, setAuthQty] = useState<number>(5);
  const [heldQty, setHeldQty] = useState<number>(4);
  const [svcQty, setSvcQty] = useState<number>(4);
  const [unsvcQty, setUnsvcQty] = useState<number>(0);
  const [repairQty, setRepairQty] = useState<number>(0);
  const [location, setLocation] = useState<string>('OT Sterile Storage');
  const [lastInsp, setLastInsp] = useState<string>('2026-08-01');
  const [nextInsp, setNextInsp] = useState<string>('2026-09-01');
  const [repairRef, setRepairRef] = useState<string>('');
  const [respAppt, setRespAppt] = useState<string>('OT NCO');
  const [remarks, setRemarks] = useState<string>('');

  const loadData = async () => {
    const list = await db.medicalInstruments.toArray();
    setInstruments(list);
    const appr = await db.sectionApprovals.where('section').equals('med_store_instruments').last();
    if (appr) setApprovalRecord(appr);
  };

  useEffect(() => {
    loadData();

    const handleCloudSync = (e: any) => {
      if (e.detail?.collection === 'medicalInstruments' || e.detail?.collection === 'sectionApprovals') {
        loadData();
      }
    };
    window.addEventListener('unit-ready-cloud-sync', handleCloudSync);
    return () => window.removeEventListener('unit-ready-cloud-sync', handleCloudSync);
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setSetName('');
    setCategory('SURGICAL_SET');
    setAuthQty(5);
    setHeldQty(4);
    setSvcQty(4);
    setUnsvcQty(0);
    setRepairQty(0);
    setLocation('OT Sterile Storage');
    setLastInsp('2026-08-01');
    setNextInsp('2026-09-01');
    setRepairRef('');
    setRespAppt('OT NCO');
    setRemarks('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: MedicalInstrumentItem) => {
    setEditingItem(item);
    setSetName(item.instrumentSetName);
    setCategory(item.category);
    setAuthQty(item.authorizedQty);
    setHeldQty(item.heldQty);
    setSvcQty(item.serviceableQty);
    setUnsvcQty(item.unserviceableQty);
    setRepairQty(item.underRepairQty);
    setLocation(item.location);
    setLastInsp(item.lastInspectionDate);
    setNextInsp(item.nextInspectionDueDate);
    setRepairRef(item.repairReference || '');
    setRespAppt(item.responsibleAppointment);
    setRemarks(item.remarks || '');
    setIsModalOpen(true);
  };

  const handleDeleteInstrument = async (item: MedicalInstrumentItem) => {
    const confirm = window.confirm(`Are you sure you want to delete "${item.instrumentSetName}"?`);
    if (!confirm) return;

    await db.medicalInstruments.delete(item.id);
    await deleteEntityFromCloud('medicalInstruments', item.id);

    await logAuditEvent(
      currentUser,
      'RECORD_DELETED',
      'med_store_instruments',
      item.instrumentSetName,
      `Archived instrument set: ${item.instrumentSetName}`
    );

    loadData();
    alert(`Instrument set "${item.instrumentSetName}" deleted.`);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setName.trim()) return;

    // Strict Holding Equation Validation: Held = Serviceable + Unserviceable + UnderRepair
    const sumComponents = Number(svcQty) + Number(unsvcQty) + Number(repairQty);
    if (sumComponents !== Number(heldQty)) {
      alert(`VALIDATION ERROR: Held quantity (${heldQty}) must strictly equal Serviceable (${svcQty}) + Unserviceable (${unsvcQty}) + Under Repair (${repairQty}) = ${sumComponents}`);
      return;
    }

    const shortage = Number(heldQty) - Number(authQty);

    if (editingItem) {
      const updated: MedicalInstrumentItem = {
        ...editingItem,
        instrumentSetName: setName.trim(),
        category,
        authorizedQty: Number(authQty),
        heldQty: Number(heldQty),
        shortageOrExcess: shortage,
        serviceableQty: Number(svcQty),
        unserviceableQty: Number(unsvcQty),
        underRepairQty: Number(repairQty),
        location,
        lastInspectionDate: lastInsp,
        nextInspectionDueDate: nextInsp,
        repairReference: repairRef,
        responsibleAppointment: respAppt,
        remarks,
        updatedAt: new Date().toISOString()
      };
      await db.medicalInstruments.put(updated);
      await syncEntityToCloud('medicalInstruments', updated.id, updated);
      await logAuditEvent(currentUser, 'DRAFT_SAVED', 'med_store_instruments', updated.instrumentSetName, `Updated instrument set: ${updated.instrumentSetName}`);
    } else {
      const newItem: MedicalInstrumentItem = {
        id: 'inst-' + Date.now(),
        instrumentSetName: setName.trim(),
        category,
        authorizedQty: Number(authQty),
        heldQty: Number(heldQty),
        shortageOrExcess: shortage,
        serviceableQty: Number(svcQty),
        unserviceableQty: Number(unsvcQty),
        underRepairQty: Number(repairQty),
        location,
        lastInspectionDate: lastInsp,
        nextInspectionDueDate: nextInsp,
        repairReference: repairRef,
        responsibleAppointment: respAppt,
        remarks,
        updatedAt: new Date().toISOString()
      };
      await db.medicalInstruments.add(newItem);
      await syncEntityToCloud('medicalInstruments', newItem.id, newItem);
      await logAuditEvent(currentUser, 'DRAFT_SAVED', 'med_store_instruments', newItem.instrumentSetName, `Added new instrument set: ${newItem.instrumentSetName}`);
    }

    setIsModalOpen(false);
    loadData();
  };

  const handleSubmitToMoic = async () => {
    const nowIso = new Date().toISOString();
    const appr = await db.sectionApprovals.where('section').equals('med_store_instruments').first();
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
      'med_store_instruments',
      'INSTRUMENTS_STATE',
      'Submitted Medical Instruments state to MOIC for verification.'
    );

    loadData();
    alert('Medical Instruments state submitted to MOIC.');
  };

  const handleMoicReviewApprove = async () => {
    const nowIso = new Date().toISOString();
    const appr = await db.sectionApprovals.where('section').equals('med_store_instruments').first();
    if (appr) {
      const updatedAppr = {
        ...appr,
        status: 'MOIC_APPROVED' as const,
        intermediateAppointment: currentUser.appointmentTitle,
        intermediateDecision: 'APPROVED' as const,
        intermediateRemarks: 'Verified sterilization logs and set completeness.',
        intermediateDecidedAt: nowIso
      };
      await db.sectionApprovals.update(appr.id, updatedAppr);
      await syncEntityToCloud('sectionApprovals', appr.id, updatedAppr);
    }

    await logAuditEvent(
      currentUser,
      'MOIC_APPROVED',
      'med_store_instruments',
      'INSTRUMENTS_STATE',
      'MOIC approved Medical Instruments state. Forwarded to CO.'
    );

    loadData();
    alert('MOIC verification complete. Forwarded to Commanding Officer.');
  };

  // CO Command Approval (WITHOUT Locking)
  const handleCoFinalApprove = async () => {
    const nowIso = new Date().toISOString();
    const appr = await db.sectionApprovals.where('section').equals('med_store_instruments').first();
    if (appr) {
      const updatedAppr = {
        ...appr,
        status: 'CO_APPROVED' as const,
        coAppointment: currentUser.appointmentTitle,
        coDecision: 'FINAL_APPROVED' as const,
        coRemarks: 'Commanding Officer approval granted. Records remain editable by authorized personnel.',
        coDecidedAt: nowIso
      };
      await db.sectionApprovals.update(appr.id, updatedAppr);
      await syncEntityToCloud('sectionApprovals', appr.id, updatedAppr);
    }

    await logAuditEvent(
      currentUser,
      'CO_APPROVED',
      'med_store_instruments',
      'INSTRUMENTS_STATE',
      'Commanding Officer approved Medical Instruments register.'
    );

    loadData();
    alert('COMMAND APPROVAL GRANTED: Medical Instruments register approved by Commanding Officer.');
  };

  const filteredInstruments = instruments.filter(i => 
    i.instrumentSetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.responsibleAppointment.toLowerCase().includes(searchQuery.toLowerCase())
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
              <strong>Read-Only View Mode:</strong> You are logged in as <strong>{currentUser.appointmentTitle}</strong>. Instrument set modifications are restricted to Instruments & Equipment Operator, MOIC & CO.
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
            <Scissors className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white uppercase tracking-wide">
              {t('sub_instruments')} (Authorized Qty & Holding Equation)
            </h3>
            <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
              95 FD AMB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Holding Equation: Held = Serviceable + Unserviceable + Under Repair | MOIC Review → CO Final Approval.
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
              <span>Add Instrument Set</span>
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
                <th className="py-3 px-4">Instrument / Set Name</th>
                <th className="py-3 px-4 text-center">Auth</th>
                <th className="py-3 px-4 text-center">Held / Current</th>
                <th className="py-3 px-4 text-center">Shortage/Excess</th>
                <th className="py-3 px-4 text-center">Serviceable</th>
                <th className="py-3 px-4 text-center">Under Repair</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredInstruments.map((item) => {
                const diff = (item.heldQty || 0) - (item.authorizedQty || 0);
                return (
                  <tr key={item.id} className="hover:bg-[#F8F9F5] dark:hover:bg-slate-800/50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {item.instrumentSetName}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {formatNumber(item.authorizedQty)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black text-slate-900 dark:text-white">
                      {formatNumber(item.heldQty)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black">
                      <span className={diff < 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                      {formatNumber(item.serviceableQty)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-amber-700 dark:text-amber-400">
                      {formatNumber(item.underRepairQty)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {item.location}
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
                            title="Edit Set"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteInstrument(item)}
                            className="p-1.5 rounded bg-red-100 hover:bg-red-200 dark:bg-red-950/60 dark:hover:bg-red-900 text-red-700 dark:text-red-300 text-xs font-semibold cursor-pointer"
                            title="Delete / Archive Set"
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
        title={editingItem ? 'Edit Medical Instrument Set' : 'Add Medical Instrument Set'}
        subtitle="Enforces: Held = Serviceable + Unserviceable + Under Repair"
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Instrument Set Name *
            </label>
            <input
              type="text"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              placeholder="e.g. Major Surgical Set (General)"
              className="w-full px-3 py-2 border rounded-lg text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Authorized Qty *</label>
              <input type="number" min="0" value={authQty} onChange={(e) => setAuthQty(Number(e.target.value))} className="w-full px-2 py-1.5 border rounded text-xs font-mono font-bold text-emerald-700" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Held / Current Qty *</label>
              <input type="number" min="0" value={heldQty} onChange={(e) => setHeldQty(Number(e.target.value))} className="w-full px-2 py-1.5 border rounded text-xs font-mono font-bold text-blue-700" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Shortage / Excess</label>
              <input type="text" disabled value={heldQty - authQty > 0 ? `+${heldQty - authQty}` : `${heldQty - authQty}`} className="w-full px-2 py-1.5 border rounded text-xs font-mono font-bold bg-slate-100 text-slate-700" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Serviceable</label>
              <input type="number" min="0" value={svcQty} onChange={(e) => setSvcQty(Number(e.target.value))} className="w-full px-2 py-1.5 border rounded text-xs text-emerald-700 font-bold" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Unserviceable</label>
              <input type="number" min="0" value={unsvcQty} onChange={(e) => setUnsvcQty(Number(e.target.value))} className="w-full px-2 py-1.5 border rounded text-xs text-red-600 font-bold" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Under Repair</label>
              <input type="number" min="0" value={repairQty} onChange={(e) => setRepairQty(Number(e.target.value))} className="w-full px-2 py-1.5 border rounded text-xs text-amber-600 font-bold" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Remarks</label>
            <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks / sterilization status..." className="w-full px-3 py-1.5 border rounded-lg text-xs" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg bg-slate-200 text-xs font-semibold cursor-pointer">
              {t('action_cancel')}
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow cursor-pointer">
              Save Instrument Set
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
          { name: 'Instrument Serviceability', label: 'Instrument Sets Serviceability Equation', currentValue: `Total Sets: ${instruments.length}` },
          { name: 'Under Repair Sets', label: 'Sets Under Repair / Maintenance', currentValue: `Repair: ${instruments.reduce((s, i) => s + (i.underRepairQty || 0), 0)}` },
          { name: 'Location & Sterility', label: 'Sterile Storage Location & Inspection', currentValue: 'OT Sterile Storage' }
        ]}
        onSuccess={() => loadData()}
      />
    </div>
  );
};
