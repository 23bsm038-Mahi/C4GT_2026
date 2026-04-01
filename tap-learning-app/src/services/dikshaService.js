import {
  cacheDikshaContent,
  getCachedDikshaContent,
  getDikshaCacheStatus,
} from './offlineService';
import { dikshaProvider } from './contentProviderService';

export async function fetchDikshaContent() {
  const cachedItems = await getCachedDikshaContent();
  const cacheStatus = await getDikshaCacheStatus().catch(() => ({
    hasData: cachedItems.length > 0,
    isExpired: false,
  }));

  if (cacheStatus.hasData && !cacheStatus.isExpired) {
    return {
      items: cachedItems,
      source: 'cache',
    };
  }

  try {
    const items = await dikshaProvider.fetchContent();
    await cacheDikshaContent(items);

    return {
      items,
      source: 'live',
    };
  } catch (error) {
    if (cachedItems.length) {
      return {
        items: cachedItems,
        source: 'cache',
      };
    }

    throw error;
  }
}
