"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import NextLink from "next/link";
import { Plus, Briefcase, TrendingUp, TrendingDown } from "lucide-react";

import { API_BASE_URL } from "@/config/constants";
import { useUserAuth } from "@/lib/user-auth-context";
import type { Portfolio } from "@/types/user";

export default function PortfoliosPage() {
  const { user } = useUserAuth();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const fetchPortfolios = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/portfolios`, {
        credentials: "include",
      });
      const data = await res.json();

      setPortfolios(data.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolios();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await fetch(`${API_BASE_URL}/user/portfolios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      onClose();
      fetchPortfolios();
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const canCreate =
    user?.plan === "pro" || portfolios.length < 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Portfolios</h1>
        <Button
          color="primary"
          isDisabled={!canCreate}
          size="sm"
          startContent={<Plus size={16} />}
          onPress={onOpen}
        >
          New Portfolio
        </Button>
      </div>

      {!canCreate && (
        <p className="text-sm text-default-500">
          Free plan allows 1 portfolio.{" "}
          <NextLink className="text-primary" href="/dashboard/pricing">
            Upgrade to Pro
          </NextLink>{" "}
          for unlimited.
        </p>
      )}

      {portfolios.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center justify-center py-12 gap-4">
            <Briefcase className="text-default-300" size={48} />
            <p className="text-default-500">No portfolios yet</p>
            <Button color="primary" size="sm" onPress={onOpen}>
              Create your first portfolio
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolios.map((p) => (
            <Card
              key={p.id}
              as={NextLink}
              className="cursor-pointer hover:border-primary transition-colors"
              href={`/dashboard/portfolios/${p.id}`}
              isPressable
            >
              <CardHeader className="pb-1">
                <h3 className="font-semibold">{p.name}</h3>
              </CardHeader>
              <CardBody className="gap-2 pt-0">
                <p className="text-2xl font-bold">
                  $
                  {(p.latest_value || 0).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-default-500">
                    {p.holding_count} holding{p.holding_count !== 1 ? "s" : ""}
                  </span>
                  {p.latest_pnl !== null && (
                    <span
                      className={`text-sm flex items-center gap-1 ${
                        p.latest_pnl >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {p.latest_pnl >= 0 ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )}
                      {p.latest_pnl >= 0 ? "+" : ""}$
                      {Math.abs(p.latest_pnl).toFixed(2)}
                    </span>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>New Portfolio</ModalHeader>
          <ModalBody>
            <Input
              label="Portfolio Name"
              placeholder="e.g. Long-term, Trading, DeFi"
              value={newName}
              onValueChange={setNewName}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={!newName.trim()}
              isLoading={creating}
              onPress={handleCreate}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
