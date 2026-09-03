import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { neonAuthInterceptor } from './neon-auth.interceptor';
import { provideRouter } from '@angular/router';
import { provideTaiga } from '@taiga-ui/core/utils/miscellaneous';
import { provideTransloco } from '@jsverse/transloco';
import { TranslocoHttpLoader } from './transloco-loader';
import { routes } from './app.routes';
export const appConfig: ApplicationConfig = {providers:[provideBrowserGlobalErrorListeners(),provideRouter(routes),provideHttpClient(withInterceptors([neonAuthInterceptor])),provideTransloco({config:{availableLangs:['en','es'],defaultLang:'en',reRenderOnLangChange:true,prodMode:false},loader:TranslocoHttpLoader}),provideTaiga({mode:'light',apis:'stable',fontScaling:false,scrollbars:'native'})]};
