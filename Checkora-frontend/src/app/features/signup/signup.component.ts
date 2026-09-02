import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TuiButton } from '@taiga-ui/core/components/button';
import { AuthService } from '../../auth.service';
@Component({selector:'app-signup',imports:[ReactiveFormsModule,TuiButton],templateUrl:'./signup.component.html',styleUrl:'../auth/login.component.scss',changeDetection:ChangeDetectionStrategy.OnPush})
export class SignupComponent { private readonly fb=inject(NonNullableFormBuilder); private readonly auth=inject(AuthService); private readonly router=inject(Router); protected readonly error=signal(''); protected readonly form=this.fb.group({name:['',Validators.required],email:['',[Validators.required,Validators.email]],password:['',Validators.minLength(12)]}); protected async submit():Promise<void>{if(this.form.invalid)return;const value=this.form.getRawValue();const response=await this.auth.signup(value.name,value.email,value.password);if(response){this.error.set(response);return;}await this.router.navigateByUrl('/login');} }
