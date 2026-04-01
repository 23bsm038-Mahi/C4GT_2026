import NetInfo from '@react-native-community/netinfo';
import appConfig from '../config/appConfig';
import { createLocalId } from '../utils/createLocalId';

function buildChatMessage(sender, text, messageId = '') {
  return {
    id: messageId || createLocalId(`${sender}-message`),
    sender,
    text,
  };
}

function logTutor(message, details) {
  console.log(`[Tutor] ${message}`, details || {});
}

function shouldTreatTutorFallbackAsError(reason) {
  if (reason === 'invalid_url') {
    return appConfig.tutor.liveRequired;
  }

  return true;
}

function nextReconnectDelay(attempt) {
  const safeAttempt = Math.max(1, attempt);
  const baseDelay = appConfig.tutor.reconnectBaseDelayMs * (2 ** (safeAttempt - 1));
  const jitter = Math.floor(Math.random() * 400);

  return Math.min(15000, baseDelay + jitter);
}

function looksLikePlaceholderUrl(url) {
  return /example\.gov\.in|example\.com|localhost\/?$/.test(String(url || '').trim());
}

function isValidTutorUrl(url) {
  const trimmedUrl = String(url || '').trim();

  if (!trimmedUrl || looksLikePlaceholderUrl(trimmedUrl)) {
    return false;
  }

  return /^wss?:\/\//i.test(trimmedUrl);
}

function createMockTutorReply(message, courseTitle) {
  const text = String(message || '').toLowerCase();

  if (/progress|complete|completed/.test(text)) {
    return `You are making steady progress in ${courseTitle}. Finish the next lesson and check back for an updated completion score.`;
  }

  if (/next|lesson|what should i do/.test(text)) {
    return `Start with the next lesson in ${courseTitle}, then try explaining the key idea in your own words.`;
  }

  if (/help|stuck|confused/.test(text)) {
    return `Try breaking the task into one small step. Read the lesson once, note one idea, and then ask me about that part.`;
  }

  if (/course|about|explain/.test(text)) {
    return `${courseTitle} is designed to build practical skills through short lessons and guided practice.`;
  }

  return `I am in local tutor mode right now, but I can still help with ${courseTitle}. Ask about the lesson, your progress, or what to do next.`;
}

function createLocalTutorClient({
  studentName,
  course,
  onOpen,
  onMessage,
  onClose,
  onStatusChange,
  onTypingChange,
  onQueueChange,
}) {
  let isConnected = false;
  let replyTimer = null;
  const pendingMessages = [];

  const publishQueueLength = () => {
    onQueueChange(pendingMessages.length);
  };

  const clearReplyTimer = () => {
    if (replyTimer) {
      clearTimeout(replyTimer);
      replyTimer = null;
    }
  };

  const flushPendingMessages = () => {
    if (!isConnected) {
      return;
    }

    while (pendingMessages.length) {
      const payload = pendingMessages.shift();
      const replyText = createMockTutorReply(payload.text, course.title);
      onTypingChange(true);

      clearReplyTimer();
      replyTimer = setTimeout(() => {
        onTypingChange(false);
        onMessage(buildChatMessage('ai', replyText));
      }, 450);
    }

    publishQueueLength();
  };

  return {
    connect() {
      isConnected = true;
      onStatusChange('connected');
      onOpen();
      logTutor('Tutor fallback mode active', { studentName, courseId: course.id });
      onMessage(buildChatMessage('ai', `Tutor is running in local mode for ${course.title}.`));
      flushPendingMessages();
    },

    sendMessage(message) {
      pendingMessages.push({
        text: message,
        id: createLocalId('local-tutor'),
      });
      publishQueueLength();
      flushPendingMessages();
    },

    notifyTyping(isTyping) {
      onTypingChange(Boolean(isTyping));
    },

    reconnect() {
      this.connect();
    },

    disconnect() {
      isConnected = false;
      clearReplyTimer();
      onTypingChange(false);
      onClose();
    },

    getAvailability() {
      return true;
    },
  };
}

