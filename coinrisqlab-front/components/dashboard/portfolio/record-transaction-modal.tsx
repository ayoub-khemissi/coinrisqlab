"use client";

import { useState, useEffect } from "react";
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
  const [search, setSearch] = useState("");
  const [cryptos, setCryptos] = useState<any[]>([]);
  const [selectedCryptoId, setSelectedCryptoId] = useState<number | null>(null);
  const [type, setType] = useState<string>("buy");
  const [quantity, setQuantity] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [feeUsd, setFeeUsd] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const handleSubmit = async () => {
    if (!selectedCryptoId || !quantity || !priceUsd) {
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
            crypto_id: selectedCryptoId,
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

      setSearch("");
      setSelectedCryptoId(null);
      setQuantity("");
      setPriceUsd("");
      setFeeUsd("");
      setNotes("");
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
            label="Cryptocurrency"
            placeholder="Search..."
            inputValue={search}
            onInputChange={(value) => {
              setSearch(value);
              if (!value) setSelectedCryptoId(null);
            }}
            onSelectionChange={(key) => {
              if (key) {
                setSelectedCryptoId(Number(key));
                const selected = cryptos.find((c: any) => c.id === Number(key));

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
          <Button color="primary" isLoading={loading} onPress={handleSubmit}>
            Record
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
