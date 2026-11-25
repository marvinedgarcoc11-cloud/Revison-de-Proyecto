import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export interface LivenessSessionResponse {
  sessionId?: string;
  SessionId?: string;
  body?: string | LivenessSessionResponse;
  [key: string]: unknown;
}

export interface LivenessResultResponse {
  Status?: string;
  Confidence?: number;
  isLive?: boolean;
  confidence?: number;
  [key: string]: unknown;
}

export interface CompareFaceResponse {
  similarity?: number;
  Similarity?: number;
  matched?: boolean;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class LivenessService {
  private readonly requestTimeoutMs = 15000;

  private readonly endpoints = {
    getSessionId: 'https://ngawqscdifk3htiblkk5mjmahu0xqtrz.lambda-url.us-east-1.on.aws/',
    getSessionResults: 'https://sv732muel6so7x7pg4jnmqa6dm0xjxkq.lambda-url.us-east-1.on.aws/',
    compareFace: 'https://wb2oril6mxhrwswtbfhhqkomoi0gyaeg.lambda-url.us-east-1.on.aws/',
  };

  private parseSessionId(rawData: unknown): string {
    if (typeof rawData === 'string') {
      const trimmed = rawData.trim().replace(/^"+|"+$/g, '');
      if (!trimmed) return '';
      try {
        const parsed = JSON.parse(trimmed);
        return this.parseSessionId(parsed);
      } catch {
        return trimmed;
      }
    }

    if (rawData && typeof rawData === 'object') {
      const obj = rawData as Record<string, unknown>;
      if (obj['body'] !== undefined) {
        return this.parseSessionId(obj['body']);
      }
      const id = String(obj['sessionId'] ?? obj['SessionId'] ?? '').trim();
      if (id) return id;
    }

    return '';
  }

  private async postJson<T>(url: string, body: unknown): Promise<{ status: number; data: T }> {
    console.log('[LivenessService] POST ->', url, 'isNative:', Capacitor.isNativePlatform());

    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.post({
        url,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        data: body,
        connectTimeout: this.requestTimeoutMs,
        readTimeout: this.requestTimeoutMs,
      });

      console.log('[LivenessService] Respuesta nativa status:', res.status, res.data);
      return { status: res.status, data: res.data as T };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = (await resp.json()) as T;
      return { status: resp.status, data };
    } finally {
      clearTimeout(timer);
    }
  }

  async createSession(): Promise<string> {
    const { status, data } = await this.postJson<LivenessSessionResponse>(
      this.endpoints.getSessionId,
      {}
    );

    if (status < 200 || status >= 300) {
      throw new Error(`HTTP ${status} al crear sesión: ${JSON.stringify(data)}`);
    }

    const sessionId = this.parseSessionId(data);
    if (!sessionId) {
      throw new Error(`La Lambda no devolvió un sessionId válido: ${JSON.stringify(data)}`);
    }

    return sessionId;
  }

  async getSessionResults(sessionId: string): Promise<LivenessResultResponse> {
    const url = `${this.endpoints.getSessionResults}?sessionId=${encodeURIComponent(sessionId)}`;
    console.log('[LivenessService] GET ->', url, 'isNative:', Capacitor.isNativePlatform());

    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.get({
        url,
        headers: { Accept: 'application/json' },
        connectTimeout: this.requestTimeoutMs,
        readTimeout: this.requestTimeoutMs,
      });
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status} al consultar resultados`);
      }
      return res.data as LivenessResultResponse;
    }

    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} al consultar resultados`);
    }
    return resp.json();
  }

  async compareFaces(params: {
    sourceImageBase64: string;
    targetImageBase64: string;
    sessionId?: string;
  }): Promise<CompareFaceResponse> {
    const { status, data } = await this.postJson<CompareFaceResponse>(
      this.endpoints.compareFace,
      params
    );
    if (status < 200 || status >= 300) {
      throw new Error(`HTTP ${status} al comparar rostros`);
    }
    return data;
  }
}