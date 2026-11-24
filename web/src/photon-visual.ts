/**
 * In-flight photon marker. Render only: the sim still flies the seeker.
 * The head is a glowing sprite. The trail is a short run of samples
 * behind it, clipped to a few range units so it stays readable between ships.
 */

export const PHOTON_HEAD_SIZE = 2.4;
export const PHOTON_TRAIL_LENGTH = 2.4;
export const PHOTON_TRAIL_POINTS = 5;

export interface PhotonSample {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface PhotonMark {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size: number;
  readonly opacity: number;
}

function stepLength(a: PhotonSample, b: PhotonSample): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.hypot(dx, dy, dz);
}

function mix(newer: PhotonSample, older: PhotonSample, t: number): PhotonSample {
  return {
    x: newer.x + (older.x - newer.x) * t,
    y: newer.y + (older.y - newer.y) * t,
    z: newer.z + (older.z - newer.z) * t,
  };
}

/** Keep the head and the samples that still fall inside the trail length. */
export function trimPhotonTrail(
  points: readonly PhotonSample[],
  maxLength = PHOTON_TRAIL_LENGTH,
  maxPoints = PHOTON_TRAIL_POINTS,
): PhotonSample[] {
  if (points.length === 0) return [];
  const head = points[points.length - 1]!;
  const kept: PhotonSample[] = [head];
  let length = 0;
  for (let i = points.length - 2; i >= 0 && kept.length < maxPoints; i--) {
    const older = points[i]!;
    const newer = kept[0]!;
    const step = stepLength(older, newer);
    if (step === 0) continue;
    if (length + step > maxLength) {
      const remain = maxLength - length;
      kept.unshift(mix(newer, older, remain / step));
      break;
    }
    kept.unshift(older);
    length += step;
  }
  return kept;
}

export function rememberPhotonSample(history: readonly PhotonSample[], sample: PhotonSample): PhotonSample[] {
  return trimPhotonTrail(history.length === 0 ? [sample] : [...history, sample]);
}

/** Head is full size and opaque. Older samples shrink and fade. */
export function photonMarks(trail: readonly PhotonSample[]): PhotonMark[] {
  const count = trail.length;
  const marks: PhotonMark[] = [];
  for (let i = 0; i < count; i++) {
    const sample = trail[i]!;
    const along = count === 1 ? 1 : i / (count - 1);
    marks.push({
      x: sample.x,
      y: sample.y,
      z: sample.z,
      size: 0.7 + (PHOTON_HEAD_SIZE - 0.7) * along,
      opacity: 0.28 + 0.72 * along,
    });
  }
  return marks;
}
