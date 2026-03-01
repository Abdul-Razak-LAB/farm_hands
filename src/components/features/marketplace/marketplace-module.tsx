'use client';

import { useAuth } from '@/components/layout/auth-provider';
import { formatDate } from '@/lib/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

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

export function MarketplaceModule() {
  const { farmId } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'PRODUCE' | 'EQUIPMENT' | 'SERVICE'>('PRODUCE');
  const [direction, setDirection] = useState<'SELL' | 'BUY' | 'RENT' | 'SERVICE'>('SELL');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [location, setLocation] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PRODUCE' | 'EQUIPMENT' | 'SERVICE'>('ALL');
  const [selectedListingId, setSelectedListingId] = useState('');
  const [interestMessage, setInterestMessage] = useState('');

  const marketplaceQuery = useQuery({
    queryKey: ['marketplace', farmId],
    queryFn: () => apiCall<any>(`/api/farms/${farmId}/marketplace`),
    enabled: Boolean(farmId),
    refetchInterval: 15000,
  });

  const createMutation = useMutation({
    mutationFn: () => apiCall(`/api/farms/${farmId}/marketplace`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'CREATE_LISTING',
        title,
        description,
        category,
        direction,
        quantity: quantity ? Number(quantity) : undefined,
        unit,
        price: price ? Number(price) : undefined,
        currency,
        location,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setQuantity('');
      setPrice('');
      setLocation('');
      void marketplaceQuery.refetch();
    },
  });

  const interestMutation = useMutation({
    mutationFn: () => apiCall(`/api/farms/${farmId}/marketplace`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'EXPRESS_INTEREST',
        listingId: selectedListingId,
        message: interestMessage,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: () => {
      setSelectedListingId('');
      setInterestMessage('');
      void marketplaceQuery.refetch();
    },
  });

  const closeMutation = useMutation({
    mutationFn: (listingId: string) => apiCall(`/api/farms/${farmId}/marketplace`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'CLOSE_LISTING',
        listingId,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
    onSuccess: () => {
      void marketplaceQuery.refetch();
    },
  });

  const listings = Array.isArray(marketplaceQuery.data?.listings) ? marketplaceQuery.data.listings : [];
  const stakeholders = Array.isArray(marketplaceQuery.data?.stakeholders) ? marketplaceQuery.data.stakeholders : [];
  const summary = marketplaceQuery.data?.summary;

  const filteredListings = useMemo(() => {
    if (filter === 'ALL') return listings;
    return listings.filter((listing: any) => listing.category === filter);
  }, [filter, listings]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Buy/sell produce, equipment, and agricultural services</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Active Listings</p>
          <p className="text-2xl font-black">{summary?.activeListings ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Total Listings</p>
          <p className="text-2xl font-black">{summary?.totalListings ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Open Interests</p>
          <p className="text-2xl font-black">{summary?.openInterests ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Stakeholders</p>
          <p className="text-2xl font-black">{summary?.stakeholders ?? 0}</p>
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Create Listing</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Listing title" className="h-10 rounded-md bg-accent/40 px-3 text-sm" />
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" className="h-10 rounded-md bg-accent/40 px-3 text-sm" />
        </div>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe produce, equipment, or service" className="w-full min-h-[90px] rounded-md bg-accent/40 px-3 py-2 text-sm" />
        <div className="grid gap-2 md:grid-cols-4">
          <select value={category} onChange={(event) => setCategory(event.target.value as 'PRODUCE' | 'EQUIPMENT' | 'SERVICE')} className="h-10 rounded-md bg-accent/40 px-3 text-sm">
            <option value="PRODUCE">PRODUCE</option>
            <option value="EQUIPMENT">EQUIPMENT</option>
            <option value="SERVICE">SERVICE</option>
          </select>
          <select value={direction} onChange={(event) => setDirection(event.target.value as 'SELL' | 'BUY' | 'RENT' | 'SERVICE')} className="h-10 rounded-md bg-accent/40 px-3 text-sm">
            <option value="SELL">SELL</option>
            <option value="BUY">BUY</option>
            <option value="RENT">RENT</option>
            <option value="SERVICE">SERVICE</option>
          </select>
          <input value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Quantity" className="h-10 rounded-md bg-accent/40 px-3 text-sm" />
          <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Unit" className="h-10 rounded-md bg-accent/40 px-3 text-sm" />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Price" className="h-10 rounded-md bg-accent/40 px-3 text-sm" />
          <input value={currency} onChange={(event) => setCurrency(event.target.value)} placeholder="Currency" className="h-10 rounded-md bg-accent/40 px-3 text-sm" />
        </div>
        <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || title.trim().length < 3} className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
          {createMutation.isPending ? 'Posting...' : 'Post Listing'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Browse Listings</h2>
        <div className="grid gap-2 md:grid-cols-4">
          {['ALL', 'PRODUCE', 'EQUIPMENT', 'SERVICE'].map((entry) => (
            <button
              key={entry}
              onClick={() => setFilter(entry as 'ALL' | 'PRODUCE' | 'EQUIPMENT' | 'SERVICE')}
              className={`h-9 rounded-md text-xs font-semibold ${filter === entry ? 'bg-primary text-primary-foreground' : 'bg-accent/30 text-muted-foreground'}`}
            >
              {entry}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {filteredListings.length ? filteredListings.map((listing: any) => (
            <div key={listing.listingId} className="rounded-md bg-accent/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold">{listing.title}</span>
                <span className="uppercase text-muted-foreground">{listing.status}</span>
              </div>
              <p className="text-sm">{listing.description || 'No description'}</p>
              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span>{listing.category}</span>
                <span>{listing.direction}</span>
                <span>{listing.quantity || 0} {listing.unit || ''}</span>
                <span>{listing.currency || 'USD'} {listing.price || 0}</span>
                <span>{listing.location || 'N/A'}</span>
                <span>{formatDate(listing.createdAt)}</span>
                <span>Interests: {listing.interestCount || 0}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedListingId(listing.listingId)}
                  disabled={listing.status !== 'ACTIVE'}
                  className="h-8 px-3 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold disabled:opacity-50"
                >
                  Express Interest
                </button>
                <button
                  onClick={() => closeMutation.mutate(listing.listingId)}
                  disabled={closeMutation.isPending || listing.status !== 'ACTIVE'}
                  className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                >
                  Close Listing
                </button>
              </div>
            </div>
          )) : <p className="text-xs text-muted-foreground">No listings available.</p>}
        </div>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Send Interest</h2>
        <input value={selectedListingId} onChange={(event) => setSelectedListingId(event.target.value)} placeholder="Listing ID" className="h-10 rounded-md bg-accent/40 px-3 text-sm" />
        <textarea value={interestMessage} onChange={(event) => setInterestMessage(event.target.value)} placeholder="Message to buyer/seller/supplier" className="w-full min-h-[80px] rounded-md bg-accent/40 px-3 py-2 text-sm" />
        <button onClick={() => interestMutation.mutate()} disabled={interestMutation.isPending || selectedListingId.trim().length < 8 || interestMessage.trim().length < 2} className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
          {interestMutation.isPending ? 'Sending...' : 'Submit Interest'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Stakeholder Directory</h2>
        <div className="space-y-2">
          {stakeholders.length ? stakeholders.map((stakeholder: any) => (
            <div key={`${stakeholder.type}-${stakeholder.stakeholderId}`} className="rounded-md bg-accent/20 px-3 py-2 text-xs flex items-center justify-between gap-3">
              <span className="font-semibold">{stakeholder.name}</span>
              <span className="text-muted-foreground uppercase">{stakeholder.type}</span>
            </div>
          )) : <p className="text-xs text-muted-foreground">No stakeholders available.</p>}
        </div>
      </section>
    </div>
  );
}
