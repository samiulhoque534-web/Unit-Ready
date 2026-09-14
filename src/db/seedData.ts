// Initial Seed Data for 95 Fd Amb — UNIT-READY (v3)

import {
  User,
  Device,
  RankItem,
  SectionItem,
  ParadeState,
  DutyRoster,
  ManpowerDailyState,
  ManpowerPersonnel,
  VehicleDailyState,
  VehicleFleetItem,
  MedicineItem,
  MedicineBatch,
  MedicalInstrumentItem,
  MedicalEquipmentItem,
  MonthlyMedicalAuditReport,
  MiscellaneousNotice,
  SectionApprovalRecord,
  AuditLogEntry,
  InAppNotification,
  RankTradeDistributionItem
} from '../types';

export const initialUsers: User[] = [];

export const initialDevices: Device[] = [
  {
    id: 'dev-01',
    deviceIdentifier: 'DESKTOP-95FA-HQ-MAIN-01',
    deviceName: 'HQ Command Main Workstation',
    deviceType: 'desktop',
    assignedSectionCode: 'all',
    status: 'ACTIVE',
    registrationDate: '2026-01-01T00:00:00Z',
    revokedStatus: false
  },
  {
    id: 'dev-02',
    deviceIdentifier: 'TABLET-95FA-MED-FIELD-02',
    deviceName: 'Medical Store Rugged Field Tablet',
    deviceType: 'tablet',
    assignedSectionCode: 'Med',
    status: 'ACTIVE',
    registrationDate: '2026-01-01T00:00:00Z',
    revokedStatus: false
  }
];

export const initialRanks: RankItem[] = [
  { id: 'rk-1', rankName: 'LT Col', rankOrder: 1, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'rk-2', rankName: 'Maj', rankOrder: 2, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'rk-3', rankName: 'Capt', rankOrder: 3, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'rk-4', rankName: 'Lt', rankOrder: 4, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'rk-5', rankName: '2Lt', rankOrder: 5, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'rk-6', rankName: 'SWO', rankOrder: 6, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'rk-7', rankName: 'WO', rankOrder: 7, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'rk-8', rankName: 'Sgt', rankOrder: 8, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'rk-9', rankName: 'Cpl', rankOrder: 9, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'rk-10', rankName: 'Lcpl', rankOrder: 10, isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'rk-11', rankName: 'Snk', rankOrder: 11, isActive: true, createdAt: '2026-01-01T00:00:00Z' }
];

export const initialSections: SectionItem[] = [
  { id: 'sec-1', sectionCode: 'A', sectionName: 'A Section', designatedOperatorRole: 'manpower_operator', responsibleVerifierRole: 'qm', intermediateApproverRole: 'qm', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'sec-2', sectionCode: 'Med', sectionName: 'Medical Section', designatedOperatorRole: 'medicine_operator', responsibleVerifierRole: 'moic', intermediateApproverRole: 'moic', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'sec-3', sectionCode: 'EME', sectionName: 'EME Workshop Section', designatedOperatorRole: 'manpower_operator', responsibleVerifierRole: 'qm', intermediateApproverRole: 'qm', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'sec-4', sectionCode: 'MT', sectionName: 'MT (Motor Transport)', designatedOperatorRole: 'vehicle_operator', responsibleVerifierRole: 'qm', intermediateApproverRole: 'qm', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'sec-5', sectionCode: 'SMT', sectionName: 'SMT (Special Medical Transport)', designatedOperatorRole: 'manpower_operator', responsibleVerifierRole: 'qm', intermediateApproverRole: 'qm', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'sec-6', sectionCode: 'Clk', sectionName: 'Clerks Section', designatedOperatorRole: 'manpower_operator', responsibleVerifierRole: 'qm', intermediateApproverRole: 'qm', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'sec-7', sectionCode: 'Cook', sectionName: 'Cooks Section', designatedOperatorRole: 'manpower_operator', responsibleVerifierRole: 'qm', intermediateApproverRole: 'qm', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'sec-8', sectionCode: 'Tradesman', sectionName: 'Tradesmen Section', designatedOperatorRole: 'manpower_operator', responsibleVerifierRole: 'qm', intermediateApproverRole: 'qm', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'sec-9', sectionCode: 'NC(E)', sectionName: 'NC(E) Support', designatedOperatorRole: 'manpower_operator', responsibleVerifierRole: 'qm', intermediateApproverRole: 'qm', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'sec-10', sectionCode: 'NC(U)', sectionName: 'NC(U) Support', designatedOperatorRole: 'manpower_operator', responsibleVerifierRole: 'qm', intermediateApproverRole: 'qm', isActive: true, createdAt: '2026-01-01T00:00:00Z' }
];

