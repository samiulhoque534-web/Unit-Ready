import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { UserRole, ManpowerPersonnel } from '../../types';
import { 
  Shield, Lock, Eye, EyeOff,
  CheckCircle2, User, Award, Hash, AlertCircle, Building,
  UserPlus, LogIn, ShieldCheck, Clock, UserCheck
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { 
    loginWithIndividualCredentials,
    registerIndividualAccount
  } = useAuth();
  const { language } = useLanguage();

  // Active Tab: 'LOGIN' or 'REGISTER'
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login Form Inputs
  const [loginBaNumber, setLoginBaNumber] = useState<string>('');
  const [loginRank, setLoginRank] = useState<string>('');
  const [loginFullName, setLoginFullName] = useState<string>('');
  const [loginPin, setLoginPin] = useState<string>('');
  const [showLoginPin, setShowLoginPin] = useState<boolean>(false);

  // Registration Form Inputs
  const [regBaNumber, setRegBaNumber] = useState<string>('');
  const [regRank, setRegRank] = useState<string>('');
  const [regFullName, setRegFullName] = useState<string>('');
  const [regCompany, setRegCompany] = useState<string>('HQ Company');
  const [regRole, setRegRole] = useState<UserRole>('general_personnel');
  const [regPin, setRegPin] = useState<string>('');
  const [regConfirmPin, setRegConfirmPin] = useState<string>('');
  const [showRegPin, setShowRegPin] = useState<boolean>(false);

  // Live Personnel Cross-Check State
  const [regMatchedPersonnel, setRegMatchedPersonnel] = useState<ManpowerPersonnel | null>(null);
  const [loginMatchedPersonnel, setLoginMatchedPersonnel] = useState<ManpowerPersonnel | null>(null);

  // Status & Feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isVerificationPending, setIsVerificationPending] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Rate Limiting Timer
  useEffect(() => {
    let timer: any;
    if (lockoutSeconds > 0) {
      timer = setInterval(() => {
        setLockoutSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // Live Cross-Check for Registration BA Number
  useEffect(() => {
    const checkRegistrationBa = async () => {
      const clean = regBaNumber.replace(/\s+/g, '').toUpperCase();
      if (clean.length >= 3) {
        const personnel = await db.manpowerPersonnel.toArray();
        const found = personnel.find(p => {
          const norm = (p.baNo || p.personalNumber || '').replace(/\s+/g, '').toUpperCase();
          return norm === clean;
        });
        if (found) {
          setRegMatchedPersonnel(found);
          if (!regFullName) setRegFullName(found.name);
          if (!regRank) setRegRank(found.rank);
        } else {
          setRegMatchedPersonnel(null);
        }
      } else {
        setRegMatchedPersonnel(null);
      }
    };
    checkRegistrationBa();
  }, [regBaNumber]);

  // Live Cross-Check for Login BA Number
  useEffect(() => {
    const checkLoginBa = async () => {
      const clean = loginBaNumber.replace(/\s+/g, '').toUpperCase();
      if (clean.length >= 3) {
        const personnel = await db.manpowerPersonnel.toArray();
        const found = personnel.find(p => {
          const norm = (p.baNo || p.personalNumber || '').replace(/\s+/g, '').toUpperCase();
          return norm === clean;
        });
        if (found) {
          setLoginMatchedPersonnel(found);
          if (!loginRank) setLoginRank(found.rank);
          if (!loginFullName) setLoginFullName(found.name);
        } else {
          setLoginMatchedPersonnel(null);
        }
      } else {
        setLoginMatchedPersonnel(null);
      }
    };
    checkLoginBa();
  }, [loginBaNumber]);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsVerificationPending(false);
    setIsSubmitting(true);

    try {
      const res = await loginWithIndividualCredentials(
        loginBaNumber,
        loginRank,
        loginFullName,
        loginPin
      );

      if (res.success) {
        setSuccessMessage(res.message);
      } else {
        if (res.requiresVerification) {
          setIsVerificationPending(true);
        }
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsVerificationPending(false);

    if (regPin !== regConfirmPin) {
      setErrorMessage('PIN confirmation does not match. Please re-enter.');
      return;
    }

    if (regPin.length < 4) {
      setErrorMessage('Security PIN must be at least 4 digits.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await registerIndividualAccount({
        baNumber: regBaNumber,
        rank: regRank,
        fullName: regFullName,
        subUnitCompany: regCompany,
        role: regRole,
        pin: regPin
      });

      if (res.success) {
        setSuccessMessage(res.message);
        if (res.requiresVerification) {
          setIsVerificationPending(true);
        } else {
          // Pre-populate login form and switch
          setLoginBaNumber(regBaNumber);
          setLoginRank(regRank);
          setLoginFullName(regFullName);
          setLoginPin(regPin);
          setTimeout(() => {
            setActiveTab('LOGIN');
          }, 1500);
        }
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Registration failed. Please check your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D1809] via-[#14230E] to-[#1D3315] flex flex-col justify-center items-center p-4 font-sans text-white select-none">
      
      {/* Background Military Accents */}
      <div className="fixed inset-0 pointer-events-none opacity-5 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border-8 border-white" />
        <div className="absolute top-1/2 left-10 w-80 h-80 rounded-full border border-dashed border-white" />
        <div className="absolute -bottom-20 right-1/3 w-[500px] h-[500px] rounded-full border border-white" />
      </div>

      <div className="w-full max-w-lg relative z-10 space-y-5">

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3.5 bg-[#1E3316] border-2 border-[#4C7536] rounded-2xl shadow-xl">
            <ShieldCheck className="w-10 h-10 text-emerald-400" />
          </div>

          <div>
            <h1 className="text-3xl font-black tracking-wider uppercase text-white drop-shadow-md">
              UNIT-READY
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mt-0.5 font-mono">
              95 Field Ambulance • Individual Access System
            </p>
          </div>
        </div>

        {/* Tab Selector: Log In vs Create Account */}
        <div className="bg-[#1A2E13] p-1.5 rounded-2xl border border-[#3B5E2B] flex shadow-lg">
          <button
            type="button"
            onClick={() => {
              setActiveTab('LOGIN');
              setErrorMessage(null);
              setSuccessMessage(null);
              setIsVerificationPending(false);
            }}
            className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'LOGIN'
                ? 'bg-[#2D4A22] text-white shadow-md border border-[#4C7536]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Individual Login</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('REGISTER');
              setErrorMessage(null);
              setSuccessMessage(null);
              setIsVerificationPending(false);
            }}
            className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'REGISTER'
                ? 'bg-[#2D4A22] text-white shadow-md border border-[#4C7536]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Card Container */}
        <div className="bg-[#1A2E13]/90 backdrop-blur-md rounded-2xl border border-[#3B5E2B] p-6 shadow-2xl space-y-5">

          {/* TAB 1: INDIVIDUAL LOGIN */}
          {activeTab === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              
              {/* Personal BA Number */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Personal BA Number *</span>
                </label>
                <input
                  type="text"
                  value={loginBaNumber}
                  onChange={(e) => setLoginBaNumber(e.target.value.toUpperCase())}
                  placeholder="Enter your personal BA Number"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#14230E] border border-[#3B5E2B] text-white font-mono text-sm uppercase focus:outline-none focus:border-emerald-400"
                  required
                />
                {loginMatchedPersonnel && (
                  <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Roll Match: <strong>{loginMatchedPersonnel.rank} {loginMatchedPersonnel.name}</strong> ({loginMatchedPersonnel.trade})</span>
                  </div>
                )}
              </div>

              {/* Rank & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Rank *</span>
                  </label>
                  <input
                    type="text"
                    value={loginRank}
                    onChange={(e) => setLoginRank(e.target.value)}
                    placeholder="e.g. Lt Col, Maj, Sgt"
                    className="w-full px-3 py-2 rounded-lg bg-[#14230E] border border-[#3B5E2B] text-white text-xs font-semibold focus:outline-none focus:border-emerald-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Full Name *</span>
                  </label>
                  <input
                    type="text"
                    value={loginFullName}
                    onChange={(e) => setLoginFullName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full px-3 py-2 rounded-lg bg-[#14230E] border border-[#3B5E2B] text-white text-xs font-semibold focus:outline-none focus:border-emerald-400"
                    required
                  />
                </div>
              </div>

              {/* Personal PIN */}
              <div>
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Personal PIN *</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowLoginPin(!showLoginPin)}
                    className="text-[10px] text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer font-mono"
                  >
                    {showLoginPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showLoginPin ? 'Hide' : 'Show'}</span>
                  </button>
                </label>
                <input
                  type={showLoginPin ? 'text' : 'password'}
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  placeholder="Enter personal PIN"
                  className="w-full px-4 py-3 rounded-xl bg-[#14230E] border-2 border-[#4C7536] text-white font-mono text-center text-lg font-extrabold tracking-widest focus:outline-none focus:border-emerald-400 shadow-inner"
                  required
                />
              </div>

              {/* Verification Pending Alert Banner */}
              {isVerificationPending && (
                <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500 text-amber-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Identity Verification Pending</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-200/90">
                    Your details do not match the verified unit personnel database or your account is held for Commanding Officer review. Access will be unlocked upon CO command approval.
                  </p>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && !isVerificationPending && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || lockoutSeconds > 0}
                className="w-full py-3 rounded-xl bg-[#2D4A22] hover:bg-[#3B5E2B] text-white font-extrabold text-sm tracking-wider uppercase transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-[#4C7536]"
              >
                <LogIn className="w-4 h-4 text-emerald-400" />
                <span>
                  {lockoutSeconds > 0
                    ? `Locked (${lockoutSeconds}s)`
                    : isSubmitting
                    ? 'Verifying Identity...'
                    : 'Log In'}
                </span>
              </button>

              <div className="text-center pt-1">
                <p className="text-xs text-slate-400">
                  Need to register a personal account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('REGISTER');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setIsVerificationPending(false);
                    }}
                    className="text-[#F59E0B] font-bold hover:underline cursor-pointer"
                  >
                    Create Account
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* TAB 2: CREATE INDIVIDUAL ACCOUNT */}
          {activeTab === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              
              {/* Personal BA Number */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Personal BA Number *</span>
                </label>
                <input
                  type="text"
                  value={regBaNumber}
                  onChange={(e) => setRegBaNumber(e.target.value.toUpperCase())}
                  placeholder="Enter your unique personal BA Number"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#14230E] border border-[#3B5E2B] text-white font-mono text-sm uppercase focus:outline-none focus:border-emerald-400"
                  required
                />

                {/* Real-time cross-check status */}
                {regMatchedPersonnel ? (
                  <div className="mt-1.5 p-2 rounded-lg bg-emerald-950/60 border border-emerald-500 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Found in Personnel Roll: <strong>{regMatchedPersonnel.rank} {regMatchedPersonnel.name}</strong> ({regMatchedPersonnel.trade})
                    </span>
                  </div>
                ) : regBaNumber.trim().length >= 3 ? (
                  <div className="mt-1.5 p-2 rounded-lg bg-amber-950/60 border border-amber-500 text-amber-300 text-xs flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Not found in personnel roll snapshot. Account will be held for CO review with <strong>Identity Verification Pending</strong>.
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Rank & Full Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Rank *</span>
                  </label>
                  <input
                    type="text"
                    value={regRank}
                    onChange={(e) => setRegRank(e.target.value)}
                    placeholder="Enter rank"
                    className="w-full px-3 py-2 rounded-lg bg-[#14230E] border border-[#3B5E2B] text-white text-xs font-semibold focus:outline-none focus:border-emerald-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Full Name *</span>
                  </label>
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full px-3 py-2 rounded-lg bg-[#14230E] border border-[#3B5E2B] text-white text-xs font-semibold focus:outline-none focus:border-emerald-400"
                    required
                  />
                </div>
              </div>

              {/* Sub-Unit & Role Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sub-Unit / Company</span>
                  </label>
                  <select
                    value={regCompany}
                    onChange={(e) => setRegCompany(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#14230E] border border-[#3B5E2B] text-white text-xs font-semibold focus:outline-none focus:border-emerald-400"
                  >
                    <option value="HQ Company">HQ Company</option>
                    <option value="Medical Company">Medical Company</option>
                    <option value="A Company">A Company</option>
                    <option value="MT Platoon">MT Platoon</option>
                    <option value="EME Section">EME Section</option>
                    <option value="SMT Trade">SMT Trade</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Designated Role</span>
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-lg bg-[#14230E] border border-[#3B5E2B] text-white text-xs font-semibold focus:outline-none focus:border-emerald-400"
                  >
                    <option value="general_personnel">General Unit Personnel</option>
                    <option value="medicine_operator">Medicine Store Operator</option>
                    <option value="vehicle_operator">Vehicle Fleet / MT Operator</option>
                    <option value="manpower_operator">Manpower / Personnel Operator</option>
                    <option value="duty_operator">Duty Roster Operator</option>
                    <option value="inst_equip_operator">Instruments & Equipment Operator</option>
                    <option value="co">Commanding Officer (CO)</option>
                    <option value="2ic">Second-in-Command (2IC)</option>
                    <option value="moic">Medical Officer In-Charge (MOIC)</option>
                    <option value="qm">Quartermaster (QM)</option>
                  </select>
                </div>
              </div>

              {/* Security PIN & Confirmation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Set Personal PIN *</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowRegPin(!showRegPin)}
                      className="text-[10px] text-slate-300 hover:text-white cursor-pointer font-mono"
                    >
                      {showRegPin ? 'Hide' : 'Show'}
                    </button>
                  </label>
                  <input
                    type={showRegPin ? 'text' : 'password'}
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value)}
                    placeholder="Min 4 digits"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#14230E] border border-[#3B5E2B] text-white font-mono text-center text-sm font-bold tracking-widest focus:outline-none focus:border-emerald-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">
                    Confirm PIN *
                  </label>
                  <input
                    type={showRegPin ? 'text' : 'password'}
                    value={regConfirmPin}
                    onChange={(e) => setRegConfirmPin(e.target.value)}
                    placeholder="Re-enter PIN"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#14230E] border border-[#3B5E2B] text-white font-mono text-center text-sm font-bold tracking-widest focus:outline-none focus:border-emerald-400"
                    required
                  />
                </div>
              </div>

              {/* Status Messages */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Verification Notice Warning */}
              {isVerificationPending && (
                <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500 text-amber-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Identity Verification Pending</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-200/90">
                    Your account registration has been created and submitted. Because your BA Number/details did not match the unit roll or require command review, your account is held for Commanding Officer approval.
                  </p>
                </div>
              )}

              {/* Submit Registration Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm tracking-wider uppercase transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isSubmitting ? 'Registering...' : 'Register Individual Account'}</span>
              </button>

              <div className="text-center pt-1">
                <p className="text-xs text-slate-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('LOGIN');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setIsVerificationPending(false);
                    }}
                    className="text-[#F59E0B] font-bold hover:underline cursor-pointer"
                  >
                    Log In
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* Security Notice */}
          <div className="pt-3 border-t border-slate-800/80 text-[10px] text-slate-400 text-center font-mono leading-relaxed">
            RESTRICTED MILITARY SYSTEM • All login attempts, registrations and activity are cryptographically logged with permanent audit trail.
          </div>
        </div>
      </div>
    </div>
  );
};
