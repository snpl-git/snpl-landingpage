import Stripe from "stripe";
import { createClient } from "supabase";
import {
  chargeFinalizationSucceeded,
  failureFinalizationSucceeded,
  failureTransition,
  paymentBindingIsValid,
  paymentIntentIdempotencyKey,
} from "./payment-logic.ts";

const MAX_BODY_BYTES = 4096;
const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function securityEvent(event: string, fields: Record<string, string | number | boolean> = {}) {
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...fields }));
}

function safeStripeFailure(error: unknown) {
  if (error instanceof Stripe.errors.StripeCardError) {
    return { terminal: true, code: error.code ?? "card_declined" };
  }
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    return { terminal: true, code: "stripe_invalid_request" };
  }
  return { terminal: false, code: "stripe_ambiguous_or_unavailable" };
}

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
const cronToken = Deno.env.get("CRON_TOKEN");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!stripeSecret || !cronToken || !supabaseUrl || !serviceRole) {
  throw new Error("Missing required Edge Function configuration");
}

const stripe = new Stripe(stripeSecret);
const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413);

  let body: { cron_token?: string };
  try {
    const raw = new Uint8Array(await req.arrayBuffer());
    if (raw.byteLength > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413);
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  const suppliedToken = req.headers.get("x-cron-token") ?? body.cron_token;
  if (!suppliedToken || suppliedToken !== cronToken) {
    securityEvent("charge_due_denied");
    return json({ error: "Unauthorized" }, 401);
  }

  const { data: reconciled, error: reconciliationError } = await supabase.rpc(
    "reconcile_terminal_scheduled_payment_orders",
    { p_limit: 100 },
  );
  if (reconciliationError || !Number.isInteger(Number(reconciled))) {
    securityEvent("charge_due_reconciliation_failed");
    return json({ error: "Unable to reconcile payments" }, 500);
  }

  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_due_scheduled_payments",
    { p_limit: 25, p_stale_after: "15 minutes" },
  );
  if (claimError) {
    securityEvent("charge_due_claim_failed");
    return json({ error: "Unable to claim payments" }, 500);
  }

  const results = {
    reconciled: Number(reconciled), claimed: claimed?.length ?? 0,
    charged: 0, failed: 0, retrying: 0,
  };
  for (const payment of claimed ?? []) {
    const invalid = !paymentBindingIsValid({
      scheduledPaymentId: payment.id, orderId: payment.order_id, amount: payment.amount,
      orderTotalCents: payment.order_total_cents, orderStatus: payment.order_status,
      stripeCustomerId: payment.stripe_customer_id, paymentMethodId: payment.payment_method_id,
    });
    if (invalid) {
      await supabase.from("scheduled_payments").update({
        status: "failed", failed_at: new Date().toISOString(),
        failure_code: "payment_integrity_failed", last_error: "Payment integrity validation failed",
      }).eq("id", payment.id).eq("status", "processing");
      results.failed++;
      securityEvent("scheduled_payment_integrity_failed", { scheduled_payment_id: payment.id });
      continue;
    }

    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(payment.payment_method_id);
      const methodCustomer = typeof paymentMethod.customer === "string"
        ? paymentMethod.customer : paymentMethod.customer?.id;
      if (methodCustomer !== payment.stripe_customer_id) {
        await supabase.from("scheduled_payments").update({
          status: "failed", failed_at: new Date().toISOString(),
          failure_code: "payment_method_customer_mismatch",
          last_error: "Payment method ownership validation failed",
        }).eq("id", payment.id).eq("status", "processing");
        results.failed++;
        securityEvent("scheduled_payment_customer_mismatch", { scheduled_payment_id: payment.id });
        continue;
      }

      const paymentIntent = payment.stripe_payment_intent_id
        ? await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id)
        : await stripe.paymentIntents.create({
            amount: payment.amount,
            currency: payment.currency,
            customer: payment.stripe_customer_id,
            payment_method: payment.payment_method_id,
            confirm: true,
            off_session: true,
            metadata: { scheduled_payment_id: payment.id, order_id: payment.order_id },
          }, { idempotencyKey: paymentIntentIdempotencyKey(payment.id) });

      if (
        paymentIntent.status !== "succeeded" ||
        paymentIntent.customer !== payment.stripe_customer_id ||
        paymentIntent.metadata?.scheduled_payment_id !== payment.id ||
        paymentIntent.metadata?.order_id !== payment.order_id
      ) throw new Error("PaymentIntent reconciliation failed");

      const { data: finalization, error: finalizationError } = await supabase.rpc(
        "finalize_scheduled_payment_charge",
        {
          p_scheduled_payment_id: payment.id,
          p_order_id: payment.order_id,
          p_stripe_payment_intent_id: paymentIntent.id,
          p_charged_at: new Date().toISOString(),
        },
      );
      if (finalizationError || !chargeFinalizationSucceeded(finalization)) {
        throw new Error("Charged payment persistence failed");
      }

      results.charged++;
      securityEvent("scheduled_payment_charged", { scheduled_payment_id: payment.id });
    } catch (error) {
      const failure = safeStripeFailure(error);
      if (failure.terminal) {
        const { data: finalization, error: finalizationError } = await supabase.rpc(
          "finalize_scheduled_payment_failure",
          {
            p_scheduled_payment_id: payment.id,
            p_order_id: payment.order_id,
            p_failure_code: failure.code,
            p_failed_at: new Date().toISOString(),
          },
        );
        if (finalizationError || !failureFinalizationSucceeded(finalization)) {
          results.retrying++;
          securityEvent("scheduled_payment_failure_persistence_failed", {
            scheduled_payment_id: payment.id,
          });
          continue;
        }
        results.failed++;
        securityEvent("scheduled_payment_declined", { scheduled_payment_id: payment.id, code: failure.code });
      } else {
        // Return to a retryable state. The next attempt reuses the same Stripe
        // idempotency key, reconciling a timeout or a success followed by DB failure.
        await supabase.from("scheduled_payments").update({
          status: failureTransition(false), processing_at: null,
          next_retry_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          failure_code: failure.code, last_error: "Payment result requires reconciliation",
        }).eq("id", payment.id).eq("status", "processing");
        results.retrying++;
        securityEvent("scheduled_payment_retry_scheduled", { scheduled_payment_id: payment.id });
      }
    }
  }

  securityEvent("charge_due_completed", results);
  return json(results);
});
