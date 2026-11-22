import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  Evaluation,
  EventSettings,
  Judge,
  LeaderboardEntry,
  Team,
} from '../types/arena';
import { CRITERIA } from './scoring';

function sanitizeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportLeaderboardCsv(
  entries: LeaderboardEntry[],
  settings: EventSettings,
): void {
  const headers = [
    'Rank',
    'Tie Status',
    'Team Name',
    'Project Title',
    'Presentation Status',
    'Average Score (out of 25)',
    'Submissions Received',
    'Total Judges',
  ];

  const rows = entries.map((e) => [
    e.submittedCount > 0 ? e.rank : '-',
    e.isTied ? 'Tied' : 'Single',
    e.teamName,
    e.projectTitle,
    e.presentationStatus,
    e.submittedCount > 0 ? e.averageFormatted : 'N/A',
    e.submittedCount,
    e.totalJudges,
  ]);

  const metaRows = [
    ['Event', settings.eventName],
    ['Institution', settings.collegeName],
    ['Exported At', new Date().toISOString()],
    [],
    headers,
    ...rows,
  ];

  const csvContent = metaRows
    .map((row) => row.map(sanitizeCsvCell).join(','))
    .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const slug = settings.eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  triggerDownload(blob, `${slug || 'rank-rush'}-leaderboard.csv`);
}

export function exportFullWorkbookXlsx(
  entries: LeaderboardEntry[],
  teams: Team[],
  judges: Judge[],
  evaluations: Evaluation[],
  settings: EventSettings,
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Leaderboard
  const leaderboardSheetData = entries.map((e) => ({
    Rank: e.submittedCount > 0 ? e.rank : '-',
    'Tie Status': e.isTied ? 'Tied' : 'Clear',
    Team: e.teamName,
    'Project Title': e.projectTitle,
    'Presentation Status': e.presentationStatus,
    'Average Score (/25)': e.submittedCount > 0 ? Number(e.averageFormatted) : 'N/A',
    'Total Score (sum of totals)': e.ratingSum,
    'Old 1-5 Ratings (not in score)': e.legacyCount ?? 0,
    'Submissions Received': e.submittedCount,
    'Total Judges': e.totalJudges,
  }));
  const ws1 = XLSX.utils.json_to_sheet(leaderboardSheetData);
  XLSX.utils.book_append_sheet(wb, ws1, 'Leaderboard');

  // Sheet 2: Judge Submission Status
  const teamCount = teams.length;
  const evalsByJudge = new Map<string, number>();
  for (const ev of evaluations) {
    evalsByJudge.set(ev.judgeId, (evalsByJudge.get(ev.judgeId) ?? 0) + 1);
  }
  const judgeSheetData = judges.map((j) => {
    const done = evalsByJudge.get(j.id) ?? 0;
    return {
      Name: j.name,
      Email: j.email || '-',
      Department: j.department || '-',
      Status: j.active ? 'Active' : 'Inactive',
      'Submitted Teams': done,
      'Total Teams': teamCount,
      'Completion (%)':
        teamCount > 0 ? Math.round((done / teamCount) * 100) : 0,
    };
  });
  const ws2 = XLSX.utils.json_to_sheet(judgeSheetData);
  XLSX.utils.book_append_sheet(wb, ws2, 'Judge Status');

  // Sheet 3: Individual Ratings (Admin Audit)
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const judgeMap = new Map(judges.map((j) => [j.id, j]));
  const evalSheetData = evaluations.map((ev) => {
    return {
      'Judge Name': judgeMap.get(ev.judgeId)?.name ?? '-',
      'Judge Email': judgeMap.get(ev.judgeId)?.email ?? '-',
      Team: teamMap.get(ev.teamId)?.name ?? ev.teamId,
      'Project Title': teamMap.get(ev.teamId)?.projectTitle ?? '-',
      ...Object.fromEntries(
        CRITERIA.map(({ id, label }) => [`${label} (/5)`, ev.criteria?.[id] ?? '']),
      ),
      'Total (/25)': ev.total ?? '',
      'Old 1-5 Rating (not in standings)': ev.total === undefined ? ev.rating ?? '' : '',
      Feedback: ev.comment || '',
    };
  });
  const ws3 = XLSX.utils.json_to_sheet(evalSheetData);
  XLSX.utils.book_append_sheet(wb, ws3, 'All Ratings');

  const slug = settings.eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  XLSX.writeFile(wb, `${slug || 'rank-rush'}-evaluation-report.xlsx`);
}

export function exportLeaderboardPdf(
  entries: LeaderboardEntry[],
  settings: EventSettings,
  totalSubmitted: number,
  totalPossible: number,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  // Header band
  doc.setFillColor(9, 43, 89); // #092B59 Navy Blue
  doc.rect(0, 0, 595, 96, 'F');

  doc.setTextColor(245, 185, 66); // #F5B942 Gold
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RANK RUSH | SMART PROJECT EVALUATION SYSTEM', 40, 32);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(settings.eventName || 'Official Evaluation Report', 40, 58);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `${settings.collegeName}  |  ${settings.eventDate || new Date().toLocaleDateString()}`,
    40,
    78,
  );

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(10);
  const completion =
    totalPossible > 0 ? Math.round((totalSubmitted / totalPossible) * 100) : 0;
  doc.text(
    `Total Submissions: ${totalSubmitted} / ${totalPossible} (${completion}% Complete)   |   Visibility: ${
      settings.resultsPublished ? 'Published' : 'Admin Preview'
    }`,
    40,
    120,
  );

  autoTable(doc, {
    startY: 138,
    head: [['Rank', 'Team Name', 'Project Title', 'Average (/25)', 'Submissions']],
    body: entries.map((e) => [
      e.submittedCount > 0 ? (e.isTied ? `${e.rank} (Tie)` : `${e.rank}`) : '-',
      e.teamName,
      e.projectTitle,
      e.submittedCount > 0 ? `${e.averageFormatted} / 25` : 'Pending',
      `${e.submittedCount} / ${e.totalJudges}`,
    ]),
    headStyles: {
      fillColor: [9, 43, 89],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    styles: {
      fontSize: 10,
      cellPadding: 8,
    },
  });

  const slug = settings.eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`${slug || 'rank-rush'}-leaderboard.pdf`);
                                         }
