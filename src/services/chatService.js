import { createLocalId } from '../utils/createLocalId';

function buildMockAiReply(message, course) {
  const cleanMessage = message.toLowerCase();
  const completedLessons = Math.round((course.progress / 100) * course.lessons.length);
  const nextLessonIndex = Math.min(completedLessons, course.lessons.length - 1);

  if (cleanMessage.includes('progress')) {
    return `You have completed ${course.progress}% of this course. Try the next lesson to keep your progress moving.`;
  }

  if (
    cleanMessage.includes('next') ||
    cleanMessage.includes('lesson') ||
    cleanMessage.includes('start')
  ) {
    return `You can continue with Lesson ${nextLessonIndex + 1}: ${course.lessons[nextLessonIndex].title}.`;
  }

  if (
    cleanMessage.includes('course') ||
    cleanMessage.includes('learn') ||
    cleanMessage.includes('explain')
  ) {
    return `${course.title} helps you understand ${course.description.toLowerCase()}`;
  }

  if (cleanMessage.includes('hello') || cleanMessage.includes('hi')) {
    return `Hello! I can help you with lessons, progress, and simple questions about ${course.title}.`;
  }

  return 'Try asking about your progress, the next lesson, or what this course teaches.';
}

function buildChatMessage(sender, text) {
  return {
    id: createLocalId(`${sender}-message`),
    sender,
    text,
  };
}

function buildInitialMessage(studentName, courseTitle) {
  return buildChatMessage(
    'ai',
    `Hi ${studentName}, I am your AI Tutor. Ask me about ${courseTitle}.`
  );
}

function createMockSocket({ studentName, course, onOpen, onMessage, onClose, onError, onStatusChange }) {
  let connectTimer = null;
  let replyTimer = null;
  let isClosed = false;

  return {
    connect() {
      onStatusChange('connecting');

      connectTimer = setTimeout(() => {
        if (isClosed) {
          return;
        }

        onStatusChange('connected');
        onOpen();
        onMessage(buildInitialMessage(studentName, course.title));
      }, 500);
    },

    sendMessage(message) {
      if (isClosed) {
        onError('Chat connection is closed.');
        return;
      }

      onStatusChange('connected');

      replyTimer = setTimeout(() => {
        if (isClosed) {
          return;
        }

        onMessage(buildChatMessage('ai', buildMockAiReply(message, course)));
      }, 1000);
    },

    disconnect() {
      isClosed = true;
      clearTimeout(connectTimer);
      clearTimeout(replyTimer);
      onStatusChange('disconnected');
      onClose();
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
  onFallbackToMock,
}) {
  let socket = null;

  return {
    connect() {
      try {
        onStatusChange('connecting');
        socket = new WebSocket(url);

        socket.onopen = () => {
          onStatusChange('connected');
          onOpen();

          // Send a lightweight join event so a real backend can identify the session.
          socket.send(
            JSON.stringify({
              type: 'join',
              studentName,
              courseId: course.id,
              courseTitle: course.title,
            })
          );
        };

        socket.onmessage = (event) => {
          let parsedPayload;

          try {
            parsedPayload = JSON.parse(event.data);
          } catch (error) {
            parsedPayload = { text: event.data };
          }

          const messageText = parsedPayload?.text || parsedPayload?.message || '';

          if (!messageText) {
            return;
          }

          const sender = parsedPayload?.sender === 'student' ? 'student' : 'ai';
          onMessage(buildChatMessage(sender, messageText));
        };

        socket.onerror = () => {
          onStatusChange('disconnected');
          onError('Chat connection failed. Falling back to local tutor mode.');
          onFallbackToMock();
        };

        socket.onclose = () => {
          onStatusChange('disconnected');
          onClose();
        };
      } catch (error) {
        onStatusChange('disconnected');
        onError('Chat connection failed. Falling back to local tutor mode.');
        onFallbackToMock();
      }
    },

    sendMessage(message) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        onError('Chat is not connected yet.');
        return;
      }

      socket.send(
        JSON.stringify({
          type: 'message',
          sender: 'student',
          text: message,
          studentName,
          courseId: course.id,
        })
      );
    },

    disconnect() {
      if (socket) {
        socket.close();
      }
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
}) {
  const apiUrl = process.env.EXPO_PUBLIC_TUTOR_WS_URL;
  let activeClient = null;

  const startMockClient = () => {
    activeClient = createMockSocket({
      studentName,
      course,
      onOpen,
      onMessage,
      onClose,
      onError,
      onStatusChange,
    });

    activeClient.connect();
  };

  return {
    connect() {
      if (apiUrl && typeof WebSocket !== 'undefined') {
        activeClient = createWebSocketClient({
          url: apiUrl,
          studentName,
          course,
          onOpen,
          onMessage,
          onClose,
          onError,
          onStatusChange,
          onFallbackToMock: startMockClient,
        });

        activeClient.connect();
        return;
      }

      startMockClient();
    },

    sendMessage(message) {
      activeClient?.sendMessage(message);
    },

    disconnect() {
      activeClient?.disconnect();
    },
  };
}
