import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeBaseUrl, resolveBaseUrl } from '../utils/baseUrl';

export const AppConfigType = {
  isDev: Config.APP_CONFIG === 'development',
  isProd: Config.APP_CONFIG === 'production',
};

export type Server = {
  id: string;
  label: string; // short name shown next to the address on the sign-in screen
  configUrl: string; // online file naming the server ({"base_url": ...})
  defaultUrl: string; // used until that file has been fetched once
};

// Servers the sign-in screen cycles through when the address is tapped.
const GIST = 'https://gist.githubusercontent.com/priyankas9';
const BUILT_IN_SERVERS: Server[] = [
  {
    id: 'production',
    label: 'PROD',
    configUrl: `${GIST}/1fe13469bef34e3a1b471297d7353c24/raw/base-imis-prod.json`,
    defaultUrl: 'https://imis.innovativesolution.com.np',
  },
  {
    id: 'production-muninfosys',
    label: 'MUNINFOSYS',
    configUrl: `${GIST}/fb4a4fe5ae03ad50cf0c3cd529465b3a/raw/base-imis-prod.1.json`,
    defaultUrl: 'https://imis.muninfosys.com',
  },
  {
    id: 'staging',
    label: 'STAGING',
    configUrl: `${GIST}/8880a82d3720108f6cc2ec5fd83938d4/raw/base-imis-dev.json`,
    defaultUrl: 'https://imis-base-staging.innovativesolution.com.np',
  },
];

// CONFIG_URL in .env picks the server used until the user switches; an unknown
// URL becomes an extra "CUSTOM" server falling back to the .env BASE_URL.
const envConfigUrl = Config.CONFIG_URL || '';
const SERVERS: Server[] =
  envConfigUrl && !BUILT_IN_SERVERS.some((s) => s.configUrl === envConfigUrl)
    ? [
        ...BUILT_IN_SERVERS,
        {
          id: 'custom',
          label: 'CUSTOM',
          configUrl: envConfigUrl,
          defaultUrl: normalizeBaseUrl(Config.BASE_URL ?? '') ?? '',
        },
      ]
    : BUILT_IN_SERVERS;

const DEFAULT_SERVER_ID =
  SERVERS.find((s) => s.configUrl === envConfigUrl)?.id ??
  (AppConfigType.isProd ? 'production' : 'staging');

const SERVER_ID_KEY = 'serverId';
const ACTIVE_URL_KEY = 'activeBaseUrl';
const LEGACY_URL_KEY = 'remoteBaseUrl'; // used by 1.0.9 before servers could be switched

let serverId = DEFAULT_SERVER_ID;
// Address of every server, filled at startup so switching needs no network.
const serverUrls: Record<string, string> = Object.fromEntries(
  SERVERS.map((s) => [s.id, s.defaultUrl])
);

export const getServers = () => SERVERS;
export const getServerId = () => serverId;
export const getServer = () => SERVERS.find((s) => s.id === serverId)!;

// The API server, without a trailing slash. Read it when making a request, not
// when a module loads: it can change.
export const getBaseUrl = () => serverUrls[serverId] ?? '';

// Startup: fetch every server's file at once (each falls back to its last good
// address, then its built-in one) and restore the server chosen last time.
// `changed` is true when the active address differs from the one used last
// time, so the caller can drop the old login.
export const loadBaseUrl = async () => {
  const savedId = await AsyncStorage.getItem(SERVER_ID_KEY).catch(() => null);
  if (savedId && SERVERS.some((s) => s.id === savedId)) serverId = savedId;

  const results = await Promise.all(
    SERVERS.map((s) =>
      resolveBaseUrl({
        configUrl: s.configUrl,
        fallback: s.defaultUrl,
        storage: AsyncStorage,
        storageKey: `remoteBaseUrl:${s.id}`,
      })
    )
  );
  SERVERS.forEach((s, i) => {
    if (results[i].url) serverUrls[s.id] = results[i].url;
  });

  const changed = await rememberActiveUrl();
  const source = results[SERVERS.findIndex((s) => s.id === serverId)].source;
  console.log('BaseURL', getBaseUrl(), `(${serverId}, ${source})`);
  return { url: getBaseUrl(), source, serverId, changed };
};

// Sign-in screen: move to the next server. Instant, no network call.
export const switchToNextServer = async () => {
  const i = SERVERS.findIndex((s) => s.id === serverId);
  serverId = SERVERS[(i + 1) % SERVERS.length].id;
  await AsyncStorage.setItem(SERVER_ID_KEY, serverId).catch(() => {});
  await rememberActiveUrl();
  console.log('BaseURL', getBaseUrl(), `(${serverId}, switched)`);
  return getServer();
};

const rememberActiveUrl = async () => {
  const url = getBaseUrl();
  const previous =
    (await AsyncStorage.getItem(ACTIVE_URL_KEY).catch(() => null)) ??
    (await AsyncStorage.getItem(LEGACY_URL_KEY).catch(() => null));
  if (url) await AsyncStorage.setItem(ACTIVE_URL_KEY, url).catch(() => {});
  return !!previous && !!url && previous !== url;
};

export const MAX_FILE_SIZE = 5e6; // 5 megabytes

// DEFAULT COMPONENT CONFIGS
export const DEFAULT_ACTIVE_OPACITY = 0.6;
