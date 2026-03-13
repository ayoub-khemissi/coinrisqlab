"use client";

import { useState } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { useRouter } from "next/navigation";

import { useAdminAuth } from "@/lib/admin-auth-context";

export default function AdminLoginPage() {
  const router = useRouter();
  const { refresh } = useAdminAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setError("Invalid credentials");

        return;
      }

      await refresh();
      router.push("/admin");
    } catch {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-xl bg-primary flex items-center justify-center mb-4">
            <span className="text-white font-black text-2xl">C</span>
          </div>
          <h1 className="text-2xl font-bold text-primary">Admin Login</h1>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Username"
            value={username}
            variant="bordered"
            onValueChange={setUsername}
          />
          <Input
            label="Password"
            type="password"
            value={password}
            variant="bordered"
            onValueChange={setPassword}
          />

          {error && <p className="text-danger text-sm">{error}</p>}

          <Button
            className="w-full font-bold"
            color="primary"
            isLoading={loading}
            type="submit"
          >
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
