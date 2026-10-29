import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { TuiDay } from '@taiga-ui/cdk/date-time';
import { TranslocoService } from '@jsverse/transloco';
import { environment } from '../../../environments/environment';
import { CheckinFormComponent } from './checkin-form.component';

describe('Checkin form autosave', () => {
  const reference = 'public-checkin-link';
  const checkinUrl = `${environment.apiUrl}/checkin/${reference}`;
  let fixture: ComponentFixture<CheckinFormComponent>;
  let component: CheckinFormComponent;
  let http: HttpTestingController;

  const draftRequest = () =>
    http.expectOne(
      (request) => request.method === 'PUT' && request.url.startsWith(`${checkinUrl}/drafts/`),
    );

  async function advanceDebounce(): Promise<void> {
    await vi.advanceTimersByTimeAsync(600);
  }

  function fillValidForm(): void {
    component['form'].setValue({
      email: 'ana@example.com',
      firstName: 'Ana',
      firstSurname: 'Garcia',
      secondSurname: '',
      gender: 'female',
      documentType: 'passport',
      documentNumber: 'X123456',
      documentSupportNumber: 'ABC123',
      nationality: 'Spain',
      birthDate: new TuiDay(1990, 0, 2),
      mobilePhone: '+34600111222',
      habitualResidence: 'Madrid',
      address: 'Calle Uno 1',
      postalCode: '28001',
      municipality: 'Madrid',
      signature: 'data:image/png;base64,dGVzdA==',
      privacyAccepted: true,
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckinFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ token: reference }) } },
        },
        { provide: TranslocoService, useValue: { setActiveLang: vi.fn() } },
      ],
    })
      .overrideComponent(CheckinFormComponent, { set: { template: '', imports: [] } })
      .compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CheckinFormComponent);
    component = fixture.componentInstance;
    vi.useFakeTimers();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.useRealTimers();
  });

  it('does not create a draft for an untouched or empty form', async () => {
    await advanceDebounce();
    component['form'].controls.firstName.setValue('');
    await advanceDebounce();

    http.expectNone((request) => request.method === 'PUT');
    expect(component['autosaveStatus']()).toBe('idle');
  });

  it('saves an incomplete form even when its first field is invalid', async () => {
    component['form'].controls.email.setValue('ana@');
    expect(component['form'].invalid).toBe(true);
    await vi.advanceTimersByTimeAsync(599);
    http.expectNone((request) => request.method === 'PUT');

    await vi.advanceTimersByTimeAsync(1);
    const request = draftRequest();
    expect(request.request.body.email).toBe('ana@');
    expect(request.request.body.birthDate).toBe('');
    request.flush({ id: 'submission-1', isValid: false });
    await vi.advanceTimersByTimeAsync(0);

    expect(component['autosaveStatus']()).toBe('saved');
  });

  it('waits for typing to pause and sends only the latest values', async () => {
    component['form'].controls.firstName.setValue('A');
    await vi.advanceTimersByTimeAsync(400);
    component['form'].controls.firstName.setValue('Ana');
    component['form'].controls.email.setValue('ana@example.com');
    await vi.advanceTimersByTimeAsync(599);
    http.expectNone((request) => request.method === 'PUT');

    await vi.advanceTimersByTimeAsync(1);
    const request = draftRequest();
    expect(request.request.body.firstName).toBe('Ana');
    expect(request.request.body.email).toBe('ana@example.com');
    request.flush({ id: 'submission-1', isValid: false });
    await vi.advanceTimersByTimeAsync(0);
    http.expectNone((next) => next.method === 'PUT');
  });

  it('updates the same draft when the user clears every field', async () => {
    component['form'].controls.firstName.setValue('Ana');
    await advanceDebounce();
    const first = draftRequest();
    const firstUrl = first.request.url;
    first.flush({ id: 'submission-1', isValid: false });
    await vi.advanceTimersByTimeAsync(0);

    component['form'].controls.firstName.setValue('');
    await advanceDebounce();
    const cleared = draftRequest();
    expect(cleared.request.url).toBe(firstUrl);
    expect(cleared.request.body.firstName).toBe('');
    cleared.flush({ id: 'submission-1', isValid: false });
    await vi.advanceTimersByTimeAsync(0);
  });

  it('serializes saves so a slow older request cannot overwrite a newer edit', async () => {
    component['form'].controls.firstName.setValue('Ana');
    await advanceDebounce();
    const first = draftRequest();

    component['form'].controls.firstName.setValue('Andrea');
    await advanceDebounce();
    http.expectNone((request) => request.method === 'PUT');

    first.flush({ id: 'submission-1', isValid: false });
    await vi.advanceTimersByTimeAsync(0);
    const second = draftRequest();
    expect(second.request.url).toBe(first.request.url);
    expect(second.request.body.firstName).toBe('Andrea');
    expect(component['autosaveStatus']()).not.toBe('saved');
    second.flush({ id: 'submission-1', isValid: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(component['autosaveStatus']()).toBe('saved');
  });

  it('lets the user retry a failed save with the same draft token', async () => {
    component['form'].controls.firstName.setValue('Ana');
    await advanceDebounce();
    const failed = draftRequest();
    failed.flush({ error: 'Temporary failure' }, { status: 503, statusText: 'Unavailable' });
    await vi.advanceTimersByTimeAsync(0);
    expect(component['autosaveStatus']()).toBe('error');

    component['retryAutosave']();
    await vi.advanceTimersByTimeAsync(0);
    const retry = draftRequest();
    expect(retry.request.url).toBe(failed.request.url);
    expect(retry.request.body.firstName).toBe('Ana');
    retry.flush({ id: 'submission-1', isValid: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(component['autosaveStatus']()).toBe('saved');
  });

  it('continues saving future edits after an autosave failure', async () => {
    component['form'].controls.firstName.setValue('Ana');
    await advanceDebounce();
    const failed = draftRequest();
    failed.flush({ error: 'Temporary failure' }, { status: 503, statusText: 'Unavailable' });
    await vi.advanceTimersByTimeAsync(0);

    component['form'].controls.firstName.setValue('Andrea');
    await advanceDebounce();
    const recovered = draftRequest();
    expect(recovered.request.url).toBe(failed.request.url);
    expect(recovered.request.body.firstName).toBe('Andrea');
    recovered.flush({ id: 'submission-1', isValid: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(component['autosaveStatus']()).toBe('saved');
  });

  it('finalizes the same draft with the latest values after an in-flight save finishes', async () => {
    component['form'].controls.firstName.setValue('Ana');
    await advanceDebounce();
    const saving = draftRequest();
    const draftToken = saving.request.url.split('/').at(-1);

    fillValidForm();
    expect(component['form'].valid).toBe(true);
    const submitting = component['submit']();
    await vi.advanceTimersByTimeAsync(0);
    http.expectNone(`${checkinUrl}/submissions`);

    saving.flush({ id: 'submission-1', isValid: false });
    await vi.advanceTimersByTimeAsync(0);
    const submission = http.expectOne(`${checkinUrl}/submissions`);
    expect(submission.request.method).toBe('POST');
    expect(submission.request.body.draftToken).toBe(draftToken);
    expect(submission.request.body.email).toBe('ana@example.com');
    expect(submission.request.body.birthDate).toBe('1990-01-02');
    submission.flush({ emailSent: true });
    await submitting;

    expect(component['submitted']()).toBe(true);
    expect(component['form'].disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    http.expectNone((request) => request.method === 'PUT');
  });

  it('can submit before the debounce expires without creating a second draft', async () => {
    fillValidForm();
    const submitting = component['submit']();
    await vi.advanceTimersByTimeAsync(0);

    const submission = http.expectOne(`${checkinUrl}/submissions`);
    expect(submission.request.body.draftToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    submission.flush({ emailSent: true });
    await submitting;
    await advanceDebounce();
    http.expectNone((request) => request.method === 'PUT');
    expect(component['submitted']()).toBe(true);
  });

  it('saves the latest draft after a failed submission consumed the pending debounce', async () => {
    fillValidForm();
    const submitting = component['submit']();
    await vi.advanceTimersByTimeAsync(0);
    const submission = http.expectOne(`${checkinUrl}/submissions`);
    const draftToken: unknown = submission.request.body.draftToken;
    await advanceDebounce();
    http.expectNone((request) => request.method === 'PUT');
    submission.flush({ error: 'Temporary failure' }, { status: 503, statusText: 'Unavailable' });
    await submitting;
    await vi.advanceTimersByTimeAsync(0);

    expect(component['form'].enabled).toBe(true);
    expect(component['submitted']()).toBe(false);
    const saving = draftRequest();
    expect(saving.request.url.split('/').at(-1)).toBe(draftToken);
    expect(saving.request.body.firstName).toBe('Ana');
    expect(saving.request.body.email).toBe('ana@example.com');
    expect(saving.request.body.birthDate).toBe('1990-01-02');
    saving.flush({ id: 'submission-1', isValid: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(component['autosaveStatus']()).toBe('saved');
  });
});
