import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { MedicineItem, MedicineBatch, ExpiryCategory, SectionApprovalRecord } from '../../types';
import { Modal } from '../common/Modal';
import { StatusBadge } from '../common/StatusBadge';
import { RequestCorrectionModal } from '../common/RequestCorrectionModal';
import { logAuditEvent } from '../../services/auditService';
import { syncEntityToCloud, deleteEntityFromCloud } from '../../services/firebaseSyncService';
import { 
  Pill, Search, Plus, AlertTriangle, 
  ShieldAlert, CheckCircle, ArrowRight, Clock, 
  Calendar, Layers, FileSpreadsheet, Package, 
  AlertCircle, CheckCircle2, ShieldCheck, Edit3, Send, Trash2 
} from 'lucide-react';

export const MedicineSubModule: React.FC = () => {
  const { currentUser, activeDevice } = useAuth();
  const { t, formatNumber } = useLanguage();

  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [approvalRecord, setApprovalRecord] = useState<SectionApprovalRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expiryCategoryFilter, setExpiryCategoryFilter] = useState<string>('ALL');

  // Correction Request Modal State
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState<boolean>(false);
  const [correctionRecordTitle, setCorrectionRecordTitle] = useState<string>('Medical Store — Medicine Register');
  const [correctionField, setCorrectionField] = useState<string>('Authorized vs Held Quantity');
  const [correctionExistingVal, setCorrectionExistingVal] = useState<string>('');

  // Add / Edit Medicine Modal
  const [isMedModalOpen, setIsMedModalOpen] = useState<boolean>(false);
  const [editingMed, setEditingMed] = useState<MedicineItem | null>(null);
  const [genericName, setGenericName] = useState<string>('');
  const [brandName, setBrandName] = useState<string>('');
  const [strength, setStrength] = useState<string>('500 mg');
  const [dosageForm, setDosageForm] = useState<string>('Tablet');
  const [unitOfIssue, setUnitOfIssue] = useState<string>('Tablets');
  const [expiryDate, setExpiryDate] = useState<string>('2027-08-30'); // Mandatory Expiry Date
  const [authQty, setAuthQty] = useState<number>(5000);
  const [currentQty, setCurrentQty] = useState<number>(200);
  const [minLevel, setMinLevel] = useState<number>(500);
  const [maxLevel, setMaxLevel] = useState<number>(10000);
  const [unitPrice, setUnitPrice] = useState<number>(1.20);
  const [storage, setStorage] = useState<string>('Room Temperature (Under 25C)');
  const [isLasa, setIsLasa] = useState<boolean>(false);
  const [dailyConsump, setDailyConsump] = useState<number>(150);
  const [medRemarks, setMedRemarks] = useState<string>('');

  // Add / Edit Batch Modal
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [selectedMedForBatch, setSelectedMedForBatch] = useState<MedicineItem | null>(null);
  const [batchNo, setBatchNo] = useState<string>('');
  const [batchExpDate, setBatchExpDate] = useState<string>('');
  const [batchQty, setBatchQty] = useState<number>(100);
  const [rack, setRack] = useState<string>('A');
  const [shelf, setShelf] = useState<string>('01');
  const [bin, setBin] = useState<string>('01');
  const [rcvRef, setRcvRef] = useState<string>('RCV/95FA/2026/01');

  // Issue Stock (FEFO) Modal
  const [isIssueModalOpen, setIsIssueModalOpen] = useState<boolean>(false);
  const [selectedMedForIssue, setSelectedMedForIssue] = useState<MedicineItem | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [issueQty, setIssueQty] = useState<number>(1);
  const [issuedTo, setIssuedTo] = useState<string>('MI Room Emergency Bay');
  const [voucherRef, setVoucherRef] = useState<string>('VOUCH/95FA/2026/08/101');
  const [fefoOverrideWarning, setFefoOverrideWarning] = useState<boolean>(false);

  const loadData = async () => {
    const medList = await db.medicines.toArray();
    setMedicines(medList);
    const batchList = await db.medicineBatches.toArray();
    setBatches(batchList);
    const appr = await db.sectionApprovals.where('section').equals('med_store_medicine').last();
    if (appr) setApprovalRecord(appr);
  };

  useEffect(() => {
    loadData();

    const handleCloudSync = (e: any) => {
      if (e.detail?.collection === 'medicines' || e.detail?.collection === 'medicineBatches' || e.detail?.collection === 'sectionApprovals') {
        loadData();
      }
    };
    window.addEventListener('unit-ready-cloud-sync', handleCloudSync);
    return () => window.removeEventListener('unit-ready-cloud-sync', handleCloudSync);
  }, []);

  // Asia/Dhaka Days Remaining Helper
  const now = new Date();
  const getDaysRemaining = (expDateStr: string) => {
    if (!expDateStr) return 999;
    const exp = new Date(expDateStr);
    return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatDateDDMMYYYY = (isoDate: string) => {
    if (!isoDate) return '—';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return isoDate;
  };

  const getExpiryCategoryInfo = (expDateStr: string, isQuarantined?: boolean): {
    category: ExpiryCategory;
    label: string;
    warningText: string;
    badgeStyle: string;
    colorHex: string;
    isUsable: boolean;
  } => {
    const days = getDaysRemaining(expDateStr);

    if (days < 0 || isQuarantined) {
      return {
        category: 'EXPIRED',
        label: 'Expired Medicines',
        warningText: 'EXPIRED — DO NOT ISSUE',
        badgeStyle: 'bg-[#7F1D1D] text-white border border-red-800 font-black',
        colorHex: '#7F1D1D',
        isUsable: false
      };
    } else if (days <= 30) {
      return {
        category: 'SHORT_DATED',
        label: 'Short-Dated Medicines – Expiry within 30 Days',
        warningText: 'SHORT-DATED — EXPIRY WITHIN 30 DAYS',
        badgeStyle: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-500 font-bold',
        colorHex: '#D97706',
        isUsable: true
      };
    } else {
      return {
        category: 'HELD_NORMAL',
        label: 'Held Medicines – Normal Use',
        warningText: 'HELD MEDICINES — NORMAL USE (>30 DAYS)',
        badgeStyle: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-500 font-bold',
        colorHex: '#16A34A',
        isUsable: true
      };
    }
  };

  // Batches classification
  const expiredBatches = batches.filter(b => getDaysRemaining(b.expiryDate) < 0 || b.status === 'EXPIRED');
  const shortDatedBatches = batches.filter(b => {
    const days = getDaysRemaining(b.expiryDate);
    return days >= 0 && days <= 30 && b.status !== 'EXPIRED';
  });
  const heldNormalBatches = batches.filter(b => {
    const days = getDaysRemaining(b.expiryDate);
    return days > 30 && b.status !== 'EXPIRED';
  });

  const totalHeldUnits = medicines.reduce((sum, m) => sum + (Number(m.currentQuantity) || 0), 0);
  const totalAuthUnits = medicines.reduce((sum, m) => sum + (Number(m.authorizedQuantity) || 0), 0);

  const calcValuation = (batchArr: MedicineBatch[]) => {
    return batchArr.reduce((sum, b) => {
      const med = medicines.find(m => m.id === b.medicineId);
      const price = med?.unitPrice || 0;
      return sum + (b.currentQuantity * price);
    }, 0);
  };

  const getUsableQuantity = (medId: string) => {
    return batches
      .filter(b => b.medicineId === medId && getDaysRemaining(b.expiryDate) >= 0 && b.status !== 'EXPIRED')
      .reduce((sum, b) => sum + b.currentQuantity, 0);
  };

  const getBatchesForMed = (medId: string) => {
    return batches
      .filter(b => b.medicineId === medId)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  };

  // Submit Medicine State to MOIC
  const handleSubmitToMoic = async () => {
    const nowIso = new Date().toISOString();
    const appr = await db.sectionApprovals.where('section').equals('med_store_medicine').first();
    if (appr) {
      const updated = {
        ...appr,
        status: 'PENDING_MOIC' as const,
        submittedByAppointment: currentUser.appointmentTitle,
        submittedAt: nowIso
      };
      await db.sectionApprovals.update(appr.id, updated);
      await syncEntityToCloud('sectionApprovals', appr.id, updated);
    }

    await logAuditEvent(
      currentUser,
      'RECORD_SUBMITTED',
      'med_store_medicine',
      'MEDICINE_STORE_STATE',
      'Submitted Medicine Store inventory and expiry register to MOIC for clinical verification.'
    );

    loadData();
    alert('Medicine Store state submitted to MOIC for review.');
  };

  // MOIC Review Action
  const handleMoicReviewApprove = async () => {
    const nowIso = new Date().toISOString();
    const appr = await db.sectionApprovals.where('section').equals('med_store_medicine').first();
    if (appr) {
      const updated = {
        ...appr,
        status: 'MOIC_APPROVED' as const,
        intermediateAppointment: currentUser.appointmentTitle,
        intermediateDecision: 'APPROVED' as const,
        intermediateRemarks: 'Verified all medicine expiry dates, FEFO batches, and quarantine vault.',
        intermediateDecidedAt: nowIso
      };
      await db.sectionApprovals.update(appr.id, updated);
      await syncEntityToCloud('sectionApprovals', appr.id, updated);
    }

    await logAuditEvent(
      currentUser,
      'MOIC_APPROVED',
      'med_store_medicine',
      'MEDICINE_STORE_STATE',
      'MOIC approved Medicine Store state. Forwarded to Commanding Officer for command approval.'
    );

    loadData();
    alert('MOIC verification complete. Forwarded to Commanding Officer for final approval.');
  };

  // CO Command Approval (WITHOUT Locking)
  const handleCoFinalApprove = async () => {
    const nowIso = new Date().toISOString();
    const appr = await db.sectionApprovals.where('section').equals('med_store_medicine').first();
    if (appr) {
      const updated = {
        ...appr,
        status: 'CO_APPROVED' as const,
        coAppointment: currentUser.appointmentTitle,
        coDecision: 'FINAL_APPROVED' as const,
        coRemarks: 'Commanding Officer approval granted. Stock register remains active & editable by authorized operators.',
        coDecidedAt: nowIso
      };
      await db.sectionApprovals.update(appr.id, updated);
      await syncEntityToCloud('sectionApprovals', appr.id, updated);
    }

    await logAuditEvent(
      currentUser,
      'CO_APPROVED',
      'med_store_medicine',
      'MEDICINE_STORE_STATE',
      'Commanding Officer granted command approval for Medicine Store.'
    );

    loadData();
    alert('COMMAND APPROVAL GRANTED: Medicine Store state has received Commanding Officer approval.');
  };

  // FEFO Issue Modal Trigger
  const handleOpenIssue = (med: MedicineItem) => {
    setSelectedMedForIssue(med);
    const usableBatches = getBatchesForMed(med.id).filter(b => getDaysRemaining(b.expiryDate) >= 0 && b.status !== 'EXPIRED' && b.currentQuantity > 0);
    if (usableBatches.length === 0) {
      alert('CANNOT ISSUE: All held batches for this medicine are EXPIRED — DO NOT ISSUE.');
      return;
    }
    setSelectedBatchId(usableBatches[0].id);
    setIssueQty(1);
    setFefoOverrideWarning(false);
    setVoucherRef(`VOUCH/95FA/2026/08/${Math.floor(100 + Math.random() * 900)}`);
    setIsIssueModalOpen(true);
  };

  const handleBatchSelect = (batchId: string) => {
    setSelectedBatchId(batchId);
    if (selectedMedForIssue) {
      const usableBatches = getBatchesForMed(selectedMedForIssue.id).filter(b => getDaysRemaining(b.expiryDate) >= 0 && b.status !== 'EXPIRED' && b.currentQuantity > 0);
      if (usableBatches.length > 0 && usableBatches[0].id !== batchId) {
        setFefoOverrideWarning(true);
      } else {
        setFefoOverrideWarning(false);
      }
    }
  };

  const handleExecuteIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedForIssue || !selectedBatchId) return;

    const targetBatch = batches.find(b => b.id === selectedBatchId);
    if (!targetBatch) return;

    const expInfo = getExpiryCategoryInfo(targetBatch.expiryDate, targetBatch.status === 'EXPIRED');
    if (!expInfo.isUsable) {
      alert('ISSUE BLOCKED — EXPIRED BATCH! Expired stock cannot be issued. Move to quarantine.');
      return;
    }

    if (issueQty > targetBatch.currentQuantity) {
      alert(`Insufficient quantity in selected batch. Available: ${targetBatch.currentQuantity}`);
      return;
    }

    const updatedQty = targetBatch.currentQuantity - issueQty;
    await db.medicineBatches.update(targetBatch.id, { currentQuantity: updatedQty });

    // Update medicine currentQuantity
    const newMedCurrent = selectedMedForIssue.currentQuantity - issueQty;
    const newShortage = newMedCurrent - selectedMedForIssue.authorizedQuantity;
    await db.medicines.update(selectedMedForIssue.id, {
      currentQuantity: newMedCurrent,
      shortageOrExcess: newShortage
    });

    await db.medicineTransactions.add({
      id: 'tx-' + Date.now(),
      transactionType: 'ISSUE',
      medicineId: selectedMedForIssue.id,
      medicineName: selectedMedForIssue.genericName,
      batchId: targetBatch.id,
      batchNumber: targetBatch.batchNumber,
      quantity: issueQty,
      unitPrice: selectedMedForIssue.unitPrice,
      totalValue: issueQty * selectedMedForIssue.unitPrice,
      voucherReference: voucherRef,
      issuedToRecipient: issuedTo,
      performedByUserId: currentUser.id,
      performedByAppointment: currentUser.appointmentTitle,
      deviceId: activeDevice.id,
      transactionTimestamp: new Date().toISOString(),
      remarks: fefoOverrideWarning ? 'FEFO Override: User selected later-expiry batch with recorded justification.' : 'Standard FEFO Issue.'
    });

    await logAuditEvent(
      currentUser,
      'DRAFT_SAVED',
      'med_store_medicine',
      voucherRef,
      `Issued ${issueQty} ${selectedMedForIssue.unitOfIssue} of ${selectedMedForIssue.genericName} (Batch: ${targetBatch.batchNumber}) to ${issuedTo}.`
    );

    setIsIssueModalOpen(false);
    loadData();
  };

  const handleOpenAddMed = () => {
    setEditingMed(null);
    setGenericName('');
    setBrandName('');
    setStrength('500 mg');
    setDosageForm('Tablet');
    setUnitOfIssue('Tablets');
    setExpiryDate('2027-08-30');
    setAuthQty(5000);
    setCurrentQty(200);
    setMinLevel(500);
    setMaxLevel(10000);
    setUnitPrice(1.20);
    setStorage('Room Temperature (Under 25C)');
    setIsLasa(false);
    setDailyConsump(150);
    setMedRemarks('');
    setIsMedModalOpen(true);
  };

  const handleOpenEditMed = (med: MedicineItem) => {
    setEditingMed(med);
    setGenericName(med.genericName);
    setBrandName(med.brandName || '');
    setStrength(med.strength);
    setDosageForm(med.dosageForm);
    setUnitOfIssue(med.unitOfIssue);
    setExpiryDate(med.expiryDate);
    setAuthQty(med.authorizedQuantity);
    setCurrentQty(med.currentQuantity);
    setMinLevel(med.minimumLevel);
    setMaxLevel(med.maximumLevel);
    setUnitPrice(med.unitPrice);
    setStorage(med.storageCondition);
    setIsLasa(med.isHighRiskLasa);
    setDailyConsump(med.dailyConsumptionAverage);
    setMedRemarks(med.remarks || '');
    setIsMedModalOpen(true);
  };

  const handleDeleteMed = async (med: MedicineItem) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete / archive "${med.genericName} (${med.strength})"?\n\nThis will remove the medicine from the active inventory list while preserving a tamper-evident audit trail.`
    );
    if (!confirmDelete) return;

    await db.medicines.delete(med.id);
    await deleteEntityFromCloud('medicines', med.id);

    const relatedBatches = batches.filter(b => b.medicineId === med.id);
    for (const b of relatedBatches) {
      await db.medicineBatches.delete(b.id);
      await deleteEntityFromCloud('medicineBatches', b.id);
    }

    await logAuditEvent(
      currentUser,
      'RECORD_DELETED',
      'med_store_medicine',
      med.genericName,
      `Archived / deleted medicine: ${med.genericName} (${med.strength}, Expiry: ${med.expiryDate}).`
    );

    loadData();
    alert(`Medicine "${med.genericName}" deleted / archived from active inventory.`);
  };

  const handleSaveMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genericName.trim()) {
      alert('Generic chemical name is required.');
      return;
    }
    if (!expiryDate) {
      alert('Mandatory Expiry Date is required. Medicine cannot be saved without an expiry date.');
      return;
    }

    const shortage = Number(currentQty) - Number(authQty);

    if (editingMed) {
      const updated: MedicineItem = {
        ...editingMed,
        genericName: genericName.trim(),
        brandName: brandName.trim(),
        strength,
        dosageForm,
        unitOfIssue,
        expiryDate,
        authorizedQuantity: Number(authQty),
        currentQuantity: Number(currentQty),
        shortageOrExcess: shortage,
        minimumLevel: Number(minLevel),
        maximumLevel: Number(maxLevel),
        unitPrice: Number(unitPrice),
        storageCondition: storage,
        isHighRiskLasa: isLasa,
        dailyConsumptionAverage: Number(dailyConsump),
        remarks: medRemarks
      };
      await db.medicines.put(updated);
      await syncEntityToCloud('medicines', updated.id, updated);

      await logAuditEvent(
        currentUser,
        'DRAFT_SAVED',
        'med_store_medicine',
        updated.genericName,
        `Updated medicine: ${updated.genericName} (Expiry: ${expiryDate}, Auth: ${authQty}, Current: ${currentQty})`
      );
    } else {
      const newMedId = 'med-' + Date.now();
      const newMed: MedicineItem = {
        id: newMedId,
        genericName: genericName.trim(),
        brandName: brandName.trim(),
        strength,
        dosageForm,
        unitOfIssue,
        expiryDate,
        authorizedQuantity: Number(authQty),
        currentQuantity: Number(currentQty),
        shortageOrExcess: shortage,
        minimumLevel: Number(minLevel),
        maximumLevel: Number(maxLevel),
        unitPrice: Number(unitPrice),
        storageCondition: storage,
        isHighRiskLasa: isLasa,
        dailyConsumptionAverage: Number(dailyConsump),
        remarks: medRemarks,
        createdAt: new Date().toISOString()
      };
      await db.medicines.add(newMed);
      await syncEntityToCloud('medicines', newMedId, newMed);

      // Also create an initial batch for this medicine
      const newBatch: MedicineBatch = {
        id: 'b-' + Date.now(),
        medicineId: newMedId,
        batchNumber: `BATCH-${Date.now().toString().slice(-4)}`,
        expiryDate: expiryDate,
        receivedQuantity: Number(currentQty),
        currentQuantity: Number(currentQty),
        rack: 'A',
        shelf: '01',
        bin: '01',
        receiptReference: `RCV/95FA/${new Date().getFullYear()}/001`,
        status: getExpiryCategoryInfo(expiryDate).category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.medicineBatches.add(newBatch);
      await syncEntityToCloud('medicineBatches', newBatch.id, newBatch);

      await logAuditEvent(
        currentUser,
        'DRAFT_SAVED',
        'med_store_medicine',
        newMed.genericName,
        `Added new medicine: ${newMed.genericName} (Expiry: ${expiryDate}, Qty: ${currentQty} ${unitOfIssue})`
      );
    }

    setIsMedModalOpen(false);
    loadData();
  };

  const filteredMedicines = medicines.filter(m => {
    const matchesSearch = 
      m.genericName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.brandName && m.brandName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.strength.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (expiryCategoryFilter === 'ALL') return true;

    const medBatches = getBatchesForMed(m.id);
    const earliestExp = m.expiryDate || (medBatches.length > 0 ? medBatches[0].expiryDate : '');
    const info = getExpiryCategoryInfo(earliestExp);
    return info.category === expiryCategoryFilter;
  });

  const canEdit = currentUser.role === 'medicine_operator' || currentUser.role === 'moic' || currentUser.role === 'co' || currentUser.role === '2ic' || currentUser.role === 'other_operator' || currentUser.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Read-Only Notice Banner for non-concerned personnel */}
      {!canEdit && (
        <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>Read-Only View Mode:</strong> You are logged in as <strong>{currentUser.appointmentTitle}</strong>. Medicine inventory & FEFO issues are restricted to Medicine Store Operator, MOIC & CO.
            </span>
          </div>
          <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded font-bold">
            VIEW ONLY
          </span>
        </div>
      )}

      {/* 5 Enhanced Expiry & Stock Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Card 1: Total Authorized Quantity */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">1. Total Authorized</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-slate-800 dark:text-slate-100">{formatNumber(totalAuthUnits)}</span>
            <span className="text-[10px] text-slate-400 font-mono">Units</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">{medicines.length} Types Authorized</p>
        </div>

        {/* Card 2: Total Held / Current Quantity */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 block">2. Total Held Qty</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-blue-700 dark:text-blue-300">{formatNumber(totalHeldUnits)}</span>
            <span className="text-[10px] text-blue-500 font-mono">Units</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Individual numbers/units</p>
        </div>

        {/* Card 3: Held Medicines – Normal Use (> 30 days) */}
        <div 
          onClick={() => setExpiryCategoryFilter(expiryCategoryFilter === 'HELD_NORMAL' ? 'ALL' : 'HELD_NORMAL')}
          className={`p-3.5 rounded-xl border shadow-xs cursor-pointer transition ${
            expiryCategoryFilter === 'HELD_NORMAL' ? 'ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/50' : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-300">3. Held / Normal Use</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-emerald-900 dark:text-emerald-100">{formatNumber(heldNormalBatches.reduce((s, b) => s + b.currentQuantity, 0))}</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">&gt; 30d</span>
          </div>
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
            {heldNormalBatches.length} Active Batches
          </p>
        </div>

        {/* Card 4: Short-Dated Medicines (≤ 30 Days) */}
        <div 
          onClick={() => setExpiryCategoryFilter(expiryCategoryFilter === 'SHORT_DATED' ? 'ALL' : 'SHORT_DATED')}
          className={`p-3.5 rounded-xl border shadow-xs cursor-pointer transition ${
            expiryCategoryFilter === 'SHORT_DATED' ? 'ring-2 ring-amber-500 bg-amber-50 dark:bg-amber-950/50' : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">4. Short-Dated</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-amber-800 dark:text-amber-200">{formatNumber(shortDatedBatches.reduce((s, b) => s + b.currentQuantity, 0))}</span>
            <span className="text-[10px] text-amber-600 font-mono">≤ 30d</span>
          </div>
          <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1 font-mono">
            {shortDatedBatches.length} Critical Batches
          </p>
        </div>

        {/* Card 5: Expired Medicines (< 0 Days) */}
        <div 
          onClick={() => setExpiryCategoryFilter(expiryCategoryFilter === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
          className={`p-3.5 rounded-xl border shadow-xs cursor-pointer transition ${
            expiryCategoryFilter === 'EXPIRED' ? 'ring-2 ring-red-500 bg-red-950 text-white' : 'bg-red-950/80 text-white border-red-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-red-300">5. Expired Qty</span>
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-red-100">{formatNumber(expiredBatches.reduce((s, b) => s + b.currentQuantity, 0))}</span>
            <span className="text-[10px] text-red-300 font-mono">Expired</span>
          </div>
          <p className="text-[10px] text-red-300/80 mt-1 font-mono">
            {expiredBatches.length} Quarantined
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search generic medicine name, brand, strength..."
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {approvalRecord && <StatusBadge status={approvalRecord.status} />}

          {/* Clearly Visible Add Medicine Button (Always available for authorized operators) */}
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenAddMed}
              className="px-4 py-2 rounded-xl bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-extrabold shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#F59E0B]" />
              <span>Add Medicine</span>
            </button>
          )}

          {/* Submit to MOIC */}
          {canEdit && approvalRecord?.status === 'DRAFT' && (
            <button
              onClick={handleSubmitToMoic}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit to MOIC</span>
            </button>
          )}

          {/* MOIC Review Button */}
          {approvalRecord?.status === 'PENDING_MOIC' && (currentUser.role === 'moic' || currentUser.role === 'admin') && (
            <button
              onClick={handleMoicReviewApprove}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>MOIC Approve & Forward to CO</span>
            </button>
          )}

          {/* CO Command Approval Button */}
          {(currentUser.role === 'co' || currentUser.role === 'admin') && (
            <button
              onClick={handleCoFinalApprove}
              className="px-3.5 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-black font-extrabold text-xs shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>CO Command Approval</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Medicine & Batch Register */}
      <div className="space-y-4">
        {filteredMedicines.map((m) => {
          const medBatches = getBatchesForMed(m.id);
          const usableQty = getUsableQuantity(m.id);
          const earliestExpiry = m.expiryDate || (medBatches.length > 0 ? medBatches[0].expiryDate : '');
          const daysRemaining = getDaysRemaining(earliestExpiry);
          const expInfo = getExpiryCategoryInfo(earliestExpiry);

          return (
            <div 
              key={m.id}
              className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3"
            >
              {/* Medicine Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                      {m.genericName}
                    </h3>
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs px-2 py-0.5 rounded">
                      {m.strength} ({m.dosageForm})
                    </span>
                    {m.isHighRiskLasa && (
                      <span className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-black text-[9px] px-1.5 py-0.5 rounded border border-red-400">
                        LASA HIGH RISK
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Brand: <strong className="text-slate-700 dark:text-slate-300">{m.brandName || 'Generic'}</strong> | Unit: {m.unitOfIssue} | Storage: {m.storageCondition}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Stock Equation Strip */}
                  <div className="flex items-center gap-3 font-mono text-xs bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold uppercase block font-sans">Authorized</span>
                      <strong className="text-slate-800 dark:text-slate-200">{formatNumber(m.authorizedQuantity)}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold uppercase block font-sans">Current / On-Hand</span>
                      <strong className="text-slate-800 dark:text-slate-200">{formatNumber(m.currentQuantity)}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold uppercase block font-sans">Shortage / Excess</span>
                      <strong className={m.shortageOrExcess < 0 ? 'text-red-600 font-black' : 'text-emerald-600 font-black'}>
                        {m.shortageOrExcess > 0 ? `+${m.shortageOrExcess}` : m.shortageOrExcess}
                      </strong>
                    </div>
                  </div>

                  {canEdit ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditMed(m)}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                        title="Edit Medicine Details"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteMed(m)}
                        className="p-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-950/60 dark:hover:bg-red-900 text-red-700 dark:text-red-300 text-xs font-semibold cursor-pointer"
                        title="Delete / Archive Medicine"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleOpenIssue(m)}
                        className="px-3 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Issue (FEFO)</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400 font-mono text-[11px] px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                      View Only
                    </span>
                  )}
                </div>
              </div>

              {/* Expiry Overview Strip */}
              <div className="flex flex-wrap items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 font-sans font-bold">Mandatory Expiry Date (DD-MM-YYYY): </span>
                  <strong className="text-slate-800 dark:text-white">{formatDateDDMMYYYY(earliestExpiry)}</strong>
                  <span className="text-slate-500 text-[11px] ml-2">
                    ({daysRemaining < 0 ? `Expired ${Math.abs(daysRemaining)}d ago` : `${daysRemaining} days remaining`})
                  </span>
                </div>

                <div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] ${expInfo.badgeStyle}`}>
                    {expInfo.warningText}
                  </span>
                </div>
              </div>

              {/* Batch-wise Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8F9F5] dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-2 px-3">Batch Number</th>
                      <th className="py-2 px-3">Quantity</th>
                      <th className="py-2 px-3">Expiry Date (DD-MM-YYYY)</th>
                      <th className="py-2 px-3">Days Remaining</th>
                      <th className="py-2 px-3">Expiry Classification & Warning</th>
                      <th className="py-2 px-3">Rack / Shelf / Bin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {medBatches.map((b) => {
                      const days = getDaysRemaining(b.expiryDate);
                      const batchExpInfo = getExpiryCategoryInfo(b.expiryDate, b.status === 'EXPIRED');

                      return (
                        <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {b.batchNumber}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold">
                            {formatNumber(b.currentQuantity)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold">
                            {formatDateDDMMYYYY(b.expiryDate)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold">
                            {days < 0 ? (
                              <span className="text-red-500 font-bold">Passed ({Math.abs(days)}d ago)</span>
                            ) : (
                              <span>{formatNumber(days)} Days</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] ${batchExpInfo.badgeStyle}`}>
                              {batchExpInfo.warningText}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                            {b.rack} / {b.shelf} / {b.bin}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* FEFO Issue Stock Modal */}
      <Modal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        title={`Issue Medicine (FEFO Rule): ${selectedMedForIssue?.genericName}`}
        subtitle="Earliest expiring usable batch is auto-recommended by default"
      >
        <form onSubmit={handleExecuteIssue} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Select Batch (Sorted by Expiry Date) *
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => handleBatchSelect(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
              required
            >
              {selectedMedForIssue && getBatchesForMed(selectedMedForIssue.id).map((b, idx) => {
                const days = getDaysRemaining(b.expiryDate);
                const isExp = days < 0 || b.status === 'EXPIRED';
                return (
                  <option key={b.id} value={b.id} disabled={isExp}>
                    {idx === 0 && !isExp ? '★ [EARLIEST EXPIRY] ' : ''}
                    Batch: {b.batchNumber} | Expiry: {formatDateDDMMYYYY(b.expiryDate)} ({days}d remaining) | Qty: {b.currentQuantity} {isExp ? '[EXPIRED - BLOCKED]' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* FEFO Status Warning Banner */}
          {selectedBatchId && (() => {
            const b = batches.find(x => x.id === selectedBatchId);
            if (!b) return null;
            const expInfo = getExpiryCategoryInfo(b.expiryDate, b.status === 'EXPIRED');

            if (!expInfo.isUsable) {
              return (
                <div className="p-3 bg-[#7F1D1D] text-white border border-red-600 rounded-lg text-xs font-bold flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-300" />
                  <span>EXPIRED — DO NOT ISSUE — MOVE TO QUARANTINE</span>
                </div>
              );
            }

            if (fefoOverrideWarning) {
              return (
                <div className="p-3 bg-amber-100 text-amber-900 border border-amber-400 rounded-lg text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-700" />
                  <span>WARNING — AN EARLIER-EXPIRY BATCH IS AVAILABLE. VERIFY BEFORE CONTINUING.</span>
                </div>
              );
            }

            return (
              <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>ISSUE THIS BATCH FIRST — EARLIEST EXPIRY</span>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Issue Quantity ({selectedMedForIssue?.unitOfIssue}) *
              </label>
              <input
                type="number"
                min="1"
                value={issueQty}
                onChange={(e) => setIssueQty(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-xs font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Issue Voucher Reference *
              </label>
              <input
                type="text"
                value={voucherRef}
                onChange={(e) => setVoucherRef(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Issued to Department / Detachment *
            </label>
            <input
              type="text"
              value={issuedTo}
              onChange={(e) => setIssuedTo(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-xs"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsIssueModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold"
            >
              {t('action_cancel')}
            </button>
            <button
              type="submit"
              disabled={Boolean(selectedBatchId && batches.find(x => x.id === selectedBatchId && (getDaysRemaining(x.expiryDate) < 0 || x.status === 'EXPIRED')))}
              className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] disabled:bg-slate-400 text-white text-xs font-bold shadow"
            >
              Confirm FEFO Stock Issue
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Medicine Modal */}
      <Modal
        isOpen={isMedModalOpen}
        onClose={() => setIsMedModalOpen(false)}
        title={editingMed ? 'Edit Medicine Record' : 'Add New Medicine Item'}
        subtitle="Medicine scale, authorized quantity, and mandatory expiry date"
      >
        <form onSubmit={handleSaveMed} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Generic Chemical Name *
              </label>
              <input
                type="text"
                value={genericName}
                onChange={(e) => setGenericName(e.target.value)}
                placeholder="e.g. Paracetamol, Ceftriaxone"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Brand Name (Optional)
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g. Napa / Fast"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Strength *</label>
              <input type="text" value={strength} onChange={(e) => setStrength(e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Dosage Form *</label>
              <input type="text" value={dosageForm} onChange={(e) => setDosageForm(e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Unit of Issue *</label>
              <input type="text" value={unitOfIssue} onChange={(e) => setUnitOfIssue(e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Expiry Date * (DD-MM-YYYY)
              </label>
              <input 
                type="date" 
                value={expiryDate} 
                onChange={(e) => setExpiryDate(e.target.value)} 
                className="w-full px-2 py-1.5 border rounded text-xs font-mono font-bold" 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Authorized Quantity *
              </label>
              <input 
                type="number" 
                min="0" 
                value={authQty} 
                onChange={(e) => setAuthQty(Number(e.target.value))} 
                className="w-full px-2 py-1.5 border rounded text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400" 
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Current / On-Hand Qty *
              </label>
              <input 
                type="number" 
                min="0" 
                value={currentQty} 
                onChange={(e) => setCurrentQty(Number(e.target.value))} 
                className="w-full px-2 py-1.5 border rounded text-xs font-mono font-bold text-blue-700 dark:text-blue-400" 
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
                value={currentQty - authQty > 0 ? `+${currentQty - authQty}` : `${currentQty - authQty}`}
                className="w-full px-2 py-1.5 border rounded text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Remarks</label>
            <input
              type="text"
              value={medRemarks}
              onChange={(e) => setMedRemarks(e.target.value)}
              placeholder="e.g. Quarantined, Emergency Reserve..."
              className="w-full px-3 py-1.5 border rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="lasaCheck"
              checked={isLasa}
              onChange={(e) => setIsLasa(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded"
            />
            <label htmlFor="lasaCheck" className="text-xs font-bold text-red-700 dark:text-red-400 cursor-pointer">
              Mark as High-Risk / Look-Alike Sound-Alike (LASA) Medicine
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => setIsMedModalOpen(false)} className="px-4 py-2 rounded-lg bg-slate-200 text-xs font-semibold cursor-pointer">
              {t('action_cancel')}
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow cursor-pointer">
              Save Medicine Record
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
          { name: 'Held vs Auth Stock', label: 'Medicine Holdings & Authorized Quantities', currentValue: `Held Total: ${medicines.reduce((s, m) => s + m.currentQuantity, 0)}` },
          { name: 'Batch Expiry Date', label: 'Batch Expiry & Shelf-Life Classification', currentValue: 'Active Batch Dates' },
          { name: 'Shortage and Excess', label: 'Deficiency / Surplus Variance', currentValue: 'Stock Balance' }
        ]}
        onSuccess={() => {
          // reload data
          db.medicines.toArray().then(m => setMedicines(m));
          db.medicineBatches.toArray().then(b => setBatches(b));
        }}
      />
    </div>
  );
};
