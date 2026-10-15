const browserHostname =
  typeof window === "undefined" ? "localhost" : window.location.hostname;
const browserProtocol =
  typeof window === "undefined" ? "http:" : window.location.protocol;
const localHostAliases = new Set(["localhost", "127.0.0.1", "::1"]);
const configuredApiUrl = import.meta.env.VITE_API_BASE_URL;
const configuredApiUsesLoopback = configuredApiUrl
  ? localHostAliases.has(new URL(configuredApiUrl).hostname)
  : false;
const useDevelopmentProxy =
  import.meta.env.DEV &&
  (!configuredApiUrl || configuredApiUsesLoopback);
const useBrowserHost = !configuredApiUrl;

export const API_BASE_URL =
  useDevelopmentProxy
    ? ""
    : useBrowserHost
      ? `${browserProtocol}//${browserHostname}:5000`
      : configuredApiUrl.replace(/\/+$/, "");
