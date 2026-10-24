import Link from "next/link";

import { Brand } from "@/components/brand";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TOWN_NAMES } from "@/lib/geo/towns";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create an account" };

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
        <h1 className="sr-only">Create a TrialCave account</h1>
        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              Finding trials and applying are always free. TrialCave is for
              adults 18 and older.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm initialPath={path} towns={TOWN_NAMES} />
            <p className="mt-4 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">Log in</Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