export const initialParadeState: ParadeState = {
  id: 'parade-today',
  stateDate: new Date().toISOString().substring(0, 10),
  dayOfWeek: 'Monday',
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
  personnelList: [
    { id: 'p-1', personalNumber: 'MED-1001', appointment: 'Senior Medical Assistant', sectionCode: 'Med', status: 'ON_PARADE' },
    { id: 'p-2', personalNumber: 'MED-1002', appointment: 'Combat Medic NCO', sectionCode: 'Med', status: 'ON_PARADE' },
    { id: 'p-3', personalNumber: 'MED-1003', appointment: 'Nursing Attendant', sectionCode: 'Med', status: 'P_LEAVE', statusRemarks: 'Privilege Leave until 24-08-2026' },
    { id: 'p-4', personalNumber: 'SMT-2001', appointment: 'SMT Ambulance Driver Special', sectionCode: 'SMT', status: 'ON_PARADE' },
    { id: 'p-5', personalNumber: 'SMT-2002', appointment: 'SMT Medical Transport Tech', sectionCode: 'SMT', status: 'ON_PARADE' },
    { id: 'p-6', personalNumber: 'MT-3001', appointment: 'MT Head Driver', sectionCode: 'MT', status: 'ON_PARADE' },
    { id: 'p-7', personalNumber: 'EME-4001', appointment: 'Vehicle & Generator Tech', sectionCode: 'EME', status: 'ON_PARADE' },
    { id: 'p-8', personalNumber: 'CLK-5001', appointment: 'Chief Confidential Clerk', sectionCode: 'Clk', status: 'ON_PARADE' },
    { id: 'p-9', personalNumber: 'A-6001', appointment: 'Section In-Charge', sectionCode: 'A', status: 'ON_PARADE' },
    { id: 'p-10', personalNumber: 'MED-1004', appointment: 'Emergency Bay Medic', sectionCode: 'Med', status: 'C_LEAVE', statusRemarks: 'Casual Leave (Station)' },
    { id: 'p-11', personalNumber: 'MED-1005', appointment: 'Laboratory Technician', sectionCode: 'Med', status: 'MEDICAL_LEAVE', statusRemarks: 'Medical Rest (Unit Sick Quarters)' },
    { id: 'p-12', personalNumber: 'SMT-2003', appointment: 'Field ICU Driver', sectionCode: 'SMT', status: 'CMH_ADMITTED', statusRemarks: 'Admitted in CMH Ward 4' },
    { id: 'p-13', personalNumber: 'A-6002', appointment: 'Field Assistant', sectionCode: 'A', status: 'COURSE', statusRemarks: 'Advanced Combat Medical Course' },
    { id: 'p-14', personalNumber: 'MT-3002', appointment: 'Ambulance Driver', sectionCode: 'MT', status: 'TEMPORARY_ATTACHMENT', statusRemarks: 'Ty Att to Division Headquarters' }
  ],
  cLeaveDetails: ['04 x ORs (Station Casual Leave)'],
  pLeaveDetails: ['08 x ORs, 01 x JCO (Annual Privilege Leave)'],
  medicalLeaveDetails: ['02 x ORs (Unit Sick Quarters - Med Rest)'],
  cmhAdmittedDetails: ['01 x OR (CMH Ward 4)'],
  maternityLeaveDetails: [],
  courseDetails: [
    '01 x Offr on Senior Officers Field Ambulance Command Course',
    '03 x ORs on Advanced Combat Medical Technician Course'
  ],
  tyAttDetails: [
    '01 x Offr attached to HQ 55 Inf Div (Med Branch)',
    '01 x OR attached to Combined Military Hospital'
  ],
  otherOutDetails: [],
  tomorrowActivities: [
    '0600h: Unit Physical Training & Resuscitation Drill',
    '0830h: Weekly Special Medical Transport & Oxygen Cascade Inspection',
    '1100h: Cold-Chain & Vaccine Storage Integrity Audit'
  ],
  medicalCover: [
    '01 x SMT Field ICU Ambulance detachment for Bde Live-Fire Exercise',
    '01 x Mobile Resuscitation Post at Range Perimeter'
  ],
  foodMenu: 'Breakfast: Paratha, Egg, Dal, Tea | Lunch: Rice, Chicken Curry, Mixed Vegetables, Dal | Dinner: Roti, Beef Bhuna, Lentil Soup',
  closingRegards: 'Profound Regards',
  status: 'CO_APPROVED',
  version: '1.0',
  preparedBy: 'Part-I Duty Operator',
  qmApprovedBy: 'Quartermaster (QM)',
  coApprovedBy: 'Commanding Officer (CO)',
  updatedAt: new Date().toISOString()
};

export const initialDutyRosters: DutyRoster[] = [
  {
    id: 'roster-01',
    referenceNo: '95FA/DUTY/2026/08/001',
    title: 'Daily Part-I Unit Duty Roster & Medical Cover Order',
    dutyDate: new Date().toISOString().substring(0, 10),
    effectiveFrom: '0600 hrs',
    effectiveUntil: '0600 hrs (+1 Day)',
    dutyCategory: 'Operational Routine',
    section: 'all',
    version: '1.0',
    accessLevel: 'UNIT_ALL',
    status: 'CO_APPROVED',
    pdfDataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJ...',
    pdfFileName: '95FA_Duty_Roster_Official.pdf',
    pdfFileSize: 45200,
    pdfSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    preparedByUserId: 'usr-op-duty',
    qmApprovedByUserId: 'usr-qm',
    qmApprovedAt: '2026-08-16T08:00:00Z',
    coApprovedByUserId: 'usr-co',
    coApprovedAt: '2026-08-16T10:00:00Z',
    publishedAt: '2026-08-16T10:05:00Z',
    isPublished: true,
    createdAt: '2026-08-16T06:30:00Z',
    updatedAt: '2026-08-16T10:05:00Z'
  }
];

export const initialManpowerState: ManpowerDailyState = {
  id: 'mp-today',
  stateDate: new Date().toISOString().substring(0, 10),
  totalAuthorized: 180,
  totalHeld: 170,
  totalPresent: 148,
  totalEffective: 148,
  totalLeave: 13,
  totalCourse: 4,
  totalTemporaryDuty: 3,
  totalMedicalAdmitted: 2,
  totalOtherAbsence: 0,
  totalDeficiency: 10,
  status: 'CO_APPROVED',
  version: '1.0',
  preparedBy: 'Manpower Operator',
  qmApprovedBy: 'Quartermaster (QM)',
  coApprovedBy: 'Commanding Officer (CO)',
  updatedAt: new Date().toISOString()
};

