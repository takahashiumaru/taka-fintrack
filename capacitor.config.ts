import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'id.takahashiumaru.takafintrack',
  appName: 'Taka FinTrack',
  webDir: 'public',
  server: {
    url: 'https://takahashiumaru.my.id',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#F4F9FF',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
