export type Fee = {
  id: string;
  studentId: string;
  title: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
};
