import { db } from '../db/database';

declare global {
  interface Window {
    firebase?: any;
  }
}

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBQWoxI545CsYsZeGEwHd8_Ji20CDUHOmo",
  authDomain: "unit-ready-360.firebaseapp.com",
  projectId: "unit-ready-360",
  storageBucket: "unit-ready-360.firebasestorage.app",
  messagingSenderId: "190829560868",
  appId: "1:190829560868:web:a9cfaec420961bff2344b1",
  measurementId: "G-DQ7WYPLBFL"
};

let firestoreInstance: any = null;
let storageInstance: any = null;
let isInitialized = false;

// Collections to sync in real-time
const SYNC_COLLECTIONS = [
  'dutyRosters',
  'paradeStates',
  'manpowerPersonnel',
  'rankTradeDistributions',
  'vehicleDailyStates',
  'vehicleFleetItems',
  'medicines',
  'medicineBatches',
  'medicalInstruments',
  'medicalEquipment',
  'miscellaneousNotices',
  'trainingMaterials',
  'sectionApprovals',
  'correctionRequests',
  'notifications',
  'users',
  'medicineTransactions',
  'monthlyMedicalAudits',
  'userAuditLogs'
];

export function initFirebaseSync(): void {
  if (isInitialized) return;
  if (typeof window === 'undefined') return;

  if (window.firebase) {
    try {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(FIREBASE_CONFIG);
      }
      firestoreInstance = window.firebase.firestore();
      try {
        storageInstance = window.firebase.storage();
      } catch (stErr) {
        console.warn('Firebase Storage init notice:', stErr);
      }
      isInitialized = true;
      console.log('⚡ Firebase Cloud Firestore & Storage Initialized for:', FIREBASE_CONFIG.projectId);

      setupRealtimeListeners();
      seedInitialCloudData();
    } catch (err) {
      console.warn('Firebase initialization notice (running in offline-ready mode):', err);
    }
  } else {
    // Retry in 1 second if CDN is still loading
    setTimeout(initFirebaseSync, 1000);
  }
}

function setupRealtimeListeners(): void {
  if (!firestoreInstance) return;

  SYNC_COLLECTIONS.forEach(collectionName => {
    try {
      firestoreInstance.collection(`unit360_${collectionName}`).onSnapshot(
        async (snapshot: any) => {
          if (snapshot && !snapshot.empty) {
            const table = (db as any)[collectionName];
            if (!table) return;

            const changes = snapshot.docChanges();
            const tasks = changes.map(async (change: any) => {
              const data = change.doc.data();
              if (change.type === 'added' || change.type === 'modified') {
                try {
                  await table.put(data);
                } catch (e) {
                  // Ignore minor collision
                }
              } else if (change.type === 'removed') {
                try {
                  await table.delete(change.doc.id);
                } catch (e) {
                  // Ignore
                }
              }
            });

            await Promise.all(tasks);
            console.log(`[REALTIME CLOUD SYNC] Applied ${changes.length} updates for ${collectionName}`);
            window.dispatchEvent(new CustomEvent('unit-ready-cloud-sync', { detail: { collection: collectionName } }));
          }
        },
        (err: any) => {
          console.warn(`Firestore listener notice for ${collectionName}:`, err.message);
        }
      );
    } catch (e) {
      console.warn(`Error attaching listener for ${collectionName}:`, e);
    }
  });
}

export async function syncEntityToCloud(collectionName: string, idOrData: string | any, maybeData?: any): Promise<void> {
  if (!firestoreInstance) return;
  try {
    let id: string;
    let data: any;

    if (typeof idOrData === 'string') {
      id = idOrData;
      data = maybeData !== undefined ? maybeData : {};
    } else {
      data = idOrData || {};
      id = data.id || `doc_${Date.now()}`;
    }

    const cleanData = JSON.parse(JSON.stringify(data));

    // If attachments contain huge base64 strings (>700KB), truncate cloud payload so Firestore 1MB doc limit is not exceeded
    if (cleanData.attachments && Array.isArray(cleanData.attachments)) {
      cleanData.attachments = cleanData.attachments.map((att: any) => {
        if (att.fileUrl && att.fileUrl.startsWith('data:') && att.fileUrl.length > 700000) {
          return {
            ...att,
            fileUrl: '#offline_local_storage',
            isOfflineStored: true
          };
        }
        return att;
      });
    }

    await firestoreInstance.collection(`unit360_${collectionName}`).doc(id).set(cleanData, { merge: true });
    console.log(`[CLOUD SYNC] Synced ${collectionName}/${id} to Cloud Firestore.`);
  } catch (err) {
    console.warn(`[CLOUD SYNC NOTICE] Failed to sync ${collectionName}:`, err);
  }
}

export async function deleteEntityFromCloud(collectionName: string, id: string): Promise<void> {
  if (!firestoreInstance) return;
  try {
    await firestoreInstance.collection(`unit360_${collectionName}`).doc(id).delete();
    console.log(`[CLOUD SYNC] Deleted ${collectionName}/${id} from Cloud Firestore.`);
  } catch (err) {
    console.warn(`[CLOUD SYNC NOTICE] Failed to delete ${collectionName}/${id}:`, err);
  }
}

