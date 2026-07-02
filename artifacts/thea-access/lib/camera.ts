import type { CameraView } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";

/**
 * Captures a photo from a live CameraView, downscales it to a network-friendly
 * 512px-wide JPEG and returns the base64 payload the API expects.
 * Returns null if the capture failed.
 */
export async function captureFaceBase64(
  camera: CameraView,
): Promise<string | null> {
  const photo = await camera.takePictureAsync({ quality: 0.7, skipProcessing: false });
  if (!photo?.uri) return null;

  const manipulated = await ImageManipulator.manipulateAsync(
    photo.uri,
    [{ resize: { width: 512 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );

  return manipulated.base64 ?? null;
}
