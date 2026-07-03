/**
 * Web Geolocation wrapper with explicit, typed error handling so the UI can
 * distinguish "blocked" from "unavailable" and guide the user accordingly.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: number;
}

export type GeoErrorKind = "unsupported" | "denied" | "unavailable" | "timeout";

export class GeoError extends Error {
  kind: GeoErrorKind;
  constructor(kind: GeoErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "GeoError";
  }
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export function getCurrentLocation(
  options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 30000,
  },
): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(
        new GeoError(
          "unsupported",
          "This device doesn't support location services.",
        ),
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: pos.timestamp,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(
            new GeoError(
              "denied",
              "Location access was blocked. Enable it in your browser settings to verify your location.",
            ),
          );
        } else if (err.code === err.TIMEOUT) {
          reject(
            new GeoError(
              "timeout",
              "Timed out getting your location. Try again with a clearer view of the sky.",
            ),
          );
        } else {
          reject(
            new GeoError(
              "unavailable",
              "Your location is currently unavailable. Please try again.",
            ),
          );
        }
      },
      options,
    );
  });
}

/** Formats coordinates for display, e.g. "37.7749°, -122.4194°". */
export function formatCoords(c: Coordinates): string {
  return `${c.latitude.toFixed(5)}°, ${c.longitude.toFixed(5)}°`;
}
