import Dexie, { type Table } from 'dexie';

export interface OutboxEntry {
  id: string;
  domain: string;
  action: string;
  payload: any;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'COMPLETED';
  retryCount: number;
  lastError?: string;
  createdAt: Date;
  nextAttemptAt?: Date;
}

export interface LocalTask {
  id: string;
  farmId: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
  dueDate: Date;
  assignedTo?: string;
  data: any;
}

export class FarmDB extends Dexie {
  outbox!: Table<OutboxEntry>;
  local_tasks!: Table<LocalTask>;
  local_media!: Table<{ id: string; blob: Blob; metadata: any; synced: boolean }>;
  sync_meta!: Table<{ key: string; value: any }>;

  constructor() {
    super('FarmOpsDB');
    this.version(1).stores({
      outbox: 'id, domain, status, createdAt',
      local_tasks: 'id, farmId, status, dueDate',
      local_media: 'id, synced',
      sync_meta: 'key'
    });
  }
}

export const db = new FarmDB();
