import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createErrorResponse } from '@/lib/errors';
import { getRequestUserId, requirePermission } from '@/lib/permissions';
import { marketplaceService } from '@/services/marketplace/marketplace-service';

const createListingSchema = z.object({
  action: z.literal('CREATE_LISTING'),
  title: z.string().min(3),
  description: z.string().optional(),
  category: z.enum(['PRODUCE', 'EQUIPMENT', 'SERVICE']),
  direction: z.enum(['SELL', 'BUY', 'RENT', 'SERVICE']),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  location: z.string().optional(),
  availableFrom: z.string().optional(),
  availableTo: z.string().optional(),
  idempotencyKey: z.string().min(8),
});

const expressInterestSchema = z.object({
  action: z.literal('EXPRESS_INTEREST'),
  listingId: z.string().min(8),
  message: z.string().min(2),
  quantity: z.number().nonnegative().optional(),
  offeredPrice: z.number().nonnegative().optional(),
  idempotencyKey: z.string().min(8),
});

const closeListingSchema = z.object({
  action: z.literal('CLOSE_LISTING'),
  listingId: z.string().min(8),
  idempotencyKey: z.string().min(8),
});

const requestSchema = z.discriminatedUnion('action', [
  createListingSchema,
  expressInterestSchema,
  closeListingSchema,
]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    requirePermission(request, 'marketplace:read');
    const { farmId } = await context.params;
    const data = await marketplaceService.getMarketplace(farmId);
    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    requirePermission(request, 'marketplace:write');
    const { farmId } = await context.params;
    const userId = getRequestUserId(request);
    const input = requestSchema.parse(await request.json());

    if (input.action === 'CREATE_LISTING') {
      const data = await marketplaceService.createListing({
        farmId,
        userId,
        idempotencyKey: input.idempotencyKey,
        title: input.title,
        description: input.description,
        category: input.category,
        direction: input.direction,
        quantity: input.quantity,
        unit: input.unit,
        price: input.price,
        currency: input.currency,
        location: input.location,
        availableFrom: input.availableFrom,
        availableTo: input.availableTo,
      });

      return Response.json({ success: true, data });
    }

    if (input.action === 'EXPRESS_INTEREST') {
      const data = await marketplaceService.expressInterest({
        farmId,
        userId,
        idempotencyKey: input.idempotencyKey,
        listingId: input.listingId,
        message: input.message,
        quantity: input.quantity,
        offeredPrice: input.offeredPrice,
      });

      return Response.json({ success: true, data });
    }

    const data = await marketplaceService.closeListing({
      farmId,
      userId,
      idempotencyKey: input.idempotencyKey,
      listingId: input.listingId,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
