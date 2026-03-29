"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import NextLink from "next/link";

import { API_BASE_URL } from "@/config/constants";
import { useUserAuth } from "@/lib/user-auth-context";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { refresh } = useUserAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");

      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");

      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/user/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, displayName }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.msg || "Registration failed");

        return;
      }

      await refresh();
      router.push("/dashboard");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <CardHeader className="flex-col gap-1">
        <h1 className="text-2xl font-bold">Create Account</h1>
        <p className="text-sm text-default-500">
          Start tracking your crypto portfolio
        </p>
      </CardHeader>
      <CardBody>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger">
              {error}
            </div>
          )}
          <Input
            isRequired
            label="Email"
            placeholder="you@example.com"
            type="email"
            value={email}
            onValueChange={setEmail}
          />
          <Input
            label="Display Name"
            placeholder="Your name (optional)"
            value={displayName}
            onValueChange={setDisplayName}
          />
          <Input
            isRequired
            label="Password"
            placeholder="Min. 8 characters"
            type="password"
            value={password}
            onValueChange={setPassword}
          />
          <Input
            isRequired
            label="Confirm Password"
            placeholder="Confirm your password"
            type="password"
            value={confirmPassword}
            onValueChange={setConfirmPassword}
          />
          <Button
            className="mt-2"
            color="primary"
            isLoading={loading}
            type="submit"
          >
            Create Account
          </Button>
          <p className="text-center text-sm text-default-500">
            Already have an account?{" "}
            <Link as={NextLink} href="/login" size="sm">
              Sign in
            </Link>
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
