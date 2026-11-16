import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeBaseUrl, resolveBaseUrl } from '../utils/baseUrl';

export const AppConfigType = {
  isDev: Config.APP_CONFIG === 'development',
  isProd: Config.APP_CONFIG === 'production',
};

export type Server = { id: string; label: string; configUrl: string };

// Servers the user can pick on the sign-in screen. Each online file names the
// API server ({"base_url": ...}), so an address can change without a new app.
const GIST = 'https://gist.githubusercontent.com/priyankas9';
const BUILT_IN_SERVERS: Server[] = [
  {
    id: 'production',
    label: 'Production',
    configUrl: `${GIST}/1fe13469bef34e3a1b471297d7353c24/raw/base-imis-prod.json`,
  },
  {
    id: 'production-muninfosys',
    label: 'Production (muninfosys)',
    configUrl: `${GIST}/fb4a4fe5ae03ad50cf0c3cd529465b3a/raw/base-imis-prod.1.json`,
  },
  {
    id: 'staging',
    label: 'Staging',
    configUrl: `${GIST}/8880a82d3720108f6cc2ec5fd83938d4/raw/base-imis-dev.json`,
  },
];

// CONFIG_URL in .env picks the default server; an unknown URL becomes "Custom".
const envConfigUrl = Config.CONFIG_URL || '';
const SERVERS: Server[] =
  envConfigUrl && !BUILT_IN_SERVERS.some((s) => s.configUrl === envConfigUrl)
    ? [...BUILT_IN_SERVERS, { id: 'custom', label: 'Custom', configUrl: envConfigUrl }]
    : BUILT_IN_SERVERS;

const DEFAULT_SERVER_ID =
  SERVERS.find((s) => s.configUrl === envConfigUrl)?.id ??
  (AppConfigType.isProd ? 'production' : 'staging');

const SERVER_ID_KEY = 'serverId';
const ACTIVE_URL_KEY = 'activeBaseUrl';
const LEGACY_URL_KEY = 'remoteBaseUrl'; // used by 1.0.9 before the server picker
const BUILT_IN_URL = normalizeBaseUrl(Config.BASE_URL ?? '') ?? '';

let serverId = DEFAULT_SERVER_ID;
let baseUrl = BUILT_IN_URL;

export const getServers = () => SERVERS;
export const getServerId = () => serverId;

// The API server, without a trailing slash, or '' if it could not be loaded.
// Read it when making a request, not when a module loads: it can change.
export const getBaseUrl = () => baseUrl;

// Loads the address of the selected server. `changed` is true when it differs
// from the server used last time, so the caller can drop the old login.
export const loadBaseUrl = async () => {
  const savedId = await AsyncStorage.getItem(SERVER_ID_KEY).catch(() => null);
  if (savedId && SERVERS.some((s) => s.id === savedId)) serverId = savedId;
  const server = SERVERS.find((s) => s.id === serverId)!;

  const result = await resolveBaseUrl({
    configUrl: server.configUrl,
    // Only the build's own server may fall back to the .env address; for any
    // other choice that would silently connect to the wrong server.
    fallback: server.id === DEFAULT_SERVER_ID ? BUILT_IN_URL : '',
    storage: AsyncStorage,
    storageKey: `remoteBaseUrl:${server.id}`,
  });
  baseUrl = result.url;

  const previous =
    (await AsyncStorage.getItem(ACTIVE_URL_KEY).catch(() => null)) ??
    (await AsyncStorage.getItem(LEGACY_URL_KEY).catch(() => null));
  const changed = !!previous && !!baseUrl && previous !== baseUrl;
  if (baseUrl) await AsyncStorage.setItem(ACTIVE_URL_KEY, baseUrl).catch(() => {});

  console.log('BaseURL', baseUrl || '(none)', `(${server.id}, ${result.source})`);
  return { ...result, serverId: server.id, changed };
};

// Called from the sign-in screen. Saves the choice and loads its address.
export const switchServer = async (id: string) => {
  if (!SERVERS.some((s) => s.id === id)) throw new Error(`Unknown server ${id}`);
  serverId = id;
  await AsyncStorage.setItem(SERVER_ID_KEY, id);
  return loadBaseUrl();
};

export const MAX_FILE_SIZE = 5e6; // 5 megabytes

// DEFAULT COMPONENT CONFIGS
export const DEFAULT_ACTIVE_OPACITY = 0.6;
