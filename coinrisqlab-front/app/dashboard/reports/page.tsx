"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Select, SelectItem } from "@heroui/select";
import {
  FileText,
  FileSpreadsheet,
  Download,
  ShieldAlert,
} from "lucide-react";

import { API_BASE_URL } from "@/config/constants";
import { useUserAuth } from "@/lib/user-auth-context";
import type { Portfolio } from "@/types/user";

export default function ReportsPage() {
  const { user } = useUserAuth();
  const isPro = user?.plan === "pro";
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPortfolios() {
      try {
        const res = await fetch(`${API_BASE_URL}/user/portfolios`, {
          credentials: "include",
        });
        const data = await res.json();
        const list: Portfolio[] = data.data || [];

        setPortfolios(list);
        if (list.length > 0) {
          setSelectedPortfolioId(String(list[0].id));
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    fetchPortfolios();
  }, []);

  const handleDownload = (path: string) => {
    if (!selectedPortfolioId) return;
    window.open(
      `${API_BASE_URL}/user/portfolios/${selectedPortfolioId}/export/${path}`,
      "_blank",
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  const freeReports = [
    {
      title: "Positions CSV",
      description: "Current holdings with prices, values, PnL, and allocation.",
      path: "positions-csv",
      icon: FileSpreadsheet,
    },
    {
      title: "Price History CSV (30d)",
      description: "Daily prices for all your holdings over the last 30 days.",
      path: "prices-csv",
      icon: FileSpreadsheet,
    },
  ];

  const proReports = [
    {
      title: "Transactions CSV",
      description: "Full transaction history with dates, prices, fees, and notes.",
      path: "transactions-csv",
      icon: FileSpreadsheet,
    },
    {
      title: "Portfolio Report PDF",
      description: "Complete report: summary, holdings table, PnL breakdown.",
      path: "report-pdf",
      icon: FileText,
    },
    {
      title: "Stress Test Report PDF",
      description:
        "Impact analysis of historical crash scenarios on your portfolio.",
      path: "stress-test-pdf",
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Reports & Exports</h1>

      {portfolios.length > 1 && (
        <Select
          label="Portfolio"
          selectedKeys={selectedPortfolioId ? [selectedPortfolioId] : []}
          onSelectionChange={(keys) => {
            const k = Array.from(keys)[0];

            if (k) setSelectedPortfolioId(String(k));
          }}
        >
          {portfolios.map((p) => (
            <SelectItem key={String(p.id)}>{p.name}</SelectItem>
          ))}
        </Select>
      )}

      {/* Free reports */}
      <div>
        <h2 className="text-sm font-semibold text-default-500 mb-3">
          Free Reports
        </h2>
        <div className="space-y-3">
          {freeReports.map((report) => {
            const Icon = report.icon;

            return (
              <Card key={report.path}>
                <CardBody className="flex flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-default-100">
                      <Icon size={20} className="text-default-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{report.title}</p>
                      <p className="text-xs text-default-500">
                        {report.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    isDisabled={!selectedPortfolioId}
                    size="sm"
                    startContent={<Download size={14} />}
                    variant="flat"
                    onPress={() => handleDownload(report.path)}
                  >
                    Download
                  </Button>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Pro reports */}
      <div>
        <h2 className="text-sm font-semibold text-default-500 mb-3 flex items-center gap-2">
          Pro Reports
          {!isPro && (
            <Chip color="warning" size="sm" variant="flat">
              Pro
            </Chip>
          )}
        </h2>
        <div className="space-y-3">
          {proReports.map((report) => {
            const Icon = report.icon;

            return (
              <Card
                key={report.path}
                className={!isPro ? "opacity-60" : ""}
              >
                <CardBody className="flex flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-default-100">
                      <Icon size={20} className="text-default-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{report.title}</p>
                      <p className="text-xs text-default-500">
                        {report.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    isDisabled={!isPro || !selectedPortfolioId}
                    size="sm"
                    startContent={<Download size={14} />}
                    variant="flat"
                    onPress={() => handleDownload(report.path)}
                  >
                    {isPro ? "Download" : "Pro Only"}
                  </Button>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
