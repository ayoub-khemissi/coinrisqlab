"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";

import { API_BASE_URL } from "@/config/constants";
import { useUserAuth } from "@/lib/user-auth-context";

export default function SettingsPage() {
  const { user, refresh } = useUserAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");

  const [portalLoading, setPortalLoading] = useState(false);

  const handleProfileUpdate = async () => {
    setProfileLoading(true);
    setProfileMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/user/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ displayName }),
      });

      if (res.ok) {
        setProfileMsg("Profile updated");
        refresh();
      } else {
        const data = await res.json();

        setProfileMsg(data.msg || "Update failed");
      }
    } catch {
      setProfileMsg("Connection error");
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordMsg("Passwords do not match");

      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg("Password must be at least 8 characters");

      return;
    }

    setPasswordLoading(true);
    setPasswordMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/user/auth/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      setPasswordMsg(data.msg || (res.ok ? "Password updated" : "Failed"));
      if (res.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordMsg("Connection error");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/stripe/create-portal-session`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json();

      if (data.data?.url) {
        window.location.href = data.data.url;
      }
    } catch {
      // ignore
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Profile</h3>
        </CardHeader>
        <CardBody className="gap-4">
          <Input isReadOnly label="Email" value={user?.email || ""} />
          <Input
            label="Display Name"
            value={displayName}
            onValueChange={setDisplayName}
          />
          {profileMsg && (
            <p className="text-sm text-default-500">{profileMsg}</p>
          )}
          <Button
            color="primary"
            isLoading={profileLoading}
            size="sm"
            onPress={handleProfileUpdate}
          >
            Save
          </Button>
        </CardBody>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Change Password</h3>
        </CardHeader>
        <CardBody className="gap-4">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onValueChange={setCurrentPassword}
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onValueChange={setNewPassword}
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onValueChange={setConfirmPassword}
          />
          {passwordMsg && (
            <p className="text-sm text-default-500">{passwordMsg}</p>
          )}
          <Button
            color="primary"
            isLoading={passwordLoading}
            size="sm"
            onPress={handlePasswordChange}
          >
            Change Password
          </Button>
        </CardBody>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Subscription</h3>
        </CardHeader>
        <CardBody className="gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm">Current plan:</span>
            <Chip
              color={user?.plan === "pro" ? "warning" : "default"}
              variant="flat"
            >
              {user?.plan === "pro" ? "Pro" : "Free"}
            </Chip>
          </div>
          {user?.planExpiresAt && (
            <p className="text-sm text-default-500">
              Renews on{" "}
              {new Date(user.planExpiresAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
          {user?.plan === "pro" ? (
            <Button
              isLoading={portalLoading}
              size="sm"
              variant="flat"
              onPress={handleManageSubscription}
            >
              Manage Subscription
            </Button>
          ) : (
            <Button
              as="a"
              color="warning"
              href="/dashboard/pricing"
              size="sm"
              variant="flat"
            >
              Upgrade to Pro
            </Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
