import {registerPlugin} from '@capacitor/core';
import {LocalNotifications} from '@capacitor/local-notifications';
export const AppHealth=registerPlugin('AppHealth');
export const StudyAlarm=registerPlugin('StudyAlarm');
export const Notifications=LocalNotifications;
