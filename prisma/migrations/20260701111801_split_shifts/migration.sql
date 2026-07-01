-- DropIndex
DROP INDEX "Shift_employeeId_date_key";

-- DropIndex
DROP INDEX "SyncedShiftEvent_employeeId_date_key";

-- CreateIndex
CREATE UNIQUE INDEX "Shift_employeeId_date_startTime_endTime_key" ON "Shift"("employeeId", "date", "startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "SyncedShiftEvent_employeeId_date_startTime_endTime_key" ON "SyncedShiftEvent"("employeeId", "date", "startTime", "endTime");

