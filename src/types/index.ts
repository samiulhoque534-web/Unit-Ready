// Core Type Definitions for 95 Fd Amb — UNIT-READY System
// Unit: 95 Field Ambulance
// Offline Unit Administration, Duty Roster, Vehicle and Medical Store Management System

export type UserRole =
  | 'co' // Commanding Officer (Final Command Approval)
  | '2ic' // Second-in-Command (Mandatory Verification)
  | 'qm' // Quartermaster (Logistical Approval)
  | 'moic' // Medical Officer In Charge (Clinical Approval)
  | 'other_operator' // Other Operators (Variable & Editable)
  | 'manpower_operator'
  | 'vehicle_operator'
  | 'medicine_operator'
  | 'inst_equip_operator'
  | 'duty_roster_operator'
  | 'duty_operator'
  | 'general_viewer' // General Unit Viewer (Read-Only 1-Click Access)
  | 'admin'
  | 'auditor'
  | 'general_personnel'
  | 'general_duty'
  | 'smt_member'
  | 'authorised_personnel';

export type SectionCode =
  | 'A'
  | 'Med'
  | 'EME'
  | 'MT'
  | 'SMT' // Special Medical Transport (Trade under Manpower)
  | 'Clk'
  | 'Cook'
  | 'Tradesman'
  | 'NC(E)'
  | 'NC(U)';

export type ApprovalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PUBLISHED'
  | 'PENDING_MOIC'
  | 'PENDING_QM'
  | '2IC_APPROVED'
  | '2IC_HELD'
  | '2IC_RETURNED'
  | 'QM_APPROVED'
  | 'MOIC_APPROVED'
  | 'CO_APPROVED'
  | 'LOCKED'
  | 'SUPERSEDED'
  | 'REJECTED'
  | 'RETURNED'
  | 'HELD';

export type ExpiryCategory =
  | 'HELD_NORMAL' // Held Medicines – Normal Use (> 30 days)
  | 'SHORT_DATED' // Short-Dated Medicines – Expiry within 30 Days (0-30 days)
  | 'EXPIRED'; // Expired Medicines (< 0 days)

export type DeviceStatus = 'ACTIVE' | 'PENDING' | 'REVOKED';

export interface RankItem {
  id: string;
  rankName: string;
  rankOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface SectionItem {
  id: string;
  sectionCode: string;
  sectionName: string;
  designatedOperatorRole: string;
  responsibleVerifierRole: string;
  intermediateApproverRole: string;
  isActive: boolean;
  createdAt: string;
}

export interface UserAuditLogEntry {
  id: string;
  armyNumber: string;
  rank?: string;
  name?: string;
  userId?: string;
  timestamp: string; // ISO Asia/Dhaka
  actionType: 'REGISTRATION' | 'LOGIN' | 'LOGOUT' | 'FAILED_LOGIN' | 'APPROVAL' | 'REJECTION' | 'SUSPENSION' | 'DEACTIVATION' | 'REACTIVATION';
  performedBy: string; // e.g. "CO", "System", "Admin"
  details?: string;
}

export interface User {
  id: string;
  serviceNumber: string; // Army Number / BA Number
  armyNumberNormalized?: string; // Upper-case trimmed space-normalized
  rank?: string;
  fullName?: string;
  subUnitCompany?: string; // Company / Sub-unit
  appointmentTitle: string; // Used across the system
  role: UserRole;
  sectionAssigned: SectionCode | 'all';
  canApprove?: boolean;
  canVerify?: boolean;
  canRequestCorrection?: boolean;
  mustChangePassword?: boolean;
  failedLoginAttempts: number;
  lockoutUntil?: string | null;
  isActive: boolean;
  accountStatus?: 'PENDING' | 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'REJECTED';
  registrationDate?: string;
  lastActivityAt?: string;
  identityVerified?: boolean;
  verificationNotes?: string;
  userStatus?: 'ACTIVE' | 'TRANSFERRED' | 'DISBANDED' | 'INACTIVE' | 'DEACTIVATED' | 'REVOKED';
  loginCode?: string;
  lastLoginAt?: string;
  lastEditedBy?: string;
  lastEditedAt?: string;
  deactivatedAt?: string;
  deactivatedReason?: string;
  deactivatedBy?: string;
  pin?: string;
}

export interface Device {
  id: string;
  deviceIdentifier: string;
  deviceName: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  assignedUserId?: string;
  assignedSectionCode?: string;
  applicantBaNo?: string;
  applicantRank?: string;
  applicantFullName?: string;
  applicantAppt?: string;
  sixDigitPin?: string;
  pinExpiresAt?: string;
  generatedByAppointment?: string;
  status: DeviceStatus;
  registrationDate: string;
  lastSyncAt?: string;
  revokedStatus: boolean;
}

export interface ParadeStateOutUnitBreakdown {
  cLeave: number;
  pLeave: number;
  medicalLeave: number;
  cmhAdmitted: number;
  maternityLeave: number;
  course: number;
  temporaryAttachment: number;
  otherOutUnit: number;
}

export interface ParadeStatePersonnelItem {
  id: string;
  personalNumber: string;
  appointment: string;
  sectionCode: string;
  status: 'ON_PARADE' | 'C_LEAVE' | 'P_LEAVE' | 'MEDICAL_LEAVE' | 'CMH_ADMITTED' | 'MATERNITY_LEAVE' | 'COURSE' | 'TEMPORARY_ATTACHMENT' | 'OTHER_OUT_UNIT';
  statusRemarks?: string;
}

export interface ParadeState {
  id: string;
  stateDate: string; // YYYY-MM-DD
  dayOfWeek: string;
  greeting: string;
  
