import { LIVE } from "./supabase";
import { shrinkImage, shrinkToBlob } from "./image";
import { uploadEventMediaLive, uploadFileLive } from "./live";

/**
 * Save a picture: logos, people's photos, speakers and flyers.
 * Live: shrunk and stored in the church's folder of Supabase storage. Demo: kept inline in this browser.
 */
export async function uploadImage(file: File, kind: "logo" | "photo" | "speaker" | "flyer" | "building", size = 512, square = kind !== "flyer" && kind !== "building"): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (!LIVE) return square ? shrinkImage(file, Math.min(size, 320)) : (await blobToDataUrl(await shrinkToBlob(file, Math.min(size, 900), false)));
  return uploadFileLive(await shrinkToBlob(file, size, square), kind);
}

const blobToDataUrl = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(b); });

/**
 * A picture or short video for one event page (headline video, carousel, host photos, own sections).
 * Live: stored in the event's own folder, removed 14 days after the event. Demo: kept in this browser for now.
 */
export async function uploadEventFile(file: File, eventId: string): Promise<string> {
  const video = file.type.startsWith("video/");
  if (!video && !file.type.startsWith("image/")) throw new Error("Choose a picture or a video");
  if (video && file.size > 10 * 1024 * 1024) throw new Error(`That video is ${(file.size / 1048576).toFixed(1)} MB. The most is 10 MB: try a shorter clip.`);
  if (!LIVE) return video ? URL.createObjectURL(file) : blobToDataUrl(await shrinkToBlob(file, 1400, false));
  if (video) return uploadEventMediaLive(file, eventId, (file.name.split(".").pop() || "mp4").toLowerCase());
  return uploadEventMediaLive(await shrinkToBlob(file, 1800, false), eventId, "webp");
}
