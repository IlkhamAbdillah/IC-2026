"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkSessionValidity } from "../../app/actions";
import { Tables } from "@/types/database.types";

export default function SessionChecker({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const validateSession = async () => {
      try {
        const isValid = await checkSessionValidity();

        if (!isValid) {
          console.warn('Session is technically invalid, but bypassing kickout for now');
          // router.push("/session-error");
          // return;
        }

        setIsChecking(false);
      } catch (error) {
        console.error("Error validating session:", error);
        setIsChecking(false);
      }
    };

    validateSession();

    // Periodically check session validity (every 5 minutes)
    // const intervalId = setInterval(validateSession, 5 * 60 * 1000);

    // return () => clearInterval(intervalId);
  }, [router]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-secondary/20 to-background/95">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground">Validating session...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