  // Posted Strength Breakdown (Personnel on Unit Roll for that date)
  strOffrs: number; // Posted Officers
  strJco: number; // Posted JCOs
  strOrs: number; // Posted ORs
  strNce: number; // Posted NC(E)
  strNcu: number; // Posted NC(U)
  totalStrength: number; // Total Posted Strength = Offrs + JCO + ORs + NC(E) + NC(U)

  // Present / On Parade Strength Breakdown (Physically present inside unit)
  presentOffrs?: number;
  presentJco?: number;
  presentOrs?: number;
  presentNce?: number;
  presentNcu?: number;
  onParadeCount: number; // Total Present / On Parade Strength
  
  // Out Unit Total = Total Posted Strength - On Parade
  outUnitTotal: number;

  // Category-wise Out Unit Breakdown
  outUnitBreakdown: ParadeStateOutUnitBreakdown;
  
  // Detailed lists
  personnelList: ParadeStatePersonnelItem[];
  cLeaveDetails: string[];
  pLeaveDetails: string[];
  medicalLeaveDetails: string[];
  cmhAdmittedDetails: string[];
  maternityLeaveDetails: string[];
  courseDetails: string[];
  tyAttDetails: string[];
  otherOutDetails: string[];
  
  // Daily Administrative Details
  tomorrowActivities: string[];
  medicalCover: string[];
  foodMenu: string;
  closingRegards: string;
  
