import { Worker, Job } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.config';
import { FEE_BILLING_QUEUE_NAME, FeeBillingJobData } from '../queues/feeBilling.queue';
import { generateMonthlyFeeBillsService, generateTransportBillsService, generateHostelBillsService } from '../Service/fee.service';

function getMonthRange(start: string, end: string): string[] {
  const months: string[] = [];
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  let curY = sy, curM = sm;
  while (curY < ey || (curY === ey && curM <= em)) {
    months.push(`${curY}-${String(curM).padStart(2, '0')}`);
    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }
  return months.length ? months : [start];
}

export const feeBillingWorker = new Worker<FeeBillingJobData>(
  FEE_BILLING_QUEUE_NAME,
  async (job: Job<FeeBillingJobData>) => {
    const {
      school_id,
      created_by,
      academic_year_id,
      billing_month,
      from_month,
      to_month,
      custom_due_date,
      class_id,
      section_id,
      fee_type = 'academic',
    } = job.data;

    console.log(`[Worker] Started fee billing job ${job.id} for school ${school_id}, fee_type: ${fee_type}`);
    await job.updateProgress(5);

    let result;
    if (fee_type === 'academic') {
      result = await generateMonthlyFeeBillsService(
        school_id,
        created_by,
        academic_year_id,
        to_month || billing_month,
        custom_due_date,
        from_month,
        to_month,
        class_id,
        section_id,
        async (processed: number, total: number) => {
          const percent = total > 0 ? Math.min(95, Math.max(10, Math.round((processed / total) * 90))) : 90;
          await job.updateProgress(percent);
        }
      );
    } else if (fee_type === 'transport') {
      result = await generateTransportBillsService(
        school_id,
        created_by,
        academic_year_id,
        to_month || billing_month,
        10,
        [],
        custom_due_date,
        from_month,
        to_month
      );
    } else if (fee_type === 'hostel') {
      result = await generateHostelBillsService(
        school_id,
        created_by,
        academic_year_id,
        to_month || billing_month,
        10,
        [],
        custom_due_date,
        from_month,
        to_month
      );
    }

    await job.updateProgress(100);
    console.log(`[Worker] Completed fee billing job ${job.id} — created: ${result?.created ?? 0}, skipped: ${result?.skipped ?? 0}`);
    return result;
  },
  {
    connection: redisConnectionOptions,
    concurrency: 2,
  }
);

feeBillingWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

feeBillingWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});
