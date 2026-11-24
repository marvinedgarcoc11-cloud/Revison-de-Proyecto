# ProyectoFinal — Revisión Previa (Ionic + Angular + Capacitor + AWS Lambda)

Avance de aplicación móvil híbrida con **Ionic**, **Angular** y **Capacitor** (`@capacitor/camera` y `aws-amplify`) integrada mediante Function URLs HTTPS a servicios *serverless* de **AWS Lambda** y **Amazon Rekognition**.

## Endpoints configurados en `Tab1Page`
- `getSessionId`: `https://ngawqscdifk3htiblkk5mjmahu0xqtrz.lambda-url.us-east-1.on.aws/`
- `compareFace`: `https://wb2oril6mxhrwswtbfhhqkomoi0gyaeg.lambda-url.us-east-1.on.aws/`
- `getSessionResults`: `https://sv732muel6so7x7pg4jnmqa6dm0xjxkq.lambda-url.us-east-1.on.aws/`

## Pasos para compilar y sincronizar
```bash
npm install
ionic build
npx cap sync android