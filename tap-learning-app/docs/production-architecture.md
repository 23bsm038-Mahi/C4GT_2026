# Production Architecture

## Goals

- preserve validated student journeys while replacing prototype-grade internals
- support Android-first, low-bandwidth, low-memory deployments
- keep backend-specific logic isolated for government-scale rollout across partners

## Core Design Decisions

### 1. Repository-Based LMS Integration

`src/services/lmsRepository.js` is the single integration boundary for:

- login
- course catalog
- progress retrieval
- feedback submissions

This keeps screens and hooks independent from Frappe endpoint details and payload shapes.

### 2. Shared Core Services

`src/services/core/` contains reusable primitives:

- `apiClient.js`: JSON requests, timeout handling, retry behavior
- `networkService.js`: online/offline detection
- `storageService.js`: storage abstraction with safe failure handling
- `syncService.js`: offline queue with retry metadata and dedupe support

### 3. Offline-First Strategy

Offline behavior is designed around graceful degradation:

- cache the last known student and course catalog
- prefer live data when reachable
- fall back to local cache when refresh fails
- queue write operations while offline
- retry queued writes on connectivity restoration

Current queue implementation supports feedback submissions and is ready to extend for:

- assignment submissions
- progress events
- assessment attempts

### 4. Tutor Chat Transport

`src/services/chatService.js` now supports:

- WebSocket session setup
- buffered outbound messages during reconnect windows
- bounded reconnect attempts
- local tutor fallback when transport is unavailable

`src/hooks/useTutorChat.js` keeps screen code simple and separates session state from UI rendering.

## Recommended Backend Contracts

### Student Login

Request:

```json
{
  "full_name": "Student Name",
  "mobile_number": "9876543210"
}
```

Preferred response:

```json
{
  "message": {
    "student_id": "STU-0001",
    "api_key": "token-or-api-key"
  }
}
```

### Student Courses

Preferred response:

```json
{
  "message": {
    "courses": [
      {
        "id": 1,
        "title": "Course Title",
        "description": "Course description",
        "category": "Life Skills",
        "department": "TAP",
        "progress": 35,
        "lessons": [
          {
            "id": "lesson-1",
            "title": "Introduction",
            "duration": "10 min"
          }
        ]
      }
    ]
  }
}
```

### Student Progress

Preferred response:

```json
{
  "message": [
    {
      "course_id": 1,
      "progress": 35
    }
  ]
}
```

## Scaling Guidance

- paginate course and lesson payloads for low-memory devices
- pre-compute lightweight dashboard summaries server-side when possible
- keep lesson content fetches incremental instead of bundling entire journeys
- prefer append-only progress events or versioned updates for conflict resolution
- expose backend timestamps and record versions for future sync reconciliation

## Next Backend-Dependent Work

- replace assumed Frappe response fields with confirmed TAP LMS contracts
- add authenticated refresh token or signed session flow if required by deployment
- implement assignment submission APIs through the same sync queue
- persist tutor chat history if policy allows
- add analytics and observability hooks for sync failures, crash reporting, and slow endpoints
