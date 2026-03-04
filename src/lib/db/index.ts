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

export interface LocalEvent {
  id: string;
  farmId: string;
  type: string;
  payload: any;
  createdAt: Date;
}

export interface LocalMedia {
  id: string;
  farmId: string;
  blob: Blob;
  metadata: any;
  synced: boolean;
  createdAt: Date;
}

export interface SyncMetaRecord {
  key: string;
  value: any;
}

export class FarmDB extends Dexie {
  outbox_jobs!: Table<OutboxEntry, string>;
  local_events!: Table<LocalEvent, string>;
  local_tasks!: Table<LocalTask, string>;
  local_media!: Table<LocalMedia, string>;
  sync_meta!: Table<SyncMetaRecord, string>;

  get outbox() {
    return this.outbox_jobs;
  }

  constructor() {
    super('FarmOpsDB');
    this.version(1).stores({
      outbox: 'id, domain, status, createdAt',
      local_tasks: 'id, farmId, status, dueDate',
      local_media: 'id, synced',
      sync_meta: 'key'
    });

    this.version(2).stores({
      outbox: null,
      outbox_jobs: 'id, domain, status, createdAt, nextAttemptAt',
      local_events: 'id, farmId, type, createdAt',
      local_tasks: 'id, farmId, status, dueDate',
      local_media: 'id, farmId, synced, createdAt',
      sync_meta: 'key'
    }).upgrade(async (tx) => {
      const legacyOutbox = await tx.table('outbox').toArray();

      if (legacyOutbox.length > 0) {
        await tx.table('outbox_jobs').bulkPut(legacyOutbox);
      }
    });
  }
}

export const db = new FarmDB();
