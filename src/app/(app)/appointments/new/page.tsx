import type { Metadata } from "next";
import { requireWriter } from "@/lib/auth";
import { getCustomerOption, getFormOptions } from "@/lib/options";
import { isoDateInIsrael } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { AppointmentForm } from "../appointment-form";

export const metadata: Metadata = { title: "תור חדש" };

export default async function NewAppointmentPage({ searchParams }: PageProps<"/appointments/new">) {
  await requireWriter();
  const sp = await searchParams;
  const customerId = typeof sp.customer === "string" ? sp.customer : null;
  const [customer, { treatments, staff }] = await Promise.all([getCustomerOption(customerId), getFormOptions()]);
  const back = customer ? `/customers/${customer.id}` : "/appointments";

  return (
    <>
      <PageHeader title="תור חדש" back={{ href: back, label: customer ? customer.full_name : "תורים" }} />
      <AppointmentForm
        initial={{ customer, date: isoDateInIsrael(), time: "10:00", status: "scheduled" }}
        treatments={treatments.filter((t) => t.is_active)}
        staff={staff}
        cancelHref={back}
        returnTo={customer ? back : undefined}
      />
    </>
  );
}
