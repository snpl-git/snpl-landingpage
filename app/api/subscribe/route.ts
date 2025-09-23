import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase-server";

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  interest: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { name, email, interest } = parsed.data;

    const resendApiKey = process.env.RESEND_API_KEY;
    const ownerEmail = process.env.OWNER_EMAIL;
    const siteUrl = process.env.SITE_URL || "http://localhost:3000";

    if (!resendApiKey || !ownerEmail) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const supabase = getAdminClient();
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || null;
    const ua = req.headers.get("user-agent") || null;

    // Insert into DB
    const { error: dbError } = await supabase
      .from("waitlist_signups")
      .insert({
        name,
        email,
        interest: interest || "holiday",
        source: "holiday",
        ip,
        user_agent: ua,
      });

    if (dbError) {
      // If duplicate email unique constraint, still treat as ok for UX
      const msg = dbError.message || "";
      const isUnique = /duplicate key value/i.test(msg);
      if (!isUnique) {
        console.error("Supabase insert error:", dbError);
        return NextResponse.json({ error: "DB error" }, { status: 500 });
      }
    }

    const resend = new Resend(resendApiKey);

    // Confirmation to the user
    await resend.emails.send({
      from: "SNPL Pilot <no-reply@resend.dev>",
      to: email,
      subject: "You're on the SNPL Holiday Waitlist 🎁",
      html: `
        <h2>Thanks, ${name}!</h2>
        <p>You're on the list. We'll reach out soon with early access.</p>
        <p>Interest: <b>${interest || "holiday"}</b></p>
        <p>Visit us: <a href="${siteUrl}">${siteUrl}</a></p>
      `
    });

    // Notification to owner
    await resend.emails.send({
      from: "SNPL Pilot <no-reply@resend.dev>",
      to: ownerEmail,
      subject: "New Waitlist Signup",
      html: `
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Interest:</b> ${interest || "holiday"}</p>
      `
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
