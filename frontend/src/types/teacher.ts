export type Teacher = {
  id: string;
  name: string;
  department?: string;
  role?: "teacher" | "faculty" | "staff";
};