function createWebSocketClient({
  url,
  studentName,
  course,
  onOpen,
  onMessage,
  onClose,
  onError,
  onStatusChange,
  onTypingChange,
  onQueueChange,
  onAvailabilityChange,
  onFallbackRequested,
}) {
  let socket = null;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let connectTimeout = null;
  let currentSocketId = 0;
  let closedByUser = false;
  let networkUnsubscribe = null;
  let isOnline = true;
  const pendingMessages = [];
  const seenMessageKeys = new Set();

  const publishQueueLength = () => {
    onQueueChange(pendingMessages.length);
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const clearConnectTimeout = () => {
    if (connectTimeout) {
      clearTimeout(connectTimeout);
      connectTimeout = null;
    }
  };

  const rememberMessageKey = (key) => {
    if (!key) {
      return false;
    }

    if (seenMessageKeys.has(key)) {
      return true;
    }

    seenMessageKeys.add(key);
    if (seenMessageKeys.size > 50) {
      const oldestKey = seenMessageKeys.values().next().value;
      seenMessageKeys.delete(oldestKey);
    }

    return false;
  };

  const queuePayload = (payload) => {
    if (
      payload.type === 'message'
      && pendingMessages.some((item) => item.clientMessageId === payload.clientMessageId)
    ) {
      return;
    }

    pendingMessages.push(payload);
    publishQueueLength();
  };

  const flushPendingMessages = () => {
    while (pendingMessages.length && socket?.readyState === WebSocket.OPEN) {
      const payload = pendingMessages.shift();
      socket.send(JSON.stringify(payload));
    }

    publishQueueLength();
  };

  const sendPayload = (payload) => {
    if (!isOnline || socket?.readyState !== WebSocket.OPEN) {
      queuePayload(payload);
      return;
    }

    socket.send(JSON.stringify(payload));
  };

  const activateFallback = (reason, errorMessage = '') => {
    clearReconnectTimer();
    clearConnectTimeout();
    onAvailabilityChange(false);
    onStatusChange('disconnected');
    if (errorMessage && shouldTreatTutorFallbackAsError(reason)) {
      onError(errorMessage);
    }
    logTutor('Tutor fallback mode active', { reason });
    onFallbackRequested();
  };

  const scheduleReconnect = () => {
    if (closedByUser) {
      return;
    }

    if (reconnectAttempt >= appConfig.tutor.reconnectAttempts) {
      activateFallback('max_retries', 'Real-time tutor is unavailable right now. Switching to local tutor mode.');
      return;
    }

    reconnectAttempt += 1;
    onStatusChange('reconnecting');
    const delay = nextReconnectDelay(reconnectAttempt);
    logTutor('Retrying connection...', {
      attempt: reconnectAttempt,
      delayMs: delay,
    });

    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      connectSocket();
    }, delay);
  };

  const handleIncomingMessage = (rawData) => {
    let payload;

    try {
      payload = JSON.parse(rawData);
    } catch (error) {
      payload = { type: 'message', text: rawData };
    }

    if (payload?.type === 'typing') {
      onTypingChange(Boolean(payload?.active));
      return;
    }

    const messageText = payload?.text || payload?.message || '';
    const messageKey =
      payload?.id
      || payload?.messageId
      || `${payload?.sender || 'ai'}:${messageText}`;

    if (!messageText || rememberMessageKey(messageKey)) {
      return;
    }

    onTypingChange(false);
    onMessage(buildChatMessage(
      payload?.sender === 'student' ? 'student' : 'ai',
      messageText,
      messageKey
    ));
  };

  const connectSocket = () => {
    if (!isOnline) {
      logTutor('Retrying connection...', { reason: 'offline' });
      return;
    }

    currentSocketId += 1;
    const socketId = currentSocketId;

    try {
      socket = new WebSocket(url);
    } catch (error) {
      activateFallback('socket_create_failed', 'Tutor connection could not be created. Switching to local tutor mode.');
      return;
    }

    clearConnectTimeout();
    connectTimeout = setTimeout(() => {
      if (socketId !== currentSocketId || socket?.readyState === WebSocket.OPEN) {
        return;
      }

      try {
        socket?.close();
      } catch (error) {
        // Ignore close failures and let reconnect logic handle the transition.
      }
    }, 8000);

    socket.onopen = () => {
      if (socketId !== currentSocketId) {
        socket.close();
        return;
      }

      clearConnectTimeout();
      reconnectAttempt = 0;
      onAvailabilityChange(true);
      onStatusChange('connected');
      onTypingChange(false);
      onOpen();
      logTutor('Tutor connected', { url });

      sendPayload({
        type: 'join',
        studentName,
        courseId: course.id,
        courseTitle: course.title,
      });
      flushPendingMessages();
    };

    socket.onmessage = (event) => {
      if (socketId !== currentSocketId) {
        return;
      }

      clearConnectTimeout();
      handleIncomingMessage(event.data);
    };

    socket.onerror = () => {
      if (socketId !== currentSocketId) {
        return;
      }

      onError('The tutor connection is unstable. Trying to reconnect...');
    };

    socket.onclose = () => {
      if (socketId !== currentSocketId) {
        return;
      }

      clearConnectTimeout();
      onClose();
      onTypingChange(false);

      if (closedByUser) {
        onStatusChange('disconnected');
        return;
      }

      scheduleReconnect();
    };
  };

  const watchNetwork = () => {
    networkUnsubscribe = NetInfo.addEventListener((state) => {
      const nextOnline = typeof state.isInternetReachable === 'boolean'
        ? Boolean(state.isConnected) && state.isInternetReachable
        : Boolean(state.isConnected);

      if (nextOnline === isOnline) {
        return;
      }

      isOnline = nextOnline;

      if (isOnline) {
        logTutor('Retrying connection...', { reason: 'network_restored' });
        if (socket?.readyState === WebSocket.OPEN) {
          flushPendingMessages();
        } else {
          reconnectAttempt = 0;
          clearReconnectTimer();
          connectSocket();
        }
      }
    });
  };

  return {
    async connect() {
      if (!isValidTutorUrl(url)) {
        logTutor('Tutor backend unavailable, using local tutor mode', {
          configuredUrl: url || '',
          liveRequired: appConfig.tutor.liveRequired,
        });
        activateFallback('invalid_url', 'Tutor backend is not configured. Switching to local tutor mode.');
        return;
      }

      const state = await NetInfo.fetch().catch(() => null);
      isOnline = typeof state?.isInternetReachable === 'boolean'
        ? Boolean(state?.isConnected) && state.isInternetReachable
        : Boolean(state?.isConnected ?? true);

      watchNetwork();
      onStatusChange('connecting');

      if (!isOnline) {
        onError('You are offline. Messages will be sent when the connection comes back.');
      }

      connectSocket();
    },

    sendMessage(message) {
      sendPayload({
        type: 'message',
        clientMessageId: createLocalId('chat-client'),
        sender: 'student',
        text: message,
        studentName,
        courseId: course.id,
      });
    },

    notifyTyping(isTyping) {
      sendPayload({
        type: 'typing',
        active: Boolean(isTyping),
        studentName,
        courseId: course.id,
      });
    },

    reconnect() {
      closedByUser = false;
      reconnectAttempt = 0;
      clearReconnectTimer();
      clearConnectTimeout();

      if (socket?.readyState === WebSocket.OPEN) {
        flushPendingMessages();
        return;
      }

      connectSocket();
    },

    disconnect() {
      closedByUser = true;
      clearReconnectTimer();
      clearConnectTimeout();
      onTypingChange(false);

      if (typeof networkUnsubscribe === 'function') {
        networkUnsubscribe();
        networkUnsubscribe = null;
      }

      if (socket) {
        socket.close();
      }
    },

    getAvailability() {
      return socket?.readyState === WebSocket.OPEN;
    },
  };
}

