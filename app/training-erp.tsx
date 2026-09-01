'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Analytics02Icon,
  ArrowUpRight02Icon,
  Calendar01Icon,
  CalendarPlus01Icon,
  ChartLineIcon,
  CheckmarkCircle02Icon,
  Clock04Icon,
  DashboardSquare01Icon,
  FilterIcon,
  Menu05Icon,
  Notification01Icon,
  PlusSignIcon,
  Search02Icon,
  Settings01Icon,
  TaskDaily02Icon,
  UserAdd02Icon,
  UserMultipleIcon,
} from '@hugeicons/core-free-icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Status = 'Completed' | 'Scheduled' | 'No-show' | 'Cancelled';
type View = 'Overview' | 'Candidates' | 'Training log' | 'Reports' | 'Settings';
type Candidate = { id: string; name: string; enrolled: string; phone: string };
type Session = { id: string; candidateId: string; candidateName: string; date: string; slot: string; status: Status; trainer: string };
type ProgressCandidate = Candidate & { complete: number; remaining: number; percentage: number };
type WebMCPTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool?: (
        tool: WebMCPTool,
        options?: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

const initialCandidates: Candidate[] = [
  { id: 'TR-082', name: 'Aarav Sen', enrolled: '01 Jun 2026', phone: '•••• 6846' },
  { id: 'TR-090', name: 'Mira Ghosh', enrolled: '02 Jun 2026', phone: '•••• 0251' },
  { id: 'TR-093', name: 'Ishaan Dey', enrolled: '03 Jun 2026', phone: '•••• 1818' },
  { id: 'TR-095', name: 'Rhea Das', enrolled: '04 Jun 2026', phone: '•••• 1089' },
  { id: 'TR-091', name: 'Kabir Roy', enrolled: '02 Jun 2026', phone: '•••• 4824' },
  { id: 'TR-087', name: 'Tara Bose', enrolled: '29 May 2026', phone: '•••• 3751' },
];

const initialSessions: Session[] = [
  { id: 's1', candidateId: 'TR-082', candidateName: 'Aarav Sen', date: 'Today', slot: '07:00', status: 'Completed', trainer: 'S. Rao' },
  { id: 's2', candidateId: 'TR-090', candidateName: 'Mira Ghosh', date: 'Today', slot: '07:30', status: 'No-show', trainer: 'S. Rao' },
  { id: 's3', candidateId: 'TR-093', candidateName: 'Ishaan Dey', date: 'Today', slot: '08:00', status: 'Scheduled', trainer: 'M. Jain' },
  { id: 's4', candidateId: 'TR-095', candidateName: 'Rhea Das', date: 'Today', slot: '08:30', status: 'Scheduled', trainer: 'M. Jain' },
  { id: 's5', candidateId: 'TR-091', candidateName: 'Kabir Roy', date: 'Today', slot: '09:00', status: 'Completed', trainer: 'S. Rao' },
  { id: 's6', candidateId: 'TR-087', candidateName: 'Tara Bose', date: 'Today', slot: '10:00', status: 'Scheduled', trainer: 'S. Rao' },
];

const navItems: { label: View; icon: IconSvgElement }[] = [
  { label: 'Overview', icon: DashboardSquare01Icon }, { label: 'Candidates', icon: UserMultipleIcon },
  { label: 'Training log', icon: Calendar01Icon }, { label: 'Reports', icon: Analytics02Icon }, { label: 'Settings', icon: Settings01Icon },
];

function Icon({ icon, size = 18, className }: { icon: IconSvgElement; size?: number; className?: string }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.8} className={className} />;
}
function statusStyle(status: Status) {
  if (status === 'Completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'Scheduled') return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (status === 'No-show') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-zinc-100 text-zinc-600 ring-zinc-200';
}

export function TrainingERP() {
  const [activeView, setActiveView] = useState<View>('Overview');
  const [target, setTarget] = useState(15);
  const [candidates, setCandidates] = useState(initialCandidates);
  const [sessions, setSessions] = useState(initialSessions);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    void fetch('/api/erp')
      .then(async (response) => response.ok ? response.json() : null)
      .then((data: unknown) => {
        if (!data || typeof data !== 'object') return;
        const payload = data as { trainingTarget?: unknown; candidates?: unknown; sessions?: unknown };
        if (typeof payload.trainingTarget === 'number') setTarget(payload.trainingTarget);
        if (Array.isArray(payload.candidates) && payload.candidates.length > 0) {
          setCandidates(payload.candidates.map((candidate) => {
            const row = candidate as { id?: unknown; name?: unknown; phone?: unknown; enrolledAt?: unknown };
            return { id: String(row.id ?? ''), name: String(row.name ?? ''), phone: String(row.phone ?? '—'), enrolled: String(row.enrolledAt ?? '—') };
          }));
        }
        if (Array.isArray(payload.sessions) && payload.sessions.length > 0) {
          setSessions(payload.sessions.map((session) => {
            const row = session as { id?: unknown; candidateId?: unknown; candidateName?: unknown; sessionDate?: unknown; timeSlot?: unknown; status?: unknown; trainerName?: unknown };
            return { id: String(row.id ?? ''), candidateId: String(row.candidateId ?? ''), candidateName: String(row.candidateName ?? ''), date: String(row.sessionDate ?? ''), slot: String(row.timeSlot ?? ''), status: row.status === 'Completed' || row.status === 'No-show' || row.status === 'Cancelled' ? row.status : 'Scheduled', trainer: String(row.trainerName ?? '—') };
          }));
        }
      })
      .catch(() => undefined);
  }, []);
  const completeByCandidate = useMemo(() => sessions.reduce<Record<string, number>>((counts, session) => {
    if (session.status === 'Completed') counts[session.candidateId] = (counts[session.candidateId] ?? 0) + 1;
    return counts;
  }, {}), [sessions]);
  const completed = sessions.filter((session) => session.status === 'Completed').length;
  const scheduled = sessions.filter((session) => session.status === 'Scheduled').length;
  const noShows = sessions.filter((session) => session.status === 'No-show').length;
  const attendance = completed + noShows === 0 ? 0 : Math.round((completed / (completed + noShows)) * 100);
  const candidateRows: ProgressCandidate[] = candidates.map((candidate) => {
    const complete = completeByCandidate[candidate.id] ?? 0;
    return { ...candidate, complete, remaining: Math.max(target - complete, 0), percentage: Math.round((complete / target) * 100) };
  });
  function saveToD1(payload: Record<string, unknown>) {
    return fetch('/api/erp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(() => undefined).catch(() => undefined);
  }
  function addCandidate(name: string, phone: string) {
    const id = `TR-${String(candidates.length + 96).padStart(3, '0')}`;
    setCandidates((current) => [...current, { id, name, enrolled: 'Today', phone: phone || '—' }]);
    void saveToD1({ action: 'candidate', id, name, phone, enrolledAt: new Date().toISOString().slice(0, 10) });
    return id;
  }
  function handleCandidateAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const name = String(form.get('name') ?? '').trim(); if (!name) return;
    addCandidate(name, String(form.get('phone') ?? '').trim());
    event.currentTarget.reset(); setAddOpen(false); setActiveView('Candidates');
  }
  function completeNextSession() { const next = sessions.find((session) => session.status === 'Scheduled'); if (!next) return null; setSessions((current) => current.map((session) => session.id === next.id ? { ...session, status: 'Completed' } : session)); void saveToD1({ action: 'session-status', id: next.id, status: 'Completed' }); return next; }
  useEffect(() => {
    const registerTool = document.modelContext?.registerTool;
    if (!registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: WebMCPTool) => {
      void Promise.resolve(registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined);
    };
    register({ name: 'get_training_erp_summary', title: 'Get training ERP summary', description: 'Read the current learner, session, and attendance summary.', inputSchema: { type: 'object', additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => ({ activeLearners: candidates.length, completedToday: completed, scheduledNext: scheduled, attendance }) });
    register({ name: 'create_training_candidate', title: 'Create training candidate', description: 'Create a learner in the candidate register using the same flow as the Add learner form.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' } }, required: ['name'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { const row = input as { name?: unknown; phone?: unknown }; const name = typeof row.name === 'string' ? row.name.trim() : ''; if (!name) throw new Error('name is required'); const id = addCandidate(name, typeof row.phone === 'string' ? row.phone.trim() : ''); return { id, name }; } });
    register({ name: 'complete_next_training_session', title: 'Complete next training session', description: 'Mark the earliest scheduled training session as completed.', inputSchema: { type: 'object', additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: () => { const session = completeNextSession(); if (!session) throw new Error('No scheduled sessions are available.'); return { id: session.id, candidateId: session.candidateId, status: 'Completed' }; } });
    return () => lifecycle.abort();
  }, [attendance, candidates.length, completed, scheduled, sessions]);
  return <div className="min-h-screen bg-[#f7f8fc] text-[#151724]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[246px] flex-col border-r border-[#e5e7f0] bg-white px-4 py-5 lg:flex">
      <div className="flex items-center gap-3 px-2"><div className="grid size-9 place-items-center rounded-xl bg-[#25255e] text-white shadow-sm"><Icon icon={TaskDaily02Icon} size={20} /></div><div><p className="text-sm font-semibold tracking-[-0.02em]">PMTS</p><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#777b91]">Operations</p></div></div>
      <nav className="mt-10 space-y-1" aria-label="Primary navigation">{navItems.map((item) => { const active = activeView === item.label; return <button key={item.label} type="button" onClick={() => setActiveView(item.label)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${active ? 'bg-[#ececff] font-medium text-[#363681]' : 'text-[#686c80] hover:bg-[#f4f5f9] hover:text-[#25255e]'}`}><Icon icon={item.icon} size={18} />{item.label}</button>; })}</nav>
      <div className="mt-auto rounded-2xl bg-[#25255e] p-4 text-white"><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#bdbdeb]">Monthly target</p><p className="mt-3 text-2xl font-semibold">{target} sessions</p><p className="mt-1 text-xs leading-5 text-[#c9c9ef]">Every learner progresses against the same completion target.</p><button type="button" onClick={() => setActiveView('Settings')} className="mt-4 text-xs font-medium text-white underline decoration-[#7878bf] underline-offset-4">Manage settings</button></div>
    </aside>
    <main className="lg:pl-[246px]"><header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#e5e7f0]/90 bg-[#f7f8fc]/90 px-5 backdrop-blur-lg sm:px-8"><div className="flex items-center gap-3"><Button variant="outline" size="icon-sm" className="lg:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation"><Icon icon={Menu05Icon} /></Button><div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#777b91]">Training ERP</p><h1 className="text-lg font-semibold tracking-[-0.03em]">{activeView}</h1></div></div><div className="flex items-center gap-2 sm:gap-3"><Button variant="outline" size="icon" className="hidden sm:inline-flex" aria-label="Notifications"><Icon icon={Notification01Icon} /></Button><Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => setActiveView('Training log')}><Icon icon={CalendarPlus01Icon} /> Log session</Button><Button size="sm" onClick={() => setAddOpen(true)}><Icon icon={PlusSignIcon} /> Add learner</Button></div></header>
      {menuOpen && <nav className="border-b border-[#e5e7f0] bg-white px-4 py-3 lg:hidden" aria-label="Mobile navigation"><div className="grid grid-cols-2 gap-1">{navItems.map((item) => <button key={item.label} type="button" onClick={() => { setActiveView(item.label); setMenuOpen(false); }} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${activeView === item.label ? 'bg-[#ececff] text-[#363681]' : 'text-[#686c80]'}`}><Icon icon={item.icon} size={16} />{item.label}</button>)}</div></nav>}
      <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{activeView === 'Overview' && <Overview candidates={candidateRows} sessions={sessions} completed={completed} scheduled={scheduled} attendance={attendance} target={target} onViewCandidates={() => setActiveView('Candidates')} onCompleteNext={completeNextSession} />}{activeView === 'Candidates' && <Candidates candidates={candidateRows} search={search} setSearch={setSearch} onAdd={() => setAddOpen(true)} />}{activeView === 'Training log' && <TrainingLog sessions={sessions} onCompleteNext={completeNextSession} />}{activeView === 'Reports' && <Reports candidates={candidateRows} completed={completed} noShows={noShows} attendance={attendance} target={target} />}{activeView === 'Settings' && <Settings target={target} onTargetChange={setTarget} onPersist={(value) => { void saveToD1({ action: 'settings', trainingTarget: value }); }} />}</div>
    </main>
    {addOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-[#151724]/30 p-4 backdrop-blur-sm" role="presentation"><Card className="w-full max-w-md bg-white shadow-2xl"><CardHeader><CardTitle className="text-lg">Add a learner</CardTitle><CardDescription>Create a candidate record ready for training-session entries.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={handleCandidateAdd}><label className="block text-sm font-medium">Learner name<Input required name="name" placeholder="e.g. Priya Banerjee" className="mt-1.5" /></label><label className="block text-sm font-medium">Phone number<Input name="phone" placeholder="Optional" className="mt-1.5" /></label><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit"><Icon icon={UserAdd02Icon} /> Create learner</Button></div></form></CardContent></Card></div>}
  </div>;
}

function Overview({ candidates, sessions, completed, scheduled, attendance, target, onViewCandidates, onCompleteNext }: { candidates: ProgressCandidate[]; sessions: Session[]; completed: number; scheduled: number; attendance: number; target: number; onViewCandidates: () => void; onCompleteNext: () => void }) {
  const metricCards = [{ label: 'Active learners', value: candidates.length, detail: '+2 this week', icon: UserMultipleIcon, tone: 'bg-[#ececff] text-[#41418e]' }, { label: 'Completed today', value: completed, detail: 'out of 6 logged', icon: CheckmarkCircle02Icon, tone: 'bg-[#e9f9f2] text-[#197b58]' }, { label: 'Scheduled next', value: scheduled, detail: 'across 3 trainers', icon: Calendar01Icon, tone: 'bg-[#eef7ff] text-[#26709c]' }, { label: 'Attendance', value: `${attendance}%`, detail: 'within target range', icon: ChartLineIcon, tone: 'bg-[#fff5e6] text-[#a56018]' }];
  return <><section className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">Tuesday · 09 June</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#1d1f31] sm:text-4xl">Keep every learner moving.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#656a80]">One operational view for your candidates, sessions, attendance, and training pace.</p></div><div className="flex gap-2"><Button variant="outline" onClick={onViewCandidates}><Icon icon={UserMultipleIcon} /> Candidate register</Button><Button onClick={onCompleteNext}><Icon icon={CheckmarkCircle02Icon} /> Complete next</Button></div></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metricCards.map((card) => <Card key={card.label} className="bg-white"><CardContent className="flex items-start justify-between"><div><p className="text-sm text-[#6d7288]">{card.label}</p><p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">{card.value}</p><p className="mt-2 text-xs text-[#82869a]">{card.detail}</p></div><div className={`grid size-10 place-items-center rounded-xl ${card.tone}`}><Icon icon={card.icon} /></div></CardContent></Card>)}</section>
    <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.72fr)]"><Card className="bg-white"><CardHeader><div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8a8ea0]">Live board</p><CardTitle className="mt-1 text-lg">Today&apos;s training slots</CardTitle></div><div className="flex items-center gap-2"><Badge variant="outline" className="font-mono text-[10px]">06 sessions</Badge><Button size="icon-sm" variant="ghost" aria-label="Filter schedule"><Icon icon={FilterIcon} /></Button></div></CardHeader><CardContent className="pt-1"><div className="space-y-2">{sessions.map((session) => <div key={session.id} className="grid grid-cols-[52px_1fr_auto] items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-[#e5e7f0] hover:bg-[#fafbfe]"><span className="font-mono text-xs text-[#6c7187]">{session.slot}</span><div><p className="text-sm font-medium">{session.candidateName}</p><p className="mt-0.5 text-xs text-[#8a8ea0]">{session.candidateId} · {session.trainer}</p></div><Badge className={`${statusStyle(session.status)} ring-1`}>{session.status}</Badge></div>)}</div></CardContent></Card><div className="space-y-6"><Card className="bg-[#25255e] text-white"><CardHeader><div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#bdbdea]">Target completion</p><CardTitle className="mt-1 text-lg text-white">Momentum this week</CardTitle></div><Icon icon={ArrowUpRight02Icon} className="text-[#e5e5ff]" /></CardHeader><CardContent><div className="flex items-end gap-1.5 pt-4" aria-label="Weekly completion trend">{[28, 46, 35, 62, 48, 78, 66].map((height, index) => <div key={height} className="flex-1 rounded-t-md bg-[#8282d7]" style={{ height: `${height}px`, opacity: index === 5 ? 1 : 0.52 }} />)}</div><div className="mt-4 flex justify-between text-xs text-[#c4c4e8]"><span>Mon</span><span>Today</span><span>Sun</span></div><p className="mt-5 text-sm leading-6 text-[#dbdbfb]">{completed} completions logged today. Keep the calendar live as sessions finish.</p></CardContent></Card><Card className="bg-white"><CardHeader><div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8a8ea0]">Attention queue</p><CardTitle className="mt-1 text-lg">Learners needing a nudge</CardTitle></div></CardHeader><CardContent className="space-y-4">{candidates.slice(0, 3).map((candidate) => <div key={candidate.id}><div className="mb-2 flex items-center justify-between"><div><p className="text-sm font-medium">{candidate.name}</p><p className="font-mono text-[10px] text-[#85899b]">{candidate.complete}/{target} completed</p></div><span className="text-sm font-semibold text-[#5559a8]">{candidate.percentage}%</span></div><Progress value={candidate.percentage}><ProgressLabel className="sr-only">{candidate.name} progress</ProgressLabel><ProgressValue className="sr-only" /></Progress></div>)}</CardContent></Card></div></section>
    <section className="mt-6"><Card className="bg-white"><CardHeader><div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8a8ea0]">Candidate register</p><CardTitle className="mt-1 text-lg">Progress at a glance</CardTitle></div><Button size="sm" variant="outline" onClick={onViewCandidates}>View all <Icon icon={ArrowUpRight02Icon} /></Button></CardHeader><CardContent><CandidateTable candidates={candidates.slice(0, 5)} target={target} /></CardContent></Card></section></>;
}

