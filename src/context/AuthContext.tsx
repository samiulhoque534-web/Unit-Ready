import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Device, UserRole } from '../types';
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
  activeDevice: Device;
  isDeviceAuthorized: boolean;
  isLoggedIn: boolean;
  loginWithIndividualCode: (
    role: UserRole,
    loginCode: string,
    operatorDetails?: { appointmentTitle?: string; fullName?: string; rank?: string; serviceNumber?: string }
  ) => Promise<{ success: boolean; message: string }>;
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

  // 5 Official Authorized Roles (Strictly filtered, no GD / SMT Auditor / System Administrator)
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
      if (savedUserRole) {
        const dbUser = await db.users.where('role').equals(savedUserRole).first();
        if (dbUser) {
          setCurrentUser(dbUser);
        }
      }
    };
    syncUser();
  }, [savedUserRole]);

  /**
   * Secure Individual Login with Unique Generated Access Code
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
      return { success: false, message: 'Please enter your individual 6-digit access code.' };
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
      localStorage.setItem('95fa_is_logged_in', 'true');

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
      if (localUser.isActive === false || localUser.userStatus === 'DEACTIVATED') {
        return {
          success: false,
          message: 'Account deactivated. Access denied. Contact Commanding Officer for reactivation.'
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
      localStorage.setItem('95fa_is_logged_in', 'true');

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

    await logAuditEvent(
      currentUser,
      'LOGIN_FAILED',
      'auth',
      role,
      `Invalid individual access code attempt.`
    );

    return {
      success: false,
      message: authResult.message || 'Invalid access code. Please check your individual 6-digit code.'
    };
  };

  /**
   * 1-Click Transparent General Viewer Access (Read-Only)
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
    logAuditEvent(currentUser, 'LOGOUT', 'auth', currentUser.appointmentTitle, `${currentUser.appointmentTitle} signed out.`);
    setIsLoggedIn(false);
    localStorage.removeItem('95fa_is_logged_in');
  };

  const activateDeviceWithPin = async (pin: string): Promise<{ success: boolean; message: string }> => {
    setIsDeviceAuthorized(true);
    return { success: true, message: 'Device activated successfully.' };
  };

  /**
   * CO Access-Code Management Actions
   */
  const createPersonnelAccount = async (userData: Partial<User>): Promise<{ success: boolean; user?: User; message: string }> => {
    if (currentUser.role !== 'co' && currentUser.role !== 'admin') {
      return { success: false, message: 'Commanding Officer (CO) authorization required.' };
    }

    // Generate unique 6-digit access code
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
        activeDevice,
        isDeviceAuthorized,
        isLoggedIn,
        loginWithIndividualCode,
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
