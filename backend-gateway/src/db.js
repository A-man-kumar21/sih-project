import { GridFSBucket, MongoClient } from "mongodb";

let client;
let database;
let auditCollection;
let usersCollection;
let documentsCollection;
let applicationsCollection;
let tendersCollection;
let documentFilesBucket;

export async function getDatabase() {
  if (database) return database;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required to connect to MongoDB.");
  }

  client = new MongoClient(uri);
  await client.connect();
  database = client.db(process.env.MONGODB_DB_NAME || "gem_bid_compliance");
  return database;
}

/**
 * Durable document storage for Render and other ephemeral container runtimes.
 * Files are stored in MongoDB GridFS instead of depending on the container disk.
 */
export async function getDocumentFilesBucket() {
  if (documentFilesBucket) return documentFilesBucket;
  const db = await getDatabase();
  documentFilesBucket = new GridFSBucket(db, { bucketName: "document_files" });
  return documentFilesBucket;
}

export async function getAuditCollection() {
  if (auditCollection) return auditCollection;
  const db = await getDatabase();
  auditCollection = db.collection("compliance_audit_trail");
  await auditCollection.createIndex({ bidder_id: 1, timestamp: -1 });
  return auditCollection;
}

export async function getUsersCollection() {
  if (usersCollection) return usersCollection;
  const db = await getDatabase();
  usersCollection = db.collection("users");
  await usersCollection.createIndex({ email: 1 }, { unique: true });
  await usersCollection.createIndex({ bidder_id: 1 }, { sparse: true });
  return usersCollection;
}

export async function getDocumentsCollection() {
  if (documentsCollection) return documentsCollection;
  const db = await getDatabase();
  documentsCollection = db.collection("bidder_documents");
  await documentsCollection.createIndex({ bidder_id: 1, document_type: 1 });
  await documentsCollection.createIndex({ bidder_user_id: 1 });
  await documentsCollection.createIndex({ gridfs_file_id: 1 }, { sparse: true });
  return documentsCollection;
}

export async function getApplicationsCollection() {
  if (applicationsCollection) return applicationsCollection;
  const db = await getDatabase();
  applicationsCollection = db.collection("tender_applications");
  try {
    await applicationsCollection.createIndex({ tender_id: 1, compliance_score: -1 });
    try {
      await applicationsCollection.dropIndex("bidder_id_1_tender_id_1");
    } catch {
      // Ignore if index doesn't exist
    }
    await applicationsCollection.createIndex(
      { bidder_id: 1, tender_id: 1 },
      { name: "uniq_bidder_tender", unique: true }
    );
    await applicationsCollection.createIndex(
      { bidder_user_id: 1, tender_id: 1 },
      { name: "uniq_bidder_user_tender", unique: true }
    );
  } catch (err) {
    console.warn("Notice: index creation:", err.message);
  }
  return applicationsCollection;
}

export async function getTendersCollection() {
  if (tendersCollection) return tendersCollection;
  const db = await getDatabase();
  tendersCollection = db.collection("tenders");
  await tendersCollection.createIndex({ tender_id: 1 });
  await tendersCollection.createIndex({ created_by: 1 });
  return tendersCollection;
}

export async function closeMongoConnection() {
  if (client) await client.close();
  client = undefined;
  database = undefined;
  auditCollection = undefined;
  usersCollection = undefined;
  documentsCollection = undefined;
  applicationsCollection = undefined;
  tendersCollection = undefined;
  documentFilesBucket = undefined;
}
