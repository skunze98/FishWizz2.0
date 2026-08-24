import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.atlasfishing.os',
  appName: 'Atlas Fishing OS',
  // The app is now built with Vite; ship the build output, not the source tree.
  webDir: '../dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    Geolocation: {
      permissions: ['location']
    }
  }
};

export default config;
