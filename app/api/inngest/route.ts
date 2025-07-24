import { inngest } from "@/lib/inngest";
import { serve } from "inngest/next";
import { scrapeResearchnetInngest } from "@/lib/scrape-researchnet-inngest";

// Example background task: logs a welcome message
const sendWelcomeEmail = inngest.createFunction(
  { id: "send-welcome-email", name: "Send Welcome Email" },
  { event: "user/created" },
  async ({ event }) => {
    // In a real app, you would send an email here
    console.log("starting")
    await new Promise((resolve) => setTimeout(resolve, 120_000));
    console.log(`Welcome email would be sent to: ${event.data.email}`);
    return { sent: true };
  }
);

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendWelcomeEmail, scrapeResearchnetInngest],
}); 