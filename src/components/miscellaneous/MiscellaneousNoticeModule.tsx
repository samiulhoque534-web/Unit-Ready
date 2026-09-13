import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { MiscellaneousNotice, NoticeAttachment } from '../../types';
import { Modal } from '../common/Modal';
import { logAuditEvent } from '../../services/auditService';
import { 
  uploadFileToFirebaseStorage, 
  syncEntityToCloud, 
  deleteEntityFromCloud 
} from '../../services/firebaseSyncService';
import { 
  FileText, Plus, Search, Filter, Download, 
  Printer, Eye, Trash2, Upload, Paperclip, Clock, 
  ShieldCheck, Tag, Edit3, CheckCircle2, ExternalLink, 
  X, File, Image as ImageIcon, AlertCircle, Save, 
  Layers, Check, Sparkles, AlertTriangle
} from 'lucide-react';

const NOTICE_CATEGORIES = [
  'General Order',
  'Administrative Instruction',
  'Medical Directive',
  'Training Directive',
  'Routine Notice',
  'Emergency Flash',
  'Safety & Hygiene',
  'Miscellaneous'
];

export const MiscellaneousNoticeModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber, language } = useLanguage();

  const [notices, setNotices] = useState<MiscellaneousNotice[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [filterTab, setFilterTab] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');

  // Modal States
  const [isEditorModalOpen, setIsEditorModalOpen] = useState<boolean>(false);
  const [editingNotice, setEditingNotice] = useState<MiscellaneousNotice | null>(null);

  // Form Fields
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('General Order');
  const [noticeDate, setNoticeDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [description, setDescription] = useState<string>('');
  const [validUntil, setValidUntil] = useState<string>('');
  const [attachments, setAttachments] = useState<NoticeAttachment[]>([]);
  
  // Upload Progress & Submitting States
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);

  // Full Document Viewer Modal
  const [isViewerModalOpen, setIsViewerModalOpen] = useState<boolean>(false);
  const [selectedNotice, setSelectedNotice] = useState<MiscellaneousNotice | null>(null);
  const [activeAttachmentIdx, setActiveAttachmentIdx] = useState<number>(0);

  // Permission Check: General Viewers are view-only; all authenticated operators/officers have full CRUD
  const canManageNotices = currentUser.role !== 'general_viewer';

  const loadNotices = async () => {
    try {
      const list = await db.miscellaneousNotices.toArray();
      const nowStr = new Date().toISOString().substring(0, 10);

      // Auto-archive expired notices
      for (const n of list) {
        if (n.validUntil && n.validUntil < nowStr && !n.isArchived) {
          const updated = { ...n, isArchived: true, status: 'ARCHIVED' as const };
          await db.miscellaneousNotices.put(updated);
          await syncEntityToCloud('miscellaneousNotices', updated.id, updated);
        }
      }

      const updatedList = await db.miscellaneousNotices.toArray();
      setNotices(updatedList.sort((a, b) => new Date(b.uploadDate || b.createdAt || 0).getTime() - new Date(a.uploadDate || a.createdAt || 0).getTime()));
    } catch (err) {
      console.warn('Notice loading notice:', err);
    }
  };

  useEffect(() => {
    loadNotices();

    const onCloudSync = (e: any) => {
      const col = e?.detail?.collection;
      if (!col || col === 'miscellaneousNotices') {
        loadNotices();
      }
    };

    window.addEventListener('unit-ready-cloud-sync', onCloudSync);
    return () => {
      window.removeEventListener('unit-ready-cloud-sync', onCloudSync);
    };
  }, []);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingNotice(null);
    setTitle('');
    setCategory('General Order');
    setNoticeDate(new Date().toISOString().substring(0, 10));
    setDescription('');
    setValidUntil('');
    setAttachments([]);
    setUploadProgress(null);
    setIsEditorModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (notice: MiscellaneousNotice) => {
    setEditingNotice(notice);
    setTitle(notice.title);
    setCategory(notice.category || 'General Order');
    setNoticeDate(notice.noticeDate || (notice.uploadDate ? notice.uploadDate.substring(0, 10) : new Date().toISOString().substring(0, 10)));
    setDescription(notice.description || '');
    setValidUntil(notice.validUntil || '');
    setAttachments(notice.attachments || []);
    setUploadProgress(null);
    setIsEditorModalOpen(true);
  };

  // Handle Multi-Format File Upload (PDF, JPG, PNG, DOC, DOCX, PPT, PPTX, TXT)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadProgress(10);
    const fileList = Array.from(files);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const uploaded = await uploadFileToFirebaseStorage(file, 'unit_notices', (percent) => {
          setUploadProgress(Math.round(((i + (percent / 100)) / fileList.length) * 100));
        });

        const newAtt: NoticeAttachment = {
          id: 'att-' + Date.now() + '-' + Math.random().toString().slice(-4),
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          dataUrl: uploaded.url,
          fileUrl: uploaded.url,
          isCloudStorage: uploaded.isCloudStorage
        };

        setAttachments(prev => [...prev, newAtt]);
      } catch (err: any) {
        console.error('File upload error:', err);
        alert(`Failed to upload ${file.name}: ${err.message}`);
      }
    }

    setUploadProgress(null);
    e.target.value = ''; // Reset input
  };

  // Remove attachment from pending list
  const handleRemoveAttachment = (attId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  // Save / Update Notice
  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a notice title.');
      return;
    }

    if (!canManageNotices) {
      alert('General Viewers are not authorized to create or edit notices.');
      return;
    }

    setIsSubmitting(true);
    const nowIso = new Date().toISOString();

    try {
      if (editingNotice) {
        const updatedNotice: MiscellaneousNotice = {
          ...editingNotice,
          title: title.trim(),
          category,
          noticeDate,
          description: description.trim(),
          validUntil: validUntil || undefined,
          attachments,
          status: 'PUBLISHED',
          isPublished: true,
          updatedAt: nowIso
        };

        await db.miscellaneousNotices.put(updatedNotice);
        await syncEntityToCloud('miscellaneousNotices', updatedNotice.id, updatedNotice);
        await logAuditEvent(
          currentUser,
          'NOTICE_APPROVED',
          'notice_board',
          updatedNotice.referenceNo,
          `Updated notice "${updatedNotice.title}" (${updatedNotice.referenceNo})`
        );

        setSaveStatusMessage(`✅ Notice "${updatedNotice.title}" updated and published in real time!`);
      } else {
        const id = 'misc-' + Date.now();
        const year = new Date().getFullYear();
        const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
        const refNo = `NOTICE/95FA/${year}/${month}/${Date.now().toString().slice(-4)}`;

        const newNotice: MiscellaneousNotice = {
          id,
          referenceNo: refNo,
          title: title.trim(),
          category,
          noticeDate,
          description: description.trim(),
          uploadDate: nowIso,
          uploaderAppointment: currentUser.appointmentTitle || currentUser.fullName,
          uploaderUserId: currentUser.id,
          uploaderName: currentUser.fullName,
          validUntil: validUntil || undefined,
          attachments,
          status: 'PUBLISHED', // Published immediately without CO approval blocking
          isPublished: true,
          isArchived: false,
          createdAt: nowIso,
          updatedAt: nowIso
        };

        await db.miscellaneousNotices.put(newNotice);
        await syncEntityToCloud('miscellaneousNotices', newNotice.id, newNotice);
        await logAuditEvent(
          currentUser,
          'NOTICE_PUBLISHED',
          'notice_board',
          newNotice.referenceNo,
          `Uploaded and published notice "${newNotice.title}" (${newNotice.referenceNo})`
        );

        setSaveStatusMessage(`✅ Notice "${newNotice.title}" published immediately to all connected devices!`);
      }

      setIsEditorModalOpen(false);
      await loadNotices();

      setTimeout(() => {
        setSaveStatusMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Error saving notice:', err);
      alert('Failed to save notice: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Notice
  const handleDeleteNotice = async (notice: MiscellaneousNotice) => {
    if (!canManageNotices) {
      alert('General Viewers are not authorized to delete notices.');
      return;
    }

    const confirm = window.confirm(`Are you sure you want to permanently delete notice "${notice.title}" (${notice.referenceNo})?`);
    if (!confirm) return;

    try {
      await db.miscellaneousNotices.delete(notice.id);
      await deleteEntityFromCloud('miscellaneousNotices', notice.id);
      await logAuditEvent(
        currentUser,
        'RECORD_DELETED',
        'notice_board',
        notice.referenceNo,
        `Deleted notice ${notice.referenceNo}: ${notice.title}`
      );

      setSaveStatusMessage(`🗑️ Notice "${notice.title}" deleted permanently from Firestore.`);
      await loadNotices();

      setTimeout(() => {
        setSaveStatusMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error('Error deleting notice:', err);
      alert('Failed to delete notice: ' + err.message);
    }
  };

  // Toggle Archive Status
  const handleToggleArchive = async (notice: MiscellaneousNotice) => {
    if (!canManageNotices) return;

    const newArchived = !notice.isArchived;
    const updated: MiscellaneousNotice = {
      ...notice,
      isArchived: newArchived,
      status: newArchived ? 'ARCHIVED' : 'PUBLISHED',
      updatedAt: new Date().toISOString()
    };

    await db.miscellaneousNotices.put(updated);
    await syncEntityToCloud('miscellaneousNotices', updated.id, updated);
    await logAuditEvent(
      currentUser,
      'NOTICE_ARCHIVED',
      'notice_board',
      notice.referenceNo,
      `Notice ${notice.referenceNo} marked as ${newArchived ? 'Archived' : 'Active'}.`
    );

    loadNotices();
  };

  // Open Full Viewer Modal
  const handleOpenViewer = (notice: MiscellaneousNotice) => {
    setSelectedNotice(notice);
    setActiveAttachmentIdx(0);
    setIsViewerModalOpen(true);
    logAuditEvent(currentUser, 'RECORD_VIEWED', 'notice_board', notice.referenceNo, `Viewed notice document: ${notice.title}`);
  };

  // Filter Notices
  const filteredNotices = useMemo(() => {
    return notices.filter(n => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        n.title.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.referenceNo.toLowerCase().includes(q) ||
        (n.uploaderAppointment || '').toLowerCase().includes(q) ||
        (n.category || '').toLowerCase().includes(q);

      const matchesCategory = selectedCategory === 'ALL' || n.category === selectedCategory;

      if (filterTab === 'ACTIVE') return matchesSearch && matchesCategory && !n.isArchived;
      if (filterTab === 'ARCHIVED') return matchesSearch && matchesCategory && n.isArchived;
      return matchesSearch && matchesCategory;
    });
  }, [notices, searchQuery, selectedCategory, filterTab]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              Others / Miscellaneous Notice Board
            </h2>
            <span className="bg-[#2D4A22] text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
              95 FD AMB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-sans">
            Direct real-time military notice board for General Directives, Circulars, PDFs, Word/PPT docs and Images (No CO approval required).
          </p>
        </div>

        {canManageNotices && (
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer transition"
          >
            <Plus className="w-4 h-4" />
            <span>Upload New Notice</span>
          </button>
        )}
      </div>

      {/* Save Status Alert Banner */}
      {saveStatusMessage && (
        <div className="p-3.5 rounded-xl border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{saveStatusMessage}</span>
          </div>
          <button onClick={() => setSaveStatusMessage(null)} className="text-xs px-2 py-0.5 rounded bg-white/50 hover:bg-white text-slate-700 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Filter & Category Selector Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setFilterTab('ACTIVE')}
              className={`px-3 py-1.5 rounded-md font-bold text-xs transition cursor-pointer ${
                filterTab === 'ACTIVE'
                  ? 'bg-white dark:bg-slate-700 text-[#2D4A22] dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Active Notices ({notices.filter(n => !n.isArchived).length})
            </button>
            <button
              onClick={() => setFilterTab('ARCHIVED')}
              className={`px-3 py-1.5 rounded-md font-bold text-xs transition cursor-pointer ${
                filterTab === 'ARCHIVED'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Archived ({notices.filter(n => n.isArchived).length})
            </button>
            <button
              onClick={() => setFilterTab('ALL')}
              className={`px-3 py-1.5 rounded-md font-bold text-xs transition cursor-pointer ${
                filterTab === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All ({notices.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, category, ref no, uploader..."
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            Category:
          </span>
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-[#2D4A22] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            All Categories
          </button>
          {NOTICE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#2D4A22] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Notices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredNotices.length === 0 ? (
          <div className="col-span-2 bg-white dark:bg-slate-900 p-12 rounded-xl text-center border-2 border-dashed border-slate-300 dark:border-slate-700">
            <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">No Notices Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              There are currently no notices matching the selected criteria.
            </p>
            {canManageNotices && (
              <button
                onClick={handleOpenCreateModal}
                className="mt-4 px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload First Notice</span>
              </button>
            )}
          </div>
        ) : (
          filteredNotices.map((n) => {
            const hasAttachments = n.attachments && n.attachments.length > 0;

            return (
              <div 
                key={n.id}
                className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:border-[#3B5E2B] transition relative group"
              >
                <div>
                  {/* Top Bar: Reference No + Date + Category */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="bg-[#2D4A22] text-white font-mono text-[10px] font-black px-2 py-0.5 rounded shadow-xs">
                        {n.referenceNo}
                      </span>
                      <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                        {n.category || 'General Order'}
                      </span>
                      {n.isArchived && (
                        <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          ARCHIVED
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-500 whitespace-nowrap">
                      {n.noticeDate || (n.uploadDate ? n.uploadDate.substring(0, 10) : '—')}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-black text-base text-slate-900 dark:text-white mt-3 line-clamp-2">
                    {n.title}
                  </h3>

                  {/* Description / Content Preview */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-3 font-sans leading-relaxed">
                    {n.description || 'No additional text description provided.'}
                  </p>

                  {/* Metadata Summary Box */}
                  <div className="mt-4 p-3 rounded-lg bg-[#F8F9F5] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Uploaded By:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{n.uploaderAppointment || 'Authority'}</strong>
                    </div>
                    {n.validUntil && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Valid Until:</span>
                        <strong className="text-amber-700 dark:text-amber-400">{n.validUntil}</strong>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-sans">Attachments:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <Paperclip className="w-3 h-3" />
                        <span>{n.attachments?.length || 0} file(s) attached</span>
                      </span>
                    </div>
                  </div>

                  {/* Attachment Previews / Chips */}
                  {hasAttachments && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {n.attachments.map((att, idx) => (
                        <div
                          key={att.id || idx}
                          className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1 max-w-[200px] truncate"
                          title={att.name}
                        >
                          {att.name.endsWith('.pdf') ? (
                            <File className="w-3 h-3 text-red-500 flex-shrink-0" />
                          ) : att.name.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                            <ImageIcon className="w-3 h-3 text-blue-500 flex-shrink-0" />
                          ) : (
                            <FileText className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                          )}
                          <span className="truncate">{att.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Live Published</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* View Full Document Button */}
                    <button
                      onClick={() => handleOpenViewer(n)}
                      className="px-3 py-1.5 bg-[#2D4A22] hover:bg-[#3B5E2B] text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer transition"
                      title="View complete original document / notice"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Notice</span>
                    </button>

                    {/* Operator Edit & Delete Actions (Hidden from General Viewers) */}
                    {canManageNotices && (
                      <>
                        <button
                          onClick={() => handleOpenEditModal(n)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs transition cursor-pointer"
                          title="Edit Notice"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteNotice(n)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300 rounded-lg text-xs transition cursor-pointer"
                          title="Delete Notice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ADD / EDIT NOTICE                                */}
      {/* ========================================================= */}
      <Modal
        isOpen={isEditorModalOpen}
        onClose={() => setIsEditorModalOpen(false)}
        title={editingNotice ? 'Edit Unit Notice' : 'Upload & Publish New Notice'}
        subtitle="Direct publication to all unit devices without approval queues."
      >
        <form onSubmit={handleSaveNotice} className="space-y-4 text-xs font-sans">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Title */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Notice Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mandatory Medical Training Directive on Casevac Protocols"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Notice Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
              >
                {NOTICE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Notice Date */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Notice Date *
              </label>
              <input
                type="date"
                value={noticeDate}
                onChange={(e) => setNoticeDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                required
              />
            </div>

            {/* Validity (Optional) */}
            {/* Validity (Optional) */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Valid Until (Optional Auto-Archive Date)
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
            </div>

            {/* Description / Directives Text */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Notice Content / Description / Instructions *
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter complete notice directives, operational guidelines, or detailed instructions..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-sans leading-relaxed"
                required
              />
            </div>

            {/* File Upload Box */}
            <div className="sm:col-span-2 p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-center space-y-2">
              <Upload className="w-6 h-6 text-[#2D4A22] dark:text-emerald-400 mx-auto" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                  Attach Documents, Images, or Directives
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Supported formats: PDF, JPG, PNG, DOC, DOCX, PPT, PPTX, TXT
                </span>
              </div>

              <label className="inline-block mt-2 px-4 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white font-bold text-xs cursor-pointer shadow">
                <span>Browse Files</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.ppt,.pptx,.txt"
                  className="hidden"
                />
              </label>

              {/* Progress Bar */}
              {uploadProgress !== null && (
                <div className="w-full bg-slate-200 rounded-full h-2 mt-2 dark:bg-slate-700 overflow-hidden">
                  <div 
                    className="bg-[#2D4A22] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Attached Files List */}
            {attachments.length > 0 && (
              <div className="sm:col-span-2 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Attached Files ({attachments.length}):
                </span>
                <div className="space-y-1.5">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Paperclip className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-bold truncate">{att.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({(att.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                        title="Remove attachment"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditorModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Publishing Notice...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingNotice ? 'Update & Publish' : 'Publish Notice Immediately'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: COMPLETE DOCUMENT VIEWER                         */}
      {/* ========================================================= */}
      {selectedNotice && (
        <Modal
          isOpen={isViewerModalOpen}
          onClose={() => setIsViewerModalOpen(false)}
          title={selectedNotice.title}
          subtitle={`Ref: ${selectedNotice.referenceNo} | Category: ${selectedNotice.category || 'General'} | Date: ${selectedNotice.noticeDate || selectedNotice.uploadDate?.substring(0, 10)}`}
        >
          <div className="space-y-4 font-sans text-xs">
            {/* Header Directives Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono border-b pb-2 border-slate-200 dark:border-slate-700">
                <span>Issued by: <strong>{selectedNotice.uploaderAppointment}</strong></span>
                <span>Date: <strong>{selectedNotice.noticeDate || selectedNotice.uploadDate?.substring(0, 10)}</strong></span>
              </div>
              <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {selectedNotice.description}
              </p>
            </div>

            {/* Document Preview Section */}
            {selectedNotice.attachments && selectedNotice.attachments.length > 0 ? (
              <div className="space-y-3">
                {/* Attachment Selector Tabs (if multi-attachment) */}
                {selectedNotice.attachments.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 pb-2 border-b">
                    {selectedNotice.attachments.map((att, idx) => (
                      <button
                        key={att.id || idx}
                        onClick={() => setActiveAttachmentIdx(idx)}
                        className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                          activeAttachmentIdx === idx
                            ? 'bg-[#2D4A22] text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <Paperclip className="w-3 h-3" />
                        <span>{att.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Active Attachment Full Render */}
                {(() => {
                  const currentAtt = selectedNotice.attachments[activeAttachmentIdx] || selectedNotice.attachments[0];
                  const url = currentAtt.fileUrl || currentAtt.dataUrl || '';
                  const isPdf = currentAtt.name.toLowerCase().endsWith('.pdf') || currentAtt.type.includes('pdf');
                  const isImage = currentAtt.name.match(/\.(jpg|jpeg|png|webp|gif)$/i) || currentAtt.type.startsWith('image/');
                  const isOfficeDoc = currentAtt.name.match(/\.(doc|docx|ppt|pptx|xls|xlsx)$/i);

                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-950 p-2">
                      <div className="flex items-center justify-between pb-2 px-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                        <span className="font-bold font-mono text-slate-700 dark:text-slate-300 truncate">
                          {currentAtt.name} ({(currentAtt.size / 1024).toFixed(1)} KB)
                        </span>
                        <div className="flex items-center gap-2">
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded font-bold text-[11px] flex items-center gap-1 shadow-xs"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Open in New Tab</span>
                            </a>
                          )}
                          {url && (
                            <a
                              href={url}
                              download={currentAtt.name}
                              className="px-2.5 py-1 bg-[#2D4A22] hover:bg-[#3B5E2B] text-white rounded font-bold text-[11px] flex items-center gap-1 shadow-xs"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Preview Container */}
                      <div className="mt-2 min-h-[350px] max-h-[550px] flex items-center justify-center overflow-auto rounded bg-white dark:bg-slate-900 p-2">
                        {isPdf ? (
                          <iframe
                            src={url}
                            title={currentAtt.name}
                            className="w-full h-[500px] border-0 rounded"
                          />
                        ) : isImage ? (
                          <img
                            src={url}
                            alt={currentAtt.name}
                            className="max-h-[500px] max-w-full object-contain rounded shadow"
                          />
                        ) : isOfficeDoc ? (
                          <div className="text-center p-8 space-y-3">
                            <FileText className="w-12 h-12 text-[#2D4A22] dark:text-emerald-400 mx-auto" />
                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                              Microsoft Office Document ({currentAtt.name})
                            </h4>
                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                              Click below to view via browser document viewer or download to open directly in Microsoft Word / PowerPoint.
                            </p>
                            <div className="flex justify-center gap-2 pt-2">
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2 bg-[#2D4A22] hover:bg-[#3B5E2B] text-white font-bold rounded-lg text-xs shadow flex items-center gap-1.5"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open Full Document</span>
                              </a>
                              <a
                                href={url}
                                download={currentAtt.name}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-lg text-xs shadow flex items-center gap-1.5"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download File</span>
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center p-8 space-y-2">
                            <File className="w-10 h-10 text-slate-400 mx-auto" />
                            <span className="font-bold text-xs block">{currentAtt.name}</span>
                            <a
                              href={url}
                              download={currentAtt.name}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#2D4A22] text-white rounded font-bold text-xs shadow"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download File</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center border border-dashed border-slate-300 dark:border-slate-700">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                  Pure Text Notice (No Attachment Uploaded)
                </span>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsViewerModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
