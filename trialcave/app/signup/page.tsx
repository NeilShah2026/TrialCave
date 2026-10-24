import Link from "next/link";

import { Brand } from "@/components/brand";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const { path } = await searchParams;

  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-5">
        <Brand />
        <Link href="/login" className="text-sm text-primary hover:underline">
          Log in
        </Link>
      </header>

      <section className="mx-auto max-w-md px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              Finding trials and applying are always free. TrialCave is for
              adults 18 and older.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm initialPath={path} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
