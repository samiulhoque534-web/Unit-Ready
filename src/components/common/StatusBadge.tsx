import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { ApprovalStatus } from '../../types';

interface StatusBadgeProps {
  status: ApprovalStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const { t } = useLanguage();

  const getBadgeStyle = () => {
    switch (status) {
      case 'DRAFT':
        return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
      case 'SUBMITTED':
      case 'PENDING_2IC_REVIEW':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300';
      case '2IC_APPROVED':
      case 'TWO_IC_RECOMMENDED':
      case 'TWO_IC_REVERIFIED':
        return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300';
      case 'PENDING_QM':
      case 'PENDING_MOIC':
      case 'PENDING_CO_APPROVAL':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300';
      case 'QM_APPROVED':
      case 'MOIC_APPROVED':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300';
      case 'CO_APPROVED':
      case 'LOCKED':
      case 'CO_APPROVED_LOCKED':
        return 'bg-emerald-100 text-emerald-900 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300 font-black';
      case 'CO_CONFIRMED_LOCKED':
      case 'CO_APPROVED_CORRECTED':
        return 'bg-emerald-100 text-emerald-900 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300 font-black';
      case 'CO_APPROVED_UNLOCKED':
        return 'bg-blue-100 text-blue-900 border-blue-500 dark:bg-blue-950 dark:text-blue-300 font-bold';
      case 'CORRECTION_SUBMITTED':
      case 'CORRECTION_PENDING_CO':
        return 'bg-amber-100 text-amber-900 border-amber-500 dark:bg-amber-950 dark:text-amber-300 font-bold';
      case 'RETURNED':
      case 'CORRECTION_REJECTED':
      case 'REJECTED':
      case 'EXPIRED':
        return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300';
      case 'HELD':
      case 'SHORT_DATED':
      case 'QUARANTINED':
        return 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950 dark:text-amber-300';
      case 'SUPERSEDED':
      case 'ARCHIVED':
        return 'bg-slate-200 text-slate-600 border-slate-400 line-through dark:bg-slate-800 dark:text-slate-400';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'DRAFT':
        return t('status_draft') || 'DRAFT';
      case 'SUBMITTED':
        return t('status_submitted') || 'SUBMITTED';
      case 'RETURNED':
        return t('status_returned') || 'RETURNED';
      case 'HELD':
        return t('status_held') || 'HELD';
      case '2IC_APPROVED':
        return t('status_two_ic_approved') || '2IC VERIFIED';
      case 'PENDING_QM':
        return t('status_pending_qm') || 'PENDING QM';
      case 'QM_APPROVED':
        return t('status_qm_approved') || 'QM APPROVED';
      case 'PENDING_MOIC':
        return t('status_pending_moic') || 'PENDING MOIC';
      case 'MOIC_APPROVED':
        return t('status_moic_approved') || 'MOIC APPROVED';
      case 'CO_APPROVED':
      case 'LOCKED':
      case 'CO_APPROVED_LOCKED':
        return 'VERIFIED & PUBLISHED';
      case 'CO_APPROVED_UNLOCKED':
        return 'ACTIVE';
      case 'CORRECTION_SUBMITTED':
      case 'CORRECTION_PENDING_CO':
        return 'UPDATED';
      case 'CO_CONFIRMED_LOCKED':
      case 'CO_APPROVED_CORRECTED':
        return 'VERIFIED';
      case 'SUPERSEDED':
        return t('status_superseded') || 'SUPERSEDED';
      case 'ARCHIVED':
        return t('status_archived') || 'ARCHIVED';
      case 'REJECTED':
        return 'REVIEW REQUIRED';
      case 'PUBLISHED':
        return 'PUBLISHED';
      default:
        return (status as string).replace(/_/g, ' ');
    }
  };

  return (
    <span
      className={`
        inline-flex items-center font-bold font-mono uppercase tracking-wider
        border rounded-full
        ${size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}
        ${getBadgeStyle()}
      `}
    >
      {getStatusLabel()}
    </span>
  );
};
