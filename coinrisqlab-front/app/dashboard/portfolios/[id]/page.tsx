"use client";

import type { Holding, Transaction } from "@/types/user";

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { useParams } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Tabs, Tab } from "@heroui/tabs";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { useDisclosure } from "@heroui/modal";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Input } from "@heroui/input";
import NextLink from "next/link";
import { Plus, BarChart3, Download, Trash2, Lock, Pencil } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

import { API_BASE_URL } from "@/config/constants";
import { useUserAuth } from "@/lib/user-auth-context";
import { formatCryptoPrice } from "@/lib/formatters";
import {
  BinancePricesProvider,
  useBinancePricesContext,
} from "@/contexts/BinancePricesContext";
import { PriceCell } from "@/components/PriceCell";
import { AddHoldingModal } from "@/components/dashboard/portfolio/add-holding-modal";
import { RecordTransactionModal } from "@/components/dashboard/portfolio/record-transaction-modal";

// Memoized allocation chart — prevents re-render when Binance prices update
const AllocationChart = memo(function AllocationChart({
  chartData,
  holdingCount,
  isMobile,
}: {
  chartData: { name: string; value: number; displayValue: string }[];
  holdingCount: number;
  isMobile: boolean;
}) {
  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold">Allocation</h3>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col lg:flex-row items-center gap-8 w-full">
          <div
            className="w-full lg:w-1/2"
            style={{ height: isMobile ? "275px" : "400px" }}
          >
            <ResponsiveContainer
              height="100%"
              minHeight={isMobile ? 275 : 400}
              width="100%"
            >
              <PieChart>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={chartData}
                  dataKey="value"
                  innerRadius={isMobile ? 60 : 80}
                  label={({
                    cx,
                    cy,
                    midAngle,
                    outerRadius: r,
                    percent,
                  }: any) => {
                    const RADIAN = Math.PI / 180;
                    const dist = isMobile ? 15 : 25;
                    const x = cx + (r + dist) * Math.cos(-midAngle * RADIAN);
                    const y = cy + (r + dist) * Math.sin(-midAngle * RADIAN);

                    return (
                      <text
                        className="fill-gray-900 dark:fill-white"
                        dominantBaseline="central"
                        fontSize={isMobile ? 10 : 12}
                        fontWeight={600}
                        textAnchor={x > cx ? "start" : "end"}
                        x={x}
                        y={y}
                      >
                        {`${(percent * 100).toFixed(1)}%`}
                      </text>
                    );
                  }}
                  labelLine={false}
                  outerRadius={isMobile ? 100 : 140}
                  stroke="none"
                >
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={ALLOC_COLORS[index % ALLOC_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-content1 border border-default-200 rounded-lg shadow-lg px-4 py-2">
                          <p className="text-sm font-semibold">
                            {payload[0].name}
                          </p>
                          <p className="text-sm text-default-500">
                            {payload[0].payload.displayValue}
                          </p>
                        </div>
                      );
                    }

                    return null;
                  }}
                />
                <text
                  dominantBaseline="central"
                  textAnchor="middle"
                  x="50%"
                  y="50%"
                >
                  <tspan
                    className="fill-gray-900 dark:fill-white"
                    dy="-0.5em"
                    fontSize={isMobile ? 24 : 32}
                    fontWeight={700}
                    x="50%"
                  >
                    {holdingCount}
                  </tspan>
                  <tspan
                    className="fill-gray-600 dark:fill-gray-400"
                    dy="1.5em"
                    fontSize={isMobile ? 12 : 14}
                    x="50%"
                  >
                    Assets
                  </tspan>
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="w-full lg:w-1/2">
            <ul className="flex flex-col gap-3">
              {chartData.map((entry, index) => (
                <li key={`legend-${index}`}>
                  <div className="flex items-center justify-between gap-4 p-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            ALLOC_COLORS[index % ALLOC_COLORS.length],
                        }}
                      />
                      <span className="text-sm font-medium">{entry.name}</span>
                    </div>
                    <span className="text-sm text-default-500">
                      {entry.displayValue}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardBody>
    </Card>
  );
});

const ALLOC_COLORS = [
  "#FF6B35", // Orange
  "#3B82F6", // Blue
  "#10B981", // Green
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#6366F1", // Indigo
  "#14B8A6", // Teal
  "#94A3B8", // Slate gray for "Others"
];

