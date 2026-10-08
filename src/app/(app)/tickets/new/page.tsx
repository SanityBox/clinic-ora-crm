import type { Metadata } from "next";
import { requireWriter } from "@/lib/auth";
import { getCustomerOption, getFormOptions } from "@/lib/options";
import { PageHeader } from "@/components/ui";
import { TicketForm } from "../ticket-form";

export const metadata: Metadata = { title: "קריאה חדשה" };

export default async function NewTicketPage({ searchParams }: PageProps<"/tickets/new">) {
  await requireWriter();
  const sp = await searchParams;
  const customerId = typeof sp.customer === "string" ? sp.customer : null;
  const [customer, { staff }] = await Promise.all([getCustomerOption(customerId), getFormOptions()]);
  const back = customer ? `/customers/${customer.id}` : "/tickets";

  return (
    <>
      <PageHeader title="קריאת שירות חדשה" back={{ href: back, label: customer ? customer.full_name : "קריאות שירות" }} />
      <TicketForm initial={{ customer, status: "new", priority: "normal" }} staff={staff} cancelHref={back} />
    </>
  );
}
