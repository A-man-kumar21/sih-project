import express from "express";
import path from "path";
import fs from "fs";
import { ObjectId } from "mongodb";
import { getDocumentsCollection, getApplicationsCollection } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/**
 * Verify user has authorization to access the given document.
 * - Bidders can ONLY access their own documents.
 * - Officers can access documents that are associated with an application in the platform.
 */
async function checkDocumentAccess(user, doc) {
  if (user.role === "bidder") {
    const isOwner =
      (doc.bidder_user_id && doc.bidder_user_id === user.id) ||
      (doc.bidder_id && doc.bidder_id === user.bidder_id);
    return isOwner;
  }

  if (user.role === "officer") {
    const applications = await getApplicationsCollection();
    const docIdStr = doc._id.toString();
    const app = await applications.findOne({
      $or: [
        { "submitted_documents.document_id": docIdStr },
        { bidder_user_id: doc.bidder_user_id },
        { bidder_id: doc.bidder_id },
      ],
    });
    return Boolean(app);
  }

  return false;
}

/**
 * GET /api/documents/:id/download
 * Secure document download route. Authenticates user and verifies ownership / reviewer rights.
 */
router.get("/:id/download", requireAuth, async (request, response, next) => {
  try {
    const docs = await getDocumentsCollection();
    let query;
    try {
      query = { _id: new ObjectId(request.params.id) };
    } catch (e) {
      return response.status(400).json({ error: "Invalid document ID format." });
    }

    const doc = await docs.findOne(query);
    if (!doc) {
      return response.status(404).json({ error: "Document not found." });
    }

    // Authorization check
    const isAuthorized = await checkDocumentAccess(request.user, doc);
    if (!isAuthorized) {
      return response.status(403).json({
        error: "Access denied. You do not have permission to access this document.",
      });
    }

    if (!doc.storage_path || !fs.existsSync(doc.storage_path)) {
      return response.status(404).json({ error: "File not found on storage disk." });
    }

    const filename = doc.original_name || doc.file_name || "document.pdf";
    return response.download(doc.storage_path, filename);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/documents/:id/view
 * Secure document inline viewing route. Sets content-type for preview in browser.
 */
router.get("/:id/view", requireAuth, async (request, response, next) => {
  try {
    const docs = await getDocumentsCollection();
    let query;
    try {
      query = { _id: new ObjectId(request.params.id) };
    } catch (e) {
      return response.status(400).json({ error: "Invalid document ID format." });
    }

    const doc = await docs.findOne(query);
    if (!doc) {
      return response.status(404).json({ error: "Document not found." });
    }

    // Authorization check
    const isAuthorized = await checkDocumentAccess(request.user, doc);
    if (!isAuthorized) {
      return response.status(403).json({
        error: "Access denied. You do not have permission to access this document.",
      });
    }

    if (!doc.storage_path || !fs.existsSync(doc.storage_path)) {
      return response.status(404).json({ error: "File not found on storage disk." });
    }

    const mimeType = doc.mime_type || "application/pdf";
    const filename = doc.original_name || doc.file_name || "document.pdf";
    response.setHeader("Content-Type", mimeType);
    response.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    return response.sendFile(path.resolve(doc.storage_path));
  } catch (error) {
    return next(error);
  }
});

export default router;
