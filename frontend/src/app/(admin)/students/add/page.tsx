"use client";

import Topbar from "@/components/shared/Topbar";
import AddStudentForm from "@/components/admin/students/AddStudentForm";
import styles from "@/components/admin/students/students.module.css";

const s = (className: string) => styles[className] || className;

export default function AddStudentRoute() {
  return (
    <div className={s("students-page")}>
      <Topbar title="Add Student" subtitle="Create a new student admission and class enrollment" />
      <main className={s("page-content")}>
        <section className={s("page-head")}>
          <div>
            <h1>Add Student</h1>
            <p>Create the student record, then enroll them into a class and section.</p>
          </div>
        </section>
        <AddStudentForm />
      </main>
    </div>
  );
}
