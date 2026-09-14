import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db/database';
import { User, UserAuditLogEntry, ManpowerPersonnel } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
  History,
  Clock,
  UserCheck,
  UserX,
  FileSpreadsheet,
  RefreshCw,
  Building2,
  Calendar,
  AlertCircle
} from 'lucide-react';

export const UserMonitoringModule: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [personnel, setPersonnel] = useState<ManpowerPersonnel[]>([]);
  const [auditLogs, setAuditLogs] = useState<UserAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');

  // Selected user for details/history modal
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionUser, setActionUser] = useState<{ user: User; action: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'DEACTIVATE' | 'REACTIVATE' } | null>(null);
  const [actionReason, setActionReason] = useState('');

  // Load data from Dexie
  const loadData = async () => {
    setLoading(true);
    try {
      const [allUsers, allPersonnel, allLogs] = await Promise.all([
        db.users.toArray(),
        db.manpowerPersonnel.toArray(),
        db.userAuditLogs ? db.userAuditLogs.reverse().toArray() : []
      ]);
      setUsers(allUsers);
      setPersonnel(allPersonnel);
      setAuditLogs(allLogs);
    } catch (err) {
      console.error('Failed to load user monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Personnel lookup map by normalized army number
  const personnelMap = useMemo(() => {
    const map = new Map<string, ManpowerPersonnel>();
    personnel.forEach(p => {
      const normalized = (p.baNo || p.personalNumber || '').replace(/\s+/g, '').toUpperCase();
      if (normalized) {
        map.set(normalized, p);
      }
    });
    return map;
  }, [personnel]);

  // Companies list
  const companies = useMemo(() => {
    const set = new Set<string>();
    users.forEach(u => {
      if (u.subUnitCompany) set.add(u.subUnitCompany);
    });
    return Array.from(set).sort();
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const normalizedArmy = (u.serviceNumber || '').replace(/\s+/g, '').toUpperCase();
      const matchSearch =
        normalizedArmy.includes(searchTerm.toUpperCase()) ||
        (u.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.rank || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.appointmentTitle || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PENDING' && (u.accountStatus === 'PENDING' || !u.accountStatus)) ||
        u.accountStatus === statusFilter;

      const matchCompany = companyFilter === 'ALL' || u.subUnitCompany === companyFilter;

      return matchSearch && matchStatus && matchCompany;
    });
  }, [users, searchTerm, statusFilter, companyFilter]);

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchSearch =
        log.armyNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.details || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchAction = auditActionFilter === 'ALL' || log.actionType === auditActionFilter;
      return matchSearch && matchAction;
    });
  }, [auditLogs, searchTerm, auditActionFilter]);

  // Statistics
  const stats = useMemo(() => {
    let total = users.length;
    let pending = 0;
    let active = 0;
    let suspended = 0;
    let deactivated = 0;

    users.forEach(u => {
      if (u.accountStatus === 'PENDING' || (!u.accountStatus && u.role === 'general_personnel')) {
        pending++;
      } else if (u.accountStatus === 'SUSPENDED') {
        suspended++;
      } else if (u.accountStatus === 'DEACTIVATED' || u.userStatus === 'DEACTIVATED') {
        deactivated++;
      } else {
        active++;
      }
    });

    return { total, pending, active, suspended, deactivated };
  }, [users]);

  // Status Action handler
  const handleExecuteStatusAction = async () => {
    if (!actionUser) return;
    const { user, action } = actionUser;
    const nowIso = new Date().toISOString();
    const performerAppointment = currentUser?.appointmentTitle || currentUser?.role?.toUpperCase() || 'CO';

    let updatedAccountStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' = 'ACTIVE';
    let auditAction: UserAuditLogEntry['actionType'] = 'APPROVAL';
    let detailMsg = '';

    if (action === 'APPROVE') {
      updatedAccountStatus = 'ACTIVE';
      auditAction = 'APPROVAL';
      detailMsg = `Account approved by ${performerAppointment}. Reason/Note: ${actionReason || 'Verified'}`;
    } else if (action === 'REJECT') {
      updatedAccountStatus = 'DEACTIVATED';
      auditAction = 'REJECTION';
      detailMsg = `Account rejected by ${performerAppointment}. Reason: ${actionReason || 'Not authorized'}`;
    } else if (action === 'SUSPEND') {
      updatedAccountStatus = 'SUSPENDED';
      auditAction = 'SUSPENSION';
      detailMsg = `Account suspended by ${performerAppointment}. Reason: ${actionReason || 'Security hold'}`;
    } else if (action === 'DEACTIVATE') {
      updatedAccountStatus = 'DEACTIVATED';
      auditAction = 'DEACTIVATION';
      detailMsg = `Account deactivated by ${performerAppointment}. Reason: ${actionReason || 'Deactivated'}`;
    } else if (action === 'REACTIVATE') {
      updatedAccountStatus = 'ACTIVE';
      auditAction = 'REACTIVATION';
      detailMsg = `Account reactivated by ${performerAppointment}. Reason: ${actionReason || 'Reactivated by CO'}`;
    }

    try {
      // Update User table
      await db.users.update(user.id, {
        accountStatus: updatedAccountStatus,
        isActive: updatedAccountStatus === 'ACTIVE',
        userStatus: updatedAccountStatus === 'ACTIVE' ? 'ACTIVE' : 'DEACTIVATED',
        verificationNotes: actionReason || user.verificationNotes,
        lastEditedBy: performerAppointment,
        lastEditedAt: nowIso
      });

      // Log in userAuditLogs
      const newLog: UserAuditLogEntry = {
        id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        armyNumber: user.serviceNumber,
        rank: user.rank,
        name: user.fullName,
        userId: user.id,
        timestamp: nowIso,
        actionType: auditAction,
        performedBy: performerAppointment,
        details: detailMsg
      };

      if (db.userAuditLogs) {
        await db.userAuditLogs.add(newLog);
      }

      setActionUser(null);
      setActionReason('');
      await loadData();
    } catch (err) {
      console.error('Failed to update user status:', err);
      alert('Failed to update user status. Please check console.');
    }
  };

  const getStatusBadge = (user: User) => {
    const status = user.accountStatus || (user.isActive ? 'ACTIVE' : 'PENDING');
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Active
          </span>
        );
      case 'PENDING':
      case 'PENDING_VERIFICATION':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Pending Verification
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-orange-600" />
            Suspended
          </span>
        );
      case 'DEACTIVATED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
            Deactivated
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-xl shadow-lg border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-600/30 rounded-lg border border-indigo-400/40">
                <ShieldCheck className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  User Identity and Login Monitoring
                </h1>
                <p className="text-sm text-slate-300 mt-0.5">
                  Commanding Officer & Administrator Control Centre for Individual General User Verification & Audit
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="flex items-center space-x-2 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition border border-slate-600 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-slate-700/60 text-center">
          <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-slate-400 uppercase font-medium mt-1">Total Users</div>
          </div>
          <div className="bg-amber-950/40 p-3 rounded-lg border border-amber-800/40">
            <div className="text-2xl font-bold text-amber-400">{stats.pending}</div>
            <div className="text-xs text-amber-300 uppercase font-medium mt-1">Pending Approval</div>
          </div>
          <div className="bg-emerald-950/40 p-3 rounded-lg border border-emerald-800/40">
            <div className="text-2xl font-bold text-emerald-400">{stats.active}</div>
            <div className="text-xs text-emerald-300 uppercase font-medium mt-1">Active Accounts</div>
          </div>
          <div className="bg-orange-950/40 p-3 rounded-lg border border-orange-800/40">
            <div className="text-2xl font-bold text-orange-400">{stats.suspended}</div>
            <div className="text-xs text-orange-300 uppercase font-medium mt-1">Suspended</div>
          </div>
          <div className="bg-rose-950/40 p-3 rounded-lg border border-rose-800/40">
            <div className="text-2xl font-bold text-rose-400">{stats.deactivated}</div>
            <div className="text-xs text-rose-300 uppercase font-medium mt-1">Deactivated</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-lg px-4 pt-3 shadow-sm">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-medium text-sm transition ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-700 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>General Users Registry ({users.length})</span>
          {stats.pending > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full">
              {stats.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-medium text-sm transition ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-700 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Authentication Audit Log ({auditLogs.length})</span>
        </button>
      </div>

      {/* Tab 1: Users Registry */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-b-lg shadow-sm border border-t-0 border-gray-200 p-5 space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Army Number, Rank, Name, Appointment..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DEACTIVATED">Deactivated</option>
              </select>

              {companies.length > 0 && (
                <select
                  value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Companies</option>
                  {companies.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-xs border-b border-gray-200">
                <tr>
                  <th className="py-3 px-3">BA Number</th>
                  <th className="py-3 px-3">Rank</th>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Company/Sub-unit</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Account Status</th>
                  <th className="py-3 px-3">Registration Date</th>
                  <th className="py-3 px-3">Last Login Date & Time</th>
                  <th className="py-3 px-3">Last Activity Date & Time</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-500">
                      No users match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => {
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition text-xs">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {u.serviceNumber}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                          {u.rank || '—'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-900">
                          {u.fullName || '—'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-gray-700">
                          {u.subUnitCompany || 'HQ Company'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-gray-700 font-medium">
                          {u.appointmentTitle || u.role}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getStatusBadge(u)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                          {u.registrationDate ? new Date(u.registrationDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                          {u.lastLoginAt && u.lastLoginAt !== 'Never logged in' ? new Date(u.lastLoginAt).toLocaleString() : 'Never logged in'}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                          {u.lastActivityAt ? new Date(u.lastActivityAt).toLocaleString() : (u.lastLoginAt && u.lastLoginAt !== 'Never logged in' ? new Date(u.lastLoginAt).toLocaleString() : '—')}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-right space-x-1">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                            title="View User Login History & Audit Details"
                          >
                            <History className="w-4 h-4 inline" />
                          </button>

                          {/* Quick Approval / Actions for CO */}
                          {(!u.accountStatus || u.accountStatus === 'PENDING' || u.accountStatus === 'PENDING_VERIFICATION') && (
                            <>
                              <button
                                onClick={() => setActionUser({ user: u, action: 'APPROVE' })}
                                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                                title="Approve User"
                              >
                                <CheckCircle2 className="w-4 h-4 inline" />
                              </button>
                              <button
                                onClick={() => setActionUser({ user: u, action: 'REJECT' })}
                                className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded"
                                title="Reject User"
                              >
                                <XCircle className="w-4 h-4 inline" />
                              </button>
                            </>
                          )}

                          {u.accountStatus === 'ACTIVE' && (
                            <button
                              onClick={() => setActionUser({ user: u, action: 'SUSPEND' })}
                              className="p-1.5 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded"
                              title="Suspend User"
                            >
                              <Lock className="w-4 h-4 inline" />
                            </button>
                          )}

                          {u.accountStatus === 'SUSPENDED' && (
                            <button
                              onClick={() => setActionUser({ user: u, action: 'REACTIVATE' })}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                              title="Reactivate User"
                            >
                              <Unlock className="w-4 h-4 inline" />
                            </button>
                          )}

                          {u.accountStatus !== 'DEACTIVATED' && u.accountStatus !== 'PENDING' && u.accountStatus !== 'PENDING_VERIFICATION' && (
                            <button
                              onClick={() => setActionUser({ user: u, action: 'DEACTIVATE' })}
                              className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded"
                              title="Deactivate User"
                            >
                              <UserX className="w-4 h-4 inline" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-b-lg shadow-sm border border-t-0 border-gray-200 p-5 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search audit trail by Army Number, Name, Details..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <select
              value={auditActionFilter}
              onChange={e => setAuditActionFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Event Types</option>
              <option value="REGISTRATION">Registrations</option>
              <option value="LOGIN">Successful Logins</option>
              <option value="FAILED_LOGIN">Failed Logins</option>
              <option value="APPROVAL">Approvals</option>
              <option value="REJECTION">Rejections</option>
              <option value="SUSPENSION">Suspensions</option>
              <option value="DEACTIVATION">Deactivations</option>
              <option value="REACTIVATION">Reactivations</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-xs border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Timestamp (Dhaka)</th>
                  <th className="py-3 px-4">Army Number</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Performed By</th>
                  <th className="py-3 px-4">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white font-mono text-xs">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500 font-sans text-sm">
                      No audit logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition font-sans">
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap text-xs font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {log.armyNumber}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-gray-800">
                        {log.rank ? `${log.rank} ` : ''}{log.name || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          log.actionType === 'APPROVAL' || log.actionType === 'REACTIVATION'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.actionType === 'LOGIN'
                            ? 'bg-blue-100 text-blue-800'
                            : log.actionType === 'FAILED_LOGIN' || log.actionType === 'REJECTION' || log.actionType === 'DEACTIVATION'
                            ? 'bg-rose-100 text-rose-800'
                            : log.actionType === 'SUSPENSION'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {log.actionType}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-gray-700 font-medium">
                        {log.performedBy}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Modal (Approve / Reject / Suspend / Deactivate / Reactivate) */}
      {actionUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {actionUser.action === 'APPROVE' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {actionUser.action === 'REJECT' && <XCircle className="w-5 h-5 text-rose-600" />}
              {actionUser.action === 'SUSPEND' && <AlertTriangle className="w-5 h-5 text-orange-600" />}
              {actionUser.action === 'DEACTIVATE' && <UserX className="w-5 h-5 text-rose-600" />}
              {actionUser.action === 'REACTIVATE' && <Unlock className="w-5 h-5 text-emerald-600" />}
              Confirm {actionUser.action} User
            </h3>

            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-sm">
              <div><span className="font-semibold text-gray-700">Army Number:</span> <span className="font-mono font-bold">{actionUser.user.serviceNumber}</span></div>
              <div><span className="font-semibold text-gray-700">Name:</span> {actionUser.user.rank} {actionUser.user.fullName}</div>
              <div><span className="font-semibold text-gray-700">Company:</span> {actionUser.user.subUnitCompany || 'HQ'}</div>
              <div><span className="font-semibold text-gray-700">Current Status:</span> {actionUser.user.accountStatus || 'PENDING'}</div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                Reason / Command Note (Recorded in Audit Trail)
              </label>
              <textarea
                rows={3}
                value={actionReason}
                onChange={e => setActionReason(e.target.value)}
                placeholder={`Enter reason for ${actionUser.action.toLowerCase()}ing this account...`}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setActionUser(null);
                  setActionReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteStatusAction}
                className={`px-5 py-2 rounded-lg text-sm font-semibold text-white shadow transition ${
                  actionUser.action === 'APPROVE' || actionUser.action === 'REACTIVATE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : actionUser.action === 'SUSPEND'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Confirm {actionUser.action}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected User Details & History Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-gray-900">User Identity & Authentication Profile</h3>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold uppercase">Army / Personal Number</div>
                <div className="text-base font-mono font-bold text-slate-900 mt-0.5">{selectedUser.serviceNumber}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold uppercase">Rank & Name</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {selectedUser.rank} {selectedUser.fullName || '—'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold uppercase">Sub-Unit / Company</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {selectedUser.subUnitCompany || 'HQ / Unspecified'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold uppercase">Account Status</div>
                <div className="mt-1">{getStatusBadge(selectedUser)}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold uppercase">Registration Date</div>
                <div className="text-sm font-medium text-slate-800 mt-0.5">
                  {selectedUser.registrationDate ? new Date(selectedUser.registrationDate).toLocaleString() : 'N/A'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold uppercase">Last Activity / Login</div>
                <div className="text-sm font-medium text-slate-800 mt-0.5">
                  {selectedUser.lastActivityAt || selectedUser.lastLoginAt
                    ? new Date(selectedUser.lastActivityAt || selectedUser.lastLoginAt!).toLocaleString()
                    : 'No recorded activity'}
                </div>
              </div>
            </div>

            {/* Cross-check details */}
            <div className="mt-4 p-4 rounded-lg bg-indigo-50/60 border border-indigo-200">
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Manpower Database Cross-Check
              </h4>
              {personnelMap.get((selectedUser.serviceNumber || '').replace(/\s+/g, '').toUpperCase()) ? (
                (() => {
                  const m = personnelMap.get((selectedUser.serviceNumber || '').replace(/\s+/g, '').toUpperCase())!;
                  return (
                    <div className="text-xs text-slate-700 space-y-1">
                      <div><span className="font-semibold">Official Record:</span> {m.rank} {m.name}</div>
                      <div><span className="font-semibold">Trade / Appt:</span> {m.trade} — {m.appointment} (Sec: {m.sectionCode})</div>
                      <div><span className="font-semibold">Current State:</span> {m.currentStatus}</div>
                      <div className="text-emerald-700 font-medium">✓ Verified match against unit manpower roll</div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-xs text-amber-700">
                  ⚠ No direct match found in unit manpower database for Army Number '{selectedUser.serviceNumber}'.
                  Requires manual verification by Commanding Officer.
                </div>
              )}
            </div>

            {/* Audit entries for this specific user */}
            <div className="mt-5">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                User Activity History
              </h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {auditLogs.filter(l => l.armyNumber === selectedUser.serviceNumber).length === 0 ? (
                  <div className="p-3 text-xs text-gray-500 text-center">No audit history for this user.</div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 text-gray-600">
                      <tr>
                        <th className="p-2">Time</th>
                        <th className="p-2">Action</th>
                        <th className="p-2">By</th>
                        <th className="p-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {auditLogs
                        .filter(l => l.armyNumber === selectedUser.serviceNumber)
                        .map(l => (
                          <tr key={l.id}>
                            <td className="p-2 whitespace-nowrap text-gray-500">{new Date(l.timestamp).toLocaleString()}</td>
                            <td className="p-2 font-semibold">{l.actionType}</td>
                            <td className="p-2">{l.performedBy}</td>
                            <td className="p-2 text-gray-600">{l.details}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMonitoringModule;
