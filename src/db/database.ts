import Dexie, { Table } from 'dexie';
import {
  User,
  Device,
  RankItem,
  SectionItem,
  ParadeState,
  DutyRoster,
  RosterAcknowledgement,
  ManpowerDailyState,
  ManpowerPersonnel,
  VehicleDailyState,
  VehicleFleetItem,
  MedicineItem,
  MedicineBatch,
  MedicineTransaction,
  MedicalInstrumentItem,
  MedicalEquipmentItem,
  MonthlyMedicalAuditReport,
  MiscellaneousNotice,
  SectionApprovalRecord,
  CorrectionRequest,
  AuditLogEntry,
  InAppNotification,
  SystemBackupRecord,
  RankTradeDistributionItem,
  UserAuditLogEntry
} from '../types';
import {
  initialUsers,
  initialDevices,
  initialRanks,
  initialSections,
  initialParadeState,
  initialDutyRosters,
  initialManpowerState,
  initialPersonnel,
  initialVehicleState,
  initialVehicleFleet,
  initialMedicines,
  initialMedicineBatches,
  initialInstruments,
  initialEquipment,
  initialSectionApprovals,
  initialAuditLogs,
  initialNotifications,
  initialMonthlyAudits,
  initialMiscellaneousNotices,
  initialTrainingMaterials,
  initialDailySnapshots,
  initialRankTradeDistributions
} from './seedData';

export class UnitReadyDatabase extends Dexie {
  users!: Table<User, string>;
  devices!: Table<Device, string>;
  ranks!: Table<RankItem, string>;
  sections!: Table<SectionItem, string>;
  paradeStates!: Table<ParadeState, string>;
  dutyRosters!: Table<DutyRoster, string>;
  rosterAcknowledgements!: Table<RosterAcknowledgement, string>;
  manpowerDailyStates!: Table<ManpowerDailyState, string>;
  manpowerPersonnel!: Table<ManpowerPersonnel, string>;
  rankTradeDistributions!: Table<RankTradeDistributionItem, string>;
  vehicleDailyStates!: Table<VehicleDailyState, string>;
  vehicleFleetItems!: Table<VehicleFleetItem, string>;
  medicines!: Table<MedicineItem, string>;
  medicineBatches!: Table<MedicineBatch, string>;
  medicineTransactions!: Table<MedicineTransaction, string>;
  medicalInstruments!: Table<MedicalInstrumentItem, string>;
  medicalEquipment!: Table<MedicalEquipmentItem, string>;
  monthlyMedicalAudits!: Table<MonthlyMedicalAuditReport, string>;
  miscellaneousNotices!: Table<MiscellaneousNotice, string>;
  sectionApprovals!: Table<SectionApprovalRecord, string>;
  correctionRequests!: Table<CorrectionRequest, string>;
  auditLogs!: Table<AuditLogEntry, string>;
  notifications!: Table<InAppNotification, string>;
  backups!: Table<SystemBackupRecord, string>;
  trainingMaterials!: Table<any, string>;
  deactivationRequests!: Table<any, string>;
  dailySnapshots!: Table<any, string>;
  userAuditLogs!: Table<UserAuditLogEntry, string>;

  constructor() {
    super('UnitReady360_95FA_DB');

    this.version(6).stores({
      users: 'id, serviceNumber, armyNumberNormalized, appointmentTitle, role, sectionAssigned, userStatus, accountStatus',
      devices: 'id, deviceIdentifier, deviceName, status, assignedSectionCode, sixDigitPin',
      ranks: 'id, rankName, rankOrder, isActive',
      sections: 'id, sectionCode, sectionName, designatedOperatorRole',
      paradeStates: 'id, stateDate, status',
      dutyRosters: 'id, referenceNo, dutyDate, section, status, isPublished',
      rosterAcknowledgements: 'id, rosterId, userId, acknowledgedAt',
      manpowerDailyStates: 'id, stateDate, status',
      manpowerPersonnel: 'id, personalNumber, appointment, sectionCode, currentStatus',
      rankTradeDistributions: 'id, classification, tradeCode, categoryGroup, authCount, postedCount, presentCount, orderIndex',
      vehicleDailyStates: 'id, stateDate, status',
      vehicleFleetItems: 'id, registrationFleetRef, vehicleType, status',
      medicines: 'id, genericName, strength, dosageForm, expiryDate',
      medicineBatches: 'id, medicineId, batchNumber, expiryDate, status',
      medicineTransactions: 'id, issueId, transactionType, medicineId, batchNumber, issueDate, placeLocation, transactionTimestamp',
      medicalInstruments: 'id, instrumentSetName, category, location',
      medicalEquipment: 'id, equipmentName, category, serialNumber, currentStatus',
      monthlyMedicalAudits: 'id, auditMonth, auditDate, status',
      miscellaneousNotices: 'id, referenceNo, uploadDate, status, isPublished, isArchived',
      sectionApprovals: 'id, stateDate, section, status',
      correctionRequests: 'id, referenceNo, section, targetRecordRef, status',
      auditLogs: 'id, timestamp, userAppointment, actionType, section',
      notifications: 'id, timestamp, isRead, type, section',
      backups: 'id, backupReference, createdAt',
      trainingMaterials: 'id, category, uploadDate, status, isPublished, isArchived, isEmergencyQuickRef',
      deactivationRequests: 'id, targetUserId, status, recommendedAt',
      dailySnapshots: 'id, snapshotDate, snapshotStatus',
      userAuditLogs: 'id, armyNumber, actionType, timestamp, performedBy'
    });
  }
}

