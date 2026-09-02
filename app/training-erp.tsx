'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
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
type Candidate = { id: string; name: string; enrolled: string; phone: string };
type Session = { id: string; candidateId: string; candidateName: string; date: string; slot: string; status: Status; trainer: string; notes: string };
type ProgressCandidate = Candidate & { complete: number; remaining: number; percentage: number };
type ApiPayload = { trainingTarget?: unknown; candidates?: unknown; sessions?: unknown; error?: unknown };

const STATUSES: Status[] = ['Scheduled', 'Completed', 'No-show', 'Cancelled'];
const navItems = [
  { label: 'Candidate dashboard', href: '/', icon: DashboardSquare01Icon },
  { label: 'Candidates', href: '/candidates', icon: UserMultipleIcon },
  { label: 'Training log', href: '/training-log', icon: Calendar01Icon },
  { label: 'Reports', href: '/reports', icon: Analytics02Icon },
  { label: 'Settings', href: '/settings', icon: Settings01Icon },
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

function dateToday() {
  return new Date().toISOString().slice(0, 10);
}

function asStatus(value: unknown): Status {
  return value === 'Completed' || value === 'No-show' || value === 'Cancelled' ? value : 'Scheduled';
}

async function postERP(payload: Record<string, unknown>) {
  const response = await fetch('/api/erp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as { error?: unknown; id?: unknown };
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Unable to save this change.');
  return result;
}

export function TrainingERP() {
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const page = navItems.find((item) => item.href === pathname) ?? navItems[0];
  const [target, setTarget] = useState(15);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const response = await fetch('/api/erp', { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as ApiPayload;
        if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Unable to load PMTS data.');
        if (!mounted) return;
        if (typeof payload.trainingTarget === 'number') setTarget(payload.trainingTarget);
        setCandidates(
          Array.isArray(payload.candidates)
            ? payload.candidates.map((item) => {
                const row = item as { id?: unknown; name?: unknown; phone?: unknown; enrolledAt?: unknown };
                return { id: String(row.id ?? ''), name: String(row.name ?? ''), phone: String(row.phone ?? '—'), enrolled: String(row.enrolledAt ?? '—') };
              })
            : [],
        );
        setSessions(
          Array.isArray(payload.sessions)
            ? payload.sessions.map((item) => {
                const row = item as { id?: unknown; candidateId?: unknown; candidateName?: unknown; sessionDate?: unknown; timeSlot?: unknown; status?: unknown; trainerName?: unknown; notes?: unknown };
                return { id: String(row.id ?? ''), candidateId: String(row.candidateId ?? ''), candidateName: String(row.candidateName ?? ''), date: String(row.sessionDate ?? ''), slot: String(row.timeSlot ?? ''), status: asStatus(row.status), trainer: String(row.trainerName ?? '—'), notes: String(row.notes ?? '') };
              })
            : [],
        );
      } catch (error) {
        if (mounted) setMessage(error instanceof Error ? error.message : 'Unable to load PMTS data.');
      } finally {
        if (mounted) setLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const completedByCandidate = useMemo(() => sessions.reduce<Record<string, number>>((counts, session) => {
    if (session.status === 'Completed') counts[session.candidateId] = (counts[session.candidateId] ?? 0) + 1;
    return counts;
  }, {}), [sessions]);
  const rows: ProgressCandidate[] = candidates.map((candidate) => {
    const complete = completedByCandidate[candidate.id] ?? 0;
    return { ...candidate, complete, remaining: Math.max(target - complete, 0), percentage: Math.round((complete / target) * 100) };
  });
  const completed = sessions.filter((session) => session.status === 'Completed').length;
  const scheduled = sessions.filter((session) => session.status === 'Scheduled').length;
  const noShows = sessions.filter((session) => session.status === 'No-show').length;
  const attendance = completed + noShows ? Math.round((completed / (completed + noShows)) * 100) : 0;
  const selected = rows.find((candidate) => candidate.id === searchParams.get('candidate')) ?? rows[0];

  async function createCandidate(name: string, phone: string) {
    const result = await postERP({ action: 'candidate', name, phone, enrolledAt: dateToday() });
    const id = String(result.id ?? '');
    if (!id) throw new Error('The learner record was not created.');
    setCandidates((current) => [...current, { id, name, phone: phone || '—', enrolled: dateToday() }]);
  }

  async function createSession(input: { candidateId: string; date: string; slot: string; trainer: string; status: Status; notes: string }) {
    const result = await postERP({ action: 'session', candidateId: input.candidateId, sessionDate: input.date, timeSlot: input.slot, trainerName: input.trainer, status: input.status, notes: input.notes });
    const id = String(result.id ?? '');
    if (!id) throw new Error('The session was not created.');
    const learner = candidates.find((candidate) => candidate.id === input.candidateId);
    const session: Session = { id, candidateId: input.candidateId, candidateName: learner?.name ?? input.candidateId, date: input.date, slot: input.slot, status: input.status, trainer: input.trainer || '—', notes: input.notes };
    setSessions((current) => [...current, session].sort((a, b) => `${a.date} ${a.slot}`.localeCompare(`${b.date} ${b.slot}`)));
  }

  async function setSessionStatus(id: string, status: Status) {
    await postERP({ action: 'session-status', id, status });
    setSessions((current) => current.map((session) => session.id === id ? { ...session, status } : session));
  }

  async function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const phone = String(form.get('phone') ?? '').trim();
    if (!name) return;
    setSaving(true); setMessage(null);
    try {
      await createCandidate(name, phone);
      setAddOpen(false);
      window.location.assign('/candidates');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create the learner.');
    } finally { setSaving(false); }
  }

  async function completeNext() {
    const next = sessions.find((session) => session.status === 'Scheduled');
    if (!next) { setMessage('There are no scheduled sessions to complete.'); return; }
    setSaving(true); setMessage(null);
    try { await setSessionStatus(next.id, 'Completed'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update the session.'); }
    finally { setSaving(false); }
  }

  async function saveTarget(value: number) {
    setSaving(true); setMessage(null);
    try { await postERP({ action: 'settings', trainingTarget: value }); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save the training target.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-[#151724]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[246px] flex-col border-r border-[#e5e7f0] bg-white px-4 py-5 lg:flex">
        <a href="/" className="flex items-center gap-3 px-2"><div className="grid size-9 place-items-center rounded-xl bg-[#25255e] text-white shadow-sm"><Icon icon={TaskDaily02Icon} size={20} /></div><div><p className="text-sm font-semibold tracking-[-0.02em]">PMTS</p><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#777b91]">Operations</p></div></a>
        <nav className="mt-10 space-y-1" aria-label="Primary navigation">{navItems.map((item) => <a key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${page.href === item.href ? 'bg-[#ececff] font-medium text-[#363681]' : 'text-[#686c80] hover:bg-[#f4f5f9] hover:text-[#25255e]'}`}><Icon icon={item.icon} size={18} />{item.label}</a>)}</nav>
        <div className="mt-auto rounded-2xl bg-[#25255e] p-4 text-white"><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#bdbdeb]">Monthly target</p><p className="mt-3 text-2xl font-semibold">{target} sessions</p><p className="mt-1 text-xs leading-5 text-[#c9c9ef]">Every learner progresses against the same completion target.</p><a href="/settings" className="mt-4 inline-block text-xs font-medium text-white underline decoration-[#7878bf] underline-offset-4">Manage settings</a></div>
      </aside>
      <main className="lg:pl-[246px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#e5e7f0]/90 bg-[#f7f8fc]/90 px-5 backdrop-blur-lg sm:px-8"><div className="flex items-center gap-3"><Button variant="outline" size="icon-sm" className="lg:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation"><Icon icon={Menu05Icon} /></Button><div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#777b91]">Training ERP</p><h1 className="text-lg font-semibold tracking-[-0.03em]">{page.label}</h1></div></div><div className="flex items-center gap-2 sm:gap-3"><Button variant="outline" size="icon" className="hidden sm:inline-flex" aria-label="Notifications"><Icon icon={Notification01Icon} /></Button><a href="/training-log" className="hidden h-7 items-center gap-1 rounded-lg border border-[#e5e7f0] bg-white px-2.5 text-[0.8rem] font-medium hover:bg-[#f3f4f8] sm:inline-flex"><Icon icon={CalendarPlus01Icon} /> Log session</a><Button size="sm" onClick={() => setAddOpen(true)}><Icon icon={PlusSignIcon} /> Add learner</Button></div></header>
        {menuOpen && <nav className="border-b border-[#e5e7f0] bg-white px-4 py-3 lg:hidden" aria-label="Mobile navigation"><div className="grid grid-cols-2 gap-1">{navItems.map((item) => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${page.href === item.href ? 'bg-[#ececff] text-[#363681]' : 'text-[#686c80]'}`}><Icon icon={item.icon} size={16} />{item.label}</a>)}</div></nav>}
        <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">
          {message && <div role="status" className="mb-5 rounded-xl border border-[#eed5d8] bg-[#fff7f7] px-4 py-3 text-sm text-[#9b3039]">{message}</div>}
          {!loaded && <Card className="bg-white"><CardContent className="py-14 text-center"><p className="font-mono text-xs uppercase tracking-[0.16em] text-[#777b91]">Loading PMTS records</p></CardContent></Card>}
          {loaded && page.href === '/' && (selected ? <CandidateDashboard candidate={selected} candidates={rows} sessions={sessions} target={target} /> : <EmptyDashboard onAdd={() => setAddOpen(true)} />)}
          {loaded && page.href === '/candidates' && <Candidates candidates={rows} target={target} search={search} onSearch={setSearch} onAdd={() => setAddOpen(true)} />}
          {loaded && page.href === '/training-log' && <TrainingLog candidates={rows} sessions={sessions} saving={saving} onCreate={createSession} onComplete={completeNext} />}
          {loaded && page.href === '/reports' && <Reports candidates={rows} completed={completed} noShows={noShows} attendance={attendance} target={target} />}
          {loaded && page.href === '/settings' && <Settings target={target} saving={saving} onChange={setTarget} onSave={saveTarget} />}
        </div>
      </main>
      {addOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-[#151724]/30 p-4 backdrop-blur-sm"><Card className="w-full max-w-md bg-white shadow-2xl"><CardHeader><CardTitle className="text-lg">Add a learner</CardTitle><CardDescription>Create a candidate record in the PMTS database.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={submitCandidate}><label className="block text-sm font-medium">Learner name<Input required name="name" placeholder="e.g. Priya Banerjee" className="mt-1.5" /></label><label className="block text-sm font-medium">Phone number<Input name="phone" placeholder="Optional" className="mt-1.5" /></label><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}><Icon icon={UserAdd02Icon} /> {saving ? 'Saving…' : 'Create learner'}</Button></div></form></CardContent></Card></div>}
    </div>
  );
}

function EmptyDashboard({ onAdd }: { onAdd: () => void }) {
  return <Card className="border border-dashed border-[#cfd2e4] bg-white"><CardContent className="flex min-h-80 flex-col items-center justify-center text-center"><div className="grid size-12 place-items-center rounded-2xl bg-[#ececff] text-[#3f3f91]"><Icon icon={UserAdd02Icon} size={22} /></div><p className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#777b91]">Database ready</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Add your first learner</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#686d81]">There are no PMTS records yet. New learners and training sessions will be saved to your Cloudflare D1 database.</p><Button className="mt-6" onClick={onAdd}><Icon icon={UserAdd02Icon} /> Add learner</Button></CardContent></Card>;
}

function CandidateDashboard({ candidate, candidates, sessions, target }: { candidate: ProgressCandidate; candidates: ProgressCandidate[]; sessions: Session[]; target: number }) {
  const history = sessions.filter((session) => session.candidateId === candidate.id);
  const nextSession = history.find((session) => session.status === 'Scheduled');
  const misses = history.filter((session) => session.status === 'No-show').length;
  const attendance = candidate.complete + misses ? Math.round((candidate.complete / (candidate.complete + misses)) * 100) : 0;
  return <><section className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">Learner workspace</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#1d1f31] sm:text-4xl">{candidate.name}&apos;s dashboard</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#656a80]">Individual training progress, attendance, and session activity in one focused view.</p></div><label className="w-full xl:w-[310px]"><span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.15em] text-[#777b91]">Selected candidate</span><select value={candidate.id} onChange={(event) => window.location.assign(`/?candidate=${encodeURIComponent(event.target.value)}`)} className="h-10 w-full rounded-lg border border-[#dfe2ec] bg-white px-3 text-sm outline-none focus:border-[#7575cf] focus:ring-2 focus:ring-[#7575cf]/20">{candidates.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select></label></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Sessions complete" value={`${candidate.complete}/${target}`} detail={candidate.remaining ? `${candidate.remaining} sessions remaining` : 'Training target reached'} icon={CheckmarkCircle02Icon} tone="bg-[#e9f9f2] text-[#197b58]" /><MetricCard label="Completion pace" value={`${candidate.percentage}%`} detail="Against programme target" icon={ChartLineIcon} tone="bg-[#ececff] text-[#41418e]" /><MetricCard label="Attendance" value={`${attendance}%`} detail="From recorded outcomes" icon={UserMultipleIcon} tone="bg-[#fff5e6] text-[#a56018]" /><MetricCard label="Next session" value={nextSession?.slot ?? '—'} detail={nextSession ? `${nextSession.date} · ${nextSession.trainer}` : 'No future slot booked'} icon={Calendar01Icon} tone="bg-[#eef7ff] text-[#26709c]" /></section>
    <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(320px,.78fr)]"><Card className="bg-white"><CardHeader><div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8a8ea0]">Progress plan</p><CardTitle className="mt-1 text-lg">Completion journey</CardTitle></div><Badge variant="outline" className="font-mono text-[10px]">{candidate.id}</Badge></CardHeader><CardContent><div className="rounded-2xl bg-[#f7f8fc] p-5"><div className="flex items-end justify-between gap-4"><div><p className="text-4xl font-semibold tracking-[-0.06em] text-[#25255e]">{candidate.percentage}%</p><p className="mt-1 text-sm text-[#6d7288]">{candidate.complete} completed of {target} required sessions</p></div><span className="rounded-xl bg-white px-3 py-2 font-mono text-xs text-[#5559a8]">{candidate.remaining} left</span></div><Progress value={candidate.percentage} className="mt-6"><ProgressLabel className="sr-only">{candidate.name} completion</ProgressLabel><ProgressValue className="sr-only" /></Progress></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><InfoBox label="Enrolled" value={candidate.enrolled} /><InfoBox label="Contact" value={candidate.phone} mono /></div></CardContent></Card><Card className="bg-[#25255e] text-white"><CardHeader><div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#bdbdea]">Next action</p><CardTitle className="mt-1 text-lg text-white">Session readiness</CardTitle></div><Icon icon={Clock04Icon} className="text-[#e5e5ff]" /></CardHeader><CardContent>{nextSession ? <><p className="text-3xl font-semibold tracking-[-0.05em]">{nextSession.slot}</p><p className="mt-2 text-sm text-[#dbdbfb]">{nextSession.date} with {nextSession.trainer}</p><Badge className="mt-5 bg-white/10 text-white ring-1 ring-white/20">Scheduled</Badge></> : <><p className="text-xl font-semibold">No session booked</p><p className="mt-2 text-sm leading-6 text-[#dbdbfb]">Schedule the next training slot to keep momentum moving.</p><a href="/training-log" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-white underline underline-offset-4">Open training log <Icon icon={ArrowUpRight02Icon} size={16} /></a></>}</CardContent></Card></section>
    <section className="mt-6"><Card className="bg-white"><CardHeader><div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8a8ea0]">Candidate history</p><CardTitle className="mt-1 text-lg">Training sessions</CardTitle></div><a href="/training-log" className="inline-flex items-center gap-1 text-sm font-medium text-[#4b4b9d] hover:text-[#25255e]">Open full log <Icon icon={ArrowUpRight02Icon} size={16} /></a></CardHeader><CardContent>{history.length ? <div className="space-y-2">{history.map((session) => <div key={session.id} className="grid grid-cols-[70px_1fr_auto] items-center gap-3 rounded-xl border border-[#e5e7f0] px-4 py-3"><span className="font-mono text-xs text-[#5559a8]">{session.slot}</span><div><p className="text-sm font-medium">{session.date}</p><p className="mt-0.5 text-xs text-[#85899b]">Trainer · {session.trainer}</p></div><Badge className={`${statusStyle(session.status)} ring-1`}>{session.status}</Badge></div>)}</div> : <p className="py-7 text-sm text-[#73788d]">No sessions have been logged for this learner yet.</p>}</CardContent></Card></section></>;
}

function MetricCard({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: IconSvgElement; tone: string }) {
  return <Card className="bg-white"><CardContent className="flex items-start justify-between"><div><p className="text-sm text-[#6d7288]">{label}</p><p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">{value}</p><p className="mt-2 text-xs text-[#82869a]">{detail}</p></div><div className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon icon={icon} /></div></CardContent></Card>;
}

function InfoBox({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-xl border border-[#e5e7f0] p-4"><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#85899b]">{label}</p><p className={`mt-2 text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</p></div>;
}

function Candidates({ candidates, target, search, onSearch, onAdd }: { candidates: ProgressCandidate[]; target: number; search: string; onSearch: (value: string) => void; onAdd: () => void }) {
  const filtered = candidates.filter((candidate) => `${candidate.name} ${candidate.id}`.toLowerCase().includes(search.toLowerCase()));
  return <><section className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">Master data</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Candidate register</h2><p className="mt-2 text-sm text-[#686d81]">Each learner has one profile and an automatically calculated completion pace.</p></div><Button onClick={onAdd}><Icon icon={UserAdd02Icon} /> Add learner</Button></section><Card className="bg-white"><CardHeader><div className="relative w-full max-w-sm"><Icon icon={Search02Icon} size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#85899b]" /><Input value={search} onChange={(event) => onSearch(event.target.value)} className="pl-9" placeholder="Search ID or learner" /></div><Badge variant="outline">{filtered.length} records</Badge></CardHeader><CardContent>{filtered.length ? <CandidateTable candidates={filtered} target={target} /> : <p className="py-10 text-center text-sm text-[#73788d]">No learners yet. Add the first learner to create a D1 record.</p>}</CardContent></Card></>;
}

function CandidateTable({ candidates, target }: { candidates: ProgressCandidate[]; target: number }) {
  return <Table><TableHeader><TableRow><TableHead>Learner</TableHead><TableHead className="hidden md:table-cell">Enrolled</TableHead><TableHead className="hidden lg:table-cell">Contact</TableHead><TableHead>Progress</TableHead><TableHead className="text-right">Remaining</TableHead></TableRow></TableHeader><TableBody>{candidates.map((candidate) => <TableRow key={candidate.id}><TableCell><a href={`/?candidate=${encodeURIComponent(candidate.id)}`} className="block hover:text-[#4b4b9d]"><p className="font-medium">{candidate.name}</p><p className="font-mono text-[10px] text-[#85899b]">{candidate.id}</p></a></TableCell><TableCell className="hidden text-[#73788d] md:table-cell">{candidate.enrolled}</TableCell><TableCell className="hidden font-mono text-xs text-[#73788d] lg:table-cell">{candidate.phone}</TableCell><TableCell className="min-w-[150px]"><div className="flex items-center gap-3"><Progress value={candidate.percentage} className="flex-1"><ProgressLabel className="sr-only">{candidate.name} completion</ProgressLabel><ProgressValue className="sr-only" /></Progress><span className="font-mono text-[11px] text-[#5559a8]">{candidate.complete}/{target}</span></div></TableCell><TableCell className="text-right font-mono text-xs text-[#5559a8]">{candidate.remaining}</TableCell></TableRow>)}</TableBody></Table>;
}

function TrainingLog({ candidates, sessions, saving, onCreate, onComplete }: { candidates: ProgressCandidate[]; sessions: Session[]; saving: boolean; onCreate: (input: { candidateId: string; date: string; slot: string; trainer: string; status: Status; notes: string }) => Promise<void>; onComplete: () => Promise<void> }) {
  const [candidateId, setCandidateId] = useState('');
  const [date, setDate] = useState(dateToday());
  const [slot, setSlot] = useState('09:00');
  const [trainer, setTrainer] = useState('');
  const [status, setStatus] = useState<Status>('Scheduled');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!candidateId) { setError('Choose a learner before saving the session.'); return; }
    setError(null);
    try { await onCreate({ candidateId, date, slot, trainer, status, notes }); setNotes(''); setStatus('Scheduled'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save the session.'); }
  }
  return <><section className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">Operational log</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Training sessions</h2><p className="mt-2 text-sm text-[#686d81]">Every entry below is stored as a session record in D1.</p></div><Button onClick={() => void onComplete()} disabled={saving || !sessions.some((session) => session.status === 'Scheduled')}><Icon icon={CheckmarkCircle02Icon} /> Complete next session</Button></section>
    {!candidates.length ? <Card className="bg-white"><CardContent className="py-10 text-center text-sm text-[#73788d]">Add a learner before logging a training session.</CardContent></Card> : <Card className="mb-6 bg-white"><CardHeader><div><CardTitle>Log a session</CardTitle><CardDescription>Create a permanent attendance and progress record.</CardDescription></div></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={submit}><label className="text-sm font-medium">Learner<select required value={candidateId} onChange={(event) => setCandidateId(event.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-[#dfe2ec] bg-white px-2.5 text-sm outline-none focus:border-[#7575cf] focus:ring-2 focus:ring-[#7575cf]/20"><option value="">Select learner</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.id}</option>)}</select></label><label className="text-sm font-medium">Date<Input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5" /></label><label className="text-sm font-medium">Time<Input type="time" required value={slot} onChange={(event) => setSlot(event.target.value)} className="mt-1.5" /></label><label className="text-sm font-medium">Trainer<Input value={trainer} onChange={(event) => setTrainer(event.target.value)} placeholder="Optional" className="mt-1.5" /></label><label className="text-sm font-medium">Outcome<select value={status} onChange={(event) => setStatus(asStatus(event.target.value))} className="mt-1.5 h-9 w-full rounded-lg border border-[#dfe2ec] bg-white px-2.5 text-sm outline-none focus:border-[#7575cf] focus:ring-2 focus:ring-[#7575cf]/20">{STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-sm font-medium">Notes<Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" className="mt-1.5" /></label>{error && <p className="text-sm text-[#9b3039] md:col-span-2 xl:col-span-3">{error}</p>}<div className="md:col-span-2 xl:col-span-3"><Button type="submit" disabled={saving}><Icon icon={CalendarPlus01Icon} /> {saving ? 'Saving…' : 'Save session'}</Button></div></form></CardContent></Card>}
    <Card className="bg-white"><CardHeader><div><CardTitle>Session register</CardTitle><CardDescription>Current records from the PMTS database.</CardDescription></div><Badge variant="outline"><Icon icon={Clock04Icon} /> Live</Badge></CardHeader><CardContent>{sessions.length ? <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Learner</TableHead><TableHead className="hidden md:table-cell">Trainer</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{sessions.map((session) => <TableRow key={session.id}><TableCell className="text-sm text-[#73788d]">{session.date}</TableCell><TableCell className="font-mono text-xs text-[#5559a8]">{session.slot}</TableCell><TableCell><a href={`/?candidate=${encodeURIComponent(session.candidateId)}`} className="block hover:text-[#4b4b9d]"><p className="font-medium">{session.candidateName}</p><p className="font-mono text-[10px] text-[#85899b]">{session.candidateId}</p></a></TableCell><TableCell className="hidden text-[#73788d] md:table-cell">{session.trainer}</TableCell><TableCell><Badge className={`${statusStyle(session.status)} ring-1`}>{session.status}</Badge></TableCell></TableRow>)}</TableBody></Table> : <p className="py-10 text-center text-sm text-[#73788d]">No sessions have been logged yet.</p>}</CardContent></Card></>;
}

function Reports({ candidates, completed, noShows, attendance, target }: { candidates: ProgressCandidate[]; completed: number; noShows: number; attendance: number; target: number }) {
  const totalTarget = candidates.length * target;
  const portfolio = totalTarget ? Math.round((completed / totalTarget) * 100) : 0;
  return <><section className="mb-7"><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">Operations intelligence</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Training performance</h2><p className="mt-2 text-sm text-[#686d81]">A simple performance lens for the team—not another spreadsheet to maintain.</p></section><div className="grid gap-6 xl:grid-cols-[1fr_.8fr]"><Card className="bg-white"><CardHeader><div><CardTitle>Completion capacity</CardTitle><CardDescription>Portfolio progress against the {target}-session requirement.</CardDescription></div></CardHeader><CardContent><div className="flex flex-col gap-7 sm:flex-row sm:items-center"><div className="grid size-44 shrink-0 place-items-center rounded-full border-[13px] border-[#ddddff] bg-[#fafaff]"><div className="text-center"><p className="text-3xl font-semibold tracking-[-0.05em]">{completed}</p><p className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#777b91]">of {totalTarget}</p></div></div><div className="flex-1 space-y-5"><MetricProgress label="Attendance rate" value={attendance} /><MetricProgress label="Portfolio completion" value={portfolio} /></div></div></CardContent></Card><Card className="bg-[#f0f0ff]"><CardHeader><div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#6969a6]">Quality signal</p><CardTitle className="mt-1">Attendance exceptions</CardTitle></div><Icon icon={ChartLineIcon} className="text-[#4b4b9d]" /></CardHeader><CardContent><p className="text-5xl font-semibold tracking-[-0.06em] text-[#32327c]">{noShows}</p><p className="mt-2 text-sm leading-6 text-[#66689a]">No-shows recorded in the PMTS session log.</p><a href="/training-log" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-[#4b4b9d] underline underline-offset-4">Review session log <Icon icon={ArrowUpRight02Icon} size={16} /></a></CardContent></Card></div></>;
}

function MetricProgress({ label, value }: { label: string; value: number }) {
  return <div><div className="mb-2 flex justify-between text-sm"><span>{label}</span><span className="font-semibold text-[#41418e]">{value}%</span></div><Progress value={value}><ProgressLabel className="sr-only">{label}</ProgressLabel><ProgressValue className="sr-only" /></Progress></div>;
}

function Settings({ target, saving, onChange, onSave }: { target: number; saving: boolean; onChange: (value: number) => void; onSave: (value: number) => Promise<void> }) {
  const slots = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '15:30', '16:00'];
  return <><section className="mb-7"><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">System configuration</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Training rules</h2><p className="mt-2 text-sm text-[#686d81]">Set the operational standard that drives candidate progress and session availability.</p></section><div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><Card className="bg-white"><CardHeader><div><CardTitle>Completion target</CardTitle><CardDescription>Required sessions per learner.</CardDescription></div></CardHeader><CardContent><label className="text-sm font-medium">Sessions required<Input type="number" min="1" value={target} onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))} onBlur={() => void onSave(target)} className="mt-2 max-w-44 font-mono text-base" disabled={saving} /></label><p className="mt-4 text-sm leading-6 text-[#73788d]">This value is saved in D1 and updates calculations throughout the application.</p></CardContent></Card><Card className="bg-white"><CardHeader><div><CardTitle>Available time slots</CardTitle><CardDescription>Suggested windows for training sessions.</CardDescription></div></CardHeader><CardContent><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.map((slot) => <div key={slot} className="rounded-lg border border-[#e5e7f0] bg-[#fafbfe] px-3 py-2 font-mono text-xs text-[#5559a8]">{slot}</div>)}</div><div className="mt-6 border-t border-[#e5e7f0] pt-5"><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#85899b]">Session statuses</p><div className="mt-3 flex flex-wrap gap-2">{STATUSES.map((status) => <Badge key={status} className={`${statusStyle(status)} ring-1`}>{status}</Badge>)}</div></div></CardContent></Card></div></>;
}
