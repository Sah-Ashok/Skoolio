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
import { apiRequest } from "@/lib/api";
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

  // ── Fetch Current User / School Profile (Skip if user is already present in Redux) ──
  const { data: me } = useApi<any>(user?.school_name && user?.full_name ? "" : "/auth/me");

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

  // ── Unified Single-Pass Dashboard Aggregation (P1, P2, L2, L3, L4, L5) ──
  const {
    distinctStudentsWithDues,
    card1Badge,
    card2Badge,
    card3Badge,
    card4Badge,
    activeMonthName,
    overviewBarData,
    statusDonutData,
    categoryBreakdown,
    dailyTrendData,
    topClasses,
  } = useMemo(() => {
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
    const prevM = curM === 1 ? 12 : curM - 1;
    const prevY = curM === 1 ? curY - 1 : curY;

    // 1. Setup Rolling Months for Overview Bar Chart (L3)
    const overviewMonthLabels: string[] = [];
    if (collectionOverviewPeriod === "year") {
      overviewMonthLabels.push(...(isBS ? [...BS_MONTH_NAMES] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]));
    } else {
      for (let i = 5; i >= 0; i--) {
        let m = curM - i;
        while (m < 1) m += 12;
        overviewMonthLabels.push(isBS ? BS_MONTH_NAMES[m - 1] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]);
      }
    }
    const overviewMonthMap: Record<string, { collected: number; pending: number }> = {};
    for (const m of overviewMonthLabels) {
      overviewMonthMap[m] = { collected: 0, pending: 0 };
    }

    // 2. Track Deduplicated Payments (L2)
    const seenPaymentKeys = new Set<string>();
    const allPmts: Array<{ amount: number; month: number; year: number; day: number; date: string }> = [];

    const addPayment = (p: any, collectionId?: number) => {
      const amt = parseFloat(p.paid_amount || 0);
      if (amt <= 0 || !p.payment_date) return;
      const pDate = String(p.payment_date).slice(0, 10);
      const colId = collectionId ?? p.collection_id ?? 0;
      const pKey = p.id ? `id_${p.id}` : `${colId}_${pDate}_${amt}_${p.receipt_number || ''}`;
      if (seenPaymentKeys.has(pKey)) return;
      seenPaymentKeys.add(pKey);

      let pDay = 1;
      let m = 1;
      let y = 2026;
      if (isBS) {
        try {
          const bs = isoToBS(pDate);
          pDay = bs.day;
          m = bs.month;
          y = bs.year;
        } catch {
          const d = new Date(pDate);
          pDay = d.getDate();
          m = d.getMonth() + 1;
          y = d.getFullYear();
        }
      } else {
        const d = new Date(pDate);
        pDay = d.getDate();
        m = d.getMonth() + 1;
        y = d.getFullYear();
      }
      allPmts.push({ amount: amt, month: m, year: y, day: pDay, date: pDate });
    };

    // 3. Single-Pass Iteration over Collections
    const duesStudentsSet = new Set<number>();
    const thisMonthDuesStudents = new Set<number>();
    const lastMonthDuesStudents = new Set<number>();
    let thisMonthPending = 0;
    let lastMonthPending = 0;
    let thisMonthPaidFallback = 0;
    let lastMonthPaidFallback = 0;
    const catMap: Record<string, number> = {};
    let totalCatAmt = 0;
    const classMap: Record<string, number> = {};
    const fallbackStatusCounts = { paid: 0, partial: 0, unpaid: 0, waived: 0, cancelled: 0 };
    let hasRealOverviewData = false;

    for (const c of collections) {
      const p = parseFloat(c.paid_amount || 0);
      const rem = (c.status !== "paid" && c.status !== "waived" && c.status !== "cancelled")
        ? parseFloat(c.remaining_amount ?? (parseFloat(c.net_amount || c.total_amount || 0) - p))
        : 0;

      // Status count fallback
      if (c.status === "paid") fallbackStatusCounts.paid++;
      else if (c.status === "partial") fallbackStatusCounts.partial++;
      else if (c.status === "unpaid") fallbackStatusCounts.unpaid++;
      else if (c.status === "waived") fallbackStatusCounts.waived++;
      else if (c.status === "cancelled") fallbackStatusCounts.cancelled++;

      // Dues tracking
      if (rem > 0 && c.student_id && c.status !== "paid" && c.status !== "waived" && c.status !== "cancelled") {
        duesStudentsSet.add(c.student_id);
      }

      // Payments from collection
      if (Array.isArray(c.payments)) {
        for (const pmt of c.payments) {
          addPayment(pmt, c.id);
        }
      }

      // Category breakdown (Revenue)
      if (p > 0) {
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

        // Top classes
        const cName = c.class_name ? `${c.class_name}${c.section_name ? ` - Sec ${c.section_name}` : ""}` : "Class 1";
        classMap[cName] = (classMap[cName] || 0) + p;
      }

      // Month matching for collections
      let cMonth = 0;
      let cYear = 0;
      let overviewLabel: string | null = null;

      if (isBS) {
        if (c.fee_name) {
          for (let bIdx = 0; bIdx < BS_MONTH_NAMES.length; bIdx++) {
            if (new RegExp(`\\b${BS_MONTH_NAMES[bIdx]}\\b`, "i").test(c.fee_name)) {
              cMonth = bIdx + 1;
              overviewLabel = BS_MONTH_NAMES[bIdx];
              break;
            }
          }
        }
        if (!overviewLabel && c.billing_from_month) {
          try {
            const ym = String(c.billing_from_month).slice(0, 7);
            const bs = isoToBS(`${ym}-15`);
            cYear = bs.year;
            cMonth = bs.month;
            overviewLabel = BS_MONTH_NAMES[bs.month - 1];
          } catch {}
        }
        if (!overviewLabel && (c.due_date || c.created_at)) {
          try {
            const bs = isoToBS(String(c.due_date || c.created_at).slice(0, 10));
            cYear = bs.year;
            cMonth = bs.month;
            overviewLabel = BS_MONTH_NAMES[bs.month - 1];
          } catch {}
        }
      } else {
        const dateStr = c.due_date || c.created_at;
        if (dateStr) {
          const d = new Date(dateStr);
          cYear = d.getFullYear();
          cMonth = d.getMonth() + 1;
          const adMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          overviewLabel = adMonths[d.getMonth()];
        }
      }

      if (overviewLabel && overviewMonthMap[overviewLabel]) {
        overviewMonthMap[overviewLabel].collected += p;
        overviewMonthMap[overviewLabel].pending += Math.max(0, rem);
        if (p > 0 || rem > 0) hasRealOverviewData = true;
      }

      if (cYear === curY && cMonth === curM) {
        thisMonthPending += Math.max(0, rem);
        thisMonthPaidFallback += p;
        if (rem > 0 && c.student_id) thisMonthDuesStudents.add(c.student_id);
      } else if (cYear === prevY && cMonth === prevM) {
        lastMonthPending += Math.max(0, rem);
        lastMonthPaidFallback += p;
        if (rem > 0 && c.student_id) lastMonthDuesStudents.add(c.student_id);
      }
    }

    // Add payments from recentPayments (Deduplicated with collections payments)
    for (const pmt of recentPayments) {
      addPayment(pmt);
    }

    // 4. Compute Month-over-Month Payments
    let thisMonthPaid = 0;
    let lastMonthPaid = 0;
    for (const p of allPmts) {
      if (p.year === curY && p.month === curM) {
        thisMonthPaid += p.amount;
      } else if (p.year === prevY && p.month === prevM) {
        lastMonthPaid += p.amount;
      }
    }
    if (allPmts.length === 0) {
      thisMonthPaid = thisMonthPaidFallback;
      lastMonthPaid = lastMonthPaidFallback;
    }

    // 5. Card Badges Calculation
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
      card1Badge = { text: "100%", sub: "Fully realized", isPositive: true, icon: "fa-check" };
    } else if (totalPaid > 0) {
      card1Badge = { text: `${collectionRate}%`, sub: "Realized to date", isPositive: true, icon: "fa-arrow-trend-up" };
    } else {
      card1Badge = { text: "0%", sub: "No collections yet", isPositive: false, icon: "fa-minus" };
    }

    let card2Badge = { text: "0%", sub: "All fees cleared", isPositive: true, icon: "fa-check" };
    if (totalPending === 0) {
      card2Badge = { text: "0%", sub: "All fees cleared", isPositive: true, icon: "fa-check" };
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
      card2Badge = { text: `${duesPct}%`, sub: "of billed amount", isPositive: false, icon: "fa-clock" };
    }

    let card3Badge = { text: `${collectionRate}%`, sub: "Overall realization", isPositive: true, icon: "fa-check" };
    if (collectionRate === 100) {
      card3Badge = { text: "100%", sub: "Target reached", isPositive: true, icon: "fa-circle-check" };
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

    let card4Badge = { text: "0 dues", sub: "Zero defaulters", isPositive: true, icon: "fa-check" };
    if (duesStudentsSet.size === 0) {
      card4Badge = { text: "0 dues", sub: "Zero defaulters", isPositive: true, icon: "fa-check" };
    } else if (lastMonthDuesStudents.size > 0 && thisMonthDuesStudents.size > 0) {
      const dDiff = thisMonthDuesStudents.size - lastMonthDuesStudents.size;
      card4Badge = {
        text: `${dDiff >= 0 ? `+${dDiff}` : `${dDiff}`}`,
        sub: "vs last month",
        isPositive: dDiff <= 0,
        icon: dDiff >= 0 ? "fa-arrow-up" : "fa-arrow-down",
      };
    } else {
      card4Badge = { text: `${duesStudentsSet.size} due`, sub: "Require follow-up", isPositive: false, icon: "fa-users" };
    }

    const mName = isBS ? (BS_MONTH_NAMES[curM - 1] || "This Month") : "This Month";

    // 6. Overview Bar Data
    const overviewBarData = overviewMonthLabels.map((m) => ({
      name: m,
      collected: overviewMonthMap[m]?.collected || 0,
      pending: overviewMonthMap[m]?.pending || 0,
    }));

    // 7. Status Donut Data (L5)
    const rawCounts = apiResult?.status_counts;
    let paidCount = rawCounts?.paid ?? fallbackStatusCounts.paid;
    let partialCount = rawCounts?.partial ?? fallbackStatusCounts.partial;
    let unpaidCount = rawCounts?.unpaid ?? fallbackStatusCounts.unpaid;
    let waivedCount = rawCounts?.waived ?? fallbackStatusCounts.waived;

    const totalStatusCount = paidCount + partialCount + unpaidCount + waivedCount;
    let statusDonutData;
    if (totalStatusCount === 0) {
      statusDonutData = {
        total: 0,
        chartData: [
          { name: "Paid Invoices", value: 0, color: "#10b981", percent: 0 },
          { name: "Partial Invoices", value: 0, color: "#f59e0b", percent: 0 },
          { name: "Unpaid Invoices", value: 0, color: "#ef4444", percent: 0 },
          { name: "Waived Invoices", value: 0, color: "#3b82f6", percent: 0 },
        ],
      };
    } else {
      const pPaid = Math.round((paidCount / totalStatusCount) * 100);
      const pPartial = Math.round((partialCount / totalStatusCount) * 100);
      const pUnpaid = Math.round((unpaidCount / totalStatusCount) * 100);
      const pWaived = Math.max(0, 100 - pPaid - pPartial - pUnpaid);
      statusDonutData = {
        total: totalStatusCount,
        chartData: [
          { name: "Paid Invoices", value: paidCount, color: "#10b981", percent: pPaid },
          { name: "Partial Invoices", value: partialCount, color: "#f59e0b", percent: pPartial },
          { name: "Unpaid Invoices", value: unpaidCount, color: "#ef4444", percent: pUnpaid },
          { name: "Waived Invoices", value: waivedCount, color: "#3b82f6", percent: pWaived },
        ],
      };
    }

    // 8. Category Breakdown
    const catColors: Record<string, string> = {
      "Tuition Fee": "#3b82f6",
      "Computer Fee": "#a855f7",
      "Admission Fee": "#14b8a6",
      "Library Fee": "#f59e0b",
      "Exam Fee": "#ec4899",
      Others: "#94a3b8",
    };
    const categoryBreakdown = {
      total: totalCatAmt,
      items: Object.entries(catMap)
        .map(([name, amount]) => ({
          name,
          amount,
          percent: totalCatAmt > 0 ? Math.round((amount / totalCatAmt) * 100) : 0,
          color: catColors[name] || "#94a3b8",
        }))
        .sort((a, b) => b.amount - a.amount),
    };

    // 9. Daily Trend Data (L4 - No synthetic slopes)
    const endDay = Math.max(1, Math.min(todayDay, maxDays));
    const candidateDays = [1, 5, 10, 15, 20, 25, 30];
    const days = candidateDays.filter((d) => d < endDay);
    if (!days.includes(endDay)) {
      days.push(endDay);
    }
    const currentMonthPayments = allPmts.filter((p) => p.year === curY && p.month === curM);
    let dailyTrendData;
    if (currentMonthPayments.length === 0) {
      dailyTrendData = days.map((d) => ({ day: d, amount: 0 }));
    } else {
      let runningTotal = 0;
      const dayMap: Record<number, number> = {};
      for (let d = 1; d <= endDay; d++) {
        const dayAmt = currentMonthPayments
          .filter((p) => p.day === d)
          .reduce((sum, p) => sum + p.amount, 0);
        runningTotal += dayAmt;
        dayMap[d] = runningTotal;
      }
      dailyTrendData = days.map((d) => ({
        day: d,
        amount: dayMap[d] ?? 0,
      }));
    }

    // 10. Top Classes
    const rankColors = ["#3b82f6", "#a855f7", "#10b981", "#f59e0b", "#ef4444"];
    const classEntries = Object.entries(classMap);
    const totalTop = classEntries.reduce((acc, [, val]) => acc + val, 0);
    const topClasses = classEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount], idx) => ({
        name,
        amount,
        percent: totalTop > 0 ? Math.round((amount / totalTop) * 100) : 0,
        color: rankColors[idx] || "#94a3b8",
      }));

    return {
      distinctStudentsWithDues: duesStudentsSet.size,
      card1Badge,
      card2Badge,
      card3Badge,
      card4Badge,
      activeMonthName: mName,
      overviewBarData,
      statusDonutData,
      categoryBreakdown,
      dailyTrendData,
      topClasses,
    };
  }, [collections, recentPayments, apiResult, isBS, collectionOverviewPeriod, totalPaid, totalPending, collectionRate, totalBillVolume]);

  // ── 7. Handle Send Fee Reminders (L6 / N6) ──
  const handleSendReminders = async () => {
    if (distinctStudentsWithDues === 0) {
      return dispatch(
        showToast({
          type: "info",
          title: "All Dues Cleared",
          message: "There are currently no students with pending fee dues.",
        })
      );
    }
    try {
      setSendingReminders(true);
      await apiRequest('/notices/admin', {
        method: 'POST',
        body: JSON.stringify({
          title: `Fee Due Reminder - ${activeMonthName}`,
          content: `Important notice for students and parents: Fee collections for the current academic session are ongoing. There are currently outstanding balances for ${distinctStudentsWithDues} student accounts. Please ensure timely fee settlement at the school finance counter or online.`,
          is_pinned: true,
        }),
      });
      dispatch(
        showToast({
          type: "success",
          title: "Announcement Published",
          message: `Official fee reminder announcement posted to the notice board for students and parents regarding ${distinctStudentsWithDues} accounts with pending dues.`,
        })
      );
    } catch (err: any) {
      dispatch(
        showToast({
          type: "error",
          title: "Failed to publish notice",
          message: err?.message || "Could not post fee reminder announcement.",
        })
      );
    } finally {
      setSendingReminders(false);
    }
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

      {/* ── Large Ledger Transparency Notice (N5) ── */}
      {collections.length >= 2000 && (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 10,
            padding: "10px 16px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            color: "#1e40af",
          }}
        >
          <i className="fa-solid fa-circle-info" style={{ color: "#3b82f6" }} />
          <span>
            <strong>Large Session Ledger:</strong> Breakdown charts reflect the latest 2,000 collections. Aggregate summary metrics at the top account for the entire academic session.
          </span>
        </div>
      )}

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
            <h4 className={styles.calloutTitle}>Publish Fee Reminders Announcement</h4>
            <p className={styles.calloutDesc}>
              Post an official fee due notice to the school notice board for the {distinctStudentsWithDues} students with unpaid balances.
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
              <i className="fa-solid fa-spinner fa-spin" /> Publishing…
            </>
          ) : (
            <>
              <i className="fa-solid fa-bullhorn" /> Post Notice Board Reminder
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
