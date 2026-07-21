/**
 * How a cascade offer resolved. Stored on TripOfferHistory so the
 * decline-penalty accumulator + QA audits have a clean signal.
 *
 * PENDING → response not yet recorded (offer live).
 * ACCEPT → driver accepted; group → ASSIGNED.
 * DECLINE → driver actively declined (§9.5 counts toward penalty).
 * TIMEOUT → 30 s window elapsed without a response (counts too).
 * SUPERSEDED → offer withdrawn because another driver accepted
 *              a broadcast round.
 */
export enum OfferResponse {
  PENDING = 'pending',
  ACCEPT = 'accept',
  DECLINE = 'decline',
  TIMEOUT = 'timeout',
  SUPERSEDED = 'superseded',
  /**
   * Driver accepted then cancelled before pickup (§10). Counted as
   * a decline for penalty purposes (driverCancelPenalty ≥ decline).
   * Preserved as a distinct outcome so ops audits can tell the two apart.
   */
  CANCEL_AFTER_ACCEPT = 'cancel_after_accept',
}
