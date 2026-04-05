"use client";

import type { Portfolio } from "@/types/user";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Skeleton } from "@heroui/skeleton";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import NextLink from "next/link";
import {
  Plus,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Trash2,
} from "lucide-react";

import { API_BASE_URL } from "@/config/constants";
import { useUserAuth } from "@/lib/user-auth-context";

export default function PortfoliosPage() {
  const { user } = useUserAuth();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const deleteModal = useDisclosure();

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

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await fetch(`${API_BASE_URL}/user/portfolios/${deletingId}`, {
        method: "DELETE",
        credentials: "include",
      });
      deleteModal.onClose();
      setDeletingId(null);
      fetchPortfolios();
    } catch {
      // ignore
    }
  };

  const canCreate = user?.plan === "pro" || portfolios.length < 1;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="w-32 h-8 rounded-lg" />
          <Skeleton className="w-36 h-9 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-1">
                <Skeleton className="w-32 h-5 rounded-lg" />
              </CardHeader>
              <CardBody className="gap-2 pt-0">
                <Skeleton className="w-40 h-8 rounded-lg" />
                <Skeleton className="w-full h-4 rounded-lg" />
              </CardBody>
            </Card>
          ))}
        </div>
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
              className="cursor-pointer hover:border-primary transition-colors relative"
            >
              <CardHeader className="pb-1 flex items-center justify-between">
                <NextLink href={`/dashboard/portfolios/${p.id}`}>
                  <h3 className="font-semibold">{p.name}</h3>
                </NextLink>
                <Button
                  isIconOnly
                  color="danger"
                  size="sm"
                  variant="light"
                  onPress={() => {
                    setDeletingId(p.id);
                    deleteModal.onOpen();
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </CardHeader>
              <CardBody
                as={NextLink}
                className="gap-2 pt-0"
                href={`/dashboard/portfolios/${p.id}`}
              >
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

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.onClose}>
        <ModalContent>
          <ModalHeader>Delete Portfolio</ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete this portfolio? All holdings and
              transactions will be permanently removed.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={deleteModal.onClose}>
              Cancel
            </Button>
            <Button color="danger" onPress={handleDelete}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