export const initialPersonnel: ManpowerPersonnel[] = [
  { id: 'p-1', baNo: 'BA-1001', rank: 'WO', name: 'Md. Rafiqul Islam', trade: 'SMT', personalNumber: 'BA-1001', appointment: 'Senior Medical Assistant', sectionCode: 'Med', isAuthorizedAppointment: true, currentStatus: 'PRESENT', statusFromDate: '2026-08-01' },
  { id: 'p-2', baNo: 'BA-1002', rank: 'Sgt', name: 'Kabir Hossain', trade: 'MA', personalNumber: 'BA-1002', appointment: 'Combat Medic NCO', sectionCode: 'Med', isAuthorizedAppointment: true, currentStatus: 'PRESENT', statusFromDate: '2026-08-01' },
  { id: 'p-3', baNo: 'BA-1003', rank: 'Cpl', name: 'Tareq Rahman', trade: 'OTA', personalNumber: 'BA-1003', appointment: 'Nursing Attendant', sectionCode: 'Med', isAuthorizedAppointment: true, currentStatus: 'LEAVE', statusFromDate: '2026-08-10', expectedReturnDate: '2026-08-24' },
  { id: 'p-4', baNo: 'BA-2001', rank: 'Lcpl', name: 'Moniruzzaman', trade: 'SMT', personalNumber: 'BA-2001', appointment: 'SMT Ambulance Driver Special', sectionCode: 'SMT', isAuthorizedAppointment: true, currentStatus: 'PRESENT', statusFromDate: '2026-08-01' },
  { id: 'p-5', baNo: 'BA-2002', rank: 'Snk', name: 'Shahidul Islam', trade: 'SMT', personalNumber: 'BA-2002', appointment: 'SMT Medical Transport Tech', sectionCode: 'SMT', isAuthorizedAppointment: true, currentStatus: 'PRESENT', statusFromDate: '2026-08-01' },
  { id: 'p-6', baNo: 'BA-3001', rank: 'Cpl', name: 'Anowar Hossain', trade: 'MT', personalNumber: 'BA-3001', appointment: 'MT Head Driver', sectionCode: 'MT', isAuthorizedAppointment: true, currentStatus: 'PRESENT', statusFromDate: '2026-08-01' },
  { id: 'p-7', baNo: 'BA-4001', rank: 'Sgt', name: 'Delwar Hossain', trade: 'EME', personalNumber: 'BA-4001', appointment: 'Vehicle & Generator Tech', sectionCode: 'EME', isAuthorizedAppointment: true, currentStatus: 'PRESENT', statusFromDate: '2026-08-01' },
  { id: 'p-8', baNo: 'BA-5001', rank: 'WO', name: 'Mizanur Rahman', trade: 'Clk', personalNumber: 'BA-5001', appointment: 'Chief Confidential Clerk', sectionCode: 'Clk', isAuthorizedAppointment: true, currentStatus: 'PRESENT', statusFromDate: '2026-08-01' },
  { id: 'p-9', baNo: 'BA-6001', rank: 'SWO', name: 'Abdur Rahim', trade: 'Tradesman', personalNumber: 'BA-6001', appointment: 'Section In-Charge', sectionCode: 'A', isAuthorizedAppointment: true, currentStatus: 'PRESENT', statusFromDate: '2026-08-01' }
];

export const initialVehicleState: VehicleDailyState = {
  id: 'veh-today',
  stateDate: new Date().toISOString().substring(0, 10),
  totalAuthorized: 24,
  totalHeld: 22,
  totalServiceable: 20,
  totalUnserviceable: 1,
  totalUnderRepair: 1,
  totalInspectionDue: 2,
  totalAvailableForTask: 19,
  deficiencyExcess: -2,
  status: 'CO_APPROVED',
  version: '1.0',
  preparedBy: 'Vehicle Operator',
  qmApprovedBy: 'Quartermaster (QM)',
  coApprovedBy: 'Commanding Officer (CO)',
  updatedAt: new Date().toISOString()
};

export const initialVehicleFleet: VehicleFleetItem[] = [
  { id: 'vf-1', vehicleType: 'Field Ambulance 4x4', registrationFleetRef: '95-FA-AMB-01', authorizedQty: 6, heldQty: 6, status: 'AVAILABLE_FOR_TASK', serviceability: 'FULLY_FIT', lastInspectionDate: '2026-08-01', nextInspectionDueDate: '2026-08-30', responsibleAppointment: 'MT NCO' },
  { id: 'vf-2', vehicleType: 'Troop Carrier 3-Ton', registrationFleetRef: '95-FA-TC-01', authorizedQty: 4, heldQty: 4, status: 'AVAILABLE_FOR_TASK', serviceability: 'FULLY_FIT', lastInspectionDate: '2026-08-05', nextInspectionDueDate: '2026-09-05', responsibleAppointment: 'MT NCO' },
  { id: 'vf-3', vehicleType: 'Water Bowser 1000L', registrationFleetRef: '95-FA-WB-01', authorizedQty: 2, heldQty: 2, status: 'UNDER_REPAIR', serviceability: 'TEMPORARY_RESTRICTION', lastInspectionDate: '2026-07-20', nextInspectionDueDate: '2026-08-20', repairReference: 'EME/95FA/JOB-102', responsibleAppointment: 'MT NCO' }
];

// Mandatory Expiry Dates and Authorized Quantities for Medicines
export const initialMedicines: MedicineItem[] = [
  {
    id: 'med-01',
    genericName: 'Paracetamol',
    brandName: 'Napa',
    strength: '500 mg',
    dosageForm: 'Tablet',
    unitOfIssue: 'Tablets',
    expiryDate: '2026-08-10', // Expired
    authorizedQuantity: 5000,
    currentQuantity: 200,
    shortageOrExcess: -4800,
    minimumLevel: 500,
    maximumLevel: 10000,
    unitPrice: 1.20,
    storageCondition: 'Room Temperature (Under 25C)',
    isHighRiskLasa: false,
    dailyConsumptionAverage: 150,
    remarks: 'Expired batch quarantined in Rack A-01',
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'med-02',
    genericName: 'Inj. Ceftriaxone',
    brandName: 'Rocephin',
    strength: '1 g',
    dosageForm: 'Vial',
    unitOfIssue: 'Vials',
    expiryDate: '2026-09-05', // 0-30 days critical
    authorizedQuantity: 300,
    currentQuantity: 150,
    shortageOrExcess: -150,
    minimumLevel: 50,
    maximumLevel: 600,
    unitPrice: 185.00,
    storageCondition: 'Cool Storage (15C-25C)',
    isHighRiskLasa: false,
    dailyConsumptionAverage: 10,
    remarks: 'Critical short-dated batch. Expedited FEFO utilization ordered.',
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'med-03',
    genericName: 'Ciprofloxacin',
    brandName: 'Ciprocin',
    strength: '500 mg',
    dosageForm: 'Tablet',
    unitOfIssue: 'Tablets',
    expiryDate: '2026-10-05', // 31-60 days short-dated
    authorizedQuantity: 2000,
    currentQuantity: 800,
    shortageOrExcess: -1200,
    minimumLevel: 200,
    maximumLevel: 3000,
    unitPrice: 12.50,
    storageCondition: 'Room Temperature (Under 25C)',
    isHighRiskLasa: false,
    dailyConsumptionAverage: 30,
    remarks: 'Short-dated batch expiring in 50 days.',
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'med-04',
    genericName: 'Omeprazole',
    brandName: 'Seclo',
    strength: '20 mg',
    dosageForm: 'Capsule',
    unitOfIssue: 'Capsules',
    expiryDate: '2026-11-05', // 61-90 days watch
    authorizedQuantity: 4000,
    currentQuantity: 1200,
    shortageOrExcess: -2800,
    minimumLevel: 400,
    maximumLevel: 5000,
    unitPrice: 5.00,
    storageCondition: 'Room Temperature (Under 25C)',
    isHighRiskLasa: false,
    dailyConsumptionAverage: 80,
    remarks: 'Expiry watch list. Normal issuing in progress.',
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'med-05',
    genericName: 'Inj. Morphine Sulphate',
    brandName: 'Morphine',
    strength: '15 mg/ml',
    dosageForm: 'Ampoule',
    unitOfIssue: 'Ampoules',
    expiryDate: '2027-08-30', // > 90 days serviceable
    authorizedQuantity: 100,
    currentQuantity: 85,
    shortageOrExcess: -15,
    minimumLevel: 20,
    maximumLevel: 200,
    unitPrice: 45.00,
    storageCondition: 'Controlled Drug Safe Vault (Double Locked)',
    isHighRiskLasa: true,
    dailyConsumptionAverage: 1,
    remarks: 'High Risk LASA. Double verification mandatory.',
    createdAt: '2026-01-01T00:00:00Z'
  }
];

