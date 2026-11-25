import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { IonicRouteStrategy } from '@ionic/angular/ionic-route-strategy';
import { RouteReuseStrategy } from '@angular/router';
import { Amplify } from 'aws-amplify';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

Amplify.configure({
  Auth: {
    Cognito: {
      identityPoolId: 'us-east-1:965c56e1-af7a-4962-82a2-d494cc2dba04',
      allowGuestAccess: true,
    },
  },
});

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ],
});