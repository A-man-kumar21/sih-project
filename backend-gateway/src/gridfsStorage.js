import fs from "fs";
import { ObjectId } from "mongodb";
import { getDocumentFilesBucket, getDocumentsCollection } from "./db.js";

export async function persistLocalDocument(doc) {
  if (doc.gridfs_file_id) return new ObjectId(doc.gridfs_file_id);
  if (!doc.storage_path || !fs.existsSync(doc.storage_path)) return null;

  const bucket = await getDocumentFilesBucket();
  const stream = fs.createReadStream(doc.storage_path);
  const fileId = await bucket.uploadFromStream(
    doc.original_name || doc.file_name || "document.pdf",
    stream,
    {
      metadata: {
        document_id: doc._id.toString(),
        mime_type: doc.mime_type || "application/pdf",
      },
    }
  );
  stream.destroy();

  const docs = await getDocumentsCollection();
  await docs.updateOne(
    { _id: doc._id },
    {
      $set: { gridfs_file_id: fileId, storage_version: "gridfs", updated_at: new Date() },
      $unset: { storage_path: "" },
    }
  );
  return fileId;
}

export async function streamDocument(response, doc, disposition = "inline") {
  const fileId = await persistLocalDocument(doc);
  if (!fileId) return false;

  const bucket = await getDocumentFilesBucket();
  const filename = (doc.original_name || doc.file_name || "document.pdf").replace(/"/g, "");
  response.setHeader("Content-Type", doc.mime_type || "application/pdf");
  response.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
  bucket.openDownloadStream(fileId).pipe(response);
  return true;
}
