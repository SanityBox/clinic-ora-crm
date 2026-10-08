import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../../customer-form";

export const metadata: Metadata = { title: "עריכת לקוחה" };

export default async function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  await requireWriter();
  const { id } = await params;
  const supabase = await createClient();
  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!customer) notFound();

  return (
    <>
      <PageHeader title={`עריכה: ${customer.full_name}`} back={{ href: `/customers/${id}`, label: "חזרה לכרטיס" }} />
      <CustomerForm initial={customer} cancelHref={`/customers/${id}`} />
    </>
  );
}
