'use client';

import { useAuth } from '@/components/layout/auth-provider';
import type { AlertPreferences, SetupPayload } from '@/lib/api/contracts';
import { getFarmData, postFarmData } from '@/lib/api/farm-client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function SetupModule() {
  const { farmId, setFarmId, setRole, role } = useAuth();
  const [profileName, setProfileName] = useState('');
  const [location, setLocation] = useState('');
  const [sizeHectares, setSizeHectares] = useState('');
  const [crops, setCrops] = useState('');
  const [notes, setNotes] = useState('');
  const [sensorName, setSensorName] = useState('');
  const [sensorType, setSensorType] = useState('SOIL_MOISTURE');
  const [inApp, setInApp] = useState(true);
  const [sms, setSms] = useState(false);
  const [email, setEmail] = useState(false);
  const [smsRecipients, setSmsRecipients] = useState('');
  const [emailRecipients, setEmailRecipients] = useState('');
  const [profileSaveMessage, setProfileSaveMessage] = useState('');
  const [profileSaveError, setProfileSaveError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [sensorSaveMessage, setSensorSaveMessage] = useState('');
  const [sensorSaveError, setSensorSaveError] = useState('');
  const [preferencesSaveMessage, setPreferencesSaveMessage] = useState('');
  const [preferencesSaveError, setPreferencesSaveError] = useState('');
  const [newFarmName, setNewFarmName] = useState('');
  const [farmMessage, setFarmMessage] = useState('');
  const [farmError, setFarmError] = useState('');
  const primaryActionButtonClass = 'h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50';
  const canWriteSetup = role === 'OWNER' || role === 'MANAGER' || role === 'WORKER';

  type ApiEnvelope<T> = {
    success: boolean;
    data?: T;
    error?: { code: string; message: string };
  };

  type FarmSummary = {
    farmId: string;
    name: string;
    role: 'OWNER' | 'MANAGER' | 'WORKER';
    createdAt: string;
  };

  async function appApiCall<T>(path: string, options?: RequestInit): Promise<T> {
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

  const farmsQuery = useQuery({
    queryKey: ['user-farms'],
    queryFn: () => appApiCall<FarmSummary[]>('/api/farms'),
  });

  const createFarmMutation = useMutation({
    mutationFn: () => appApiCall<{ farmId: string; name: string; role: 'OWNER' | 'MANAGER' | 'WORKER' }>('/api/farms', {
      method: 'POST',
      body: JSON.stringify({ name: newFarmName.trim() }),
    }),
    onSuccess: (data) => {
      setFarmError('');
      setFarmMessage(`Farm ${data.name} created successfully.`);
      setNewFarmName('');
      setFarmId(data.farmId);
      setRole(data.role);
      void farmsQuery.refetch();
      void setupQuery.refetch();
      void preferenceQuery.refetch();
    },
    onError: (error) => {
      setFarmMessage('');
      setFarmError(error instanceof Error ? error.message : 'Failed to create farm.');
    },
  });

  const setupQuery = useQuery({
    queryKey: ['farm-setup', farmId],
    queryFn: () => getFarmData<SetupPayload>(farmId!, '/setup'),
    enabled: Boolean(farmId),
  });

  const preferenceQuery = useQuery({
    queryKey: ['alert-preferences', farmId],
    queryFn: () => getFarmData<AlertPreferences>(farmId!, '/monitoring/alerts/preferences'),
    enabled: Boolean(farmId),
  });

  const profileMutation = useMutation({
    mutationFn: () => postFarmData(farmId!, '/setup', {
        action: 'UPDATE_PROFILE',
        name: profileName,
        location,
        sizeHectares: sizeHectares ? Number(sizeHectares) : undefined,
        crops: crops.split(',').map((entry) => entry.trim()).filter(Boolean),
        notes,
        idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      setProfileSaveError('');
      setProfileSaveMessage('Profile saved successfully.');
      setProfileSaved(true);
      void setupQuery.refetch();
    },
    onError: (error) => {
      setProfileSaveMessage('');
      setProfileSaveError(error instanceof Error ? error.message : 'Failed to save profile.');
    },
  });

  const sensorMutation = useMutation({
    mutationFn: () => {
      if (!farmId) {
        throw new Error('No farm selected. Select a farm before adding sensors.');
      }

      if (!canWriteSetup) {
        throw new Error('Current role cannot add sensors. Select a farm role with setup write access.');
      }

      return postFarmData(farmId, '/setup', {
        action: 'UPSERT_SENSOR',
        name: sensorName,
        type: sensorType,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      setSensorSaveError('');
      setSensorSaveMessage('Sensor saved successfully.');
      setSensorName('');
      void setupQuery.refetch();
    },
    onError: (error) => {
      setSensorSaveMessage('');
      setSensorSaveError(error instanceof Error ? error.message : 'Failed to save sensor configuration.');
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: 'OWNER' | 'MANAGER' | 'WORKER' }) => postFarmData(farmId!, '/setup', {
        action: 'UPDATE_MEMBER_ROLE',
        membershipId,
        role,
        idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      void setupQuery.refetch();
    },
  });

  const preferencesMutation = useMutation({
    mutationFn: () => postFarmData(farmId!, '/monitoring/alerts/preferences', {
        inApp,
        sms,
        email,
        smsRecipients: smsRecipients.split(',').map((entry) => entry.trim()).filter(Boolean),
        emailRecipients: emailRecipients.split(',').map((entry) => entry.trim()).filter(Boolean),
        idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      setPreferencesSaveError('');
      setPreferencesSaveMessage('Alert channel preferences saved successfully.');
      void preferenceQuery.refetch();
    },
    onError: (error) => {
      setPreferencesSaveMessage('');
      setPreferencesSaveError(error instanceof Error ? error.message : 'Failed to save alert channel preferences.');
    },
  });

  const profile = setupQuery.data?.profile;
  const sensors = setupQuery.data?.sensors ?? [];
  const members = setupQuery.data?.members ?? [];
  const preferences = preferenceQuery.data;

  useEffect(() => {
    if (!profile) return;
    setProfileName(profile.name ?? '');
    setLocation(profile.location ?? '');
    setSizeHectares(profile.sizeHectares ? String(profile.sizeHectares) : '');
    setCrops(Array.isArray(profile.crops) ? profile.crops.join(', ') : '');
    setNotes(profile.notes ?? '');
  }, [profile]);

  useEffect(() => {
    if (!preferences) return;
    setInApp(Boolean(preferences.inApp));
    setSms(Boolean(preferences.sms));
    setEmail(Boolean(preferences.email));
    setSmsRecipients(Array.isArray(preferences.smsRecipients) ? preferences.smsRecipients.join(', ') : '');
    setEmailRecipients(Array.isArray(preferences.emailRecipients) ? preferences.emailRecipients.join(', ') : '');
  }, [preferences]);

  useEffect(() => {
    if (!farmId || !farmsQuery.data?.length) return;
    const selected = farmsQuery.data.find((farm) => farm.farmId === farmId);
    if (selected) {
      setRole(selected.role);
    }
  }, [farmId, farmsQuery.data, setRole]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Farm Setup & Configuration</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Profile, sensors, roles, and alert channels</p>
      </header>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Farm Workspace</h2>
        <div className="grid gap-2 md:grid-cols-[1fr_240px]">
          <input
            value={newFarmName}
            onChange={(event) => setNewFarmName(event.target.value)}
            placeholder="New farm name"
            className="h-10 rounded-md px-3 text-sm"
          />
          <button
            onClick={() => {
              setFarmMessage('');
              setFarmError('');
              createFarmMutation.mutate();
            }}
            disabled={createFarmMutation.isPending || newFarmName.trim().length < 2}
            className={primaryActionButtonClass}
          >
            {createFarmMutation.isPending ? 'Creating...' : 'Create Farm'}
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_220px]">
          <select
            value={farmId || ''}
            onChange={(event) => {
              const nextFarmId = event.target.value;
              const selected = farmsQuery.data?.find((farm) => farm.farmId === nextFarmId);
              setFarmId(nextFarmId);
              if (selected) {
                setRole(selected.role);
              }
            }}
            className="h-10 rounded-md px-3 text-sm"
          >
            <option value="" disabled>Select active farm</option>
            {(farmsQuery.data || []).map((farm) => (
              <option key={farm.farmId} value={farm.farmId}>{farm.name} ({farm.role})</option>
            ))}
          </select>
          <button
            onClick={() => void farmsQuery.refetch()}
            className="h-10 rounded-md border bg-background px-4 text-sm font-semibold"
          >
            Refresh Farms
          </button>
        </div>

        {farmError ? <p className="text-xs text-destructive">{farmError}</p> : null}
        {farmMessage ? <p className="text-xs text-primary">{farmMessage}</p> : null}
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Farm Profile</h2>
        {profileSaved ? (
          <div className="rounded-md border border-primary/30 bg-primary/10 p-3 space-y-2">
            <p className="text-sm font-semibold text-primary">Profile saved.</p>
            <p className="text-xs text-muted-foreground">Your latest farm profile update was recorded successfully.</p>
            <button
              onClick={() => {
                setProfileSaved(false);
                setProfileSaveMessage('');
              }}
              className="h-9 rounded-md border bg-background px-3 text-xs font-semibold"
            >
              Edit Profile
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Farm name" className="h-10 rounded-md px-3 text-sm" />
              <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location (e.g. Kumasi, GH or 6.6885,-1.6244)" className="h-10 rounded-md px-3 text-sm" />
              <input value={sizeHectares} onChange={(event) => setSizeHectares(event.target.value)} placeholder="Size (hectares)" className="h-10 rounded-md px-3 text-sm" />
              <input value={crops} onChange={(event) => setCrops(event.target.value)} placeholder="Crops (comma-separated)" className="h-10 rounded-md px-3 text-sm" />
            </div>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Operational notes" className="w-full min-h-[90px] rounded-md px-3 py-2 text-sm" />
            <button
              onClick={() => {
                setProfileSaveMessage('');
                setProfileSaveError('');
                profileMutation.mutate();
              }}
              disabled={profileMutation.isPending || profileName.trim().length < 2 || !farmId}
              className={primaryActionButtonClass}
            >
              {profileMutation.isPending ? 'Saving...' : 'Save Profile'}
            </button>
          </>
        )}
        {!farmId ? <p className="text-xs text-destructive">No farm selected. Select a farm before saving profile changes.</p> : null}
        {profileSaveError ? <p className="text-xs text-destructive">{profileSaveError}</p> : null}
        {profileSaveMessage ? <p className="text-xs text-primary">{profileSaveMessage}</p> : null}
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Sensor Configuration</h2>
        <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
          <input value={sensorName} onChange={(event) => setSensorName(event.target.value)} placeholder="Sensor name" className="h-10 rounded-md px-3 text-sm" />
          <select value={sensorType} onChange={(event) => setSensorType(event.target.value)} className="h-10 rounded-md px-3 text-sm">
            <option value="SOIL_MOISTURE">SOIL_MOISTURE</option>
            <option value="TEMPERATURE">TEMPERATURE</option>
            <option value="WEATHER">WEATHER</option>
            <option value="IRRIGATION">IRRIGATION</option>
            <option value="GENERATOR">GENERATOR</option>
          </select>
          <button
            onClick={() => {
              setSensorSaveMessage('');
              setSensorSaveError('');

              if (!farmId) {
                setSensorSaveError('No farm selected. Select a farm before adding sensors.');
                return;
              }

              if (!canWriteSetup) {
                setSensorSaveError('Current role cannot add sensors. Select a farm role with setup write access.');
                return;
              }

              sensorMutation.mutate();
            }}
            disabled={sensorMutation.isPending || sensorName.trim().length < 2 || !farmId || !canWriteSetup}
            className={primaryActionButtonClass}
          >
            {sensorMutation.isPending ? 'Saving...' : 'Add Sensor'}
          </button>
        </div>
        {!canWriteSetup ? <p className="text-xs text-destructive">Current role cannot add sensors. Select a farm role with setup write access.</p> : null}
        {!farmId ? <p className="text-xs text-destructive">No farm selected. Select a farm before adding sensors.</p> : null}
        {sensorSaveError ? <p className="text-xs text-destructive">{sensorSaveError}</p> : null}
        {sensorSaveMessage ? <p className="text-xs text-primary">{sensorSaveMessage}</p> : null}
        <div className="space-y-2">
          {sensors.length ? sensors.map((sensor) => (
            <div key={sensor.id} className="rounded-md bg-accent/20 px-3 py-2 text-xs flex justify-between gap-3">
              <span className="font-semibold">{sensor.name} · {sensor.type}</span>
              <span className="text-muted-foreground">{sensor.lastReadingAt ? `Last signal: ${new Date(sensor.lastReadingAt).toLocaleString()}` : 'No reading yet'}</span>
            </div>
          )) : <p className="text-xs text-muted-foreground">No sensors configured yet.</p>}
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Team Roles</h2>
        <div className="space-y-2">
          {members.length ? members.map((member) => (
            <div key={member.membershipId} className="rounded-md bg-accent/20 px-3 py-2 text-xs flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{member.user?.name || member.user?.email || member.userId}</p>
                <p className="text-muted-foreground">{member.user?.email || member.userId}</p>
              </div>
              <select
                value={member.role}
                onChange={(event) => roleMutation.mutate({ membershipId: member.membershipId, role: event.target.value as 'OWNER' | 'MANAGER' | 'WORKER' })}
                className="h-8 rounded-md bg-background px-2 text-xs"
              >
                <option value="OWNER">OWNER</option>
                <option value="MANAGER">MANAGER</option>
                <option value="WORKER">WORKER</option>
              </select>
            </div>
          )) : <p className="text-xs text-muted-foreground">No team members found.</p>}
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Alert Channels</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <label className="rounded-md bg-accent/20 px-3 py-2 text-xs flex items-center gap-2"><input type="checkbox" checked={inApp} onChange={(event) => setInApp(event.target.checked)} /> In-app</label>
          <label className="rounded-md bg-accent/20 px-3 py-2 text-xs flex items-center gap-2"><input type="checkbox" checked={sms} onChange={(event) => setSms(event.target.checked)} /> SMS</label>
          <label className="rounded-md bg-accent/20 px-3 py-2 text-xs flex items-center gap-2"><input type="checkbox" checked={email} onChange={(event) => setEmail(event.target.checked)} /> Email</label>
        </div>
        <input value={smsRecipients} onChange={(event) => setSmsRecipients(event.target.value)} placeholder="SMS recipients (comma-separated phone numbers)" className="h-10 rounded-md px-3 text-sm" />
        <input value={emailRecipients} onChange={(event) => setEmailRecipients(event.target.value)} placeholder="Email recipients (comma-separated)" className="h-10 rounded-md px-3 text-sm" />
        <button
          onClick={() => {
            setPreferencesSaveMessage('');
            setPreferencesSaveError('');
            preferencesMutation.mutate();
          }}
          disabled={preferencesMutation.isPending}
          className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {preferencesMutation.isPending ? 'Saving...' : 'Save Channel Preferences'}
        </button>
        {preferencesSaveError ? <p className="text-xs text-destructive">{preferencesSaveError}</p> : null}
        {preferencesSaveMessage ? <p className="text-xs text-primary">{preferencesSaveMessage}</p> : null}
      </section>
    </div>
  );
}

