import express from "express";
import bcrypt from "bcryptjs";
import { getUsersCollection } from "../db.js";
import { generateToken, requireAuth } from "../middleware/auth.js";

const router = express.Router();
const ENGINE_URL = process.env.AI_ENGINE_URL || "http://127.0.0.1:8000";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeUser(user) {
  return {
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
    statutory: user.statutory || {},
    created_at: user.created_at,
  };
}

/**
 * POST /api/auth/register/officer
 * Register a government procurement officer.
 */
router.post("/register/officer", async (request, response, next) => {
  try {
    const {
      full_name,
      email,
      phone,
      department,
      designation,
      employee_id,
      password,
      confirm_password,
    } = request.body;

    if (!full_name || !email || !department || !designation || !password) {
      return response.status(400).json({
        error: "Full Name, Official Email, Department, Designation, and Password are required.",
      });
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      return response.status(400).json({ error: "Invalid official email address format." });
    }

    if (password.length < 6) {
      return response.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    if (password !== confirm_password) {
      return response.status(400).json({ error: "Password confirmation does not match password." });
    }

    const users = await getUsersCollection();
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) {
      return response.status(409).json({ error: "An account with this email already exists." });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const now = new Date();

    const newOfficer = {
      role: "officer",
      email: normalizedEmail,
      password_hash,
      full_name: full_name.trim(),
      department: department.trim(),
      designation: designation.trim(),
      employee_id: (employee_id || "").trim(),
      phone: (phone || "").trim(),
      created_at: now,
      updated_at: now,
    };

    const insertResult = await users.insertOne(newOfficer);
    newOfficer._id = insertResult.insertedId;

    const token = generateToken(newOfficer);

    return response.status(201).json({
      success: true,
      token,
      user: sanitizeUser(newOfficer),
      message: "Officer account registered successfully.",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/auth/register/bidder
 * Register an enterprise bidder and synchronize with AI Engine profiles.
 */
router.post("/register/bidder", async (request, response, next) => {
  try {
    const {
      company_name,
      contact_person,
      email,
      phone,
      password,
      confirm_password,
    } = request.body;

    if (!company_name || !contact_person || !email || !password) {
      return response.status(400).json({
        error: "Company Name, Contact Person, Business Email, and Password are required.",
      });
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      return response.status(400).json({ error: "Invalid business email address format." });
    }

    if (password.length < 6) {
      return response.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    if (password !== confirm_password) {
      return response.status(400).json({ error: "Password confirmation does not match password." });
    }

    const users = await getUsersCollection();
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) {
      return response.status(409).json({ error: "An account with this business email already exists." });
    }

    // Generate unique internal bidder_id linked to AI Engine
    const cleanPrefix = company_name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "ENT";
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const bidderId = `BIDDER-${cleanPrefix}-${randomSuffix}`;

    // Synchronize with AI Engine profile registry
    try {
      await fetch(`${ENGINE_URL}/bidders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bidder_id: bidderId,
          company_name: company_name.trim(),
          udyam_number: "",
          gstin: "",
          pan: "",
          epfo_esic_number: "",
        }),
      });
    } catch (engineErr) {
      console.warn("Notice: AI engine profile sync on bidder registration:", engineErr.message);
    }

    const password_hash = await bcrypt.hash(password, 10);
    const now = new Date();

    const newBidder = {
      role: "bidder",
      email: normalizedEmail,
      password_hash,
      company_name: company_name.trim(),
      contact_person: contact_person.trim(),
      phone: (phone || "").trim(),
      bidder_id: bidderId,
      statutory: {
        pan: "",
        gstin: "",
        udyam_number: "",
        epfo_esic_number: "",
      },
      created_at: now,
      updated_at: now,
    };

    const insertResult = await users.insertOne(newBidder);
    newBidder._id = insertResult.insertedId;

    const token = generateToken(newBidder);

    return response.status(201).json({
      success: true,
      token,
      user: sanitizeUser(newBidder),
      message: "Bidder registered successfully.",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/auth/login
 * Common login for both Officers and Bidders.
 */
router.post("/login", async (request, response, next) => {
  try {
    const { email, password } = request.body;
    if (!email || !password) {
      return response.status(400).json({ error: "Email and password are required." });
    }

    const users = await getUsersCollection();
    const normalizedEmail = email.toLowerCase().trim();

    const user = await users.findOne({ email: normalizedEmail });
    if (!user) {
      return response.status(401).json({ error: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return response.status(401).json({ error: "Invalid email or password." });
    }

    const token = generateToken(user);

    return response.json({
      success: true,
      token,
      user: sanitizeUser(user),
      message: `Welcome back, ${user.full_name || user.company_name}!`,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user.
 */
router.get("/me", requireAuth, async (request, response, next) => {
  try {
    const users = await getUsersCollection();
    let query;
    try {
      const { ObjectId } = await import("mongodb");
      query = { _id: new ObjectId(request.user.id) };
    } catch (e) {
      query = { email: request.user.email };
    }

    const user = await users.findOne(query);
    if (!user) {
      return response.status(404).json({ error: "User account not found." });
    }

    return response.json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
