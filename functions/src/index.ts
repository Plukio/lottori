import * as admin from "firebase-admin";
import cors from "cors";
import express from "express";
import { z } from "zod";
import * as functions from "firebase-functions";

type Request = express.Request;
type Response = express.Response;

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

interface LineVerifyResponse {
    iss: string;
    sub: string;
    aud: string;
    exp: number;
    iat: number;
    nonce?: string;
    name?: string;
    picture?: string;
    email?: string;
}

const ticketSchema = z.object({
    drawDate: z.string(),
    numbers: z.string(),
    serial: z.string(),
    imageUrl: z.string().url().optional(),
    meta: z.record(z.any()).optional(),
});

const voucherSchema = z.object({
    provider: z.enum(["Grab", "Shopee", "TrueMoney", "InApp"]),
    code: z.string().nullable().optional(),
    valueAmount: z.number().min(1),
    currency: z.enum(["THB", "COIN"]),
    expiresOn: z.string(),
    meta: z.record(z.any()).optional(),
});

async function verifyLiffToken(idToken: string) {
    if (!process.env.LINE_CHANNEL_ID) {
        throw new Error("LINE_CHANNEL_ID is not set");
    }

    const response = await fetch(LINE_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            id_token: idToken,
            client_id: process.env.LINE_CHANNEL_ID,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LINE verify failed: ${errorText}`);
    }

    const payload = (await response.json()) as LineVerifyResponse;
    if (payload.aud !== process.env.LINE_CHANNEL_ID) {
        throw new Error("Token audience mismatch");
    }

    return payload;
}

const requireUser = async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing Authorization header" });
        return null;
    }

    const token = authHeader.slice("Bearer ".length);
    try {
        const profile = await verifyLiffToken(token);
        return { userId: profile.sub, profile };
    } catch (error) {
        functions.logger.error("Failed to verify LIFF token", error);
        res.status(401).json({ error: "Invalid LIFF token" });
        return null;
    }
};

const isAdminRequest = (req: express.Request) => {
    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey) return true;
    return req.headers["x-admin-key"] === adminKey;
};

app.post("/api/tickets", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const parsed = ticketSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }

    const payload = {
        ...parsed.data,
        userId: user.userId,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("tickets").add(payload);
    res.status(201).json({ id: docRef.id, ...payload });
});

app.get("/api/tickets", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const snapshot = await db
        .collection("tickets")
        .where("userId", "==", user.userId)
        .orderBy("drawDate", "desc")
        .get();

    const tickets = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));

    res.json({ tickets });
});

app.get("/api/rewards", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const snapshot = await db
        .collection("rewardAssignments")
        .where("userId", "==", user.userId)
        .orderBy("assignedAt", "desc")
        .get();

    const rewards = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));

    res.json({ rewards });
});

app.post("/api/rewards/:id/claim", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const assignmentRef = db.collection("rewardAssignments").doc(req.params.id);
    const assignmentSnap = await assignmentRef.get();

    if (!assignmentSnap.exists) {
        res.status(404).json({ error: "Reward not found" });
        return;
    }

    const assignmentData = assignmentSnap.data();
    if (assignmentData?.userId !== user.userId) {
        res.status(403).json({ error: "Forbidden" });
        return;
    }

    await assignmentRef.update({
        status: "redeemed",
        redeemedAt: FieldValue.serverTimestamp(),
    });

    if (assignmentData?.rewardId) {
        await db.collection("rewards").doc(assignmentData.rewardId).update({
            status: "redeemed",
            redeemedAt: FieldValue.serverTimestamp(),
        });
    }

    res.json({ success: true });
});

app.post("/admin/rewards/upload", async (req, res) => {
    if (!isAdminRequest(req)) {
        res.status(403).json({ error: "Admin key required" });
        return;
    }

    const vouchers = req.body?.vouchers;
    if (!Array.isArray(vouchers)) {
        res.status(400).json({ error: "vouchers array required" });
        return;
    }

    const parsed = z.array(voucherSchema).safeParse(vouchers);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }

    const batch = db.batch();

    parsed.data.forEach((voucher) => {
        const ref = db.collection("rewards").doc();
        batch.set(ref, {
            ...voucher,
            expiresOn: admin.firestore.Timestamp.fromDate(
                new Date(voucher.expiresOn)
            ),
            status: "unused",
            createdAt: FieldValue.serverTimestamp(),
        });
    });

    await batch.commit();
    res.status(201).json({ inserted: parsed.data.length });
});

app.get("/admin/inventory", async (req, res) => {
    if (!isAdminRequest(req)) {
        res.status(403).json({ error: "Admin key required" });
        return;
    }

    let queryRef: admin.firestore.Query = db.collection("rewards");
    const { provider, status } = req.query;
    if (provider) {
        queryRef = queryRef.where("provider", "==", provider);
    }
    if (status) {
        queryRef = queryRef.where("status", "==", status);
    }

    const snapshot = await queryRef.orderBy("expiresOn", "asc").limit(500).get();
    const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));

    res.json({ inventory: items });
});

export const api = functions.https.onRequest(app);

