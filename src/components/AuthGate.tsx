import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { Outlet } from "react-router-dom";

import PageStateCard from "@/components/PageStateCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type AuthGateStatus = "disabled" | "loading" | "authenticated" | "unauthenticated";

export default function AuthGate() {
  const client = getSupabaseBrowserClient();
  const [status, setStatus] = useState<AuthGateStatus>(client ? "loading" : "disabled");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!client) {
      return;
    }

    let active = true;

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }

      if (error) {
        setErrorMessage(error.message);
        setStatus("unauthenticated");
        return;
      }

      setStatus(data.session ? "authenticated" : "unauthenticated");
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return;
      }

      setStatus(session ? "authenticated" : "unauthenticated");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  if (status === "disabled" || status === "authenticated") {
    return <Outlet />;
  }

  if (status === "loading") {
    return <PageStateCard title="Loading workspace access" description="Checking your authenticated session before loading the operational workspace." />;
  }

  const handleRequestMagicLink = async () => {
    if (!client || !email.trim()) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const normalizedEmail = email.trim();
      const { error } = await client.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        throw error;
      }

      setSentTo(normalizedEmail);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "A sign-in link could not be sent.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-[720px] px-4 py-10 sm:px-6 sm:py-14">
      <Card className="panel-strong rounded-[34px] border-white/70">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-primary/10 text-primary">
            <MailCheck className="h-5 w-5" />
          </div>
          <p className="section-eyebrow">Workspace sign-in</p>
          <CardTitle className="text-3xl">This deployment expects an authenticated Supabase session.</CardTitle>
          <p className="text-sm leading-7 text-muted-foreground">
            Enter your workspace email to receive a magic link. Once the browser session is active, API requests will
            automatically include your access token.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="workspace-email">Email address</Label>
            <Input
              id="workspace-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@workspace.com"
            />
          </div>

          {sentTo ? (
            <div className="rounded-[24px] bg-primary/8 px-4 py-4 text-sm leading-6 text-foreground">
              A sign-in link was sent to {sentTo}. Open it in this browser to continue into the workspace.
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-[24px] bg-destructive/10 px-4 py-4 text-sm leading-6 text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <Button className="w-full" disabled={isSubmitting || email.trim().length === 0} onClick={handleRequestMagicLink}>
            {isSubmitting ? "Sending sign-in link..." : "Send magic link"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
