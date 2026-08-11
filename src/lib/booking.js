// How far ahead customers can book a drop-off.
// Must stay in step with the horizon in the booking_requests insert policy —
// if this is larger, the form will offer days the database then refuses.
export const BOOKING_HORIZON_DAYS = 120