export const initialMedicineBatches: MedicineBatch[] = [
  {
    id: 'b-01',
    medicineId: 'med-01',
    batchNumber: 'PCM-EXP-2026',
    expiryDate: '2026-08-10',
    receivedQuantity: 500,
    currentQuantity: 200,
    rack: 'A',
    shelf: '01',
    bin: '04',
    receiptReference: 'RCV/95FA/2024/091',
    status: 'EXPIRED',
    quarantineReason: 'Past expiry date (Aug 10, 2026). Move to quarantine vault.',
    createdAt: '2024-08-10T00:00:00Z',
    updatedAt: '2026-08-16T00:00:00Z'
  },
  {
    id: 'b-02',
    medicineId: 'med-02',
    batchNumber: 'CEF-30D-SHORT',
    expiryDate: '2026-09-05',
    receivedQuantity: 300,
    currentQuantity: 150,
    rack: 'B',
    shelf: '02',
    bin: '01',
    receiptReference: 'RCV/95FA/2025/112',
    status: 'SHORT_DATED',
    createdAt: '2025-03-05T00:00:00Z',
    updatedAt: '2026-08-16T00:00:00Z'
  },
  {
    id: 'b-03',
    medicineId: 'med-03',
    batchNumber: 'CIP-NORM-2026',
    expiryDate: '2026-10-05',
    receivedQuantity: 1000,
    currentQuantity: 800,
    rack: 'C',
    shelf: '01',
    bin: '02',
    receiptReference: 'RCV/95FA/2025/140',
    status: 'HELD_NORMAL',
    createdAt: '2025-04-10T00:00:00Z',
    updatedAt: '2026-08-16T00:00:00Z'
  },
  {
    id: 'b-04',
    medicineId: 'med-04',
    batchNumber: 'OMP-NORM-2026',
    expiryDate: '2026-11-05',
    receivedQuantity: 2000,
    currentQuantity: 1200,
    rack: 'C',
    shelf: '03',
    bin: '05',
    receiptReference: 'RCV/95FA/2025/201',
    status: 'HELD_NORMAL',
    createdAt: '2025-05-15T00:00:00Z',
    updatedAt: '2026-08-16T00:00:00Z'
  },
  {
    id: 'b-05',
    medicineId: 'med-05',
    batchNumber: 'MOR-NORM-2027',
    expiryDate: '2027-08-30',
    receivedQuantity: 100,
    currentQuantity: 85,
    rack: 'VAULT',
    shelf: '01',
    bin: '01',
    receiptReference: 'RCV/95FA/2025/299',
    status: 'HELD_NORMAL',
    createdAt: '2025-08-30T00:00:00Z',
    updatedAt: '2026-08-16T00:00:00Z'
  }
];

export const initialInstruments: MedicalInstrumentItem[] = [
  {
    id: 'inst-01',
    instrumentSetName: 'Major Surgical Resuscitation Set #01',
    category: 'SURGICAL',
    authorizedQty: 5,
    heldQty: 4,
    shortageOrExcess: -1,
    serviceableQty: 4,
    unserviceableQty: 0,
    underRepairQty: 0,
    location: 'OT Resuscitation Room Cabinet 1',
    lastInspectionDate: '2026-08-01',
    nextInspectionDueDate: '2026-08-31',
    responsibleAppointment: 'Senior Medical Assistant',
    remarks: 'Full autoclaved set checked before mission readiness drill.',
    updatedAt: '2026-08-16T00:00:00Z'
  },
  {
    id: 'inst-02',
    instrumentSetName: 'Emergency Tracheostomy Set #02',
    category: 'EMERGENCY',
    authorizedQty: 4,
    heldQty: 4,
    shortageOrExcess: 0,
    serviceableQty: 4,
    unserviceableQty: 0,
    underRepairQty: 0,
    location: 'MI Room Emergency Tray #2',
    lastInspectionDate: '2026-08-10',
    nextInspectionDueDate: '2026-09-10',
    responsibleAppointment: 'Medical Officer In-Charge (MOIC)',
    remarks: 'Sterilized and sealed in surgical pouch.',
    updatedAt: '2026-08-16T00:00:00Z'
  }
];

