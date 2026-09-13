import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { TrainingMaterial, TrainingCategory } from '../../types';
import { Modal } from '../common/Modal';
import { logAuditEvent } from '../../services/auditService';
import { syncEntityToCloud, deleteEntityFromCloud } from '../../services/firebaseSyncService';
import { 
  BookOpen, Plus, Search, Filter, Edit3, Trash2, 
  CheckCircle2, AlertTriangle, AlertCircle, FileText, 
  Layers, ShieldAlert, HeartPulse, Flame, Car, Lock, 
  Stethoscope, Eye, EyeOff, Tag, Calendar, UserCheck, 
  Sparkles, Check, Send, Printer, Copy
} from 'lucide-react';

export const TrainingHubModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber } = useLanguage();

  const [instructions, setInstructions] = useState<TrainingMaterial[]>([]);
  const [selectedInstruction, setSelectedInstruction] = useState<TrainingMaterial | null>(null);
  const [viewingInstruction, setViewingInstruction] = useState<TrainingMaterial | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Form States
  const [instructionId, setInstructionId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<TrainingCategory>('FIELD_MEDICAL_AND_CASEVAC');
  const [instructionText, setInstructionText] = useState<string>('');
  const [priority, setPriority] = useState<'ROUTINE' | 'PRIORITY' | 'IMMEDIATE'>('ROUTINE');
  const [issuingAuthority, setIssuingAuthority] = useState<string>('Clinical Training Division, 95 Fd Amb');
  const [instructionDate, setInstructionDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [isPublished, setIsPublished] = useState<boolean>(true);
  const [isEmergencyRef, setIsEmergencyRef] = useState<boolean>(false);

  const isViewer = currentUser.role === 'general_viewer';
  const canManage = !isViewer;

  const categories: { key: TrainingCategory; label: string; icon: any }[] = [
    { key: 'FIELD_MEDICAL_AND_CASEVAC', label: 'Field Medical & CASEVAC Guidance', icon: HeartPulse },
    { key: 'MEDICAL_AND_FIRST_AID', label: 'Medical & First Aid Protocols', icon: Stethoscope },
    { key: 'HYGIENE_AND_DISEASE_PREVENTION', label: 'Hygiene & Disease Prevention', icon: ShieldAlert },
    { key: 'FIRE_SAFETY_AND_EMERGENCY', label: 'Fire, Safety & Emergency Response', icon: Flame },
    { key: 'MT_AND_VEHICLE_SAFETY', label: 'MT & Vehicle Convoy Safety', icon: Car },
    { key: 'IT_AND_CYBER_AWARENESS', label: 'IT & Cyber Security Awareness', icon: Lock },
    { key: 'ADMINISTRATIVE_PROCEDURES', label: 'Administrative Procedures & Standing Orders', icon: FileText },
    { key: 'FORMS_CHECKLISTS_AND_HANDOUTS', label: 'SOPs, Checklists & Training Handouts', icon: Layers }
  ];

  const loadInstructions = async () => {
    const list = await db.trainingMaterials.toArray();
    setInstructions(list.sort((a, b) => new Date(b.uploadDate || b.createdAt).getTime() - new Date(a.uploadDate || a.createdAt).getTime()));
  };

  useEffect(() => {
    loadInstructions();

    const handleCloudSync = (e: any) => {
      if (e.detail?.collection === 'trainingMaterials') {
        loadInstructions();
      }
    };
    window.addEventListener('unit-ready-cloud-sync', handleCloudSync);
    return () => window.removeEventListener('unit-ready-cloud-sync', handleCloudSync);
  }, []);

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setInstructionId('');
    setTitle('');
    setCategory('FIELD_MEDICAL_AND_CASEVAC');
    setInstructionText('');
    setPriority('ROUTINE');
    setIssuingAuthority(currentUser.appointmentTitle || 'Training Wing, 95 Fd Amb');
    setInstructionDate(new Date().toISOString().substring(0, 10));
    setIsPublished(true);
    setIsEmergencyRef(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: TrainingMaterial) => {
    setIsEditing(true);
    setInstructionId(item.id);
    setTitle(item.title);
    setCategory(item.category);
    setInstructionText(item.instructionText || item.description || '');
    setPriority(item.priority || 'ROUTINE');
    setIssuingAuthority(item.issuingAuthority || currentUser.appointmentTitle || '95 Fd Amb');
    setInstructionDate(item.uploadDate || new Date().toISOString().substring(0, 10));
    setIsPublished(item.isPublished !== false);
    setIsEmergencyRef(Boolean(item.isEmergencyQuickRef));
    setIsModalOpen(true);
  };

  const handleSaveInstruction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !instructionText.trim()) {
      alert('Please provide both an Instruction Title and the Instruction Details Text.');
      return;
    }

    const matchedCat = categories.find(c => c.key === category);
    const nowIso = new Date().toISOString();

    const record: TrainingMaterial = {
      id: isEditing && instructionId ? instructionId : 'inst-' + Date.now(),
      title: title.trim(),
      category,
      categoryLabel: matchedCat?.label || category,
      description: instructionText.trim().substring(0, 160) + '...',
      instructionText: instructionText.trim(),
      priority,
      issuingAuthority: issuingAuthority.trim(),
      uploadDate: instructionDate,
      version: isEditing ? '1.1' : '1.0',
      isEmergencyQuickRef: isEmergencyRef,
      accessLevel: 'ALL_PERSONNEL',
      status: isPublished ? 'PUBLISHED' : 'DRAFT',
      isPublished,
      isArchived: false,
      uploaderAppointment: currentUser.appointmentTitle,
      uploaderUserId: currentUser.id,
      acknowledgements: [],
      createdAt: isEditing ? (selectedInstruction?.createdAt || nowIso) : nowIso,
      updatedAt: nowIso
    };

    await db.trainingMaterials.put(record);
    await syncEntityToCloud('trainingMaterials', record.id, record);

    await logAuditEvent(
      currentUser,
      isEditing ? 'TRAINING_MATERIAL_UPDATED' : 'TRAINING_MATERIAL_UPLOADED',
      'training',
      record.title,
      `${currentUser.appointmentTitle} ${isEditing ? 'updated' : 'created'} training instruction: ${record.title}. Priority: ${priority}.`
    );

    setIsModalOpen(false);
    await loadInstructions();
  };

  const handleDeleteInstruction = async (item: TrainingMaterial) => {
    const confirm = window.confirm(`Are you sure you want to delete instruction "${item.title}"? This action cannot be undone.`);
    if (!confirm) return;

    await db.trainingMaterials.delete(item.id);
    await deleteEntityFromCloud('trainingMaterials', item.id);

    await logAuditEvent(
      currentUser,
      'TRAINING_MATERIAL_DELETED',
      'training',
      item.title,
      `${currentUser.appointmentTitle} deleted training instruction: ${item.title}.`
    );

    await loadInstructions();
    if (selectedInstruction?.id === item.id) {
      setSelectedInstruction(null);
    }
  };

  const handleTogglePublish = async (item: TrainingMaterial) => {
    const targetStatus = !item.isPublished;
    const updated: TrainingMaterial = {
      ...item,
      isPublished: targetStatus,
      status: targetStatus ? 'PUBLISHED' : 'DRAFT',
      updatedAt: new Date().toISOString()
    };

    await db.trainingMaterials.put(updated);
    await syncEntityToCloud('trainingMaterials', updated.id, updated);
    await loadInstructions();
  };

  // Filter instructions
  const filteredInstructions = useMemo(() => {
    return instructions.filter(item => {
      // General viewers only see published items
      if (isViewer && !item.isPublished) return false;

      // Category filter
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;

      // Priority filter
      if (priorityFilter !== 'ALL' && (item.priority || 'ROUTINE') !== priorityFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesText = (item.instructionText || item.description || '').toLowerCase().includes(q);
        const matchesAuth = (item.issuingAuthority || '').toLowerCase().includes(q);
        const matchesCat = (item.categoryLabel || '').toLowerCase().includes(q);
        return matchesTitle || matchesText || matchesAuth || matchesCat;
      }

      return true;
    });
  }, [instructions, isViewer, categoryFilter, priorityFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#2D4A22] text-[#F59E0B] flex items-center justify-center shadow-md">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                Training & Knowledge Hub — Unit Standing Instructions
              </h2>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Text Instructions
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Official tactical clinical protocols, emergency standing orders, and training directives for all unit appointments.
            </p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-[#2D4A22] hover:bg-[#3B5E2B] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Instruction</span>
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search instructions by title, keyword, or authority..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none font-medium"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full md:w-auto p-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Categories ({instructions.length})</option>
            {categories.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full md:w-auto p-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="IMMEDIATE">Immediate / Urgent</option>
            <option value="PRIORITY">Priority</option>
            <option value="ROUTINE">Routine</option>
          </select>
        </div>
      </div>

      {/* Instructions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredInstructions.length === 0 ? (
          <div className="col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No training instructions found</p>
            <p className="text-xs text-slate-400">
              {searchQuery ? 'Try clearing your search query or filters.' : 'Click "Add New Instruction" above to publish a training directive.'}
            </p>
          </div>
        ) : (
          filteredInstructions.map(item => {
            const p = item.priority || 'ROUTINE';
            const isImmediate = p === 'IMMEDIATE';
            const isPriority = p === 'PRIORITY';

            return (
              <div 
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top Bar: Priority & Category & Publish Status */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Priority Tag */}
                      <span className={`text-[10px] font-mono font-extrabold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                        isImmediate
                          ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800'
                          : isPriority
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      }`}>
                        {isImmediate ? <Flame className="w-3 h-3 text-red-600" /> : <Tag className="w-3 h-3" />}
                        <span>{p}</span>
                      </span>

                      {/* Category Tag */}
                      <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                        {item.categoryLabel || item.category}
                      </span>
                    </div>

                    {/* Publish Status Pill */}
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      item.isPublished !== false
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {item.isPublished !== false ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                    {item.title}
                  </h3>

                  {/* Instruction Details Text (Rich Structured View) */}
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-sans">
                    {item.instructionText || item.description}
                  </div>
                </div>

                {/* Metadata & Actions Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 font-medium">
                  <div className="space-y-0.5 font-mono">
                    <div>Issued by: <strong className="text-slate-700 dark:text-slate-300">{item.issuingAuthority}</strong></div>
                    <div className="text-[10px]">Date: {item.uploadDate || item.createdAt.substring(0, 10)} • Ref: {item.id}</div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {/* View Full Document Button (Visible to General Viewers & All Users) */}
                    <button
                      type="button"
                      onClick={() => setViewingInstruction(item)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                      title="View Complete Document"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>View Full Document</span>
                    </button>

                    {canManage && (
                      <>
                        {/* Publish / Unpublish Toggle */}
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(item)}
                          className={`p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer transition ${
                            item.isPublished !== false
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600'
                          }`}
                          title={item.isPublished !== false ? 'Unpublish to Draft' : 'Publish to Unit'}
                        >
                          {item.isPublished !== false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">{item.isPublished !== false ? 'Unpublish' : 'Publish'}</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs transition"
                          title="Edit Instruction"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteInstruction(item)}
                          className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                          title="Delete Instruction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Delete</span>
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

      {/* Modal: Full-Screen Dedicated Document Viewer (General Viewers & All Personnel) */}
      <Modal
        isOpen={!!viewingInstruction}
        onClose={() => setViewingInstruction(null)}
        title={viewingInstruction?.title || 'Standing Instruction & Directive'}
        subtitle={`Issued by: ${viewingInstruction?.issuingAuthority || '95 Fd Amb HQ'} • Ref: ${viewingInstruction?.id}`}
        maxWidth="xl"
      >
        {viewingInstruction && (
          <div className="space-y-4 p-2 text-slate-800 dark:text-slate-200">
            {/* Header Tags */}
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase px-2.5 py-1 rounded-md bg-[#2D4A22] text-white">
                  {viewingInstruction.categoryLabel || viewingInstruction.category}
                </span>
                <span className={`text-xs font-mono font-black uppercase px-2.5 py-1 rounded-md ${
                  viewingInstruction.priority === 'IMMEDIATE'
                    ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300'
                    : viewingInstruction.priority === 'PRIORITY'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300'
                    : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300'
                }`}>
                  Priority: {viewingInstruction.priority || 'ROUTINE'}
                </span>
              </div>

              <div className="text-xs font-mono text-slate-500">
                Date: {viewingInstruction.uploadDate || viewingInstruction.createdAt.substring(0, 10)}
              </div>
            </div>

            {/* Complete Document Body with Full Scroll & Typography */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner max-h-[65vh] overflow-y-auto">
              <h2 className="text-lg font-black uppercase tracking-wide text-[#2D4A22] dark:text-emerald-400 border-b pb-3 mb-4 border-slate-200 dark:border-slate-800">
                {viewingInstruction.title}
              </h2>
              <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200 space-y-3">
                {viewingInstruction.instructionText || viewingInstruction.description}
              </div>
            </div>

            {/* Viewer Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="text-slate-500 font-mono">
                {isViewer ? 'General Viewer Mode — Read & Print Access' : 'Full Operational Directive View'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${viewingInstruction.title}\n\n${viewingInstruction.instructionText || viewingInstruction.description}`);
                    alert('Complete instruction content copied to clipboard.');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingInstruction(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Add / Edit Training Instruction */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Standing Instruction' : 'Add New Standing Instruction'}
        subtitle="Publish a formal text directive, clinical protocol, or standing operational order."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveInstruction} className="p-5 space-y-4 text-xs font-sans">
          {/* Title */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Instruction Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Protocol for Heat Stroke & Emergency Resuscitation"
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold text-xs"
              required
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TrainingCategory)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-xs"
              >
                {categories.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Priority Level *
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-xs"
              >
                <option value="ROUTINE">Routine (Standard SOP)</option>
                <option value="PRIORITY">Priority (Important Directives)</option>
                <option value="IMMEDIATE">Immediate / Urgent (Emergency Protocols)</option>
              </select>
            </div>
          </div>

          {/* Issuing Authority & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Issued By / Authority *
              </label>
              <input
                type="text"
                value={issuingAuthority}
                onChange={(e) => setIssuingAuthority(e.target.value)}
                placeholder="e.g. MOIC / Clinical Training Division, 95 Fd Amb"
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold text-xs"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Instruction Date *
              </label>
              <input
                type="date"
                value={instructionDate}
                onChange={(e) => setInstructionDate(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold text-xs"
                required
              />
            </div>
          </div>

          {/* Instruction / Details Text Area */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase">
                Instruction & Clinical Guidance Details *
              </label>
              <span className="text-[10px] text-slate-400">Supports multi-line structured text</span>
            </div>
            <textarea
              rows={8}
              value={instructionText}
              onChange={(e) => setInstructionText(e.target.value)}
              placeholder="Type the full standing instruction, step-by-step clinical protocol, emergency actions, dosages, and operational instructions here..."
              className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-sans text-xs leading-relaxed"
              required
            />
          </div>

          {/* Publish Option */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <input
              type="checkbox"
              id="publishCheckbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="w-4 h-4 text-[#2D4A22] rounded focus:ring-0 cursor-pointer"
            />
            <label htmlFor="publishCheckbox" className="font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
              Publish immediately for all unit viewers
            </label>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white font-extrabold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : 'Save & Publish Instruction'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
