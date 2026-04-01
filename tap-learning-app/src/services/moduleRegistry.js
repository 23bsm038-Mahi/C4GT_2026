import moduleWhitelist from '../config/moduleWhitelist';

function getEnvEnabledModules() {
  const rawValue = process.env.EXPO_PUBLIC_ENABLED_MODULES || '';

  if (!rawValue.trim()) {
    return null;
  }

  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isModuleEnabled(moduleKey) {
  const envEnabledModules = getEnvEnabledModules();

  if (envEnabledModules) {
    return envEnabledModules.includes(moduleKey);
  }

  return Boolean(moduleWhitelist[moduleKey]);
}

export function getEnabledModules() {
  const envEnabledModules = getEnvEnabledModules();

  if (envEnabledModules) {
    return envEnabledModules;
  }

  return Object.keys(moduleWhitelist).filter((moduleKey) => moduleWhitelist[moduleKey]);
}
