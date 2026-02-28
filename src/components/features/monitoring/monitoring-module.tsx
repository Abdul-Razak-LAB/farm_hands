'use client';

import { useAuth } from '@/components/layout/auth-provider';
import { formatDate } from '@/lib/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const json = (await response.json()) as ApiEnvelope<T>;
  if (!json.success) {
    throw new Error(json.error?.message || 'Request failed');
  }
  return json.data as T;
}

export function MonitoringModule() {
  const { farmId } = useAuth();
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState<'INFO' | 'WARNING' | 'CRITICAL'>('WARNING');
  const [commodityPrice, setCommodityPrice] = useState(360);
  const [weatherRisk, setWeatherRisk] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [pestPressure, setPestPressure] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');
  const [feedbackZoneId, setFeedbackZoneId] = useState('z1');
  const [recommendedYield, setRecommendedYield] = useState(4.2);
  const [actualYield, setActualYield] = useState(4.0);
  const previousLeaderboardRanksRef = useRef<Map<string, number>>(new Map());
  const [rankChanges, setRankChanges] = useState<Record<string, 'UP' | 'DOWN' | 'NEW' | 'SAME'>>({});
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importedMachines, setImportedMachines] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState<{ rows: number; importedAt: string } | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ['monitoring-dashboard', farmId],
    queryFn: () => apiCall<any>(`/api/farms/${farmId}/monitoring`),
    enabled: Boolean(farmId),
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const triggerMutation = useMutation({
    mutationFn: () => apiCall(`/api/farms/${farmId}/monitoring`, {
      method: 'POST',
      body: JSON.stringify({
        level,
        message,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: () => {
      setMessage('');
      void dashboardQuery.refetch();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (alertId: string) => apiCall(`/api/farms/${farmId}/monitoring/alerts/${alertId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
    }),
    onSuccess: () => {
      void dashboardQuery.refetch();
    },
  });

  const vraQuery = useQuery({
    queryKey: ['monitoring-vra', farmId],
    queryFn: () => apiCall<any>(`/api/farms/${farmId}/monitoring/vra`),
    enabled: Boolean(farmId),
  });

  const runVraMutation = useMutation({
    mutationFn: () => apiCall(`/api/farms/${farmId}/monitoring/vra`, {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        zones: [
          { zoneId: 'z1', name: 'North Ridge', hectares: 12, productivityIndex: 0.34 },
          { zoneId: 'z2', name: 'Central Flat', hectares: 18, productivityIndex: 0.61 },
          { zoneId: 'z3', name: 'South Valley', hectares: 10, productivityIndex: 0.82 },
        ],
        market: {
          commodityPricePerTon: commodityPrice,
          seedCostPerKg: 2.6,
          fertilizerCostPerKg: 0.95,
          targetMarginPerHa: 420,
        },
        intelligence: {
          weatherRisk,
          pestPressure,
          maxYieldPotentialTonsPerHa: 6.2,
        },
      }),
    }),
    onSuccess: () => {
      void vraQuery.refetch();
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: () => apiCall(`/api/farms/${farmId}/monitoring/vra/feedback`, {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        outcomes: [{
          zoneId: feedbackZoneId,
          recommendedYieldPerHa: recommendedYield,
          actualYieldPerHa: actualYield,
        }],
      }),
    }),
    onSuccess: () => {
      void vraQuery.refetch();
    },
  });

  const dashboard = dashboardQuery.data;
  const vra = vraQuery.data;

  const fieldLeaderboard = useMemo(
    () => (Array.isArray(dashboard?.fieldLeaderboard) ? dashboard.fieldLeaderboard : []),
    [dashboard?.fieldLeaderboard]
  );
  const fieldStateAnalytics = dashboard?.fieldStateAnalytics;
  const dataManager = dashboard?.dataManager;

  useEffect(() => {
    if (!fieldLeaderboard.length) return;

    const previousRanks = previousLeaderboardRanksRef.current;
    const nextRanks = new Map<string, number>();
    const nextChanges: Record<string, 'UP' | 'DOWN' | 'NEW' | 'SAME'> = {};

    for (const entry of fieldLeaderboard) {
      const currentRank = Number(entry.rank);
      const previousRank = previousRanks.get(entry.fieldName);

      if (typeof previousRank === 'number') {
        if (currentRank < previousRank) {
          nextChanges[entry.fieldName] = 'UP';
        } else if (currentRank > previousRank) {
          nextChanges[entry.fieldName] = 'DOWN';
        } else {
          nextChanges[entry.fieldName] = 'SAME';
        }
      } else {
        nextChanges[entry.fieldName] = 'NEW';
      }

      nextRanks.set(entry.fieldName, currentRank);
    }

    previousLeaderboardRanksRef.current = nextRanks;
    setRankChanges(nextChanges);
  }, [fieldLeaderboard]);

  const exportPhase2Csv = () => {
    const rows = Array.isArray(vra?.phase2) ? vra.phase2 : [];
    if (!rows.length) return;

    const header = ['zone', 'seed_rate_kg_per_ha', 'fertilizer_rate_kg_per_ha'];
    const csvLines = [
      header.join(','),
      ...rows.map((zone: any) => {
        const zoneName = String(zone.zoneName || '').replaceAll('"', '""');
        return [
          `"${zoneName}"`,
          String(zone.seedRateKgPerHa ?? ''),
          String(zone.fertilizerRateKgPerHa ?? ''),
        ].join(',');
      }),
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `phase2-prescription-${farmId || 'farm'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportDataManagerCsv = () => {
    const machines = importedMachines.length
      ? importedMachines
      : (Array.isArray(dataManager?.machines) ? dataManager.machines : []);
    if (!machines.length) return;

    const header = [
      'machine_id',
      'machine_name',
      'machine_type',
      'field_name',
      'connectivity',
      'health_score',
      'engine_hours',
      'speed_kph',
      'fuel_level_pct',
      'rpm',
      'battery_voltage',
      'temperature_c',
      'last_seen_at',
    ];

    const csvLines = [
      header.join(','),
      ...machines.map((machine: any) => {
        const machineName = String(machine.machineName || '').replaceAll('"', '""');
        const machineType = String(machine.machineType || '').replaceAll('"', '""');
        const fieldName = String(machine.fieldName || '').replaceAll('"', '""');

        return [
          machine.machineId ?? '',
          `"${machineName}"`,
          `"${machineType}"`,
          `"${fieldName}"`,
          machine.connectivity ?? '',
          machine.healthScore ?? '',
          machine.telemetry?.engineHours ?? '',
          machine.telemetry?.speedKph ?? '',
          machine.telemetry?.fuelLevelPct ?? '',
          machine.telemetry?.rpm ?? '',
          machine.telemetry?.batteryVoltage ?? '',
          machine.telemetry?.temperatureC ?? '',
          machine.lastSeenAt ?? '',
        ].join(',');
      }),
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `data-manager-machines-${farmId || 'farm'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportMachineEventsCsv = () => {
    const events = Array.isArray(dataManager?.recentMachineEvents) ? dataManager.recentMachineEvents : [];
    if (!events.length) return;

    const header = ['event_id', 'event_type', 'event_at'];
    const csvLines = [
      header.join(','),
      ...events.map((event: any) => {
        const eventType = String(event.type || '').replaceAll('"', '""');
        return [
          event.id ?? '',
          `"${eventType}"`,
          event.at ?? '',
        ].join(',');
      }),
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `data-manager-events-${farmId || 'farm'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const parseCsvLine = (line: string) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          index += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }

      if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    cells.push(current.trim());
    return cells;
  };

  const normalizeNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const importDataManagerCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        setImportedMachines([]);
        setImportSummary({ rows: 0, importedAt: new Date().toISOString() });
        return;
      }

      const header = parseCsvLine(lines[0]).map((item) => item.toLowerCase());
      const getCell = (cells: string[], column: string) => {
        const index = header.indexOf(column);
        return index >= 0 ? (cells[index] ?? '') : '';
      };

      const parsedMachines = lines.slice(1).map((line, index) => {
        const cells = parseCsvLine(line);
        const machineId = getCell(cells, 'machine_id') || `imported-${index + 1}`;

        return {
          machineId,
          machineName: getCell(cells, 'machine_name') || `Imported Machine ${index + 1}`,
          machineType: getCell(cells, 'machine_type') || 'UNKNOWN',
          fieldName: getCell(cells, 'field_name') || 'General',
          connectivity: getCell(cells, 'connectivity') || 'UNKNOWN',
          healthScore: normalizeNumber(getCell(cells, 'health_score')),
          lastSeenAt: getCell(cells, 'last_seen_at') || null,
          telemetry: {
            engineHours: normalizeNumber(getCell(cells, 'engine_hours')),
            speedKph: normalizeNumber(getCell(cells, 'speed_kph')),
            fuelLevelPct: normalizeNumber(getCell(cells, 'fuel_level_pct')),
            rpm: normalizeNumber(getCell(cells, 'rpm')),
            batteryVoltage: normalizeNumber(getCell(cells, 'battery_voltage')),
            temperatureC: normalizeNumber(getCell(cells, 'temperature_c')),
          },
        };
      });

      setImportedMachines(parsedMachines);
      setImportSummary({ rows: parsedMachines.length, importedAt: new Date().toISOString() });
    } finally {
      event.target.value = '';
    }
  };

  const dataManagerMachines = useMemo(() => {
    if (importedMachines.length) {
      return importedMachines;
    }
    return Array.isArray(dataManager?.machines) ? dataManager.machines : [];
  }, [dataManager?.machines, importedMachines]);
  const onlineMachines = useMemo(
    () => dataManagerMachines.filter((machine: any) => machine.connectivity === 'ONLINE').length,
    [dataManagerMachines]
  );
  const offlineMachines = useMemo(
    () => dataManagerMachines.filter((machine: any) => machine.connectivity === 'OFFLINE').length,
    [dataManagerMachines]
  );
  const averageHealthScore = useMemo(() => {
    if (!dataManagerMachines.length) return 0;
    const total = dataManagerMachines.reduce((sum: number, machine: any) => sum + Number(machine.healthScore || 0), 0);
    return Math.round(total / dataManagerMachines.length);
  }, [dataManagerMachines]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8 overflow-x-hidden">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Monitoring</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Sensor status and threshold alerts</p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Devices</p>
          <p className="text-2xl font-black">{dashboard?.summary?.totalDevices ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Open Alerts</p>
          <p className="text-2xl font-black">{dashboard?.summary?.unresolvedAlerts ?? 0}</p>
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase">Field Leaderboard</h2>
          <span className="text-[10px] uppercase text-muted-foreground">
            Live · 15s refresh
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Near real-time field activity tracking, continuously refreshed in the background.
        </p>
        {dashboard?.leaderboardGeneratedAt ? (
          <p className="text-[10px] text-muted-foreground">Last update: {formatDate(dashboard.leaderboardGeneratedAt)}</p>
        ) : null}

        <div className="space-y-2">
          {fieldLeaderboard.length ? fieldLeaderboard.map((entry: any) => {
            const change = rankChanges[entry.fieldName] || 'SAME';
            const changeText = change === 'UP'
              ? '↑ Rising'
              : change === 'DOWN'
                ? '↓ Falling'
                : change === 'NEW'
                  ? '• New'
                  : '→ Steady';

            return (
              <div key={entry.fieldName} className="p-3 rounded-md bg-accent/20 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">#{entry.rank} {entry.fieldName}</p>
                  <span className="text-[10px] uppercase text-muted-foreground">{changeText}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Score {entry.score} · {entry.readingCount} readings · Top sensor: {entry.topDevice}
                </p>
                <p className="text-[10px] text-muted-foreground">Last signal: {formatDate(entry.lastSignalAt)}</p>
              </div>
            );
          }) : <p className="text-xs text-muted-foreground">No recent field activity.</p>}
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase">Field State Analytics</h2>
          <span className="text-[10px] uppercase text-muted-foreground">In-depth</span>
        </div>

        {fieldStateAnalytics?.generatedAt ? (
          <p className="text-[10px] text-muted-foreground">Generated: {formatDate(fieldStateAnalytics.generatedAt)}</p>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-accent/20 space-y-1">
            <p className="text-[10px] uppercase text-muted-foreground">Weather Forecast</p>
            <p className="text-sm font-semibold">{fieldStateAnalytics?.weatherForecast?.riskLevel ?? 'NO DATA'}</p>
            <p className="text-[11px] text-muted-foreground">
              Rain {fieldStateAnalytics?.weatherForecast?.next24hRainProbabilityPct ?? 0}% · Wind {fieldStateAnalytics?.weatherForecast?.windKph ?? 0} kph
            </p>
          </div>
          <div className="p-3 rounded-md bg-accent/20 space-y-1">
            <p className="text-[10px] uppercase text-muted-foreground">Vegetation Indices</p>
            <p className="text-sm font-semibold">NDVI {fieldStateAnalytics?.vegetationIndices?.ndvi ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">
              EVI {fieldStateAnalytics?.vegetationIndices?.evi ?? 0} · SAVI {fieldStateAnalytics?.vegetationIndices?.savi ?? 0}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase">Plant Growth Stages</h3>
          {Array.isArray(fieldStateAnalytics?.growthStages) && fieldStateAnalytics.growthStages.length ? (
            fieldStateAnalytics.growthStages.map((stage: any) => (
              <div key={stage.fieldName} className="p-3 rounded-md bg-accent/20 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{stage.fieldName}</p>
                  <p className="text-[11px] text-muted-foreground">NDVI {stage.ndvi} · Confidence {stage.confidence}</p>
                </div>
                <span className="text-[10px] uppercase text-muted-foreground">{stage.stage}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No growth-stage analytics available.</p>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase">Key Factors</h3>
          {Array.isArray(fieldStateAnalytics?.keyFactors) && fieldStateAnalytics.keyFactors.length ? (
            fieldStateAnalytics.keyFactors.map((factor: any) => (
              <div key={factor.factor} className="p-3 rounded-md bg-accent/20 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{factor.factor}</p>
                  <p className="text-[11px] text-muted-foreground">{factor.status}</p>
                </div>
                <span className="text-[10px] uppercase text-muted-foreground">Impact {factor.impact}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No factor insights available.</p>
          )}
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <h2 className="text-sm font-bold uppercase">Data Manager</h2>
          <span className="text-[10px] uppercase text-muted-foreground">All machinery on one screen</span>
        </div>

        <div className="w-full sm:w-auto">
          <div className="mt-2 rounded-md border bg-card p-2 shadow-sm flex flex-wrap items-center gap-2">
            <button
              onClick={() => importInputRef.current?.click()}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold whitespace-nowrap"
            >
              Import CSV
            </button>
            <button
              onClick={exportDataManagerCsv}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold whitespace-nowrap"
            >
              Export Machines CSV
            </button>
            <button
              onClick={exportMachineEventsCsv}
              disabled={!Array.isArray(dataManager?.recentMachineEvents) || dataManager.recentMachineEvents.length === 0}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold whitespace-nowrap disabled:opacity-50"
            >
              Export Events CSV
            </button>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={importDataManagerCsv}
            className="hidden"
          />
        </div>

        {importSummary ? (
          <p className="text-[10px] text-muted-foreground">
            Imported {importSummary.rows} rows at {formatDate(importSummary.importedAt)}. Imported data is shown in the machine list.
          </p>
        ) : null}

        {dataManager?.generatedAt ? (
          <p className="text-[10px] text-muted-foreground">Synced: {formatDate(dataManager.generatedAt)}</p>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-accent/20">
            <p className="text-[10px] uppercase text-muted-foreground">Machines</p>
            <p className="text-xl font-black">{importedMachines.length || dataManager?.summary?.totalMachines || 0}</p>
            <p className="text-[11px] text-muted-foreground">Online {onlineMachines}</p>
          </div>
          <div className="p-3 rounded-md bg-accent/20">
            <p className="text-[10px] uppercase text-muted-foreground">Fleet Health</p>
            <p className="text-xl font-black">{averageHealthScore}</p>
            <p className="text-[11px] text-muted-foreground">Offline {offlineMachines}</p>
          </div>
        </div>

        <div className="space-y-2">
          {dataManagerMachines.length ? (
            dataManagerMachines.map((machine: any) => (
              <div key={machine.machineId} className="p-3 rounded-md bg-accent/20 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{machine.machineName}</p>
                  <span className="text-[10px] uppercase text-muted-foreground">{machine.connectivity}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{machine.machineType} · {machine.fieldName} · Health {machine.healthScore}</p>
                <p className="text-[11px] text-muted-foreground">
                  Fuel {machine.telemetry?.fuelLevelPct ?? 0}% · Speed {machine.telemetry?.speedKph ?? 0} kph · RPM {machine.telemetry?.rpm ?? 0}
                </p>
                <p className="text-[10px] text-muted-foreground">Last seen: {machine.lastSeenAt ? formatDate(machine.lastSeenAt) : 'No signal'}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No machinery telemetry available.</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase">Recent Machine Events</h3>
          </div>
          {Array.isArray(dataManager?.recentMachineEvents) && dataManager.recentMachineEvents.length ? (
            dataManager.recentMachineEvents.map((event: any) => (
              <div key={event.id} className="p-2 rounded-md bg-accent/20 flex items-center justify-between">
                <p className="text-[11px] font-semibold">{event.type}</p>
                <p className="text-[10px] text-muted-foreground">{formatDate(event.at)}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No recent machinery events.</p>
          )}
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-2">
        <h2 className="text-sm font-bold uppercase">Trigger Alert</h2>
        <select
          value={level}
          onChange={(event) => setLevel(event.target.value as 'INFO' | 'WARNING' | 'CRITICAL')}
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        >
          <option value="INFO">INFO</option>
          <option value="WARNING">WARNING</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Alert message"
          className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
        />
        <button
          onClick={() => triggerMutation.mutate()}
          disabled={triggerMutation.isPending || message.trim().length < 3}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {triggerMutation.isPending ? 'Sending...' : 'Trigger Alert'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card">
        <h2 className="text-sm font-bold uppercase mb-2">Active Alerts</h2>
        <div className="space-y-2">
          {dashboard?.unresolvedAlerts?.length ? dashboard.unresolvedAlerts.map((alert: any) => (
            <div key={alert.id} className="p-3 rounded-md bg-accent/20">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold">{alert.message}</p>
                <span className="text-[10px] uppercase text-muted-foreground">{alert.level}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{formatDate(alert.createdAt)}</p>
              <button
                onClick={() => resolveMutation.mutate(alert.id)}
                className="mt-2 h-8 px-3 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold"
              >
                Resolve
              </button>
            </div>
          )) : <p className="text-xs text-muted-foreground">No unresolved alerts.</p>}
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Variable Rate Intelligence</h2>
        <p className="text-[11px] text-muted-foreground">All phases: productivity zoning, prescription map, market optimization, and learning feedback.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="number"
            value={commodityPrice}
            onChange={(event) => setCommodityPrice(Number(event.target.value) || 0)}
            className="h-10 rounded-md bg-accent/40 px-3 text-sm"
            placeholder="Commodity price"
          />
          <select
            value={weatherRisk}
            onChange={(event) => setWeatherRisk(event.target.value as 'LOW' | 'MEDIUM' | 'HIGH')}
            className="h-10 rounded-md bg-accent/40 px-3 text-sm"
          >
            <option value="LOW">Weather: LOW</option>
            <option value="MEDIUM">Weather: MEDIUM</option>
            <option value="HIGH">Weather: HIGH</option>
          </select>
        </div>

        <select
          value={pestPressure}
          onChange={(event) => setPestPressure(event.target.value as 'LOW' | 'MEDIUM' | 'HIGH')}
          className="h-10 rounded-md bg-accent/40 px-3 text-sm w-full"
        >
          <option value="LOW">Pest: LOW</option>
          <option value="MEDIUM">Pest: MEDIUM</option>
          <option value="HIGH">Pest: HIGH</option>
        </select>

        <button
          onClick={() => runVraMutation.mutate()}
          disabled={runVraMutation.isPending || !farmId}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {runVraMutation.isPending ? 'Running all phases...' : 'Run All Phases'}
        </button>
      </section>

      {vra && (
        <>
          <section className="p-4 border rounded-xl bg-card">
            <h3 className="text-xs font-bold uppercase mb-2">Phase 1 - Productivity Bands</h3>
            <div className="space-y-2">
              {vra.phase1?.map((zone: any) => (
                <div key={zone.zoneId} className="p-2 rounded-md bg-accent/20 text-xs flex justify-between">
                  <span>{zone.zoneName}</span>
                  <span className="font-semibold">{zone.applicationBand}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="p-4 border rounded-xl bg-card">
            <h3 className="text-xs font-bold uppercase mb-2">Phase 2 - Prescription Rates</h3>
            <button
              onClick={exportPhase2Csv}
              disabled={!vra?.phase2?.length}
              className="mb-2 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              Export CSV
            </button>
            <div className="space-y-2">
              {vra.phase2?.map((zone: any) => (
                <div key={zone.zoneId} className="p-2 rounded-md bg-accent/20 text-xs">
                  <p className="font-semibold">{zone.zoneName}</p>
                  <p>Seed: {zone.seedRateKgPerHa} kg/ha | Fertilizer: {zone.fertilizerRateKgPerHa} kg/ha</p>
                </div>
              ))}
            </div>
          </section>

          <section className="p-4 border rounded-xl bg-card space-y-2">
            <h3 className="text-xs font-bold uppercase">Phase 3 - Margin Optimization</h3>
            <p className="text-[11px] text-muted-foreground">Expected margin: {vra.phase3?.totals?.expectedMargin ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Avg yield/ha: {vra.phase3?.totals?.averageYieldPerHa ?? 0}</p>
          </section>

          <section className="p-4 border rounded-xl bg-card space-y-2">
            <h3 className="text-xs font-bold uppercase">Phase 4 - Learning Feedback</h3>
            <p className="text-[11px] text-muted-foreground">Adjustment factor: {vra.phase4?.learningAdjustmentFactor ?? 1}</p>
            <p className="text-[11px] text-muted-foreground">Confidence: {vra.phase4?.learningConfidence ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">{vra.phase4?.recommendation}</p>

            <div className="grid grid-cols-3 gap-2">
              <input
                value={feedbackZoneId}
                onChange={(event) => setFeedbackZoneId(event.target.value)}
                className="h-10 rounded-md bg-accent/40 px-3 text-sm"
                placeholder="Zone ID"
              />
              <input
                type="number"
                value={recommendedYield}
                onChange={(event) => setRecommendedYield(Number(event.target.value) || 0)}
                className="h-10 rounded-md bg-accent/40 px-3 text-sm"
                placeholder="Rec. Yield"
              />
              <input
                type="number"
                value={actualYield}
                onChange={(event) => setActualYield(Number(event.target.value) || 0)}
                className="h-10 rounded-md bg-accent/40 px-3 text-sm"
                placeholder="Actual Yield"
              />
            </div>

            <button
              onClick={() => feedbackMutation.mutate()}
              disabled={feedbackMutation.isPending || !feedbackZoneId || recommendedYield <= 0 || actualYield <= 0}
              className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
            >
              {feedbackMutation.isPending ? 'Saving feedback...' : 'Submit Feedback'}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
