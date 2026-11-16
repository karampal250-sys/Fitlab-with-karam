// Reference unit test specification for FitPlate Firestore Security Rules
// Verifies the Dirty Dozen attack payloads against rules_version = '2'.

export const dirtyDozenCases = [
  { name: '01. Unauthenticated read on /users/userA', expected: 'PERMISSION_DENIED' },
  { name: '02. Cross-user read by userB on /users/userA', expected: 'PERMISSION_DENIED' },
  { name: '03. Cross-user write by userB to /users/userA/foodLogs/log1', expected: 'PERMISSION_DENIED' },
  { name: '04. UID spoofing inside body on /users/userA/foodLogs/log1', expected: 'PERMISSION_DENIED' },
  { name: '05. Unverified email write on /users/userA', expected: 'PERMISSION_DENIED' },
  { name: '06. Shadow field injection (isAdmin: true) on /users/userA', expected: 'PERMISSION_DENIED' },
  { name: '07. ID poisoning with invalid characters on /users/userA/foodLogs/bad$id', expected: 'PERMISSION_DENIED' },
  { name: '08. Calorie target below 1200 kcal floor on /users/userA', expected: 'PERMISSION_DENIED' },
  { name: '09. Backdated client timestamp on /users/userA/foodLogs/log1', expected: 'PERMISSION_DENIED' },
  { name: '10. Immutable createdAt tampering on /users/userA update', expected: 'PERMISSION_DENIED' },
  { name: '11. Oversized allergies array (>15 items) on /users/userA', expected: 'PERMISSION_DENIED' },
  { name: '12. Cross-user list query by userB on /users/userA/foodLogs', expected: 'PERMISSION_DENIED' },
];
