/**
 * Read-only Prisma aggregation for the calibration drift dashboard.
 *
 * Exposes `getCalibrationDashboard(projectId)` returning the windowed 30 most
 * recent calibration rows aggregated into the dashboard DTO. Adoption counter
 * derives the feature-availability moment from MIN(TicketAnalysis.createdAt)
 * for the project.
 */
import { prisma } from '@/lib/db/client';
import { composeDashboardData } from './serialize';
import type { AdoptionData, CalibrationDashboardData } from './types';

const WINDOW_SIZE = 30;

export async function computeAdoption(projectId: number): Promise<AdoptionData> {
  const featureAvailable = await prisma.ticketAnalysis.aggregate({
    _min: { createdAt: true },
    where: { projectId },
  });
  const featureAvailableAt = featureAvailable._min.createdAt;

  if (!featureAvailableAt) {
    return { analyzed: 0, sinceFeatureAvailable: 0, ratio: null };
  }

  const [analyzedRows, sinceFeatureAvailable] = await Promise.all([
    prisma.ticketAnalysis.findMany({
      where: { projectId },
      distinct: ['ticketId'],
      select: { ticketId: true },
    }),
    prisma.ticket.count({
      where: {
        projectId,
        createdAt: { gte: featureAvailableAt },
      },
    }),
  ]);

  const analyzed = analyzedRows.length;
  const ratio =
    sinceFeatureAvailable === 0 ? null : analyzed / sinceFeatureAvailable;

  return { analyzed, sinceFeatureAvailable, ratio };
}

export async function getCalibrationDashboard(
  projectId: number
): Promise<CalibrationDashboardData> {
  const [rows, totalRows, adoption] = await Promise.all([
    prisma.analysisCalibration.findMany({
      where: { projectId },
      orderBy: { shippedAt: 'desc' },
      take: WINDOW_SIZE,
    }),
    prisma.analysisCalibration.count({ where: { projectId } }),
    computeAdoption(projectId),
  ]);

  return composeDashboardData({
    rows,
    totalRows,
    adoption,
    generatedAt: new Date(),
  });
}
