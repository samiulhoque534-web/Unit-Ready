import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { 
  ManpowerDailyState, ManpowerPersonnel, SectionApprovalRecord, 
  ParadeState, ParadeStatePersonnelItem, CorrectionRequest, PersonnelTrade,
  RankTradeDistributionItem
} from '../../types';
import { initialRankTradeDistributions } from '../../db/seedData';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { RequestCorrectionModal } from '../common/RequestCorrectionModal';
import { exportTableToExcel } from '../../services/excelService';
import { logAuditEvent } from '../../services/auditService';
import { sendPhoneSmsAlert, DEFAULT_UNIT_PHONE } from '../../services/smsService';
import { syncEntityToCloud, deleteEntityFromCloud } from '../../services/firebaseSyncService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Users, Plus, Search, Filter, Download, 
  Send, Edit, CheckCircle2, UserCheck, AlertTriangle, 
  CalendarCheck, Clock, ShieldCheck, Printer, Save, 
  Lock, Unlock, Sparkles, Activity, FileText, Check, ChevronRight, Layers, Edit3, Trash2
} from 'lucide-react';
import { ParadeStateModule } from '../paradeState/ParadeStateModule';

interface ManpowerModuleProps {
  onNavigate?: (path: string) => void;
  defaultTab?: 'PARADE_STATE' | 'NOMINAL_ROLL' | 'STRENGTH_SUMMARY';
}

