import { prisma } from '../lib/db/client';

async function checkTicket(ticketKey: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { ticketKey },
    select: {
      id: true,
      ticketKey: true,
      stage: true,
      branch: true,
      previewUrl: true,
      jobs: {
        select: {
          id: true,
          command: true,
          status: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!ticket) {
    console.log(`Ticket ${ticketKey} not found`);
    return;
  }

  console.log('\n=== Ticket Details ===');
  console.log(`ID: ${ticket.id}`);
  console.log(`Key: ${ticket.ticketKey}`);
  console.log(`Stage: ${ticket.stage}`);
  console.log(`Branch: ${ticket.branch || 'null'}`);
  console.log(`Preview URL: ${ticket.previewUrl || 'null'}`);

  console.log('\n=== Jobs ===');
  if (ticket.jobs.length === 0) {
    console.log('No jobs found');
  } else {
    ticket.jobs.forEach((job, index) => {
      console.log(`\n${index + 1}. Job ID ${job.id}:`);
      console.log(`   Command: ${job.command}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Created: ${job.createdAt.toISOString()}`);
    });
  }

  // Check verify jobs specifically
  const verifyJobs = ticket.jobs.filter(j => j.command === 'verify');
  console.log('\n=== Verify Jobs ===');
  if (verifyJobs.length === 0) {
    console.log('No verify jobs found');
  } else {
    console.log(`Found ${verifyJobs.length} verify job(s)`);
    const latestVerify = verifyJobs[0];
    if (latestVerify) {
      console.log(`Latest verify job: ID ${latestVerify.id}, Status: ${latestVerify.status}`);
    }
  }

  // Check eligibility
  console.log('\n=== Eligibility Check ===');
  console.log(`Stage === VERIFY: ${ticket.stage === 'VERIFY'}`);
  console.log(`Has branch: ${!!ticket.branch}`);
  console.log(`Has jobs: ${ticket.jobs.length > 0}`);
  console.log(`Has verify jobs: ${verifyJobs.length > 0}`);
  if (verifyJobs.length > 0 && verifyJobs[0]) {
    console.log(`Latest verify job COMPLETED: ${verifyJobs[0].status === 'COMPLETED'}`);
  }
  console.log(`No preview URL: ${!ticket.previewUrl}`);

  await prisma.$disconnect();
}

const ticketKey = process.argv[2] || 'DEV-19';
checkTicket(ticketKey).catch(console.error);
