import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MPESA_ENV = Deno.env.get("MPESA_ENV") || "sandbox";
const MPESA_BASE_URL = MPESA_ENV === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

const PAYMENT_TIMEOUT = 90000; // 90 seconds for async payments

interface STKPushResult {
  success: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  responseCode?: string;
  responseDescription?: string;
  customerMessage?: string;
  error?: string;
}

interface B2CResult {
  success: boolean;
  conversationId?: string;
  originatorConversationId?: string;
  responseCode?: string;
  responseDescription?: string;
  error?: string;
}

// Get M-Pesa OAuth token with retry
async function getAccessToken(attempt = 1): Promise<string> {
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");

  if (!consumerKey || !consumerSecret) {
    throw new Error("M-Pesa consumer key and secret must be configured");
  }

  try {
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${auth}` },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("M-Pesa OAuth returned non-JSON response");
      throw new Error("M-Pesa API returned an invalid response");
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error(`M-Pesa auth error (attempt ${attempt}/3):`, error);
    if (attempt >= 3) {
      throw new Error(`Failed to get M-Pesa access token after 3 attempts`);
    }
    await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
    return getAccessToken(attempt + 1);
  }
}

// STK Push - Request payment from buyer
async function stkPush(
  phoneNumber: string,
  amount: number,
  orderRef: string,
  callbackUrl: string
): Promise<STKPushResult> {
  try {
    const shortcode = Deno.env.get("MPESA_SHORTCODE");
    const passkey = Deno.env.get("MPESA_PASSKEY");

    if (!shortcode || !passkey) {
      throw new Error("M-Pesa shortcode and passkey must be configured");
    }

    const token = await getAccessToken();
    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14);
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    const formattedPhone = phoneNumber.replace(/\+/g, "").replace(/^0/, "254");

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: orderRef,
      TransactionDesc: `Payment for ${orderRef}`,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYMENT_TIMEOUT);

    const response = await fetch(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("M-Pesa STK Push returned non-JSON response");
      throw new Error("M-Pesa API returned an invalid response");
    }

    const data = await response.json();

    if (data.ResponseCode === "0") {
      return {
        success: true,
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID,
        responseCode: data.ResponseCode,
        responseDescription: data.ResponseDescription,
        customerMessage: data.CustomerMessage,
      };
    } else {
      return {
        success: false,
        error: data.ResponseDescription || data.errorMessage || "STK Push failed",
      };
    }
  } catch (error) {
    console.error("M-Pesa STK Push error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "STK Push failed",
    };
  }
}

// B2C - Pay seller
async function payoutToSeller(
  phoneNumber: string,
  amount: number,
  orderRef: string
): Promise<B2CResult> {
  try {
    const shortcode = Deno.env.get("MPESA_SHORTCODE");
    const initiatorName = Deno.env.get("MPESA_INITIATOR_NAME");
    const securityCredential = Deno.env.get("MPESA_SECURITY_CREDENTIAL");
    const apiUrl = Deno.env.get("SUPABASE_URL");

    if (!shortcode || !initiatorName || !securityCredential) {
      throw new Error("M-Pesa B2C credentials must be configured");
    }

    const token = await getAccessToken();
    const formattedPhone = phoneNumber.replace(/\+/g, "").replace(/^0/, "254");

    const payload = {
      InitiatorName: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: "BusinessPayment",
      Amount: Math.round(amount),
      PartyA: shortcode,
      PartyB: formattedPhone,
      Remarks: `Payout for order ${orderRef}`,
      QueueTimeOutURL: `${apiUrl}/functions/v1/mpesa-api/webhook/timeout`,
      ResultURL: `${apiUrl}/functions/v1/mpesa-api/webhook/b2c-result`,
      Occasion: "PayLoom Seller Payout",
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYMENT_TIMEOUT);

    const response = await fetch(
      `${MPESA_BASE_URL}/mpesa/b2c/v1/paymentrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("M-Pesa B2C returned non-JSON response");
      throw new Error("M-Pesa API returned an invalid response");
    }

    const data = await response.json();

    if (data.ResponseCode === "0") {
      return {
        success: true,
        conversationId: data.ConversationID,
        originatorConversationId: data.OriginatorConversationID,
        responseCode: data.ResponseCode,
        responseDescription: data.ResponseDescription,
      };
    } else {
      return {
        success: false,
        error: data.ResponseDescription || data.errorMessage || "B2C payout failed",
      };
    }
  } catch (error) {
    console.error("M-Pesa B2C error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "B2C payout failed",
    };
  }
}

