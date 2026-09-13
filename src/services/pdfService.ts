// jsPDF Report & Watermarked Document Generator for 95 Fd Amb

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DutyRoster, ManpowerDailyState, ManpowerPersonnel } from '../types';

export const generateDutyRosterPdf = (
  roster: Partial<DutyRoster>, 
  customStatusBanner: string = 'DRAFT — NOT YET APPROVED'
) => {
  const doc = new jsPDF();

  // Unit Title Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('HEADQUARTERS, 95 FIELD AMBULANCE', 105, 15, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('PART-I DAILY DUTY ROSTER', 105, 22, { align: 'center' });

  doc.setFontSize(9);
  doc.text(`Reference No: ${roster.referenceNo || '95FA/DUTY/DRAFT'} | Date: ${roster.dutyDate || new Date().toISOString().substring(0, 10)}`, 105, 28, { align: 'center' });

  // Dynamic Status Banner
  doc.setFillColor(roster.status === 'CO_APPROVED' ? 45 : 220, roster.status === 'CO_APPROVED' ? 74 : 38, roster.status === 'CO_APPROVED' ? 34 : 38);
  doc.rect(14, 32, 182, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(customStatusBanner.toUpperCase(), 105, 37.5, { align: 'center' });

  // Roster Metadata Box
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  autoTable(doc, {
    startY: 44,
    head: [['Serial', 'Duty Appointment', 'Assigned Personal ID', 'Shift Period', 'Station']],
    body: [
      ['1', 'Duty Medical Officer (DMO)', 'MO On Call', '0600h - 0600h (24h)', 'MI Room & Resuscitation Bay'],
      ['2', 'Duty NCO', 'Senior Sergeant Duty', '0600h - 0600h (24h)', 'HQ Duty Room / Gate'],
      ['3', 'Emergency Standby Medic #1', 'Combat Medic', '0800h - 2000h (Day)', 'Ambulance Bay #1'],
      ['4', 'Emergency Standby Medic #2', 'Combat Medic', '2000h - 0800h (Night)', 'Ambulance Bay #1'],
      ['5', 'SMT Standby ICU Driver', 'Driver Special', '0600h - 0600h (24h)', 'SMT Vehicle Bay']
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 51, 22], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 }
  });

  // Footer & Governance Notice
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('“This application is an administrative and decision-support system. It does not replace official registers unless formally approved by competent authority.”', 105, finalY, { align: 'center', maxWidth: 180 });

  // Signature Blocks
  doc.setFont('helvetica', 'bold');
  doc.text('Prepared By:', 20, finalY + 15);
  doc.text('Verified By 2IC:', 85, finalY + 15);
  doc.text('Approved By CO:', 150, finalY + 15);

  doc.setFont('helvetica', 'normal');
  doc.text('Part-I Duty Operator', 20, finalY + 20);
  doc.text(roster.twoIcApprovedByUserId ? 'Second-in-Command (VERIFIED)' : '[ PENDING 2IC ]', 85, finalY + 20);
  doc.text(roster.status === 'CO_APPROVED' ? 'Commanding Officer (APPROVED)' : '[ PENDING CO ]', 150, finalY + 20);

  // Download PDF file
  doc.save(`95FA_Duty_Roster_${roster.dutyDate || 'Draft'}.pdf`);
};

export const generateManpowerPdf = (
  state: ManpowerDailyState, 
  personnelList: ManpowerPersonnel[]
) => {
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('HEADQUARTERS, 95 FIELD AMBULANCE', 105, 15, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('DAILY MANPOWER STATE REPORT (INCL. SMT)', 105, 22, { align: 'center' });

  doc.setFontSize(9);
  doc.text(`State Date: ${state.stateDate} | Version: v${state.version}`, 105, 28, { align: 'center' });

  // Strength Summary
  autoTable(doc, {
    startY: 34,
    head: [['Authorized', 'Held', 'Present', 'Effective', 'Leave', 'Course', 'TD', 'Hospital', 'Deficiency']],
    body: [
      [
        state.totalAuthorized,
        state.totalHeld,
        state.totalPresent,
        state.totalEffective,
        state.totalLeave,
        state.totalCourse,
        state.totalTemporaryDuty,
        state.totalMedicalAdmitted,
        state.totalDeficiency
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: [45, 74, 34], textColor: 255, fontStyle: 'bold' }
  });

  // Nominal Roll table
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['BA No', 'Rank', 'Name', 'Trade', 'Appointment', 'Section', 'Status', 'Expected Return', 'Remarks']],
    body: personnelList.map(p => [
      p.baNo || p.personalNumber,
      p.rank || 'Snk',
      p.name || p.appointment,
      p.trade || (p.qualification?.includes('SMT') ? 'SMT' : 'MA'),
      p.appointment,
      p.sectionCode,
      p.currentStatus,
      p.expectedReturnDate || '—',
      p.remarks || '—'
    ]),
    theme: 'striped',
    headStyles: { fillColor: [30, 51, 22], textColor: 255 },
    styles: { fontSize: 7, cellPadding: 2 }
  });

  doc.save(`95FA_Manpower_State_${state.stateDate}.pdf`);
};
