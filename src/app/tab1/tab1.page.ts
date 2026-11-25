import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
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
  IonSpinner,
} from '@ionic/angular';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { FaceLivenessDetector } from '@aws-amplify/ui-react-liveness';
import {
  LivenessResultResponse,
  LivenessService,
} from '../services/liveness.service';

export type FlowState =
  | 'idle'
  | 'creating-session'
  | 'liveness-running'
  | 'fetching-results'
  | 'done'
  | 'error';

const LIVENESS_REGION = 'us-east-1';

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
    IonSpinner,
  ],
})
export class Tab1Page implements OnDestroy {
  @ViewChild('livenessContainer', { static: false })
  private livenessContainer?: ElementRef<HTMLElement>;

  private readonly livenessService = inject(LivenessService);
  private readonly cdr = inject(ChangeDetectorRef);
  private reactRoot: Root | null = null;

  sessionId = '';
  livenessActive = false;

  livenessResult: LivenessResultResponse | null = null;

  flowState: FlowState = 'idle';
  statusMessage = 'Listo para iniciar prueba de vida';

  get loading(): boolean {
    return (
      this.flowState === 'creating-session' ||
      this.flowState === 'fetching-results'
    );
  }

  get referenceImageBase64(): string {
    if (!this.livenessResult) return '';
    const raw =
      (this.livenessResult['referenceImageBase64'] as string | undefined) ??
      (this.livenessResult['ReferenceImageBase64'] as string | undefined) ??
      '';
    return this.stripBase64Prefix(raw);
  }

  get confidenceScore(): number | null {
    const val =
      this.livenessResult?.Confidence ??
      this.livenessResult?.confidence ??
      (this.livenessResult?.['Confidence'] as number | undefined);
    return typeof val === 'number' ? val : null;
  }

  get livenessPassed(): boolean | null {
    if (!this.livenessResult) return null;
    if (typeof this.livenessResult.isLive === 'boolean') {
      return this.livenessResult.isLive;
    }
    const status = String(
      this.livenessResult.Status ?? this.livenessResult['status'] ?? ''
    ).toUpperCase();
    if (status === 'SUCCEEDED') {
      return this.confidenceScore !== null ? this.confidenceScore >= 85 : true;
    }
    if (status === 'FAILED' || status === 'EXPIRED') {
      return false;
    }
    return null;
  }

  async iniciarSesionLiveness(): Promise<void> {
    this.flowState = 'creating-session';
    this.statusMessage = 'Creando sesión de Face Liveness...';
    this.livenessResult = null;
    this.cdr.detectChanges();

    try {
      this.sessionId = await this.livenessService.createSession();
      this.livenessActive = true;
      this.flowState = 'liveness-running';
      this.statusMessage = 'Sigue las instrucciones en pantalla para la prueba de vida';
      this.cdr.detectChanges();

      setTimeout(() => {
        this.montarWidgetLiveness();
        this.cdr.detectChanges();
      }, 120);
    } catch (err: unknown) {
      this.flowState = 'error';
      this.statusMessage = this.formatError('Error al crear sesión', err);
      this.cdr.detectChanges();
    }
  }

  private montarWidgetLiveness(): void {
    const host = this.livenessContainer?.nativeElement;
    if (!host || !this.sessionId) {
      this.flowState = 'error';
      this.statusMessage = 'No se encontró el contenedor para la prueba de vida';
      this.livenessActive = false;
      this.cdr.detectChanges();
      return;
    }

    this.desmontarWidgetLiveness();
    this.reactRoot = createRoot(host);

    const element = React.createElement(FaceLivenessDetector, {
      sessionId: this.sessionId,
      region: LIVENESS_REGION,
      onAnalysisComplete: async () => {
        this.desmontarWidgetLiveness();
        this.livenessActive = false;
        this.cdr.detectChanges();
        await this.consultarResultados();
      },
      onError: (error: unknown) => {
        this.desmontarWidgetLiveness();
        this.livenessActive = false;
        this.flowState = 'error';
        this.statusMessage = this.formatError('Error en FaceLivenessDetector', error);
        this.cdr.detectChanges();
      },
    });

    this.reactRoot.render(element);
  }

  async consultarResultados(): Promise<void> {
    if (!this.sessionId) {
      this.flowState = 'error';
      this.statusMessage = 'Primero inicia una sesión de prueba de vida';
      this.cdr.detectChanges();
      return;
    }

    this.flowState = 'fetching-results';
    this.statusMessage = 'Obteniendo resultado de prueba de vida...';
    this.cdr.detectChanges();

    try {
      const data = await this.livenessService.getSessionResults(this.sessionId);
      this.livenessResult = data;

      const passed = this.livenessPassed;
      const conf = this.confidenceScore;

      if (passed === true) {
        this.flowState = 'done';
        this.statusMessage =
          conf !== null
            ? `Prueba de vida aprobada (${conf.toFixed(1)}% confianza)`
            : 'Prueba de vida aprobada';
      } else if (passed === false) {
        this.flowState = 'error';
        this.statusMessage = 'Prueba de vida no aprobada';
      } else {
        this.flowState = 'done';
        this.statusMessage = 'Resultado recibido';
      }
    } catch (err: unknown) {
      this.flowState = 'error';
      this.statusMessage = this.formatError('Error al consultar resultados', err);
    }
    this.cdr.detectChanges();
  }

  private stripBase64Prefix(value: string): string {
    const trimmed = (value || '').trim();
    const commaIdx = trimmed.indexOf(',');
    return commaIdx >= 0 ? trimmed.slice(commaIdx + 1) : trimmed;
  }

  ngOnDestroy(): void {
    this.desmontarWidgetLiveness();
  }

  private desmontarWidgetLiveness(): void {
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
  }

  private formatError(prefix: string, err: unknown): string {
    const detail =
      err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
    return `${prefix}: ${detail}`;
  }
}