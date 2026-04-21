import { Router } from "express";

import { CallRecordService } from "../modules/call-records/call-record.service.js";
import { createCallRecordRouter } from "../modules/call-records/call-record.routes.js";
import { createAuditService } from "../modules/audit/audit.service.js";
import { CampaignService } from "../modules/campaigns/campaign.service.js";
import { createCampaignRouter } from "../modules/campaigns/campaign.routes.js";
import { ContactService } from "../modules/contacts/contact.service.js";
import { createContactRouter } from "../modules/contacts/contact.routes.js";
import { DashboardService } from "../modules/dashboard/dashboard.service.js";
import { createDashboardRouter } from "../modules/dashboard/dashboard.routes.js";
import { JourneyService } from "../modules/journeys/journey.service.js";
import { createJourneyRouter } from "../modules/journeys/journey.routes.js";
import { ReportService } from "../modules/reports/report.service.js";
import { createReportRouter } from "../modules/reports/report.routes.js";
import { createSearchRouter } from "../modules/search/search.routes.js";
import { SearchService } from "../modules/search/search.service.js";
import { SettingsService } from "../modules/settings/settings.service.js";
import { createSettingsRouter } from "../modules/settings/settings.routes.js";
import { createApiAuthMiddleware } from "../modules/auth/auth.middleware.js";
import type { ApiAuthDependencies } from "../modules/auth/auth.types.js";
import { createVoiceApiRouter } from "../modules/voice/voice.api-routes.js";
import { createVoiceService } from "../modules/voice/voice.service.js";
import type { BackendRepositories } from "../repositories/backend-repositories.js";

export function createApiRouter(repositories: BackendRepositories, auth?: ApiAuthDependencies) {
  const router = Router();
  const auditService = createAuditService(repositories.audit);
  const voiceService = createVoiceService(repositories);

  router.use(createApiAuthMiddleware(auth));
  router.use("/dashboard", createDashboardRouter(new DashboardService(repositories.dashboard)));
  router.use("/campaigns", createCampaignRouter(new CampaignService(repositories.campaigns, repositories.contacts, auditService)));
  router.use("/contacts", createContactRouter(new ContactService(repositories.contacts)));
  router.use("/journeys", createJourneyRouter(new JourneyService(repositories.journeys)));
  router.use("/call-records", createCallRecordRouter(new CallRecordService(repositories.callRecords, auditService, repositories.settings)));
  router.use("/reports", createReportRouter(new ReportService(repositories.reports)));
  router.use("/search", createSearchRouter(new SearchService(repositories.search)));
  router.use("/settings", createSettingsRouter(new SettingsService(repositories.settings, auditService)));
  router.use("/voice", createVoiceApiRouter(voiceService));

  return router;
}
