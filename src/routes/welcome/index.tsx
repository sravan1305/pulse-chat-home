import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { OnboardingChat } from "@/components/onboarding/OnboardingChat";

const searchSchema = z.object({
  hh: z.string().optional(),
});

export const Route = createFileRoute("/welcome/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Enpal Pulse — Quick setup" },
      {
        name: "description",
        content:
          "A one-minute conversational setup so Enpal Pulse can tailor energy tips to your home.",
      },
      { property: "og:title", content: "Enpal Pulse — Quick setup" },
      {
        property: "og:description",
        content:
          "Answer a few quick questions so Pulse can give you personalized energy-saving tips.",
      },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return <OnboardingChat />;
}
