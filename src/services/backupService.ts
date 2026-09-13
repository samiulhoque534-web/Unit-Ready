// Web Crypto AES-GCM-256 Encrypted Backup & Restore Service for 95 Fd Amb

import { User, SystemBackupRecord } from '../types';
import { db } from '../db/database';
import { logAuditEvent } from './auditService';

export async function createEncryptedBackup(
  user: User, 
  passphrase: string = '95FA-UNIT-READY-SECURE-KEY'
): Promise<{ filename: string; blob: Blob }> {
  // Collect all tables
  const backupData = {
    metadata: {
      unit: '95 Fd Amb',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: user.appointmentTitle,
      exportedByRole: user.role
    },
    tables: {
      users: await db.users.toArray(),
      devices: await db.devices.toArray(),
      ranks: await db.ranks.toArray(),
      sections: await db.sections.toArray(),
      paradeStates: await db.paradeStates.toArray(),
      dutyRosters: await db.dutyRosters.toArray(),
      rosterAcknowledgements: await db.rosterAcknowledgements.toArray(),
      manpowerDailyStates: await db.manpowerDailyStates.toArray(),
      manpowerPersonnel: await db.manpowerPersonnel.toArray(),
      vehicleDailyStates: await db.vehicleDailyStates.toArray(),
      vehicleFleetItems: await db.vehicleFleetItems.toArray(),
      medicines: await db.medicines.toArray(),
      medicineBatches: await db.medicineBatches.toArray(),
      medicineTransactions: await db.medicineTransactions.toArray(),
      monthlyMedicalAudits: await db.monthlyMedicalAudits.toArray(),
      miscellaneousNotices: await db.miscellaneousNotices.toArray(),
      medicalInstruments: await db.medicalInstruments.toArray(),
      medicalEquipment: await db.medicalEquipment.toArray(),
      sectionApprovals: await db.sectionApprovals.toArray(),
      correctionRequests: await db.correctionRequests.toArray(),
      auditLogs: await db.auditLogs.toArray()
    }
  };

  const jsonString = JSON.stringify(backupData);
  const totalCount = Object.values(backupData.tables).reduce((acc, curr) => acc + curr.length, 0);

  // Encrypt using Web Crypto API (AES-GCM-256)
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encryptedContent = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(jsonString)
  );

  // Calculate SHA-256 checksum of the payload
  const hashBuffer = await crypto.subtle.digest('SHA-256', encryptedContent);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const payloadSha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Pack into base64 payload structure
  const saltB64 = btoa(String.fromCharCode(...salt));
  const ivB64 = btoa(String.fromCharCode(...iv));
  const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(encryptedContent)));

  const finalPayload = JSON.stringify({
    salt: saltB64,
    iv: ivB64,
    ciphertext: cipherB64,
    sha256: payloadSha256,
    version: '1.0',
    unit: '95 Fd Amb'
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRef = `95FA-BAK-${timestamp}`;
  const filename = `95FA_UNIT_READY_360_${timestamp}.bak`;

  const backupRecord: SystemBackupRecord = {
    id: 'bak-' + Date.now(),
    backupReference: backupRef,
    backupVersion: '1.0',
    encryptedPayload: finalPayload,
    payloadSha256,
    createdByUserId: user.id,
    createdByAppointment: user.appointmentTitle,
    createdAt: new Date().toISOString(),
    backupType: 'MANUAL',
    totalRecordsCount: totalCount
  };

  await db.backups.add(backupRecord);
  await logAuditEvent(
    user,
    'BACKUP_CREATED',
    'all',
    backupRef,
    `Created AES-256 encrypted local backup with ${totalCount} records. SHA-256: ${payloadSha256.substring(0, 16)}...`
  );

  const blob = new Blob([JSON.stringify(backupRecord, null, 2)], { type: 'application/octet-stream' });
  return { filename, blob };
}

export async function restoreEncryptedBackup(
  user: User,
  backupRecord: SystemBackupRecord,
  passphrase: string = '95FA-UNIT-READY-SECURE-KEY'
): Promise<{ success: boolean; message: string; recordCount?: number }> {
  try {
    const payloadObj = JSON.parse(backupRecord.encryptedPayload);
    const salt = Uint8Array.from(atob(payloadObj.salt), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(payloadObj.iv), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(payloadObj.ciphertext), c => c.charCodeAt(0));

    // Verify SHA-256 Checksum
    const hashBuffer = await crypto.subtle.digest('SHA-256', ciphertext);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const calculatedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (calculatedHash !== payloadObj.sha256 || calculatedHash !== backupRecord.payloadSha256) {
      await logAuditEvent(user, 'SECURITY_VIOLATION_ATTEMPT', 'all', backupRecord.backupReference, 'Backup restore failed: SHA-256 checksum mismatch!');
      return { success: false, message: 'INTEGRITY ERROR: SHA-256 Checksum mismatch. The backup file may be corrupted or tampered with.' };
    }

    // Decrypt
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    const decryptedJson = dec.decode(decryptedBuffer);
    const restoredData = JSON.parse(decryptedJson);

    // Atomic Restore
    await db.transaction('rw', [
      db.users, db.devices, db.ranks, db.sections, db.paradeStates,
      db.dutyRosters, db.manpowerDailyStates, db.manpowerPersonnel, db.vehicleDailyStates, db.vehicleFleetItems,
      db.medicines, db.medicineBatches, db.medicalInstruments, db.medicalEquipment, db.sectionApprovals,
      db.monthlyMedicalAudits, db.miscellaneousNotices
    ], async () => {
      if (restoredData.tables.users) await db.users.bulkPut(restoredData.tables.users);
      if (restoredData.tables.ranks) await db.ranks.bulkPut(restoredData.tables.ranks);
      if (restoredData.tables.sections) await db.sections.bulkPut(restoredData.tables.sections);
      if (restoredData.tables.paradeStates) await db.paradeStates.bulkPut(restoredData.tables.paradeStates);
      if (restoredData.tables.dutyRosters) await db.dutyRosters.bulkPut(restoredData.tables.dutyRosters);
      if (restoredData.tables.manpowerDailyStates) await db.manpowerDailyStates.bulkPut(restoredData.tables.manpowerDailyStates);
      if (restoredData.tables.manpowerPersonnel) await db.manpowerPersonnel.bulkPut(restoredData.tables.manpowerPersonnel);
      if (restoredData.tables.vehicleDailyStates) await db.vehicleDailyStates.bulkPut(restoredData.tables.vehicleDailyStates);
      if (restoredData.tables.vehicleFleetItems) await db.vehicleFleetItems.bulkPut(restoredData.tables.vehicleFleetItems);
      if (restoredData.tables.medicines) await db.medicines.bulkPut(restoredData.tables.medicines);
      if (restoredData.tables.medicineBatches) await db.medicineBatches.bulkPut(restoredData.tables.medicineBatches);
      if (restoredData.tables.monthlyMedicalAudits) await db.monthlyMedicalAudits.bulkPut(restoredData.tables.monthlyMedicalAudits);
      if (restoredData.tables.miscellaneousNotices) await db.miscellaneousNotices.bulkPut(restoredData.tables.miscellaneousNotices);
      if (restoredData.tables.medicalInstruments) await db.medicalInstruments.bulkPut(restoredData.tables.medicalInstruments);
      if (restoredData.tables.medicalEquipment) await db.medicalEquipment.bulkPut(restoredData.tables.medicalEquipment);
      if (restoredData.tables.sectionApprovals) await db.sectionApprovals.bulkPut(restoredData.tables.sectionApprovals);
    });

    await logAuditEvent(
      user,
      'BACKUP_RESTORED',
      'all',
      backupRecord.backupReference,
      `Successfully verified SHA-256 and restored database from ${backupRecord.backupReference}.`
    );

    return { success: true, message: 'Backup verified and restored successfully.', recordCount: backupRecord.totalRecordsCount };
  } catch (err: any) {
    return { success: false, message: `Decryption or restore failed: ${err.message}` };
  }
}
