import type { LocalDate } from '../dates';
import type { Cents } from '../money';

/** One statement line, normalized from OFX or CSV. Negative amounts are money out. */
export interface ImportedRow {
  date: LocalDate;
  description: string;
  amountCents: Cents;
  externalId: string | null;
}
