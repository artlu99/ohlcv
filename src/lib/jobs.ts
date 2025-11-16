import { sort } from "radash";

export enum JobStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum JobType {
  FULL_UPDATE = "full",
  PARTIAL_UPDATE = "partial",
  LIVE_ONLY = "live",
}

const jobs = new Map<string, { status: JobStatus; timestamp: number }>();

export const allJobs = () =>
  sort(
    Array.from(jobs.entries()),
    ([_, job]) => job.timestamp,
    true // descending
  );

const jobKey = (ticker: string, type: JobType) => `${ticker}:${type}`;

export const splitKey = (key: string) => {
  const [ticker, type] = key.split(":");
  const jobType =
    type === JobType.FULL_UPDATE
      ? JobType.FULL_UPDATE
      : type === JobType.PARTIAL_UPDATE
      ? JobType.PARTIAL_UPDATE
      : JobType.LIVE_ONLY;
  return { ticker, type: jobType };
};

export const addJob = (ticker: string, type: JobType) => {
  jobs.set(jobKey(ticker, type), {
    status: JobStatus.PENDING,
    timestamp: Date.now(),
  });
};

export const setJobStatus = (
  ticker: string,
  type: JobType,
  status: JobStatus
) => {
  jobs.set(jobKey(ticker, type), { status, timestamp: Date.now() });
};

export const jobsStatus = () => {
  const jobsArray = Array.from(jobs.values());
  return {
    total: jobs.size,
    pending: jobsArray.filter((job) => job.status === JobStatus.PENDING).length,
    running: jobsArray.filter((job) => job.status === JobStatus.RUNNING).length,
    completed: jobsArray.filter((job) => job.status === JobStatus.COMPLETED)
      .length,
    failed: jobsArray.filter((job) => job.status === JobStatus.FAILED).length,
  };
};