export const initialEquipment: MedicalEquipmentItem[] = [
  {
    id: 'eq-01',
    equipmentName: 'Transport Multiparameter Patient Monitor',
    category: 'LIFE_SUPPORT',
    makeModel: 'Mindray BeneVision N1',
    serialNumber: 'MN-95FA-0089',
    authorizedQuantity: 6,
    heldQuantity: 5,
    shortageOrExcess: -1,
    currentStatus: 'SERVICEABLE',
    locationDepartment: 'SMT ICU Ambulance Bay 1',
    lastInspectionDate: '2026-08-01',
    nextMaintenanceDueDate: '2026-11-01',
    calibrationDueDate: '2026-12-15',
    responsibleAppointment: 'SMT Medical Transport Tech',
    remarks: 'Battery health 100%, oxygen cascade sensor calibrated.',
    updatedAt: '2026-08-16T00:00:00Z'
  },
  {
    id: 'eq-02',
    equipmentName: 'Portable Field Ultrasound Diagnostic Unit',
    category: 'DIAGNOSTIC_IMAGING',
    makeModel: 'SonoSite Edge II',
    serialNumber: 'SS-95FA-1102',
    authorizedQuantity: 2,
    heldQuantity: 2,
    shortageOrExcess: 0,
    currentStatus: 'SERVICEABLE',
    locationDepartment: 'Radiology / Resuscitation Bay',
    lastInspectionDate: '2026-07-28',
    nextMaintenanceDueDate: '2026-10-28',
    calibrationDueDate: '2026-11-30',
    responsibleAppointment: 'Medical Officer In-Charge (MOIC)',
    remarks: 'Curvilinear and phased array probes operational.',
    updatedAt: '2026-08-16T00:00:00Z'
  }
];

export const initialMonthlyAudits: MonthlyMedicalAuditReport[] = [
  {
    id: 'audit-2026-07',
    auditMonth: '2026-07',
    auditDate: '2026-07-31',
    reportReference: 'AUDIT/95FA/MED/2026/07-CONSOL',
    totalMedicineItems: 5,
    totalInstrumentItems: 2,
    totalEquipmentItems: 2,
    totalVariancesDetected: 0,
    status: 'CO_APPROVED',
    preparedByAppointment: 'Medicine Operator',
    submittedAt: '2026-07-31T14:00:00Z',
    moicAppointment: 'Medical Officer In-Charge (MOIC)',
    moicDecision: 'APPROVED',
    moicRemarks: 'Physical counts verified across medicine, instruments, and equipment. Zero discrepancies found.',
    moicDecidedAt: '2026-07-31T16:30:00Z',
    coAppointment: 'Commanding Officer (CO)',
    coDecision: 'FINAL_APPROVED',
    coRemarks: 'Monthly medical stock-taking approved for July 2026. Register locked.',
    coDecidedAt: '2026-08-01T09:00:00Z',
    lockedAt: '2026-08-01T09:00:00Z',
    createdAt: '2026-07-31T10:00:00Z',
    updatedAt: '2026-08-01T09:00:00Z',
    items: [
      { id: 'ai-1', itemType: 'MEDICINE', name: 'Paracetamol 500mg', specOrModel: 'Tablet', batchOrSerial: 'PCM-EXP-2026', expiryDate: '2026-08-10', expiryCategory: 'EXPIRED', authorizedQty: 5000, systemQty: 200, physicalQty: 200, variance: 0, remarks: 'Verified in quarantine rack' },
      { id: 'ai-2', itemType: 'MEDICINE', name: 'Inj. Ceftriaxone 1g', specOrModel: 'Vial', batchOrSerial: 'CEF-30D-CRIT', expiryDate: '2026-09-05', expiryCategory: 'SHORT_DATED', authorizedQty: 300, systemQty: 150, physicalQty: 150, variance: 0, remarks: 'Physically counted' },
      { id: 'ai-3', itemType: 'INSTRUMENT', name: 'Major Surgical Resuscitation Set #01', specOrModel: 'SURGICAL', batchOrSerial: 'SET-01', authorizedQty: 5, systemQty: 4, physicalQty: 4, variance: 0, remarks: 'OT sterilization verified' },
      { id: 'ai-4', itemType: 'EQUIPMENT', name: 'Transport Multiparameter Patient Monitor', specOrModel: 'Mindray N1', batchOrSerial: 'MN-95FA-0089', authorizedQty: 6, systemQty: 5, physicalQty: 5, variance: 0, remarks: 'All functional' }
    ]
  }
];

export const initialMiscellaneousNotices: MiscellaneousNotice[] = [
  {
    id: 'misc-01',
    referenceNo: 'NOTICE/95FA/2026/08/001',
    title: 'Unit Monsoon Sanitation & Vector-Borne Disease Prevention Directive',
    description: 'Guidelines on vector surveillance, water purification checks, and preventative measures across troop accommodations.',
    uploadDate: '2026-08-15T09:00:00Z',
    uploaderAppointment: 'Medical Officer In-Charge (MOIC)',
    uploaderUserId: 'usr-moic',
    validUntil: '2026-09-30',
    attachments: [
      {
        id: 'att-01',
        name: 'Monsoon_Sanitation_Directive_95FA.pdf',
        type: 'application/pdf',
        size: 1048576,
        dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJ...'
      }
    ],
    status: 'PUBLISHED',
    coApprovedBy: 'Commanding Officer (CO)',
    coApprovedAt: '2026-08-15T11:00:00Z',
    coRemarks: 'Approved for immediate unit-wide compliance and display.',
    isPublished: true,
    isArchived: false,
    createdAt: '2026-08-15T09:00:00Z',
    updatedAt: '2026-08-15T11:00:00Z'
  },
  {
    id: 'misc-02',
    referenceNo: 'NOTICE/95FA/2026/08/002',
    title: 'Quarterly Physical Fitness & Field Resuscitation Assessment Schedule',
    description: 'Assessment schedule for all trade personnel at the division training ground.',
    uploadDate: '2026-08-16T14:30:00Z',
    uploaderAppointment: 'Quartermaster (QM)',
    uploaderUserId: 'usr-qm',
    validUntil: '2026-09-15',
    attachments: [],
    status: 'PUBLISHED',
    coApprovedBy: 'Commanding Officer (CO)',
    coApprovedAt: '2026-08-16T16:00:00Z',
    coRemarks: 'Approved for publication.',
    isPublished: true,
    isArchived: false,
    createdAt: '2026-08-16T14:30:00Z',
    updatedAt: '2026-08-16T16:00:00Z'
  }
];

