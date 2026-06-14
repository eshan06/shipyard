-- LogChunk: enforce monotonic, gap-free seq per deployment. Replaces the plain
-- (deploymentId, seq) index with a unique constraint so a seq-allocation
-- regression fails loudly instead of writing a silent duplicate.
DROP INDEX "LogChunk_deploymentId_seq_idx";
CREATE UNIQUE INDEX "LogChunk_deploymentId_seq_key" ON "LogChunk"("deploymentId", "seq");

-- PullRequest: record the close/merge timestamp so the destroy TTL can anchor
-- on it instead of `updatedAt` (which any later row mutation would bump).
ALTER TABLE "PullRequest" ADD COLUMN "closedAt" TIMESTAMP(3);
