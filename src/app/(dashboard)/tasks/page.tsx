'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/layout/auth-provider';
import { partitionTaskLanes } from '@/components/features/tasks/task-lanes';

export default function TaskBoard() {
  const [activeLane, setActiveLane] = useState<'TODAY' | 'OVERDUE' | 'COMPLETED'>('TODAY');
  const [templateName, setTemplateName] = useState('');
  const [templateNotes, setTemplateNotes] = useState('');
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; notes?: string }>>([]);
  const { farmId } = useAuth();

  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ['local_tasks'],
    queryFn: () => db.local_tasks.orderBy('dueDate').toArray(),
  });

  useEffect(() => {
    let cancelled = false;

    const seedSampleTask = async () => {
      const totalTasks = await db.local_tasks.count();
      if (totalTasks > 0 || cancelled) return;

      await db.local_tasks.add({
        id: 'sample-task-1',
        farmId: farmId || 'farm-123',
        title: 'Inspect irrigation lines in Section A',
        status: 'IN_PROGRESS',
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
        assignedTo: 'field-worker-1',
        data: {
          priority: 'MEDIUM',
          checklist: ['Check pressure', 'Look for leaks', 'Capture proof photo'],
          notes: 'Verify all hose joints before 4 PM.',
        },
      });

      await db.local_tasks.add({
        id: 'sample-task-2',
        farmId: farmId || 'farm-123',
        title: 'Repair cracked drip connector at Zone B',
        status: 'TODO',
        dueDate: new Date(Date.now() - 90 * 60 * 1000),
        assignedTo: 'field-worker-2',
        data: {
          priority: 'HIGH',
          checklist: ['Replace connector', 'Pressure test line', 'Capture photo proof'],
          notes: 'Escalated by monitoring alert #M-022.',
        },
      });

      await db.local_tasks.add({
        id: 'sample-task-3',
        farmId: farmId || 'farm-123',
        title: 'Close end-of-day feed storage checklist',
        status: 'COMPLETED',
        dueDate: new Date(Date.now() - 5 * 60 * 60 * 1000),
        assignedTo: 'field-worker-3',
        data: {
          priority: 'LOW',
          checklist: ['Count bags', 'Seal storage', 'Record notes'],
        },
      });

      if (!cancelled) {
        await refetch();
      }
    };

    void seedSampleTask();
    return () => {
      cancelled = true;
    };
  }, [farmId, refetch]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('farmops.taskTemplates');
      if (!stored) return;
      const parsed = JSON.parse(stored) as Array<{ id: string; name: string; notes?: string }>;
      if (Array.isArray(parsed)) setTemplates(parsed);
    } catch {
      setTemplates([]);
    }
  }, []);

  const persistTemplates = (nextTemplates: Array<{ id: string; name: string; notes?: string }>) => {
    setTemplates(nextTemplates);
    localStorage.setItem('farmops.taskTemplates', JSON.stringify(nextTemplates));
  };

  const now = Date.now();
  const lanes = useMemo(() => partitionTaskLanes(tasks, now), [tasks, now]);

  const visibleTasks = lanes[activeLane];

  const addTemplate = () => {
    if (templateName.trim().length < 2) return;
    const next = [
      ...templates,
      {
        id: crypto.randomUUID(),
        name: templateName.trim(),
        notes: templateNotes.trim() || undefined,
      },
    ];
    persistTemplates(next);
    setTemplateName('');
    setTemplateNotes('');
  };

  const removeTemplate = (id: string) => {
    persistTemplates(templates.filter((template) => template.id !== id));
  };

  const createTaskFromTemplate = async (templateId: string) => {
    const template = templates.find((entry) => entry.id === templateId);
    if (!template) return;

    await db.local_tasks.add({
      id: crypto.randomUUID(),
      farmId: farmId || 'farm-123',
      title: template.name,
      status: 'TODO',
      dueDate: new Date(Date.now() + 3 * 60 * 60 * 1000),
      assignedTo: 'template-assignee',
      data: {
        priority: 'MEDIUM',
        notes: template.notes,
        source: 'template',
      },
    });
    await refetch();
  };

  if (isLoading) return <div className="p-4 animate-pulse">Loading tasks...</div>;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Today's Work</h1>
        <p className="text-muted-foreground text-sm">Today, overdue, completed + reusable templates</p>
      </header>

      <section className="grid grid-cols-3 gap-2 rounded-xl border bg-card p-1">
        {([
          { id: 'TODAY', label: 'Today' },
          { id: 'OVERDUE', label: 'Overdue' },
          { id: 'COMPLETED', label: 'Completed' },
        ] as const).map((lane) => (
          <button
            key={lane.id}
            onClick={() => setActiveLane(lane.id)}
            className={`h-10 rounded-lg text-xs font-semibold ${activeLane === lane.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            {lane.label}
          </button>
        ))}
      </section>

      <div className="space-y-4">
        {visibleTasks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No tasks in this lane.
          </div>
        )}

        {visibleTasks.map((task) => (
          <div 
            key={task.id}
            className="p-4 border rounded-xl bg-card hover:border-primary/50 transition-colors shadow-sm"
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-bold text-lg">{task.title}</h2>
                <time className="text-xs text-muted-foreground">
                  {formatDate(task.dueDate)}
                </time>
              </div>
              <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-accent uppercase">
                {task.status}
              </span>
            </div>

            <div className="mt-4 flex gap-2">
              <Link href={`/tasks/${task.id}`} className="text-xs font-semibold underline underline-offset-4">
                Detailed Instructions
              </Link>
              <Link href={`/tasks/${task.id}`} className="ml-auto bg-primary text-primary-foreground px-4 py-1 rounded-md text-xs font-bold">
                Log Progress
              </Link>
            </div>
          </div>
        ))}
      </div>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Template Management</h2>
        <input
          value={templateName}
          onChange={(event) => setTemplateName(event.target.value)}
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
          placeholder="Template name"
        />
        <input
          value={templateNotes}
          onChange={(event) => setTemplateNotes(event.target.value)}
          className="w-full h-10 rounded-md bg-accent/50 px-3 text-sm"
          placeholder="Template notes (optional)"
        />
        <button
          onClick={addTemplate}
          disabled={templateName.trim().length < 2}
          className="w-full h-10 rounded-md bg-secondary text-secondary-foreground text-sm font-semibold disabled:opacity-50"
        >
          Save Template
        </button>

        <div className="space-y-2">
          {templates.length ? templates.map((template) => (
            <div key={template.id} className="p-3 rounded-md bg-accent/20 space-y-2">
              <p className="text-sm font-semibold">{template.name}</p>
              {template.notes ? <p className="text-xs text-muted-foreground">{template.notes}</p> : null}
              <div className="flex gap-2">
                <button
                  onClick={() => void createTaskFromTemplate(template.id)}
                  className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Use Template
                </button>
                <button
                  onClick={() => removeTemplate(template.id)}
                  className="h-8 px-3 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          )) : <p className="text-xs text-muted-foreground">No templates yet.</p>}
        </div>
      </section>
    </div>
  );
}
