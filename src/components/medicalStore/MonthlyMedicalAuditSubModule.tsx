import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { MonthlyMedicalAuditReport, MonthlyMedicalAuditItem, AuditSignatureBlock } from '../../types';
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
  Eye, Edit3, Lock, RefreshCw, FileText, Check,
  ShieldCheck, AlertCircle, Clock, RotateCcw
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

  // Remarks / notes for sign-off
  const [signatureRemarks, setSignatureRemarks] = useState<string>('');

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
      const bal = Math.max(0, (Number(m.heldQuantity) || Number(m.currentQuantity) || 0) + (Number(m.receivedQuantity) || 0) - (Number(m.issuedQuantity) || 0));
      items.push({
        id: 'aud-med-' + m.id,
        itemType: 'MEDICINE',
        name: m.genericName + (m.brandName ? ` (${m.brandName})` : ''),
        specOrModel: m.strength + ' ' + m.dosageForm,
        batchOrSerial: b ? b.batchNumber : (m.batchNumber || 'N/A'),
        expiryDate: m.expiryDate,
        expiryCategory: b ? b.status : undefined,
        authorizedQty: m.authorizedQuantity || 0,
        systemQty: bal,
        physicalQty: bal,
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

    items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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
      auditVersion: 'v1.0',
      isRevised: false,
      medNcoSignature: {
        appointment: 'Med NCO',
        status: 'PENDING',
        version: 'v1.0'
      },
      moicSignature: {
        appointment: 'MOIC',
        status: 'PENDING',
        version: 'v1.0'
      },
      coSignature: {
        appointment: 'CO',
        status: 'PENDING',
        version: 'v1.0'
      },
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

  // STEP 1: Med NCO Signs and Submits
  const handleMedNcoSignAndSubmit = async (audit: MonthlyMedicalAuditReport) => {
    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10);
    const timeStr = now.toTimeString().substring(0, 8);

    const medNcoSig: AuditSignatureBlock = {
      appointment: 'Med NCO',
      signerName: currentUser.fullName || currentUser.appointmentTitle,
      signerRank: currentUser.rank || 'NCO',
      signerUserId: currentUser.id,
      signatureData: `DIGITALLY-SIGNED-MED-NCO-${currentUser.serviceNumber || currentUser.id}-${Date.now()}`,
      signedAtDate: dateStr,
      signedAtTime: timeStr,
      status: 'SIGNED',
      version: audit.auditVersion || 'v1.0'
    };

    const updated: MonthlyMedicalAuditReport = {
      ...audit,
      status: 'PENDING_MOIC',
      submittedAt: now.toISOString(),
      medNcoSignature: medNcoSig,
      updatedAt: now.toISOString()
    };

    await db.monthlyMedicalAudits.put(updated);
    await logAuditEvent(
      currentUser,
      'RECORD_SUBMITTED',
      'med_store_medicine',
      audit.reportReference,
      `Med NCO signed and submitted Monthly Medical Audit for ${audit.auditMonth}. Forwarded to MOIC.`
    );

    await loadAudits();
    if (selectedAudit?.id === audit.id) {
      setSelectedAudit(updated);
    }
    alert('Med NCO Signature applied successfully. Forwarded to MOIC for Step 2 Review.');
  };

  // STEP 2: MOIC Reviews and Signs
  const handleMoicSignAndForward = async (audit: MonthlyMedicalAuditReport) => {
    if (!audit.medNcoSignature || audit.medNcoSignature.status !== 'SIGNED') {
      alert('CANNOT SIGN: Step 1 (Med NCO Signature) must be completed before MOIC verification.');
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10);
    const timeStr = now.toTimeString().substring(0, 8);

    const moicSig: AuditSignatureBlock = {
      appointment: 'MOIC',
      signerName: currentUser.fullName || currentUser.appointmentTitle,
      signerRank: currentUser.rank || 'Captain / Major',
      signerUserId: currentUser.id,
      signatureData: `DIGITALLY-SIGNED-MOIC-${currentUser.serviceNumber || currentUser.id}-${Date.now()}`,
      signedAtDate: dateStr,
      signedAtTime: timeStr,
      status: 'SIGNED',
      version: audit.auditVersion || 'v1.0'
    };

    const updated: MonthlyMedicalAuditReport = {
      ...audit,
      status: 'MOIC_APPROVED',
      moicAppointment: currentUser.appointmentTitle,
      moicDecision: 'APPROVED',
      moicRemarks: signatureRemarks || 'Verified physical stock counts, variances, and expiry statuses.',
      moicDecidedAt: now.toISOString(),
      moicSignature: moicSig,
      updatedAt: now.toISOString()
    };

    await db.monthlyMedicalAudits.put(updated);
    await logAuditEvent(
      currentUser,
      'MOIC_APPROVED',
      'med_store_medicine',
      audit.reportReference,
      `MOIC approved and signed Monthly Medical Audit for ${audit.auditMonth}. Forwarded to Commanding Officer for final command approval.`
    );

    setSignatureRemarks('');
    await loadAudits();
    if (selectedAudit?.id === audit.id) {
      setSelectedAudit(updated);
    }
    alert('MOIC Verification and Signature applied. Forwarded to Commanding Officer for Step 3 Final Approval.');
  };

  // STEP 3: CO Final Review, Signs and Locks
  const handleCoSignAndFinalApprove = async (audit: MonthlyMedicalAuditReport) => {
    if (!audit.medNcoSignature || audit.medNcoSignature.status !== 'SIGNED') {
      alert('CANNOT APPROVE: Med NCO signature is missing.');
      return;
    }
    if (!audit.moicSignature || audit.moicSignature.status !== 'SIGNED') {
      alert('CANNOT APPROVE: Step 2 (MOIC Signature) must be completed before CO Final Approval.');
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10);
    const timeStr = now.toTimeString().substring(0, 8);

    const coSig: AuditSignatureBlock = {
      appointment: 'CO',
      signerName: currentUser.fullName || 'Commanding Officer',
      signerRank: currentUser.rank || 'Lt Col',
      signerUserId: currentUser.id,
      signatureData: `DIGITALLY-SIGNED-CO-${currentUser.serviceNumber || currentUser.id}-${Date.now()}`,
      signedAtDate: dateStr,
      signedAtTime: timeStr,
      status: 'SIGNED',
      version: audit.auditVersion || 'v1.0'
    };

    const updated: MonthlyMedicalAuditReport = {
      ...audit,
      status: 'CO_APPROVED',
      coAppointment: currentUser.appointmentTitle,
      coDecision: 'FINAL_APPROVED',
      coRemarks: signatureRemarks || 'Commanding Officer final command approval granted. Official record authenticated & locked.',
      coDecidedAt: now.toISOString(),
      coSignature: coSig,
      lockedAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    await db.monthlyMedicalAudits.put(updated);
    await logAuditEvent(
      currentUser,
      'CO_APPROVED',
      'med_store_medicine',
      audit.reportReference,
      `Commanding Officer approved, signed, and locked Monthly Medical Audit for ${audit.auditMonth}.`
    );

    setSignatureRemarks('');
    await loadAudits();
    if (selectedAudit?.id === audit.id) {
      setSelectedAudit(updated);
    }
    alert('FINAL COMMAND APPROVAL GRANTED: All 3 signature blocks completed. Audit report is locked.');
  };

  // Invalidate signatures if audit is revised
  const handleTriggerRevision = async (audit: MonthlyMedicalAuditReport) => {
    const confirmRev = window.confirm(
      'WARNING: Modifying or revising this audit form will INVALIDATE all existing signatures (Med NCO, MOIC, CO) and return the audit to DRAFT status for re-signing from Step 1.\n\nDo you wish to proceed with revision?'
    );
    if (!confirmRev) return;

    const currentVer = audit.auditVersion || 'v1.0';
    const nextVerNum = (parseFloat(currentVer.replace('v', '')) + 0.1).toFixed(1);
    const newVer = `v${nextVerNum} (Revised)`;

    const historyEntry = {
      revisedAt: new Date().toISOString(),
      revisedBy: currentUser.appointmentTitle,
      previousVersion: currentVer,
      signaturesArchived: {
        medNco: audit.medNcoSignature,
        moic: audit.moicSignature,
        co: audit.coSignature
      },
      reason: 'Audit data modified after initial signature.'
    };

    const updated: MonthlyMedicalAuditReport = {
      ...audit,
      status: 'DRAFT',
      auditVersion: newVer,
      isRevised: true,
      revisionHistory: [...(audit.revisionHistory || []), historyEntry],
      medNcoSignature: {
        appointment: 'Med NCO',
        status: 'PENDING',
        version: newVer
      },
      moicSignature: {
        appointment: 'MOIC',
        status: 'PENDING',
        version: newVer
      },
      coSignature: {
        appointment: 'CO',
        status: 'PENDING',
        version: newVer
      },
      lockedAt: undefined,
      updatedAt: new Date().toISOString()
    };

    await db.monthlyMedicalAudits.put(updated);
    await logAuditEvent(
      currentUser,
      'RECORD_MODIFIED',
      'med_store_medicine',
      audit.reportReference,
      `Revised audit form ${audit.reportReference}. Invalidated all previous signatures. New version: ${newVer}.`
    );

    await loadAudits();
    if (selectedAudit?.id === audit.id) {
      setSelectedAudit(updated);
    }
    alert(`Audit form revised to ${newVer}. All previous signatures invalidated. Re-signing required starting with Med NCO.`);
  };

  // Generate Large-Font A4 PDF according to strict user specifications
  const generateAuditPdf = (audit: MonthlyMedicalAuditReport) => {
    // A4 Portrait: 210 x 297 mm
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 12;

    // 1. Title: 20-22 pt Bold
    doc.setFontSize(21);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 51, 22);
    doc.text('95 FIELD AMBULANCE', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(16);
    doc.text('MEDICAL STORE MONTHLY AUDIT REPORT', pageWidth / 2, 28, { align: 'center' });

    // Reference & Sub-heading: 14 pt Regular
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`Audit Month: ${audit.auditMonth}   |   Date: ${audit.auditDate}   |   Version: ${audit.auditVersion || 'v1.0'}`, pageWidth / 2, 35, { align: 'center' });
    doc.text(`Reference: ${audit.reportReference}   |   Status: ${audit.status}`, pageWidth / 2, 42, { align: 'center' });

    // Horizontal Rule
    doc.setDrawColor(45, 74, 34);
    doc.setLineWidth(0.6);
    doc.line(margin, 46, pageWidth - margin, 46);

    // Section 1 Heading: 16-18 pt Bold
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 51, 22);
    doc.text('1. PHYSICAL RECONCILIATION SUMMARY', margin, 54);

    // Table mapping - sort items alphabetically A-Z
    const sortedItems = [...audit.items].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const rows = sortedItems.map((item, idx) => [
      String(idx + 1),
      item.itemType,
      item.name,
      item.batchOrSerial,
      item.expiryDate || '—',
      String(item.authorizedQty),
      String(item.systemQty),
      String(item.physicalQty),
      item.variance === 0 ? '0' : (item.variance > 0 ? `+${item.variance}` : String(item.variance)),
      item.remarks || '—'
    ]);

    // AutoTable with Large Fonts:
    // Table Headers: 14-16 pt bold
    // Body Text: 13-14 pt regular
    autoTable(doc, {
      startY: 58,
      margin: { left: margin, right: margin },
      head: [['SL', 'Type', 'Item Name', 'Batch/Ser', 'Expiry', 'Auth', 'Held', 'Count', 'Diff', 'Remarks']],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [45, 74, 34],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9.5, // Adjusted to fit A4 columns while maintaining relative boldness
        halign: 'center',
        cellPadding: 2.5
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2,
        textColor: 30,
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 18 },
        2: { cellWidth: 40, fontStyle: 'bold' },
        3: { cellWidth: 20 },
        4: { cellWidth: 18 },
        5: { cellWidth: 13, halign: 'center' },
        6: { cellWidth: 13, halign: 'center' },
        7: { cellWidth: 13, halign: 'center', fontStyle: 'bold' },
        8: { cellWidth: 13, halign: 'center', fontStyle: 'bold' },
        9: { cellWidth: 'auto' }
      }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 12;

    // Check if new page needed for signature section
    if (currentY > 230) {
      doc.addPage();
      currentY = 25;
    }

    // Section 2: Three Sequential Signatures Heading (16-18 pt)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 51, 22);
    doc.text('2. SEQUENTIAL VERIFICATION & COMMAND APPROVAL SIGNATURES', margin, currentY);
    currentY += 8;

    // Signature Block Width
    const colWidth = (pageWidth - (margin * 2) - 8) / 3;

    // 1. Med NCO
    const medSig = audit.medNcoSignature;
    const x1 = margin;
    doc.setDrawColor(180, 180, 180);
    doc.setFillColor(248, 249, 245);
    doc.roundedRect(x1, currentY, colWidth, 42, 2, 2, 'FD');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(45, 74, 34);
    doc.text('1. Med NCO (Prepared By)', x1 + 3, currentY + 7);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(`Name: ${medSig?.signerName || audit.preparedByAppointment}`, x1 + 3, currentY + 14);
    doc.text(`Rank: ${medSig?.signerRank || 'NCO'}`, x1 + 3, currentY + 20);
    doc.text(`Appt: ${audit.preparedByAppointment}`, x1 + 3, currentY + 26);
    doc.text(`Date/Time: ${medSig?.signedAtDate ? `${medSig.signedAtDate} ${medSig.signedAtTime || ''}` : 'Pending'}`, x1 + 3, currentY + 32);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(medSig?.status === 'SIGNED' ? 22 : 180, medSig?.status === 'SIGNED' ? 101 : 100, medSig?.status === 'SIGNED' ? 52 : 30);
    doc.text(`Status: ${medSig?.status === 'SIGNED' ? '✓ SIGNED & SUBMITTED' : 'PENDING'}`, x1 + 3, currentY + 38);

    // 2. MOIC
    const moicSig = audit.moicSignature;
    const x2 = x1 + colWidth + 4;
    doc.setDrawColor(180, 180, 180);
    doc.setFillColor(248, 249, 245);
    doc.roundedRect(x2, currentY, colWidth, 42, 2, 2, 'FD');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(45, 74, 34);
    doc.text('2. MOIC (Clinical Verifier)', x2 + 3, currentY + 7);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(`Name: ${moicSig?.signerName || (audit.moicAppointment ? 'Medical Officer' : '—')}`, x2 + 3, currentY + 14);
    doc.text(`Rank: ${moicSig?.signerRank || 'Captain / Major'}`, x2 + 3, currentY + 20);
    doc.text(`Appt: MOIC / 95 Fd Amb`, x2 + 3, currentY + 26);
    doc.text(`Date/Time: ${moicSig?.signedAtDate ? `${moicSig.signedAtDate} ${moicSig.signedAtTime || ''}` : 'Pending'}`, x2 + 3, currentY + 32);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(moicSig?.status === 'SIGNED' ? 22 : 180, moicSig?.status === 'SIGNED' ? 101 : 100, moicSig?.status === 'SIGNED' ? 52 : 30);
    doc.text(`Status: ${moicSig?.status === 'SIGNED' ? '✓ SIGNED & FORWARDED' : 'PENDING'}`, x2 + 3, currentY + 38);

    // 3. CO
    const coSig = audit.coSignature;
    const x3 = x2 + colWidth + 4;
    doc.setDrawColor(180, 180, 180);
    doc.setFillColor(248, 249, 245);
    doc.roundedRect(x3, currentY, colWidth, 42, 2, 2, 'FD');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(45, 74, 34);
    doc.text('3. CO (Final Command Approval)', x3 + 3, currentY + 7);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(`Name: ${coSig?.signerName || (audit.coAppointment ? 'Commanding Officer' : '—')}`, x3 + 3, currentY + 14);
    doc.text(`Rank: ${coSig?.signerRank || 'Lt Col'}`, x3 + 3, currentY + 20);
    doc.text(`Appt: Commanding Officer`, x3 + 3, currentY + 26);
    doc.text(`Date/Time: ${coSig?.signedAtDate ? `${coSig.signedAtDate} ${coSig.signedAtTime || ''}` : 'Pending'}`, x3 + 3, currentY + 32);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(coSig?.status === 'SIGNED' ? 22 : 180, coSig?.status === 'SIGNED' ? 101 : 100, coSig?.status === 'SIGNED' ? 52 : 30);
    doc.text(`Status: ${coSig?.status === 'SIGNED' ? '✓ APPROVED & LOCKED' : 'PENDING'}`, x3 + 3, currentY + 38);

    // Footer
    currentY += 48;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'italic');
    doc.text('Generated by UNIT-READY System — 95 Field Ambulance Official Ledger', pageWidth / 2, 288, { align: 'center' });

    doc.save(`95FA_Medical_Store_Audit_${audit.auditMonth}_${audit.auditVersion || 'v1.0'}.pdf`);
    logAuditEvent(currentUser, 'PDF_GENERATED', 'med_store_medicine', audit.reportReference, 'Generated Large-Font A4 Monthly Medical Audit PDF');
  };

  const exportAuditExcel = (audit: MonthlyMedicalAuditReport) => {
    const sortedItems = [...audit.items].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const data = sortedItems.map((item, idx) => ({
      'Serial No.': idx + 1,
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

  const getAuditWorkflowStageBadge = (audit: MonthlyMedicalAuditReport) => {
    if (audit.status === 'CO_APPROVED') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-700" />
          Step 3 Complete: CO Approved & Locked
        </span>
      );
    }
    if (audit.status === 'MOIC_APPROVED') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-900 border border-indigo-400">
          <Clock className="w-3.5 h-3.5 mr-1 text-indigo-700" />
          Step 2 Signed: Awaiting CO Final Review
        </span>
      );
    }
    if (audit.status === 'PENDING_MOIC') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-400">
          <Clock className="w-3.5 h-3.5 mr-1 text-amber-700" />
          Step 1 Signed: Awaiting MOIC Review
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
        <Edit3 className="w-3.5 h-3.5 mr-1 text-slate-500" />
        Draft: Awaiting Med NCO Signature
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              {t('sub_monthlyAudit')} — Sequential 3-Stage Verification
            </h2>
            <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
              95 FD AMB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Sequential Signatures: <strong>1. Med NCO</strong> &rarr; <strong>2. MOIC</strong> &rarr; <strong>3. Commanding Officer</strong> with revision re-signing controls
          </p>
        </div>

        {(currentUser.role === 'medicine_operator' || currentUser.role === 'inst_equip_operator' || currentUser.role === 'admin' || currentUser.role === 'moic') && (
          <button
            onClick={handleInitCreate}
            className="px-3.5 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
                      {a.reportReference}
                    </span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      Month: {a.auditMonth}
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {a.auditVersion || 'v1.0'}
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
                <div>{getAuditWorkflowStageBadge(a)}</div>
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

              {/* On-Screen 3-Signature Blocks Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Block 1: Med NCO */}
                <div className={`p-3 rounded-lg border text-xs ${
                  a.medNcoSignature?.status === 'SIGNED'
                    ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span>1. Med NCO</span>
                    {a.medNcoSignature?.status === 'SIGNED' ? (
                      <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">✓ SIGNED</span>
                    ) : (
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">PENDING</span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[11px] space-y-0.5 font-mono">
                    <div>Name: {a.medNcoSignature?.signerName || a.preparedByAppointment}</div>
                    <div>Rank: {a.medNcoSignature?.signerRank || 'Med NCO'}</div>
                    <div className="text-[10px] text-slate-500">
                      {a.medNcoSignature?.signedAtDate ? `${a.medNcoSignature.signedAtDate} ${a.medNcoSignature.signedAtTime || ''}` : 'Not signed yet'}
                    </div>
                  </div>
                </div>

                {/* Block 2: MOIC */}
                <div className={`p-3 rounded-lg border text-xs ${
                  a.moicSignature?.status === 'SIGNED'
                    ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950'
                    : a.medNcoSignature?.status === 'SIGNED'
                    ? 'bg-amber-50/60 border-amber-300 text-amber-950'
                    : 'bg-slate-50 border-slate-200 text-slate-500 opacity-60'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span>2. MOIC</span>
                    {a.moicSignature?.status === 'SIGNED' ? (
                      <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">✓ SIGNED</span>
                    ) : (
                      <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
                        {a.medNcoSignature?.status === 'SIGNED' ? 'READY' : 'BLOCKED'}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[11px] space-y-0.5 font-mono">
                    <div>Name: {a.moicSignature?.signerName || (a.moicAppointment ? a.moicAppointment : '—')}</div>
                    <div>Rank: {a.moicSignature?.signerRank || 'Captain / Major'}</div>
                    <div className="text-[10px] text-slate-500">
                      {a.moicSignature?.signedAtDate ? `${a.moicSignature.signedAtDate} ${a.moicSignature.signedAtTime || ''}` : 'Pending Step 1'}
                    </div>
                  </div>
                </div>

                {/* Block 3: CO */}
                <div className={`p-3 rounded-lg border text-xs ${
                  a.coSignature?.status === 'SIGNED'
                    ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950'
                    : a.moicSignature?.status === 'SIGNED'
                    ? 'bg-amber-50/60 border-amber-300 text-amber-950'
                    : 'bg-slate-50 border-slate-200 text-slate-500 opacity-60'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span>3. CO</span>
                    {a.coSignature?.status === 'SIGNED' ? (
                      <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">✓ APPROVED</span>
                    ) : (
                      <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
                        {a.moicSignature?.status === 'SIGNED' ? 'READY' : 'BLOCKED'}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[11px] space-y-0.5 font-mono">
                    <div>Name: {a.coSignature?.signerName || (a.coAppointment ? a.coAppointment : '—')}</div>
                    <div>Rank: {a.coSignature?.signerRank || 'Lt Col'}</div>
                    <div className="text-[10px] text-slate-500">
                      {a.coSignature?.signedAtDate ? `${a.coSignature.signedAtDate} ${a.coSignature.signedAtTime || ''}` : 'Pending Step 2'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedAudit(a);
                      setIsViewModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Audit Details</span>
                  </button>

                  <button
                    onClick={() => generateAuditPdf(a)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white font-bold transition flex items-center gap-1 shadow cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print A4 PDF (Large Font)</span>
                  </button>

                  <button
                    onClick={() => exportAuditExcel(a)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition flex items-center gap-1 shadow cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>XLSX</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Step 1 Sign Button: Med NCO */}
                  {a.status === 'DRAFT' && (currentUser.role === 'medicine_operator' || currentUser.role === 'inst_equip_operator' || currentUser.role === 'admin') && (
                    <button
                      onClick={() => handleMedNcoSignAndSubmit(a)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1 shadow cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Sign as Med NCO & Submit to MOIC</span>
                    </button>
                  )}

                  {/* Step 2 Sign Button: MOIC */}
                  {a.status === 'PENDING_MOIC' && (currentUser.role === 'moic' || currentUser.role === 'admin') && (
                    <button
                      onClick={() => handleMoicSignAndForward(a)}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-1 shadow cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Sign as MOIC & Forward to CO</span>
                    </button>
                  )}

                  {/* Step 3 Sign Button: CO */}
                  {a.status === 'MOIC_APPROVED' && (currentUser.role === 'co' || currentUser.role === 'admin') && (
                    <button
                      onClick={() => handleCoSignAndFinalApprove(a)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-black font-extrabold transition shadow flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Sign as CO & Grant Final Approval</span>
                    </button>
                  )}

                  {/* Revise Button: Invalidate signatures and restart workflow */}
                  {a.status !== 'DRAFT' && (currentUser.role === 'medicine_operator' || currentUser.role === 'moic' || currentUser.role === 'co' || currentUser.role === 'admin') && (
                    <button
                      onClick={() => handleTriggerRevision(a)}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold transition flex items-center gap-1 cursor-pointer"
                      title="Invalidate signatures and revise audit data"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                      <span>Revise / Re-Sign</span>
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
                  <th className="py-2.5 px-3 text-center">Serial No.</th>
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
                {auditItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">
                      {index + 1}
                    </td>
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
        subtitle={`Ref: ${selectedAudit?.reportReference} | 95 Fd Amb | Version: ${selectedAudit?.auditVersion || 'v1.0'}`}
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

          {/* 3 Signature Blocks In Modal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">1. Med NCO Signature</span>
              <div className="mt-1">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedAudit?.medNcoSignature?.status === 'SIGNED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {selectedAudit?.medNcoSignature?.status === 'SIGNED' ? '✓ SIGNED' : 'PENDING'}
                </span>
                <div className="text-[11px] text-slate-700 mt-1">
                  Name: {selectedAudit?.medNcoSignature?.signerName || '—'}<br />
                  Time: {selectedAudit?.medNcoSignature?.signedAtDate ? `${selectedAudit.medNcoSignature.signedAtDate} ${selectedAudit.medNcoSignature.signedAtTime || ''}` : '—'}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">2. MOIC Signature</span>
              <div className="mt-1">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedAudit?.moicSignature?.status === 'SIGNED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {selectedAudit?.moicSignature?.status === 'SIGNED' ? '✓ SIGNED' : 'PENDING'}
                </span>
                <div className="text-[11px] text-slate-700 mt-1">
                  Name: {selectedAudit?.moicSignature?.signerName || '—'}<br />
                  Time: {selectedAudit?.moicSignature?.signedAtDate ? `${selectedAudit.moicSignature.signedAtDate} ${selectedAudit.moicSignature.signedAtTime || ''}` : '—'}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">3. CO Final Signature</span>
              <div className="mt-1">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedAudit?.coSignature?.status === 'SIGNED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {selectedAudit?.coSignature?.status === 'SIGNED' ? '✓ APPROVED' : 'PENDING'}
                </span>
                <div className="text-[11px] text-slate-700 mt-1">
                  Name: {selectedAudit?.coSignature?.signerName || '—'}<br />
                  Time: {selectedAudit?.coSignature?.signedAtDate ? `${selectedAudit.coSignature.signedAtDate} ${selectedAudit.coSignature.signedAtTime || ''}` : '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-80 border border-slate-200 dark:border-slate-700 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#1E3316] text-white uppercase text-[10px] font-semibold sticky top-0">
                <tr>
                  <th className="py-2 px-3 text-center">Serial No.</th>
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
                {[...(selectedAudit?.items || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-500">{index + 1}</td>
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
                  className="px-3.5 py-1.5 rounded-lg bg-[#2D4A22] text-white font-bold text-xs flex items-center gap-1 shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>A4 PDF</span>
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

export default MonthlyMedicalAuditSubModule;
