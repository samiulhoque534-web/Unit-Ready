import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { UserRole } from '../../types';
import { 
  Shield, Key, Lock, Eye, EyeOff, ArrowRight, 
  CheckCircle2, User, Award, Hash, AlertCircle, Sparkles, Building 
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { 
    loginWithIndividualCode,
    loginAsGeneralViewer
  } = useAuth();
  const { language } = useLanguage();

  // Role Selection (Strictly 5 Allowed: CO, 2IC, MOIC, QM, Other Operator)
  const [selectedRole, setSelectedRole] = useState<'co' | '2ic' | 'moic' | 'qm' | 'other_operator'>('co');
  
  // Operator Customization (for 'other_operator')
  const [operatorType, setOperatorType] = useState<string>('Medicine Store Operator');
  const [customAppt, setCustomAppt] = useState<string>('Medicine Store Operator');
  const [personnelIdOrName, setPersonnelIdOrName] = useState<string>('Lt Col Tariqul Anam (BA-5421)');

  // Input code & security (Always blank by default - No auto-fill)
  const [loginCode, setLoginCode] = useState<string>('');
  const [showCode, setShowCode] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Rate Limiting Security
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

  const handleRoleChange = (role: 'co' | '2ic' | 'moic' | 'qm' | 'other_operator') => {
    setSelectedRole(role);
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoginCode(''); // Always keep password field blank
    setPersonnelIdOrName(roleProfiles[role].defaultIdName);
  };

  const handleOperatorTypeChange = (type: string) => {
    setOperatorType(type);
    setCustomAppt(type);
    setLoginCode(''); // Always keep password field blank
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
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

  const handleGeneralViewerLogin = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await loginAsGeneralViewer();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#14230E] via-[#0E1A09] to-[#14230E] text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#F59E0B] selection:text-black">
      {/* Top Unit Banner */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between py-2 border-b border-[#2D4A22]/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2D4A22] border border-[#4C7536] flex items-center justify-center text-[#F59E0B] shadow-md">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base tracking-wider uppercase text-white">95 Field Ambulance</h1>
            <p className="text-[11px] text-emerald-400 font-mono">UNIT-READY Tactical Station</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono bg-[#2D4A22] text-emerald-300 px-3 py-1 rounded-full border border-[#4C7536]">
            {language === 'bn' ? 'ব্যক্তিগত অ্যাক্সেস কোড প্রমাণীকরণ' : 'Individual Access Code Authentication'}
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-xl w-full mx-auto my-6 space-y-5">
        {/* Card: Authorized Individual Login */}
        <div className="bg-[#1C2E15]/95 border-2 border-[#3B5E2B] rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-sm">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-[#2D4A22] border border-[#4C7536] text-[#F59E0B] shadow-inner mb-2">
              <Key className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-extrabold text-white tracking-wide uppercase">
              {language === 'bn' ? 'অনুমোদিত ইউজার লগইন' : 'Authorized Personnel Login'}
            </h2>
            <p className="text-xs text-emerald-400/80 mt-0.5 font-mono">
              {language === 'bn' ? 'আপনার ব্যক্তিগত ৬-সংখ্যার অ্যাক্সেস কোড দিয়ে প্রবেশ করুন' : 'Login with your assigned individual 6-digit access code'}
            </p>
          </div>

          {/* 5 Clean Role Selector Buttons */}
          <div className="mb-5">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
              Select Appointment *
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {(['co', '2ic', 'moic', 'qm', 'other_operator'] as const).map((r) => {
                const isSelected = selectedRole === r;
                const labels: Record<string, string> = {
                  co: 'CO',
                  '2ic': '2IC',
                  moic: 'MOIC',
                  qm: 'QM',
                  other_operator: 'Other Operator'
                };
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRoleChange(r)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-extrabold transition-all border text-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#F59E0B] text-black border-[#F59E0B] shadow-md scale-105'
                        : 'bg-[#2D4A22]/70 text-slate-200 border-[#4C7536]/60 hover:bg-[#3B5E2B]'
                    }`}
                  >
                    {labels[r]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* If 'Other Operator' selected, show operator appointment selector */}
          {selectedRole === 'other_operator' && (
            <div className="p-4 rounded-xl bg-[#2D4A22]/40 border border-[#4C7536] mb-5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#F59E0B] uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Operator Appointment Assignment</span>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                  Select Section Appointment
                </label>
                <select
                  value={operatorType}
                  onChange={(e) => handleOperatorTypeChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#14230E] border border-[#4C7536] text-white text-xs font-semibold"
                >
                  <option value="Medicine Store Operator">Medicine Store Operator</option>
                  <option value="MT / Vehicle Fleet Operator">MT / Vehicle Fleet Operator</option>
                  <option value="Manpower & Parade State Operator">Manpower & Parade State Operator</option>
                  <option value="Part-I Duty Roster Operator">Part-I Duty Roster Operator</option>
                  <option value="Medical Instruments & Equipment Operator">Medical Instruments & Equipment Operator</option>
                </select>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Enter Personnel ID/Name */}
            <div>
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Enter Personnel ID/Name *</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400">
                  {selectedRole === 'other_operator' ? customAppt : roleProfiles[selectedRole].title}
                </span>
              </label>
              <input
                type="text"
                value={personnelIdOrName}
                onChange={(e) => setPersonnelIdOrName(e.target.value)}
                placeholder="e.g. Lt Col Tariqul Anam (BA-5421)"
                className="w-full px-4 py-2.5 rounded-xl bg-[#14230E] border border-[#4C7536] text-white font-sans text-xs font-bold focus:outline-none focus:border-[#F59E0B]"
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
                    : 'Login'}
              </span>
            </button>
          </form>
        </div>

        {/* Card: 1-Click General Viewer Entry (No Code Required) */}
        <div className="bg-[#1C2E15]/80 border border-[#3B5E2B] rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-11 h-11 rounded-xl bg-[#2D4A22] border border-[#4C7536] flex items-center justify-center text-emerald-400 flex-shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">
                {language === 'bn' ? 'সাধারণ ভিউয়ার (শুধুমাত্র পাঠযোগ্য)' : 'General Viewer Access'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {language === 'bn' 
                  ? 'কোনো কোড ছাড়াই অনুমোদিত প্যারেড স্টেট, যানবাহন, মেডিকেল তথ্য ও নোটিশ দেখুন' 
                  : 'Enter with read-only access to published information without an access code.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGeneralViewerLogin}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2D4A22] hover:bg-[#3B5E2B] text-emerald-200 hover:text-white font-extrabold text-xs tracking-wider uppercase transition border border-[#4C7536] flex items-center justify-center gap-2 shadow cursor-pointer whitespace-nowrap"
          >
            <span>Enter as General Viewer</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Footer Notice */}
      <div className="text-center text-[10px] text-emerald-500/70 font-mono py-2">
        <p>UNIT-READY • 95 FIELD AMBULANCE • SECURE TACTICAL INTEL & LOGISTICS</p>
      </div>
    </div>
  );
};
