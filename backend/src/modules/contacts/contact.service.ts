import { parseCsv, serializeCsv } from "../../lib/csv.js";
import { AppError } from "../../lib/http-errors.js";
import type {
  ContactListFilters,
  ContactRepository,
  PreparedContactImport,
  PreparedContactImportRow,
} from "../../repositories/backend-repositories.js";
import {
  createContactRequestSchema,
  type ContactImportRequest,
  type CreateContactRequest,
  type UpdateContactRequest,
} from "./contact.schemas.js";

const importColumnAliases: { [key in keyof CreateContactRequest]-?: readonly string[] } = {
  name: ["name", "full_name", "contact_name"],
  phone: ["phone", "phone_number", "mobile", "mobile_number", "contact_number"],
  email: ["email", "email_address"],
  language: ["language", "lang"],
  consent: ["consent", "has_consent", "opt_in"],
  source: ["source", "campaign_source", "upload_source"],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizePhoneNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const withoutFormatting = trimmed.replace(/[\s()-]/g, "");

  if (withoutFormatting.startsWith("+")) {
    const digits = withoutFormatting.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }

  if (withoutFormatting.startsWith("00")) {
    const digits = withoutFormatting.slice(2).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }

  const digits = withoutFormatting.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length > 10) {
    return `+${digits}`;
  }

  return digits;
}

function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeMutableContactInput<TContactInput extends CreateContactRequest | UpdateContactRequest>(input: TContactInput): TContactInput {
  const normalized = {
    ...input,
    name: input.name.trim(),
    phone: normalizePhoneNumber(input.phone),
    email: normalizeOptionalString(input.email),
    source: input.source.trim(),
  };

  return normalized as TContactInput;
}

function findImportColumnIndex(headerRow: readonly string[], aliases: readonly string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));
  return headerRow.findIndex((header) => normalizedAliases.has(normalizeHeader(header)));
}

function parseConsentValue(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (["true", "yes", "y", "1"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "n", "0"].includes(normalized)) {
    return false;
  }

  throw new Error(`Consent value "${value}" must be yes/no, true/false, or 1/0.`);
}

function buildPayloadRecord(headerRow: readonly string[], dataRow: readonly string[]) {
  const payload: Record<string, string> = {};

  for (let index = 0; index < headerRow.length; index += 1) {
    const header = headerRow[index]?.trim() || `column_${index + 1}`;
    payload[header] = dataRow[index]?.trim() ?? "";
  }

  return payload;
}

export class ContactService {
  public constructor(private readonly repository: ContactRepository) {}

  public list(filters: ContactListFilters) {
    return this.repository.list(filters);
  }

  public async getById(id: string) {
    const contact = await this.repository.getById(id);

    if (!contact) {
      throw new AppError(404, "contact_not_found", `Contact ${id} was not found.`);
    }

    return contact;
  }

  private async assertUniquePhone(phone: string, currentContactId?: string) {
    const existingContact = await this.repository.findByPhone(phone);

    if (existingContact && existingContact.id !== currentContactId) {
      throw new AppError(409, "contact_phone_exists", `A contact with phone ${phone} already exists.`);
    }
  }

  public async exportCsv(filters: ContactListFilters) {
    const contacts = await this.list(filters);

    return serializeCsv(contacts, [
      { header: "id", value: (contact) => contact.id },
      { header: "name", value: (contact) => contact.name },
      { header: "phone", value: (contact) => contact.phone },
      { header: "email", value: (contact) => contact.email },
      { header: "language", value: (contact) => contact.language },
      { header: "status", value: (contact) => contact.status },
      { header: "consent", value: (contact) => contact.consent },
      { header: "workspace", value: (contact) => contact.workspace },
      { header: "source", value: (contact) => contact.source },
      { header: "campaign_id", value: (contact) => contact.campaignId },
      { header: "last_contacted_at", value: (contact) => contact.lastContactedAt },
    ]);
  }

  public async create(input: CreateContactRequest) {
    const normalizedInput = createContactRequestSchema.parse(normalizeMutableContactInput(input));
    await this.assertUniquePhone(normalizedInput.phone);
    return this.repository.create(normalizedInput);
  }

