# DMP 2026 Selection Plan

## What The Reviewers Will Care About

For this problem, selection is likely to depend on whether you show:

- clear understanding of the real scope
- mobile-first architectural thinking
- realistic phased execution
- ability to integrate with existing systems
- ability to work in low-resource public education contexts

## What To Say In Your Application

Use something close to this:

> I have already implemented and tested the core student journey as a frontend prototype: onboarding, dashboard, course detail, and progress flow. I understand that the actual DMP 2026 problem is significantly broader and requires a React Native Android application integrated with TAP's Frappe LMS, WebSocket-based AI tutor chat, offline support, DIKSHA compatibility, and a partner whitelisting model. My plan is to use the current prototype as a validated product baseline and build the actual solution in phased milestones with backend integration from the start.

## Strong Technical Plan

### Phase 1

- React Native app setup
- environment config
- API client and auth scaffolding
- onboarding screens

### Phase 2

- fetch student courses from Frappe
- render dashboard and course details
- handle loading and error states

### Phase 3

- submissions and progression APIs
- lesson completion state
- teacher or system feedback display

### Phase 4

- WebSocket AI tutor chat
- retry and reconnect behavior
- message persistence

### Phase 5

- offline caching with sync queue
- partner module whitelist rules
- DIKSHA integration boundaries and adapter design

## Risks To Mention

Mentioning risks makes you sound more mature:

- backend API shape may change during integration
- offline sync conflicts need careful design
- partner modules need clear security boundaries
- DIKSHA interoperability may need adapter mapping

## Simple Architecture Pitch

```text
UI Screens
  -> App State
  -> API / WebSocket Services
  -> Offline Storage Layer
  -> Frappe LMS / AI Tutor / Partner Modules / DIKSHA
```

## Ready-To-Paste Issue Comment

```text
I reviewed the project scope carefully. The key challenge is not only building screens, but designing a mobile-first React Native architecture that works reliably with TAP's existing Frappe LMS, AI Tutor chat over WebSockets, offline-first sync, and partner whitelisting for public education deployments.

I already have a frontend prototype for the core student journey (onboarding, dashboard, course detail, progress), and I would use that as a product baseline while implementing the real solution in phases:

1. React Native Android scaffold and project structure
2. Frappe LMS API integration for onboarding, courses, lessons, and progress
3. Core learning interaction and submission flows
4. WebSocket-based AI Tutor chat
5. Offline caching and sync
6. DIKSHA interoperability exploration and partner whitelisting architecture

By the mid-point milestone, I aim to deliver a working Android scaffold with onboarding and Frappe-backed learning flows functional end-to-end.
```

## Honest Positioning

Do not say:

- "The project is complete"
- "The current repo fully solves the problem"

Say:

- "The current repo validates the user flow"
- "The next step is migration into the real mobile architecture"
- "I understand the integration and deployment complexity"
