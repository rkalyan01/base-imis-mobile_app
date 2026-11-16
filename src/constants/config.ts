import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { resolveBaseUrl } from '../utils/baseUrl';

export const AppConfigType = {
  isDev: Config.APP_CONFIG === 'development',
  isProd: Config.APP_CONFIG === 'production',
};

// Online files that name the API server for each build ({"base_url": ...}).
// CONFIG_URL in .env overrides them.
const REMOTE_CONFIG_URLS = {
  production:
    'https://gist.githubusercontent.com/priyankas9/1fe13469bef34e3a1b471297d7353c24/raw/base-imis-prod.json',
  development:
    'https://gist.githubusercontent.com/priyankas9/8880a82d3720108f6cc2ec5fd83938d4/raw/base-imis-dev.json',
};

const CONFIG_URL =
  Config.CONFIG_URL ||
  REMOTE_CONFIG_URLS[AppConfigType.isProd ? 'production' : 'development'];

// Start with the build's URL; loadBaseUrl() replaces it before the app renders.
let baseUrl = (Config.BASE_URL ?? '').replace(/\/+$/, '');

// The API server, without a trailing slash. Read it when making a request, not
// when a module loads, because it can change at startup.
export const getBaseUrl = () => baseUrl;

export const loadBaseUrl = async () => {
  const result = await resolveBaseUrl({
    configUrl: CONFIG_URL,
    fallback: baseUrl,
    storage: AsyncStorage,
  });
  baseUrl = result.url;
  console.log('BaseURL', baseUrl, `(${result.source})`);
  return result;
};

export const MAX_FILE_SIZE = 5e6; // 5 megabytes

// DEFAULT COMPONENT CONFIGS
export const DEFAULT_ACTIVE_OPACITY = 0.6;
