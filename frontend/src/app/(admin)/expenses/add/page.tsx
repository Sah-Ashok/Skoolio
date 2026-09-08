"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import AddExpensePage from "@/components/admin/expenses/AddExpensePage";
import Loader from "@/components/shared/Loader";

export default function AddExpenseRoutePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    if (user && user.role === "admin") {
      dispatch(showToast({
        type: "warning",
        title: "Access Restricted",
        message: "Expense entries must be recorded through the Finance portal.",
      }));
      router.replace("/expenses");
    }
  }, [user, router, dispatch]);

  if (user?.role === "admin") {
    return <Loader fullScreen={false} size="md" text="Redirecting to Expenses..." />;
  }

  return <AddExpensePage />;
}

