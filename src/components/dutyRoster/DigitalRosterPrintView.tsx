import React from 'react';
import { DutyRoster } from '../../types';
import { Printer, Download, ArrowLeft, Shield } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DigitalRosterPrintViewProps {
  roster: DutyRoster;
  onClose: () => void;
}

export const DigitalRosterPrintView: React.FC<DigitalRosterPrintViewProps> = ({
  roster,
  onClose
}) => {
  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Restricted & Unit Header
    if (roster.isRestricted !== false) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(200, 0, 0);
      doc.text('RESTRICTED', pageWidth / 2, 12, { align: 'center' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(45, 74, 34); // Military Olive
    doc.text(roster.unitName || '95 FIELD AMBULANCE', pageWidth / 2, 19, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(roster.title || 'DAILY PART-1 DUTY ROSTER / ORDERS', pageWidth / 2, 25, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const dateText = roster.secondaryDate 
      ? `Duty Dates: ${roster.dutyDate} to ${roster.secondaryDate}`
      : `Duty Date: ${roster.dutyDate} (Effective: ${roster.effectiveFrom})`;
    doc.text(dateText, pageWidth / 2, 30, { align: 'center' });

    let currentY = 35;

    // Main Appointments Table
    if (roster.mainAppointments) {
      const appt = roster.mainAppointments;
      const apptData = [
        [
          `Duty Officer:\n${appt.dutyOfficer?.rank || ''} ${appt.dutyOfficer?.name || 'N/A'}\n(${appt.dutyOfficer?.baNo || ''})`,
          `Duty JCO:\n${appt.dutyJco?.rank || ''} ${appt.dutyJco?.name || 'N/A'}\n(${appt.dutyJco?.baNo || ''})`,
          `Duty NCO:\n${appt.dutyNco?.rank || ''} ${appt.dutyNco?.name || 'N/A'}\n(${appt.dutyNco?.baNo || ''})`
        ],
        [
          `Duty Clerk:\n${appt.dutyClerk?.rank || ''} ${appt.dutyClerk?.name || 'N/A'} (${appt.dutyClerk?.baNo || ''})`,
          `2nd Seater:\n${appt.secondSeater?.rank || appt.dutyBatman?.rank || ''} ${appt.secondSeater?.name || appt.dutyBatman?.name || 'N/A'} (${appt.secondSeater?.baNo || appt.dutyBatman?.baNo || ''})`,
          `Admin Driver:\n${appt.adminDriver?.rank || ''} ${appt.adminDriver?.name || 'N/A'} (${appt.adminDriver?.baNo || ''}) [${appt.adminDriver?.vehicleNo || ''}]`
        ]
      ];

      autoTable(doc, {
        startY: currentY,
        head: [['KEY APPOINTMENTS', 'KEY APPOINTMENTS', 'KEY APPOINTMENTS']],
        body: apptData,
        theme: 'grid',
        headStyles: { fillColor: [45, 74, 34], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
        margin: { left: 12, right: 12 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;
    }

    // Grouped Duty Assignments Table
    const tableRows: any[] = [];
    const placeGroups = roster.placeGroups || [];
    const dutyRows = roster.dutyRows || [];

    placeGroups.forEach(place => {
      const rowsForPlace = dutyRows.filter(r => r.placeOfDuty === place);
      if (rowsForPlace.length > 0) {
        // Section Header Row
        tableRows.push([
          { content: `📍 PLACE OF DUTY: ${place.toUpperCase()}`, colSpan: 6, styles: { fillColor: [240, 243, 238], fontStyle: 'bold', textColor: [45, 74, 34] } }
        ]);

        rowsForPlace.forEach((r, idx) => {
          tableRows.push([
            (idx + 1).toString(),
            r.dutyCategory || 'Sentry',
            `${r.rankTrade} ${r.personnelName}`,
            r.serviceNumber,
            `${r.timeFrom} - ${r.timeTo}`,
            r.remarks || '-'
          ]);
        });
      }
    });

    if (tableRows.length > 0) {
      autoTable(doc, {
        startY: currentY,
        head: [['#', 'Post / Duty Category', 'Personnel Name & Rank', 'BA / Personal No', 'Time Shift', 'Remarks']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [45, 74, 34], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 42 },
          2: { cellWidth: 48 },
          3: { cellWidth: 28, fontStyle: 'bold' },
          4: { cellWidth: 26, halign: 'center' },
          5: { cellWidth: 34 }
        },
        margin: { left: 12, right: 12 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 6;
    }

    // Special Instructions
    if (roster.specialInstructions && roster.specialInstructions.length > 0) {
      if (currentY > 240) {
        doc.addPage();
        currentY = 15;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(45, 74, 34);
      doc.text('SPECIAL ORDERS & INSTRUCTIONS:', 14, currentY);
      currentY += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(40, 40, 40);
      roster.specialInstructions.forEach(inst => {
        doc.text(inst, 14, currentY, { maxWidth: pageWidth - 28 });
        currentY += 4;
      });
      currentY += 3;
    }

    // Signatures Footer
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    } else {
      currentY = Math.max(currentY + 6, 260);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Prepared By:\n${roster.preparedBy || 'Duty Clerk'}`, 25, currentY);
    doc.text(`Checked By:\n${roster.checkedBy || 'Quartermaster'}`, pageWidth / 2, currentY, { align: 'center' });
    doc.text(`Approved By:\nCommanding Officer (CO)`, pageWidth - 25, currentY, { align: 'right' });

    doc.save(`95_FD_AMB_Part1_Duty_Roster_${roster.dutyDate}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 print:hidden">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1.5 cursor-pointer transition text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Editor / List</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold flex items-center gap-1.5 cursor-pointer shadow transition text-xs"
          >
            <Download className="w-4 h-4" />
            <span>Export Official PDF</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl bg-[#2D4A22] hover:bg-[#3B5E2B] text-white font-extrabold flex items-center gap-1.5 cursor-pointer shadow transition text-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Print A4 Roster</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet View */}
      <div id="printable-roster-sheet" className="bg-white text-slate-900 p-8 sm:p-12 rounded-2xl border border-slate-300 shadow-lg max-w-4xl mx-auto space-y-6 print:p-0 print:border-none print:shadow-none print:max-w-none">
        {/* Military RESTRICTED Header */}
        {roster.isRestricted !== false && (
          <div className="text-center font-black text-xs uppercase tracking-widest text-red-600">
            RESTRICTED
          </div>
        )}

        {/* Unit Crest & Title */}
        <div className="text-center border-b-2 border-slate-800 pb-3 space-y-1">
          <div className="w-10 h-10 mx-auto rounded-xl bg-[#2D4A22] text-[#F59E0B] flex items-center justify-center shadow-xs">
            <Shield className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-black uppercase tracking-wider text-[#2D4A22]">
            {roster.unitName || '95 FIELD AMBULANCE'}
          </h1>
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
            {roster.title || 'DAILY PART-1 DUTY ROSTER / ORDERS'}
          </h2>
          <p className="text-xs font-mono font-semibold text-slate-600">
            {roster.secondaryDate ? `Duty Dates: ${roster.dutyDate} to ${roster.secondaryDate}` : `Duty Date: ${roster.dutyDate} • Effective: ${roster.effectiveFrom}`}
          </p>
        </div>

        {/* Main Appointments Summary Grid */}
        {roster.mainAppointments && (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <div className="bg-[#2D4A22] text-white font-extrabold text-xs uppercase p-2 text-center tracking-wider">
              KEY DUTY APPOINTMENTS
            </div>
            <div className="grid grid-cols-3 divide-x divide-y divide-slate-800 text-xs">
              <div className="p-2.5">
                <span className="font-bold text-[10px] uppercase text-slate-500 block">Duty Officer (DO)</span>
                <span className="font-extrabold">{roster.mainAppointments.dutyOfficer?.rank} {roster.mainAppointments.dutyOfficer?.name}</span>
                <span className="text-[11px] font-mono block text-emerald-700 font-bold">{roster.mainAppointments.dutyOfficer?.baNo}</span>
              </div>
              <div className="p-2.5">
                <span className="font-bold text-[10px] uppercase text-slate-500 block">Duty JCO</span>
                <span className="font-extrabold">{roster.mainAppointments.dutyJco?.rank} {roster.mainAppointments.dutyJco?.name}</span>
                <span className="text-[11px] font-mono block text-emerald-700 font-bold">{roster.mainAppointments.dutyJco?.baNo}</span>
              </div>
              <div className="p-2.5">
                <span className="font-bold text-[10px] uppercase text-slate-500 block">Duty NCO</span>
                <span className="font-extrabold">{roster.mainAppointments.dutyNco?.rank} {roster.mainAppointments.dutyNco?.name}</span>
                <span className="text-[11px] font-mono block text-emerald-700 font-bold">{roster.mainAppointments.dutyNco?.baNo}</span>
              </div>
              <div className="p-2.5">
                <span className="font-bold text-[10px] uppercase text-slate-500 block">Duty Clerk</span>
                <span className="font-bold">{roster.mainAppointments.dutyClerk?.rank} {roster.mainAppointments.dutyClerk?.name}</span>
                <span className="text-[11px] font-mono block text-slate-600">{roster.mainAppointments.dutyClerk?.baNo}</span>
              </div>
              <div className="p-2.5">
                <span className="font-bold text-[10px] uppercase text-slate-500 block">2nd Seater</span>
                <span className="font-bold">{roster.mainAppointments.secondSeater?.rank || roster.mainAppointments.dutyBatman?.rank} {roster.mainAppointments.secondSeater?.name || roster.mainAppointments.dutyBatman?.name || 'N/A'}</span>
                <span className="text-[11px] font-mono block text-slate-600">{roster.mainAppointments.secondSeater?.baNo || roster.mainAppointments.dutyBatman?.baNo}</span>
              </div>
              <div className="p-2.5">
                <span className="font-bold text-[10px] uppercase text-slate-500 block">Admin Driver</span>
                <span className="font-bold">{roster.mainAppointments.adminDriver?.rank} {roster.mainAppointments.adminDriver?.name}</span>
                <span className="text-[11px] font-mono block text-slate-600">{roster.mainAppointments.adminDriver?.baNo} • {roster.mainAppointments.adminDriver?.vehicleNo}</span>
              </div>
            </div>
          </div>
        )}

        {/* Grouped Duty Assignment Tables */}
        <div className="space-y-4">
          {(roster.placeGroups || []).map((place) => {
            const rows = (roster.dutyRows || []).filter(r => r.placeOfDuty === place);
            if (rows.length === 0) return null;

            return (
              <div key={place} className="border border-slate-800 rounded-lg overflow-hidden">
                <div className="bg-slate-100 border-b border-slate-800 p-2 font-black text-xs uppercase tracking-wider text-[#2D4A22] flex items-center justify-between">
                  <span>📍 {place}</span>
                  <span className="font-mono text-[10px] text-slate-600 font-normal">({rows.length} Personnel Assigned)</span>
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-600">
                      <th className="p-2 border-r border-slate-800 w-8 text-center">#</th>
                      <th className="p-2 border-r border-slate-800">Post / Category</th>
                      <th className="p-2 border-r border-slate-800">Personnel Name & Rank</th>
                      <th className="p-2 border-r border-slate-800">BA / Personal ID</th>
                      <th className="p-2 border-r border-slate-800 text-center">Time Shift</th>
                      <th className="p-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {rows.map((row, idx) => (
                      <tr key={row.id}>
                        <td className="p-2 border-r border-slate-300 text-center font-mono font-bold">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-300 font-bold">{row.dutyCategory}</td>
                        <td className="p-2 border-r border-slate-300">{row.rankTrade} {row.personnelName}</td>
                        <td className="p-2 border-r border-slate-300 font-mono font-bold text-emerald-800">{row.serviceNumber}</td>
                        <td className="p-2 border-r border-slate-300 text-center font-mono">{row.timeFrom} - {row.timeTo}</td>
                        <td className="p-2">{row.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* Special Instructions */}
        {roster.specialInstructions && roster.specialInstructions.length > 0 && (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-300 space-y-1.5">
            <h4 className="font-black text-xs uppercase tracking-wider text-[#2D4A22]">
              Special Instructions & Operational Standing Orders:
            </h4>
            <div className="space-y-1 text-xs text-slate-800 font-medium">
              {roster.specialInstructions.map((inst, i) => (
                <div key={i}>{inst}</div>
              ))}
            </div>
          </div>
        )}

        {/* Signature Blocks */}
        <div className="pt-10 grid grid-cols-3 gap-6 text-center text-xs border-t border-slate-300 font-sans">
          <div className="space-y-1">
            <div className="h-8"></div>
            <div className="border-t border-slate-800 pt-1 font-bold">
              {roster.preparedBy || 'Duty Clerk'}
            </div>
            <div className="text-[10px] text-slate-500 uppercase">Prepared By</div>
          </div>

          <div className="space-y-1">
            <div className="h-8"></div>
            <div className="border-t border-slate-800 pt-1 font-bold">
              {roster.checkedBy || 'Quartermaster (QM)'}
            </div>
            <div className="text-[10px] text-slate-500 uppercase">Checked By</div>
          </div>

          <div className="space-y-1">
            <div className="h-8"></div>
            <div className="border-t border-slate-800 pt-1 font-extrabold text-[#2D4A22]">
              Commanding Officer (CO)
            </div>
            <div className="text-[10px] text-slate-500 uppercase">95 Field Ambulance</div>
          </div>
        </div>

        {/* Footer Restricted */}
        {roster.isRestricted !== false && (
          <div className="text-center font-black text-xs uppercase tracking-widest text-red-600 pt-4">
            RESTRICTED
          </div>
        )}
      </div>
    </div>
  );
};