export const db = new UnitReadyDatabase();

export async function initializeDatabase(): Promise<void> {
  try {
    const usersCount = await db.users.count();
    if (usersCount === 0) {
      console.log('Initializing 95 Fd Amb Database with Seed Data (v5)...');

      await db.users.bulkPut(initialUsers);
      await db.devices.bulkPut(initialDevices);
      await db.ranks.bulkPut(initialRanks);
      await db.sections.bulkPut(initialSections);
      await db.paradeStates.put(initialParadeState);
      await db.dutyRosters.bulkPut(initialDutyRosters);
      await db.manpowerDailyStates.put(initialManpowerState);
      await db.manpowerPersonnel.bulkPut(initialPersonnel);
      await db.rankTradeDistributions.bulkPut(initialRankTradeDistributions);
      await db.vehicleDailyStates.put(initialVehicleState);
      await db.vehicleFleetItems.bulkPut(initialVehicleFleet);
      await db.medicines.bulkPut(initialMedicines);
      await db.medicineBatches.bulkPut(initialMedicineBatches);
      await db.medicalInstruments.bulkPut(initialInstruments);
      await db.medicalEquipment.bulkPut(initialEquipment);
      await db.monthlyMedicalAudits.bulkPut(initialMonthlyAudits);
      await db.miscellaneousNotices.bulkPut(initialMiscellaneousNotices);
      await db.sectionApprovals.bulkPut(initialSectionApprovals);
      await db.auditLogs.bulkPut(initialAuditLogs);
      await db.notifications.bulkPut(initialNotifications);
      await db.trainingMaterials.bulkPut(initialTrainingMaterials);
      await db.dailySnapshots.bulkPut(initialDailySnapshots);

      console.log('Database initialized successfully for 95 Fd Amb.');
    } else {
      // Safely ensure new tables have seed records if empty
      const rtdCount = await db.rankTradeDistributions.count();
      if (rtdCount === 0) {
        await db.rankTradeDistributions.bulkPut(initialRankTradeDistributions);
      }
      const tCount = await db.trainingMaterials.count();
      if (tCount === 0) {
        await db.trainingMaterials.bulkPut(initialTrainingMaterials);
      }
      const sCount = await db.dailySnapshots.count();
      if (sCount === 0) {
        await db.dailySnapshots.bulkPut(initialDailySnapshots);
      }
    }

    // Auto-purge any legacy demo user records from production IndexedDB
    const demoUserIds = ['usr-co', 'usr-2ic', 'usr-qm', 'usr-moic', 'usr-op-med', 'usr-op-vehicle', 'usr-op-manpower', 'usr-op-duty', 'usr-op-inst', 'usr-viewer'];
    const allDbUsers = await db.users.toArray();
    const demoUsersToDelete = allDbUsers.filter(u => 
      demoUserIds.includes(u.id) || 
      ['951001', '952002', '953003', '954004', '955005', '956006', '957007', '958008', '959009'].includes(u.loginCode || '') ||
      (u.fullName && (
        u.fullName.includes('Tariqul Anam') || 
        u.fullName.includes('Mahmudur Rahman') || 
        u.fullName.includes('Farhana Yesmin') || 
        u.fullName.includes('Asaduzzaman')
      ))
    );
    if (demoUsersToDelete.length > 0) {
      for (const dUser of demoUsersToDelete) {
        await db.users.delete(dUser.id);
      }
      console.log(`Purged ${demoUsersToDelete.length} legacy demo user account(s) from database.`);
    }
  } catch (error) {
    console.warn('Database initialization warning (safe to ignore if already populated):', error);
  }
}

/**
 * Backend/Database-level Duplicate Prevention for Individual Accounts
 * Ensures no two accounts can share the same BA / Personal / Army Number.
 */
export async function saveUserWithDuplicateCheck(
  userData: User
): Promise<{ success: boolean; error?: string; user?: User }> {
  const normArmy = (userData.armyNumberNormalized || userData.serviceNumber || '').replace(/\s+/g, '').toUpperCase();
  if (!normArmy) {
    return { success: false, error: 'Personal BA Number is mandatory.' };
  }

  // Database-level check across all users
  const existingUsers = await db.users.toArray();
  const duplicate = existingUsers.find(u => {
    const uNorm = (u.armyNumberNormalized || u.serviceNumber || '').replace(/\s+/g, '').toUpperCase();
    return uNorm === normArmy && u.id !== userData.id;
  });

  if (duplicate) {
    return {
      success: false,
      error: `Duplicate account prohibited: BA Number "${userData.serviceNumber}" is already registered to an account (${duplicate.rank || ''} ${duplicate.fullName || ''}).`
    };
  }

  await db.users.put(userData);
  return { success: true, user: userData };
}