// Send SMS notifications when M-Pesa payment is verified
async function sendVerificationSMS(
  supabaseUrl: string,
  serviceKey: string,
  transaction: any,
  receiptNumber: string | null,
  amount: any
) {
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/sms-notifications`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          action: "payment_submitted",
          transactionId: transaction.order_id,
          amount: amount || transaction.amount,
          currency: "KES",
          payerPhone: transaction.phone_number,
        }),
      }
    );
    console.log("📱 SMS notification result:", await response.json());
  } catch (err) {
    console.error("⚠️ SMS notification failed (non-blocking):", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Handle STK Push
    if (action === "stk-push" && req.method === "POST") {
      const { phoneNumber, amount, orderId, orderRef } = await req.json();

      if (!phoneNumber || !amount || !orderId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const callbackUrl = `${supabaseUrl}/functions/v1/mpesa-api/webhook/stk-callback`;
      const result = await stkPush(phoneNumber, amount, orderRef || orderId, callbackUrl);

      if (result.success) {
        // Save M-Pesa transaction record
        await supabase.from("mpesa_transactions").insert({
          order_id: orderId,
          transaction_type: "stk_push",
          merchant_request_id: result.merchantRequestId,
          checkout_request_id: result.checkoutRequestId,
          phone_number: phoneNumber,
          amount,
          status: "pending",
          raw_request: { phoneNumber, amount, orderId, orderRef },
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle B2C Payout
    if (action === "payout" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { phoneNumber, amount, orderId, orderRef } = await req.json();

      if (!phoneNumber || !amount || !orderId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await payoutToSeller(phoneNumber, amount, orderRef || orderId);

      if (result.success) {
        // Save M-Pesa transaction record
        await supabase.from("mpesa_transactions").insert({
          order_id: orderId,
          transaction_type: "b2c_payout",
          conversation_id: result.conversationId,
          phone_number: phoneNumber,
          amount,
          status: "pending",
          raw_request: { phoneNumber, amount, orderId, orderRef },
        });
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle STK Callback
    if (url.pathname.includes("/webhook/stk-callback") && req.method === "POST") {
      console.log("📥 M-Pesa STK Callback received");
      const body = await req.json();
      const { Body } = body;
      const { stkCallback } = Body;

      const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

      // Find transaction
      const { data: transaction } = await supabase
        .from("mpesa_transactions")
        .select("*")
        .eq("checkout_request_id", CheckoutRequestID)
        .single();

      if (!transaction) {
        console.error("Transaction not found:", CheckoutRequestID);
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const status = ResultCode === 0 ? "completed" : "failed";
      let mpesaReceiptNumber = null;

      if (ResultCode === 0) {
        const { CallbackMetadata } = stkCallback;
        const items = CallbackMetadata?.Item || [];
        mpesaReceiptNumber = items.find((item: any) => item.Name === "MpesaReceiptNumber")?.Value;
      }

      // Update M-Pesa transaction
      await supabase
        .from("mpesa_transactions")
        .update({
          status,
          result_code: String(ResultCode),
          result_desc: ResultDesc,
          mpesa_receipt_number: mpesaReceiptNumber,
          callback_data: stkCallback,
          completed_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);

      // Update order if payment successful
      if (ResultCode === 0 && transaction.order_id) {
        await supabase
          .from("transactions")
          .update({
            status: "paid",
            payment_method: "mpesa",
            payment_reference: mpesaReceiptNumber,
            paid_at: new Date().toISOString(),
          })
          .eq("id", transaction.order_id);

        // Call escrow lock
        const escrowResponse = await fetch(
          `${supabaseUrl}/functions/v1/escrow-api/lock`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: transaction.order_id, amount: transaction.amount }),
          }
        );
        console.log("Escrow lock result:", await escrowResponse.json());
      }

      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle B2C Result Callback
    if (url.pathname.includes("/webhook/b2c-result") && req.method === "POST") {
      console.log("📥 M-Pesa B2C Result received");
      const body = await req.json();
      const { Result } = body;

      const { ConversationID, ResultCode, ResultDesc, ResultParameters } = Result;

      // Find transaction by conversation ID
      const { data: transaction } = await supabase
        .from("mpesa_transactions")
        .select("*")
        .eq("conversation_id", ConversationID)
        .single();

      if (transaction) {
        let transactionReceipt = null;
        if (ResultCode === 0 && ResultParameters?.ResultParameter) {
          transactionReceipt = ResultParameters.ResultParameter.find(
            (p: any) => p.Key === "TransactionReceipt"
          )?.Value;
        }

        await supabase
          .from("mpesa_transactions")
          .update({
            status: ResultCode === 0 ? "completed" : "failed",
            result_code: String(ResultCode),
            result_desc: ResultDesc,
            mpesa_receipt_number: transactionReceipt,
            callback_data: Result,
            completed_at: new Date().toISOString(),
          })
          .eq("id", transaction.id);

        // Record in ledger
        if (ResultCode === 0 && transaction.order_id) {
          await supabase.from("ledger_entries").insert({
            entry_ref: `PAY-${Date.now()}`,
            order_id: transaction.order_id,
            transaction_type: "payout",
            debit_account: "payout_pending",
            credit_account: "seller",
            amount: transaction.amount,
            description: `Payout to seller, Receipt: ${transactionReceipt}`,
            metadata: { mpesa_receipt: transactionReceipt, conversation_id: ConversationID },
          });
        }
      }

      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle timeout callback
    if (url.pathname.includes("/webhook/timeout") && req.method === "POST") {
      console.log("📥 M-Pesa Timeout received");
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== M-Pesa Transaction Verification (manual code submission) =====
    if (action === "verify" && req.method === "POST") {
      const { transaction_code, customer_phone, order_id, expected_amount, payment_recipient } = await req.json();

      // Input validation
      if (!transaction_code || !customer_phone || !order_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Transaction code, customer phone, and order ID are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate M-Pesa code format (10 alphanumeric characters)
      const codeRegex = /^[A-Z0-9]{10}$/i;
      if (!codeRegex.test(transaction_code)) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid M-Pesa transaction code format. Must be 10 alphanumeric characters." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate Kenyan phone number format
      const phoneRegex = /^254[0-9]{9}$/;
      const cleanPhone = customer_phone.replace(/[\s+]/g, "").replace(/^0/, "254");
      if (!phoneRegex.test(cleanPhone)) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid Kenyan phone number format (must start with 254)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const upperCode = transaction_code.toUpperCase();

      // Check for duplicate transaction code
      const { data: existingUsage } = await supabase
        .from("mpesa_verification_attempts")
        .select("id, order_id")
        .eq("transaction_code", upperCode)
        .eq("verification_status", "success")
        .limit(1);

      if (existingUsage && existingUsage.length > 0 && existingUsage[0].order_id !== order_id) {
        // Log duplicate attempt
        await supabase.from("mpesa_verification_attempts").insert({
          order_id,
          transaction_code: upperCode,
          customer_phone: cleanPhone,
          verification_status: "duplicate",
          error_message: `Code already used for order ${existingUsage[0].order_id}`,
        });

        return new Response(
          JSON.stringify({ success: false, error: "This transaction code has already been used for another order" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Query M-Pesa Daraja Transaction Status API
      let mpesaData: any = null;
      try {
        const accessToken = await getAccessToken();
        const shortcode = Deno.env.get("MPESA_SHORTCODE");
        const initiatorName = Deno.env.get("MPESA_INITIATOR_NAME");
        const securityCredential = Deno.env.get("MPESA_SECURITY_CREDENTIAL");
        const resultUrl = Deno.env.get("MPESA_RESULT_URL") || `${supabaseUrl}/functions/v1/mpesa-api/webhook/verification-result`;
        const timeoutUrl = Deno.env.get("MPESA_QUEUE_TIMEOUT_URL") || `${supabaseUrl}/functions/v1/mpesa-api/webhook/timeout`;

        if (!shortcode || !initiatorName || !securityCredential) {
          throw new Error("M-Pesa verification credentials not configured");
        }

        const statusPayload = {
          Initiator: initiatorName,
          SecurityCredential: securityCredential,
          CommandID: "TransactionStatusQuery",
          TransactionID: upperCode,
          PartyA: shortcode,
          IdentifierType: "4",
          ResultURL: resultUrl,
          QueueTimeOutURL: timeoutUrl,
          Remarks: "PayLoom verification",
          Occasion: "Verification",
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const statusResponse = await fetch(
          `${MPESA_BASE_URL}/mpesa/transactionstatus/v1/query`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(statusPayload),
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

        mpesaData = await statusResponse.json();
        console.log("📥 M-Pesa Transaction Status Response:", JSON.stringify(mpesaData));
      } catch (mpesaError) {
        console.error("❌ M-Pesa verification query error:", mpesaError);

        // Log failed attempt
        await supabase.from("mpesa_verification_attempts").insert({
          order_id,
          transaction_code: upperCode,
          customer_phone: cleanPhone,
          verification_status: "failed",
          error_message: mpesaError instanceof Error ? mpesaError.message : "M-Pesa API error",
        });

        return new Response(
          JSON.stringify({ success: false, error: "Failed to verify transaction with M-Pesa. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Daraja Transaction Status API is async - it returns a conversation ID
      // The actual result comes via callback. For now, we accept the request and mark as pending verification.
      const conversationId = mpesaData?.ConversationID;
      const responseCode = mpesaData?.ResponseCode;

      if (responseCode === "0") {
        // Request accepted by M-Pesa - store pending verification
        await supabase.from("mpesa_verification_attempts").insert({
          order_id,
          transaction_code: upperCode,
          customer_phone: cleanPhone,
          verification_status: "pending_callback",
          daraja_response: mpesaData,
        });

        // Also save to mpesa_transactions for tracking
        await supabase.from("mpesa_transactions").insert({
          order_id,
          transaction_type: "verification",
          conversation_id: conversationId,
          phone_number: cleanPhone,
          amount: expected_amount || 0,
          status: "pending",
          raw_request: { transaction_code: upperCode, customer_phone: cleanPhone, payment_recipient },
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: "Verification request submitted. Awaiting M-Pesa confirmation.",
            data: {
              order_id,
              transaction_code: upperCode,
              status: "pending_verification",
              conversation_id: conversationId,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // M-Pesa rejected the query
        await supabase.from("mpesa_verification_attempts").insert({
          order_id,
          transaction_code: upperCode,
          customer_phone: cleanPhone,
          verification_status: "rejected",
          error_message: mpesaData?.ResponseDescription || "M-Pesa rejected the verification query",
          daraja_response: mpesaData,
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: mpesaData?.ResponseDescription || "M-Pesa could not verify this transaction code",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Handle Verification Result Callback
    if (url.pathname.includes("/webhook/verification-result") && req.method === "POST") {
      console.log("📥 M-Pesa Verification Result received");
      const body = await req.json();
      const { Result } = body;

      const { ConversationID, ResultCode, ResultDesc, ResultParameters } = Result;

      // Find the verification transaction
      const { data: transaction } = await supabase
        .from("mpesa_transactions")
        .select("*")
        .eq("conversation_id", ConversationID)
        .eq("transaction_type", "verification")
        .single();

      if (transaction) {
        const isSuccess = ResultCode === 0;
        let receiptNumber = null;
        let transactionAmount = null;

        if (isSuccess && ResultParameters?.ResultParameter) {
          const params = ResultParameters.ResultParameter;
          receiptNumber = params.find((p: any) => p.Key === "ReceiptNo")?.Value;
          transactionAmount = params.find((p: any) => p.Key === "Amount")?.Value;
        }

        // Update mpesa_transactions
        await supabase
          .from("mpesa_transactions")
          .update({
            status: isSuccess ? "completed" : "failed",
            result_code: String(ResultCode),
            result_desc: ResultDesc,
            mpesa_receipt_number: receiptNumber,
            callback_data: Result,
            completed_at: new Date().toISOString(),
            verification_status: isSuccess ? "verified" : "failed",
            verified_at: isSuccess ? new Date().toISOString() : null,
          })
          .eq("id", transaction.id);

        // Update verification_attempts
        const transactionCode = (transaction.raw_request as any)?.transaction_code;
        if (transactionCode) {
          await supabase
            .from("mpesa_verification_attempts")
            .update({
              verification_status: isSuccess ? "success" : "failed",
              error_message: isSuccess ? null : ResultDesc,
              daraja_response: Result,
            })
            .eq("transaction_code", transactionCode)
            .eq("order_id", transaction.order_id)
            .eq("verification_status", "pending_callback");
        }

        // If verified, update the order status
        if (isSuccess && transaction.order_id) {
          // Validate amount if we have expected amount
          const expectedAmount = transaction.amount;
          if (expectedAmount > 0 && transactionAmount) {
            const amountDiff = Math.abs(parseFloat(transactionAmount) - expectedAmount);
            if (amountDiff > 5) {
              // Amount mismatch - mark as failed
              await supabase
                .from("mpesa_verification_attempts")
                .update({
                  verification_status: "amount_mismatch",
                  error_message: `Expected KES ${expectedAmount}, got KES ${transactionAmount}`,
                })
                .eq("transaction_code", transactionCode)
                .eq("order_id", transaction.order_id);

              console.log(`⚠️ Amount mismatch for order ${transaction.order_id}`);
            } else {
            // Amount matches - update order as paid
              await supabase
                .from("transactions")
                .update({
                  status: "paid",
                  payment_method: "mpesa",
                  payment_reference: receiptNumber,
                  paid_at: new Date().toISOString(),
                })
                .eq("id", transaction.order_id);

              // Send SMS notifications
              await sendVerificationSMS(supabaseUrl, supabaseServiceKey, transaction, receiptNumber, transactionAmount);
            }
          } else {
            // No amount check needed, just mark as paid
            await supabase
              .from("transactions")
              .update({
                status: "paid",
                payment_method: "mpesa",
                payment_reference: receiptNumber,
                paid_at: new Date().toISOString(),
              })
              .eq("id", transaction.order_id);

            // Send SMS notifications
            await sendVerificationSMS(supabaseUrl, supabaseServiceKey, transaction, receiptNumber, transactionAmount);
          }
        }
      }

      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get verification status for an order
    if (action === "verification-status" && req.method === "GET") {
      const orderId = url.searchParams.get("order_id");
      if (!orderId) {
        return new Response(
          JSON.stringify({ success: false, error: "order_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: attempts } = await supabase
        .from("mpesa_verification_attempts")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      return new Response(
        JSON.stringify({ success: true, data: attempts || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown endpoint" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("M-Pesa API error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
