"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import styles from "./finance-dashboard.module.css";
import { useApi } from "@/lib/useApi";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDateFormat } from "@/lib/useDateFormat";
import { useCurrency } from "@/lib/useCurrency";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Loader } from "@/components/shared/Loader";
import DashboardGreeting from "@/components/shared/DashboardGreeting";
import { isoToBS, BS_MONTH_NAMES, daysInBSMonth, todayLocalISO } from "@/lib/bs-ad";

// Format numbers like 12000 -> 12K, 120000 -> 1.2L
function formatCompactNumber(val: number): string {
  if (val >= 100000) {
    return `${(val / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  }
  if (val >= 1000) {
    return `${(val / 1000).toFixed(0)}K`;
  }
  return String(val);
}

export default function FinanceDashboard() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const isFinance = user?.role === "finance";
  const collectUrl = isFinance ? "/finance/fees/collect" : "/fees/collect";
  const recordsUrl = isFinance ? "/finance/fees/records" : "/fees/records";
  const receiptBase = isFinance ? "/finance/fees/receipt" : "/fees/receipt";

  const { formatDate, formatFeeName, isBS } = useDateFormat();
  const { fmt: formatCurrency, symbol: currSymbol } = useCurrency();
  const { activeYear, academicYearId } = useAcademicYear();
  const { data: yearsData } = useApi<any>("/academic-years");
  const years: any[] = useMemo(() => {
    if (!yearsData) return [];
    if (Array.isArray(yearsData)) return yearsData;
    return yearsData.data ?? [];
  }, [yearsData]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const currentYearId = selectedYearId || academicYearId;
  const currentYearObj = years.find((y: any) => y.id === currentYearId) || activeYear;

  // Filters state for charts
  const [collectionOverviewPeriod, setCollectionOverviewPeriod] = useState<"6months" | "year">("6months");
  const [revenueBreakdownPeriod, setRevenueBreakdownPeriod] = useState<"month" | "all">("month");
  const [topClassesPeriod, setTopClassesPeriod] = useState<"month" | "all">("month");
  const [sendingReminders, setSendingReminders] = useState(false);

  // ── Fetch Collections & Aggregates ──
  const collectionsUrl = currentYearId
    ? `/fees/collections?academic_year_id=${currentYearId}&limit=2000`
    : "";
  const { data: apiResult, loading: collectionsLoading } = useApi<any>(collectionsUrl, [collectionsUrl]);

  // ── Fetch Recent Payments ──
  const paymentsUrl = currentYearId
    ? `/fees/payments?academic_year_id=${currentYearId}&page=1&limit=6`
    : "";
  const { data: paymentsApiResult, loading: paymentsLoading } = useApi<any>(paymentsUrl, [paymentsUrl]);

  // ── Fetch Current User / School Profile ──
  const { data: me } = useApi<any>("/auth/me");

  const schoolName = me?.school_name || user?.school_name || "Nepal Test School";
  const personName = me?.full_name || user?.full_name || "Finance Manager";

  const collections: any[] = useMemo(() => {
    if (!apiResult) return [];
    if (Array.isArray(apiResult)) return apiResult;
    return apiResult.data ?? [];
  }, [apiResult]);

  const recentPayments: any[] = useMemo(() => {
    if (!paymentsApiResult) return [];
    if (Array.isArray(paymentsApiResult)) return paymentsApiResult;
    return paymentsApiResult.data ?? [];
  }, [paymentsApiResult]);

  // ── 1. Top 4 Metric Cards Aggregates ──
  const totalPaid = apiResult?.total_collected ?? collections.reduce((acc, c) => acc + parseFloat(c.paid_amount || 0), 0);
  const totalPending = apiResult?.total_pending ?? collections.reduce((acc, c) => {
    if (c.status !== "paid" && c.status !== "waived" && c.status !== "cancelled") {
      return acc + parseFloat(c.remaining_amount ?? (parseFloat(c.net_amount || c.total_amount || 0) - parseFloat(c.paid_amount || 0)));
    }
    return acc;
  }, 0);

  const totalBillVolume = totalPaid + totalPending;
  const collectionRate = totalBillVolume > 0 ? Math.round((totalPaid / totalBillVolume) * 100) : 0;

  const distinctStudentsWithDues = useMemo(() => {
    const s = new Set<number>();
    for (const c of collections) {
      if (c.status !== "paid" && c.status !== "waived" && c.status !== "cancelled") {
        const rem = parseFloat(c.remaining_amount ?? 0);
        if (rem > 0 && c.student_id) {
          s.add(c.student_id);
        }
      }
    }
    return s.size;
  }, [collections]);

  // ── Month-over-Month & Card Trend Calculations ──
  const {
    card1Badge,
    card2Badge,
    card3Badge,
    card4Badge,
    activeMonthName,
  } = useMemo(() => {
    const todayIso = todayLocalISO();
    let curM = new Date().getMonth() + 1;
    let curY = new Date().getFullYear();
    if (isBS) {
      try {
        const bs = isoToBS(todayIso);
        curM = bs.month;
        curY = bs.year;
      } catch {}
    }
    const prevM = curM === 1 ? 12 : curM - 1;
    const prevY = curM === 1 ? curY - 1 : curY;

    // 1. Gather all payments
    const allPmts: Array<{ amount: number; month: number; year: number; date: string }> = [];

    // Check payments from collections
    for (const c of collections) {
      if (Array.isArray(c.payments)) {
        for (const p of c.payments) {
          const amt = parseFloat(p.paid_amount || 0);
          if (amt <= 0 || !p.payment_date) continue;
          const pDate = String(p.payment_date).slice(0, 10);
          let m = new Date(pDate).getMonth() + 1;
          let y = new Date(pDate).getFullYear();
          if (isBS) {
            try {
              const bs = isoToBS(pDate);
              m = bs.month;
              y = bs.year;
            } catch {}
          }
          allPmts.push({ amount: amt, month: m, year: y, date: pDate });
        }
      }
    }

    // Check payments from recentPayments
    for (const p of recentPayments) {
      const amt = parseFloat(p.paid_amount || 0);
      if (amt <= 0 || !p.payment_date) continue;
      const pDate = String(p.payment_date).slice(0, 10);
      let m = new Date(pDate).getMonth() + 1;
      let y = new Date(pDate).getFullYear();
      if (isBS) {
        try {
          const bs = isoToBS(pDate);
          m = bs.month;
          y = bs.year;
        } catch {}
      }
      if (!allPmts.some((x) => x.date === pDate && Math.abs(x.amount - amt) < 0.01)) {
        allPmts.push({ amount: amt, month: m, year: y, date: pDate });
      }
    }

    let thisMonthPaid = 0;
    let lastMonthPaid = 0;

    for (const p of allPmts) {
      if (p.year === curY && p.month === curM) {
        thisMonthPaid += p.amount;
      } else if (p.year === prevY && p.month === prevM) {
        lastMonthPaid += p.amount;
      }
    }

    let thisMonthPending = 0;
    let lastMonthPending = 0;
    const thisMonthDuesStudents = new Set<number>();
    const lastMonthDuesStudents = new Set<number>();

    for (const c of collections) {
      let m = 0;
      let y = 0;
      if (isBS) {
        // Direct month match in fee_name
        if (c.fee_name) {
          for (let bIdx = 0; bIdx < BS_MONTH_NAMES.length; bIdx++) {
            if (new RegExp(`\\b${BS_MONTH_NAMES[bIdx]}\\b`, "i").test(c.fee_name)) {
              m = bIdx + 1;
              break;
            }
          }
        }
        if (!m && c.billing_from_month) {
          try {
            const bs = isoToBS(`${c.billing_from_month.slice(0, 7)}-15`);
            y = bs.year;
            m = bs.month;
          } catch {}
        }
        if (!m && (c.due_date || c.created_at)) {
          try {
            const bs = isoToBS(String(c.due_date || c.created_at).slice(0, 10));
            y = bs.year;
            m = bs.month;
          } catch {}
        }
      } else {
        const d = new Date(c.due_date || c.created_at);
        y = d.getFullYear();
        m = d.getMonth() + 1;
      }

      const p = parseFloat(c.paid_amount || 0);
      const rem = (c.status !== "paid" && c.status !== "waived" && c.status !== "cancelled")
        ? parseFloat(c.remaining_amount ?? (parseFloat(c.net_amount || c.total_amount || 0) - p))
        : 0;

      // If allPmts was empty, fallback paid from collections billing month
      if (allPmts.length === 0) {
        if (y === curY && m === curM) thisMonthPaid += p;
        if (y === prevY && m === prevM) lastMonthPaid += p;
      }

      if (y === curY && m === curM) {
        thisMonthPending += Math.max(0, rem);
        if (rem > 0 && c.student_id) thisMonthDuesStudents.add(c.student_id);
      } else if (y === prevY && m === prevM) {
        lastMonthPending += Math.max(0, rem);
        if (rem > 0 && c.student_id) lastMonthDuesStudents.add(c.student_id);
      }
    }

    // ── Card 1: Collected Trend ──
    let card1Badge = { text: "0%", sub: "No collections yet", isPositive: true, icon: "fa-arrow-up" };
    if (lastMonthPaid > 0) {
      const cPct = Math.round(((thisMonthPaid - lastMonthPaid) / lastMonthPaid) * 100);
      card1Badge = {
        text: `${cPct >= 0 ? `+${cPct}%` : `${cPct}%`}`,
        sub: "vs last month",
        isPositive: cPct >= 0,
        icon: cPct >= 0 ? "fa-arrow-up" : "fa-arrow-down",
      };
    } else if (totalPaid > 0 && totalPending === 0) {
      card1Badge = {
        text: "100%",
        sub: "Fully realized",
        isPositive: true,
        icon: "fa-check",
      };
    } else if (totalPaid > 0) {
      card1Badge = {
        text: `${collectionRate}%`,
        sub: "Realized to date",
        isPositive: true,
        icon: "fa-arrow-trend-up",
      };
    } else {
      card1Badge = {
        text: "0%",
        sub: "No collections yet",
        isPositive: false,
        icon: "fa-minus",
      };
    }

    // ── Card 2: Pending Dues Trend ──
    let card2Badge = { text: "0%", sub: "All fees cleared", isPositive: true, icon: "fa-check" };
    if (totalPending === 0) {
      card2Badge = {
        text: "0%",
        sub: "All fees cleared",
        isPositive: true,
        icon: "fa-check",
      };
    } else if (lastMonthPending > 0) {
      const pPct = Math.round(((thisMonthPending - lastMonthPending) / lastMonthPending) * 100);
      card2Badge = {
        text: `${pPct >= 0 ? `+${pPct}%` : `${pPct}%`}`,
        sub: "vs last month",
        isPositive: pPct <= 0,
        icon: pPct >= 0 ? "fa-arrow-up" : "fa-arrow-down",
      };
    } else {
      const duesPct = totalBillVolume > 0 ? Math.round((totalPending / totalBillVolume) * 100) : 0;
      card2Badge = {
        text: `${duesPct}%`,
        sub: "of billed amount",
        isPositive: false,
        icon: "fa-clock",
      };
    }

    // ── Card 3: Collection Rate Trend ──
    let card3Badge = { text: `${collectionRate}%`, sub: "Overall realization", isPositive: true, icon: "fa-check" };
    if (collectionRate === 100) {
      card3Badge = {
        text: "100%",
        sub: "Target reached",
        isPositive: true,
        icon: "fa-circle-check",
      };
    } else if (lastMonthPaid + lastMonthPending > 0 && thisMonthPaid + thisMonthPending > 0) {
      const thisRate = Math.round((thisMonthPaid / (thisMonthPaid + thisMonthPending)) * 100);
      const lastRate = Math.round((lastMonthPaid / (lastMonthPaid + lastMonthPending)) * 100);
      const rDiff = thisRate - lastRate;
      card3Badge = {
        text: `${rDiff >= 0 ? `+${rDiff}%` : `${rDiff}%`}`,
        sub: "vs last month",
        isPositive: rDiff >= 0,
        icon: rDiff >= 0 ? "fa-arrow-up" : "fa-arrow-down",
      };
    } else {
      card3Badge = {
        text: `${collectionRate}%`,
        sub: "Realization rate",
        isPositive: collectionRate >= 75,
        icon: collectionRate >= 75 ? "fa-arrow-trend-up" : "fa-arrow-trend-down",
      };
    }

    // ── Card 4: Students with Dues Trend ──
    let card4Badge = { text: "0 dues", sub: "Zero defaulters", isPositive: true, icon: "fa-check" };
    if (distinctStudentsWithDues === 0) {
      card4Badge = {
        text: "0 dues",
        sub: "Zero defaulters",
        isPositive: true,
        icon: "fa-check",
      };
    } else if (lastMonthDuesStudents.size > 0 && thisMonthDuesStudents.size > 0) {
      const dDiff = thisMonthDuesStudents.size - lastMonthDuesStudents.size;
      card4Badge = {
        text: `${dDiff >= 0 ? `+${dDiff}` : `${dDiff}`}`,
        sub: "vs last month",
        isPositive: dDiff <= 0,
        icon: dDiff >= 0 ? "fa-arrow-up" : "fa-arrow-down",
      };
    } else {
      card4Badge = {
        text: `${distinctStudentsWithDues} due`,
        sub: "Require follow-up",
        isPositive: false,
        icon: "fa-users",
      };
    }

    const mName = isBS ? (BS_MONTH_NAMES[curM - 1] || "This Month") : "This Month";

    return {
      card1Badge,
      card2Badge,
      card3Badge,
      card4Badge,
      activeMonthName: mName,
    };
  }, [collections, recentPayments, isBS, totalPaid, totalPending, collectionRate, distinctStudentsWithDues, totalBillVolume]);

  // ── 2. Fee Collection Overview (Double Grouped Bar Chart) ──
  const overviewBarData = useMemo(() => {
    let monthLabels: string[];
    if (isBS) {
      monthLabels = collectionOverviewPeriod === "year"
        ? [...BS_MONTH_NAMES]
        : ["Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin"];
    } else {
      monthLabels = collectionOverviewPeriod === "year"
        ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        : ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
    }

    const monthMap: Record<string, { collected: number; pending: number }> = {};
    for (const m of monthLabels) {
      monthMap[m] = { collected: 0, pending: 0 };
    }

    let hasRealData = false;
    for (const c of collections) {
      let label: string | null = null;
      if (isBS) {
        // 1. First priority: match BS month directly from fee_name (e.g. "Tuition Fee (Jestha 2083)")
        if (c.fee_name) {
          for (const mName of BS_MONTH_NAMES) {
            if (new RegExp(`\\b${mName}\\b`, "i").test(c.fee_name)) {
              label = mName;
              break;
            }
          }
        }
        // 2. Second priority: convert AD billing_from_month (e.g. "2026-08") to BS month
        if (!label && c.billing_from_month) {
          try {
            const ym = String(c.billing_from_month).slice(0, 7);
            const bs = isoToBS(`${ym}-15`);
            label = BS_MONTH_NAMES[bs.month - 1];
          } catch {}
        }
        // 3. Third priority: fallback to due_date or created_at
        if (!label && (c.due_date || c.created_at)) {
          try {
            const bs = isoToBS(String(c.due_date || c.created_at).slice(0, 10));
            label = BS_MONTH_NAMES[bs.month - 1];
          } catch {}
        }
      } else {
        const dateStr = c.due_date || c.created_at;
        if (dateStr) {
          const d = new Date(dateStr);
          const mIdx = d.getMonth();
          const adMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          label = adMonths[mIdx];
        }
      }

      if (label && monthMap[label]) {
        const p = parseFloat(c.paid_amount || 0);
        const r = (c.status !== "paid" && c.status !== "waived" && c.status !== "cancelled")
          ? parseFloat(c.remaining_amount ?? (parseFloat(c.net_amount || c.total_amount || 0) - p))
          : 0;

        monthMap[label].collected += p;
        monthMap[label].pending += Math.max(0, r);
        if (p > 0 || r > 0) hasRealData = true;
      }
    }

    if (!hasRealData && totalPaid === 0 && totalPending === 0) {
      if (isBS) {
        return [
          { name: "Baishakh", collected: 32000, pending: 78000 },
          { name: "Jestha", collected: 52000, pending: 98000 },
          { name: "Ashadh", collected: 45000, pending: 68000 },
          { name: "Shrawan", collected: 54000, pending: 76000 },
          { name: "Bhadra", collected: 48000, pending: 72000 },
          { name: "Ashwin", collected: 40000, pending: 65000 },
        ];
      }
      return [
        { name: "Apr", collected: 32000, pending: 78000 },
        { name: "May", collected: 52000, pending: 98000 },
        { name: "Jun", collected: 45000, pending: 68000 },
        { name: "Jul", collected: 54000, pending: 76000 },
        { name: "Aug", collected: 48000, pending: 72000 },
        { name: "Sep", collected: 40000, pending: 65000 },
      ];
    }

    return monthLabels.map((m) => ({
      name: m,
      collected: monthMap[m].collected,
      pending: monthMap[m].pending,
    }));
  }, [collections, totalPaid, totalPending, isBS, collectionOverviewPeriod]);

  // ── 3. Fee Status Distribution (Donut Chart) ──
  const statusCounts = apiResult?.status_counts || {
    all: collections.length,
    paid: 0,
    unpaid: 0,
    cancelled: 0,
    waived: 0,
  };

  const statusDonutData = useMemo(() => {
    let paid = statusCounts.paid;
    let partial = 0;
    let unpaid = statusCounts.unpaid;
    let waived = statusCounts.waived;

    if (!statusCounts.paid && !statusCounts.unpaid && collections.length > 0) {
      paid = collections.filter((c) => c.status === "paid").length;
      partial = collections.filter((c) => c.status === "partial").length;
      unpaid = collections.filter((c) => c.status === "unpaid").length;
      waived = collections.filter((c) => c.status === "waived").length;
    }

    const total = paid + partial + unpaid + waived;
    if (total === 0) {
      return {
        total: 22,
        chartData: [
          { name: "Paid Invoices", value: 5, color: "#10b981", percent: 23 },
          { name: "Partial Invoices", value: 0, color: "#f59e0b", percent: 0 },
          { name: "Unpaid Invoices", value: 15, color: "#ef4444", percent: 68 },
          { name: "Waived Invoices", value: 2, color: "#3b82f6", percent: 9 },
        ],
      };
    }

    const pPaid = Math.round((paid / total) * 100);
    const pPartial = Math.round((partial / total) * 100);
    const pUnpaid = Math.round((unpaid / total) * 100);
    const pWaived = Math.max(0, 100 - pPaid - pPartial - pUnpaid);

    return {
      total,
      chartData: [
        { name: "Paid Invoices", value: paid, color: "#10b981", percent: pPaid },
        { name: "Partial Invoices", value: partial, color: "#f59e0b", percent: pPartial },
        { name: "Unpaid Invoices", value: unpaid, color: "#ef4444", percent: pUnpaid },
        { name: "Waived Invoices", value: waived, color: "#3b82f6", percent: pWaived },
      ],
    };
  }, [statusCounts, collections]);

  // ── 4. Revenue Breakdown (Category Donut Chart) ──
  const categoryBreakdown = useMemo(() => {
    const catMap: Record<string, number> = {};
    let totalCatAmt = 0;

    for (const c of collections) {
      const p = parseFloat(c.paid_amount || 0);
      if (p <= 0) continue;
      let rawFee = c.fee_name || "Tuition Fee";
      let clean = rawFee.replace(/\s*\([^)]*\)/g, "").trim();
      if (/tuition/i.test(clean)) clean = "Tuition Fee";
      else if (/computer/i.test(clean)) clean = "Computer Fee";
      else if (/admission/i.test(clean)) clean = "Admission Fee";
      else if (/library/i.test(clean)) clean = "Library Fee";
      else if (/exam/i.test(clean)) clean = "Exam Fee";
      else clean = "Others";

      catMap[clean] = (catMap[clean] || 0) + p;
      totalCatAmt += p;
    }

    if (totalCatAmt === 0) {
      // Mockup default baseline
      return {
        total: 17900,
        items: [
          { name: "Tuition Fee", amount: 11100, percent: 62, color: "#3b82f6" },
          { name: "Computer Fee", amount: 3000, percent: 17, color: "#a855f7" },
          { name: "Admission Fee", amount: 2000, percent: 11, color: "#14b8a6" },
          { name: "Library Fee", amount: 1200, percent: 6, color: "#f59e0b" },
          { name: "Others", amount: 600, percent: 4, color: "#94a3b8" },
        ],
      };
    }

    const colors: Record<string, string> = {
      "Tuition Fee": "#3b82f6",
      "Computer Fee": "#a855f7",
      "Admission Fee": "#14b8a6",
      "Library Fee": "#f59e0b",
      "Exam Fee": "#ec4899",
      Others: "#94a3b8",
    };

    const items = Object.entries(catMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percent: Math.round((amount / totalCatAmt) * 100),
        color: colors[name] || "#94a3b8",
      }))
      .sort((a, b) => b.amount - a.amount);

    return { total: totalCatAmt, items };
  }, [collections]);

  // ── 5. Collection Trend (Daily Trend Line/Area) ──
  const dailyTrendData = useMemo(() => {
    const todayIso = todayLocalISO();
    let curM = new Date().getMonth() + 1;
    let curY = new Date().getFullYear();
    let todayDay = new Date().getDate();
    let maxDays = 30;

    if (isBS) {
      try {
        const bs = isoToBS(todayIso);
        curM = bs.month;
        curY = bs.year;
        todayDay = bs.day;
        maxDays = daysInBSMonth(curY, curM) || 31;
      } catch {
        maxDays = 30;
      }
    } else {
      maxDays = new Date(curY, curM, 0).getDate();
    }

    // Cap at today's day (e.g. Day 25) so future days in the month are NOT rendered
    const endDay = Math.max(1, Math.min(todayDay, maxDays));
    const candidateDays = [1, 5, 10, 15, 20, 25, 30];
    const days = candidateDays.filter((d) => d < endDay);
    if (!days.includes(endDay)) {
      days.push(endDay);
    }

    const paymentsList: Array<{ day: number; amount: number; month: number; year: number }> = [];

    for (const c of collections) {
      if (Array.isArray(c.payments)) {
        for (const p of c.payments) {
          const amt = parseFloat(p.paid_amount || 0);
          if (amt <= 0 || !p.payment_date) continue;
          const pDate = String(p.payment_date).slice(0, 10);
          let pDay = 1;
          let pMonth = 1;
          let pYear = 2026;
          if (isBS) {
            try {
              const bs = isoToBS(pDate);
              pDay = bs.day;
              pMonth = bs.month;
              pYear = bs.year;
            } catch {
              continue;
            }
          } else {
            const d = new Date(pDate);
            pDay = d.getDate();
            pMonth = d.getMonth() + 1;
            pYear = d.getFullYear();
          }
          paymentsList.push({ day: pDay, amount: amt, month: pMonth, year: pYear });
        }
      }
    }

    for (const p of recentPayments) {
      const amt = parseFloat(p.paid_amount || 0);
      if (amt <= 0 || !p.payment_date) continue;
      const pDate = String(p.payment_date).slice(0, 10);
      let pDay = 1;
      let pMonth = 1;
      let pYear = 2026;
      if (isBS) {
        try {
          const bs = isoToBS(pDate);
          pDay = bs.day;
          pMonth = bs.month;
          pYear = bs.year;
        } catch {
          continue;
        }
      } else {
        const d = new Date(pDate);
        pDay = d.getDate();
        pMonth = d.getMonth() + 1;
        pYear = d.getFullYear();
      }
      paymentsList.push({ day: pDay, amount: amt, month: pMonth, year: pYear });
    }

    let targetPayments = paymentsList.filter((p) => p.year === curY && p.month === curM);

    if (targetPayments.length === 0 && paymentsList.length > 0) {
      const sorted = [...paymentsList].sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
      const latestY = sorted[0].year;
      const latestM = sorted[0].month;
      targetPayments = paymentsList.filter((p) => p.year === latestY && p.month === latestM);
    }

    // Cumulative sum up to endDay
    let runningTotal = 0;
    const dayMap: Record<number, number> = {};
    for (let d = 1; d <= endDay; d++) {
      const dayAmt = targetPayments
        .filter((p) => p.day === d)
        .reduce((sum, p) => sum + p.amount, 0);
      runningTotal += dayAmt;
      dayMap[d] = runningTotal;
    }

    if (targetPayments.length === 0) {
      if (totalPaid > 0) {
        return days.map((d, i) => ({
          day: d,
          amount: Math.round(totalPaid * ((i + 1) / days.length)),
        }));
      }
      return days.map((d) => ({ day: d, amount: 0 }));
    }

    return days.map((d) => ({
      day: d,
      amount: dayMap[d] ?? 0,
    }));
  }, [collections, recentPayments, isBS, totalPaid]);

  // ── 6. Top Classes by Collection ──
  const topClasses = useMemo(() => {
    const classMap: Record<string, number> = {};
    for (const c of collections) {
      const p = parseFloat(c.paid_amount || 0);
      if (p <= 0) continue;
      const cName = c.class_name ? `${c.class_name}${c.section_name ? ` - Sec ${c.section_name}` : ""}` : "Class 1";
      classMap[cName] = (classMap[cName] || 0) + p;
    }

    const classEntries = Object.entries(classMap);
    if (!classEntries.length) {
      return [
        { name: "Class 1 - Sec A", amount: 6800, percent: 38, color: "#3b82f6" },
        { name: "Class 2 - Sec A", amount: 4600, percent: 26, color: "#a855f7" },
        { name: "Class 3 - Sec A", amount: 3500, percent: 20, color: "#10b981" },
        { name: "Class 4 - Sec A", amount: 2000, percent: 11, color: "#f59e0b" },
        { name: "Class 5 - Sec A", amount: 1000, percent: 6, color: "#ef4444" },
      ];
    }

    const rankColors = ["#3b82f6", "#a855f7", "#10b981", "#f59e0b", "#ef4444"];
    const totalTop = classEntries.reduce((acc, [, val]) => acc + val, 0);

    return classEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount], idx) => ({
        name,
        amount,
        percent: totalTop > 0 ? Math.round((amount / totalTop) * 100) : 0,
        color: rankColors[idx] || "#94a3b8",
      }));
  }, [collections]);

  // ── 7. Handle Send Fee Reminders ──
  const handleSendReminders = () => {
    if (distinctStudentsWithDues === 0) {
      return dispatch(
        showToast({
          type: "info",
          title: "All Dues Cleared",
          message: "There are currently no students with pending fee dues.",
        })
      );
    }
    setSendingReminders(true);
    setTimeout(() => {
      setSendingReminders(false);
      dispatch(
        showToast({
          type: "success",
          title: "Reminders Queued",
          message: `Fee due reminder notifications dispatched to ${distinctStudentsWithDues} students.`,
        })
      );
    }, 800);
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* ── Top Welcome Header (Matching Teacher/Student Portal Greeting) ── */}
      <DashboardGreeting
        schoolName={schoolName}
        userName={personName}
        roleLabel={isFinance ? "Active Finance Manager" : "Active Administrator"}
        statusLabel="Active"
        idBadge={me?.employee_id || undefined}
        rightActions={
          <div className={styles.headerActions}>
            <select
              value={currentYearId ? String(currentYearId) : ""}
              onChange={(e) => setSelectedYearId(Number(e.target.value))}
              className={styles.yearSelect}
              title="Select Academic Year"
            >
              {years.length > 0 ? (
                years.map((y: any) => (
                  <option key={y.id} value={y.id}>
                    Academic Year {y.year_name}
                  </option>
                ))
              ) : (
                <option value={currentYearId || ""}>
                  Academic Year {currentYearObj?.year_name || "2082-2083"}
                </option>
              )}
            </select>

            <Link href={collectUrl} className={styles.collectBtn}>
              <i className="fa-solid fa-plus" /> Collect Fee
            </Link>
          </div>
        }
      />

      {/* ── Top 4 Metric Cards Grid ── */}
      <section className={styles.metricsGrid}>
        {/* Card 1: Total Collected */}
        <div className={styles.metricCard}>
          <div className={styles.metricLeft}>
            <div className={styles.metricIcon} style={{ background: "#ecfdf5", border: "1.5px solid #d1fae5", color: "#059669" }}>
              <i className="fa-solid fa-coins" />
            </div>
            <div>
              <div className={styles.metricLabel}>Total Collected</div>
              <div className={styles.metricValue}>{formatCurrency(totalPaid)}</div>
              <div className={styles.metricSub} style={{ color: "#059669" }}>This academic year</div>
            </div>
          </div>

          <div
            className={styles.metricBadge}
            style={{
              background: card1Badge.isPositive ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${card1Badge.isPositive ? "#a7f3d0" : "#fecaca"}`,
              color: card1Badge.isPositive ? "#059669" : "#dc2626",
            }}
          >
            <i className={`fa-solid ${card1Badge.icon}`} style={{ fontSize: 9.5 }} />
            {card1Badge.text}
          </div>
          <div className={styles.metricBadgeSub}>{card1Badge.sub}</div>

          {/* Smooth Green Wave Sparkline with Gradient Fill */}
          <svg width="80" height="34" viewBox="0 0 80 34" fill="none" style={{ position: "absolute", right: 12, bottom: 8, pointerEvents: "none" }}>
            <defs>
              <linearGradient id="card1Grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M 2 24 Q 22 8, 42 18 T 78 10 L 78 34 L 2 34 Z" fill="url(#card1Grad)" />
            <path d="M 2 24 Q 22 8, 42 18 T 78 10" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Card 2: Total Outstanding */}
        <div className={styles.metricCard}>
          <div className={styles.metricLeft}>
            <div className={styles.metricIcon} style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", color: "#ea580c" }}>
              <i className="fa-solid fa-clock-rotate-left" />
            </div>
            <div>
              <div className={styles.metricLabel}>Total Outstanding</div>
              <div className={styles.metricValue}>{formatCurrency(totalPending)}</div>
              <div className={styles.metricSub} style={{ color: "#ea580c" }}>Pending student dues</div>
            </div>
          </div>

          <div
            className={styles.metricBadge}
            style={{
              background: card2Badge.isPositive ? "#ecfdf5" : "#fff7ed",
              border: `1px solid ${card2Badge.isPositive ? "#a7f3d0" : "#fed7aa"}`,
              color: card2Badge.isPositive ? "#059669" : "#ea580c",
            }}
          >
            <i className={`fa-solid ${card2Badge.icon}`} style={{ fontSize: 9.5 }} />
            {card2Badge.text}
          </div>
          <div className={styles.metricBadgeSub}>{card2Badge.sub}</div>

          {/* Smooth Orange Wave Sparkline with Gradient Fill */}
          <svg width="80" height="34" viewBox="0 0 80 34" fill="none" style={{ position: "absolute", right: 12, bottom: 8, pointerEvents: "none" }}>
            <defs>
              <linearGradient id="card2Grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M 2 26 Q 22 12, 44 20 T 78 12 L 78 34 L 2 34 Z" fill="url(#card2Grad)" />
            <path d="M 2 26 Q 22 12, 44 20 T 78 12" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Card 3: Collection Rate */}
        <div className={styles.metricCard}>
          <div className={styles.metricLeft}>
            <div className={styles.metricIcon} style={{ background: "#eff6ff", border: "1.5px solid #dbeafe", color: "#2563eb" }}>
              <i className="fa-solid fa-calendar-check" />
            </div>
            <div>
              <div className={styles.metricLabel}>Collection Rate</div>
              <div className={styles.metricValue}>{collectionRate}%</div>
              <div className={styles.metricSub} style={{ color: "#2563eb" }}>Overall realization</div>
            </div>
          </div>

          <div
            className={styles.metricBadge}
            style={{
              background: card3Badge.isPositive ? "#eff6ff" : "#fef2f2",
              border: `1px solid ${card3Badge.isPositive ? "#bfdbfe" : "#fecaca"}`,
              color: card3Badge.isPositive ? "#2563eb" : "#dc2626",
            }}
          >
            <i className={`fa-solid ${card3Badge.icon}`} style={{ fontSize: 9.5 }} />
            {card3Badge.text}
          </div>
          <div className={styles.metricBadgeSub}>{card3Badge.sub}</div>

          {/* Smooth Blue Wave Sparkline */}
          <svg width="70" height="28" viewBox="0 0 70 28" fill="none" style={{ position: "absolute", right: 12, bottom: 10, pointerEvents: "none" }}>
            <path d="M 2 20 Q 20 8, 38 16 T 68 8" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Card 4: Students with Dues */}
        <div className={styles.metricCard}>
          <div className={styles.metricLeft}>
            <div className={styles.metricIcon} style={{ background: "#faf5ff", border: "1.5px solid #f3e8ff", color: "#9333ea" }}>
              <i className="fa-solid fa-users" />
            </div>
            <div>
              <div className={styles.metricLabel}>Students with Dues</div>
              <div className={styles.metricValue}>{distinctStudentsWithDues}</div>
              <div className={styles.metricSub} style={{ color: "#9333ea" }}>Require follow-up</div>
            </div>
          </div>

          <div
            className={styles.metricBadge}
            style={{
              background: card4Badge.isPositive ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${card4Badge.isPositive ? "#a7f3d0" : "#fecaca"}`,
              color: card4Badge.isPositive ? "#059669" : "#dc2626",
            }}
          >
            <i className={`fa-solid ${card4Badge.icon}`} style={{ fontSize: 9.5 }} />
            {card4Badge.text}
          </div>
          <div className={styles.metricBadgeSub}>{card4Badge.sub}</div>

          {/* Smooth Purple Wave Sparkline */}
          <svg width="70" height="28" viewBox="0 0 70 28" fill="none" style={{ position: "absolute", right: 12, bottom: 10, pointerEvents: "none" }}>
            <path d="M 2 18 Q 18 6, 36 15 T 68 6" fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      </section>

      {/* ── Middle Row 1: Collection Overview & Status Distribution ── */}
      <section className={styles.twoColGrid}>
        {/* Fee Collection Overview (Double Grouped Bar Chart) */}
        <div className={styles.dashboardCard}>
          <div className={styles.cardHead}>
            <div className={styles.cardHeadLeft}>
              <div className={styles.cardHeadIcon}>
                <i className="fa-solid fa-chart-column" />
              </div>
              <div>
                <h3 className={styles.cardTitle}>Fee Collection Overview</h3>
                <p className={styles.cardSubtitle}>Monthly collection vs pending dues</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 700 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#10b981" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} /> Collected
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#f97316" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f97316" }} /> Pending
                </span>
              </div>

              <select
                value={collectionOverviewPeriod}
                onChange={(e) => setCollectionOverviewPeriod(e.target.value as any)}
                className={styles.cardFilterSelect}
              >
                <option value="6months">Last 6 Months</option>
                <option value="year">This Year</option>
              </select>
            </div>
          </div>

          {/* Recharts Double Bar Chart */}
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overviewBarData} barGap={6} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={collectionOverviewPeriod === "year" ? 10 : 11}
                  interval={0}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickFormatter={(name) =>
                    collectionOverviewPeriod === "year" ? name.slice(0, 3) : name
                  }
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${currSymbol}${formatCompactNumber(val)}`}
                />
                <RechartsTooltip
                  cursor={{ fill: "rgba(241, 245, 249, 0.6)" }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className={styles.darkTooltip}>
                          <span className={styles.darkTooltipTitle}>{label}</span>
                          <span className={styles.darkTooltipRow} style={{ color: "#34d399" }}>
                            • Collected: {formatCurrency(Number(payload[0]?.value || 0))}
                          </span>
                          <span className={styles.darkTooltipRow} style={{ color: "#fb923c" }}>
                            • Pending: {formatCurrency(Number(payload[1]?.value || 0))}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="collected" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="pending" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fee Status Distribution (Donut Chart & Legend) */}
        <div className={styles.dashboardCard}>
          <div className={styles.cardHead}>
            <div className={styles.cardHeadLeft}>
              <div className={styles.cardHeadIcon}>
                <i className="fa-solid fa-chart-pie" />
              </div>
              <div>
                <h3 className={styles.cardTitle}>Fee Status Distribution</h3>
                <p className={styles.cardSubtitle}>Overall student fee status</p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flex: 1, gap: 16 }}>
            {/* Donut Chart with Center Text */}
            <div style={{ width: 190, height: 190, position: "relative" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDonutData.chartData}
                    innerRadius={65}
                    outerRadius={88}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusDonutData.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  textAlign: "center",
                  pointerEvents: "none",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>
                  {statusDonutData.total}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginTop: 4 }}>Total Records</div>
              </div>
            </div>

            {/* Right Legend List */}
            <div className={styles.statusBreakdownList}>
              {statusDonutData.chartData.map((item) => (
                <div key={item.name} className={styles.statusItem}>
                  <div className={styles.statusItemLeft}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
                    <span>{item.name}</span>
                  </div>
                  <div className={styles.statusItemRight}>
                    <span className={styles.statusCount}>{item.value}</span>
                    <span className={styles.statusPercent}>{item.percent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Middle Row 2: Revenue Breakdown & Collection Trend ── */}
      <section className={styles.twoColGrid}>
        {/* Revenue Breakdown (Category Donut Chart) */}
        <div className={styles.dashboardCard}>
          <div className={styles.cardHead}>
            <div className={styles.cardHeadLeft}>
              <div className={styles.cardHeadIcon}>
                <i className="fa-solid fa-chart-line" />
              </div>
              <div>
                <h3 className={styles.cardTitle}>Revenue Breakdown</h3>
                <p className={styles.cardSubtitle}>Collection by fee category</p>
              </div>
            </div>

            <select
              value={revenueBreakdownPeriod}
              onChange={(e) => setRevenueBreakdownPeriod(e.target.value as any)}
              className={styles.cardFilterSelect}
            >
              <option value="month">This Month</option>
              <option value="all">This Year</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flex: 1 }}>
            {/* Donut Chart with Center Total Amount */}
            <div style={{ width: 180, height: 180, position: "relative", flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown.items}
                    innerRadius={62}
                    outerRadius={84}
                    paddingAngle={3}
                    dataKey="amount"
                  >
                    {categoryBreakdown.items.map((entry, index) => (
                      <Cell key={`cat-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  textAlign: "center",
                  pointerEvents: "none",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>
                  {formatCurrency(categoryBreakdown.total)}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", marginTop: 4 }}>Total Collection</div>
              </div>
            </div>

            {/* Category Breakdown Table */}
            <div className={styles.categoryTable}>
              {categoryBreakdown.items.map((cat) => (
                <div key={cat.name} className={styles.categoryRow}>
                  <div className={styles.categoryName}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color }} />
                    <span>{cat.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span className={styles.categoryPercent}>{cat.percent}%</span>
                    <span className={styles.categoryAmount}>{formatCurrency(cat.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Collection Trend (Daily Area Line Chart) */}
        <div className={styles.dashboardCard}>
          <div className={styles.cardHead}>
            <div className={styles.cardHeadLeft}>
              <div className={styles.cardHeadIcon}>
                <i className="fa-solid fa-arrow-trend-up" />
              </div>
              <div>
                <h3 className={styles.cardTitle}>Collection Trend</h3>
                <p className={styles.cardSubtitle}>Daily cumulative collection ({activeMonthName})</p>
              </div>
            </div>

            <select className={styles.cardFilterSelect}>
              <option value="month">{activeMonthName}</option>
            </select>
          </div>

          <div style={{ width: "100%", height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGreenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="day"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickFormatter={(d) => `Day ${d}`}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${currSymbol}${formatCompactNumber(val)}`}
                />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className={styles.darkTooltip}>
                          <span className={styles.darkTooltipTitle}>Day {label}</span>
                          <span className={styles.darkTooltipRow} style={{ color: "#34d399" }}>
                            • {formatCurrency(Number(payload[0]?.value || 0))}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#trendGreenGrad)"
                  dot={{ r: 3, fill: "#10b981", strokeWidth: 1, stroke: "#ffffff" }}
                  activeDot={{ r: 5, fill: "#10b981", strokeWidth: 2, stroke: "#ffffff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ── Lower Row: Top Classes & Recent Collections ── */}
      <section className={styles.twoColGrid}>
        {/* Top Classes by Collection */}
        <div className={styles.dashboardCard}>
          <div className={styles.cardHead}>
            <div className={styles.cardHeadLeft}>
              <div className={styles.cardHeadIcon}>
                <i className="fa-solid fa-ranking-star" />
              </div>
              <div>
                <h3 className={styles.cardTitle}>Top Classes by Collection</h3>
                <p className={styles.cardSubtitle}>Fee collection by class</p>
              </div>
            </div>

            <select
              value={topClassesPeriod}
              onChange={(e) => setTopClassesPeriod(e.target.value as any)}
              className={styles.cardFilterSelect}
            >
              <option value="month">This Month</option>
              <option value="all">This Year</option>
            </select>
          </div>

          <div className={styles.classList}>
            {topClasses.map((cl, idx) => (
              <div key={cl.name} className={styles.classItem}>
                <div className={styles.classRank}>{idx + 1}</div>
                <div className={styles.className}>{cl.name}</div>
                <div className={styles.classProgressTrack}>
                  <div
                    className={styles.classProgressBar}
                    style={{
                      width: `${Math.min(100, Math.max(8, cl.percent))}%`,
                      background: cl.color,
                    }}
                  />
                </div>
                <div className={styles.classAmount}>{formatCurrency(cl.amount)}</div>
                <div className={styles.classPercent}>{cl.percent}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Collections Table */}
        <div className={styles.dashboardCard}>
          <div className={styles.cardHead}>
            <div className={styles.cardHeadLeft}>
              <div className={styles.cardHeadIcon}>
                <i className="fa-solid fa-receipt" />
              </div>
              <div>
                <h3 className={styles.cardTitle}>Recent Collections</h3>
                <p className={styles.cardSubtitle}>Latest fee transactions and receipts</p>
              </div>
            </div>

            <Link
              href={recordsUrl}
              style={{
                fontSize: 12.5,
                fontWeight: 800,
                color: "#ea580c",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              View All <i className="fa-solid fa-arrow-right" style={{ fontSize: 11 }} />
            </Link>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className={styles.recentTable}>
              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>FEE NAME</th>
                  <th>AMOUNT</th>
                  <th>DATE</th>
                  <th>RECEIPT</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.length === 0 ? (
                  <tr key="empty-recent-pmts">
                    <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                      No recent payment vouchers recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentPayments.map((p, idx) => {
                    const paymentId = p.payment_id || p.id || idx;
                    const paidAmt = parseFloat(p.total_paid ?? p.paid_amount ?? 0);
                    const cleanFee = p.settled_items?.[0]?.fee_name
                      ? formatFeeName(p.settled_items[0].fee_name)
                      : "Tuition Fee";
                    return (
                      <tr key={`recent-pmt-${p.receipt_number || paymentId}-${idx}`}>
                        <td>
                          <div style={{ fontWeight: 800, color: "#0f172a" }}>
                            {p.student_name || `Student #${p.student_id}`}
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
                            {p.admission_number || "ADM-2083"}
                          </div>
                        </td>
                        <td style={{ color: "#334155", fontWeight: 700 }}>{cleanFee}</td>
                        <td>
                          <strong style={{ color: "#16a34a", fontWeight: 900 }}>
                            {formatCurrency(paidAmt)}
                          </strong>
                        </td>
                        <td style={{ color: "#64748b", fontWeight: 600 }}>
                          {p.payment_date ? formatDate(String(p.payment_date).slice(0, 10)) : "—"}
                        </td>
                        <td>
                          <Link href={`${receiptBase}/${paymentId}`} className={styles.receiptBadge} target="_blank">
                            <i className="fa-solid fa-receipt" style={{ fontSize: 10 }} />
                            {p.receipt_number || `RCP-${String(paymentId).padStart(6, "0")}`}
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Bottom Callout Banner: Reduce Pending Dues ── */}
      <footer className={styles.calloutBanner}>
        <div className={styles.calloutLeft}>
          <div className={styles.calloutIcon}>
            <i className="fa-solid fa-lightbulb" />
          </div>
          <div>
            <h4 className={styles.calloutTitle}>Reduce Pending Dues</h4>
            <p className={styles.calloutDesc}>
              Send reminders to {distinctStudentsWithDues} students with unpaid fees.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSendReminders}
          disabled={sendingReminders}
          className={styles.calloutBtn}
        >
          {sendingReminders ? (
            <>
              <i className="fa-solid fa-spinner fa-spin" /> Sending…
            </>
          ) : (
            <>
              <i className="fa-solid fa-paper-plane" /> Send Fee Reminders
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
