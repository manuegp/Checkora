import { ChangeDetectionStrategy, Component, ElementRef, WritableSignal, computed, inject, signal, viewChild } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core/components/button';
import { TuiElasticContainer } from '@taiga-ui/layout/components/elastic-container';
import { TuiForm } from '@taiga-ui/layout/components/form';
import { TuiCheckbox } from '@taiga-ui/core/components/checkbox';
import { TuiDataList } from '@taiga-ui/core/components/data-list';
import { TuiDay } from '@taiga-ui/cdk/date-time';
import { tuiItemsHandlersProvider } from '@taiga-ui/core/directives/items-handlers';
import { TuiFilterByInputPipe } from '@taiga-ui/core/pipes/filter-by-input';
import { TuiComboBox, TuiFlagPipe, TuiInputDate, TuiSelect } from '@taiga-ui/kit';
import { TUI_ENGLISH_LANGUAGE, TUI_ENGLISH_LANGUAGE_COUNTRIES, TUI_LANGUAGE, TUI_SPANISH_LANGUAGE, TUI_SPANISH_LANGUAGE_COUNTRIES } from '@taiga-ui/i18n';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

function countryFlag(code: string): string {
  return String.fromCodePoint(...[...code].map((character) => 127_397 + character.charCodeAt(0)));
}

type CheckinLanguage = 'en' | 'es';
type CheckinLanguageChoice = CheckinLanguage | 'auto';
interface CountryOption {code: string; name: string; flag: string;}

const languageLabel = (value: unknown): string => {
  if (value === 'auto') return 'Autom\u00e1tico';
  if (value === 'en') return 'English';
  if (value === 'es') return 'Espa\u00f1ol';
  if (value === 'dni') return 'DNI';
  if (value === 'nie') return 'NIE';
  if (value === 'passport') return 'Pasaporte';
  if (value === 'other') return 'Otro';
  return typeof value === 'string' ? value : '';
};

@Component({selector:'app-checkin-form',imports:[FormsModule,ReactiveFormsModule,TranslocoPipe,TuiButton,TuiCheckbox,TuiComboBox,TuiElasticContainer,TuiForm,TuiDataList,TuiFilterByInputPipe,TuiFlagPipe,TuiInputDate,TuiSelect],providers:[{provide:TUI_LANGUAGE,useValue:signal(TUI_ENGLISH_LANGUAGE)},tuiItemsHandlersProvider({stringify: signal(languageLabel)})],templateUrl:'./checkin-form.component.html',styleUrl:'./checkin-form.component.scss',changeDetection:ChangeDetectionStrategy.OnPush})
export class CheckinFormComponent {
  private readonly builder = inject(FormBuilder);
  private readonly transloco = inject(TranslocoService);
  private readonly tuiLanguage = inject(TUI_LANGUAGE) as WritableSignal<typeof TUI_ENGLISH_LANGUAGE>;
  private readonly countryNames = computed(() => this.activeLanguage() === 'es' ? TUI_SPANISH_LANGUAGE_COUNTRIES : TUI_ENGLISH_LANGUAGE_COUNTRIES);
  protected readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('signatureCanvas');
  protected readonly selectedLanguage = signal<CheckinLanguageChoice>('auto');
  protected readonly activeLanguage = computed<CheckinLanguage>(() => {const language=this.selectedLanguage();return language === 'auto' ? this.detectBrowserLanguage() : language});
  protected readonly countries = computed<readonly CountryOption[]>(() => Object.entries(this.countryNames()).map(([code, name]) => ({code, name, flag: countryFlag(code)})).sort((a, b) => a.name.localeCompare(b.name, this.activeLanguage())));
  protected readonly countryFilter = (items: readonly CountryOption[], search: string) => {const term=search.trim().toLocaleLowerCase(this.activeLanguage());return term ? items.filter(({name}) => name.toLocaleLowerCase(this.activeLanguage()).includes(term)) : items};
  private drawing = false;
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly emailNotificationSent = signal<boolean | null>(null);
  protected readonly submitError = signal('');
  constructor() {this.applyLanguage(this.activeLanguage())}
  protected setLanguage(language: string): void {if(language === 'auto' || language === 'en' || language === 'es') {this.selectedLanguage.set(language);this.applyLanguage(this.activeLanguage())}}
  private detectBrowserLanguage(): CheckinLanguage {return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'}
  private applyLanguage(language: CheckinLanguage): void {this.transloco.setActiveLang(language);this.tuiLanguage.set(language === 'es' ? TUI_SPANISH_LANGUAGE : TUI_ENGLISH_LANGUAGE)}
  protected readonly form = this.builder.group({email:['',[Validators.required,Validators.email]],firstName:['',Validators.required],firstSurname:['',Validators.required],secondSurname:[''],gender:['',Validators.required],documentType:['',Validators.required],documentNumber:['',Validators.required],documentSupportNumber:['',Validators.required],nationality:['',Validators.required],birthDate:this.builder.control<TuiDay | null>(null,Validators.required),mobilePhone:['',Validators.required],habitualResidence:['',Validators.required],address:['',Validators.required],postalCode:['',Validators.required],municipality:['',Validators.required],signature:['',Validators.required],privacyAccepted:[false,Validators.requiredTrue]});
  protected begin(event: PointerEvent): void {this.drawing=true;this.draw(event)}
  protected draw(event: PointerEvent): void {if(!this.drawing)return;const canvas=this.canvas()?.nativeElement;if(!canvas)return;const context=canvas.getContext('2d');if(!context)return;const bounds=canvas.getBoundingClientRect();context.lineWidth=2;context.lineCap='round';context.lineTo(event.clientX-bounds.left,event.clientY-bounds.top);context.stroke();context.beginPath();context.moveTo(event.clientX-bounds.left,event.clientY-bounds.top);this.form.controls.signature.setValue(canvas.toDataURL())}
  protected end(): void {this.drawing=false}
  protected clear(): void {const canvas=this.canvas()?.nativeElement;canvas?.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);this.form.controls.signature.setValue('')}
  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting() || this.submitted()) return;
    const reference = this.route.snapshot.paramMap.get('token');
    if (!reference) { this.submitError.set('El enlace de registro no es válido.'); return; }
    this.submitError.set('');
    this.submitting.set(true);
    const value = this.form.getRawValue();
    try {
      const response = await firstValueFrom(this.http.post<{emailSent: boolean}>(environment.apiUrl + '/checkin/' + encodeURIComponent(reference) + '/submissions', {...value, birthDate: this.toIsoDate(value.birthDate)}));
      this.emailNotificationSent.set(response.emailSent);
      this.submitted.set(true);
      this.form.disable();
    } catch (error) {
      this.submitError.set(this.getSubmitError(error));
    } finally {
      this.submitting.set(false);
    }
  }

  private toIsoDate(value: TuiDay | null): string {
    if (!value) return '';
    return String(value.year) + '-' + String(value.month + 1).padStart(2, '0') + '-' + String(value.day).padStart(2, '0');
  }

  private getSubmitError(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.error === 'string') return error.error.error;
    return 'No se ha podido enviar el registro. Intentalo de nuevo.';
  }
}