export default function PortfolioDetailPage() {
  const params = useParams();
  const portfolioId = parseInt(params.id as string);
  const { user } = useUserAuth();

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const addModal = useDisclosure();
  const txModal = useDisclosure();

  const fetchHoldings = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/portfolios/${portfolioId}/holdings`,
        { credentials: "include" },
      );
      const data = await res.json();

      setHoldings(data.data || []);
    } catch {
      // ignore
    }
  }, [portfolioId]);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/portfolios/${portfolioId}/transactions`,
        { credentials: "include" },
      );
      const data = await res.json();

      setTransactions(data.data || []);
    } catch {
      // ignore
    }
  }, [portfolioId]);

  useEffect(() => {
    Promise.all([fetchHoldings(), fetchTransactions()]).finally(() =>
      setLoading(false),
    );
  }, [fetchHoldings, fetchTransactions]);

  const binanceSymbols = useMemo(
    () => holdings.map((h) => h.symbol.toUpperCase()),
    [holdings],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  return (
    <BinancePricesProvider symbols={binanceSymbols}>
      <PortfolioDetailContent
        addModal={addModal}
        fetchHoldings={fetchHoldings}
        fetchTransactions={fetchTransactions}
        holdings={holdings}
        portfolioId={portfolioId}
        transactions={transactions}
        txModal={txModal}
        user={user}
      />
    </BinancePricesProvider>
  );
}

interface PortfolioDetailContentProps {
  holdings: Holding[];
  transactions: Transaction[];
  portfolioId: number;
  user: any;
  addModal: ReturnType<typeof useDisclosure>;
  txModal: ReturnType<typeof useDisclosure>;
  fetchHoldings: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
}