export function createTutorChatService({
  studentName,
  course,
  onOpen,
  onMessage,
  onClose,
  onError,
  onStatusChange,
  onTypingChange,
  onQueueChange,
  onAvailabilityChange = () => {},
}) {
  const wsUrl = appConfig.tutor.webSocketUrl;
  let activeClient = null;
  let usingFallback = false;

  const switchToLocalTutor = () => {
    usingFallback = true;
    activeClient?.disconnect?.();
    activeClient = createLocalTutorClient({
      studentName,
      course,
      onOpen,
      onMessage,
      onClose,
      onStatusChange,
      onTypingChange,
      onQueueChange,
    });
    onAvailabilityChange(false);
    activeClient.connect();
  };

  return {
    connect() {
      usingFallback = false;

      activeClient = createWebSocketClient({
        url: wsUrl,
        studentName,
        course,
        onOpen,
        onMessage,
        onClose,
        onError,
        onStatusChange,
        onTypingChange,
        onQueueChange,
        onAvailabilityChange,
        onFallbackRequested: switchToLocalTutor,
      });

      activeClient.connect();
    },

    sendMessage(message) {
      activeClient?.sendMessage(message);
    },

    notifyTyping(isTyping) {
      activeClient?.notifyTyping(isTyping);
    },

    reconnect() {
      if (usingFallback) {
        logTutor('Tutor fallback mode active', { action: 'manual_reconnect' });
      }

      activeClient?.reconnect();
    },

    disconnect() {
      activeClient?.disconnect();
    },

    getAvailability() {
      return activeClient?.getAvailability?.() ?? false;
    },
  };
}
