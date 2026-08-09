import { NextResponse } from "next/server";
import { z } from "zod";
import { getCheckoutAdmin } from "@/lib/checkout-admin";

const Body = z.object({
  firstName: z.string().trim().max(100).optional().or(z.literal("")),
  email: z.string().trim().email(),
  useCase: z.string().trim().max(100).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  try {
    const supabase = getCheckoutAdmin();
    const body = await req.json();
    const parsed = Body.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { firstName, email, useCase } = parsed.data;

    const safeName = firstName?.trim() || "Waitlist User";

    const { data, error } = await supabase
      .from("waitlist_signups")
      .upsert(
        {
          name: safeName,
          first_name: safeName,
          email: email.toLowerCase(),
          use_case: useCase || null,
        },
        { onConflict: "email" }
      )
      .select();

    if (error) {
      console.error("waitlist upsert error:", error);
      return NextResponse.json(
        { error: "Failed to save signup" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("subscribe route error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
