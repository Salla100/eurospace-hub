import { formatDistanceToNow, differenceInDays, format, parseISO } from 'date-fns';

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  return differenceInDays(parseISO(dateStr), new Date());
}

export function deadlineLabel(dateStr) {
  if (!dateStr) return null;
  const d = daysUntil(dateStr);
  if (d < 0) return 'Closed';
  if (d === 0) return 'Today!';
  if (d === 1) return 'Tomorrow!';
  return `${d} days left`;
}

export function deadlineColor(dateStr) {
  if (!dateStr) return 'text-space-muted';
  const d = daysUntil(dateStr);
  if (d < 0) return 'text-space-muted line-through';
  if (d < 7) return 'text-space-danger';
  if (d < 14) return 'text-space-warn';
  return 'text-space-accent';
}

export function deadlineColorHex(dateStr) {
  if (!dateStr) return '#64748b';
  const d = daysUntil(dateStr);
  if (d < 0) return '#64748b';
  if (d < 7) return '#ef4444';
  if (d < 14) return '#f59e0b';
  return '#4f8ef7';
}

export function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    return format(parseISO(dateStr), 'd MMM yyyy');
  } catch {
    return dateStr;
  }
}

export function categoryLabel(cat) {
  const map = {
    internship: 'Internship',
    esa_academy_workshop: 'ESA Academy',
    esa_academy_project: 'ESA Project',
    esa_academy_scholarship: 'Scholarship',
    esa_academy_sponsorship: 'Sponsorship',
    summer_school: 'Summer School',
    competition_rocketry: 'Rocketry',
    competition_rover: 'Rover',
    competition_design: 'Design Comp',
    hackathon: 'Hackathon',
    conference_sponsorship: 'Conference',
    national_network: 'Network',
    bip: 'BIP',
    course_online: 'Online Course',
    workshop_external: 'Workshop',
  };
  return map[cat] || (cat || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function categoryColor(cat) {
  const map = {
    internship: 'bg-purple-900/60 text-purple-300 border border-purple-700/40',
    esa_academy_workshop: 'bg-blue-900/60 text-blue-300 border border-blue-700/40',
    esa_academy_project: 'bg-blue-900/60 text-blue-300 border border-blue-700/40',
    esa_academy_scholarship: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/40',
    esa_academy_sponsorship: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/40',
    summer_school: 'bg-teal-900/60 text-teal-300 border border-teal-700/40',
    competition_rocketry: 'bg-red-900/60 text-red-300 border border-red-700/40',
    competition_rover: 'bg-orange-900/60 text-orange-300 border border-orange-700/40',
    competition_design: 'bg-orange-900/60 text-orange-300 border border-orange-700/40',
    hackathon: 'bg-pink-900/60 text-pink-300 border border-pink-700/40',
    conference_sponsorship: 'bg-indigo-900/60 text-indigo-300 border border-indigo-700/40',
    national_network: 'bg-green-900/60 text-green-300 border border-green-700/40',
    bip: 'bg-cyan-900/60 text-cyan-300 border border-cyan-700/40',
    course_online: 'bg-slate-800/60 text-slate-300 border border-slate-700/40',
    workshop_external: 'bg-violet-900/60 text-violet-300 border border-violet-700/40',
  };
  return map[cat] || 'bg-slate-800/60 text-slate-300 border border-slate-700/40';
}

export function levelPill(level) {
  const map = { BSc: 'bg-slate-700 text-slate-200', MSc: 'bg-slate-600 text-slate-100', PhD: 'bg-slate-500 text-white' };
  return map[level] || 'bg-slate-700 text-slate-200';
}

export const CATEGORY_GROUPS = {
  All: null,
  'ESA Academy': ['esa_academy_workshop', 'esa_academy_project', 'esa_academy_scholarship', 'esa_academy_sponsorship'],
  Competitions: ['competition_rocketry', 'competition_rover', 'competition_design'],
  Hackathons: ['hackathon'],
  'Summer Schools': ['summer_school'],
  Workshops: ['workshop_external'],
  Scholarships: ['esa_academy_scholarship'],
  Networks: ['national_network'],
  BIPs: ['bip'],
  'Conference': ['conference_sponsorship'],
};
