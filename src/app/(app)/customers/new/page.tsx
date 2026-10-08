import type { Metadata } from "next";
import { requireWriter } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "לקוחה חדשה" };

export default async function NewCustomerPage({ searchParams }: PageProps<"/customers/new">) {
  await requireWriter();
  const sp = await searchParams;
  const phone = typeof sp.phone === "string" ? sp.phone : "";
  return (
    <>
      <PageHeader title="לקוחה חדשה" back={{ href: "/customers", label: "לקוחות" }} />
      <CustomerForm initial={{ phone }} cancelHref="/customers" />
    </>
  );
}
