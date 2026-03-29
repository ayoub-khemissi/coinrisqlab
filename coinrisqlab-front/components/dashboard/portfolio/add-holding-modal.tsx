"use client";

import { useState, useEffect } from "react";
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
  const [search, setSearch] = useState("");
  const [cryptos, setCryptos] = useState<CryptoOption[]>([]);
  const [selectedCryptoId, setSelectedCryptoId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("");
  const [avgBuyPrice, setAvgBuyPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (search.length < 1) {
      setCryptos([]);

      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/cryptocurrencies?search=${encodeURIComponent(search)}&limit=20`,
        );
        const data = await res.json();

        setCryptos(
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
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  const handleSubmit = async () => {
    if (!selectedCryptoId || !quantity) {
      setError("Select a crypto and enter a quantity");

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
            crypto_id: selectedCryptoId,
            quantity: parseFloat(quantity),
            avg_buy_price: avgBuyPrice ? parseFloat(avgBuyPrice) : 0,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.msg || "Failed to add holding");

        return;
      }

      // Reset and close
      setSearch("");
      setSelectedCryptoId(null);
      setQuantity("");
      setAvgBuyPrice("");
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
            label="Cryptocurrency"
            placeholder="Search for a crypto..."
            inputValue={search}
            onInputChange={(value) => {
              setSearch(value);
              if (!value) setSelectedCryptoId(null);
            }}
            onSelectionChange={(key) => {
              if (key) {
                setSelectedCryptoId(Number(key));
                const selected = cryptos.find((c) => c.id === Number(key));

                if (selected) {
                  setSearch(`${selected.symbol} - ${selected.name}`);
                }
              }
            }}
          >
            {cryptos.map((c) => (
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
          <Input
            isRequired
            label="Quantity"
            placeholder="0.00"
            type="number"
            value={quantity}
            onValueChange={setQuantity}
          />
          <Input
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
          <Button color="primary" isLoading={loading} onPress={handleSubmit}>
            Add
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
