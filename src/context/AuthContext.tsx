import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Device, UserRole, UserAuditLogEntry, ManpowerPersonnel } from '../types';
import { initialUsers, initialDevices } from '../db/seedData';
import { db } from '../db/database';
import { logAuditEvent } from '../services/auditService';
import { verifyUserLoginCode, syncEntityToCloud } from '../services/firebaseSyncService';

export interface RoleConfig {
  role: UserRole;
  label: string;
  appointment: string;
  concernedModule: string;
}

interface AuthContextType {
  currentUser: User;
  user: User;
  activeDevice: Device;
  isDeviceAuthorized: boolean;
  isLoggedIn: boolean;
  loginWithIndividualCode: (
    role: UserRole,
    loginCode: string,
    operatorDetails?: { appointmentTitle?: string; fullName?: string; rank?: string; serviceNumber?: string }
  ) => Promise<{ success: boolean; message: string }>;
  loginGeneralUser: (
    armyNumber: string,
    pin: string
  ) => Promise<{ success: boolean; message: string }>;
  registerGeneralUser: (data: {
    armyNumber: string;
    rank: string;
    fullName: string;
    subUnitCompany: string;
    pin: string;
  }) => Promise<{ success: boolean; message: string; user?: User }>;
  loginAsGeneralViewer: () => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  activateDeviceWithPin: (pin: string) => Promise<{ success: boolean; message: string }>;
  checkDeviceStatus: () => Promise<boolean>;
  createPersonnelAccount: (user: Partial<User>) => Promise<{ success: boolean; user?: User; message: string }>;
  resetPersonnelAccessCode: (userId: string) => Promise<{ success: boolean; newCode?: string; message: string }>;
  togglePersonnelAccountStatus: (userId: string, targetStatus: 'ACTIVE' | 'DEACTIVATED') => Promise<{ success: boolean; message: string }>;
  availableRoles: RoleConfig[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const savedUserRole = (localStorage.getItem('95fa_user_role') as UserRole) || 'co';
  const savedIsLoggedIn = localStorage.getItem('95fa_is_logged_in') === 'true';
  const savedUserId = localStorage.getItem('95fa_user_id');

  // 5 Official Authorized Roles
  const availableRoles: RoleConfig[] = [
    { role: 'co', label: 'Commanding Officer (CO)', appointment: 'Commanding Officer (CO)', concernedModule: 'All Sections (Final Command Authority & User Access Control)' },
    { role: '2ic', label: 'Second-in-Command (2IC)', appointment: 'Second-in-Command (2IC)', concernedModule: 'All Sections (Verification & Executive Oversight)' },
    { role: 'moic', label: 'Medical Officer In-Charge (MOIC)', appointment: 'Medical Officer In-Charge (MOIC)', concernedModule: 'Medical Store & Clinical Logistics' },
    { role: 'qm', label: 'Quartermaster (QM)', appointment: 'Quartermaster (QM)', concernedModule: 'Logistics, MT, Manpower & Material Readiness' },
    { role: 'other_operator', label: 'Other Operator', appointment: 'Unit Section Operator', concernedModule: 'Assigned Operational Section (Medicine / MT / Manpower / Duty / Instruments)' }
  ];

  const defaultUser = initialUsers.find(u => u.role === savedUserRole) || initialUsers[0];

  const [currentUser, setCurrentUser] = useState<User>(defaultUser);
  const [activeDevice, setActiveDevice] = useState<Device>(initialDevices[0]);
  const [isDeviceAuthorized, setIsDeviceAuthorized] = useState<boolean>(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(savedIsLoggedIn);

  const checkDeviceStatus = async (): Promise<boolean> => {
    const devices = await db.devices.toArray();
    const active = devices.find(d => !d.revokedStatus && d.status === 'ACTIVE');
    if (active) {
      setActiveDevice(active);
      setIsDeviceAuthorized(true);
      return true;
    }
    return false;
  };

  useEffect(() => {
    const syncUser = async () => {
      if (savedUserId) {
        const found = await db.users.get(savedUserId);
        if (found) {
          setCurrentUser(found);
          return;
        }
      }
      if (savedUserRole) {
        const dbUser = await db.users.where('role').equals(savedUserRole).first();
        if (dbUser) {
          setCurrentUser(dbUser);
        }
      }
    };
    syncUser();
  }, [savedUserRole, savedUserId]);

  /**
   * Secure Individual Login with Unique Generated Access Code (CO, 2IC, MOIC, QM, Operators)
   */
  const loginWithIndividualCode = async (
    role: UserRole,
    loginCode: string,
    operatorDetails?: { appointmentTitle?: string; fullName?: string; rank?: string; serviceNumber?: string }
  ): Promise<{ success: boolean; message: string }> => {
    if (role === 'general_viewer') {
      return loginAsGeneralViewer();
    }

    const cleanCode = (loginCode || '').trim();
    if (!cleanCode) {
      return { success: false, message: 'Please enter your individual access code.' };
    }

    const searchRole = role === 'other_operator' ? 'other_operator' : role;
    const authResult = await verifyUserLoginCode(
      searchRole, 
      cleanCode, 
      operatorDetails?.appointmentTitle, 
      operatorDetails?.serviceNumber || operatorDetails?.fullName
    );

    if (authResult.success && authResult.user) {
      const user = authResult.user;
      if (operatorDetails?.appointmentTitle) {
        user.appointmentTitle = operatorDetails.appointmentTitle;
      }
      if (operatorDetails?.fullName) {
        user.fullName = operatorDetails.fullName;
      }
      if (operatorDetails?.rank) {
        user.rank = operatorDetails.rank;
      }
      if (operatorDetails?.serviceNumber) {
        user.serviceNumber = operatorDetails.serviceNumber;
      }

      setCurrentUser(user);
      setIsLoggedIn(true);
      setIsDeviceAuthorized(true);
      localStorage.setItem('95fa_user_role', user.role);
      localStorage.setItem('95fa_user_id', user.id);
      localStorage.setItem('95fa_is_logged_in', 'true');

      // Log in userAuditLogs
      if (db.userAuditLogs) {
        await db.userAuditLogs.add({
          id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          armyNumber: user.serviceNumber,
          rank: user.rank,
          name: user.fullName,
          userId: user.id,
          timestamp: new Date().toISOString(),
          actionType: 'LOGIN',
          performedBy: 'User',
          details: `Command/Operator login verified for ${user.appointmentTitle}.`
        });
      }

      await logAuditEvent(
        user,
        'LOGIN_SUCCESS',
        'auth',
        user.appointmentTitle,
        `Individual verified login for ${user.rank || ''} ${user.fullName || user.appointmentTitle} (Role: ${user.role}).`
      );

      return {
        success: true,
        message: `Welcome, ${user.rank ? user.rank + ' ' : ''}${user.fullName || user.appointmentTitle}. Login verified.`
      };
    }

    // Check Local Seed Users fallback
    const localUsers = await db.users.toArray();
    const localUser = localUsers.find(u => 
      (u.loginCode === cleanCode || u.pin === cleanCode)
    ) || initialUsers.find(u => (u.loginCode === cleanCode || u.pin === cleanCode));

    if (localUser) {
      if (localUser.isActive === false || localUser.userStatus === 'DEACTIVATED' || localUser.accountStatus === 'DEACTIVATED') {
        return {
          success: false,
          message: 'Account deactivated. Access denied. Contact Commanding Officer for reactivation.'
        };
      }
      if (localUser.accountStatus === 'SUSPENDED') {
        return {
          success: false,
          message: 'Account suspended by Commanding Officer. Access denied.'
        };
      }

      const activeUser: User = {
        ...localUser,
        appointmentTitle: operatorDetails?.appointmentTitle || localUser.appointmentTitle,
        fullName: operatorDetails?.fullName || localUser.fullName,
        rank: operatorDetails?.rank || localUser.rank,
        serviceNumber: operatorDetails?.serviceNumber || localUser.serviceNumber,
        lastLoginAt: new Date().toISOString()
      };

      setCurrentUser(activeUser);
      setIsLoggedIn(true);
      setIsDeviceAuthorized(true);
      localStorage.setItem('95fa_user_role', activeUser.role);
      localStorage.setItem('95fa_user_id', activeUser.id);
      localStorage.setItem('95fa_is_logged_in', 'true');

      if (db.userAuditLogs) {
        await db.userAuditLogs.add({
          id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          armyNumber: activeUser.serviceNumber,
          rank: activeUser.rank,
          name: activeUser.fullName,
          userId: activeUser.id,
          timestamp: new Date().toISOString(),
          actionType: 'LOGIN',
          performedBy: 'User',
          details: `Local seed login for ${activeUser.appointmentTitle}.`
        });
      }

      await logAuditEvent(
        activeUser,
        'LOGIN_SUCCESS',
        'auth',
        activeUser.appointmentTitle,
        `Verified individual login for ${activeUser.appointmentTitle}.`
      );

      return {
        success: true,
        message: `Welcome, ${activeUser.appointmentTitle}. Login verified.`
      };
    }

    if (db.userAuditLogs) {
      await db.userAuditLogs.add({
        id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        armyNumber: operatorDetails?.serviceNumber || 'UNKNOWN',
        rank: operatorDetails?.rank,
        name: operatorDetails?.fullName,
        timestamp: new Date().toISOString(),
        actionType: 'FAILED_LOGIN',
        performedBy: 'System',
        details: `Invalid access code attempt for role ${role}.`
      });
    }

    await logAuditEvent(
      currentUser,
      'LOGIN_FAILED',
      'auth',
      role,
      `Invalid individual access code attempt.`
    );

    return {
      success: false,
      message: authResult.message || 'Invalid access code. Please check your individual access code.'
    };
  };

  /**
   * Individual General User Registration with Cross-Check against manpowerPersonnel
   */
  const registerGeneralUser = async (data: {
    armyNumber: string;
    rank: string;
    fullName: string;
    subUnitCompany: string;
    pin: string;
  }): Promise<{ success: boolean; message: string; user?: User }> => {
    const rawArmy = (data.armyNumber || '').trim();
    if (!rawArmy) {
      return { success: false, message: 'Army Number is mandatory.' };
    }
    const cleanPin = (data.pin || '').trim();
    if (!cleanPin || cleanPin.length < 4) {
      return { success: false, message: 'Please set a secure PIN (at least 4 digits).' };
    }

    const normalizedArmy = rawArmy.replace(/\s+/g, '').toUpperCase();

    // 1. Duplicate Prevention (case-insensitive, space-insensitive)
    const allUsers = await db.users.toArray();
    const duplicate = allUsers.find(u => {
      const uNorm = (u.armyNumberNormalized || u.serviceNumber || '').replace(/\s+/g, '').toUpperCase();
      return uNorm === normalizedArmy;
    });

    if (duplicate) {
      return {
        success: false,
        message: `An account for Army Number "${rawArmy}" already exists. Please login or contact Commanding Officer.`
      };
    }

    // 2. Cross-check against Manpower Personnel Database
    const personnel = await db.manpowerPersonnel.toArray();
    const matchedPersonnel = personnel.find(p => {
      const pNorm = (p.baNo || p.personalNumber || '').replace(/\s+/g, '').toUpperCase();
      return pNorm === normalizedArmy;
    });

    const isVerified = Boolean(matchedPersonnel);
    const resolvedRank = data.rank || matchedPersonnel?.rank || 'Personnel';
    const resolvedName = data.fullName || matchedPersonnel?.name || 'Unit Soldier';

    // Set accountStatus: Verified accounts can be active or pending CO review.
    // If verified against unit roll -> ACTIVE; If not found in roll -> PENDING CO approval.
    const accountStatus: 'ACTIVE' | 'PENDING' = isVerified ? 'ACTIVE' : 'PENDING';
    const verificationNotes = isVerified
      ? `Verified match against unit manpower roll (${matchedPersonnel?.trade || 'Personnel'}, Appt: ${matchedPersonnel?.appointment || 'N/A'})`
      : 'Unmatched in manpower database. Held for CO verification.';

    const nowIso = new Date().toISOString();
    const newUser: User = {
      id: `usr-gen-${Date.now()}`,
      serviceNumber: rawArmy,
      armyNumberNormalized: normalizedArmy,
      rank: resolvedRank,
      fullName: resolvedName,
      subUnitCompany: data.subUnitCompany || 'HQ Company',
      appointmentTitle: `${resolvedRank} ${resolvedName}`,
      role: 'general_personnel',
      sectionAssigned: 'all',
      accountStatus: accountStatus,
      registrationDate: nowIso,
      identityVerified: isVerified,
      verificationNotes: verificationNotes,
      failedLoginAttempts: 0,
      isActive: accountStatus === 'ACTIVE',
      userStatus: accountStatus === 'ACTIVE' ? 'ACTIVE' : 'DEACTIVATED',
      loginCode: cleanPin,
      pin: cleanPin,
      lastLoginAt: 'Never logged in'
    };

    await db.users.add(newUser);
    await syncEntityToCloud('users', newUser.id, newUser);

    // Record in userAuditLogs
    if (db.userAuditLogs) {
      await db.userAuditLogs.add({
        id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        armyNumber: rawArmy,
        rank: resolvedRank,
        name: resolvedName,
        userId: newUser.id,
        timestamp: nowIso,
        actionType: 'REGISTRATION',
        performedBy: 'User',
        details: `General user self-registration. Database match: ${isVerified ? 'YES' : 'NO'}. Status: ${accountStatus}. Notes: ${verificationNotes}`
      });
    }

    await logAuditEvent(
      newUser,
      'DEVICE_REGISTERED',
      'auth',
      newUser.appointmentTitle,
      `General user registration for ${rawArmy} (${resolvedRank} ${resolvedName}). Status: ${accountStatus}.`
    );

    return {
      success: true,
      user: newUser,
      message: isVerified
        ? `Account registered and verified against unit roll. You can now login.`
        : `Account created. Because your Army Number was not found in the active unit roll, your account is PENDING approval by the Commanding Officer.`
    };
  };

  /**
   * Individual General User Login with Army Number & PIN
   */
  const loginGeneralUser = async (
    armyNumber: string,
    pin: string
  ): Promise<{ success: boolean; message: string }> => {
    const rawArmy = (armyNumber || '').trim();
    const cleanPin = (pin || '').trim();

    if (!rawArmy || !cleanPin) {
      return { success: false, message: 'Please enter both Army Number and PIN.' };
    }

    const normalizedArmy = rawArmy.replace(/\s+/g, '').toUpperCase();
    const allUsers = await db.users.toArray();
    const user = allUsers.find(u => {
      const uNorm = (u.armyNumberNormalized || u.serviceNumber || '').replace(/\s+/g, '').toUpperCase();
      return uNorm === normalizedArmy;
    });

    if (!user) {
      if (db.userAuditLogs) {
        await db.userAuditLogs.add({
          id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          armyNumber: rawArmy,
          timestamp: new Date().toISOString(),
          actionType: 'FAILED_LOGIN',
          performedBy: 'System',
          details: `Login attempt failed: Army Number ${rawArmy} not registered.`
        });
      }
      return { success: false, message: `Army Number "${rawArmy}" is not registered. Please register first.` };
    }

    // Verify PIN
    const isValidPin = user.pin === cleanPin || user.loginCode === cleanPin;
    if (!isValidPin) {
      if (db.userAuditLogs) {
        await db.userAuditLogs.add({
          id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          armyNumber: user.serviceNumber,
          rank: user.rank,
          name: user.fullName,
          userId: user.id,
          timestamp: new Date().toISOString(),
          actionType: 'FAILED_LOGIN',
          performedBy: 'System',
          details: 'Incorrect PIN entered.'
        });
      }
      return { success: false, message: 'Invalid PIN entered. Please check your credentials.' };
    }

    // Check Account Status
    if (user.accountStatus === 'PENDING') {
      return {
        success: false,
        message: 'Your account is PENDING approval by the Commanding Officer. Access will be granted once verified by the CO.'
      };
    }

    if (user.accountStatus === 'SUSPENDED') {
      return {
        success: false,
        message: 'Your account is currently SUSPENDED by the Commanding Officer. Access denied.'
      };
    }

    if (user.accountStatus === 'DEACTIVATED' || user.isActive === false) {
      return {
        success: false,
        message: 'Your account has been DEACTIVATED. Contact the Commanding Officer for reactivation.'
      };
    }

    // Successful Login
    const nowIso = new Date().toISOString();
    await db.users.update(user.id, {
      lastLoginAt: nowIso,
      lastActivityAt: nowIso
    });

    const activeUser: User = {
      ...user,
      lastLoginAt: nowIso,
      lastActivityAt: nowIso
    };

    setCurrentUser(activeUser);
    setIsLoggedIn(true);
    setIsDeviceAuthorized(true);
    localStorage.setItem('95fa_user_role', activeUser.role);
    localStorage.setItem('95fa_user_id', activeUser.id);
    localStorage.setItem('95fa_is_logged_in', 'true');

    if (db.userAuditLogs) {
      await db.userAuditLogs.add({
        id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        armyNumber: user.serviceNumber,
        rank: user.rank,
        name: user.fullName,
        userId: user.id,
        timestamp: nowIso,
        actionType: 'LOGIN',
        performedBy: 'User',
        details: `General user authenticated successfully: ${user.serviceNumber} (${user.rank || ''} ${user.fullName})`
      });
    }

    await logAuditEvent(
      activeUser,
      'LOGIN_SUCCESS',
      'auth',
      activeUser.appointmentTitle,
      `General User logged in: ${activeUser.serviceNumber} (${activeUser.fullName}).`
    );

    return {
      success: true,
      message: `Welcome, ${activeUser.rank ? activeUser.rank + ' ' : ''}${activeUser.fullName}. Login verified.`
    };
  };

  /**
   * Fallback General Viewer Access
   */
  const loginAsGeneralViewer = async (): Promise<{ success: boolean; message: string }> => {
    const viewerUser: User = {
      id: 'usr-viewer-' + Date.now(),
      serviceNumber: 'GEN-VIEW',
      rank: 'Viewer',
      fullName: 'Unit Personnel (General)',
      appointmentTitle: 'General Viewer (Read-Only)',
      role: 'general_viewer',
      sectionAssigned: 'all',
      failedLoginAttempts: 0,
      isActive: true,
      userStatus: 'ACTIVE',
      lastLoginAt: new Date().toISOString()
    };

    setCurrentUser(viewerUser);
    setIsLoggedIn(true);
    setIsDeviceAuthorized(true);
    localStorage.setItem('95fa_user_role', 'general_viewer');
    localStorage.setItem('95fa_is_logged_in', 'true');

    await logAuditEvent(
      viewerUser,
      'LOGIN_SUCCESS',
      'auth',
      'General Viewer',
      'Entered UNIT-READY in Read-Only General Viewer mode.'
    );

    return {
      success: true,
      message: 'Logged in as General Viewer. You have read-only access to published unit records.'
    };
  };

  const logout = () => {
    const nowIso = new Date().toISOString();
    if (db.userAuditLogs && currentUser.serviceNumber) {
      db.userAuditLogs.add({
        id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        armyNumber: currentUser.serviceNumber,
        rank: currentUser.rank,
        name: currentUser.fullName,
        userId: currentUser.id,
        timestamp: nowIso,
        actionType: 'LOGOUT',
        performedBy: 'User',
        details: `User signed out: ${currentUser.appointmentTitle}.`
      }).catch(console.error);
    }

    logAuditEvent(currentUser, 'LOGOUT', 'auth', currentUser.appointmentTitle, `${currentUser.appointmentTitle} signed out.`);
    setIsLoggedIn(false);
    localStorage.removeItem('95fa_is_logged_in');
    localStorage.removeItem('95fa_user_id');
  };

  const activateDeviceWithPin = async (pin: string): Promise<{ success: boolean; message: string }> => {
    setIsDeviceAuthorized(true);
    return { success: true, message: 'Device activated successfully.' };
  };

  const createPersonnelAccount = async (userData: Partial<User>): Promise<{ success: boolean; user?: User; message: string }> => {
    if (currentUser.role !== 'co' && currentUser.role !== 'admin') {
      return { success: false, message: 'Commanding Officer (CO) authorization required.' };
    }

    const existingUsers = await db.users.toArray();
    let uniqueCode = Math.floor(100000 + Math.random() * 900000).toString();
    while (existingUsers.some(u => u.loginCode === uniqueCode || u.pin === uniqueCode)) {
      uniqueCode = Math.floor(100000 + Math.random() * 900000).toString();
    }

    const newUser: User = {
      id: 'usr-' + Date.now(),
      serviceNumber: userData.serviceNumber || `BA-${Math.floor(1000 + Math.random() * 9000)}`,
      rank: userData.rank || 'Sgt',
      fullName: userData.fullName || 'Unit Personnel',
      appointmentTitle: userData.appointmentTitle || 'Section Operator',
      role: userData.role || 'other_operator',
      sectionAssigned: userData.sectionAssigned || 'all',
      failedLoginAttempts: 0,
      isActive: true,
      userStatus: 'ACTIVE',
      accountStatus: 'ACTIVE',
      loginCode: uniqueCode,
      pin: uniqueCode,
      lastLoginAt: 'Never logged in'
    };

    await db.users.add(newUser);
    await syncEntityToCloud('users', newUser.id, newUser);

    await logAuditEvent(
      currentUser,
      'DEVICE_REGISTERED',
      'auth',
      newUser.appointmentTitle,
      `CO created authorized account for ${newUser.appointmentTitle} (${newUser.fullName}, ${newUser.serviceNumber}) with unique access code.`
    );

    return {
      success: true,
      user: newUser,
      message: `Account created for ${newUser.appointmentTitle}. Individual Access Code: ${uniqueCode}`
    };
  };

  const resetPersonnelAccessCode = async (userId: string): Promise<{ success: boolean; newCode?: string; message: string }> => {
    if (currentUser.role !== 'co' && currentUser.role !== 'admin') {
      return { success: false, message: 'Commanding Officer (CO) authorization required.' };
    }

    const existingUsers = await db.users.toArray();
    const userToUpdate = existingUsers.find(u => u.id === userId);
    if (!userToUpdate) {
      return { success: false, message: 'Personnel account not found.' };
    }

    let newCode = Math.floor(100000 + Math.random() * 900000).toString();
    while (existingUsers.some(u => (u.loginCode === newCode || u.pin === newCode) && u.id !== userId)) {
      newCode = Math.floor(100000 + Math.random() * 900000).toString();
    }

    const updatedUser = {
      ...userToUpdate,
      loginCode: newCode,
      pin: newCode,
      lastEditedBy: currentUser.appointmentTitle,
      lastEditedAt: new Date().toISOString()
    };

    await db.users.put(updatedUser);
    await syncEntityToCloud('users', userId, updatedUser);

    await logAuditEvent(
      currentUser,
      'PIN_RESET',
      'auth',
      userToUpdate.appointmentTitle,
      `CO reset individual access code for ${userToUpdate.appointmentTitle} (${userToUpdate.fullName}).`
    );

    return {
      success: true,
      newCode,
      message: `New Access Code generated for ${userToUpdate.appointmentTitle}: ${newCode}`
    };
  };

  const togglePersonnelAccountStatus = async (userId: string, targetStatus: 'ACTIVE' | 'DEACTIVATED'): Promise<{ success: boolean; message: string }> => {
    if (currentUser.role !== 'co' && currentUser.role !== 'admin') {
      return { success: false, message: 'Commanding Officer (CO) authorization required.' };
    }

    const user = await db.users.get(userId);
    if (!user) {
      return { success: false, message: 'Personnel account not found.' };
    }

    const isActivating = targetStatus === 'ACTIVE';
    const updated = {
      ...user,
      isActive: isActivating,
      userStatus: isActivating ? ('ACTIVE' as const) : ('DEACTIVATED' as const),
      accountStatus: isActivating ? ('ACTIVE' as const) : ('DEACTIVATED' as const),
      deactivatedAt: isActivating ? undefined : new Date().toISOString(),
      deactivatedBy: isActivating ? undefined : currentUser.appointmentTitle,
      lastEditedBy: currentUser.appointmentTitle,
      lastEditedAt: new Date().toISOString()
    };

    await db.users.put(updated);
    await syncEntityToCloud('users', userId, updated);

    await logAuditEvent(
      currentUser,
      isActivating ? 'USER_REACTIVATED' : 'USER_DEACTIVATION_APPROVED',
      'auth',
      user.appointmentTitle,
      `CO ${isActivating ? 'reactivated' : 'deactivated'} access for ${user.appointmentTitle} (${user.fullName}).`
    );

    return {
      success: true,
      message: `Account for ${user.appointmentTitle} is now ${isActivating ? 'ACTIVE' : 'DEACTIVATED'}.`
    };
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        user: currentUser,
        activeDevice,
        isDeviceAuthorized,
        isLoggedIn,
        loginWithIndividualCode,
        loginGeneralUser,
        registerGeneralUser,
        loginAsGeneralViewer,
        logout,
        activateDeviceWithPin,
        checkDeviceStatus,
        createPersonnelAccount,
        resetPersonnelAccessCode,
        togglePersonnelAccountStatus,
        availableRoles
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
