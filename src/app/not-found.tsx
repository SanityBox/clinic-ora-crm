import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="card max-w-sm p-6 text-center">
        <h1 className="mb-1 text-lg font-semibold">הדף לא נמצא</h1>
        <p className="mb-4 text-sm text-ink-soft">ייתכן שהרשומה נמחקה או שהקישור שגוי.</p>
        <Link href="/" className="btn btn-primary">למסך הראשי</Link>
      </div>
    </main>
  );
}
