import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { MedicineTransaction, MedicineItem, MedicineBatch } from '../../types';
import { logAuditEvent } from '../../services/auditService';
import { syncEntityToCloud } from '../../services/firebaseSyncService';
import { exportTableToExcel } from '../../services/excelService';
import { Modal } from '../common/Modal';
import { 
  History, Search, Filter, RotateCcw, Calendar, 
  MapPin, User, Package, Download, AlertCircle, 
  CheckCircle2, Clock, ArrowUpDown, ChevronDown, RefreshCw 
} from 'lucide-react';

export const MedicineIssueHistorySubModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { formatNumber } = useLanguage();

  const [transactions, setTransactions] = useState<MedicineTransaction[]>([]);
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [medicineFilter, setMedicineFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [recipientFilter, setRecipientFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [sortField, setSortField] = useState<'date' | 'qty' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Reversal Modal State
  const [reversingTx, setReversingTx] = useState<MedicineTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');
  const [isReversing, setIsReversing] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const txList = await db.medicineTransactions.toArray();
      // Filter only ISSUE transactions (or REVERSAL)
      const issueOnly = txList.filter(t => t.transactionType === 'ISSUE' || t.transactionType === 'REVERSAL_ENTRY');
      setTransactions(issueOnly);

      const medList = await db.medicines.toArray();
      setMedicines(medList);

      const batchList = await db.medicineBatches.toArray();
      setBatches(batchList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleSync = (e: any) => {
      if (e.detail?.collection === 'medicineTransactions' || e.detail?.collection === 'medicines') {
        loadData();
      }
    };
    window.addEventListener('unit-ready-cloud-sync', handleSync);
    return () => window.removeEventListener('unit-ready-cloud-sync', handleSync);
  }, []);

  // Filtered & Sorted Transactions
  const filteredTransactions = transactions.filter(tx => {
    // Reversal or Issue
    if (medicineFilter !== 'ALL' && tx.medicineId !== medicineFilter) return false;
    
    // Date Filtering (Single or Range)
    const txDate = tx.issueDate || (tx.transactionTimestamp ? tx.transactionTimestamp.substring(0, 10) : '');
    if (startDate && txDate < startDate) return false;
    if (endDate && txDate > endDate) return false;

    // Batch Filter
    if (batchFilter.trim() && !tx.batchNumber.toLowerCase().includes(batchFilter.toLowerCase())) return false;

    // Recipient Filter
    if (recipientFilter.trim() && !(tx.issuedToRecipient || '').toLowerCase().includes(recipientFilter.toLowerCase())) return false;

    // Location Filter
    if (locationFilter.trim() && !(tx.placeLocation || '').toLowerCase().includes(locationFilter.toLowerCase())) return false;

    // Free Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (tx.medicineName || '').toLowerCase().includes(q);
      const matchBatch = (tx.batchNumber || '').toLowerCase().includes(q);
      const matchIssueId = (tx.issueId || tx.id || '').toLowerCase().includes(q);
      const matchRecipient = (tx.issuedToRecipient || '').toLowerCase().includes(q);
      const matchLocation = (tx.placeLocation || '').toLowerCase().includes(q);
      const matchVoucher = (tx.voucherReference || '').toLowerCase().includes(q);
      if (!matchName && !matchBatch && !matchIssueId && !matchRecipient && !matchLocation && !matchVoucher) return false;
    }

    return true;
  }).sort((a, b) => {
    if (sortField === 'date') {
      const dateA = a.issueDate || a.transactionTimestamp || '';
      const dateB = b.issueDate || b.transactionTimestamp || '';
      return sortOrder === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    }
    if (sortField === 'qty') {
      return sortOrder === 'asc' ? a.quantity - b.quantity : b.quantity - a.quantity;
    }
    if (sortField === 'name') {
      return sortOrder === 'asc' ? a.medicineName.localeCompare(b.medicineName) : b.medicineName.localeCompare(a.medicineName);
    }
    return 0;
  });

  // Calculate Total Quantity Issued for filtered records (excluding reversed issues)
  const totalQuantityIssued = filteredTransactions
    .filter(tx => !tx.isReversed)
    .reduce((sum, tx) => sum + (Number(tx.quantity) || 0), 0);

  const canManageStock = 
    currentUser.role === 'medicine_operator' || 
    currentUser.role === 'moic' || 
    currentUser.role === 'admin' ||
    (currentUser.role === 'other_operator' && (currentUser.appointmentTitle?.includes('Medicine') || currentUser.appointmentTitle?.includes('Med')));

  const handleOpenReverse = (tx: MedicineTransaction) => {
    setReversingTx(tx);
    setReversalReason('');
  };

  const handleConfirmReversal = async () => {
    if (!reversingTx) return;
    if (!reversalReason.trim()) {
      alert('Please specify an official reason for this reversal.');
      return;
    }

    setIsReversing(true);
    try {
      const nowIso = new Date().toISOString();
      const updatedTx: MedicineTransaction = {
        ...reversingTx,
        isReversed: true,
        reversedAt: nowIso,
        reversedBy: `${currentUser.rank ? currentUser.rank + ' ' : ''}${currentUser.fullName || currentUser.appointmentTitle}`,
        reversalReason: reversalReason.trim()
      };

      // 1. Update Transaction in DB & Cloud
      await db.medicineTransactions.put(updatedTx);
      await syncEntityToCloud('medicineTransactions', updatedTx.id, updatedTx);

      // 2. Restore Medicine Quantities
      const med = await db.medicines.get(reversingTx.medicineId);
      if (med) {
        const restoredIssued = Math.max(0, (med.issuedQuantity || 0) - reversingTx.quantity);
        const restoredHeld = Number(med.heldQuantity ?? med.currentQuantity ?? 0);
        const restoredRcv = Number(med.receivedQuantity ?? 0);
        const restoredBalance = Math.max(0, restoredHeld + restoredRcv - restoredIssued);

        const updatedMed = {
          ...med,
          issuedQuantity: restoredIssued,
          balanceQuantity: restoredBalance,
          currentQuantity: restoredBalance,
          shortageOrExcess: restoredBalance - med.authorizedQuantity,
          updatedAt: nowIso
        };
        await db.medicines.put(updatedMed);
        await syncEntityToCloud('medicines', med.id, updatedMed);
      }

      // 3. Restore Batch Quantity
      if (reversingTx.batchId) {
        const batch = await db.medicineBatches.get(reversingTx.batchId);
        if (batch) {
          const restoredBatchQty = (batch.currentQuantity || 0) + reversingTx.quantity;
          const updatedBatch = {
            ...batch,
            currentQuantity: restoredBatchQty,
            updatedAt: nowIso
          };
          await db.medicineBatches.put(updatedBatch);
          await syncEntityToCloud('medicineBatches', batch.id, updatedBatch);
        }
      }

      // 4. Log Audit Event
      await logAuditEvent(
        currentUser,
        'REVERSAL_ENTRY',
        'med_store_medicine',
        reversingTx.issueId || reversingTx.voucherReference,
        `Reversed issue of ${reversingTx.quantity} ${reversingTx.unit || 'units'} of ${reversingTx.medicineName}. Reason: ${reversalReason.trim()}`
      );

      setReversingTx(null);
      await loadData();
      alert('Transaction reversed successfully. Stock balance has been restored.');
    } finally {
      setIsReversing(false);
    }
  };

  const handleExportExcel = () => {
    const exportRows = filteredTransactions.map(tx => ({
      'Issue ID': tx.issueId || tx.id,
      'Issue Date': tx.issueDate || (tx.transactionTimestamp ? tx.transactionTimestamp.substring(0, 10) : ''),
      'Medicine Name': tx.medicineName,
      'Strength & Form': tx.strengthDosage || '—',
      'Batch Number': tx.batchNumber,
      'Expiry Date': tx.expiryDate || '—',
      'Quantity Issued': tx.quantity,
      'Unit': tx.unit || 'units',
      'Issued To / Recipient': tx.issuedToRecipient || '—',
      'Location / Place': tx.placeLocation || '—',
      'Issued By': tx.issuedByName || tx.performedByAppointment,
      'Remarks': tx.remarks,
      'Status': tx.isReversed ? 'REVERSED' : 'ACTIVE',
      'Reversal Reason': tx.reversalReason || ''
    }));

    exportTableToExcel(exportRows, `Medicine_Issue_History_95FA_${new Date().toISOString().substring(0, 10)}`);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setMedicineFilter('ALL');
    setStartDate('');
    setEndDate('');
    setBatchFilter('');
    setRecipientFilter('');
    setLocationFilter('');
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              Medicine Issue History & Dispensation Log
            </h2>
            <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
              95 FD AMB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Permanent tamper-evident dispensation audit register with FEFO trace and authorized reversals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
            title="Refresh history"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Aggregate Quantity Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Issue Records</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-slate-800 dark:text-white">
              {formatNumber(filteredTransactions.length)}
            </span>
            <span className="text-xs text-slate-400 font-mono">Transactions</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Matching active search & filters</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-300 block">
            Total Quantity Issued (Active)
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-emerald-900 dark:text-emerald-100">
              {formatNumber(totalQuantityIssued)}
            </span>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 font-mono">Units</span>
          </div>
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
            Sum of issued items for selected range
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 block">Reversed Transactions</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-amber-700 dark:text-amber-300">
              {formatNumber(filteredTransactions.filter(t => t.isReversed).length)}
            </span>
            <span className="text-xs text-amber-600 font-mono">Reversals</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Preserved with full audit reason</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              Search & Multi-Parameter Filter Controls
            </h3>
          </div>
          {(searchQuery || medicineFilter !== 'ALL' || startDate || endDate || batchFilter || recipientFilter || locationFilter) && (
            <button
              onClick={clearFilters}
              className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-semibold cursor-pointer"
            >
              Clear All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Issue ID, recipient, voucher..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Medicine Selector */}
          <div>
            <select
              value={medicineFilter}
              onChange={(e) => setMedicineFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">All Medicines ({medicines.length})</option>
              {medicines.map(m => (
                <option key={m.id} value={m.id}>
                  {m.genericName} ({m.strength})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: From */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[10px] text-slate-400 font-bold">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs w-full text-slate-800 dark:text-slate-200 font-mono"
            />
          </div>

          {/* Date Range: To */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[10px] text-slate-400 font-bold">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs w-full text-slate-800 dark:text-slate-200 font-mono"
            />
          </div>
        </div>

        {/* Secondary Row Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
          <div>
            <input
              type="text"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              placeholder="Filter by Batch No..."
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 font-mono"
            />
          </div>

          <div>
            <input
              type="text"
              value={recipientFilter}
              onChange={(e) => setRecipientFilter(e.target.value)}
              placeholder="Filter by Recipient..."
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <input
              type="text"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="Filter by Issue Location..."
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-1.5">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="date">Sort: Issue Date</option>
              <option value="qty">Sort: Quantity</option>
              <option value="name">Sort: Medicine Name</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              title="Toggle Sort Ascending / Descending"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Issue Records Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#1E3316] text-white uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-3">Issue ID</th>
                <th className="py-3 px-3">Issue Date</th>
                <th className="py-3 px-3">Medicine Name</th>
                <th className="py-3 px-3">Strength & Form</th>
                <th className="py-3 px-3">Batch No</th>
                <th className="py-3 px-3">Expiry Date</th>
                <th className="py-3 px-3 text-center">Qty Issued</th>
                <th className="py-3 px-3">Unit</th>
                <th className="py-3 px-3">Recipient</th>
                <th className="py-3 px-3">Place / Location</th>
                <th className="py-3 px-3">Issued By</th>
                <th className="py-3 px-3">Status / Remarks</th>
                {canManageStock && <th className="py-3 px-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-slate-500">
                    No medicine issue transactions found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isRev = tx.isReversed;
                  return (
                    <tr 
                      key={tx.id} 
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        isRev ? 'bg-red-50/40 dark:bg-red-950/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {tx.issueId || tx.voucherReference || tx.id.slice(0, 12)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {tx.issueDate || (tx.transactionTimestamp ? tx.transactionTimestamp.substring(0, 10) : '—')}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {tx.medicineName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {tx.strengthDosage || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {tx.batchNumber}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {tx.expiryDate || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-sm text-emerald-700 dark:text-emerald-400">
                        {formatNumber(tx.quantity)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {tx.unit || 'units'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          {tx.issuedToRecipient || 'General Dispensation'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          {tx.placeLocation || 'MI Room'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap text-[11px]">
                        {tx.issuedByName || tx.performedByAppointment}
                      </td>
                      <td className="py-2.5 px-3 max-w-xs">
                        {isRev ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300">
                              REVERSED
                            </span>
                            <p className="text-[10px] text-red-600 dark:text-red-400 italic truncate" title={tx.reversalReason}>
                              {tx.reversalReason}
                            </p>
                          </div>
                        ) : (
                          <p className="text-slate-500 text-[11px] truncate" title={tx.remarks}>
                            {tx.remarks || '—'}
                          </p>
                        )}
                      </td>
                      {canManageStock && (
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {isRev ? (
                            <span className="text-[10px] text-slate-400 italic">Reversed</span>
                          ) : (
                            <button
                              onClick={() => handleOpenReverse(tx)}
                              className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 text-[10px] font-bold transition cursor-pointer flex items-center gap-1 mx-auto"
                              title="Reverse this issue and return quantities to inventory"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reverse</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reversal Confirmation Modal */}
      {reversingTx && (
        <Modal
          isOpen={true}
          onClose={() => setReversingTx(null)}
          title="Reverse Medicine Issue Transaction"
          subtitle={`Issue ID: ${reversingTx.issueId || reversingTx.voucherReference} | ${reversingTx.medicineName}`}
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-xl border border-amber-300 dark:border-amber-700 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  Are you sure you want to reverse this issue?
                </p>
                <p className="text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                  Reversing this issue will restore <strong>{reversingTx.quantity} {reversingTx.unit}</strong> back into batch <strong>{reversingTx.batchNumber}</strong> and increase the available medicine balance. This transaction will not be erased; it will be marked as REVERSED in the permanent audit trail.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Reason for Reversal / Correction <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g. Prescription cancelled by MO, excess issued returned intact to dispensary..."
                rows={3}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReversingTx(null)}
                disabled={isReversing}
                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReversal}
                disabled={isReversing}
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isReversing ? 'Reversing...' : 'Confirm Reversal & Restore Stock'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
