import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonBadge,
  IonSpinner,
}  from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      identityPoolId: 'us-east-1:00000000-0000-0000-0000-000000000000', 
      allowGuestAccess: true,
    },
  },
});

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonBadge,
    IonSpinner,
  ],
})
export class Tab1Page {
  private readonly urls = {
    compareFace: 'https://wb2oril6mxhrwswtbfhhqkomoi0gyaeg.lambda-url.us-east-1.on.aws/',
    getSessionId: 'https://ngawqscdifk3htiblkk5mjmahu0xqtrz.lambda-url.us-east-1.on.aws/',
    getSessionResults: 'https://sv732muel6so7x7pg4jnmqa6dm0xjxkq.lambda-url.us-east-1.on.aws/',
  };

  sessionId = '';
  referenceBase64 = '';
  referencePreview = '';
  capturedBase64 = '';
  capturedPreview = '';
  resultData: any = null;
  statusMessage = 'Listo para iniciar';
  loading = false;

  constructor() {}

  async iniciarSesionLiveness() {
    this.loading = true;
    this.statusMessage = 'Solicitando sesión...';
    try {
      const resp = await fetch(this.urls.getSessionId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      this.sessionId = data.sessionId || data.SessionId || JSON.stringify(data);
      this.statusMessage = 'Sesión obtenida';
    } catch (err: any) {
      this.statusMessage = `Error al obtener sesión: ${err?.message || err}`;
    } finally {
      this.loading = false;
    }
  }

  async tomarFoto(tipo: 'referencia' | 'captura') {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: tipo === 'referencia' ? CameraSource.Photos : CameraSource.Camera,
      });

      const base64 = photo.base64String || '';
      const dataUrl = `data:image/${photo.format || 'jpeg'};base64,${base64}`;

      if (tipo === 'referencia') {
        this.referenceBase64 = base64;
        this.referencePreview = dataUrl;
      } else {
        this.capturedBase64 = base64;
        this.capturedPreview = dataUrl;
      }
      this.statusMessage = tipo === 'referencia' ? 'Foto de referencia lista' : 'Foto capturada';
    } catch (err: any) {
      this.statusMessage = `Cámara cancelada o sin permiso: ${err?.message || err}`;
    }
  }

  async compararRostros() {
    if (!this.referenceBase64 || !this.capturedBase64) {
      this.statusMessage = 'Selecciona la foto de referencia y toma la foto capturada primero';
      return;
    }

    this.loading = true;
    this.statusMessage = 'Comparando rostros en AWS...';
    try {
      const resp = await fetch(this.urls.compareFace, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceImageBase64: this.referenceBase64,
          targetImageBase64: this.capturedBase64,
          sessionId: this.sessionId || undefined,
        }),
      });
      this.resultData = await resp.json();
      this.statusMessage = 'Comparación completada';
    } catch (err: any) {
      this.statusMessage = `Error al comparar: ${err?.message || err}`;
    } finally {
      this.loading = false;
    }
  }

  async consultarResultados() {
    if (!this.sessionId) {
      this.statusMessage = 'Primero inicia una sesión para tener un sessionId';
      return;
    }

    this.loading = true;
    this.statusMessage = 'Consultando resultados...';
    try {
      const urlConQuery = `${this.urls.getSessionResults}?sessionId=${encodeURIComponent(this.sessionId)}`;
      const resp = await fetch(urlConQuery, { method: 'GET' });
      this.resultData = await resp.json();
      this.statusMessage = 'Resultados actualizados';
    } catch (err: any) {
      this.statusMessage = `Error al consultar resultados: ${err?.message || err}`;
    } finally {
      this.loading = false;
    }
  }
}