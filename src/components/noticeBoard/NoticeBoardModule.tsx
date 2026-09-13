import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { DutyRoster, RosterAcknowledgement } from '../../types';
import { WatermarkOverlay } from '../common/WatermarkOverlay';
import { Modal } from '../common/Modal';
import { logAuditEvent } from '../../services/auditService';
import { 
  Shield, CheckCircle, Clock, FileText, 
  Eye, CheckSquare, Download, AlertCircle, Lock 
} from 'lucide-react';

export const NoticeBoardModule: React.FC = () => {
  const { currentUser, activeDevice } = useAuth();
  const { t, formatNumber } = useLanguage();

  const [publishedRosters, setPublishedRosters] = useState<DutyRoster[]>([]);
  const [selectedRoster, setSelectedRoster] = useState<DutyRoster | null>(null);
  const [acknowledgements, setAcknowledgements] = useState<RosterAcknowledgement[]>([]);
  const [hasAcknowledged, setHasAcknowledged] = useState<boolean>(false);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);

  const loadData = async () => {
    // Air-gapped constraint: strictly ONLY load CO-approved & published records
    const all = await db.dutyRosters.toArray();
    const approved = all.filter(r => r.status === 'CO_APPROVED' && r.isPublished);
    setPublishedRosters(approved.sort((a, b) => new Date(b.dutyDate).getTime() - new Date(a.dutyDate).getTime()));

    const acks = await db.rosterAcknowledgements.toArray();
    setAcknowledgements(acks);
  };

  useEffect(() => {
    loadData();
  }, []);

  const checkUserAck = (rosterId: string) => {
    return acknowledgements.some(a => a.rosterId === rosterId && a.userId === currentUser.id);
  };

  const handleOpenRoster = (roster: DutyRoster) => {
    setSelectedRoster(roster);
    setHasAcknowledged(checkUserAck(roster.id));
    setIsViewerOpen(true);
    logAuditEvent(currentUser, 'ROSTER_ACKNOWLEDGED', 'notice_board', roster.referenceNo, `Viewed published duty roster: ${roster.title}`);
  };

  const handleAcknowledge = async () => {
    if (!selectedRoster) return;

    const newAck: RosterAcknowledgement = {
      id: 'ack-' + Date.now(),
      rosterId: selectedRoster.id,
      userId: currentUser.id,
      userAppointment: currentUser.appointmentTitle,
      role: currentUser.role,
      deviceId: activeDevice.id,
      deviceName: activeDevice.deviceName,
      documentVersion: selectedRoster.version,
      acknowledgedAt: new Date().toISOString(),
      statement: 'I HAVE READ AND ACKNOWLEDGED'
    };

    await db.rosterAcknowledgements.add(newAck);
    setAcknowledgements(prev => [...prev, newAck]);
    setHasAcknowledged(true);

    await logAuditEvent(
      currentUser,
      'ROSTER_ACKNOWLEDGED',
      'notice_board',
      selectedRoster.referenceNo,
      `User ${currentUser.appointmentTitle} signed formal acknowledgement for ${selectedRoster.referenceNo} on device ${activeDevice.deviceName}`
    );

    alert('ACKNOWLEDGEMENT RECORDED: Your compliance statement has been securely logged to the 95 Fd Amb audit register.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              {t('nav_noticeBoard')} (Air-Gapped Display)
            </h2>
            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold text-[10px] px-2 py-0.5 rounded border border-emerald-300">
              CO APPROVED ONLY
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict Air-Gap Integrity: Unapproved, returned or draft orders are completely blocked from this board.
          </p>
        </div>
      </div>

      {/* Published Rosters Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {publishedRosters.length === 0 ? (
          <div className="col-span-2 bg-white dark:bg-slate-900 p-8 rounded-xl text-center border border-dashed border-slate-300 dark:border-slate-700">
            <Lock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">No Published Orders Available</h3>
            <p className="text-xs text-slate-500 mt-1">
              Part-I Duty Rosters will appear here automatically once Commanding Officer (CO) grants final approval.
            </p>
          </div>
        ) : (
          publishedRosters.map((roster) => {
            const isAck = checkUserAck(roster.id);
            return (
              <div 
                key={roster.id}
                className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-[#3B5E2B] transition"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="bg-[#2D4A22] text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                      {roster.referenceNo}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Published: {formatNumber(roster.publishedAt?.substring(0, 16).replace('T', ' ') || '')}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mt-3">
                    {roster.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    Duty Date: <strong className="text-[#2D4A22] dark:text-emerald-400">{formatNumber(roster.dutyDate)}</strong> | Access: {roster.accessLevel}
                  </p>

                  <div className="mt-4 p-3 rounded-lg bg-[#F8F9F5] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">Your Acknowledgement:</span>
                    {isAck ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 font-mono text-[11px]">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>ACKNOWLEDGED</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-bold font-mono text-[11px] animate-pulse">
                        PENDING ACKNOWLEDGEMENT
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    onClick={() => handleOpenRoster(roster)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold transition flex items-center gap-1.5 shadow"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View & Acknowledge</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* In-App Viewer Modal with Dynamic Security Watermark */}
      <Modal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        title={selectedRoster?.title || 'Notice Board Order'}
        subtitle={`Official Document Ref: ${selectedRoster?.referenceNo} | HQ 95 Field Ambulance`}
      >
        <div className="space-y-4">
          <div className="relative border-2 border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800 p-6 min-h-[320px] text-xs font-sans">
            <WatermarkOverlay 
              watermarkText={`95 FD AMB — ${currentUser.appointmentTitle} — ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour12: false })}`} 
            />

            <div className="text-center pb-4 border-b border-slate-300 dark:border-slate-700">
              <span className="text-[10px] font-mono uppercase bg-[#2D4A22] text-white px-2 py-0.5 rounded">
                RESTRICTED — UNIT INTERNAL ORDER
              </span>
              <h3 className="font-extrabold text-sm sm:text-base tracking-wider text-[#2D4A22] dark:text-emerald-400 mt-2">
                HEADQUARTERS, 95 FIELD AMBULANCE
              </h3>
              <p className="font-bold text-slate-800 dark:text-slate-100">{selectedRoster?.title}</p>
              <p className="font-mono text-[10px] text-slate-500">Effective: {selectedRoster?.effectiveFrom} to {selectedRoster?.effectiveUntil}</p>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex justify-between p-2 rounded bg-white dark:bg-slate-900 border">
                <span>Duty Medical Officer (DMO):</span>
                <strong>Medical Officer On Call</strong>
              </div>
              <div className="flex justify-between p-2 rounded bg-white dark:bg-slate-900 border">
                <span>Duty NCO:</span>
                <strong>Senior Sergeant</strong>
              </div>
              <div className="flex justify-between p-2 rounded bg-white dark:bg-slate-900 border">
                <span>Standby Ambulance Driver:</span>
                <strong>SMT Special Driver</strong>
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Official Compliance Requirement:
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Logging your acknowledgement records your appointment, hardware device, and Asia/Dhaka timestamp to the audit trail.
              </p>
            </div>

            {hasAcknowledged ? (
              <span className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow">
                <CheckCircle className="w-4 h-4" />
                <span>ACKNOWLEDGED</span>
              </span>
            ) : (
              <button
                onClick={handleAcknowledge}
                className="px-4 py-2 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-black font-extrabold text-xs flex items-center gap-1.5 shadow-md transition animate-pulse"
              >
                <CheckSquare className="w-4 h-4" />
                <span>{t('action_acknowledge')}</span>
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
