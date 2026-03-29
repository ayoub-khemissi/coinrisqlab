"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import NextLink from "next/link";

import { API_BASE_URL } from "@/config/constants";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/user/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.msg || "Login failed");
        return;
      }

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
        <h1 className="text-2xl font-bold">Sign In</h1>
        <p className="text-sm text-default-500">
          Access your CoinRisqLab dashboard
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
            isRequired
            label="Password"
            placeholder="Your password"
            type="password"
            value={password}
            onValueChange={setPassword}
          />
          <Button
            className="mt-2"
            color="primary"
            isLoading={loading}
            type="submit"
          >
            Sign In
          </Button>
          <p className="text-center text-sm text-default-500">
            Don&apos;t have an account?{" "}
            <Link as={NextLink} href="/register" size="sm">
              Create one
            </Link>
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
