import express from "express";
import path from "path";
import fs from "fs";
import { ObjectId } from "mongodb";
import { getDocumentsCollection } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

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

    // Authorization check:
    // Bidders can only download their own documents. Officers can download documents they are evaluating.
    if (request.user.role === "bidder") {
      if (doc.bidder_user_id !== request.user.id && doc.bidder_id !== request.user.bidder_id) {
        return response.status(403).json({ error: "Access denied. You can only access your own documents." });
      }
    }

    if (!doc.storage_path || !fs.existsSync(doc.storage_path)) {
      return response.status(404).json({ error: "File not found on storage disk." });
    }

    return response.download(doc.storage_path, doc.original_name || doc.file_name);
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

    if (request.user.role === "bidder") {
      if (doc.bidder_user_id !== request.user.id && doc.bidder_id !== request.user.bidder_id) {
        return response.status(403).json({ error: "Access denied. You can only access your own documents." });
      }
    }

    if (!doc.storage_path || !fs.existsSync(doc.storage_path)) {
      return response.status(404).json({ error: "File not found on storage disk." });
    }

    const mimeType = doc.mime_type || "application/pdf";
    response.setHeader("Content-Type", mimeType);
    response.setHeader("Content-Disposition", `inline; filename="${doc.original_name || doc.file_name}"`);
    return response.sendFile(path.resolve(doc.storage_path));
  } catch (error) {
    return next(error);
  }
});

export default router;