/**
 * Upload a real document or image to Firebase Storage with automatic DataURL fallback
 */
export async function uploadFileToFirebaseStorage(
  file: File,
  folder: string = 'training_documents',
  onProgress?: (percent: number) => void
): Promise<{ url: string; fileName: string; fileSize: number; fileType: string; isCloudStorage?: boolean }> {
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${Date.now()}_${cleanFileName}`;

  // Try Firebase Storage first
  if (storageInstance) {
    try {
      const storageRef = storageInstance.ref(path);
      const uploadTask = storageRef.put(file, { contentType: file.type || 'application/octet-stream' });

      const url = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot: any) => {
            if (onProgress && snapshot.totalBytes > 0) {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              onProgress(progress);
            }
          },
          (error: any) => {
            console.warn('Firebase Storage upload error:', error);
            reject(error);
          },
          async () => {
            const downloadUrl = await uploadTask.snapshot.ref.getDownloadURL();
            if (onProgress) onProgress(100);
            resolve(downloadUrl);
          }
        );
      });

      console.log('✅ File uploaded to Firebase Cloud Storage:', url);
      return {
        url,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        isCloudStorage: true
      };
    } catch (storageErr) {
      console.warn('Firebase Storage not active yet, using local document repository fallback:', storageErr);
    }
  }

  // Fallback: Convert to Base64 Data URL (guaranteed offline and local browser viewable)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (onProgress) onProgress(100);
      resolve({
        url: reader.result as string,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        isCloudStorage: false
      });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Verify individual user access code against Cloud Firestore & local DB
 */
export async function verifyUserLoginCode(
  role: string,
  enteredCode: string,
  appointmentTitle?: string,
  personnelIdOrName?: string
): Promise<{ success: boolean; user?: any; message: string }> {
  const cleanCode = (enteredCode || '').trim();
  if (!cleanCode) {
    return { success: false, message: 'Please enter your unique 6-digit individual access code.' };
  }

  // Check Firestore first if online
  if (firestoreInstance) {
    try {
      const snap = await firestoreInstance.collection('unit360_users').get();
      if (!snap.empty) {
        let matchedDoc: any = null;
        snap.forEach((doc: any) => {
          const u = doc.data();
          // Match by unique individual access code
          if (u.loginCode === cleanCode || u.pin === cleanCode) {
            matchedDoc = u;
          }
        });

        if (matchedDoc) {
          if (matchedDoc.isActive === false || matchedDoc.userStatus === 'DEACTIVATED' || matchedDoc.userStatus === 'REVOKED') {
            return { 
              success: false, 
              message: 'Account deactivated. Access denied. Contact Commanding Officer for reactivation.' 
            };
          }
          // Update last login
          const now = new Date().toISOString();
          await firestoreInstance.collection('unit360_users').doc(matchedDoc.id).set({ lastLoginAt: now }, { merge: true });
          return { 
            success: true, 
            user: { ...matchedDoc, lastLoginAt: now }, 
            message: 'Authentication successful.' 
          };
        }
      }
    } catch (e) {
      console.warn('Cloud auth check notice, falling back to local DB:', e);
    }
  }

  // Check Local DB
  const localUsers = await db.users.toArray();
  const matchedUser = localUsers.find(u => (u as any).loginCode === cleanCode || (u as any).pin === cleanCode);

  if (matchedUser) {
    if (matchedUser.isActive === false || matchedUser.userStatus === 'DEACTIVATED' || matchedUser.userStatus === 'REVOKED') {
      return { 
        success: false, 
        message: 'Account deactivated. Access denied. Contact Commanding Officer for reactivation.' 
      };
    }
    const now = new Date().toISOString();
    await db.users.update(matchedUser.id, { lastLoginAt: now });
    return { 
      success: true, 
      user: { ...matchedUser, lastLoginAt: now }, 
      message: 'Authentication successful.' 
    };
  }

  return { success: false, message: 'Invalid access code. Please check your individual 6-digit code.' };
}

async function seedInitialCloudData(): Promise<void> {
  if (!firestoreInstance) return;

  for (const collectionName of SYNC_COLLECTIONS) {
    try {
      const snap = await firestoreInstance.collection(`unit360_${collectionName}`).limit(1).get();
      if (snap.empty) {
        const table = (db as any)[collectionName];
        if (table) {
          const localItems = await table.toArray();
          if (localItems.length > 0) {
            const batch = firestoreInstance.batch();
            localItems.forEach((item: any) => {
              if (item.id) {
                const docRef = firestoreInstance.collection(`unit360_${collectionName}`).doc(item.id);
                batch.set(docRef, JSON.parse(JSON.stringify(item)));
              }
            });
            await batch.commit();
            console.log(`[CLOUD SEED] Uploaded initial ${localItems.length} records for ${collectionName}`);
          }
        }
      }
    } catch (err) {
      console.warn(`[CLOUD SEED NOTICE] ${collectionName}:`, err);
    }
  }
}
