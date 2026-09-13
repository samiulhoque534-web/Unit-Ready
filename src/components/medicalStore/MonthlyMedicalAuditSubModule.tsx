import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { MonthlyMedicalAuditReport, MonthlyMedicalAuditItem } from '../../types';
import { Modal } from '../common/Modal';
import { StatusBadge } from '../common/StatusBadge';
import { RequestCorrectionModal } from '../common/RequestCorrectionModal';
import { logAuditEvent } from '../../services/auditService';
import { exportTableToExcel } from '../../services/excelService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  ClipboardCheck, Plus, Calendar, Download, 
  Printer, Send, CheckCircle2, AlertTriangle, 
  Eye, Edit3, Lock, RefreshCw, FileText 
} from 'lucide-react';

export const MonthlyMedicalAuditSubModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber } = useLanguage();

  const [audits, setAudits] = useState<MonthlyMedicalAuditReport[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<MonthlyMedicalAuditReport | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);

  // Correction Request Modal State
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState<boolean>(false);
  const [correctionRecordTitle, setCorrectionRecordTitle] = useState<string>('Monthly Medical Stock-Taking Report');
  const [correctionField, setCorrectionField] = useState<string>('Physical Count vs System Quantity');
  const [correctionExistingVal, setCorrectionExistingVal] = useState<string>('');

  // Create Audit form states
  const currentMonthYear = new Date().toISOString().substring(0, 7); // YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthYear);
  const [auditItems, setAuditItems] = useState<MonthlyMedicalAuditItem[]>([]);

  // Editing state for active draft audit
  const [editingAudit, setEditingAudit] = useState<MonthlyMedicalAuditReport | null>(null);

  const loadAudits = async () => {
    const list = await db.monthlyMedicalAudits.toArray();
    setAudits(list.sort((a, b) => b.auditMonth.localeCompare(a.auditMonth)));
  };

  useEffect(() => {
    loadAudits();
  }, []);

  const handleInitCreate = async () => {
    // Compile system snapshot from medicines, instruments, and equipment
    const meds = await db.medicines.toArray();
    const batches = await db.medicineBatches.toArray();
    const insts = await db.medicalInstruments.toArray();
    const equips = await db.medicalEquipment.toArray();

    const items: MonthlyMedicalAuditItem[] = [];

    // 1. Medicines
    meds.forEach(m => {
      const b = batches.find(batch => batch.medicineId === m.id);
      items.push({
        id: 'aud-med-' + m.id,
        itemType: 'MEDICINE',
        name: m.genericName + (m.brandName ? ` (${m.brandName})` : ''),
        specOrModel: m.strength + ' ' + m.dosageForm,
        batchOrSerial: b ? b.batchNumber : 'N/A',
        expiryDate: m.expiryDate,
        expiryCategory: b ? b.status : undefined,
        authorizedQty: m.authorizedQuantity || 0,
        systemQty: m.currentQuantity || 0,
        physicalQty: m.currentQuantity || 0,
        variance: 0,
        remarks: 'Physical stock matched'
      });
    });

    // 2. Instruments
    insts.forEach(inst => {
      items.push({
        id: 'aud-inst-' + inst.id,
        itemType: 'INSTRUMENT',
        name: inst.instrumentSetName,
        specOrModel: inst.category,
        batchOrSerial: inst.location,
        authorizedQty: inst.authorizedQty || 0,
        systemQty: inst.heldQty || 0,
        physicalQty: inst.heldQty || 0,
        variance: 0,
        remarks: 'Physical count verified'
      });
    });

    // 3. Equipment
    equips.forEach(eq => {
      items.push({
        id: 'aud-eq-' + eq.id,
        itemType: 'EQUIPMENT',
        name: eq.equipmentName,
        specOrModel: eq.makeModel,
        batchOrSerial: eq.serialNumber,
        authorizedQty: eq.authorizedQuantity || 0,
        systemQty: eq.heldQuantity || 0,
        physicalQty: eq.heldQuantity || 0,
        variance: 0,
        remarks: `Status: ${eq.currentStatus}`
      });
    });

    setAuditItems(items);
    setIsCreateModalOpen(true);
  };

  const handlePhysicalQtyChange = (itemId: string, val: number) => {
    setAuditItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const variance = val - item.systemQty;
        return {
          ...item,
          physicalQty: val,
          variance,
          remarks: variance === 0 ? 'Physical count matched' : (variance > 0 ? `Excess +${variance}` : `Shortage ${variance}`)
        };
      }
      return item;
    }));
  };

  const handleItemRemarksChange = (itemId: string, rem: string) => {
    setAuditItems(prev => prev.map(item => item.id === itemId ? { ...item, remarks: rem } : item));
  };

  const handleSaveAuditDraft = async () => {
    const totalVariances = auditItems.filter(i => i.variance !== 0).length;
    const refNo = `AUDIT/95FA/MED/${selectedMonth.replace('-', '/')}-CONSOL`;

    const newAudit: MonthlyMedicalAuditReport = {
      id: 'audit-' + selectedMonth,
      auditMonth: selectedMonth,
      auditDate: new Date().toISOString().substring(0, 10),
      reportReference: refNo,
      items: auditItems,
      totalMedicineItems: auditItems.filter(i => i.itemType === 'MEDICINE').length,
      totalInstrumentItems: auditItems.filter(i => i.itemType === 'INSTRUMENT').length,
      totalEquipmentItems: auditItems.filter(i => i.itemType === 'EQUIPMENT').length,
      totalVariancesDetected: totalVariances,
      status: 'DRAFT',
      preparedByAppointment: currentUser.appointmentTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.monthlyMedicalAudits.put(newAudit);
    await logAuditEvent(
      currentUser,
      'MONTHLY_AUDIT_SAVED',
      'med_store_medicine',
      newAudit.reportReference,
      `Saved Consolidated Monthly Medical Audit draft for ${selectedMonth}. Items: ${auditItems.length}, Variances: ${totalVariances}`
    );

    setIsCreateModalOpen(false);
    loadAudits();
    alert('Consolidated Monthly Medical Audit saved as Draft.');
  };

  const handleSubmitToMoic = async (audit: MonthlyMedicalAuditReport) => {
    const nowIso = new Date().toISOString();
    await db.monthlyMedicalAudits.update(audit.id, {
      status: 'PENDING_MOIC',
      submittedAt: nowIso,
      updatedAt: nowIso
    });

    await logAuditEvent(
      currentUser,
      'MONTHLY_AUDIT_SUBMITTED',
      'med_store_medicine',
      audit.reportReference,
      `Submitted Monthly Medical Audit for ${audit.auditMonth} to MOIC for clinical & stock verification.`
    );

    loadAudits();
    alert('Monthly Medical Audit submitted to MOIC.');
  };

  const handleMoicApprove = async (audit: MonthlyMedicalAuditReport) => {
    const nowIso = new Date().toISOString();
    await db.monthlyMedicalAudits.update(audit.id, {
      status: 'MOIC_APPROVED',
      moicAppointment: currentUser.appointmentTitle,
      moicDecision: 'APPROVED',
      moicRemarks: 'Verified all physical stock counts, variances, and expiry statuses.',
      moicDecidedAt: nowIso,
      updatedAt: nowIso
    });

    await logAuditEvent(
      currentUser,
      'MOIC_APPROVED',
      'med_store_medicine',
      audit.reportReference,
      `MOIC approved Monthly Medical Audit for ${audit.auditMonth}. Forwarded to CO for final approval.`
    );

    loadAudits();
    alert('Approved by MOIC. Forwarded to Commanding Officer for final approval.');
  };

  const handleCoFinalApprove = async (audit: MonthlyMedicalAuditReport) => {
    const nowIso = new Date().toISOString();
    await db.monthlyMedicalAudits.update(audit.id, {
      status: 'CO_APPROVED',
      coAppointment: currentUser.appointmentTitle,
      coDecision: 'FINAL_APPROVED',
      coRemarks: 'Commanding Officer final approval granted. Register locked.',
      coDecidedAt: nowIso,
      lockedAt: nowIso,
      updatedAt: nowIso
    });

    await logAuditEvent(
      currentUser,
      'MONTHLY_AUDIT_APPROVED',
      'med_store_medicine',
      audit.reportReference,
      `Commanding Officer approved and locked Monthly Medical Stock-Taking Audit for ${audit.auditMonth}.`
    );

    loadAudits();
    alert('FINAL APPROVAL GRANTED: Monthly Medical Audit is now officially approved and locked.');
  };

  const generateAuditPdf = (audit: MonthlyMedicalAuditReport) => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('HEADQUARTERS, 95 FIELD AMBULANCE', 105, 15, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`CONSOLIDATED MONTHLY MEDICAL STOCK-TAKING AUDIT — ${audit.auditMonth}`, 105, 22, { align: 'center' });

    doc.setFontSize(8);
    doc.text(`Reference: ${audit.reportReference} | Status: ${audit.status} | Date: ${audit.auditDate}`, 105, 28, { align: 'center' });

    const rows = audit.items.map(item => [
      item.itemType,
      item.name,
      item.specOrModel,
      item.batchOrSerial,
      item.expiryDate || '—',
      item.authorizedQty,
      item.systemQty,
      item.physicalQty,
      item.variance === 0 ? '0' : (item.variance > 0 ? `+${item.variance}` : `${item.variance}`),
      item.remarks || '—'
    ]);

    autoTable(doc, {
      startY: 34,
      head: [['Type', 'Item Name', 'Spec / Model', 'Batch / Serial', 'Expiry Date', 'Auth', 'System', 'Physical', 'Variance', 'Remarks']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [45, 74, 34], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(8);
    doc.text(`Prepared By: ${audit.preparedByAppointment}`, 20, finalY);
    doc.text(`Reviewed By: ${audit.moicAppointment || '[ PENDING MOIC ]'}`, 85, finalY);
    doc.text(`Approved By: ${audit.coAppointment || '[ PENDING CO ]'}`, 150, finalY);

    doc.save(`95FA_Monthly_Medical_Audit_${audit.auditMonth}.pdf`);
    logAuditEvent(currentUser, 'PDF_GENERATED', 'med_store_medicine', audit.reportReference, 'Generated Monthly Medical Audit PDF');
  };

  const exportAuditExcel = (audit: MonthlyMedicalAuditReport) => {
    const data = audit.items.map(item => ({
      'Unit': '95 Fd Amb',
      'Audit Month': audit.auditMonth,
      'Item Type': item.itemType,
      'Item Name': item.name,
      'Specification / Model': item.specOrModel,
      'Batch / Serial': item.batchOrSerial,
      'Expiry Date': item.expiryDate || 'N/A',
      'Authorized Qty': item.authorizedQty,
      'System Qty': item.systemQty,
      'Physical Qty': item.physicalQty,
      'Variance': item.variance,
      'Remarks': item.remarks || ''
    }));
    exportTableToExcel(data, `95FA_Monthly_Medical_Audit_${audit.auditMonth}`);
    logAuditEvent(currentUser, 'EXCEL_EXPORTED', 'med_store_medicine', audit.reportReference, 'Exported Monthly Medical Audit Excel');
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              {t('sub_monthlyAudit')} (Stock-Taking & Physical Reconciliation)
            </h2>
            <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
              95 FD AMB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Single Consolidated Medical Audit: Medicine + Instrument + Equipment with MOIC Review & CO Final Approval
          </p>
        </div>

        {(currentUser.role === 'medicine_operator' || currentUser.role === 'inst_equip_operator' || currentUser.role === 'admin' || currentUser.role === 'moic') && (
          <button
            onClick={handleInitCreate}
            className="px-3.5 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Monthly Stock-Taking Audit</span>
          </button>
        )}
      </div>

      {/* Audits Register */}
      <div className="space-y-4">
        {audits.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-8 rounded-xl text-center border border-dashed border-slate-300 dark:border-slate-700">
            <ClipboardCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">No Monthly Audits Recorded</h3>
            <p className="text-xs text-slate-500 mt-1">
              Click above to initialize the consolidated monthly stock-taking audit for 95 Fd Amb.
            </p>
          </div>
        ) : (
          audits.map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 hover:border-[#3B5E2B] transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
                      {a.reportReference}
                    </span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      Month: {a.auditMonth}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Audit Date: {a.auditDate}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Prepared by <strong className="text-slate-700 dark:text-slate-300">{a.preparedByAppointment}</strong>
                    {a.moicAppointment && ` | Verified by ${a.moicAppointment}`}
                    {a.coAppointment && ` | Approved by ${a.coAppointment}`}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>

              {/* KPI Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#F8F9F5] dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 font-mono">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block font-sans">Medicine Items</span>
                  <strong className="text-slate-800 dark:text-white">{a.totalMedicineItems} Items</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block font-sans">Instruments</span>
                  <strong className="text-slate-800 dark:text-white">{a.totalInstrumentItems} Sets</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block font-sans">Equipment</span>
                  <strong className="text-slate-800 dark:text-white">{a.totalEquipmentItems} Units</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block font-sans">Discrepancies</span>
                  <strong className={a.totalVariancesDetected > 0 ? 'text-red-600 font-black' : 'text-emerald-600 font-black'}>
                    {a.totalVariancesDetected} Variances
                  </strong>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="text-[11px] text-slate-500 font-mono">
                  {a.status === 'CO_APPROVED' && (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Official Locked Record — Corrections Require Formal Request</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedAudit(a);
                      setIsViewModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Audit</span>
                  </button>

                  <button
                    onClick={() => exportAuditExcel(a)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition flex items-center gap-1 shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>XLSX</span>
                  </button>

                  <button
                    onClick={() => generateAuditPdf(a)}
                    className="px-3 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white font-bold transition flex items-center gap-1 shadow"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>

                  {/* Submit to MOIC */}
                  {a.status === 'DRAFT' && (
                    <button
                      onClick={() => handleSubmitToMoic(a)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1 shadow"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit to MOIC</span>
                    </button>
                  )}

                  {/* MOIC Review & Approve */}
                  {a.status === 'PENDING_MOIC' && (currentUser.role === 'moic' || currentUser.role === 'admin') && (
                    <button
                      onClick={() => handleMoicApprove(a)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1 shadow"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>MOIC Approve & Forward to CO</span>
                    </button>
                  )}

                  {/* CO Final Approval */}
                  {a.status === 'MOIC_APPROVED' && (currentUser.role === 'co' || currentUser.role === 'admin') && (
                    <button
                      onClick={() => handleCoFinalApprove(a)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-black font-extrabold transition shadow flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>CO Final Approval & Lock</span>
                    </button>
                  )}

                  {/* Request Correction Button when CO Approved */}
                  {a.status === 'CO_APPROVED' && (currentUser.role === 'medicine_operator' || currentUser.role === 'inst_equip_operator' || currentUser.role === 'moic' || currentUser.role === 'co' || currentUser.role === 'admin') && (
                    <button
                      onClick={() => {
                        setCorrectionRecordTitle(`Monthly Medical Stock-Taking Audit (${a.auditMonth})`);
                        setCorrectionField('Physical Stock Reconciliation & Variance Count');
                        setCorrectionExistingVal(`Items: ${a.items.length}, Variances: ${a.totalVariancesDetected}`);
                        setIsCorrectionModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-[#F59E0B] font-extrabold text-xs shadow border border-[#F59E0B]/40 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Request Correction</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Monthly Audit Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Consolidated Monthly Medical Stock-Taking Audit"
        subtitle="Medicine, Instruments & Equipment Physical Reconciliation"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Audit Target Month:
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
            />
          </div>

          <div className="overflow-x-auto max-h-96 border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#1E3316] text-white uppercase text-[10px] font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Item Nomenclature</th>
                  <th className="py-2.5 px-3">Spec / Batch / Serial</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3 text-center">Auth</th>
                  <th className="py-2.5 px-3 text-center">System</th>
                  <th className="py-2.5 px-3 text-center">Physical Qty *</th>
                  <th className="py-2.5 px-3 text-center">Variance</th>
                  <th className="py-2.5 px-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                {auditItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-3 font-mono font-bold text-[10px] text-slate-500">
                      {item.itemType}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                      {item.name}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {item.batchOrSerial}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {item.expiryDate || '—'}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold">
                      {item.authorizedQty}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {item.systemQty}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min="0"
                        value={item.physicalQty}
                        onChange={(e) => handlePhysicalQtyChange(item.id, Number(e.target.value))}
                        className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs"
                      />
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-black">
                      <span className={item.variance === 0 ? 'text-emerald-600' : (item.variance > 0 ? 'text-blue-600' : 'text-red-600')}>
                        {item.variance === 0 ? '0' : (item.variance > 0 ? `+${item.variance}` : item.variance)}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={item.remarks}
                        onChange={(e) => handleItemRemarksChange(item.id, e.target.value)}
                        placeholder="Remarks..."
                        className="w-36 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold"
            >
              {t('action_cancel')}
            </button>
            <button
              onClick={handleSaveAuditDraft}
              className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow"
            >
              Save Consolidated Audit Draft
            </button>
          </div>
        </div>
      </Modal>

      {/* View Audit Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Monthly Medical Stock-Taking Audit (${selectedAudit?.auditMonth})`}
        subtitle={`Ref: ${selectedAudit?.reportReference} | 95 Fd Amb`}
      >
        <div className="space-y-4 font-sans text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-slate-500 font-bold uppercase text-[10px] block">Audit Month:</span>
              <strong className="text-slate-800 dark:text-white font-mono">{selectedAudit?.auditMonth}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-bold uppercase text-[10px] block">Status:</span>
              <StatusBadge status={selectedAudit?.status || 'DRAFT'} size="sm" />
            </div>
            <div>
              <span className="text-slate-500 font-bold uppercase text-[10px] block">Prepared By:</span>
              <strong className="text-slate-800 dark:text-slate-200">{selectedAudit?.preparedByAppointment}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-bold uppercase text-[10px] block">Variances Detected:</span>
              <strong className={selectedAudit?.totalVariancesDetected ? 'text-red-600 font-black' : 'text-emerald-600 font-black'}>
                {selectedAudit?.totalVariancesDetected || 0}
              </strong>
            </div>
          </div>

          <div className="overflow-x-auto max-h-80 border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#1E3316] text-white uppercase text-[10px] font-semibold sticky top-0">
                <tr>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Item Name</th>
                  <th className="py-2 px-3">Spec / Batch</th>
                  <th className="py-2 px-3">Expiry Date</th>
                  <th className="py-2 px-3 text-center">Auth</th>
                  <th className="py-2 px-3 text-center">System</th>
                  <th className="py-2 px-3 text-center">Physical</th>
                  <th className="py-2 px-3 text-center">Variance</th>
                  <th className="py-2 px-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {selectedAudit?.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-3 font-mono font-bold text-[10px] text-slate-500">{item.itemType}</td>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{item.name}</td>
                    <td className="py-2 px-3 font-mono text-[11px]">{item.batchOrSerial}</td>
                    <td className="py-2 px-3 font-mono text-[11px]">{item.expiryDate || '—'}</td>
                    <td className="py-2 px-3 text-center font-mono font-bold">{item.authorizedQty}</td>
                    <td className="py-2 px-3 text-center font-mono font-bold">{item.systemQty}</td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400">{item.physicalQty}</td>
                    <td className="py-2 px-3 text-center font-mono font-black">
                      <span className={item.variance === 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {item.variance === 0 ? '0' : (item.variance > 0 ? `+${item.variance}` : item.variance)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{item.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            {selectedAudit && (
              <>
                <button
                  onClick={() => exportAuditExcel(selectedAudit)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>XLSX</span>
                </button>
                <button
                  onClick={() => generateAuditPdf(selectedAudit)}
                  className="px-3 py-1.5 rounded-lg bg-[#2D4A22] text-white font-bold text-xs flex items-center gap-1 shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              </>
            )}
            <button
              onClick={() => setIsViewModalOpen(false)}
              className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Request Correction Modal */}
      <RequestCorrectionModal
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        recordTypeOrDate={correctionRecordTitle}
        initialField={correctionField}
        initialExistingValue={correctionExistingVal}
        availableFields={[
          { name: 'Physical Inventory Count', label: 'Physical Reconciliation Count', currentValue: 'Audit Count' },
          { name: 'Variance Explanation', label: 'Surplus / Deficiency Variance Remarks', currentValue: 'Stock Count Verification' },
          { name: 'Discrepancy Correction', label: 'Stock Register Discrepancy Adjustment', currentValue: 'Reconciled Stock' }
        ]}
        onSuccess={() => loadAudits()}
      />
    </div>
  );
};
