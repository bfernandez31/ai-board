/**
 * Pull a project snapshot from prod into the local DB.
 *
 * Usage:
 *   PROD_DATABASE_URL=postgres://... bunx tsx scripts/pull-prod-project.ts AIB [--yes]
 *
 * Env:
 *   PROD_DATABASE_URL  Source (read-only).
 *   DATABASE_URL       Target (wiped for the given project key).
 *
 * Scope: Project + members + tickets + jobs + comments + notifications +
 * comparison records (participants, metric snapshots, compliance assessments,
 * decision points) + health scans + health score, plus referenced Users.
 *
 * Skipped: Account, Session, VerificationToken, PersonalAccessToken,
 * PushSubscription, UserCredential, Subscription, StripeEvent, ProjectSetupJob.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

function jsonInNullable(
  v: Prisma.JsonValue | null
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue);
}

function jsonInRequired(v: Prisma.JsonValue): Prisma.InputJsonValue {
  return v as Prisma.InputJsonValue;
}

const LOCAL_HOST_PATTERNS = [/@localhost[:/]/i, /@127\.0\.0\.1[:/]/, /@host\.docker\.internal[:/]/i];

function parseArgs() {
  const args = process.argv.slice(2);
  const autoConfirm = args.includes("--yes") || args.includes("-y");
  const projectKey = args.find((a) => !a.startsWith("-"));
  if (!projectKey) {
    console.error("Usage: bunx tsx scripts/pull-prod-project.ts <PROJECT_KEY> [--yes]");
    process.exit(1);
  }
  return { projectKey, autoConfirm };
}

function isLocalHost(url: string) {
  return LOCAL_HOST_PATTERNS.some((p) => p.test(url));
}

async function confirm(question: string) {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return answer.trim().toLowerCase() === "y";
}

async function main() {
  const { projectKey, autoConfirm } = parseArgs();
  const prodUrl = process.env.PROD_DATABASE_URL;
  const localUrl = process.env.DATABASE_URL;

  if (!prodUrl) throw new Error("PROD_DATABASE_URL is not set.");
  if (!localUrl) throw new Error("DATABASE_URL is not set.");
  if (prodUrl === localUrl) {
    throw new Error("PROD_DATABASE_URL === DATABASE_URL. Refusing to wipe prod.");
  }
  if (!isLocalHost(localUrl)) {
    throw new Error(
      `DATABASE_URL does not point to a local host (localhost / 127.0.0.1 / host.docker.internal). Refusing.`
    );
  }

  const prod = new PrismaClient({ datasourceUrl: prodUrl });
  const local = new PrismaClient({ datasourceUrl: localUrl });

  try {
    console.log(`Fetching project "${projectKey}" from prod…`);
    const project = await prod.project.findUnique({
      where: { key: projectKey },
      include: {
        members: true,
        tickets: {
          include: {
            jobs: true,
            comments: true,
            notifications: true,
          },
        },
        comparisonRecords: {
          include: {
            participants: {
              include: {
                metricSnapshot: true,
                complianceAssessments: true,
              },
            },
            decisionPoints: true,
          },
        },
        healthScans: true,
        healthScore: true,
      },
    });

    if (!project) {
      throw new Error(`Project "${projectKey}" not found in prod.`);
    }

    const userIds = new Set<string>();
    userIds.add(project.userId);
    for (const m of project.members) userIds.add(m.userId);
    for (const t of project.tickets) {
      for (const c of t.comments) userIds.add(c.userId);
      for (const n of t.notifications) {
        userIds.add(n.recipientId);
        userIds.add(n.actorId);
      }
    }

    const users = await prod.user.findMany({
      where: { id: { in: Array.from(userIds) } },
    });

    const ticketCount = project.tickets.length;
    const jobCount = project.tickets.reduce((s, t) => s + t.jobs.length, 0);
    const commentCount = project.tickets.reduce((s, t) => s + t.comments.length, 0);
    const notifCount = project.tickets.reduce((s, t) => s + t.notifications.length, 0);
    const comparisonCount = project.comparisonRecords.length;
    const participantCount = project.comparisonRecords.reduce(
      (s, r) => s + r.participants.length,
      0
    );
    const decisionPointCount = project.comparisonRecords.reduce(
      (s, r) => s + r.decisionPoints.length,
      0
    );
    const metricSnapshotCount = project.comparisonRecords.reduce(
      (s, r) => s + r.participants.filter((p) => p.metricSnapshot).length,
      0
    );
    const complianceCount = project.comparisonRecords.reduce(
      (s, r) =>
        s +
        r.participants.reduce((ss, p) => ss + p.complianceAssessments.length, 0),
      0
    );
    const healthScanCount = project.healthScans.length;

    console.log(`\n=== ${project.name} (${project.key}) ===`);
    console.log(`  Users:                 ${users.length}`);
    console.log(`  Members:               ${project.members.length}`);
    console.log(`  Tickets:               ${ticketCount}`);
    console.log(`  Jobs:                  ${jobCount}`);
    console.log(`  Comments:              ${commentCount}`);
    console.log(`  Notifications:         ${notifCount}`);
    console.log(`  ComparisonRecords:     ${comparisonCount}`);
    console.log(`  ComparisonParticipants:${participantCount}`);
    console.log(`  MetricSnapshots:       ${metricSnapshotCount}`);
    console.log(`  ComplianceAssessments: ${complianceCount}`);
    console.log(`  DecisionPoints:        ${decisionPointCount}`);
    console.log(`  HealthScans:           ${healthScanCount}`);
    console.log(`  HealthScore:           ${project.healthScore ? "yes" : "no"}`);
    console.log(`\nTarget DB: ${localUrl.replace(/:[^@]+@/, ":***@")}`);
    console.log(`This will DELETE the local project "${projectKey}" and all its data, then re-insert from prod.\n`);

    if (!autoConfirm) {
      const ok = await confirm("Proceed?");
      if (!ok) {
        console.log("Aborted.");
        return;
      }
    }

    console.log("\nDeleting local project (cascades to children)…");
    await local.project.deleteMany({ where: { key: projectKey } });

    const prodEmails = users.map((u) => u.email);
    const prodUserIds = new Set(users.map((u) => u.id));
    const conflicting = await local.user.findMany({
      where: { email: { in: prodEmails } },
    });
    const toDelete = conflicting.filter((c) => !prodUserIds.has(c.id));

    if (toDelete.length > 0) {
      const deletedIds = toDelete.map((u) => u.id);
      const [otherProjects, otherMemberships] = await Promise.all([
        local.project.count({
          where: { userId: { in: deletedIds }, NOT: { key: projectKey } },
        }),
        local.projectMember.count({
          where: {
            userId: { in: deletedIds },
            project: { NOT: { key: projectKey } },
          },
        }),
      ]);

      console.log(
        `\n⚠  ${toDelete.length} local user(s) have the same email as prod users but different ids:`
      );
      for (const u of toDelete) console.log(`   - ${u.email} (local id: ${u.id})`);
      if (otherProjects > 0 || otherMemberships > 0) {
        console.log(
          `   Cascade delete will also remove ${otherProjects} other project(s) and ${otherMemberships} membership(s) owned by these users.`
        );
        if (!autoConfirm) {
          const ok = await confirm("Proceed with user deletion?");
          if (!ok) {
            console.log("Aborted.");
            return;
          }
        }
      }

      console.log(`Deleting ${toDelete.length} conflicting local user(s)…`);
      await local.user.deleteMany({ where: { id: { in: deletedIds } } });
    }

    console.log(`Upserting ${users.length} user(s)…`);
    for (const u of users) {
      const { stripeCustomerId: _ignoreStripe, ...rest } = u;
      await local.user.upsert({
        where: { id: u.id },
        create: { ...rest, stripeCustomerId: null },
        update: { ...rest, stripeCustomerId: null },
      });
    }

    const {
      members,
      tickets,
      comparisonRecords,
      healthScans,
      healthScore,
      ...projectData
    } = project;

    const allJobs = tickets.flatMap((t) => t.jobs);
    const allComments = tickets.flatMap((t) => t.comments);
    const allNotifs = tickets.flatMap((t) => t.notifications);
    const allParticipants = comparisonRecords.flatMap((cr) => cr.participants);
    const allSnapshots = allParticipants
      .map((p) => p.metricSnapshot)
      .filter((s): s is NonNullable<typeof s> => s !== null);
    const allCompliance = allParticipants.flatMap((p) => p.complianceAssessments);
    const allDecisionPoints = comparisonRecords.flatMap((cr) => cr.decisionPoints);

    console.log("Clearing colliding IDs on target tables…");
    await local.project.deleteMany({ where: { id: projectData.id } });
    if (members.length)
      await local.projectMember.deleteMany({ where: { id: { in: members.map((m) => m.id) } } });
    if (tickets.length)
      await local.ticket.deleteMany({ where: { id: { in: tickets.map((t) => t.id) } } });
    if (allJobs.length)
      await local.job.deleteMany({ where: { id: { in: allJobs.map((j) => j.id) } } });
    if (allComments.length)
      await local.comment.deleteMany({ where: { id: { in: allComments.map((c) => c.id) } } });
    if (allNotifs.length)
      await local.notification.deleteMany({ where: { id: { in: allNotifs.map((n) => n.id) } } });
    if (comparisonRecords.length)
      await local.comparisonRecord.deleteMany({
        where: { id: { in: comparisonRecords.map((cr) => cr.id) } },
      });
    if (allParticipants.length)
      await local.comparisonParticipant.deleteMany({
        where: { id: { in: allParticipants.map((p) => p.id) } },
      });
    if (allSnapshots.length)
      await local.ticketMetricSnapshot.deleteMany({
        where: { id: { in: allSnapshots.map((s) => s.id) } },
      });
    if (allCompliance.length)
      await local.complianceAssessment.deleteMany({
        where: { id: { in: allCompliance.map((c) => c.id) } },
      });
    if (allDecisionPoints.length)
      await local.decisionPointEvaluation.deleteMany({
        where: { id: { in: allDecisionPoints.map((d) => d.id) } },
      });
    if (healthScans.length)
      await local.healthScan.deleteMany({ where: { id: { in: healthScans.map((h) => h.id) } } });
    if (healthScore)
      await local.healthScore.deleteMany({ where: { id: healthScore.id } });

    console.log("Inserting project…");
    await local.project.create({
      data: { ...projectData, config: jsonInNullable(projectData.config) },
    });

    if (members.length) {
      console.log(`Inserting ${members.length} member(s)…`);
      await local.projectMember.createMany({ data: members });
    }

    console.log(`Inserting ${tickets.length} ticket(s)…`);
    for (const t of tickets) {
      const { jobs: _j, comments: _c, notifications: _n, ...tdata } = t;
      await local.ticket.create({
        data: { ...tdata, attachments: jsonInNullable(tdata.attachments) },
      });
    }

    if (allJobs.length) {
      console.log(`Inserting ${allJobs.length} job(s)…`);
      await local.job.createMany({ data: allJobs });
    }

    if (allComments.length) {
      console.log(`Inserting ${allComments.length} comment(s)…`);
      await local.comment.createMany({ data: allComments });
    }

    if (allNotifs.length) {
      console.log(`Inserting ${allNotifs.length} notification(s)…`);
      await local.notification.createMany({ data: allNotifs });
    }

    if (comparisonRecords.length) {
      console.log(`Inserting ${comparisonRecords.length} comparison record(s)…`);
      for (const cr of comparisonRecords) {
        const { participants, decisionPoints, ...crData } = cr;
        await local.comparisonRecord.create({
          data: { ...crData, keyDifferentiators: jsonInRequired(crData.keyDifferentiators) },
        });

        for (const p of participants) {
          const { metricSnapshot, complianceAssessments, ...pData } = p;
          await local.comparisonParticipant.create({ data: pData });
          if (metricSnapshot) {
            await local.ticketMetricSnapshot.create({
              data: {
                ...metricSnapshot,
                changedFiles: jsonInRequired(metricSnapshot.changedFiles),
                bestValueFlags: jsonInRequired(metricSnapshot.bestValueFlags),
              },
            });
          }
          if (complianceAssessments.length) {
            await local.complianceAssessment.createMany({ data: complianceAssessments });
          }
        }

        if (decisionPoints.length) {
          await local.decisionPointEvaluation.createMany({
            data: decisionPoints.map((dp) => ({
              ...dp,
              participantApproaches: jsonInRequired(dp.participantApproaches),
            })),
          });
        }
      }
    }

    if (healthScans.length) {
      console.log(`Inserting ${healthScans.length} health scan(s)…`);
      await local.healthScan.createMany({ data: healthScans });
    }

    if (healthScore) {
      console.log("Inserting health score…");
      await local.healthScore.create({ data: healthScore });
    }

    console.log("Resetting autoincrement sequences…");
    const tables = [
      "Project",
      "ProjectMember",
      "Ticket",
      "Job",
      "Comment",
      "Notification",
      "ComparisonRecord",
      "ComparisonParticipant",
      "TicketMetricSnapshot",
      "DecisionPointEvaluation",
      "ComplianceAssessment",
      "HealthScan",
      "HealthScore",
    ];
    for (const table of tables) {
      await local.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`
      );
    }

    console.log(`\n✓ Project "${projectKey}" imported into local DB.`);
  } finally {
    await prod.$disconnect();
    await local.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
