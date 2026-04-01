import { useEffect, useRef, useState } from 'react';
import { createLocalId } from '../utils/createLocalId';
import { createTutorChatService } from '../services/chatService';
import { captureAppError, getFriendlyErrorMessage } from '../services/core/errorService';

function isExpectedTutorFallbackMessage(message) {
  return /tutor backend is not configured|switching to local tutor mode/i.test(String(message || ''));
}

function buildStudentMessage(text) {
  return {
    id: createLocalId('student-message'),
    sender: 'student',
    text,
  };
}

function useTutorChat({ studentName, course, enabled }) {
  const [messages, setMessages] = useState([]);
  const [connectionState, setConnectionState] = useState(enabled ? 'connecting' : 'disconnected');
  const [chatError, setChatError] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isTutorTyping, setIsTutorTyping] = useState(false);
  const [queuedMessageCount, setQueuedMessageCount] = useState(0);
  const chatServiceRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !course) {
      setMessages([]);
      setChatError('');
      setIsSendingMessage(false);
      setIsTutorTyping(false);
      setQueuedMessageCount(0);
      setConnectionState('disconnected');
      chatServiceRef.current?.disconnect();
      chatServiceRef.current = null;
      return undefined;
    }

    setMessages([]);
    setChatError('');
    setIsSendingMessage(false);
    setIsTutorTyping(false);
    setQueuedMessageCount(0);
    setConnectionState('connecting');

    const chatService = createTutorChatService({
      studentName,
      course,
      onOpen: () => {
        if (!isMountedRef.current) {
          return;
        }

        setChatError('');
      },
      onMessage: (message) => {
        if (!isMountedRef.current) {
          return;
        }

        const messageKey = `${message.sender}:${message.text}`;

        setMessages((currentMessages) => {
          const duplicateExists = currentMessages.some(
            (item) => item.id === message.id || `${item.sender}:${item.text}` === messageKey
          );

          if (duplicateExists) {
            return currentMessages;
          }

          return [...currentMessages, message];
        });
        setIsSendingMessage(false);
      },
      onClose: () => {
        if (!isMountedRef.current) {
          return;
        }

        setIsSendingMessage(false);
        setIsTutorTyping(false);
      },
      onError: (message) => {
        if (!isMountedRef.current) {
          return;
        }

        const friendlyMessage = getFriendlyErrorMessage(new Error(message), 'tutor');
        setChatError(friendlyMessage);
        setIsSendingMessage(false);
        if (!isExpectedTutorFallbackMessage(message)) {
          captureAppError(new Error(message), { label: 'Tutor chat' });
        }
      },
      onStatusChange: (status) => {
        if (!isMountedRef.current) {
          return;
        }

        setConnectionState(status);
      },
      onTypingChange: (isTyping) => {
        if (!isMountedRef.current) {
          return;
        }

        setIsTutorTyping(Boolean(isTyping));
        if (isTyping) {
          setIsSendingMessage(true);
        }
      },
      onQueueChange: (queueLength) => {
        if (!isMountedRef.current) {
          return;
        }

        setQueuedMessageCount(queueLength);
      },
    });

    chatServiceRef.current = chatService;
    chatService.connect();

    return () => {
      chatService.disconnect();
      chatServiceRef.current = null;
    };
  }, [course, enabled, studentName]);

  const sendMessage = (text) => {
    const cleanText = text.trim();

    if (!cleanText) {
      return false;
    }

    setMessages((currentMessages) => [...currentMessages, buildStudentMessage(cleanText)]);
    setIsSendingMessage(true);
    setChatError('');
    chatServiceRef.current?.sendMessage(cleanText);

    return true;
  };

  const notifyTyping = (isTyping) => {
    chatServiceRef.current?.notifyTyping(Boolean(isTyping));
  };

  const retryConnection = () => {
    setChatError('');
    setConnectionState('connecting');
    chatServiceRef.current?.reconnect();
  };

  return {
    messages,
    connectionState,
    chatError,
    isSendingMessage,
    isTutorTyping,
    queuedMessageCount,
    sendMessage,
    notifyTyping,
    retryConnection,
  };
}

export default useTutorChat;
