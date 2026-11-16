#!/usr/bin/env python3
"""Configure the generated Capacitor Android project for reproducible release signing.
Never writes private keys or passwords to source control or build logs.
"""
from pathlib import Path
import os
import re

path=Path("android/app/build.gradle")
source=path.read_text(encoding="utf-8")
keystore=os.environ.get("ANDROID_KEYSTORE_FILE")
password=os.environ.get("ANDROID_SIGNING_PASSWORD")
if not keystore or not password:
    raise SystemExit("Faltam os segredos obrigatórios da assinatura Android.")
if not Path(keystore).is_file():
    raise SystemExit("Arquivo de assinatura Android não encontrado.")
if "signingConfigs" in source:
    raise SystemExit("O template Gradle mudou: ajuste a assinatura manualmente antes de distribuir o APK.")

# Credentials are supplied exclusively via environment variables at build time.
block="""signingConfigs {
        release {
            storeFile file(System.getenv('ANDROID_KEYSTORE_FILE'))
            storePassword System.getenv('ANDROID_SIGNING_PASSWORD')
            keyAlias 'eusereibiologo'
            keyPassword System.getenv('ANDROID_SIGNING_PASSWORD')
            storeType 'pkcs12'
        }
    }
    buildTypes {"""
source, count=re.subn(r"\bbuildTypes\s*\{",block,source,count=1)
if count!=1: raise SystemExit("Bloco buildTypes não encontrado no projeto Android.")
source, count=re.subn(r"(buildTypes\s*\{\s*release\s*\{)",r"\1\n            signingConfig signingConfigs.release",source,count=1)
if count!=1: raise SystemExit("Bloco release não encontrado no projeto Android.")
path.write_text(source,encoding="utf-8")
print("Configuração de assinatura RELEASE aplicada. Nenhum segredo foi impresso.")
