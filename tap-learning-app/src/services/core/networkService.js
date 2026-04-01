import NetInfo from '@react-native-community/netinfo';

export async function isOnline() {
  const state = await NetInfo.fetch();

  if (typeof state.isInternetReachable === 'boolean') {
    return Boolean(state.isConnected) && state.isInternetReachable;
  }

  return Boolean(state.isConnected);
}

export function subscribeToNetworkStatus(onChange) {
  return NetInfo.addEventListener((state) => {
    const online = typeof state.isInternetReachable === 'boolean'
      ? Boolean(state.isConnected) && state.isInternetReachable
      : Boolean(state.isConnected);

    onChange(online);
  });
}
