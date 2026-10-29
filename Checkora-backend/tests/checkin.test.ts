import assert from 'node:assert/strict';
import { after, before, beforeEach, mock, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import {
  draftBirthDate,
  draftBody,
  draftColumnValue,
  hasDraftContent,
  submissionBody,
} from '../src/lib/checkin-validation.ts';
import { hashPublicToken } from '../src/lib/crypto.ts';

const token = 'b1291e72-8d70-463e-9a81-831fb779598e';
const validSubmission = {
  email: 'guest@example.com',
  firstName: 'Ana',
  firstSurname: 'García',
  secondSurname: '',
  gender: 'female',
  documentType: 'passport',
  documentNumber: '123456',
  documentSupportNumber: '654321',
  nationality: 'España',
  birthDate: '2000-02-29',
  mobilePhone: '+34600111222',
  habitualResidence: 'España',
  address: 'Calle Mayor 1',
  postalCode: '28001',
  municipality: 'Madrid',
  signature: 'data:image/png;base64,AAAA',
  privacyAccepted: true,
};

type QueryCall = { text: string; values: unknown[] };
const queries: QueryCall[] = [];
let queryResults: unknown[][] = [];
const notify = mock.fn(async () => undefined);

mock.module(new URL('../src/config/env.ts', import.meta.url).href, {
  exports: { env: { FRONTEND_ORIGIN: 'http://localhost:4200' } },
});
mock.module(new URL('../src/db/database.ts', import.meta.url).href, {
  exports: {
    sql: async (parts: TemplateStringsArray, ...values: unknown[]) => {
      queries.push({ text: parts.join('?'), values });
      assert.ok(queryResults.length, 'unexpected database query');
      return queryResults.shift();
    },
  },
});
mock.module(new URL('../src/services/email.service.ts', import.meta.url).href, {
  exports: { sendGuestSubmissionNotificationEmail: notify },
});

const { checkinRouter } = await import('../src/routes/checkin.routes.ts');
const app = express();
app.use(express.json());
app.use('/api/checkin', checkinRouter);
const server = app.listen(0, '127.0.0.1');
let baseUrl: string;
const link = { id: 'link-id', owner_name: 'Owner', owner_email: 'owner@example.com' };

before(async () => {
  if (!server.listening) await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/checkin/public-link`;
});
after(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  queries.length = 0;
  queryResults = [];
  notify.mock.resetCalls();
});

test('incomplete and invalid values are drafts, but not valid submissions', () => {
  const draft = draftBody.parse({ email: 'unfinished@', birthDate: '2000-02-30' });
  assert.equal(draft.email, 'unfinished@');
  assert.equal(draft.birthDate, '2000-02-30');
  assert.equal(submissionBody.safeParse(draft).success, false);
  assert.equal(draftBirthDate(draft.birthDate), null);
});

test('validity requires every field, a real date, a signature and accepted privacy', () => {
  assert.equal(submissionBody.safeParse(validSubmission).success, true);
  for (const change of [
    { firstName: '  ' },
    { email: 'wrong' },
    { birthDate: '2001-02-29' },
    { birthDate: '0000-01-01' },
    { signature: '' },
    { privacyAccepted: false },
  ]) {
    assert.equal(submissionBody.safeParse({ ...validSubmission, ...change }).success, false);
  }
});

test('empty forms do not create drafts and invalid overlong input remains in raw data', () => {
  assert.equal(hasDraftContent(draftBody.parse({})), false);
  assert.equal(hasDraftContent(draftBody.parse({ firstName: ' ' })), true);
  assert.equal(hasDraftContent(draftBody.parse({ privacyAccepted: true })), true);
  assert.equal(hasDraftContent(draftBody.parse({ firstName: 'A' })), true);
  const draft = draftBody.parse({ firstName: 'A'.repeat(121) });
  assert.equal(draft.firstName.length, 121);
  assert.equal(draftColumnValue(draft.firstName, 120), null);
  assert.equal(submissionBody.safeParse(draft).success, false);
});

async function request(method: 'PUT' | 'POST', path: string, body: unknown) {
  return fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('PUT creates an invalid draft for the first filled field without sending email', async () => {
  queryResults = [[link], [{ id: 'draft-id', is_valid: false }]];
  const response = await request('PUT', `/drafts/${token}`, { firstName: 'Ana' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id: 'draft-id', isValid: false });
  assert.equal(notify.mock.callCount(), 0);
  assert.equal(queries[1].values[1], hashPublicToken(token));
  assert.equal(queries[1].values[3], false);
  assert.ok(queries[1].text.includes('ON CONFLICT (draft_token_hash) DO UPDATE'));
  assert.ok(queries[1].text.includes('guest_submissions.submitted_at IS NULL'));
  assert.ok(
    queries[1].text.includes('guest_submissions.checkin_link_id = EXCLUDED.checkin_link_id'),
  );
});

test('PUT stores invalid dates verbatim in draft_data and uses NULL for the date column', async () => {
  queryResults = [[link], [{ id: 'draft-id', is_valid: false }]];
  const response = await request('PUT', `/drafts/${token}`, { birthDate: '2000-02-30' });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(queries[1].values[2] as string).birthDate, '2000-02-30');
  assert.equal(queries[1].values[13], null);
});

test('PUT marks a complete valid form as valid before final submission', async () => {
  queryResults = [[link], [{ id: 'draft-id', is_valid: true }]];
  const response = await request('PUT', `/drafts/${token}`, validSubmission);
  assert.equal(response.status, 200);
  assert.equal(queries[1].values[3], true);
  assert.equal(queries[1].values[21], false);
  assert.equal(notify.mock.callCount(), 0);
});

test('PUT preserves invalid year zero and external signature URL only in raw draft data', async () => {
  queryResults = [[link], [{ id: 'draft-id', is_valid: false }]];
  const response = await request('PUT', `/drafts/${token}`, {
    birthDate: '0000-01-01',
    signature: 'https://untrusted.example/signature.png',
  });
  assert.equal(response.status, 200);
  const draft = JSON.parse(queries[1].values[2] as string);
  assert.equal(draft.birthDate, '0000-01-01');
  assert.equal(draft.signature, 'https://untrusted.example/signature.png');
  assert.equal(queries[1].values[13], null);
  assert.equal(queries[1].values[19], null);
});

test('PUT does not create a row for an untouched empty form', async () => {
  queryResults = [[link], []];
  const response = await request('PUT', `/drafts/${token}`, {});
  assert.equal(response.status, 204);
  assert.equal(queries.length, 2);
  assert.ok(!queries.some((query) => query.text.includes('INSERT')));
});

test('PUT saves clearing every field on an existing draft', async () => {
  queryResults = [[link], [{ id: 'draft-id' }], [{ id: 'draft-id', is_valid: false }]];
  const response = await request('PUT', `/drafts/${token}`, {});
  assert.equal(response.status, 200);
  assert.equal(queries[2].values[3], false);
  assert.equal(queries[2].values[4], null);
});

test('PUT rejects an invalid token without touching the database', async () => {
  const response = await request('PUT', '/drafts/not-a-private-uuid', { firstName: 'Ana' });
  assert.equal(response.status, 422);
  assert.equal(queries.length, 0);
});

test('PUT returns 404 for a revoked or missing public link', async () => {
  queryResults = [[]];
  const response = await request('PUT', `/drafts/${token}`, { firstName: 'Ana' });
  assert.equal(response.status, 404);
  assert.equal(queries.length, 1);
});

test('late autosave cannot overwrite a finalized row or a draft belonging to another link', async () => {
  queryResults = [[link], []];
  const response = await request('PUT', `/drafts/${token}`, { firstName: 'Changed' });
  assert.equal(response.status, 409);
  assert.equal(notify.mock.callCount(), 0);
});

test('POST finalizes the same draft token and only then sends the owner notification', async () => {
  queryResults = [[link], [{ id: 'draft-id', is_valid: true }]];
  const response = await request('POST', '/submissions', { ...validSubmission, draftToken: token });
  assert.equal(response.status, 201);
  assert.equal(queries[1].values[1], hashPublicToken(token));
  assert.equal(queries[1].values[3], true);
  assert.equal(queries[1].values[21], true);
  assert.equal(notify.mock.callCount(), 1);
  assert.equal((await response.json()).id, 'draft-id');
});

test('repeating POST cannot duplicate or send another email for a finalized draft', async () => {
  queryResults = [[link], [], [{ id: 'draft-id', is_valid: true }]];
  const response = await request('POST', '/submissions', { ...validSubmission, draftToken: token });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    id: 'draft-id',
    isValid: true,
    emailSent: null,
    message: 'Registro ya enviado.',
  });
  assert.equal(notify.mock.callCount(), 0);
});

test('POST cannot finalize a draft associated with a different public link', async () => {
  queryResults = [[link], [], []];
  const response = await request('POST', '/submissions', { ...validSubmission, draftToken: token });
  assert.equal(response.status, 409);
  assert.equal(notify.mock.callCount(), 0);
});

test('POST rejects incomplete drafts without changing the stored row', async () => {
  const response = await request('POST', '/submissions', { firstName: 'Ana', draftToken: token });
  assert.equal(response.status, 422);
  assert.equal(queries.length, 0);
});

test('POST remains compatible with clients without draft autosave', async () => {
  queryResults = [[link], [{ id: 'submitted-id', is_valid: true }]];
  const response = await request('POST', '/submissions', validSubmission);
  assert.equal(response.status, 201);
  assert.equal(queries[1].values[1], null);
});
