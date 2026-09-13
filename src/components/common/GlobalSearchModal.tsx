import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../db/database';
import { logAuditEvent } from '../../services/auditService';
import { 
  Search, X, Users, Pill, Scissors, Activity, 
  Truck, FileText, Bell, BookOpen, ArrowRight, ShieldCheck 
} from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

interface SearchResultItem {
  id: string;
  category: 'PERSONNEL' | 'MEDICINE' | 'INSTRUMENT' | 'EQUIPMENT' | 'VEHICLE' | 'DUTY_ROSTER' | 'NOTICE' | 'TRAINING';
  categoryLabel: string;
  title: string;
  subtitle: string;
  details?: string;
  path: string;
  badgeText?: string;
  badgeColor?: string;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const { currentUser } = useAuth();
  const { formatNumber } = useLanguage();

  const [query, setQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const executeSearch = async () => {
      const q = query.trim().toLowerCase();
      if (!q) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      const items: SearchResultItem[] = [];

      try {
        // 1. Manpower / Nominal Roll
        const personnel = await db.manpowerPersonnel.toArray();
        personnel.forEach(p => {
          const ba = p.baNo || p.personalNumber || '';
          const rank = p.rank || '';
          const name = p.name || '';
          const trade = p.trade || p.qualification || '';
          const appt = p.appointment || '';

          if (
            ba.toLowerCase().includes(q) ||
            rank.toLowerCase().includes(q) ||
            name.toLowerCase().includes(q) ||
            trade.toLowerCase().includes(q) ||
            appt.toLowerCase().includes(q) ||
            p.sectionCode.toLowerCase().includes(q) ||
            p.currentStatus.toLowerCase().includes(q)
          ) {
            items.push({
              id: `p-${p.id}`,
              category: 'PERSONNEL',
              categoryLabel: 'Nominal Roll',
              title: `${rank} ${name || appt} (${ba})`,
              subtitle: `Trade: ${trade || 'MA'} | Status: ${p.currentStatus.replace(/_/g, ' ')} | Section: ${p.sectionCode}`,
              details: p.remarks || undefined,
              path: '/manpower',
              badgeText: trade || 'MA',
              badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            });
          }
        });

        // 2. Medicine Store
        const medicines = await db.medicines.toArray();
        medicines.forEach(m => {
          if (
            m.genericName.toLowerCase().includes(q) ||
            (m.brandName && m.brandName.toLowerCase().includes(q)) ||
            m.strength.toLowerCase().includes(q)
          ) {
            items.push({
              id: `med-${m.id}`,
              category: 'MEDICINE',
              categoryLabel: 'Medicine Store',
              title: `${m.genericName} ${m.strength} (${m.dosageForm})`,
              subtitle: `Brand: ${m.brandName || 'Generic'} | Current Qty: ${formatNumber(m.currentQuantity)} | Expiry: ${m.expiryDate}`,
              details: m.isHighRiskLasa ? 'HIGH RISK LASA' : undefined,
              path: '/medical-store',
              badgeText: m.unitOfIssue,
              badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            });
          }
        });

        // 3. Medical Instruments
        const instruments = await db.medicalInstruments.toArray();
        instruments.forEach(i => {
          if (
            i.instrumentSetName.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q) ||
            i.location.toLowerCase().includes(q)
          ) {
            items.push({
              id: `inst-${i.id}`,
              category: 'INSTRUMENT',
              categoryLabel: 'Medical Instruments',
              title: i.instrumentSetName,
              subtitle: `Held: ${formatNumber(i.heldQty)} (Svc: ${formatNumber(i.serviceableQty)}) | Loc: ${i.location}`,
              details: i.remarks,
              path: '/medical-store',
              badgeText: i.category,
              badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
            });
          }
        });

        // 4. Medical Equipment
        const equipment = await db.medicalEquipment.toArray();
        equipment.forEach(e => {
          if (
            e.equipmentName.toLowerCase().includes(q) ||
            e.makeModel.toLowerCase().includes(q) ||
            e.serialNumber.toLowerCase().includes(q)
          ) {
            items.push({
              id: `eq-${e.id}`,
              category: 'EQUIPMENT',
              categoryLabel: 'Medical Equipment',
              title: `${e.equipmentName} - ${e.makeModel}`,
              subtitle: `S/N: ${e.serialNumber} | Status: ${e.currentStatus.replace(/_/g, ' ')} | Calib Due: ${e.calibrationDueDate}`,
              details: e.remarks,
              path: '/medical-store',
              badgeText: e.category.replace(/_/g, ' '),
              badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            });
          }
        });

        // 5. Vehicle / MT Fleet
        const vehicles = await db.vehicleFleetItems.toArray();
        vehicles.forEach(v => {
          if (
            v.vehicleType.toLowerCase().includes(q) ||
            v.registrationFleetRef.toLowerCase().includes(q) ||
            v.responsibleAppointment.toLowerCase().includes(q)
          ) {
            items.push({
              id: `v-${v.id}`,
              category: 'VEHICLE',
              categoryLabel: 'MT Vehicle',
              title: `${v.vehicleType} (${v.registrationFleetRef})`,
              subtitle: `Auth/Held: ${formatNumber(v.authorizedQty)}/${formatNumber(v.heldQty)} | Svc: ${v.serviceability} | Insp: ${v.nextInspectionDueDate}`,
              path: '/vehicle',
              badgeText: v.status.replace(/_/g, ' '),
              badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            });
          }
        });

        const isGd = currentUser.role === 'general_duty' || currentUser.role === 'general_personnel' || currentUser.role === 'smt_member' || currentUser.role === 'authorised_personnel';

        // 6. Duty Rosters (For GD: only show published/approved rosters)
        const rosters = await db.dutyRosters.toArray();
        rosters.forEach(r => {
          if (isGd && !r.isPublished && r.status !== 'CO_APPROVED') return;
          if (
            r.referenceNo.toLowerCase().includes(q) ||
            r.title.toLowerCase().includes(q) ||
            r.dutyDate.toLowerCase().includes(q)
          ) {
            items.push({
              id: `dr-${r.id}`,
              category: 'DUTY_ROSTER',
              categoryLabel: 'Duty Roster',
              title: r.title,
              subtitle: `Ref: ${r.referenceNo} | Date: ${r.dutyDate} | Status: ${r.status}`,
              path: '/duty-roster',
              badgeText: r.status,
              badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
            });
          }
        });

        // 7. Published Notices & Miscellaneous (For GD: only show published)
        const notices = await db.miscellaneousNotices.toArray();
        notices.forEach(n => {
          if (isGd && !n.isPublished && n.status !== 'PUBLISHED') return;
          if (
            n.title.toLowerCase().includes(q) ||
            n.description.toLowerCase().includes(q) ||
            n.referenceNo.toLowerCase().includes(q)
          ) {
            items.push({
              id: `not-${n.id}`,
              category: 'NOTICE',
              categoryLabel: 'Unit Notice',
              title: n.title,
              subtitle: `Ref: ${n.referenceNo} | Uploaded: ${n.uploadDate.substring(0, 10)} | By: ${n.uploaderAppointment}`,
              details: n.description,
              path: '/others-notices',
              badgeText: n.status,
              badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            });
          }
        });

        // 8. Training Materials (For GD: published or uploaded by self)
        const training = await db.trainingMaterials.toArray();
        training.forEach(t => {
          if (isGd && !t.isPublished && t.uploaderUserId !== currentUser.id) return;
          if (
            t.title.toLowerCase().includes(q) ||
            t.categoryLabel.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q)
          ) {
            items.push({
              id: `trn-${t.id}`,
              category: 'TRAINING',
              categoryLabel: 'Training Hub',
              title: t.title,
              subtitle: `Category: ${t.categoryLabel} | Version: ${t.version} | Authority: ${t.issuingAuthority}`,
              details: t.isEmergencyQuickRef ? 'EMERGENCY QUICK REF' : undefined,
              path: '/training-hub',
              badgeText: t.categoryLabel,
              badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
            });
          }
        });

        setResults(items);

        if (items.length > 0) {
          logAuditEvent(
            currentUser,
            'GLOBAL_SEARCH_PERFORMED',
            'all',
            `QUERY: ${q}`,
            `Global search performed for "${q}", returned ${items.length} records.`
          );
        }
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(executeSearch, 250);
    return () => clearTimeout(debounce);
  }, [query, currentUser, formatNumber]);

  if (!isOpen) return null;

  const filteredResults = activeCategory === 'ALL' 
    ? results 
    : results.filter(r => r.category === activeCategory);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'PERSONNEL': return <Users className="w-4 h-4 text-blue-600" />;
      case 'MEDICINE': return <Pill className="w-4 h-4 text-emerald-600" />;
      case 'INSTRUMENT': return <Scissors className="w-4 h-4 text-purple-600" />;
      case 'EQUIPMENT': return <Activity className="w-4 h-4 text-amber-600" />;
      case 'VEHICLE': return <Truck className="w-4 h-4 text-green-600" />;
      case 'DUTY_ROSTER': return <FileText className="w-4 h-4 text-slate-600" />;
      case 'NOTICE': return <Bell className="w-4 h-4 text-orange-600" />;
      case 'TRAINING': return <BookOpen className="w-4 h-4 text-indigo-600" />;
      default: return <Search className="w-4 h-4 text-slate-500" />;
    }
  };

  const handleSelectResult = (item: SearchResultItem) => {
    onNavigate(item.path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60">
          <Search className="w-5 h-5 text-[#2D4A22] dark:text-emerald-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search personnel, medicine, equipment, vehicles, duty rosters, notices, training..."
            className="flex-1 bg-transparent text-sm sm:text-base font-medium outline-hidden text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
            ESC
          </kbd>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 p-2 px-4 border-b border-slate-100 dark:border-slate-800 overflow-x-auto text-[11px] font-semibold bg-white dark:bg-slate-900">
          {[
            { key: 'ALL', label: 'All Results' },
            { key: 'PERSONNEL', label: 'Personnel' },
            { key: 'MEDICINE', label: 'Medicines' },
            { key: 'INSTRUMENT', label: 'Instruments' },
            { key: 'EQUIPMENT', label: 'Equipment' },
            { key: 'VEHICLE', label: 'Vehicles' },
            { key: 'DUTY_ROSTER', label: 'Duty Rosters' },
            { key: 'NOTICE', label: 'Notices' },
            { key: 'TRAINING', label: 'Training Hub' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key)}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap transition ${
                activeCategory === tab.key
                  ? 'bg-[#2D4A22] text-white font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800">
          {isSearching ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">
              Searching 95 Fd Amb secure offline records...
            </div>
          ) : query.trim() && filteredResults.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-1">
              <p className="font-bold text-slate-700 dark:text-slate-300">No records found matching "{query}"</p>
              <p className="text-[11px]">Try searching by generic chemical name, service ID, vehicle type, or training topic.</p>
            </div>
          ) : !query.trim() ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-2">
              <ShieldCheck className="w-8 h-8 text-emerald-600/40 mx-auto" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                Type keywords to securely search across all 95 Fd Amb modules
              </p>
              <p className="text-[11px] text-slate-500">
                Personnel • Medicines • Electro-Medical • MT Fleet • Duty Orders • Training Materials
              </p>
            </div>
          ) : (
            filteredResults.map(item => (
              <div
                key={item.id}
                onClick={() => handleSelectResult(item)}
                className="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition flex items-start justify-between gap-3 group"
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0 mt-0.5">
                    {getCategoryIcon(item.category)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                        {item.title}
                      </span>
                      {item.badgeText && (
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${item.badgeColor}`}>
                          {item.badgeText}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {item.subtitle}
                    </p>
                    {item.details && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 italic line-clamp-1 mt-0.5">
                        {item.details}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-slate-400 group-hover:text-[#2D4A22] dark:group-hover:text-emerald-400 transition-colors text-xs font-semibold flex-shrink-0">
                  <span className="hidden sm:inline">Open</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 px-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Role: <strong>{currentUser.appointmentTitle}</strong> (Filtered access)</span>
          <span>{filteredResults.length} records matching</span>
        </div>
      </div>
    </div>
  );
};
