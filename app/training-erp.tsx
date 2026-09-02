'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Analytics02Icon,
  Calendar01Icon,
  CalendarPlus01Icon,
  CheckmarkCircle02Icon,
  DashboardSquare01Icon,
  Menu05Icon,
  PlusSignIcon,
  Search02Icon,
  Settings01Icon,
  TaskDaily02Icon,
  UserAdd02Icon,
  UserMultipleIcon,
} from '@hugeicons/core-free-icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Status = 'Completed' | 'Scheduled' | 'No-show' | 'Cancelled';
type Candidate = {
  id: string;
  serialNumber: number | null;
  enrollmentYear: number | null;
  name: string;
  enrolled: string;
  phone: string;
};
type Trainer = { id: string; name: string };
type Session = {
  id: string;
  candidateId: string;
  candidateName: string;
  date: string;
  slot: string;
  status: Status;
  trainerId: string;
  trainer: string;
  notes: string;
};
type ProgressCandidate = Candidate & {
  complete: number;
  remaining: number;
  percentage: number;
};
type ApiPayload = {
  trainingTarget?: unknown;
  candidates?: unknown;
  sessions?: unknown;
  trainers?: unknown;
  error?: unknown;
};
type AccessState = {
  configured: boolean;
  email: string | null;
  role: 'admin' | 'general';
};
type AccessPayload = {
  configured?: unknown;
  email?: unknown;
  error?: unknown;
  role?: unknown;
};

const STATUSES: Status[] = ['Scheduled', 'Completed', 'No-show', 'Cancelled'];
const navItems = [
  { label: 'Candidate dashboard', href: '/', icon: DashboardSquare01Icon },
  { label: 'Candidates', href: '/candidates', icon: UserMultipleIcon },
  { label: 'Training log', href: '/training-log', icon: Calendar01Icon },
  { label: 'Reports', href: '/reports', icon: Analytics02Icon },
  { label: 'Settings', href: '/settings', icon: Settings01Icon },
];

