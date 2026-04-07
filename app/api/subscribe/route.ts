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
    const parsed = Body.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { firstName, email, useCase } = parsed.data;

    const { error } = await supabase
      .from("waitlist_signups")
      .upsert(
        {
          email: email.toLowerCase(),
          first_name: firstName || null,
          use_case: useCase || null,
        },
        { onConflict: "email" }
      );

    if (error) {
      console.error("Waitlist signup error:", error);
      return NextResponse.json(
        { error: "Failed to save signup" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscribe route error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
