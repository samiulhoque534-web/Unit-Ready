import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { CorrectionRequest } from '../../types';
import { Modal } from './Modal';
import { logAuditEvent } from '../../services/auditService';
import { sendPhoneSmsAlert, DEFAULT_UNIT_PHONE } from '../../services/smsService';
import { Edit3, Lock, ShieldAlert, Paperclip, Send, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

interface RequestCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordTypeOrDate: string;
  initialField?: string;
  initialExistingValue?: string;
  availableFields?: { name: string; label: string; currentValue?: string }[];
  onSuccess?: (newRequest: CorrectionRequest) => void;
}

export const RequestCorrectionModal: React.FC<RequestCorrectionModalProps> = ({
  isOpen,
  onClose,
  recordTypeOrDate,
  initialField = '',
  initialExistingValue = '',
  availableFields = [],
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const { t, language } = useLanguage();

  const [selectedField, setSelectedField] = useState<string>(initialField);
  const [customFieldName, setCustomFieldName] = useState<string>('');
  const [existingValue, setExistingValue] = useState<string>(initialExistingValue);
  const [proposedValue, setProposedValue] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [attachmentDataUrl, setAttachmentDataUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedField(initialField || (availableFields.length > 0 ? availableFields[0].name : ''));
      setExistingValue(initialExistingValue || (availableFields.length > 0 ? availableFields[0].currentValue || '' : ''));
      setProposedValue('');
      setReason('');
      setAttachmentName('');
      setAttachmentDataUrl('');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialField, initialExistingValue, availableFields]);

  const handleFieldChange = (fieldName: string) => {
    setSelectedField(fieldName);
    const matched = availableFields.find(f => f.name === fieldName);
    if (matched && matched.currentValue !== undefined) {
      setExistingValue(matched.currentValue);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Attachment file size exceeds 5MB limit.');
      return;
    }

    setAttachmentName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const finalField = selectedField === 'CUSTOM' ? customFieldName.trim() : selectedField.trim();

    if (!finalField) {
      setErrorMessage(language === 'bn' ? 'সংশোধনযোগ্য ফিল্ড নির্দিষ্ট করুন।' : 'Field to be corrected is required.');
      return;
    }
    if (!proposedValue.trim()) {
      setErrorMessage(language === 'bn' ? 'প্রস্তাবিত সংশোধিত মান লিখুন।' : 'Proposed corrected value is required.');
      return;
    }
    if (!reason.trim()) {
      setErrorMessage(language === 'bn' ? 'সংশোধনের কারণ লিখুন।' : 'Reason for correction is mandatory.');
      return;
    }

    setIsSubmitting(true);

    try {
      const nowIso = new Date().toISOString();
      const referenceNo = `CORR/95FA/${new Date().getFullYear()}/${Date.now().toString().slice(-4)}`;

      const newReq: CorrectionRequest = {
        id: 'corr-' + Date.now(),
        referenceNo,
        recordTypeOrDate: recordTypeOrDate.trim(),
        targetFieldName: finalField,
        existingValue: existingValue.trim() || '—',
        proposedCorrectedValue: proposedValue.trim(),
        reason: reason.trim(),
        attachmentName: attachmentName || undefined,
        attachmentDataUrl: attachmentDataUrl || undefined,
        requestedByUserId: currentUser.id,
        requestedByAppointment: currentUser.appointmentTitle,
        requestedAt: nowIso,
        status: 'PENDING_CO'
      };

      await db.correctionRequests.add(newReq);

      // Create in-app notification for CO & Command Authority
      await db.notifications.add({
        id: 'notif-' + Date.now(),
        title: `Correction Request: ${recordTypeOrDate}`,
        message: `${currentUser.appointmentTitle} submitted a correction request for [${finalField}]. Reason: ${reason}`,
        type: 'WARNING',
        section: 'correction',
        timestamp: nowIso,
        isRead: false,
        targetPath: '/corrections'
      });

      // Audit Log
      await logAuditEvent(
        currentUser,
        'CORRECTION_REQUESTED',
        'correction',
        newReq.referenceNo,
        `Submitted formal correction request directly to Commanding Officer for locked record [${recordTypeOrDate}] field [${finalField}]. Reason: ${reason}`
      );

      // SMS Dispatch to 95 Fd Amb CO
      await sendPhoneSmsAlert(
        `Correction Request: ${newReq.referenceNo}`,
        `Operator ${currentUser.appointmentTitle} requested edit permission for [${recordTypeOrDate} - ${finalField}]. Reason: ${reason}`,
        'CORRECTION',
        currentUser.appointmentTitle,
        DEFAULT_UNIT_PHONE
      );

      alert(`CORRECTION REQUEST SUBMITTED: Request ${referenceNo} has been forwarded directly to the Commanding Officer. The original record remains locked until CO approval.`);

      if (onSuccess) {
        onSuccess(newReq);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit correction request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Official Record Correction" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Banner */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider block">
              CO Command-Lock Security Control
            </span>
            <p className="mt-0.5 text-[11px] leading-relaxed">
              This record is locked under CO final approval. Your request will go directly to the Commanding Officer. If approved, only the requested field will be unlocked for limited correction.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-100 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-xl text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Record / Report Name & Date (Read-Only) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Record / Report Name & Date (Locked)</span>
          </label>
          <input
            type="text"
            value={recordTypeOrDate}
            readOnly
            className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 cursor-not-allowed"
          />
        </div>

        {/* 2. Field to be Corrected */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Field Requiring Correction *
          </label>
          {availableFields.length > 0 ? (
            <div className="space-y-2">
              <select
                value={selectedField}
                onChange={(e) => handleFieldChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
              >
                {availableFields.map(f => (
                  <option key={f.name} value={f.name}>
                    {f.label}
                  </option>
                ))}
                <option value="CUSTOM">Other / Specific Field (Custom Entry)...</option>
              </select>
              {selectedField === 'CUSTOM' && (
                <input
                  type="text"
                  value={customFieldName}
                  onChange={(e) => setCustomFieldName(e.target.value)}
                  placeholder="Type specific field name (e.g. Authorized Strength / SMT Oxygen Cylinder)..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  required
                />
              )}
            </div>
          ) : (
            <input
              type="text"
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value)}
              placeholder="e.g. Food Menu, Tomorrow Activities, Quantity, Serviceability Status..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
              required
            />
          )}
        </div>

        {/* 3. Existing Value (Read-Only) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Existing Value (Current Approved Entry)
          </label>
          <textarea
            value={existingValue}
            onChange={(e) => setExistingValue(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300"
            placeholder="Current approved value in record..."
          />
        </div>

        {/* 4. Proposed Corrected Value */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Proposed Corrected Value *
          </label>
          <textarea
            value={proposedValue}
            onChange={(e) => setProposedValue(e.target.value)}
            rows={2}
            placeholder="Enter the proposed new / corrected value..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:border-[#2D4A22]"
            required
          />
        </div>

        {/* 5. Reason for Correction */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Reason for Correction *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="State clinical, logistical, or administrative justification for this correction..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:border-[#2D4A22]"
            required
          />
        </div>

        {/* 6. Optional Supporting Document */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Paperclip className="w-3.5 h-3.5 text-slate-500" />
              <span>Supporting Document (Optional)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">PDF, JPG, PNG (Max 5MB)</span>
          </label>
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={handleFileUpload}
            className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#2D4A22] file:text-white hover:file:bg-[#3B5E2B] cursor-pointer"
          />
          {attachmentName && (
            <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
              Attached: {attachmentName}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Submitting...' : 'Submit to Commanding Officer'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
