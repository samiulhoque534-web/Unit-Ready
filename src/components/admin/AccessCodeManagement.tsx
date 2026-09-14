import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { User, UserRole, SectionCode } from '../../types';
import { Modal } from '../common/Modal';
import { 
  Key, Shield, Plus, Copy, Printer, RefreshCw, 
  UserCheck, UserX, Search, CheckCircle2, AlertCircle, 
  Lock, Eye, EyeOff, ShieldAlert, Award, FileText, Check
} from 'lucide-react';

export const AccessCodeManagement: React.FC = () => {
  const { 
    currentUser, 
    createPersonnelAccount, 
    resetPersonnelAccessCode, 
    togglePersonnelAccountStatus 
  } = useAuth();
  const { t } = useLanguage();

  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({});

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newRole, setNewRole] = useState<UserRole>('other_operator');
  const [newAppt, setNewAppt] = useState<string>('Medicine Store Operator');
  const [newName, setNewName] = useState<string>('');
  const [newRank, setNewRank] = useState<string>('Sgt');
  const [newBaNo, setNewBaNo] = useState<string>('');
  const [newSection, setNewSection] = useState<SectionCode | 'all'>('Med');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Print Slip Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printUser, setPrintUser] = useState<User | null>(null);

  const isCO = currentUser.role === 'co' || currentUser.role === 'admin';

  const loadUsers = async () => {
    const allUsers = await db.users.toArray();
    // Exclude general viewer from code list
    const filtered = allUsers.filter(u => u.role !== 'general_viewer');
    setUsers(filtered);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const generateUnique6DigitCode = () => {
    let code = Math.floor(100000 + Math.random() * 900000).toString();
    while (users.some(u => u.loginCode === code || u.pin === code)) {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    }
    return code;
  };

  const handleOpenCreateModal = () => {
    setNewRole('other_operator');
    setNewAppt('Medicine Store Operator');
    setNewName('');
    setNewRank('Sgt');
    setNewBaNo('');
    setNewSection('Med');
    setGeneratedCode(generateUnique6DigitCode());
    setCreateSuccess(null);
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newBaNo.trim()) {
      setCreateError('Please enter both personnel name and Personal/BA number.');
      return;
    }

    const res = await createPersonnelAccount({
      role: newRole,
      appointmentTitle: newAppt || 'Section Operator',
      fullName: newName.trim(),
      rank: newRank,
      serviceNumber: newBaNo.trim(),
      sectionAssigned: newSection,
      loginCode: generatedCode,
      pin: generatedCode
    });

    if (res.success && res.user) {
      setCreateSuccess(`Account created successfully! Assigned Individual Access Code: ${generatedCode}`);
      await loadUsers();
      setTimeout(() => {
        setIsCreateModalOpen(false);
      }, 2000);
    } else {
      setCreateError(res.message);
    }
  };

  const handleCopyCode = (user: User) => {
    const code = user.loginCode || user.pin || '';
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedId(user.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handlePrintSlip = (user: User) => {
    setPrintUser(user);
    setIsPrintModalOpen(true);
  };

  const handleResetCode = async (user: User) => {
    const confirm = window.confirm(`Reset individual access code for ${user.appointmentTitle} (${user.fullName})? The previous code will become immediately invalid.`);
    if (!confirm) return;

    const res = await resetPersonnelAccessCode(user.id);
    if (res.success) {
      alert(`NEW ACCESS CODE ISSUED for ${user.appointmentTitle}: ${res.newCode}`);
      await loadUsers();
    } else {
      alert(res.message);
    }
  };

  const handleToggleStatus = async (user: User) => {
    const targetStatus = user.isActive === false || user.userStatus === 'DEACTIVATED' ? 'ACTIVE' : 'DEACTIVATED';
    const confirm = window.confirm(`Are you sure you want to ${targetStatus === 'ACTIVE' ? 'REACTIVATE' : 'DEACTIVATE'} access for ${user.appointmentTitle} (${user.fullName})?`);
    if (!confirm) return;

    const res = await togglePersonnelAccountStatus(user.id, targetStatus);
    if (res.success) {
      await loadUsers();
    } else {
      alert(res.message);
    }
  };

  const toggleShowCode = (userId: string) => {
    setShowCodes(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  if (!isCO) {
    return (
      <div className="bg-red-50 dark:bg-red-950/30 border border-red-500 rounded-xl p-8 text-center space-y-3 max-w-xl mx-auto my-10">
        <ShieldAlert className="w-12 h-12 text-red-600 mx-auto" />
        <h2 className="text-lg font-bold text-red-900 dark:text-red-200 uppercase">
          Access Restricted — Commanding Officer Authority Required
        </h2>
        <p className="text-xs text-red-700 dark:text-red-300">
          Access code management and credential generation can only be performed by the Commanding Officer (CO).
        </p>
      </div>
    );
  }

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    return (
      u.appointmentTitle?.toLowerCase().includes(term) ||
      u.fullName?.toLowerCase().includes(term) ||
      u.serviceNumber?.toLowerCase().includes(term) ||
      u.rank?.toLowerCase().includes(term)
    );
  });

  const activeCount = users.filter(u => u.isActive !== false && u.userStatus !== 'DEACTIVATED').length;
  const deactivatedCount = users.filter(u => u.isActive === false || u.userStatus === 'DEACTIVATED').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#2D4A22] text-[#F59E0B] flex items-center justify-center shadow-md">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                Individual Access-Code Management
              </h2>
              <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                CO Authority
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Create authorized personnel accounts, generate unique 6-digit access codes, reset credentials, print passes, and manage account statuses.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 bg-[#2D4A22] hover:bg-[#3B5E2B] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Create Personnel Account</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Authorized Accounts</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{users.length}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Active Access Accounts</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{activeCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase">Deactivated Accounts</p>
            <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{deactivatedCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
            <UserX className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 ml-2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by appointment, name, rank, or BA number..."
          className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none font-medium"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs text-slate-400 hover:text-slate-600 px-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Authorized Accounts Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Authorized Unit Accounts & Unique Access Codes ({filteredUsers.length})</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">
            Real-time Cloud Synchronized
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-3.5">Appointment & Section</th>
                <th className="p-3.5">Personnel Name & BA No</th>
                <th className="p-3.5 text-center">Unique Access Code</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5">Last Login</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-mono text-xs">
                    No authorized accounts match the search query.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isActive = u.isActive !== false && u.userStatus !== 'DEACTIVATED';
                  const code = u.loginCode || u.pin || '—';
                  const isVisible = showCodes[u.id];
                  const isCopied = copiedId === u.id;

                  return (
                    <tr 
                      key={u.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Appointment */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {u.appointmentTitle}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono uppercase mt-0.5">
                          Section: {u.sectionAssigned || 'All'} • Role: {u.role}
                        </div>
                      </td>

                      {/* Name & BA */}
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {u.rank ? `${u.rank} ` : ''}{u.fullName || 'Unit Personnel'}
                        </div>
                        <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                          {u.serviceNumber || 'BA-0000'}
                        </div>
                      </td>

                      {/* Unique Access Code */}
                      <td className="p-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-mono font-extrabold text-sm">
                          <span className="tracking-widest text-[#2D4A22] dark:text-amber-400">
                            {isVisible ? code : '••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleShowCode(u.id)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                            title={isVisible ? 'Hide code' : 'Show code'}
                          >
                            {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          isActive
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800'
                        }`}>
                          {isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                          <span>{isActive ? 'Active' : 'Deactivated'}</span>
                        </span>
                      </td>

                      {/* Last Login */}
                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                        {u.lastLoginAt ? (
                          u.lastLoginAt.includes('T') 
                            ? new Date(u.lastLoginAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
                            : u.lastLoginAt
                        ) : 'Never'}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Copy Code Button */}
                          <button
                            type="button"
                            onClick={() => handleCopyCode(u)}
                            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                            }`}
                            title="Copy unique access code"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Copy'}</span>
                          </button>

                          {/* Print Slip Button */}
                          <button
                            type="button"
                            onClick={() => handlePrintSlip(u)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Print access pass"
                          >
                            <Printer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span className="hidden sm:inline">Print</span>
                          </button>

                          {/* Reset Code Button */}
                          <button
                            type="button"
                            onClick={() => handleResetCode(u)}
                            className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Generate new unique 6-digit code"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Reset</span>
                          </button>

                          {/* Deactivate / Reactivate Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                              isActive
                                ? 'bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            }`}
                            title={isActive ? 'Deactivate account access' : 'Reactivate account access'}
                          >
                            {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{isActive ? 'Deactivate' : 'Reactivate'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Authorized Personnel Account */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Authorized Personnel Account"
        subtitle="Issue an official appointment account with a unique individual 6-digit access code."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs font-sans">
          {createError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-300 text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          {createSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{createSuccess}</span>
            </div>
          )}

          {/* Appointment Selection */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Appointment / Role *
            </label>
            <select
              value={newRole}
              onChange={(e) => {
                const r = e.target.value as UserRole;
                setNewRole(r);
                if (r === 'co') {
                  setNewAppt('Commanding Officer (CO)');
                  setNewRank('Lt Col');
                  setNewSection('all');
                } else if (r === '2ic') {
                  setNewAppt('Second-in-Command (2IC)');
                  setNewRank('Maj');
                  setNewSection('all');
                } else if (r === 'moic') {
                  setNewAppt('Medical Officer In-Charge (MOIC)');
                  setNewRank('Maj');
                  setNewSection('Med');
                } else if (r === 'qm') {
                  setNewAppt('Quartermaster (QM)');
                  setNewRank('Maj');
                  setNewSection('all');
                } else {
                  setNewAppt('Medicine Store Operator');
                  setNewRank('Sgt');
                  setNewSection('Med');
                }
              }}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
            >
              <option value="co">Commanding Officer (CO)</option>
              <option value="2ic">Second-in-Command (2IC)</option>
              <option value="moic">Medical Officer In-Charge (MOIC)</option>
              <option value="qm">Quartermaster (QM)</option>
              <option value="other_operator">Other Section Operator</option>
            </select>
          </div>

          {/* Appointment Title */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Appointment Title *
            </label>
            <input
              type="text"
              value={newAppt}
              onChange={(e) => setNewAppt(e.target.value)}
              placeholder="e.g. Medicine Store Operator, MT Fleet Operator, etc."
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold"
              required
            />
          </div>

          {/* Rank & Full Name */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Rank *
              </label>
              <select
                value={newRank}
                onChange={(e) => setNewRank(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
              >
                <option value="Lt Col">Lt Col</option>
                <option value="Maj">Maj</option>
                <option value="Capt">Capt</option>
                <option value="Lt">Lt</option>
                <option value="WO">WO</option>
                <option value="Sgt">Sgt</option>
                <option value="Cpl">Cpl</option>
                <option value="L/Cpl">L/Cpl</option>
                <option value="Sldr">Sldr</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Personnel Full Name *
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter personnel full name"
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold"
                required
              />
            </div>
          </div>

          {/* Personal ID / BA Number & Section */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Personal ID / BA Number *
              </label>
              <input
                type="text"
                value={newBaNo}
                onChange={(e) => setNewBaNo(e.target.value)}
                placeholder="e.g. BA-10492 or NO-30482"
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Assigned Section
              </label>
              <select
                value={newSection}
                onChange={(e) => setNewSection(e.target.value as any)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
              >
                <option value="all">All Sections (HQ Command)</option>
                <option value="Med">Medical Section (Med)</option>
                <option value="MT">Motor Transport (MT)</option>
                <option value="Admin">Administration & Quartermaster</option>
                <option value="Trg">Training Wing</option>
              </select>
            </div>
          </div>

          {/* Generated Unique Access Code Box */}
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-600" />
                <span>Generated 6-Digit Individual Access Code</span>
              </span>
              <button
                type="button"
                onClick={() => setGeneratedCode(generateUnique6DigitCode())}
                className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Regenerate</span>
              </button>
            </div>

            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-center">
              <span className="text-2xl font-black font-mono tracking-widest text-[#2D4A22] dark:text-amber-400">
                {generatedCode}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 text-center">
              This code is unique to this individual and guaranteed not to conflict with any other personnel in the unit.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white font-extrabold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save & Issue Access Code</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Print Official Access Authorization Slip */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="Individual Access Authorization Voucher"
        subtitle="Print or copy the official credential pass to provide directly to the authorized personnel."
        maxWidth="md"
      >
        {printUser && (
          <div className="p-5 space-y-4">
            {/* Printable Pass Container */}
            <div id="military-pass-slip" className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-400 dark:border-slate-600 shadow-inner text-slate-900 dark:text-white space-y-4 font-sans print:p-0 print:border-none">
              {/* Unit Crest & Title */}
              <div className="text-center border-b-2 border-slate-300 dark:border-slate-600 pb-3">
                <div className="w-10 h-10 mx-auto mb-1 rounded-xl bg-[#2D4A22] text-[#F59E0B] flex items-center justify-center shadow">
                  <Shield className="w-5 h-5" />
                </div>
                <h2 className="font-black text-sm uppercase tracking-widest text-[#2D4A22] dark:text-emerald-400">
                  95 Field Ambulance
                </h2>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  UNIT-READY Tactical Information Station
                </p>
                <h3 className="text-xs font-extrabold uppercase mt-1 text-slate-800 dark:text-slate-100 bg-slate-200 dark:bg-slate-700/60 py-0.5 rounded">
                  INDIVIDUAL ACCESS AUTHORIZATION PASS
                </h3>
              </div>

              {/* Personnel Metadata */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 py-1">
                  <span className="text-slate-500 font-bold uppercase">Appointment:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{printUser.appointmentTitle}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 py-1">
                  <span className="text-slate-500 font-bold uppercase">Name & Rank:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{printUser.rank} {printUser.fullName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 py-1">
                  <span className="text-slate-500 font-bold uppercase">BA / Personal ID:</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">{printUser.serviceNumber}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 py-1">
                  <span className="text-slate-500 font-bold uppercase">Assigned Section:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{printUser.sectionAssigned || 'All'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 py-1">
                  <span className="text-slate-500 font-bold uppercase">Issued By:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">Commanding Officer (CO)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-bold uppercase">Date of Issue:</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">{new Date().toLocaleDateString('en-GB')}</span>
                </div>
              </div>

              {/* Access Code Highlight Box */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border-2 border-dashed border-[#2D4A22] dark:border-amber-500 text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                  Your Secret Individual 6-Digit Access Code
                </p>
                <div className="text-3xl font-black font-mono tracking-widest text-[#2D4A22] dark:text-amber-400">
                  {printUser.loginCode || printUser.pin || '—'}
                </div>
              </div>

              {/* Confidential Security Warning */}
              <div className="text-[9px] text-slate-500 dark:text-slate-400 text-center font-mono leading-tight pt-1">
                CONFIDENTIAL: For authorized military personnel only. Do not disclose or transmit this code via open channels. Keep strictly confidential.
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const c = printUser.loginCode || printUser.pin || '';
                  if (c) {
                    navigator.clipboard.writeText(c);
                    alert('Access Code copied to clipboard!');
                  }
                }}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5 hover:bg-slate-200 transition cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Code</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white font-extrabold flex items-center gap-1.5 shadow transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Pass Slip</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
