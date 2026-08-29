import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.config';

export interface FeeBillingJobData {
  school_id: number;
  created_by: number;
  academic_year_id: number;
  fee_type?: 'academic' | 'transport' | 'hostel';
  billing_month: string;
  from_month?: string;
  to_month?: string;
  custom_due_date?: string;
  class_id?: number | null;
  section_id?: number | null;
}

export const FEE_BILLING_QUEUE_NAME = 'fee-billing-queue';

export const feeBillingQueue = new Queue<FeeBillingJobData>(FEE_BILLING_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    removeOnComplete: {
      age: 3600,  // Keep completed jobs for 1 hour
      count: 100, // Maximum 100 completed jobs in Redis
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
      count: 50,
    },
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const addBillingJob = async (data: FeeBillingJobData) => {
  const jobName = `bill-${data.school_id}-${data.academic_year_id}-${data.from_month || data.billing_month}`;
  const job = await feeBillingQueue.add(jobName, data);
  return {
    jobId: job.id,
    name: job.name,
    status: 'queued',
  };
};

export const getBillingJobStatus = async (jobId: string) => {
  const job = await feeBillingQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = typeof job.progress === 'number' ? job.progress : 0;

  return {
    id: job.id,
    name: job.name,
    state,
    progress,
    result: job.returnvalue || null,
    failedReason: job.failedReason || null,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
};
