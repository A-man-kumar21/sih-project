import { MongoClient } from "mongodb";

let client;
let database;
let auditCollection;
let usersCollection;
let documentsCollection;
let applicationsCollection;
let tendersCollection;

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
  return documentsCollection;
}

export async function getApplicationsCollection() {
  if (applicationsCollection) return applicationsCollection;
  const db = await getDatabase();
  applicationsCollection = db.collection("tender_applications");
  await applicationsCollection.createIndex({ tender_id: 1, compliance_score: -1 });
  await applicationsCollection.createIndex({ bidder_user_id: 1 });
  await applicationsCollection.createIndex({ bidder_id: 1, tender_id: 1 });
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
}
