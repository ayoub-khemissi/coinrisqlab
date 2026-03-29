"use client";

import { useState, useEffect, Key } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";

import { API_BASE_URL } from "@/config/constants";

interface CryptoOption {
  id: number;
  symbol: string;
  name: string;
  image_url: string | null;
}

interface RecordTransactionModalProps {
  portfolioId: number;
  isOpen: boolean;
  onClose: () => void;
  onRecorded: () => void;
}

export function RecordTransactionModal({
  portfolioId,
  isOpen,
  onClose,
  onRecorded,
}: RecordTransactionModalProps) {
  const [allCryptos, setAllCryptos] = useState<CryptoOption[]>([]);
  const [selectedKey, setSelectedKey] = useState<Key | null>(null);
  const [type, setType] = useState<string>("buy");
  const [quantity, setQuantity] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [feeUsd, setFeeUsd] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || allCryptos.length > 0) return;
    const fetchAll = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/cryptocurrencies?limit=500&sortBy=market_cap_usd&sortOrder=desc`,
        );
        const data = await res.json();

        setAllCryptos(
          (data.data || []).map((c: any) => ({
            id: c.id,
            symbol: c.symbol,
            name: c.name,
            image_url: c.image_url,
          })),
        );
      } catch {
        // ignore
      }
    };

    fetchAll();
  }, [isOpen, allCryptos.length]);

  const handleSubmit = async () => {
    if (!selectedKey || !quantity || !priceUsd) {
      setError("Crypto, quantity, and price are required");

      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/user/portfolios/${portfolioId}/transactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            crypto_id: Number(selectedKey),
            type,
            quantity: parseFloat(quantity),
            price_usd: parseFloat(priceUsd),
            fee_usd: feeUsd ? parseFloat(feeUsd) : 0,
            timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
            notes: notes || null,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.msg || "Failed to record transaction");

        return;
      }

      setSelectedKey(null);
      setQuantity("");
      setPriceUsd("");
      setFeeUsd("");
      setNotes("");
      setError("");
      onClose();
      onRecorded();
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} size="lg" onClose={onClose}>
      <ModalContent>
        <ModalHeader>Record Transaction</ModalHeader>
        <ModalBody className="gap-4">
          {error && (
            <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger">
              {error}
            </div>
          )}
          <Autocomplete
            isRequired
            defaultItems={allCryptos}
            label="Cryptocurrency"
            placeholder="Search..."
            selectedKey={selectedKey != null ? String(selectedKey) : null}
            onSelectionChange={(key) => setSelectedKey(key)}
          >
            {(item) => (
              <AutocompleteItem
                key={String(item.id)}
                textValue={`${item.symbol} ${item.name}`}
              >
                <div className="flex items-center gap-2">
                  {item.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={item.symbol}
                      className="w-5 h-5 rounded-full"
                      src={item.image_url}
                    />
                  )}
                  <span className="font-medium">{item.symbol}</span>
                  <span className="text-default-400 text-sm">{item.name}</span>
                </div>
              </AutocompleteItem>
            )}
          </Autocomplete>
          <Select
            label="Type"
            selectedKeys={[type]}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0];

              if (selected) setType(String(selected));
            }}
          >
            <SelectItem key="buy">Buy</SelectItem>
            <SelectItem key="sell">Sell</SelectItem>
            <SelectItem key="transfer">Transfer</SelectItem>
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input
              isRequired
              label="Quantity"
              placeholder="0.00"
              type="number"
              value={quantity}
              onValueChange={setQuantity}
            />
            <Input
              isRequired
              label="Price (USD)"
              placeholder="0.00"
              type="number"
              value={priceUsd}
              onValueChange={setPriceUsd}
            />
          </div>
          <Input
            label="Fee (USD)"
            placeholder="0.00"
            type="number"
            value={feeUsd}
            onValueChange={setFeeUsd}
          />
          <Input
            label="Notes"
            placeholder="Optional notes..."
            value={notes}
            onValueChange={setNotes}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            isDisabled={!selectedKey || !quantity || !priceUsd}
            isLoading={loading}
            onPress={handleSubmit}
          >
            Record
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
