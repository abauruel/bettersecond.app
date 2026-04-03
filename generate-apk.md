# Guia de Geração de APK - Better Seconds App

## 📦 Pré-requisitos

1. **Android Studio** instalado com SDK Tools
2. **Node.js** e **npm** instalados
3. **Java JDK 17** (recomendado)
4. Dependências instaladas: `npm install`

## 🔧 Preparação do Ambiente

### 1. Instalar EAS CLI (Opcional - para build cloud)
```bash
npm install -g eas-cli
eas login
```

### 2. Verificar configurações
```bash
# Verificar se o Android SDK está configurado
echo $ANDROID_HOME

# Verificar Java
java -version
```

## 🏗️ Métodos de Geração de APK

### Método 1: Build Local (Recomendado)

#### Passo 1: Pré-build
```bash
# Instalar dependências
npm install

# Gerar arquivos nativos (se necessário)
npx expo prebuild
```

#### Passo 2: Build de Debug (para testes)
```bash
cd android && ./gradlew assembleDebug
```

#### Passo 3: Build de Release (produção)
```bash
cd android && ./gradlew assembleRelease
```

**APK gerado em:**
```
android/app/build/outputs/apk/release/app-release.apk
```

### Método 2: Via Expo CLI

```bash
# Build de desenvolvimento
npx expo run:android

# Build de produção
npx expo run:android --variant release
```

### Método 3: Via EAS Build (Cloud)

```bash
# Configurar EAS
eas build:configure

# Build para Android
eas build --platform android --profile preview

# Build de produção
eas build --platform android --profile production
```

## 🔑 Assinatura do APK

Para distribuir o APK, você precisa assiná-lo:

### Gerar Keystore (primeira vez)

```bash
# Navegar para a pasta android/app
cd android/app

# Gerar keystore
keytool -genkeypair -v -storetype PKCS12 -keystore my-upload-key.keystore \
  -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

**Informações importantes:**
- **Password**: Escolha uma senha forte e **guarde em local seguro**
- **Alias**: `my-key-alias`
- Preencha os dados solicitados

### Configurar gradle.properties

Crie/edite `android/gradle.properties`:

```properties
MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=*** senha da keystore ***
MYAPP_UPLOAD_KEY_PASSWORD=*** senha da chave ***
```

### Configurar build.gradle

Edite `android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            ...
        }
    }
}
```

## 📱 Instalação e Teste

### Via ADB (Android Debug Bridge)

```bash
# Instalar APK no dispositivo conectado
adb install android/app/build/outputs/apk/release/app-release.apk

# Reinstalar (sobrescrever)
adb install -r android/app/build/outputs/apk/release/app-release.apk

# Desinstalar
adb uninstall com.abauruel.bettersecondsapp
```

### Via compartilhamento de arquivo

1. Copie o APK para o dispositivo
2. No celular, navegue até o arquivo
3. Habilite "Instalar apps de fontes desconhecidas" nas configurações
4. Toque no APK para instalar

## 🧹 Limpeza de Build

Se encontrar problemas, limpe o cache:

```bash
cd android

# Limpar build gradle
./gradlew clean

# Limpar cache completo
./gradlew clean cleanBuildCache

# Voltar para raiz
cd ..

# Limpar cache do Metro
npx expo start --clear

# Limpar node_modules (se necessário)
rm -rf node_modules
npm install
```

## 📋 Checklist Pré-Build

- [ ] Dependências instaladas (`npm install`)
- [ ] Ícones configurados em `app.json`
- [ ] Splash screen configurado
- [ ] Package name correto: `com.abauruel.bettersecondsapp`
- [ ] Version code incrementado (build number)
- [ ] Versão atualizada em `app.json`
- [ ] Permissões configuradas no `AndroidManifest.xml`
- [ ] Keystore gerado e configurado (para produção)
- [ ] Teste em dispositivo real

## 🚀 Build Otimizado de Produção

### 1. Atualizar versão

Edite `app.json`:
```json
{
  "expo": {
    "version": "1.0.0",
    "android": {
      "versionCode": 1
    }
  }
}
```

### 2. Gerar APK assinado

```bash
cd android && ./gradlew assembleRelease
```

### 3. Verificar APK

```bash
# Analisar APK
cd android/app/build/outputs/apk/release
ls -lh app-release.apk

# Ver informações do APK
aapt dump badging app-release.apk | grep package
```

## 🐛 Troubleshooting

### Erro: SDK location not found

Crie `android/local.properties`:
```properties
sdk.dir=/Users/SEU_USUARIO/Library/Android/sdk
```

### Erro: Java version incompatible

Instale JDK 17:
```bash
brew install openjdk@17
```

### Erro: AAPT: error: resource android:attr/lStar not found

Atualize compileSdkVersion em `android/app/build.gradle`:
```gradle
android {
    compileSdkVersion 34
    ...
}
```

### Erro: Execution failed for task ':app:mergeReleaseResources'

```bash
cd android
./gradlew clean
./gradlew assembleRelease --stacktrace
```

## 📊 Tamanho do APK

Para reduzir o tamanho:

1. **Habilitar ProGuard** (ofuscação):
   ```gradle
   buildTypes {
       release {
           minifyEnabled true
           proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
       }
   }
   ```

2. **Habilitar App Bundle**:
   ```bash
   ./gradlew bundleRelease
   ```
   Gera `.aab` em vez de `.apk` (menor e otimizado por dispositivo)

## 🎯 Distribuição

### Google Play Store

1. Gere um **Android App Bundle** (`.aab`):
   ```bash
   cd android && ./gradlew bundleRelease
   ```

2. Upload via [Google Play Console](https://play.google.com/console)

### Distribuição Direta (APK)

1. Compartilhe o APK via:
   - Email
   - Google Drive
   - Firebase App Distribution
   - TestFlight alternativo

## 📚 Resources

- [Expo Build Documentation](https://docs.expo.dev/build/setup/)
- [React Native Android Guide](https://reactnative.dev/docs/signed-apk-android)
- [Android Developer Guide](https://developer.android.com/studio/publish)

## ✅ APK Pronto!

Seu APK está em:
```
android/app/build/outputs/apk/release/app-release.apk
```

Para instalar:
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