export const initialSectionApprovals: SectionApprovalRecord[] = [
  {
    id: 'appr-parade',
    stateDate: new Date().toISOString().substring(0, 10),
    section: 'parade_state',
    sectionTitle: 'Daily Parade State',
    status: 'CO_APPROVED',
    version: '1.0',
    submittedByAppointment: 'Part-I Duty Operator',
    submittedAt: '2026-08-16T06:30:00Z',
    intermediateAppointment: 'Quartermaster (QM)',
    intermediateDecision: 'APPROVED',
    intermediateRemarks: 'Parade strength matched with physical muster roll.',
    intermediateDecidedAt: '2026-08-16T08:00:00Z',
    coAppointment: 'Commanding Officer (CO)',
    coDecision: 'FINAL_APPROVED',
    coRemarks: 'Approved and sealed.',
    coDecidedAt: '2026-08-16T10:00:00Z',
    lockedAt: '2026-08-16T10:00:00Z'
  },
  {
    id: 'appr-manpower',
    stateDate: new Date().toISOString().substring(0, 10),
    section: 'manpower',
    sectionTitle: 'Manpower State',
    status: 'CO_APPROVED',
    version: '1.0',
    submittedByAppointment: 'Manpower Operator',
    submittedAt: '2026-08-16T07:00:00Z',
    intermediateAppointment: 'Quartermaster (QM)',
    intermediateDecision: 'APPROVED',
    intermediateRemarks: 'Verified all 10 trades including SMT drivers and medical technicians.',
    intermediateDecidedAt: '2026-08-16T08:15:00Z',
    coAppointment: 'Commanding Officer (CO)',
    coDecision: 'FINAL_APPROVED',
    coRemarks: 'Manpower state approved.',
    coDecidedAt: '2026-08-16T10:05:00Z',
    lockedAt: '2026-08-16T10:05:00Z'
  },
  {
    id: 'appr-vehicle',
    stateDate: new Date().toISOString().substring(0, 10),
    section: 'vehicle',
    sectionTitle: 'Vehicle / MT State',
    status: 'CO_APPROVED',
    version: '1.0',
    submittedByAppointment: 'Vehicle Operator',
    submittedAt: '2026-08-16T07:15:00Z',
    intermediateAppointment: 'Quartermaster (QM)',
    intermediateDecision: 'APPROVED',
    intermediateRemarks: 'MT vehicle fitness and EME repair references verified.',
    intermediateDecidedAt: '2026-08-16T08:20:00Z',
    coAppointment: 'Commanding Officer (CO)',
    coDecision: 'FINAL_APPROVED',
    coRemarks: 'Vehicle readiness approved.',
    coDecidedAt: '2026-08-16T10:10:00Z',
    lockedAt: '2026-08-16T10:10:00Z'
  },
  {
    id: 'appr-medicine',
    stateDate: new Date().toISOString().substring(0, 10),
    section: 'med_store_medicine',
    sectionTitle: 'Medical Store — Medicine',
    status: 'CO_APPROVED',
    version: '1.0',
    submittedByAppointment: 'Medicine Operator',
    submittedAt: '2026-08-16T07:30:00Z',
    intermediateAppointment: 'Medical Officer In-Charge (MOIC)',
    intermediateDecision: 'APPROVED',
    intermediateRemarks: 'Expiry dates, FEFO batches, and quarantine vault verified.',
    intermediateDecidedAt: '2026-08-16T08:30:00Z',
    coAppointment: 'Commanding Officer (CO)',
    coDecision: 'FINAL_APPROVED',
    coRemarks: 'Medical store state approved.',
    coDecidedAt: '2026-08-16T10:15:00Z',
    lockedAt: '2026-08-16T10:15:00Z'
  },
  {
    id: 'appr-instruments',
    stateDate: new Date().toISOString().substring(0, 10),
    section: 'med_store_instruments',
    sectionTitle: 'Medical Instruments',
    status: 'CO_APPROVED',
    version: '1.0',
    submittedByAppointment: 'Instrument & Equipment Operator',
    submittedAt: '2026-08-16T07:45:00Z',
    intermediateAppointment: 'Medical Officer In-Charge (MOIC)',
    intermediateDecision: 'APPROVED',
    intermediateRemarks: 'Autoclave sterilization logs and set quantities verified.',
    intermediateDecidedAt: '2026-08-16T08:35:00Z',
    coAppointment: 'Commanding Officer (CO)',
    coDecision: 'FINAL_APPROVED',
    coRemarks: 'Medical instruments approved.',
    coDecidedAt: '2026-08-16T10:20:00Z',
    lockedAt: '2026-08-16T10:20:00Z'
  },
  {
    id: 'appr-equipment',
    stateDate: new Date().toISOString().substring(0, 10),
    section: 'med_store_equipment',
    sectionTitle: 'Medical Equipment',
    status: 'CO_APPROVED',
    version: '1.0',
    submittedByAppointment: 'Instrument & Equipment Operator',
    submittedAt: '2026-08-16T07:50:00Z',
    intermediateAppointment: 'Medical Officer In-Charge (MOIC)',
    intermediateDecision: 'APPROVED',
    intermediateRemarks: 'Mindray monitors and Sonosite ultrasound units calibrated.',
    intermediateDecidedAt: '2026-08-16T08:40:00Z',
    coAppointment: 'Commanding Officer (CO)',
    coDecision: 'FINAL_APPROVED',
    coRemarks: 'Electro-medical equipment state approved.',
    coDecidedAt: '2026-08-16T10:25:00Z',
    lockedAt: '2026-08-16T10:25:00Z'
  }
];

export const initialAuditLogs: AuditLogEntry[] = [
  {
    id: 'log-01',
    timestamp: '2026-08-16T06:00:00Z',
    userId: 'usr-admin',
    userAppointment: 'System Administrator',
    userRole: 'admin',
    section: 'auth',
    deviceId: 'dev-01',
    deviceName: 'HQ Command Main Workstation',
    actionType: 'LOGIN_SUCCESS',
    targetRecordRef: 'AUTH_SESSION_INIT',
    remarks: 'Session authenticated on hardware desktop.',
    integrityHmac: 'a3f89e21bc089df7812903feab112456789abcdef0123456789abcdef0123456'
  },
  {
    id: 'log-02',
    timestamp: '2026-08-16T06:30:00Z',
    userId: 'usr-op-duty',
    userAppointment: 'Part-I Duty Roster Operator',
    userRole: 'duty_operator',
    section: 'admin_duty',
    deviceId: 'dev-01',
    deviceName: 'HQ Command Main Workstation',
    actionType: 'DRAFT_SAVED',
    targetRecordRef: '95FA/DUTY/2026/08/001',
    remarks: 'Part-I Daily Duty Roster saved in Draft status.',
    integrityHmac: 'b4a90f32cd190ea89230140fb122356789abcdef0123456789abcdef0123457'
  }
];

