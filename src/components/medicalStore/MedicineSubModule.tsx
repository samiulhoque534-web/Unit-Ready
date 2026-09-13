import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { MedicineItem, MedicineBatch, ExpiryCategory, SectionApprovalRecord, StockStatusType, MedicineTransaction } from '../../types';
import { Modal } from '../common/Modal';
import { StatusBadge } from '../common/StatusBadge';
import { RequestCorrectionModal } from '../common/RequestCorrectionModal';
import { logAuditEvent } from '../../services/auditService';
import { syncEntityToCloud, deleteEntityFromCloud } from '../../services/firebaseSyncService';
import { 
  Pill, Search, Plus, AlertTriangle, 
  ShieldAlert, CheckCircle, ArrowRight, Clock, 
  Calendar, Layers, FileSpreadsheet, Package, 
  AlertCircle, CheckCircle2, ShieldCheck, Edit3, Send, Trash2,
  TrendingDown, TrendingUp, RefreshCw, MapPin, User, ShieldX
} from 'lucide-react';

export const MedicineSubModule: React.FC = () => {
  const { currentUser, activeDevice } = useAuth();
  const { t, formatNumber } = useLanguage();

  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [approvalRecord, setApprovalRecord] = useState<SectionApprovalRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('ALL');

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
  const [batchNumberInput, setBatchNumberInput] = useState<string>('B-95FA-01');
  const [expiryDate, setExpiryDate] = useState<string>('2027-08-30'); // Mandatory Expiry Date
  const [authQty, setAuthQty] = useState<number>(5000);
  const [heldQty, setHeldQty] = useState<number>(200);
  const [receivedQty, setReceivedQty] = useState<number>(0);
  const [issuedQty, setIssuedQty] = useState<number>(0);
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
  const [issuePlace, setIssuePlace] = useState<string>('Camp Medical Post');
  const [issuedByName, setIssuedByName] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [voucherRef, setVoucherRef] = useState<string>('');
  const [fefoOverrideWarning, setFefoOverrideWarning] = useState<boolean>(false);

  // Success Confirmation State
  const [issueSuccessInfo, setIssueSuccessInfo] = useState<{
    medicineName: string;
    issueId: string;
    quantityIssued: number;
    unit: string;
    remainingBalance: number;
  } | null>(null);

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
      if (
        e.detail?.collection === 'medicines' ||
        e.detail?.collection === 'medicineBatches' ||
        e.detail?.collection === 'sectionApprovals' ||
        e.detail?.collection === 'medicineTransactions'
      ) {
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

  // Helper to compute balance quantity: Held + Received - Issued (never < 0)
  const calculateBalance = (med: MedicineItem): number => {
    const held = Number(med.heldQuantity) || Number(med.currentQuantity) || 0;
    const received = Number(med.receivedQuantity) || 0;
    const issued = Number(med.issuedQuantity) || 0;
    return Math.max(0, held + received - issued);
  };

  // Compute stock status badge and classification
  const getMedicineStockStatus = (med: MedicineItem, earliestExp?: string): StockStatusType => {
    if (med.stockStatus === 'QUARANTINED') return 'QUARANTINED';
    const exp = earliestExp || med.expiryDate;
    const days = getDaysRemaining(exp);
    if (days < 0) return 'EXPIRED';
    const balance = calculateBalance(med);
    if (balance <= 0) return 'OUT_OF_STOCK';
    if (days <= 30) return 'SHORT_DATED';
    if (balance <= (Number(med.minimumLevel) || 100)) return 'LOW_STOCK';
    return 'AVAILABLE';
  };

  const renderStockStatusBadge = (status: StockStatusType) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Available
          </span>
        );
      case 'LOW_STOCK':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Low Stock
          </span>
        );
      case 'OUT_OF_STOCK':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300 dark:bg-red-950 dark:text-red-300">
            <ShieldAlert className="w-3.5 h-3.5 mr-1 text-red-600" />
            Out of Stock
          </span>
        );
      case 'SHORT_DATED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-950 dark:text-orange-300">
            <Clock className="w-3.5 h-3.5 mr-1 text-orange-600" />
            Short-Dated (≤30d)
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-950 text-white border border-rose-800">
            <ShieldX className="w-3.5 h-3.5 mr-1 text-rose-300" />
            Expired (Do Not Issue)
          </span>
        );
      case 'QUARANTINED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950 dark:text-purple-300">
            <AlertCircle className="w-3.5 h-3.5 mr-1 text-purple-600" />
            Quarantined
          </span>
        );
      default:
        return null;
    }
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

  const getBatchesForMed = (medId: string) => {
    return batches
      .filter(b => b.medicineId === medId)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  };

  // Aggregated quantities across all medicines
  const metrics = useMemo(() => {
    let totalAuth = 0;
    let totalHeld = 0;
    let totalReceived = 0;
    let totalIssued = 0;
    let totalBalance = 0;
    let availableCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let shortDatedCount = 0;
    let expiredCount = 0;

    medicines.forEach(m => {
      const auth = Number(m.authorizedQuantity) || 0;
      const held = Number(m.heldQuantity) || Number(m.currentQuantity) || 0;
      const rec = Number(m.receivedQuantity) || 0;
      const iss = Number(m.issuedQuantity) || 0;
      const bal = calculateBalance(m);

      totalAuth += auth;
      totalHeld += held;
      totalReceived += rec;
      totalIssued += iss;
      totalBalance += bal;

      const medBatches = getBatchesForMed(m.id);
      const earliestExp = m.expiryDate || (medBatches.length > 0 ? medBatches[0].expiryDate : '');
      const status = getMedicineStockStatus(m, earliestExp);

      if (status === 'AVAILABLE') availableCount++;
      else if (status === 'LOW_STOCK') lowStockCount++;
      else if (status === 'OUT_OF_STOCK') outOfStockCount++;
      else if (status === 'SHORT_DATED') shortDatedCount++;
      else if (status === 'EXPIRED') expiredCount++;
    });

    return {
      totalAuth,
      totalHeld,
      totalReceived,
      totalIssued,
      totalBalance,
      availableCount,
      lowStockCount,
      outOfStockCount,
      shortDatedCount,
      expiredCount
    };
  }, [medicines, batches]);

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
    const balance = calculateBalance(med);
    if (balance <= 0) {
      alert(`CANNOT ISSUE: ${med.genericName} is OUT OF STOCK. Available Balance is 0.`);
      return;
    }

    setSelectedMedForIssue(med);
    const usableBatches = getBatchesForMed(med.id).filter(
      b => getDaysRemaining(b.expiryDate) >= 0 && b.status !== 'EXPIRED' && b.currentQuantity > 0
    );

    if (usableBatches.length === 0) {
      alert('CANNOT ISSUE: All held batches for this medicine are EXPIRED or depleted. Cannot issue expired stock.');
      return;
    }

    const defaultBatch = usableBatches[0];
    setSelectedBatchId(defaultBatch.id);
    setIssueQty(1);
    setFefoOverrideWarning(false);
    
    // Unique Issue ID: ISS-95FA-YYYYMMDD-XXXX
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.floor(1000 + Math.random() * 9000);
    setVoucherRef(`ISS-95FA-${datePart}-${randPart}`);

    setIssuedTo('MI Room Emergency Bay');
    setIssuePlace('Camp Medical Post');
    setIssuedByName(currentUser.fullName ? `${currentUser.rank || ''} ${currentUser.fullName}` : currentUser.appointmentTitle);
    setIssueDate(new Date().toISOString().slice(0, 10));
    setIsIssueModalOpen(true);
  };

  const handleBatchSelect = (batchId: string) => {
    setSelectedBatchId(batchId);
    if (selectedMedForIssue) {
      const usableBatches = getBatchesForMed(selectedMedForIssue.id).filter(
        b => getDaysRemaining(b.expiryDate) >= 0 && b.status !== 'EXPIRED' && b.currentQuantity > 0
      );
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
      alert('ISSUE BLOCKED — EXPIRED BATCH! Expired stock cannot be issued under military medical regulations.');
      return;
    }

    const currentBalance = calculateBalance(selectedMedForIssue);
    if (issueQty <= 0) {
      alert('Issue quantity must be greater than zero.');
      return;
    }

    if (issueQty > currentBalance) {
      alert(`CANNOT ISSUE: Requested quantity (${issueQty}) exceeds available Balance Quantity (${currentBalance}).`);
      return;
    }

    if (issueQty > targetBatch.currentQuantity) {
      alert(`Selected batch only has ${targetBatch.currentQuantity} units available. Please issue from this batch or select next batch.`);
      return;
    }

    // 1. Deduct from batch
    const updatedBatchQty = targetBatch.currentQuantity - issueQty;
    await db.medicineBatches.update(targetBatch.id, {
      currentQuantity: updatedBatchQty,
      updatedAt: new Date().toISOString()
    });

    // 2. Recalculate medicine quantities:
    // Balance Quantity = Held Quantity + Received Quantity - Issued Quantity
    const currentIssued = Number(selectedMedForIssue.issuedQuantity) || 0;
    const newIssued = currentIssued + issueQty;
    const baseHeld = Number(selectedMedForIssue.heldQuantity) || Number(selectedMedForIssue.currentQuantity) || 0;
    const baseReceived = Number(selectedMedForIssue.receivedQuantity) || 0;
    const newBalance = Math.max(0, baseHeld + baseReceived - newIssued);
    const newShortage = newBalance - (Number(selectedMedForIssue.authorizedQuantity) || 0);

    const medEarliestExp = targetBatch.expiryDate;
    const newStockStatus = getMedicineStockStatus({
      ...selectedMedForIssue,
      heldQuantity: baseHeld,
      receivedQuantity: baseReceived,
      issuedQuantity: newIssued,
      balanceQuantity: newBalance
    }, medEarliestExp);

    await db.medicines.update(selectedMedForIssue.id, {
      issuedQuantity: newIssued,
      balanceQuantity: newBalance,
      currentQuantity: newBalance, // sync currentQuantity for backward compat
      shortageOrExcess: newShortage,
      stockStatus: newStockStatus,
      updatedAt: new Date().toISOString()
    });

    // 3. Create unique transaction record
    const newTx: MedicineTransaction = {
      id: 'tx-' + Date.now(),
      issueId: voucherRef,
      transactionType: 'ISSUE',
      medicineId: selectedMedForIssue.id,
      medicineName: selectedMedForIssue.genericName,
      strengthDosage: `${selectedMedForIssue.strength} (${selectedMedForIssue.dosageForm})`,
      batchId: targetBatch.id,
      batchNumber: targetBatch.batchNumber,
      expiryDate: targetBatch.expiryDate,
      quantity: issueQty,
      unit: selectedMedForIssue.unitOfIssue,
      unitPrice: selectedMedForIssue.unitPrice || 0,
      totalValue: issueQty * (selectedMedForIssue.unitPrice || 0),
      voucherReference: voucherRef,
      issuedToRecipient: issuedTo.trim(),
      placeLocation: issuePlace.trim(),
      issuedByName: issuedByName.trim() || currentUser.appointmentTitle,
      performedByUserId: currentUser.id,
      performedByAppointment: currentUser.appointmentTitle,
      deviceId: activeDevice.id,
      transactionTimestamp: new Date().toISOString(),
      issueDate: issueDate,
      remarks: fefoOverrideWarning
        ? 'FEFO Override: User selected later-expiry batch with recorded justification.'
        : 'Standard FEFO Issue.'
    };

    if (db.medicineTransactions) {
      await db.medicineTransactions.add(newTx);
      await syncEntityToCloud('medicineTransactions', newTx.id, newTx);
    }

    await syncEntityToCloud('medicines', selectedMedForIssue.id, {
      ...selectedMedForIssue,
      issuedQuantity: newIssued,
      balanceQuantity: newBalance,
      currentQuantity: newBalance,
      shortageOrExcess: newShortage,
      stockStatus: newStockStatus
    });

    await syncEntityToCloud('medicineBatches', targetBatch.id, {
      ...targetBatch,
      currentQuantity: updatedBatchQty
    });

    await logAuditEvent(
      currentUser,
      'DRAFT_SAVED',
      'med_store_medicine',
      voucherRef,
      `Issued ${issueQty} ${selectedMedForIssue.unitOfIssue} of ${selectedMedForIssue.genericName} (Batch: ${targetBatch.batchNumber}, Expiry: ${targetBatch.expiryDate}) to ${issuedTo}. Issue ID: ${voucherRef}. Remaining Balance: ${newBalance}.`
    );

    setIsIssueModalOpen(false);
    setIssueSuccessInfo({
      medicineName: selectedMedForIssue.genericName,
      issueId: voucherRef,
      quantityIssued: issueQty,
      unit: selectedMedForIssue.unitOfIssue,
      remainingBalance: newBalance
    });

    loadData();
  };

  const handleOpenAddMed = () => {
    setEditingMed(null);
    setGenericName('');
    setBrandName('');
    setStrength('500 mg');
    setDosageForm('Tablet');
    setUnitOfIssue('Tablets');
    setBatchNumberInput(`B-95FA-${Math.floor(10 + Math.random() * 90)}`);
    setExpiryDate('2027-08-30');
    setAuthQty(5000);
    setHeldQty(200);
    setReceivedQty(0);
    setIssuedQty(0);
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
    setBatchNumberInput(med.batchNumber || 'B-95FA-01');
    setExpiryDate(med.expiryDate);
    setAuthQty(med.authorizedQuantity);
    setHeldQty(med.heldQuantity || med.currentQuantity || 0);
    setReceivedQty(med.receivedQuantity || 0);
    setIssuedQty(med.issuedQuantity || 0);
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
      `Are you sure you want to delete / archive "${med.genericName} (${med.strength})"?\n\nThis will remove the medicine from active inventory while preserving a permanent audit record.`
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

    // Balance calculation: Held + Received - Issued
    const calculatedBal = Math.max(0, Number(heldQty) + Number(receivedQty) - Number(issuedQty));
    const shortage = calculatedBal - Number(authQty);

    if (editingMed) {
      const updated: MedicineItem = {
        ...editingMed,
        genericName: genericName.trim(),
        brandName: brandName.trim(),
        strength,
        dosageForm,
        unitOfIssue,
        batchNumber: batchNumberInput.trim() || editingMed.batchNumber,
        expiryDate,
        authorizedQuantity: Number(authQty),
        heldQuantity: Number(heldQty),
        receivedQuantity: Number(receivedQty),
        issuedQuantity: Number(issuedQty),
        balanceQuantity: calculatedBal,
        currentQuantity: calculatedBal, // sync
        shortageOrExcess: shortage,
        minimumLevel: Number(minLevel),
        maximumLevel: Number(maxLevel),
        unitPrice: Number(unitPrice),
        storageCondition: storage,
        isHighRiskLasa: isLasa,
        dailyConsumptionAverage: Number(dailyConsump),
        remarks: medRemarks.trim(),
        stockStatus: getMedicineStockStatus({
          ...editingMed,
          heldQuantity: Number(heldQty),
          receivedQuantity: Number(receivedQty),
          issuedQuantity: Number(issuedQty),
          balanceQuantity: calculatedBal
        }, expiryDate),
        updatedAt: new Date().toISOString()
      };

      await db.medicines.update(editingMed.id, updated);
      await syncEntityToCloud('medicines', editingMed.id, updated);

      await logAuditEvent(
        currentUser,
        'DRAFT_SAVED',
        'med_store_medicine',
        updated.genericName,
        `Updated medicine record: ${updated.genericName} (${updated.strength}, Balance: ${calculatedBal} ${unitOfIssue}).`
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
        batchNumber: batchNumberInput.trim() || 'B-95FA-01',
        expiryDate,
        authorizedQuantity: Number(authQty),
        heldQuantity: Number(heldQty),
        receivedQuantity: Number(receivedQty),
        issuedQuantity: Number(issuedQty),
        balanceQuantity: calculatedBal,
        currentQuantity: calculatedBal,
        shortageOrExcess: shortage,
        minimumLevel: Number(minLevel),
        maximumLevel: Number(maxLevel),
        unitPrice: Number(unitPrice),
        storageCondition: storage,
        isHighRiskLasa: isLasa,
        dailyConsumptionAverage: Number(dailyConsump),
        remarks: medRemarks.trim(),
        stockStatus: getMedicineStockStatus({
          id: newMedId,
          genericName: genericName.trim(),
          strength,
          dosageForm,
          unitOfIssue,
          expiryDate,
          authorizedQuantity: Number(authQty),
          heldQuantity: Number(heldQty),
          receivedQuantity: Number(receivedQty),
          issuedQuantity: Number(issuedQty),
          balanceQuantity: calculatedBal,
          currentQuantity: calculatedBal,
          shortageOrExcess: shortage,
          minimumLevel: Number(minLevel),
          maximumLevel: Number(maxLevel),
          unitPrice: Number(unitPrice),
          storageCondition: storage,
          isHighRiskLasa: isLasa,
          dailyConsumptionAverage: Number(dailyConsump),
          createdAt: new Date().toISOString()
        }, expiryDate),
        createdAt: new Date().toISOString()
      };

      await db.medicines.add(newMed);
      await syncEntityToCloud('medicines', newMed.id, newMed);

      // Create initial batch corresponding to held quantity
      const newBatch: MedicineBatch = {
        id: 'batch-' + Date.now(),
        medicineId: newMed.id,
        batchNumber: batchNumberInput.trim() || 'B-95FA-01',
        expiryDate,
        receivedQuantity: Number(heldQty) + Number(receivedQty),
        currentQuantity: calculatedBal,
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
        `Added new medicine: ${newMed.genericName} (Expiry: ${expiryDate}, Balance: ${calculatedBal} ${unitOfIssue})`
      );
    }

    setIsMedModalOpen(false);
    loadData();
  };

  const filteredMedicines = medicines.filter(m => {
    const matchesSearch = 
      m.genericName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.brandName && m.brandName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.strength.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.batchNumber && m.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;

    if (stockStatusFilter === 'ALL') return true;

    const medBatches = getBatchesForMed(m.id);
    const earliestExp = m.expiryDate || (medBatches.length > 0 ? medBatches[0].expiryDate : '');
    const status = getMedicineStockStatus(m, earliestExp);
    return status === stockStatusFilter;
  });

  const canEdit = currentUser.role === 'medicine_operator' || currentUser.role === 'moic' || currentUser.role === 'co' || currentUser.role === '2ic' || currentUser.role === 'other_operator' || currentUser.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Read-Only Notice Banner for General Users */}
      {!canEdit && (
        <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>Read-Only View Mode:</strong> You are logged in as <strong>{currentUser.appointmentTitle}</strong>. Medicine issuing and inventory alterations are restricted to Medical Store Operators, MOIC & Commanding Officer.
            </span>
          </div>
          <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded font-bold">
            VIEW ONLY
          </span>
        </div>
      )}

      {/* Numerical Stock Calculation Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Card 1: Authorized Quantity */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">1. Authorized Qty</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-slate-800 dark:text-slate-100">{formatNumber(metrics.totalAuth)}</span>
            <span className="text-[10px] text-slate-400 font-mono">Scale</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">{medicines.length} Catalogued Items</p>
        </div>

        {/* Card 2: Held Quantity */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 block">2. Held Qty</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-blue-700 dark:text-blue-300">{formatNumber(metrics.totalHeld)}</span>
            <span className="text-[10px] text-blue-500 font-mono">Base</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Starting held holdings</p>
        </div>

        {/* Card 3: Received Quantity */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 block">3. Received Qty</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-indigo-700 dark:text-indigo-300">+{formatNumber(metrics.totalReceived)}</span>
            <span className="text-[10px] text-indigo-500 font-mono">Total In</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Incoming depot deliveries</p>
        </div>

        {/* Card 4: Issued Quantity */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-orange-600 dark:text-orange-400 block">4. Issued Qty</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-orange-700 dark:text-orange-300">-{formatNumber(metrics.totalIssued)}</span>
            <span className="text-[10px] text-orange-500 font-mono">Total Out</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Issued to bays & patients</p>
        </div>

        {/* Card 5: Balance Quantity (Held + Received - Issued >= 0) */}
        <div className="p-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase text-emerald-900 dark:text-emerald-200">
              5. Balance Quantity
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-emerald-900 dark:text-emerald-100">
              {formatNumber(metrics.totalBalance)}
            </span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono font-bold">Available</span>
          </div>
          <p className="text-[10px] text-emerald-800 dark:text-emerald-300 mt-1 font-mono">
            Held + Rcvd − Issued ≥ 0
          </p>
        </div>
      </div>

      {/* Quick Status Badges Summary */}
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setStockStatusFilter(stockStatusFilter === 'AVAILABLE' ? 'ALL' : 'AVAILABLE')}
          className={`px-3 py-1.5 rounded-lg border font-semibold transition flex items-center gap-1.5 ${
            stockStatusFilter === 'AVAILABLE'
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Available ({metrics.availableCount})
        </button>

        <button
          onClick={() => setStockStatusFilter(stockStatusFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK')}
          className={`px-3 py-1.5 rounded-lg border font-semibold transition flex items-center gap-1.5 ${
            stockStatusFilter === 'LOW_STOCK'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Low Stock ({metrics.lowStockCount})
        </button>

        <button
          onClick={() => setStockStatusFilter(stockStatusFilter === 'SHORT_DATED' ? 'ALL' : 'SHORT_DATED')}
          className={`px-3 py-1.5 rounded-lg border font-semibold transition flex items-center gap-1.5 ${
            stockStatusFilter === 'SHORT_DATED'
              ? 'bg-orange-600 text-white border-orange-600'
              : 'bg-white text-orange-800 border-orange-300 hover:bg-orange-50'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Short-Dated ≤30d ({metrics.shortDatedCount})
        </button>

        <button
          onClick={() => setStockStatusFilter(stockStatusFilter === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
          className={`px-3 py-1.5 rounded-lg border font-semibold transition flex items-center gap-1.5 ${
            stockStatusFilter === 'EXPIRED'
              ? 'bg-red-700 text-white border-red-700'
              : 'bg-white text-red-800 border-red-300 hover:bg-red-50'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Expired ({metrics.expiredCount})
        </button>

        <button
          onClick={() => setStockStatusFilter(stockStatusFilter === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK')}
          className={`px-3 py-1.5 rounded-lg border font-semibold transition flex items-center gap-1.5 ${
            stockStatusFilter === 'OUT_OF_STOCK'
              ? 'bg-rose-700 text-white border-rose-700'
              : 'bg-white text-rose-800 border-rose-300 hover:bg-rose-50'
          }`}
        >
          <ShieldX className="w-3.5 h-3.5" />
          Out of Stock ({metrics.outOfStockCount})
        </button>

        {stockStatusFilter !== 'ALL' && (
          <button
            onClick={() => setStockStatusFilter('ALL')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search generic medicine name, batch number, strength..."
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {approvalRecord && <StatusBadge status={approvalRecord.status} />}

          {/* Issue Medicine Action Button */}
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                const firstAvailable = medicines.find(m => calculateBalance(m) > 0);
                if (firstAvailable) {
                  handleOpenIssue(firstAvailable);
                } else {
                  alert('No medicines currently have available balance stock to issue.');
                }
              }}
              className="px-4 py-2 rounded-xl bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-extrabold shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 text-amber-400" />
              <span>Issue Medicine</span>
            </button>
          )}

          {/* Add Medicine Button */}
          {canEdit && (
            <button
              type="button"
              onClick={handleOpenAddMed}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
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

      {/* Main Medicine Inventory List */}
      <div className="space-y-4">
        {filteredMedicines.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 text-slate-500 text-sm">
            No medicine items matched your search query or status filter.
          </div>
        ) : (
          filteredMedicines.map((m) => {
            const medBatches = getBatchesForMed(m.id);
            const earliestExpiry = m.expiryDate || (medBatches.length > 0 ? medBatches[0].expiryDate : '');
            const daysRemaining = getDaysRemaining(earliestExpiry);
            const expInfo = getExpiryCategoryInfo(earliestExpiry);

            const heldVal = Number(m.heldQuantity) || Number(m.currentQuantity) || 0;
            const receivedVal = Number(m.receivedQuantity) || 0;
            const issuedVal = Number(m.issuedQuantity) || 0;
            const balanceVal = calculateBalance(m);
            const stockStatus = getMedicineStockStatus(m, earliestExpiry);

            // Primary batch number
            const primaryBatch = m.batchNumber || (medBatches.length > 0 ? medBatches[0].batchNumber : 'N/A');

            return (
              <div 
                key={m.id}
                className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                        {m.genericName}
                      </h3>
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs px-2.5 py-0.5 rounded">
                        {m.strength} ({m.dosageForm})
                      </span>
                      {renderStockStatusBadge(stockStatus)}
                      {m.isHighRiskLasa && (
                        <span className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-black text-[10px] px-2 py-0.5 rounded border border-red-400">
                          LASA HIGH RISK
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-mono mt-1">
                      <span>Brand: <strong className="text-slate-700 dark:text-slate-300">{m.brandName || 'Generic'}</strong></span>
                      <span>Batch: <strong className="text-indigo-700 dark:text-indigo-400">{primaryBatch}</strong></span>
                      <span>Unit: <strong>{m.unitOfIssue}</strong></span>
                      <span>Storage: {m.storageCondition}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <>
                        <button
                          onClick={() => handleOpenIssue(m)}
                          disabled={balanceVal <= 0 || stockStatus === 'EXPIRED'}
                          className="px-3.5 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] disabled:bg-slate-300 disabled:text-slate-500 text-white text-xs font-bold shadow flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
                          <span>Issue Medicine</span>
                        </button>

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
                      </>
                    ) : (
                      <span className="text-slate-400 font-mono text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded font-semibold">
                        View Only
                      </span>
                    )}
                  </div>
                </div>

                {/* Mandatory Numerical Quantities Display Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center font-mono">
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block font-sans">Authorized</span>
                    <strong className="text-sm text-slate-900 dark:text-slate-100">{formatNumber(m.authorizedQuantity)}</strong>
                    <span className="text-[10px] text-slate-400 block font-sans">{m.unitOfIssue}</span>
                  </div>

                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80">
                    <span className="text-[9px] text-blue-600 font-bold uppercase block font-sans">Held / Base</span>
                    <strong className="text-sm text-blue-700 dark:text-blue-300">{formatNumber(heldVal)}</strong>
                    <span className="text-[10px] text-slate-400 block font-sans">{m.unitOfIssue}</span>
                  </div>

                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80">
                    <span className="text-[9px] text-indigo-600 font-bold uppercase block font-sans">Received</span>
                    <strong className="text-sm text-indigo-700 dark:text-indigo-300">+{formatNumber(receivedVal)}</strong>
                    <span className="text-[10px] text-slate-400 block font-sans">{m.unitOfIssue}</span>
                  </div>

                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80">
                    <span className="text-[9px] text-orange-600 font-bold uppercase block font-sans">Issued</span>
                    <strong className="text-sm text-orange-700 dark:text-orange-300">-{formatNumber(issuedVal)}</strong>
                    <span className="text-[10px] text-slate-400 block font-sans">{m.unitOfIssue}</span>
                  </div>

                  {/* Balance Quantity = Held + Received - Issued */}
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-500">
                    <span className="text-[9px] text-emerald-800 dark:text-emerald-300 font-black uppercase block font-sans">
                      Balance Qty
                    </span>
                    <strong className="text-base text-emerald-900 dark:text-emerald-100 font-black">
                      {formatNumber(balanceVal)}
                    </strong>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-sans font-bold">
                      {m.unitOfIssue}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block font-sans">Deficiency/Excess</span>
                    <strong className={`text-sm ${balanceVal - m.authorizedQuantity < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {balanceVal - m.authorizedQuantity > 0 ? `+${balanceVal - m.authorizedQuantity}` : balanceVal - m.authorizedQuantity}
                    </strong>
                    <span className="text-[10px] text-slate-400 block font-sans">vs Auth</span>
                  </div>
                </div>

                {/* Expiry and Dates Row */}
                <div className="flex flex-wrap items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 font-mono">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-[11px] text-slate-500 font-sans font-bold">Expiry Date:</span>
                    <strong className="text-slate-800 dark:text-white">{formatDateDDMMYYYY(earliestExpiry)}</strong>
                    <span className="text-slate-500 text-[11px]">
                      ({daysRemaining < 0 ? `Expired ${Math.abs(daysRemaining)}d ago` : `${daysRemaining} days remaining`})
                    </span>
                  </div>

                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] ${expInfo.badgeStyle}`}>
                      {expInfo.warningText}
                    </span>
                  </div>
                </div>

                {/* Batches Table */}
                {medBatches.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#F8F9F5] dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 text-[10px] uppercase font-bold">
                        <tr>
                          <th className="py-2 px-3">Batch Number</th>
                          <th className="py-2 px-3">Batch Held Qty</th>
                          <th className="py-2 px-3">Expiry Date (DD-MM-YYYY)</th>
                          <th className="py-2 px-3">Days Remaining</th>
                          <th className="py-2 px-3">Classification</th>
                          <th className="py-2 px-3">Rack / Shelf / Bin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {medBatches.map((b) => {
                          const days = getDaysRemaining(b.expiryDate);
                          const batchExpInfo = getExpiryCategoryInfo(b.expiryDate, b.status === 'EXPIRED');

                          return (
                            <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                              <td className="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                                {b.batchNumber}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold">
                                {formatNumber(b.currentQuantity)} {m.unitOfIssue}
                              </td>
                              <td className="py-2 px-3 font-mono font-semibold">
                                {formatDateDDMMYYYY(b.expiryDate)}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold">
                                {days < 0 ? (
                                  <span className="text-red-500 font-bold">Passed ({Math.abs(days)}d ago)</span>
                                ) : (
                                  <span>{formatNumber(days)} Days</span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] ${batchExpInfo.badgeStyle}`}>
                                  {batchExpInfo.warningText}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                                {b.rack} / {b.shelf} / {b.bin}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* FEFO Issue Stock Modal */}
      <Modal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        title={`Issue Medicine: ${selectedMedForIssue?.genericName} (${selectedMedForIssue?.strength})`}
        subtitle="Deducts directly from available balance with automatic FEFO batch selection"
      >
        <form onSubmit={handleExecuteIssue} className="space-y-4">
          {/* Real-time Balance Box */}
          {selectedMedForIssue && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 block">
                  Current Balance Quantity:
                </span>
                <span className="text-lg font-black font-mono text-indigo-900 dark:text-indigo-100">
                  {calculateBalance(selectedMedForIssue)} {selectedMedForIssue.unitOfIssue}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">Unit Form:</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {selectedMedForIssue.dosageForm} ({selectedMedForIssue.unitOfIssue})
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Select Batch (FEFO - Earliest Expiry Prioritized) *
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
                    Batch: {b.batchNumber} | Exp: {formatDateDDMMYYYY(b.expiryDate)} ({days}d) | Available: {b.currentQuantity} {isExp ? '[EXPIRED - CANNOT ISSUE]' : ''}
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
                  <span>EXPIRED BATCH — DO NOT ISSUE — MOVE TO QUARANTINE</span>
                </div>
              );
            }

            if (fefoOverrideWarning) {
              return (
                <div className="p-3 bg-amber-100 text-amber-900 border border-amber-400 rounded-lg text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-700" />
                  <span>WARNING: AN EARLIER-EXPIRING BATCH IS AVAILABLE. FEFO PRINCIPLE APPLIES.</span>
                </div>
              );
            }

            return (
              <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>FEFO COMPLIANT: Issuing from earliest expiring batch</span>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Quantity to Issue ({selectedMedForIssue?.unitOfIssue}) *
              </label>
              <input
                type="number"
                min="1"
                max={selectedMedForIssue ? calculateBalance(selectedMedForIssue) : 9999}
                value={issueQty}
                onChange={(e) => setIssueQty(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-xs font-mono font-bold"
                required
              />
              {selectedMedForIssue && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Remaining after issue:{' '}
                  <strong className="text-emerald-700 font-mono">
                    {Math.max(0, calculateBalance(selectedMedForIssue) - issueQty)} {selectedMedForIssue.unitOfIssue}
                  </strong>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Unique Issue ID / Voucher # *
              </label>
              <input
                type="text"
                value={voucherRef}
                onChange={(e) => setVoucherRef(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs font-mono font-bold text-indigo-700 bg-slate-50"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Recipient / Sub-unit / Department / MI Room / Individual *
              </label>
              <input
                type="text"
                value={issuedTo}
                onChange={(e) => setIssuedTo(e.target.value)}
                placeholder="e.g. MI Room Emergency Bay, Sgt Tariq"
                className="w-full px-3 py-2 border rounded-lg text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Place / Location *
              </label>
              <input
                type="text"
                value={issuePlace}
                onChange={(e) => setIssuePlace(e.target.value)}
                placeholder="e.g. Camp Medical Post, Dressing Room"
                className="w-full px-3 py-2 border rounded-lg text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Issued By *
              </label>
              <input
                type="text"
                value={issuedByName}
                onChange={(e) => setIssuedByName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Issue Date *
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs font-mono"
                required
              />
            </div>
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
              disabled={
                Boolean(
                  selectedBatchId &&
                  batches.find(
                    x => x.id === selectedBatchId && (getDaysRemaining(x.expiryDate) < 0 || x.status === 'EXPIRED')
                  )
                ) ||
                !selectedMedForIssue ||
                issueQty <= 0 ||
                issueQty > calculateBalance(selectedMedForIssue)
              }
              className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] disabled:bg-slate-400 text-white text-xs font-bold shadow transition cursor-pointer"
            >
              Confirm Issue & Deduct Balance
            </button>
          </div>
        </form>
      </Modal>

      {/* Issue Confirmation Modal */}
      {issueSuccessInfo && (
        <Modal
          isOpen={true}
          onClose={() => setIssueSuccessInfo(null)}
          title="Medicine Issued Successfully"
          subtitle="Stock balances updated across local database and cloud ledger"
        >
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Issue Voucher Confirmed
              </div>
              <div className="text-xs space-y-1 font-mono">
                <div>Issue ID: <strong>{issueSuccessInfo.issueId}</strong></div>
                <div>Medicine: <strong>{issueSuccessInfo.medicineName}</strong></div>
                <div>Issued Quantity: <strong>{issueSuccessInfo.quantityIssued} {issueSuccessInfo.unit}</strong></div>
                <div className="text-emerald-800 font-bold pt-1 border-t border-emerald-200">
                  Updated Balance Quantity: {issueSuccessInfo.remainingBalance} {issueSuccessInfo.unit}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setIssueSuccessInfo(null)}
                className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700"
              >
                Close Confirmation
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Edit Medicine Modal */}
      <Modal
        isOpen={isMedModalOpen}
        onClose={() => setIsMedModalOpen(false)}
        title={editingMed ? 'Edit Medicine Record' : 'Add New Medicine Item'}
        subtitle="Medicine scale, authorized holdings, and mandatory expiry date"
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
              <input type="text" value={unitOfIssue} onChange={(e) => setUnitOfIssue(e.target.value)} placeholder="tablet, vial, ampoule..." className="w-full px-2 py-1.5 border rounded text-xs" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Primary Batch # *
              </label>
              <input 
                type="text" 
                value={batchNumberInput} 
                onChange={(e) => setBatchNumberInput(e.target.value)} 
                className="w-full px-2 py-1.5 border rounded text-xs font-mono font-bold" 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Authorized Qty *
              </label>
              <input 
                type="number" 
                min="0" 
                value={authQty} 
                onChange={(e) => setAuthQty(Number(e.target.value))} 
                className="w-full px-2 py-1.5 border rounded text-xs font-mono font-bold text-slate-800" 
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Held / Base Qty *
              </label>
              <input 
                type="number" 
                min="0" 
                value={heldQty} 
                onChange={(e) => setHeldQty(Number(e.target.value))} 
                className="w-full px-2 py-1.5 border rounded text-xs font-mono font-bold text-blue-700" 
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Received Qty
              </label>
              <input 
                type="number" 
                min="0" 
                value={receivedQty} 
                onChange={(e) => setReceivedQty(Number(e.target.value))} 
                className="w-full px-2 py-1.5 border rounded text-xs font-mono font-bold text-indigo-700" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Issued Qty
              </label>
              <input 
                type="number" 
                min="0" 
                value={issuedQty} 
                onChange={(e) => setIssuedQty(Number(e.target.value))} 
                className="w-full px-2 py-1.5 border rounded text-xs font-mono font-bold text-orange-700" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Calculated Balance Qty
              </label>
              <input 
                type="text" 
                disabled 
                value={Math.max(0, Number(heldQty) + Number(receivedQty) - Number(issuedQty))}
                className="w-full px-2 py-1.5 border rounded text-xs font-mono font-extrabold bg-emerald-50 text-emerald-900 border-emerald-400" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Shortage / Excess
              </label>
              <input 
                type="text" 
                disabled 
                value={
                  Math.max(0, Number(heldQty) + Number(receivedQty) - Number(issuedQty)) - authQty > 0
                    ? `+${Math.max(0, Number(heldQty) + Number(receivedQty) - Number(issuedQty)) - authQty}`
                    : `${Math.max(0, Number(heldQty) + Number(receivedQty) - Number(issuedQty)) - authQty}`
                }
                className="w-full px-2 py-1.5 border rounded text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700" 
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
          { name: 'Held vs Auth Stock', label: 'Medicine Holdings & Authorized Quantities', currentValue: `Balance Total: ${metrics.totalBalance}` },
          { name: 'Batch Expiry Date', label: 'Batch Expiry & Shelf-Life Classification', currentValue: 'Active Batch Dates' },
          { name: 'Shortage and Excess', label: 'Deficiency / Surplus Variance', currentValue: 'Stock Balance' }
        ]}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
};

export default MedicineSubModule;
