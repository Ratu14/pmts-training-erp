'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Analytics02Icon,
  Calendar01Icon,
  CalendarPlus01Icon,
  CheckmarkCircle02Icon,
  DashboardSquare01Icon,
  Database01Icon,
  Menu05Icon,
  PlusSignIcon,
  Search02Icon,
  Settings01Icon,
  TaskDaily02Icon,
  UserAdd02Icon,
  UserMultipleIcon,
} from '@hugeicons/core-free-icons';
import { XIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
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
type Trainer = { id: string; name: string; isActive?: boolean };
type AdminCandidateRecord = {
  id: string;
  serialNumber: number | null;
  enrollmentYear: number | null;
  name: string;
  phone: string;
  enrolledAt: string;
  isActive: boolean;
};
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
  timeSlots?: unknown;
  candidates?: unknown;
  sessions?: unknown;
  trainers?: unknown;
  error?: unknown;
};
type AdminSessionPayload = {
  authenticated?: unknown;
  configured?: unknown;
  error?: unknown;
};
type AdminDataPayload = {
  trainingTarget?: unknown;
  timeSlots?: unknown;
  trainers?: unknown;
  candidates?: unknown;
  error?: unknown;
};

const STATUSES: Status[] = ['Scheduled', 'Completed', 'No-show', 'Cancelled'];
const navItems = [
  { label: 'Candidate dashboard', href: '/', icon: DashboardSquare01Icon },
  { label: 'Candidates', href: '/candidates', icon: UserMultipleIcon },
  { label: 'Training log', href: '/training-log', icon: Calendar01Icon },
  { label: 'Reports', href: '/reports', icon: Analytics02Icon },
  { label: 'Settings', href: '/settings', icon: Settings01Icon },
  { label: 'Admin records', href: '/admin', icon: Database01Icon },
];
const ADMIN_ONLY_HREFS = new Set(['/settings', '/admin']);

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
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminConfigured, setAdminConfigured] = useState(false);
  const [target, setTarget] = useState(15);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSaving, setAdminSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [candidateSerial, setCandidateSerial] = useState('');
  const [enrollmentDate, setEnrollmentDate] = useState(today());
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [adminTrainers, setAdminTrainers] = useState<Trainer[]>([]);
  const [adminCandidates, setAdminCandidates] = useState<AdminCandidateRecord[]>([]);
  const [adminBusy, setAdminBusy] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<AdminCandidateRecord | null>(null);
  const [deletingCandidate, setDeletingCandidate] = useState<AdminCandidateRecord | null>(null);
  const isAdmin = adminAuthenticated;
  const visibleNavItems = isAdmin
    ? navItems
    : navItems.filter((item) => !ADMIN_ONLY_HREFS.has(item.href));

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [sessionResponse, response] = await Promise.all([
          fetch('/api/admin/session', { cache: 'no-store' }),
          fetch('/api/erp', { cache: 'no-store' }),
        ]);
        const sessionPayload = (await sessionResponse
          .json()
          .catch(() => ({}))) as AdminSessionPayload;
        if (mounted && sessionResponse.ok) {
          setAdminAuthenticated(sessionPayload.authenticated === true);
          setAdminConfigured(sessionPayload.configured === true);
        }
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
        if (Array.isArray(payload.timeSlots)) {
          setTimeSlots(
            payload.timeSlots.filter(
              (slot): slot is string => typeof slot === 'string',
            ),
          );
        }
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

  async function loadAdminRecords() {
    try {
      const response = await fetch('/api/admin', { cache: 'no-store' });
      const payload = (await response
        .json()
        .catch(() => ({}))) as AdminDataPayload;
      if (!response.ok)
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : 'Unable to load administrator records.',
        );

      const nextTimeSlots = Array.isArray(payload.timeSlots)
        ? payload.timeSlots.filter(
            (slot): slot is string => typeof slot === 'string',
          )
        : [];
      const nextTrainers: Trainer[] = Array.isArray(payload.trainers)
        ? payload.trainers.map((item) => {
            const row = item as {
              id?: unknown;
              name?: unknown;
              isActive?: unknown;
            };
            return {
              id: String(row.id ?? ''),
              name: String(row.name ?? ''),
              isActive: Boolean(row.isActive),
            };
          })
        : [];
      const nextCandidates: AdminCandidateRecord[] = Array.isArray(
        payload.candidates,
      )
        ? payload.candidates.map((item) => {
            const row = item as {
              id?: unknown;
              serialNumber?: unknown;
              enrollmentYear?: unknown;
              name?: unknown;
              phone?: unknown;
              enrolledAt?: unknown;
              isActive?: unknown;
            };
            return {
              id: String(row.id ?? ''),
              serialNumber:
                typeof row.serialNumber === 'number' ? row.serialNumber : null,
              enrollmentYear:
                typeof row.enrollmentYear === 'number'
                  ? row.enrollmentYear
                  : null,
              name: String(row.name ?? ''),
              phone: typeof row.phone === 'string' ? row.phone : '',
              enrolledAt: String(row.enrolledAt ?? ''),
              isActive: Boolean(row.isActive),
            };
          })
        : [];

      setTimeSlots(nextTimeSlots);
      setAdminTrainers(nextTrainers);
      setAdminCandidates(nextCandidates);
      setTrainers(
        nextTrainers
          .filter((trainer) => trainer.isActive)
          .map(({ id, name }) => ({ id, name })),
      );
      setCandidates(
        nextCandidates
          .filter((candidate) => candidate.isActive)
          .map((candidate) => ({
            id: candidate.id,
            serialNumber: candidate.serialNumber,
            enrollmentYear: candidate.enrollmentYear,
            name: candidate.name,
            phone: candidate.phone || '—',
            enrolled: candidate.enrolledAt,
          })),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load administrator records.',
      );
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    if (pathname !== '/settings' && pathname !== '/admin') return;
    void loadAdminRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, pathname]);

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

  async function updateSessionStatus(id: string, status: Status) {
    setSaving(true);
    setMessage(null);
    try {
      await postERP({ action: 'session-status', id, status });
      setSessions((current) =>
        current.map((session) =>
          session.id === id ? { ...session, status } : session,
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

  async function completeNext() {
    const next = sessions.find((session) => session.status === 'Scheduled');
    if (!next) {
      setMessage('There are no scheduled sessions to complete.');
      return;
    }
    await updateSessionStatus(next.id, 'Completed');
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

  async function saveTimeSlots(nextSlots: string[]) {
    setAdminBusy(true);
    setMessage(null);
    try {
      await postAdmin({ action: 'time-slots', timeSlots: nextSlots });
      await loadAdminRecords();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update time slots.',
      );
    } finally {
      setAdminBusy(false);
    }
  }

  async function createTrainer(name: string) {
    setAdminBusy(true);
    setMessage(null);
    try {
      await postAdmin({ action: 'trainer-create', name });
      await loadAdminRecords();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to add the trainer.',
      );
    } finally {
      setAdminBusy(false);
    }
  }

  async function updateTrainer(
    id: string,
    changes: { name?: string; isActive?: boolean },
  ) {
    setAdminBusy(true);
    setMessage(null);
    try {
      await postAdmin({ action: 'trainer-update', id, ...changes });
      await loadAdminRecords();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update the trainer.',
      );
    } finally {
      setAdminBusy(false);
    }
  }

  async function updateCandidateAdmin(
    id: string,
    changes: {
      name?: string;
      phone?: string;
      enrolledAt?: string;
      isActive?: boolean;
    },
  ) {
    setAdminBusy(true);
    setMessage(null);
    try {
      await postAdmin({ action: 'candidate-update', id, ...changes });
      await loadAdminRecords();
      setEditingCandidate(null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update the candidate.',
      );
    } finally {
      setAdminBusy(false);
    }
  }

  async function deleteCandidateAdmin(id: string) {
    setAdminBusy(true);
    setMessage(null);
    try {
      await postAdmin({ action: 'candidate-delete', id });
      await loadAdminRecords();
      setSessions((current) =>
        current.filter((session) => session.candidateId !== id),
      );
      setDeletingCandidate(null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to delete the candidate.',
      );
    } finally {
      setAdminBusy(false);
    }
  }

  async function submitAdminSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setAdminSaving(true);
    setAdminError(null);
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          password: adminPassword,
          website: String(form.get('website') ?? ''),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: unknown;
      };
      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : 'Unable to sign in.',
        );
      }
      setAdminAuthenticated(true);
      setAdminConfigured(true);
      setAdminPassword('');
      setAdminOpen(false);
    } catch (error) {
      setAdminError(
        error instanceof Error ? error.message : 'Unable to sign in.',
      );
    } finally {
      setAdminSaving(false);
    }
  }

  async function signOutAdmin() {
    try {
      await fetch('/api/admin/session', { method: 'DELETE' });
    } finally {
      setAdminAuthenticated(false);
      setAdminPassword('');
      if (pathname === '/settings') window.location.assign('/');
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
            >
              {isAdmin ? 'Admin access' : 'General access'}
            </Badge>
            {isAdmin ? (
              <Button variant="outline" size="sm" onClick={() => void signOutAdmin()}>
                Sign out
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAdminError(null);
                  setAdminOpen(true);
                }}
              >
                Admin sign in
              </Button>
            )}
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
              className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-[#eed5d8] bg-[#fff7f7] px-4 py-3 text-sm text-[#9b3039]"
            >
              <p>{message}</p>
              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() => setMessage(null)}
                className="shrink-0 rounded-md p-0.5 text-[#9b3039]/70 hover:bg-[#9b3039]/10 hover:text-[#9b3039]"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          )}
          {!loaded && (
            <div className="space-y-6" aria-busy="true" aria-live="polite">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-8 w-64" />
                </div>
                <Skeleton className="h-10 w-full max-w-xs rounded-xl sm:w-64" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Card key={index} className="bg-white">
                    <CardContent className="space-y-3">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-3 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="bg-white">
                <CardContent className="space-y-3 py-6">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </CardContent>
              </Card>
            </div>
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
              onUpdateStatus={updateSessionStatus}
            />
          )}
          {loaded && page.href === '/reports' && (
            <Reports
              candidates={rows}
              sessions={sessions}
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
                trainers={adminTrainers}
                timeSlots={timeSlots}
                saving={saving}
                busy={adminBusy}
                onChange={setTarget}
                onSave={saveTarget}
                onCreateTrainer={createTrainer}
                onUpdateTrainer={updateTrainer}
                onSaveTimeSlots={saveTimeSlots}
              />
            ) : (
              <SettingsRestricted
                configured={adminConfigured}
                title="Settings are protected"
                description="General users can work with candidate and training records, but only an administrator can view or change operational settings."
                onSignIn={() => {
                  setAdminError(null);
                  setAdminOpen(true);
                }}
              />
            ))}
          {loaded && page.href === '/admin' &&
            (isAdmin ? (
              <AdminCandidates
                candidates={adminCandidates}
                busy={adminBusy}
                onEdit={setEditingCandidate}
                onToggleActive={(candidate) =>
                  void updateCandidateAdmin(candidate.id, {
                    isActive: !candidate.isActive,
                  })
                }
                onDelete={setDeletingCandidate}
              />
            ) : (
              <SettingsRestricted
                configured={adminConfigured}
                title="Candidate records are protected"
                description="General users can work with candidate and training records, but only an administrator can view, edit, or delete the full candidate register."
                onSignIn={() => {
                  setAdminError(null);
                  setAdminOpen(true);
                }}
              />
            ))}
        </div>
      </main>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!open) setAddOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a learner</DialogTitle>
            <DialogDescription>
              Create a candidate record in the PMTS database.
            </DialogDescription>
          </DialogHeader>
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
            <DialogFooter>
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={adminOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAdminOpen(false);
            setAdminPassword('');
            setAdminError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Administrator sign in</DialogTitle>
            <DialogDescription>
              Enter the administrator password to unlock Settings for this browser for 30 minutes.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitAdminSignIn}>
            <input
              aria-hidden="true"
              autoComplete="off"
              className="absolute -left-[9999px] size-px"
              name="website"
              tabIndex={-1}
            />
            <label className="block text-sm font-medium">
              Administrator password
              <Input
                autoFocus
                required
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                autoComplete="current-password"
                className="mt-1.5"
              />
            </label>
            {adminError && (
              <p className="text-sm text-[#9b3039]">{adminError}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAdminOpen(false);
                  setAdminPassword('');
                  setAdminError(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={adminSaving}>
                {adminSaving ? 'Signing in…' : 'Sign in'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {editingCandidate && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setEditingCandidate(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit candidate</DialogTitle>
              <DialogDescription>
                Candidate ID {editingCandidate.id} cannot be changed here.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const name = String(form.get('name') ?? '').trim();
                const phone = String(form.get('phone') ?? '').trim();
                const enrolledAt = String(form.get('enrolledAt') ?? '').trim();
                if (!name || !enrolledAt) return;
                void updateCandidateAdmin(editingCandidate.id, {
                  name,
                  phone,
                  enrolledAt,
                });
              }}
            >
              <label className="block text-sm font-medium">
                Learner name
                <Input
                  required
                  name="name"
                  defaultValue={editingCandidate.name}
                  className="mt-1.5"
                />
              </label>
              <label className="block text-sm font-medium">
                Phone number
                <Input
                  name="phone"
                  defaultValue={editingCandidate.phone}
                  className="mt-1.5"
                />
              </label>
              <label className="block text-sm font-medium">
                Enrollment date
                <Input
                  required
                  type="date"
                  name="enrolledAt"
                  defaultValue={editingCandidate.enrolledAt}
                  className="mt-1.5"
                />
              </label>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingCandidate(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={adminBusy}>
                  {adminBusy ? 'Saving…' : 'Save changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {deletingCandidate && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeletingCandidate(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete candidate</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes {deletingCandidate.name} (
                {deletingCandidate.id}) and all of their training sessions.
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={adminBusy}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={adminBusy}
                onClick={() =>
                  void deleteCandidateAdmin(deletingCandidate.id)
                }
              >
                {adminBusy ? 'Deleting…' : 'Delete permanently'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = normalizedQuery
    ? candidates.filter((item) =>
        (item.name + ' ' + item.id).toLocaleLowerCase().includes(normalizedQuery),
      )
    : candidates;

  useEffect(() => {
    setHighlighted(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  function selectCandidate(id: string) {
    setOpen(false);
    setQuery('');
    window.location.assign('/?candidate=' + encodeURIComponent(id));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlighted((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlighted((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      const match = matches[highlighted];
      if (open && match) {
        event.preventDefault();
        selectCandidate(match.id);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div ref={containerRef} className="relative w-full xl:w-[310px]">
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
          value={open ? query : `${candidate.name} · ${candidate.id}`}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search name or serial no."
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="candidate-search-listbox"
          aria-autocomplete="list"
          className="h-10 border-[#dfe2ec] bg-white pl-9 text-sm"
        />
      </div>
      {open && (
        <ul
          id="candidate-search-listbox"
          role="listbox"
          aria-label="Candidates"
          className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-lg border border-[#dfe2ec] bg-white py-1 shadow-lg"
        >
          {matches.length ? (
            matches.map((item, index) => (
              <li key={item.id} role="option" aria-selected={item.id === candidate.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => selectCandidate(item.id)}
                  className={
                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm ' +
                    (index === highlighted
                      ? 'bg-[#f1f1fb] text-[#3f3f91]'
                      : 'text-[#31323d]') +
                    (item.id === candidate.id ? ' font-medium' : '')
                  }
                >
                  <span>
                    {item.name} · {item.id}
                  </span>
                  {item.id === candidate.id && (
                    <Icon
                      icon={CheckmarkCircle02Icon}
                      size={14}
                      className="text-[#3f3f91]"
                    />
                  )}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-xs text-[#85899b]">
              No candidate matches that name or serial number.
            </li>
          )}
        </ul>
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
  onUpdateStatus,
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
  onUpdateStatus: (id: string, status: Status) => Promise<void>;
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
                <NativeSelect
                  required
                  value={candidateId}
                  onChange={(event) => setCandidateId(event.target.value)}
                  className="mt-1.5 w-full"
                >
                  <NativeSelectOption value="">Select learner</NativeSelectOption>
                  {candidates.map((candidate) => (
                    <NativeSelectOption key={candidate.id} value={candidate.id}>
                      {candidate.name} · {candidate.id}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
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
                <NativeSelect
                  required
                  value={trainerId}
                  onChange={(event) => setTrainerId(event.target.value)}
                  className="mt-1.5 w-full"
                  disabled={!trainers.length}
                >
                  <NativeSelectOption value="">
                    {trainers.length ? 'Select trainer' : 'Loading trainers…'}
                  </NativeSelectOption>
                  {trainers.map((trainer) => (
                    <NativeSelectOption key={trainer.id} value={trainer.id}>
                      {trainer.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <label className="text-sm font-medium">
                Outcome
                <NativeSelect
                  value={status}
                  onChange={(event) => setStatus(asStatus(event.target.value))}
                  className="mt-1.5 w-full"
                >
                  {STATUSES.map((item) => (
                    <NativeSelectOption key={item}>{item}</NativeSelectOption>
                  ))}
                </NativeSelect>
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
                      <div className="flex items-center gap-2">
                        <Badge
                          className={statusStyle(session.status) + ' ring-1'}
                        >
                          {session.status}
                        </Badge>
                        <NativeSelect
                          size="sm"
                          aria-label={
                            'Update status for ' + session.candidateName
                          }
                          value={session.status}
                          disabled={saving}
                          onChange={(event) =>
                            void onUpdateStatus(
                              session.id,
                              asStatus(event.target.value),
                            )
                          }
                          className="text-xs"
                        >
                          {STATUSES.map((status) => (
                            <NativeSelectOption key={status} value={status}>
                              {status}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </div>
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

const distributionChartConfig = {
  candidates: { label: 'Learners', color: '#25255e' },
} satisfies ChartConfig;

const statusChartConfig = {
  count: { label: 'Sessions', color: '#5559a8' },
} satisfies ChartConfig;

function Reports({
  candidates,
  sessions,
  completed,
  noShows,
  attendance,
  target,
}: {
  candidates: ProgressCandidate[];
  sessions: Session[];
  completed: number;
  noShows: number;
  attendance: number;
  target: number;
}) {
  const totalTarget = candidates.length * target;
  const portfolio = totalTarget
    ? Math.round((completed / totalTarget) * 100)
    : 0;

  const distributionBuckets = [
    { label: '0–24%', min: 0, max: 25 },
    { label: '25–49%', min: 25, max: 50 },
    { label: '50–74%', min: 50, max: 75 },
    { label: '75–99%', min: 75, max: 100 },
    { label: '100%', min: 100, max: Infinity },
  ];
  const distribution = distributionBuckets.map((bucket) => ({
    label: bucket.label,
    candidates: candidates.filter(
      (candidate) =>
        candidate.percentage >= bucket.min &&
        candidate.percentage < bucket.max,
    ).length,
  }));

  const statusCounts = STATUSES.map((status) => ({
    status,
    count: sessions.filter((session) => session.status === status).length,
  }));

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
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="bg-white">
          <CardHeader>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8a8ea0]">
                Programme spread
              </p>
              <CardTitle className="mt-1 text-lg">
                Completion distribution
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {candidates.length ? (
              <ChartContainer
                config={distributionChartConfig}
                className="aspect-auto h-64 w-full"
              >
                <BarChart data={distribution} margin={{ left: -20 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    fontSize={11}
                    width={28}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="candidates"
                    fill="var(--color-candidates)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-10 text-center text-sm text-[#73788d]">
                No learners yet.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardHeader>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8a8ea0]">
                Session outcomes
              </p>
              <CardTitle className="mt-1 text-lg">Status breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {sessions.length ? (
              <ChartContainer
                config={statusChartConfig}
                className="aspect-auto h-64 w-full"
              >
                <BarChart
                  data={statusCounts}
                  layout="vertical"
                  margin={{ left: 8 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    fontSize={11}
                  />
                  <YAxis
                    dataKey="status"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={78}
                    fontSize={11}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-10 text-center text-sm text-[#73788d]">
                No sessions logged yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SettingsRestricted({
  configured,
  title = 'Settings are protected',
  description = 'General users can work with candidate and training records, but only an administrator can view or change operational settings.',
  onSignIn,
}: {
  configured: boolean;
  title?: string;
  description?: string;
  onSignIn: () => void;
}) {
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
          {title}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#686d81]">
          {description}
        </p>
        {!configured && (
          <p className="mt-3 max-w-md text-xs leading-5 text-[#9b3039]">
            Administrator sign-in has not been configured for this ERP yet.
          </p>
        )}
        <Button className="mt-6" onClick={onSignIn}>
          Administrator sign in
        </Button>
        <a
          href="/"
          className="mt-4 text-sm font-medium text-[#4b4b9d] underline underline-offset-4"
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
  timeSlots,
  saving,
  busy,
  onChange,
  onSave,
  onCreateTrainer,
  onUpdateTrainer,
  onSaveTimeSlots,
}: {
  target: number;
  trainers: Trainer[];
  timeSlots: string[];
  saving: boolean;
  busy: boolean;
  onChange: (value: number) => void;
  onSave: (value: number) => Promise<void>;
  onCreateTrainer: (name: string) => Promise<void>;
  onUpdateTrainer: (
    id: string,
    changes: { name?: string; isActive?: boolean },
  ) => Promise<void>;
  onSaveTimeSlots: (slots: string[]) => Promise<void>;
}) {
  const [newTrainerName, setNewTrainerName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newSlot, setNewSlot] = useState('');
  const activeCount = trainers.filter((trainer) => trainer.isActive !== false).length;
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
            <Badge variant="outline">{activeCount} active</Badge>
          </CardHeader>
          <CardContent>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const name = newTrainerName.trim();
                if (!name) return;
                void onCreateTrainer(name).then(() => setNewTrainerName(''));
              }}
            >
              <Input
                value={newTrainerName}
                onChange={(event) => setNewTrainerName(event.target.value)}
                placeholder="e.g. A. Kapoor"
                className="h-9 text-sm"
                disabled={busy}
              />
              <Button
                type="submit"
                size="sm"
                disabled={busy || !newTrainerName.trim()}
              >
                <Icon icon={PlusSignIcon} size={14} /> Add
              </Button>
            </form>
            {trainers.length ? (
              <div className="mt-4 space-y-2">
                {trainers.map((trainer) => (
                  <div
                    key={trainer.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#e5e7f0] bg-[#fafbfe] px-3 py-2.5"
                  >
                    {renamingId === trainer.id ? (
                      <form
                        className="flex flex-1 items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const name = renameValue.trim();
                          if (!name) return;
                          void onUpdateTrainer(trainer.id, { name }).then(() =>
                            setRenamingId(null),
                          );
                        }}
                      >
                        <Input
                          autoFocus
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          className="h-8 text-sm"
                          disabled={busy}
                        />
                        <Button type="submit" size="sm" disabled={busy}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setRenamingId(null)}
                        >
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <>
                        <span
                          className={
                            'min-w-0 flex-1 truncate text-sm font-medium ' +
                            (trainer.isActive === false
                              ? 'text-[#a3a7bb] line-through'
                              : '')
                          }
                        >
                          {trainer.name}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {trainer.isActive === false && (
                            <Badge variant="outline" className="text-[10px]">
                              Inactive
                            </Badge>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                              setRenamingId(trainer.id);
                              setRenameValue(trainer.name);
                            }}
                          >
                            Rename
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void onUpdateTrainer(trainer.id, {
                                isActive: trainer.isActive === false,
                              })
                            }
                          >
                            {trainer.isActive === false
                              ? 'Reactivate'
                              : 'Deactivate'}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#73788d]">
                Loading trainer records…
              </p>
            )}
            <p className="mt-4 text-xs leading-5 text-[#73788d]">
              Deactivated trainers stay on past sessions but drop off the
              training log's trainer list.
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
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!newSlot || timeSlots.includes(newSlot)) {
                  setNewSlot('');
                  return;
                }
                void onSaveTimeSlots([...timeSlots, newSlot].sort()).then(() =>
                  setNewSlot(''),
                );
              }}
            >
              <Input
                type="time"
                value={newSlot}
                onChange={(event) => setNewSlot(event.target.value)}
                className="h-9 text-sm"
                disabled={busy}
              />
              <Button type="submit" size="sm" disabled={busy || !newSlot}>
                <Icon icon={PlusSignIcon} size={14} /> Add
              </Button>
            </form>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {timeSlots.map((slot) => (
                <div
                  key={slot}
                  className="flex items-center justify-between gap-1 rounded-lg border border-[#e5e7f0] bg-[#fafbfe] px-2.5 py-2 font-mono text-xs text-[#5559a8]"
                >
                  {slot}
                  <button
                    type="button"
                    aria-label={'Remove ' + slot}
                    disabled={busy}
                    className="text-[#9a9ec2] hover:text-[#9b3039] disabled:pointer-events-none disabled:opacity-50"
                    onClick={() =>
                      void onSaveTimeSlots(
                        timeSlots.filter((item) => item !== slot),
                      )
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              {!timeSlots.length && (
                <p className="col-span-3 text-sm text-[#73788d]">
                  No time slots configured.
                </p>
              )}
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

function AdminCandidates({
  candidates,
  busy,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  candidates: AdminCandidateRecord[];
  busy: boolean;
  onEdit: (candidate: AdminCandidateRecord) => void;
  onToggleActive: (candidate: AdminCandidateRecord) => void;
  onDelete: (candidate: AdminCandidateRecord) => void;
}) {
  return (
    <>
      <section className="mb-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#747991]">
          Administrator only
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
          Candidate records
        </h2>
        <p className="mt-2 text-sm text-[#686d81]">
          Edit, deactivate, or permanently remove candidate records, including
          learners hidden from the general dashboard.
        </p>
      </section>
      <Card className="bg-white">
        <CardHeader>
          <div>
            <CardTitle>All candidates</CardTitle>
            <CardDescription>
              Deleting a candidate also deletes their training sessions.
            </CardDescription>
          </div>
          <Badge variant="outline">{candidates.length} records</Badge>
        </CardHeader>
        <CardContent>
          {candidates.length ? (
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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => (
                  <TableRow key={candidate.id}>
                    <TableCell className="font-medium">
                      {candidate.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {candidate.id}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {candidate.enrolledAt}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs lg:table-cell">
                      {candidate.phone || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          (candidate.isActive
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-zinc-100 text-zinc-600 ring-zinc-200') +
                          ' ring-1'
                        }
                      >
                        {candidate.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => onEdit(candidate)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => onToggleActive(candidate)}
                        >
                          {candidate.isActive ? 'Deactivate' : 'Reactivate'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={busy}
                          onClick={() => onDelete(candidate)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-10 text-center text-sm text-[#73788d]">
              No candidate records yet.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
