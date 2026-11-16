import {registerPlugin} from '@capacitor/core';
import {TextToSpeech} from '@capacitor-community/text-to-speech';
// Este módulo é compilado somente para o APK, nunca para o GitHub Pages.
export const StudySpeech = registerPlugin('StudySpeech');

// Motor TTS comunitário, mantido para Capacitor 8.
export const CommunitySpeech=TextToSpeech;
