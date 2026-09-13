import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { 
  ParadeState, ParadeStatePersonnelItem, ParadeStateOutUnitBreakdown, CorrectionRequest 
} from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { logAuditEvent } from '../../services/auditService';
import { syncEntityToCloud, deleteEntityFromCloud } from '../../services/firebaseSyncService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  CalendarCheck, Plus, Trash2, Printer, Download, 
  Send, AlertTriangle, CheckCircle2, Users, Calendar, 
  Clock, ShieldCheck, UserCheck, ShieldAlert, History, Edit3, Save, Lock, Unlock, Check, Sparkles
} from 'lucide-react';

interface ParadeStateModuleProps {
  onNavigate?: (path: string) => void;
}

export const ParadeStateModule: React.FC<ParadeStateModuleProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { t, formatNumber } = useLanguage();

  // Selected date (Defaults to current Asia/Dhaka date)
  const getTodayDhakaDate = () => {
    const now = new Date();
    const dtf = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' });
    return dtf.format(now); // "YYYY-MM-DD"
  };

  const todayStr = getTodayDhakaDate();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [paradeState, setParadeState] = useState<ParadeState | null>(null);
  const [allAvailableDates, setAllAvailableDates] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [activeCorrection, setActiveCorrection] = useState<CorrectionRequest | null>(null);

  // Strength fields (5 cadres Posted)
  const [strOffrs, setStrOffrs] = useState<number>(6);
  const [strJco, setStrJco] = useState<number>(8);
  const [strOrs, setStrOrs] = useState<number>(140);
  const [strNce, setStrNce] = useState<number>(12);
  const [strNcu, setStrNcu] = useState<number>(4);

  // Strength fields (5 cadres Present / On Parade)
  const [presentOffrs, setPresentOffrs] = useState<number>(5);
  const [presentJco, setPresentJco] = useState<number>(7);
  const [presentOrs, setPresentOrs] = useState<number>(122);
  const [presentNce, setPresentNce] = useState<number>(10);
  const [presentNcu, setPresentNcu] = useState<number>(4);

  // Overall State Modal State
  const [isOverallModalOpen, setIsOverallModalOpen] = useState<boolean>(false);
  const [editPostedOffrs, setEditPostedOffrs] = useState<number>(6);
  const [editPostedJco, setEditPostedJco] = useState<number>(8);
  const [editPostedOrs, setEditPostedOrs] = useState<number>(140);
  const [editPostedNce, setEditPostedNce] = useState<number>(12);
  const [editPostedNcu, setEditPostedNcu] = useState<number>(4);

  const [editPresentOffrs, setEditPresentOffrs] = useState<number>(5);
  const [editPresentJco, setEditPresentJco] = useState<number>(7);
  const [editPresentOrs, setEditPresentOrs] = useState<number>(122);
  const [editPresentNce, setEditPresentNce] = useState<number>(10);
  const [editPresentNcu, setEditPresentNcu] = useState<number>(4);

  const [editCLeave, setEditCLeave] = useState<number>(4);
  const [editPLeave, setEditPLeave] = useState<number>(9);
  const [editMedLeave, setEditMedLeave] = useState<number>(2);
  const [editCmhAdmitted, setEditCmhAdmitted] = useState<number>(1);
  const [editMaternityLeave, setEditMaternityLeave] = useState<number>(0);
  const [editCourse, setEditCourse] = useState<number>(4);
  const [editTyAtt, setEditTyAtt] = useState<number>(2);
  const [editOtherOut, setEditOtherOut] = useState<number>(0);

  const [saveStatusMsg, setSaveStatusMsg] = useState<string | null>(null);

  // Out Unit Category Breakdown Counts
  const [cLeaveCount, setCLeaveCount] = useState<number>(4);
  const [pLeaveCount, setPLeaveCount] = useState<number>(9);
  const [medLeaveCount, setMedLeaveCount] = useState<number>(2);
  const [cmhAdmittedCount, setCmhAdmittedCount] = useState<number>(1);
  const [maternityLeaveCount, setMaternityLeaveCount] = useState<number>(0);
  const [courseCount, setCourseCount] = useState<number>(4);
  const [tyAttCount, setTyAttCount] = useState<number>(2);
  const [otherOutCount, setOtherOutCount] = useState<number>(0);

  // Personnel status assignment (Primary status to prevent double-counting)
  const [personnelList, setPersonnelList] = useState<ParadeStatePersonnelItem[]>([]);

  // Detailed lists
  const [tyAttList, setTyAttList] = useState<string[]>([]);
  const [coursesList, setCoursesList] = useState<string[]>([]);
  const [activitiesList, setActivitiesList] = useState<string[]>([]);
  const [medicalCoverList, setMedicalCoverList] = useState<string[]>([]);
  const [foodMenu, setFoodMenu] = useState<string>('');
  const [greeting, setGreeting] = useState<string>('Assalamualaikum Sir');
  const [closingRegards, setClosingRegards] = useState<string>('Profound Regards');

  // Input helpers for editing lists
  const [newTyAtt, setNewTyAtt] = useState<string>('');
  const [newCourse, setNewCourse] = useState<string>('');
  const [newActivity, setNewActivity] = useState<string>('');
  const [newMedCover, setNewMedCover] = useState<string>('');

  // Editing single item modals
  const [editingActivityIdx, setEditingActivityIdx] = useState<number | null>(null);
  const [editActivityText, setEditActivityText] = useState<string>('');
  const [editingMedCoverIdx, setEditingMedCoverIdx] = useState<number | null>(null);
  const [editMedCoverText, setEditMedCoverText] = useState<string>('');

  // Personnel Status Modal
  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState<boolean>(false);
  const [newPNo, setNewPNo] = useState<string>('');
  const [newPAppt, setNewPAppt] = useState<string>('');
  const [newPSec, setNewPSec] = useState<string>('Med');
  const [newPStatus, setNewPStatus] = useState<ParadeStatePersonnelItem['status']>('ON_PARADE');
  const [newPRemarks, setNewPRemarks] = useState<string>('');

  // Calculated Strength & Formulae
  const totalStrength = Number(strOffrs) + Number(strJco) + Number(strOrs) + Number(strNce) + Number(strNcu);
  const totalPresentStrength = Number(presentOffrs) + Number(presentJco) + Number(presentOrs) + Number(presentNce) + Number(presentNcu);

  // Out Unit Total = Sum of all distinct Out Unit categories (or totalStrength - totalPresentStrength)
  const calculatedOutUnit = Math.max(0, totalStrength - totalPresentStrength);
  const calculatedOnParade = totalPresentStrength;

  // Check if dates record exists or auto-reset for new day
  const loadParadeStateForDate = async (targetDate: string) => {
    const allRecords = await db.paradeStates.orderBy('stateDate').reverse().toArray();
    const dates = allRecords.map(r => r.stateDate);
    if (!dates.includes(todayStr)) {
      dates.unshift(todayStr);
    }
    setAllAvailableDates(Array.from(new Set(dates)));

    // Check if there is an active CO approved correction for Parade State
    const activeCorr = await db.correctionRequests
      .filter(c => c.status === 'CO_APPROVED_UNLOCKED' && (c.recordTypeOrDate.toLowerCase().includes('parade') || c.recordTypeOrDate.includes(targetDate)))
      .first();

    setActiveCorrection(activeCorr || null);

    let record = await db.paradeStates.where('stateDate').equals(targetDate).first();

    if (!record && targetDate === todayStr) {
      // Inherit from the most recent existing record if available, so user's data is never overwritten by hardcoded demo numbers
      const prev = allRecords.length > 0 ? allRecords[0] : null;
      const freshRecord: ParadeState = {
        id: `parade-${targetDate}`,
        stateDate: targetDate,
        dayOfWeek: new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Dhaka' }).format(new Date()),
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

      await db.paradeStates.add(freshRecord);
      record = freshRecord;
    }

    if (record) {
      setParadeState(record);
      setStrOffrs(record.strOffrs || 0);
      setStrJco(record.strJco || 0);
      setStrOrs(record.strOrs || 0);
      setStrNce(record.strNce || 0);
      setStrNcu(record.strNcu || 0);

      setPresentOffrs(record.presentOffrs ?? Math.max(0, (record.strOffrs || 6) - 1));
      setPresentJco(record.presentJco ?? Math.max(0, (record.strJco || 8) - 1));
      setPresentOrs(record.presentOrs ?? Math.max(0, (record.strOrs || 140) - 18));
      setPresentNce(record.presentNce ?? Math.max(0, (record.strNce || 12) - 2));
      setPresentNcu(record.presentNcu ?? (record.strNcu || 4));

      const bd = record.outUnitBreakdown || {
        cLeave: 4,
        pLeave: 9,
        medicalLeave: 2,
        cmhAdmitted: 1,
        maternityLeave: 0,
        course: 4,
        temporaryAttachment: 2,
        otherOutUnit: 0
      };

      setCLeaveCount(bd.cLeave || 0);
      setPLeaveCount(bd.pLeave || 0);
      setMedLeaveCount(bd.medicalLeave || 0);
      setCmhAdmittedCount(bd.cmhAdmitted || 0);
      setMaternityLeaveCount(bd.maternityLeave || 0);
      setCourseCount(bd.course || 0);
      setTyAttCount(bd.temporaryAttachment || 0);
      setOtherOutCount(bd.otherOutUnit || 0);

      setPersonnelList(record.personnelList || []);
      setTyAttList(record.tyAttDetails || []);
      setCoursesList(record.courseDetails || []);
      setActivitiesList(record.tomorrowActivities || [
        '0600h: Unit Physical Training & Resuscitation Drill',
        '0830h: Weekly Special Medical Transport & Oxygen Cascade Inspection',
        '1100h: Cold-Chain & Vaccine Storage Integrity Audit'
      ]);
      setMedicalCoverList(record.medicalCover || [
        '01 x SMT Field ICU Ambulance detachment for Bde Live-Fire Exercise',
        '01 x Mobile Resuscitation Post at Range Perimeter'
      ]);
      setFoodMenu(record.foodMenu || '');
      setGreeting(record.greeting || 'Assalamualaikum Sir');
      setClosingRegards(record.closingRegards || 'Profound Regards');

      // Auto-unlock if record is in draft or if active correction was granted by CO
      setIsEditing(record.status === 'DRAFT' || Boolean(activeCorr));
    }
  };

  useEffect(() => {
    loadParadeStateForDate(selectedDate);

    const handleCloudSync = (e: any) => {
      const col = e?.detail?.collection;
      if (!col || ['paradeStates', 'sectionApprovals', 'correctionRequests', 'manpowerPersonnel', 'rankTradeDistributions'].includes(col)) {
        loadParadeStateForDate(selectedDate);
      }
    };
    window.addEventListener('unit-ready-cloud-sync', handleCloudSync);
    return () => window.removeEventListener('unit-ready-cloud-sync', handleCloudSync);
  }, [selectedDate]);

  // Open Overall State Modal
  const handleOpenOverallModal = () => {
    setEditPostedOffrs(strOffrs);
    setEditPostedJco(strJco);
    setEditPostedOrs(strOrs);
    setEditPostedNce(strNce);
    setEditPostedNcu(strNcu);

    setEditPresentOffrs(presentOffrs);
    setEditPresentJco(presentJco);
    setEditPresentOrs(presentOrs);
    setEditPresentNce(presentNce);
    setEditPresentNcu(presentNcu);

    setEditCLeave(cLeaveCount);
    setEditPLeave(pLeaveCount);
    setEditMedLeave(medLeaveCount);
    setEditCmhAdmitted(cmhAdmittedCount);
    setEditMaternityLeave(maternityLeaveCount);
    setEditCourse(courseCount);
    setEditTyAtt(tyAttCount);
    setEditOtherOut(otherOutCount);

    setIsOverallModalOpen(true);
  };

  // Save Overall State directly to Firestore & Dexie
  const handleSaveOverallState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paradeState) return;

    if (
      editPostedOffrs < 0 || editPostedJco < 0 || editPostedOrs < 0 || editPostedNce < 0 || editPostedNcu < 0 ||
      editPresentOffrs < 0 || editPresentJco < 0 || editPresentOrs < 0 || editPresentNce < 0 || editPresentNcu < 0
    ) {
      alert('All strength counts must be non-negative integers.');
      return;
    }

    if (editPresentOffrs > editPostedOffrs) {
      alert('Present Officers cannot exceed Posted Officers.');
      return;
    }
    if (editPresentJco > editPostedJco) {
      alert('Present JCOs cannot exceed Posted JCOs.');
      return;
    }
    if (editPresentOrs > editPostedOrs) {
      alert('Present ORs cannot exceed Posted ORs.');
      return;
    }
    if (editPresentNce > editPostedNce) {
      alert('Present NC(E) cannot exceed Posted NC(E).');
      return;
    }
    if (editPresentNcu > editPostedNcu) {
      alert('Present NC(U) cannot exceed Posted NC(U).');
      return;
    }

    const newTotalPosted = Number(editPostedOffrs) + Number(editPostedJco) + Number(editPostedOrs) + Number(editPostedNce) + Number(editPostedNcu);
    const newTotalPresent = Number(editPresentOffrs) + Number(editPresentJco) + Number(editPresentOrs) + Number(editPresentNce) + Number(editPresentNcu);
    const newOutUnit = Math.max(0, newTotalPosted - newTotalPresent);

    const updatedBreakdown: ParadeStateOutUnitBreakdown = {
      cLeave: Number(editCLeave),
      pLeave: Number(editPLeave),
      medicalLeave: Number(editMedLeave),
      cmhAdmitted: Number(editCmhAdmitted),
      maternityLeave: Number(editMaternityLeave),
      course: Number(editCourse),
      temporaryAttachment: Number(editTyAtt),
      otherOutUnit: Number(editOtherOut)
    };

    const updated: ParadeState = {
      ...paradeState,
      strOffrs: Number(editPostedOffrs),
      strJco: Number(editPostedJco),
      strOrs: Number(editPostedOrs),
      strNce: Number(editPostedNce),
      strNcu: Number(editPostedNcu),
      totalStrength: newTotalPosted,
      presentOffrs: Number(editPresentOffrs),
      presentJco: Number(editPresentJco),
      presentOrs: Number(editPresentOrs),
      presentNce: Number(editPresentNce),
      presentNcu: Number(editPresentNcu),
      onParadeCount: newTotalPresent,
      outUnitTotal: newOutUnit,
      outUnitBreakdown: updatedBreakdown,
      updatedAt: new Date().toISOString()
    };

    await db.paradeStates.put(updated);
    await syncEntityToCloud('paradeStates', updated.id, updated);

    setStrOffrs(Number(editPostedOffrs));
    setStrJco(Number(editPostedJco));
    setStrOrs(Number(editPostedOrs));
    setStrNce(Number(editPostedNce));
    setStrNcu(Number(editPostedNcu));

    setPresentOffrs(Number(editPresentOffrs));
    setPresentJco(Number(editPresentJco));
    setPresentOrs(Number(editPresentOrs));
    setPresentNce(Number(editPresentNce));
    setPresentNcu(Number(editPresentNcu));

    setCLeaveCount(Number(editCLeave));
    setPLeaveCount(Number(editPLeave));
    setMedLeaveCount(Number(editMedLeave));
    setCmhAdmittedCount(Number(editCmhAdmitted));
    setMaternityLeaveCount(Number(editMaternityLeave));
    setCourseCount(Number(editCourse));
    setTyAttCount(Number(editTyAtt));
    setOtherOutCount(Number(editOtherOut));

    setParadeState(updated);
    setIsOverallModalOpen(false);

    // Sync with db.rankTradeDistributions
    try {
      const rtdItems = await db.rankTradeDistributions.toArray();
      for (const item of rtdItems) {
        if (item.classification === 'Offr') {
          const u = { ...item, postedCount: editPostedOffrs, presentCount: editPresentOffrs, outUnitCount: editPostedOffrs - editPresentOffrs, shortfall: Math.max(0, item.authCount - editPostedOffrs), updatedAt: new Date().toISOString() };
          await db.rankTradeDistributions.put(u);
          await syncEntityToCloud('rankTradeDistributions', u.id, u);
        } else if (item.classification === 'JCO') {
          const u = { ...item, postedCount: editPostedJco, presentCount: editPresentJco, outUnitCount: editPostedJco - editPresentJco, shortfall: Math.max(0, item.authCount - editPostedJco), updatedAt: new Date().toISOString() };
          await db.rankTradeDistributions.put(u);
          await syncEntityToCloud('rankTradeDistributions', u.id, u);
        } else if (item.classification === 'NC(E)') {
          const u = { ...item, postedCount: editPostedNce, presentCount: editPresentNce, outUnitCount: editPostedNce - editPresentNce, shortfall: Math.max(0, item.authCount - editPostedNce), updatedAt: new Date().toISOString() };
          await db.rankTradeDistributions.put(u);
          await syncEntityToCloud('rankTradeDistributions', u.id, u);
        } else if (item.classification === 'NC(U)') {
          const u = { ...item, postedCount: editPostedNcu, presentCount: editPresentNcu, outUnitCount: editPostedNcu - editPresentNcu, shortfall: Math.max(0, item.authCount - editPostedNcu), updatedAt: new Date().toISOString() };
          await db.rankTradeDistributions.put(u);
          await syncEntityToCloud('rankTradeDistributions', u.id, u);
        }
      }
    } catch (err) {
      console.warn('RankTrade sync warning:', err);
    }

    await logAuditEvent(
      currentUser,
      'PARADE_STATE_SAVED',
      'parade_state',
      selectedDate,
      `Updated Overall State for ${selectedDate}: Posted=${newTotalPosted}, Present=${newTotalPresent}, OutUnit=${newOutUnit}`
    );

    setSaveStatusMsg(`✅ Overall State for ${selectedDate} updated and synced successfully to Firestore!`);
    setTimeout(() => setSaveStatusMsg(null), 4000);
  };

  // Personnel filter for currently On Parade list
  const personnelOnParade = useMemo(() => {
    return personnelList.filter(p => p.status === 'ON_PARADE');
  }, [personnelList]);

  // Save Draft action
  const handleSaveDraft = async () => {
    if (!paradeState) return;

    const updatedBreakdown: ParadeStateOutUnitBreakdown = {
      cLeave: Number(cLeaveCount),
      pLeave: Number(pLeaveCount),
      medicalLeave: Number(medLeaveCount),
      cmhAdmitted: Number(cmhAdmittedCount),
      maternityLeave: Number(maternityLeaveCount),
      course: Number(courseCount),
      temporaryAttachment: Number(tyAttCount),
      otherOutUnit: Number(otherOutCount)
    };

    const updated: ParadeState = {
      ...paradeState,
      strOffrs: Number(strOffrs),
      strJco: Number(strJco),
      strOrs: Number(strOrs),
      strNce: Number(strNce),
      strNcu: Number(strNcu),
      totalStrength: totalStrength,
      presentOffrs: Number(presentOffrs),
      presentJco: Number(presentJco),
      presentOrs: Number(presentOrs),
      presentNce: Number(presentNce),
      presentNcu: Number(presentNcu),
      onParadeCount: calculatedOnParade,
      outUnitTotal: calculatedOutUnit,
      outUnitBreakdown: updatedBreakdown,
      personnelList,
      tyAttDetails: tyAttList,
      courseDetails: coursesList,
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
    setIsEditing(false);

    await logAuditEvent(
      currentUser,
      'PARADE_STATE_SAVED',
      'parade_state',
      updated.stateDate,
      `Saved Daily Parade State for ${updated.stateDate}. Total: ${totalStrength}, On Parade: ${calculatedOnParade}, Out Unit: ${calculatedOutUnit}.`
    );

    setSaveStatusMsg(`✅ Daily Parade State saved successfully!`);
    setTimeout(() => setSaveStatusMsg(null), 4000);
  };

  // Submit Corrected Record to CO (When under CO approved correction)
  const handleSubmitCorrectionToCo = async () => {
    if (!paradeState || !activeCorrection) return;

    const nowIso = new Date().toISOString();
    await handleSaveDraft();

    await db.correctionRequests.update(activeCorrection.id, {
      status: 'CORRECTION_SUBMITTED',
      correctedValueApplied: `Parade State updated on ${selectedDate}`,
      coDecidedAt: nowIso
    });

    await logAuditEvent(
      currentUser,
      'RECORD_SUBMITTED',
      'correction',
      activeCorrection.referenceNo,
      `Operator completed corrections for Parade State ${selectedDate}. Forwarded for CO Final Confirmation.`
    );

    alert('CORRECTION SUBMITTED: The Daily Parade State has been forwarded to the Commanding Officer (CO) for confirmation.');
    setActiveCorrection(null);
    loadParadeStateForDate(selectedDate);
  };

  // Submit to QM action
  const handleSubmitToQm = async () => {
    if (!paradeState) return;

    const nowIso = new Date().toISOString();
    const updated: ParadeState = {
      ...paradeState,
      status: 'SUBMITTED',
      preparedBy: currentUser.appointmentTitle,
      updatedAt: nowIso
    };

    await db.paradeStates.put(updated);
    await syncEntityToCloud('paradeStates', updated.id, updated);
    setParadeState(updated);

    const appr = await db.sectionApprovals.where('section').equals('parade_state').first();
    if (appr) {
      const updatedAppr = {
        ...appr,
        status: 'SUBMITTED' as const,
        submittedByAppointment: currentUser.appointmentTitle,
        submittedAt: nowIso
      };
      await db.sectionApprovals.update(appr.id, updatedAppr);
      await syncEntityToCloud('sectionApprovals', appr.id, updatedAppr);
    }

    await logAuditEvent(
      currentUser,
      'RECORD_SUBMITTED',
      'parade_state',
      paradeState.stateDate,
      `Submitted Daily Parade State ${paradeState.stateDate} to QM for verification.`
    );

    alert('Daily Parade State submitted to QM.');
  };

  // QM Review Approval
  const handleQmReviewApprove = async () => {
    if (!paradeState) return;
    const nowIso = new Date().toISOString();

    const updated: ParadeState = {
      ...paradeState,
      status: 'QM_APPROVED',
      qmApprovedBy: currentUser.appointmentTitle,
      updatedAt: nowIso
    };
    await db.paradeStates.put(updated);
    await syncEntityToCloud('paradeStates', updated.id, updated);
    setParadeState(updated);

    const appr = await db.sectionApprovals.where('section').equals('parade_state').first();
    if (appr) {
      const updatedAppr = {
        ...appr,
        status: 'QM_APPROVED' as const,
        intermediateAppointment: currentUser.appointmentTitle,
        intermediateDecision: 'APPROVED' as const,
        intermediateRemarks: 'Verified strength and On-Parade roll muster.',
        intermediateDecidedAt: nowIso
      };
      await db.sectionApprovals.update(appr.id, updatedAppr);
      await syncEntityToCloud('sectionApprovals', appr.id, updatedAppr);
    }

    await logAuditEvent(
      currentUser,
      'QM_APPROVED',
      'parade_state',
      paradeState.stateDate,
      `QM approved Daily Parade State for ${paradeState.stateDate}. Forwarded to CO.`
    );

    alert('QM review verified. Forwarded to Commanding Officer for command approval.');
  };

  // CO Command Approval (WITHOUT Locking)
  const handleCoFinalApprove = async () => {
    if (!paradeState) return;
    const nowIso = new Date().toISOString();

    const updated: ParadeState = {
      ...paradeState,
      status: 'CO_APPROVED',
      coApprovedBy: currentUser.appointmentTitle,
      updatedAt: nowIso
    };
    await db.paradeStates.put(updated);
    await syncEntityToCloud('paradeStates', updated.id, updated);
    setParadeState(updated);

    const appr = await db.sectionApprovals.where('section').equals('parade_state').first();
    if (appr) {
      const updatedAppr = {
        ...appr,
        status: 'CO_APPROVED' as const,
        coAppointment: currentUser.appointmentTitle,
        coDecision: 'FINAL_APPROVED' as const,
        coRemarks: 'Commanding Officer approval granted. Record remains editable by authorized personnel.',
        coDecidedAt: nowIso
      };
      await db.sectionApprovals.update(appr.id, updatedAppr);
      await syncEntityToCloud('sectionApprovals', appr.id, updatedAppr);
    }

    await logAuditEvent(
      currentUser,
      'CO_APPROVED',
      'parade_state',
      paradeState.stateDate,
      `Commanding Officer approved Daily Parade State for ${paradeState.stateDate}.`
    );

    alert('COMMAND APPROVAL GRANTED: Daily Parade State has received Commanding Officer approval.');
  };

  // Tomorrow Activities Edit Handlers
  const handleAddActivity = () => {
    if (!newActivity.trim()) return;
    setActivitiesList([...activitiesList, newActivity.trim()]);
    setNewActivity('');
  };

  const handleStartEditActivity = (idx: number) => {
    setEditingActivityIdx(idx);
    setEditActivityText(activitiesList[idx]);
  };

  const handleSaveEditActivity = (idx: number) => {
    if (!editActivityText.trim()) return;
    const updated = [...activitiesList];
    updated[idx] = editActivityText.trim();
    setActivitiesList(updated);
    setEditingActivityIdx(null);
    setEditActivityText('');
  };

  const handleRemoveActivity = (idx: number) => {
    setActivitiesList(activitiesList.filter((_, i) => i !== idx));
  };

  // Medical Cover Detachment Edit Handlers
  const handleAddMedCover = () => {
    if (!newMedCover.trim()) return;
    setMedicalCoverList([...medicalCoverList, newMedCover.trim()]);
    setNewMedCover('');
  };

  const handleStartEditMedCover = (idx: number) => {
    setEditingMedCoverIdx(idx);
    setEditMedCoverText(medicalCoverList[idx]);
  };

  const handleSaveEditMedCover = (idx: number) => {
    if (!editMedCoverText.trim()) return;
    const updated = [...medicalCoverList];
    updated[idx] = editMedCoverText.trim();
    setMedicalCoverList(updated);
    setEditingMedCoverIdx(null);
    setEditMedCoverText('');
  };

  const handleRemoveMedCover = (idx: number) => {
    setMedicalCoverList(medicalCoverList.filter((_, i) => i !== idx));
  };

  // Personnel Status Update / Add
  const handleAddPersonnel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPNo.trim() || !newPAppt.trim()) return;

    const newItem: ParadeStatePersonnelItem = {
      id: 'psp-' + Date.now(),
      personalNumber: newPNo.trim(),
      appointment: newPAppt.trim(),
      sectionCode: newPSec,
      status: newPStatus,
      statusRemarks: newPRemarks.trim() || undefined
    };

    setPersonnelList([...personnelList, newItem]);
    setIsPersonnelModalOpen(false);
    setNewPNo('');
    setNewPAppt('');
    setNewPRemarks('');
  };

  const handleRemovePersonnel = (id: string) => {
    setPersonnelList(personnelList.filter(p => p.id !== id));
  };

  // Print view
  const handlePrint = () => {
    window.print();
    logAuditEvent(currentUser, 'PDF_PRINTED', 'parade_state', selectedDate, 'Printed Daily Parade State sheet');
  };

  // PDF Export
  const handleExportPdf = () => {
    const doc = new jsPDF();

    // Main Heading — strictly "DAILY PARADE STATE"
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('95 FIELD AMBULANCE', 105, 14, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DAILY PARADE STATE', 105, 21, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${selectedDate} | Day: ${paradeState?.dayOfWeek?.toUpperCase() || ''}`, 105, 27, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(`"${greeting}"`, 105, 33, { align: 'center' });

    // Table 1: Core Strength Equation Summary (Posted Strength, On Parade, Out Unit)
    autoTable(doc, {
      startY: 37,
      head: [['Category', 'Officers', 'JCOs', 'ORs', 'NC(E)', 'NC(U)', 'TOTAL']],
      body: [
        ['Posted Strength (Total Posted)', strOffrs, strJco, strOrs, strNce, strNcu, totalStrength],
        ['On Parade (Present in Unit)', presentOffrs, presentJco, presentOrs, presentNce, presentNcu, calculatedOnParade],
        ['Out Unit (Total Posted - On Parade)', strOffrs - presentOffrs, strJco - presentJco, strOrs - presentOrs, strNce - presentNce, strNcu - presentNcu, calculatedOutUnit]
      ],
      theme: 'grid',
      headStyles: { fillColor: [45, 74, 34], textColor: 255, fontStyle: 'bold' }
    });

    // Table 2: Category-wise Out Unit Breakdown
    const finalY1 = (doc as any).lastAutoTable.finalY + 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('CATEGORY-WISE OUT UNIT BREAKDOWN', 14, finalY1);

    autoTable(doc, {
      startY: finalY1 + 2,
      head: [['C Leave', 'P Leave', 'Medical Leave', 'CMH Admitted', 'Maternity', 'Course', 'Ty Att', 'Other Out', 'OUT UNIT TOTAL']],
      body: [
        [cLeaveCount, pLeaveCount, medLeaveCount, cmhAdmittedCount, maternityLeaveCount, courseCount, tyAttCount, otherOutCount, calculatedOutUnit]
      ],
      theme: 'grid',
      headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: 'bold' }
    });

    const finalY2 = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tomorrow Activities: ${activitiesList.join('; ') || 'Routine'}`, 14, finalY2, { maxWidth: 180 });
    doc.text(`Medical Cover: ${medicalCoverList.join('; ') || 'Standard Bay Cover'}`, 14, finalY2 + 10, { maxWidth: 180 });
    doc.text(`Food Menu: ${foodMenu || 'Standard Menu'}`, 14, finalY2 + 18, { maxWidth: 180 });

    doc.setFont('helvetica', 'bold');
    doc.text(`${closingRegards} — ${currentUser.appointmentTitle}`, 105, finalY2 + 32, { align: 'center' });

    doc.save(`95FA_Daily_Parade_State_${selectedDate}.pdf`);
    logAuditEvent(currentUser, 'PDF_GENERATED', 'parade_state', selectedDate, 'Exported Daily Parade State PDF');
  };

  const isToday = selectedDate === todayStr;
  const isLocked = false;
  const canEdit = currentUser.role !== 'general_viewer';

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

    const freshRecord: ParadeState = {
      id: `parade-${newDate}`,
      stateDate: newDate,
      dayOfWeek: new Date(newDate).toLocaleDateString('en-US', { weekday: 'long' }),
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
      courseDetails: [],
      tyAttDetails: [],
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
      preparedBy: currentUser.appointmentTitle,
      updatedAt: new Date().toISOString()
    };

    await db.paradeStates.put(freshRecord);
    await syncEntityToCloud('paradeStates', freshRecord.id, freshRecord);
    setAllAvailableDates(prev => prev.includes(newDate) ? prev : [newDate, ...prev]);
    setSelectedDate(newDate);
    setIsEditing(true);
  };

  // Delete Daily Parade State
  const handleDeleteParadeState = async () => {
    if (!paradeState) return;
    const confirm = window.confirm(
      `Are you sure you want to delete the Daily Parade State for ${paradeState.stateDate}?\n\nThis will permanently remove only this date's parade state. Other dates and the master nominal roll will not be affected.`
    );
    if (!confirm) return;

    const deletedDate = paradeState.stateDate;
    await db.paradeStates.delete(paradeState.id);
    await deleteEntityFromCloud('paradeStates', paradeState.id);

    await logAuditEvent(
      currentUser,
      'RECORD_DELETED',
      'parade_state',
      deletedDate,
      `Deleted Daily Parade State for ${deletedDate}`
    );

    const remaining = allAvailableDates.filter(d => d !== deletedDate);
    const newTargetDate = remaining.length > 0 ? remaining[0] : todayStr;
    setAllAvailableDates(remaining.length > 0 ? remaining : [todayStr]);
    setSelectedDate(newTargetDate);
    await loadParadeStateForDate(newTargetDate);

    setSaveStatusMsg(`✅ Daily Parade State for ${deletedDate} deleted successfully.`);
    setTimeout(() => setSaveStatusMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Read-Only Notice Banner for General Viewers */}
      {!canEdit && (
        <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 shadow-xs">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>Read-Only View Mode:</strong> You have view-only access to the official daily parade state.
            </span>
          </div>
          <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded font-bold">
            VIEW ONLY
          </span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
              DAILY PARADE STATE
            </h1>
            <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
              95 FD AMB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Formula: Total Posted - Out Unit = On Parade. Continuous CRUD control for authorized operators.
          </p>
        </div>

        {/* Date Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Selector */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <History className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-mono font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {allAvailableDates.map((d) => (
                <option key={d} value={d} className="bg-white dark:bg-slate-900">
                  {d} {d === todayStr ? '(Today)' : ''}
                </option>
              ))}
            </select>
          </div>

          {paradeState && <StatusBadge status={paradeState.status} />}

          {/* Edit / Save / Delete Action Buttons */}
          {canEdit && (
            <>
              {/* 1. Edit Summary Button (prominently beside New State) */}
              <button
                onClick={handleOpenOverallModal}
                className="px-3.5 py-1.5 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-black text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer"
                title="Edit Daily Parade State Summary (Posted, Present and Out Unit counts)"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Summary</span>
              </button>

              {/* 2. New State Button */}
              <button
                onClick={handleCreateNewParadeState}
                className="px-3 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow transition flex items-center gap-1 cursor-pointer"
                title="Create a new Daily Parade State"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New State</span>
              </button>

              {/* 3. Inline Edit Toggle */}
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'View Mode' : 'Edit State Details'}</span>
              </button>

              {isEditing && (
                <button
                  onClick={handleSaveDraft}
                  className="px-3.5 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow transition flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save State</span>
                </button>
              )}

              {/* 4. Delete Daily Parade State Button */}
              {paradeState && (
                <button
                  onClick={handleDeleteParadeState}
                  className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs font-bold shadow flex items-center gap-1 cursor-pointer"
                  title="Delete Daily Parade State"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Daily Parade State</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1 shadow"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
          <button
            onClick={handleExportPdf}
            className="px-3 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold transition flex items-center gap-1 shadow"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Save / Delete Status Alert Banner */}
      {saveStatusMsg && (
        <div className="p-3.5 rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{saveStatusMsg}</span>
          </div>
          <button onClick={() => setSaveStatusMsg(null)} className="text-xs px-2 py-0.5 rounded bg-white/50 hover:bg-white text-slate-700 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Main Parade State Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-md border-2 border-[#2D4A22]/40 dark:border-emerald-800/40 p-6 sm:p-8 space-y-6 max-w-5xl mx-auto font-sans text-xs">
        
        {/* Main Heading Header */}
        <div className="text-center pb-4 border-b-2 border-slate-200 dark:border-slate-800">
          <span className="bg-[#2D4A22] text-white font-mono text-[10px] uppercase font-black px-3 py-0.5 rounded-full">
            95 FIELD AMBULANCE
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-widest text-[#2D4A22] dark:text-emerald-400 mt-2 uppercase">
            DAILY PARADE STATE
          </h2>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono mt-0.5">
            Date: <strong>{formatNumber(selectedDate)}</strong> | Day: <strong>{paradeState?.dayOfWeek?.toUpperCase()}</strong>
          </p>
          <p className="text-sm font-serif italic text-slate-600 dark:text-slate-400 mt-2">
            "{greeting}"
          </p>
        </div>

        {/* 3 Main Summary Cards: POSTED STRENGTH (TOTAL POSTED), ON PARADE (PRESENT), OUT UNIT */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: POSTED STRENGTH (TOTAL POSTED) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center flex flex-col justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase block font-sans tracking-wide">
                POSTED STRENGTH (TOTAL POSTED)
              </span>
              <span className="text-3xl font-black text-slate-900 dark:text-white font-mono mt-1 block">
                {formatNumber(totalStrength)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                Total Personnel on Unit Roll for {selectedDate}
              </span>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-5 gap-1 text-[10px] font-mono">
              <div><span className="text-slate-400 block font-sans">Offr</span><strong>{strOffrs}</strong></div>
              <div><span className="text-slate-400 block font-sans">JCO</span><strong>{strJco}</strong></div>
              <div><span className="text-slate-400 block font-sans">ORs</span><strong>{strOrs}</strong></div>
              <div><span className="text-slate-400 block font-sans">NC(E)</span><strong>{strNce}</strong></div>
              <div><span className="text-slate-400 block font-sans">NC(U)</span><strong>{strNcu}</strong></div>
            </div>
          </div>

          {/* Card 2: ON PARADE (PRESENT) */}
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 dark:border-emerald-600 text-center shadow-xs flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 uppercase block font-sans tracking-wide">
                ★ ON PARADE (PRESENT)
              </span>
              <span className="text-3xl font-black text-emerald-700 dark:text-emerald-400 font-mono mt-1 block">
                {formatNumber(totalPresentStrength)}
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono block mt-0.5 font-bold">
                Physically Present Inside Unit Today
              </span>
            </div>
            <div className="mt-3 pt-2 border-t border-emerald-200 dark:border-emerald-800 grid grid-cols-5 gap-1 text-[10px] font-mono text-emerald-900 dark:text-emerald-200">
              <div><span className="text-emerald-700 dark:text-emerald-400 block font-sans">Offr</span><strong>{presentOffrs}</strong></div>
              <div><span className="text-emerald-700 dark:text-emerald-400 block font-sans">JCO</span><strong>{presentJco}</strong></div>
              <div><span className="text-emerald-700 dark:text-emerald-400 block font-sans">ORs</span><strong>{presentOrs}</strong></div>
              <div><span className="text-emerald-700 dark:text-emerald-400 block font-sans">NC(E)</span><strong>{presentNce}</strong></div>
              <div><span className="text-emerald-700 dark:text-emerald-400 block font-sans">NC(U)</span><strong>{presentNcu}</strong></div>
            </div>
          </div>

          {/* Card 3: OUT UNIT */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-center flex flex-col justify-between shadow-xs">
            <div>
              <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 uppercase block font-sans tracking-wide">
                OUT UNIT
              </span>
              <span className="text-3xl font-black text-amber-700 dark:text-amber-400 font-mono mt-1 block">
                {formatNumber(calculatedOutUnit)}
              </span>
              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-mono block mt-0.5 font-bold">
                Posted ({totalStrength}) − On Parade ({totalPresentStrength})
              </span>
            </div>
            <div className="mt-3 pt-2 border-t border-amber-200 dark:border-amber-800 text-[10px] text-amber-800 dark:text-amber-200 font-mono flex items-center justify-around flex-wrap gap-1">
              <span>Leave: <strong>{cLeaveCount + pLeaveCount + maternityLeaveCount}</strong></span>
              <span>Med: <strong>{medLeaveCount + cmhAdmittedCount}</strong></span>
              <span>Course: <strong>{courseCount}</strong></span>
              <span>Att: <strong>{tyAttCount}</strong></span>
              <span>Other: <strong>{otherOutCount}</strong></span>
            </div>
          </div>
        </div>

        {/* 1. Posted Unit Strength Breakdown by Rank/Cadre */}
        <div className="p-4 rounded-xl bg-[#F8F9F5] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
            <span className="font-extrabold text-xs uppercase tracking-wide text-slate-800 dark:text-slate-200">
              1. Posted Unit Strength Breakdown (Held on Roll)
            </span>
            <span className="font-mono text-xs font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-1 rounded border">
              Total Posted: {formatNumber(totalStrength)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Officers</span>
              {isEditing ? (
                <input type="number" min="0" value={strOffrs} onChange={(e) => setStrOffrs(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1" />
              ) : (
                <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-100">{formatNumber(strOffrs)}</span>
              )}
            </div>
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">JCOs</span>
              {isEditing ? (
                <input type="number" min="0" value={strJco} onChange={(e) => setStrJco(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1" />
              ) : (
                <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-100">{formatNumber(strJco)}</span>
              )}
            </div>
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">ORs</span>
              {isEditing ? (
                <input type="number" min="0" value={strOrs} onChange={(e) => setStrOrs(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1" />
              ) : (
                <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-100">{formatNumber(strOrs)}</span>
              )}
            </div>
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">NC(E)</span>
              {isEditing ? (
                <input type="number" min="0" value={strNce} onChange={(e) => setStrNce(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1" />
              ) : (
                <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-100">{formatNumber(strNce)}</span>
              )}
            </div>
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">NC(U)</span>
              {isEditing ? (
                <input type="number" min="0" value={strNcu} onChange={(e) => setStrNcu(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1" />
              ) : (
                <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-100">{formatNumber(strNcu)}</span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Present / On Parade Strength Breakdown by Rank/Cadre */}
        <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border-2 border-emerald-500/40 dark:border-emerald-700 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-200 dark:border-emerald-800">
            <span className="font-extrabold text-xs uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
              2. ★ Present / On Parade Strength Breakdown (Physically in Unit)
            </span>
            <span className="font-mono text-xs font-black text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-900 px-3 py-1 rounded border border-emerald-300">
              Total Present: {formatNumber(totalPresentStrength)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">Present Offr</span>
              {isEditing ? (
                <input type="number" min="0" max={strOffrs} value={presentOffrs} onChange={(e) => setPresentOffrs(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1 text-emerald-700" />
              ) : (
                <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400">{formatNumber(presentOffrs)}</span>
              )}
            </div>
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">Present JCO</span>
              {isEditing ? (
                <input type="number" min="0" max={strJco} value={presentJco} onChange={(e) => setPresentJco(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1 text-emerald-700" />
              ) : (
                <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400">{formatNumber(presentJco)}</span>
              )}
            </div>
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">Present ORs</span>
              {isEditing ? (
                <input type="number" min="0" max={strOrs} value={presentOrs} onChange={(e) => setPresentOrs(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1 text-emerald-700" />
              ) : (
                <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400">{formatNumber(presentOrs)}</span>
              )}
            </div>
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">Present NC(E)</span>
              {isEditing ? (
                <input type="number" min="0" max={strNce} value={presentNce} onChange={(e) => setPresentNce(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1 text-emerald-700" />
              ) : (
                <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400">{formatNumber(presentNce)}</span>
              )}
            </div>
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">Present NC(U)</span>
              {isEditing ? (
                <input type="number" min="0" max={strNcu} value={presentNcu} onChange={(e) => setPresentNcu(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1 text-emerald-700" />
              ) : (
                <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400">{formatNumber(presentNcu)}</span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Category-Wise Out Unit Breakdown Grid */}
        <div className="p-4 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-amber-200 dark:border-amber-800">
            <span className="font-extrabold text-xs uppercase tracking-wide text-amber-900 dark:text-amber-300">
              3. Category-Wise Out Unit Breakdown (Not On Parade)
            </span>
            <span className="font-mono text-xs font-black text-amber-800 dark:text-amber-200 bg-white dark:bg-slate-900 px-3 py-1 rounded border border-amber-300">
              Out Unit Total: {formatNumber(calculatedOutUnit)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {/* C Leave */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block">C Leave</span>
              {isEditing ? (
                <input type="number" min="0" value={cLeaveCount} onChange={(e) => setCLeaveCount(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1 text-amber-700" />
              ) : (
                <span className="text-sm font-black font-mono text-amber-700 dark:text-amber-400">{formatNumber(cLeaveCount)}</span>
              )}
            </div>

            {/* P Leave */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block">P Leave</span>
              {isEditing ? (
                <input type="number" min="0" value={pLeaveCount} onChange={(e) => setPLeaveCount(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1 text-amber-700" />
              ) : (
                <span className="text-sm font-black font-mono text-amber-700 dark:text-amber-400">{formatNumber(pLeaveCount)}</span>
              )}
            </div>

            {/* Medical Leave */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block">Medical Leave</span>
              {isEditing ? (
                <input type="number" min="0" value={medLeaveCount} onChange={(e) => setMedLeaveCount(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1 text-red-700" />
              ) : (
                <span className="text-sm font-black font-mono text-red-600 dark:text-red-400">{formatNumber(medLeaveCount)}</span>
              )}
            </div>

            {/* CMH Admitted */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block">CMH Admitted</span>
              {isEditing ? (
                <input type="number" min="0" value={cmhAdmittedCount} onChange={(e) => setCmhAdmittedCount(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1 text-red-700" />
              ) : (
                <span className="text-sm font-black font-mono text-red-600 dark:text-red-400">{formatNumber(cmhAdmittedCount)}</span>
              )}
            </div>

            {/* Maternity Leave */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block">Maternity Leave</span>
              {isEditing ? (
                <input type="number" min="0" value={maternityLeaveCount} onChange={(e) => setMaternityLeaveCount(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1" />
              ) : (
                <span className="text-sm font-black font-mono text-slate-700 dark:text-slate-300">{formatNumber(maternityLeaveCount)}</span>
              )}
            </div>

            {/* Course */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block">Course</span>
              {isEditing ? (
                <input type="number" min="0" value={courseCount} onChange={(e) => setCourseCount(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1 text-blue-700" />
              ) : (
                <span className="text-sm font-black font-mono text-blue-600 dark:text-blue-400">{formatNumber(courseCount)}</span>
              )}
            </div>

            {/* Temporary Attachment */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block">Ty Attachment</span>
              {isEditing ? (
                <input type="number" min="0" value={tyAttCount} onChange={(e) => setTyAttCount(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1 text-indigo-700" />
              ) : (
                <span className="text-sm font-black font-mono text-indigo-600 dark:text-indigo-400">{formatNumber(tyAttCount)}</span>
              )}
            </div>

            {/* Other Out Unit */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block">Other Out Unit</span>
              {isEditing ? (
                <input type="number" min="0" value={otherOutCount} onChange={(e) => setOtherOutCount(Number(e.target.value))} className="w-full text-center font-mono font-bold border rounded p-1" />
              ) : (
                <span className="text-sm font-black font-mono text-slate-700 dark:text-slate-300">{formatNumber(otherOutCount)}</span>
              )}
            </div>
          </div>
        </div>

        {/* 3. List of Personnel Currently On Parade (Appointments & Sections Only — No Ranks) */}
        <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-200 dark:border-emerald-800">
            <div>
              <span className="font-extrabold text-xs uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
                3. Personnel Currently On Parade (Physically Present)
              </span>
              <span className="text-[10px] text-slate-500 block font-sans font-normal">
                Strictly displays appointment title and section code (no military rank).
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-900 px-3 py-1 rounded border border-emerald-300">
                On Parade: {formatNumber(personnelOnParade.length)} Personnel
              </span>
              {isEditing && (
                <button
                  onClick={() => setIsPersonnelModalOpen(true)}
                  className="px-2.5 py-1 rounded bg-[#2D4A22] text-white text-[11px] font-bold shadow flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Assign Status</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-emerald-900/10 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] uppercase font-bold">
                <tr>
                  <th className="py-2 px-3">Service / ID No</th>
                  <th className="py-2 px-3">Appointment Title</th>
                  <th className="py-2 px-3">Section / Trade</th>
                  <th className="py-2 px-3">Physical Status</th>
                  {isEditing && <th className="py-2 px-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 dark:divide-slate-800">
                {personnelOnParade.map((p) => (
                  <tr key={p.id} className="hover:bg-white dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {p.personalNumber}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                      {p.appointment}
                    </td>
                    <td className="py-2 px-3 font-mono">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-bold">
                        {p.sectionCode}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px] font-extrabold border border-emerald-300">
                        ON PARADE
                      </span>
                    </td>
                    {isEditing && (
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => handleRemovePersonnel(p.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Details: Ty Att & Courses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Temporary Attachment */}
          <div className="p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-800/40 space-y-2">
            <span className="font-bold text-xs uppercase text-slate-700 dark:text-slate-300">
              Temporary Attachment (Ty Att) Details
            </span>
            <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
              {tyAttList.map((item, idx) => (
                <li key={idx} className="flex justify-between items-center">
                  <span>{item}</span>
                  {isEditing && (
                    <button onClick={() => setTyAttList(tyAttList.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isEditing && (
              <div className="flex gap-1.5 pt-1">
                <input type="text" value={newTyAtt} onChange={(e) => setNewTyAtt(e.target.value)} placeholder="Add Ty Att detachment..." className="flex-1 px-2 py-1 border rounded text-xs" />
                <button onClick={() => { if (newTyAtt) { setTyAttList([...tyAttList, newTyAtt]); setNewTyAtt(''); } }} className="px-2 py-1 bg-[#2D4A22] text-white rounded font-bold">Add</button>
              </div>
            )}
          </div>

          {/* Courses */}
          <div className="p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-800/40 space-y-2">
            <span className="font-bold text-xs uppercase text-slate-700 dark:text-slate-300">
              Courses Details
            </span>
            <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
              {coursesList.map((item, idx) => (
                <li key={idx} className="flex justify-between items-center">
                  <span>{item}</span>
                  {isEditing && (
                    <button onClick={() => setCoursesList(coursesList.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isEditing && (
              <div className="flex gap-1.5 pt-1">
                <input type="text" value={newCourse} onChange={(e) => setNewCourse(e.target.value)} placeholder="Add course detail..." className="flex-1 px-2 py-1 border rounded text-xs" />
                <button onClick={() => { if (newCourse) { setCoursesList([...coursesList, newCourse]); setNewCourse(''); } }} className="px-2 py-1 bg-[#2D4A22] text-white rounded font-bold">Add</button>
              </div>
            )}
          </div>
        </div>

        {/* 5. Tomorrow Activities & Medical Cover Detachments (Full Interactive Editing) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tomorrow's Important Activities */}
          <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700">
              <span className="font-extrabold text-xs uppercase text-slate-800 dark:text-slate-200">
                Tomorrow's Important Activities
              </span>
              <span className="font-mono text-[10px] text-slate-500 font-bold">
                {activitiesList.length} Activities
              </span>
            </div>

            <ul className="space-y-2 text-slate-700 dark:text-slate-300">
              {activitiesList.map((item, idx) => (
                <li key={idx} className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-2">
                  {editingActivityIdx === idx ? (
                    <div className="flex-1 flex gap-1.5">
                      <input
                        type="text"
                        value={editActivityText}
                        onChange={(e) => setEditActivityText(e.target.value)}
                        className="flex-1 px-2 py-1 border rounded text-xs bg-slate-50 dark:bg-slate-800 font-semibold"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEditActivity(idx)}
                        className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[10px]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingActivityIdx(null)}
                        className="px-2 py-1 bg-slate-300 text-slate-700 rounded font-semibold text-[10px]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-1.5 flex-1">
                        <span className="w-4 h-4 rounded-full bg-[#2D4A22] text-white flex items-center justify-center text-[10px] font-bold mt-0.5 flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                          {item}
                        </span>
                      </div>
                      {isEditing && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleStartEditActivity(idx)}
                            className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition"
                            title="Edit Activity"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveActivity(idx)}
                            className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-slate-800 transition"
                            title="Remove Activity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>

            {isEditing && (
              <div className="flex gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                <input
                  type="text"
                  value={newActivity}
                  onChange={(e) => setNewActivity(e.target.value)}
                  placeholder="e.g. 0600h: Resuscitation Drill & PT..."
                  className="flex-1 px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-900"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddActivity(); } }}
                />
                <button
                  type="button"
                  onClick={handleAddActivity}
                  className="px-3 py-1.5 bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Activity</span>
                </button>
              </div>
            )}
          </div>

          {/* Medical Cover Detachments */}
          <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-700">
              <span className="font-extrabold text-xs uppercase text-slate-800 dark:text-slate-200">
                Medical Cover Detachments
              </span>
              <span className="font-mono text-[10px] text-slate-500 font-bold">
                {medicalCoverList.length} Detachments
              </span>
            </div>

            <ul className="space-y-2 text-slate-700 dark:text-slate-300">
              {medicalCoverList.map((item, idx) => (
                <li key={idx} className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-2">
                  {editingMedCoverIdx === idx ? (
                    <div className="flex-1 flex gap-1.5">
                      <input
                        type="text"
                        value={editMedCoverText}
                        onChange={(e) => setEditMedCoverText(e.target.value)}
                        className="flex-1 px-2 py-1 border rounded text-xs bg-slate-50 dark:bg-slate-800 font-semibold"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEditMedCover(idx)}
                        className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[10px]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMedCoverIdx(null)}
                        className="px-2 py-1 bg-slate-300 text-slate-700 rounded font-semibold text-[10px]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-1.5 flex-1">
                        <span className="w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-bold mt-0.5 flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                          {item}
                        </span>
                      </div>
                      {isEditing && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleStartEditMedCover(idx)}
                            className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition"
                            title="Edit Medical Cover"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveMedCover(idx)}
                            className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-slate-800 transition"
                            title="Remove Medical Cover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>

            {isEditing && (
              <div className="flex gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                <input
                  type="text"
                  value={newMedCover}
                  onChange={(e) => setNewMedCover(e.target.value)}
                  placeholder="e.g. 01 x SMT ICU Ambulance at Bde Live-Fire..."
                  className="flex-1 px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-900"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMedCover(); } }}
                />
                <button
                  type="button"
                  onClick={handleAddMedCover}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Med Cover</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 6. Food Menu & Closing Regards */}
        <div className="p-4 rounded-xl border bg-[#F8F9F5] dark:bg-slate-800/60 space-y-2">
          <span className="font-bold text-xs uppercase text-slate-800 dark:text-slate-200 block">Food Menu:</span>
          {isEditing ? (
            <textarea 
              value={foodMenu} 
              onChange={(e) => setFoodMenu(e.target.value)} 
              placeholder="e.g. Breakfast: Paratha, Egg, Dal, Tea | Lunch: Rice, Chicken Curry | Dinner: Roti, Beef..." 
              className="w-full p-2.5 border rounded-lg text-xs font-semibold bg-white dark:bg-slate-900" 
              rows={2} 
            />
          ) : (
            <p className="text-slate-700 dark:text-slate-300 italic">{foodMenu || 'Standard Military Menu'}</p>
          )}
        </div>

        {/* Closing Footer */}
        <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-800 font-serif">
          <p className="text-base font-bold text-[#2D4A22] dark:text-emerald-400">
            {closingRegards}
          </p>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
            {currentUser.appointmentTitle}
          </p>
        </div>
      </div>

      {/* Assign Personnel Status Modal */}
      <Modal
        isOpen={isPersonnelModalOpen}
        onClose={() => setIsPersonnelModalOpen(false)}
        title="Assign Primary Personnel Physical Status"
        subtitle="Each person is assigned exactly one primary status to prevent double-counting"
      >
        <form onSubmit={handleAddPersonnel} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Personal / Service ID *
              </label>
              <input
                type="text"
                value={newPNo}
                onChange={(e) => setNewPNo(e.target.value)}
                placeholder="e.g. MED-1008"
                className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Appointment Title * (No Rank)
              </label>
              <input
                type="text"
                value={newPAppt}
                onChange={(e) => setNewPAppt(e.target.value)}
                placeholder="e.g. Emergency Room Assistant"
                className="w-full px-3 py-1.5 border rounded-lg text-xs font-semibold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Section / Trade *
              </label>
              <select
                value={newPSec}
                onChange={(e) => setNewPSec(e.target.value)}
                className="w-full px-2 py-1.5 border rounded-lg text-xs font-semibold"
              >
                <option value="A">A Section</option>
                <option value="Med">Med Section</option>
                <option value="MT">MT Section</option>
                <option value="SMT">SMT Section</option>
                <option value="EME">EME Section</option>
                <option value="Clk">Clk Section</option>
                <option value="Cook">Cook Section</option>
                <option value="Tradesman">Tradesman Section</option>
                <option value="NC(E)">NC(E) Section</option>
                <option value="NC(U)">NC(U) Section</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Primary Physical Status *
              </label>
              <select
                value={newPStatus}
                onChange={(e) => setNewPStatus(e.target.value as any)}
                className="w-full px-2 py-1.5 border rounded-lg text-xs font-semibold"
              >
                <option value="ON_PARADE">★ On Parade (Physically Present in Unit)</option>
                <option value="C_LEAVE">C Leave (Casual Leave)</option>
                <option value="P_LEAVE">P Leave (Privilege Leave)</option>
                <option value="MEDICAL_LEAVE">Medical Leave (Unit Rest)</option>
                <option value="CMH_ADMITTED">CMH Admitted</option>
                <option value="MATERNITY_LEAVE">Maternity Leave</option>
                <option value="COURSE">Course</option>
                <option value="TEMPORARY_ATTACHMENT">Temporary Attachment (Ty Att)</option>
                <option value="OTHER_OUT_UNIT">Other Out Unit Status</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Status Remarks / Authority
            </label>
            <input
              type="text"
              value={newPRemarks}
              onChange={(e) => setNewPRemarks(e.target.value)}
              placeholder="e.g. Leave order #12, Course location..."
              className="w-full px-3 py-1.5 border rounded-lg text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsPersonnelModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow"
            >
              Add Personnel Status
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: EDIT DAILY PARADE STATE SUMMARY (POSTED, PRESENT, OUT) */}
      {/* ========================================================= */}
      <Modal
        isOpen={isOverallModalOpen}
        onClose={() => setIsOverallModalOpen(false)}
        title={`Edit Daily Parade State Summary — ${selectedDate}`}
        subtitle="Edit Posted Strength, Present / On Parade, and Out Unit metrics for the selected date."
      >
        <form onSubmit={handleSaveOverallState} className="space-y-4 font-sans text-xs">
          {/* 1. Posted Strength */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between border-b pb-1.5 border-slate-200 dark:border-slate-700">
              <span className="font-extrabold text-xs uppercase text-slate-800 dark:text-slate-200">
                Posted Strength
              </span>
              <span className="font-mono text-xs font-black text-[#2D4A22] dark:text-emerald-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border">
                Total Posted Strength: {Number(editPostedOffrs) + Number(editPostedJco) + Number(editPostedOrs) + Number(editPostedNce) + Number(editPostedNcu)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Posted Officers</label>
                <input
                  type="number"
                  min="0"
                  value={editPostedOffrs}
                  onChange={(e) => setEditPostedOffrs(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Posted JCOs</label>
                <input
                  type="number"
                  min="0"
                  value={editPostedJco}
                  onChange={(e) => setEditPostedJco(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Posted ORs</label>
                <input
                  type="number"
                  min="0"
                  value={editPostedOrs}
                  onChange={(e) => setEditPostedOrs(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Posted NC(E)</label>
                <input
                  type="number"
                  min="0"
                  value={editPostedNce}
                  onChange={(e) => setEditPostedNce(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Posted NC(U)</label>
                <input
                  type="number"
                  min="0"
                  value={editPostedNcu}
                  onChange={(e) => setEditPostedNcu(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900"
                  required
                />
              </div>
            </div>
          </div>

          {/* 2. Present / On Parade */}
          <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 space-y-2.5">
            <div className="flex items-center justify-between border-b pb-1.5 border-emerald-200 dark:border-emerald-800">
              <span className="font-extrabold text-xs uppercase text-emerald-900 dark:text-emerald-300">
                Present / On Parade
              </span>
              <span className="font-mono text-xs font-black text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-300">
                Total Present / On Parade Strength: {Number(editPresentOffrs) + Number(editPresentJco) + Number(editPresentOrs) + Number(editPresentNce) + Number(editPresentNcu)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div>
                <label className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block mb-1">Present Officers</label>
                <input
                  type="number"
                  min="0"
                  max={editPostedOffrs}
                  value={editPresentOffrs}
                  onChange={(e) => setEditPresentOffrs(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-emerald-700"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block mb-1">Present JCOs</label>
                <input
                  type="number"
                  min="0"
                  max={editPostedJco}
                  value={editPresentJco}
                  onChange={(e) => setEditPresentJco(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-emerald-700"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block mb-1">Present ORs</label>
                <input
                  type="number"
                  min="0"
                  max={editPostedOrs}
                  value={editPresentOrs}
                  onChange={(e) => setEditPresentOrs(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-emerald-700"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block mb-1">Present NC(E)</label>
                <input
                  type="number"
                  min="0"
                  max={editPostedNce}
                  value={editPresentNce}
                  onChange={(e) => setEditPresentNce(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-emerald-700"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block mb-1">Present NC(U)</label>
                <input
                  type="number"
                  min="0"
                  max={editPostedNcu}
                  value={editPresentNcu}
                  onChange={(e) => setEditPresentNcu(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-emerald-700"
                  required
                />
              </div>
            </div>
          </div>

          {/* 3. Out Unit */}
          <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-2.5">
            <div className="flex items-center justify-between border-b pb-1.5 border-amber-200 dark:border-amber-800">
              <span className="font-extrabold text-xs uppercase text-amber-900 dark:text-amber-300">
                Out Unit
              </span>
              <span className="font-mono text-xs font-black text-amber-800 dark:text-amber-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-amber-300">
                Total Out Unit: {(Number(editPostedOffrs) + Number(editPostedJco) + Number(editPostedOrs) + Number(editPostedNce) + Number(editPostedNcu)) - (Number(editPresentOffrs) + Number(editPresentJco) + Number(editPresentOrs) + Number(editPresentNce) + Number(editPresentNcu))}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">C Leave</label>
                <input
                  type="number"
                  min="0"
                  value={editCLeave}
                  onChange={(e) => setEditCLeave(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-amber-700"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">P Leave</label>
                <input
                  type="number"
                  min="0"
                  value={editPLeave}
                  onChange={(e) => setEditPLeave(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-amber-700"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Medical Leave</label>
                <input
                  type="number"
                  min="0"
                  value={editMedLeave}
                  onChange={(e) => setEditMedLeave(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-amber-700"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">CMH Admission</label>
                <input
                  type="number"
                  min="0"
                  value={editCmhAdmitted}
                  onChange={(e) => setEditCmhAdmitted(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-amber-700"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Maternity Leave</label>
                <input
                  type="number"
                  min="0"
                  value={editMaternityLeave}
                  onChange={(e) => setEditMaternityLeave(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-amber-700"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Course</label>
                <input
                  type="number"
                  min="0"
                  value={editCourse}
                  onChange={(e) => setEditCourse(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-amber-700"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Temporary Attachment</label>
                <input
                  type="number"
                  min="0"
                  value={editTyAtt}
                  onChange={(e) => setEditTyAtt(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-amber-700"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Other Out Unit</label>
                <input
                  type="number"
                  min="0"
                  value={editOtherOut}
                  onChange={(e) => setEditOtherOut(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-center font-mono font-bold p-1.5 border rounded-lg bg-white dark:bg-slate-900 text-amber-700"
                />
              </div>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsOverallModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