function Candidates({ candidates, search, setSearch, onAdd }: { candidates: ProgressCandidate[]; search: string; setSearch: (value: string) => void; onAdd: () => void }) { const filtered = candidates.filter((candidate) => `${candidate.name} ${candidate.id}`.toLowerCase().includes(search.toLowerCase())); return <><section className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">Master data</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Candidate register</h2><p className="mt-2 text-sm text-[#686d81]">Each learner has one profile and an automatically calculated completion pace.</p></div><Button onClick={onAdd}><Icon icon={UserAdd02Icon} /> Add learner</Button></section><Card className="bg-white"><CardHeader><div className="relative w-full max-w-sm"><Icon icon={Search02Icon} size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#85899b]"/><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search ID or learner" /></div><Badge variant="outline">{filtered.length} records</Badge></CardHeader><CardContent><CandidateTable candidates={filtered} target={15} /></CardContent></Card></>; }
function CandidateTable({ candidates, target }: { candidates: ProgressCandidate[]; target: number }) { return <Table><TableHeader><TableRow><TableHead>Learner</TableHead><TableHead className="hidden md:table-cell">Enrolled</TableHead><TableHead className="hidden lg:table-cell">Contact</TableHead><TableHead>Progress</TableHead><TableHead className="text-right">Remaining</TableHead></TableRow></TableHeader><TableBody>{candidates.map((candidate) => <TableRow key={candidate.id}><TableCell><p className="font-medium">{candidate.name}</p><p className="font-mono text-[10px] text-[#85899b]">{candidate.id}</p></TableCell><TableCell className="hidden text-[#73788d] md:table-cell">{candidate.enrolled}</TableCell><TableCell className="hidden font-mono text-xs text-[#73788d] lg:table-cell">{candidate.phone}</TableCell><TableCell className="min-w-[150px]"><div className="flex items-center gap-3"><Progress value={candidate.percentage} className="flex-1"><ProgressLabel className="sr-only">{candidate.name} completion</ProgressLabel><ProgressValue className="sr-only" /></Progress><span className="font-mono text-[11px] text-[#5559a8]">{candidate.complete}/{target}</span></div></TableCell><TableCell className="text-right font-mono text-xs text-[#5559a8]">{candidate.remaining}</TableCell></TableRow>)}</TableBody></Table>; }
function TrainingLog({ sessions, onCompleteNext }: { sessions: Session[]; onCompleteNext: () => void }) { return <><section className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">Operational log</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Training sessions</h2><p className="mt-2 text-sm text-[#686d81]">Track every learner&apos;s booking, attendance, trainer, and outcome in one activity log.</p></div><Button onClick={onCompleteNext}><Icon icon={CheckmarkCircle02Icon} /> Complete next session</Button></section><Card className="bg-white"><CardHeader><div><CardTitle>Today&apos;s schedule</CardTitle><CardDescription>Complete the earliest pending slot directly from the live log.</CardDescription></div><Badge variant="outline"><Icon icon={Clock04Icon} /> Live</Badge></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Learner</TableHead><TableHead className="hidden md:table-cell">Trainer</TableHead><TableHead>Status</TableHead><TableHead className="hidden lg:table-cell">Notes</TableHead></TableRow></TableHeader><TableBody>{sessions.map((session) => <TableRow key={session.id}><TableCell className="font-mono text-xs text-[#5559a8]">{session.slot}</TableCell><TableCell><p className="font-medium">{session.candidateName}</p><p className="font-mono text-[10px] text-[#85899b]">{session.candidateId}</p></TableCell><TableCell className="hidden text-[#73788d] md:table-cell">{session.trainer}</TableCell><TableCell><Badge className={`${statusStyle(session.status)} ring-1`}>{session.status}</Badge></TableCell><TableCell className="hidden text-sm text-[#85899b] lg:table-cell">—</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></>; }
function Reports({ candidates, completed, noShows, attendance, target }: { candidates: ProgressCandidate[]; completed: number; noShows: number; attendance: number; target: number }) { const totalTarget = candidates.length * target; const portfolio = Math.round((completed / totalTarget) * 100); return <><section className="mb-7"><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">Operations intelligence</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Training performance</h2><p className="mt-2 text-sm text-[#686d81]">A simple performance lens for the team—not another spreadsheet to maintain.</p></section><div className="grid gap-6 xl:grid-cols-[1fr_.8fr]"><Card className="bg-white"><CardHeader><div><CardTitle>Completion capacity</CardTitle><CardDescription>Portfolio progress against the {target}-session requirement.</CardDescription></div></CardHeader><CardContent><div className="flex flex-col gap-7 sm:flex-row sm:items-center"><div className="grid size-44 shrink-0 place-items-center rounded-full border-[13px] border-[#ddddff] bg-[#fafaff]"><div className="text-center"><p className="text-3xl font-semibold tracking-[-0.05em]">{completed}</p><p className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#777b91]">of {totalTarget}</p></div></div><div className="flex-1 space-y-5"><MetricProgress label="Attendance rate" value={attendance} /><MetricProgress label="Portfolio completion" value={portfolio} /></div></div></CardContent></Card><Card className="bg-[#f0f0ff]"><CardHeader><div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#6969a6]">Quality signal</p><CardTitle className="mt-1">Attendance exceptions</CardTitle></div><Icon icon={ChartLineIcon} className="text-[#4b4b9d]" /></CardHeader><CardContent><p className="text-5xl font-semibold tracking-[-0.06em] text-[#32327c]">{noShows}</p><p className="mt-2 text-sm leading-6 text-[#66689a]">No-shows logged today. Follow up early to protect learner momentum.</p><Button className="mt-6" variant="outline"><Icon icon={TaskDaily02Icon} /> Review follow-ups</Button></CardContent></Card></div></>; }
function MetricProgress({ label, value }: { label: string; value: number }) { return <div><div className="mb-2 flex justify-between text-sm"><span>{label}</span><span className="font-semibold text-[#41418e]">{value}%</span></div><Progress value={value}><ProgressLabel className="sr-only">{label}</ProgressLabel><ProgressValue className="sr-only" /></Progress></div>; }
function Settings({ target, onTargetChange, onPersist }: { target: number; onTargetChange: (value: number) => void; onPersist: (value: number) => void }) { const slots = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '15:30', '16:00']; return <><section className="mb-7"><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">System configuration</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Training rules</h2><p className="mt-2 text-sm text-[#686d81]">Set the operational standard that drives candidate progress and session availability.</p></section><div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><Card className="bg-white"><CardHeader><div><CardTitle>Completion target</CardTitle><CardDescription>Required sessions per learner.</CardDescription></div></CardHeader><CardContent><label className="text-sm font-medium">Sessions required<Input type="number" min="1" value={target} onChange={(event) => onTargetChange(Math.max(1, Number(event.target.value) || 1))} onBlur={() => onPersist(target)} className="mt-2 max-w-44 font-mono text-base" /></label><p className="mt-4 text-sm leading-6 text-[#73788d]">This value updates remaining-session and completion-rate calculations across the application.</p></CardContent></Card><Card className="bg-white"><CardHeader><div><CardTitle>Available time slots</CardTitle><CardDescription>These are the bookable windows for training sessions.</CardDescription></div><Button size="sm" variant="outline"><Icon icon={PlusSignIcon} /> Add slot</Button></CardHeader><CardContent><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.map((slot) => <div key={slot} className="rounded-lg border border-[#e5e7f0] bg-[#fafbfe] px-3 py-2 font-mono text-xs text-[#5559a8]">{slot}</div>)}</div><div className="mt-6 border-t border-[#e5e7f0] pt-5"><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#85899b]">Session statuses</p><div className="mt-3 flex flex-wrap gap-2">{(['Completed', 'Scheduled', 'No-show', 'Cancelled'] as Status[]).map((status) => <Badge key={status} className={`${statusStyle(status)} ring-1`}>{status}</Badge>)}</div></div></CardContent></Card></div></>; }
