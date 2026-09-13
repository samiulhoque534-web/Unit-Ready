import React, { useState, useEffect } from 'react';
import { SmsPayload, DEFAULT_UNIT_PHONE } from '../../services/smsService';
import { Smartphone, CheckCircle, X, Bell, UploadCloud, Edit3, ShieldAlert, FileText } from 'lucide-react';

export const SmsNotificationToast: React.FC = () => {
  const [activeSms, setActiveSms] = useState<SmsPayload | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    const handleSmsEvent = (e: any) => {
      const payload: SmsPayload = e.detail;
      setActiveSms(payload);
      setIsVisible(true);

      // Play subtle notification tone if browser allows
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } catch (err) {
        // audio context blocked by browser policy
      }

      // Auto dismiss after 6 seconds
      const timeout = setTimeout(() => {
        setIsVisible(false);
      }, 6000);

      return () => clearTimeout(timeout);
    };

    window.addEventListener('95fa_sms_notification', handleSmsEvent);
    return () => {
      window.removeEventListener('95fa_sms_notification', handleSmsEvent);
    };
  }, []);

  if (!isVisible || !activeSms) return null;

  const getIcon = () => {
    switch (activeSms.eventType) {
      case 'FILE_UPLOAD':
        return <UploadCloud className="w-5 h-5 text-emerald-400" />;
      case 'EDIT_REQUEST':
      case 'CORRECTION':
        return <Edit3 className="w-5 h-5 text-amber-400" />;
      case 'APPROVAL':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'NOTICE':
        return <FileText className="w-5 h-5 text-blue-400" />;
      default:
        return <Smartphone className="w-5 h-5 text-[#F59E0B]" />;
    }
  };

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm w-full bg-[#1E3316] text-white p-4 rounded-xl shadow-2xl border-2 border-[#F59E0B] animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="p-2 rounded-lg bg-[#2D4A22] border border-[#3B5E2B] flex-shrink-0">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="bg-[#F59E0B] text-black font-extrabold font-mono text-[9px] px-1.5 py-0.2 rounded uppercase tracking-wider">
              SMS DISPATCH
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-300 truncate">
              {activeSms.recipientPhone || DEFAULT_UNIT_PHONE}
            </span>
          </div>

          <h4 className="font-bold text-xs text-white leading-tight">
            {activeSms.title}
          </h4>
          <p className="text-[11px] text-slate-300 mt-1 leading-snug break-words">
            {activeSms.message}
          </p>

          <div className="mt-2 pt-2 border-t border-[#3B5E2B] flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>By: {activeSms.sender}</span>
            <span>{new Date(activeSms.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        <button
          onClick={() => setIsVisible(false)}
          className="text-slate-400 hover:text-white p-1 rounded transition flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
