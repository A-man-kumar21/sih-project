import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "gem_compliance_jwt_secret_2026_sih_key_secure_production";

/**
 * Verifies JWT token and attaches authenticated user object to request.
 */
export async function requireAuth(request, response, next) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return response.status(401).json({
        error: "Authentication required. Please provide a valid Bearer token.",
      });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return response.status(401).json({
        error: "Invalid or expired token. Please log in again.",
      });
    }

    const users = await getUsersCollection();
    let query;
    try {
      query = { _id: new ObjectId(decoded.id) };
    } catch (e) {
      query = { _id: decoded.id };
    }

    const user = await users.findOne(query);
    if (!user) {
      return response.status(401).json({
        error: "User account associated with this token was not found.",
      });
    }

    // Attach sanitized user to request
    request.user = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      full_name: user.full_name || "",
      company_name: user.company_name || "",
      contact_person: user.contact_person || "",
      phone: user.phone || "",
      department: user.department || "",
      designation: user.designation || "",
      employee_id: user.employee_id || "",
      bidder_id: user.bidder_id || "",
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Enforces role-based access control on endpoints.
 */
export function requireRole(...allowedRoles) {
  return (request, response, next) => {
    if (!request.user) {
      return response.status(401).json({ error: "Authentication required." });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return response.status(403).json({
        error: `Access denied. Requires one of the following roles: [${allowedRoles.join(", ")}]. Current role: '${request.user.role}'`,
      });
    }

    return next();
  };
}

/**
 * Optionally parses JWT token if present. Never blocks unauthenticated requests.
 */
export async function optionalAuth(request, response, next) {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const users = await getUsersCollection();
      let query;
      try {
        query = { _id: new ObjectId(decoded.id) };
      } catch (e) {
        query = { _id: decoded.id };
      }
      const user = await users.findOne(query);
      if (user) {
        request.user = {
          id: user._id.toString(),
          role: user.role,
          email: user.email,
          full_name: user.full_name || "",
          company_name: user.company_name || "",
          contact_person: user.contact_person || "",
          bidder_id: user.bidder_id || "",
        };
      }
    }
    return next();
  } catch (error) {
    // Continue without user if optional auth fails
    return next();
  }
}

export function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      name: user.full_name || user.company_name || "",
      bidder_id: user.bidder_id || "",
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}
