import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const Body = z.object({
  firstName: z.string().trim().max(100).optional().or(z.literal("")),
  email: z.string().trim().email(),
  useCase: z.string().trim().max(100).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("subscribe payload received:", body);

    const parsed = Body.safeParse(body);

    if (!parsed.success) {
      console.error("invalid subscribe body:", parsed.error.flatten());
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { firstName, email, useCase } = parsed.data;

    const payload = {
      email: email.toLowerCase(),
      first_name: firstName || null,
      use_case: useCase || null,
    };

    console.log("subscribe upsert payload:", payload);

    const { data, error } = await supabase
      .from("waitlist_signups")
      .upsert(payload, { onConflict: "email" })
      .select();

    if (error) {
      console.error("waitlist upsert error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to save signup" },
        { status: 500 }
      );
    }

    console.log("waitlist upsert success:", data);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("subscribe route error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
