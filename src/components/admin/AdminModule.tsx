import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { User, Device, UserDeactivationRequest, InAppNotification } from '../../types';
import { Modal } from '../common/Modal';
import { logAuditEvent } from '../../services/auditService';
import { AccessCodeManagement } from './AccessCodeManagement';
import { 
  ShieldCheck, Laptop, Key, Plus, 
  RotateCcw, Trash2, CheckCircle2, AlertTriangle, 
  Lock, RefreshCw, Users, ShieldAlert, Check, Clock, 
  UserMinus, UserCheck, FileText, Send, XCircle, ArrowRight
} from 'lucide-react';

interface AdminModuleProps {
  defaultTab?: 'ACCESS_CODES' | 'DEVICES' | 'ACTIVE_USERS' | 'DEACTIVATION_REQUESTS' | 'INACTIVE_ARCHIVE';
}

export const AdminModule: React.FC<AdminModuleProps> = ({ defaultTab }) => {
  const { currentUser } = useAuth();
  const { t, formatNumber } = useLanguage();

  const isQM = currentUser.role === 'qm';
  const isCO = currentUser.role === 'co' || currentUser.role === 'admin';
  const isAuthorizedManager = isQM || isCO;

  const [activeTab, setActiveTab] = useState<'ACCESS_CODES' | 'DEVICES' | 'ACTIVE_USERS' | 'DEACTIVATION_REQUESTS' | 'INACTIVE_ARCHIVE'>(
    defaultTab || (isCO ? 'ACCESS_CODES' : 'DEVICES')
  );
  const [users, setUsers] = useState<User[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [deactivations, setDeactivations] = useState<UserDeactivationRequest[]>([]);

  // Device Modals
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [generatedPin, setGeneratedPin] = useState<string>('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [newDevName, setNewDevName] = useState<string>('');
  const [newDevType, setNewDevType] = useState<'desktop' | 'tablet' | 'mobile'>('tablet');
  const [newDevSec, setNewDevSec] = useState<string>('Med');

  // Deactivation Modal (QM Initiate)
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState<boolean>(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [reasonForLeaving, setReasonForLeaving] = useState<'TRANSFER' | 'DISBANDMENT' | 'RETIREMENT' | 'DEPUTATION' | 'OTHER'>('TRANSFER');
  const [replacementUserId, setReplacementUserId] = useState<string>('');
  const [supportingRemarks, setSupportingRemarks] = useState<string>('');

  // CO Review Modal
  const [selectedDeactReq, setSelectedDeactReq] = useState<UserDeactivationRequest | null>(null);
  const [isCoReviewModalOpen, setIsCoReviewModalOpen] = useState<boolean>(false);
  const [coRemarks, setCoRemarks] = useState<string>('');

  const loadData = async () => {
    const uList = await db.users.toArray();
    setUsers(uList);
    const dList = await db.devices.toArray();
    setDevices(dList);
    const deactList = await db.deactivationRequests.toArray();
    setDeactivations(deactList.sort((a, b) => new Date(b.recommendedAt).getTime() - new Date(a.recommendedAt).getTime()));
  };

  useEffect(() => {
    loadData();
  }, []);

  // 1. QM Generates 6-Digit PIN
  const handleGenerateSixDigitPin = async (dev: Device) => {
    if (!isAuthorizedManager) {
      alert('ACCESS RESTRICTED — QM or CO authorization required.');
      return;
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.devices.update(dev.id, {
      sixDigitPin: pin,
      pinExpiresAt: expiresAt,
      generatedByAppointment: currentUser.appointmentTitle,
      status: 'PENDING'
    });

    await logAuditEvent(
      currentUser,
      'PIN_GENERATED',
      'admin_device',
      dev.deviceIdentifier,
      `${currentUser.appointmentTitle} issued 6-digit installation PIN (${pin}) for device ${dev.deviceName}.`
    );

    setSelectedDevice(dev);
    setGeneratedPin(pin);
    setIsPinModalOpen(true);
    loadData();
  };

  // 2. QM Approves Install Request & Dispatches Notification to CO
  const handleApproveInstallRequest = async (dev: Device) => {
    if (!isAuthorizedManager) {
      alert('ACCESS RESTRICTED — QM or CO authority required.');
      return;
    }

    const pin = dev.sixDigitPin || Math.floor(100000 + Math.random() * 900000).toString();
    const nowIso = new Date().toISOString();

    await db.devices.update(dev.id, {
      status: 'ACTIVE',
      sixDigitPin: pin,
      revokedStatus: false,
      generatedByAppointment: currentUser.appointmentTitle,
      lastSyncAt: nowIso
    });

    // Create In-App Notification for Commanding Officer (CO)
    const coNotif: InAppNotification = {
      id: 'notif-co-' + Date.now(),
      title: 'New Device Activated (QM Approval)',
      message: `Device "${dev.deviceName}" (${dev.deviceIdentifier}, Section: ${dev.assignedSectionCode || 'all'}) was approved and activated by Quartermaster (QM) on ${new Date().toLocaleString('en-GB')}.`,
      type: 'INFO',
      section: 'admin',
      timestamp: nowIso,
      isRead: false,
      targetPath: '/admin'
    };
    await db.notifications.add(coNotif);

    await logAuditEvent(
      currentUser,
      'DEVICE_ACTIVATED',
      'admin_device',
      dev.deviceIdentifier,
      `Quartermaster (QM) approved device installation for ${dev.deviceName} (${dev.deviceIdentifier}). Notification dispatched to CO.`
    );

    alert(`INSTALLATION APPROVED: Device ${dev.deviceName} is now active. Commanding Officer (CO) notified.`);
    loadData();
  };

  // 3. Register Device Manually
  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevName.trim()) return;

    if (!isAuthorizedManager) {
      alert('ACCESS RESTRICTED — QM or CO authorization required.');
      return;
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const devId = 'dev-' + Date.now();
    const devIdent = `${newDevType.toUpperCase()}-95FA-${newDevSec}-${Date.now().toString().slice(-4)}`;

    const newDev: Device = {
      id: devId,
      deviceIdentifier: devIdent,
      deviceName: newDevName.trim(),
      deviceType: newDevType,
      assignedSectionCode: newDevSec,
      sixDigitPin: pin,
      pinExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      generatedByAppointment: currentUser.appointmentTitle,
      status: 'ACTIVE',
      registrationDate: new Date().toISOString(),
      revokedStatus: false
    };

    await db.devices.add(newDev);
    await logAuditEvent(
      currentUser,
      'DEVICE_REGISTERED',
      'admin_device',
      newDev.deviceIdentifier,
      `${currentUser.appointmentTitle} registered device: ${newDev.deviceName} (${newDev.deviceIdentifier}) with 6-digit PIN (${pin}).`
    );

    setIsRegisterModalOpen(false);
    setSelectedDevice(newDev);
    setGeneratedPin(pin);
    setIsPinModalOpen(true);
    loadData();
  };

  // 4. Toggle Device Revocation
  const handleToggleRevoke = async (dev: Device) => {
    if (!isAuthorizedManager) {
      alert('ACCESS RESTRICTED — QM or CO authorization required.');
      return;
    }

    const newStatus = !dev.revokedStatus;
    await db.devices.update(dev.id, {
      revokedStatus: newStatus,
      status: newStatus ? 'REVOKED' : 'ACTIVE'
    });

    await logAuditEvent(
      currentUser,
      newStatus ? 'DEVICE_REVOKED' : 'DEVICE_ACTIVATED',
      'admin_device',
      dev.deviceIdentifier,
      `${currentUser.appointmentTitle} ${newStatus ? 'revoked' : 're-authorized'} access for device ${dev.deviceName}.`
    );
    loadData();
  };

  // 5. QM Submits Deactivation Recommendation
  const handleInitiateDeactivation = (u: User) => {
    if (!isQM && currentUser.role !== 'admin') {
      alert('ACCESS RESTRICTED — Only Quartermaster (QM) can initiate a user deactivation/disband recommendation.');
      return;
    }
    setTargetUser(u);
    setEffectiveDate(new Date().toISOString().substring(0, 10));
    setSupportingRemarks('');
    setReplacementUserId('');
    setIsDeactivateModalOpen(true);
  };

  const handleSaveDeactivationRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;

    const repUser = users.find(u => u.id === replacementUserId);

    const newReq: UserDeactivationRequest = {
      id: 'deact-' + Date.now(),
      targetUserId: targetUser.id,
      targetUserName: targetUser.fullName || targetUser.appointmentTitle,
      targetUserAppointment: targetUser.appointmentTitle,
      targetSection: targetUser.sectionAssigned,
      effectiveDate,
      reasonForLeaving,
      replacementUserId: repUser?.id,
      replacementAppointment: repUser?.appointmentTitle,
      supportingRemarks: supportingRemarks.trim(),
      status: 'PENDING_CO',
      recommendedByAppointment: 'Quartermaster (QM)',
      recommendedAt: new Date().toISOString(),
      isCompleted: false
    };

    await db.deactivationRequests.add(newReq);

    // Send CO notification
    const coNotif: InAppNotification = {
      id: 'notif-deact-' + Date.now(),
      title: 'QM Deactivation Recommendation Submitted',
      message: `Quartermaster (QM) recommended deactivation/disbandment for appointment "${targetUser.appointmentTitle}" effective ${effectiveDate}. Reason: ${reasonForLeaving}. Awaiting CO Final Approval.`,
      type: 'WARNING',
      section: 'admin',
      timestamp: new Date().toISOString(),
      isRead: false,
      targetPath: '/admin'
    };
    await db.notifications.add(coNotif);

    await logAuditEvent(
      currentUser,
      'USER_DEACTIVATION_RECOMMENDED',
      'admin',
      targetUser.appointmentTitle,
      `Quartermaster (QM) recommended deactivation for ${targetUser.appointmentTitle}. Reason: ${reasonForLeaving}. Forwarded to CO.`
    );

    setIsDeactivateModalOpen(false);
    alert(`RECOMMENDATION SUBMITTED: Deactivation request for ${targetUser.appointmentTitle} forwarded to Commanding Officer (CO). The user remains active until CO final decision.`);
    loadData();
  };

  // 6. CO Decision on Deactivation Recommendation
  const handleCoDeactivationDecision = async (decision: 'APPROVE' | 'REJECT' | 'RETURN') => {
    if (!selectedDeactReq) return;
    if (!isCO) {
      alert('ACCESS RESTRICTED — Commanding Officer (CO) authority required.');
      return;
    }

    const nowIso = new Date().toISOString();

    if (decision === 'APPROVE') {
      // Approve Deactivation
      await db.deactivationRequests.update(selectedDeactReq.id, {
        status: 'CO_APPROVED',
        coAppointment: currentUser.appointmentTitle,
        coDecision: 'APPROVED',
        coRemarks: coRemarks.trim() || 'Approved by Commanding Officer.',
        coDecidedAt: nowIso,
        isCompleted: true
      });

      // Update target user to INACTIVE / DISBANDED
      await db.users.update(selectedDeactReq.targetUserId, {
        isActive: false,
        userStatus: selectedDeactReq.reasonForLeaving === 'TRANSFER' ? 'TRANSFERRED' : 'DISBANDED',
        deactivatedAt: nowIso,
        deactivatedReason: selectedDeactReq.reasonForLeaving,
        deactivatedBy: currentUser.appointmentTitle
      });

      await logAuditEvent(
        currentUser,
        'USER_DEACTIVATION_APPROVED',
        'admin',
        selectedDeactReq.targetUserAppointment,
        `Commanding Officer approved deactivation for ${selectedDeactReq.targetUserAppointment}. Account marked Inactive/Disbanded. Access revoked.`
      );

      alert(`CO APPROVAL COMPLETE: User ${selectedDeactReq.targetUserAppointment} has been deactivated and moved to Former/Inactive Archive.`);
    } else {
      const newStatus = decision === 'REJECT' ? 'CO_REJECTED' : 'CO_RETURNED';
      await db.deactivationRequests.update(selectedDeactReq.id, {
        status: newStatus,
        coAppointment: currentUser.appointmentTitle,
        coDecision: decision,
        coRemarks: coRemarks.trim() || `Recommendation ${decision.toLowerCase()}ed by CO.`,
        coDecidedAt: nowIso,
        isCompleted: true
      });

      await logAuditEvent(
        currentUser,
        'USER_DEACTIVATION_REJECTED',
        'admin',
        selectedDeactReq.targetUserAppointment,
        `Commanding Officer ${decision.toLowerCase()}ed deactivation recommendation for ${selectedDeactReq.targetUserAppointment}. Remarks: ${coRemarks}`
      );

      alert(`DECISION RECORDED: Recommendation ${decision.toLowerCase()}ed.`);
    }

    setIsCoReviewModalOpen(false);
    loadData();
  };

  // 7. CO Reactivates User
  const handleCoReactivateUser = async (u: User) => {
    if (!isCO) {
      alert('ACCESS RESTRICTED — Only Commanding Officer (CO) can reactivate former/inactive personnel.');
      return;
    }

    if (!confirm(`Reactivate ${u.appointmentTitle} into active unit nominal roll and restore permissions?`)) {
      return;
    }

    await db.users.update(u.id, {
      isActive: true,
      userStatus: 'ACTIVE',
      deactivatedAt: undefined,
      deactivatedReason: undefined,
      deactivatedBy: undefined
    });

    await logAuditEvent(
      currentUser,
      'USER_REACTIVATED',
      'admin',
      u.appointmentTitle,
      `Commanding Officer reactivated user account: ${u.appointmentTitle}.`
    );

    alert(`USER REACTIVATED: ${u.appointmentTitle} is restored to active status.`);
    loadData();
  };

  const activeUsersList = users.filter(u => u.isActive !== false && u.userStatus !== 'DISBANDED' && u.userStatus !== 'TRANSFERRED' && u.userStatus !== 'INACTIVE');
  const inactiveUsersList = users.filter(u => u.isActive === false || u.userStatus === 'DISBANDED' || u.userStatus === 'TRANSFERRED' || u.userStatus === 'INACTIVE');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              Unit Administration & Whitelisting Panel
            </h2>
            <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
              QM & CO CONTROL
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Hardware whitelisting, 6-digit installation PINs, and QM deactivation recommendations with CO final approval.
          </p>
        </div>

        {isAuthorizedManager && activeTab === 'DEVICES' && (
          <button
            onClick={() => {
              setNewDevName('');
              setIsRegisterModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Generate PIN & Register Device</span>
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-bold overflow-x-auto">
        {isCO && (
          <button
            onClick={() => setActiveTab('ACCESS_CODES')}
            className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'ACCESS_CODES'
                ? 'bg-[#2D4A22] text-[#F59E0B] shadow border border-[#4C7536]'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <Key className="w-4 h-4 text-[#F59E0B]" />
            <span>Access Code Management (CO Authority)</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('DEVICES')}
          className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'DEVICES'
              ? 'bg-[#2D4A22] text-white shadow'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <Laptop className="w-4 h-4" />
          <span>Device Whitelist & Installs ({devices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ACTIVE_USERS')}
          className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'ACTIVE_USERS'
              ? 'bg-[#2D4A22] text-white shadow'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Active Appointments ({activeUsersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('DEACTIVATION_REQUESTS')}
          className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'DEACTIVATION_REQUESTS'
              ? 'bg-[#2D4A22] text-white shadow'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <UserMinus className="w-4 h-4" />
          <span>QM Deactivation Workflow ({deactivations.filter(d => d.status === 'PENDING_CO').length} Pending CO)</span>
        </button>

        <button
          onClick={() => setActiveTab('INACTIVE_ARCHIVE')}
          className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === 'INACTIVE_ARCHIVE'
              ? 'bg-[#2D4A22] text-white shadow'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Former / Inactive Users ({inactiveUsersList.length})</span>
        </button>
      </div>

      {/* TAB 0: INDIVIDUAL ACCESS CODES MANAGEMENT (CO) */}
      {activeTab === 'ACCESS_CODES' && (
        <AccessCodeManagement />
      )}

      {/* TAB 1: DEVICE WHITELISTING */}
      {activeTab === 'DEVICES' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Laptop className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-800 dark:text-slate-200">
                Hardware Whitelist & Installation Requests (QM Controlled)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Total Hardware: {formatNumber(devices.length)} Devices
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#1E3316] text-white uppercase text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Device Name</th>
                  <th className="py-3 px-4">Identifier</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Section</th>
                  <th className="py-3 px-4">6-Digit PIN</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-[#F8F9F5] dark:hover:bg-slate-800/50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {d.deviceName}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-800 dark:text-emerald-400 font-semibold">
                      {d.deviceIdentifier}
                    </td>
                    <td className="py-3 px-4 uppercase text-[10px] font-mono text-slate-500">
                      {d.deviceType}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {d.assignedSectionCode || 'all'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-700 dark:text-amber-400 text-sm">
                      {d.sixDigitPin || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.revokedStatus 
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' 
                          : d.status === 'ACTIVE' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {d.revokedStatus ? 'REVOKED' : d.status === 'PENDING' ? 'PENDING QM APPROVAL' : 'WHITELISTED & ACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      {isAuthorizedManager && (
                        <>
                          {d.status === 'PENDING' && (
                            <button
                              onClick={() => handleApproveInstallRequest(d)}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow inline-flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve Install & Notify CO</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleGenerateSixDigitPin(d)}
                            className="px-2.5 py-1 rounded bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow inline-flex items-center gap-1"
                          >
                            <Key className="w-3 h-3 text-[#F59E0B]" />
                            <span>Generate PIN</span>
                          </button>
                          <button
                            onClick={() => handleToggleRevoke(d)}
                            className={`px-2.5 py-1 rounded text-xs font-bold ${
                              d.revokedStatus 
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                                : 'bg-red-600 text-white hover:bg-red-700'
                            }`}
                          >
                            {d.revokedStatus ? 'Re-Authorize' : 'Revoke'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE USERS & APPOINTMENTS */}
      {activeTab === 'ACTIVE_USERS' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-800 dark:text-slate-200">
                Active User Appointments (Appointments Only — No Military Ranks)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Active: {formatNumber(activeUsersList.length)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#1E3316] text-white uppercase text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Service Number</th>
                  <th className="py-3 px-4">Appointment Title</th>
                  <th className="py-3 px-4">Role Code</th>
                  <th className="py-3 px-4">Assigned Section</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {activeUsersList.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F8F9F5] dark:hover:bg-slate-800/50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {u.serviceNumber}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                      {u.appointmentTitle}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-800 dark:text-emerald-400">
                      {u.role}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {u.sectionAssigned}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                        ACTIVE
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {/* QM can initiate deactivation recommendation */}
                      {(isQM || currentUser.role === 'admin') && u.role !== 'co' && (
                        <button
                          onClick={() => handleInitiateDeactivation(u)}
                          className="px-2.5 py-1 rounded bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow inline-flex items-center gap-1"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          <span>QM Deactivation Recommendation</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: QM DEACTIVATION RECOMMENDATIONS */}
      {activeTab === 'DEACTIVATION_REQUESTS' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden space-y-4">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <UserMinus className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-800 dark:text-slate-200">
                QM Deactivation / Disbandment Recommendations (Forwarded to CO)
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Only QM can initiate; User remains active until Commanding Officer gives final approval.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#1E3316] text-white uppercase text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Target Appointment</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Effective Date</th>
                  <th className="py-3 px-4">Replacement</th>
                  <th className="py-3 px-4">Recommended By</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {deactivations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-mono">
                      No deactivation recommendations submitted.
                    </td>
                  </tr>
                ) : (
                  deactivations.map((d) => (
                    <tr key={d.id} className="hover:bg-[#F8F9F5] dark:hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {d.targetUserAppointment}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-800 dark:text-amber-400">
                        {d.reasonForLeaving}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {d.effectiveDate}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {d.replacementAppointment || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {d.recommendedByAppointment} ({new Date(d.recommendedAt).toLocaleDateString('en-GB')})
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.status === 'CO_APPROVED'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            : d.status === 'PENDING_CO'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800'
                        }`}>
                          {d.status === 'PENDING_CO' ? 'AWAITING CO FINAL APPROVAL' : d.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {d.status === 'PENDING_CO' && isCO && (
                          <button
                            onClick={() => {
                              setSelectedDeactReq(d);
                              setCoRemarks('');
                              setIsCoReviewModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded bg-[#F59E0B] hover:bg-[#D97706] text-black font-extrabold text-xs shadow flex items-center gap-1 ml-auto"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>CO Final Review</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: FORMER / INACTIVE USERS (ARCHIVE) */}
      {activeTab === 'INACTIVE_ARCHIVE' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-800 dark:text-slate-200">
                Former / Inactive Users (Historical Audit Preserved — Reactivation by CO Only)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Archived: {formatNumber(inactiveUsersList.length)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#1E3316] text-white uppercase text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Service Number</th>
                  <th className="py-3 px-4">Appointment Title</th>
                  <th className="py-3 px-4">Status / Reason</th>
                  <th className="py-3 px-4">Deactivation Date</th>
                  <th className="py-3 px-4">Authorized By</th>
                  <th className="py-3 px-4 text-right">CO Reactivation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {inactiveUsersList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-mono">
                      No former or inactive personnel in archive.
                    </td>
                  </tr>
                ) : (
                  inactiveUsersList.map((u) => (
                    <tr key={u.id} className="hover:bg-[#F8F9F5] dark:hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-500">
                        {u.serviceNumber}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        {u.appointmentTitle}
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-2 py-0.5 rounded text-[10px] font-bold">
                          {u.userStatus || 'DISBANDED'} ({u.deactivatedReason || 'Transferred'})
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {u.deactivatedAt ? new Date(u.deactivatedAt).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {u.deactivatedBy || 'Commanding Officer'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isCO && (
                          <button
                            onClick={() => handleCoReactivateUser(u)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>CO Reactivate</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generated PIN Modal */}
      <Modal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        title="6-Digit Installation PIN Issued"
        subtitle={`Hardware: ${selectedDevice?.deviceName} (${selectedDevice?.deviceIdentifier})`}
      >
        <div className="text-center space-y-4 py-3">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center mx-auto">
            <Key className="w-6 h-6" />
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">
              Provide this 6-digit numeric installation PIN to the device operator:
            </p>
            <div className="font-mono text-3xl font-black tracking-widest text-[#2D4A22] dark:text-emerald-400 bg-[#F8F9F5] dark:bg-slate-800 py-3 rounded-lg border border-slate-300 dark:border-slate-700">
              {generatedPin}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-mono">
              Issued by Quartermaster (QM). Valid for 7 days. Enforces device intranet authorization.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsPinModalOpen(false)}
              className="w-full py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Register Device Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register New Client Device (QM Authorization)"
        subtitle="Whitelist tablet, desktop, or mobile workstation for 95 Fd Amb Intranet"
      >
        <form onSubmit={handleRegisterDevice} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Device Descriptive Name *
            </label>
            <input
              type="text"
              value={newDevName}
              onChange={(e) => setNewDevName(e.target.value)}
              placeholder="e.g. Med Store Field Terminal #3"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Hardware Form Factor *
              </label>
              <select
                value={newDevType}
                onChange={(e) => setNewDevType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="tablet">Tablet (Field / Mobile Use)</option>
                <option value="desktop">Desktop Workstation (HQ Main)</option>
                <option value="mobile">Handheld Mobile</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Designated Section *
              </label>
              <select
                value={newDevSec}
                onChange={(e) => setNewDevSec(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="all">All Sections (HQ Command)</option>
                <option value="Med">Med Section</option>
                <option value="A">A Section</option>
                <option value="MT">MT Section</option>
                <option value="SMT">SMT Section</option>
                <option value="Clk">Clk Section</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold"
            >
              {t('action_cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow"
            >
              Register & Issue 6-Digit PIN
            </button>
          </div>
        </form>
      </Modal>

      {/* QM Initiate Deactivation Modal */}
      <Modal
        isOpen={isDeactivateModalOpen}
        onClose={() => setIsDeactivateModalOpen(false)}
        title="QM User Deactivation / Disband Recommendation"
        subtitle={`Target: ${targetUser?.appointmentTitle} (${targetUser?.serviceNumber})`}
      >
        <form onSubmit={handleSaveDeactivationRecommendation} className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200">
            <p className="font-bold mb-0.5">Quartermaster Recommendation Note:</p>
            <p>The user will remain active until the Commanding Officer (CO) grants final approval.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Effective Deactivation Date *
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Leaving Unit *
              </label>
              <select
                value={reasonForLeaving}
                onChange={(e) => setReasonForLeaving(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="TRANSFER">Posting / Permanent Transfer Out</option>
                <option value="DISBANDMENT">Unit Disbandment / Re-organization</option>
                <option value="RETIREMENT">Retirement / Release from Service</option>
                <option value="DEPUTATION">Temporary Attachment / Deputation</option>
                <option value="OTHER">Other Administrative Reason</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Optional Replacement Operator (Task Handover)
            </label>
            <select
              value={replacementUserId}
              onChange={(e) => setReplacementUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="">Transfer pending tasks to CO / Unassigned</option>
              {activeUsersList
                .filter(u => u.id !== targetUser?.id)
                .map(u => (
                  <option key={u.id} value={u.id}>
                    {u.appointmentTitle} ({u.sectionAssigned})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Supporting Remarks / Authority Reference *
            </label>
            <textarea
              rows={3}
              value={supportingRemarks}
              onChange={(e) => setSupportingRemarks(e.target.value)}
              placeholder="e.g. Relinquishing charge as per AHQ MS Branch posting order ref #..."
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-sans"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsDeactivateModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Forward Recommendation to CO</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* CO Deactivation Decision Modal */}
      <Modal
        isOpen={isCoReviewModalOpen}
        onClose={() => setIsCoReviewModalOpen(false)}
        title="CO Final Decision: User Deactivation"
        subtitle={`Target Appointment: ${selectedDeactReq?.targetUserAppointment}`}
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-600 dark:text-slate-300">
              <p>Reason: <strong>{selectedDeactReq?.reasonForLeaving}</strong></p>
              <p>Effective Date: <strong>{selectedDeactReq?.effectiveDate}</strong></p>
              <p>Recommended By: <strong>{selectedDeactReq?.recommendedByAppointment}</strong></p>
              <p>Replacement: <strong>{selectedDeactReq?.replacementAppointment || 'None (Handover to CO)'}</strong></p>
            </div>
            <div className="pt-2 border-t text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">QM Supporting Remarks:</span>
              <p className="italic text-slate-600 dark:text-slate-400">{selectedDeactReq?.supportingRemarks}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Commanding Officer Decision Remarks:
            </label>
            <textarea
              rows={2}
              value={coRemarks}
              onChange={(e) => setCoRemarks(e.target.value)}
              placeholder="e.g. Approved. Revoke network credentials and handover store ledgers."
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <button
              onClick={() => handleCoDeactivationDecision('RETURN')}
              className="px-3 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold"
            >
              Return to QM
            </button>
            <button
              onClick={() => handleCoDeactivationDecision('REJECT')}
              className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow flex items-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
            <button
              onClick={() => handleCoDeactivationDecision('APPROVE')}
              className="px-4 py-1.5 rounded bg-[#F59E0B] hover:bg-[#D97706] text-black font-extrabold text-xs shadow flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>CO Approve & Deactivate</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
