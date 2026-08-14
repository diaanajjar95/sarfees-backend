/**
 * Trip group lifecycle per master spec §11. Every group is always in
 * exactly one of these states; the state machine's transitions are
 * encoded in GroupingService + AssignmentService (PR 3).
 *
 *   OPEN  → FROZEN  → OFFERING → ASSIGNED → IN_PROGRESS → COMPLETED
 *                 ↘ BROADCASTING ↗
 *                              ↘ UNSERVED_ESCALATION
 *   any pre-IN_PROGRESS → CANCELLED
 */
export enum TripGroupStatus {
  OPEN = 'open',
  FROZEN = 'frozen',
  OFFERING = 'offering',
  BROADCASTING = 'broadcasting',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  UNSERVED_ESCALATION = 'unserved_escalation',
}
