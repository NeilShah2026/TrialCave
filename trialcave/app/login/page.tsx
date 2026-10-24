import Link from "next/link";

import { Brand } from "@/components/brand";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEMO_MODE } from "@/lib/env";
import { LoginForm } from "./login-form";
import { DemoAccountsCard } from "./demo-accounts-card";

export const metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-5">
        <Brand />
        <Link href="/signup" className="text-sm text-primary hover:underline">
          Create an account
        </Link>
      </header>

      <section className="mx-auto max-w-[1100px] px-4 py-10">
        <h1 className="sr-only">Log in to TrialCave</h1>
        {next ? (
          <p className="mb-4 rounded-md bg-tc-primary-soft px-3 py-2 text-sm">
            Please log in to continue.
          </p>
        ) : null}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Log in</CardTitle>
              <CardDescription>Welcome back. Your vault is waiting.</CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm next={next} />
              <p className="mt-4 text-sm text-muted-foreground">
                New to TrialCave?{" "}
                <Link href="/signup" className="text-primary hover:underline">
                  Create an account
                </Link>
              </p>
            </CardContent>
          </Card>

          {DEMO_MODE ? <DemoAccountsCard next={next} /> : null}
        </div>
      </section>
    </main>
  );
}
