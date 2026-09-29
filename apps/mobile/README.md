# @erp/mobile — TramaTech ERP (Fase 1)

Aplicación React Native (Android nativo en `android/`) generada con la
plantilla oficial `@react-native-community/template@0.87.1`.

- Application ID: `com.tramatech.erp`
- Pantalla inicial mínima (`App.tsx`): valida arranque, sin auth ni API real.
- La migración de UI compartida (`packages/ui`) es Fase 2. `apps/web`
  sigue intacto con `react-native-web`.

## Comandos

```sh
npm run start --workspace @erp/mobile      # Metro
npm run android --workspace @erp/mobile    # compilar + instalar en emulador
npm run typecheck --workspace @erp/mobile  # tsc del workspace
```

## Android Studio

Abrir `apps/mobile/android` y ejecutar Gradle Sync.
Build debug: `cd apps/mobile/android && gradlew.bat assembleDebug`.