export const ManpowerModule: React.FC<ManpowerModuleProps> = ({ onNavigate, defaultTab = 'PARADE_STATE' }) => {
  const { currentUser } = useAuth();
  const { t, formatNumber, language } = useLanguage();

  // Active Tab: 'PARADE_STATE' | 'NOMINAL_ROLL' | 'STRENGTH_SUMMARY'
  const [activeTab, setActiveTab] = useState<'PARADE_STATE' | 'NOMINAL_ROLL' | 'STRENGTH_SUMMARY'>(defaultTab);

  // Correction Request Modal State
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState<boolean>(false);
  const [correctionRecordTitle, setCorrectionRecordTitle] = useState<string>('Daily Parade State');
  const [correctionField, setCorrectionField] = useState<string>('Tomorrow Activities / Medical Cover');
  const [correctionExistingVal, setCorrectionExistingVal] = useState<string>('');

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Selected date (Defaults to current Asia/Dhaka date)
  const getTodayDhakaDate = () => {
    const now = new Date();
    const dtf = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' });
    return dtf.format(now); // "YYYY-MM-DD"
  };

  const todayStr = getTodayDhakaDate();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [allAvailableDates, setAllAvailableDates] = useState<string[]>([]);
  const [isEditingParade, setIsEditingParade] = useState<boolean>(false);
  const [activeCorrection, setActiveCorrection] = useState<CorrectionRequest | null>(null);

  // States
  const [paradeState, setParadeState] = useState<ParadeState | null>(null);
  const [dailyManpowerState, setDailyManpowerState] = useState<ManpowerDailyState | null>(null);
  const [personnelList, setPersonnelList] = useState<ManpowerPersonnel[]>([]);
  const [approvalRecord, setApprovalRecord] = useState<SectionApprovalRecord | null>(null);

  // Dynamic Rank & Trade Distribution State (Stored permanently in IndexedDB + Cloud Firestore)
  const [rankTradeList, setRankTradeList] = useState<RankTradeDistributionItem[]>([]);
  const [isRankTradeModalOpen, setIsRankTradeModalOpen] = useState<boolean>(false);
  const [editingRankTrade, setEditingRankTrade] = useState<RankTradeDistributionItem | null>(null);
  const [rtClassification, setRtClassification] = useState<string>('');
  const [rtTradeCode, setRtTradeCode] = useState<string>('');
  const [rtAuthCount, setRtAuthCount] = useState<number>(1);
  const [rtPostedCount, setRtPostedCount] = useState<number>(1);
  const [rtPresentCount, setRtPresentCount] = useState<number>(1);
  const [rtRemarks, setRtRemarks] = useState<string>('');
  const [isSavingRtd, setIsSavingRtd] = useState<boolean>(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);
  const [saveStatusType, setSaveStatusType] = useState<'SUCCESS' | 'ERROR' | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Parade Strength fields
  const [strOffrs, setStrOffrs] = useState<number>(6);
  const [strJco, setStrJco] = useState<number>(8);
  const [strOrs, setStrOrs] = useState<number>(140);
  const [strNce, setStrNce] = useState<number>(12);
  const [strNcu, setStrNcu] = useState<number>(4);

  // Out Unit Category Breakdown Counts
  const [cLeaveCount, setCLeaveCount] = useState<number>(4);
  const [pLeaveCount, setPLeaveCount] = useState<number>(9);
  const [medLeaveCount, setMedLeaveCount] = useState<number>(2);
  const [cmhAdmittedCount, setCmhAdmittedCount] = useState<number>(1);
  const [maternityLeaveCount, setMaternityLeaveCount] = useState<number>(0);
  const [courseCount, setCourseCount] = useState<number>(4);
  const [tyAttCount, setTyAttCount] = useState<number>(2);
  const [otherOutCount, setOtherOutCount] = useState<number>(0);

  // Lists & Text fields
  const [activitiesList, setActivitiesList] = useState<string[]>([
    '0600 hrs: Morning Physical Training & Unit Muster',
    '0830 hrs: SMT Clinical Inspection & Emergency Tray Check',
    '1030 hrs: Casevac Drill & Ambulance Readiness Inspection',
    '1430 hrs: Unit Hygiene & Bio-Medical Waste Clearance'
  ]);
  const [medicalCoverList, setMedicalCoverList] = useState<string[]>([
    '01 x Ambulance + 02 x SMT at Divisional Firing Range (Capt MO + SMT)',
    '01 x First Aid Team at Brigade Road March (0700-1100 hrs)'
  ]);
  const [foodMenu, setFoodMenu] = useState<string>('Breakfast: Khichuri, Egg, Tea | Lunch: Rice, Chicken Curry, Dal, Salad | Dinner: Roti, Vegetable, Beef, Dal');
  const [greeting, setGreeting] = useState<string>('Assalamualaikum Sir');
  const [closingRegards, setClosingRegards] = useState<string>('Profound Regards');

  // Input helpers for adding items
  const [newActivity, setNewActivity] = useState<string>('');
  const [newMedCover, setNewMedCover] = useState<string>('');

  // Constants
  const ALL_RANKS = ['LT Col', 'Maj', 'Capt', 'Lt', '2Lt', 'SWO', 'WO', 'Sgt', 'Cpl', 'Lcpl', 'Snk'];
  const ALL_TRADES: PersonnelTrade[] = [
    'Offr',
    'JCO',
    'MA',
    'MT',
    'SMT',
    'Clk',
    'Lab Tech',
    'OTA',
    'Disp',
    'EME',
    'Tradesman',
    'Cook',
    'NC(E)',
    'NC(U)'
  ];

  // Personnel Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPerson, setEditingPerson] = useState<ManpowerPersonnel | null>(null);
  const [pNo, setPNo] = useState<string>('');
  const [pRank, setPRank] = useState<string>('Snk');
  const [pName, setPName] = useState<string>('');
  const [pTrade, setPTrade] = useState<PersonnelTrade>('MA');
  const [pAppt, setPAppt] = useState<string>('');
  const [pSec, setPSec] = useState<string>('Med');
  const [pStatus, setPStatus] = useState<any>('PRESENT');
  const [pFromDate, setPFromDate] = useState<string>(todayStr);
  const [pReturnDate, setPReturnDate] = useState<string>('');
  const [pQual, setPQual] = useState<string>('Special Medical Trade (SMT)');
  const [pRemarks, setPRemarks] = useState<string>('');

  // Additional Filters
  const [tradeFilter, setTradeFilter] = useState<string>('ALL');
  const [rankFilter, setRankFilter] = useState<string>('ALL');

  // Calculations
  const totalStrength = Number(strOffrs) + Number(strJco) + Number(strOrs) + Number(strNce) + Number(strNcu);
  const calculatedOutUnit = 
    Number(cLeaveCount) + 
    Number(pLeaveCount) + 
    Number(medLeaveCount) + 
    Number(cmhAdmittedCount) + 
    Number(maternityLeaveCount) + 
    Number(courseCount) + 
    Number(tyAttCount) + 
    Number(otherOutCount);
  const calculatedOnParade = Math.max(0, totalStrength - calculatedOutUnit);

  // Load data for date
  const loadData = async (targetDate: string = selectedDate) => {
    // 1. Available Dates
    const allRecords = await db.paradeStates.orderBy('stateDate').reverse().toArray();
    const dates = allRecords.map(r => r.stateDate);
    if (!dates.includes(todayStr)) {
      dates.unshift(todayStr);
    }
    setAllAvailableDates(Array.from(new Set(dates)));

    // 2. Active Corrections
    const activeCorr = await db.correctionRequests
      .filter(c => c.status === 'CO_APPROVED_UNLOCKED' && (c.recordTypeOrDate.toLowerCase().includes('parade') || c.recordTypeOrDate.includes(targetDate) || c.recordTypeOrDate.toLowerCase().includes('manpower')))
      .first();
    setActiveCorrection(activeCorr || null);

    // 3. Parade State Record
    let record = await db.paradeStates.where('stateDate').equals(targetDate).first();
    if (!record && targetDate === todayStr) {
      const freshRecord: ParadeState = {
        id: `parade-${targetDate}`,
        stateDate: targetDate,
        dayOfWeek: new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Dhaka' }).format(new Date()),
        greeting: 'Assalamualaikum Sir',
        strOffrs: 6,
        strJco: 8,
        strOrs: 140,
        strNce: 12,
        strNcu: 4,
        totalStrength: 170,
        onParadeCount: 148,
        outUnitTotal: 22,
        outUnitBreakdown: {
          cLeave: 4,
          pLeave: 9,
          medicalLeave: 2,
          cmhAdmitted: 1,
          maternityLeave: 0,
          course: 4,
          temporaryAttachment: 2,
          otherOutUnit: 0
        },
        personnelList: [],
        cLeaveDetails: [],
        pLeaveDetails: [],
        medicalLeaveDetails: [],
        cmhAdmittedDetails: [],
        maternityLeaveDetails: [],
        courseDetails: ['02 x Nursing Asst (Adv Course AFMSD)', '02 x Driver (Spl MT Trg)'],
        tyAttDetails: ['02 x ORs attached to HQ 55 Inf Div Med Branch'],
        otherOutDetails: [],
        tomorrowActivities: [
          '0600 hrs: Morning Physical Training & Unit Muster',
          '0830 hrs: SMT Clinical Inspection & Emergency Tray Check',
          '1030 hrs: Casevac Drill & Ambulance Readiness Inspection',
          '1430 hrs: Unit Hygiene & Bio-Medical Waste Clearance'
        ],
        medicalCover: [
          '01 x Ambulance + 02 x SMT at Divisional Firing Range (Capt MO + SMT)',
          '01 x First Aid Team at Brigade Road March (0700-1100 hrs)'
        ],
        foodMenu: 'Breakfast: Khichuri, Egg, Tea | Lunch: Rice, Chicken Curry, Dal, Salad | Dinner: Roti, Vegetable, Beef, Dal',
        closingRegards: 'Profound Regards',
        status: 'DRAFT',
        version: '1.0',
        preparedBy: 'Manpower Operator',
        updatedAt: new Date().toISOString()
      };
      await db.paradeStates.put(freshRecord);
      record = freshRecord;
    }

    if (record) {
      setParadeState(record);
      setStrOffrs(record.strOffrs || 6);
      setStrJco(record.strJco || 8);
      setStrOrs(record.strOrs || 140);
      setStrNce(record.strNce || 12);
      setStrNcu(record.strNcu || 4);

      if (record.outUnitBreakdown) {
        setCLeaveCount(record.outUnitBreakdown.cLeave);
        setPLeaveCount(record.outUnitBreakdown.pLeave);
        setMedLeaveCount(record.outUnitBreakdown.medicalLeave);
        setCmhAdmittedCount(record.outUnitBreakdown.cmhAdmitted);
        setMaternityLeaveCount(record.outUnitBreakdown.maternityLeave);
        setCourseCount(record.outUnitBreakdown.course);
        setTyAttCount(record.outUnitBreakdown.temporaryAttachment);
        setOtherOutCount(record.outUnitBreakdown.otherOutUnit || 0);
      }

      setActivitiesList(record.tomorrowActivities || []);
      setMedicalCoverList(record.medicalCover || []);
      setFoodMenu(record.foodMenu || '');
      setGreeting(record.greeting || 'Assalamualaikum Sir');
      setClosingRegards(record.closingRegards || 'Profound Regards');
    }

    // 4. Nominal Roll List
    const mList = await db.manpowerPersonnel.toArray();
    setPersonnelList(mList);

    // 5. Section Approval
    const appr = await db.sectionApprovals.where('section').equals('manpower').last();
    if (appr) setApprovalRecord(appr);

    // 6. Rank & Trade Distribution List (Persistent Firestore & Dexie)
    let rtdList = await db.rankTradeDistributions.orderBy('orderIndex').toArray();
    if (!rtdList || rtdList.length === 0) {
      await db.rankTradeDistributions.bulkPut(initialRankTradeDistributions);
      rtdList = await db.rankTradeDistributions.orderBy('orderIndex').toArray();
    }
    setRankTradeList(rtdList);
  };

  useEffect(() => {
    loadData(selectedDate);

    // Real-Time Multi-Device Listener
    const onCloudSync = (e: any) => {
      const col = e?.detail?.collection;
      if (!col || ['rankTradeDistributions', 'manpowerPersonnel', 'paradeStates', 'sectionApprovals'].includes(col)) {
        loadData(selectedDate);
      }
    };

    window.addEventListener('unit-ready-cloud-sync', onCloudSync);
    return () => {
      window.removeEventListener('unit-ready-cloud-sync', onCloudSync);
    };
  }, [selectedDate]);

  // Is editable based on operator permissions (No locking restriction)
  const isParadeEditable = () => {
    return currentUser.role !== 'general_viewer';
  };

  const canEditNominalRoll = () => {
    return currentUser.role !== 'general_viewer';
  };

  // Create New Daily Parade State
  const handleCreateNewParadeState = async () => {
    const newDate = prompt('Enter date for new Daily Parade State (YYYY-MM-DD):', new Date().toISOString().substring(0, 10));
    if (!newDate) return;

    const existing = await db.paradeStates.where('stateDate').equals(newDate).first();
    if (existing) {
      setSelectedDate(newDate);
      alert(`Parade state for ${newDate} is already loaded.`);
      return;
    }

    const allPrev = await db.paradeStates.orderBy('stateDate').reverse().toArray();
    const prev = allPrev.length > 0 ? allPrev[0] : null;

    const freshRecord: ParadeState = {
      id: `parade-${newDate}`,
      stateDate: newDate,
      dayOfWeek: new Date(newDate).toLocaleDateString('en-US', { weekday: 'long' }),
      greeting: prev?.greeting || 'Assalamualaikum Sir',
      strOffrs: prev?.strOffrs ?? 6,
      strJco: prev?.strJco ?? 8,
      strOrs: prev?.strOrs ?? 140,
      strNce: prev?.strNce ?? 12,
      strNcu: prev?.strNcu ?? 4,
      totalStrength: prev?.totalStrength ?? 170,
      presentOffrs: prev?.presentOffrs ?? prev?.strOffrs ?? 6,
      presentJco: prev?.presentJco ?? prev?.strJco ?? 8,
      presentOrs: prev?.presentOrs ?? prev?.strOrs ?? 140,
      presentNce: prev?.presentNce ?? prev?.strNce ?? 12,
      presentNcu: prev?.presentNcu ?? prev?.strNcu ?? 4,
      onParadeCount: prev?.onParadeCount ?? 170,
      outUnitTotal: prev?.outUnitTotal ?? 0,
      outUnitBreakdown: prev?.outUnitBreakdown ? { ...prev.outUnitBreakdown } : {
        cLeave: 0,
        pLeave: 0,
        medicalLeave: 0,
        cmhAdmitted: 0,
        maternityLeave: 0,
        course: 0,
        temporaryAttachment: 0,
        otherOutUnit: 0
      },
      personnelList: prev?.personnelList ? [...prev.personnelList] : [],
      cLeaveDetails: prev?.cLeaveDetails ? [...prev.cLeaveDetails] : [],
      pLeaveDetails: prev?.pLeaveDetails ? [...prev.pLeaveDetails] : [],
      medicalLeaveDetails: prev?.medicalLeaveDetails ? [...prev.medicalLeaveDetails] : [],
      cmhAdmittedDetails: prev?.cmhAdmittedDetails ? [...prev.cmhAdmittedDetails] : [],
      maternityLeaveDetails: prev?.maternityLeaveDetails ? [...prev.maternityLeaveDetails] : [],
      courseDetails: prev?.courseDetails ? [...prev.courseDetails] : [],
      tyAttDetails: prev?.tyAttDetails ? [...prev.tyAttDetails] : [],
      otherOutDetails: prev?.otherOutDetails ? [...prev.otherOutDetails] : [],
      tomorrowActivities: prev?.tomorrowActivities ? [...prev.tomorrowActivities] : [],
      medicalCover: prev?.medicalCover ? [...prev.medicalCover] : [],
      foodMenu: prev?.foodMenu || '',
      closingRegards: prev?.closingRegards || 'Profound Regards',
      status: 'DRAFT',
      version: '1.0',
      preparedBy: currentUser.appointmentTitle,
      updatedAt: new Date().toISOString()
    };

    await db.paradeStates.put(freshRecord);
    await syncEntityToCloud('paradeStates', freshRecord.id, freshRecord);
    setAllAvailableDates(prev => prev.includes(newDate) ? prev : [newDate, ...prev]);
    setSelectedDate(newDate);
    setIsEditingParade(true);
  };

  // Delete Current Daily Parade State
  const handleDeleteParadeState = async () => {
    if (!paradeState) return;
    const confirm = window.confirm(`Are you sure you want to delete Daily Parade State for ${paradeState.stateDate}?`);
    if (!confirm) return;

    await db.paradeStates.delete(paradeState.id);
    await deleteEntityFromCloud('paradeStates', paradeState.id);
    const remaining = allAvailableDates.filter(d => d !== paradeState.stateDate);
    setAllAvailableDates(remaining);
    if (remaining.length > 0) {
      setSelectedDate(remaining[0]);
    }
    alert(`Deleted Daily Parade State for ${paradeState.stateDate}.`);
  };

  // Save Parade State Changes
  const handleSaveParadeState = async () => {
    if (!paradeState) return;

    const updated: ParadeState = {
      ...paradeState,
      strOffrs: Number(strOffrs),
      strJco: Number(strJco),
      strOrs: Number(strOrs),
      strNce: Number(strNce),
      strNcu: Number(strNcu),
      totalStrength,
      onParadeCount: calculatedOnParade,
      outUnitTotal: calculatedOutUnit,
      outUnitBreakdown: {
        cLeave: Number(cLeaveCount),
        pLeave: Number(pLeaveCount),
        medicalLeave: Number(medLeaveCount),
        cmhAdmitted: Number(cmhAdmittedCount),
        maternityLeave: Number(maternityLeaveCount),
        course: Number(courseCount),
        temporaryAttachment: Number(tyAttCount),
        otherOutUnit: Number(otherOutCount)
      },
      tomorrowActivities: activitiesList,
      medicalCover: medicalCoverList,
      foodMenu,
      greeting,
      closingRegards,
      updatedAt: new Date().toISOString()
    };

    await db.paradeStates.put(updated);
    await syncEntityToCloud('paradeStates', updated.id, updated);
    setParadeState(updated);
    setIsEditingParade(false);

    await logAuditEvent(
      currentUser,
      'DRAFT_SAVED',
      'manpower',
      selectedDate,
      `Saved changes for Daily Parade State [${selectedDate}]. On Parade: ${calculatedOnParade}, Out Unit: ${calculatedOutUnit}.`
    );

    alert(language === 'bn' ? 'প্যারেড বিবরণীর তথ্য সফলভাবে সংরক্ষিত হয়েছে।' : 'Daily Parade State saved successfully.');
    loadData(selectedDate);
  };

  // Submit to QM
  const handleSubmitToQm = async () => {
    const nowIso = new Date().toISOString();
    if (paradeState) {
      const updated = {
        ...paradeState,
        status: 'SUBMITTED' as any,
        preparedBy: currentUser.appointmentTitle,
        updatedAt: nowIso
      };
      await db.paradeStates.put(updated);
      setParadeState(updated);
    }

    const appr = await db.sectionApprovals.where('section').equals('manpower').first();
    if (appr) {
      await db.sectionApprovals.update(appr.id, {
        status: 'SUBMITTED',
        submittedByAppointment: currentUser.appointmentTitle,
        submittedAt: nowIso
      });
    }

    await sendPhoneSmsAlert(
      `Parade & Manpower Submitted: ${selectedDate}`,
      `${currentUser.appointmentTitle} submitted Daily Parade & Manpower State for QM review. On Parade: ${calculatedOnParade}/${totalStrength}.`,
      'APPROVAL',
      currentUser.appointmentTitle,
      DEFAULT_UNIT_PHONE
    );

    await logAuditEvent(currentUser, 'RECORD_SUBMITTED', 'manpower', selectedDate, `Submitted Daily Parade State [${selectedDate}] to QM.`);
    alert(language === 'bn' ? 'জনবল ও প্যারেড বিবরণী কিউএম এর নিকট দাখিল করা হয়েছে।' : 'Parade State submitted to Quartermaster (QM) for review.');
    loadData(selectedDate);
  };

  // QM Approval
  const handleQmApprove = async () => {
    const nowIso = new Date().toISOString();
    if (paradeState) {
      const updated = {
        ...paradeState,
        status: 'QM_APPROVED' as any,
        qmApprovedBy: currentUser.appointmentTitle,
        updatedAt: nowIso
      };
      await db.paradeStates.put(updated);
      setParadeState(updated);
    }

    const appr = await db.sectionApprovals.where('section').equals('manpower').first();
    if (appr) {
      await db.sectionApprovals.update(appr.id, {
        status: 'QM_APPROVED',
        intermediateAppointment: currentUser.appointmentTitle,
        intermediateDecision: 'APPROVED',
        intermediateRemarks: 'Verified all manpower strengths and On Parade attendance.',
        intermediateDecidedAt: nowIso
      });
    }

    await logAuditEvent(currentUser, 'QM_APPROVED', 'manpower', selectedDate, `QM approved Daily Parade State [${selectedDate}]. Forwarded to CO.`);
    alert(language === 'bn' ? 'কিউএম কর্তৃক যাচাইকরণ সম্পন্ন। অধিনায়কের অনুমোদনের জন্য প্রস্তুত।' : 'QM approval complete. Forwarded to Commanding Officer (CO).');
    loadData(selectedDate);
  };

  // CO Command Final Approval
  const handleCoFinalApprove = async () => {
    const nowIso = new Date().toISOString();
    if (paradeState) {
      const updated = {
        ...paradeState,
        status: 'CO_APPROVED' as any,
        coApprovedBy: currentUser.appointmentTitle,
        updatedAt: nowIso
      };
      await db.paradeStates.put(updated);
      setParadeState(updated);
    }

    const appr = await db.sectionApprovals.where('section').equals('manpower').first();
    if (appr) {
      await db.sectionApprovals.update(appr.id, {
        status: 'CO_APPROVED',
        coAppointment: currentUser.appointmentTitle,
        coDecision: 'FINAL_APPROVED',
        coRemarks: 'Commanding Officer Final Approval granted. Record officially locked.',
        coDecidedAt: nowIso,
        lockedAt: nowIso
      });
    }

    await sendPhoneSmsAlert(
      `Parade State Approved: ${selectedDate}`,
      `Commanding Officer approved and locked 95 Fd Amb Daily Parade State (${selectedDate}). On Parade: ${calculatedOnParade}.`,
      'APPROVAL',
      currentUser.appointmentTitle,
      DEFAULT_UNIT_PHONE
    );

    await logAuditEvent(currentUser, 'CO_APPROVED', 'manpower', selectedDate, `CO granted final command approval for Daily Parade State [${selectedDate}]. Record locked.`);
    alert(language === 'bn' ? 'অধিনায়ক কর্তৃক চূড়ান্ত কমান্ড অনুমোদন প্রদান করা হয়েছে। বিবরণী লক করা হলো।' : 'Commanding Officer final approval granted. Daily state officially locked.');
    loadData(selectedDate);
  };

  // Export Daily Parade State PDF
  const handleExportParadePdf = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('95 FIELD AMBULANCE', 105, 15, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`DAILY PARADE STATE — ${selectedDate}`, 105, 22, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`On Parade: ${calculatedOnParade} | Out Unit: ${calculatedOutUnit} | Total: ${totalStrength}`, 105, 28, { align: 'center' });

    autoTable(doc, {
      startY: 34,
      head: [['Category / Status', 'Officers', 'JCOs', 'ORs', 'NC(E)', 'NC(U)', 'Total']],
      body: [
        ['Authorized Strength', '6', '8', '140', '12', '4', '170'],
        ['Present / On Parade', formatNumber(Math.floor(calculatedOnParade * 0.04)), formatNumber(Math.floor(calculatedOnParade * 0.05)), formatNumber(Math.floor(calculatedOnParade * 0.82)), formatNumber(Math.floor(calculatedOnParade * 0.07)), '2', formatNumber(calculatedOnParade)],
        ['Out Unit Total', '-', '-', formatNumber(calculatedOutUnit), '-', '-', formatNumber(calculatedOutUnit)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [45, 74, 34] }
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [['Leave & Out Unit Classification', 'Personnel Count']],
      body: [
        ['C Leave (Casual)', formatNumber(cLeaveCount)],
        ['P Leave (Privilege)', formatNumber(pLeaveCount)],
        ['Medical Leave', formatNumber(medLeaveCount)],
        ['CMH Admitted', formatNumber(cmhAdmittedCount)],
        ['Maternity Leave', formatNumber(maternityLeaveCount)],
        ['Military Course', formatNumber(courseCount)],
        ['Temporary Attachment', formatNumber(tyAttCount)],
        ['Other Out Unit', formatNumber(otherOutCount)],
      ],
      theme: 'striped'
    });

    doc.save(`95FA_Daily_Parade_State_${selectedDate}.pdf`);
  };

  // Nominal Roll Add/Edit
  const handleOpenAddPerson = () => {
    setEditingPerson(null);
    setPNo(`BA-${Math.floor(10000 + Math.random() * 90000)}`);
    setPRank('Snk');
    setPName('');
    setPTrade('MA');
    setPAppt('General Duty (GD)');
    setPSec('Med');
    setPStatus('PRESENT');
    setPFromDate(todayStr);
    setPReturnDate('');
    setPQual('Medical Assistant (MA)');
    setPRemarks('');
    setIsModalOpen(true);
  };

  const handleOpenEditPerson = (p: ManpowerPersonnel) => {
    setEditingPerson(p);
    setPNo(p.baNo || p.personalNumber);
    setPRank(p.rank || 'Snk');
    setPName(p.name || '');
    setPTrade(p.trade || (p.qualification?.includes('SMT') ? 'SMT' : 'MA'));
    setPAppt(p.appointment || 'General Duty');
    setPSec(p.sectionCode || 'Med');
    setPStatus(p.currentStatus);
    setPFromDate(p.statusFromDate || todayStr);
    setPReturnDate(p.expectedReturnDate || '');
    setPQual(p.qualification || 'Special Medical Trade (SMT)');
    setPRemarks(p.remarks || '');
    setIsModalOpen(true);
  };

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBaNo = pNo.trim();
    const cleanName = pName.trim();
    const cleanAppt = pAppt.trim() || `${pRank} (${pTrade})`;

    if (!cleanBaNo) {
      alert('BA No is required.');
      return;
    }
    if (!cleanName) {
      alert('Personnel Name is required.');
      return;
    }

    // BA No Uniqueness Enforcement
    if (!editingPerson) {
      const exists = personnelList.some(
        p => (p.baNo || p.personalNumber).toLowerCase() === cleanBaNo.toLowerCase()
      );
      if (exists) {
        alert(`BA No "${cleanBaNo}" already exists in the nominal roll. BA No must be strictly unique.`);
        return;
      }
    } else {
      const exists = personnelList.some(
        p => p.id !== editingPerson.id && (p.baNo || p.personalNumber).toLowerCase() === cleanBaNo.toLowerCase()
      );
      if (exists) {
        alert(`BA No "${cleanBaNo}" already belongs to another personnel record. BA No must be unique.`);
        return;
      }
    }

    if (editingPerson) {
      const updated: ManpowerPersonnel = {
        ...editingPerson,
        baNo: cleanBaNo,
        rank: pRank,
        name: cleanName,
        trade: pTrade,
        personalNumber: cleanBaNo,
        appointment: cleanAppt,
        sectionCode: pSec,
        currentStatus: pStatus,
        statusFromDate: pFromDate,
        expectedReturnDate: pReturnDate,
        qualification: pTrade === 'SMT' ? 'Special Medical Trade (SMT)' : pTrade,
        remarks: pRemarks
      };
      await db.manpowerPersonnel.put(updated);
      await syncEntityToCloud('manpowerPersonnel', updated.id, updated);
      await logAuditEvent(currentUser, 'DRAFT_SAVED', 'manpower', cleanBaNo, `Updated personnel: ${pRank} ${cleanName} (BA: ${cleanBaNo}, Trade: ${pTrade})`);
    } else {
      const newP: ManpowerPersonnel = {
        id: 'p-' + Date.now(),
        baNo: cleanBaNo,
        rank: pRank,
        name: cleanName,
        trade: pTrade,
        personalNumber: cleanBaNo,
        appointment: cleanAppt,
        sectionCode: pSec,
        isAuthorizedAppointment: true,
        currentStatus: pStatus,
        statusFromDate: pFromDate,
        expectedReturnDate: pReturnDate,
        qualification: pTrade === 'SMT' ? 'Special Medical Trade (SMT)' : pTrade,
        remarks: pRemarks
      };
      await db.manpowerPersonnel.add(newP);
      await syncEntityToCloud('manpowerPersonnel', newP.id, newP);
      await logAuditEvent(currentUser, 'DRAFT_SAVED', 'manpower', cleanBaNo, `Added personnel: ${pRank} ${cleanName} (BA: ${cleanBaNo}, Trade: ${pTrade})`);
    }

    setIsModalOpen(false);
    loadData(selectedDate);
  };

  const handleDeletePerson = async (p: ManpowerPersonnel) => {
    const confirm = window.confirm(`Are you sure you want to delete ${p.rank} ${p.name} (BA: ${p.baNo || p.personalNumber}) from the nominal roll?`);
    if (!confirm) return;

    await db.manpowerPersonnel.delete(p.id);
    await deleteEntityFromCloud('manpowerPersonnel', p.id);
    await logAuditEvent(currentUser, 'RECORD_DELETED', 'manpower', p.baNo || p.personalNumber, `Deleted personnel: ${p.rank} ${p.name} (${p.baNo || p.personalNumber})`);
    loadData(selectedDate);
  };

  // Rank & Trade Distribution Handlers (Add, Edit, Delete with permanent Firestore sync)
  const handleOpenAddRankTrade = () => {
    setEditingRankTrade(null);
    setRtClassification('');
    setRtTradeCode('');
    setRtAuthCount(1);
    setRtPostedCount(1);
    setRtPresentCount(1);
    setRtRemarks('');
    setIsRankTradeModalOpen(true);
  };

  const handleOpenEditRankTrade = (item: RankTradeDistributionItem) => {
    setEditingRankTrade(item);
    setRtClassification(item.classification);
    setRtTradeCode(item.tradeCode || item.classification);
    setRtAuthCount(item.authCount);
    setRtPostedCount(item.postedCount !== undefined ? item.postedCount : (item.heldCount || 0));
    setRtPresentCount(item.presentCount || 0);
    setRtRemarks(item.remarks || '');
    setIsRankTradeModalOpen(true);
  };

  const handleSaveRankTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rtClassification.trim()) {
      alert('Please enter a classification or rank/trade name.');
      return;
    }

    if (currentUser.role === 'general_viewer') {
      alert('General Viewers are not authorized to edit rank or trade distributions.');
      return;
    }

    setIsSavingRtd(true);
    try {
      const auth = Math.max(0, Number(rtAuthCount) || 0);
      const posted = Math.max(0, Number(rtPostedCount) || 0);
      const present = Math.max(0, Number(rtPresentCount) || 0);
      const outUnit = Math.max(0, posted - present);
      const shortfall = Math.max(0, auth - posted);

      const id = editingRankTrade?.id || `rtd-${Date.now()}`;
      const classification = rtClassification.trim();
      const tradeCode = rtTradeCode.trim() || classification;

      const getCategory = (cls: string): 'OFFICER' | 'JCO' | 'OTHER_RANK' | 'NCE' | 'NCU' => {
        if (cls === 'Offr') return 'OFFICER';
        if (cls === 'JCO') return 'JCO';
        if (cls === 'NC(E)') return 'NCE';
        if (cls === 'NC(U)') return 'NCU';
        return 'OTHER_RANK';
      };

      const itemToSave: RankTradeDistributionItem = {
        id,
        classification,
        tradeCode,
        categoryGroup: getCategory(classification),
        authCount: auth,
        postedCount: posted,
        presentCount: present,
        outUnitCount: outUnit,
        shortfall: shortfall,
        heldCount: posted,
        leaveCount: outUnit,
        deficiency: shortfall,
        remarks: rtRemarks.trim() || undefined,
        orderIndex: editingRankTrade?.orderIndex || (rankTradeList.length + 1),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.appointmentTitle || currentUser.fullName || 'Manpower Operator'
      };

      // 1. Save permanently to Dexie IndexedDB
      await db.rankTradeDistributions.put(itemToSave);

      // 2. Save permanently to Cloud Firestore using exact document ID
      await syncEntityToCloud('rankTradeDistributions', itemToSave.id, itemToSave);

      // 3. Log audit entry
      await logAuditEvent(
        currentUser,
        editingRankTrade ? 'RANK_UPDATED' : 'DRAFT_SAVED',
        'manpower',
        classification,
        `${editingRankTrade ? 'Updated' : 'Added'} Rank/Trade: ${classification} (Auth: ${auth}, Posted: ${posted}, Present: ${present}, Shortfall: ${shortfall})`
      );

      // 4. Update UI & Feedback
      setSaveStatusMessage(`✅ Saved successfully! Rank & Trade "${classification}" updated permanently in Firestore.`);
      setSaveStatusType('SUCCESS');
      setIsRankTradeModalOpen(false);
      await loadData(selectedDate);

      setTimeout(() => {
        setSaveStatusMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Error saving rank & trade:', err);
      setSaveStatusMessage(`❌ Save failed: ${err.message || 'Database error'}`);
      setSaveStatusType('ERROR');
    } finally {
      setIsSavingRtd(false);
    }
  };

  const handleDeleteRankTrade = async (item: RankTradeDistributionItem) => {
    if (currentUser.role === 'general_viewer') {
      alert('General Viewers are not authorized to delete rank or trade distributions.');
      return;
    }

    const confirm = window.confirm(`Are you sure you want to permanently delete rank/trade entry "${item.classification}"?`);
    if (!confirm) return;

    try {
      // 1. Delete from Dexie
      await db.rankTradeDistributions.delete(item.id);

      // 2. Delete from Firestore
      await deleteEntityFromCloud('rankTradeDistributions', item.id);

      // 3. Log audit entry
      await logAuditEvent(currentUser, 'RECORD_DELETED', 'manpower', item.classification, `Deleted Rank & Trade distribution entry: ${item.classification}`);

      setSaveStatusMessage(`🗑️ Entry "${item.classification}" deleted permanently from Firestore.`);
      setSaveStatusType('SUCCESS');
      await loadData(selectedDate);

      setTimeout(() => {
        setSaveStatusMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Error deleting rank & trade:', err);
      alert('Failed to delete entry: ' + err.message);
    }
  };

  // Filter Nominal Roll (BA No, Rank, Name, Trade, Status)
  const filteredPersonnel = useMemo(() => {
    return personnelList.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        (p.baNo || p.personalNumber || '').toLowerCase().includes(q) ||
        (p.rank || '').toLowerCase().includes(q) ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.trade || p.qualification || '').toLowerCase().includes(q) ||
        (p.appointment || '').toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'ALL' || p.currentStatus === statusFilter;
      const matchesTrade = tradeFilter === 'ALL' || p.trade === tradeFilter || (tradeFilter === 'SMT' && (p.qualification || '').includes('SMT'));
      const matchesRank = rankFilter === 'ALL' || p.rank === rankFilter;

      return matchesSearch && matchesStatus && matchesTrade && matchesRank;
    });
  }, [personnelList, searchQuery, statusFilter, tradeFilter, rankFilter]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              {t('nav_manpower')} (95 Fd Amb)
            </h1>
            <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
              {language === 'bn' ? 'সমন্বিত জনবল' : 'CONSOLIDATED'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {language === 'bn' 
              ? 'দৈনিক প্যারেড বিবরণী, অন প্যারেড/ছুটি গণনা এবং ট্রেডভিত্তিক জনবল তালিকা' 
              : 'Daily Parade State, On Parade / Out Unit attendance calculation & Nominal Trade roll.'}
          </p>
        </div>

        {/* Date Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-0 font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {allAvailableDates.map((d) => (
                <option key={d} value={d} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                  {d === todayStr ? `${d} (${language === 'bn' ? 'আজ' : 'Today'})` : d}
                </option>
              ))}
            </select>
          </div>

          {currentUser.role !== 'general_viewer' && (
            <>
              <button
                onClick={handleCreateNewParadeState}
                className="px-3 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
                title="Create a new Daily Parade State"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New State</span>
              </button>

              {paradeState && (
                <button
                  onClick={handleDeleteParadeState}
                  className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs font-bold shadow flex items-center gap-1 cursor-pointer"
                  title="Delete this Daily Parade State"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete State</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={handleExportParadePdf}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t('action_print')}</span>
          </button>
        </div>
      </div>

      {/* Read-Only Notice Banner for General Duty Personnel */}
      {(currentUser.role === 'general_duty' || currentUser.role === 'general_personnel' || currentUser.role === 'smt_member' || currentUser.role === 'authorised_personnel' || currentUser.role === 'auditor') && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              <strong>{language === 'bn' ? 'সাধারণ দায়িত্ব (GD) কর্মী – শুধুমাত্র পাঠযোগ্য বিবরণী' : 'General Duty (GD) Personnel — Read-Only View'}:</strong> {language === 'bn' ? 'অনুমোদিত প্যারেড ও জনবল তথ্য শুধুমাত্র পাঠযোগ্য। কোনো পরিবর্তন বা সংশোধন অনুরোধ করার অনুমতি নেই।' : 'You have view-only access to approved daily parade state and nominal roll. Modifications and correction requests are restricted.'}
            </span>
          </div>
          <span className="font-mono text-[10px] bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded font-bold whitespace-nowrap">
            {language === 'bn' ? 'শুধুমাত্র পাঠযোগ্য (READ-ONLY)' : 'READ-ONLY VIEW'}
          </span>
        </div>
      )}

      {/* 3 Main Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 rounded-t-xl gap-2 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('PARADE_STATE')}
          className={`pb-3 px-3 transition border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'PARADE_STATE'
              ? 'border-[#2D4A22] dark:border-emerald-400 text-[#2D4A22] dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>{t('tab_paradeState')}</span>
        </button>
        <button
          onClick={() => setActiveTab('NOMINAL_ROLL')}
          className={`pb-3 px-3 transition border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'NOMINAL_ROLL'
              ? 'border-[#2D4A22] dark:border-emerald-400 text-[#2D4A22] dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>{t('tab_nominalRoll')} ({personnelList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('STRENGTH_SUMMARY')}
          className={`pb-3 px-3 transition border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'STRENGTH_SUMMARY'
              ? 'border-[#2D4A22] dark:border-emerald-400 text-[#2D4A22] dark:text-emerald-400 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{t('tab_strengthSummary')}</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: DAILY PARADE STATE & ATTENDANCE                     */}
      {/* ========================================================= */}
      {activeTab === 'PARADE_STATE' && (
        <ParadeStateModule />
      )}

      {/* ========================================================= */}
      {/* TAB 2: NOMINAL ROLL & MANPOWER NOMINAL STATE               */}
      {/* ========================================================= */}
      {activeTab === 'NOMINAL_ROLL' && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-sm">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search BA No, Rank, Name, Trade..."
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Trade Filter */}
              <select
                value={tradeFilter}
                onChange={(e) => setTradeFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              >
                <option value="ALL">All Trades</option>
                {ALL_TRADES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {/* Rank Filter */}
              <select
                value={rankFilter}
                onChange={(e) => setRankFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              >
                <option value="ALL">All Ranks</option>
                {ALL_RANKS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              >
                <option value="ALL">{language === 'bn' ? 'সকল স্ট্যাটাস' : 'All Statuses'}</option>
                <option value="PRESENT">{language === 'bn' ? 'উপস্থিত (Present)' : 'Present'}</option>
                <option value="LEAVE">{language === 'bn' ? 'ছুটি (Leave)' : 'Leave'}</option>
                <option value="COURSE">{language === 'bn' ? 'কোর্স (Course)' : 'Course'}</option>
                <option value="ATTACHED">{language === 'bn' ? 'সংযুক্তি (Attached)' : 'Attached'}</option>
                <option value="HOSPITAL">{language === 'bn' ? 'হাসপাতাল (Hospital)' : 'Hospital'}</option>
              </select>

              <button
                onClick={() => exportTableToExcel(filteredPersonnel, '95FA_Nominal_Roll', 'Nominal Roll')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>

              {canEditNominalRoll() && (
                <button
                  onClick={handleOpenAddPerson}
                  className="px-3.5 py-1.5 rounded-lg bg-[#2D4A22] text-white font-bold flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('mp_addPersonnel')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Nominal Roll Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table id="manpower-nominal-table" className="w-full text-left text-xs font-sans">
                <thead className="bg-[#2D4A22] text-white font-bold font-mono">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">BA No</th>
                    <th className="p-3">Rank</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Trade</th>
                    <th className="p-3">{t('mp_appointment')}</th>
                    <th className="p-3">{t('mp_section')}</th>
                    <th className="p-3">{t('mp_status')}</th>
                    <th className="p-3">{t('mp_expectedReturn')}</th>
                    <th className="p-3">{t('mp_remarks')}</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPersonnel.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-500">
                        {language === 'bn' ? 'কোন জনবল পাওয়া যায়নি।' : 'No personnel records matching your filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPersonnel.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono text-slate-400">{formatNumber(idx + 1)}</td>
                        <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{p.baNo || p.personalNumber}</td>
                        <td className="p-3 font-bold text-emerald-800 dark:text-emerald-300 font-mono">{p.rank || 'Snk'}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{p.name || p.appointment}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            p.trade === 'SMT' || p.qualification?.includes('SMT')
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-400' 
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {p.trade || (p.qualification?.includes('SMT') ? 'SMT' : 'MA')}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-700 dark:text-slate-300">{p.appointment}</td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{p.sectionCode}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                            p.currentStatus === 'PRESENT'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {p.currentStatus}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-500">{p.expectedReturnDate || '—'}</td>
                        <td className="p-3 text-slate-500 truncate max-w-xs">{p.remarks || '—'}</td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {canEditNominalRoll() ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditPerson(p)}
                                className="p-1 text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 cursor-pointer"
                                title="Edit Personnel"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePerson(p)}
                                className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 cursor-pointer"
                                title="Delete Personnel"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px] font-mono">READ-ONLY</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: STRENGTH SUMMARY & TRADE DISTRIBUTION              */}
      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* TAB 3: STRENGTH SUMMARY & TRADE DISTRIBUTION              */}
      {/* ========================================================= */}
      {activeTab === 'STRENGTH_SUMMARY' && (() => {
        // Grouping & Collective Calculations
        const offrItems = rankTradeList.filter(r => r.classification === 'Offr');
        const jcoItems = rankTradeList.filter(r => r.classification === 'JCO');
        const orTradeItems = rankTradeList.filter(r => !['Offr', 'JCO', 'NC(E)', 'NC(U)'].includes(r.classification));
        const nceItems = rankTradeList.filter(r => r.classification === 'NC(E)');
        const ncuItems = rankTradeList.filter(r => r.classification === 'NC(U)');

        const sumGroup = (list: RankTradeDistributionItem[]) => {
          const auth = list.reduce((s, r) => s + Number(r.authCount || 0), 0);
          const posted = list.reduce((s, r) => s + Number(r.postedCount !== undefined ? r.postedCount : (r.heldCount || 0)), 0);
          const present = list.reduce((s, r) => s + Number(r.presentCount || 0), 0);
          const outUnit = list.reduce((s, r) => {
            const itemPosted = Number(r.postedCount !== undefined ? r.postedCount : (r.heldCount || 0));
            const itemPresent = Number(r.presentCount || 0);
            return s + (r.outUnitCount !== undefined ? Number(r.outUnitCount) : Math.max(0, itemPosted - itemPresent));
          }, 0);
          const shortfall = list.reduce((s, r) => {
            const itemAuth = Number(r.authCount || 0);
            const itemPosted = Number(r.postedCount !== undefined ? r.postedCount : (r.heldCount || 0));
            return s + (r.shortfall !== undefined ? Number(r.shortfall) : Math.max(0, itemAuth - itemPosted));
          }, 0);

          return { auth, posted, present, outUnit, shortfall };
        };

        const offrTotals = sumGroup(offrItems);
        const jcoTotals = sumGroup(jcoItems);
        const orTotals = sumGroup(orTradeItems);
        const nceTotals = sumGroup(nceItems);
        const ncuTotals = sumGroup(ncuItems);
        const grandTotals = sumGroup(rankTradeList);

        return (
          <div className="space-y-4">
            {/* Status Alert Banner */}
            {saveStatusMessage && (
              <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold animate-fade-in ${
                saveStatusType === 'SUCCESS' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 shadow-sm'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 shadow-sm'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{saveStatusMessage}</span>
                </div>
                <button 
                  onClick={() => setSaveStatusMessage(null)}
                  className="text-xs px-2 py-0.5 rounded bg-white/50 hover:bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 3-Tier Strength KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Authorized Strength */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">1. AUTHORIZED STRENGTH</span>
                  <span className="text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">Sanctioned</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">{formatNumber(grandTotals.auth)}</span>
                  <span className="text-xs font-mono text-slate-500">Shortfall: <b className="text-red-600">{formatNumber(grandTotals.shortfall)}</b></span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>Offr: {formatNumber(offrTotals.auth)} | JCO: {formatNumber(jcoTotals.auth)}</span>
                  <span>ORs: {formatNumber(orTotals.auth)}</span>
                </div>
              </div>

              {/* Card 2: Posted Strength (Held) */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">2. POSTED STRENGTH (HELD)</span>
                  <span className="text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">On Roll</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black font-mono text-indigo-900 dark:text-indigo-200">{formatNumber(grandTotals.posted)}</span>
                  <span className="text-xs font-mono text-slate-500">Out Unit: <b className="text-amber-600">{formatNumber(grandTotals.outUnit)}</b></span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>Offr: {formatNumber(offrTotals.posted)} | JCO: {formatNumber(jcoTotals.posted)}</span>
                  <span>ORs: {formatNumber(orTotals.posted)}</span>
                </div>
              </div>

              {/* Card 3: Present / On Parade Strength */}
              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-xl border-2 border-emerald-600/40 dark:border-emerald-600/60 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider font-mono">
                    3. PRESENT / ON PARADE
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                    Physically In Unit
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black font-mono text-emerald-900 dark:text-emerald-100">{formatNumber(grandTotals.present)}</span>
                  <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300">Total Unit Present</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-emerald-800 dark:text-emerald-300 pt-1 border-t border-emerald-200 dark:border-emerald-800">
                  <span className="font-bold">ORs Present: {formatNumber(orTotals.present)}</span>
                  <span>NC(E)+NC(U): {formatNumber(nceTotals.present + ncuTotals.present)}</span>
                </div>
              </div>

              {/* Card 4: Other Ranks (ORs Collective) 10 Trades */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">OTHER RANKS (ORs)</span>
                  <span className="text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">10 Trades</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                    {formatNumber(orTotals.posted)}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    Auth: {formatNumber(orTotals.auth)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">Present: {formatNumber(orTotals.present)}</span>
                  <span className="text-amber-700 dark:text-amber-400">Out Unit: {formatNumber(orTotals.outUnit)}</span>
                </div>
              </div>
            </div>

            {/* Main Rank & Trade Table */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#2D4A22] dark:text-emerald-400" />
                    <span>Rank & Trade Strength Distribution (14 Military Classifications)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-sans">
                    Permanently synced with Cloud Firestore. Displays separate <b>AUTHORIZED</b>, <b>POSTED</b>, and <b>PRESENT / ON PARADE</b> strengths.
                  </p>
                </div>

                {canEditNominalRoll() && (
                  <button
                    type="button"
                    onClick={handleOpenAddRankTrade}
                    className="px-3.5 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Rank / Trade</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-[#2D4A22] text-white font-bold font-mono text-[11px]">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">CLASSIFICATION</th>
                      <th className="p-3 text-center">AUTHORIZED (AUTH)</th>
                      <th className="p-3 text-center">POSTED (HELD)</th>
                      <th className="p-3 text-center">PRESENT / ON PARADE</th>
                      <th className="p-3 text-center">OUT UNIT</th>
                      <th className="p-3 text-center">SHORTFALL</th>
                      <th className="p-3">REMARKS</th>
                      {canEditNominalRoll() && <th className="p-3 text-right">ACTIONS</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Render Function for an item row */}
                    {(() => {
                      let counter = 1;
                      const renderRow = (item: RankTradeDistributionItem, isHighlight: boolean = false) => {
                        const itemAuth = Number(item.authCount || 0);
                        const itemPosted = Number(item.postedCount !== undefined ? item.postedCount : (item.heldCount || 0));
                        const itemPresent = Number(item.presentCount || 0);
                        const itemOutUnit = item.outUnitCount !== undefined ? Number(item.outUnitCount) : Math.max(0, itemPosted - itemPresent);
                        const itemShortfall = item.shortfall !== undefined ? Number(item.shortfall) : Math.max(0, itemAuth - itemPosted);

                        return (
                          <tr 
                            key={item.id} 
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${isHighlight ? 'bg-slate-50/60 dark:bg-slate-800/30' : ''}`}
                          >
                            <td className="p-3 font-mono text-slate-400">{counter++}</td>
                            <td className="p-3">
                              <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-slate-100">
                                {item.classification}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-center font-bold text-slate-700 dark:text-slate-300">{formatNumber(itemAuth)}</td>
                            <td className="p-3 font-mono text-center font-bold text-slate-900 dark:text-slate-100">{formatNumber(itemPosted)}</td>
                            <td className="p-3 font-mono text-center text-emerald-700 dark:text-emerald-400 font-bold">{formatNumber(itemPresent)}</td>
                            <td className="p-3 font-mono text-center text-amber-700 dark:text-amber-400 font-bold">{formatNumber(itemOutUnit)}</td>
                            <td className="p-3 font-mono text-center text-red-600 font-bold">{formatNumber(itemShortfall)}</td>
                            <td className="p-3 text-slate-500 font-mono text-[11px] truncate max-w-xs">{item.remarks || '—'}</td>
                            {canEditNominalRoll() && (
                              <td className="p-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditRankTrade(item)}
                                    className="p-1.5 text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded hover:bg-emerald-100 transition cursor-pointer"
                                    title="Edit Entry"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRankTrade(item)}
                                    className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded hover:bg-red-100 transition cursor-pointer"
                                    title="Delete Entry"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      };

                      return (
                        <>
                          {/* 1. Officers (Offr) */}
                          {offrItems.map(item => renderRow(item))}

                          {/* 2. JCOs */}
                          {jcoItems.map(item => renderRow(item))}

                          {/* 3. Individual Other Ranks (ORs) Trades */}
                          {orTradeItems.map(item => renderRow(item))}

                          {/* 4. COLLECTIVE SUBTOTAL: OTHER RANKS (ORs) */}
                          <tr className="bg-emerald-100/70 dark:bg-emerald-950/60 font-bold border-y-2 border-emerald-600 dark:border-emerald-500">
                            <td className="p-3 font-mono text-emerald-900 dark:text-emerald-200">Σ</td>
                            <td className="p-3 font-mono">
                              <div className="font-black text-emerald-950 dark:text-emerald-200 text-xs uppercase tracking-wide flex items-center gap-1.5">
                                <span>SUBTOTAL: OTHER RANKS (ORs)</span>
                                <span className="text-[10px] font-normal text-emerald-800 dark:text-emerald-300 font-sans">
                                  (10 Trades Collective)
                                </span>
                              </div>
                            </td>
                            <td className="p-3 font-mono text-center text-sm font-black text-emerald-950 dark:text-emerald-100">
                              {formatNumber(orTotals.auth)}
                            </td>
                            <td className="p-3 font-mono text-center text-sm font-black text-emerald-950 dark:text-emerald-100">
                              {formatNumber(orTotals.posted)}
                            </td>
                            <td className="p-3 font-mono text-center text-sm font-black text-emerald-800 dark:text-emerald-200">
                              {formatNumber(orTotals.present)}
                            </td>
                            <td className="p-3 font-mono text-center text-sm font-black text-amber-900 dark:text-amber-300">
                              {formatNumber(orTotals.outUnit)}
                            </td>
                            <td className="p-3 font-mono text-center text-sm font-black text-red-700 dark:text-red-300">
                              {formatNumber(orTotals.shortfall)}
                            </td>
                            <td className="p-3 text-[10px] font-mono text-emerald-900 dark:text-emerald-300 font-medium" colSpan={canEditNominalRoll() ? 2 : 1}>
                              MA, MT, SMT, Clk, Lab Tech, OTA, Disp, EME, Tradesman, Cook
                            </td>
                          </tr>

                          {/* 5. NC(E) */}
                          {nceItems.map(item => renderRow(item))}

                          {/* 6. NC(U) */}
                          {ncuItems.map(item => renderRow(item))}

                          {/* 7. GRAND TOTAL UNIT STRENGTH & MUSTER */}
                          <tr className="bg-slate-900 text-white dark:bg-slate-800 font-bold border-t-2 border-slate-950">
                            <td className="p-3 font-mono text-amber-400">★</td>
                            <td className="p-3 font-mono">
                              <span className="text-amber-400 uppercase tracking-wider font-black text-xs">
                                TOTAL UNIT STRENGTH & MUSTER
                              </span>
                            </td>
                            <td className="p-3 font-mono text-center text-sm text-white font-extrabold">
                              {formatNumber(grandTotals.auth)}
                            </td>
                            <td className="p-3 font-mono text-center text-sm text-white font-extrabold">
                              {formatNumber(grandTotals.posted)}
                            </td>
                            <td className="p-3 font-mono text-center text-sm text-emerald-400 font-extrabold">
                              {formatNumber(grandTotals.present)}
                            </td>
                            <td className="p-3 font-mono text-center text-sm text-amber-300 font-extrabold">
                              {formatNumber(grandTotals.outUnit)}
                            </td>
                            <td className="p-3 font-mono text-center text-sm text-red-400 font-extrabold">
                              {formatNumber(grandTotals.shortfall)}
                            </td>
                            <td className="p-3 text-[11px] font-mono text-slate-300" colSpan={canEditNominalRoll() ? 2 : 1}>
                              14 Military Classifications Active (Firestore Synced)
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Add / Edit Rank & Trade Entry */}
      <Modal
        isOpen={isRankTradeModalOpen}
        onClose={() => setIsRankTradeModalOpen(false)}
        title={editingRankTrade ? 'Edit Rank / Trade Distribution' : 'Add Rank / Trade Distribution'}
        subtitle="Manage authorized establishment, posted strength on roll, and physical present count."
      >
        <form onSubmit={handleSaveRankTrade} className="space-y-4 text-xs font-sans">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Classification / Rank / Trade Name *
              </label>
              <input
                type="text"
                value={rtClassification}
                onChange={(e) => setRtClassification(e.target.value)}
                placeholder="e.g. Offr, JCO, MA, MT, SMT, Clk, Lab Tech, OTA, Disp, EME, Tradesman, Cook, NC(E), NC(U)"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                required
              />
              {/* Standard 14 Classifications Quick Selection */}
              <div className="mt-2">
                <span className="text-[10px] font-bold text-slate-500 block mb-1">Select from 14 Standard Classifications:</span>
                <div className="flex flex-wrap gap-1">
                  {ALL_TRADES.map(trade => (
                    <button
                      key={trade}
                      type="button"
                      onClick={() => {
                        setRtClassification(trade);
                        setRtTradeCode(trade);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition ${
                        rtClassification === trade
                          ? 'bg-[#2D4A22] text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {trade}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Trade Code / Designation
              </label>
              <input
                type="text"
                value={rtTradeCode}
                onChange={(e) => setRtTradeCode(e.target.value)}
                placeholder="e.g. SMT, MA, DVR"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Authorized Strength (Auth) *
              </label>
              <input
                type="number"
                min={0}
                value={rtAuthCount}
                onChange={(e) => setRtAuthCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                required
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">Officially sanctioned establishment</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Posted Strength (Held) *
              </label>
              <input
                type="number"
                min={0}
                value={rtPostedCount}
                onChange={(e) => setRtPostedCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                required
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">Personnel actually posted on unit roll</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Present in Unit (On Parade) *
              </label>
              <input
                type="number"
                min={0}
                value={rtPresentCount}
                onChange={(e) => setRtPresentCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400"
                required
              />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">Physically present in unit today</span>
            </div>

            {/* Live Calculation Cards inside Modal */}
            <div className="col-span-2 grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-mono text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px]">Out Unit (Posted - Present):</span>
                <span className="font-bold text-amber-600">{Math.max(0, Number(rtPostedCount) - Number(rtPresentCount))}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Authorized Shortfall (Auth - Posted):</span>
                <span className="font-bold text-red-600">{Math.max(0, Number(rtAuthCount) - Number(rtPostedCount))}</span>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Remarks / Section Notes
              </label>
              <input
                type="text"
                value={rtRemarks}
                onChange={(e) => setRtRemarks(e.target.value)}
                placeholder="Deployment, ward allocation or trade specialization notes"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsRankTradeModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingRtd}
              className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSavingRtd ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving to Firestore...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Distribution Entry</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Personnel Modal (Section Field Completely Removed) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPerson ? t('mp_editPersonnel') : t('mp_addPersonnel')}
        subtitle="95 Field Ambulance Nominal Roll Register"
      >
        <form onSubmit={handleSavePerson} className="space-y-4 text-xs font-sans">
          {/* Row 1: BA No & Rank */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                BA No * (Unique ID)
              </label>
              <input
                type="text"
                value={pNo}
                onChange={(e) => setPNo(e.target.value)}
                placeholder="e.g. BA-10293"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Rank * (BD Army)
              </label>
              <select
                value={pRank}
                onChange={(e) => setPRank(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                required
              >
                {ALL_RANKS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Name & Trade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Name * (Full Name)
              </label>
              <input
                type="text"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder="e.g. Md. Rafiqul Islam"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Trade * (Approved Army Trade)
              </label>
              <select
                value={pTrade}
                onChange={(e) => setPTrade(e.target.value as PersonnelTrade)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-emerald-700 dark:text-emerald-400"
                required
              >
                {ALL_TRADES.map(tr => (
                  <option key={tr} value={tr}>{tr}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Appointment (Section Completely Removed) */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Appointment (Appt)
            </label>
            <input
              type="text"
              value={pAppt}
              onChange={(e) => setPAppt(e.target.value)}
              placeholder="e.g. Nursing Assistant / Driver / General Duty"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
            />
          </div>

          {/* Row 4: Status & Expected Return Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('mp_status')}
              </label>
              <select
                value={pStatus}
                onChange={(e) => setPStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
              >
                <option value="PRESENT">PRESENT (On Parade)</option>
                <option value="LEAVE">LEAVE (C/P Leave)</option>
                <option value="COURSE">COURSE</option>
                <option value="ATTACHED">TY ATTACHMENT</option>
                <option value="HOSPITAL">CMH ADMITTED</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('mp_expectedReturn')}
              </label>
              <input
                type="date"
                value={pReturnDate}
                onChange={(e) => setPReturnDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
            </div>
          </div>

          {/* Row 5: Remarks */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('mp_remarks')}
            </label>
            <input
              type="text"
              value={pRemarks}
              onChange={(e) => setPRemarks(e.target.value)}
              placeholder="Deployment details or remarks"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
            >
              {t('action_cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#2D4A22] text-white text-xs font-bold shadow cursor-pointer"
            >
              {t('action_saveRecord')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reusable Request Correction Modal */}
      <RequestCorrectionModal
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        recordTypeOrDate={correctionRecordTitle}
        initialField={correctionField}
        initialExistingValue={correctionExistingVal}
        availableFields={[
          { name: 'Tomorrow Activities', label: 'Tomorrow Activities', currentValue: activitiesList.join('; ') },
          { name: 'Medical Cover', label: 'Medical Cover Detachments', currentValue: medicalCoverList.join('; ') },
          { name: 'Food Menu', label: 'Daily Food Menu', currentValue: foodMenu },
          { name: 'Leave Breakdown', label: 'Out Unit / Leave Count Breakdown', currentValue: `C: ${cLeaveCount}, P: ${pLeaveCount}, Med: ${medLeaveCount}, CMH: ${cmhAdmittedCount}` }
        ]}
        onSuccess={() => loadData(selectedDate)}
      />
    </div>
  );
};