  status: ApprovalStatus;
  version: string;
  preparedBy: string;
  qmApprovedBy?: string;
  coApprovedBy?: string;
  remarks?: string;
  updatedAt: string;
}

export interface DutyAssignmentRow {
  id: string;
  placeOfDuty: string; // e.g. "Southern Camp", "MT Park", "ARP / Main Gate", "Guard Commander", "Quarter Guard"
  dutyCategory: string; // e.g. "Camp Guard", "Sentry", "Patrol", "Night Watch"
  personnelName: string;
  rankTrade: string; // e.g. "Sgt / MA" or "Cpl / MT"
  serviceNumber: string; // e.g. "BA-10492" or "NO-30482"
  date: string; // YYYY-MM-DD
  timeFrom: string; // e.g. "06:00" or "0600"
  timeTo: string; // e.g. "14:00" or "1400"
  shiftLabel?: string; // e.g. "Shift A (0600-1400)"
  remarks?: string;
}

export interface DutyAppointmentsBlock {
  dutyOfficer?: { name: string; rank: string; baNo: string; contact?: string };
  dutyJco?: { name: string; rank: string; baNo: string; contact?: string };
  dutyNco?: { name: string; rank: string; baNo: string; contact?: string };
  dutyClerk?: { name: string; rank: string; baNo: string };
  secondSeater?: { name: string; rank: string; baNo: string; placeOfDuty?: string; timeFrom?: string; timeTo?: string; remarks?: string };
  dutyBatman?: { name: string; rank: string; baNo: string };
  adminDriver?: { name: string; rank: string; baNo: string; vehicleNo?: string };
}

export interface RankTradeDistributionItem {
  id: string;
  classification: string; // e.g. "Offr", "JCO", "MA", "MT", "SMT", "Clk", "Lab Tech", "OTA", "Disp", "EME", "Tradesman", "Cook", "NC(E)", "NC(U)"
  tradeCode?: string;
  categoryGroup?: 'OFFICER' | 'JCO' | 'OTHER_RANK' | 'NCE' | 'NCU';
  authCount: number; // Authorized Strength (Establishment)
  postedCount: number; // Posted Strength (Held)
  presentCount: number; // Present / On Parade Strength
  outUnitCount: number; // Out Unit (Leave / Course / Att)
  shortfall: number; // Authorized Shortfall = Auth - Posted
  heldCount?: number; // Alias for postedCount
  leaveCount?: number; // Alias for outUnitCount
  deficiency?: number; // Alias for shortfall
  remarks?: string;
  orderIndex?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface DutyRoster {
  id: string;
  referenceNo: string;
  unitName?: string; // "95 FD AMB"
  title: string; // "Daily Part-1 Duty Roster / Orders"
  dutyDate: string; // Primary date
  effectiveFrom: string;
  effectiveUntil: string;
  secondaryDate?: string; // 2nd comparison date
  isRestricted?: boolean; // Show "RESTRICTED" military header
  dutyCategory: string;
  section: SectionCode | string;
  version: string;
  accessLevel: 'RESTRICTED_SECTION' | 'UNIT_ALL' | 'OFFICERS_ONLY';
  status: ApprovalStatus;
  
  // Structured Digital Fields
  mainAppointments?: DutyAppointmentsBlock;
  dutyRows?: DutyAssignmentRow[];
  placeGroups?: string[];
  specialInstructions?: string[];
  preparedBy?: string;
  checkedBy?: string;
  
  // Legacy / optional generated PDF
  pdfDataUrl?: string;
  pdfFileName?: string;
  pdfFileSize?: number;
  pdfSha256?: string;
  
  preparedByUserId?: string;
  submittedByUserId?: string;
  qmApprovedByUserId?: string;
  qmApprovedAt?: string;
  qmRemarks?: string;
  twoIcApprovedByUserId?: string;
  twoIcApprovedAt?: string;
  twoIcRemarks?: string;
  coApprovedByUserId?: string;
  coApprovedAt?: string;
  coRemarks?: string;
  publishedAt?: string;
  isPublished: boolean;
  supersededByRosterId?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RosterAcknowledgement {
  id: string;
  rosterId: string;
  userId: string;
  userAppointment: string;
  role: UserRole;
  deviceId: string;
  deviceName: string;
  documentVersion: string;
  acknowledgedAt: string;
  statement: string;
}

export type PersonnelTrade =
  | 'Offr'
  | 'JCO'
  | 'MA'
  | 'MT'
  | 'SMT'
  | 'Clk'
  | 'Lab Tech'
  | 'OTA'
  | 'Disp'
  | 'EME'
  | 'Tradesman'
  | 'Cook'
  | 'NC(E)'
  | 'NC(U)';

export interface ManpowerPersonnel {
  id: string;
  baNo: string; // Unique BA Number
  rank: string; // Military Rank
  name: string; // Full Name
  trade: PersonnelTrade; // Exactly one of the 10 approved trades
  personalNumber: string; // Backward compatibility alias with baNo
  appointment: string;
  sectionCode: string;
  isAuthorizedAppointment: boolean;
  currentStatus: 'PRESENT' | 'LEAVE' | 'COURSE' | 'TEMPORARY_DUTY' | 'MEDICAL_REST_ADMITTED' | 'OTHER_APPROVED_ABSENCE';
  statusFromDate: string;
  expectedReturnDate?: string;
  qualification?: string;
  remarks?: string;
}

export interface ManpowerDailyState {
  id: string;
  stateDate: string;
  totalAuthorized: number;
  totalHeld: number;
  totalPresent: number;
  totalEffective: number;
  totalLeave: number;
  totalCourse: number;
  totalTemporaryDuty: number;
  totalMedicalAdmitted: number;
  totalOtherAbsence: number;
  totalDeficiency: number;
  status: ApprovalStatus;
  version: string;
  preparedBy: string;
  qmApprovedBy?: string;
  coApprovedBy?: string;
  remarks?: string;
  updatedAt: string;
}

export interface VehicleFleetItem {
  id: string;
  vehicleType: string;
  model?: string;
  registrationFleetRef: string;
  authorizedQty: number;
  heldQty: number;
  status: 'SERVICEABLE' | 'UNSERVICEABLE' | 'UNDER_REPAIR' | 'INSPECTION_DUE' | 'AVAILABLE_FOR_TASK';
  serviceability: 'FULLY_FIT' | 'TEMPORARY_RESTRICTION' | 'OFF_ROAD';
  driverName?: string;
  location?: string;
  lastInspectionDate: string;
  nextInspectionDueDate: string;
  defectCategory?: string;
  repairStatus?: string;
  repairReference?: string;
  expectedReturnDate?: string;
  responsibleAppointment: string;
  remarks?: string;
}

export interface VehicleDailyState {
  id: string;
  stateDate: string;
  totalAuthorized: number;
  totalHeld: number;
  totalServiceable: number;
  totalUnserviceable: number;
  totalUnderRepair: number;
  totalInspectionDue: number;
  totalAvailableForTask: number;
  deficiencyExcess: number;
  status: ApprovalStatus;
  version: string;
  preparedBy: string;
  qmApprovedBy?: string;
  coApprovedBy?: string;
  remarks?: string;
  updatedAt: string;
}

export type StockStatusType = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SHORT_DATED' | 'EXPIRED' | 'QUARANTINED';

export interface MedicineItem {
  id: string;
  genericName: string;
  brandName?: string;
  strength: string;
  dosageForm: string;
  unitOfIssue: string; // e.g. tablet, vial, ampoule, bottle, strip
  batchNumber?: string;
  expiryDate: string; // Mandatory YYYY-MM-DD
  authorizedQuantity: number;
  heldQuantity: number; // base held quantity
  receivedQuantity: number; // total received
  issuedQuantity: number; // total issued
  balanceQuantity: number; // Held + Received - Issued (never < 0)
  currentQuantity: number; // maps to balanceQuantity for backward compatibility
  shortageOrExcess: number; // balanceQuantity - authorizedQuantity
  minimumLevel: number;
  maximumLevel: number;
  unitPrice: number;
  storageCondition: string;
  isHighRiskLasa: boolean;
  dailyConsumptionAverage: number;
  stockStatus?: StockStatusType;
  remarks?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MedicineBatch {
  id: string;
  medicineId: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  receivedQuantity: number;
  currentQuantity: number;
  rack: string;
  shelf: string;
  bin: string;
  receiptReference: string;
  status: ExpiryCategory;
  quarantineReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicineTransaction {
  id: string;
  issueId?: string; // e.g. ISS-95FA-YYYYMMDD-XXXX
  transactionType: 'RECEIVE' | 'ISSUE' | 'RETURN' | 'TRANSFER_PROPOSAL' | 'QUARANTINE_MOVE' | 'REVERSAL_ENTRY' | 'CORRECTING_ENTRY' | 'STOCK_ADJUSTMENT';
  medicineId: string;
  medicineName: string;
  strengthDosage?: string;
  batchId: string;
  batchNumber: string;
  expiryDate?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  totalValue: number;
  voucherReference: string;
  linkedOriginalTransactionId?: string;
  issuedToRecipient?: string;
  placeLocation?: string; // location/department where issued
  issuedByName?: string;
  secondVerifierUserId?: string;
  performedByUserId: string;
  performedByAppointment: string;
  deviceId: string;
  transactionTimestamp: string;
  issueDate?: string; // YYYY-MM-DD
  remarks: string;
  isReversed?: boolean;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
}

export interface MedicalInstrumentItem {
  id: string;
  instrumentSetName: string;
  category: string;
  authorizedQty: number;
  heldQty: number;
  shortageOrExcess?: number;
  serviceableQty: number;
  unserviceableQty: number;
  underRepairQty: number;
  location: string;
  lastInspectionDate: string;
  nextInspectionDueDate: string;
  defectDetails?: string;
  repairReference?: string;
  responsibleAppointment: string;
  remarks?: string;
  updatedAt: string;
}

export interface MedicalEquipmentItem {
  id: string;
  equipmentName: string;
  category: 'ELECTRO_MEDICAL' | 'DIAGNOSTIC_IMAGING' | 'STERILIZATION' | 'LIFE_SUPPORT' | 'LABORATORY';
  makeModel: string;
  serialNumber: string;
  authorizedQuantity: number;
  heldQuantity: number;
  shortageOrExcess?: number;
  currentStatus: 'SERVICEABLE' | 'MAINTENANCE_DUE' | 'CALIBRATION_DUE' | 'UNSERVICEABLE' | 'UNDER_REPAIR' | 'QUARANTINED_USE_PROHIBITED' | 'SURVEY_DISPOSAL_PENDING';
  locationDepartment: string;
  lastInspectionDate: string;
  nextMaintenanceDueDate: string;
  calibrationDueDate: string;
  warrantyExpiryDate?: string;
  defectDescription?: string;
  repairForwardingDate?: string;
  repairReference?: string;
  expectedReturnDate?: string;
  responsibleAppointment: string;
  remarks?: string;
  updatedAt: string;
}

export interface MonthlyMedicalAuditItem {
  id: string;
  itemType: 'MEDICINE' | 'INSTRUMENT' | 'EQUIPMENT';
  name: string;
  specOrModel: string;
  batchOrSerial: string;
  expiryDate?: string;
  expiryCategory?: ExpiryCategory;
  authorizedQty: number;
  systemQty: number;
  physicalQty: number;
  variance: number; // physicalQty - systemQty
  varianceReason?: string;
  remarks?: string;
}

export interface AuditSignatureBlock {
  appointment: 'Med NCO' | 'MOIC' | 'CO';
  signerName?: string;
  signerRank?: string;
  signerUserId?: string;
  signatureData?: string;
  signedAtDate?: string; // YYYY-MM-DD
  signedAtTime?: string; // HH:mm:ss
  status: 'PENDING' | 'SIGNED';
  version: string;
}

export interface MonthlyMedicalAuditReport {
  id: string;
  auditMonth: string; // YYYY-MM
  auditDate: string; // YYYY-MM-DD
  reportReference: string;
  items: MonthlyMedicalAuditItem[];
  totalMedicineItems: number;
  totalInstrumentItems: number;
  totalEquipmentItems: number;
  totalVariancesDetected: number;
  status: ApprovalStatus;
  preparedByAppointment: string;
  submittedAt?: string;
  moicAppointment?: string;
  moicDecision?: string;
  moicRemarks?: string;
  moicDecidedAt?: string;
  coAppointment?: string;
  coDecision?: string;
  coRemarks?: string;
  coDecidedAt?: string;
  // 3-Stage Signature Blocks
  medNcoSignature?: AuditSignatureBlock;
  moicSignature?: AuditSignatureBlock;
  coSignature?: AuditSignatureBlock;
  auditVersion?: string; // e.g. "v1.0", "v1.1 (Revised)"
  isRevised?: boolean;
  revisionHistory?: Array<{
    revisedAt: string;
    revisedBy: string;
    previousVersion: string;
    signaturesArchived: {
      medNco?: AuditSignatureBlock;
      moic?: AuditSignatureBlock;
      co?: AuditSignatureBlock;
    };
    reason?: string;
  }>;
  lockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeAttachment {
  id: string;
  name: string;
  type: string; // pdf, image/jpeg, image/png, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain, etc.
  size: number;
  dataUrl?: string;
  fileUrl?: string;
  isCloudStorage?: boolean;
}

export interface MiscellaneousNotice {
  id: string;
  referenceNo: string;
  title: string;
  category?: string; // 'General Order', 'Administrative Instruction', 'Medical Directive', 'Training Directive', 'Routine Notice', 'Emergency Memo'
  noticeDate?: string; // YYYY-MM-DD
  description: string;
  uploadDate: string; // YYYY-MM-DDTHH:mm:ss or ISO
  uploaderAppointment?: string;
  uploaderUserId?: string;
  uploaderName?: string;
  validUntil?: string; // YYYY-MM-DD
  attachments: NoticeAttachment[];
  status: 'PUBLISHED' | 'ARCHIVED' | 'DRAFT';
  isPublished: boolean;
  isArchived: boolean;
  coApprovedBy?: string;
  coApprovedAt?: string;
  coRemarks?: string;
  isCoApproved?: boolean;
  acknowledgements?: {
    userId: string;
    userAppointment: string;
    acknowledgedAt: string;
  }[];
  createdAt?: string;
  updatedAt?: string;
}

// Simplified Correction Request Structure (Direct to CO)
export type SimpleCorrectionStatus =
  | 'PENDING_CO'
  | 'CO_APPROVED_UNLOCKED'
  | 'CORRECTION_SUBMITTED'
  | 'CO_CONFIRMED_LOCKED'
  | 'REJECTED';

export interface CorrectionRequest {
  id: string;
  referenceNo: string;
  recordTypeOrDate: string; // e.g. "Parade State 2026-08-17" or "Medicine: Ceftriaxone"
  targetFieldName: string; // e.g. "Food Menu" or "Authorized Quantity"
  existingValue: string;
  proposedCorrectedValue: string;
  reason: string;
  attachmentName?: string;
  attachmentDataUrl?: string;
  requestedByUserId: string;
  requestedByAppointment: string;
  requestedAt: string;
  status: SimpleCorrectionStatus;
  coRemarks?: string;
  coDecidedAt?: string;
  correctedValueApplied?: string;
  coConfirmedAt?: string;
}

export interface SectionApprovalRecord {
  id: string;
  stateDate: string;
  section: string;
  sectionTitle: string;
  status: ApprovalStatus;
  version: string;
  submittedByAppointment?: string;
  submittedAt?: string;
  twoIcAppointment?: string;
  twoIcDecision?: string;
  twoIcRemarks?: string;
  twoIcDecidedAt?: string;
  intermediateAppointment?: string; // QM or MOIC
  intermediateDecision?: string;
  intermediateRemarks?: string;
  intermediateDecidedAt?: string;
  coAppointment?: string;
  coDecision?: string;
  coRemarks?: string;
  coDecidedAt?: string;
  lockedAt?: string;
  supersededById?: string;
}

export interface TrainingAcknowledgement {
  userId: string;
  userAppointment: string;
  acknowledgedAt: string;
}

export type TrainingCategory =
  | 'MEDICAL_AND_FIRST_AID'
  | 'FIRE_SAFETY_AND_EMERGENCY'
  | 'HYGIENE_AND_DISEASE_PREVENTION'
  | 'MT_AND_VEHICLE_SAFETY'
  | 'IT_AND_CYBER_AWARENESS'
  | 'ADMINISTRATIVE_PROCEDURES'
  | 'FIELD_MEDICAL_AND_CASEVAC'
  | 'FORMS_CHECKLISTS_AND_HANDOUTS';

export interface TrainingMaterial {
  id: string;
  title: string;
  category: TrainingCategory;
  categoryLabel: string;
  description: string;
  instructionText?: string;
  priority?: 'ROUTINE' | 'PRIORITY' | 'IMMEDIATE';
  issuingAuthority: string;
  uploadDate: string; // YYYY-MM-DD
  version: string;
  reviewDate?: string;
  isEmergencyQuickRef: boolean;
  accessLevel: 'ALL_PERSONNEL' | 'MEDICAL_ONLY' | 'OFFICERS_ONLY';
  attachments?: {
    id: string;
    fileName: string;
    fileType: 'pdf' | 'pptx' | 'docx' | 'image' | 'video_link';
    fileSize?: number;
    fileUrl?: string;
  }[];
  status: ApprovalStatus;
  isPublished: boolean;
  isArchived: boolean;
  uploaderAppointment: string;
  uploaderUserId: string;
  moicApprovedBy?: string;
  moicApprovedAt?: string;
  qmApprovedBy?: string;
  qmApprovedAt?: string;
  coApprovedBy?: string;
  coApprovedAt?: string;
  acknowledgements: TrainingAcknowledgement[];
  createdAt: string;
  updatedAt: string;
}

export interface UserDeactivationRequest {
  id: string;
  targetUserId: string;
  targetUserName?: string;
  targetUserAppointment: string;
  targetSection: string;
  effectiveDate: string; // YYYY-MM-DD
  reasonForLeaving: 'TRANSFER' | 'DISBANDMENT' | 'RETIREMENT' | 'DEPUTATION' | 'OTHER';
  replacementUserId?: string;
  replacementAppointment?: string;
  supportingRemarks: string;
  attachmentName?: string;
  status: 'PENDING_CO' | 'CO_APPROVED' | 'CO_REJECTED' | 'CO_RETURNED';
  recommendedByAppointment: string;
  recommendedAt: string;
  coAppointment?: string;
  coDecision?: string;
  coRemarks?: string;
  coDecidedAt?: string;
  isCompleted: boolean;
}

export interface DailySnapshotRecord {
  id: string;
  snapshotDate: string; // YYYY-MM-DD
  dayOfWeek: string;
  totalStrength: number;
  onParade: number;
  outUnit: number;
  cLeave: number;
  pLeave: number;
  medicalLeave: number;
  cmhAdmitted: number;
  tyAtt: number;
  courses: number;
  otherOut: number;
  activities: string[];
  medicalCover: string[];
  foodMenu: string;
  vehicleHeld: number;
  vehicleServiceable: number;
  medicineExpiredBatches: number;
  medicineCriticalShortDated: number;
  lockedAt: string;
  snapshotStatus: 'CO_APPROVED_LOCKED' | 'DRAFT';
}

export type AuditActionType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'DEVICE_REGISTERED'
  | 'DEVICE_ACTIVATED'
  | 'DEVICE_SUSPENDED'
  | 'DEVICE_REVOKED'
  | 'PIN_GENERATED'
  | 'PIN_RESET'
  | 'DRAFT_SAVED'
  | 'RECORD_SUBMITTED'
  | 'RECORD_VIEWED'
  | 'VIEWED'
  | '2IC_APPROVED'
  | '2IC_RETURNED'
  | '2IC_HELD'
  | 'QM_APPROVED'
  | 'QM_RETURNED'
  | 'MOIC_APPROVED'
  | 'MOIC_RETURNED'
  | 'CO_APPROVED'
  | 'CO_RETURNED'
  | 'ROSTER_PUBLISHED'
  | 'ROSTER_ACKNOWLEDGED'
  | 'DUTY_ROSTER_SAVED'
  | 'PARADE_STATE_SAVED'
  | 'PARADE_STATE_APPROVED'
  | 'NOTICE_UPLOADED'
  | 'NOTICE_APPROVED'
  | 'NOTICE_PUBLISHED'
  | 'NOTICE_ARCHIVED'
  | 'NOTICE_DELETED'
  | 'RECORD_DELETED'
  | 'RECORD_MODIFIED'
  | 'REVERSAL_ENTRY'
  | 'MEDICINE_ISSUED'
  | 'NOTICE_ACKNOWLEDGED'
  | 'MONTHLY_AUDIT_SAVED'
  | 'MONTHLY_AUDIT_SUBMITTED'
  | 'MONTHLY_AUDIT_APPROVED'
  | 'CORRECTION_REQUESTED'
  | 'CORRECTION_APPROVED'
  | 'CORRECTION_CONFIRMED'
  | 'PDF_GENERATED'
  | 'PDF_PRINTED'
  | 'EXCEL_EXPORTED'
  | 'RANK_UPDATED'
  | 'SECTION_UPDATED'
  | 'BACKUP_CREATED'
  | 'BACKUP_RESTORED'
  | 'SECURITY_VIOLATION_ATTEMPT'
  | 'USER_DEACTIVATION_RECOMMENDED'
  | 'USER_DEACTIVATION_APPROVED'
  | 'USER_DEACTIVATION_REJECTED'
  | 'USER_REACTIVATED'
  | 'TRAINING_MATERIAL_UPLOADED'
  | 'TRAINING_MATERIAL_UPDATED'
  | 'TRAINING_MATERIAL_DELETED'
  | 'TRAINING_MATERIAL_APPROVED'
  | 'TRAINING_MATERIAL_ACKNOWLEDGED'
  | 'GLOBAL_SEARCH_PERFORMED'
  | 'DAILY_SNAPSHOT_CREATED';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userAppointment: string;
  userRole: UserRole;
  section: string;
  deviceId: string;
  deviceName: string;
  actionType: AuditActionType;
  targetRecordRef: string;
  previousValueJson?: string;
  newValueJson?: string;
  remarks?: string;
  integrityHmac: string;
}

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  section: string;
  timestamp: string;
  isRead: boolean;
  targetPath?: string;
}

export interface SystemBackupRecord {
  id: string;
  backupReference: string;
  backupVersion: string;
  encryptedPayload: string;
  payloadSha256: string;
  createdByUserId: string;
  createdByAppointment: string;
  createdAt: string;
  backupType: 'MANUAL' | 'SCHEDULED_AUTO';
  totalRecordsCount: number;
  restoredAt?: string;
  restoredByUserId?: string;
}

