import React, { useState } from 'react';
import { DutyRoster, DutyAssignmentRow, DutyAppointmentsBlock } from '../../types';
import { 
  Plus, Trash2, Copy, Save, CheckCircle2, 
  Calendar, Clock, MapPin, UserCheck, Shield, 
  Layers, AlertCircle, ArrowLeft, Eye, Printer, FileText
} from 'lucide-react';

interface DigitalRosterEditorProps {
  initialRoster?: DutyRoster | null;
  onSave: (roster: DutyRoster) => Promise<void>;
  onCancel: () => void;
  onPreviewPrint: (roster: DutyRoster) => void;
  currentUserAppointment: string;
}

const DEFAULT_PLACES = [
  'Southern Camp & Perimeter',
  'MT Park & Vehicle Fleet',
  'ARP / Main Gate Sentry',
  'Quarter Guard & Armory',
  'Medical Inspection Room & Triage',
  'Administrative Block'
];

export const DigitalRosterEditor: React.FC<DigitalRosterEditorProps> = ({
  initialRoster,
  onSave,
  onCancel,
  onPreviewPrint,
  currentUserAppointment
}) => {
  const isEditing = Boolean(initialRoster);
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.substring(0, 10);

  // Tomorrow date helper for next-day default
  const getTomorrowStr = (baseDate: string) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().substring(0, 10);
  };

  // Basic Information
  const [unitName, setUnitName] = useState<string>(initialRoster?.unitName || '95 FD AMB');
  const [rosterTitle, setRosterTitle] = useState<string>(initialRoster?.title || 'Daily Part-1 Duty Roster / Orders');
  const [rosterDate, setRosterDate] = useState<string>(initialRoster?.dutyDate || todayStr);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(initialRoster?.effectiveFrom || todayStr);
  const [effectiveUntil, setEffectiveUntil] = useState<string>(initialRoster?.effectiveUntil || getTomorrowStr(todayStr));
  const [secondaryDate, setSecondaryDate] = useState<string>(initialRoster?.secondaryDate || '');
  const [isRestricted, setIsRestricted] = useState<boolean>(initialRoster?.isRestricted !== false);
  const [preparedBy, setPreparedBy] = useState<string>(initialRoster?.preparedBy || currentUserAppointment || 'Duty Clerk, 95 Fd Amb');
  const [checkedBy, setCheckedBy] = useState<string>(initialRoster?.checkedBy || 'Quartermaster (QM), 95 Fd Amb');
  const [isPublished, setIsPublished] = useState<boolean>(initialRoster?.isPublished !== false);

  // Main Appointments
  const [appointments, setAppointments] = useState<DutyAppointmentsBlock>(
    initialRoster?.mainAppointments || {
      dutyOfficer: { rank: 'Capt', name: 'Dr. Mahmudul Hasan', baNo: 'BA-9021', contact: '01711-000001' },
      dutyJco: { rank: 'SWO', name: 'Md. Abdul Mannan', baNo: 'NO-40182', contact: '01711-000002' },
      dutyNco: { rank: 'Sgt', name: 'Md. Shahidul Islam', baNo: 'NO-30291', contact: '01711-000003' },
      dutyClerk: { rank: 'Cpl', name: 'Kazi Farhad', baNo: 'NO-20481' },
      secondSeater: { rank: 'Snk', name: 'Md. Monir Hossain', baNo: 'NO-10293', placeOfDuty: 'Main HQ Post', timeFrom: '06:00', timeTo: '14:00', remarks: '2nd Seater Duty' },
      adminDriver: { rank: 'Snk', name: 'Md. Rasel Miah', baNo: 'NO-10847', vehicleNo: 'AMB-1049' }
    }
  );

  // Place of Duty Groups & Duty Assignment Rows
  const [places, setPlaces] = useState<string[]>(
    initialRoster?.placeGroups && initialRoster.placeGroups.length > 0 
      ? initialRoster.placeGroups 
      : DEFAULT_PLACES
  );

  const [newPlaceInput, setNewPlaceInput] = useState<string>('');

  const [dutyRows, setDutyRows] = useState<DutyAssignmentRow[]>(
    initialRoster?.dutyRows && initialRoster.dutyRows.length > 0
      ? initialRoster.dutyRows
      : [
          {
            id: 'row-1',
            placeOfDuty: 'Southern Camp & Perimeter',
            dutyCategory: 'Guard Commander',
            personnelName: 'Md. Enamul Haque',
            rankTrade: 'Sgt / MA',
            serviceNumber: 'BA-10928',
            date: todayStr,
            timeFrom: '06:00',
            timeTo: '14:00',
            shiftLabel: 'Morning Shift (0600-1400)',
            remarks: 'Armed Guard'
          },
          {
            id: 'row-2',
            placeOfDuty: 'Southern Camp & Perimeter',
            dutyCategory: 'Camp Sentry',
            personnelName: 'Md. Tarikul Islam',
            rankTrade: 'Snk / GD',
            serviceNumber: 'NO-30482',
            date: todayStr,
            timeFrom: '06:00',
            timeTo: '14:00',
            shiftLabel: 'Morning Shift (0600-1400)',
            remarks: 'Perimeter Post 1'
          },
          {
            id: 'row-3',
            placeOfDuty: 'MT Park & Vehicle Fleet',
            dutyCategory: 'MT Sentry & Fleet Security',
            personnelName: 'Md. Alamgir Hossain',
            rankTrade: 'Cpl / MT',
            serviceNumber: 'NO-20491',
            date: todayStr,
            timeFrom: '06:00',
            timeTo: '14:00',
            shiftLabel: 'Morning Shift (0600-1400)',
            remarks: 'Ambulance Park'
          },
          {
            id: 'row-4',
            placeOfDuty: 'ARP / Main Gate Sentry',
            dutyCategory: 'Main Gate Access Controller',
            personnelName: 'Md. Zahid Hasan',
            rankTrade: 'Snk / MA',
            serviceNumber: 'NO-10293',
            date: todayStr,
            timeFrom: '06:00',
            timeTo: '14:00',
            shiftLabel: 'Morning Shift (0600-1400)',
            remarks: 'Entry Log Maintenance'
          }
        ]
  );

  // Special Instructions
  const [specialInstructions, setSpecialInstructions] = useState<string[]>(
    initialRoster?.specialInstructions || [
      '1. All duty personnel must fall-in for mounting parade 15 minutes prior to the respective duty hour.',
      '2. Guard Commander is responsible for inspecting weapons, ammunition pouches, and communications set at every shift handover.',
      '3. Emergency Casevac Ambulance driver must remain on immediate 5-minute standby with engine pre-checked.',
      '4. Any suspicious movement or perimeter breach must immediately be reported to the Duty Officer.'
    ]
  );
  const [newInstructionText, setNewInstructionText] = useState<string>('');

  // Row Manipulation
  const handleAddRow = (place: string) => {
    const newRow: DutyAssignmentRow = {
      id: 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      placeOfDuty: place,
      dutyCategory: 'Sentry / Guard',
      personnelName: '',
      rankTrade: 'Snk',
      serviceNumber: '',
      date: rosterDate,
      timeFrom: '06:00',
      timeTo: '14:00',
      shiftLabel: 'Shift (0600-1400)',
      remarks: ''
    };
    setDutyRows(prev => [...prev, newRow]);
  };

  const handleUpdateRow = (id: string, field: keyof DutyAssignmentRow, value: string) => {
    setDutyRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleDeleteRow = (id: string) => {
    setDutyRows(prev => prev.filter(r => r.id !== id));
  };

  const handleDuplicateRow = (row: DutyAssignmentRow) => {
    const dup: DutyAssignmentRow = {
      ...row,
      id: 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      personnelName: row.personnelName ? `${row.personnelName} (Relief)` : ''
    };
    setDutyRows(prev => [...prev, dup]);
  };

  // Place Manipulation
  const handleAddPlace = () => {
    if (!newPlaceInput.trim()) return;
    if (!places.includes(newPlaceInput.trim())) {
      setPlaces(prev => [...prev, newPlaceInput.trim()]);
    }
    setNewPlaceInput('');
  };

  const handleRemovePlace = (placeToRemove: string) => {
    const confirm = window.confirm(`Remove "${placeToRemove}" and all its assigned rows?`);
    if (!confirm) return;
    setPlaces(prev => prev.filter(p => p !== placeToRemove));
    setDutyRows(prev => prev.filter(r => r.placeOfDuty !== placeToRemove));
  };

  // Special Instructions manipulation
  const handleAddInstruction = () => {
    if (!newInstructionText.trim()) return;
    setSpecialInstructions(prev => [...prev, newInstructionText.trim()]);
    setNewInstructionText('');
  };

  const handleRemoveInstruction = (index: number) => {
    setSpecialInstructions(prev => prev.filter((_, i) => i !== index));
  };

  // Duplicate entire roster for next day
  const handleDuplicateForNextDay = () => {
    const nextDay = getTomorrowStr(rosterDate);
    setRosterDate(nextDay);
    setEffectiveFrom(nextDay);
    setEffectiveUntil(getTomorrowStr(nextDay));
    setDutyRows(prev => prev.map(r => ({
      ...r,
      id: 'row-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      date: nextDay
    })));
    alert(`Roster date advanced to ${nextDay}. All duty places and shift allocations preserved for next day.`);
  };

  // Construct current roster object
  const constructCurrentRoster = (): DutyRoster => {
    return {
      id: initialRoster?.id || 'roster-' + Date.now(),
      referenceNo: initialRoster?.referenceNo || `95FD/PART1/${rosterDate.replace(/[-]/g, '')}`,
      unitName,
      title: rosterTitle,
      dutyDate: rosterDate,
      effectiveFrom,
      effectiveUntil,
      secondaryDate: secondaryDate || undefined,
      isRestricted,
      dutyCategory: 'Daily Part-1 Duties',
      section: 'all',
      version: initialRoster?.version ? '1.1' : '1.0',
      accessLevel: 'UNIT_ALL',
      status: isPublished ? 'PUBLISHED' : 'DRAFT',
      isPublished,
      mainAppointments: appointments,
      dutyRows,
      placeGroups: places,
      specialInstructions,
      preparedBy,
      checkedBy,
      createdAt: initialRoster?.createdAt || nowIso,
      updatedAt: nowIso
    };
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const roster = constructCurrentRoster();
    await onSave(roster);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6 text-xs font-sans pb-12">
      {/* Top Action Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer transition"
            title="Back to Roster List"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2D4A22] dark:text-amber-400" />
              <span>{isEditing ? 'Edit Digital Part-1 Duty Roster' : 'Create Structured Part-1 Duty Roster'}</span>
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              Unit: {unitName} • Date: {rosterDate} • Total Assigned Rows: {dutyRows.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleDuplicateForNextDay}
            className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-300 dark:border-amber-700 font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
            title="Advance date to tomorrow while keeping structure"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate Next Day</span>
          </button>

          <button
            type="button"
            onClick={() => onPreviewPrint(constructCurrentRoster())}
            className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-300 dark:border-blue-700 font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Export PDF</span>
          </button>

          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-[#2D4A22] hover:bg-[#3B5E2B] text-white font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md transition"
          >
            <Save className="w-4 h-4" />
            <span>{isPublished ? 'Save & Publish' : 'Save Draft'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: BASIC INFORMATION */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>1. Basic Order & Date Header</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Unit Name *
            </label>
            <input
              type="text"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-extrabold"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Roster Title *
            </label>
            <input
              type="text"
              value={rosterTitle}
              onChange={(e) => setRosterTitle(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Primary Roster Date *
            </label>
            <input
              type="date"
              value={rosterDate}
              onChange={(e) => setRosterDate(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Secondary Date (Two-Date Format)
            </label>
            <input
              type="date"
              value={secondaryDate}
              onChange={(e) => setSecondaryDate(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Prepared By Appointment *
            </label>
            <input
              type="text"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Checked By Appointment *
            </label>
            <input
              type="text"
              value={checkedBy}
              onChange={(e) => setCheckedBy(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
              required
            />
          </div>

          <div className="flex items-center gap-4 pt-6">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={isRestricted}
                onChange={(e) => setIsRestricted(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded cursor-pointer"
              />
              <span>Mark "RESTRICTED" Header</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 text-[#2D4A22] rounded cursor-pointer"
              />
              <span>Publish to All Viewers</span>
            </label>
          </div>
        </div>
      </div>

      {/* SECTION 2: MAIN DUTY APPOINTMENTS */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <UserCheck className="w-4 h-4 text-blue-600" />
          <span>2. Main Duty Appointments (Officer, JCO, NCO, Clerk, Driver)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Duty Officer */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="font-extrabold text-[11px] uppercase text-emerald-700 dark:text-emerald-400">
              Duty Officer (DO)
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Rank"
                value={appointments.dutyOfficer?.rank || ''}
                onChange={(e) => setAppointments(p => ({ ...p, dutyOfficer: { ...p.dutyOfficer!, rank: e.target.value, name: p.dutyOfficer?.name || '', baNo: p.dutyOfficer?.baNo || '' } }))}
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
              <input
                type="text"
                placeholder="Full Name"
                value={appointments.dutyOfficer?.name || ''}
                onChange={(e) => setAppointments(p => ({ ...p, dutyOfficer: { ...p.dutyOfficer!, name: e.target.value, rank: p.dutyOfficer?.rank || '', baNo: p.dutyOfficer?.baNo || '' } }))}
                className="col-span-2 p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
            </div>
            <input
              type="text"
              placeholder="BA Number (e.g. BA-9021)"
              value={appointments.dutyOfficer?.baNo || ''}
              onChange={(e) => setAppointments(p => ({ ...p, dutyOfficer: { ...p.dutyOfficer!, baNo: e.target.value, name: p.dutyOfficer?.name || '', rank: p.dutyOfficer?.rank || '' } }))}
              className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
            />
          </div>

          {/* Duty JCO */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="font-extrabold text-[11px] uppercase text-blue-700 dark:text-blue-400">
              Duty JCO
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Rank"
                value={appointments.dutyJco?.rank || ''}
                onChange={(e) => setAppointments(p => ({ ...p, dutyJco: { ...p.dutyJco!, rank: e.target.value, name: p.dutyJco?.name || '', baNo: p.dutyJco?.baNo || '' } }))}
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
              <input
                type="text"
                placeholder="Full Name"
                value={appointments.dutyJco?.name || ''}
                onChange={(e) => setAppointments(p => ({ ...p, dutyJco: { ...p.dutyJco!, name: e.target.value, rank: p.dutyJco?.rank || '', baNo: p.dutyJco?.baNo || '' } }))}
                className="col-span-2 p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
            </div>
            <input
              type="text"
              placeholder="BA / Personal ID"
              value={appointments.dutyJco?.baNo || ''}
              onChange={(e) => setAppointments(p => ({ ...p, dutyJco: { ...p.dutyJco!, baNo: e.target.value, name: p.dutyJco?.name || '', rank: p.dutyJco?.rank || '' } }))}
              className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
            />
          </div>

          {/* Duty NCO */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="font-extrabold text-[11px] uppercase text-indigo-700 dark:text-indigo-400">
              Duty NCO
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Rank"
                value={appointments.dutyNco?.rank || ''}
                onChange={(e) => setAppointments(p => ({ ...p, dutyNco: { ...p.dutyNco!, rank: e.target.value, name: p.dutyNco?.name || '', baNo: p.dutyNco?.baNo || '' } }))}
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
              <input
                type="text"
                placeholder="Full Name"
                value={appointments.dutyNco?.name || ''}
                onChange={(e) => setAppointments(p => ({ ...p, dutyNco: { ...p.dutyNco!, name: e.target.value, rank: p.dutyNco?.rank || '', baNo: p.dutyNco?.baNo || '' } }))}
                className="col-span-2 p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
            </div>
            <input
              type="text"
              placeholder="BA / Personal ID"
              value={appointments.dutyNco?.baNo || ''}
              onChange={(e) => setAppointments(p => ({ ...p, dutyNco: { ...p.dutyNco!, baNo: e.target.value, name: p.dutyNco?.name || '', rank: p.dutyNco?.rank || '' } }))}
              className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
            />
          </div>

          {/* Duty Clerk */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="font-extrabold text-[11px] uppercase text-slate-700 dark:text-slate-300">
              Duty Clerk
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Rank"
                value={appointments.dutyClerk?.rank || ''}
                onChange={(e) => setAppointments(p => ({ ...p, dutyClerk: { ...p.dutyClerk!, rank: e.target.value, name: p.dutyClerk?.name || '', baNo: p.dutyClerk?.baNo || '' } }))}
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
              <input
                type="text"
                placeholder="Full Name"
                value={appointments.dutyClerk?.name || ''}
                onChange={(e) => setAppointments(p => ({ ...p, dutyClerk: { ...p.dutyClerk!, name: e.target.value, rank: p.dutyClerk?.rank || '', baNo: p.dutyClerk?.baNo || '' } }))}
                className="col-span-2 p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
            </div>
            <input
              type="text"
              placeholder="BA / Personal ID"
              value={appointments.dutyClerk?.baNo || ''}
              onChange={(e) => setAppointments(p => ({ ...p, dutyClerk: { ...p.dutyClerk!, baNo: e.target.value, name: p.dutyClerk?.name || '', rank: p.dutyClerk?.rank || '' } }))}
              className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
            />
          </div>

          {/* 2nd Seater (Replaces Duty Batman / Orderly) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-[11px] uppercase text-emerald-700 dark:text-emerald-400">
                2nd Seater
              </div>
              {appointments.secondSeater?.name && (
                <button
                  type="button"
                  onClick={() => setAppointments(p => ({ ...p, secondSeater: undefined }))}
                  className="text-[10px] text-red-500 hover:text-red-700 font-bold cursor-pointer"
                  title="Remove 2nd Seater"
                >
                  Clear / Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Rank"
                value={appointments.secondSeater?.rank || ''}
                onChange={(e) => setAppointments(p => ({ 
                  ...p, 
                  secondSeater: { 
                    ...(p.secondSeater || { baNo: '', placeOfDuty: '', timeFrom: '06:00', timeTo: '14:00' }), 
                    rank: e.target.value, 
                    name: p.secondSeater?.name || '' 
                  } 
                }))}
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
              <input
                type="text"
                placeholder="Personnel Name"
                value={appointments.secondSeater?.name || ''}
                onChange={(e) => setAppointments(p => ({ 
                  ...p, 
                  secondSeater: { 
                    ...(p.secondSeater || { baNo: '', rank: 'Snk', placeOfDuty: '', timeFrom: '06:00', timeTo: '14:00' }), 
                    name: e.target.value 
                  } 
                }))}
                className="col-span-2 p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="BA / Personal ID"
                value={appointments.secondSeater?.baNo || ''}
                onChange={(e) => setAppointments(p => ({ 
                  ...p, 
                  secondSeater: { 
                    ...(p.secondSeater || { name: '', rank: 'Snk' }), 
                    baNo: e.target.value 
                  } 
                }))}
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
              />
              <input
                type="text"
                placeholder="Place of Duty"
                value={appointments.secondSeater?.placeOfDuty || ''}
                onChange={(e) => setAppointments(p => ({ 
                  ...p, 
                  secondSeater: { 
                    ...(p.secondSeater || { name: '', rank: 'Snk', baNo: '' }), 
                    placeOfDuty: e.target.value 
                  } 
                }))}
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                <span>From:</span>
                <input
                  type="text"
                  placeholder="06:00"
                  value={appointments.secondSeater?.timeFrom || '06:00'}
                  onChange={(e) => setAppointments(p => ({ 
                    ...p, 
                    secondSeater: { 
                      ...(p.secondSeater || { name: '', rank: 'Snk', baNo: '' }), 
                      timeFrom: e.target.value 
                    } 
                  }))}
                  className="w-full p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                <span>To:</span>
                <input
                  type="text"
                  placeholder="14:00"
                  value={appointments.secondSeater?.timeTo || '14:00'}
                  onChange={(e) => setAppointments(p => ({ 
                    ...p, 
                    secondSeater: { 
                      ...(p.secondSeater || { name: '', rank: 'Snk', baNo: '' }), 
                      timeTo: e.target.value 
                    } 
                  }))}
                  className="w-full p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Admin / Standby Driver */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="font-extrabold text-[11px] uppercase text-amber-700 dark:text-amber-400">
              Admin / Standby Driver
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Rank"
                value={appointments.adminDriver?.rank || ''}
                onChange={(e) => setAppointments(p => ({ ...p, adminDriver: { ...p.adminDriver!, rank: e.target.value, name: p.adminDriver?.name || '', baNo: p.adminDriver?.baNo || '' } }))}
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
              <input
                type="text"
                placeholder="Full Name"
                value={appointments.adminDriver?.name || ''}
                onChange={(e) => setAppointments(p => ({ ...p, adminDriver: { ...p.adminDriver!, name: e.target.value, rank: p.adminDriver?.rank || '', baNo: p.adminDriver?.baNo || '' } }))}
                className="col-span-2 p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="BA Number"
                value={appointments.adminDriver?.baNo || ''}
                onChange={(e) => setAppointments(p => ({ ...p, adminDriver: { ...p.adminDriver!, baNo: e.target.value, name: p.adminDriver?.name || '', rank: p.adminDriver?.rank || '' } }))}
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
              />
              <input
                type="text"
                placeholder="Vehicle Reg No"
                value={appointments.adminDriver?.vehicleNo || ''}
                onChange={(e) => setAppointments(p => ({ ...p, adminDriver: { ...p.adminDriver!, vehicleNo: e.target.value } }))}
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: GROUPED PLACES OF DUTY & DUTY ROWS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-600" />
              <span>3. Grouped Places of Duty & Personnel Assignment Matrix</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Add multiple places of duty (Southern Camp, MT Park, ARP/Main Gate, etc.), multiple personnel rows, and time shifts under each place.
            </p>
          </div>

          {/* Add Custom Place Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newPlaceInput}
              onChange={(e) => setNewPlaceInput(e.target.value)}
              placeholder="New Place of Duty (e.g. Range Camp)"
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            />
            <button
              type="button"
              onClick={handleAddPlace}
              className="px-3 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Place</span>
            </button>
          </div>
        </div>

        {/* Render each place group */}
        {places.map((placeName, placeIdx) => {
          const placeRows = dutyRows.filter(r => r.placeOfDuty === placeName);

          return (
            <div 
              key={placeName} 
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              {/* Place Header */}
              <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#2D4A22] text-[#F59E0B] text-[11px] font-black flex items-center justify-center">
                    {placeIdx + 1}
                  </span>
                  <h4 className="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                    {placeName}
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                    {placeRows.length} {placeRows.length === 1 ? 'person' : 'personnel'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddRow(placeName)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Personnel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemovePlace(placeName)}
                    className="p-1.5 rounded-lg hover:bg-red-100 text-red-600 dark:text-red-400 text-xs cursor-pointer transition"
                    title="Remove this place group"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Rows Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      <th className="p-2.5">Duty Category / Post</th>
                      <th className="p-2.5">Rank & Trade</th>
                      <th className="p-2.5">Personnel Full Name</th>
                      <th className="p-2.5">BA / Personal No</th>
                      <th className="p-2.5">Time Shift (From - To)</th>
                      <th className="p-2.5">Remarks</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {placeRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400 font-mono text-[11px]">
                          No personnel assigned to {placeName} yet. Click "+ Add Personnel" above.
                        </td>
                      </tr>
                    ) : (
                      placeRows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                          {/* Duty Category */}
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={row.dutyCategory}
                              onChange={(e) => handleUpdateRow(row.id, 'dutyCategory', e.target.value)}
                              placeholder="e.g. Guard Commander, Sentry"
                              className="w-full p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200"
                            />
                          </td>

                          {/* Rank & Trade */}
                          <td className="p-2.5 w-28">
                            <input
                              type="text"
                              value={row.rankTrade}
                              onChange={(e) => handleUpdateRow(row.id, 'rankTrade', e.target.value)}
                              placeholder="Sgt / MA"
                              className="w-full p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                            />
                          </td>

                          {/* Name */}
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={row.personnelName}
                              onChange={(e) => handleUpdateRow(row.id, 'personnelName', e.target.value)}
                              placeholder="Personnel Name"
                              className="w-full p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                            />
                          </td>

                          {/* Service Number */}
                          <td className="p-2.5 w-32">
                            <input
                              type="text"
                              value={row.serviceNumber}
                              onChange={(e) => handleUpdateRow(row.id, 'serviceNumber', e.target.value)}
                              placeholder="BA-10492"
                              className="w-full p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
                            />
                          </td>

                          {/* Time Shift */}
                          <td className="p-2.5 w-44">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={row.timeFrom}
                                onChange={(e) => handleUpdateRow(row.id, 'timeFrom', e.target.value)}
                                placeholder="0600"
                                className="w-16 p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                              />
                              <span className="text-slate-400 font-bold">-</span>
                              <input
                                type="text"
                                value={row.timeTo}
                                onChange={(e) => handleUpdateRow(row.id, 'timeTo', e.target.value)}
                                placeholder="1400"
                                className="w-16 p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                              />
                            </div>
                          </td>

                          {/* Remarks */}
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={row.remarks || ''}
                              onChange={(e) => handleUpdateRow(row.id, 'remarks', e.target.value)}
                              placeholder="Remarks / Post"
                              className="w-full p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                          </td>

                          {/* Actions */}
                          <td className="p-2.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleDuplicateRow(row)}
                                className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 cursor-pointer"
                                title="Duplicate row (Relief shift)"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row.id)}
                                className="p-1.5 rounded hover:bg-red-100 text-red-600 dark:text-red-400 cursor-pointer"
                                title="Delete row"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* SECTION 4: SPECIAL INSTRUCTIONS & ORDERS */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
        <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <Layers className="w-4 h-4 text-purple-600" />
          <span>4. Special Instructions & Orders</span>
        </h3>

        <div className="space-y-2">
          {specialInstructions.map((instruction, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">{instruction}</span>
              <button
                type="button"
                onClick={() => handleRemoveInstruction(idx)}
                className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                title="Remove instruction"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={newInstructionText}
            onChange={(e) => setNewInstructionText(e.target.value)}
            placeholder="Add a new standing order or shift instruction..."
            className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
          />
          <button
            type="button"
            onClick={handleAddInstruction}
            className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold cursor-pointer transition"
          >
            Add Order
          </button>
        </div>
      </div>
    </form>
  );
};
