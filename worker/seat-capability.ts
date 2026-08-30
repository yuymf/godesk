const encoder = new TextEncoder();

export interface StoredSessionSeat {
  seat: number;
  seatTokenHash: string;
  displayName?: string;
}

export interface PublicSessionSeat {
  seat: number;
  displayName?: string;
}

export async function hashSeatToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function issueSeatToken() {
  return `seat_${crypto.randomUUID()}`;
}

export function publicSeats(seats: StoredSessionSeat[]): PublicSessionSeat[] {
  return seats.map(({ seat, displayName }) => ({
    seat,
    ...(displayName ? { displayName } : {}),
  }));
}

export async function seatForToken(
  seats: StoredSessionSeat[],
  seat: number,
  seatToken: string,
) {
  const hash = await hashSeatToken(seatToken);
  return seats.find((entry) => entry.seat === seat && entry.seatTokenHash === hash);
}

export function otherSeatForHash(
  seats: StoredSessionSeat[],
  seat: number,
  seatTokenHash: string,
) {
  return seats.find(
    (entry) => entry.seat !== seat && entry.seatTokenHash === seatTokenHash,
  );
}
