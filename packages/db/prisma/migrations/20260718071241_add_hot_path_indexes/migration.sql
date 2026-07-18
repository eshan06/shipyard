-- CreateIndex
CREATE INDEX "CostRecord_periodStart_idx" ON "CostRecord"("periodStart");

-- CreateIndex
CREATE INDEX "Deployment_previewId_queuedAt_idx" ON "Deployment"("previewId", "queuedAt");

-- CreateIndex
CREATE INDEX "Deployment_queuedAt_idx" ON "Deployment"("queuedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Preview_projectId_createdAt_idx" ON "Preview"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "PullRequest_projectId_createdAt_idx" ON "PullRequest"("projectId", "createdAt");
