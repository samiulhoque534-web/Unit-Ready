import React from 'react';
import { useAuth } from '../../context/AuthContext';

interface WatermarkOverlayProps {
  watermarkText?: string;
  extraText?: string;
}

export const WatermarkOverlay: React.FC<WatermarkOverlayProps> = ({ watermarkText, extraText }) => {
  const { currentUser, activeDevice } = useAuth();
  
  const text = watermarkText || extraText || `95 FD AMB — ${currentUser.appointmentTitle} — ${activeDevice.deviceName} — ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour12: false })}`;

  return (
    <div 
      className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center overflow-hidden select-none opacity-[0.08] dark:opacity-[0.05]"
      aria-hidden="true"
    >
      <div className="transform -rotate-25 text-center whitespace-nowrap space-y-8 font-mono font-black text-black dark:text-white">
        <p className="text-xl sm:text-2xl tracking-widest">{text}</p>
        <p className="text-xl sm:text-2xl tracking-widest">{text}</p>
        <p className="text-xl sm:text-2xl tracking-widest">{text}</p>
      </div>
    </div>
  );
};
