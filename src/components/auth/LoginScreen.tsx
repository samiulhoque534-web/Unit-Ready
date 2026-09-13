import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { UserRole, ManpowerPersonnel } from '../../types';
import { 
  Shield, Key, Lock, Eye, EyeOff, ArrowRight, 
  CheckCircle2, User, Award, Hash, AlertCircle, Sparkles, Building,
  UserPlus, LogIn, ShieldCheck, Check, Clock, UserCheck
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { 
    loginWithIndividualCode,
    loginGeneralUser,
    registerGeneralUser
  } = useAuth();
  const { language } = useLanguage();

  // Mode: 'COMMAND' (CO/2IC/MOIC/QM/Operators) or 'GENERAL' (General Personnel)
  const [authMode, setAuthMode] = useState<'COMMAND' | 'GENERAL'>('COMMAND');

  // General User Mode: 'LOGIN' or 'REGISTER'
  const [generalMode, setGeneralMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Command Role Selection (Strictly 5 Allowed: CO, 2IC, MOIC, QM, Other Operator)
  const [selectedRole, setSelectedRole] = useState<'co' | '2ic' | 'moic' | 'qm' | 'other_operator'>('co');
  
  // Operator Customization (for 'other_operator')
  const [operatorType, setOperatorType] = useState<string>('Medicine Store Operator');
  const [customAppt, setCustomAppt] = useState<string>('Medicine Store Operator');
  const [personnelIdOrName, setPersonnelIdOrName] = useState<string>('Lt Col Tariqul Anam (BA-5421)');

  // Command Input code
  const [loginCode, setLoginCode] = useState<string>('');
  const [showCode, setShowCode] = useState<boolean>(false);

  // General User Login Inputs
  const [generalArmyNumber, setGeneralArmyNumber] = useState<string>('');
  const [generalPin, setGeneralPin] = useState<string>('');
  const [showGeneralPin, setShowGeneralPin] = useState<boolean>(false);

  // General User Registration Inputs
  const [regArmyNumber, setRegArmyNumber] = useState<string>('');
  const [regRank, setRegRank] = useState<string>('Soldier / Cpl');
  const [regFullName, setRegFullName] = useState<string>('');
  const [regCompany, setRegCompany] = useState<string>('Alpha Company');
  const [regPin, setRegPin] = useState<string>('');
  const [regConfirmPin, setRegConfirmPin] = useState<string>('');
  const [matchedPersonnel, setMatchedPersonnel] = useState<ManpowerPersonnel | null>(null);

  // Status & Rate Limiting
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Default Profiles Map
  const roleProfiles: Record<'co' | '2ic' | 'moic' | 'qm' | 'other_operator', { title: string; defaultCode: string; defaultIdName: string }> = {
    co: { title: 'Commanding Officer (CO)', defaultCode: '951001', defaultIdName: 'Lt Col Tariqul Anam (BA-5421)' },
    '2ic': { title: 'Second-in-Command (2IC)', defaultCode: '952002', defaultIdName: 'Maj Mahmudur Rahman (BA-6789)' },
    moic: { title: 'Medical Officer In-Charge (MOIC)', defaultCode: '953003', defaultIdName: 'Maj Dr. Farhana Yesmin (BA-8923)' },
    qm: { title: 'Quartermaster (QM)', defaultCode: '954004', defaultIdName: 'Maj Asaduzzaman (BA-7812)' },
    other_operator: { title: 'Medicine Store Operator', defaultCode: '955005', defaultIdName: 'WO Md. Mizanur Rahman (NO-40673)' }
  };

  useEffect(() => {
    let timer: any;
    if (lockoutSeconds > 0) {
      timer = setInterval(() => {
        setLockoutSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // Live Cross-Check of Army Number during Registration
  useEffect(() => {
    const checkManpower = async () => {
      const clean = regArmyNumber.replace(/\s+/g, '').toUpperCase();
      if (clean.length >= 3) {
        const personnel = await db.manpowerPersonnel.toArray();
        const found = personnel.find(p => {
          const norm = (p.baNo || p.personalNumber || '').replace(/\s+/g, '').toUpperCase();
          return norm === clean;
        });
        if (found) {
          setMatchedPersonnel(found);
          if (!regFullName) setRegFullName(found.name);
          if (!regRank || regRank === 'Soldier / Cpl') setRegRank(found.rank);
        } else {
          setMatchedPersonnel(null);
        }
      } else {
        setMatchedPersonnel(null);
      }
    };
    checkManpower();
  }, [regArmyNumber]);

  const handleRoleChange = (role: 'co' | '2ic' | 'moic' | 'qm' | 'other_operator') => {
    setSelectedRole(role);
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoginCode('');
    setPersonnelIdOrName(roleProfiles[role].defaultIdName);
  };

  const handleOperatorTypeChange = (type: string) => {
    setOperatorType(type);
    setCustomAppt(type);
    setLoginCode('');
    if (type === 'Medicine Store Operator') {
      setPersonnelIdOrName('WO Md. Mizanur Rahman (NO-40673)');
    } else if (type === 'MT / Vehicle Fleet Operator') {
      setPersonnelIdOrName('Sgt Kazi Nazmul (NO-30582)');
    } else if (type === 'Manpower & Parade State Operator') {
      setPersonnelIdOrName('Sgt Md. Rafiqul Islam (NO-20491)');
    } else if (type === 'Part-I Duty Roster Operator') {
      setPersonnelIdOrName('Cpl Shahidul Alam (NO-10293)');
    } else if (type === 'Medical Instruments & Equipment Operator') {
      setPersonnelIdOrName('Sgt Jahangir Alam (NO-50764)');
    }
  };

  // Submit Command & Operator Login
  const handleCommandLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      let roleToUse: UserRole = selectedRole;
      let apptToUse = roleProfiles[selectedRole].title;

      if (selectedRole === 'other_operator') {
        apptToUse = customAppt || operatorType;
        if (operatorType.includes('Medicine')) roleToUse = 'medicine_operator';
        else if (operatorType.includes('Vehicle') || operatorType.includes('MT')) roleToUse = 'vehicle_operator';
        else if (operatorType.includes('Manpower')) roleToUse = 'manpower_operator';
        else if (operatorType.includes('Duty')) roleToUse = 'duty_operator';
        else if (operatorType.includes('Instrument')) roleToUse = 'inst_equip_operator';
      }

      const res = await loginWithIndividualCode(roleToUse, loginCode, {
        appointmentTitle: apptToUse,
        fullName: personnelIdOrName,
        serviceNumber: personnelIdOrName
      });

      if (!res.success) {
        const newFailed = failedAttempts + 1;
        setFailedAttempts(newFailed);
        if (newFailed >= 5) {
          setLockoutSeconds(60);
          setErrorMessage('Too many failed attempts. Security cooldown active. Please wait 60 seconds.');
        } else {
          setErrorMessage(res.message);
        }
      } else {
        setFailedAttempts(0);
        setSuccessMessage(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit General User Login
  const handleGeneralLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await loginGeneralUser(generalArmyNumber, generalPin);
      if (!res.success) {
        const newFailed = failedAttempts + 1;
        setFailedAttempts(newFailed);
        if (newFailed >= 5) {
          setLockoutSeconds(60);
          setErrorMessage('Too many failed attempts. Security cooldown active. Please wait 60 seconds.');
        } else {
          setErrorMessage(res.message);
        }
      } else {
        setFailedAttempts(0);
        setSuccessMessage(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit General User Registration
  const handleGeneralRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (regPin !== regConfirmPin) {
      setErrorMessage('PINs do not match. Please re-enter your PIN accurately.');
      return;
    }

    if (regPin.length < 4) {
      setErrorMessage('PIN must be at least 4 digits long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerGeneralUser({
        armyNumber: regArmyNumber,
        rank: regRank,
        fullName: regFullName,
        subUnitCompany: regCompany,
        pin: regPin
      });

      if (!res.success) {
        setErrorMessage(res.message);
      } else {
        setSuccessMessage(res.message);
        setGeneralArmyNumber(regArmyNumber);
        setGeneralPin(regPin);
        setGeneralMode('LOGIN');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#14230E] via-[#0E1A09] to-[#14230E] text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#F59E0B] selection:text-black">
      {/* Top Unit Banner */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between py-2 border-b border-[#2D4A22]/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2D4A22] border border-[#4C7536] flex items-center justify-center text-[#F59E0B] shadow-md font-black text-xs">
            95 FA
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold tracking-wider text-white uppercase">
              95 Field Ambulance
            </h1>
            <p className="text-[10px] text-emerald-400 font-mono">
              UNIT-READY • Tactical Command & Medical Store Ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1C2E15] border border-[#3B5E2B] text-[10px] text-emerald-300 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            System Online
          </span>
        </div>
      </div>

      {/* Main Authentication Container */}
      <div className="max-w-lg w-full mx-auto my-auto py-6 space-y-4">
        {/* Navigation Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#1C2E15] rounded-2xl border border-[#3B5E2B] shadow-lg">
          <button
            type="button"
            onClick={() => {
              setAuthMode('COMMAND');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 ${
              authMode === 'COMMAND'
                ? 'bg-[#2D4A22] text-[#F59E0B] shadow-md border border-[#4C7536]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Command & Operator</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('GENERAL');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`py-2.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 ${
              authMode === 'GENERAL'
                ? 'bg-[#2D4A22] text-[#F59E0B] shadow-md border border-[#4C7536]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>General Personnel Access</span>
          </button>
        </div>

        {/* MODE 1: Command & Operator Login */}
        {authMode === 'COMMAND' && (
          <div className="bg-[#1C2E15]/90 border border-[#3B5E2B] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 backdrop-blur-md">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#F59E0B]" />
                Command & Section Access
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Authorized access for Commanding Officer, 2IC, MOIC, QM and Section Operators
              </p>
            </div>

            {/* Role Selection Tabs */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Select Authorized Role / Appointment
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(['co', '2ic', 'moic', 'qm', 'other_operator'] as const).map((r) => {
                  const isSelected = selectedRole === r;
                  const labelMap: Record<string, string> = {
                    co: 'CO (Command)',
                    '2ic': '2IC (Executive)',
                    moic: 'MOIC (Clinical)',
                    qm: 'QM (Logistics)',
                    other_operator: 'Section Operator'
                  };

                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRoleChange(r)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-[#2D4A22] border-[#F59E0B] text-white shadow-md'
                          : 'bg-[#14230E] border-[#2D4A22] text-slate-300 hover:border-[#4C7536]'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-mono text-emerald-400 font-bold">
                        {r.toUpperCase()}
                      </span>
                      <span className="text-xs font-bold mt-1 line-clamp-1">{labelMap[r]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleCommandLoginSubmit} className="space-y-4">
              {/* Operator Type Selection if 'other_operator' */}
              {selectedRole === 'other_operator' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Assigned Operational Section *
                  </label>
                  <select
                    value={operatorType}
                    onChange={(e) => handleOperatorTypeChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#14230E] border border-[#3B5E2B] text-white text-xs font-semibold focus:outline-none focus:border-[#F59E0B]"
                  >
                    <option value="Medicine Store Operator">Medicine Store Operator (FEFO / Expiry)</option>
                    <option value="MT / Vehicle Fleet Operator">MT / Vehicle Fleet Operator</option>
                    <option value="Manpower & Parade State Operator">Manpower & Parade State Operator</option>
                    <option value="Part-I Duty Roster Operator">Part-I Duty Roster Operator</option>
                    <option value="Medical Instruments & Equipment Operator">Medical Instruments & Equipment Operator</option>
                  </select>
                </div>
              )}

              {/* Personnel ID / Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Designated Officer / Operator Identifier
                </label>
                <input
                  type="text"
                  value={personnelIdOrName}
                  onChange={(e) => setPersonnelIdOrName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#14230E] border border-[#3B5E2B] text-white text-xs font-mono font-medium focus:outline-none focus:border-[#F59E0B]"
                  required
                />
              </div>

              {/* Enter Individual Access Code */}
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>Enter Individual Access Code *</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCode(!showCode)}
                    className="text-[10px] text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer font-mono"
                  >
                    {showCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showCode ? 'Hide' : 'Show'}</span>
                  </button>
                </label>
                <input
                  type={showCode ? 'text' : 'password'}
                  maxLength={6}
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  placeholder="Enter 6-digit access code (e.g. 951001)"
                  className="w-full px-4 py-3 rounded-xl bg-[#14230E] border-2 border-[#4C7536] text-white font-mono text-center text-lg font-extrabold tracking-widest focus:outline-none focus:border-[#F59E0B] shadow-inner"
                  required
                />
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || lockoutSeconds > 0}
                className="w-full py-3 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-black font-extrabold text-sm tracking-wider uppercase transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Shield className="w-4 h-4" />
                <span>
                  {lockoutSeconds > 0 
                    ? `Locked (${lockoutSeconds}s)` 
                    : isSubmitting 
                      ? 'Authenticating...' 
                      : 'Login to Section'}
                </span>
              </button>
            </form>
          </div>
        )}

        {/* MODE 2: Individual General User Access (Login / Register) */}
        {authMode === 'GENERAL' && (
          <div className="bg-[#1C2E15]/90 border border-[#3B5E2B] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-[#2D4A22]">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-400" />
                  {generalMode === 'LOGIN' ? 'Individual General User Login' : 'General User Account Registration'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Army Number & individual PIN authentication cross-checked against unit roll
                </p>
              </div>

              {/* Sub-tab toggle */}
              <div className="flex bg-[#14230E] p-1 rounded-xl border border-[#2D4A22]">
                <button
                  type="button"
                  onClick={() => {
                    setGeneralMode('LOGIN');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    generalMode === 'LOGIN' ? 'bg-[#2D4A22] text-[#F59E0B]' : 'text-slate-400'
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGeneralMode('REGISTER');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    generalMode === 'REGISTER' ? 'bg-[#2D4A22] text-[#F59E0B]' : 'text-slate-400'
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {/* Sub-form A: General User Login */}
            {generalMode === 'LOGIN' && (
              <form onSubmit={handleGeneralLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Army Number (Personal / BA / NO Number) *
                  </label>
                  <input
                    type="text"
                    value={generalArmyNumber}
                    onChange={(e) => setGeneralArmyNumber(e.target.value)}
                    placeholder="e.g. BA-10492 or NO-30482"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#14230E] border border-[#3B5E2B] text-white font-mono text-sm focus:outline-none focus:border-emerald-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Security PIN *</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowGeneralPin(!showGeneralPin)}
                      className="text-[10px] text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer font-mono"
                    >
                      {showGeneralPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showGeneralPin ? 'Hide' : 'Show'}</span>
                    </button>
                  </label>
                  <input
                    type={showGeneralPin ? 'text' : 'password'}
                    value={generalPin}
                    onChange={(e) => setGeneralPin(e.target.value)}
                    placeholder="Enter your security PIN"
                    className="w-full px-4 py-3 rounded-xl bg-[#14230E] border-2 border-[#4C7536] text-white font-mono text-center text-lg font-extrabold tracking-widest focus:outline-none focus:border-emerald-400 shadow-inner"
                    required
                  />
                </div>

                {/* Error Message */}
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Success Message */}
                {successMessage && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                    <span>{successMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || lockoutSeconds > 0}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm tracking-wider uppercase transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>
                    {lockoutSeconds > 0
                      ? `Locked (${lockoutSeconds}s)`
                      : isSubmitting
                      ? 'Authenticating...'
                      : 'Login as General User'}
                  </span>
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-slate-400">
                    Don't have an individual account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setGeneralMode('REGISTER');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-[#F59E0B] font-bold hover:underline"
                    >
                      Register Now
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* Sub-form B: General User Registration */}
            {generalMode === 'REGISTER' && (
              <form onSubmit={handleGeneralRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Army Number (BA / NO / Personal Number) *
                  </label>
                  <input
                    type="text"
                    value={regArmyNumber}
                    onChange={(e) => setRegArmyNumber(e.target.value)}
                    placeholder="e.g. BA-10492 or NO-30482"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#14230E] border border-[#3B5E2B] text-white font-mono text-sm focus:outline-none focus:border-emerald-400"
                    required
                  />
                  {/* Real-time cross check badge */}
                  {matchedPersonnel ? (
                    <div className="mt-1.5 p-2 rounded-lg bg-emerald-950/60 border border-emerald-500 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>
                        Verified in unit roll: <strong>{matchedPersonnel.rank} {matchedPersonnel.name}</strong> ({matchedPersonnel.trade})
                      </span>
                    </div>
                  ) : regArmyNumber.trim().length >= 3 ? (
                    <div className="mt-1.5 p-2 rounded-lg bg-amber-950/60 border border-amber-500 text-amber-300 text-xs flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>
                        Not in current unit roll snapshot. Account will require manual CO approval before login.
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Rank *
                    </label>
                    <input
                      type="text"
                      value={regRank}
                      onChange={(e) => setRegRank(e.target.value)}
                      placeholder="e.g. Cpl, Sgt, Maj"
                      className="w-full px-3 py-2 rounded-lg bg-[#14230E] border border-[#3B5E2B] text-white text-xs font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="e.g. Md. Rafiqul Islam"
                      className="w-full px-3 py-2 rounded-lg bg-[#14230E] border border-[#3B5E2B] text-white text-xs font-semibold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Sub-Unit / Company *
                  </label>
                  <select
                    value={regCompany}
                    onChange={(e) => setRegCompany(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#14230E] border border-[#3B5E2B] text-white text-xs font-semibold focus:outline-none focus:border-emerald-400"
                  >
                    <option value="HQ Company">HQ Company</option>
                    <option value="Alpha Company">Alpha Company</option>
                    <option value="Bravo Company">Bravo Company</option>
                    <option value="Ambulance Company">Ambulance Company</option>
                    <option value="Dental Detachment">Dental Detachment</option>
                    <option value="Medical Store Detachment">Medical Store Detachment</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Create PIN (min 4 digits) *
                    </label>
                    <input
                      type="password"
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value)}
                      placeholder="****"
                      className="w-full px-3 py-2 rounded-lg bg-[#14230E] border border-[#3B5E2B] text-white font-mono text-center text-base"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Confirm PIN *
                    </label>
                    <input
                      type="password"
                      value={regConfirmPin}
                      onChange={(e) => setRegConfirmPin(e.target.value)}
                      placeholder="****"
                      className="w-full px-3 py-2 rounded-lg bg-[#14230E] border border-[#3B5E2B] text-white font-mono text-center text-base"
                      required
                    />
                  </div>
                </div>

                {/* Error Message */}
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Success Message */}
                {successMessage && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                    <span>{successMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-black font-extrabold text-sm tracking-wider uppercase transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isSubmitting ? 'Registering...' : 'Register Individual Account'}</span>
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-slate-400">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setGeneralMode('LOGIN');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-emerald-400 font-bold hover:underline"
                    >
                      Back to Login
                    </button>
                  </p>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Footer Notice */}
      <div className="text-center text-[10px] text-emerald-500/70 font-mono py-2">
        <p>UNIT-READY • 95 FIELD AMBULANCE • INDIVIDUAL IDENTITY VERIFIED LEDGER</p>
      </div>
    </div>
  );
};

export default LoginScreen;
