import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { generateDutyRosterPdf, generateManpowerPdf } from '../../services/pdfService';
import { exportTableToExcel } from '../../services/excelService';
import { logAuditEvent } from '../../services/auditService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart3, FileText, Download, Printer, 
  Users, Truck, Pill, ShieldCheck, AlertTriangle, 
  ShieldAlert, Clock, CheckCircle2, TrendingDown 
} from 'lucide-react';

export const ReportsModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber } = useLanguage();

  const [manpowerState, setManpowerState] = useState<any>(null);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [dutyRosters, setDutyRosters] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);

  useEffect(() => {
    const loadAll = async () => {
      const mp = await db.manpowerDailyStates.orderBy('stateDate').last();
      setManpowerState(mp);
      const plist = await db.manpowerPersonnel.toArray();
      setPersonnel(plist);
      const rosters = await db.dutyRosters.toArray();
      setDutyRosters(rosters);
      const meds = await db.medicines.toArray();
      setMedicines(meds);
      const bList = await db.medicineBatches.toArray();
      setBatches(bList);
    };
    loadAll();
  }, []);

  const now = new Date();
  const getDaysRemaining = (expDateStr: string) => {
    const exp = new Date(expDateStr);
    return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Helper for generating standard Expiry PDF
  const generateExpiryPdf = (title: string, batchList: any[], statusFilterName: string) => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('HEADQUARTERS, 95 FIELD AMBULANCE', 105, 15, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`MEDICAL STORE — ${title.toUpperCase()}`, 105, 22, { align: 'center' });

    doc.setFontSize(8);
    doc.text(`Generated on: ${new Date().toISOString().substring(0, 19).replace('T', ' ')} (Asia/Dhaka) | Appointment: ${currentUser.appointmentTitle}`, 105, 28, { align: 'center' });

    const rows = batchList.map(b => {
      const med = medicines.find(m => m.id === b.medicineId);
      const days = getDaysRemaining(b.expiryDate);
      const val = (med?.unitPrice || 0) * b.currentQuantity;
      return [
        med?.genericName || '—',
        med?.strength || '—',
        b.batchNumber,
        b.currentQuantity,
        b.expiryDate,
        days < 0 ? `EXPIRED (${Math.abs(days)}d)` : `${days} Days`,
        statusFilterName,
        `BDT ${val}`,
        `${b.rack}/${b.shelf}/${b.bin}`
      ];
    });

    autoTable(doc, {
      startY: 34,
      head: [['Medicine Name', 'Strength', 'Batch', 'Qty', 'Expiry Date', 'Remaining', 'Status', 'Valuation', 'Location']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [45, 74, 34], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('“This application is an administrative decision-support system for 95 Fd Amb.”', 105, finalY, { align: 'center' });

    doc.save(`95FA_${title.replace(/\s+/g, '_')}_${new Date().toISOString().substring(0, 10)}.pdf`);
    logAuditEvent(currentUser, 'PDF_GENERATED', 'med_store_medicine', title, `Generated PDF for ${title}`);
  };

  // Helper for generating standard Expiry Excel
  const exportExpiryExcel = (title: string, batchList: any[]) => {
    const data = batchList.map(b => {
      const med = medicines.find(m => m.id === b.medicineId);
      const days = getDaysRemaining(b.expiryDate);
      const val = (med?.unitPrice || 0) * b.currentQuantity;
      return {
        'Unit': '95 Fd Amb',
        'Medicine Name': med?.genericName || '—',
        'Strength': med?.strength || '—',
        'Dosage Form': med?.dosageForm || '—',
        'Batch Number': b.batchNumber,
        'Quantity': b.currentQuantity,
        'Expiry Date': b.expiryDate,
        'Days Remaining': days < 0 ? `EXPIRED (${Math.abs(days)} days ago)` : `${days} Days`,
        'Category / Status': b.status,
        'Unit Price (BDT)': med?.unitPrice || 0,
        'Total Valuation (BDT)': val,
        'Rack / Shelf / Bin': `${b.rack} / ${b.shelf} / ${b.bin}`,
        'Receipt Reference': b.receiptReference || '—'
      };
    });
    exportTableToExcel(data, `95FA_${title.replace(/\s+/g, '_')}_${new Date().toISOString().substring(0, 10)}`);
    logAuditEvent(currentUser, 'EXCEL_EXPORTED', 'med_store_medicine', title, `Exported Excel for ${title}`);
  };

  // Exactly 3 Simplified Batch Sets
  const heldNormalList = batches.filter(b => {
    const d = getDaysRemaining(b.expiryDate);
    return d > 30 && b.status !== 'EXPIRED';
  });
  const shortDatedList = batches.filter(b => {
    const d = getDaysRemaining(b.expiryDate);
    return d >= 0 && d <= 30 && b.status !== 'EXPIRED';
  });
  const expiredList = batches.filter(b => getDaysRemaining(b.expiryDate) < 0 || b.status === 'EXPIRED');

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              {t('nav_reports')} & Documentation Engine
            </h2>
            <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
              95 FD AMB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Dynamic Watermarked PDF Generation, Official Print Formats & Excel/CSV Exports
          </p>
        </div>
      </div>

      {/* Exactly 3 Dedicated Medicine Store Reports Section */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Pill className="w-4 h-4 text-emerald-600" />
          <span>Medicine Store Category Reports (3 Reports)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Held Medicines – Normal Use Report */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-emerald-200 dark:border-emerald-900/50 flex flex-col justify-between hover:border-emerald-500 transition">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>1. Held Medicines – Normal Use</span>
                </span>
                <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                  {heldNormalList.length} Batches
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                All regular held medicine batches with more than 30 days remaining for standard clinical dispensary issue.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button onClick={() => exportExpiryExcel('Held_Medicines_Normal_Use_Report', heldNormalList)} className="px-2.5 py-1 rounded bg-emerald-700 text-white text-xs font-bold cursor-pointer">
                XLSX
              </button>
              <button onClick={() => generateExpiryPdf('Held Medicines – Normal Use Report', heldNormalList, 'HELD MEDICINES – NORMAL USE')} className="px-2.5 py-1 rounded bg-[#2D4A22] text-white text-xs font-bold cursor-pointer">
                PDF
              </button>
            </div>
          </div>

          {/* 2. Short-Dated Medicines – Expiry within 30 Days */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-amber-200 dark:border-amber-900/50 flex flex-col justify-between hover:border-amber-500 transition">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
                  <span>2. Short-Dated (≤ 30 Days)</span>
                </span>
                <span className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-amber-300">
                  {shortDatedList.length} Batches
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Medicines expiring within the next 30 days requiring prioritized FEFO consumption or redistribution.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button onClick={() => exportExpiryExcel('Short_Dated_Medicines_30_Days_Report', shortDatedList)} className="px-2.5 py-1 rounded bg-emerald-700 text-white text-xs font-bold cursor-pointer">
                XLSX
              </button>
              <button onClick={() => generateExpiryPdf('Short-Dated Medicines Report – Expiry within 30 Days', shortDatedList, 'SHORT-DATED (EXPIRY WITHIN 30 DAYS)')} className="px-2.5 py-1 rounded bg-amber-700 text-white text-xs font-bold cursor-pointer">
                PDF
              </button>
            </div>
          </div>

          {/* 3. Expired Medicines Report */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-red-200 dark:border-red-900/50 flex flex-col justify-between hover:border-red-500 transition">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-xs text-red-700 dark:text-red-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  <span>3. Expired Medicines Report</span>
                </span>
                <span className="bg-red-100 text-red-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                  {expiredList.length} Batches
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                All batches whose expiry date has passed. Blocked from issue: “EXPIRED — DO NOT ISSUE”.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button onClick={() => exportExpiryExcel('Expired_Medicine_Report', expiredList)} className="px-2.5 py-1 rounded bg-emerald-700 text-white text-xs font-bold cursor-pointer">
                XLSX
              </button>
              <button onClick={() => generateExpiryPdf('Expired Medicine Report', expiredList, 'EXPIRED — DO NOT ISSUE')} className="px-2.5 py-1 rounded bg-red-700 text-white text-xs font-bold cursor-pointer">
                PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* General Operational Reports Grid */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
          Unit Operational & Administrative Reports
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Manpower Nominal State */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-[#3B5E2B] transition">
            <div>
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Users className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                  Manpower Nominal Roll & Trade State
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Complete nominal roll covering all 10 trades including SMT, with leave schedules and absence tracking.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => {
                  if (manpowerState) generateManpowerPdf(manpowerState, personnel);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold transition flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>

          {/* Part-I Duty Roster Dossier */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-[#3B5E2B] transition">
            <div>
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <FileText className="w-4 h-4 text-purple-600" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                  Part-I Daily Duty Roster Official Dossier
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Official watermarked Part-I Duty Roster with 2IC verification and CO command signatures.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => {
                  if (dutyRosters.length > 0) {
                    const activeRoster = dutyRosters.find(r => r.isPublished) || dutyRosters[0];
                    generateDutyRosterPdf({
                      referenceNo: activeRoster.referenceNo,
                      title: activeRoster.title,
                      dutyDate: activeRoster.dutyDate,
                      dutyCategory: activeRoster.dutyCategory,
                      status: activeRoster.status
                    }, 'CO APPROVED OFFICIAL DOSSIER');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold transition flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
