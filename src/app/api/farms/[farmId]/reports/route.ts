import { NextRequest } from 'next/server';
import { createErrorResponse } from '@/lib/errors';
import { requirePermission } from '@/lib/permissions';
import { reportingService } from '@/services/reporting/reporting-service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ farmId: string }> },
) {
  try {
    const format = request.nextUrl.searchParams.get('format') || 'json';
    const periodDays = Number(request.nextUrl.searchParams.get('periodDays') || 30);
    const { farmId } = await context.params;

    if (format === 'json') {
      requirePermission(request, 'report:read');
      const data = await reportingService.buildSummary(farmId, periodDays);
      return Response.json({ success: true, data });
    }

    requirePermission(request, 'report:export');
    const summary = await reportingService.buildSummary(farmId, periodDays);

    if (format === 'csv') {
      const csv = reportingService.toCsv(summary);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="farm-report-${farmId}.csv"`,
        },
      });
    }

    if (format === 'excel') {
      const tsv = reportingService.toExcelTsv(summary);
      return new Response(tsv, {
        headers: {
          'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
          'Content-Disposition': `attachment; filename="farm-report-${farmId}.xls"`,
        },
      });
    }

    if (format === 'pdf') {
      const pdf = reportingService.toPdf(summary);
      return new Response(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="farm-report-${farmId}.pdf"`,
        },
      });
    }

    return Response.json({
      success: false,
      error: {
        code: 'INVALID_FORMAT',
        message: 'Supported formats are json, csv, excel, pdf.',
      },
    }, { status: 400 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
