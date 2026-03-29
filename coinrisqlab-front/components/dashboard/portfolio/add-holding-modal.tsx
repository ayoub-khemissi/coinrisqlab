"use client";

import { useState, useEffect, Key } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
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

interface AddHoldingModalProps {
  portfolioId: number;
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function AddHoldingModal({
  portfolioId,
  isOpen,
  onClose,
  onAdded,
}: AddHoldingModalProps) {
  const [allCryptos, setAllCryptos] = useState<CryptoOption[]>([]);
  const [selectedKey, setSelectedKey] = useState<Key | null>(null);
  const [quantity, setQuantity] = useState("");
  const [avgBuyPrice, setAvgBuyPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load all cryptos once on first open
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
    if (!selectedKey || !quantity || !avgBuyPrice) {
      setError("All fields are required");

      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/user/portfolios/${portfolioId}/holdings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            crypto_id: Number(selectedKey),
            quantity: parseFloat(quantity),
            avg_buy_price: parseFloat(avgBuyPrice),
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.msg || "Failed to add holding");

        return;
      }

      setSelectedKey(null);
      setQuantity("");
      setAvgBuyPrice("");
      setError("");
      onClose();
      onAdded();
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader>Add Holding</ModalHeader>
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
            placeholder="Search for a crypto..."
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
            label="Average Buy Price (USD)"
            placeholder="0.00"
            type="number"
            value={avgBuyPrice}
            onValueChange={setAvgBuyPrice}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            isDisabled={!selectedKey || !quantity || !avgBuyPrice}
            isLoading={loading}
            onPress={handleSubmit}
          >
            Add
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
