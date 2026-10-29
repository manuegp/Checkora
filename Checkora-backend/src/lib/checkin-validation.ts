import { z } from 'zod';

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const birthDateSchema = z.iso.date().refine((value) => !value.startsWith('0000-'));

export const submissionBody = z.object({
  email: z.email().max(320),
  firstName: requiredText(120),
  firstSurname: requiredText(120),
  secondSurname: z.string().trim().max(120),
  gender: z.enum(['female', 'male', 'other']),
  documentType: z.enum(['dni', 'nie', 'passport', 'other']),
  documentNumber: requiredText(80),
  documentSupportNumber: requiredText(80),
  nationality: requiredText(120),
  birthDate: birthDateSchema,
  mobilePhone: requiredText(40),
  habitualResidence: requiredText(160),
  address: requiredText(240),
  postalCode: requiredText(24),
  municipality: requiredText(160),
  signature: z.string().startsWith('data:image/').max(1_500_000),
  privacyAccepted: z.literal(true),
});

// Drafts retain unfinished/invalid values. The complete schema above determines validity.
const draftText = z.string().max(10_000).default('');
export const draftBody = z.object({
  email: draftText,
  firstName: draftText,
  firstSurname: draftText,
  secondSurname: draftText,
  gender: draftText,
  documentType: draftText,
  documentNumber: draftText,
  documentSupportNumber: draftText,
  nationality: draftText,
  birthDate: draftText,
  mobilePhone: draftText,
  habitualResidence: draftText,
  address: draftText,
  postalCode: draftText,
  municipality: draftText,
  signature: z.string().max(1_500_000).default(''),
  privacyAccepted: z.boolean().default(false),
});

export const draftTokenSchema = z.uuid();
export type CheckinDraft = z.infer<typeof draftBody>;

export function hasDraftContent(draft: CheckinDraft): boolean {
  return Object.values(draft).some((value) =>
    typeof value === 'string' ? value.length > 0 : value,
  );
}

export function draftColumnValue(value: string, max: number): string | null {
  // Overlong input is kept verbatim in draft_data rather than rejected or truncated.
  return value.trim() && value.length <= max ? value : null;
}

export function draftBirthDate(value: string): string | null {
  return birthDateSchema.safeParse(value).success ? value : null;
}
