"use client";

import type { Portfolio, HoldingWithPortfolio } from "@/types/user";

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
  Pencil,
  Copy,
} from "lucide-react";

import { API_BASE_URL } from "@/config/constants";
import { useUserAuth } from "@/lib/user-auth-context";
import { useLivePortfolioMetrics } from "@/hooks/useLivePortfolioMetrics";

export default function PortfoliosPage() {
  const { user } = useUserAuth();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [holdings, setHoldings] = useState<HoldingWithPortfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const deleteModal = useDisclosure();
  const renameModal = useDisclosure();
  const duplicateModal = useDisclosure();

  const { byPortfolio } = useLivePortfolioMetrics(holdings);

  const fetchAll = async () => {
    try {
      const [pRes, hRes] = await Promise.all([
        fetch(`${API_BASE_URL}/user/portfolios`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/user/holdings/all`, {
          credentials: "include",
        }),
      ]);
      const pData = await pRes.json();
      const hData = await hRes.json();

      setPortfolios(pData.data || []);
      setHoldings(hData.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
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
      fetchAll();
      window.dispatchEvent(new Event("portfolios:changed"));
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
      fetchAll();
      window.dispatchEvent(new Event("portfolios:changed"));
    } catch {
      // ignore
    }
  };

  const handleRename = async () => {
    if (!renamingId || !renameValue.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`${API_BASE_URL}/user/portfolios/${renamingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      renameModal.onClose();
      setRenamingId(null);
      setRenameValue("");
      fetchAll();
      window.dispatchEvent(new Event("portfolios:changed"));
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async () => {
    if (!duplicatingId || !duplicateName.trim()) return;
    setSubmitting(true);
    try {
      await fetch(
        `${API_BASE_URL}/user/portfolios/${duplicatingId}/duplicate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: duplicateName.trim() }),
        },
      );
      duplicateModal.onClose();
      setDuplicatingId(null);
      setDuplicateName("");
      fetchAll();
      window.dispatchEvent(new Event("portfolios:changed"));
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
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
              <CardHeader className="pb-1 flex items-center justify-between gap-1">
                <NextLink
                  className="min-w-0 flex-1 truncate"
                  href={`/dashboard/portfolios/${p.id}`}
                >
                  <h3 className="font-semibold truncate">{p.name}</h3>
                </NextLink>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <Button
                    isIconOnly
                    aria-label="Rename"
                    size="sm"
                    variant="light"
                    onPress={() => {
                      setRenamingId(p.id);
                      setRenameValue(p.name);
                      renameModal.onOpen();
                    }}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    isIconOnly
                    aria-label="Delete"
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
                  <Button
                    isIconOnly
                    aria-label="Duplicate"
                    isDisabled={!canCreate}
                    size="sm"
                    variant="light"
                    onPress={() => {
                      setDuplicatingId(p.id);
                      setDuplicateName(`${p.name} (copy)`);
                      duplicateModal.onOpen();
                    }}
                  >
                    <Copy size={14} />
                  </Button>
                </div>
              </CardHeader>
              <CardBody
                as={NextLink}
                className="gap-2 pt-0"
                href={`/dashboard/portfolios/${p.id}`}
              >
                {(() => {
                  const agg = byPortfolio[p.id];
                  const value = agg?.value ?? p.latest_value ?? 0;
                  const pnl = agg?.pnl ?? p.latest_pnl;

                  return (
                    <>
                      <p className="text-2xl font-bold">
                        $
                        {value.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-default-500">
                          {p.holding_count} holding
                          {p.holding_count !== 1 ? "s" : ""}
                        </span>
                        {pnl !== null && pnl !== undefined && (
                          <span
                            className={`text-sm flex items-center gap-1 ${
                              pnl >= 0 ? "text-success" : "text-danger"
                            }`}
                          >
                            {pnl >= 0 ? (
                              <TrendingUp size={14} />
                            ) : (
                              <TrendingDown size={14} />
                            )}
                            {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </>
                  );
                })()}
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

      {/* Rename Modal */}
      <Modal isOpen={renameModal.isOpen} onClose={renameModal.onClose}>
        <ModalContent>
          <ModalHeader>Rename Portfolio</ModalHeader>
          <ModalBody>
            <Input
              label="Portfolio Name"
              value={renameValue}
              onValueChange={setRenameValue}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={renameModal.onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={!renameValue.trim()}
              isLoading={submitting}
              onPress={handleRename}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Duplicate Modal */}
      <Modal isOpen={duplicateModal.isOpen} onClose={duplicateModal.onClose}>
        <ModalContent>
          <ModalHeader>Duplicate Portfolio</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-500 mb-2">
              Holdings and transaction history will be copied to the new
              portfolio.
            </p>
            <Input
              label="New Portfolio Name"
              value={duplicateName}
              onValueChange={setDuplicateName}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={duplicateModal.onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={!duplicateName.trim()}
              isLoading={submitting}
              onPress={handleDuplicate}
            >
              Duplicate
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
