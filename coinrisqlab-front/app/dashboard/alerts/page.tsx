"use client";

import type { Alert } from "@/types/user";

import { useEffect, useState, useMemo, memo } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Chip } from "@heroui/chip";
import { Switch } from "@heroui/switch";
import { Spinner } from "@heroui/spinner";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Bell, Plus, Trash2 } from "lucide-react";

import { API_BASE_URL } from "@/config/constants";
import { useUserAuth } from "@/lib/user-auth-context";
import { formatCryptoPrice } from "@/lib/formatters";
import {
  BinancePricesProvider,
  useBinancePriceFromContext,
} from "@/contexts/BinancePricesContext";

// Inline live price component (renders as <span>, not <div>)
const LivePrice = memo(function LivePrice({
  symbol,
  fallbackPrice,
}: {
  symbol: string;
  fallbackPrice: number;
}) {
  const livePrice = useBinancePriceFromContext(symbol);
  const price = livePrice ?? fallbackPrice;

  return <span className="font-mono">{formatCryptoPrice(price)}</span>;
});

export default function AlertsPage() {
  const { user } = useUserAuth();
  const isPro = user?.plan === "pro";
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Create alert form
  const [search, setSearch] = useState("");
  const [cryptos, setCryptos] = useState<any[]>([]);
  const [selectedCryptoId, setSelectedCryptoId] = useState<number | null>(null);
  const [alertType, setAlertType] = useState("price");
  const [threshold, setThreshold] = useState("");
  const [direction, setDirection] = useState("above");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/alerts`, {
        credentials: "include",
      });
      const data = await res.json();

      setAlerts(data.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    if (search.length < 1) return;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/cryptocurrencies?search=${encodeURIComponent(search)}&limit=20`,
        );
        const data = await res.json();

        setCryptos(data.data || []);
      } catch {
        // ignore
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  const handleCreate = async () => {
    if (!selectedCryptoId || !threshold) {
      setError("All fields are required");

      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/user/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          crypto_id: selectedCryptoId,
          alert_type: alertType,
          threshold_value: parseFloat(threshold),
          direction,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.msg || "Failed");

        return;
      }
      setSearch("");
      setSelectedCryptoId(null);
      setThreshold("");
      onClose();
      fetchAlerts();
    } catch {
      setError("Connection error");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (alertId: number, isActive: boolean) => {
    await fetch(`${API_BASE_URL}/user/alerts/${alertId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ is_active: isActive ? 1 : 0 }),
    });
    fetchAlerts();
  };

  const handleDelete = async (alertId: number) => {
    await fetch(`${API_BASE_URL}/user/alerts/${alertId}`, {
      method: "DELETE",
      credentials: "include",
    });
    fetchAlerts();
  };

  const canCreate = isPro || alerts.length < 3;

  const binanceSymbols = useMemo(() => {
    const syms = alerts.map((a) => a.symbol.toUpperCase());

    return syms.filter((s, i) => syms.indexOf(s) === i); // unique
  }, [alerts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  return (
    <BinancePricesProvider symbols={binanceSymbols}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Alerts</h1>
          <Button
            color="primary"
            isDisabled={!canCreate}
            size="sm"
            startContent={<Plus size={16} />}
            onPress={onOpen}
          >
            New Alert
          </Button>
        </div>

        {!isPro && (
          <p className="text-sm text-default-500">
            Free plan: {alerts.length}/3 alerts (price only).
          </p>
        )}

        {alerts.length === 0 ? (
          <Card>
            <CardBody className="flex flex-col items-center py-12 gap-4">
              <Bell className="text-default-300" size={48} />
              <p className="text-default-500">No alerts set</p>
              <Button color="primary" size="sm" onPress={onOpen}>
                Create your first alert
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => (
              <Card key={a.id}>
                <CardBody className="flex flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {a.image_url && (
                      <img
                        alt={a.symbol}
                        className="w-8 h-8 rounded-full"
                        src={a.image_url}
                      />
                    )}
                    <div>
                      <p className="font-medium">
                        {a.symbol}{" "}
                        <Chip size="sm" variant="flat">
                          {a.alert_type}
                        </Chip>
                      </p>
                      <p className="text-sm text-default-500">
                        {a.direction === "above" ? "Above" : "Below"} $
                        {Number(a.threshold_value).toLocaleString()}
                        <span className="ml-2 text-default-400">
                          (now:{" "}
                          <LivePrice
                            fallbackPrice={a.current_price || 0}
                            symbol={a.symbol}
                          />
                          )
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      isSelected={!!a.is_active}
                      size="sm"
                      onValueChange={(v) => handleToggle(a.id, v)}
                    />
                    <Button
                      isIconOnly
                      color="danger"
                      size="sm"
                      variant="light"
                      onPress={() => handleDelete(a.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {/* Create Alert Modal */}
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalContent>
            <ModalHeader>New Alert</ModalHeader>
            <ModalBody className="gap-4">
              {error && (
                <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger">
                  {error}
                </div>
              )}
              <Autocomplete
                inputValue={search}
                label="Cryptocurrency"
                placeholder="Search..."
                onInputChange={(value) => {
                  setSearch(value);
                  if (!value) setSelectedCryptoId(null);
                }}
                onSelectionChange={(key) => {
                  if (key) {
                    setSelectedCryptoId(Number(key));
                    const selected = cryptos.find(
                      (c: any) => c.id === Number(key),
                    );

                    if (selected) {
                      setSearch(`${selected.symbol} - ${selected.name}`);
                    }
                  }
                }}
              >
                {cryptos.map((c: any) => (
                  <AutocompleteItem
                    key={c.id}
                    textValue={`${c.symbol} - ${c.name}`}
                  >
                    <div className="flex items-center gap-2">
                      {c.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={c.symbol}
                          className="w-5 h-5 rounded-full"
                          src={c.image_url}
                        />
                      )}
                      <span className="font-medium">{c.symbol}</span>
                      <span className="text-default-400 text-sm">{c.name}</span>
                    </div>
                  </AutocompleteItem>
                ))}
              </Autocomplete>
              {isPro && (
                <Select
                  label="Alert Type"
                  selectedKeys={[alertType]}
                  onSelectionChange={(keys) => {
                    const k = Array.from(keys)[0];

                    if (k) setAlertType(String(k));
                  }}
                >
                  <SelectItem key="price">Price</SelectItem>
                  <SelectItem key="volatility">Volatility</SelectItem>
                  <SelectItem key="drawdown">Drawdown</SelectItem>
                  <SelectItem key="var_breach">VaR Breach</SelectItem>
                  <SelectItem key="rebalancing">Rebalancing</SelectItem>
                </Select>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  isRequired
                  label="Threshold"
                  placeholder="0.00"
                  type="number"
                  value={threshold}
                  onValueChange={setThreshold}
                />
                <Select
                  label="Direction"
                  selectedKeys={[direction]}
                  onSelectionChange={(keys) => {
                    const k = Array.from(keys)[0];

                    if (k) setDirection(String(k));
                  }}
                >
                  <SelectItem key="above">Above</SelectItem>
                  <SelectItem key="below">Below</SelectItem>
                </Select>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                isLoading={creating}
                onPress={handleCreate}
              >
                Create
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </BinancePricesProvider>
  );
}