function PortfolioDetailContent({
  holdings,
  transactions,
  portfolioId,
  user,
  addModal,
  txModal,
  fetchHoldings,
  fetchTransactions,
}: PortfolioDetailContentProps) {
  const { prices } = useBinancePricesContext();
  const [tab, setTab] = useState("holdings");
  const [isMobile, setIsMobile] = useState(false);

  // Edit holding modal state
  const editHoldingModal = useDisclosure();
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editAvgPrice, setEditAvgPrice] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Edit transaction modal state
  const editTxModal = useDisclosure();
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editTxQty, setEditTxQty] = useState("");
  const [editTxPrice, setEditTxPrice] = useState("");
  const [editTxFee, setEditTxFee] = useState("");
  const [editTxNotes, setEditTxNotes] = useState("");
  const [editTxLoading, setEditTxLoading] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Dynamically recompute holdings values using Binance live prices
  const dynamicHoldings = useMemo(() => {
    return holdings.map((h) => {
      const livePrice = prices[h.symbol.toUpperCase()] ?? h.current_price;
      const currentValue = Number(h.quantity) * livePrice;
      const unrealizedPnl =
        currentValue - Number(h.quantity) * Number(h.avg_buy_price);
      const pnlPercent =
        Number(h.avg_buy_price) > 0
          ? ((livePrice - Number(h.avg_buy_price)) / Number(h.avg_buy_price)) *
            100
          : 0;

      return {
        ...h,
        current_price: livePrice,
        current_value: currentValue,
        unrealized_pnl: unrealizedPnl,
        pnl_percent: pnlPercent,
      };
    });
  }, [holdings, prices]);

  const totalValue = useMemo(
    () => dynamicHoldings.reduce((s, h) => s + h.current_value, 0),
    [dynamicHoldings],
  );

  const dynamicHoldingsWithAlloc = useMemo(() => {
    return dynamicHoldings.map((h) => ({
      ...h,
      allocation_pct:
        totalValue > 0
          ? Number(((h.current_value / totalValue) * 100).toFixed(2))
          : 0,
    }));
  }, [dynamicHoldings, totalValue]);

  const totalPnl = dynamicHoldingsWithAlloc.reduce(
    (s, h) => s + h.unrealized_pnl,
    0,
  );
  const totalCost = dynamicHoldingsWithAlloc.reduce(
    (s, h) => s + Number(h.quantity) * Number(h.avg_buy_price),
    0,
  );

  const handleDeleteHolding = async (holdingId: number) => {
    await fetch(
      `${API_BASE_URL}/user/portfolios/${portfolioId}/holdings/${holdingId}`,
      { method: "DELETE", credentials: "include" },
    );
    fetchHoldings();
  };

  const handleEditHolding = async () => {
    if (!editingHolding) return;
    setEditLoading(true);
    try {
      await fetch(
        `${API_BASE_URL}/user/portfolios/${portfolioId}/holdings/${editingHolding.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            quantity: parseFloat(editQty),
            avg_buy_price: parseFloat(editAvgPrice),
          }),
        },
      );
      editHoldingModal.onClose();
      setEditingHolding(null);
      fetchHoldings();
    } catch {
      // ignore
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteTx = async (txId: number) => {
    await fetch(
      `${API_BASE_URL}/user/portfolios/${portfolioId}/transactions/${txId}`,
      { method: "DELETE", credentials: "include" },
    );
    fetchTransactions();
    fetchHoldings();
  };

  const handleEditTx = async () => {
    if (!editingTx) return;
    setEditTxLoading(true);
    try {
      await fetch(
        `${API_BASE_URL}/user/portfolios/${portfolioId}/transactions/${editingTx.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            quantity: parseFloat(editTxQty),
            price_usd: parseFloat(editTxPrice),
            fee_usd: editTxFee ? parseFloat(editTxFee) : 0,
            notes: editTxNotes || null,
          }),
        },
      );
      editTxModal.onClose();
      setEditingTx(null);
      fetchTransactions();
      fetchHoldings();
    } catch {
      // ignore
    } finally {
      setEditTxLoading(false);
    }
  };

  const handleExportCSV = () => {
    window.open(
      `${API_BASE_URL}/user/portfolios/${portfolioId}/export/positions-csv`,
      "_blank",
    );
  };

  // Chart data based on INITIAL holdings (not live prices) to avoid re-render saccade
  const chartData = useMemo(() => {
    if (holdings.length === 0) return [];

    const staticTotal = holdings.reduce(
      (s, h) => s + (Number(h.current_value) || 0),
      0,
    );

    const sorted = [...holdings].sort(
      (a, b) => (Number(b.current_value) || 0) - (Number(a.current_value) || 0),
    );

    const THRESHOLD = 2;
    const aboveThreshold = sorted.filter(
      (h) =>
        staticTotal > 0 &&
        ((Number(h.current_value) || 0) / staticTotal) * 100 >= THRESHOLD,
    );
    const belowThreshold = sorted.filter(
      (h) =>
        staticTotal <= 0 ||
        ((Number(h.current_value) || 0) / staticTotal) * 100 < THRESHOLD,
    );

    const data = aboveThreshold.map((h) => ({
      name: h.symbol,
      value: Number(h.current_value) || 0,
      displayValue: `${staticTotal > 0 ? (((Number(h.current_value) || 0) / staticTotal) * 100).toFixed(2) : "0.00"}%`,
    }));

    if (belowThreshold.length > 0) {
      const othersValue = belowThreshold.reduce(
        (sum, h) => sum + (Number(h.current_value) || 0),
        0,
      );

      data.push({
        name: "Others",
        value: othersValue,
        displayValue: `${staticTotal > 0 ? ((othersValue / staticTotal) * 100).toFixed(2) : "0.00"}%`,
      });
    }

    return data;
  }, [holdings]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-3xl font-bold">
              $
              {totalValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <Chip
              color={totalPnl >= 0 ? "success" : "danger"}
              size="sm"
              variant="flat"
            >
              {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toFixed(2)} (
              {totalCost > 0
                ? ((totalPnl / totalCost) * 100).toFixed(2)
                : "0.00"}
              %)
            </Chip>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            startContent={<Plus size={16} />}
            variant="flat"
            onPress={addModal.onOpen}
          >
            Add Holding
          </Button>
          <Button
            as={NextLink}
            href={
              user?.plan === "pro"
                ? `/dashboard/portfolios/${portfolioId}/analytics`
                : "/dashboard/pricing"
            }
            size="sm"
            startContent={<BarChart3 size={16} />}
            variant="flat"
          >
            Analytics
            {user?.plan !== "pro" && <Lock className="ml-1" size={12} />}
          </Button>
          <Button
            size="sm"
            startContent={<Download size={16} />}
            variant="flat"
            onPress={handleExportCSV}
          >
            CSV
          </Button>
        </div>
      </div>

      {/* Allocation chart — memoized to prevent re-render on Binance price updates */}
      <AllocationChart
        chartData={chartData}
        holdingCount={holdings.length}
        isMobile={isMobile}
      />

      {/* Tabs */}
      <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
        <Tab key="holdings" title={`Holdings (${holdings.length})`}>
          <Table removeWrapper aria-label="Holdings">
            <TableHeader>
              <TableColumn>Asset</TableColumn>
              <TableColumn>Quantity</TableColumn>
              <TableColumn>Avg Price</TableColumn>
              <TableColumn>Price</TableColumn>
              <TableColumn>Value</TableColumn>
              <TableColumn>PnL</TableColumn>
              <TableColumn>Alloc.</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No holdings yet. Add one!">
              {dynamicHoldingsWithAlloc.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {h.image_url && (
                        <img
                          alt={h.symbol}
                          className="w-6 h-6 rounded-full"
                          src={h.image_url}
                        />
                      )}
                      <div>
                        <p className="font-medium">{h.symbol}</p>
                        <p className="text-xs text-default-400">
                          {h.crypto_name}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{Number(h.quantity).toFixed(4)}</TableCell>
                  <TableCell>
                    <span className="font-mono">
                      {formatCryptoPrice(h.avg_buy_price)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <PriceCell
                      fallbackPrice={String(h.current_price)}
                      symbol={h.symbol}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">
                      {formatCryptoPrice(h.current_value)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        h.unrealized_pnl >= 0 ? "text-success" : "text-danger"
                      }
                    >
                      {h.unrealized_pnl >= 0 ? "+" : ""}$
                      {Math.abs(h.unrealized_pnl).toFixed(2)}
                      <span className="text-xs ml-1">
                        ({h.pnl_percent >= 0 ? "+" : ""}
                        {h.pnl_percent.toFixed(1)}%)
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>{h.allocation_pct}%</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => {
                          txModal.onOpen();
                        }}
                      >
                        <Plus size={14} />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => {
                          setEditingHolding(h);
                          setEditQty(String(h.quantity));
                          setEditAvgPrice(String(h.avg_buy_price));
                          editHoldingModal.onOpen();
                        }}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        isIconOnly
                        color="danger"
                        size="sm"
                        variant="light"
                        onPress={() => handleDeleteHolding(h.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Tab>
        <Tab key="transactions" title="Transactions">
          <Table removeWrapper aria-label="Transactions">
            <TableHeader>
              <TableColumn>Date</TableColumn>
              <TableColumn>Asset</TableColumn>
              <TableColumn>Type</TableColumn>
              <TableColumn>Quantity</TableColumn>
              <TableColumn>Price</TableColumn>
              <TableColumn>Total</TableColumn>
              <TableColumn>Notes</TableColumn>
              <TableColumn>Actions</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No transactions recorded yet.">
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">
                    {new Date(t.timestamp).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {t.image_url && (
                        <img
                          alt={t.symbol}
                          className="w-5 h-5 rounded-full"
                          src={t.image_url}
                        />
                      )}
                      <span className="font-medium">{t.symbol}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip
                      color={
                        t.type === "buy"
                          ? "success"
                          : t.type === "sell"
                            ? "danger"
                            : "default"
                      }
                      size="sm"
                      variant="flat"
                    >
                      {t.type}
                    </Chip>
                  </TableCell>
                  <TableCell>{Number(t.quantity).toFixed(4)}</TableCell>
                  <TableCell>${Number(t.price_usd).toFixed(2)}</TableCell>
                  <TableCell>
                    ${(t.quantity * t.price_usd).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs text-default-400 max-w-32 truncate">
                    {t.notes || "\u2014"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => {
                          setEditingTx(t);
                          setEditTxQty(String(t.quantity));
                          setEditTxPrice(String(t.price_usd));
                          setEditTxFee(String(t.fee_usd || 0));
                          setEditTxNotes(t.notes || "");
                          editTxModal.onOpen();
                        }}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        isIconOnly
                        color="danger"
                        size="sm"
                        variant="light"
                        onPress={() => handleDeleteTx(t.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Tab>
      </Tabs>

      <AddHoldingModal
        isOpen={addModal.isOpen}
        portfolioId={portfolioId}
        onAdded={() => {
          fetchHoldings();
          fetchTransactions();
        }}
        onClose={addModal.onClose}
      />
      <RecordTransactionModal
        isOpen={txModal.isOpen}
        portfolioId={portfolioId}
        onClose={txModal.onClose}
        onRecorded={() => {
          fetchHoldings();
          fetchTransactions();
        }}
      />

      {/* Edit Holding Modal */}
      <Modal
        isOpen={editHoldingModal.isOpen}
        onClose={editHoldingModal.onClose}
      >
        <ModalContent>
          <ModalHeader>Edit Holding — {editingHolding?.symbol}</ModalHeader>
          <ModalBody className="gap-4">
            <Input
              label="Quantity"
              placeholder="0.00"
              type="number"
              value={editQty}
              onValueChange={setEditQty}
            />
            <Input
              label="Average Buy Price (USD)"
              placeholder="0.00"
              type="number"
              value={editAvgPrice}
              onValueChange={setEditAvgPrice}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={editHoldingModal.onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={!editQty || !editAvgPrice}
              isLoading={editLoading}
              onPress={handleEditHolding}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal isOpen={editTxModal.isOpen} onClose={editTxModal.onClose}>
        <ModalContent>
          <ModalHeader>Edit Transaction — {editingTx?.symbol}</ModalHeader>
          <ModalBody className="gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Quantity"
                placeholder="0.00"
                type="number"
                value={editTxQty}
                onValueChange={setEditTxQty}
              />
              <Input
                label="Price (USD)"
                placeholder="0.00"
                type="number"
                value={editTxPrice}
                onValueChange={setEditTxPrice}
              />
            </div>
            <Input
              label="Fee (USD)"
              placeholder="0.00"
              type="number"
              value={editTxFee}
              onValueChange={setEditTxFee}
            />
            <Input
              label="Notes"
              placeholder="Optional notes..."
              value={editTxNotes}
              onValueChange={setEditTxNotes}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={editTxModal.onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={!editTxQty || !editTxPrice}
              isLoading={editTxLoading}
              onPress={handleEditTx}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
