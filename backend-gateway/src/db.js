import { MongoClient } from "mongodb";

let client;
let auditCollection;

export async function getAuditCollection() {
  if (auditCollection) return auditCollection;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required to persist the audit trail.");
  }

  client = new MongoClient(uri);
  await client.connect();
  const database = client.db(process.env.MONGODB_DB_NAME || "gem_bid_compliance");
  auditCollection = database.collection("compliance_audit_trail");
  await auditCollection.createIndex({ bidder_id: 1, timestamp: -1 });
  return auditCollection;
}

export async function closeMongoConnection() {
  if (client) await client.close();
  client = undefined;
  auditCollection = undefined;
}
