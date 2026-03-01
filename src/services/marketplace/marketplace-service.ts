import { randomUUID } from 'node:crypto';
import { AppError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

export type ListingCategory = 'PRODUCE' | 'EQUIPMENT' | 'SERVICE';
export type ListingDirection = 'SELL' | 'BUY' | 'RENT' | 'SERVICE';

type CreateListingInput = {
  farmId: string;
  userId: string;
  idempotencyKey: string;
  title: string;
  description?: string;
  category: ListingCategory;
  direction: ListingDirection;
  quantity?: number;
  unit?: string;
  price?: number;
  currency?: string;
  location?: string;
  availableFrom?: string;
  availableTo?: string;
};

type ExpressInterestInput = {
  farmId: string;
  userId: string;
  idempotencyKey: string;
  listingId: string;
  message: string;
  quantity?: number;
  offeredPrice?: number;
};

export class MarketplaceService {
  private async ensureIdempotency(farmId: string, idempotencyKey: string) {
    return prisma.event.findUnique({
      where: {
        farmId_idempotencyKey: {
          farmId,
          idempotencyKey,
        },
      },
    });
  }

  async getMarketplace(farmId: string) {
    const [listingEvents, closeEvents, interestEvents, vendors, members] = await Promise.all([
      prisma.event.findMany({
        where: { farmId, type: 'MARKETPLACE_LISTING_CREATED' },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      prisma.event.findMany({
        where: { farmId, type: 'MARKETPLACE_LISTING_CLOSED' },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      prisma.event.findMany({
        where: { farmId, type: 'MARKETPLACE_INTEREST_SUBMITTED' },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.vendor.findMany({
        where: { farmId },
        orderBy: { name: 'asc' },
        take: 100,
      }),
      prisma.farmMembership.findMany({
        where: { farmId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { id: 'asc' },
      }),
    ]);

    const closedListingIds = new Set(
      closeEvents
        .map((entry) => {
          const payload = entry.payload as Record<string, unknown>;
          return typeof payload?.listingId === 'string' ? payload.listingId : null;
        })
        .filter((entry): entry is string => Boolean(entry)),
    );

    const listings = listingEvents
      .map((entry) => {
        const payload = entry.payload as Record<string, unknown>;
        const listingId = typeof payload?.listingId === 'string' ? payload.listingId : entry.id;

        return {
          listingId,
          createdAt: entry.createdAt,
          createdBy: entry.userId,
          title: String(payload?.title ?? 'Untitled listing'),
          description: typeof payload?.description === 'string' ? payload.description : '',
          category: String(payload?.category ?? 'PRODUCE'),
          direction: String(payload?.direction ?? 'SELL'),
          quantity: Number(payload?.quantity ?? 0),
          unit: String(payload?.unit ?? ''),
          price: Number(payload?.price ?? 0),
          currency: String(payload?.currency ?? 'USD'),
          location: String(payload?.location ?? ''),
          availableFrom: typeof payload?.availableFrom === 'string' ? payload.availableFrom : null,
          availableTo: typeof payload?.availableTo === 'string' ? payload.availableTo : null,
          status: closedListingIds.has(listingId) ? 'CLOSED' : 'ACTIVE',
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const interestsByListing = interestEvents.reduce<Record<string, number>>((acc, event) => {
      const payload = event.payload as Record<string, unknown>;
      const listingId = typeof payload?.listingId === 'string' ? payload.listingId : null;
      if (!listingId) return acc;
      acc[listingId] = (acc[listingId] ?? 0) + 1;
      return acc;
    }, {});

    const listingsWithInterest = listings.map((listing) => ({
      ...listing,
      interestCount: interestsByListing[listing.listingId] ?? 0,
    }));

    const stakeholders = [
      ...vendors.map((vendor) => ({
        stakeholderId: vendor.id,
        type: 'SUPPLIER',
        name: vendor.name,
        contact: vendor.contactInfo,
      })),
      ...members.map((membership) => ({
        stakeholderId: membership.userId,
        type: membership.role,
        name: membership.user?.name || membership.user?.email || membership.userId,
        contact: { email: membership.user?.email || null },
      })),
    ];

    return {
      summary: {
        activeListings: listingsWithInterest.filter((listing) => listing.status === 'ACTIVE').length,
        totalListings: listingsWithInterest.length,
        openInterests: interestEvents.length,
        stakeholders: stakeholders.length,
      },
      listings: listingsWithInterest,
      interests: interestEvents.map((event) => ({
        id: event.id,
        userId: event.userId,
        createdAt: event.createdAt,
        payload: event.payload,
      })),
      stakeholders,
      generatedAt: new Date().toISOString(),
    };
  }

  async createListing(input: CreateListingInput) {
    const existing = await this.ensureIdempotency(input.farmId, input.idempotencyKey);
    if (existing) {
      return { reused: true, eventId: existing.id };
    }

    const listingId = randomUUID();

    const event = await prisma.event.create({
      data: {
        farmId: input.farmId,
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        type: 'MARKETPLACE_LISTING_CREATED',
        payload: {
          listingId,
          title: input.title,
          description: input.description || '',
          category: input.category,
          direction: input.direction,
          quantity: input.quantity ?? 0,
          unit: input.unit || '',
          price: input.price ?? 0,
          currency: input.currency || 'USD',
          location: input.location || '',
          availableFrom: input.availableFrom || null,
          availableTo: input.availableTo || null,
        },
      },
    });

    return { listingId, eventId: event.id, status: 'CREATED' };
  }

  async expressInterest(input: ExpressInterestInput) {
    const existing = await this.ensureIdempotency(input.farmId, input.idempotencyKey);
    if (existing) {
      return { reused: true, eventId: existing.id };
    }

    const listing = await prisma.event.findFirst({
      where: {
        farmId: input.farmId,
        type: 'MARKETPLACE_LISTING_CREATED',
        payload: {
          path: ['listingId'],
          equals: input.listingId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!listing) {
      throw new AppError('LISTING_NOT_FOUND', 'Listing not found', 404);
    }

    const event = await prisma.event.create({
      data: {
        farmId: input.farmId,
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        type: 'MARKETPLACE_INTEREST_SUBMITTED',
        payload: {
          listingId: input.listingId,
          message: input.message,
          quantity: input.quantity ?? 0,
          offeredPrice: input.offeredPrice ?? 0,
        },
      },
    });

    return { interestId: event.id, status: 'RECORDED' };
  }

  async closeListing(input: { farmId: string; userId: string; idempotencyKey: string; listingId: string }) {
    const existing = await this.ensureIdempotency(input.farmId, input.idempotencyKey);
    if (existing) {
      return { reused: true, eventId: existing.id };
    }

    const createdListing = await prisma.event.findFirst({
      where: {
        farmId: input.farmId,
        type: 'MARKETPLACE_LISTING_CREATED',
        payload: {
          path: ['listingId'],
          equals: input.listingId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!createdListing) {
      throw new AppError('LISTING_NOT_FOUND', 'Listing not found', 404);
    }

    const event = await prisma.event.create({
      data: {
        farmId: input.farmId,
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        type: 'MARKETPLACE_LISTING_CLOSED',
        payload: {
          listingId: input.listingId,
        },
      },
    });

    return { eventId: event.id, status: 'CLOSED' };
  }
}

export const marketplaceService = new MarketplaceService();
