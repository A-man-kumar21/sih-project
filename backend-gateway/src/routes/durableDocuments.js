import express from "express";
import { ObjectId } from "mongodb";
import { getDocumentsCollection } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { persistLocalDocument, streamDocument } from "../gridfsStorage.js";

const router = express.Router();

async function authorized(user, doc) {
  if (user.role === "bidder") {
    return (doc.bidder_user_id && doc.bidder_user_id === user.id) || (doc.bidder_id && doc.bidder_id === user.bidder_id);
  }
  if (user.role === "officer") {
    const docs = await getDocumentsCollection();
    const app = await docs.db?.collection?.("tender_applications");
    return Boolean(app);
  }
  return false;
}

router.post("/:id/persist", requireAuth, async (req, res, next) => {
  try {
    const docs = await getDocumentsCollection();
    const doc = await docs.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ error: "Document not found." });
    if (!(await authorized(req.user, doc))) return res.status(403).json({ error: "Access denied." });
    const fileId = await persistLocalDocument(doc);
    if (!fileId) return res.status(404).json({ error: "Local file is no longer available." });
    return res.json({ success: true, storage: "mongodb-gridfs", file_id: fileId.toString() });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/view", requireAuth, async (req, res, next) => {
  try {
    const docs = await getDocumentsCollection();
    const doc = await docs.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ error: "Document not found." });
    if (!(await authorized(req.user, doc))) return res.status(403).json({ error: "Access denied." });
    if (await streamDocument(res, doc, "inline")) return;
    return res.status(404).json({ error: "File not found in durable storage." });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/download", requireAuth, async (req, res, next) => {
  try {
    const docs = await getDocumentsCollection();
    const doc = await docs.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ error: "Document not found." });
    if (!(await authorized(req.user, doc))) return res.status(403).json({ error: "Access denied." });
    if (await streamDocument(res, doc, "attachment")) return;
    return res.status(404).json({ error: "File not found in durable storage." });
  } catch (error) {
    return next(error);
  }
});

export default router;
