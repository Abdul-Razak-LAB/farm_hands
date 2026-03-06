export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ProcurementOrder = {
  id: string;
  status: string;
};

export type PayrollRun = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
};

export type ReportSummary = {
  cropHealthAndYield?: {
    estimatedYieldScore?: number;
    averageMoisture?: number;
    averageTemperature?: number;
  };
  waterAndEnergyUsage?: {
    waterLiters?: number;
    energyKwh?: number;
  };
  laborCostAndProductivity?: {
    totalLaborCost?: number;
    completedTasks?: number;
  };
  equipmentMaintenanceAndPerformance?: {
    criticalAlerts?: number;
  };
};

export type WeeklyDigest = {
  totals?: {
    events?: number;
    unresolvedAlerts?: number;
    openPurchaseOrders?: number;
    pendingPayrollRuns?: number;
  };
  byType?: Record<string, number>;
};

export type MarketplaceListing = {
  listingId: string;
  title: string;
  description?: string;
  category: 'PRODUCE' | 'EQUIPMENT' | 'SERVICE';
  direction: 'SELL' | 'BUY' | 'RENT' | 'SERVICE';
  quantity?: number;
  unit?: string;
  price?: number;
  currency?: string;
  location?: string;
  createdAt: string;
  status: 'ACTIVE' | 'CLOSED';
  interestCount?: number;
};

export type MarketplaceStakeholder = {
  stakeholderId: string;
  name: string;
  type: string;
};

export type MarketplaceSummary = {
  activeListings: number;
  totalListings: number;
  openInterests: number;
  stakeholders: number;
};

export type MarketplacePayload = {
  listings: MarketplaceListing[];
  stakeholders: MarketplaceStakeholder[];
  summary: MarketplaceSummary;
};

export type IncidentEvent = {
  id: string;
  type: string;
  createdAt: string;
  payload?: unknown;
};

export type MessageAttachment = {
  fileUrl: string;
  fileName?: string;
  contentType?: string;
  size?: number;
};

export type MessageRecord = {
  id: string;
  userId?: string;
  createdAt: string;
  payload?: {
    text?: string;
    threadId?: string;
    attachments?: MessageAttachment[];
  };
};

export type SetupProfile = {
  name?: string;
  location?: string;
  sizeHectares?: number;
  crops?: string[];
  notes?: string;
};

export type SetupSensor = {
  id: string;
  name: string;
  type: string;
  lastReadingAt?: string;
};

export type SetupMember = {
  membershipId: string;
  userId: string;
  role: 'OWNER' | 'MANAGER' | 'WORKER';
  user?: {
    name?: string;
    email?: string;
  };
};

export type SetupPayload = {
  profile?: SetupProfile;
  sensors?: SetupSensor[];
  members?: SetupMember[];
};

export type AlertPreferences = {
  inApp?: boolean;
  sms?: boolean;
  email?: boolean;
  smsRecipients?: string[];
  emailRecipients?: string[];
};