  public async update(id: string, input: UpdateContactRequest) {
    const currentContact = await this.getById(id);
    const normalizedInput = createContactRequestSchema.parse(normalizeMutableContactInput(input));

    await this.assertUniquePhone(normalizedInput.phone, currentContact.id);

    const updatedContact = await this.repository.update(id, normalizedInput);

    if (!updatedContact) {
      throw new AppError(404, "contact_not_found", `Contact ${id} was not found.`);
    }

    return updatedContact;
  }

  public async remove(id: string) {
    await this.getById(id);
    await this.repository.remove(id);
  }

  public async markDoNotCall(id: string) {
    const currentContact = await this.getById(id);

    if (currentContact.status === "dnd") {
      return currentContact;
    }

    const updatedContact = await this.repository.setStatus(id, "dnd");

    if (!updatedContact) {
      throw new AppError(404, "contact_not_found", `Contact ${id} was not found.`);
    }

    return updatedContact;
  }

  public async importCsv(input: ContactImportRequest) {
    const parsedRows = parseCsv(input.csvText);

    if (parsedRows.length === 0) {
      throw new AppError(400, "contact_import_empty_csv", "The uploaded CSV file did not contain any rows.");
    }

    const headerRow = parsedRows[0] ?? [];
    const dataRows = parsedRows.slice(1);
    const nameColumnIndex = findImportColumnIndex(headerRow, importColumnAliases.name);
    const phoneColumnIndex = findImportColumnIndex(headerRow, importColumnAliases.phone);

    if (nameColumnIndex === -1 || phoneColumnIndex === -1) {
      throw new AppError(400, "contact_import_missing_columns", "The CSV must include name and phone columns.", {
        requiredColumns: ["name", "phone"],
      });
    }

    const emailColumnIndex = findImportColumnIndex(headerRow, importColumnAliases.email);
    const languageColumnIndex = findImportColumnIndex(headerRow, importColumnAliases.language);
    const consentColumnIndex = findImportColumnIndex(headerRow, importColumnAliases.consent);
    const sourceColumnIndex = findImportColumnIndex(headerRow, importColumnAliases.source);
    const defaultLanguage = input.defaultLanguage ?? "english";
    const defaultSource = input.source?.trim() || input.filename.trim();
    const seenPhones = new Set<string>();
    const existingPhoneCache = new Map<string, boolean>();
    const preparedRows: PreparedContactImportRow[] = [];

    const isExistingPhone = async (phone: string) => {
      if (existingPhoneCache.has(phone)) {
        return existingPhoneCache.get(phone) ?? false;
      }

      const existingContact = await this.repository.findByPhone(phone);
      const exists = Boolean(existingContact);
      existingPhoneCache.set(phone, exists);
      return exists;
    };

    for (let index = 0; index < dataRows.length; index += 1) {
      const dataRow = dataRows[index] ?? [];
      const rowNumber = index + 2;
      const payload = buildPayloadRecord(headerRow, dataRow);

      try {
        const normalizedContact = createContactRequestSchema.parse(
          normalizeMutableContactInput({
            name: dataRow[nameColumnIndex]?.trim() ?? "",
            phone: dataRow[phoneColumnIndex]?.trim() ?? "",
            email: normalizeOptionalString(emailColumnIndex >= 0 ? dataRow[emailColumnIndex] : undefined),
            language: (dataRow[languageColumnIndex]?.trim().toLowerCase() || defaultLanguage) as CreateContactRequest["language"],
            consent: parseConsentValue(consentColumnIndex >= 0 ? dataRow[consentColumnIndex] : undefined, input.defaultConsent),
            source: dataRow[sourceColumnIndex]?.trim() || defaultSource,
          }),
        );

        if (seenPhones.has(normalizedContact.phone) || (await isExistingPhone(normalizedContact.phone))) {
          preparedRows.push({
            rowNumber,
            payload,
            status: "duplicate",
            errorMessage: `Duplicate phone ${normalizedContact.phone}.`,
          });
          continue;
        }

        seenPhones.add(normalizedContact.phone);
        preparedRows.push({
          rowNumber,
          payload,
          status: "imported",
          contact: normalizedContact,
        });
      } catch (error) {
        preparedRows.push({
          rowNumber,
          payload,
          status: "invalid",
          errorMessage: error instanceof Error ? error.message : "The row could not be validated.",
        });
      }
    }

    const preparedImport: PreparedContactImport = {
      filename: input.filename.trim(),
      rows: preparedRows,
    };

    return this.repository.importContacts(preparedImport);
  }
}
