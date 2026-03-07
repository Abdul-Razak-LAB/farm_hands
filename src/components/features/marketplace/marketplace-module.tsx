'use client';

import { useAuth } from '@/components/layout/auth-provider';
import type { MarketplaceListing, MarketplacePayload, MarketplaceStakeholder } from '@/lib/api/contracts';
import { getFarmData, postFarmData } from '@/lib/api/farm-client';
import { formatDate } from '@/lib/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

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
    queryFn: () => getFarmData<MarketplacePayload>(farmId!, '/marketplace'),
    enabled: Boolean(farmId),
    refetchInterval: 15000,
  });

  const createMutation = useMutation({
    mutationFn: () => postFarmData(farmId!, '/marketplace', {
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
    mutationFn: () => postFarmData(farmId!, '/marketplace', {
        action: 'EXPRESS_INTEREST',
        listingId: selectedListingId,
        message: interestMessage,
        idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      setSelectedListingId('');
      setInterestMessage('');
      void marketplaceQuery.refetch();
    },
  });

  const closeMutation = useMutation({
    mutationFn: (listingId: string) => postFarmData(farmId!, '/marketplace', {
        action: 'CLOSE_LISTING',
        listingId,
        idempotencyKey: crypto.randomUUID(),
    }),
    onSuccess: () => {
      void marketplaceQuery.refetch();
    },
  });

  const listings: MarketplaceListing[] = Array.isArray(marketplaceQuery.data?.listings) ? marketplaceQuery.data.listings : [];
  const stakeholders: MarketplaceStakeholder[] = Array.isArray(marketplaceQuery.data?.stakeholders) ? marketplaceQuery.data.stakeholders : [];
  const summary = marketplaceQuery.data?.summary;

  const filteredListings = useMemo(() => {
    if (filter === 'ALL') return listings;
    return listings.filter((listing) => listing.category === filter);
  }, [filter, listings]);

  const fieldClass = 'h-10 rounded-md border border-input px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary';
  const selectClass = 'h-10 rounded-md border border-input px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary';
  const textareaClass = 'w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary';
  const primaryButtonClass = 'h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold shadow-sm transition-all hover:brightness-105 disabled:opacity-50';

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6 pb-24 md:pb-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-xs text-muted-foreground uppercase font-semibold">Buy/sell produce, equipment, and agricultural services</p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
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
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Listing title" className={fieldClass} />
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" className={fieldClass} />
        </div>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe produce, equipment, or service" className={`${textareaClass} min-h-[90px]`} />
        <div className="grid gap-2 md:grid-cols-4">
          <select value={category} onChange={(event) => setCategory(event.target.value as 'PRODUCE' | 'EQUIPMENT' | 'SERVICE')} className={selectClass}>
            <option value="PRODUCE">PRODUCE</option>
            <option value="EQUIPMENT">EQUIPMENT</option>
            <option value="SERVICE">SERVICE</option>
          </select>
          <select value={direction} onChange={(event) => setDirection(event.target.value as 'SELL' | 'BUY' | 'RENT' | 'SERVICE')} className={selectClass}>
            <option value="SELL">SELL</option>
            <option value="BUY">BUY</option>
            <option value="RENT">RENT</option>
            <option value="SERVICE">SERVICE</option>
          </select>
          <input value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Quantity" className={fieldClass} />
          <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Unit" className={fieldClass} />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <input value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Price" className={fieldClass} />
          <input value={currency} onChange={(event) => setCurrency(event.target.value)} placeholder="Currency" className={fieldClass} />
        </div>
        <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || title.trim().length < 3} className={primaryButtonClass}>
          {createMutation.isPending ? 'Posting...' : 'Post Listing'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Browse Listings</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {['ALL', 'PRODUCE', 'EQUIPMENT', 'SERVICE'].map((entry) => (
            <button
              key={entry}
              onClick={() => setFilter(entry as 'ALL' | 'PRODUCE' | 'EQUIPMENT' | 'SERVICE')}
              className={`h-9 rounded-md border px-2 text-xs font-semibold transition-colors ${filter === entry ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground hover:text-foreground'}`}
            >
              {entry}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {filteredListings.length ? filteredListings.map((listing) => (
            <div key={listing.listingId} className="rounded-md border bg-background/60 p-3 space-y-2 shadow-sm">
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
              <div className="flex flex-wrap gap-2">
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
        <input value={selectedListingId} onChange={(event) => setSelectedListingId(event.target.value)} placeholder="Listing ID" className={fieldClass} />
        <textarea value={interestMessage} onChange={(event) => setInterestMessage(event.target.value)} placeholder="Message to buyer/seller/supplier" className={`${textareaClass} min-h-[80px]`} />
        <button onClick={() => interestMutation.mutate()} disabled={interestMutation.isPending || selectedListingId.trim().length < 8 || interestMessage.trim().length < 2} className={primaryButtonClass}>
          {interestMutation.isPending ? 'Sending...' : 'Submit Interest'}
        </button>
      </section>

      <section className="p-4 border rounded-xl bg-card space-y-3">
        <h2 className="text-sm font-bold uppercase">Stakeholder Directory</h2>
        <div className="space-y-2">
          {stakeholders.length ? stakeholders.map((stakeholder) => (
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