export const initialNotifications: InAppNotification[] = [
  {
    id: 'notif-01',
    title: 'Part-I Duty Roster Approved & Published',
    message: 'Commanding Officer (CO) approved and published today\'s Part-I Duty Roster to the Secure Notice Board.',
    type: 'SUCCESS',
    section: 'admin_duty',
    timestamp: '2026-08-16T10:05:00Z',
    isRead: false,
    targetPath: '/notice-board'
  },
  {
    id: 'notif-02',
    title: 'Expired Medicine Warning in Medical Store',
    message: 'Paracetamol 500mg Batch PCM-EXP-2026 has expired. Moved to quarantine vault.',
    type: 'CRITICAL',
    section: 'med_store_medicine',
    timestamp: '2026-08-16T07:30:00Z',
    isRead: false,
    targetPath: '/medical-store'
  }
];

export const initialTrainingMaterials = [
  {
    id: 'train-01',
    title: 'Standard Operating Procedure (SOP) on Field Medical Cover & Triage Protocol',
    category: 'FIELD_MEDICAL_AND_CASEVAC',
    categoryLabel: 'Field Medical and CASEVAC Guidance',
    description: 'Detailed instructions on setting up Advanced Dressing Station (ADS), triage color-coding, and rapid CASEVAC dispatch protocols.',
    issuingAuthority: 'Headquarters, 95 Field Ambulance',
    uploadDate: '2026-08-15',
    version: '1.2',
    reviewDate: '2026-12-31',
    isEmergencyQuickRef: true,
    accessLevel: 'ALL_PERSONNEL',
    attachments: [
      {
        id: 'att-t1',
        fileName: '95FA_SOP_Field_Medical_Triage_2026.pdf',
        fileType: 'pdf',
        fileSize: 245760,
        fileUrl: '#'
      }
    ],
    status: 'CO_APPROVED',
    isPublished: true,
    isArchived: false,
    uploaderAppointment: 'Medical Officer In-Charge (MOIC)',
    uploaderUserId: 'usr-moic',
    moicApprovedBy: 'Medical Officer In-Charge (MOIC)',
    moicApprovedAt: '2026-08-15T09:00:00Z',
    coApprovedBy: 'Commanding Officer (CO)',
    coApprovedAt: '2026-08-15T11:30:00Z',
    acknowledgements: [
      {
        userId: 'usr-op-med',
        userAppointment: 'Medicine Operator',
        acknowledgedAt: '2026-08-15T14:20:00Z'
      }
    ],
    createdAt: '2026-08-15T08:30:00Z',
    updatedAt: '2026-08-15T11:30:00Z'
  },
  {
    id: 'train-02',
    title: 'Emergency Resuscitation & Defibrillator Operations Handbook (Life-Support)',
    category: 'MEDICAL_AND_FIRST_AID',
    categoryLabel: 'Medical and First Aid',
    description: 'Guidelines for operating automated and manual biphasic defibrillators, bag-valve mask ventilation, and intravenous fluid resuscitation.',
    issuingAuthority: 'Clinical Training Division, 95 Fd Amb',
    uploadDate: '2026-08-16',
    version: '2.0',
    reviewDate: '2026-11-30',
    isEmergencyQuickRef: true,
    accessLevel: 'ALL_PERSONNEL',
    attachments: [
      {
        id: 'att-t2',
        fileName: 'Life_Support_Resuscitation_Manual.pdf',
        fileType: 'pdf',
        fileSize: 524288,
        fileUrl: '#'
      }
    ],
    status: 'CO_APPROVED',
    isPublished: true,
    isArchived: false,
    uploaderAppointment: 'Medical Officer In-Charge (MOIC)',
    uploaderUserId: 'usr-moic',
    moicApprovedBy: 'Medical Officer In-Charge (MOIC)',
    moicApprovedAt: '2026-08-16T09:00:00Z',
    coApprovedBy: 'Commanding Officer (CO)',
    coApprovedAt: '2026-08-16T10:00:00Z',
    acknowledgements: [],
    createdAt: '2026-08-16T08:00:00Z',
    updatedAt: '2026-08-16T10:00:00Z'
  },
  {
    id: 'train-03',
    title: 'Military Transport & Ambulance Road Safety Directive',
    category: 'MT_AND_VEHICLE_SAFETY',
    categoryLabel: 'MT and Vehicle Safety',
    description: 'Pre-trip 1st parade inspection, convoy light discipline, blackout driving, and emergency mechanical breakdown SOP.',
    issuingAuthority: 'Quartermaster & MT Section, 95 Fd Amb',
    uploadDate: '2026-08-17',
    version: '1.0',
    reviewDate: '2027-01-15',
    isEmergencyQuickRef: false,
    accessLevel: 'ALL_PERSONNEL',
    attachments: [
      {
        id: 'att-t3',
        fileName: 'MT_Safety_Ambulance_Directive.pdf',
        fileType: 'pdf',
        fileSize: 314572,
        fileUrl: '#'
      }
    ],
    status: 'CO_APPROVED',
    isPublished: true,
    isArchived: false,
    uploaderAppointment: 'Quartermaster (QM)',
    uploaderUserId: 'usr-qm',
    qmApprovedBy: 'Quartermaster (QM)',
    qmApprovedAt: '2026-08-17T09:15:00Z',
    coApprovedBy: 'Commanding Officer (CO)',
    coApprovedAt: '2026-08-17T11:00:00Z',
    acknowledgements: [],
    createdAt: '2026-08-17T08:45:00Z',
    updatedAt: '2026-08-17T11:00:00Z'
  }
];

