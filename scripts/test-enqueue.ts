import { prisma } from '@/lib/db/client';
import { workflowQueue } from '@/lib/queue/client';

async function testEnqueue() {
  try {
    console.log('Testing Redis connection...');
    const isHealthy = await workflowQueue.client.ping();
    console.log('✅ Redis connection:', isHealthy);

    console.log('\nFetching ticket 7401...');
    const ticket = await prisma.ticket.findUnique({
      where: { id: 7401 },
      include: { project: true },
    });

    if (!ticket) {
      console.error('❌ Ticket 7401 not found');
      return;
    }

    console.log('✅ Ticket found:', ticket.title);

    console.log('\nFetching job 2373...');
    const job = await prisma.job.findUnique({
      where: { id: 2373 },
    });

    if (!job) {
      console.error('❌ Job 2373 not found');
      return;
    }

    console.log('✅ Job found:', job.command, job.status);

    console.log('\nEnqueuing job...');
    const queueJob = await workflowQueue.add('specify', {
      ticketId: ticket.id,
      projectId: ticket.project.id,
      command: 'specify',
      ticketTitle: ticket.title,
      ticketDescription: ticket.description || '',
      branch: ticket.branch,
      githubOwner: ticket.project.githubOwner,
      githubRepo: ticket.project.githubRepo,
      jobId: job.id,
    }, {
      jobId: job.id.toString(),
      priority: 3,
    });

    console.log('✅ Job enqueued with ID:', queueJob.id);

    // Check if worker picks it up
    console.log('\nWaiting for worker to process (10 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    const jobState = await queueJob.getState();
    console.log('Job state after 10s:', jobState);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
    await workflowQueue.close();
    process.exit(0);
  }
}

testEnqueue();
