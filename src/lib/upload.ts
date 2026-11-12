import { LIVE } from "./supabase";
import { shrinkImage, shrinkToBlob } from "./image";
import { uploadFileLive } from "./live";

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
