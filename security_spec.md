# FitPlate Security Specification

## 1. Data Invariants
1. All health profile data, food logs, daily metrics, custom foods, favorites, progress entries, and AI coach plans belong strictly to a single authenticated, email-verified user (`request.auth.uid == userId`).
2. Every subcollection document under `/users/{userId}/...` requires the parent `/users/{userId}` document to exist (Master Gate), except during initial profile creation on `/users/{userId}`.
3. `uid` inside every document must equal `request.auth.uid` on `create` and remain immutable on `update`.
4. `createdAt` must equal `request.time` on `create` and remain immutable on `update`; `updatedAt` must equal `request.time` on `create` and `update`.
5. All document path IDs (`userId`, `logId`, `dateId`, `foodId`, `entryId`, `planId`) must match `^[a-zA-Z0-9_\-]+$` and stay within `1..128` characters.
6. Daily calorie targets obey strict bounds (`>= 1200` and `<= 6000` kcal) to prevent poisoned targets.
7. Users may delete their own records and profile to support GDPR / privacy account deletion.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read**: Anonymous client reads `/users/userA`.
2. **Cross-user profile read (PII leak)**: `userB` reads `/users/userA`.
3. **Cross-user write spoofing**: `userB` creates `/users/userA/foodLogs/log1` with `uid: "userB"`.
4. **UID spoofing in body**: `userA` creates `/users/userA/foodLogs/log1` with `uid: "userB"`.
5. **Unverified email write**: `userA` with `email_verified: false` writes `/users/userA`.
6. **Shadow / Ghost field injection**: `userA` creates `/users/userA` with extra field `isAdmin: true`.
7. **ID poisoning**: `userA` creates `/users/userA/foodLogs/bad$id..with..chars`.
8. **Type / Boundary poisoning (unsafe calories)**: `userA` sets `dailyCalorieTarget: 200` (< 1200 safety floor).
9. **Client timestamp forgery**: `userA` creates `/users/userA/foodLogs/log1` with backdated `createdAt`.
10. **Immutable field tampering**: `userA` updates `/users/userA` changing `createdAt` or `uid`.
11. **Oversized array / string DoS**: `userA` submits `allergies` array with 50 items or `name` of 500 chars.
12. **Blanket list query by non-owner**: `userB` lists `/users/userA/foodLogs`.
