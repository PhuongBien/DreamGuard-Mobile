const CLOUDINARY_CLOUD_NAME = "duvdkladk";
const CLOUDINARY_UPLOAD_PRESET = "imageforDG";

const getMimeType = (fileName: string) => {
  const normalized = fileName.toLowerCase();

  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
};

const buildFileName = (imageUri: string, fileName?: string) => {
  if (fileName) {
    return /\.(jpe?g|png|gif|webp)$/i.test(fileName) ? fileName : `${fileName}.jpg`;
  }

  const uriFileName = imageUri.split("/").pop() || `delivery_${Date.now()}.jpg`;
  return /\.(jpe?g|png|gif|webp)$/i.test(uriFileName)
    ? uriFileName
    : `${uriFileName}.jpg`;
};

export const uploadImageToCloudinary = async (
  imageUri: string,
  options?: { fileName?: string; mimeType?: string },
): Promise<string> => {
  const fileName = buildFileName(imageUri, options?.fileName);
  const mimeType = options?.mimeType || getMimeType(fileName);
  const formData = new FormData();

  formData.append("file", {
    uri: imageUri,
    name: fileName,
    type: mimeType,
  } as any);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Upload failed");
  }

  const data = await response.json();
  const secureUrl = String(data?.secure_url || "").trim();

  if (!secureUrl) {
    throw new Error("Upload failed");
  }

  return secureUrl;
};