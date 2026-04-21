import { serializeCsv } from "../../lib/csv.js";
import type { ReportRepository } from "../../repositories/backend-repositories.js";

export class ReportService {
  public constructor(private readonly repository: ReportRepository) {}

  public getSnapshot() {
    return this.repository.getSnapshot();
  }

  public async exportCsv() {
    const snapshot = await this.getSnapshot();
    const rows = [
      { section: "overview", item: "answer_rate", metric: "value", value: snapshot.overview.avgAnswerRate },
      { section: "overview", item: "completion_rate", metric: "value", value: snapshot.overview.avgCompletionRate },
      { section: "overview", item: "confirmation_rate", metric: "value", value: snapshot.overview.avgConfirmationRate },
      { section: "overview", item: "opt_out_rate", metric: "value", value: snapshot.overview.optOutRate },
      { section: "overview", item: "transfer_rate", metric: "value", value: snapshot.overview.transferRate },
      ...snapshot.dailyVolume.flatMap((point) => [
        { section: "daily_volume", item: point.date, metric: "calls", value: point.calls },
        { section: "daily_volume", item: point.date, metric: "answered", value: point.answered },
        { section: "daily_volume", item: point.date, metric: "completed", value: point.completed },
      ]),
      ...snapshot.fieldDropoff.flatMap((field) => [
        { section: "field_dropoff", item: field.field, metric: "captured", value: field.captured },
        { section: "field_dropoff", item: field.field, metric: "dropped", value: field.dropped },
      ]),
      ...snapshot.providerPerformance.flatMap((provider) => [
        { section: "provider_performance", item: provider.date, metric: "plivo", value: provider.plivo },
        { section: "provider_performance", item: provider.date, metric: "exotel", value: provider.exotel },
      ]),
      ...snapshot.dispositionBreakdown.map((item) => ({
        section: "disposition_breakdown",
        item: item.name,
        metric: "percentage",
        value: item.value,
      })),
    ];

    return serializeCsv(rows, [
      { header: "section", value: (row) => row.section },
      { header: "item", value: (row) => row.item },
      { header: "metric", value: (row) => row.metric },
      { header: "value", value: (row) => row.value },
    ]);
  }
}
