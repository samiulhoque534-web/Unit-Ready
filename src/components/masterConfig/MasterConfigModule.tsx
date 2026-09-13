import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { RankItem, SectionItem, UserRole } from '../../types';
import { Modal } from '../common/Modal';
import { logAuditEvent } from '../../services/auditService';
import { 
  Sliders, Plus, Edit2, CheckCircle2, 
  Trash2, ShieldCheck, ArrowUp, ArrowDown, Layers 
} from 'lucide-react';

export const MasterConfigModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { t, formatNumber } = useLanguage();

  const [activeTab, setActiveTab] = useState<'ranks' | 'sections'>('ranks');
  const [ranks, setRanks] = useState<RankItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);

  // Rank Modal
  const [isRankModalOpen, setIsRankModalOpen] = useState<boolean>(false);
  const [editingRank, setEditingRank] = useState<RankItem | null>(null);
  const [rankName, setRankName] = useState<string>('');
  const [rankOrder, setRankOrder] = useState<number>(1);

  // Section Modal
  const [isSectionModalOpen, setIsSectionModalOpen] = useState<boolean>(false);
  const [editingSection, setEditingSection] = useState<SectionItem | null>(null);
  const [secCode, setSecCode] = useState<string>('');
  const [secName, setSecName] = useState<string>('');
  const [secOpRole, setSecOpRole] = useState<UserRole>('manpower_operator');
  const [secVerifierRole, setSecVerifierRole] = useState<UserRole>('2ic');
  const [secIntermediateRole, setSecIntermediateRole] = useState<UserRole | 'none'>('qm');

  const loadData = async () => {
    const rList = await db.ranks.toArray();
    setRanks(rList.sort((a, b) => a.rankOrder - b.rankOrder));
    const sList = await db.sections.toArray();
    setSections(sList);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Rank CRUD
  const handleOpenAddRank = () => {
    setEditingRank(null);
    setRankName('');
    setRankOrder(ranks.length + 1);
    setIsRankModalOpen(true);
  };

  const handleOpenEditRank = (r: RankItem) => {
    setEditingRank(r);
    setRankName(r.rankName);
    setRankOrder(r.rankOrder);
    setIsRankModalOpen(true);
  };

  const handleSaveRank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rankName.trim()) return;

    if (editingRank) {
      const updated: RankItem = { ...editingRank, rankName: rankName.trim(), rankOrder: Number(rankOrder) };
      await db.ranks.put(updated);
      logAuditEvent(currentUser, 'RANK_UPDATED', 'all', updated.id, `Updated rank: ${rankName}`);
    } else {
      const newRank: RankItem = {
        id: 'rk-' + Date.now(),
        rankName: rankName.trim(),
        rankOrder: Number(rankOrder),
        isActive: true,
        createdAt: new Date().toISOString()
      };
      await db.ranks.add(newRank);
      logAuditEvent(currentUser, 'RANK_UPDATED', 'all', newRank.id, `Added new rank: ${rankName}`);
    }
    setIsRankModalOpen(false);
    loadData();
  };

  const handleToggleRankActive = async (r: RankItem) => {
    const updated = { ...r, isActive: !r.isActive };
    await db.ranks.put(updated);
    logAuditEvent(currentUser, 'RANK_UPDATED', 'all', r.id, `Toggled active status for rank ${r.rankName} to ${updated.isActive}`);
    loadData();
  };

  // Section CRUD
  const handleOpenAddSection = () => {
    setEditingSection(null);
    setSecCode('');
    setSecName('');
    setSecOpRole('manpower_operator');
    setSecVerifierRole('2ic');
    setSecIntermediateRole('qm');
    setIsSectionModalOpen(true);
  };

  const handleOpenEditSection = (s: SectionItem) => {
    setEditingSection(s);
    setSecCode(s.sectionCode);
    setSecName(s.sectionName);
    setSecOpRole(s.designatedOperatorRole as any);
    setSecVerifierRole(s.responsibleVerifierRole as any);
    setSecIntermediateRole(s.intermediateApproverRole as any);
    setIsSectionModalOpen(true);
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secCode.trim() || !secName.trim()) return;

    if (editingSection) {
      const updated: SectionItem = {
        ...editingSection,
        sectionCode: secCode.trim(),
        sectionName: secName.trim(),
        designatedOperatorRole: secOpRole,
        responsibleVerifierRole: secVerifierRole,
        intermediateApproverRole: secIntermediateRole
      };
      await db.sections.put(updated);
      logAuditEvent(currentUser, 'SECTION_UPDATED', 'all', updated.id, `Updated section: ${secName} (${secCode})`);
    } else {
      const newSec: SectionItem = {
        id: 'sec-' + Date.now(),
        sectionCode: secCode.trim(),
        sectionName: secName.trim(),
        designatedOperatorRole: secOpRole,
        responsibleVerifierRole: secVerifierRole,
        intermediateApproverRole: secIntermediateRole,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      await db.sections.add(newSec);
      logAuditEvent(currentUser, 'SECTION_UPDATED', 'all', newSec.id, `Added new section: ${secName} (${secCode})`);
    }
    setIsSectionModalOpen(false);
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              {t('nav_masterConfig')}
            </h2>
            <span className="bg-[#D97706] text-black font-extrabold text-[10px] px-2 py-0.5 rounded uppercase">
              SYSADMIN CONTROLS
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Editable military Rank Master hierarchy and 10 Unit Section Masters for 95 Fd Amb.
          </p>
        </div>

        <div>
          {activeTab === 'ranks' ? (
            <button
              onClick={handleOpenAddRank}
              className="px-3.5 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Rank</span>
            </button>
          ) : (
            <button
              onClick={handleOpenAddSection}
              className="px-3.5 py-1.5 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Section</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab('ranks')}
          className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs border-b-2 transition ${
            activeTab === 'ranks'
              ? 'border-[#2D4A22] text-[#2D4A22] dark:border-emerald-400 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Rank Master ({formatNumber(ranks.length)})</span>
        </button>
        <button
          onClick={() => setActiveTab('sections')}
          className={`flex items-center gap-2 py-2.5 px-4 font-bold text-xs border-b-2 transition ${
            activeTab === 'sections'
              ? 'border-[#2D4A22] text-[#2D4A22] dark:border-emerald-400 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Unit Section Master ({formatNumber(sections.length)})</span>
        </button>
      </div>

      {/* Tab 1: Rank Master Table */}
      {activeTab === 'ranks' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#1E3316] text-white uppercase text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Rank Nomenclature</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {ranks.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F8F9F5] dark:hover:bg-slate-800/50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-800 dark:text-emerald-400">
                      #{r.rankOrder}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {r.rankName}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-600'}`}>
                        {r.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenEditRank(r)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                      >
                        {t('action_edit')}
                      </button>
                      <button
                        onClick={() => handleToggleRankActive(r)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                      >
                        {r.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Section Master Table */}
      {activeTab === 'sections' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#1E3316] text-white uppercase text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Section Code</th>
                  <th className="py-3 px-4">Section Name</th>
                  <th className="py-3 px-4">Data Entry Operator</th>
                  <th className="py-3 px-4">Responsible 2IC / Verifier</th>
                  <th className="py-3 px-4">Intermediate Approver</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {sections.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F8F9F5] dark:hover:bg-slate-800/50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-800 dark:text-emerald-400">
                      {s.sectionCode}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {s.sectionName}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {s.designatedOperatorRole}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-purple-700 dark:text-purple-400 font-semibold">
                      {s.responsibleVerifierRole.toUpperCase()}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                      {s.intermediateApproverRole.toUpperCase()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenEditSection(s)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                      >
                        {t('action_edit')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Edit Rank */}
      <Modal
        isOpen={isRankModalOpen}
        onClose={() => setIsRankModalOpen(false)}
        title={editingRank ? 'Edit Military Rank' : 'Add New Military Rank'}
        subtitle="Rank hierarchy is used across Parade State, Nominal Rolls, and Approvals"
      >
        <form onSubmit={handleSaveRank} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Rank Title *
            </label>
            <input
              type="text"
              value={rankName}
              onChange={(e) => setRankName(e.target.value)}
              placeholder="e.g. Major General, Brigadier General, Captain..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Hierarchy Order (1 = Highest)
            </label>
            <input
              type="number"
              min="1"
              value={rankOrder}
              onChange={(e) => setRankOrder(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsRankModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold"
            >
              {t('action_cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow"
            >
              Save Rank
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Edit Section */}
      <Modal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        title={editingSection ? 'Edit Unit Section' : 'Add New Unit Section'}
        subtitle="Configure section code, operator role, and approving authority"
      >
        <form onSubmit={handleSaveSection} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Section Code *
              </label>
              <input
                type="text"
                value={secCode}
                onChange={(e) => setSecCode(e.target.value)}
                placeholder="e.g. A, Med, MT, SMT, EME..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Section Full Name *
              </label>
              <input
                type="text"
                value={secName}
                onChange={(e) => setSecName(e.target.value)}
                placeholder="e.g. Motor Transport Fleet Section"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Data Entry Operator Role
              </label>
              <select
                value={secOpRole}
                onChange={(e) => setSecOpRole(e.target.value as any)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="manpower_operator">Manpower Operator</option>
                <option value="vehicle_operator">Vehicle Operator</option>
                <option value="smt_operator">SMT Operator</option>
                <option value="medicine_operator">Medicine Operator</option>
                <option value="inst_equip_operator">Inst / Equip Operator</option>
                <option value="duty_operator">Duty Roster Operator</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Responsible Verifier (2IC)
              </label>
              <select
                value={secVerifierRole}
                onChange={(e) => setSecVerifierRole(e.target.value as any)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="2ic">Second-in-Command (2IC)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Intermediate Approver
              </label>
              <select
                value={secIntermediateRole}
                onChange={(e) => setSecIntermediateRole(e.target.value as any)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="qm">Quartermaster (QM)</option>
                <option value="moic">MOIC (Medical Store)</option>
                <option value="none">None (Direct to CO)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsSectionModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold"
            >
              {t('action_cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#2D4A22] hover:bg-[#3B5E2B] text-white text-xs font-bold shadow"
            >
              Save Section
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