export const initialDailySnapshots = [
  {
    id: 'snap-2026-08-16',
    snapshotDate: '2026-08-16',
    dayOfWeek: 'Sunday',
    totalStrength: 180,
    onParade: 148,
    outUnit: 32,
    cLeave: 12,
    pLeave: 6,
    medicalLeave: 3,
    cmhAdmitted: 2,
    tyAtt: 4,
    courses: 3,
    otherOut: 2,
    activities: [
      '0600h: PT & Medical Resuscitation Drill',
      '0830h: Daily Sick Report & MOIC Clinical Inspection',
      '1100h: MT Preventive Maintenance Parade'
    ],
    medicalCover: [
      '01 x SMT ICU Ambulance on Standby at Main Gate'
    ],
    foodMenu: 'Breakfast: Paratha, Dal, Egg, Tea | Lunch: Rice, Chicken, Dal | Dinner: Roti, Beef, Vegetables',
    vehicleHeld: 14,
    vehicleServiceable: 11,
    medicineExpiredBatches: 1,
    medicineCriticalShortDated: 2,
    lockedAt: '2026-08-16T18:00:00Z',
    snapshotStatus: 'CO_APPROVED_LOCKED'
  }
];

export const initialDeactivationRequests = [];

export const initialRankTradeDistributions: RankTradeDistributionItem[] = [
  { id: 'rtd-offr', classification: 'Offr', tradeCode: 'Offr', categoryGroup: 'OFFICER', authCount: 6, postedCount: 6, presentCount: 5, outUnitCount: 1, shortfall: 0, heldCount: 6, leaveCount: 1, deficiency: 0, remarks: 'CO, 2IC, MOIC, QM', orderIndex: 1, updatedAt: new Date().toISOString() },
  { id: 'rtd-jco', classification: 'JCO', tradeCode: 'JCO', categoryGroup: 'JCO', authCount: 8, postedCount: 8, presentCount: 7, outUnitCount: 1, shortfall: 0, heldCount: 8, leaveCount: 1, deficiency: 0, remarks: 'SM, SWO, WO', orderIndex: 2, updatedAt: new Date().toISOString() },
  { id: 'rtd-ma', classification: 'MA', tradeCode: 'MA', categoryGroup: 'OTHER_RANK', authCount: 45, postedCount: 45, presentCount: 40, outUnitCount: 5, shortfall: 0, heldCount: 45, leaveCount: 5, deficiency: 0, remarks: 'Medical Assistant', orderIndex: 3, updatedAt: new Date().toISOString() },
  { id: 'rtd-mt', classification: 'MT', tradeCode: 'MT', categoryGroup: 'OTHER_RANK', authCount: 14, postedCount: 14, presentCount: 12, outUnitCount: 2, shortfall: 0, heldCount: 14, leaveCount: 2, deficiency: 0, remarks: 'MT Driver', orderIndex: 4, updatedAt: new Date().toISOString() },
  { id: 'rtd-smt', classification: 'SMT', tradeCode: 'SMT', categoryGroup: 'OTHER_RANK', authCount: 38, postedCount: 38, presentCount: 34, outUnitCount: 4, shortfall: 0, heldCount: 38, leaveCount: 4, deficiency: 0, remarks: 'Special Medical Trade', orderIndex: 5, updatedAt: new Date().toISOString() },
  { id: 'rtd-clk', classification: 'Clk', tradeCode: 'Clk', categoryGroup: 'OTHER_RANK', authCount: 8, postedCount: 8, presentCount: 7, outUnitCount: 1, shortfall: 0, heldCount: 8, leaveCount: 1, deficiency: 0, remarks: 'Clerk', orderIndex: 6, updatedAt: new Date().toISOString() },
  { id: 'rtd-lab-tech', classification: 'Lab Tech', tradeCode: 'Lab Tech', categoryGroup: 'OTHER_RANK', authCount: 4, postedCount: 4, presentCount: 4, outUnitCount: 0, shortfall: 0, heldCount: 4, leaveCount: 0, deficiency: 0, remarks: 'Lab Tech', orderIndex: 7, updatedAt: new Date().toISOString() },
  { id: 'rtd-ota', classification: 'OTA', tradeCode: 'OTA', categoryGroup: 'OTHER_RANK', authCount: 6, postedCount: 6, presentCount: 5, outUnitCount: 1, shortfall: 0, heldCount: 6, leaveCount: 1, deficiency: 0, remarks: 'OT Assistant', orderIndex: 8, updatedAt: new Date().toISOString() },
  { id: 'rtd-disp', classification: 'Disp', tradeCode: 'Disp', categoryGroup: 'OTHER_RANK', authCount: 6, postedCount: 6, presentCount: 5, outUnitCount: 1, shortfall: 0, heldCount: 6, leaveCount: 1, deficiency: 0, remarks: 'Dispenser', orderIndex: 9, updatedAt: new Date().toISOString() },
  { id: 'rtd-eme', classification: 'EME', tradeCode: 'EME', categoryGroup: 'OTHER_RANK', authCount: 5, postedCount: 5, presentCount: 4, outUnitCount: 1, shortfall: 0, heldCount: 5, leaveCount: 1, deficiency: 0, remarks: 'EME', orderIndex: 10, updatedAt: new Date().toISOString() },
  { id: 'rtd-tradesman', classification: 'Tradesman', tradeCode: 'Tradesman', categoryGroup: 'OTHER_RANK', authCount: 10, postedCount: 10, presentCount: 9, outUnitCount: 1, shortfall: 0, heldCount: 10, leaveCount: 1, deficiency: 0, remarks: 'Tradesman', orderIndex: 11, updatedAt: new Date().toISOString() },
  { id: 'rtd-cook', classification: 'Cook', tradeCode: 'Cook', categoryGroup: 'OTHER_RANK', authCount: 6, postedCount: 6, presentCount: 5, outUnitCount: 1, shortfall: 0, heldCount: 6, leaveCount: 1, deficiency: 0, remarks: 'Cook', orderIndex: 12, updatedAt: new Date().toISOString() },
  { id: 'rtd-nce', classification: 'NC(E)', tradeCode: 'NC(E)', categoryGroup: 'NCE', authCount: 12, postedCount: 12, presentCount: 11, outUnitCount: 1, shortfall: 0, heldCount: 12, leaveCount: 1, deficiency: 0, remarks: 'NC(E)', orderIndex: 13, updatedAt: new Date().toISOString() },
  { id: 'rtd-ncu', classification: 'NC(U)', tradeCode: 'NC(U)', categoryGroup: 'NCU', authCount: 4, postedCount: 4, presentCount: 3, outUnitCount: 1, shortfall: 0, heldCount: 4, leaveCount: 1, deficiency: 0, remarks: 'NC(U)', orderIndex: 14, updatedAt: new Date().toISOString() }
];