function Icon({
  icon,
  size = 18,
  className,
}: {
  icon: IconSvgElement;
  size?: number;
  className?: string;
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      strokeWidth={1.8}
      className={className}
    />
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function candidateCode(serial: string | number, enrolledAt: string) {
  const serialNumber = Number(serial);
  const year = /^\d{4}-\d{2}-\d{2}$/.test(enrolledAt)
    ? enrolledAt.slice(2, 4)
    : '';
  return Number.isInteger(serialNumber) && serialNumber > 0 && year
    ? String(serialNumber) + '-' + year
    : '—';
}

function statusStyle(status: Status) {
  if (status === 'Completed')
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'Scheduled') return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (status === 'No-show') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-zinc-100 text-zinc-600 ring-zinc-200';
}

function asStatus(value: unknown): Status {
  return value === 'Completed' || value === 'No-show' || value === 'Cancelled'
    ? value
    : 'Scheduled';
}

async function postERP(payload: Record<string, unknown>) {
  const response = await fetch('/api/erp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as {
    error?: unknown;
    id?: unknown;
    serialNumber?: unknown;
    enrollmentYear?: unknown;
  };
  if (!response.ok)
    throw new Error(
      typeof result.error === 'string'
        ? result.error
        : 'Unable to save this change.',
    );
  return result;
}

async function postAdmin(payload: Record<string, unknown>) {
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as {
    error?: unknown;
  };
  if (!response.ok) {
    throw new Error(
      typeof result.error === 'string'
        ? result.error
        : 'Unable to save this administrator change.',
    );
  }
  return result;
}

export function TrainingERP() {
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const page = navItems.find((item) => item.href === pathname) ?? navItems[0];
  const [access, setAccess] = useState<AccessState>({
    configured: false,
    email: null,
    role: 'general',
  });
  const [target, setTarget] = useState(15);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [candidateSerial, setCandidateSerial] = useState('');
  const [enrollmentDate, setEnrollmentDate] = useState(today());
  const isAdmin = access.role === 'admin';
  const visibleNavItems = isAdmin
    ? navItems
    : navItems.filter((item) => item.href !== '/settings');

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const accessResponse = await fetch('/api/access', { cache: 'no-store' });
        const accessPayload = (await accessResponse.json().catch(() => ({}))) as AccessPayload;
        if (!accessResponse.ok) {
          throw new Error(
            typeof accessPayload.error === 'string'
              ? accessPayload.error
              : 'Unable to confirm your ERP access.',
          );
        }
        if (!mounted) return;
        setAccess({
          configured: accessPayload.configured === true,
          email: typeof accessPayload.email === 'string' ? accessPayload.email : null,
          role: accessPayload.role === 'admin' ? 'admin' : 'general',
        });

        const response = await fetch('/api/erp', { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as ApiPayload;
        if (!response.ok)
          throw new Error(
            typeof payload.error === 'string'
              ? payload.error
              : 'Unable to load PMTS data.',
          );
        if (!mounted) return;
        if (typeof payload.trainingTarget === 'number')
          setTarget(payload.trainingTarget);
        setCandidates(
          Array.isArray(payload.candidates)
            ? payload.candidates.map((item) => {
                const row = item as {
                  id?: unknown;
                  serialNumber?: unknown;
                  enrollmentYear?: unknown;
                  name?: unknown;
                  phone?: unknown;
                  enrolledAt?: unknown;
                };
                return {
                  id: String(row.id ?? ''),
                  serialNumber:
                    typeof row.serialNumber === 'number'
                      ? row.serialNumber
                      : null,
                  enrollmentYear:
                    typeof row.enrollmentYear === 'number'
                      ? row.enrollmentYear
                      : null,
                  name: String(row.name ?? ''),
                  phone: String(row.phone ?? '—'),
                  enrolled: String(row.enrolledAt ?? '—'),
                };
              })
            : [],
        );
        setSessions(
          Array.isArray(payload.sessions)
            ? payload.sessions.map((item) => {
                const row = item as {
                  id?: unknown;
                  candidateId?: unknown;
                  candidateName?: unknown;
                  sessionDate?: unknown;
                  timeSlot?: unknown;
                  status?: unknown;
                  trainerId?: unknown;
                  trainerName?: unknown;
                  notes?: unknown;
                };
                return {
                  id: String(row.id ?? ''),
                  candidateId: String(row.candidateId ?? ''),
                  candidateName: String(row.candidateName ?? ''),
                  date: String(row.sessionDate ?? ''),
                  slot: String(row.timeSlot ?? ''),
                  status: asStatus(row.status),
                  trainerId: String(row.trainerId ?? ''),
                  trainer: String(row.trainerName ?? '—'),
                  notes: String(row.notes ?? ''),
                };
              })
            : [],
        );
        setTrainers(
          Array.isArray(payload.trainers)
            ? payload.trainers
                .map((item) => {
                  const row = item as { id?: unknown; name?: unknown };
                  return {
                    id: String(row.id ?? ''),
                    name: String(row.name ?? ''),
                  };
                })
                .filter((trainer) => trainer.id && trainer.name)
            : [],
        );
      } catch (error) {
        if (mounted)
          setMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load PMTS data.',
          );
      } finally {
        if (mounted) setLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const rows: ProgressCandidate[] = useMemo(() => {
    const completedByCandidate = sessions.reduce<Record<string, number>>(
      (counts, session) => {
        if (session.status === 'Completed')
          counts[session.candidateId] = (counts[session.candidateId] ?? 0) + 1;
        return counts;
      },
      {},
    );
    return candidates.map((candidate) => {
      const complete = completedByCandidate[candidate.id] ?? 0;
      return {
        ...candidate,
        complete,
        remaining: Math.max(target - complete, 0),
        percentage: Math.round((complete / target) * 100),
      };
    });
  }, [candidates, sessions, target]);
  const completed = sessions.filter(
    (session) => session.status === 'Completed',
  ).length;
  const noShows = sessions.filter(
    (session) => session.status === 'No-show',
  ).length;
  const attendance =
    completed + noShows
      ? Math.round((completed / (completed + noShows)) * 100)
      : 0;
  const selected =
    rows.find((candidate) => candidate.id === searchParams.get('candidate')) ??
    rows[0];

  async function createCandidate(input: {
    name: string;
    phone: string;
    serialNumber: string;
    enrolledAt: string;
  }) {
    const result = await postERP({ action: 'candidate', ...input });
    const id = String(result.id ?? '');
    if (!id) throw new Error('The learner record was not created.');
    setCandidates((current) => [
      ...current,
      {
        id,
        serialNumber:
          typeof result.serialNumber === 'number'
            ? result.serialNumber
            : Number(input.serialNumber),
        enrollmentYear:
          typeof result.enrollmentYear === 'number'
            ? result.enrollmentYear
            : Number(input.enrolledAt.slice(2, 4)),
        name: input.name,
        phone: input.phone || '—',
        enrolled: input.enrolledAt,
      },
    ]);
  }

  async function createSession(input: {
    candidateId: string;
    date: string;
    slot: string;
    trainerId: string;
    status: Status;
    notes: string;
  }) {
    const result = await postERP({
      action: 'session',
      candidateId: input.candidateId,
      sessionDate: input.date,
      timeSlot: input.slot,
      trainerId: input.trainerId,
      status: input.status,
      notes: input.notes,
    });
    const id = String(result.id ?? '');
    if (!id) throw new Error('The session was not created.');
    const learner = candidates.find(
      (candidate) => candidate.id === input.candidateId,
    );
    const trainer = trainers.find((item) => item.id === input.trainerId);
    const session: Session = {
      id,
      candidateId: input.candidateId,
      candidateName: learner?.name ?? input.candidateId,
      date: input.date,
      slot: input.slot,
      status: input.status,
      trainerId: input.trainerId,
      trainer: trainer?.name ?? '—',
      notes: input.notes,
    };
    setSessions((current) =>
      [...current, session].sort((a, b) =>
        (a.date + ' ' + a.slot).localeCompare(b.date + ' ' + b.slot),
      ),
    );
  }

  async function submitCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const phone = String(form.get('phone') ?? '').trim();
    if (!name || !candidateSerial || !enrollmentDate) return;
    setSaving(true);
    setMessage(null);
    try {
      await createCandidate({
        name,
        phone,
        serialNumber: candidateSerial,
        enrolledAt: enrollmentDate,
      });
      setAddOpen(false);
      setCandidateSerial('');
      window.location.assign('/candidates');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to create the learner.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function completeNext() {
    const next = sessions.find((session) => session.status === 'Scheduled');
    if (!next) {
      setMessage('There are no scheduled sessions to complete.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await postERP({
        action: 'session-status',
        id: next.id,
        status: 'Completed',
      });
      setSessions((current) =>
        current.map((session) =>
          session.id === next.id
            ? { ...session, status: 'Completed' }
            : session,
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update the session.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveTarget(value: number) {
    setSaving(true);
    setMessage(null);
    try {
      await postAdmin({ action: 'settings', trainingTarget: value });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save the training target.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-[#151724]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[246px] flex-col border-r border-[#e5e7f0] bg-white px-4 py-5 lg:flex">
        <a href="/" className="flex items-center gap-3 px-2">
          <div className="grid size-9 place-items-center rounded-xl bg-[#25255e] text-white shadow-sm">
            <Icon icon={TaskDaily02Icon} size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[-0.02em]">PMTS</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#777b91]">
              Operations
            </p>
          </div>
        </a>
        <nav className="mt-10 space-y-1" aria-label="Primary navigation">
          {visibleNavItems.map((item) => {
            const active = page.href === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ' +
                  (active
                    ? 'bg-[#ececff] font-medium text-[#363681]'
                    : 'text-[#686c80] hover:bg-[#f4f5f9] hover:text-[#25255e]')
                }
              >
                <Icon icon={item.icon} size={18} />
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl bg-[#25255e] p-4 text-white">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#bdbdeb]">
            Monthly target
          </p>
          <p className="mt-3 text-2xl font-semibold">{target} sessions</p>
          <p className="mt-1 text-xs leading-5 text-[#c9c9ef]">
            Every learner progresses against the same completion target.
          </p>
          {isAdmin && (
            <a
              href="/settings"
              className="mt-4 inline-block text-xs font-medium text-white underline decoration-[#7878bf] underline-offset-4"
            >
              Manage settings
            </a>
          )}
        </div>
      </aside>

      <main className="lg:pl-[246px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#e5e7f0]/90 bg-[#f7f8fc]/90 px-5 backdrop-blur-lg sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Toggle navigation"
            >
              <Icon icon={Menu05Icon} />
            </Button>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#777b91]">
                Training ERP
              </p>
              <h1 className="text-lg font-semibold tracking-[-0.03em]">
                {page.label}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Badge
              variant="outline"
              className={
                'hidden h-7 border-[#dfe2ec] px-2.5 text-[10px] uppercase tracking-[0.12em] sm:inline-flex ' +
                (isAdmin
                  ? 'bg-[#ececff] text-[#363681]'
                  : 'bg-white text-[#686c80]')
              }
              title={access.email ?? undefined}
            >
              {isAdmin ? 'Admin access' : 'General access'}
            </Badge>
            <a
              href="/training-log"
              className="hidden h-7 items-center gap-1 rounded-lg border border-[#e5e7f0] bg-white px-2.5 text-[0.8rem] font-medium hover:bg-[#f3f4f8] sm:inline-flex"
            >
              <Icon icon={CalendarPlus01Icon} /> Log session
            </a>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Icon icon={PlusSignIcon} /> Add learner
            </Button>
          </div>
        </header>

        {menuOpen && (
          <nav
            className="border-b border-[#e5e7f0] bg-white px-4 py-3 lg:hidden"
            aria-label="Mobile navigation"
          >
            <div className="grid grid-cols-2 gap-1">
              {visibleNavItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm ' +
                    (page.href === item.href
                      ? 'bg-[#ececff] text-[#363681]'
                      : 'text-[#686c80]')
                  }
                >
                  <Icon icon={item.icon} size={16} />
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        )}

        <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">
          {message && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-[#eed5d8] bg-[#fff7f7] px-4 py-3 text-sm text-[#9b3039]"
            >
              {message}
            </div>
          )}
          {!loaded && (
            <Card className="bg-white">
              <CardContent className="py-14 text-center">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#777b91]">
                  Loading PMTS records
                </p>
              </CardContent>
            </Card>
          )}
          {loaded && page.href === '/' && (
            <Dashboard
              candidate={selected}
              candidates={rows}
              sessions={sessions}
              target={target}
              onAdd={() => setAddOpen(true)}
            />
          )}
          {loaded && page.href === '/candidates' && (
            <Candidates
              candidates={rows}
              target={target}
              search={search}
              onSearch={setSearch}
              onAdd={() => setAddOpen(true)}
            />
          )}
          {loaded && page.href === '/training-log' && (
            <TrainingLog
              candidates={rows}
              sessions={sessions}
              trainers={trainers}
              saving={saving}
              onCreate={createSession}
              onComplete={completeNext}
            />
          )}
          {loaded && page.href === '/reports' && (
            <Reports
              candidates={rows}
              completed={completed}
              noShows={noShows}
              attendance={attendance}
              target={target}
            />
          )}
          {loaded && page.href === '/settings' &&
            (isAdmin ? (
              <Settings
                target={target}
                trainers={trainers}
                saving={saving}
                onChange={setTarget}
                onSave={saveTarget}
              />
            ) : (
              <SettingsRestricted configured={access.configured} />
            ))}
        </div>
      </main>

      {addOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#151724]/30 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-white shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Add a learner</CardTitle>
              <CardDescription>
                Create a candidate record in the PMTS database.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submitCandidate}>
                <label className="block text-sm font-medium">
                  Learner name
                  <Input
                    required
                    name="name"
                    placeholder="e.g. Priya Banerjee"
                    className="mt-1.5"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Phone number
                  <Input
                    name="phone"
                    placeholder="e.g. 9876543210"
                    className="mt-1.5"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    Candidate serial number
                    <Input
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={candidateSerial}
                      onChange={(event) =>
                        setCandidateSerial(event.target.value)
                      }
                      placeholder="e.g. 82"
                      className="mt-1.5 font-mono"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Enrollment date
                    <Input
                      required
                      type="date"
                      value={enrollmentDate}
                      onChange={(event) =>
                        setEnrollmentDate(event.target.value)
                      }
                      className="mt-1.5"
                    />
                  </label>
                </div>
                <div className="rounded-xl border border-[#dfe2ec] bg-[#fafbfe] px-3 py-2.5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#85899b]">
                    Candidate ID preview
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-[#41418e]">
                    {candidateCode(candidateSerial, enrollmentDate)}
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    <Icon icon={UserAdd02Icon} />{' '}
                    {saving ? 'Saving…' : 'Create learner'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function CandidatePicker({
  candidate,
  candidates,
}: {
  candidate: ProgressCandidate;
  candidates: ProgressCandidate[];
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = candidates.filter((item) =>
    (item.name + ' ' + item.id).toLocaleLowerCase().includes(normalizedQuery),
  );
  const selectedIsVisible = matches.some((item) => item.id === candidate.id);

  return (
    <div className="w-full xl:w-[310px]">
      <label htmlFor="candidate-search" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.15em] text-[#777b91]">
        Selected candidate
      </label>
      <div className="relative">
        <Icon
          icon={Search02Icon}
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#85899b]"
        />
        <Input
          id="candidate-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or serial no."
          className="h-10 border-[#dfe2ec] bg-white pl-9 text-sm"
        />
      </div>
      <select
        value={candidate.id}
        onChange={(event) =>
          window.location.assign(
            '/?candidate=' + encodeURIComponent(event.target.value),
          )
        }
        aria-label="Choose a candidate"
        className="mt-2 h-10 w-full rounded-lg border border-[#dfe2ec] bg-white px-3 text-sm outline-none focus:border-[#7575cf] focus:ring-2 focus:ring-[#7575cf]/20"
      >
        {!selectedIsVisible && (
          <option value={candidate.id}>
            {candidate.name} · {candidate.id}
          </option>
        )}
        {matches.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} · {item.id}
          </option>
        ))}
      </select>
      {normalizedQuery && matches.length === 0 && (
        <p className="mt-1.5 text-xs text-[#85899b]">
          No candidate matches that name or serial number.
        </p>
      )}
    </div>
  );
}

function Dashboard({
  candidate,
  candidates,
  sessions,
  target,
  onAdd,
}: {
  candidate?: ProgressCandidate;
  candidates: ProgressCandidate[];
  sessions: Session[];
  target: number;
  onAdd: () => void;
}) {
  if (!candidate)
    return (
      <Card className="border border-dashed border-[#cfd2e4] bg-white">
        <CardContent className="flex min-h-80 flex-col items-center justify-center text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-[#ececff] text-[#3f3f91]">
            <Icon icon={UserAdd02Icon} size={22} />
          </div>
          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#777b91]">
            Database ready
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
            Add your first learner
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#686d81]">
            New learners and training sessions will be saved to your Cloudflare
            D1 database.
          </p>
          <Button className="mt-6" onClick={onAdd}>
            <Icon icon={UserAdd02Icon} /> Add learner
          </Button>
        </CardContent>
      </Card>
    );

  const history = sessions.filter(
    (session) => session.candidateId === candidate.id,
  );
  const nextSession = history.find((session) => session.status === 'Scheduled');
  const misses = history.filter(
    (session) => session.status === 'No-show',
  ).length;
  const attendance =
    candidate.complete + misses
      ? Math.round((candidate.complete / (candidate.complete + misses)) * 100)
      : 0;
  return (
    <>
      <section className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">
            Learner workspace
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#1d1f31] sm:text-4xl">
            {candidate.name}&apos;s dashboard
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#656a80]">
            Individual training progress, attendance, and session activity in
            one focused view.
          </p>
        </div>
        <CandidatePicker candidate={candidate} candidates={candidates} />
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Sessions complete"
          value={String(candidate.complete) + '/' + String(target)}
          detail={
            candidate.remaining
              ? String(candidate.remaining) + ' sessions remaining'
              : 'Training target reached'
          }
        />
        <Metric
          label="Completion pace"
          value={String(candidate.percentage) + '%'}
          detail="Against programme target"
        />
        <Metric
          label="Attendance"
          value={String(attendance) + '%'}
          detail="From recorded outcomes"
        />
        <Metric
          label="Next session"
          value={nextSession?.slot ?? '—'}
          detail={
            nextSession
              ? nextSession.date + ' · ' + nextSession.trainer
              : 'No future slot booked'
          }
        />
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(320px,.78fr)]">
        <Card className="bg-white">
          <CardHeader>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8a8ea0]">
                Progress plan
              </p>
              <CardTitle className="mt-1 text-lg">Completion journey</CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              {candidate.id}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl bg-[#f7f8fc] p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-4xl font-semibold tracking-[-0.06em] text-[#25255e]">
                    {candidate.percentage}%
                  </p>
                  <p className="mt-1 text-sm text-[#6d7288]">
                    {candidate.complete} completed of {target} required sessions
                  </p>
                </div>
                <span className="rounded-xl bg-white px-3 py-2 font-mono text-xs text-[#5559a8]">
                  {candidate.remaining} left
                </span>
              </div>
              <Progress value={candidate.percentage} className="mt-6">
                <ProgressLabel className="sr-only">
                  {candidate.name} completion
                </ProgressLabel>
                <ProgressValue className="sr-only" />
              </Progress>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <InfoBox label="Candidate ID" value={candidate.id} mono />
              <InfoBox label="Enrollment date" value={candidate.enrolled} />
              <InfoBox label="Contact" value={candidate.phone} mono />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#25255e] text-white">
          <CardHeader>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#bdbdea]">
                Next action
              </p>
              <CardTitle className="mt-1 text-lg text-white">
                Session readiness
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {nextSession ? (
              <>
                <p className="text-3xl font-semibold tracking-[-0.05em]">
                  {nextSession.slot}
                </p>
                <p className="mt-2 text-sm text-[#dbdbfb]">
                  {nextSession.date} with {nextSession.trainer}
                </p>
                <Badge className="mt-5 bg-white/10 text-white ring-1 ring-white/20">
                  Scheduled
                </Badge>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold">No session booked</p>
                <p className="mt-2 text-sm leading-6 text-[#dbdbfb]">
                  Schedule the next training slot to keep momentum moving.
                </p>
                <a
                  href="/training-log"
                  className="mt-6 inline-flex text-sm font-medium text-white underline underline-offset-4"
                >
                  Open training log
                </a>
              </>
            )}
          </CardContent>
        </Card>
      </section>
      <section className="mt-6">
        <Card className="bg-white">
          <CardHeader>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8a8ea0]">
                Candidate history
              </p>
              <CardTitle className="mt-1 text-lg">Training sessions</CardTitle>
            </div>
            <a
              href="/training-log"
              className="text-sm font-medium text-[#4b4b9d] hover:text-[#25255e]"
            >
              Open full log
            </a>
          </CardHeader>
          <CardContent>
            {history.length ? (
              <div className="space-y-2">
                {history.map((session) => (
                  <div
                    key={session.id}
                    className="grid grid-cols-[70px_1fr_auto] items-center gap-3 rounded-xl border border-[#e5e7f0] px-4 py-3"
                  >
                    <span className="font-mono text-xs text-[#5559a8]">
                      {session.slot}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{session.date}</p>
                      <p className="mt-0.5 text-xs text-[#85899b]">
                        Trainer · {session.trainer}
                      </p>
                    </div>
                    <Badge className={statusStyle(session.status) + ' ring-1'}>
                      {session.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-7 text-sm text-[#73788d]">
                No sessions have been logged for this learner yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="bg-white">
      <CardContent>
        <p className="text-sm text-[#6d7288]">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
          {value}
        </p>
        <p className="mt-2 text-xs text-[#82869a]">{detail}</p>
      </CardContent>
    </Card>
  );
}

function InfoBox({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#e5e7f0] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#85899b]">
        {label}
      </p>
      <p className={'mt-2 text-sm font-medium ' + (mono ? 'font-mono' : '')}>
        {value}
      </p>
    </div>
  );
}

function Candidates({
  candidates,
  target,
  search,
  onSearch,
  onAdd,
}: {
  candidates: ProgressCandidate[];
  target: number;
  search: string;
  onSearch: (value: string) => void;
  onAdd: () => void;
}) {
  const filtered = candidates.filter((candidate) =>
    (candidate.name + ' ' + candidate.id + ' ' + candidate.phone)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <section className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">
            Master data
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
            Candidate register
          </h2>
          <p className="mt-2 text-sm text-[#686d81]">
            Each learner has a serial-year ID and an automatically calculated
            completion pace.
          </p>
        </div>
        <Button onClick={onAdd}>
          <Icon icon={UserAdd02Icon} /> Add learner
        </Button>
      </section>
      <Card className="bg-white">
        <CardHeader>
          <div className="relative w-full max-w-sm">
            <Icon
              icon={Search02Icon}
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#85899b]"
            />
            <Input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              className="pl-9"
                  placeholder="Search name or serial no."
            />
          </div>
          <Badge variant="outline">{filtered.length} records</Badge>
        </CardHeader>
        <CardContent>
          {filtered.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Candidate ID</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Enrollment
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Contact
                  </TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((candidate) => (
                  <TableRow key={candidate.id}>
                    <TableCell>
                      <a
                        href={'/?candidate=' + encodeURIComponent(candidate.id)}
                        className="block hover:text-[#4b4b9d]"
                      >
                        <p className="font-medium">{candidate.name}</p>
                        <p className="font-mono text-[10px] text-[#85899b]">
                          Record
                        </p>
                      </a>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[#5559a8]">
                      {candidate.id}
                    </TableCell>
                    <TableCell className="hidden text-[#73788d] md:table-cell">
                      {candidate.enrolled}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-[#73788d] lg:table-cell">
                      {candidate.phone}
                    </TableCell>
                    <TableCell className="min-w-[150px]">
                      <div className="flex items-center gap-3">
                        <Progress
                          value={candidate.percentage}
                          className="flex-1"
                        >
                          <ProgressLabel className="sr-only">
                            {candidate.name} completion
                          </ProgressLabel>
                          <ProgressValue className="sr-only" />
                        </Progress>
                        <span className="font-mono text-[11px] text-[#5559a8]">
                          {candidate.complete}/{target}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-[#5559a8]">
                      {candidate.remaining}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-10 text-center text-sm text-[#73788d]">
              No learners yet. Add the first learner to create a D1 record.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function TrainingLog({
  candidates,
  sessions,
  trainers,
  saving,
  onCreate,
  onComplete,
}: {
  candidates: ProgressCandidate[];
  sessions: Session[];
  trainers: Trainer[];
  saving: boolean;
  onCreate: (input: {
    candidateId: string;
    date: string;
    slot: string;
    trainerId: string;
    status: Status;
    notes: string;
  }) => Promise<void>;
  onComplete: () => Promise<void>;
}) {
  const [candidateId, setCandidateId] = useState('');
  const [date, setDate] = useState(today());
  const [slot, setSlot] = useState('09:00');
  const [trainerId, setTrainerId] = useState('');
  const [status, setStatus] = useState<Status>('Scheduled');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!candidateId) {
      setError('Choose a learner before saving the session.');
      return;
    }
    if (!trainerId) {
      setError('Choose a trainer before saving the session.');
      return;
    }
    setError(null);
    try {
      await onCreate({ candidateId, date, slot, trainerId, status, notes });
      setNotes('');
      setStatus('Scheduled');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to save the session.',
      );
    }
  }
  return (
    <>
      <section className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">
            Operational log
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
            Training sessions
          </h2>
          <p className="mt-2 text-sm text-[#686d81]">
            Every entry is stored as a session record in D1 and tied to a
            trainer.
          </p>
        </div>
        <Button
          onClick={() => void onComplete()}
          disabled={
            saving ||
            !sessions.some((session) => session.status === 'Scheduled')
          }
        >
          <Icon icon={CheckmarkCircle02Icon} /> Complete next session
        </Button>
      </section>
      {!candidates.length ? (
        <Card className="bg-white">
          <CardContent className="py-10 text-center text-sm text-[#73788d]">
            Add a learner before logging a training session.
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6 bg-white">
          <CardHeader>
            <div>
              <CardTitle>Log a session</CardTitle>
              <CardDescription>
                Create a permanent attendance and progress record.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
              onSubmit={submit}
            >
              <label className="text-sm font-medium">
                Learner
                <select
                  required
                  value={candidateId}
                  onChange={(event) => setCandidateId(event.target.value)}
                  className="mt-1.5 h-9 w-full rounded-lg border border-[#dfe2ec] bg-white px-2.5 text-sm outline-none focus:border-[#7575cf] focus:ring-2 focus:ring-[#7575cf]/20"
                >
                  <option value="">Select learner</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} · {candidate.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Date
                <Input
                  type="date"
                  required
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="mt-1.5"
                />
              </label>
              <label className="text-sm font-medium">
                Time
                <Input
                  type="time"
                  required
                  value={slot}
                  onChange={(event) => setSlot(event.target.value)}
                  className="mt-1.5"
                />
              </label>
              <label className="text-sm font-medium">
                Trainer
                <select
                  required
                  value={trainerId}
                  onChange={(event) => setTrainerId(event.target.value)}
                  className="mt-1.5 h-9 w-full rounded-lg border border-[#dfe2ec] bg-white px-2.5 text-sm outline-none focus:border-[#7575cf] focus:ring-2 focus:ring-[#7575cf]/20"
                  disabled={!trainers.length}
                >
                  <option value="">
                    {trainers.length ? 'Select trainer' : 'Loading trainers…'}
                  </option>
                  {trainers.map((trainer) => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Outcome
                <select
                  value={status}
                  onChange={(event) => setStatus(asStatus(event.target.value))}
                  className="mt-1.5 h-9 w-full rounded-lg border border-[#dfe2ec] bg-white px-2.5 text-sm outline-none focus:border-[#7575cf] focus:ring-2 focus:ring-[#7575cf]/20"
                >
                  {STATUSES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Notes
                <Input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional"
                  className="mt-1.5"
                />
              </label>
              {error && (
                <p className="text-sm text-[#9b3039] md:col-span-2 xl:col-span-3">
                  {error}
                </p>
              )}
              <div className="md:col-span-2 xl:col-span-3">
                <Button type="submit" disabled={saving || !trainers.length}>
                  <Icon icon={CalendarPlus01Icon} />{' '}
                  {saving ? 'Saving…' : 'Save session'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <Card className="bg-white">
        <CardHeader>
          <div>
            <CardTitle>Session register</CardTitle>
            <CardDescription>
              Current records from the PMTS database.
            </CardDescription>
          </div>
          <Badge variant="outline">Live</Badge>
        </CardHeader>
        <CardContent>
          {sessions.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Learner</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Trainer
                  </TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="text-sm text-[#73788d]">
                      {session.date}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[#5559a8]">
                      {session.slot}
                    </TableCell>
                    <TableCell>
                      <a
                        href={
                          '/?candidate=' +
                          encodeURIComponent(session.candidateId)
                        }
                        className="block hover:text-[#4b4b9d]"
                      >
                        <p className="font-medium">{session.candidateName}</p>
                        <p className="font-mono text-[10px] text-[#85899b]">
                          {session.candidateId}
                        </p>
                      </a>
                    </TableCell>
                    <TableCell className="hidden text-[#73788d] md:table-cell">
                      {session.trainer}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={statusStyle(session.status) + ' ring-1'}
                      >
                        {session.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-10 text-center text-sm text-[#73788d]">
              No sessions have been logged yet.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Reports({
  candidates,
  completed,
  noShows,
  attendance,
  target,
}: {
  candidates: ProgressCandidate[];
  completed: number;
  noShows: number;
  attendance: number;
  target: number;
}) {
  const totalTarget = candidates.length * target;
  const portfolio = totalTarget
    ? Math.round((completed / totalTarget) * 100)
    : 0;
  return (
    <>
      <section className="mb-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">
          Operations intelligence
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
          Training performance
        </h2>
        <p className="mt-2 text-sm text-[#686d81]">
          A simple performance lens for the team—not another spreadsheet to
          maintain.
        </p>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          label="Completed sessions"
          value={String(completed)}
          detail={'of ' + String(totalTarget) + ' required'}
        />
        <Metric
          label="Attendance rate"
          value={String(attendance) + '%'}
          detail="From recorded outcomes"
        />
        <Metric
          label="No-show records"
          value={String(noShows)}
          detail={'Portfolio completion: ' + String(portfolio) + '%'}
        />
      </div>
    </>
  );
}

function SettingsRestricted({ configured }: { configured: boolean }) {
  return (
    <Card className="border border-dashed border-[#cfd2e4] bg-white">
      <CardContent className="flex min-h-80 flex-col items-center justify-center text-center">
        <div className="grid size-12 place-items-center rounded-2xl bg-[#ececff] text-[#3f3f91]">
          <Icon icon={Settings01Icon} size={22} />
        </div>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#777b91]">
          Administrator only
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
          Settings are protected
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#686d81]">
          General users can work with candidate and training records, but only an administrator can view or change operational settings.
        </p>
        {!configured && (
          <p className="mt-3 max-w-md text-xs leading-5 text-[#9b3039]">
            Secure access is still being configured for this ERP.
          </p>
        )}
        <a
          href="/"
          className="mt-6 text-sm font-medium text-[#4b4b9d] underline underline-offset-4"
        >
          Return to dashboard
        </a>
      </CardContent>
    </Card>
  );
}

function Settings({
  target,
  trainers,
  saving,
  onChange,
  onSave,
}: {
  target: number;
  trainers: Trainer[];
  saving: boolean;
  onChange: (value: number) => void;
  onSave: (value: number) => Promise<void>;
}) {
  const slots = [
    '07:00',
    '07:30',
    '08:00',
    '08:30',
    '09:00',
    '09:30',
    '10:00',
    '10:30',
    '11:00',
    '11:30',
    '15:30',
    '16:00',
  ];
  return (
    <>
      <section className="mb-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">
          System configuration
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
          Training rules
        </h2>
        <p className="mt-2 text-sm text-[#686d81]">
          Set the operational standard that drives candidate progress and
          session availability.
        </p>
      </section>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="bg-white">
          <CardHeader>
            <div>
              <CardTitle>Completion target</CardTitle>
              <CardDescription>Required sessions per learner.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <label className="text-sm font-medium">
              Sessions required
              <Input
                type="number"
                min="1"
                value={target}
                onChange={(event) =>
                  onChange(Math.max(1, Number(event.target.value) || 1))
                }
                onBlur={() => void onSave(target)}
                className="mt-2 max-w-44 font-mono text-base"
                disabled={saving}
              />
            </label>
            <p className="mt-4 text-sm leading-6 text-[#73788d]">
              This value is saved in D1 and updates calculations throughout the
              application.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardHeader>
            <div>
              <CardTitle>Trainer directory</CardTitle>
              <CardDescription>
                Active records populate the session form.
              </CardDescription>
            </div>
            <Badge variant="outline">{trainers.length} active</Badge>
          </CardHeader>
          <CardContent>
            {trainers.length ? (
              <div className="space-y-2">
                {trainers.map((trainer) => (
                  <div
                    key={trainer.id}
                    className="flex items-center justify-between rounded-xl border border-[#e5e7f0] bg-[#fafbfe] px-3 py-2.5"
                  >
                    <span className="text-sm font-medium">{trainer.name}</span>
                    <span className="font-mono text-[10px] text-[#85899b]">
                      Trainer
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#73788d]">Loading trainer records…</p>
            )}
            <p className="mt-4 text-xs leading-5 text-[#73788d]">
              Administrator-only changes to the trainer table will be added with
              protected access later.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardHeader>
            <div>
              <CardTitle>Available time slots</CardTitle>
              <CardDescription>
                Suggested windows for training sessions.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <div
                  key={slot}
                  className="rounded-lg border border-[#e5e7f0] bg-[#fafbfe] px-3 py-2 font-mono text-xs text-[#5559a8]"
                >
                  {slot}
                </div>
              ))}
            </div>
            <div className="mt-6 border-t border-[#e5e7f0] pt-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#85899b]">
                Session statuses
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUSES.map((status) => (
                  <Badge
                    key={status}
                    className={statusStyle(status) + ' ring-1'}
                  >
                    {status}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
